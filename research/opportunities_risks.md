# Opportunity & Risk Map — AI Adoption

**Sector:** Cloud/hosting enterprise (~5,000 employees) · **Decision owner:** Cleo (CEO)
Citations `[n]` resolve in [`../sources.md`](../sources.md).

---

## 1. The three AI opportunities considered

We scoped three realistic AI adoption opportunities for the procurement/supply-chain function,
then chose one to prioritize.

### Opportunity A — AI demand forecasting + dynamic reorder *(PRIORITIZED)*
Use ML to forecast per-SKU demand from usage history **plus external signals**, and convert the
forecast into a **dynamic reorder point** (`burn × lead-time + safety`) that updates as lead times
move.

- **Value:** AI forecasting cuts errors **30–50%** `[D1]`; supply-chain is a proven savings area
  (**61%** report cost savings `[A1]`). Directly attacks our worst category (Networking ~21% error).
- **Why it fits us:** lead-time volatility from chip geopolitics `[E1][E2]` breaks static reorder
  points — the exact failure mode AI addresses.
- **Effort:** Low–medium. We already have the data, the measures, and a working dashboard.

### Opportunity B — AI supplier-risk & concentration monitoring
Flag single-source dependence, expiring contracts and overdue inbound; score supplier resilience.

- **Value:** Mitigates the chip single-node risk (~90% of advanced chips from Taiwan `[A3]`).
- **Why not first:** more of a *reporting/automation* play than an AI play; valuable but lower
  forecast-accuracy payoff and harder to quantify ROI for Cleo.

### Opportunity C — GenAI procurement copilot (NL Q&A over spend/inventory)
A chat assistant answering "which SKUs do we reorder this week and why?"

- **Value:** Adoption/UX win; lowers the analyst barrier.
- **Why not first:** highest hype, hardest to tie to EBIT; **64% of orgs stall in pilot** `[B1]`
  precisely on flashy GenAI. Build it *after* the forecasting core proves value.

---

## 2. Priority recommendation

**Prioritize Opportunity A (AI demand forecasting + dynamic reorder).** It has the strongest
evidence base, the lowest incremental effort (the dashboard already demonstrates it), the clearest
ROI story, and it directly de-risks the geopolitical lead-time problem that matters most to a
hardware-heavy cloud business. B is the fast-follow; C is a later UX layer.

---

## 3. Risk map

| # | Risk | Type | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R1 | **Model drift** — accuracy decays as conditions shift | AI reliability | High | High | Named owner + monthly retrain + accuracy SLA; drift is the #1 scaling-failure cause `[B2]` |
| R2 | **Garbage-in** — usage/lead-time data incomplete or wrong | Data quality | Med | High | Data-quality gate before pilot; validate against public Kaggle analog `[F1]` |
| R3 | **Lead-time shocks** (chip geopolitics) break assumptions | Operational/external | High | High | Forecast *bands* not points; dynamic safety stock; supplier diversification flags `[E1][E2]` |
| R4 | **Over-trust** — planners follow a wrong number blindly | Adoption/process | Med | High | Keep human-in-the-loop "approve→place"; show the *why* (drill-downs already do this) |
| R5 | **Pilot-stall** — never scales past a demo | Adoption/financial | High | Med | Pre-defined success criteria + go/no-go gate; ~64% stall here `[B1]` |
| R6 | **ROI underwhelms** — savings <10% | Financial | Med | Med | Frame as risk-reduction + working-capital, not just cost; most SC savings are <10% `[A1]` |
| R7 | **Privacy/compliance** on supplier data (DACH/GDPR) | Privacy/legal | Low | Med | Keep data in-region; no PII in the model; document data flows |
| R8 | **Vendor lock-in / cost creep** on AI platform | Financial | Med | Low | Start with open tooling; cost ceiling in the pilot budget |

**Highest-priority risks to mitigate first:** R1 (drift), R3 (lead-time shocks), R5 (pilot-stall) —
these are the ones that most commonly turn a promising AI forecast into shelfware.

---

## 4. Adoption-readiness check

| Readiness factor | Status | Note |
|---|---|---|
| Data available | 🟢 | Usage, lead time, spend, forecast-vs-actual already modelled |
| Working proof-of-concept | 🟢 | Live dashboard + 85% backtested accuracy (synthetic) |
| Executive sponsor | 🟡 | Cleo deciding — that's this project |
| Owner for the model | 🔴 | **Must assign** before scaling (R1) |
| Change-management plan | 🟡 | Human-in-the-loop design lowers the bar |

**Verdict:** ready for a **scoped pilot**, not yet for full rollout — see
[`../implementation/solution_proposal.md`](../implementation/solution_proposal.md).
