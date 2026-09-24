// Half-year checkpoints for the KPIs tab, derived from what /api/v1/kpis serves, and the
// fleet path toward the owner's device milestones. Pure arithmetic: no fetch, no DOM.
// The page loads it with a <script> tag and a Node script can require() it, so every
// number on the tab can be re-run on the command line against the same JSON.
//
// The backend's targets are yearly (one, two and three years after they were set) and no
// half-year target exists anywhere in the data. A half-year checkpoint is therefore
// DERIVED, and the screen says so:
//   1. Day zero is the first measurement, the day the backend seeded the targets; year
//      one, two and three fall 12, 24 and 36 months after it.
//   2. Straight lines from (day zero, first value) to the year-one target, on to year two,
//      on to year three. The checkpoint for a half-year is the line's value on 30.06. or
//      31.12. of that year.
//   3. How far off = today's measured value minus the line's value today, in the KPI's own
//      unit and signed in its good direction; within 1 % of the one-year distance counts
//      as on the line.
// The line is anchored at the first measurement and not at today's value on purpose: a
// line through today's value can never show ahead or behind, and its checkpoints would
// creep toward today's value as the year mark recedes. A placeholder target stays a
// placeholder through every checkpoint. A KPI with no measurement carries its reason,
// never a zero.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KPIHalfYear = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const DAY = 86400000;
  const DAYS_PER_MONTH = 30.4375;            // the backend's constant (services/capacity_plan.py)
  const ON_LINE_TOL = 0.01;                  // within 1 % of the one-year distance = on the line
  const HALF_YEARS = [
    { key: "H1 2026", end: "2026-06-30", short: "30.06.2026" },
    { key: "H2 2026", end: "2026-12-31", short: "31.12.2026" },
    { key: "H1 2027", end: "2027-06-30", short: "30.06.2027" },
    { key: "H2 2027", end: "2027-12-31", short: "31.12.2027" },
  ];

  const d = (v) => (v == null ? null : new Date(String(v).slice(0, 10) + "T00:00:00Z"));
  const iso = (date) => date.toISOString().slice(0, 10);
  const addMonths = (date, n) => { const x = new Date(date.getTime()); x.setUTCMonth(x.getUTCMonth() + n); return x; };
  const monthEnd = (y, m) => new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 0));   // last day of month m (1-12)
  const daysBetween = (a, b) => Math.round((b - a) / DAY);

  // The half-year a date falls in, or null past the last one.
  function periodOf(dateIso) {
    const x = d(dateIso);
    if (!x) return null;
    return HALF_YEARS.find((h) => x <= d(h.end)) || null;
  }

  // Linear between anchors [{date, value}], null before the first, flat after the last.
  function valueAt(pts, date) {
    if (!pts || !pts.length || date < pts[0].date) return null;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (date <= b.date) {
        const span = b.date - a.date;
        return span > 0 ? a.value + (b.value - a.value) * (date - a.date) / span : b.value;
      }
    }
    return pts[pts.length - 1].value;
  }

  const meets = (dir, cur, target) => (dir === "lower" ? cur <= target : cur >= target);

  // The first snapshot with a value: the proxy recovers it from the uncapped history when
  // the served list is cut at 60; otherwise the served history; otherwise today's read.
  function firstMeasured(k) {
    if (k.first_measured && k.first_measured.value != null) return { as_of: k.first_measured.as_of, value: +k.first_measured.value };
    const pts = (k.history || []).filter((h) => h && h.value != null);
    if (pts.length) return { as_of: pts[0].as_of, value: +pts[0].value };
    if (k.current != null) return { as_of: k.as_of, value: +k.current };
    return null;
  }

  function anchors(k, first) {
    const d0 = d(first.as_of);
    const pts = [{ date: d0, value: first.value }];
    [k.target_y1, k.target_y2, k.target_y3].forEach((t, i) => {
      if (t != null) pts.push({ date: addMonths(d0, 12 * (i + 1)), value: +t });
    });
    return pts;
  }

  // One KPI row from /api/v1/kpis -> its half-year checkpoints and how far off it is today.
  function assess(k, todayIso) {
    const dir = k.direction === "lower" ? "lower" : "higher";
    const out = { id: k.id, direction: dir, unit: k.unit, placeholder: !!k.placeholder, status: "open", reason: null,
                  gap: null, pace: null, tolerance: null, first: null, anchors: [], checkpoints: [] };
    const blank = (reason) => HALF_YEARS.map((h) => ({ key: h.key, end: h.end, short: h.short, value: null, reason }));
    if (k.current == null) {
      out.status = "not_measurable"; out.reason = k.reason || "no measurement"; out.checkpoints = blank(out.reason);
      return out;
    }
    if (k.target_y1 == null) {
      out.status = "no_target"; out.reason = "no target set"; out.checkpoints = blank("no target");
      return out;
    }
    const first = firstMeasured(k);
    out.first = first;
    const pts = anchors(k, first);
    out.anchors = pts.map((p) => ({ date: iso(p.date), value: p.value }));
    out.checkpoints = HALF_YEARS.map((h) => {
      const e = d(h.end);
      if (e < pts[0].date) return { key: h.key, end: h.end, short: h.short, value: null, reason: "before the first measurement (" + iso(pts[0].date) + ")" };
      return { key: h.key, end: h.end, short: h.short, value: valueAt(pts, e), reason: null };
    });
    const cur = +k.current;
    const today = d(todayIso || k.as_of);
    out.pace = valueAt(pts, today);
    if (meets(dir, cur, +k.target_y1)) { out.status = "met"; out.gap = 0; return out; }
    const span = Math.abs(+k.target_y1 - first.value);
    out.tolerance = ON_LINE_TOL * span;
    const diff = cur - (out.pace == null ? cur : out.pace);
    if (Math.abs(diff) <= out.tolerance) { out.status = "on_line"; out.gap = 0; }
    else { const good = dir === "lower" ? diff < 0 : diff > 0; out.status = good ? "ahead" : "behind"; out.gap = Math.abs(diff); }
    return out;
  }

  // The device fleet against the owner's milestones. Prefers the backend's capacity plan
  // (fleet_now, milestones, month-by-month path). Where a deployment does not serve it
  // yet, derives the same straight-line path from /fleet/summary and the milestones the
  // page passes in, and says so through `source`.
  function fleetPath(opts) {
    const plan = opts.plan || null, summary = opts.summary || null, seed = opts.milestones || [];
    const res = { source: "none", reason: null, asOf: null, fleetNow: null, milestones: [], path: [], checkpoints: [],
                  next: null, measured12m: null };
    if (plan && plan.scenario === "daas" && plan.fleet_now != null && Array.isArray(plan.path) && plan.path.length) {
      res.source = "served"; res.asOf = String(plan.as_of).slice(0, 10); res.fleetNow = +plan.fleet_now;
      res.milestones = (plan.milestones || []).map((m) => ({ date: String(m.date).slice(0, 10), fleet: +m.target_fleet, placeholder: !!m.placeholder }));
      res.path = plan.path.map((p) => ({ date: String(p.date).slice(0, 10), fleet: +p.fleet }));
    } else if (plan && plan.scenario && plan.scenario !== "daas") {
      res.reason = plan.reason || "the capacity plan exists in the device-as-a-service scenario only";
    } else if (summary && summary.scenario === "daas" && summary.rented != null) {
      res.source = "derived"; res.asOf = String(summary.as_of).slice(0, 10); res.fleetNow = +summary.rented;
      const today = d(res.asOf);
      res.milestones = seed.filter((m) => d(m.date) > today).map((m) => ({ date: m.date, fleet: +m.fleet, placeholder: false }));
      const pts = [{ date: today, value: res.fleetNow }].concat(res.milestones.map((m) => ({ date: d(m.date), value: m.fleet })));
      // today, then every month end up to the last milestone, the milestone dates included
      const dates = new Set([res.asOf]);
      if (res.milestones.length) {
        const last = d(res.milestones[res.milestones.length - 1].date);
        res.milestones.forEach((m) => dates.add(m.date));
        let y = today.getUTCFullYear(), m = today.getUTCMonth() + 1;
        for (;;) {
          const e = monthEnd(y, m);
          if (e >= last) break;
          if (e > today) dates.add(iso(e));
          if (m === 12) { y += 1; m = 1; } else m += 1;
        }
      }
      res.path = Array.from(dates).sort().map((s) => ({ date: s, fleet: Math.round(valueAt(pts, d(s))) }));
    } else if (summary && summary.scenario && summary.scenario !== "daas") {
      res.reason = "this database holds the datacenter operation: no device fleet, so the device goal does not apply";
    } else {
      res.reason = "no fleet measurement served (/fleet/summary and /capacity-plan returned nothing)";
    }
    if (summary && summary.growth && summary.growth.added_12m != null) {
      res.measured12m = { added: +summary.growth.added_12m, perMonth: +summary.growth.added_12m / 12 };
    }
    if (res.source === "none") { res.checkpoints = HALF_YEARS.map((h) => ({ key: h.key, end: h.end, short: h.short, value: null, kind: null, reason: res.reason })); return res; }
    const pathPts = res.path.map((p) => ({ date: d(p.date), value: p.fleet }));
    const byDate = {}; res.milestones.forEach((m) => { byDate[m.date] = m; });
    res.checkpoints = HALF_YEARS.map((h) => {
      const e = d(h.end);
      if (e < pathPts[0].date) return { key: h.key, end: h.end, short: h.short, value: null, kind: null, reason: "before the first fleet measurement (" + res.asOf + ")" };
      const ms = byDate[h.end];
      const v = valueAt(pathPts, e);
      if (ms) return { key: h.key, end: h.end, short: h.short, value: ms.fleet, kind: ms.placeholder ? "placeholder" : "milestone", reason: null };
      const beyond = e > pathPts[pathPts.length - 1].date;
      return { key: h.key, end: h.end, short: h.short, value: beyond ? null : Math.round(v), kind: beyond ? null : "path",
               reason: beyond ? "after the last milestone: no path" : null };
    });
    const ahead = res.milestones.find((m) => d(m.date) > d(res.asOf));
    if (ahead) {
      const days = daysBetween(d(res.asOf), d(ahead.date));
      const toGo = ahead.fleet - res.fleetNow;
      res.next = { date: ahead.date, fleet: ahead.fleet, toGo, days, perMonth: days > 0 ? toGo / (days / DAYS_PER_MONTH) : null };
    }
    return res;
  }

  return { HALF_YEARS, DAYS_PER_MONTH, ON_LINE_TOL, assess, fleetPath, valueAt, periodOf, firstMeasured };
});
