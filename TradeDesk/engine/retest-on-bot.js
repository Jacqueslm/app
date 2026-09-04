'use strict';
/* His pullback entry, applied to the bot's own 1H pattern. The bot enters at
   the close back through the lower high; his way waits for price to COME BACK
   to that level after the reclaim and buys the retest. Same stop (behind the
   shakeout), same target, same everything else — live settings. */
const {run, prep} = require('./msb-trap');
const HOUR = 3600e3;

function stats(tr, months) {
  const n = tr.length; if (!n) return {n: 0};
  let sum = 0, w = 0, s = 0, worst = 0;
  for (const t of tr) { sum += t.R; if (t.R > 0) w++; if (t.R < 0) { s++; worst = Math.max(worst, s); } else s = 0; }
  return {n, win: w / n * 100, exp: sum / n, tot: sum, perMo: n / months, worst};
}
const INSTS = [
  {k: 'MES',    tick: 0.25, from: 930, to: 1500, h1: 'MES-1h.csv',    m15: 'MES-15m.csv'},
  {k: 'NAS100', tick: 0.25, from: 930, to: 1500, h1: 'NAS100-1h.csv', m15: 'NAS100-15m.csv'},
  {k: 'XAU',    tick: 0.10, from: 800, to: 1300, h1: 'XAU-1h.csv',    m15: 'XAU-15m.csv'},
];
const rows = [];
for (const I of INSTS) {
  const D = prep({exec: I.h1, m15: I.m15}, {execTfMs: HOUR, pv: 3});
  const months = D.months;
  for (const v of [
    {name: 'bot today (reclaim close)', o: {}},
    {name: 'his way (retest the level)', o: {entryRetest: true}},
    {name: 'retest, no room filter',     o: {entryRetest: true, minRoom: 0}},
  ]) {
    const tr = run(D, {maxPerDay: 2, useT1: false, tgtPct: 0.8, stop15: true,
                       minRoom: 1.5, tick: I.tick, sessFrom: I.from, sessTo: I.to, ...v.o});
    rows.push({k: I.k, v: v.name, ...stats(tr, months)});
  }
}
const H = ['market', 'entry', 'trades', '/month', 'win%', 'avg R', 'total R', 'worst run'];
const T = [H, ...rows.map(r => r.n
  ? [r.k, r.v, r.n, r.perMo.toFixed(2), r.win.toFixed(0), r.exp.toFixed(3), r.tot.toFixed(1), r.worst]
  : [r.k, r.v, 0, '-', '-', '-', '-', '-']).map(r => r.map(String))];
const w = H.map((_, i) => Math.max(...T.map(r => r[i].length)));
console.log('\nThe bot pattern, entered his way — retest of the level after the reclaim\n');
T.forEach((r, i) => { console.log(r.map((x, j) => j < 2 ? x.padEnd(w[j]) : x.padStart(w[j])).join('   ')); if (!i) console.log(w.map(x => '-'.repeat(x)).join('---')); });
