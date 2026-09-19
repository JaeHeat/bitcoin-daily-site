#!/usr/bin/env python3
"""
Runfi sustainability model
==========================

A 24-month cohort simulation of a move-to-earn economy, built to answer one
question: can you pay people to walk without the payout mechanism eating itself?

Three engines are implemented so they can be compared on identical user dynamics.

  ENGINE A  token_mint      The STEPN shape. A protocol token is minted at a
                            FIXED nominal rate per unit of activity. The only
                            real money entering the system is new users buying
                            in. Token price floats on buy pressure vs sell
                            pressure.

  ENGINE C  token_buyback   A token used as a distribution RAIL. Revenue buys the
                            token on the open market and those bought tokens are
                            what gets paid. Emission is zero, so the payout is
                            bought, never printed, and the invariant holds. The
                            open question is whether the PRICE survives.

  ENGINE B  revenue_share   The proposed shape. No token. A fixed SHARE of real
                            outside revenue is placed in a weekly pool and split
                            pro-rata by verified activity. Reward per mile
                            floats; the pool cannot be overdrawn.

Both engines feed the same behavioural loop: what a user earned last month sets
how likely they are to stay, and how likely the system is to attract cheaters.

The headline invariant under test:

    payouts(t) <= outside_revenue(t)      for every period t

Engine B satisfies this by construction. Engine A cannot, and the simulation
shows exactly how that resolves.

No third-party dependencies. Run with:  python3 model.py
"""

from __future__ import annotations

import csv
import json
import math
import os
from dataclasses import dataclass, field, asdict, replace
from typing import Callable

HORIZON_MONTHS = 24


# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------

@dataclass
class Params:
    """All model inputs. Defaults are the base case and are sourced in README.md."""

    # -- horizon -------------------------------------------------------------
    months: int = HORIZON_MONTHS

    # -- user acquisition ----------------------------------------------------
    starting_users: float = 5_000.0
    # Paid/marketing-driven signups in month 1, decaying as cheap channels saturate.
    paid_signups_m1: float = 4_000.0
    paid_signup_decay: float = 0.97          # multiplicative, per month
    # Referral k-factor: new users per existing active user per month. Scaled by
    # how satisfying the reward currently is, because people only refer a thing
    # that is paying.
    referral_k: float = 0.06
    referral_reward_sensitivity: float = 1.0  # 0 = referrals ignore payout level

    # -- retention -----------------------------------------------------------
    # Monthly churn floor: what you get when the reward fully satisfies users.
    churn_floor: float = 0.06
    # Monthly churn ceiling: what you get when the reward is worthless.
    churn_ceiling: float = 0.30
    # The payout per active user per month at which satisfaction saturates.
    # Above this, extra money buys no extra retention. This is the single most
    # important number in the model and the one most worth challenging.
    target_payout_usd: float = 4.00

    # -- activity ------------------------------------------------------------
    # NOT YET CONSUMED. Users are homogeneous in this version, so a pro-rata
    # split of the pool is just an equal split and these two have no effect.
    # They are the hooks for a heterogeneous extension, where activity varies
    # per user and the curve exponent applies diminishing returns above the
    # median so whales and bot farms cannot dominate the split.
    activity_per_user: float = 300.0

    # -- outside revenue (Engine B) -----------------------------------------
    sub_price_usd: float = 4.99
    sub_conversion: float = 0.045            # share of MAU on a paid tier
    app_store_cut: float = 0.15              # small-business rate
    ad_arpu_usd: float = 0.55                # sponsorship / brand, per MAU / month
    offer_arpu_usd: float = 0.35             # opt-in partner offers, per MAU / month
    # Revenue per user is not constant with scale: brand deals price better with
    # audience size, subscriptions convert worse as the funnel widens.
    ad_arpu_scale_exponent: float = 0.08     # ad_arpu *= (mau/ref)^exp
    ad_arpu_scale_ref: float = 50_000.0
    sub_conversion_decay: float = 0.985      # per month, funnel widening

    # -- LEVER 1: commerce ---------------------------------------------------
    # Gear is what this audience already buys. Affiliate or own-margin retail.
    commerce_attach_rate: float = 0.0        # share of MAU buying in a month
    commerce_aov_usd: float = 0.0
    commerce_take_rate: float = 0.0          # your margin on that order

    # -- LEVER 2: the payer channel (B2B2C) ----------------------------------
    # An employer or insurer pays per covered member per month because verified
    # activity lowers their claims. This is the only source in the model that is
    # not capped by consumer attention, and it is 5-10x consumer ARPU. It is also
    # a completely different company to build: long sales cycles, clinical
    # validation, health-data compliance.
    covered_share: float = 0.0               # share of MAU whose payer pays
    payer_pepm_usd: float = 0.0              # per eligible member per month
    # Payer money carries a higher payout share by contract: paying the member to
    # move IS the product they bought. It is still outside revenue, so the
    # invariant is unaffected.
    payer_payout_share: float = 0.60

    # -- LEVER 3: concentration ----------------------------------------------
    # Share of actives who clear the activity bar and qualify to earn. Paying
    # 30% of users 3x beats paying 100% of users 1x, for the same money and the
    # same invariant. The bar is the product: "we pay for real exercise."
    earner_share: float = 1.0

    # -- LEVER 4: payout in kind ---------------------------------------------
    # Partner credit or gift cards bought below face, or your own margin-bearing
    # goods. Costs you a dollar, lands as more than a dollar. Sweatcoin's actual
    # business. Cash cost is what the invariant tests; face value is what the
    # user perceives.
    payout_in_kind_share: float = 0.0        # share of payout delivered in kind
    in_kind_face_multiple: float = 1.0       # face value per dollar of cost

    # -- payout policy (Engine B) -------------------------------------------
    payout_share: float = 0.50               # share of outside revenue into the pool
    payout_share_cap_usd: float = 75.0       # hard per-earner monthly cap
    activity_curve_exponent: float = 0.70    # see activity_per_user: not yet consumed

    # -- costs ---------------------------------------------------------------
    variable_cost_per_user_usd: float = 0.18  # infra, attestation, payment rails
    fixed_cost_monthly_usd: float = 45_000.0  # small team
    cac_usd: float = 1.80                     # blended, per paid signup
    starting_treasury_usd: float = 750_000.0  # seed capital

    # -- cheating ------------------------------------------------------------
    # Fake activity claimed, as a multiple of honest activity, at zero reward.
    cheat_base: float = 0.04
    # How strongly cheating scales with how much money is on the table.
    cheat_reward_sensitivity: float = 0.55
    # Share of fake activity caught before payout clears.
    cheat_detection: float = 0.80

    # -- commitment stakes (self-funded side pool, both engines) -------------
    stakes_enabled: bool = True
    stake_participation: float = 0.12         # share of MAU entering a challenge
    stake_amount_usd: float = 20.0            # per 6-week challenge, ~1/1.5 months
    stake_success_rate: float = 0.72          # share who hit their goal
    stake_rake: float = 0.15                  # platform cut of forfeits
    stake_cycle_months: float = 1.5

    # -- token economy (Engine A only) --------------------------------------
    token_price_usd: float = 3.00
    entry_cost_usd: float = 350.0             # NFT sneaker, paid by every new user
    entry_to_token_buy: float = 0.55          # share of entry spend that bids the token
    tokens_per_user_month: float = 60.0       # FIXED nominal emission. The bug.
    token_sell_fraction: float = 0.85         # share of earned tokens sold to market
    token_sink_fraction: float = 0.30         # share burned on repairs/levelling
    token_price_damping: float = 0.55         # price response to order imbalance
    token_price_floor_usd: float = 0.0005
    # THE death-spiral term. The entry NFT is priced in token terms, so when the
    # token falls the sneaker falls with it, and each new user brings less real
    # buy pressure than the one before. Set to 0 to sever the link and see the
    # spiral disappear - that single line is the difference between STEPN's
    # chart and a soft landing.
    entry_price_elasticity: float = 0.85

    # -- buyback token economy (Engine C) ------------------------------------
    # The token as a distribution RAIL rather than a source of funds. Revenue
    # arrives in fiat, the protocol buys the token on the open market, and those
    # bought tokens are what gets paid out. Emission is zero by default, so the
    # payout is bought, never printed, and the invariant is untouched.
    #
    # Payouts are quoted in dollars and bought at the price of the day, so what
    # an earner receives is price-INDEPENDENT. A falling token means more tokens
    # per dollar, not a smaller payout. That single property is what separates
    # this from every design that failed.
    # Minting on top of the buyback, expressed against the buyback itself: for
    # every dollar of token bought with real revenue, how many dollars of token
    # do you also print? Stated this way it is price-independent, which "tokens
    # per user" is not - the same per-user rate means nothing at one valuation
    # and everything at another.
    emission_multiple_of_buyback: float = 0.0   # 0 = pure buyback
    token_total_supply: float = 1_000_000_000.0
    # Team and investor allocations vesting into the float. This is what actually
    # kills most tokens, and it is the pressure the buyback has to absorb.
    unlock_allocation_share: float = 0.0      # share of supply that vests
    unlock_months: float = 36.0
    unlock_sell_fraction: float = 0.80        # share of unlocked tokens sold
    # Rewards an earner keeps do not vanish, they become overhang. Holders take
    # profit at a rate that rises with how far price sits above where they got
    # in. Without this the model shows a token compounding upward forever, which
    # is not a finding, it is a missing seller.
    profit_taking_rate: float = 0.10          # share of held stock sold monthly
    profit_taking_elasticity: float = 0.60    # how hard a rising price pulls sellers

    # -- motivation levers (Engine B) ---------------------------------------
    # Perceived motivational value per dollar when the pool is paid out as an
    # activity-weighted weekly draw rather than flat micro-payments. Prize-linked
    # savings research consistently finds >1 here; the exact figure is unknown,
    # so the base case assumes NO benefit and it is tested as a scenario.
    prize_multiplier: float = 1.0

    label: str = "base"
    engine: str = "revenue_share"


# ---------------------------------------------------------------------------
# Shared behavioural components
# ---------------------------------------------------------------------------

def satisfaction(payout_per_user: float, target: float) -> float:
    """How well last month's payout met the user's expectation, in [0, 1].

    Concave, not linear: the first dollar changes behaviour far more than the
    fourth. sqrt is a defensible stand-in for the usual diminishing-returns
    shape and avoids pretending to a precision we do not have.
    """
    if target <= 0:
        return 1.0
    return min(1.0, math.sqrt(max(0.0, payout_per_user) / target))


def churn_rate(sat: float, p: Params) -> float:
    """Monthly churn as a function of how satisfying the reward is."""
    return p.churn_ceiling - (p.churn_ceiling - p.churn_floor) * sat


def cheat_inflation(sat: float, p: Params) -> float:
    """Fake activity claimed as a multiple of honest activity.

    Rises with the reward level: money on the table is what pays for a treadmill
    phone-shaker. This is why a pro-rata pool needs real attestation - every
    undetected fake step is taken directly out of honest users' pockets.
    """
    return p.cheat_base + p.cheat_reward_sensitivity * sat


def honest_share_of_pool(sat: float, p: Params) -> float:
    """Fraction of the pool that reaches honest users after undetected fraud."""
    leak = cheat_inflation(sat, p) * (1.0 - p.cheat_detection)
    return 1.0 / (1.0 + leak)


def stake_economics(mau: float, p: Params) -> tuple[float, float]:
    """Commitment-stake side pool. Returns (platform_rake_usd, bonus_per_winner_usd).

    Structurally safe: losers fund winners, so it is zero-sum by construction and
    cannot be inflated. It is NOT outside revenue - it is a transfer between
    users - so it is tracked separately and excluded from the invariant test.
    """
    if not p.stakes_enabled or mau <= 0:
        return 0.0, 0.0
    entrants = mau * p.stake_participation / p.stake_cycle_months
    losers = entrants * (1.0 - p.stake_success_rate)
    winners = entrants * p.stake_success_rate
    forfeits = losers * p.stake_amount_usd
    rake = forfeits * p.stake_rake
    bonus_per_winner = (forfeits - rake) / winners if winners > 0 else 0.0
    return rake, bonus_per_winner


def outside_revenue(mau: float, month: int, p: Params) -> dict:
    """Revenue originating outside the user base, split consumer vs payer.

    Both are outside revenue, so both are safe to pay from. They are tracked
    apart because payer money carries a different contractual payout share.
    """
    if mau <= 0:
        return {"sub": 0.0, "ad": 0.0, "offer": 0.0, "commerce": 0.0,
                "payer": 0.0, "consumer": 0.0, "total": 0.0}
    conv = p.sub_conversion * (p.sub_conversion_decay ** month)
    sub = mau * conv * p.sub_price_usd * (1.0 - p.app_store_cut)
    scale = (max(mau, 1.0) / p.ad_arpu_scale_ref) ** p.ad_arpu_scale_exponent
    ad = mau * p.ad_arpu_usd * scale
    offer = mau * p.offer_arpu_usd
    commerce = mau * p.commerce_attach_rate * p.commerce_aov_usd * p.commerce_take_rate
    payer = mau * p.covered_share * p.payer_pepm_usd
    consumer = sub + ad + offer + commerce
    return {"sub": sub, "ad": ad, "offer": offer, "commerce": commerce,
            "payer": payer, "consumer": consumer, "total": consumer + payer}


def effective_face_multiple(p: Params) -> float:
    """Face value delivered per dollar of real payout cost."""
    return 1.0 + p.payout_in_kind_share * (p.in_kind_face_multiple - 1.0)


def new_users(mau: float, month: int, sat: float, p: Params) -> float:
    """Signups this month: decaying paid acquisition plus reward-sensitive referral."""
    paid = p.paid_signups_m1 * (p.paid_signup_decay ** month)
    ref_mult = 1.0 - p.referral_reward_sensitivity * (1.0 - sat)
    referral = mau * p.referral_k * max(0.0, ref_mult)
    return paid + referral


# ---------------------------------------------------------------------------
# Engine B: revenue share (the proposed design)
# ---------------------------------------------------------------------------

def simulate_revenue_share(p: Params) -> list[dict]:
    rows: list[dict] = []
    mau = p.starting_users
    treasury = p.starting_treasury_usd
    prev_payout_per_user = p.target_payout_usd  # month 1 users arrive on a promise

    for month in range(p.months):
        sat = satisfaction(prev_payout_per_user, p.target_payout_usd)

        joiners = new_users(mau, month, sat, p)
        leavers = mau * churn_rate(sat, p)
        mau = max(0.0, mau + joiners - leavers)

        rev = outside_revenue(mau, month, p)
        rake, stake_bonus = stake_economics(mau, p)
        revenue = rev["total"]

        # THE INVARIANT. The pool is a share of money that already arrived from
        # outside. It is not a promise, not an emission, and cannot be overdrawn.
        # Consumer and payer money carry different shares; both are real.
        pool = p.payout_share * rev["consumer"] + p.payer_payout_share * rev["payer"]

        honest = honest_share_of_pool(sat, p)
        pool_to_honest = pool * honest
        pool_lost_to_fraud = pool - pool_to_honest

        # LEVER 3. The pool is split among qualifying earners, not all actives.
        earners = max(1e-9, mau * p.earner_share)
        per_earner = (pool_to_honest / earners) if mau > 0 else 0.0
        per_earner = min(per_earner, p.payout_share_cap_usd)
        paid_out = per_earner * earners + pool_lost_to_fraud

        # LEVER 4. What it costs you is per_earner; what the user sees is face.
        face = effective_face_multiple(p)
        per_earner_face = per_earner * face
        per_user = per_earner * p.earner_share      # cost spread over all actives

        variable_costs = mau * p.variable_cost_per_user_usd
        acquisition_costs = (p.paid_signups_m1 * (p.paid_signup_decay ** month)) * p.cac_usd
        costs = variable_costs + acquisition_costs + p.fixed_cost_monthly_usd

        net = revenue + rake - paid_out - costs
        treasury += net

        rows.append({
            "month": month + 1,
            "mau": mau,
            "joiners": joiners,
            "leavers": leavers,
            "churn_rate": churn_rate(sat, p),
            "satisfaction": sat,
            "revenue_usd": revenue,
            "revenue_per_user_usd": revenue / mau if mau > 0 else 0.0,
            "consumer_revenue_usd": rev["consumer"],
            "payer_revenue_usd": rev["payer"],
            "pool_usd": pool,
            "paid_out_usd": paid_out,
            "payout_per_user_usd": per_user,
            "earners": earners,
            "payout_per_earner_usd": per_earner,
            "payout_per_earner_face_usd": per_earner_face,
            # What a qualifying, challenge-winning user actually sees per month.
            "earner_upside_face_usd": per_earner_face + stake_bonus,
            "stake_bonus_per_winner_usd": stake_bonus,
            "total_user_upside_usd": per_user + stake_bonus * p.stake_participation,
            "cheat_inflation": cheat_inflation(sat, p),
            "fraud_leak_usd": pool_lost_to_fraud,
            "costs_usd": costs,
            "net_usd": net,
            "treasury_usd": treasury,
            "token_price_usd": float("nan"),
            "entry_cost_usd": 0.0,
            "invariant_ok": paid_out <= revenue + 1e-6,
        })

        # Real dollars paid are unchanged; only the motivational weight differs.
        # The stake bonus lands on winners only, so it is weighted by how many
        # users are actually in a challenge.
        # Expected value to a user who has not yet qualified, in face terms,
        # lifted by the motivation multiplier for concentrating the money.
        prev_payout_per_user = (
            per_earner_face * p.earner_share * p.prize_multiplier
            + stake_bonus * p.stake_participation * p.stake_success_rate
        )

    return rows


# ---------------------------------------------------------------------------
# Engine A: token minting (the STEPN shape, for contrast)
# ---------------------------------------------------------------------------

def simulate_token_mint(p: Params) -> list[dict]:
    rows: list[dict] = []
    mau = p.starting_users
    treasury = p.starting_treasury_usd
    price = p.token_price_usd
    prev_payout_per_user = p.tokens_per_user_month * price

    for month in range(p.months):
        sat = satisfaction(prev_payout_per_user, p.target_payout_usd)

        joiners = new_users(mau, month, sat, p)
        leavers = mau * churn_rate(sat, p)
        mau = max(0.0, mau + joiners - leavers)

        # Emission is fixed in NOMINAL token terms. This is the whole problem:
        # the protocol has promised a quantity, not a value, so it keeps printing
        # at the same rate no matter what the token is worth.
        cheat_mult = 1.0 + cheat_inflation(sat, p) * (1.0 - p.cheat_detection)
        tokens_minted = mau * p.tokens_per_user_month * cheat_mult
        tokens_burned = tokens_minted * p.token_sink_fraction
        tokens_sold = (tokens_minted - tokens_burned) * p.token_sell_fraction

        # Buy pressure is entry spend from NEW users. That is the tell: the only
        # real money bidding the token is the next cohort's buy-in. And because
        # the entry NFT is itself priced in token terms, a falling token shrinks
        # what each new user contributes - the feedback loop that turns a decline
        # into a collapse.
        price_ratio = price / p.token_price_usd if p.token_price_usd > 0 else 1.0
        entry_cost = p.entry_cost_usd * (price_ratio ** p.entry_price_elasticity)
        buy_usd = joiners * entry_cost * p.entry_to_token_buy
        sell_usd = tokens_sold * price

        if sell_usd > 1e-9:
            ratio = max(buy_usd, 1e-9) / sell_usd
            price = max(p.token_price_floor_usd, price * (ratio ** p.token_price_damping))
        price = min(price, p.token_price_usd * 10)

        per_user = p.tokens_per_user_month * price
        paid_out = mau * per_user

        # Protocol revenue: marketplace fees on entry spend. Real, but small, and
        # it too is paid by new entrants rather than from outside the user base.
        revenue = joiners * entry_cost * 0.06
        rake, stake_bonus = stake_economics(mau, p)

        variable_costs = mau * p.variable_cost_per_user_usd
        acquisition_costs = (p.paid_signups_m1 * (p.paid_signup_decay ** month)) * p.cac_usd
        costs = variable_costs + acquisition_costs + p.fixed_cost_monthly_usd
        net = revenue + rake - costs
        treasury += net

        rows.append({
            "month": month + 1,
            "mau": mau,
            "joiners": joiners,
            "leavers": leavers,
            "churn_rate": churn_rate(sat, p),
            "satisfaction": sat,
            "revenue_usd": revenue,
            "revenue_per_user_usd": revenue / mau if mau > 0 else 0.0,
            "consumer_revenue_usd": revenue,
            "payer_revenue_usd": 0.0,
            "pool_usd": paid_out,
            "paid_out_usd": paid_out,
            "payout_per_user_usd": per_user,
            "earners": mau,
            "payout_per_earner_usd": per_user,
            "payout_per_earner_face_usd": per_user,
            "earner_upside_face_usd": per_user + stake_bonus,
            "stake_bonus_per_winner_usd": stake_bonus,
            "total_user_upside_usd": per_user,
            "cheat_inflation": cheat_inflation(sat, p),
            "fraud_leak_usd": paid_out * (1.0 - 1.0 / cheat_mult),
            "costs_usd": costs,
            "net_usd": net,
            "treasury_usd": treasury,
            "token_price_usd": price,
            "entry_cost_usd": entry_cost,
            # Payouts are minted, so they are almost never covered by real revenue.
            "invariant_ok": paid_out <= revenue + 1e-6,
        })

        prev_payout_per_user = per_user

    return rows


# ---------------------------------------------------------------------------
# Break-even: the number that actually decides whether this is a business
# ---------------------------------------------------------------------------

def break_even_mau(p: Params, month: int = 12) -> dict:
    """Smallest MAU at which revenue covers payouts and costs in a steady state.

    Solved by bisection on the monthly P&L at a fixed point in time, holding the
    payout policy fixed. Acquisition spend is excluded: this asks whether the
    RUNNING business washes its face, not whether growth is free.
    """
    def net_at(mau: float) -> float:
        rev = outside_revenue(mau, month, p)
        rake, _ = stake_economics(mau, p)
        payouts = p.payout_share * rev["consumer"] + p.payer_payout_share * rev["payer"]
        costs = mau * p.variable_cost_per_user_usd + p.fixed_cost_monthly_usd
        return rev["total"] + rake - payouts - costs

    lo, hi = 1.0, 1e9
    if net_at(hi) < 0:
        return {"break_even_mau": None, "reason": "no solution below 1e9 MAU"}
    for _ in range(200):
        mid = (lo + hi) / 2
        if net_at(mid) < 0:
            lo = mid
        else:
            hi = mid
    mau = hi
    rev = outside_revenue(mau, month, p)
    pool = p.payout_share * rev["consumer"] + p.payer_payout_share * rev["payer"]
    earners = max(1e-9, mau * p.earner_share)
    return {
        "break_even_mau": mau,
        "revenue_at_break_even_usd": rev["total"],
        "revenue_per_user_usd": rev["total"] / mau,
        "pool_at_break_even_usd": pool,
        "payout_per_user_usd": pool / mau,
        "payout_per_earner_face_usd": pool / earners * effective_face_multiple(p),
    }


def run(p: Params) -> list[dict]:
    return ENGINES[p.engine](p)


# ---------------------------------------------------------------------------
# Engine C: buyback-funded token (a token that can actually hold)
# ---------------------------------------------------------------------------

def simulate_token_buyback(p: Params) -> list[dict]:
    """Revenue -> open-market buyback -> distribute. Emission optional and off.

    The economics of the payout are identical to `simulate_revenue_share`: the
    pool is a share of outside revenue and is split among qualifying earners.
    The token changes only who is on the other side of the trade.

    The question this engine exists to answer is not whether the payout is
    solvent - it always is - but whether the TOKEN PRICE survives, which comes
    down to one ratio:

        coverage = buyback_usd / sell_pressure_usd

    Above 1 the token is bid by real revenue. Below 1 it bleeds, no matter how
    sound the payout mechanism is, because vesting supply is arriving faster
    than revenue can absorb it.
    """
    rows: list[dict] = []
    mau = p.starting_users
    treasury = p.starting_treasury_usd
    price = p.token_price_usd
    prev_payout_per_user = p.target_payout_usd
    held_tokens = 0.0

    for month in range(p.months):
        sat = satisfaction(prev_payout_per_user, p.target_payout_usd)

        joiners = new_users(mau, month, sat, p)
        leavers = mau * churn_rate(sat, p)
        mau = max(0.0, mau + joiners - leavers)

        rev = outside_revenue(mau, month, p)
        rake, stake_bonus = stake_economics(mau, p)
        revenue = rev["total"]

        # Identical to Engine B. The pool is money that already arrived.
        pool = p.payout_share * rev["consumer"] + p.payer_payout_share * rev["payer"]
        honest = honest_share_of_pool(sat, p)
        pool_to_honest = pool * honest
        pool_lost_to_fraud = pool - pool_to_honest

        earners = max(1e-9, mau * p.earner_share)
        per_earner = min(pool_to_honest / earners, p.payout_share_cap_usd)
        paid_out = per_earner * earners + pool_lost_to_fraud

        # --- the token layer ------------------------------------------------
        # Buy first, pay second. You cannot distribute what you did not buy.
        buyback_usd = paid_out
        tokens_bought = buyback_usd / max(price, p.token_price_floor_usd)

        # Minting on top is dilution with no offsetting bid: these tokens arrive
        # on the market without a dollar having been spent to buy them.
        tokens_emitted = tokens_bought * p.emission_multiple_of_buyback
        tokens_distributed = tokens_bought + tokens_emitted

        # Earners sell most of what they get; that is normal and fine.
        earner_sell = tokens_distributed * p.token_sell_fraction
        # Vesting supply arriving on the market whether or not anyone wants it.
        unlocking = (p.token_total_supply * p.unlock_allocation_share
                     / p.unlock_months) if month < p.unlock_months else 0.0
        unlock_sell = unlocking * p.unlock_sell_fraction

        # What earners keep becomes overhang, and overhang eventually sells.
        held_tokens += tokens_distributed - earner_sell
        appreciation = max(1.0, price / p.token_price_usd)
        profit_take = min(held_tokens,
                          held_tokens * p.profit_taking_rate
                          * (appreciation ** p.profit_taking_elasticity))
        held_tokens -= profit_take

        sell_usd = (earner_sell + unlock_sell + profit_take) * price
        coverage = buyback_usd / sell_usd if sell_usd > 1e-9 else float("inf")

        if sell_usd > 1e-9:
            ratio = max(buyback_usd, 1e-9) / sell_usd
            price = max(p.token_price_floor_usd,
                        price * (ratio ** p.token_price_damping))
        price = min(price, p.token_price_usd * 10)

        face = effective_face_multiple(p)
        per_earner_face = per_earner * face
        per_user = per_earner * p.earner_share

        variable_costs = mau * p.variable_cost_per_user_usd
        acquisition_costs = (p.paid_signups_m1 * (p.paid_signup_decay ** month)) * p.cac_usd
        costs = variable_costs + acquisition_costs + p.fixed_cost_monthly_usd
        net = revenue + rake - paid_out - costs
        treasury += net

        rows.append({
            "month": month + 1,
            "mau": mau, "joiners": joiners, "leavers": leavers,
            "churn_rate": churn_rate(sat, p), "satisfaction": sat,
            "revenue_usd": revenue,
            "revenue_per_user_usd": revenue / mau if mau > 0 else 0.0,
            "consumer_revenue_usd": rev["consumer"],
            "payer_revenue_usd": rev["payer"],
            "pool_usd": pool, "paid_out_usd": paid_out,
            "payout_per_user_usd": per_user,
            "earners": earners,
            "payout_per_earner_usd": per_earner,
            "payout_per_earner_face_usd": per_earner_face,
            "earner_upside_face_usd": per_earner_face + stake_bonus,
            "stake_bonus_per_winner_usd": stake_bonus,
            "total_user_upside_usd": per_user + stake_bonus * p.stake_participation,
            "cheat_inflation": cheat_inflation(sat, p),
            "fraud_leak_usd": pool_lost_to_fraud,
            "costs_usd": costs, "net_usd": net, "treasury_usd": treasury,
            "token_price_usd": price, "entry_cost_usd": 0.0,
            "buyback_usd": buyback_usd,
            "sell_pressure_usd": sell_usd,
            "buyback_coverage": coverage,
            "unlock_tokens": unlocking,
            "held_tokens": held_tokens,
            "unlock_sell_usd": unlock_sell * price,
            # Still holds: payouts are bought out of revenue, never minted.
            "invariant_ok": paid_out <= revenue + 1e-6,
        })

        prev_payout_per_user = (
            per_earner_face * p.earner_share * p.prize_multiplier
            + stake_bonus * p.stake_participation * p.stake_success_rate
        )

    return rows



ENGINES: dict[str, Callable[[Params], list[dict]]] = {
    "revenue_share": simulate_revenue_share,
    "token_mint": simulate_token_mint,
    "token_buyback": simulate_token_buyback,
}


def max_supportable_fdv(p: Params, monthly_buyback_usd: float) -> dict:
    """Largest launch valuation a given monthly buyback can actually defend.

    A buyback bids `B` dollars and hands the tokens to earners, who sell most of
    them straight back. Only the part they keep is a net bid, so the real support
    is `B * (1 - earner_sell_fraction)`. That has to cover everything arriving on
    the market that nobody bought: vesting team and investor supply, plus holders
    taking profit.

        support        = B * (1 - sell_fraction)
        unlock_per_mo  = FDV * allocation / vesting_months * unlock_sell_fraction

    Setting them equal gives the ceiling. Launch above it and the token bleeds
    from day one no matter how sound the payout mechanism is, because the
    valuation was never connected to the revenue in the first place.
    """
    support = monthly_buyback_usd * (1.0 - p.token_sell_fraction)
    if p.unlock_allocation_share <= 0:
        return {"max_fdv_usd": float("inf"), "support_usd": support,
                "note": "no vesting supply: only profit-taking to absorb"}
    drag_per_fdv = (p.unlock_allocation_share / p.unlock_months
                    * p.unlock_sell_fraction)
    return {
        "max_fdv_usd": support / drag_per_fdv,
        "support_usd": support,
        "unlock_drag_per_fdv": drag_per_fdv,
    }
