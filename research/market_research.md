# Market Research — AI Adoption for Procurement & Demand Forecasting

**Sector:** Cloud / hosting & data-center infrastructure (DACH, Microsoft-365 ecosystem)
**Company size:** Large enterprise (~5,000 employees, IONOS-scale)
**Decision owner:** Cleo — non-technical CEO asking *"Is AI/analytics investment worth it?"*

All external claims are cited inline as `[n]` and listed in [`../sources.md`](../sources.md).
Operational figures (e.g. our backtested forecast accuracy) come from the **synthetic** dataset and
are labelled as such.

---

## 1. Why this sector, why now

A large cloud/hosting company buys **servers, processors, memory, storage, networking and power**
to keep data centers expanding. Three forces make demand forecasting both **harder** and **more
valuable** right now:

1. **Forecasting is genuinely hard for this category.** Traditional models (ARIMA, exponential
   smoothing) look only at historical sales and "are getting outdated because of the increased
   amount of data generated from businesses and external sources" `[D2]`. Demand for compute is
   driven by external signals — AI workload growth, customer churn, macro shifts — that classical
   models don't see `[D4]`.

2. **The hardware supply side is in a geopolitical squeeze.** ~**90% of the most advanced chips
   are manufactured in Taiwan** `[A3]`, a single-node risk in the Taiwan Strait `[A2]`. Export
   controls, tariffs and localization pressure are lengthening and destabilizing lead times `[E2][E3]`.
   Concretely: **memory prices rose ~4× between Sep–Nov 2025**, and **China controls ~79% of
   tungsten** (a chip input), with a **2026 supply deficit forecast** `[E1]`. When lead times jump
   from 16 to 30+ days unpredictably, a static reorder point silently fails.

3. **The market is voting with money.** AI-in-supply-chain is ~**$13.93B in 2025**, projected to
   **$50.41B by 2032 (CAGR ~20.1%)**, with **demand planning the dominant segment** `[C1]`.

> **The "why now" in one line:** demand is harder to predict *and* the cost of being wrong (a
> stockout of GPUs whose lead time just doubled) is rising — exactly the conditions where AI
> forecasting earns its keep.

---

## 2. AI adoption signals — is anyone actually doing this?

| Signal | Figure | Source |
|---|---|---|
| Orgs using AI in ≥1 business function | **78%** (2024), **88%** (2025) | `[A1]`, `[B1]` |
| Orgs reporting **cost savings** from GenAI in **supply chain / inventory** | **61%** | `[A1]` |
| Orgs reporting **revenue gains** in supply-chain management | **63%** | `[A1]` |
| Orgs achieving **first-year ROI** on AI | **74%** | `[B1]` |
| AI forecasting **error reduction** | **30–50%** | `[D1]` |
| Stockout-driven **lost-sales reduction** | up to **65%** | `[D1]` |
| **Inventory reduction** possible | **20–50%** | `[D1]` |

Adoption is real and mainstream — this is **not** a bleeding-edge bet. But the headline savings
numbers (D-sources) are **vendor-leaning** and should be read as upper bounds, not promises (see
the hype-vs-evidence analysis).

---

## 3. AI adoption examples in the sector (labelled by source type)

- **Hyperscalers (AWS, Azure, Google Cloud)** run ML demand/ capacity forecasting at scale and
  depend on high-performance chip supply to keep data centers efficient `[E1]` — *industry tracker.*
- **Demand-planning vendors (ToolsGroup, Oracle, o9)** report ML forecasting that ingests external
  signals beyond history `[D2][D4]` — *vendor.*
- **Cross-industry surveys** show supply-chain functions among the most common places GenAI
  delivers cost savings `[A1]` — *academic index.*

---

## 4. Market signals: does the evidence support investment?

**Supports investing:**
- Mainstream adoption (78→88%) `[A1][B1]` — low novelty risk.
- Supply-chain is a **proven** savings area (61% report cost savings) `[A1]`.
- The category's external volatility (chips/geopolitics) `[E1][E2][E3]` is exactly where ML
  forecasting + dynamic reorder logic beats static planning.
- Our own **synthetic backtest** (720 forecasts across 5 years) shows the steady, high-volume
  categories running **~72–76% accurate**, with two intermittent categories (GPU/Compute) much
  worse — a credible, *honest* internal proof-of-concept the dashboard visualizes per category.

**Argues for caution (the cold water):**
- Only **39% of orgs attribute any EBIT impact** to AI, and most of those see <5% `[B1]`.
- ~**64% are still stuck in pilot mode**; only **~6% are "high performers"** `[B1]`.
- Most supply-chain savings are **under 10%** `[A1]` — real, but not transformational.
- **Model drift is the #1 reason AI fails to scale** `[B2]` — a forecasting model is a liability
  if no one owns retraining it.

---

## 5. Research process (transparency)

1. Defined sector + size (cloud/hosting enterprise, ~5,000 staff) and the decision question.
2. Pulled **adoption baselines** from the two most authoritative cross-industry sources (Stanford
   AI Index `[A1]`, McKinsey State of AI `[B1]`).
3. Pulled **sector-specific value** (forecasting error reduction, inventory impact) from
   demand-planning literature `[D1][D2][D4]` — explicitly flagged as vendor-leaning.
4. Pulled the **"why now" risk context** (chip geopolitics, lead-time volatility) from academic
   `[A2][A3]` and industry-tracker `[E1][E2][E3]` sources.
5. Pulled **market-sizing** for directional context `[C1][C2]`.
6. Compiled the citable figures into [`../data/processed/ai_adoption_evidence.csv`](../data/processed/ai_adoption_evidence.csv)
   for the dashboard's evidence layer; full list in [`../sources.md`](../sources.md).

**Methodology note:** where firms disagree (market size estimates vary from ~$7.7B to ~$14B for
2025 `[C1][C2]`), we report the spread rather than cherry-pick, and weight academic/representative
sources above vendor blogs.
