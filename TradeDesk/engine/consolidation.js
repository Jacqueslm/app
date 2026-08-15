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



/* --- the range scalp -------------------------------------------------------
   Detection is the 1H's job (above). Execution is the 5M or 15M.

   Inside a 1H range there is no trend to follow, so direction comes from which
   edge price is at rather than from a higher-timeframe bias. The rest of the
   machinery is the one already built and tested: liquidity is taken beyond the
   edge, price refuses it, a minor shift confirms, and the trade goes back into
   the range.

     price sweeps the range HIGH  -> short back in
     price sweeps the range LOW   -> long back in

   Stop beyond the swept extreme. Target a fraction of the way across the range,
   which is the same 50–80% exit rule the swing trade uses, applied to the range
   instead of the leg.

   Causal: the 1H range in force at a given execution bar is read from the last
   1H bar to have CLOSED, never the one still forming.                        */

function findScalps(exec, h1, opts){
  const o = Object.assign({
    fractalN: 2, window: 4, minBars: 6, within: 4, target: 0.65,
    tickBuffer: 0.25, edgeBand: 0.15
  }, opts || {});

  const {ranges} = detect(h1, o);
  const execRes  = S.analyze(exec, {fractalN: o.fractalN});

  const h1Dur = h1[1].t - h1[0].t;
  /* a 1H range is only actionable from the close of the bar that revealed it */
  const live = ranges.map(r => ({
    from: h1[r.startAt].t + h1Dur,
    to  : h1[Math.min(r.endAt + 1, h1.length - 1)].t + h1Dur,
    hi  : r.hi, lo: r.lo
  }));

  const rangeAt = t => {
    for(const r of live) if(t >= r.from && t <= r.to) return r;
    return null;
  };

  const out = [];
  for(const sweep of execRes.sweeps){
    const bar = exec[sweep.i];
    const r = rangeAt(bar.t);
    if(!r) continue;

    /* the sweep has to be at an edge of the range, not somewhere in the middle */
    const height = r.hi - r.lo;
    if(!(height > 0)) continue;
    const atHigh = bar.h >= r.hi - height*o.edgeBand;
    const atLow  = bar.l <= r.lo + height*o.edgeBand;

    let dir = null;
    if(sweep.side === 'bearish' && atHigh) dir = 'bear';
    if(sweep.side === 'bullish' && atLow)  dir = 'bull';
    if(!dir) continue;

    const shift = execRes.minor.find(e =>
      e.i > sweep.i && e.i <= sweep.i + o.within && e.dir === dir);
    if(!shift) continue;

    const entry = exec[shift.i].c;
    const stop  = dir === 'bull' ? Math.min(bar.l, exec[shift.i].l) - o.tickBuffer
                                 : Math.max(bar.h, exec[shift.i].h) + o.tickBuffer;
    const risk  = Math.abs(entry - stop);
    if(!(risk > 0)) continue;

    /* target a fraction of the way across the range from the edge swept */
    const target = dir === 'bull' ? r.lo + o.target*height : r.hi - o.target*height;
    if(dir === 'bull' ? target <= entry : target >= entry) continue;

    out.push({kind:'scalp', dir, sweepAt:sweep.i, entryAt:shift.i, t:exec[shift.i].t,
              rangeHi:r.hi, rangeLo:r.lo, height, entry, stop, risk, target,
              rr: Math.abs(target - entry)/risk});
  }
  return out;
}

function runScalps(scalps, exec){
  return scalps.map(s => {
    let outcome = 'open', barsHeld = 0;
    for(let i = s.entryAt; i < exec.length; i++){
      const k = exec[i]; barsHeld = i - s.entryAt;
      const hitStop   = s.dir === 'bull' ? k.l <= s.stop   : k.h >= s.stop;
      const hitTarget = s.dir === 'bull' ? k.h >= s.target : k.l <= s.target;
      if(hitStop)   { outcome = 'stop';   break; }
      if(hitTarget) { outcome = 'target'; break; }
    }
    return {...s, outcome, barsHeld,
            r: outcome === 'target' ? s.rr : outcome === 'stop' ? -1 : null};
  });
}

module.exports = {detect, findScalps, runScalps};
