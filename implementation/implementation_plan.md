# Implementation Plan — AI Demand Forecasting & Dynamic Reorder

Phased rollout from validation → pilot → production, for a cloud/hosting enterprise (~5,000 staff).
Costs: [`../cost_estimation/cost_analysis.md`](../cost_estimation/cost_analysis.md) ·
Timeline: [`../cost_estimation/timeline_estimate.md`](../cost_estimation/timeline_estimate.md).
Citations `[n]` in [`../sources.md`](../sources.md).

---

## Phases at a glance

| Phase | Weeks | Goal | Gate to pass |
|---|---|---|---|
| 0 · Discovery validation | 1–2 | Confirm problem & stakeholders | Sponsor + SME signed on |
| 1 · Data access & prep | 2–3 | Clean, complete data | Data-quality gate passed |
| 2 · Prototype / PoC | 3–5 | Model beats baseline | Holdout WMAPE ↓ ≥20% |
| 3 · Pilot | 5–9 | Run live on a SKU subset | Success criteria met |
| 4 · Rollout & handoff | 9–11 | Scale + train | Owner + retrain cadence live |
| 5 · Monitor & improve | ongoing | Keep it accurate | Drift SLA held |

---

## Phase 0 — Discovery validation (Weeks 1–2)
- Confirm the pain with Procurement + planners (the assumptions in
  [`../research/use_case_discovery.md`](../research/use_case_discovery.md)).
- Lock pilot scope: **one category first** (recommend a weak-but-material one — e.g. Networking/Storage,
  ~47–51% accurate — for maximum upside, or the highest-value Servers for maximum $ impact; the
  near-zero GPU/Compute categories are too intermittent to be a fair first test).
- **Owner:** exec sponsor (Cleo) + procurement lead. **Exit:** signed scope + success criteria.

## Phase 1 — Data access & preparation (Weeks 2–3)
- Pull usage, lead time, safety stock, on-hand/on-order, forecast-vs-actual.
- **Data-quality gate (mitigates R2):** completeness, outliers, lead-time accuracy. Cross-check
  structure against the public Kaggle analog `[F1]`.
- **Owner:** data/ML engineer. **Exit:** data-quality scorecard ≥ threshold.

## Phase 2 — Prototype / proof of concept (Weeks 3–5)
- Train an ML demand model (history + external signals `[D4]`); compute reorder points; score
  reliability (MAPE/WMAPE/bias).
- **Holdout backtest** vs the current spreadsheet baseline.
- **Owner:** data/ML engineer. **Exit gate:** **≥20% relative WMAPE reduction** on holdout, else
  iterate or stop.

## Phase 3 — Pilot (Weeks 5–9)
- Run live on the chosen category. Planners review **approve→place** (human-in-the-loop, mitigates
  R4). Track success criteria from the proposal.
- Weekly review with finance on avoided stockouts / working-capital effect.
- **Owner:** procurement lead + ML engineer. **Exit gate:** success criteria met.

## Phase 4 — Rollout & handoff (Weeks 9–11)
- Extend to remaining categories. **Assign the permanent model owner** and agree a retrain cadence
  (mitigates R1 / drift `[B2]`). Train planners; document runbook.
- **Owner:** model owner. **Exit:** owner + monitoring live, planners trained.

## Phase 5 — Monitor & improve (ongoing)
- Track live accuracy vs SLA; auto-alert on drift; monthly/quarterly retrain.
- Quarterly review of supplier-risk flags as chip geopolitics shift `[E1][E2]`.

---

## Dependencies
- Reliable data feeds (usage + lead time) — the hard dependency.
- A named model owner with capacity (not a borrowed analyst).
- Finance partnership to quantify savings credibly.

## Top risks & mitigations (full map in [`../research/opportunities_risks.md`](../research/opportunities_risks.md))
| Risk | Mitigation in this plan |
|---|---|
| Model drift (R1) | Phase 4 owner + Phase 5 retrain SLA |
| Bad data (R2) | Phase 1 data-quality gate |
| Lead-time shocks (R3) | Forecast bands + dynamic safety stock |
| Over-trust (R4) | Human-in-the-loop approval |
| Pilot stall (R5) | Pre-set gates at every phase |

## Owners / roles
| Role | Responsibility |
|---|---|
| Exec sponsor (Cleo) | Funding, go/no-go decisions |
| Procurement lead | Scope, adoption, success criteria |
| Data/ML engineer | Model, data prep, backtests |
| Model owner (post-pilot) | Drift monitoring, retraining |
| Finance partner | Savings/working-capital validation |
