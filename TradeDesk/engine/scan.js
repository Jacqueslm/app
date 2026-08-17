'use strict';
/* How often does the method trigger, and where do candidates get filtered out?
     node scan.js [N]                                                        */
const path = require('path');
const {load} = require('./csv');
const {resample} = require('./resample');
const {align, findSetups, evaluate} = require('./align');

const F = tf => load(path.join(__dirname, '..', 'data', `MES-${tf}.csv`));
const D = {}; ['1d','4h','2h','1h','15m'].forEach(tf => D[tf] = F(tf));

/* 4H derived from the 2H series — byte-identical to the real export on all 409
   overlapping bars, and 256 days deep instead of 95. */
D['4h'] = resample(D['2h'], 4*3600*1000, D['4h'][0].t);

const N = Number(process.argv[2]) || 2;

const CONFIGS = [
  {exec:'2h',  external:['1d','4h'], internal:[],     label:'2H exec · D+4H bias'},
  {exec:'2h',  external:['1d','4h'], internal:[],     label:'2H exec · D+4H · protected sweeps only', prot:true},
  {exec:'2h',  external:['1d'],      internal:['4h'], label:'2H exec · D bias, 4H must agree'},
  {exec:'1h',  external:['1d','4h'], internal:[],     label:'1H exec · D+4H bias'},
  {exec:'15m', external:['1d','4h'], internal:['1h'], label:'15M exec · D+4H bias, 1H agrees'}
];

console.log(`\nSetup scan   N=${N}   sweep → same-direction minor shift within 6 bars   exit 2R or stop\n`);
console.log('  ' + 'configuration'.padEnd(44) + ' days  swps  bias  conf   /wk   win%    exp');
console.log('  ' + '-'.repeat(88));

for(const cfg of CONFIGS){
  const tfs = [...new Set([...cfg.external, ...cfg.internal, cfg.exec])];
  const series = {}; tfs.forEach(tf => series[tf] = D[tf]);
  const a = align(series, {exec:cfg.exec, external:cfg.external,
                           internal:cfg.internal, fractalN:N});
  const c = D[cfg.exec];
  const res = a.meta[cfg.exec].res;

  /* usable window: bars where every required timeframe already has a bar */
  const usable = a.rows.filter(r => tfs.every(tf => r.tf[tf].barIndex >= 0));
  const days = usable.length
    ? (c[usable[usable.length-1].i].t - c[usable[0].i].t)/86400000 : 0;
  const from = usable.length ? usable[0].i : Infinity;

  /* funnel */
  const swps = res.sweeps.filter(s => s.i >= from);
  const withBias = swps.filter(s => {
    const r = a.rows[s.i]; if(!r) return false;
    const dir = s.side === 'bullish' ? 'bull' : 'bear';
    return r.external === dir && (!cfg.internal.length || r.internal === dir);
  });
  let s = findSetups(a, {requireInternal: cfg.internal.length > 0})
            .filter(x => x.sweepAt >= from);
  if(cfg.prot) s = s.filter(x => x.isProtected);

  const ev = evaluate(s, c, 2);
  const done = ev.filter(x => x.outcome !== 'open');
  const wins = done.filter(x => x.outcome === 'target').length;
  const exp = done.length ? done.reduce((a,x)=>a+x.r,0)/done.length : 0;

  console.log('  ' + cfg.label.padEnd(44) +
    days.toFixed(0).padStart(5) +
    String(cfg.prot ? swps.filter(x=>x.isProtected).length : swps.length).padStart(6) +
    String(withBias.length).padStart(6) +
    String(s.length).padStart(6) +
    (days ? (s.length*7/days).toFixed(1) : '—').padStart(6) +
    (done.length ? (wins/done.length*100).toFixed(0)+'%' : '  —').padStart(7) +
    (done.length ? (exp>=0?'+':'')+exp.toFixed(2)+'R' : '   —').padStart(8));
}
console.log('\n  swps = sweeps in the usable window · bias = those matching external bias');
console.log('  conf = those confirmed by a minor shift.  2R exit is a placeholder.\n');
