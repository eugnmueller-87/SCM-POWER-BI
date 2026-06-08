// Deterministic, zero-token insights engine.
//
// Computes procurement findings from the SAME data the cockpit already fetches —
// no LLM, no API credit, reproducible and auditable (same data -> same findings,
// every time). This is the trustworthy substrate: a procurement exec can rely on
// "Dell is 64.9% of spend" because it's a threshold over real numbers, not a
// model that might hallucinate the figure.
//
// Each finding: { severity: 'action'|'watch'|'info', title, detail, metric }.
// The optional "Generate AI commentary" path narrates OVER these outputs (passed
// as structured input), so even the AI layer never re-derives a number.

const EUR = (n) => "€" + Math.round(+n || 0).toLocaleString("en-US");
const PCT = (x) => `${(100 * (+x || 0)).toFixed(1)}%`;
const num = (x) => +x || 0;

// ── thresholds (the category-management judgement, made explicit & tunable) ──
const T = {
  CONCENTRATION_ACTION: 0.40,   // one supplier > 40% of spend = single-source risk
  CONCENTRATION_WATCH: 0.30,
  HHI_CONCENTRATED: 2500,       // DOJ/FTC: HHI > 2500 = "highly concentrated"
  HHI_MODERATE: 1500,
  WEEKS_COVER_ACTION: 2,        // < 2 weeks of cover at current burn = stockout risk
  WEEKS_COVER_WATCH: 4,
  FORECAST_WATCH: 0.70,         // backtested accuracy below this = demand volatility
  OPEX_RATIO_FLAG: 1.0,         // lifetime OpEx >= acquisition = TCO inversion
};

// ── individual rules. Each takes the fetched data and pushes findings. ──────

function ruleSupplierConcentration(d, out) {
  const sups = (d.spend_by_supplier || []).map((s) => ({ name: s.supplier_name, spend: num(s.spend) }));
  const total = sups.reduce((a, s) => a + s.spend, 0);
  if (!total) return;
  sups.sort((a, b) => b.spend - a.spend);
  const top = sups[0];
  const share = top.spend / total;

  // Herfindahl–Hirschman Index over supplier spend shares (0–10000).
  const hhi = Math.round(sups.reduce((a, s) => a + Math.pow((s.spend / total) * 100, 2), 0));

  if (share >= T.CONCENTRATION_ACTION) {
    out.push({ severity: "action", title: `${top.name} is ${PCT(share)} of spend`,
      detail: `Single-source concentration above the ${PCT(T.CONCENTRATION_ACTION)} risk line — qualify a second source to de-risk supply.`,
      metric: `${EUR(top.spend)} of ${EUR(total)}` });
  } else if (share >= T.CONCENTRATION_WATCH) {
    out.push({ severity: "watch", title: `${top.name} is ${PCT(share)} of spend`,
      detail: `Approaching the concentration risk line — monitor dual-sourcing options.`, metric: EUR(top.spend) });
  }

  if (hhi >= T.HHI_CONCENTRATED) {
    out.push({ severity: "watch", title: `Supplier base is highly concentrated (HHI ${hhi})`,
      detail: `HHI above ${T.HHI_CONCENTRATED} (DOJ/FTC threshold) across ${sups.length} suppliers — limited negotiating leverage and supply resilience.`,
      metric: `HHI ${hhi}` });
  }
}

function ruleWeeksOfCover(d, out) {
  const items = d.inventory || [];
  const risky = [];
  for (const it of items) {
    const burn = num(it.daily_burn);
    if (burn <= 0) continue;                    // no demand signal → not a cover risk
    const onHand = num(it.on_hand);
    const weeks = onHand / burn / 7;
    if (weeks < T.WEEKS_COVER_ACTION) risky.push({ name: it.name || it.product_code, weeks, onHand, eta: it.next_eta, onOrder: num(it.on_order) });
  }
  if (!risky.length) return;
  risky.sort((a, b) => a.weeks - b.weeks);
  const worst = risky[0];
  const covered = worst.onOrder > 0 ? ` (replenishment of ${worst.onOrder} due ${worst.eta || "—"})` : " — nothing on order";
  out.push({ severity: "action", title: `${risky.length} SKU${risky.length > 1 ? "s" : ""} below ${T.WEEKS_COVER_ACTION}-week cover`,
    detail: `Worst: ${worst.name} at ${worst.weeks.toFixed(1)} weeks of cover${covered}. Stockout risk at current burn.`,
    metric: `${risky.length} at risk` });
}

function ruleTcoInversion(d, out) {
  const classes = d.tco_by_class || [];
  for (const c of classes) {
    const acq = num(c.acquisition), opex = num(c.opex);
    if (acq <= 0) continue;
    const ratio = opex / acq;
    if (ratio >= T.OPEX_RATIO_FLAG) {
      out.push({ severity: "watch", title: `${c.category}: lifetime OpEx exceeds purchase price`,
        detail: `Running these assets costs ${PCT(ratio)} of what they cost to buy (${EUR(opex)} OpEx vs ${EUR(acq)} acquisition). Energy/efficiency is the real lever, not unit price.`,
        metric: `${ratio.toFixed(2)}× acquisition` });
    }
  }
}

function ruleForecastAccuracy(d, out) {
  // Cockpit computes accuracy from the forecast CSV; accept it if provided.
  const acc = d.forecast_accuracy;
  if (acc == null) return;
  if (acc < T.FORECAST_WATCH) {
    out.push({ severity: "watch", title: `Forecast accuracy ${PCT(acc)} — demand is volatile`,
      detail: `Backtested accuracy below ${PCT(T.FORECAST_WATCH)}; widen safety stock on spiky SKUs and lean on the reorder triggers rather than the point forecast.`,
      metric: PCT(acc) });
  } else {
    out.push({ severity: "info", title: `Forecast accuracy ${PCT(acc)} — backtested`,
      detail: `Demand model is tracking actuals within tolerance over the backtest window.`, metric: PCT(acc) });
  }
}

function ruleShouldCostGap(d, out) {
  const sc = d.should_cost_savings;
  if (!sc || !sc.products_with_bom) return;
  const gap = num(sc.total_gap_to_target);
  if (gap > 0) {
    out.push({ severity: "action", title: `${EUR(gap)} addressable above should-cost target`,
      detail: `${sc.products_above_target}/${sc.products_with_bom} costed products quote above their commodity-indexed target — that gap is the negotiation headroom to open from.`,
      metric: EUR(gap) });
  }
}

// ── public entry point ──────────────────────────────────────────────────────

// Build the full findings list from the cockpit's data bundle. Pure + sync.
function buildInsights(data) {
  const out = [];
  ruleSupplierConcentration(data, out);
  ruleWeeksOfCover(data, out);
  ruleShouldCostGap(data, out);
  ruleTcoInversion(data, out);
  ruleForecastAccuracy(data, out);
  // action first, then watch, then info — most urgent on top.
  const rank = { action: 0, watch: 1, info: 2 };
  out.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return out;
}

module.exports = { buildInsights, THRESHOLDS: T };
