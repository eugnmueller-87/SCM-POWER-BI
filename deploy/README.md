# SCM Master — Live Dashboard

Executive cockpit for the SCM Master API. Node server that logs into the API
server-side, serves the dashboard, and auto-refreshes data every 5 min;
the page polls /api/data every 60s so it stays live.

Overview insights are computed deterministically in [`insights.js`](insights.js)
(zero tokens). The only priced call — the on-demand "AI commentary" that narrates
over those findings — is decoupled from the data refresh: it's fetched at most
once per `INSIGHTS_TTL_SECONDS` (default 3h) and reused in between, so passive
token cost is ≈ 0.

Deploy: Railway (Nixpacks, `node server.js`).
Env: `API_BASE`, `API_USER`, `API_PASS`, `REFRESH_SECONDS`, `INSIGHTS_TTL_SECONDS`.
