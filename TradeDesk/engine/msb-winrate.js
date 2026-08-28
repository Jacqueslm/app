'use strict';
/* The hunt for a 60-70% win rate that also makes money.

   Win rate on its own is purchasable: move the target closer and it rises,
   without limit, right up to the point where you are risking a stop to make a
   tick. What decides whether a given win rate is worth having is one line:

       with the stop at 1R and the target at X R,  breakeven = 1 / (1 + X)

   So this sweeps targets from 0.4R to 2R across all three setups and both
   execution timeframes, and reports every configuration next to the win rate
   it would need just to break even. A cell only counts if it clears its own
   line — being right 65% of the time at a 0.5R target is a losing business. */
const path = require('path');
const {load} = require('./csv');
const {run, prep} = require('./msb-sweep');
const {levelsFrom, runRejection, runBreakout, stats, prepExec} = require('./msb-setups');
const HOUR = 3600e3, MIN = 60e3, RISK = 10;
const RRS = [0.4, 0.5, 0.6, 0.75, 1.0, 1.25, 1.5, 2.0];
const rows = [];
const push = (o) => { if(o.n >= 20) rows.push(o); };

// ── Setup A: aligned continuation on the 1H ─────────────────────────────────
const DA = prep([3, 4, 5, 7], false);
for(const pv of [3, 4, 5, 7]) for(const rrMult of RRS) for(const useT1 of [true, false]){
  if(rrMult <= 1 && useT1) continue;
  const r = run(DA, {pv, holdBars: 1, usePB: true, useSeq: true, useAlign: false,
                     tgtMode: 'rr', rrMult, useT1, riskPct: RISK});
  push({setup: 'A aligned 1H', cfg: `sw${pv} ${rrMult}R${useT1 ? ' +½@1R' : ''}`, rr: rrMult,
        n: r.n, per: r.perMonth ? (r.perMonth / 4.345).toFixed(1) : '-', ...r});
}

// ── Setups B and C on the 5m and 15m ────────────────────────────────────────
const h1 = load(path.join(__dirname, '..', 'data', 'MES-1h.csv'));
const levels = levelsFrom(h1, 3, HOUR);
for(const [file, tfMs, tf] of [['MES-15m.csv', 15 * MIN, '15m'], ['MES-5m.csv', 5 * MIN, '5m']]){
  const E = prepExec(file, tfMs);
  for(const rrMult of RRS){
    for(const stopMode of ['bar', 'mid']){
      const r = runRejection(E.c, E.et, levels, {pv: 3, tfMs, maxPerDay: 2, minR: 0,
                             stopMode, tgtMode: 'rr', rrMult, useT1: false});
      const s = stats(r.trades, E.months, RISK);
      push({setup: `B reject ${tf}`, cfg: `${stopMode} stop ${rrMult}R`, rr: rrMult,
            per: s.perWk ? s.perWk.toFixed(1) : '-', ...s});
    }
    for(const box of [8, 12]){
      const r = runBreakout(E.c, E.et, {box, tight: 0.7, stopMode: 'edge',
                            tgtMode: 'rr', rrMult, maxPerDay: 2, minR: 0});
      const s = stats(r.trades, E.months, RISK);
      push({setup: `C break ${tf}`, cfg: `box${box} ${rrMult}R`, rr: rrMult,
            per: s.perWk ? s.perWk.toFixed(1) : '-', ...s});
    }
  }
}

const be = rr => 100 / (1 + rr);
const inBand = r => r.win >= 55 && r.win <= 75;
const clears = r => r.win > be(r.rr);

const show = (title, list) => {
  console.log(`\n${title}`);
  if(!list.length){ console.log('  (none)\n'); return; }
  const H = ['setup', 'config', 'n', '/wk', 'win%', 'need%', 'margin', 'expR', 'totR', 'lossRun', `x@${RISK}%`, 'DD%'];
  const T = [H, ...list.map(r => [r.setup, r.cfg, r.n, r.per, r.win.toFixed(0), be(r.rr).toFixed(0),
      (r.win - be(r.rr)).toFixed(0), r.exp.toFixed(3), r.totR.toFixed(1), r.maxStreak,
      r.eq < 0.01 ? '~0' : r.eq.toFixed(2), r.ddPct.toFixed(0)])].map(r => r.map(String));
  const w = H.map((_, i) => Math.max(...T.map(r => r[i].length)));
  T.forEach((r, i) => {
    console.log('  ' + r.map((c, j) => j < 2 ? c.padEnd(w[j]) : c.padStart(w[j])).join('  '));
    if(!i) console.log('  ' + w.map(x => '-'.repeat(x)).join('  '));
  });
  console.log('');
};

console.log(`\n${rows.length} configurations with 20+ trades. "need%" is the win rate that target requires just to break even.`);
show('■ WIN RATE 55-75% *AND* BEATING ITS OWN BREAKEVEN — the only cells that count',
     rows.filter(r => inBand(r) && clears(r)).sort((a, b) => b.exp - a.exp));
show('□ Win rate 55-75% but LOSING money anyway (the trap)',
     rows.filter(r => inBand(r) && !clears(r)).sort((a, b) => b.win - a.win).slice(0, 12));
show('▲ Highest win rates found, at any expectancy',
     rows.slice().sort((a, b) => b.win - a.win).slice(0, 8));
