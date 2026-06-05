# SCM Master Tool — Procurement & Supply Chain Analytics Cockpit

An executive-facing **Power BI** cockpit for procurement & supply-chain analytics, built for
a mid-to-large cloud/hosting company (profile: IONOS-like, DACH, Microsoft-365 ecosystem,
indirect + IT/cloud-heavy spend). Audience: a non-technical CEO ("Cleo") deciding whether
**AI/analytics investment is worth it**.

## 🎥 Demo

The dashboard wired to a **live, authenticated API** — Power BI logs in on each refresh and
pulls fresh forecast-accuracy data from the deployed backend.

[![demo](/eugnmueller-87/SCM-POWER-BI/raw/main/clip/demo.gif)](/eugnmueller-87/SCM-POWER-BI/blob/main/docs/demo.mp4)

> The animated preview above plays inline. For the full-quality clip with audio,
> [**watch `docs/demo.mp4`**](docs/demo.mp4).

### Headline result (from the live data)
> **AI demand forecast accuracy ≈ 85%** — backtested across **78 forecasts over 12 months**.
> Mean Absolute % Error (MAPE) = **14.6%**; volume-weighted (WMAPE) = **13.9%**.
> *"Our AI demand forecast has been right within ~15% on average, proven against 12 months of actuals."*

| Category | MAPE | Read |
|---|---|---|
| Storage | 8.5% | 🟢 excellent |
| Servers | 9.6% | 🟢 excellent |
| Memory | 12.7% | 🟢 good |
| Processors | 17.3% | 🟡 watch |
| Power | 18.1% | 🟡 watch |
| Networking | 21.5% | 🔴 weakest — improvement target |

> ⚠️ **All data in this repo is synthetic.** It is randomly generated to be *plausible*, not
> real. No real company data is used. See [research/01_data_assumptions.md](research/01_data_assumptions.md).

## What's inside

| Layer | Where | What |
|---|---|---|
| **1. Synthetic data** | [`scripts/generate_data.py`](scripts/generate_data.py) → [`data/raw/`](data/raw/) | Python/pandas generator → 7 internally-consistent CSVs (suppliers, categories, spend, contracts, forecast, disruptions, date dim). |
| **2. Measure layer** | [`measures/measures_dax.md`](measures/measures_dax.md) | Every KPI with plain-English formula **and** copy-paste Power BI DAX, grouped by framework. |
| **3. Data model** | [`dashboard/data_model.md`](dashboard/data_model.md) | Star schema, relationships, helper tables — how to wire the `.pbix`. |
| **4. Dashboard spec** | [`dashboard/dashboard_spec.md`](dashboard/dashboard_spec.md) | 4 pages, every visual specified (chart type, fields, CEO-readability). |
| **5. Hype-vs-value** | [`dashboard/hype_vs_value.md`](dashboard/hype_vs_value.md) | Per-page "robust vs needs-validation" note → a "pilot / wait / invest" recommendation. |
| **6. Research notes** | [`research/`](research/) | Reusable assumptions for project write-ups. |
| **7. Live API connection** | [`dashboard/live_api_connection.md`](dashboard/live_api_connection.md) | Paste-ready Power Query (M) to connect Power BI to the deployed backend — auto-login on every refresh (OAuth2 → Bearer). |
| **8. Built dashboard** | [`Order_Accuracy_Forecast_2026.pbix`](Order_Accuracy_Forecast_2026.pbix) | The Power BI report itself, wired to the live API. *(Git LFS)* |

## Frameworks anchored (no ad-hoc KPIs)
- **SCOR DS** Level-1 metrics: Perfect Order Fulfillment %, Order Fulfillment Cycle Time,
  Cash-to-Cash Cycle Time, Total SCM Cost, Return on SC Fixed Assets.
- **Forecast accuracy:** WMAPE (primary), Forecast Bias % (95–105% band), RMSE,
  Plan/Schedule Adherence % — shown as a **3-month trend**, not pass/fail.
- **Resilience:** Time-to-Awareness / -Action / -Recover / -Survive, the **TTS > TTR** rule,
  a node-level Resilience Score, and single- vs multi-source risk flags.
- **Spend & savings:** spend cube, addressable vs influenceable, tail-spend %, maverick/
  off-contract %, savings waterfall (negotiated → realized → cost avoidance), contract coverage %.

## The story the data tells
- Overall **forecast error falls** 9.2% → 7.6% over M1→M3 (analytics is working)…
- …**except Logistics**, which absorbs a supplier disruption (WMAPE spikes to ~24% in M2,
  recovering to ~13% in M3) — a real, explained miss, not a hidden one.
- **~20% maverick spend** and **64% contract coverage** → concrete savings levers.
- **15% of suppliers violate TTS>TTR** and **17.5% are single-source** → resilience action list.

## Quick start

```bash
# 1. Generate the data (Python 3.12 + pandas/numpy)
pip install pandas numpy python-dateutil
python scripts/generate_data.py          # writes CSVs to data/raw/

# 2. Build the .pbix
#    - Data source — pick ONE:
#        a) Static: Get Data ▸ Text/CSV ▸ load data/raw/*.csv
#        b) Live API: follow dashboard/live_api_connection.md (paste-ready Power Query,
#           auto-login on refresh against the deployed backend)
#    - Wire relationships per dashboard/data_model.md
#    - Add measures from measures/measures_dax.md to a _Measures table
#    - Build the 4 pages per dashboard/dashboard_spec.md
```

## Why Power BI (not Tableau)
Power BI Desktop is **free**, native to the **Microsoft-365** stack this company runs, and
the brief's measure layer is authored in **DAX**. The synthetic CSV layer is tool-agnostic
and could feed Tableau later; only the measures would need re-authoring.

## Status
- [x] Synthetic data generator + validated CSVs
- [x] Measure layer (formulas + DAX)
- [x] Data model + 4-page dashboard spec
- [x] Hype-vs-value layer + research notes
- [x] Live API connection guide (`dashboard/live_api_connection.md`) — verified against the deployed backend
- [x] **`.pbix` built in Power BI Desktop** — wired to the live API, forecast-accuracy measures + visuals live
