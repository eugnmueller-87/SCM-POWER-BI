# SCM Master Tool — Procurement & Supply Chain Analytics Cockpit

An executive-facing **Power BI** cockpit for procurement & supply-chain analytics, built for
a mid-to-large cloud/hosting company (profile: IONOS-like, DACH, Microsoft-365 ecosystem,
indirect + IT/cloud-heavy spend). Audience: a non-technical CEO ("Cleo") deciding whether
**AI/analytics investment is worth it**.

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
- [ ] `.pbix` built in Power BI Desktop (manual step — specs + live-API queries are build-ready)
