# Sources

All external sources used in this project, grouped by **source type** and labelled with
how much weight we place on each. Synthetic operational data is documented separately in
[`research/01_data_assumptions.md`](research/01_data_assumptions.md).

> **How to read "weight":** `Strong` = peer-reviewed / large representative survey;
> `Moderate` = reputable survey with caveats; `Directional` = market-sizing estimate (wide
> variance between firms); `Vendor` = useful but sells the solution → treat as upper bound.

---

## A. Academic & index sources (highest weight)

| # | Source | What we took from it | Weight |
|---|---|---|---|
| A1 | **Stanford HAI — AI Index Report 2025**, Chapter 4 (Economy) — https://hai.stanford.edu/ai-index/2025-ai-index-report/economy · PDF: https://hai.stanford.edu/assets/files/hai_ai-index-report-2025_chapter4_final.pdf | 78% of orgs use AI in ≥1 function (up from 55%); 61% report cost savings from GenAI in supply chain/inventory; 63% report revenue gains in SCM; most savings are <10%. | Strong |
| A2 | **Taiwan's semiconductor industry and geopolitical challenges** — *Technology in Society* (ScienceDirect, 2025) — https://www.sciencedirect.com/science/article/abs/pii/S0308596125000485 | Concentration risk and resilience framing for advanced-chip supply. | Strong |
| A3 | **The Global Microchip Conflict: The Semiconductor Fault Line Through Taiwan** — Observer Research Foundation (ORF), 2025 — https://www.orfonline.org/research/the-global-microchip-conflict-the-semiconductor-fault-line-through-taiwan | ~90% of the most advanced chips are made in Taiwan → single-node geopolitical risk. | Strong |

## B. Consulting & industry survey sources (high weight, some self-interest)

| # | Source | What we took from it | Weight |
|---|---|---|---|
| B1 | **McKinsey — The State of AI 2025** — https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai · PDF: https://www.mckinsey.com/~/media/mckinsey/business%20functions/quantumblack/our%20insights/the%20state%20of%20ai/2025/the-state-of-ai-how-organizations-are-rewiring-to-capture-value_final.pdf | 88% adoption; 74% report first-year ROI; but only 39% attribute any EBIT impact, ~64% still in pilot mode, ~6% are "high performers." The core hype-vs-value tension. | Moderate–Strong |
| B2 | **McKinsey — Stronger forecasting in operations management, even with weak data** — https://www.mckinsey.com/capabilities/operations/our-insights/ai-driven-operations-forecasting-in-data-light-environments | AI forecasting can work in data-light settings; model drift is the top reason AI fails to scale. | Moderate |
| B3 | **Deloitte — 2026 Semiconductor Industry Outlook** — https://www.deloitte.com/us/en/insights/industry/technology/technology-media-telecom-outlooks/semiconductor-industry-outlook.html | Demand-supply volatility and capacity constraints in chips. | Moderate |

## C. Market-research / market-sizing sources (directional only)

| # | Source | What we took from it | Weight |
|---|---|---|---|
| C1 | **MarketsandMarkets — AI in Supply Chain Market 2025–2032** — https://www.marketsandmarkets.com/Market-Reports/ai-in-supply-chain-market-114588383.html | Market ≈ $13.93B (2025) → $50.41B (2032), CAGR ~20.1%. Demand planning is the dominant segment. | Directional |
| C2 | **Mordor Intelligence — AI Supply Chain Market** — https://www.mordorintelligence.com/industry-reports/artificial-intelligence-supply-chain-market | Cross-check on market growth (estimates vary widely between firms — noted as uncertainty). | Directional |

## D. Vendor / practitioner sources (useful, treat as upper bound)

| # | Source | What we took from it | Weight |
|---|---|---|---|
| D1 | **AIMultiple — Demand Forecasting in the Age of AI & ML** — https://research.aimultiple.com/demand-forecasting/ | AI forecasting reduces errors ~30–50%; stockout lost-sales down up to ~65%; inventory down 20–50%. | Vendor |
| D2 | **ToolsGroup — Machine Learning in Demand Planning** — https://www.toolsgroup.com/blog/machine-learning-in-demand-planning-how-to-boost-forecasting/ | Why traditional ARIMA/exponential-smoothing struggle with modern, multi-driver demand. | Vendor |
| D3 | **Surgere — Forecast Accuracy: Metrics, Challenges, How to Improve** — https://surgere.com/blog/forecast-accuracy-metrics-challenges-and-how-to-improve-it/ | MAPE/WMAPE/bias definitions and common forecasting failure modes. | Vendor |
| D4 | **Oracle — AI Demand Forecasting** — https://www.oracle.com/scm/ai-demand-forecasting/ | External-signal (weather, events, macro) feature framing for ML forecasting. | Vendor |

## E. Industry trackers — geopolitical & chip-sourcing risk (the "why now")

| # | Source | What we took from it | Weight |
|---|---|---|---|
| E1 | **Sourceability — Geopolitics are reshaping semiconductor supply-chain risk (2026)** — https://sourceability.com/post/geopolitics-are-reshaping-semiconductor-supply-chain-risk-in-2026 | Memory prices up ~4× Sep–Nov 2025; China controls ~79% of tungsten (a chip input); 2026 supply deficit forecast. | Moderate |
| E2 | **Omdia — The great decoupling: how geopolitics is reshaping semiconductor supply chains (2025)** — https://omdia.tech.informa.com/blogs/2025/sep/the-great-decoupling-how-geopolitics-is-reshaping-semiconductor-supply-chains | Export controls, tariffs, localization pressure → longer/volatile lead times for server hardware. | Moderate |
| E3 | **ITIF — Decoupling Risks: How Semiconductor Export Controls Could Harm US Chipmakers (Nov 2025)** — https://itif.org/publications/2025/11/10/decoupling-risks-semiconductor-export-controls-harm-us-chipmakers-innovation/ | Policy-driven supply uncertainty for procurement planning. | Moderate |

## F. Public datasets (Kaggle) — relevant to the use case

| # | Dataset | Relevance | Licence/Access |
|---|---|---|---|
| F1 | **Forecasts for Product Demand** (felixzhao) — https://www.kaggle.com/datasets/felixzhao/productdemandforecasting | Multi-product demand time series — the canonical analog to our forecast-vs-actual table. | Public, Kaggle |
| F2 | **Strategic Supply Chain Demand Forecasting Dataset** (ziya07) — https://www.kaggle.com/datasets/ziya07/strategic-supply-chain-demand-forecasting-dataset | Supply-chain demand forecasting features. | Public, Kaggle |
| F3 | **Supply Chain Dataset** (amirmotefaker) — https://www.kaggle.com/datasets/amirmotefaker/supply-chain-dataset | General SC analytics (spend, suppliers, logistics) for benchmarking structure. | Public, Kaggle |

> **Note on data:** the *operational* dashboard runs on **synthetic** data (reproducible, no
> NDA, calibrated to be plausible — see [`research/01_data_assumptions.md`](research/01_data_assumptions.md)).
> The **market-evidence** layer ([`data/processed/ai_adoption_evidence.csv`](data/processed/ai_adoption_evidence.csv))
> is compiled from the **public** sources A–E above. The Kaggle datasets (F) are the public
> analogs we would swap in to validate the model on third-party data during the pilot.
