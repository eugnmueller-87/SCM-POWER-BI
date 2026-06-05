# Live API Connection — Power BI ▸ SCM Master backend

Connect Power BI Desktop to the **deployed live API** instead of the static `data/raw/*.csv`.
The API requires login (OAuth2 password flow); these Power Query (M) scripts **log in on every
refresh and fetch fresh data automatically** — no manual token pasting.

## API contract (verified live 2026-06-05)

| Thing | Value |
|---|---|
| Base URL | `https://scm-master-production.up.railway.app` |
| Login | `POST /api/v1/auth/login` · `application/x-www-form-urlencoded` · fields `username`, `password` → `{ access_token, token_type }` |
| Auth on exports | header `Authorization: Bearer <access_token>` (OAuth2PasswordBearer) |
| Creds (demo) | `admin@example.com` / `admin` |
| OpenAPI / docs | `/openapi.json` · `/docs` (both public) |

### Export endpoints (all GET, Bearer-protected, no params)
| Endpoint | Columns |
|---|---|
| `/api/v1/analytics/exports/forecast-accuracy.csv` | `as_of_date, horizon_days, window_end, product_code, name, category, usage_rate_per_day, predicted_demand, actual_demand, abs_error, ape` (79 rows) |
| `/api/v1/analytics/exports/demand-history.csv` | `month, month_start, product_code, name, category, units_deployed` (112 rows, 2024-12 → 2026-06) |
| `/api/v1/analytics/exports/spend.csv` | `supplier_id, supplier_name, units, spend` (4 rows — supplier-level spend rollup) |

`forecast-accuracy.csv` = **79 rows, 2025-03 → 2026-02** (12-month backtest). `ape` is the
pre-computed absolute % error per row — average it for MAPE.

---

## Build steps in Power BI Desktop

### 1. Parameters (so creds/token live in one place, not scattered in queries)
Home ▸ Transform data ▸ (Power Query opens) ▸ Manage Parameters ▸ New, create three **Text** params:

| Name | Current value |
|---|---|
| `ApiBase` | `https://scm-master-production.up.railway.app` |
| `ApiUser` | `admin@example.com` |
| `ApiPassword` | `admin` |

> Treat `ApiPassword` as a demo secret only. For a published report, swap to a service account
> and store creds via the gateway, not in the file.

### 2. Token query (`fnGetToken`)
Power Query ▸ New Source ▸ Blank Query ▸ Advanced Editor ▸ paste:

```m
let
    Source = Json.Document(
        Web.Contents(
            ApiBase,
            [
                RelativePath = "/api/v1/auth/login",
                Headers = [ #"Content-Type" = "application/x-www-form-urlencoded" ],
                Content = Text.ToBinary(
                    "grant_type=password"
                    & "&username=" & Uri.EscapeDataString(ApiUser)
                    & "&password=" & Uri.EscapeDataString(ApiPassword)
                )
            ]
        )
    ),
    AccessToken = Source[access_token]
in
    AccessToken
```
Rename the query **`fnGetToken`**. (It's a value, not a function — referencing it triggers one login.)

### 3. Forecast Accuracy query (the money shot)
New Source ▸ Blank Query ▸ Advanced Editor ▸ paste:

```m
let
    Token  = fnGetToken,
    Source = Csv.Document(
        Web.Contents(
            ApiBase,
            [
                RelativePath = "/api/v1/analytics/exports/forecast-accuracy.csv",
                Headers = [ Authorization = "Bearer " & Token ]
            ]
        ),
        [ Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv ]
    ),
    Promoted = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Typed = Table.TransformColumnTypes(Promoted, {
        {"as_of_date", type date},
        {"window_end", type date},
        {"horizon_days", Int64.Type},
        {"product_code", type text},
        {"name", type text},
        {"category", type text},
        {"usage_rate_per_day", type number},
        {"predicted_demand", type number},
        {"actual_demand", type number},
        {"abs_error", type number},
        {"ape", type number}
    })
in
    Typed
```
Rename **`ForecastAccuracy`**.

### 4. The other two exports
Duplicate query #3, change the `RelativePath` and the type mappings. Each reuses `fnGetToken`.

**`DemandHistory`** — `RelativePath = "/api/v1/analytics/exports/demand-history.csv"`, types:
```m
    Typed = Table.TransformColumnTypes(Promoted, {
        {"month", type text},
        {"month_start", type date},
        {"product_code", type text},
        {"name", type text},
        {"category", type text},
        {"units_deployed", Int64.Type}
    })
```

**`Spend`** — `RelativePath = "/api/v1/analytics/exports/spend.csv"`, types:
```m
    Typed = Table.TransformColumnTypes(Promoted, {
        {"supplier_id", type text},
        {"supplier_name", type text},
        {"units", Int64.Type},
        {"spend", type number}
    })
```

### 5. Credentials prompt (one-time)
On first Close & Apply, Power BI asks how to authenticate to `…up.railway.app`. Choose
**Anonymous** (auth is handled *inside* the query via the Bearer header, not by Power BI's
connector layer). Privacy level: **Organizational** or **Public** is fine for this demo.

> If you hit `Formula.Firewall: ... references other queries` — turn OFF
> File ▸ Options ▸ Current File ▸ Privacy ▸ "Combine data according to your Privacy Level settings"
> (set to *Ignore*). This is the standard fix for dynamic `Web.Contents` + parameter patterns.

---

## The money-shot visuals (from `ForecastAccuracy`)

### A. Predicted vs Actual — line chart
- Visual: **Line chart**
- X axis: `as_of_date` (or `window_end`)
- Y values: `predicted_demand` **and** `actual_demand` (two lines)
- So-what callout: *"AI forecast tracks actual demand within ~15% over 12 months."*

### B. MAPE card
Create measure in `_Measures`:
```DAX
MAPE % = AVERAGE ( ForecastAccuracy[ape] )
```
Format as **Percentage, 1 decimal**. Drop on a **Card**. (Across all 79 rows this lands in the
low-teens %, i.e. the "within 15%" story.) For a weighted version use the existing WMAPE measure
in `measures/measures_dax.md` against `abs_error` / `actual_demand`.

### C. (Nice-to-have) MAPE by category
Bar chart: axis `category`, value `MAPE %` — shows which categories the model nails vs. struggles
with (ties into the "except Logistics" narrative once that field is exposed).

---

## Refresh behavior
Each **Refresh** re-runs `fnGetToken` (fresh login → fresh token) then pulls current CSVs. No token
expiry babysitting. For scheduled refresh in the Power BI Service you'll need the API reachable from
the cloud (it is — public Railway URL) and the same Anonymous + Bearer-in-query setup; configure
credentials on the dataset as **Anonymous**.

---

# BOARD 2 — Spend Analysis (live JSON endpoints)

These power the **Spend board**. They use the JSON analytics endpoints (cleaner than the CSV).
Each query reuses `fnGetToken`. For each: **Neue Quelle ▸ Leere Abfrage ▸ Erweiterter Editor**,
paste, **Fertig**, then rename.

Live snapshot (2026-06-05): total spend **€2,191,170** across **787 units**, 4 suppliers, 6 categories.
Servers = 47% of spend (Dell). This is the concentration story.

### Query `SpendByCategory`  → rename to **SpendByCategory**
```m
let
    Token  = fnGetToken,
    Source = Json.Document(
        Web.Contents(
            ApiBase,
            [
                RelativePath = "/api/v1/analytics/spend/by-category",
                Headers = [ Authorization = "Bearer " & Token ]
            ]
        )
    ),
    Table0 = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    Expanded = Table.ExpandRecordColumn(Table0, "Column1", {"category", "units", "spend"}),
    Typed = Table.TransformColumnTypes(Expanded, {
        {"category", type text},
        {"units", Int64.Type},
        {"spend", type number}
    }, "en-US")
in
    Typed
```

### Query `SpendBySupplier`  → rename to **SpendBySupplier**
```m
let
    Token  = fnGetToken,
    Source = Json.Document(
        Web.Contents(
            ApiBase,
            [
                RelativePath = "/api/v1/analytics/spend/by-supplier",
                Headers = [ Authorization = "Bearer " & Token ]
            ]
        )
    ),
    Table0 = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    Expanded = Table.ExpandRecordColumn(Table0, "Column1", {"supplier_id", "supplier_name", "units", "spend"}),
    Typed = Table.TransformColumnTypes(Expanded, {
        {"supplier_id", type text},
        {"supplier_name", type text},
        {"units", Int64.Type},
        {"spend", type number}
    }, "en-US")
in
    Typed
```

### Query `SpendByProduct`  → rename to **SpendByProduct**
The `product_name` has a `·` separator that arrives mojibake-encoded (`Â·`); we clean it.
```m
let
    Token  = fnGetToken,
    Source = Json.Document(
        Web.Contents(
            ApiBase,
            [
                RelativePath = "/api/v1/analytics/spend/by-product",
                Headers = [ Authorization = "Bearer " & Token ]
            ]
        )
    ),
    Table0 = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    Expanded = Table.ExpandRecordColumn(Table0, "Column1", {"product_id", "product_name", "category", "units", "spend"}),
    CleanName = Table.TransformColumns(Expanded, {{"product_name", each Text.Replace(_, "Â·", "·"), type text}}),
    Typed = Table.TransformColumnTypes(CleanName, {
        {"product_id", type text},
        {"product_name", type text},
        {"category", type text},
        {"units", Int64.Type},
        {"spend", type number}
    }, "en-US")
in
    Typed
```

## Spend board visuals & measures

Measures (create on `SpendBySupplier`, right-click ▸ Neues Measure):
```DAX
Total Spend = SUM ( SpendBySupplier[spend] )
```
```DAX
Top Supplier Share % =
DIVIDE ( MAX ( SpendBySupplier[spend] ), [Total Spend] )
```
Format `Total Spend` as **Currency (€), 0 decimals**; `Top Supplier Share %` as **% 0 dec**.

| Visual | Type | Fields | So-what |
|---|---|---|---|
| **Total Spend** | Card | `[Total Spend]` | "€2.19M total addressable spend." |
| **Spend by category** | Bar (horizontal), sorted desc | Axis `SpendByCategory[category]`, Value `spend` | "Servers = 47% — one category dominates." |
| **Supplier concentration** | Donut | Legend `SpendBySupplier[supplier_name]`, Value `spend` | "Dell = 50% of spend → single-vendor risk." |
| **Top products** | Bar | Axis `SpendByProduct[product_name]`, Value `spend` | "PowerEdge R760 is the single biggest line item." |
| **Spend detail** | Table | supplier/category/spend/units | Lets finance verify the numbers. |

Color bars with the theme: good `#1F6F54`, watch `#E8B23A`, act `#C44536`.
