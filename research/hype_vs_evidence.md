# Hype vs. Evidence — Which AI Adoption Claims Hold Up?

The honest core of the consulting case for Cleo. We take the common AI-adoption claims, sort them
into **supported by data**, **mixed/conditional**, and **mostly hype**, and list the **assumptions
Cleo must validate before investing**. Citations `[n]` resolve in [`../sources.md`](../sources.md).

> This is distinct from [`../dashboard/hype_vs_value.md`](../dashboard/hype_vs_value.md), which
> grades *our own dashboard metrics*. This file grades **industry AI-adoption claims**.

---

## 1. ✅ Claims supported by the evidence

| Claim | Evidence | Why it holds |
|---|---|---|
| "AI is mainstream, not experimental" | 78% (2024) → 88% (2025) of orgs use AI in ≥1 function `[A1][B1]` | Two independent, authoritative surveys agree. Low novelty risk. |
| "Supply chain is a real place AI saves money" | 61% report cost savings, 63% revenue gains in SCM `[A1]` | Function-specific, from the academic index — not a vendor. |
| "AI improves demand-forecast accuracy" | 30–50% error reduction `[D1]`; our synthetic backtest ~85% accuracy | Direction is well-established; magnitude needs local proof. |
| "Forecasting is getting harder with classical methods" | ARIMA/smoothing miss external drivers `[D2][D4]` | Structural, not marketing — modern demand has more signals. |
| "Chip supply is a live geopolitical risk" | ~90% advanced chips from Taiwan `[A3]`; memory +4× `[E1]` | Hard market facts; directly relevant to our SKUs. |

## 2. ⚠️ Mixed / conditional claims (true *with caveats*)

| Claim | The caveat | Source |
|---|---|---|
| "74% of companies get first-year ROI" | …but only **39% see any EBIT impact**, most <5% | `[B1]` |
| "AI delivers big supply-chain savings" | Most savings are **under 10%** — real, not transformational | `[A1]` |
| "Just deploy a model and it works" | **Model drift is the #1 reason AI fails to scale** — it needs an owner | `[B2]` |
| "Inventory down 20–50%, stockouts down 65%" | These are **vendor** figures → upper bounds, best-case | `[D1]` |

## 3. 🚩 Mostly hype / weakly supported

| Claim | Why we discount it |
|---|---|
| "AI will transform the whole P&L" | Only **~6% of orgs are high performers** (>5% EBIT from AI) `[B1]`. Transformation is rare. |
| "GenAI copilots are the place to start" | Flashiest, hardest to tie to EBIT; **64% stall in pilot** `[B1]`. Start with forecasting, not chat. |
| "Bigger market = guaranteed value for us" | Market-size forecasts vary wildly ($7.7B–$14B for 2025) `[C1][C2]` — directional hype, not a business case. |
| "AI removes the human" | The reliable designs keep a **human-in-the-loop**; full autonomy is where over-trust risk (R4) bites. |

---

## 4. Assumptions Cleo must validate before investing

1. **Our data is good enough.** Usage/lead-time history must be complete and accurate (R2).
   → *Validate in a 2-week data-quality gate against a public Kaggle analog `[F1]`.*
2. **The 30–50% improvement is reachable on *our* SKUs**, not just in vendor decks.
   → *Validate with a holdout backtest in the pilot.*
3. **Someone will own the model.** No owner → drift → shelfware `[B2]`.
   → *Name the owner before go/no-go.*
4. **Savings clear the cost bar.** If realistic savings are <10% `[A1]`, the case must also rest on
   **risk reduction** (avoided stockouts on volatile-lead-time chips) and **working capital**.
5. **Planners will use it.** Adoption, not accuracy, kills most projects.
   → *Human-in-the-loop + explainable drill-downs lower this risk.*

---

## 5. So… invest, wait, or pilot?

> **Recommendation: run a small, time-boxed PILOT — do not invest at full scale yet, do not wait.**

- **Why not "invest now":** evidence supports the *direction*, but the magnitude on our data is
  unproven and ~64% of full bets stall `[B1]`. A blind rollout is the high-risk path.
- **Why not "wait":** the problem is acute *now* (chip volatility `[E1]`), and we already have a
  working proof-of-concept — waiting forfeits a cheap, high-evidence opportunity.
- **Why "pilot":** a 10-week pilot validates assumptions 1–5 at low cost and converts "85% on
  synthetic data" into "X% on our real SKUs," giving Cleo a data-backed rollout decision.

Full reasoning, scope, cost and timeline in
[`../implementation/solution_proposal.md`](../implementation/solution_proposal.md).
