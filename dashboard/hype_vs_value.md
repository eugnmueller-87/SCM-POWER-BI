# Hype-vs-Value Layer — "Pilot, Wait, or Invest"

A per-page honesty note for Cleo (CEO). For each page it separates **robust evidence**
(a metric you can act on now) from **needs validation** (a metric that looks compelling but
rests on assumptions or thin data). The point: the dashboard should *earn* an investment
decision, not manufacture one.

> Verdict scale per metric: 🟢 **Robust** (act on it) · 🟡 **Directional** (use as a signal,
> validate before betting budget) · 🔴 **Placeholder** (modelled constant — replace with real
> data before quoting).

---

## Page 1 — Executive Cockpit

| Metric | Verdict | Why |
|---|---|---|
| Total SCM Cost | 🟡 Directional | Spend portion is solid; the +3.5% SCM-overhead uplift is a modelled assumption. Validate overhead with finance. |
| Net Savings (realized) | 🟡 Directional | Realization rate (72%) and avoidance (1.3%) are assumptions. The *shape* (leakage exists) is the robust insight; the exact € needs the savings tracker. |
| Perfect Order Fulfillment % | 🟢 Robust | Spend-weighted from supplier OTIF — a defensible reliability proxy. |
| WMAPE trend | 🟢 Robust | Computed straight from planned vs actual; the downward trend is real in the data. **This is the strongest "analytics works" evidence.** |
| Resilience Score | 🟡 Directional | A blended index — useful for ranking/tracking, but the weights are a design choice, not a standard. Don't quote the absolute number to the board; quote the ranking. |
| % Single-Source Spend | 🟢 Robust | Direct from supplier flags × spend. Concrete and actionable. |

**Page recommendation:** the cockpit supports **INVEST in forecasting analytics** (WMAPE
trend is robust) and **PILOT a savings-leakage fix** (the leakage shape is robust; the € is not).

---

## Page 2 — Spend & Savings

| Metric | Verdict | Why |
|---|---|---|
| Spend cube (supplier×category×month) | 🟢 Robust | Raw transactional aggregation. Trustworthy. |
| Tail-spend Pareto | 🟢 Robust | Pure distribution of real spend. The consolidation case is sound. |
| Maverick / No-PO % | 🟢 Robust | Direct flags. Off-contract leakage is a real, fixable lever. |
| Contract coverage % | 🟢 Robust | Direct. 64% with headroom = a clear KPI to move. |
| Addressable vs influenceable | 🟡 Directional | Robust given the category flags, but the flags themselves encode a policy judgment (what's "addressable") — confirm with category managers. |
| Savings waterfall €s | 🔴 Placeholder | Built on assumed %s. Replace with the savings tracker before quoting absolute numbers. |

**Page recommendation:** **INVEST** in tail-spend consolidation and maverick-spend
reduction (robust), **WAIT** on quoting precise savings € until a tracker feeds the waterfall.

---

## Page 3 — Forecast: Planned vs Executed

| Metric | Verdict | Why |
|---|---|---|
| WMAPE by category×month | 🟢 Robust | Computed from the data; correctly localises the Logistics disruption. |
| WMAPE trend | 🟢 Robust | The headline analytics-value evidence. |
| Forecast Bias % | 🟢 Robust | Direct ratio; the control band makes "in/out of control" objective. |
| RMSE | 🟢 Robust | Direct; complements WMAPE for outliers. |
| Plan/Schedule Adherence % | 🟡 Directional | Robust formula, but the ±2-day tolerance is a chosen threshold — agree it with ops. |

**Page recommendation:** **INVEST** — this page is the strongest evidence base. The metrics
are computed, not assumed, and they tell a true "improving with one explained miss" story.

---

## Page 4 — Resilience

| Metric | Verdict | Why |
|---|---|---|
| TTR vs TTS scatter + TTS>TTR rule | 🟢 Robust | The rule is a recognised resilience principle; violations are computed from the data. Strong board visual. |
| TTA / TTAct / TTR (from disruptions) | 🟢 Robust | Derived empirically from event timestamps. |
| TTS (buffer) | 🟡 Directional | In real life TTS depends on buffer stock / SLAs / redundancy that must be measured per node — here it's modelled. Validate the buffer assumptions per critical supplier. |
| Resilience Score | 🟡 Directional | Same caveat as Page 1 — a useful rank, not a standard. |
| Disruption impact € | 🟡 Directional | Event costs are modelled; the *relative* ranking by category is the trustworthy part. |

**Page recommendation:** **PILOT** a resilience program on the violators list — the *which
suppliers* is robust; the *exact buffer days and €* need per-supplier validation.

---

## One-line decision summary for Cleo
> **Invest now** where the metric is computed from data (forecast accuracy, tail/maverick
> spend, single-source concentration). **Pilot** where the *shape* is real but the *euros*
> are modelled (savings leakage, resilience buffers). **Wait** on quoting any absolute €
> that currently rests on a 🔴 placeholder until the underlying tracker is connected.
