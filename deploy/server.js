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
// No single call may hold a refresh open. Aborting the client does NOT stop the server
// working on it, so this is a seatbelt, not a fix: the fix is never to ask an endpoint
// for something it cannot answer quickly. See TCO_ENABLED below.
const FETCH_TIMEOUT_MS = (process.env.FETCH_TIMEOUT_SECONDS ? +process.env.FETCH_TIMEOUT_SECONDS : 20) * 1000;
// The per-asset TCO endpoints walk the whole asset table and hold it in memory. Against
// the datacenter demo of about a thousand assets that was fine. Against the device fleet
// of 431,200 serials, /tco/portfolio takes over nine minutes and the container runs out
// of memory: on 23.09.2026 this cockpit was taking the demo API down every five minutes,
// by asking it politely, on schedule. A dashboard must never be able to kill the system
// it reports on. So these two calls are OFF until the backend has a read that aggregates
// in the database; TCO_ENABLED=1 turns them back on once it does.
const TCO_ENABLED = process.env.TCO_ENABLED === "1";
// AI insights call the LLM, so they're the only refresh step that costs tokens.
// They reason over slowly-changing analytics, so re-running them every data
// refresh (every 5 min = 288 calls/day) burns tokens for no new information.
// Refresh them on their OWN, much slower clock and reuse the last good set in
// between — cutting agent calls ~97% (288/day -> ~8/day at the 3h default).
const INSIGHTS_TTL_MS = (process.env.INSIGHTS_TTL_SECONDS ? +process.env.INSIGHTS_TTL_SECONDS : 10800) * 1000;

let cache = { generated_at: null, data: null, error: null };
// Last successfully-fetched insights + when, so we only re-call the LLM when stale.
let insightsCache = { at: 0, value: [] };
// Last good KPI list. The backend measures its 32 KPIs once a day and serves the day's
// snapshot, so the read is cheap when warm (about 50 ms) but the first read of a day
// takes the measurement (10 s against the demo fleet). A read that times out keeps the
// last good list rather than blanking the KPIs tab.
let kpisCache = [];
// The day each KPI was first measured, by id. The list endpoint cuts each history at the
// last 60 snapshots, so after two months it no longer says when a KPI was first measured,
// and that day anchors the year marks on the KPIs tab. The history endpoint is uncapped:
// ask it once per KPI whose served history may be cut, and keep the answer (a first
// measurement never changes).
const firstMeasured = {};

async function withFirstMeasured(token, rows) {
  const out = [];
  for (const k of rows) {
    const served = (k.history || []).filter(h => h && h.value != null);
    let first = served.length ? served[0] : null;
    if ((k.history || []).length >= 60) {
      if (!firstMeasured[k.id]) {
        const all = await safe(`kpis/${k.id}/history`,
          getJSON(token, `/api/v1/kpis/${encodeURIComponent(k.id)}/history?days=3650`), null);
        const pts = (all || []).filter(h => h && h.value != null);
        if (pts.length) firstMeasured[k.id] = pts[0];
      }
      if (firstMeasured[k.id]) first = firstMeasured[k.id];
    }
    out.push({ ...k, first_measured: first });
  }
  return out;
}

// The warehouse block on the Overview tab: the nine compartments of the device cycle,
// each with its own capacity. The list is one grouped read. A compartment's inbound
// (the open order lines destined for it, with their ETAs) lives only in its contents
// read, and whether space is filling or draining is what the owner asked to see, so
// all nine contents are read on every refresh, in parallel, each behind safe() and the
// fetch timeout. Measured against the demo fleet on 25.09.2026: 0.2 s for the list,
// 0.16 to 0.39 s per contents read, 12 to 17 KB each; every breakdown is a grouped
// query on the backend and nothing walks the asset table (unlike TCO, above). Only
// the fields the page draws are kept, so /api/data does not grow by 120 KB.
function trimContents(c) {
  if (!c || typeof c !== "object") return null;
  const inb = c.inbound || {};
  return {
    code: c.code, as_of: c.as_of, on_hand: c.on_hand, capacity: c.capacity, free: c.free,
    overflow: c.overflow, undated_units: c.undated_units,
    by_class: (c.by_class || []).map(b => ({ key: b.key, label: b.label, units: b.units, share: b.share })),
    by_model: (c.by_model || []).map(m => ({ product_id: m.product_id, name: m.name, family: m.family, units: m.units, share: m.share })),
    inbound: {
      units: inb.units ?? 0, late_units: inb.late_units ?? 0, late_lines: inb.late_lines ?? 0,
      lines: (inb.lines || []).length, next_eta: inb.next_eta ?? null, last_eta: inb.last_eta ?? null,
      committed: inb.committed ?? null, committed_share: inb.committed_share ?? null,
      reason: inb.reason ?? null, basis: inb.basis ?? null,
      by_model: (inb.by_model || []).map(m => ({ product_id: m.product_id, name: m.name, units: m.units, late_units: m.late_units, next_eta: m.next_eta })),
    },
  };
}

async function warehouseContents(token, list) {
  const codes = ((list && list.compartments) || []).map(c => c.code).filter(Boolean);
  if (!codes.length) return {};
  const reads = await Promise.all(codes.map(code =>
    safe(`warehouse/${code}/contents`, getJSON(token, `/api/v1/warehouse/compartments/${encodeURIComponent(code)}/contents`), null)));
  const out = {};
  codes.forEach((code, i) => { const t = trimContents(reads[i]); if (t) out[code] = t; });
  return out;
}

// Which supplier a model was bought from, read off the purchase orders (the order
// carries the supplier, its lines the model). The compartments count devices by model,
// not by supplier, so this is the only honest way to say how much of a compartment a
// supplier's devices occupy. A model bought from more than one supplier is listed
// under each, and the page leaves such a model out and says so.
function suppliersByProduct(orders, bySupplier) {
  const name = {};
  for (const s of bySupplier || []) name[s.supplier_id] = s.supplier_name;
  const out = {};
  for (const o of orders || []) {
    const sup = name[o.supplier_id] || null;
    if (!sup) continue;
    for (const it of o.items || []) {
      if (!it.product_id) continue;
      (out[it.product_id] = out[it.product_id] || []);
      if (!out[it.product_id].includes(sup)) out[it.product_id].push(sup);
    }
  }
  return out;
}

// The token is cached. Every refresh and every on-demand route used to log in again,
// and the API rate-limits login to 10 attempts per IP per 5 minutes (LOGIN_RATE_LIMIT /
// LOGIN_RATE_WINDOW_SECONDS): clicking through Orders, Autonomy, Movements and
// Simulation inside one window, with the background refresh also logging in, reaches ten
// without trying. A token is good for 8 hours, so holding one for 30 minutes is well
// inside its life and takes the cockpit from dozens of logins an hour to two. Concurrent
// callers share the in-flight promise, so a burst of routes is one login, not six.
const TOKEN_TTL_MS = 30 * 60 * 1000;
let tokenCache = { value: null, until: 0, inFlight: null };

async function login() {
  const now = Date.now();
  if (tokenCache.value && now < tokenCache.until) return tokenCache.value;
  if (tokenCache.inFlight) return tokenCache.inFlight;
  tokenCache.inFlight = (async () => {
    const body = new URLSearchParams({ grant_type: "password", username: USER, password: PASS });
    const r = await fetch(`${API}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!r.ok) throw new Error(`login ${r.status}`);
    const j = await r.json();
    tokenCache = { value: j.access_token, until: Date.now() + TOKEN_TTL_MS, inFlight: null };
    return j.access_token;
  })().catch(e => { tokenCache.inFlight = null; throw e; });
  return tokenCache.inFlight;
}

// A cached token that the API no longer accepts (restarted backend, rotated password,
// changed secret) must not be handed out for the rest of its TTL. Anything that sees a
// 401 drops it, and the next call logs in again.
function forgetToken() { tokenCache = { value: null, until: 0, inFlight: null }; }

async function getJSON(token, p) {
  const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (r.status === 401) forgetToken();
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  return r.json();
}
async function getCSV(token, p) {
  const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (r.status === 401) forgetToken();
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

// A forced refresh shares whatever run is already going, so a row of clicks (or a click
// during the scheduled tick) is one pass over the API, not five.
let refreshInFlight = null;
function refreshOnce() {
  if (!refreshInFlight) refreshInFlight = refresh().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
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
    // Off by default: see TCO_ENABLED above for why asking cost the demo its uptime.
    const tcoByClass = TCO_ENABLED
      ? await safe("tco/by-class", getJSON(token, "/api/v1/tco/by-class"), [])
      : [];
    const tcoPortfolio = TCO_ENABLED
      ? await safe("tco/portfolio", getJSON(token, "/api/v1/tco/portfolio?baseline=50000000"), null)
      : null;
    // Forward warehouse capacity: free space net of inbound already on the way, so
    // the cockpit can show committed vs free as a % of max and block over-ordering.
    const storageHeadroom = await safe("storage-headroom",
      getJSON(token, "/api/v1/planning/storage-headroom"), null);
    // The one capacity-vs-flow metric: committed/free %, in/out flow, coverage.
    const capacityFlow = await safe("capacity-flow",
      getJSON(token, "/api/v1/planning/capacity-flow"), null);
    // Warehouse compartments (Overview): the list, then the nine contents in parallel
    // for what is on its way into each, and the purchase orders for which supplier a
    // model came from. See trimContents above for the cost and why all nine are read.
    // A deployment without these endpoints (or an empty database) yields null and the
    // block hides itself.
    const whT0 = Date.now();
    const warehouseCompartments = await safe("warehouse/compartments",
      getJSON(token, "/api/v1/warehouse/compartments"), null);
    const warehouseContentsByCode = await warehouseContents(token, warehouseCompartments);
    const ordersForSuppliers = warehouseCompartments
      ? await safe("purchase-orders", getJSON(token, "/api/v1/purchase-orders?limit=2000"), [])
      : [];
    const productSuppliersFromOrders = suppliersByProduct(ordersForSuppliers, bySup);
    const whMs = Date.now() - whT0;

    // KPIs tab: the backend's steering KPIs (value, yearly targets, status, daily history).
    // Only a real list advances the cache; see kpisCache above.
    const kpisFresh = await safe("kpis", getJSON(token, "/api/v1/kpis"), null);
    if (Array.isArray(kpisFresh) && kpisFresh.length) kpisCache = kpisFresh;
    const kpis = await withFirstMeasured(token, kpisCache);
    // The fleet the KPIs serve: the owner's milestones and the month-by-month path to
    // them. /capacity-plan is in the backend source but not on every deployment yet (the
    // demo answered 404 on 24.09.2026); until it is served the page derives the same
    // straight-line path from /fleet/summary and says so on screen.
    const capacityPlan = await safe("capacity-plan", getJSON(token, "/api/v1/capacity-plan"), null);
    const fleetSummary = await safe("fleet/summary", getJSON(token, "/api/v1/fleet/summary"), null);

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
        kpis, capacity_plan: capacityPlan, fleet_summary: fleetSummary,
        warehouse_compartments: warehouseCompartments,
        warehouse_contents: warehouseContentsByCode,
        product_suppliers_from_orders: productSuppliersFromOrders,
      }
    };
    const insightsAgeMin = Math.round((Date.now() - insightsCache.at) / 60000);
    const whN = warehouseCompartments && warehouseCompartments.compartments ? warehouseCompartments.compartments.length : 0;
    console.log(`[refresh] ok @ ${cache.generated_at} (${forecast.length} forecast rows, `
      + `${shouldCostBySupplier.length} should-cost rows, ${tcoByClass.length} tco classes, `
      + `${insights.length} insights age ${insightsAgeMin}m, ${kpis.length} kpis, `
      + `capacity plan ${capacityPlan ? "served" : "not served"}, fleet summary ${fleetSummary ? "served" : "not served"}, `
      + `warehouse ${whN} compartments / ${Object.keys(warehouseContentsByCode).length} contents / `
      + `${Object.keys(productSuppliersFromOrders).length} models with a supplier in ${whMs} ms)`);
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
  // Re-read the API now instead of waiting for the next scheduled tick. The reason it
  // exists: a capacity or a stock change made in the console (extra places on a
  // compartment, a delivery, a batch of returns) is invisible here for up to five
  // minutes otherwise, and "live tracking" that lags five minutes behind the thing it
  // tracks is not live. Read-only — it only makes this process fetch again.
  if (url === "/api/refresh" && req.method === "POST") {
    let body;
    try {
      await refreshOnce();
      body = cache.error ? { ok: false, error: cache.error }
                         : { ok: true, generated_at: cache.generated_at };
    } catch (e) {
      body = { ok: false, error: String(e && e.message || e) };
    }
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
    return;
  }

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
        }).then(async r => r.ok ? r.json()
          // A refusal is an answer the page must show as such (the gate needs the
          // PROCUREMENT role; a viewer account gets 403), not "no decision".
          : ({ error: `purchasing-run ${r.status}`, status: r.status, detail: (await r.text().catch(() => "")).slice(0, 300), dry_run }))
          : Promise.reject(new Error("no token")),
        null);
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(result || { error: "run unavailable", dry_run }));
    });
    return;
  }

  // ---- Orders tab: PO list + contents + per-PO capacity coverage ------------
  // Reuses the service token; safe()-wrapped. Joins purchase orders (with their
  // line items) to product names and the inventory-position model so each PO
  // can show what it contains AND how much outstanding demand it covers.
  if (url === "/api/orders") {
    const token = await login().catch(() => null);
    const [orders, products, position, tracking] = await Promise.all([
      safe("orders", token ? getJSON(token, "/api/v1/purchase-orders?limit=500") : Promise.reject(new Error("no token")), []),
      safe("products", token ? getJSON(token, "/api/v1/products?limit=500") : Promise.reject(new Error("no token")), []),
      safe("position", token ? getJSON(token, "/api/v1/planning/inventory-position") : Promise.reject(new Error("no token")), []),
      safe("tracking", token ? getJSON(token, "/api/v1/v_order_tracking") : Promise.reject(new Error("no token")), []),
    ]);
    const pname = {}; (products || []).forEach((p) => { pname[p.id] = p.name || p.product_code; });
    // outstanding net requirement per product (what's still missing) for coverage.
    const need = {}; (position || []).forEach((r) => { need[r.product_id] = r.net_requirement || 0; });
    // shipment tracking by PO: promised vs now ETA + slip (delivery performance).
    const trk = {}; (tracking || []).forEach((t) => { trk[t.po_id] = t; });
    const enriched = (orders || []).map((o) => {
    const t = trk[o.order_number] || null;
    return {
      order_number: o.order_number, status: o.status, supplier_id: o.supplier_id,
      date_ordered: o.date_ordered, currency_code: o.currency_code,
      // delivery performance (from v_order_tracking; null when no shipment record):
      eta_promised: t ? t.eta_original : null,
      eta_actual: t ? t.eta_current : null,
      delay_days: t ? t.delay_days : null,
      track_status: t ? t.current_status : null,
      items: (o.items || []).map((it) => ({
        product_id: it.product_id, name: pname[it.product_id] || it.product_id,
        quantity: it.quantity, unit_price: it.unit_price != null ? Number(it.unit_price) : null,
        eta: it.estimated_delivery_date, delivered: it.actual_delivery_date,
        // how much of this product's still-outstanding need this line helps cover.
        covers_outstanding: Math.min(it.quantity, need[it.product_id] || 0),
      })),
    };
    });
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(enriched));
    return;
  }

  // static files from this folder — resolve then CONTAIN: reject anything that escapes
  // __dirname (path traversal). The old prefix-strip regex missed Windows cases like
  // "/..\.env" that normalize to a leading backslash and slip past a "../" filter.
  const file = url === "/" ? "/index.html" : decodeURIComponent(url);
  const full = path.resolve(__dirname, "." + file);
  if (full !== __dirname && !full.startsWith(__dirname + path.sep)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
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
  setInterval(refreshOnce, REFRESH_MS);
  server.listen(PORT, () => console.log(`SCM dashboard on :${PORT} (refresh every ${REFRESH_MS / 1000}s)`));
});
