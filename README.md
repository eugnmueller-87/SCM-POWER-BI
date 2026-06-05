# SCM Master Tool — Procurement & Supply Chain Analytics Cockpit

An executive-facing cockpit for **procurement & supply-chain analytics**, built for a
mid-to-large cloud/hosting company (profile: IONOS-like, DACH, Microsoft-365 ecosystem,
indirect + IT/cloud-heavy spend). Audience: a non-technical CEO ("Cleo") deciding whether
**AI/analytics investment is worth it**.

It ships in two forms: a **live, interactive web cockpit** (hosted, auto-refreshing, wired
to a deployed API) and the **Power BI report** the lab requires — both reading the same
backend so the numbers always agree.

## 🚀 Live dashboard

### ▶︎ **[scm-power-bi-production.up.railway.app](https://scm-power-bi-production.up.railway.app)**

A fully interactive cockpit — cross-filtering, click-to-drill KPIs, reorder alerts, and a
forecast "why was it wrong / how to predict better" diagnostic. It logs into the SCM Master
API server-side and **auto-refreshes**, so the board is always current.

## 🎥 Walkthrough

<!-- ▶︎ INLINE VIDEO GOES HERE — drag clip/hosted-dashboard.mp4 into the GitHub README editor
     on this line; GitHub uploads it to its CDN and replaces this comment with a player. -->

<p align="center">
  <img src="https://raw.githubusercontent.com/eugnmueller-87/SCM-POWER-BI/main/clip/demo.gif" alt="SCM Master Tool live dashboard walkthrough — animated preview" width="100%">
</p>

> *(Animated preview above — the full narrated walkthrough video plays inline once uploaded.)*

### Headline result (from the live data)
> **AI demand forecast accuracy ≈ 85%** — backtested across **78 forecasts over 12 months**.
> Mean Absolute % Error (MAPE) = **14.6%**; volume-weighted (WMAPE) = **13.9%**.
> *"Our AI demand forecast has been right within ~15% on average, proven against 12 months of actuals."*

| Category | MAPE | Read |
|---|---|---|
| Storage | 8.5% | 🟢 excellent |
| Servers | 9.6% | 🟢 excellent |
| Memory | 12.7% | 🟢 good |
| Processors | 17.3% | 🟡 watch |
| Power | 18.1% | 🟡 watch |
| Networking | 21.5% | 🔴 weakest — improvement target |

> ⚠️ **All data in this repo is synthetic.** It is randomly generated to be *plausible*, not
> real. No real company data is used. See [research/01_data_assumptions.md](research/01_data_assumptions.md).

## What this project is

A complete, end-to-end answer to one CEO-level question: **"Is investing in AI/analytics for
our supply chain actually worth it?"** Instead of a slide deck of opinions, it backs the
answer with a working system you can click through.

The full stack:

1. **A synthetic-but-consistent data world.** A Python/pandas generator produces seven
   internally-coherent CSVs — suppliers, product categories, purchase spend, contracts, a
   12-month demand forecast vs. actuals, supply disruptions, and a date dimension. Everything
   ties together (the same products, suppliers and dates flow through every table), so the
   KPIs are believable rather than random.

2. **A deployed backend (SCM Master API).** A FastAPI service on Railway exposes
   authenticated analytics endpoints (OAuth2 login → Bearer token) for spend, inventory,
   forecast accuracy and AI-generated insights. This is the single source of truth both
   front-ends read.

3. **A live web cockpit** ([hosted here](https://scm-power-bi-production.up.railway.app)) —
   a coded, branded dashboard (Node server + Chart.js) that logs into the API server-side,
   caches and **auto-refreshes** the data, and renders an interactive board no spreadsheet
   could match:
   - **Cross-filtering** — click any category/supplier and the whole board reslices.
   - **Click-to-drill KPIs** — every scorecard tile opens a slide-out panel with its exact
     formula and the underlying rows, so a number is never a black box.
   - **Reorder intelligence** — per-SKU **reorder point** (`burn × lead-time + safety stock`),
     **days-to-reorder**, and an **action column** (🔴 ORDER NOW / 🟡 order in N days /
     ✅ on order / 🟢 ok) so planners see *when* to act, not just *what* the stock is.
   - **Forecast "why & how" diagnostic** — click a category and get a plain-English read on
     *why* the forecast missed (bias direction, demand volatility / coefficient of variation,
     over- vs under-shoot counts) **and** *how to predict better* (bias-correction factor,
     aggregation, safety-stock sizing, a seasonal model), plus the biggest individual misses.

4. **The Power BI report** ([`Order_Accuracy_Forecast_2026.pbix`](Order_Accuracy_Forecast_2026.pbix))
   — the lab-mandated deliverable, wired to the **same live API** via paste-ready Power Query
   (auto-login on every refresh). The forecast-accuracy "predicted vs actual" line chart with
   a MAPE card is the centrepiece. The full build is specified in
   [`dashboard/dashboard_spec.md`](dashboard/dashboard_spec.md) and the connection steps in
   [`dashboard/live_api_connection.md`](dashboard/live_api_connection.md).

5. **A decision layer.** Every page carries a "robust vs. needs-validation" note that rolls
   up into a concrete **pilot / wait / invest** recommendation — the honest version of the
   answer, including where the model is weak (Networking is the worst category at ~21% error).

**Why it stands out:** the data is live and wired end-to-end, the KPIs are anchored to real
supply-chain frameworks (SCOR, WMAPE, reorder-point theory) rather than invented, and the
board is *explainable* — every figure drills to its formula and its raw rows. It's built to
survive a sceptical CEO asking "where does that number come from?"

## What's inside

| Layer | Where | What |
|---|---|---|
| **1. Synthetic data** | [`scripts/generate_data.py`](scripts/generate_data.py) → [`data/raw/`](data/raw/) | Python/pandas generator → 7 internally-consistent CSVs (suppliers, categories, spend, contracts, forecast, disruptions, date dim). |
| **2. Measure layer** | [`measures/measures_dax.md`](measures/measures_dax.md) | Every KPI with plain-English formula **and** copy-paste Power BI DAX, grouped by framework. |
| **3. Data model** | [`dashboard/data_model.md`](dashboard/data_model.md) | Star schema, relationships, helper tables — how to wire the `.pbix`. |
| **4. Dashboard spec** | [`dashboard/dashboard_spec.md`](dashboard/dashboard_spec.md) | 4 pages, every visual specified (chart type, fields, CEO-readability). |
| **5. Hype-vs-value** | [`dashboard/hype_vs_value.md`](dashboard/hype_vs_value.md) | Per-page "robust vs needs-validation" note → a "pilot / wait / invest" recommendation. |
| **6. Research notes** | [`research/`](research/) | Reusable assumptions for project write-ups. |
| **7. Live API connection** | [`dashboard/live_api_connection.md`](dashboard/live_api_connection.md) | Paste-ready Power Query (M) to connect Power BI to the deployed backend — auto-login on every refresh (OAuth2 → Bearer). |
| **8. Built dashboard** | [`Order_Accuracy_Forecast_2026.pbix`](Order_Accuracy_Forecast_2026.pbix) | The Power BI report itself, wired to the live API. *(Git LFS)* |
| **9. Live web cockpit** | [`deploy/`](deploy/) → [**hosted**](https://scm-power-bi-production.up.railway.app) | Node server + Chart.js. Server-side API login, in-memory cache, auto-refresh. Cross-filtering, click-to-drill KPIs, reorder alerts, forecast diagnostics. Deployed on Railway. |

## Frameworks anchored (no ad-hoc KPIs)
- **SCOR DS** Level-1 metrics: Perfect Order Fulfillment %, Order Fulfillment Cycle Time,
  Cash-to-Cash Cycle Time, Total SCM Cost, Return on SC Fixed Assets.
- **Forecast accuracy:** WMAPE (primary), Forecast Bias % (95–105% band), RMSE,
  Plan/Schedule Adherence % — shown as a **3-month trend**, not pass/fail.
- **Resilience:** Time-to-Awareness / -Action / -Recover / -Survive, the **TTS > TTR** rule,
  a node-level Resilience Score, and single- vs multi-source risk flags.
- **Spend & savings:** spend cube, addressable vs influenceable, tail-spend %, maverick/
  off-contract %, savings waterfall (negotiated → realized → cost avoidance), contract coverage %.

## The story the data tells
- Overall **forecast error falls** 9.2% → 7.6% over M1→M3 (analytics is working)…
- …**except Logistics**, which absorbs a supplier disruption (WMAPE spikes to ~24% in M2,
  recovering to ~13% in M3) — a real, explained miss, not a hidden one.
- **~20% maverick spend** and **64% contract coverage** → concrete savings levers.
- **15% of suppliers violate TTS>TTR** and **17.5% are single-source** → resilience action list.

## Quick start

```bash
# 1. Generate the data (Python 3.12 + pandas/numpy)
pip install pandas numpy python-dateutil
python scripts/generate_data.py          # writes CSVs to data/raw/

# 2. Build the .pbix
#    - Data source — pick ONE:
#        a) Static: Get Data ▸ Text/CSV ▸ load data/raw/*.csv
#        b) Live API: follow dashboard/live_api_connection.md (paste-ready Power Query,
#           auto-login on refresh against the deployed backend)
#    - Wire relationships per dashboard/data_model.md
#    - Add measures from measures/measures_dax.md to a _Measures table
#    - Build the 4 pages per dashboard/dashboard_spec.md
```

## Why Power BI (not Tableau)
Power BI Desktop is **free**, native to the **Microsoft-365** stack this company runs, and
the brief's measure layer is authored in **DAX**. The synthetic CSV layer is tool-agnostic
and could feed Tableau later; only the measures would need re-authoring.

## Status
- [x] Synthetic data generator + validated CSVs
- [x] Measure layer (formulas + DAX)
- [x] Data model + 4-page dashboard spec
- [x] Hype-vs-value layer + research notes
- [x] Live API connection guide (`dashboard/live_api_connection.md`) — verified against the deployed backend
- [x] **`.pbix` built in Power BI Desktop** — wired to the live API, forecast-accuracy measures + visuals live
- [x] **Live web cockpit deployed** — [hosted on Railway](https://scm-power-bi-production.up.railway.app), auto-refreshing, with drill-downs + reorder alerts + forecast diagnostics
