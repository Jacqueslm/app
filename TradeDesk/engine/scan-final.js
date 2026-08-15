'use strict';
/* The pullback setup over the full 3.6-year 1H history, broken down by the two
   things most likely to be hiding a bull-market artifact: direction and year. */
const path = require('path');
const {load} = require('./csv');
const {resample, resampleDaily} = require('./resample');
const {align, findPullbacks, evaluateToLevel} = require('./align');

const F = tf => load(path.join(__dirname, '..', 'data', `MES-${tf}.csv`));
const h1 = F('1h');
const D = {'1h': h1,
           '2h': resample(h1, 2*3600e3, F('2h')[0].t),
           '4h': resample(h1, 4*3600e3, F('4h')[0].t),
           '1d': resampleDaily(h1)};

const a = align({'1d':D['1d'], '4h':D['4h'], '1h':h1},
                {exec:'1h', external:['1d','4h'], internal:[], fractalN:2});
const yrs = ((h1[h1.length-1].t - h1[0].t)/365.25/86400e3);

const S = ev => {
  const d = ev.filter(x => x.outcome !== 'open');
  if(!d.length) return null;
  const w = d.filter(x => x.outcome === 'target').length;
  return {n:d.length, win:w/d.length*100, exp:d.reduce((s,x)=>s+x.r,0)/d.length};
};
const f = s => s ? String(s.n).padStart(4) + s.win.toFixed(0).padStart(5) + '%' +
  ((s.exp>=0?'+':'')+s.exp.toFixed(2)+'R').padStart(9) : '   —      —        —';

console.log(`\nMES 1H · ${h1.length} bars · ${yrs.toFixed(2)} years · D+4H agree · target = prior extreme\n`);

for(const on of ['bos','swing']){
  console.log(`  trigger: ${on === 'bos' ? 'BOS (break required)' : 'HH swing label (no break)'}`);
  console.log('  depth |        ALL          |       LONGS         |       SHORTS');
  console.log('  ' + '-'.repeat(70));
  for(const depth of [0.33,0.50,0.62,0.75]){
    const p = findPullbacks(a, {depth, on});
    const ev = evaluateToLevel(p, h1);
    console.log('  ' + depth.toFixed(2).padStart(5) + ' |' + f(S(ev)) +
      '  |' + f(S(ev.filter(x=>x.dir==='bull'))) + '  |' + f(S(ev.filter(x=>x.dir==='bear'))));
  }
  console.log();
}

/* year by year, at the depth that looked best */
console.log('  Year by year — BOS trigger, depth 0.62\n');
console.log('  year |  n   win%     exp    | long exp   short exp | MES range');
console.log('  ' + '-'.repeat(70));
const p = findPullbacks(a, {depth:0.62, on:'bos'});
const ev = evaluateToLevel(p, h1);
const years = [...new Set(h1.map(c => new Date(c.t).getUTCFullYear()))].sort();
for(const y of years){
  const g = ev.filter(x => new Date(x.t).getUTCFullYear() === y);
  const bars = h1.filter(c => new Date(c.t).getUTCFullYear() === y);
  const lo = Math.min(...bars.map(b=>b.l)), hi = Math.max(...bars.map(b=>b.h));
  const st = S(g), L = S(g.filter(x=>x.dir==='bull')), Sh = S(g.filter(x=>x.dir==='bear'));
  console.log('  ' + String(y).padStart(4) + ' |' + f(st) + '  |' +
    (L ? ((L.exp>=0?'+':'')+L.exp.toFixed(2)+'R').padStart(9) : '        —') +
    (Sh ? ((Sh.exp>=0?'+':'')+Sh.exp.toFixed(2)+'R').padStart(11) : '          —') +
    `   ${lo.toFixed(0)}-${hi.toFixed(0)}`);
}
console.log(`\n  ${(p.length/(yrs*52)).toFixed(1)} trades/wk at depth 0.62\n`);
