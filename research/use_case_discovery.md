# Use Case Discovery & Selection

Citations `[n]` resolve in [`../sources.md`](../sources.md).

---

## 1. Sector & company size (locked)

- **Sector:** Cloud / hosting & data-center infrastructure (DACH, Microsoft-365 ecosystem).
- **Company size:** **Large enterprise — ~5,000 employees (IONOS-scale).**
- **Spend profile:** indirect + IT/cloud-heavy; ~€640m/year managed spend across servers,
  processors, memory, storage, networking and power.

**Why this profile:** a hardware-heavy cloud business lives or dies on getting compute capacity
in *before* customers need it, while buying from a chip supply chain that is currently volatile
`[E1][E2][E3]`. That is a real, defensible problem — not a toy.

---

## 2. Stakeholders, needs & pain points

| Stakeholder | What they need | Pain point today |
|---|---|---|
| **Cleo (CEO)** | A defensible yes/no on AI investment | Can't tell hype from value; doesn't want a science project |
| **Head of Procurement** | Buy the right parts at the right time | Static reorder points fail when lead times jump (chips) |
| **Demand / capacity planner** | Trustworthy demand numbers | Spreadsheet forecasts, no view of *why* a forecast missed |
| **Finance** | Protect working capital & margin | Over-ordering ties up cash; stockouts cost revenue |
| **Ops / data-center** | No capacity gaps | A late GPU shipment = unservable customer demand |

**Discovery method:** desk research + documented assumptions (no live interviews available in the
sprint). Stakeholder needs were inferred from the sector's economics and validated against the
adoption/forecasting literature `[A1][B1][D1]`.

---

## 3. From broad opportunity → one focused use case

Broad AI opportunities in procurement (forecasting, supplier risk, GenAI copilot, contract
analysis, spend classification) were narrowed in
[`opportunities_risks.md`](opportunities_risks.md) to three, then to one:

> ### ⭐ Primary use case: **AI demand forecasting with a dynamic reorder point**
> Forecast per-SKU demand from usage history + external signals, score the forecast's reliability
> (MAPE/WMAPE/bias), and convert it into a reorder point that adapts to moving lead times — with a
> human approving each purchase.

This is **AI-driven** (the demand model + reliability scoring) wrapped around **standard automation**
(the reorder arithmetic and the approval workflow) — and the doc is explicit about which is which,
as the rubric requires.

---

## 4. Why this use case is worth pursuing *now*

1. **The problem is acute now:** chip lead-time volatility and price spikes (memory ~4× in
   Sep–Nov 2025) `[E1]` make static planning fail *this quarter*, not someday.
2. **The evidence is strong:** supply-chain is a proven AI savings area (61% report savings `[A1]`);
   AI forecasting cuts error 30–50% `[D1]`.
3. **The lift is low:** we already have the data, the measure layer, and a working dashboard hitting
   ~85% backtested accuracy — a pilot is *validation*, not greenfield build.
4. **It is honest:** by leading with the *worst* category (Networking ~21% error) and a model-drift
   owner, it survives a skeptical CEO — the opposite of the 64% of projects that stall in hype `[B1]`.

---

## 5. Expected outcomes & value

- Forecast error down toward the **30–50%** improvement band `[D1]` (validated in the pilot, not
  assumed).
- Fewer stockouts on long-lead-time SKUs → protected revenue.
- Lower working capital from less over-ordering.
- A repeatable, owned model — not a one-off dashboard.

**Recommendation:** see [`../implementation/solution_proposal.md`](../implementation/solution_proposal.md)
— **run a focused 10-week pilot before any rollout.**
