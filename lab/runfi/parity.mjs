/*
 * Fails if model.js has drifted from model.py.
 * Compares every numeric field of every month for each generated scenario CSV.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { run, DEFAULTS } from './model.js';

const TOL = 0.005; // 0.5%

// Scenario overrides must mirror scenarios.py exactly.
const SCENARIOS = {
  base: {},
  stepn_token: { engine: 'token_mint' },
  hypergrowth: { paidSignupsM1: 25000, paidSignupDecay: 0.99, referralK: 0.14 },
  revenue_stall: { adArpuUsd: 0.18, offerArpuUsd: 0.10, subConversion: 0.020 },
  cheat_epidemic: { cheatDetection: 0.45, cheatRewardSensitivity: 1.10 },
  generous_80pct: { payoutShare: 0.80 },
  lean_25pct: { payoutShare: 0.25 },
  no_stakes: { stakesEnabled: false },
  token_no_feedback: { engine: 'token_mint', entryPriceElasticity: 0.0 },
  good_product: { churnCeiling: 0.18 },
  prize_linked: { prizeMultiplier: 2.2 },
  designed: { churnCeiling: 0.18, prizeMultiplier: 2.2, paidSignupsM1: 14000, paidSignupDecay: 0.985, referralK: 0.10 },
  designed_control: { paidSignupsM1: 14000, paidSignupDecay: 0.985, referralK: 0.10 },
  runfi_v2: {
    commerceAttachRate: 0.04, commerceAovUsd: 110, commerceTakeRate: 0.10,
    subConversion: 0.12, subPriceUsd: 7.99, adArpuUsd: 1.20, offerArpuUsd: 0.50,
    earnerShare: 0.30, payoutInKindShare: 0.50, inKindFaceMultiple: 1.45,
    coveredShare: 0.60, payerPepmUsd: 8.00,
    churnCeiling: 0.18, prizeMultiplier: 2.2,
    paidSignupsM1: 14000, paidSignupDecay: 0.985, referralK: 0.10,
  },
  insurer_native: {
    coveredShare: 0.95, payerPepmUsd: 14.00, payerPayoutShare: 0.70,
    earnerShare: 0.35, payoutInKindShare: 0.60, inKindFaceMultiple: 1.45,
    churnCeiling: 0.18, prizeMultiplier: 2.2,
    paidSignupsM1: 9000, paidSignupDecay: 0.99, referralK: 0.05, cacUsd: 6.00,
  },
};

const parseCsv = (text) => {
  const [head, ...lines] = text.trim().split('\n');
  const cols = head.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
};

let checked = 0, failures = [];
for (const [name, overrides] of Object.entries(SCENARIOS)) {
  let csv;
  try { csv = parseCsv(readFileSync(`./data/${name}.csv`, 'utf8')); }
  catch { failures.push(`${name}: missing data/${name}.csv - run scenarios.py first`); continue; }

  const js = run(overrides);
  if (js.length !== csv.length) { failures.push(`${name}: row count ${js.length} vs ${csv.length}`); continue; }

  for (let i = 0; i < js.length; i++) {
    for (const key of Object.keys(js[i])) {
      const a = js[i][key];
      if (typeof a !== 'number' || Number.isNaN(a)) continue;
      const b = parseFloat(csv[i][key]);
      if (Number.isNaN(b)) continue;
      checked++;
      const denom = Math.max(Math.abs(a), Math.abs(b), 1e-9);
      const rel = Math.abs(a - b) / denom;
      if (rel > TOL && Math.abs(a - b) > 1e-6) {
        failures.push(`${name} m${js[i].month} ${key}: js=${a} py=${b} (${(rel * 100).toFixed(2)}%)`);
      }
    }
  }
}

if (failures.length) {
  console.error(`PARITY FAILED (${failures.length} mismatches of ${checked} values)`);
  failures.slice(0, 20).forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log(`PARITY OK - ${checked} values across ${Object.keys(SCENARIOS).length} scenarios agree within ${TOL * 100}%`);
