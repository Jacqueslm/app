'use strict';
/* Geometry sweep — the entry rule is frozen, only the exit geometry moves.

   The entry is always the same: price reaches a 1H swing level, fails, and
   closes back through it. What varies is where the stop goes, where the target
   goes, and whether half comes off at 1R. The question is narrow and worth
   answering on its own: is ANY 2-4 trade week positive, or is the frequency
   itself the problem? */
const path = require('path');
const {load} = require('./csv');
const {levelsFrom, runRejection, stats, prepExec} = require('./msb-setups');
const RISK = +(process.argv[process.argv.indexOf('--risk') + 1]) || 10;
const HOUR = 3600e3, MIN = 60e3;

const h1 = load(path.join(__dirname, '..', 'data', 'MES-1h.csv'));
const levels = levelsFrom(h1, 3, HOUR);
const rows = [];

for(const [file, tfMs, tf] of [['MES-15m.csv', 15 * MIN, '15m'], ['MES-5m.csv', 5 * MIN, '5m']]){
  const E = prepExec(file, tfMs);
  for(const stopMode of ['bar', 'mid', 'level'])
    for(const t of [{k: 'swing', tgtMode: 'swing'}, {k: 'swing≥1.5R', tgtMode: 'swing', minR: 1.5},
                    {k: 'swing≥2R', tgtMode: 'swing', minR: 2.0},
                    {k: '1.5R', tgtMode: 'rr', rrMult: 1.5}, {k: '2R', tgtMode: 'rr', rrMult: 2},
                    {k: '3R', tgtMode: 'rr', rrMult: 3}])
      for(const m of [{k: 'half@1R+BE', useT1: true}, {k: 'all to tgt', useT1: false}]){
        const r = runRejection(E.c, E.et, levels, {
          pv: 3, tfMs, maxPerDay: 2, minR: t.minR ?? 1.0,
          stopMode, tgtMode: t.tgtMode, rrMult: t.rrMult, useT1: m.useT1
        });
        const s = stats(r.trades, E.months, RISK);
        if(s.n) rows.push([tf, stopMode, t.k, m.k, s.n, s.perWk.toFixed(1),
                           (r.g.roomSum / r.g.taken).toFixed(1), s.win.toFixed(0),
                           s.exp.toFixed(3), s.totR.toFixed(1), s.maxStreak,
                           s.eq < 0.01 ? '~0' : s.eq.toFixed(2), s.ddPct.toFixed(0)]);
      }
}

rows.sort((a, b) => +b[8] - +a[8]);
const H = ['tf', 'stop', 'target', 'manage', 'n', '/week', 'avgR', 'win%', 'expR', 'totR', 'lossRun', `x@${RISK}%`, 'DD%'];
const T = [H, ...rows].map(r => r.map(String));
const w = H.map((_, i) => Math.max(...T.map(r => r[i].length)));
console.log('\nSetup B geometry — entry rule frozen, exits swept. Sorted by expectancy.\n');
T.forEach((r, i) => {
  console.log(r.map((c, j) => j < 4 ? c.padEnd(w[j]) : c.padStart(w[j])).join('  '));
  if(!i) console.log(w.map(x => '-'.repeat(x)).join('  '));
});
console.log('');
