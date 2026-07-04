"""
generate_data.py
================
Synthetic data generator for the **SCM Master Tool** — an executive procurement &
supply-chain analytics cockpit for a mid-to-large cloud/hosting company
(profile: DACH, Microsoft-365 ecosystem, indirect + IT/cloud heavy).

ALL DATA IS SYNTHETIC. No real company data is used. Numbers are calibrated to be
*plausible* for a company with ~€600-700m annual indirect/IT addressable spend, but
they are randomly generated and internally consistent — not a real benchmark.

Horizon
-------
- 24 months of monthly history (for trend lines) ending at M3.
- The last 3 months are the reporting periods M1, M2, M3 (M3 = latest closed month).

Output (CSV -> data/raw/)
-------------------------
1. suppliers.csv            supplier master + risk/resilience attributes
2. categories.csv           category master (addressable / influenceable flags)
3. spend_transactions.csv   line-level spend (24 mo) -> maverick / tail / contract spend
4. contracts.csv            contract register -> contract coverage %
5. forecast_vs_actual.csv   planned vs executed volume & PO dates -> WMAPE/Bias/RMSE/adherence
6. disruptions.csv          disruption events -> 4 resilience time-metrics (TTA/TTAct/TTR/TTS)
7. dim_date.csv             date dimension (helper for Power BI time intelligence)

Design choices are documented inline as # ASSUMPTION comments and mirrored in
research/01_data_assumptions.md so they can be reused in project write-ups.

Run:  python scripts/generate_data.py
Deterministic: a fixed RNG seed makes every run reproducible.
"""

from __future__ import annotations

import os

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------------------
# 0. CONFIG & REPRODUCIBILITY
# --------------------------------------------------------------------------------------
SEED = 42
rng = np.random.default_rng(SEED)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(ROOT, "data", "raw")
os.makedirs(RAW, exist_ok=True)

# ASSUMPTION: 24 months of history; the most recent closed month is M3 (2026-05).
#             We anchor "today" at 2026-06 so M1/M2/M3 = Mar/Apr/May 2026.
N_MONTHS = 24
ANCHOR = pd.Timestamp("2026-05-01")  # M3 = latest closed month
MONTH_STARTS = pd.date_range(end=ANCHOR, periods=N_MONTHS, freq="MS")
M1, M2, M3 = MONTH_STARTS[-3], MONTH_STARTS[-2], MONTH_STARTS[-1]
REPORTING_MONTHS = [M1, M2, M3]


def month_key(ts: pd.Timestamp) -> str:
    return ts.strftime("%Y-%m")


# --------------------------------------------------------------------------------------
# 1. CATEGORIES
# --------------------------------------------------------------------------------------
# ASSUMPTION: 6 indirect/IT-weighted categories typical of a cloud/hosting firm.
# addressable_flag      = procurement can actively source/negotiate it.
# influenceable_flag    = procurement can influence demand/spec even if not fully owned
#                         (addressable spend is a subset of influenceable spend).
# share                 = rough share of total spend (sums to 1.0) — IT/cloud dominates.
categories_def = [
    # name,               addressable, influenceable, share
    ("IT & Cloud",            1, 1, 0.34),
    ("Hardware",              1, 1, 0.18),
    ("Logistics",             1, 1, 0.12),
    ("Facilities",            1, 1, 0.10),
    ("Marketing",             0, 1, 0.14),  # ASSUMPTION: marketing semi-owned by business
    ("Professional Services", 0, 1, 0.12),  # ASSUMPTION: influenceable, not fully addressable
]
categories = pd.DataFrame(
    [
        {
            "category_id": f"CAT{idx+1:02d}",
            "name": name,
            "addressable_flag": addr,
            "influenceable_flag": infl,
            "spend_share": share,
        }
        for idx, (name, addr, infl, share) in enumerate(categories_def)
    ]
)
# normalise share defensively
categories["spend_share"] = categories["spend_share"] / categories["spend_share"].sum()

# --------------------------------------------------------------------------------------
# 2. SUPPLIERS
# --------------------------------------------------------------------------------------
# ASSUMPTION: ~80 suppliers. DACH-weighted country mix. Tier 1 = strategic/critical.
# Resilience attributes (TTR/TTS) are generated so that MOST suppliers satisfy the
# resilience rule TTS > TTR (you can survive longer than it takes to recover), but a
# deliberate minority VIOLATE it — those are the at-risk nodes the dashboard must flag.
N_SUPPLIERS = 80

countries = ["DE", "AT", "CH", "NL", "FR", "PL", "US", "IE"]
country_p = [0.42, 0.10, 0.10, 0.08, 0.08, 0.07, 0.10, 0.05]  # DACH-heavy

supplier_rows = []
cat_ids = categories["category_id"].tolist()
cat_share = categories["spend_share"].to_numpy()

for i in range(N_SUPPLIERS):
    sid = f"SUP{i+1:03d}"
    cat = rng.choice(cat_ids, p=cat_share)  # suppliers cluster into spend-weighted categories
    # ASSUMPTION: 22% of suppliers are Tier-1 (strategic). Tier drives criticality.
    tier = int(rng.choice([1, 2, 3], p=[0.22, 0.43, 0.35]))
    country = rng.choice(countries, p=country_p)

    # ASSUMPTION: ~18% of suppliers are single-source (only qualified source for a spec).
    # Single-source is more common among Tier-1 strategic suppliers.
    base_single_p = {1: 0.34, 2: 0.16, 3: 0.08}[tier]
    single_source = int(rng.random() < base_single_p)

    # Risk score 0-100 (higher = riskier). Single-source & lower tier number (more
    # critical) skew riskier; add noise. Clipped to [5, 95].
    risk = 35 + (single_source * 18) + (3 - tier) * 6 + rng.normal(0, 12)
    risk = float(np.clip(risk, 5, 95))

    # TTR = time-to-recover (days) after a disruption hits this supplier.
    #   Riskier / single-source suppliers recover slower.
    ttr = 7 + (risk / 100) * 35 + single_source * 8 + rng.normal(0, 4)
    ttr = float(np.clip(ttr, 3, 75))

    # TTS = time-to-survive (days) = how long we can keep serving customers without
    #   this supplier (buffer stock / redundancy / contractual SLAs).
    #   We WANT TTS > TTR. Design: TTS = TTR * factor, factor ~ N(1.45, .); but for a
    #   minority (esp. single-source) factor < 1 -> violation (TTS < TTR).
    if single_source:
        factor = rng.normal(1.05, 0.45)  # single-source: thinner buffers, more violations
    else:
        factor = rng.normal(1.55, 0.40)  # multi-source: healthier buffers
    tts = float(np.clip(ttr * factor, 2, 120))

    # On-time & OTIF delivery — correlated with (inverse) risk.
    on_time = float(np.clip(rng.normal(95 - risk * 0.18, 3), 60, 99.5))
    otif = float(np.clip(on_time - rng.uniform(2, 8), 55, 99))  # OTIF <= on-time by definition

    supplier_rows.append(
        {
            "supplier_id": sid,
            "name": f"{cat.replace('CAT','Supplier ')}-{i+1:03d}",
            "country": country,
            "category_id": cat,
            "tier": tier,
            "single_source_flag": single_source,
            "risk_score": round(risk, 1),
            "TTR_days": round(ttr, 1),
            "TTS_days": round(tts, 1),
            "on_time_pct": round(on_time, 1),
            "otif_pct": round(otif, 1),
        }
    )

suppliers = pd.DataFrame(supplier_rows)
# attach readable category name for convenience (Power BI can also join on id)
suppliers = suppliers.merge(
    categories[["category_id", "name"]].rename(columns={"name": "category_name"}),
    on="category_id",
    how="left",
)
# resilience helper flag computed empirically from attributes
suppliers["tts_gt_ttr_flag"] = (suppliers["TTS_days"] > suppliers["TTR_days"]).astype(int)

# --------------------------------------------------------------------------------------
# 3. CONTRACTS
# --------------------------------------------------------------------------------------
# ASSUMPTION: ~82% of suppliers have at least one contract; some have 2. Most contracts
# are CURRENT (active as of M3) so that contract coverage of spend is realistic for a
# mature org (~78-88%). A deliberate minority have expired (end < M3) so "expiring/lapsed
# contract" remains a real, non-trivial signal on the dashboard.
contract_rows = []
cidx = 1
for _, s in suppliers.iterrows():
    has_contract = rng.random() < 0.82
    if not has_contract:
        continue
    n_contracts = 1 if rng.random() < 0.8 else 2
    for _ in range(n_contracts):
        # contract value scaled by tier (Tier-1 bigger) — EUR/year
        base = {1: 4_500_000, 2: 1_400_000, 3: 350_000}[int(s["tier"])]
        value = float(max(40_000, rng.normal(base, base * 0.4)))
        # ASSUMPTION: terms are 12-36 mo. We start most contracts recently enough that
        # they are still active at M3 (start within the last `term-2` months), with ~15%
        # deliberately lapsed (started long enough ago to have already ended).
        term = int(rng.choice([12, 18, 24, 36], p=[0.15, 0.2, 0.35, 0.30]))
        if rng.random() < 0.15:
            # lapsed contract: started (term + 1..6) months ago -> already expired
            start_offset = term + int(rng.integers(1, 7))
        else:
            # active contract: started within the last (term-2) months -> still running at M3
            start_offset = int(rng.integers(0, max(1, term - 2)))
        start = (ANCHOR - pd.DateOffset(months=start_offset)).normalize()
        end = (start + pd.DateOffset(months=term)).normalize()
        contract_rows.append(
            {
                "contract_id": f"CON{cidx:04d}",
                "supplier_id": s["supplier_id"],
                "category_id": s["category_id"],
                "value_eur": round(value, 2),
                "start_date": start.date().isoformat(),
                "end_date": end.date().isoformat(),
                "auto_renew_flag": int(rng.random() < 0.55),
            }
        )
        cidx += 1

contracts = pd.DataFrame(contract_rows)
# Set of suppliers with a contract ACTIVE as of M3 (used to bias on_contract spend)
active_contract_suppliers = set(
    contracts.loc[
        (pd.to_datetime(contracts["start_date"]) <= M3)
        & (pd.to_datetime(contracts["end_date"]) >= M3),
        "supplier_id",
    ]
)

# --------------------------------------------------------------------------------------
# 4. SPEND TRANSACTIONS (24 months, line level)
# --------------------------------------------------------------------------------------
# ASSUMPTION: total annual spend ~ €640m across all categories. We spread spend over 24
# months with mild seasonality and a gentle upward trend. Each transaction is assigned a
# supplier (within its category), and flags for on_contract / po (purchase order).
#
# Derived behaviours we want the data to exhibit:
#   - Tail spend: the long tail of small suppliers makes up a small % of spend but a
#     large % of supplier count (Pareto-ish).
#   - Maverick (off-contract) spend: transactions with on_contract_flag = 0. Higher for
#     suppliers without an active contract and for Marketing / Prof. Services.
#   - PO compliance: po_flag = 0 spend tends to overlap with maverick spend.
TARGET_ANNUAL_SPEND = 640_000_000.0  # EUR/yr (synthetic)
monthly_base = TARGET_ANNUAL_SPEND / 12.0

# supplier -> category lookup and per-supplier "size weight" for Pareto tail
sup_by_cat = suppliers.groupby("category_id")["supplier_id"].apply(list).to_dict()
# size weight: a few big suppliers, many small ones (lognormal)
size_weight = {
    s: float(rng.lognormal(mean=0.0, sigma=1.1)) for s in suppliers["supplier_id"]
}

txn_rows = []
tidx = 1
for m_i, m in enumerate(MONTH_STARTS):
    # gentle trend (+) and seasonality (Q4 marketing/hardware bump, summer dip)
    trend = 1.0 + 0.004 * m_i
    month = m.month
    seasonal = 1.0 + (0.06 if month in (10, 11) else 0.0) - (0.04 if month in (7, 8) else 0.0)
    month_total = monthly_base * trend * seasonal

    for _, c in categories.iterrows():
        cat_id = c["category_id"]
        cat_total = month_total * c["spend_share"]
        sup_list = sup_by_cat.get(cat_id, [])
        if not sup_list:
            continue
        # weights for suppliers in this category (Pareto tail)
        w = np.array([size_weight[s] for s in sup_list])
        w = w / w.sum()
        # ASSUMPTION: each category-month emits 18-32 transactions
        n_txn = int(rng.integers(18, 33))
        # split cat_total across n_txn transactions with dirichlet noise
        parts = rng.dirichlet(np.ones(n_txn) * 2.0) * cat_total
        chosen = rng.choice(sup_list, size=n_txn, p=w)
        for amt, sup in zip(parts, chosen, strict=False):
            has_active = sup in active_contract_suppliers
            # on-contract probability: high if supplier has an active contract at M3,
            # much lower otherwise. Marketing / Prof. Services carry more maverick spend.
            # Calibrated so total off-contract (maverick) spend lands ~12-20%.
            base_oc = 0.96 if has_active else 0.66
            if c["name"] in ("Marketing", "Professional Services"):
                base_oc -= 0.13
            on_contract = int(rng.random() < max(0.05, base_oc))
            # PO flag correlates with on-contract (off-contract often = no PO)
            po = int(rng.random() < (0.95 if on_contract else 0.55))
            # transaction date: random day within the month
            day = int(rng.integers(1, 28))
            txn_date = m.replace(day=day)
            txn_rows.append(
                {
                    "txn_id": f"TX{tidx:07d}",
                    "date": txn_date.date().isoformat(),
                    "month": month_key(m),
                    "supplier_id": sup,
                    "category_id": cat_id,
                    "amount_eur": round(float(amt), 2),
                    "on_contract_flag": on_contract,
                    "po_flag": po,
                }
            )
            tidx += 1

spend = pd.DataFrame(txn_rows)

# --------------------------------------------------------------------------------------
# 5. FORECAST vs ACTUAL (planned vs executed) — by category & month
# --------------------------------------------------------------------------------------
# We model a "volume" (e.g. demand units / committed PO volume index) per category-month,
# with a planned figure and an actual figure. Forecast error should:
#   - IMPROVE over the last 3 months for most categories (analytics investment story),
#   - EXCEPT one disrupted category (Logistics) which gets WORSE in M2 then partly
#     recovers — so the trend isn't a flat "everything is green" lie.
#
# We also generate planned vs actual PO dates to compute Plan/Schedule Adherence %.
fva_rows = []
disrupted_cat = "Logistics"

for _, c in categories.iterrows():
    cat_id = c["category_id"]
    cat_name = c["name"]
    # baseline monthly volume scaled by category spend share
    base_vol = 800 + c["spend_share"] * 6000
    for m_i, m in enumerate(MONTH_STARTS):
        months_from_end = (N_MONTHS - 1) - m_i  # 0 at M3
        # ASSUMPTION: forecast error has a DETERMINISTIC magnitude `mu_err` (the trend
        # signal) plus small symmetric noise `sigma` (so it's not perfectly smooth).
        # Magnitude shrinks toward the present (analytics learning curve):
        #   early history ~ 16-20% error; recent ~ 6-8% error.
        mu_err = 0.07 + 0.006 * months_from_end          # signal magnitude
        sigma = 0.012                                     # small jitter, never swamps signal
        # disrupted category (Logistics): clear spike in M2, partial recovery in M3.
        if cat_name == disrupted_cat:
            if m == M2:
                mu_err += 0.13   # M2 blows out
            elif m == M3:
                mu_err += 0.05   # M3 partially recovers but still elevated
            elif m == M1:
                mu_err += 0.02

        # sign: historically we OVER-forecast (actual below plan, err>0); bias shrinks
        # toward neutral in recent months (forecast bias % approaches 100%).
        bias_dir = 1.0  # over-forecast
        err = bias_dir * mu_err + rng.normal(0, sigma)

        planned = base_vol * (1.0 + 0.003 * m_i) * (1 + rng.normal(0, 0.02))
        actual = planned * (1.0 - err)  # err>0 => actual below plan (over-forecast)

        # Planned vs actual PO date (schedule adherence). Adherence improves recently.
        # late_days ~ larger in history, smaller now; disrupted cat late in M2.
        late_lambda = 1.0 + 0.25 * months_from_end
        if cat_name == disrupted_cat and m == M2:
            late_lambda += 6.0
        planned_po = m.replace(day=10)
        late_days = int(rng.poisson(late_lambda))
        actual_po = planned_po + pd.Timedelta(days=late_days)

        fva_rows.append(
            {
                "month": month_key(m),
                "category_id": cat_id,
                "category_name": cat_name,
                "planned_volume": round(float(planned), 1),
                "actual_volume": round(float(max(0.0, actual)), 1),
                "planned_po_date": planned_po.date().isoformat(),
                "actual_po_date": actual_po.date().isoformat(),
                "po_late_days": late_days,
            }
        )

forecast = pd.DataFrame(fva_rows)

# --------------------------------------------------------------------------------------
# 6. DISRUPTIONS -> empirical resilience time-metrics
# --------------------------------------------------------------------------------------
# Each event has: start (incident begins), detected_at (awareness), action_at (response),
# recovered_at (back to normal). From these we derive:
#   Time-to-Awareness (TTA)   = detected_at - start
#   Time-to-Action  (TTAct)   = action_at  - detected_at
#   Time-to-Recover (TTR)     = recovered_at - start         (empirical, vs supplier TTR)
#   Time-to-Survive (TTS)     = supplier buffer (from master) — compared to empirical TTR
# ASSUMPTION: ~22 disruption events over 24 months. Bias events toward higher-risk and
# single-source suppliers. Single-source events recover slower & cost more.
N_EVENTS = 22
risk_w = suppliers["risk_score"].to_numpy()
risk_w = risk_w / risk_w.sum()

event_rows = []
for e in range(N_EVENTS):
    s = suppliers.iloc[int(rng.choice(len(suppliers), p=risk_w))]
    start_month = MONTH_STARTS[int(rng.integers(0, N_MONTHS))]
    start = start_month + pd.Timedelta(days=int(rng.integers(0, 27)))

    single = bool(s["single_source_flag"])
    # awareness: 0.5-5 days; worse (longer) for higher-risk suppliers
    tta = max(0.2, rng.normal(2.0 + s["risk_score"] / 40, 1.0))
    # action: 0.5-4 days after awareness
    ttact = max(0.2, rng.normal(1.5, 0.8))
    # recovery duration anchored on supplier TTR_days (+ noise; +penalty if single-source)
    recover_dur = max(
        1.0, rng.normal(s["TTR_days"] * (1.2 if single else 1.0), s["TTR_days"] * 0.2)
    )

    detected_at = start + pd.Timedelta(days=float(tta))
    action_at = detected_at + pd.Timedelta(days=float(ttact))
    recovered_at = start + pd.Timedelta(days=float(recover_dur))
    # ensure ordering
    if recovered_at < action_at:
        recovered_at = action_at + pd.Timedelta(days=1)

    # financial impact: scales with risk, single-source, and recovery length
    impact = (recover_dur / 30.0) * rng.uniform(50_000, 400_000) * (1.6 if single else 1.0)

    event_rows.append(
        {
            "event_id": f"EVT{e+1:03d}",
            "supplier_id": s["supplier_id"],
            "category_id": s["category_id"],
            "single_source_flag": int(single),
            "start": start.date().isoformat(),
            "detected_at": detected_at.date().isoformat(),
            "action_at": action_at.date().isoformat(),
            "recovered_at": recovered_at.date().isoformat(),
            "tta_days": round(float(tta), 2),
            "ttact_days": round(float(ttact), 2),
            "ttr_days_empirical": round(float(recover_dur), 2),
            "tts_days_buffer": round(float(s["TTS_days"]), 2),
            "tts_gt_ttr_flag": int(s["TTS_days"] > recover_dur),  # survived without stockout?
            "impact_eur": round(float(impact), 2),
        }
    )

disruptions = pd.DataFrame(event_rows)

# --------------------------------------------------------------------------------------
# 7. DATE DIMENSION (helper for Power BI time intelligence)
# --------------------------------------------------------------------------------------
all_days = pd.date_range(MONTH_STARTS[0], M3 + pd.offsets.MonthEnd(0), freq="D")
dim_date = pd.DataFrame({"date": all_days})
dim_date["date"] = dim_date["date"].dt.date.astype(str)
_d = pd.to_datetime(dim_date["date"])
dim_date["year"] = _d.dt.year
dim_date["month_num"] = _d.dt.month
dim_date["month_key"] = _d.dt.strftime("%Y-%m")
dim_date["month_name"] = _d.dt.strftime("%b %Y")
dim_date["quarter"] = "Q" + _d.dt.quarter.astype(str)
dim_date["is_reporting_month"] = _d.dt.strftime("%Y-%m").isin(
    [month_key(x) for x in REPORTING_MONTHS]
).astype(int)
dim_date["reporting_label"] = _d.dt.strftime("%Y-%m").map(
    {month_key(M1): "M1", month_key(M2): "M2", month_key(M3): "M3"}
).fillna("")

# --------------------------------------------------------------------------------------
# 8. WRITE CSVs
# --------------------------------------------------------------------------------------
outputs = {
    "suppliers.csv": suppliers,
    "categories.csv": categories,
    "spend_transactions.csv": spend,
    "contracts.csv": contracts,
    "forecast_vs_actual.csv": forecast,
    "disruptions.csv": disruptions,
    "dim_date.csv": dim_date,
}
for fname, df in outputs.items():
    df.to_csv(os.path.join(RAW, fname), index=False, encoding="utf-8")

# --------------------------------------------------------------------------------------
# 9. CONSOLE SUMMARY + SANITY CHECKS
# --------------------------------------------------------------------------------------
print("=" * 70)
print("SCM Master Tool — synthetic data generated")
print("=" * 70)
print(f"Reporting months: M1={month_key(M1)}  M2={month_key(M2)}  M3={month_key(M3)}")
for fname, df in outputs.items():
    print(f"  {fname:<24} rows={len(df):>6}")

print("-" * 70)
print("SANITY CHECKS")
total_spend = spend["amount_eur"].sum()
print(f"  Total spend (24 mo): EUR {total_spend:,.0f}  (target ~ {TARGET_ANNUAL_SPEND*2:,.0f})")
mav = spend.loc[spend["on_contract_flag"] == 0, "amount_eur"].sum() / total_spend
print(f"  Maverick (off-contract) spend %: {mav:6.1%}")
po_noncov = spend.loc[spend["po_flag"] == 0, "amount_eur"].sum() / total_spend
print(f"  No-PO spend %:                  {po_noncov:6.1%}")
single_pct = suppliers["single_source_flag"].mean()
print(f"  Single-source suppliers %:      {single_pct:6.1%}")
viol = (suppliers["TTS_days"] <= suppliers["TTR_days"]).mean()
print(f"  Suppliers violating TTS>TTR:    {viol:6.1%}  (expected ~15-30%)")
print(f"  Disruption events:              {len(disruptions)}")
print(f"  Disruptions where TTS<=TTR:     {(disruptions['tts_gt_ttr_flag']==0).mean():6.1%}")

# Forecast WMAPE (recent 3 months overall) — quick proof the trend exists
def wmape(df):
    return (df["planned_volume"] - df["actual_volume"]).abs().sum() / df["planned_volume"].sum()

for label, m in zip(["M1", "M2", "M3"], REPORTING_MONTHS, strict=False):
    sub = forecast[forecast["month"] == month_key(m)]
    log_sub = sub[sub["category_name"] == disrupted_cat]
    print(
        f"  WMAPE {label} ({month_key(m)}): overall={wmape(sub):6.2%}"
        f"   {disrupted_cat}={wmape(log_sub):6.2%}"
    )
print("=" * 70)
print(f"CSV files written to: {RAW}")
