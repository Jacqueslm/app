'use strict';
/* Where to get out. "50 to 80 percent of the previous high or low."          */
const path = require('path');
const {load} = require('./csv');
const {resample, resampleDaily} = require('./resample');
const {align, findPullbacks, evaluateToLevel, evaluateFraction} = require('./align');

const F = tf => load(path.join(__dirname, '..', 'data', `MES-${tf}.csv`));
const h1 = F('1h');
const a = align({'1d':resampleDaily(h1), '4h':resample(h1,4*3600e3,F('4h')[0].t), '1h':h1},
                {exec:'1h', external:['1d','4h'], internal:[], fractalN:2});
const yrs = (h1[h1.length-1].t - h1[0].t)/365.25/86400e3, wks = yrs*52;

const S = ev => {
  const d = ev.filter(x => x.r != null);
  const un = ev.filter(x => x.outcome === 'unreachable').length;
  if(!d.length) return null;
  const w = d.filter(x => x.r > 0).length;
  return {n:d.length, un, win:w/d.length*100, exp:d.reduce((s,x)=>s+x.r,0)/d.length};
};
const f = s => s ? String(s.n).padStart(4) + s.win.toFixed(0).padStart(5) + '%' +
  ((s.exp>=0?'+':'')+s.exp.toFixed(2)+'R').padStart(9) + (s.n/wks).toFixed(1).padStart(6)
  : '   —      —        —      —';

console.log(`\nExit rules · MES 1H · ${yrs.toFixed(2)}y · D+4H agree · BOS trigger`);
console.log(`(n, win%, expectancy, trades/wk)\n`);

for(const frame of ['origin','entry']){
  console.log(`  measured from the ${frame === 'origin' ? 'ORIGIN of the leg' : 'ENTRY fill'}`);
  console.log('  depth |     50%          |     65%          |     80%          |  scale 50/65/80');
  console.log('  ' + '-'.repeat(84));
  for(const depth of [0.50,0.62,0.75]){
    const p = findPullbacks(a, {depth, on:'bos'});
    const cells = [0.50,0.65,0.80,[0.50,0.65,0.80]].map(fr =>
      f(S(evaluateFraction(p, h1, fr, frame))));
    console.log('  ' + depth.toFixed(2).padStart(5) + ' |' + cells.join('|'));
  }
  console.log();
}

console.log('  baseline — exit at the prior extreme (100%), the earlier assumption');
console.log('  ' + '-'.repeat(48));
for(const depth of [0.50,0.62,0.75]){
  const p = findPullbacks(a, {depth, on:'bos'});
  console.log('  ' + depth.toFixed(2).padStart(5) + '  ' + f(S(evaluateToLevel(p, h1))));
}
console.log();
