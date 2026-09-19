#!/usr/bin/env python3
"""
Runfi scenario runner.

Runs the named scenarios, writes one CSV per scenario, a markdown summary, and a
JSON bundle the interactive page reads. Also runs two sensitivity sweeps:

  1. payout_share      - how much of revenue should go into the pool?
  2. target_payout_usd - the parameter we are least sure of; does the answer
                         survive being wrong about it?

Run with:  python3 scenarios.py
"""

from __future__ import annotations

import csv
import json
import os
from dataclasses import replace

from model import Params, run, break_even_mau, effective_face_multiple

OUT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(OUT, "data")


# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------

BASE = Params(label="base", engine="revenue_share")

# The full v2 revenue stack, reused by several scenarios below.
V2_REVENUE = dict(
    commerce_attach_rate=0.04, commerce_aov_usd=110.0, commerce_take_rate=0.10,
    sub_conversion=0.12, sub_price_usd=7.99, ad_arpu_usd=1.20, offer_arpu_usd=0.50,
    earner_share=0.30, covered_share=0.60, payer_pepm_usd=8.00,
    churn_ceiling=0.18, prize_multiplier=2.2,
    paid_signups_m1=14_000.0, paid_signup_decay=0.985, referral_k=0.10,
)

SCENARIOS = [
    BASE,

    # The STEPN shape on identical user dynamics. Fixed nominal emission, funded
    # by new-entrant buy-in.
    replace(BASE, label="stepn_token", engine="token_mint"),

    # Growth arrives far faster than revenue can follow. This is the case that
    # kills a fixed-rate design and the one a pro-rata pool is built for.
    replace(BASE, label="hypergrowth", paid_signups_m1=25_000.0,
            paid_signup_decay=0.99, referral_k=0.14),

    # Monetisation underperforms: brand deals do not land and subs convert badly.
    replace(BASE, label="revenue_stall", ad_arpu_usd=0.18, offer_arpu_usd=0.10,
            sub_conversion=0.020),

    # Attestation is weaker than hoped and the farms find it.
    replace(BASE, label="cheat_epidemic", cheat_detection=0.45,
            cheat_reward_sensitivity=1.10),

    # Pay out nearly everything, chasing retention.
    replace(BASE, label="generous_80pct", payout_share=0.80),

    # Pay out little and lean on the stake game plus the product itself.
    replace(BASE, label="lean_25pct", payout_share=0.25),

    # No commitment stakes: pro-rata pool alone.
    replace(BASE, label="no_stakes", stakes_enabled=False),

    # Sever the one line that makes STEPN a spiral rather than a decline: stop
    # pricing the entry NFT in the token it emits.
    replace(BASE, label="token_no_feedback", engine="token_mint",
            entry_price_elasticity=0.0),

    # The app is genuinely worth opening with the money switched off.
    replace(BASE, label="good_product", churn_ceiling=0.18),

    # Same dollars, paid as an activity-weighted weekly draw.
    replace(BASE, label="prize_linked", prize_multiplier=2.2),

    # The recommended design: good product + prize-linked payout + stakes,
    # at a top of funnel that can actually reach break-even scale.
    replace(BASE, label="designed", churn_ceiling=0.18, prize_multiplier=2.2,
            paid_signups_m1=14_000.0, paid_signup_decay=0.985, referral_k=0.10),

    # The same funnel WITHOUT the motivation design, to isolate its contribution.
    replace(BASE, label="designed_control", paid_signups_m1=14_000.0,
            paid_signup_decay=0.985, referral_k=0.10),

    # ---- Engine C: can a token work at all? ----
    # Fair launch: no team or investor allocation, zero emission, payouts bought
    # on the open market out of revenue. The only design here that holds.
    replace(BASE, label="token_buyback_fair", engine="token_buyback"),

    # The same buyback mechanism, launched at the valuation these projects
    # actually launched at. 20% vesting to team and investors against a $250M
    # fully diluted valuation, on a business whose launch-month buyback is $83k.
    replace(BASE, label="token_buyback_overvalued", engine="token_buyback",
            unlock_allocation_share=0.20, token_price_usd=0.25, **V2_REVENUE),

    # Identical, except the launch valuation is sized to the buyback that exists
    # on day one rather than the one on the pitch deck.
    replace(BASE, label="token_buyback_sized", engine="token_buyback",
            unlock_allocation_share=0.20, token_price_usd=0.002, **V2_REVENUE),

    # Sized correctly, but printing 50 cents of token for every dollar bought.
    replace(BASE, label="token_buyback_emission", engine="token_buyback",
            unlock_allocation_share=0.20, token_price_usd=0.002,
            emission_multiple_of_buyback=0.50, **V2_REVENUE),

    # ---- the payout-per-player ladder (see LADDER below) ----
    replace(BASE, label="runfi_v2",
            commerce_attach_rate=0.04, commerce_aov_usd=110.0, commerce_take_rate=0.10,
            sub_conversion=0.12, sub_price_usd=7.99, ad_arpu_usd=1.20, offer_arpu_usd=0.50,
            earner_share=0.30, payout_in_kind_share=0.50, in_kind_face_multiple=1.45,
            covered_share=0.60, payer_pepm_usd=8.00,
            churn_ceiling=0.18, prize_multiplier=2.2,
            paid_signups_m1=14_000.0, paid_signup_decay=0.985, referral_k=0.10),

    # The Vitality / UnitedHealthcare Motion shape: sold to the payer, the member
    # is enrolled rather than acquired. Consumer monetisation barely matters.
    replace(BASE, label="insurer_native",
            covered_share=0.95, payer_pepm_usd=14.00, payer_payout_share=0.70,
            earner_share=0.35, payout_in_kind_share=0.60, in_kind_face_multiple=1.45,
            churn_ceiling=0.18, prize_multiplier=2.2,
            paid_signups_m1=9_000.0, paid_signup_decay=0.99, referral_k=0.05,
            cac_usd=6.00),
]

# Each rung ADDS to the one above it. The question is not which lever is best,
# it is how much they are worth stacked, because they are independent.
LADDER = [
    ("base", {}),
    ("+ commerce",
     dict(commerce_attach_rate=0.04, commerce_aov_usd=110.0, commerce_take_rate=0.10)),
    ("+ consumer monetisation",
     dict(sub_conversion=0.12, sub_price_usd=7.99, ad_arpu_usd=1.20, offer_arpu_usd=0.50)),
    ("+ concentration (30% earn)", dict(earner_share=0.30)),
    ("+ paid in kind",
     dict(payout_in_kind_share=0.50, in_kind_face_multiple=1.45)),
    ("+ payer pilot (25% @ $6)",
     dict(covered_share=0.25, payer_pepm_usd=6.00)),
    ("+ payer at scale (60% @ $8)",
     dict(covered_share=0.60, payer_pepm_usd=8.00)),
]


def ladder_params() -> list[tuple[str, Params]]:
    """Cumulative parameter sets, one per rung."""
    acc, out = {}, []
    for name, step in LADDER:
        acc = {**acc, **step}
        out.append((name, replace(BASE, label=name, **acc)))
    return out

FIELDS = [
    "month", "mau", "joiners", "leavers", "churn_rate", "satisfaction",
    "revenue_usd", "revenue_per_user_usd", "consumer_revenue_usd", "payer_revenue_usd",
    "pool_usd", "paid_out_usd", "payout_per_user_usd", "earners",
    "payout_per_earner_usd", "payout_per_earner_face_usd", "earner_upside_face_usd",
    "stake_bonus_per_winner_usd", "total_user_upside_usd",
    "cheat_inflation", "fraud_leak_usd", "costs_usd", "net_usd", "treasury_usd",
    "token_price_usd", "entry_cost_usd", "buyback_usd", "sell_pressure_usd",
    "buyback_coverage", "unlock_tokens", "held_tokens", "unlock_sell_usd",
    "invariant_ok",
]


def summarise(label: str, rows: list[dict]) -> dict:
    last = rows[-1]
    covs = [r["buyback_coverage"] for r in rows if "buyback_coverage" in r]
    breaches = sum(1 for r in rows if not r["invariant_ok"])
    trough = min(r["treasury_usd"] for r in rows)
    insolvent_month = next(
        (r["month"] for r in rows if r["treasury_usd"] < 0), None)
    peak_mau = max(r["mau"] for r in rows)
    return {
        "scenario": label,
        "mau_m24": last["mau"],
        "peak_mau": peak_mau,
        "retention_of_peak": last["mau"] / peak_mau if peak_mau else 0.0,
        "revenue_m24_usd": last["revenue_usd"],
        "payout_per_user_m24_usd": last["payout_per_user_usd"],
        "user_upside_m24_usd": last["total_user_upside_usd"],
        "payout_per_earner_face_m24_usd": last["payout_per_earner_face_usd"],
        "earner_upside_face_m24_usd": last["earner_upside_face_usd"],
        "treasury_m24_usd": last["treasury_usd"],
        "treasury_trough_usd": trough,
        "insolvent_month": insolvent_month,
        "invariant_breaches": breaches,
        "token_price_m24_usd": last["token_price_usd"],
        "min_buyback_coverage": min(covs) if covs else None,
        "buyback_m24_usd": last.get("buyback_usd"),
        "months_profitable": sum(1 for r in rows if r["net_usd"] > 0),
        "net_m24_usd": last["net_usd"],
        "fraud_leak_total_usd": sum(r["fraud_leak_usd"] for r in rows),
    }


def sweep_payout_share() -> list[dict]:
    out = []
    for i in range(1, 20):
        share = i * 0.05
        rows = run(replace(BASE, label=f"share_{share:.2f}", payout_share=share))
        s = summarise(f"{share:.2f}", rows)
        s["payout_share"] = share
        s.update(break_even_mau(replace(BASE, payout_share=share)))
        out.append(s)
    return out


def sweep_target_payout() -> list[dict]:
    """Our least defensible assumption. Does the design survive being wrong?"""
    out = []
    for target in [1.0, 2.0, 3.0, 4.0, 6.0, 8.0, 12.0, 20.0]:
        rows = run(replace(BASE, label=f"target_{target}", target_payout_usd=target))
        s = summarise(f"${target:.0f}", rows)
        s["target_payout_usd"] = target
        out.append(s)
    return out


def main() -> None:
    os.makedirs(DATA, exist_ok=True)
    summaries, bundle = [], {}

    for p in SCENARIOS:
        rows = run(p)
        bundle[p.label] = rows
        summaries.append(summarise(p.label, rows))
        path = os.path.join(DATA, f"{p.label}.csv")
        with open(path, "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=FIELDS)
            w.writeheader()
            for r in rows:
                w.writerow({k: r.get(k, "") for k in FIELDS})

    share_sweep = sweep_payout_share()
    target_sweep = sweep_target_payout()

    with open(os.path.join(DATA, "summary.json"), "w") as fh:
        json.dump({
            "break_even": {f"share_{x:.2f}": break_even_mau(replace(BASE, payout_share=x))
                           for x in (0.25, 0.50, 0.80)},
            "scenarios": summaries,
            "ladder": [{"rung": n, **{k: v for k, v in run(lp)[-1].items()
                                       if k in ("mau", "revenue_per_user_usd",
                                                "payout_per_earner_usd",
                                                "payout_per_earner_face_usd",
                                                "earner_upside_face_usd",
                                                "treasury_usd")},
                        "break_even_mau": break_even_mau(lp).get("break_even_mau")}
                       for n, lp in ladder_params()],
            "payout_share_sweep": share_sweep,
            "target_payout_sweep": target_sweep,
        }, fh, indent=2)

    # ---- console report ---------------------------------------------------
    def money(x):
        if x is None:
            return "-"
        a = abs(x)
        if a >= 1e9:
            return f"${x/1e9:,.2f}B"
        if a >= 1e6:
            return f"${x/1e6:,.2f}M"
        if a >= 1e3:
            return f"${x/1e3:,.0f}k"
        return f"${x:,.2f}"

    print("\nSCENARIOS (month 24)")
    print(f"{'scenario':<18}{'MAU':>10}{'revenue':>11}{'pay/user':>10}"
          f"{'upside':>9}{'treasury':>12}{'breaches':>10}{'insolvent':>10}")
    print("-" * 90)
    for s in summaries:
        print(f"{s['scenario']:<18}{s['mau_m24']:>10,.0f}"
              f"{money(s['revenue_m24_usd']):>11}"
              f"{money(s['payout_per_user_m24_usd']):>10}"
              f"{money(s['user_upside_m24_usd']):>9}"
              f"{money(s['treasury_m24_usd']):>12}"
              f"{s['invariant_breaches']:>10}"
              f"{str(s['insolvent_month'] or '-'):>10}")

    for name in ("stepn_token", "token_no_feedback"):
        print(f"\nTOKEN PATH ({name})")
        for r in bundle[name]:
            if r["month"] in (1, 3, 6, 12, 18, 24):
                print(f"  m{r['month']:>2}  price {money(r['token_price_usd']):>9}"
                      f"  ({r['token_price_usd']/3.0-1:>7.1%} vs launch)"
                      f"   sneaker {money(r['entry_cost_usd']):>8}"
                      f"   earn/user/mo {money(r['payout_per_user_usd']):>8}"
                      f"   MAU {r['mau']:>9,.0f}")

    print("\nBREAK-EVEN (steady state at month 12 policy, excludes acquisition spend)")
    for p_ in (BASE, replace(BASE, label="lean", payout_share=0.25),
               replace(BASE, label="generous", payout_share=0.80)):
        be = break_even_mau(p_)
        if be.get("break_even_mau"):
            print(f"  payout_share {p_.payout_share:.2f}: "
                  f"{be['break_even_mau']:>10,.0f} MAU needed   "
                  f"rev/user {money(be['revenue_per_user_usd'])}   "
                  f"pay/user {money(be['payout_per_user_usd'])}")
        else:
            print(f"  payout_share {p_.payout_share:.2f}: {be['reason']}")

    print("\nPAYOUT SHARE SWEEP (revenue_share engine)")
    print(f"{'share':>7}{'MAU m24':>11}{'pay/user':>10}{'upside':>9}"
          f"{'breakeven MAU':>15}{'treasury m24':>15}")
    print("-" * 68)
    for s in share_sweep:
        be = s.get("break_even_mau")
        print(f"{s['payout_share']:>7.2f}{s['mau_m24']:>11,.0f}"
              f"{money(s['payout_per_user_m24_usd']):>10}"
              f"{money(s['user_upside_m24_usd']):>9}"
              f"{(f'{be:,.0f}' if be else 'never'):>15}"
              f"{money(s['treasury_m24_usd']):>15}")

    print("\n  Paying more always retains more and always costs more; nothing in the")
    print("  pro-rata mechanism ever breaks. The binding constraint is not the")
    print("  payout rule, it is whether you reach break-even MAU before the")
    print("  treasury runs out. That is a growth problem, not a tokenomics one.")

    print("\nTARGET PAYOUT SENSITIVITY (what if we are wrong about motivation?)")
    print(f"{'target':>8}{'MAU m24':>11}{'pay/user':>10}{'treasury m24':>15}{'breaches':>10}")
    print("-" * 54)
    for s in target_sweep:
        print(f"{s['scenario']:>8}{s['mau_m24']:>11,.0f}"
              f"{money(s['payout_per_user_m24_usd']):>10}"
              f"{money(s['treasury_m24_usd']):>15}"
              f"{s['invariant_breaches']:>10}")

    by_engine = {sc.label: sc.engine for sc in SCENARIOS}
    rs = [s for s in summaries if by_engine[s["scenario"]] == "revenue_share"]
    tk = [s for s in summaries if by_engine[s["scenario"]] == "token_mint"]
    print("\nINVARIANT  payouts <= outside revenue, every month")
    print(f"  revenue_share ({len(rs)} scenarios): "
          f"{sum(s['invariant_breaches'] for s in rs)} breaches in "
          f"{len(rs)*BASE.months} scenario-months")
    print(f"  token_mint    ({len(tk)} scenarios): "
          f"{sum(s['invariant_breaches'] for s in tk)} breaches in "
          f"{len(tk)*BASE.months} scenario-months")
    print("\nCAN A TOKEN WORK? (Engine C: revenue -> open-market buyback -> distribute)")
    print(f"{'design':<26}{'launch FDV':>12}{'m24 price':>12}{'vs launch':>11}"
          f"{'min cov':>9}{'per earner':>12}{'breaches':>10}")
    print("-" * 92)
    for name in ("token_buyback_fair", "token_buyback_overvalued",
                 "token_buyback_sized", "token_buyback_emission"):
        rows = bundle[name]
        p0 = next(sc for sc in SCENARIOS if sc.label == name)
        fdv = p0.token_price_usd * p0.token_total_supply
        l = rows[-1]
        print(f"{name.replace('token_buyback_',''):<26}{money(fdv):>12}"
              f"{money(l['token_price_usd']):>12}"
              f"{l['token_price_usd'] / p0.token_price_usd - 1:>10.0%}"
              f"{min(r['buyback_coverage'] for r in rows):>9.2f}"
              f"{money(l['payout_per_earner_usd']):>12}"
              f"{sum(1 for r in rows if not r['invariant_ok']):>10}")
    print("  Note the last column. The payout is bought, never minted, so the")
    print("  invariant holds in every one of these - including the ones whose")
    print("  token goes to zero. Player earnings are quoted and bought in")
    print("  dollars, so they do not move with the price at all.")

    print("\nPAYOUT PER PLAYER LADDER (month 24, each rung adds to the one above)")
    print(f"{'rung':<30}{'rev/user':>10}{'earners':>10}{'/earner':>10}"
          f"{'face':>9}{'+stake':>9}{'breakeven':>11}{'treasury':>11}")
    print("-" * 100)
    ladder_rows = []
    for name, lp in ladder_params():
        rows = run(lp)
        l = rows[-1]
        be = break_even_mau(lp)
        ladder_rows.append({
            "rung": name, "mau_m24": l["mau"],
            "revenue_per_user_usd": l["revenue_per_user_usd"],
            "payout_per_earner_usd": l["payout_per_earner_usd"],
            "payout_per_earner_face_usd": l["payout_per_earner_face_usd"],
            "earner_upside_face_usd": l["earner_upside_face_usd"],
            "break_even_mau": be.get("break_even_mau"),
            "treasury_m24_usd": l["treasury_usd"],
            "invariant_breaches": sum(1 for r in rows if not r["invariant_ok"]),
        })
        print(f"{name:<30}{money(l['revenue_per_user_usd']):>10}"
              f"{l['earners']/l['mau']:>9.0%}"
              f"{money(l['payout_per_earner_usd']):>10}"
              f"{money(l['payout_per_earner_face_usd']):>9}"
              f"{money(l['earner_upside_face_usd']):>9}"
              f"{(f'{be[chr(34)]}' if False else (f'{be.get(chr(98)+chr(114)+chr(101)+chr(97)+chr(107)+chr(95)+chr(101)+chr(118)+chr(101)+chr(110)+chr(95)+chr(109)+chr(97)+chr(117)):,.0f}' if be.get('break_even_mau') else 'never')):>11}"
              f"{money(l['treasury_usd']):>11}")
    bad = [r for r in ladder_rows if r["invariant_breaches"]]
    print(f"  invariant breaches across every rung: {sum(r['invariant_breaches'] for r in ladder_rows)}")

    print("\nFULL DESIGNS (month 24)")
    for name in ("base", "runfi_v2", "insurer_native"):
        r = bundle[name][-1]
        print(f"  {name:<16} MAU {r['mau']:>9,.0f}   rev/user {money(r['revenue_per_user_usd']):>7}"
              f"   per earner {money(r['payout_per_earner_face_usd']):>8} face"
              f"   +stake {money(r['earner_upside_face_usd']):>8}"
              f"   treasury {money(r['treasury_usd']):>9}")

    print("\nPROFITABILITY")
    for s in summaries:
        print(f"  {s['scenario']:<20}{s['months_profitable']:>3}/24 months in profit"
              f"   net m24 {money(s['net_m24_usd']):>10}"
              f"   trough {money(s['treasury_trough_usd']):>10}")

    print(f"\nwrote {len(SCENARIOS)} CSVs + summary.json to {DATA}\n")


if __name__ == "__main__":
    main()
