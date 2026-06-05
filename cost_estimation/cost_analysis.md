# Cost Analysis — AI Demand Forecasting Pilot → Rollout

Cloud/hosting enterprise (~5,000 employees). All figures are **planning estimates in EUR** with
assumptions stated. Citations `[n]` in [`../sources.md`](../sources.md).

> **Methodology:** bottom-up (people-weeks × blended rate) + tooling/infra. Blended internal cost
> assumed **€700/day** (≈€90k loaded annual / ~130 productive days per half-year). External
> contractor (if used) **€1,000/day**. Ranges reflect uncertainty; we quote conservative–likely.

---

## 1. Pilot cost (Phases 0–3, ~9 weeks)

| Item | Assumption | Estimate (EUR) |
|---|---|---|
| Data/ML engineer | 0.8 FTE × 9 wk × €700/day | **€25,000** |
| Procurement SME | 0.3 FTE × 9 wk × €700/day | **€9,500** |
| Exec sponsor + finance | light, ~3 days total | **€2,000** |
| Cloud compute (training/serving, pilot scale) | small VM + storage, ~€300/mo × 3 | **€900** |
| Forecasting tooling | open-source (Prophet/statsforecast/sklearn) | **€0** |
| BI licences | Power BI Pro, ~3 seats × €10/mo × 3 | **€90** |
| Data platform / API hosting | existing Railway-style host | **€60** |
| Contingency (~15%) | | **€5,500** |
| **Pilot total** | | **≈ €43,000** *(range €35k–€55k)* |

**Why so lean:** the proof-of-concept, data model, measures and dashboard **already exist**. The
pilot is *validation*, not greenfield build — that's the core cost advantage of this use case.

---

## 2. Rollout cost (Phases 4–5, first year after pilot)

| Item | Assumption | Estimate (EUR/yr) |
|---|---|---|
| Model owner | 0.5 FTE ongoing (drift/retrain — mitigates R1 `[B2]`) | **€45,000** |
| Engineering extend to all categories | ~6 wk one-off | **€18,000** |
| Cloud compute (production scale) | €500–€900/mo | **€8,000** |
| BI licences | ~15 seats Power BI Pro | **€1,800** |
| Monitoring / alerting | lightweight | **€1,200** |
| Training & change management | workshops, docs | **€6,000** |
| Contingency (~15%) | | **€12,000** |
| **Year-1 rollout total** | | **≈ €92,000** *(range €75k–€115k)* |

---

## 3. Total cost of ownership (illustrative)

| | EUR |
|---|---|
| Pilot (one-off) | ~€43,000 |
| Year-1 rollout | ~€92,000 |
| **Year-1 all-in** | **~€135,000** |
| Year-2+ run-rate (owner + infra + licences) | ~€60,000/yr |

---

## 4. Value side (for the ROI conversation — deliberately conservative)

On ~€640m managed spend, even a **small** inventory/working-capital or stockout-avoidance effect
dwarfs the cost. Illustrative, **to be validated in the pilot, not promised**:

- Vendor evidence: AI forecasting cuts error 30–50%, inventory 20–50%, stockout lost-sales up to
  65% `[D1]` — **treat as upper bound** (vendor).
- Academic evidence: most real supply-chain AI savings are **<10%** `[A1]` — **use this as the base
  case.** A <10% improvement on even a *fraction* of inventory carrying cost or avoided-stockout
  revenue clears a €135k year-1 cost easily.
- The honest framing for Cleo: the case rests on **risk reduction** (avoided stockouts on volatile
  chip lead times `[E1]`) + **working capital**, not a heroic cost-out number.

> **Break-even:** if the pilot shows even a ~€150k/yr combined working-capital + avoided-stockout
> benefit (a small % of a €640m operation), the program pays for itself inside year 1.

---

## 5. Cost assumptions & caveats
- Internal blended rate €700/day; contractor €1,000/day — adjust to actual DACH loaded costs.
- Open-source forecasting (no per-seat AI platform fee). A commercial platform (o9/ToolsGroup/Oracle)
  would add **€50k–€250k+/yr** — explicitly **out of scope** for the pilot to avoid vendor lock-in (R8).
- Figures exclude any net-new data-center hardware (that's the spend being optimized, not a project cost).
- All ROI is **assumption until the pilot holdout validates it** (see
  [`../research/hype_vs_evidence.md`](../research/hype_vs_evidence.md)).
