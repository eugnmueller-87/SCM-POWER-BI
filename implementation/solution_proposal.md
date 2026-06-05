# Solution Proposal — AI Demand Forecasting & Dynamic Reorder

**For:** Cleo (CEO) · **Sector:** Cloud/hosting enterprise (~5,000 employees)
Citations `[n]` resolve in [`../sources.md`](../sources.md).

---

## 1. Use-case discovery summary

- **Sector / size:** Cloud/hosting & data-center infrastructure, large enterprise (~5,000 staff).
- **Stakeholders / pain:** Procurement, capacity planners, finance and ops all suffer when demand
  forecasts are wrong *and* chip lead times swing unpredictably `[E1][E2]`. (Full table in
  [`../research/use_case_discovery.md`](../research/use_case_discovery.md).)
- **Why this use case first:** strongest evidence `[A1][D1]`, lowest lift (working PoC already
  exists), clearest ROI story, and it de-risks the geopolitical lead-time problem that hits a
  hardware-heavy cloud business hardest.
- **Evidence vs assumption:** the *direction* is evidence-backed; the *magnitude on our SKUs* is an
  assumption the pilot exists to test (see [`../research/hype_vs_evidence.md`](../research/hype_vs_evidence.md)).

---

## 2. Investment recommendation

> ## 🟡 Recommendation: **RUN A SMALL PILOT** (≈10 weeks). Not "invest at full scale," not "wait."

**Why this and not the alternatives:**

| Option | Verdict | Reason |
|---|---|---|
| **Invest now (full rollout)** | ❌ | Magnitude unproven on our data; ~64% of full bets stall `[B1]`. Too much risk for the evidence we have. |
| **Wait** | ❌ | The pain is acute *now* (chip volatility, memory +4× `[E1]`); we already have a PoC. Waiting wastes a cheap edge. |
| **Pilot** | ✅ | Validates the 5 key assumptions at low cost, converts "85% on synthetic" into a real number, and gives a data-backed rollout decision. |

**What would change the recommendation to "invest now":** a pilot holdout backtest hitting the
30–50% error-reduction band `[D1]` on real SKUs **and** a named model owner in place.
**What would change it to "stop":** pilot accuracy no better than the current spreadsheet, or data
quality too poor to fix economically.

---

## 3. The recommended solution

**What it does:** for each SKU, forecast demand from usage history + external signals, score the
forecast's reliability (MAPE / WMAPE / bias), and compute a **dynamic reorder point**
(`daily_burn × lead_time + safety_stock`) that updates as lead times move. A planner reviews and
**approves** each purchase; the dashboard shows *why* (drill-downs into bias and volatility).

**Business process it improves:** demand planning → reorder timing → purchase approval. It turns a
static, spreadsheet-driven reorder process into a monitored, explainable, demand-driven one.

**What's AI vs. standard automation (explicit, per rubric):**

| Component | Type |
|---|---|
| Demand forecast model (usage + external signals) | **AI / ML** |
| Forecast-reliability scoring + drift detection | **AI / ML** |
| Reorder-point arithmetic (`burn×lead+safety`) | Standard automation |
| Reorder/action flags & approval workflow | Standard automation / BI |
| Dashboard, drill-downs, KPIs | Standard BI (communication layer) |

**Data, tools, roles required:**
- **Data:** usage/consumption history, lead times, safety stock, on-hand, on-order, forecast-vs-actual
  (all already modelled); a public Kaggle analog `[F1]` for external validation.
- **Tools:** Python (pandas/numpy + a forecasting lib), the existing API, Power BI for the exec
  view, the live web cockpit for ops.
- **Roles:** data/ML owner (the critical one — prevents drift `[B2]`), a procurement SME, an exec
  sponsor (Cleo), light finance involvement to sign off savings.

---

## 4. Success criteria (set before the pilot)

| Metric | Target to justify rollout |
|---|---|
| Forecast error (WMAPE) vs current baseline | **≥20% relative reduction** on a holdout |
| Stockout events on long-lead SKUs | Downward trend during pilot |
| Planner adoption | ≥80% of recommended reorders reviewed via the tool |
| Model ownership | Owner named + retrain cadence agreed |

If these are met → rollout. If not → fix or stop. (Detailed phases:
[`implementation_plan.md`](implementation_plan.md); cost & timeline:
[`../cost_estimation/`](../cost_estimation/).)
