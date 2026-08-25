'use strict';
const {run, prep} = require('./msb-trap');
const MIN = 60e3, HOUR = 3600e3;

function stats(trades, months, riskPct) {
  const n = trades.length;
  if (!n) return {n: 0};
  let sum = 0, wins = 0, eq = 1, peak = 1, dd = 0, streak = 0, maxStreak = 0;
  const by = {};
  for (const t of trades) {
    sum += t.R; if (t.R > 0) wins++;
    if (t.R < 0) { streak++; maxStreak = Math.max(maxStreak, streak); } else streak = 0;
    eq *= (1 + riskPct / 100 * t.R); peak = Math.max(peak, eq); dd = Math.max(dd, (peak - eq) / peak);
    by[t.how] = (by[t.how] || 0) + 1;
  }
  return {n, win: wins / n * 100, exp: sum / n, totR: sum, perMo: n / months,
          eq, ddPct: dd * 100, maxStreak, by};
}

const CONFIGS = [
  {name: '15m trigger', files: {h1: 'MES-1h.csv', exec: 'MES-15m.csv'}, execTfMs: 15 * MIN},
  {name: '1H trigger ', files: {h1: 'MES-1h.csv', exec: 'MES-1h.csv'},  execTfMs: HOUR},
];

console.log('\nTHE TRAP — MES, the setup from the drawing\n');
const rows = [];
for (const cfg of CONFIGS) {
  for (const pv of [3, 5]) for (const pvH of [3, 5, 7]) for (const flat of [true, false]) {
    const D = prep(cfg.files, {execTfMs: cfg.execTfMs, pv, pvHtf: pvH});
    const tr = run(D, {maxPerDay: 1, useT1: true, need4hFlat: flat, tick: 0.25});
    const s = stats(tr, D.months, 10);
    rows.push({cfg: cfg.name, span: D.span, mo: D.months, pv, pvH, flat, ...s});
  }
}
const H = ['trigger', 'trigSw', '1H-sw', '4Hflat', 'n', '/mo', 'win%', 'expR', 'totR', 'lossRun', 'x@10%', 'DD%'];
const T = [H, ...rows.map(r => r.n
  ? [r.cfg, r.pv, r.pvH, r.flat ? 'y' : 'n', r.n, r.perMo.toFixed(2), r.win.toFixed(0), r.exp.toFixed(3), r.totR.toFixed(1), r.maxStreak, r.eq < 0.01 ? '~0' : r.eq.toFixed(2), r.ddPct.toFixed(0)]
  : [r.cfg, r.pv, r.pvH, r.flat ? 'y' : 'n', 0, '-', '-', '-', '-', '-', '-', '-'])].map(r => r.map(String));
const w = H.map((_, i) => Math.max(...T.map(r => r[i].length)));
T.forEach((r, i) => { console.log(r.map((c, j) => j < 1 ? c.padEnd(w[j]) : c.padStart(w[j])).join('  ')); if (!i) console.log(w.map(x => '-'.repeat(x)).join('  ')); });
console.log('\nspans:', [...new Set(rows.map(r => r.cfg + '  ' + r.span + '  (' + r.mo.toFixed(1) + ' mo)'))].join('\n       '));
