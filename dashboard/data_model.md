# Power BI Data Model — SCM Master Tool

How to load the CSVs from [`data/raw/`](../data/raw/) and wire the star schema before
adding the measures in [`measures/measures_dax.md`](../measures/measures_dax.md).

## 1. Load
Power BI Desktop ▸ **Get Data ▸ Text/CSV** ▸ load all seven files from `data/raw/`:
`suppliers.csv`, `categories.csv`, `spend_transactions.csv`, `contracts.csv`,
`forecast_vs_actual.csv`, `disruptions.csv`, `dim_date.csv`.

In Power Query, set types: dates → Date, `*_eur`/`*_pct`/`*_days`/`*_volume` → Decimal,
flags → Whole Number, ids/keys → Text. Then Close & Apply.

## 2. Star schema (relationships)

`dim_date` and `categories` and `suppliers` are the dimensions; `spend_transactions`,
`forecast_vs_actual`, `disruptions` are facts.

```
                ┌───────────────┐
                │   dim_date    │ (date table)
                └──────┬────────┘
                       │ 1   date / month_key
        ┌──────────────┼───────────────────────────┐
        │ *            │ *                          │ *
┌───────┴────────┐  ┌──┴─────────────────┐  ┌───────┴────────┐
│spend_transact. │  │ forecast_vs_actual │  │  disruptions   │
└───┬────────┬───┘  └─────────┬──────────┘  └───┬────────┬───┘
  * │      * │                │ *             * │      * │
┌───┴───┐ ┌──┴──────────┐ ┌───┴──────┐    ┌─────┴──┐  ┌──┴──────────┐
│suppliers│ │ categories │ │categories│    │suppliers│  │ categories │
└─────────┘ └────────────┘ └──────────┘    └─────────┘  └────────────┘
       │
       │ *  (suppliers[category_id] → categories[category_id])
       └──────────► categories
```

Relationships to create (all single-direction, many-to-one from fact → dim):

| From (fact, many) | To (dim, one) | Key |
|---|---|---|
| `spend_transactions[supplier_id]` | `suppliers[supplier_id]` | supplier |
| `spend_transactions[category_id]` | `categories[category_id]` | category |
| `spend_transactions[date]` | `dim_date[date]` | date |
| `forecast_vs_actual[category_id]` | `categories[category_id]` | category |
| `forecast_vs_actual[month]` | `dim_date[month_key]` | month (use month_key) |
| `disruptions[supplier_id]` | `suppliers[supplier_id]` | supplier |
| `disruptions[category_id]` | `categories[category_id]` | category |
| `contracts[supplier_id]` | `suppliers[supplier_id]` | supplier |
| `suppliers[category_id]` | `categories[category_id]` | category (snowflake — OK) |

> Because two facts join `dim_date` on different grains (daily vs `month_key`), keep both
> the `date` and `month_key` columns in `dim_date`. Mark `dim_date` as the **date table**
> (Modeling ▸ Mark as date table ▸ `date`).

## 3. Disconnected helper table for the savings waterfall

Home ▸ Enter Data, name it `_SavingsSteps`:

| step_name | sort |
|---|---|
| Negotiated | 1 |
| Leakage | 2 |
| Realized | 3 |
| Cost Avoidance | 4 |
| Net Savings | 5 |

Sort `step_name` by `sort`. Used by the `Savings Waterfall Value` measure.

## 4. Measures table
Home ▸ Enter Data ▸ empty table `_Measures`. Add every measure from
[`measures/measures_dax.md`](../measures/measures_dax.md) here. Hide the dummy column.
