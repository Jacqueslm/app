'use strict';
/* ---------------------------------------------------------------------------
   Consolidation — SPEC.md §6.

   "Trade consolidation but only when the 1hr is making HH HL LL LH."

   Read mechanically, a run of swings carrying BOTH bullish labels (HH, HL) and
   bearish ones (LL, LH) is not a trend, it is a range. A trend produces one
   family or the other; only a range produces both.

   Detection lives on the 1H. Execution is a 5M/15M scalp, which is a separate
   layer and is not in this file.

   Causal: a bar is judged only on swings already confirmed by that bar.
   --------------------------------------------------------------------------- */

const S = require('./structure');

function detect(candles, opts){
  const o = Object.assign({fractalN: 2, window: 4, minBars: 6}, opts || {});
  const res = S.analyze(candles, {fractalN: o.fractalN});

  /* swings usable as of each bar, by confirmation not by print */
  const state = new Array(candles.length).fill(null);
  let si = 0;
  const live = [];

  for(let i = 0; i < candles.length; i++){
    while(si < res.swings.length && res.swings[si].confirmedAt <= i) live.push(res.swings[si++]);
    if(live.length < o.window){ state[i] = null; continue; }

    const recent = live.slice(-o.window);
    const labels = recent.map(s => s.label);
    const bull = labels.some(l => l === 'HH' || l === 'HL');
    const bear = labels.some(l => l === 'LL' || l === 'LH');
    if(!(bull && bear)){ state[i] = null; continue; }

    /* a break of structure over the same span means the range resolved */
    const from = recent[0].i;
    if(res.major.some(e => e.type === 'BOS' && e.i >= from && e.i <= i)){ state[i] = null; continue; }

    state[i] = {
      hi: Math.max(...recent.map(s => s.price)),
      lo: Math.min(...recent.map(s => s.price)),
      from
    };
  }

  /* contiguous runs become ranges, with the edges a scalp would work between */
  const ranges = [];
  let cur = null;
  for(let i = 0; i < candles.length; i++){
    if(state[i]){
      if(!cur) cur = {startAt: i, endAt: i, hi: state[i].hi, lo: state[i].lo};
      else { cur.endAt = i; cur.hi = Math.max(cur.hi, state[i].hi); cur.lo = Math.min(cur.lo, state[i].lo); }
    } else if(cur){
      if(cur.endAt - cur.startAt + 1 >= o.minBars) ranges.push(cur);
      cur = null;
    }
  }
  if(cur && cur.endAt - cur.startAt + 1 >= o.minBars) ranges.push(cur);

  ranges.forEach(r => {
    r.bars = r.endAt - r.startAt + 1;
    r.height = r.hi - r.lo;
    r.t = candles[r.startAt].t;
  });

  return {res, state, ranges};
}

module.exports = {detect};
