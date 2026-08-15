'use strict';
/* The pullback-to-origin setup, scanned across pullback depth.
     node scan-pullback.js [N]                                              */
const path = require('path');
const {load} = require('./csv');
const {resample} = require('./resample');
const {align, findPullbacks, evaluate, evaluateToLevel} = require('./align');

const F = tf => load(path.join(__dirname, '..', 'data', `MES-${tf}.csv`));
const D = {}; ['1d','4h','2h','1h','15m'].forEach(tf => D[tf] = F(tf));
D['4h'] = resample(D['2h'], 4*3600*1000, F('4h')[0].t);
D['1h_deep'] = null;

const N = Number(process.argv[2]) || 2;
const DEPTHS = [0.33, 0.50, 0.618, 0.75, 1.00];

const CONFIGS = [
  {exec:'2h', external:['4h'],      label:'2H exec · 4H swing'},
  {exec:'2h', external:['1d'],      label:'2H exec · daily swing'},
  {exec:'2h', external:['1d','4h'], label:'2H exec · both agree'},
  {exec:'1h', external:['1d','4h'], label:'1H exec · both agree'}
];

console.log(`\nPullback to origin   N=${N}   stop at the origin   exit 2R or stop\n`);

for(const cfg of CONFIGS){
  const tfs = [...new Set([...cfg.external, cfg.exec])];
  const series = {}; tfs.forEach(tf => series[tf] = D[tf]);
  const a = align(series, {exec:cfg.exec, external:cfg.external, internal:[], fractalN:N});
  const c = D[cfg.exec];
  const usable = a.rows.filter(r => tfs.every(tf => r.tf[tf].barIndex >= 0));
  const days = usable.length ? (c[usable[usable.length-1].i].t - c[usable[0].i].t)/86400000 : 0;

  console.log(`  ${cfg.label}   (${days.toFixed(0)} days)`);
  console.log('    depth  trades   /wk  |  fixed 2R target  |  target = the prior extreme');
  console.log('                            |  win%      exp    |  win%      exp    avg R:R');
  console.log('    ' + '-'.repeat(76));
  for(const depth of DEPTHS){
    const p = findPullbacks(a, {depth});
    const stat = ev => {
      const d = ev.filter(x => x.outcome !== 'open');
      const w = d.filter(x => x.outcome === 'target').length;
      return {n:d.length, win: d.length ? w/d.length*100 : null,
              exp: d.length ? d.reduce((s,x)=>s+x.r,0)/d.length : null};
    };
    const A = stat(evaluate(p, c, 2));
    const B = stat(evaluateToLevel(p, c));
    const rr = p.length ? p.reduce((s,x)=>s+Math.abs(x.legTarget-x.entry)/x.risk,0)/p.length : 0;
    const fmt = (v,suf) => v==null ? '—' : (v>=0&&suf==='R'?'+':'')+v.toFixed(suf==='R'?2:0)+suf;
    console.log('    ' + depth.toFixed(2).padStart(5) +
      String(p.length).padStart(8) +
      (days ? (p.length*7/days).toFixed(1) : '—').padStart(6) + '  |' +
      fmt(A.win,'%').padStart(7) + fmt(A.exp,'R').padStart(9) + '   |' +
      fmt(B.win,'%').padStart(7) + fmt(B.exp,'R').padStart(9) +
      rr.toFixed(2).padStart(10));
  }
  console.log();
}
