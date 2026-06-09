// SCM Master dashboard server — serves the cockpit + a live /api/data proxy.
// Runs on Railway (or locally). Logs into the SCM API server-side (no browser CORS),
// caches the data, and refreshes it on an interval so the board stays current.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { buildInsights } = require("./insights");

// Forecast accuracy = 1 − WMAPE (weighted MAPE) over the backtest rows. WMAPE
// weights error by volume, so big SKUs dominate — the honest portfolio number.
// Deterministic, no LLM. Returns null if there's nothing to score.
function wmapeAccuracy(rows) {
  let absErr = 0, actual = 0;
  for (const r of rows || []) {
    absErr += Math.abs(+r.abs_error || 0);
    actual += Math.abs(+r.actual_demand || 0);
  }
  if (actual <= 0) return null;
  return Math.max(0, 1 - absErr / actual);
}

const API   = process.env.API_BASE || "https://scm-master-production.up.railway.app";
const USER  = process.env.API_USER || "admin@example.com";
const PASS  = process.env.API_PASS || "admin";
const PORT  = process.env.PORT || 8080;
// Autonomy tab: real PO placing is OFF by default. The proxy forces dry_run=true
// unless this flag is explicitly set, so the cockpit can never place live POs by
// accident — even if a request asks for it.
const ALLOW_LIVE_PLACE = process.env.ALLOW_LIVE_PLACE === "true";
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
    // Forward warehouse capacity: free space net of inbound already on the way, so
    // the cockpit can show committed vs free as a % of max and block over-ordering.
    const storageHeadroom = await safe("storage-headroom",
      getJSON(token, "/api/v1/planning/storage-headroom"), null);
    // The one capacity-vs-flow metric: committed/free %, in/out flow, coverage.
    const capacityFlow = await safe("capacity-flow",
      getJSON(token, "/api/v1/planning/capacity-flow"), null);

    // Per-year spend, so the Spend/Sourcing scorecards can slice by year (backend
    // supports ?year=). Fetched upfront per available year and cached, so a year
    // click reslices client-side with no per-click server round-trip. Small data.
    const spendYears = await safe("spend/years",
      getJSON(token, "/api/v1/analytics/spend/years"), []);
    const spendByYear = {};
    for (const y of (spendYears || [])) {
      const [c, s, p, t] = await Promise.all([
        safe(`spend/by-category/${y}`, getJSON(token, `/api/v1/analytics/spend/by-category?year=${y}`), []),
        safe(`spend/by-supplier/${y}`, getJSON(token, `/api/v1/analytics/spend/by-supplier?year=${y}`), []),
        safe(`spend/by-product/${y}`, getJSON(token, `/api/v1/analytics/spend/by-product?year=${y}`), []),
        safe(`spend/${y}`, getJSON(token, `/api/v1/analytics/spend?year=${y}`), null),
      ]);
      spendByYear[y] = { by_category: c, by_supplier: s, by_product: p, total: t };
    }

    // Forecast accuracy = 1 − WMAPE over the backtest rows (deterministic, no LLM).
    const forecastAccuracy = wmapeAccuracy(forecast);

    // Deterministic, zero-token insights from the data above. These refresh every
    // cycle for free; the LLM commentary (on demand) narrates OVER these.
    const ruleInsights = buildInsights({
      spend_by_supplier: bySup, spend_by_category: byCat, inventory,
      tco_by_class: tcoByClass, should_cost_savings: shouldCostSavings,
      forecast_accuracy: forecastAccuracy,
    });

    cache = {
      generated_at: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
      error: null,
      data: {
        generated_at: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
        spend_by_category: byCat, spend_by_supplier: bySup, spend_by_product: byProd,
        spend_total: spendTotal, inventory, insights, forecast,
        rule_insights: ruleInsights, forecast_accuracy: forecastAccuracy,
        should_cost_savings: shouldCostSavings, should_cost_by_supplier: shouldCostBySupplier,
        tco_by_class: tcoByClass, tco_portfolio: tcoPortfolio,
        storage_headroom: storageHeadroom, capacity_flow: capacityFlow,
        spend_years: spendYears, spend_by_year: spendByYear,
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

  // On-demand AI commentary: the browser POSTs the deterministic findings here,
  // we forward them to the SCM API server-side (so the token never reaches the
  // client). One LLM call per click; the backend rate-limits per day.
  if (url === "/api/commentary" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 64 * 1024) req.destroy(); });
    req.on("end", async () => {
      try {
        const token = await login();
        const r = await fetch(`${API}/api/v1/agent/commentary`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body,
        });
        const text = await r.text();
        res.writeHead(r.status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(text);
      } catch (e) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ detail: String(e.message || e) }));
      }
    });
    return;
  }

  // ---- Autonomy tab: the decision loop + the persistent audit trail ----------
  // Every branch reuses the service-account token, wraps the upstream call in
  // safe() (a flaky agent endpoint degrades to a fallback, never a 500), and
  // does NOT touch the /api/data batch above.

  // The persistent decision audit trail (GET). Optional ?tier=&product_id=… pass
  // straight through to /agent/decisions.
  if (url === "/api/decisions") {
    const token = await login().catch(() => null);
    const qs = (req.url.split("?")[1] || "");
    const rows = await safe("decisions",
      token ? getJSON(token, `/api/v1/agent/decisions${qs ? "?" + qs : ""}`) : Promise.reject(new Error("no token")),
      []);
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(rows));
    return;
  }

  // One decision by id (drill-in): /api/decision?id=<uuid> -> /agent/decisions/{id}.
  if (url === "/api/decision") {
    const token = await login().catch(() => null);
    const id = new URLSearchParams(req.url.split("?")[1] || "").get("id") || "";
    const row = await safe("decision",
      token && id ? getJSON(token, `/api/v1/agent/decisions/${encodeURIComponent(id)}`) : Promise.reject(new Error("no id/token")),
      null);
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(row || { error: "not found" }));
    return;
  }

  // Should-cost gap for a product (price-in-band check on the live gate view).
  if (url === "/api/cost-gap") {
    const token = await login().catch(() => null);
    const id = new URLSearchParams(req.url.split("?")[1] || "").get("id") || "";
    const gap = await safe("cost-gap",
      token && id ? getJSON(token, `/api/v1/products/${encodeURIComponent(id)}/cost-gap`) : Promise.reject(new Error("no id/token")),
      null);
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(gap || { error: "unavailable" }));
    return;
  }

  // Run the decision gate (POST). dry_run defaults TRUE; real placing only when
  // the server-side ALLOW_LIVE_PLACE flag is set — a client can never force it.
  if (url === "/api/purchasing-run" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 16 * 1024) req.destroy(); });
    req.on("end", async () => {
      let asked = {};
      try { asked = body ? JSON.parse(body) : {}; } catch (_) { asked = {}; }
      // Fail-closed: live placing requires BOTH the env flag and an explicit
      // dry_run:false from the caller; otherwise force dry_run=true.
      const dry_run = ALLOW_LIVE_PLACE ? (asked.dry_run !== false ? true : false) : true;
      const payload = { dry_run, period_days: Number(asked.period_days) || 7 };
      const token = await login().catch(() => null);
      const result = await safe("purchasing-run",
        token ? fetch(`${API}/api/v1/agent/purchasing-run`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(r => r.ok ? r.json() : Promise.reject(new Error(`purchasing-run ${r.status}`)))
          : Promise.reject(new Error("no token")),
        null);
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(result || { error: "run unavailable", dry_run }));
    });
    return;
  }

  // static files from this folder
  let file = url === "/" ? "/index.html" : url;
  const full = path.join(__dirname, path.normalize(file).replace(/^(\.\.[\/\\])+/, ""));
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    // The dashboard markup carries the inline app JS, so a stale cached index.html
    // pins old behaviour (e.g. the year filter not reaching every KPI). Force the
    // browser to revalidate HTML every load; other assets may cache normally.
    const ext = path.extname(full);
    const headers = { "Content-Type": TYPES[ext] || "application/octet-stream" };
    if (ext === ".html") headers["Cache-Control"] = "no-cache, must-revalidate";
    res.writeHead(200, headers);
    res.end(buf);
  });
});

refresh().then(() => {
  setInterval(refresh, REFRESH_MS);
  server.listen(PORT, () => console.log(`SCM dashboard on :${PORT} (refresh every ${REFRESH_MS / 1000}s)`));
});
