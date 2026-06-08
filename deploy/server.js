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
// AI insights call the LLM, so they're the only refresh step that costs tokens.
// They reason over slowly-changing analytics, so re-running them every data
// refresh (every 5 min = 288 calls/day) burns tokens for no new information.
// Refresh them on their OWN, much slower clock and reuse the last good set in
// between — cutting agent calls ~97% (288/day -> ~8/day at the 3h default).
const INSIGHTS_TTL_MS = (process.env.INSIGHTS_TTL_SECONDS ? +process.env.INSIGHTS_TTL_SECONDS : 10800) * 1000;

let cache = { generated_at: null, data: null, error: null };
// Last successfully-fetched insights + when, so we only re-call the LLM when stale.
let insightsCache = { at: 0, value: [] };

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

async function refresh() {
  try {
    const token = await login();
    const [byCat, bySup, byProd, spendTotal, inventory, forecast] = await Promise.all([
      getJSON(token, "/api/v1/analytics/spend/by-category"),
      getJSON(token, "/api/v1/analytics/spend/by-supplier"),
      getJSON(token, "/api/v1/analytics/spend/by-product"),
      getJSON(token, "/api/v1/analytics/spend"),
      getJSON(token, "/api/v1/planning/inventory"),
      getCSV(token, "/api/v1/analytics/exports/forecast-accuracy.csv"),
    ]);
    // AI insights are nice-to-have AND token-costed, so fetch them only when the
    // cache is stale (every INSIGHTS_TTL_MS, not every data refresh). Between
    // refreshes we reuse the last good set. A 502 (e.g. no API credit) just keeps
    // whatever we last had — never takes down the board.
    let insights = insightsCache.value;
    if (Date.now() - insightsCache.at >= INSIGHTS_TTL_MS) {
      const fresh = await safe("agent/insights", getJSON(token, "/api/v1/agent/insights"), null);
      if (fresh && fresh.length) {            // only advance the cache on a real result
        insights = fresh;
        insightsCache = { at: Date.now(), value: fresh };
      } else {
        insightsCache.at = Date.now();        // back off a full TTL before retrying a failing call
      }
    }
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
    cache = {
      generated_at: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
      error: null,
      data: {
        generated_at: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
        spend_by_category: byCat, spend_by_supplier: bySup, spend_by_product: byProd,
        spend_total: spendTotal, inventory, insights, forecast,
        should_cost_savings: shouldCostSavings, should_cost_by_supplier: shouldCostBySupplier,
        tco_by_class: tcoByClass, tco_portfolio: tcoPortfolio,
      }
    };
    const insightsAgeMin = Math.round((Date.now() - insightsCache.at) / 60000);
    console.log(`[refresh] ok @ ${cache.generated_at} (${forecast.length} forecast rows, `
      + `${shouldCostBySupplier.length} should-cost rows, ${tcoByClass.length} tco classes, `
      + `${insights.length} insights age ${insightsAgeMin}m)`);
  } catch (e) {
    cache.error = String(e.message || e);
    console.error("[refresh] FAILED:", cache.error);
  }
}

const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json" };

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  if (url === "/api/data") {
    if (!cache.data) await refresh();
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(cache.data || { error: cache.error }));
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
