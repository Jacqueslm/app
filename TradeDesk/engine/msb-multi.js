'use strict';
/* The pattern across three markets. MES is real futures (43 months);
   NAS100 and XAU are Oanda index/spot minute data 2005-2020 - not futures
   ticks, but 15+ years of pure out-of-sample structure. */
const {run, prep} = require('./msb-trap');
const HOUR = 3600e3;

function stats(trades, months, riskPct) {
  const n = trades.length;
  if (!n) return {n: 0};
  let sum = 0, wins = 0, eq = 1, peak = 1, dd = 0, streak = 0, maxStreak = 0;
  for (const t of trades) {
    sum += t.R; if (t.R > 0) wins++;
    if (t.R < 0) { streak++; maxStreak = Math.max(maxStreak, streak); } else streak = 0;
    eq *= (1 + riskPct / 100 * t.R); peak = Math.max(peak, eq); dd = Math.max(dd, (peak - eq) / pk(peak));
  }
  function pk(x){ return x; }
  return {n, win: wins / n * 100, exp: sum / n, totR: sum, perWk: n / (months * 4.345),
          eq, ddPct: dd * 100, maxStreak};
}

const INSTS = [
  {k: 'MES  (futures, 43mo)', files: {exec: 'MES-1h.csv', m15: 'MES-15m.csv'}, tick: 0.25, sessFrom: 930, sessTo: 1500},
  {k: 'NAS100 (16y)', files: {exec: 'NAS100-1h.csv', m15: 'NAS100-15m.csv'}, tick: 0.25, sessFrom: 930, sessTo: 1500},
  {k: 'XAU    (15y)', files: {exec: 'XAU-1h.csv', m15: 'XAU-15m.csv'}, tick: 0.10, sessFrom: 800, sessTo: 1300},
];

const rows = [];
for (const I of INSTS) {
  const D = prep(I.files, {execTfMs: HOUR, pv: 3});
  for (const minRoom of [0, 1.0]) for (const stop15 of [false, true]) for (const tgtPct of [0.8, 1.0]) {
    const tr = run(D, {maxPerDay: 2, useT1: true, tgtPct, stop15, minRoom, tick: I.tick,
                       sessFrom: I.sessFrom, sessTo: I.sessTo});
    rows.push({k: I.k, span: D.span, minRoom, stop15, tgtPct, ...stats(tr, D.months, 10), g: tr.gates});
  }
}

const H = ['instrument', 'room', 'stop', 'target', 'n', '/week', 'win%', 'expR', 'totR', 'lossRun', 'x@10%', 'DD%'];
const T = [H, ...rows.map(r => r.n
  ? [r.k, r.minRoom ? '>=1R' : 'none', r.stop15 ? '15m' : 'shakeout', (r.tgtPct * 100) + '%', r.n, r.perWk.toFixed(2), r.win.toFixed(0), r.exp.toFixed(3), r.totR.toFixed(1), r.maxStreak, r.eq < 0.01 ? '~0' : r.eq.toFixed(1), r.ddPct.toFixed(0)]
  : [r.k, r.minRoom ? '>=1R' : 'none', r.stop15 ? '15m' : 'shakeout', (r.tgtPct * 100) + '%', 0, '-', '-', '-', '-', '-', '-', '-'])].map(r => r.map(String));
const w = H.map((_, i) => Math.max(...T.map(r => r[i].length)));
console.log('\nTHE PATTERN — three markets\n');
T.forEach((r, i) => { console.log(r.map((c, j) => j < 4 ? c.padEnd(w[j]) : c.padStart(w[j])).join('  ')); if (!i) console.log(w.map(x => '-'.repeat(x)).join('  ')); });
console.log('\nspans:'); for (const r of rows.filter((r, i) => i % 8 === 0)) console.log(' ', r.k, r.span);
