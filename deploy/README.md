# SCM Master — Live Dashboard

Executive cockpit for the SCM Master API. Node server that logs into the API
server-side, serves the dashboard, and auto-refreshes data every 5 min;
the page polls /api/data every 60s so it stays live.

Overview insights are computed deterministically in [`insights.js`](insights.js)
(zero tokens). The only priced call — the on-demand "AI commentary" that narrates
over those findings — is decoupled from the data refresh: it's fetched at most
once per `INSIGHTS_TTL_SECONDS` (default 3h) and reused in between, so passive
token cost is ≈ 0.

The KPIs tab shows the backend's steering KPIs (`/api/v1/kpis`) by half year for 2026
and 2027, the device goal first. The backend's targets are yearly and no half-year target
exists in the data, so the half-year checkpoints are derived in
[`kpi_halfyear.js`](kpi_halfyear.js) and labelled as such: a straight line from the first
measurement to the one-, two- and three-year targets, read off on 30.06. and 31.12.; how
far off is today's value against that line's value today, in the KPI's own unit and good
direction. Placeholder targets stay marked; a KPI without a measurement shows its reason.
The fleet path comes from `/api/v1/capacity-plan` where a deployment serves it and is
otherwise derived from `/api/v1/fleet/summary` and the owned milestones, and the screen
says which. `?tab=kpis` deep-links to the tab.

Deploy: Railway (Nixpacks, `node server.js`).
Env: `API_BASE`, `API_USER`, `API_PASS`, `REFRESH_SECONDS`, `INSIGHTS_TTL_SECONDS`.
