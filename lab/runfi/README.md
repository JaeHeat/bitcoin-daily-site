# Runfi sustainability model

A 24-month simulation asking one question: **can you pay people to walk without
the payout mechanism eating itself?**

Short answer: yes, but only if you stop trying to solve it with tokenomics. The
mechanism is the easy part. Every failure mode that killed STEPN disappears once
payouts are a share of money that already arrived from outside the user base.
What remains is an ordinary, hard, unglamorous consumer business problem.

```
python3 scenarios.py     # runs 13 scenarios + 2 sensitivity sweeps
node parity.mjs          # checks the JS model matches the Python to <0.5%
python3 -m http.server   # then open /lab/runfi/ (ES modules need a server)
```

## The invariant

    payouts(t) <= outside_revenue(t)      for every period t

"Outside revenue" means money that did not come from another user buying in:
subscriptions, brand and sponsor deals, opt-in partner offers. Not NFT sales to
the next cohort.

Across 11 revenue-share scenarios and 264 scenario-months, this holds **every
single month**, including under hypergrowth, a revenue collapse, and a fraud
epidemic. Across the 2 token-minting scenarios it is breached **every month of
all 48**. That is not a tuning result. A pro-rata split of a pool that already
exists cannot be overdrawn; a fixed nominal emission has no such guarantee.

## What the model reproduces

The token engine is calibrated to the STEPN shape and lands on it:

| | month 1 | month 6 | month 12 | month 24 |
|---|---|---|---|---|
| Token price | $2.59 | $0.27 | $0.01 | **$0.0021 (-99.93%)** |
| Earned per user per month | $155.69 | $16.34 | $0.70 | $0.13 |
| Active users | 9,000 | 27,270 | 35,795 | 9,912 |

Users peak at 38,913 in month 10 and fall 74.5% from there. Over 24 months the
protocol mints **$7.0M of rewards against $0.37M of real revenue**.

## The single line that makes it a spiral

The collapse is not caused by the emission rate. It is caused by pricing the
entry NFT in the token the protocol emits. When the token falls, the sneaker
falls with it, so each new user brings less real buy pressure than the one
before, which pushes the token down further.

Set `entry_price_elasticity = 0` and nothing else changes:

| | fixed-price entry | token-priced entry |
|---|---|---|
| Token price at month 24 | $0.42 (-86%) | $0.0021 (-99.93%) |
| Active users at month 24 | 74,144 | 9,912 |
| Shape | soft decline | collapse |

Both still breach the invariant every month. The difference is whether users get
a gentle disappointment or a wipeout. **If you ever do launch a token, never
denominate the entry cost in it.**

## The uncomfortable part nobody says out loud

In the `token_no_feedback` run the protocol mints $40.1M of rewards against
$2.73M of revenue, and the operating company still finishes with **$2.15M in the
bank**. Marketplace fees are collected in real money up front while the losses
are pushed onto token holders. A move-to-earn company can do very well out of a
design that is terrible for its users. That is worth naming, because it explains
why so many of these launched.

## What the sustainable version actually pays

Base case at month 24: 15,860 active users, $0.99 revenue per user per month,
**$0.46 from the pool and $1.26 including commitment-stake winnings.**

That is coffee money, and the model says there is no configuration in which it
is not. Paying out 95% of revenue instead of 50% moves it from $0.46 to $0.88.
The ceiling is revenue per user, and consumer fitness revenue per user is about
a dollar a month. Any design promising meaningfully more than this is either
minting it or taking it from the next user through the door.

## The constraint is not the payout rule

Sweeping payout share from 5% to 95% does not break anything. More payout always
retains more users and always costs more money. The real wall is scale:

| Payout share | Break-even users | Pool per user per month |
|---|---|---|
| 25% | 65,175 | $0.27 |
| 50% | 103,839 | $0.55 |
| 80% | 380,006 | $0.92 |

**Roughly 100,000 monthly actives to wash its face at a 50% share.** The base
case runs out of money in month 18 having never reached it. This is a customer
acquisition and retention problem wearing a tokenomics costume, and it is why
the answer is not a cleverer emission curve.

## What actually moves the number

Two levers beat payout share, and neither costs an extra dollar of payout.

`designed` and `designed_control` spend identical marketing money and pay out
identical dollars. The only differences are that the app is worth opening with
the money switched off (churn ceiling 30% to 18%) and the same pool is paid as
an activity-weighted weekly draw rather than flat micro-payments:

| | control | designed |
|---|---|---|
| Users at month 24 | 84,387 | **187,719 (+122%)** |
| Monthly churn | 17.6% | 10.2% |
| First profitable month | never | month 15 |
| Treasury at month 24 | -$101k | +$443k |

The prize multiplier of 2.2 is the least defensible assumption in this model. It
is set to 1.0 in every other scenario, so nothing else depends on it.

## Fraud is paid by users, not by you

Under a pro-rata pool the treasury is never at risk from cheating, because the
pool is fixed before it is split. Every fake step dilutes honest users instead.
Dropping detection from 80% to 45% moves the 24-month leak from $13k to $50k,
all of it out of honest users' pockets.

This inverts the usual incentive. It means device attestation is not a cost
centre, it is the product: the thing you are actually selling is a credible
claim that the person next to you on the leaderboard really walked.

## Does it survive being wrong?

`target_payout_usd` (what a user needs to earn per month before the reward stops
changing their behaviour) is the softest input. Sweeping it from $1 to $20
changes the user count by 8x and the invariant breach count by **zero**. Being
wrong about motivation changes how big the business gets. It does not change
whether the payout mechanism is solvent.

## Files

| File | |
|---|---|
| `model.py` | both engines, the behavioural loop, the break-even solver |
| `scenarios.py` | scenario definitions, sweeps, CSV and JSON output |
| `model.js` | JS port of the same math, used by the interactive page |
| `parity.mjs` | asserts the JS and Python models agree |
| `index.html` | interactive model |
| `data/` | generated output, one CSV per scenario plus `summary.json` |

## Honest limitations

- Monthly time steps. A weekly pool has within-month dynamics this cannot see.
- Users are homogeneous. There are no power users, no geography, no seasonality,
  and real fitness apps have brutal January cohorts.
- The retention curve is a smooth function of last month's payout. Real churn is
  lumpy and driven by things no model here represents.
- Revenue per user is assumed, not observed. It is the number to attack first,
  because everything downstream scales with it.
- Nothing here models regulation, app store policy on paid rewards, or the tax
  treatment of payouts. All three are real and none are modelled.
