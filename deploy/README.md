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

The Overview tab carries the warehouse compartments (`/api/v1/warehouse/compartments` and
each compartment's `/contents`): a ring of the whole warehouse's capacity split into what
stands in each of the nine compartments (in the order of the cycle, grouped under the stage
the backend gives each one: first life, return chain, second life, exit, reserve), what is
on its way in and has a place, and what is free after that; next to it one bar per
compartment against its own capacity, with the inbound that has a place, the inbound that
has none, and what stands over the capacity now past a black mark. Capacity belongs to a
compartment, never to a supplier or a product, so a filter changes the occupancy the bars
show and says so; a supplier is read off the purchase orders for each model. All nine
contents reads run in parallel on every refresh (about 0.75 s in total against the demo
fleet, grouped queries, nothing walks the asset table). `?filter=supplier:Apple` (or
`category:`, `product:`) opens the board with that filter set, for the headless render check.

The "Live data" stamp in the header is a button: it POSTs `/api/refresh`, which makes the
proxy read the API again instead of waiting for the next scheduled tick, and re-renders.
It takes about twenty seconds (a dozen calls, mostly sequential) and counts the seconds
while it runs. It exists for the demo: change something in the console (extra places on a
compartment, a delivery, a batch of returns) and the board shows it now, not in five
minutes. Concurrent clicks share one pass.

The API token is cached for 30 minutes and dropped on any 401. Before that, every refresh
and every on-demand route logged in again, against a limit of 10 logins per IP per 5
minutes (`LOGIN_RATE_LIMIT` / `LOGIN_RATE_WINDOW_SECONDS` on the API): clicking through
the tabs during a demo was enough to earn a 429. A full refresh plus twelve route calls is
now one login.

Deploy: Railway (Nixpacks, `node server.js`).
Env: `API_BASE`, `API_USER`, `API_PASS`, `REFRESH_SECONDS`, `INSIGHTS_TTL_SECONDS`.
