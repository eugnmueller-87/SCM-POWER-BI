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

let cache = { generated_at: null, data: null, error: null };

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

async function refresh() {
  try {
    const token = await login();
    const [byCat, bySup, byProd, spendTotal, inventory, insights, forecast] = await Promise.all([
      getJSON(token, "/api/v1/analytics/spend/by-category"),
      getJSON(token, "/api/v1/analytics/spend/by-supplier"),
      getJSON(token, "/api/v1/analytics/spend/by-product"),
      getJSON(token, "/api/v1/analytics/spend"),
      getJSON(token, "/api/v1/planning/inventory"),
      getJSON(token, "/api/v1/agent/insights"),
      getCSV(token, "/api/v1/analytics/exports/forecast-accuracy.csv"),
    ]);
    cache = {
      generated_at: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
      error: null,
      data: {
        generated_at: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
        spend_by_category: byCat, spend_by_supplier: bySup, spend_by_product: byProd,
        spend_total: spendTotal, inventory, insights, forecast,
      }
    };
    console.log(`[refresh] ok @ ${cache.generated_at} (${forecast.length} forecast rows)`);
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
