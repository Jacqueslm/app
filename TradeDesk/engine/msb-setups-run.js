'use strict';
const path = require('path');
const {load} = require('./csv');
const {levelsFrom, runRejection, runBreakout, stats, prepExec} = require('./msb-setups');
const RISK = +(process.argv[process.argv.indexOf('--risk') + 1]) || 10;
const HOUR = 3600e3, MIN = 60e3;

const h1 = load(path.join(__dirname, '..', 'data', 'MES-1h.csv'));
const rows = [];

for(const [file, tfMs, label] of [['MES-15m.csv', 15 * MIN, '15m'], ['MES-5m.csv', 5 * MIN, '5m']]){
  const E = prepExec(file, tfMs);
  console.log(`\n${label} execution · ${E.span} · ${E.months.toFixed(1)} months`);

  for(const refPv of [3, 5]){
    const lv = levelsFrom(h1, refPv, HOUR);
    for(const maxPerDay of [1, 2]){
      const r = runRejection(E.c, E.et, lv, {pv: 3, tfMs, maxPerDay, minR: 1.0});
      rows.push({tf: label, setup: `reject@1H sw${refPv}`, cfg: `${maxPerDay}/day`,
                 ...stats(r.trades, E.months, RISK), g: r.g});
    }
  }
  for(const box of [8, 12, 20]) for(const tight of [0.5, 0.7])
    for(const stopMode of ['far', 'edge']) for(const tgtMode of ['box', 'level']){
      // far stop + box target is a 1:1 by construction — skip the tautology
      if(stopMode === 'far' && tgtMode === 'box') continue;
      const r = runBreakout(E.c, E.et, {box, tight, stopMode, tgtMode, maxPerDay: 2, minR: 1.0});
      const st = stats(r.trades, E.months, RISK);
      if(st.n) rows.push({tf: label, setup: `break box${box}/${tight}`,
                          cfg: `${stopMode} stop, ${tgtMode} tgt`, ...st, g: r.g});
    }
}

const H = ['tf', 'setup', 'config', 'trades', '/week', 'win%', 'expR', 'totR', 'lossRun', `x@${RISK}%`, `DD%@${RISK}%`];
const fmt = r => r.n ? [r.tf, r.setup, r.cfg, r.n, r.perWk.toFixed(1), r.win.toFixed(0), r.exp.toFixed(3),
                        r.totR.toFixed(1), r.maxStreak, r.eq < 0.01 ? '~0' : r.eq.toFixed(2), r.ddPct.toFixed(0)]
                     : [r.tf, r.setup, r.cfg, 0, '-', '-', '-', '-', '-', '-', '-'];
const T = [H, ...rows.map(fmt)].map(r => r.map(String));
const w = H.map((_, i) => Math.max(...T.map(r => r[i].length)));
console.log('');
T.forEach((r, i) => {
  console.log(r.map((c, j) => j < 3 ? c.padEnd(w[j]) : c.padStart(w[j])).join('  '));
  if(!i) console.log(w.map(x => '-'.repeat(x)).join('  '));
});
console.log('');
