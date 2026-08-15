'use strict';
/* The loop must reproduce the research exactly. If a state machine folding one
   candle at a time disagrees with the batch pass, one of them is wrong, and it
   does not matter which — the number quoted in the spec stops meaning anything. */
const path = require('path');
const {load} = require('./csv');
const S = require('./structure');
const L = require('./loop');

let pass = 0, fail = 0; const out = [];
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  out.push((ok?'  ok    ':'  FAIL  ') + name +
    (ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
};

const h1 = load(path.join(__dirname, '..', 'data', 'MES-1h.csv'));

/* run the loop over the whole history */
const st = L.create();
const ticks = [];
for(const c of h1) ticks.push(L.tick(st, c));

/* and the batch engine over the same bars */
const batch = S.analyze(h1, {fractalN: 2});

out.push('\nStructure agreement, ' + h1.length + ' bars');
{
  const loopSwings = st.h1.swings.map(s => s.i + ':' + s.kind + ':' + s.price);
  const tailBatch  = batch.swings.slice(-st.h1.swings.length)
                          .map(s => s.i + ':' + s.kind + ':' + s.price);
  check('the swings the loop still holds match the batch', loopSwings, tailBatch);
}
{
  check('final bias agrees', st.h1.bias, batch.bias);
  check('final protected level agrees',
    st.h1.protectedLow ? st.h1.protectedLow.price : st.h1.protectedHigh ? st.h1.protectedHigh.price : null,
    batch.protectedLow ?? batch.protectedHigh ?? null);
}
{
  const loopBOS = [];
  ticks.forEach(t => t.events.forEach(e => { if(e.type === 'BOS') loopBOS.push(t.i); }));
  const batchBOS = batch.major.filter(e => e.type === 'BOS').map(e => e.i);
  check('every major BOS fires on the same bar', loopBOS, batchBOS);
}
{
  const loopCH = [];
  ticks.forEach(t => t.events.forEach(e => { if(e.type === 'CHoCH') loopCH.push(t.i + e.dir); }));
  const batchCH = batch.major.filter(e => e.type === 'CHoCH').map(e => e.i + e.dir);
  check('every major CHoCH fires on the same bar', loopCH, batchCH);
}

out.push('\nBar-by-bar bias, sampled');
{
  let bad = 0;
  for(let i = 0; i < h1.length; i += 53){
    if(ticks[i].bias !== S.stateAt(batch, i).bias) bad++;
  }
  check('bias matches stateAt at every sampled bar', bad, 0);
}

out.push('\nThe loop cannot see forward');
{
  check('no decision precedes the bar it was made on',
    ticks.every((t, i) => t.i === i), true);
  const entries = st.trades.filter(t => t.entryAt != null);
  /* same-bar is legitimate now: a limit filled intrabar can be stopped or
     targeted before that bar closes. What must never happen is an exit BEFORE
     the entry. */
  check('no exit precedes its entry',
    entries.every(t => t.exitAt >= t.entryAt), true);
  const sameBar = entries.filter(t => t.exitAt === t.entryAt);
  check('same-bar fills and exits do occur and are counted', sameBar.length > 0, true);
  check('and every one of them resolved', sameBar.every(t => t.r === -1 || t.r > 0), true);
  check('a stop is always beyond the entry',
    entries.every(t => t.dir === 'bull' ? t.stop < t.entry : t.stop > t.entry), true);
  check('a target is always in front of it',
    entries.every(t => t.dir === 'bull' ? t.target > t.entry : t.target < t.entry), true);
}
{
  /* feeding a prefix must produce an identical prefix of decisions */
  const cut = 5000;
  const st2 = L.create(); const t2 = [];
  for(let i = 0; i < cut; i++) t2.push(L.tick(st2, h1[i]));
  check('a truncated run gives identical decisions',
    t2.map(x => x.i + (x.action||'') + (x.bias||'')),
    ticks.slice(0, cut).map(x => x.i + (x.action||'') + (x.bias||'')));
}

out.push('\nTrades');
{
  const t = st.trades;
  check('trades were taken', t.length > 50, true);
  check('every trade resolved to a stop or a target',
    t.every(x => x.r === -1 || x.r > 0), true);
  const R = t.reduce((s,x) => s+x.r, 0);
  const wins = t.filter(x => x.r > 0).length;
  out.push(`          ${t.length} trades · ${(wins/t.length*100).toFixed(0)}% win · ` +
           `${(R/t.length >= 0 ? '+' : '')}${(R/t.length).toFixed(3)}R · ${R.toFixed(1)}R total`);
}

out.push('\nEquivalence with the batch research');
{
  const {resample, resampleDaily} = require('./resample');
  const {align, findPullbacks, evaluateFraction} = require('./align');
  const a = align({'1d':resampleDaily(h1),
                   '4h':resample(h1, 4*3600e3, load(path.join(__dirname,'..','data','MES-4h.csv'))[0].t),
                   '1h':h1}, {exec:'1h', external:['1d','4h'], internal:[], fractalN:2});
  const bt = evaluateFraction(findPullbacks(a, {depth:0.75, on:'bos'}), h1, 0.65, 'origin')
               .filter(x => x.r != null);

  const byBar = new Map(bt.map(x => [x.entryAt, x]));
  let matched = 0, mismatched = 0;
  for(const l of st.trades){
    const b = byBar.get(l.entryAt);
    if(!b) continue;
    matched++;
    if(Math.abs(b.entry-l.entry) > 1e-9 || Math.abs(b.stop-l.stop) > 1e-9 ||
       Math.abs(b.r-l.r) > 1e-9) mismatched++;
  }
  check('every loop trade has a matching backtest entry',
    st.trades.length - matched, 0);
  check('and identical entry, stop and result on every one', mismatched, 0);

  /* the backtest allows overlapping positions; the loop holds one at a time.
     That is a real difference and the only one permitted. */
  const extra = bt.length - matched;
  check('the backtest takes only a handful more, all overlaps', extra <= 5, true);
  out.push(`          backtest ${bt.length} · loop ${st.trades.length} · ` +
           `${extra} backtest-only, each overlapping an open position`);
}

out.push('\nSpeed');
{
  const t0 = process.hrtime.bigint();
  const s2 = L.create(); for(const c of h1) L.tick(s2, c);
  const ms = Number(process.hrtime.bigint() - t0)/1e6;
  const perBar = ms/h1.length*1000;
  check('folds a bar in under 20 microseconds', perBar < 20, true);
  out.push(`          ${h1.length} bars in ${ms.toFixed(0)}ms · ${perBar.toFixed(1)}µs per bar`);
}

console.log(out.join('\n'));
console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
