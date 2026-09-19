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

## What the base case pays, and why that is the wrong ceiling

Base case at month 24: 15,860 active users, $0.99 revenue per user per month,
**$0.46 per player from the pool.** That is coffee money and nobody joins for it.

Paying out 95% of revenue instead of 50% moves it to $0.88, which is still
coffee money. That is the important result: **the payout rule is the weakest
lever available**, because it is bounded by one. What a player earns is:

    payout_per_player = ARPU x payout_share / earner_share

Two of those three terms are unbounded. The next section works them.

(An earlier version of this file claimed no configuration escapes coffee money.
That was only true while revenue per user was assumed to be consumer
advertising. It is wrong once the payer channel is on the table, and the ladder
below is the correction.)

## Pushing payout per player up

Four levers, independent, so they stack. Each rung **adds to the one above it**.
Every rung holds the invariant in all 24 months.

| Rung | Revenue / user | Payout / earner | Break-even users |
|---|---|---|---|
| Base case | $0.99 | $0.46 | 103,839 |
| + commerce | $1.43 | $0.67 | 69,848 |
| + consumer monetisation | $2.65 | $1.22 | 35,145 |
| + concentration (30% earn) | $2.65 | $4.08 | 35,145 |
| + paid in kind | $2.66 | $5.00 | 35,145 |
| + payer pilot (25% @ $6) | $4.21 | $8.34 | 24,152 |
| + payer at scale (60% @ $8) | $7.55 | **$15.55** | 14,242 |

**$0.46 to $15.55 without minting a single token**, and break-even falls from
104k actives to 14k because revenue per user rose 7.6x.

**1. Sell something other than attention.** Consumer advertising ARPU in fitness
tops out near a dollar. Commerce does not; this audience already replaces shoes
every few hundred miles. Gear at a 10% take plus an earn-it-back subscription
hook takes revenue per user from $0.99 to $2.65.

**2. Stop paying everyone.** The cheapest lever here and it costs nothing. Pay
only players who clear a real activity bar. At a 30% qualification rate the same
pool pays 3.3x more per earner. The bar is the product: you are selling a
credible claim that the person on the leaderboard actually walked.

**3. Pay in something worth more than it costs.** Partner credit or gift cards
bought below face, or your own margin-bearing gear. At half the payout in kind
at a 1.45 face multiple, $4.08 of cost arrives as $5.00 of perceived value.
This is Sweatcoin's actual business model.

**4. Sell to whoever is actually paying for the outcome.** The unlock, worth more
than the other three combined. The player is not the main beneficiary of their
own exercise; employers and insurers are, because activity lowers claims. They
already buy this, priced per member per month in the mid single digits to low
tens of dollars. That is 5-10x consumer ARPU and it is not capped by attention.

## The two full designs

| | Revenue / user | Payout / earner | Users m24 | Treasury m24 | Profitable |
|---|---|---|---|---|---|
| Base case | $0.99 | $0.46 | 15,860 | -$291k | 0/24 |
| Runfi v2 | $7.76 | $15.92 | 488,187 | $17.13M | 23/24 |
| Insurer-native | $14.39 | $31.99 | 175,349 | $9.24M | 23/24 |

Zero invariant breaches in either. The money is real in both.

### What this costs you

The payer channel is a different company: 6 to 18 month sales cycles,
health-data compliance, and outcomes evidence a benefits team will sign off on.
You would be building a B2B health business with a consumer app attached, not a
crypto app. That is the real trade, and it is the honest reason most
move-to-earn projects reached for a token instead. **The token was the shortcut
around a hard enterprise sale**, and it is why they all ended the same way.

### What the stake game is not

Commitment stakes look like earnings and are not. At a $20 stake and a 72%
success rate the winner takes about $6.61, but expected value to an entrant is
**-$0.84**, and you would need a 75.2% success rate just to break even against
the rake. It is a motivation device funded by users who fail. It is excluded
from every payout figure above.

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
