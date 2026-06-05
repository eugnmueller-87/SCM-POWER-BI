# SCM Master — Live Dashboard

Executive cockpit for the SCM Master API. Node server that logs into the API
server-side, serves the dashboard, and auto-refreshes data every 5 min;
the page polls /api/data every 60s so it stays live.

Deploy: Railway (Nixpacks, `node server.js`). Env: API_BASE, API_USER, API_PASS, REFRESH_SECONDS.
