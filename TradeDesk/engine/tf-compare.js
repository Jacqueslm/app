'use strict';
/* Does this pattern work better on 4H than on 1H?
   Same engine, same rules, same settings — only the bar size changes. The
   swing strength stays at 3 for both, because a "swing" means the same shape
   whatever the bar; what changes is how much market each bar contains. */
const {run, prep} = require('./msb-trap');
const HOUR = 3600e3;

function stats(trades, months) {
  const n = trades.length;
  if (!n) return {n: 0};
  let sum = 0, wins = 0, streak = 0, maxStreak = 0;
  for (const t of trades) {
    sum += t.R; if (t.R > 0) wins++;
    if (t.R < 0) { streak++; maxStreak = Math.max(maxStreak, streak); } else streak = 0;
  }
  return {n, win: wins / n * 100, exp: sum / n, totR: sum,
          perMo: n / months, maxStreak};
}

const INSTS = [
  {k: 'MES',    tick: 0.25, from: 930, to: 1500, h1: 'MES-1h.csv',    h4: 'MES-4h.csv',    m15: 'MES-15m.csv'},
  {k: 'NAS100', tick: 0.25, from: 930, to: 1500, h1: 'NAS100-1h.csv', h4: 'NAS100-4h.csv', m15: 'NAS100-15m.csv'},
  {k: 'XAU',    tick: 0.10, from: 800, to: 1300, h1: 'XAU-1h.csv',    h4: 'XAU-4h.csv',    m15: 'XAU-15m.csv'},
];

const rows = [];
for (const I of INSTS) {
  for (const tf of [
    {name: '1H', file: I.h1, ms: HOUR},
    {name: '4H', file: I.h4, ms: 4 * HOUR},
  ]) {
    const D = prep({exec: tf.file, m15: I.m15}, {execTfMs: tf.ms, pv: 3});
    // the settings the live bot actually runs
    for (const minRoom of [1.5, 1.0, 0]) {
      const tr = run(D, {maxPerDay: 2, useT1: false, tgtPct: 0.8, stop15: true,
                         minRoom, tick: I.tick, sessFrom: I.from, sessTo: I.to});
      rows.push({k: I.k, tf: tf.name, minRoom, span: D.span,
                 ...stats(tr, D.months), g: tr.gates});
    }
  }
}

const H = ['market', 'bars', 'room', 'trades', '/month', 'win%', 'avg R', 'total R', 'worst run'];
const T = [H, ...rows.map(r => r.n
  ? [r.k, r.tf, r.minRoom ? r.minRoom + 'R' : 'none', r.n, r.perMo.toFixed(2),
     r.win.toFixed(0), r.exp.toFixed(3), r.totR.toFixed(1), r.maxStreak]
  : [r.k, r.tf, r.minRoom ? r.minRoom + 'R' : 'none', 0, '-', '-', '-', '-', '-'])]
  .map(r => r.map(String));
const w = H.map((_, i) => Math.max(...T.map(r => r[i].length)));
console.log('\n1H vs 4H — same pattern, same rules\n');
T.forEach((r, i) => {
  console.log(r.map((c, j) => j < 3 ? c.padEnd(w[j]) : c.padStart(w[j])).join('   '));
  if (!i) console.log(w.map(x => '-'.repeat(x)).join('---'));
});
console.log('\nspans:');
for (const r of rows.filter(r => r.minRoom === 1.5)) console.log(' ', r.k.padEnd(7), r.tf, r.span);
