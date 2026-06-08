// SCM Master dashboard server — serves the cockpit + a live /api/data proxy.
// Runs on Railway (or locally). Logs into the SCM API server-side (no browser CORS),
// caches the data, and refreshes it on an interval so the board stays current.
const http = require("http");
const fs = require("fs");
const path = require("path");

const API   = process.env.API_BASE || "https://scm-master-production.up.railway.app";
const USER  = process.env.API_USER || "admin@example.com";
const PASS  = process.env.API_PASS || "admin";
const PORT  = process.env.PORT || 8080;
const REFRESH_MS = (process.env.REFRESH_SECONDS ? +process.env.REFRESH_SECONDS : 300) * 1000;

// Cache keyed by year ("all" for the unfiltered total). Each entry is the full
// dashboard payload scoped to that year, so the sticky year selector just swaps
// which cached payload the board reads — no per-click backend round-trip.
let cacheByYear = {};            // { all: {...}, 2026: {...}, 2025: {...} }
let yearsList = [];              // [2026, 2025] — drives the selector
let lastError = null;
let lastGeneratedAt = null;

async function login() {
  const body = new URLSearchParams({ grant_type: "password", username: USER, password: PASS });
  const r = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!r.ok) throw new Error(`login ${r.status}`);
  const j = await r.json();
  return j.access_token;
}

async function getJSON(token, p) {
  const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  return r.json();
}
async function getCSV(token, p) {
  const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  const text = await r.text();
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(",");
  return lines.slice(1).map(line => {
    const cells = line.split(",");
    const o = {}; head.forEach((h, i) => o[h] = cells[i]); return o;
  });
}

// Best-effort fetch: returns `fallback` (and logs) instead of throwing, so one
// flaky non-critical endpoint can't blank the whole dashboard.
async function safe(label, p, fallback) {
  try { return await p; }
  catch (e) { console.warn(`[refresh] non-critical '${label}' failed: ${e.message || e} — using fallback`); return fallback; }
}

// Spend is the only year-scoped dimension (it's an over-time flow). Inventory,
// forecast, should-cost and TCO are current-state snapshots — they're the same
// regardless of the selected year, so we fetch them once and share them.
async function fetchSpend(token, year) {
  const q = year == null ? "" : `?year=${year}`;
  const [byCat, bySup, byProd, spendTotal] = await Promise.all([
    getJSON(token, `/api/v1/analytics/spend/by-category${q}`),
    getJSON(token, `/api/v1/analytics/spend/by-supplier${q}`),
    getJSON(token, `/api/v1/analytics/spend/by-product${q}`),
    getJSON(token, `/api/v1/analytics/spend${q}`),
  ]);
  return { byCat, bySup, byProd, spendTotal };
}

async function refresh() {
  try {
    const token = await login();
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

    // Which years have data? Tolerate an older backend (no /years route) by
    // falling back to all-time only.
    const years = await safe("spend/years", getJSON(token, "/api/v1/analytics/spend/years"), []);

    // Shared, non-year-scoped snapshots.
    const inventory = await getJSON(token, "/api/v1/planning/inventory");
    const forecast = await getCSV(token, "/api/v1/analytics/exports/forecast-accuracy.csv");
    // AI insights are nice-to-have — never let a 502 here take down the board.
    const insights = await safe("agent/insights", getJSON(token, "/api/v1/agent/insights"), []);
    // Should-cost is new — tolerate an older backend that lacks the endpoints.
    const shouldCostSavings = await safe("should-cost/savings",
      getJSON(token, "/api/v1/analytics/should-cost/savings"), null);
    const shouldCostBySupplier = await safe("should-cost/by-supplier",
      getJSON(token, "/api/v1/analytics/should-cost/by-supplier"), []);
    // TCO is new — tolerate a backend that lacks the endpoints (renders empty).
    const tcoByClass = await safe("tco/by-class",
      getJSON(token, "/api/v1/tco/by-class"), []);
    const tcoPortfolio = await safe("tco/portfolio",
      getJSON(token, "/api/v1/tco/portfolio?baseline=50000000"), null);

    // Build one full payload per scope: "all" + each year that has data.
    const scopes = [null, ...years];
    const spendByScope = await Promise.all(scopes.map(y => fetchSpend(token, y)));

    const next = {};
    scopes.forEach((y, i) => {
      const sp = spendByScope[i];
      next[y == null ? "all" : String(y)] = {
        generated_at: stamp,
        year: y,                 // null = all-time
        years,                   // full list, so the client can build the selector
        spend_by_category: sp.byCat, spend_by_supplier: sp.bySup,
        spend_by_product: sp.byProd, spend_total: sp.spendTotal,
        inventory, insights, forecast,
        should_cost_savings: shouldCostSavings, should_cost_by_supplier: shouldCostBySupplier,
        tco_by_class: tcoByClass, tco_portfolio: tcoPortfolio,
      };
    });

    cacheByYear = next;
    yearsList = years;
    lastGeneratedAt = stamp;
    lastError = null;
    console.log(`[refresh] ok @ ${stamp} (years: ${years.join(", ") || "none"}; `
      + `${forecast.length} forecast rows, ${shouldCostBySupplier.length} should-cost rows, `
      + `${tcoByClass.length} tco classes)`);
  } catch (e) {
    lastError = String(e.message || e);
    console.error("[refresh] FAILED:", lastError);
  }
}

const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json" };

const server = http.createServer(async (req, res) => {
  const [url, query] = req.url.split("?");

  if (url === "/api/data") {
    if (!Object.keys(cacheByYear).length) await refresh();
    // ?year=YYYY selects a scope; anything else (incl. "all" / missing) = all-time.
    const yr = new URLSearchParams(query || "").get("year");
    const key = yr && cacheByYear[yr] ? yr : "all";
    const payload = cacheByYear[key];
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(payload || { error: lastError, years: yearsList }));
    return;
  }
  if (url === "/healthz") { res.writeHead(200); res.end("ok"); return; }

  // static files from this folder
  let file = url === "/" ? "/index.html" : url;
  const full = path.join(__dirname, path.normalize(file).replace(/^(\.\.[\/\\])+/, ""));
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(full)] || "application/octet-stream" });
    res.end(buf);
  });
});

refresh().then(() => {
  setInterval(refresh, REFRESH_MS);
  server.listen(PORT, () => console.log(`SCM dashboard on :${PORT} (refresh every ${REFRESH_MS / 1000}s)`));
});
