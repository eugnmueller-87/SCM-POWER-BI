# Executive Cockpit — "Insane" Board Blueprint

The standout page. Dark, branded, fully interactive. Everything cross-filters on click.
Built on **live API data**. The pieces below are things Excel cannot do — that's the point.

Live numbers (2026-06-05): Forecast accuracy **86%**, Total spend **€2.19M**,
Dell **~50%** of spend, **84%** of assets at one location, **95.4%** deployment (thin buffer).

---

## Canvas setup (do this FIRST — biggest visual payoff)

1. **Apply the theme:** Anzeigen (View) ▸ Themen ▸ **Durchsuchen nach Designs** ▸ pick
   `dashboard/scm_theme.json`. Every visual instantly inherits the palette + clean fonts.
2. **Page background:** click empty canvas ▸ Visualisierungen ▸ Format (paintbrush) ▸
   **Canvas-Hintergrund** ▸ Farbe `#0E1A24` (deep navy) ▸ Transparenz **0%**.
   *(Dark canvas = instant "product, not spreadsheet".)*
3. **Page size:** Format ▸ Canvaseinstellungen ▸ **16:9**.

## Layout grid (1280×720 canvas)

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER BAND  "SCM Master — Executive Cockpit"        🟢 Live · 86%   │  y=0–70
├────────────┬────────────┬────────────┬────────────────────────────────┤
│ KPI: Acc.  │ KPI: Spend │ KPI: Dell  │ KPI: Stockout                  │  y=80–200
│   86%  🟢  │  €2.19M    │  50% 🔴    │   5 SKUs 🔴                    │
├────────────┴────────────┴────────────┼────────────────────────────────┤
│                                       │  SUPPLIER CONCENTRATION (donut)│  y=210–470
│   DECOMPOSITION TREE                  │  Dell 50% (red) · Arrow · …    │
│   Total Spend → category → supplier   ├────────────────────────────────┤
│   (the showstopper — AI drill)        │  PREDICTED vs ACTUAL (line)    │
│                                       │                                │
├───────────────────────────────────────┴────────────────────────────────┤
│  🤖 AI INSIGHTS:  "Dell = 50% of spend" · "84% assets at one site" …    │  y=480–700
└──────────────────────────────────────────────────────────────────────┘
```

---

## Visual-by-visual build

### 1. Header band
- Insert ▸ **Form (Shape) ▸ Rechteck**, full width, height ~70px, fill `#13212E`.
- Insert ▸ **Textfeld**: "SCM Master — Executive Cockpit" (white, 24pt, Segoe UI Semibold).
- Small text right: "● Live data · Forecast accuracy 86%" (green dot via a small circle shape).

### 2. Four KPI cards (conditional color)
Use the **Karte** visual (or the new **Card (neu)** if available — it's sleeker).
- **Forecast Accuracy** = `Forecast Accuracy %` · **Spend** = `Total Spend` ·
  **Top Supplier Share** = `Top Supplier Share %` · **Stockout Risk** = `Stockout Risk`.
- Conditional color: Format ▸ Callout-Wert ▸ fx ▸ rules:
  accuracy ≥85 green / else amber. Share >0.5 red. Stockout ≥3 red.
- Card background `#16ratan...` → use `#16breeze` … simpler: fill `#13212E`, rounded corners
  (Format ▸ Effekte ▸ Visueller Rahmen ▸ Abgerundete Ecken **8px**).

### 3. ⭐ Decomposition Tree (the standout)
- Visualisierungen ▸ **Aufschlüsselungsbaum** (Decomposition Tree) icon.
- **Analysieren (Analyze):** `Total Spend`.
- **Erklären nach (Explain by):** add `SpendByProduct[category]` and
  `SpendBySupplier[supplier_name]` (and `SpendByProduct[product_name]`).
- Now you (or Cleo) click the **+** and it expands the biggest contributor automatically —
  the "AI splits" mode shows a little lightbulb. **This is the visual that makes people lean in.**

### 4. Supplier concentration — Donut
- **Ringdiagramm (Donut)**. Legende `SpendBySupplier[supplier_name]`, Werte `spend`.
- Color Dell `#C44536` (red = the risk), others muted. Data label = %.
- This drives cross-filtering: click Dell → tree + line + cards all filter to Dell.

### 5. Predicted vs Actual — Line
- **Liniendiagramm**. X `ForecastAccuracy[as_of_date]`, Y `predicted_demand` + `actual_demand`.
- Two lines hugging = the forecast-works proof. Smooth lines, no gridlines, muted axis.

### 6. AI Insights strip
- 2–3 **Textfelder** (or Karten) with the API's findings, e.g.:
  - "🔴 Dell = ~50% of supplier spend — single-vendor dependency."
  - "🔴 84% of assets sit at ONE location — single point of failure."
  - "🟡 95.4% deployment — almost no buffer stock."

---

## The "insane" interactions to demo
- **Cross-filter:** click any donut slice / tree node → whole page refocuses. (Excel can't.)
- **Decomposition drill:** expand the tree live in the meeting — feels like the dashboard
  is *thinking*.
- **Drill-through (optional next):** right-click a supplier → a dedicated supplier detail page.
- **Tooltips:** hover any point → rich tooltip card.

## Polish checklist
- [ ] Theme applied (palette consistent)
- [ ] Dark canvas + rounded card corners
- [ ] One green accent for "good", red reserved for risk (Dell, stockouts)
- [ ] Header band with live accuracy
- [ ] Every visual cross-filters (default on)
- [ ] Footer: "Synthetic-adjacent demo data · live API"
