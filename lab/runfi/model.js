/*
 * Runfi sustainability model - JavaScript port of model.py.
 *
 * This is a SECOND IMPLEMENTATION of the same math, so it can drift. parity.mjs
 * runs both against the same parameters and fails if any field diverges by more
 * than 0.5%. Run it after touching either file.
 *
 * Python is the reference. If the two disagree, model.py is right.
 */

export const DEFAULTS = {
  months: 24,

  startingUsers: 5000,
  paidSignupsM1: 4000,
  paidSignupDecay: 0.97,
  referralK: 0.06,
  referralRewardSensitivity: 1.0,

  churnFloor: 0.06,
  churnCeiling: 0.30,
  targetPayoutUsd: 4.0,

  activityPerUser: 300,

  subPriceUsd: 4.99,
  subConversion: 0.045,
  appStoreCut: 0.15,
  adArpuUsd: 0.55,
  offerArpuUsd: 0.35,
  adArpuScaleExponent: 0.08,
  adArpuScaleRef: 50000,
  subConversionDecay: 0.985,

  payoutShare: 0.50,
  payoutShareCapUsd: 25.0,
  activityCurveExponent: 0.70,

  variableCostPerUserUsd: 0.18,
  fixedCostMonthlyUsd: 45000,
  cacUsd: 1.80,
  startingTreasuryUsd: 750000,

  cheatBase: 0.04,
  cheatRewardSensitivity: 0.55,
  cheatDetection: 0.80,

  stakesEnabled: true,
  stakeParticipation: 0.12,
  stakeAmountUsd: 20.0,
  stakeSuccessRate: 0.72,
  stakeRake: 0.15,
  stakeCycleMonths: 1.5,

  tokenPriceUsd: 3.0,
  entryCostUsd: 350,
  entryToTokenBuy: 0.55,
  tokensPerUserMonth: 60,
  tokenSellFraction: 0.85,
  tokenSinkFraction: 0.30,
  tokenPriceDamping: 0.55,
  tokenPriceFloorUsd: 0.0005,
  entryPriceElasticity: 0.85,

  prizeMultiplier: 1.0,

  engine: 'revenue_share',
};

export const satisfaction = (payout, target) =>
  target <= 0 ? 1 : Math.min(1, Math.sqrt(Math.max(0, payout) / target));

export const churnRate = (sat, p) =>
  p.churnCeiling - (p.churnCeiling - p.churnFloor) * sat;

export const cheatInflation = (sat, p) =>
  p.cheatBase + p.cheatRewardSensitivity * sat;

export const honestShareOfPool = (sat, p) =>
  1 / (1 + cheatInflation(sat, p) * (1 - p.cheatDetection));

export function stakeEconomics(mau, p) {
  if (!p.stakesEnabled || mau <= 0) return { rake: 0, bonusPerWinner: 0 };
  const entrants = (mau * p.stakeParticipation) / p.stakeCycleMonths;
  const losers = entrants * (1 - p.stakeSuccessRate);
  const winners = entrants * p.stakeSuccessRate;
  const forfeits = losers * p.stakeAmountUsd;
  const rake = forfeits * p.stakeRake;
  return { rake, bonusPerWinner: winners > 0 ? (forfeits - rake) / winners : 0 };
}

export function outsideRevenue(mau, month, p) {
  if (mau <= 0) return { sub: 0, ad: 0, offer: 0 };
  const conv = p.subConversion * Math.pow(p.subConversionDecay, month);
  const sub = mau * conv * p.subPriceUsd * (1 - p.appStoreCut);
  const scale = Math.pow(Math.max(mau, 1) / p.adArpuScaleRef, p.adArpuScaleExponent);
  return { sub, ad: mau * p.adArpuUsd * scale, offer: mau * p.offerArpuUsd };
}

export function newUsers(mau, month, sat, p) {
  const paid = p.paidSignupsM1 * Math.pow(p.paidSignupDecay, month);
  const refMult = 1 - p.referralRewardSensitivity * (1 - sat);
  return paid + mau * p.referralK * Math.max(0, refMult);
}

export function simulateRevenueShare(p) {
  const rows = [];
  let mau = p.startingUsers;
  let treasury = p.startingTreasuryUsd;
  let prevPayout = p.targetPayoutUsd;

  for (let month = 0; month < p.months; month++) {
    const sat = satisfaction(prevPayout, p.targetPayoutUsd);
    const joiners = newUsers(mau, month, sat, p);
    const leavers = mau * churnRate(sat, p);
    mau = Math.max(0, mau + joiners - leavers);

    const { sub, ad, offer } = outsideRevenue(mau, month, p);
    const { rake, bonusPerWinner } = stakeEconomics(mau, p);
    const revenue = sub + ad + offer;

    // The invariant: a share of money that already arrived. Cannot be overdrawn.
    const pool = p.payoutShare * revenue;
    const honest = honestShareOfPool(sat, p);
    const poolToHonest = pool * honest;
    const poolLost = pool - poolToHonest;

    let perUser = mau > 0 ? poolToHonest / mau : 0;
    perUser = Math.min(perUser, p.payoutShareCapUsd);
    const paidOut = perUser * mau + poolLost;

    const acquisition = p.paidSignupsM1 * Math.pow(p.paidSignupDecay, month) * p.cacUsd;
    const costs = mau * p.variableCostPerUserUsd + acquisition + p.fixedCostMonthlyUsd;
    const net = revenue + rake - paidOut - costs;
    treasury += net;

    rows.push({
      month: month + 1, mau, joiners, leavers,
      churn_rate: churnRate(sat, p), satisfaction: sat,
      revenue_usd: revenue,
      revenue_per_user_usd: mau > 0 ? revenue / mau : 0,
      pool_usd: pool, paid_out_usd: paidOut, payout_per_user_usd: perUser,
      stake_bonus_per_winner_usd: bonusPerWinner,
      total_user_upside_usd: perUser + bonusPerWinner * p.stakeParticipation,
      cheat_inflation: cheatInflation(sat, p),
      fraud_leak_usd: poolLost, costs_usd: costs, net_usd: net,
      treasury_usd: treasury, token_price_usd: NaN, entry_cost_usd: 0,
      invariant_ok: paidOut <= revenue + 1e-6,
    });

    prevPayout = perUser * p.prizeMultiplier
      + bonusPerWinner * p.stakeParticipation * p.stakeSuccessRate;
  }
  return rows;
}

export function simulateTokenMint(p) {
  const rows = [];
  let mau = p.startingUsers;
  let treasury = p.startingTreasuryUsd;
  let price = p.tokenPriceUsd;
  let prevPayout = p.tokensPerUserMonth * price;

  for (let month = 0; month < p.months; month++) {
    const sat = satisfaction(prevPayout, p.targetPayoutUsd);
    const joiners = newUsers(mau, month, sat, p);
    const leavers = mau * churnRate(sat, p);
    mau = Math.max(0, mau + joiners - leavers);

    const cheatMult = 1 + cheatInflation(sat, p) * (1 - p.cheatDetection);
    const minted = mau * p.tokensPerUserMonth * cheatMult;
    const burned = minted * p.tokenSinkFraction;
    const sold = (minted - burned) * p.tokenSellFraction;

    // Entry NFT priced in token terms: the feedback loop that makes it a spiral.
    const priceRatio = p.tokenPriceUsd > 0 ? price / p.tokenPriceUsd : 1;
    const entryCost = p.entryCostUsd * Math.pow(priceRatio, p.entryPriceElasticity);
    const buyUsd = joiners * entryCost * p.entryToTokenBuy;
    const sellUsd = sold * price;

    if (sellUsd > 1e-9) {
      const ratio = Math.max(buyUsd, 1e-9) / sellUsd;
      price = Math.max(p.tokenPriceFloorUsd, price * Math.pow(ratio, p.tokenPriceDamping));
    }
    price = Math.min(price, p.tokenPriceUsd * 10);

    const perUser = p.tokensPerUserMonth * price;
    const paidOut = mau * perUser;
    const revenue = joiners * entryCost * 0.06;
    const { rake, bonusPerWinner } = stakeEconomics(mau, p);

    const acquisition = p.paidSignupsM1 * Math.pow(p.paidSignupDecay, month) * p.cacUsd;
    const costs = mau * p.variableCostPerUserUsd + acquisition + p.fixedCostMonthlyUsd;
    const net = revenue + rake - costs;
    treasury += net;

    rows.push({
      month: month + 1, mau, joiners, leavers,
      churn_rate: churnRate(sat, p), satisfaction: sat,
      revenue_usd: revenue,
      revenue_per_user_usd: mau > 0 ? revenue / mau : 0,
      pool_usd: paidOut, paid_out_usd: paidOut, payout_per_user_usd: perUser,
      stake_bonus_per_winner_usd: bonusPerWinner,
      total_user_upside_usd: perUser,
      cheat_inflation: cheatInflation(sat, p),
      fraud_leak_usd: paidOut * (1 - 1 / cheatMult),
      costs_usd: costs, net_usd: net, treasury_usd: treasury,
      token_price_usd: price, entry_cost_usd: entryCost,
      invariant_ok: paidOut <= revenue + 1e-6,
    });

    prevPayout = perUser;
  }
  return rows;
}

export function run(params = {}) {
  const p = { ...DEFAULTS, ...params };
  return p.engine === 'token_mint' ? simulateTokenMint(p) : simulateRevenueShare(p);
}

/** Smallest MAU at which the running business covers payouts and costs. */
export function breakEvenMau(params = {}, month = 12) {
  const p = { ...DEFAULTS, ...params };
  const netAt = (mau) => {
    const { sub, ad, offer } = outsideRevenue(mau, month, p);
    const revenue = sub + ad + offer;
    const { rake } = stakeEconomics(mau, p);
    return revenue + rake - p.payoutShare * revenue
      - (mau * p.variableCostPerUserUsd + p.fixedCostMonthlyUsd);
  };
  let lo = 1, hi = 1e9;
  if (netAt(hi) < 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (netAt(mid) < 0) lo = mid; else hi = mid;
  }
  return hi;
}
