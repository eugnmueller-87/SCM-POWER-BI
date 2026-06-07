# SCM Master Tool — Procurement & Supply Chain Analytics Cockpit

[![Live Dashboard](https://img.shields.io/badge/Live_Dashboard-online-22c55e?style=flat&logo=railway&logoColor=white)](https://scm-power-bi-production.up.railway.app)
[![Power BI](https://img.shields.io/badge/Power_BI-report-F2C811?style=flat&logo=powerbi&logoColor=black)](Order_Accuracy_Forecast_2026.pbix)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat&logo=python&logoColor=white)](requirements.txt)
[![Ruff](https://img.shields.io/badge/lint-ruff-D7FF64?style=flat&logo=ruff&logoColor=black)](ruff.toml)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=nodedotjs&logoColor=white)](deploy/)
[![Chart.js](https://img.shields.io/badge/Chart.js-4.4-FF6384?style=flat&logo=chartdotjs&logoColor=white)](deploy/)
[![Deployed on Railway](https://img.shields.io/badge/Deployed-Railway-0B0D0E?style=flat&logo=railway&logoColor=white)](https://scm-power-bi-production.up.railway.app)
[![Data](https://img.shields.io/badge/data-synthetic_%2B_public-8b5cf6?style=flat)](sources.md)
[![Recommendation](https://img.shields.io/badge/recommendation-pilot-eab308?style=flat)](implementation/solution_proposal.md)
[![License](https://img.shields.io/badge/license-educational-lightgrey?style=flat)](#)

An executive-facing cockpit for **procurement & supply-chain analytics**, built for a
mid-to-large cloud/hosting company (profile: DACH, Microsoft-365 ecosystem,
indirect + IT/cloud-heavy spend). Audience: a non-technical CEO ("Cleo") deciding whether
**AI/analytics investment is worth it**.

It ships in two forms: a **live, interactive web cockpit** (hosted, auto-refreshing, wired
to a deployed API) and the **Power BI report** the lab requires — both reading the same
backend so the numbers always agree.

> **Environment-aware.** The cockpit is a thin server-side proxy: it logs into **one**
> [SCM Master](https://github.com/eugnmueller-87/SCM-Master) instance (set via `API_BASE`)
> and serves its analytics. The same code deploys per environment — a **demo** cockpit wired
> to the demo API, and a **production** cockpit (own Railway project) wired to the forge-locked
> prod API — so each board reflects only its own environment's data. Uses a read-only viewer
> account; it never writes.

## 🚀 Live dashboard

### ▶︎ **[scm-power-bi-production.up.railway.app](https://scm-power-bi-production.up.railway.app)**

A fully interactive cockpit — cross-filtering, click-to-drill KPIs, reorder alerts, and a
forecast "why was it wrong / how to predict better" diagnostic. It logs into the SCM Master
API server-side and **auto-refreshes**, so the board is always current.

## 🎥 Walkthrough

### 1 · Live web cockpit (hosted, auto-refreshing)

![SCM Master live cockpit walkthrough](https://raw.githubusercontent.com/eugnmueller-87/SCM-POWER-BI/main/clip/hosted-dashboard.gif)

> The live, hosted cockpit in motion — [**scm-power-bi-production.up.railway.app**](https://scm-power-bi-production.up.railway.app).
> For the full-quality clip with audio, ▶︎ **[open `clip/hosted-dashboard.mp4`](https://github.com/eugnmueller-87/SCM-POWER-BI/blob/main/clip/hosted-dashboard.mp4)**.

### 2 · Power BI report (lab deliverable)

![SCM Master Power BI report demo](https://raw.githubusercontent.com/eugnmueller-87/SCM-POWER-BI/main/clip/demo.gif)

> The Power BI report wired to the **same live API** — forecast-accuracy measures and the
> predicted-vs-actual view, with a DAX `Forecast Quality` flag. For the full clip,
> ▶︎ **[open `docs/demo.mp4`](https://github.com/eugnmueller-87/SCM-POWER-BI/blob/main/docs/demo.mp4)**.

### What you're looking at — KPIs and where they live

| Tab | KPI / visual | What it answers |
|---|---|---|
| **Overview** | **Forecast Accuracy** (1 − WMAPE), **Total Spend**, **Top Supplier Share**, **Stockout Risk** | The four numbers a CEO checks first — is the AI forecast trustworthy, how much are we spending, are we over-reliant on one supplier, and is anything about to run out. |
| **Overview** | **Predicted vs Actual Demand** (12-month line) + **Supplier Concentration** (donut) + **Spend by Category** (bars) + **AI-Generated Insights** | The forecast "money shot" against 12 months of actuals, plus a click-to-filter spend/supplier breakdown and the AI's plain-English read on the data. |
| **SC Scorecard** | **Inventory Turns**, **Days of Supply**, **Fill Rate**, **Forecast Bias**, **HHI concentration**, **Avg Lead Time**, **On-Order**, **SKUs below safety** … | The full supply-chain health panel — every tile is **click-to-drill**: it opens a slide-out with the exact formula and the underlying rows. |
| **Spend** | Spend **by category / supplier / product**, **maverick & tail-spend %**, **top-supplier concentration** | Where the money goes and the concrete savings levers. Cross-filters the whole board on click. |
| **Inventory** | On-hand, daily burn, **Reorder Point** (`burn × lead + safety`), **Days-to-reorder**, **Action** column (🔴 ORDER NOW / 🟡 order in N d / ✅ on order / 🟢 ok) | Tells planners *when* to reorder each SKU, not just what the stock is. |
| **Forecast** | **MAPE / WMAPE**, accuracy by category, worst-category flag, **error trend by month**, click-to-drill **why-it-missed / how-to-fix** diagnostic | Why the forecast was wrong (bias direction, demand volatility) and how to predict better (bias correction, aggregation, safety stock, seasonal model). |

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

---

## 🎓 The consulting case (Project 5 deliverable)

This repo is a full **AI-adoption consulting case**: advising **Cleo (a non-technical CEO)**
whether to invest in AI for procurement & supply-chain.

### Use-case discovery summary
- **Sector:** Cloud / hosting & data-center infrastructure (DACH, Microsoft-365 ecosystem).
- **Company size:** Large enterprise — **~5,000 employees (IONOS-scale)**, ~€640m managed spend.
- **Stakeholders & pain:** Procurement, capacity planners, finance and ops all suffer when demand
  forecasts are wrong *and* chip lead times swing unpredictably. (Full discovery:
  [`research/use_case_discovery.md`](research/use_case_discovery.md).)
- **Primary use case selected:** **AI demand forecasting + a dynamic reorder point** — strongest
  evidence, lowest lift (working PoC already exists), clearest ROI, and it de-risks the geopolitical
  chip lead-time problem that hits a hardware-heavy cloud business hardest.

### Market research summary
- AI is mainstream: **78% (2024) → 88% (2025)** of orgs use AI in ≥1 function (Stanford AI Index;
  McKinsey). Supply chain is a **proven** savings area — **61%** report cost savings.
- AI demand forecasting cuts error **30–50%** (vendor evidence — treated as upper bound).
- **Why now:** ~**90%** of advanced chips come from Taiwan; **memory prices rose ~4×** Sep–Nov 2025
  — static reorder points fail when lead times swing. Full analysis + sources:
  [`research/market_research.md`](research/market_research.md) · [`sources.md`](sources.md).

### Hype vs. evidence → recommendation
- The honest read: adoption is real, but **only 39%** see EBIT impact and **~64% stall in pilot**;
  most SC savings are **<10%**. (See [`research/hype_vs_evidence.md`](research/hype_vs_evidence.md).)
- > **🟡 Recommendation for Cleo: RUN A 10-WEEK PILOT — don't invest at full scale yet, don't wait.**
  > Validate the 30–50% improvement on *our* SKUs before committing. Full reasoning, cost (~€43k
  > pilot / ~€135k year-1) and timeline:
  > [`implementation/solution_proposal.md`](implementation/solution_proposal.md) ·
  > [`implementation/implementation_plan.md`](implementation/implementation_plan.md) ·
  > [`cost_estimation/`](cost_estimation/).

### Dataset information
- **Operational data (dashboard):** *synthetic*, reproducible via
  [`scripts/generate_data.py`](scripts/generate_data.py) → [`data/raw/`](data/raw/). Chosen for
  reproducibility and no-NDA review; documented in [`research/01_data_assumptions.md`](research/01_data_assumptions.md).
- **Market-evidence data:** *public*, compiled from cited sources into
  [`data/processed/ai_adoption_evidence.csv`](data/processed/ai_adoption_evidence.csv).
- **Public Kaggle analogs** (to validate the model on third-party data in the pilot) are listed in
  [`sources.md`](sources.md) (section F).

### 📋 Deliverables map (Project 5 rubric)

| Deliverable | File |
|---|---|
| Use-case discovery & selection | [`research/use_case_discovery.md`](research/use_case_discovery.md) |
| Market research & data gathering | [`research/market_research.md`](research/market_research.md) |
| Opportunity & risk map | [`research/opportunities_risks.md`](research/opportunities_risks.md) |
| Hype-vs-evidence analysis | [`research/hype_vs_evidence.md`](research/hype_vs_evidence.md) |
| Source list | [`sources.md`](sources.md) |
| Dashboard (Power BI) | [`Order_Accuracy_Forecast_2026.pbix`](Order_Accuracy_Forecast_2026.pbix) |
| Dashboard documentation | [`dashboard/dashboard_documentation.md`](dashboard/dashboard_documentation.md) |
| Solution proposal (invest/wait/pilot) | [`implementation/solution_proposal.md`](implementation/solution_proposal.md) |
| Implementation plan | [`implementation/implementation_plan.md`](implementation/implementation_plan.md) |
| Cost analysis | [`cost_estimation/cost_analysis.md`](cost_estimation/cost_analysis.md) |
| Timeline estimate | [`cost_estimation/timeline_estimate.md`](cost_estimation/timeline_estimate.md) |

---

## What's inside

| Layer | Where | What |
|---|---|---|
| **1. Synthetic data** | [`scripts/generate_data.py`](scripts/generate_data.py) → [`data/raw/`](data/raw/) | Python/pandas generator → 7 internally-consistent CSVs (suppliers, categories, spend, contracts, forecast, disruptions, date dim). |
| **2. Measure layer** | [`measures/measures_dax.md`](measures/measures_dax.md) | Every KPI with plain-English formula **and** copy-paste Power BI DAX, grouped by framework. |
| **3. Data model** | [`dashboard/data_model.md`](dashboard/data_model.md) | Star schema, relationships, helper tables — how to wire the `.pbix`. |
| **4. Dashboard spec** | [`dashboard/dashboard_spec.md`](dashboard/dashboard_spec.md) | 4 pages, every visual specified (chart type, fields, CEO-readability). |
| **5. Hype-vs-value** | [`dashboard/hype_vs_value.md`](dashboard/hype_vs_value.md) | Per-page "robust vs needs-validation" note → a "pilot / wait / invest" recommendation. |
| **6. Research & adoption analysis** | [`research/`](research/) | Use-case discovery, market research, opportunity/risk map, hype-vs-evidence — all cited ([`sources.md`](sources.md)). |
| **6b. Implementation & cost** | [`implementation/`](implementation/), [`cost_estimation/`](cost_estimation/) | Solution proposal (invest/wait/pilot), phased plan, cost & timeline estimates. |
| **6c. Public evidence data** | [`data/processed/ai_adoption_evidence.csv`](data/processed/ai_adoption_evidence.csv) | Cited public AI-adoption / chip-risk figures powering the market-evidence layer. |
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
# 1. Generate the data (Python 3.12)
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
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

## Project structure

```
SCM-POWER-BI/
├── data/
│   ├── raw/                    # 7 synthetic CSVs (operational data)
│   └── processed/              # ai_adoption_evidence.csv (public, cited)
├── research/
│   ├── use_case_discovery.md   # sector, size, stakeholders, why this use case
│   ├── market_research.md      # sector trends, AI adoption signals, sources
│   ├── opportunities_risks.md  # 2-3 opportunities + risk map + priority
│   ├── hype_vs_evidence.md     # AI claims: supported vs overhyped
│   └── 01_data_assumptions.md  # synthetic-data methodology
├── dashboard/
│   ├── dashboard_documentation.md  # metrics, design rationale, screenshots
│   ├── dashboard_spec.md / data_model.md / measures (see measures/)
│   └── live_api_connection.md      # Power Query to the live API
├── implementation/
│   ├── solution_proposal.md    # invest / wait / pilot recommendation
│   └── implementation_plan.md  # validation → pilot → rollout
├── cost_estimation/
│   ├── cost_analysis.md        # pilot ~€43k / year-1 ~€135k
│   └── timeline_estimate.md    # ~10-week pilot
├── measures/measures_dax.md    # every KPI: formula + DAX
├── deploy/                     # live web cockpit (Node + Chart.js, Railway)
├── clip/                       # walkthrough GIFs + mp4
├── Order_Accuracy_Forecast_2026.pbix   # Power BI report (Git LFS)
├── scripts/generate_data.py    # synthetic data generator
├── sources.md                  # all sources, labelled by type
├── requirements.txt
├── .env.example
└── README.md
```

## Status
- [x] Synthetic data generator + validated CSVs
- [x] Measure layer (formulas + DAX)
- [x] Data model + 4-page dashboard spec
- [x] Hype-vs-value layer + research notes
- [x] Live API connection guide (`dashboard/live_api_connection.md`) — verified against the deployed backend
- [x] **`.pbix` built in Power BI Desktop** — wired to the live API, forecast-accuracy measures + visuals live
- [x] **Live web cockpit deployed** — [hosted on Railway](https://scm-power-bi-production.up.railway.app), auto-refreshing, with drill-downs + reorder alerts + forecast diagnostics
- [x] **Per-environment deployment** — same cockpit deploys to a **demo** stack and an isolated **production** stack (own Railway project), each wired to its environment's SCM Master API via `API_BASE` with a read-only viewer account
