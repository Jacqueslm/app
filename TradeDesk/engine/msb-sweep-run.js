'use strict';
/* Driver for msb-sweep.js — prints the calibration table.
   Usage: node engine/msb-sweep-run.js [--align] [--risk 10] */
const {run, prep} = require('./msb-sweep');

const argv = process.argv.slice(2);
const useAlign = argv.includes('--align');
const riskPct = +(argv[argv.indexOf('--risk') + 1]) || 10;

const PVS = [2, 3, 4, 5, 6, 7];
const HOLDS = [0, 1, 2];
const MODES = [
  {k: 'pullback', usePB: true,  useSeq: false},
  {k: 'retest',   usePB: false, useSeq: true},
  {k: 'both',     usePB: true,  useSeq: true}
];

const D = prep(PVS, useAlign);
console.log(`\nMES 1H execution · ${D.span} · ${D.months.toFixed(1)} months`);
console.log(`Timeframes: Daily + 4H bias, 1H trigger${useAlign ? ', 15m alignment ON' : ', 15m alignment OFF'}`);
console.log(`One trade/day · 09:30-15:00 ET · half at 1R then break-even · risk ${riskPct}%/trade\n`);

const rows = [];
for(const m of MODES) for(const pv of PVS) for(const holdBars of HOLDS){
  if(m.k === 'pullback' && holdBars !== HOLDS[0]) continue;   // holdBars is a retest-only knob
  const r = run(D, {pv, holdBars, usePB: m.usePB, useSeq: m.useSeq, useAlign, riskPct});
  rows.push({mode: m.k, pv, hold: m.k === 'pullback' ? '-' : holdBars, ...r});
}

const H = ['mode', 'swing', 'hold', 'trades', '/mo', 'win%', 'expR', 'totR', 'maxDD_R', 'lossRun', `x@${riskPct}%`, `DD%@${riskPct}%`];
const fmt = r => r.n ? [
  r.mode, r.pv, r.hold, r.n, r.perMonth.toFixed(1), r.win.toFixed(0),
  r.exp.toFixed(3), r.totR.toFixed(1), r.ddR.toFixed(1), r.maxStreak,
  r.eq < 0.001 ? '~0' : r.eq.toFixed(2), r.ddPct.toFixed(0)
] : [r.mode, r.pv, r.hold, 0, '-', '-', '-', '-', '-', '-', '-', '-'];

const table = [H, ...rows.map(fmt)].map(r => r.map(String));
const w = H.map((_, i) => Math.max(...table.map(r => r[i].length)));
table.forEach((r, i) => {
  console.log(r.map((c, j) => j === 0 ? c.padEnd(w[j]) : c.padStart(w[j])).join('  '));
  if(i === 0) console.log(w.map(x => '-'.repeat(x)).join('  '));
});
console.log('');
