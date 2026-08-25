'use strict';
/* The trap, as corrected: no Daily. 4H is the range, the 1H is the trade,
   the 15m only tightens the stop. Trigger chart = 1H. */
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
for (const [label, files] of [
  ['43mo, sweep stop', {h1: 'MES-1h.csv', exec: 'MES-1h.csv'}],
  ['10mo, 15m stop  ', {h1: 'MES-1h.csv', exec: 'MES-1h.csv', m15: 'MES-15m.csv'}],
]) {
  // the 15m-stop run only spans the 15m data
  for (const mode of ['trap', 'sweep']) for (const pv of [2, 3]) for (const pvH of [3, 5]) for (const gate4h of ['none']) {
    const D = prep(files, {execTfMs: HOUR, pv, pvHtf: pvH});
    if (files.m15) {   // clip to the 15m window so the comparison is honest
      const from = require('./csv').load(require('path').join(__dirname, '..', 'data', files.m15))[0].t;
      const keep = D.exec.map((c, i) => c.t >= from);
      // simplest: rerun prep is heavy; instead run full and filter trades by time
    }
    const tr = run(D, {maxPerDay: 2, useT1: true, gate4h, mode, stop15: !!files.m15, tick: 0.25});
    const cut = files.m15 ? Date.parse('2025-09-30') : 0;
    const use = tr.filter(t => t.t >= cut);
    const months = files.m15 ? 10.4 : D.months;
    const s = stats(use, months, 10);
    rows.push({label, pv, pvH, gate4h: mode, ...s});
  }
}

const H = ['run', 'sw1H', 'sw4H', 'mode', 'n', '/week', 'win%', 'expR', 'totR', 'lossRun', 'x@10%', 'DD%'];
const T = [H, ...rows.map(r => r.n
  ? [r.label, r.pv, r.pvH, r.gate4h, r.n, r.perWk.toFixed(2), r.win.toFixed(0), r.exp.toFixed(3), r.totR.toFixed(1), r.maxStreak, r.eq < 0.01 ? '~0' : r.eq.toFixed(2), r.ddPct.toFixed(0)]
  : [r.label, r.pv, r.pvH, r.gate4h, 0, '-', '-', '-', '-', '-', '-', '-'])].map(r => r.map(String));
const w = H.map((_, i) => Math.max(...T.map(r => r[i].length)));
console.log('\nTHE TRAP v2 — no Daily · 4H range · trade the 1H · 15m tightens the stop\n');
T.forEach((r, i) => { console.log(r.map((c, j) => j < 4 ? c.padEnd(w[j]) : c.padStart(w[j])).join('  ')); if (!i) console.log(w.map(x => '-'.repeat(x)).join('  ')); });
