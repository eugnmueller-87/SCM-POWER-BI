# BUILD CARD — Spend & Forecast Cockpit (follow top to bottom)

Goal: a clean, professional one-page board. **Golden rule: click the VISUAL TYPE first,
then add the field.** Never check a field box on an empty canvas (that mashes everything
into one chart — the #1 cause of the "basic" look).

---

## 0. Apply the theme (makes every visual look like a card)
Anzeigen ▸ Designs (thumbnails, top-left) ▸ click the **▾** at the row's right edge ▸
**Durchsuchen nach Designs** ▸ open `dashboard/scm_theme_clean.json`.
→ Every visual now gets a white rounded box, title, soft shadow. **This is 50% of the look.**

## 1. Clean the canvas
Delete any existing visuals (click each, press Delete). Blank page.

---

## 2. KPI ROW — four cards across the top
For EACH card, repeat this exact 3-step loop:
1. Click **empty canvas** (deselect)
2. Visualisierungen ▸ click the **Karte** icon (the "123" single-number tile)
3. Drag the measure below into the card (or check its box while the card is selected)

| Card | Measure | Shows |
|---|---|---|
| 1 | `Total Spend` | €2.19M |
| 2 | `Forecast Accuracy %` | 86% |
| 3 | `Top Supplier Share %` | 50% |
| 4 | `MAPE %` | 14.6% |

Then drag the 4 cards into a neat row across the top. Make them equal size.

---

## 3. DONUT — supplier concentration (the eye-catcher)
1. Click empty canvas
2. Visualisierungen ▸ **Ringdiagramm** (Donut) icon
3. Drag `SpendBySupplier[supplier_name]` → **Legende**
4. Drag `SpendBySupplier[spend]` → **Werte**
→ Dell shows ~50%. Place top-right.

## 4. BAR — spend by category
1. Click empty canvas
2. Visualisierungen ▸ **Gestapeltes Balkendiagramm** (stacked bar, horizontal)
3. Drag `SpendByCategory[category]` → **Y-Achse**
4. Drag `SpendByCategory[spend]` → **X-Achse**
→ Servers longest bar. Place middle-left.

## 5. LINE — predicted vs actual (the forecast proof)
1. Click empty canvas
2. Visualisierungen ▸ **Liniendiagramm**
3. Drag `ForecastAccuracy[as_of_date]` → **X-Achse**
4. Drag `predicted_demand` AND `actual_demand` → **Y-Achse**
→ Two lines hugging. Place full width at bottom.

## 6. TABLE — product detail
1. Click empty canvas
2. Visualisierungen ▸ **Tabelle**
3. Drag `SpendByProduct[product_name]`, `category`, `spend`, `units` → **Spalten**
→ Place bottom-right.

---

## 7. Polish (optional, big payoff)
- **Color Dell red:** click donut ▸ Format ▸ Datenfarben ▸ Dell = `#EF4444`.
- **Add a header:** Einfügen ▸ Textfeld ▸ "SCM Master — Executive Cockpit" (top, 24pt).
- **Add a slicer:** empty canvas ▸ **Datenschnitt** (Slicer) icon ▸ drag `SpendByCategory[category]`.
  Now clicking a category filters everything.
- **Currency format:** click `Total Spend` measure ▸ Measuretools ▸ Format ▸ Währung €.

## The "wow" test
Click a donut slice (e.g. Dell) → every other visual filters to Dell. That cross-filter is
the thing Excel can't do. That's your standout.
