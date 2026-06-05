# Power BI Dashboard Spec — SCM Master Tool

Build spec for the `.pbix`. Four pages, designed for **Cleo (non-technical CEO)** deciding
whether AI/analytics investment is worth it. Every visual follows **communication-layer**
principles:

- **One insight per visual.** If a chart needs two sentences to explain, it's two charts.
- **So-what callout on every visual** (a text box stating the takeaway, not the mechanics).
- **Minimal chartjunk:** no 3-D, no gradient fills, no dual axes unless unavoidable, data
  labels only where they carry the message, gridlines muted.
- **Single source of truth:** every number comes from a measure in `_Measures` — no visual
  computes its own logic.
- **Consistent semantics:** green = good/on-track, amber = watch, red = act. Same palette
  on every page.

> **Color tokens** (set in Theme): `#1F6F54` good · `#E8B23A` watch · `#C44536` act ·
> `#2E3A46` text · `#F4F6F8` page background · `#5B7B9A` neutral accent.

---

## Global elements (every page)

- **Header band:** tool name "SCM Master Tool", page title, and the reporting month
  selector (slicer on `dim_date[reporting_label]` defaulting to **M3**).
- **Period slicer:** `dim_date[month_key]` as a dropdown for trend pages.
- **Footer microcopy:** "Synthetic data — illustrative only. v1." (honesty for the CEO).
- **Navigation:** four page buttons top-right (Cockpit · Spend · Forecast · Resilience).

---

## PAGE 1 — "Executive Cockpit" (CEO view)

**Job of this page:** in 10 seconds, answer *"Is the supply chain under control, and is the
analytics investment paying off?"* Everything here is a headline; detail lives on pages 2–4.

### Layout (top to bottom)
Row A: 6 KPI cards · Row B: savings waterfall (left) + resilience risk matrix (right) ·
Row C: forecast-accuracy 3-month line (full width).

### Row A — 6 headline KPI cards

| # | Card | Measure | Chart type | Why CEO-readable |
|---|---|---|---|---|
| 1 | **Total SCM Cost** | `Total SCM Cost` | Card + trend sparkline | One big euro number = the cost of running supply chain. Sparkline shows direction without a second chart. |
| 2 | **Net Savings (realized)** | `Net Savings (Realized + Avoidance)` | Card w/ target | "What did procurement put back in the P&L." Pair with `Savings Realization Rate %` as the subtitle. |
| 3 | **Perfect Order Fulfillment** | `Perfect Order Fulfillment %` | KPI card | Single reliability number; green ≥ 95%. Answers "are we delivering?". |
| 4 | **WMAPE (trend)** | `WMAPE` | Card + sparkline | Forecast error, lower = better. Sparkline = the "are we getting smarter?" proof. |
| 5 | **Resilience Score** | `Resilience Score` | Gauge (0–100) | Single 0–100 resilience number a CEO can track over time. |
| 6 | **% Single-Source Spend** | `% Single-Source Spend` | Card | The "concentration risk in one number" card; red if > 20%. |

**Card formatting:** big value, tiny label, conditional color from the measure's thresholds.
No decorative icons. Each card's *so-what* is its color + one-word status (On track / Watch / Act).

### Row B-left — **Savings waterfall**
- **Chart type:** Waterfall.
- **Category (X):** `_SavingsSteps[step_name]` (sorted). **Y:** `Savings Waterfall Value`.
- **Steps:** Negotiated → −Leakage → Realized → +Cost Avoidance → **Net Savings** (total).
- **Why CEO-readable:** shows *where negotiated savings leak* before they reach the P&L —
  the single most persuasive procurement-value visual.
- **So-what callout:** e.g. "Only 72% of negotiated savings reach the P&L — €X leaks. Closing
  half of that leakage funds the analytics investment."

### Row B-right — **Resilience risk matrix**
- **Chart type:** Matrix (or 2×2 scatter). Rows = `suppliers[single_source_flag]`
  (Single / Multi). Columns = TTS>TTR pass/fail bucket. Values = supplier count + `Disruption Impact (EUR)`.
- **Conditional formatting:** red cell = single-source **and** TTS≤TTR (the danger quadrant).
- **Why CEO-readable:** instantly isolates "how many suppliers are both concentrated and can't
  survive a shock" — the nodes that need board attention.
- **So-what callout:** "N suppliers sit in the danger quadrant (single-source & can't outlast
  recovery). They carry €X of disruption exposure."

### Row C — **Forecast-accuracy 3-month line**
- **Chart type:** Line. **X:** `dim_date[month_key]` (last 3 = M1–M3, plus faded history).
  **Y (line 1):** `WMAPE`. **Y (line 2, secondary):** `Plan/Schedule Adherence %`.
- **Reference band:** shade the "good" WMAPE zone (< 8%).
- **Why CEO-readable:** the "is analytics working?" chart. Downward WMAPE + upward adherence
  = the investment thesis, shown as a *trend* (not a pass/fail gate).
- **So-what callout:** "Forecast error fell from 9.2% → 7.6% over three months while one
  category (Logistics) absorbed a disruption — the system is learning."

---

## PAGE 2 — "Spend & Savings"

**Job:** let a curious CEO/CFO drill the spend cube and see the savings levers.

| Visual | Chart type | Fields | Why CEO-readable |
|---|---|---|---|
| **Spend cube** | Matrix | Rows `suppliers[name]` ▸ drill to `categories[name]`; Columns `dim_date[month_name]`; Values `Total Spend` | The single drill-anywhere table — supplier × category × month, the "spend cube". |
| **Addressable vs Influenceable** | 100% stacked bar | `Total Spend` split by `Addressable Spend` / rest, by category | Shows how much spend procurement can actually act on. |
| **Tail-spend Pareto** | Pareto (bar + cumulative line) | suppliers by `Total Spend` desc, cumulative % line | "62% of suppliers = 20% of spend." The consolidation case in one picture. |
| **Maverick & No-PO** | Two gauge/cards + trend | `Maverick Spend %`, `No-PO Spend %` over months | Off-contract leakage; a concrete savings/compliance lever. |
| **Contract coverage** | KPI card + line | `Contract Coverage %` by month | Higher coverage → more spend under negotiated terms. |
| **Savings detail** | Waterfall (same as P1) + table | savings measures by category | Lets finance verify the headline savings number. |

**So-what callouts (page-level):** "Contract coverage is 64% — every 10 points of coverage
typically converts ~€X of maverick spend to negotiated terms." · "Tail consolidation could
remove N suppliers carrying only Y% of spend but Z% of PO transaction cost."

---

## PAGE 3 — "Forecast: Planned vs Executed"

**Job:** prove forecast quality is improving and localise where it isn't.

| Visual | Chart type | Fields | Why CEO-readable |
|---|---|---|---|
| **WMAPE by category × month** | Heatmap matrix | Rows `categories[name]`, Cols `dim_date[month_key]`, Values `WMAPE` w/ color scale | Red cell instantly = the disrupted category (Logistics M2). One glance finds the problem. |
| **WMAPE trend** | Line | `WMAPE` by month, one line per category (or overall + Logistics highlighted) | Direction of travel; the learning curve. |
| **Forecast Bias control chart** | Line + 95–105% band | `Forecast Bias %` by month w/ `Bias In Control` color | Are we systematically over/under-forecasting? Band makes "in control" obvious. |
| **RMSE callout** | Card | `RMSE` | Catches a single ugly miss even when WMAPE looks calm. |
| **Plan/Schedule Adherence** | Line / bar | `Plan/Schedule Adherence %` by month & category | Did committed POs execute on time? SCOR Agility proxy. |

**So-what callout:** "Overall forecast error is falling, but Logistics spiked to 24% in M2
(a supplier disruption) and is recovering. The model is sound; the miss was an event, not a
trend — which is exactly what good analytics should let you say."

---

## PAGE 4 — "Resilience"

**Job:** make supply-chain fragility visible and rankable.

### Hero visual — **TTR vs TTS supplier scatter**
- **Chart type:** Scatter. **X:** `suppliers[TTR_days]` · **Y:** `suppliers[TTS_days]` ·
  **Size:** `Total Spend` · **Color:** `suppliers[single_source_flag]`.
- **Diagonal reference line:** `TTS = TTR`. Points **below** the diagonal violate the rule
  (can't survive long enough to recover) → the red zone.
- **Why CEO-readable:** one picture answers "which suppliers can't outlast their own recovery
  time, and how much spend rides on them." Single-source dots below the line = board-level risk.
- **So-what callout:** "Every dot below the diagonal is a supplier we can't outlast in a shock.
  The big single-source dots there are the first dual-sourcing candidates."

### Supporting visuals

| Visual | Chart type | Fields | Why CEO-readable |
|---|---|---|---|
| **Four resilience times** | 4 cards | TTA / TTAct / TTR / TTS averages | The response-speed scorecard: see → react → recover → survive. |
| **Violations list** | Table | suppliers where TTS≤TTR, with risk, spend, single-source | The action list — who to fix first, ranked by spend. |
| **Disruption cost by category** | Bar | `Disruption Impact (EUR)` by category | Where shocks actually cost money. |
| **Single vs multi-source split** | Donut | `% Single-Source Spend` | Concentration risk at a glance. |

**So-what callout:** "18% of suppliers can't currently survive longer than they take to
recover. They carry €X of historical disruption cost — dual-sourcing the top 5 removes most
of that exposure."

---

## Communication-layer checklist (apply before sign-off)
- [ ] Every visual has exactly one takeaway and a so-what text box.
- [ ] No visual computes logic — all numbers trace to a `_Measures` measure.
- [ ] Color semantics identical across pages (green/amber/red = on-track/watch/act).
- [ ] Cockpit readable in < 10 seconds with no training.
- [ ] Footer states data is synthetic.
- [ ] Trends shown as direction, not pass/fail gates (esp. forecast accuracy).
