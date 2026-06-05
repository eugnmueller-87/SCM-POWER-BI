# Timeline Estimate — AI Demand Forecasting Pilot → Rollout

Cloud/hosting enterprise (~5,000 employees). Maps to the phases in
[`../implementation/implementation_plan.md`](../implementation/implementation_plan.md).

---

## Gantt-style overview (weeks)

```
Phase                          W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 W11  →ongoing
0 Discovery validation         ██ ██
1 Data access & prep              ██ ██
2 Prototype / PoC                    ██ ██ ██
3 Pilot (live, subset)                     ██ ██ ██ ██
4 Rollout & handoff                                 ██ ██  ██
5 Monitor & improve                                        ████████→
```

| Phase | Duration | Calendar (from kickoff) | Key milestone / gate |
|---|---|---|---|
| 0 · Discovery validation | 2 wk | Weeks 1–2 | Scope + success criteria signed |
| 1 · Data access & prep | 2 wk | Weeks 2–3 | Data-quality gate passed |
| 2 · Prototype / PoC | 3 wk | Weeks 3–5 | **Holdout WMAPE ↓ ≥20%** (go/no-go) |
| 3 · Pilot | 4 wk | Weeks 5–9 | Success criteria met |
| 4 · Rollout & handoff | 2–3 wk | Weeks 9–11 | Owner + monitoring live |
| 5 · Monitor & improve | ongoing | Week 11 → | Drift SLA held; quarterly retrain |

**Pilot-to-decision: ~9 weeks. Pilot-to-rollout-complete: ~11 weeks.**

---

## Critical path & dependencies
- **Phase 1 → 2 is the bottleneck:** model quality is capped by data quality. If the data-quality
  gate slips, everything downstream slips. Budget buffer here.
- **Phase 2 gate is the real decision point:** if the holdout doesn't beat baseline, stop or iterate
  *before* spending pilot money.
- Phases overlap intentionally (1 starts while 0 finishes) to compress wall-clock.

## Timeline assumptions
- Single category in the pilot (parallelizing categories would extend Phase 3 but not the model work).
- 0.8 FTE engineer availability; a part-time engineer roughly doubles calendar time.
- No procurement freeze / no major data-platform migration mid-pilot.
- Decision latency (sponsor sign-offs) assumed ≤2 business days per gate.

## What could extend it
- Poor data quality (most common) → +1–3 wk in Phase 1.
- Model misses the gate → +2–4 wk iteration in Phase 2 (or stop).
- Slow stakeholder sign-off → adds directly to calendar at each gate.
