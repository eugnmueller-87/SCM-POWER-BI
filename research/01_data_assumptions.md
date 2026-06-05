# Research Note 01 — Synthetic Data Assumptions

Reusable assumptions behind [`scripts/generate_data.py`](../scripts/generate_data.py).
Drop these into project write-ups. **All data is synthetic; no real company data is used.**

## Company profile (synthetic)
- Mid-to-large **cloud/hosting** company, **DACH**, Microsoft-365 ecosystem.
- Procurement is **indirect + IT/cloud heavy**.
- ~**€640m/year** managed spend (→ ~€1.34bn over the 24-month history).

## Horizon
- **24 months** of monthly history for trend, ending at the latest closed month **M3**.
- Anchor: M3 = **2026-05**, so M1/M2/M3 = **Mar/Apr/May 2026**.

## Categories (6) & spend shares
| Category | Addressable | Influenceable | Share |
|---|---|---|---|
| IT & Cloud | ✓ | ✓ | 34% |
| Hardware | ✓ | ✓ | 18% |
| Marketing | ✗ | ✓ | 14% |
| Logistics | ✓ | ✓ | 12% (← disrupted category) |
| Professional Services | ✗ | ✓ | 12% |
| Facilities | ✓ | ✓ | 10% |

Addressable ⊂ influenceable. Marketing & Prof. Services are influenceable but not fully
addressable (business-owned), so they also carry more **maverick** spend.

## Suppliers (80)
- DACH-weighted countries (DE 42%, AT/CH 10% each, NL/FR 8%, PL 7%, US 10%, IE 5%).
- Tier mix: T1 22% (strategic), T2 43%, T3 35%.
- **Single-source ≈ 17.5%** of suppliers (more common in T1).
- `risk_score` 0–100 rises with single-source and criticality (lower tier number).
- `TTR_days` (recover) rises with risk & single-source.
- `TTS_days` (survive) = TTR × factor; factor ~N(1.55,.40) multi-source, ~N(1.05,.45)
  single-source → **~15% of suppliers violate TTS>TTR** (the at-risk nodes).
- `on_time_pct` / `otif_pct` correlated with inverse risk (OTIF ≤ on-time by definition).

## Contracts (~74)
- ~82% of suppliers have ≥1 contract; values scale by tier (T1 ~€4.5m, T2 ~€1.4m, T3 ~€350k/yr).
- Terms 12–36 mo; ~85% active at M3, ~15% deliberately lapsed (so "lapsed contract" is a real signal).
- `auto_renew_flag` ≈ 55%.

## Spend transactions (~3,600 lines / 24 mo)
- Gentle upward trend (+0.4%/mo) + mild seasonality (Q4 +6%, summer −4%).
- Per-supplier size weight is lognormal → **Pareto tail** (62% of suppliers ≈ 20% of spend).
- `on_contract_flag`: 96% if supplier has an active contract, 66% otherwise, −13pp for
  Marketing/Prof. Services → **maverick (off-contract) spend ≈ 20%**.
- `po_flag` correlates with on-contract → **no-PO spend ≈ 13%**.
- **Contract coverage of M3 spend ≈ 64%** (headroom for the "invest" story).

## Forecast vs actual (144 rows = 6 cat × 24 mo)
- Error = deterministic magnitude `mu_err` (signal) + small jitter (σ=1.2%).
- `mu_err` shrinks toward the present (learning curve): ~16–20% early → 6–8% recent.
- Consistent slight **over-forecast** (actual below plan) shrinking toward neutral bias.
- **Disrupted category = Logistics:** clear WMAPE spike in **M2 (~24%)**, partial recovery
  **M3 (~13%)**, while overall WMAPE still trends down (9.2% → 9.0% → 7.6%).
- `po_late_days` (Poisson) larger in history, smaller recently; Logistics late in M2 →
  feeds Plan/Schedule Adherence %.

## Disruptions (22 events / 24 mo)
- Biased toward higher-risk & single-source suppliers.
- Timestamps: `start → detected_at → action_at → recovered_at` give empirical
  **TTA / TTAct / TTR**; `TTS` comes from supplier buffer.
- Single-source events recover ~20% slower and cost ~60% more.
- ~18% of events had **TTS ≤ empirical TTR** (would have caused a stockout).

## Reproducibility
- RNG seed **42** (NumPy `default_rng`). Re-running reproduces identical CSVs.

## Sanity-check targets (printed on run)
| Check | Target | Actual |
|---|---|---|
| Maverick spend % | 12–22% | ~20% |
| No-PO spend % | 10–18% | ~13% |
| Single-source supplier % | 15–20% | 17.5% |
| Suppliers violating TTS>TTR | 15–30% | 15% |
| WMAPE trend M1→M3 | falling | 9.2% → 7.6% |
| Logistics WMAPE M2 | spike | ~24% |
| Contract coverage (M3) | 60–88% | ~64% |
| Tail: % suppliers for 20% spend | Pareto | ~62% |
