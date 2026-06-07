# SCM Master Tool — Measure Layer (Formulas + Power BI DAX)

**Single source of truth for every KPI on the dashboard.** Each measure below gives:
1. the **plain-English formula** (the definition you'd defend to an auditor), and
2. the **copy-paste DAX** for Power BI Desktop.

> **Convention:** create one *Measures* table (Home ▸ Enter Data ▸ empty table named `_Measures`)
> and add every measure there, so they're not scattered across fact tables. All measures
> assume the data model in [`dashboard/data_model.md`](../dashboard/data_model.md):
> `spend_transactions`, `suppliers`, `categories`, `contracts`, `forecast_vs_actual`,
> `disruptions`, `dim_date` (marked as the date table).

Frameworks anchored: **SCOR DS** (Reliability, Responsiveness, Agility, Cost, Asset Mgmt,
Environmental), **Forecast accuracy** (WMAPE / Bias / RMSE / Adherence), **Resilience**
(TTA / TTAct / TTR / TTS), **Spend & Savings** (spend cube, tail, maverick, coverage,
savings waterfall), **Clean-Sheet / Should-Cost** (cost floor, target price, cost gap,
addressable negotiation savings, commodity-adjusted floor). No ad-hoc KPIs.

---

## 0. Base / helper measures

```dax
Total Spend = SUM ( spend_transactions[amount_eur] )
```

```dax
Spend (Selected Period) =
-- respects whatever month slicer is applied; same as Total Spend but named for clarity on cards
CALCULATE ( [Total Spend] )
```

```dax
-- Latest closed month key (M3). Used to default cards to the current reporting month.
Latest Month =
CALCULATE ( MAX ( dim_date[month_key] ), ALL ( dim_date ) )
```

---

## 1. SCOR DS — Level-1 metrics

SCOR DS performance attributes and the Level-1 metric we use for each:

| SCOR attribute | Level-1 metric | Measure name below |
|---|---|---|
| Reliability | Perfect Order Fulfillment % | `Perfect Order Fulfillment %` |
| Responsiveness | Order Fulfillment Cycle Time | `Order Fulfillment Cycle Time (days)` |
| Agility | (proxy) Plan/Schedule Adherence % | see Forecast section |
| Cost | Total SCM Cost | `Total SCM Cost` |
| Asset Management | Cash-to-Cash Cycle Time | `Cash-to-Cash Cycle Time (days)` |
| Asset Management | Return on SC Fixed Assets | `Return on SC Fixed Assets` |
| Environmental | (out of scope for synthetic v1 — placeholder noted) | — |

### 1.1 Reliability — Perfect Order Fulfillment % (POF)

**Formula:** % of orders delivered complete, on time, in full, with no defects/errors.
We proxy POF at supplier level using OTIF, spend-weighted (a late order from a €5m
supplier should hurt more than from a €5k supplier).

```dax
Perfect Order Fulfillment % =
VAR SpendWeighted =
    SUMX (
        VALUES ( suppliers[supplier_id] ),
        VAR sp = [Total Spend]
        VAR otif = CALCULATE ( MAX ( suppliers[otif_pct] ) )
        RETURN sp * otif
    )
VAR TotalSp = [Total Spend]
RETURN DIVIDE ( SpendWeighted, TotalSp ) / 100
```

### 1.2 Responsiveness — Order Fulfillment Cycle Time

**Formula:** average elapsed time from order placement to receipt. We derive it from PO
schedule data: `actual_po_date − planned_po_date` gives lateness; cycle time is modelled
as a base lead time + observed lateness.

```dax
Order Fulfillment Cycle Time (days) =
-- base assumed order lead time (days) + average schedule slippage
VAR BaseLeadTime = 14
VAR AvgSlippage = AVERAGE ( forecast_vs_actual[po_late_days] )
RETURN BaseLeadTime + AvgSlippage
```

### 1.3 Cost — Total SCM Cost

**Formula:** total cost to plan, source, deliver and manage supply chain. For the synthetic
model we treat **Total Spend** as the dominant component and add a modelled SCM operating
overhead (people + systems) as a % of spend.

```dax
Total SCM Cost =
VAR OverheadRate = 0.035   -- ASSUMPTION: SCM opex ≈ 3.5% of managed spend
RETURN [Total Spend] * ( 1 + OverheadRate )
```

### 1.4 Asset Mgmt — Cash-to-Cash Cycle Time (C2C)

**Formula:** `DIO + DSO − DPO` (days inventory + days sales outstanding − days payables
outstanding). A cloud/hosting firm carries little inventory, so DIO is small. Values are
modelled constants here (no AR/AP tables in synthetic v1) and surfaced so the card exists
and can later bind to finance data.

```dax
Cash-to-Cash Cycle Time (days) =
VAR DIO = 6     -- low inventory (services/cloud)
VAR DSO = 41    -- ASSUMPTION
VAR DPO = 38    -- ASSUMPTION
RETURN DIO + DSO - DPO
```

### 1.5 Asset Mgmt — Return on SC Fixed Assets

**Formula:** `SC revenue contribution ÷ SC fixed assets`. Modelled ratio for completeness.

```dax
Return on SC Fixed Assets =
VAR SCFixedAssets = 120000000   -- ASSUMPTION: €120m SC-related fixed assets
VAR SCRevenueContribution = [Total Spend] * 0.9
RETURN DIVIDE ( SCRevenueContribution, SCFixedAssets )
```

---

## 2. Forecast accuracy — planned vs executed

Computed from `forecast_vs_actual` (one row per category × month).

### 2.1 WMAPE (primary) — Weighted Mean Absolute Percentage Error

**Formula:** `Σ|planned − actual| ÷ Σ planned`. Weighted by volume, so big categories
dominate — avoids the small-denominator blow-ups of plain MAPE.

```dax
WMAPE =
DIVIDE (
    SUMX ( forecast_vs_actual, ABS ( forecast_vs_actual[planned_volume] - forecast_vs_actual[actual_volume] ) ),
    SUM ( forecast_vs_actual[planned_volume] )
)
```

```dax
Forecast Accuracy % = 1 - [WMAPE]   -- friendlier "accuracy" framing for the CEO card
```

### 2.2 Forecast Bias % (control band 95–105%)

**Formula:** `Σ actual ÷ Σ planned`. >100% = under-forecasting (demand beat plan);
<100% = over-forecasting. Healthy control band: **95%–105%**.

```dax
Forecast Bias % =
DIVIDE ( SUM ( forecast_vs_actual[actual_volume] ), SUM ( forecast_vs_actual[planned_volume] ) )
```

```dax
-- 1 = inside the 95–105% control band, 0 = out of control (drives conditional formatting)
Bias In Control =
VAR b = [Forecast Bias %]
RETURN IF ( b >= 0.95 && b <= 1.05, 1, 0 )
```

### 2.3 RMSE — Root Mean Square Error (outlier catch)

**Formula:** `sqrt( mean( (planned − actual)² ) )`. Penalises large misses; complements
WMAPE by surfacing a single ugly month even when the weighted average looks fine.

```dax
RMSE =
SQRT (
    DIVIDE (
        SUMX ( forecast_vs_actual, ( forecast_vs_actual[planned_volume] - forecast_vs_actual[actual_volume] ) ^ 2 ),
        COUNTROWS ( forecast_vs_actual )
    )
)
```

### 2.4 Plan / Schedule Adherence % (SCOR Agility proxy)

**Formula:** % of committed POs executed on the planned date (within tolerance). We treat a
PO as adherent if it slipped ≤ 2 days.

```dax
Plan/Schedule Adherence % =
VAR Tolerance = 2
VAR Adherent = CALCULATE ( COUNTROWS ( forecast_vs_actual ), forecast_vs_actual[po_late_days] <= Tolerance )
VAR Total = COUNTROWS ( forecast_vs_actual )
RETURN DIVIDE ( Adherent, Total )
```

> **3-month trend, not pass/fail:** put `WMAPE`, `Forecast Bias %`, `Plan/Schedule Adherence %`
> on a line chart by `dim_date[month_key]`. The story is the *direction*, not a single gate.

---

## 3. Resilience — 4 time-based metrics + score

Derived empirically from `disruptions` (TTA/TTAct/TTR) and `suppliers` (TTS buffer).

### 3.1 The four time metrics

**Time-to-Awareness (TTA):** `detected_at − start`. How fast we *see* a disruption.

```dax
Time-to-Awareness (days) = AVERAGE ( disruptions[tta_days] )
```

**Time-to-Action (TTAct):** `action_at − detected_at`. How fast we *respond* once aware.

```dax
Time-to-Action (days) = AVERAGE ( disruptions[ttact_days] )
```

**Time-to-Recover (TTR):** `recovered_at − start`. How long until back to normal.

```dax
Time-to-Recover (days) = AVERAGE ( disruptions[ttr_days_empirical] )
```

**Time-to-Survive (TTS):** buffer (stock/redundancy/SLA) — how long we keep serving
customers *without* the node. From supplier master.

```dax
Time-to-Survive (days) = AVERAGE ( suppliers[TTS_days] )
```

### 3.2 The resilience rule: **TTS > TTR**

**Rule:** a node is resilient only if it can survive longer than it takes to recover
(`TTS > TTR`). Violations are the at-risk nodes to flag.

```dax
-- count of suppliers that VIOLATE the rule (TTS <= TTR) → headline risk count
Suppliers Violating TTS>TTR =
CALCULATE ( COUNTROWS ( suppliers ), suppliers[TTS_days] <= suppliers[TTR_days] )
```

```dax
-- % of suppliers that satisfy the rule (the healthy share)
TTS>TTR Pass Rate =
DIVIDE (
    CALCULATE ( COUNTROWS ( suppliers ), suppliers[TTS_days] > suppliers[TTR_days] ),
    COUNTROWS ( suppliers )
)
```

```dax
-- row-level flag for the resilience scatter (use as a calculated column on suppliers if preferred)
TTS Buffer Gap (days) = AVERAGE ( suppliers[TTS_days] ) - AVERAGE ( suppliers[TTR_days] )
```

### 3.3 Node-level Resilience Score (0–100)

**Formula:** blend of (a) buffer adequacy `TTS/TTR`, (b) inverse risk score, (c) detection
& action speed, (d) single-source penalty. Higher = more resilient.

```dax
Resilience Score =
VAR BufferRatio = DIVIDE ( AVERAGE ( suppliers[TTS_days] ), AVERAGE ( suppliers[TTR_days] ) )
VAR BufferComponent = MIN ( 1, BufferRatio / 2 ) * 40          -- up to 40 pts, saturates at TTS=2×TTR
VAR RiskComponent = ( 1 - AVERAGE ( suppliers[risk_score] ) / 100 ) * 35  -- up to 35 pts
VAR SingleSrcPenalty = AVERAGE ( suppliers[single_source_flag] ) * 15     -- up to −15 pts
VAR SpeedComponent =
    ( 1 - MIN ( 1, DIVIDE ( [Time-to-Awareness (days)] + [Time-to-Action (days)], 10 ) ) ) * 25  -- up to 25 pts
RETURN ROUND ( BufferComponent + RiskComponent + SpeedComponent - SingleSrcPenalty, 0 )
```

### 3.4 Single-source risk

```dax
% Single-Source Spend =
VAR SingleSpend =
    CALCULATE ( [Total Spend], suppliers[single_source_flag] = 1 )
RETURN DIVIDE ( SingleSpend, [Total Spend] )
```

```dax
Single-Source Supplier Count =
CALCULATE ( DISTINCTCOUNT ( suppliers[supplier_id] ), suppliers[single_source_flag] = 1 )
```

### 3.5 Disruption cost

```dax
Disruption Impact (EUR) = SUM ( disruptions[impact_eur] )
```

```dax
Disruption Count = DISTINCTCOUNT ( disruptions[event_id] )
```

---

## 4. Spend & savings

### 4.1 Spend cube components

```dax
Addressable Spend =
CALCULATE ( [Total Spend], categories[addressable_flag] = 1 )
```

```dax
Influenceable Spend =
CALCULATE ( [Total Spend], categories[influenceable_flag] = 1 )
```

```dax
% Addressable Spend = DIVIDE ( [Addressable Spend], [Total Spend] )
```

### 4.2 Maverick / off-contract spend

**Formula:** spend not placed against a contract ÷ total spend.

```dax
Maverick Spend % =
DIVIDE (
    CALCULATE ( [Total Spend], spend_transactions[on_contract_flag] = 0 ),
    [Total Spend]
)
```

```dax
No-PO Spend % =
DIVIDE (
    CALCULATE ( [Total Spend], spend_transactions[po_flag] = 0 ),
    [Total Spend]
)
```

### 4.3 Tail spend %

**Formula:** share of spend held by the long tail of small suppliers. Definition used:
suppliers beyond the 80% cumulative-spend cut-off (Pareto). We compute the **share of
spend** sitting in suppliers each contributing < 1% of total spend — a stable, CEO-legible
definition.

```dax
Tail Spend % =
VAR ThresholdShare = 0.01   -- suppliers below 1% of total spend each = "tail"
VAR TotalSp = [Total Spend]
VAR TailSp =
    SUMX (
        VALUES ( suppliers[supplier_id] ),
        VAR sp = [Total Spend]
        RETURN IF ( DIVIDE ( sp, TotalSp ) < ThresholdShare, sp, 0 )
    )
RETURN DIVIDE ( TailSp, TotalSp )
```

```dax
Tail Supplier Count =
VAR TotalSp = CALCULATE ( [Total Spend], ALL ( suppliers ) )
RETURN
    SUMX (
        VALUES ( suppliers[supplier_id] ),
        VAR sp = [Total Spend]
        RETURN IF ( DIVIDE ( sp, TotalSp ) < 0.01, 1, 0 )
    )
```

### 4.4 Contract coverage %

**Formula:** spend placed with suppliers holding a contract active in the period ÷ total
spend. (Modelled here via `on_contract_flag`, which is set when the transaction's supplier
has an active contract.)

```dax
Contract Coverage % =
DIVIDE (
    CALCULATE ( [Total Spend], spend_transactions[on_contract_flag] = 1 ),
    [Total Spend]
)
```

### 4.5 Savings waterfall — negotiated vs realized vs cost avoidance

**Formula:** savings are modelled as % factors on addressable spend (no separate savings
table in synthetic v1 — documented assumption). The waterfall reads:
`Negotiated → (leakage) → Realized → (+) Cost Avoidance → Net Savings`.

```dax
Negotiated Savings =
-- ASSUMPTION: 4.5% of addressable spend negotiated in-year
[Addressable Spend] * 0.045
```

```dax
Realized Savings =
-- ASSUMPTION: 72% of negotiated savings actually hit the P&L (28% leakage)
[Negotiated Savings] * 0.72
```

```dax
Savings Leakage = [Negotiated Savings] - [Realized Savings]
```

```dax
Cost Avoidance =
-- ASSUMPTION: cost avoidance ≈ 1.3% of addressable spend (renewals held flat, scope cuts)
[Addressable Spend] * 0.013
```

```dax
Net Savings (Realized + Avoidance) = [Realized Savings] + [Cost Avoidance]
```

```dax
Savings Realization Rate % = DIVIDE ( [Realized Savings], [Negotiated Savings] )
```

> **Waterfall build:** use a Waterfall visual with manually-entered category steps, or a
> small disconnected `_SavingsSteps` table (`step_name`, `sort`) and a SWITCH measure that
> returns the right component per step. Steps: *Negotiated → −Leakage → Realized →
> +Cost Avoidance → Net*.

```dax
Savings Waterfall Value =
SWITCH (
    SELECTEDVALUE ( _SavingsSteps[step_name] ),
    "Negotiated", [Negotiated Savings],
    "Leakage", -[Savings Leakage],
    "Realized", [Realized Savings],
    "Cost Avoidance", [Cost Avoidance],
    "Net Savings", [Net Savings (Realized + Avoidance)],
    BLANK ()
)
```

---

## 4b. Clean-Sheet / Should-Cost — the margin lever

Backed by the SCM-Master `costing` domain (a 5-element clean-sheet teardown indexed to
commodity markets — see `docs/should_cost_model.md` in that repo). These read two new API
tables loaded via Power Query (same OAuth2 → Bearer auto-login pattern as the rest):

- `should_cost_by_supplier` ← `GET /api/v1/analytics/should-cost/by-supplier`
  (per-product: `should_cost_floor`, `target_price`, `quoted_price`, `gap_to_target_abs`,
  `gap_to_target_pct`)
- `should_cost_savings` ← `GET /api/v1/analytics/should-cost/savings`
  (`total_gap_to_target`, `products_with_bom`, `products_above_target`)

> **Headline = vs target, backstop = vs floor.** The negotiation ask is measured against
> `target_price` (floor + a fair margin a supplier would accept), never the bare floor — no
> supplier sells at cost. The floor is kept as a secondary ranking signal (total margin
> stacked in the quote). See the model spec §5.

```dax
-- The defensible cost floor (supplier cost at zero margin), summed across BOM'd products
Should-Cost Floor = SUM ( should_cost_by_supplier[should_cost_floor] )
```

```dax
-- The fair price we should pay: floor + a conceded target margin
Target Price = SUM ( should_cost_by_supplier[target_price] )
```

```dax
-- Headline negotiation gap: how far the quote sits above a fair target price
Cost Gap % =
DIVIDE (
    SUM ( should_cost_by_supplier[gap_to_target_abs] ),
    SUM ( should_cost_by_supplier[quoted_price] )
)
```

```dax
-- The € that goes on the slide: realistic addressable negotiation savings (vs target)
Addressable Negotiation Savings = SUM ( should_cost_savings[total_gap_to_target] )
```

```dax
-- Commodity-Adjusted Floor: the floor recomputed at the current index (already index-aware
-- in the engine; this names the as-of-driven value for a "floor moves with the market" card)
Commodity-Adjusted Floor = [Should-Cost Floor]
```

**New page — "Should-Cost / Margin Lever":** KPI cards (Addressable Savings, Avg Cost Gap %),
*Quote vs Target vs Floor* bars per product, *Gap by Component Class* (where margin leaks),
*Commodity Sensitivity* tornado (floor vs DRAM/NAND ±X% — from `/products/{id}/sensitivity`),
and *Gap by Supplier* (the negotiation target list). On the existing Spend page, overlay a
should-cost-floor reference line behind actual spend — one glance shows paid-vs-floor.

---

## 5. KPI ↔ framework cross-reference

| # | KPI | Framework | Measure |
|---|---|---|---|
| 1 | Perfect Order Fulfillment % | SCOR Reliability | `Perfect Order Fulfillment %` |
| 2 | Order Fulfillment Cycle Time | SCOR Responsiveness | `Order Fulfillment Cycle Time (days)` |
| 3 | Total SCM Cost | SCOR Cost | `Total SCM Cost` |
| 4 | Cash-to-Cash Cycle Time | SCOR Asset Mgmt | `Cash-to-Cash Cycle Time (days)` |
| 5 | Return on SC Fixed Assets | SCOR Asset Mgmt | `Return on SC Fixed Assets` |
| 6 | WMAPE | Forecast (primary) | `WMAPE` / `Forecast Accuracy %` |
| 7 | Forecast Bias % | Forecast (control band) | `Forecast Bias %` / `Bias In Control` |
| 8 | RMSE | Forecast (outlier) | `RMSE` |
| 9 | Plan/Schedule Adherence % | Forecast / SCOR Agility | `Plan/Schedule Adherence %` |
| 10 | Time-to-Awareness | Resilience | `Time-to-Awareness (days)` |
| 11 | Time-to-Action | Resilience | `Time-to-Action (days)` |
| 12 | Time-to-Recover (TTR) | Resilience | `Time-to-Recover (days)` |
| 13 | Time-to-Survive (TTS) | Resilience | `Time-to-Survive (days)` |
| 14 | TTS>TTR rule | Resilience | `Suppliers Violating TTS>TTR`, `TTS>TTR Pass Rate` |
| 15 | Resilience Score | Resilience | `Resilience Score` |
| 16 | % Single-Source Spend | Resilience | `% Single-Source Spend` |
| 17 | Addressable / Influenceable | Spend cube | `Addressable Spend`, `Influenceable Spend` |
| 18 | Maverick / Off-contract % | Spend | `Maverick Spend %`, `No-PO Spend %` |
| 19 | Tail Spend % | Spend | `Tail Spend %`, `Tail Supplier Count` |
| 20 | Contract Coverage % | Spend | `Contract Coverage %` |
| 21 | Savings waterfall | Spend / Savings | `Negotiated/Realized/Cost Avoidance/Net Savings` |
| 22 | Should-Cost Floor | Clean-Sheet / Should-Cost | `Should-Cost Floor` |
| 23 | Target Price | Clean-Sheet / Should-Cost | `Target Price` |
| 24 | Cost Gap % | Clean-Sheet / Should-Cost | `Cost Gap %` |
| 25 | Addressable Negotiation Savings | Clean-Sheet / Should-Cost | `Addressable Negotiation Savings` |
| 26 | Commodity-Adjusted Floor | Clean-Sheet / Should-Cost | `Commodity-Adjusted Floor` |
