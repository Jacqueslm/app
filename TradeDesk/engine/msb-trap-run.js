'use strict';
/* The pattern, backtested: break of the higher low, reclaim of the lower
   high, ride toward the HH. */
const {run, prep} = require('./msb-trap');
const HOUR = 3600e3;

function stats(trades, months, riskPct) {
  const n = trades.length;
  if (!n) return {n: 0};
  let sum = 0, wins = 0, eq = 1, peak = 1, dd = 0, streak = 0, maxStreak = 0;
  for (const t of trades) {
    sum += t.R; if (t.R > 0) wins++;
    if (t.R < 0) { streak++; maxStreak = Math.max(maxStreak, streak); } else streak = 0;
    eq *= (1 + riskPct / 100 * t.R); peak = Math.max(peak, eq); dd = Math.max(dd, (peak - eq) / peak);
  }
  return {n, win: wins / n * 100, exp: sum / n, totR: sum, perWk: n / (months * 4.345),
          eq, ddPct: dd * 100, maxStreak};
}

const rows = [];
for (const [label, files, clip] of [
  ['1H, 43 months', {exec: 'MES-1h.csv'}, 0],
  ['1H + 15m stop ', {exec: 'MES-1h.csv', m15: 'MES-15m.csv'}, Date.parse('2025-09-30')],
]) {
  for (const pv of [3, 5, 7]) for (const tgtPct of [0.6, 0.7, 0.8, 1.0]) {
    const D = prep(files, {execTfMs: HOUR, pv});
    const tr = run(D, {maxPerDay: 2, useT1: true, tgtPct, stop15: !!files.m15, tick: 0.25});
    const use = tr.filter(t => t.t >= clip);
    const months = clip ? 10.4 : D.months;
    rows.push({label, pv, tgtPct, ...stats(use, months, 10), g: tr.gates});
  }
}

const H = ['run', 'swing', 'target', 'n', '/week', 'win%', 'expR', 'totR', 'lossRun', 'x@10%', 'DD%'];
const T = [H, ...rows.map(r => r.n
  ? [r.label, r.pv, (r.tgtPct * 100) + '%', r.n, r.perWk.toFixed(2), r.win.toFixed(0), r.exp.toFixed(3), r.totR.toFixed(1), r.maxStreak, r.eq < 0.01 ? '~0' : r.eq.toFixed(2), r.ddPct.toFixed(0)]
  : [r.label, r.pv, (r.tgtPct * 100) + '%', 0, '-', '-', '-', '-', '-', '-', '-'])].map(r => r.map(String));
const w = H.map((_, i) => Math.max(...T.map(r => r[i].length)));
console.log('\nTHE PATTERN — HL broken, LH reclaimed, ride to the HH\n');
console.log('funnel (first run per swing):');
const seen=new Set();
for(const r of rows){ const k=r.label+r.pv; if(seen.has(k))continue; seen.add(k);
  console.log('  '+r.label+' sw'+r.pv+':', JSON.stringify(r.g)); }
console.log('');
T.forEach((r, i) => { console.log(r.map((c, j) => j < 1 ? c.padEnd(w[j]) : c.padStart(w[j])).join('  ')); if (!i) console.log(w.map(x => '-'.repeat(x)).join('  ')); });
