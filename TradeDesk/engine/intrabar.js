'use strict';
/* ---------------------------------------------------------------------------
   Resolving what actually happened inside a bar.

   A 1H bar says the price reached 7810 and 7790. It does not say in which
   order. For a trade whose entry, stop and target all sit inside one bar's
   range — which is most of them here, because the average hold is under three
   bars — that ordering decides whether the trade won or lost.

   Two bounds can be computed from 1H alone:

     optimistic   the target counts on the entry bar
     conservative it does not

   Neither is the answer. The answer is the finer series: walk the 15M or 5M
   bars inside the window and see which level was reached first. Where that
   data exists, this replaces the guess with the fact.
   --------------------------------------------------------------------------- */

/* Binary search for the first fine bar at or after time t. */
function seek(fine, t){
  let lo = 0, hi = fine.length - 1, ans = fine.length;
  while(lo <= hi){
    const m = (lo + hi) >> 1;
    if(fine[m].t >= t){ ans = m; hi = m - 1; } else lo = m + 1;
  }
  return ans;
}

/* Replay one trade against the finer series.
   Returns 'target' | 'stop' | 'open' | 'nodata'. */
function resolve(trade, coarseBars, fine, fineDur){
  const entryBar = coarseBars[trade.entryAt];
  if(!entryBar) return 'nodata';
  let k = seek(fine, entryBar.t);
  if(k >= fine.length) return 'nodata';
  /* the fine data has to actually cover this bar */
  if(fine[k].t > entryBar.t + fineDur) return 'nodata';

  const dir = trade.dir;
  let filled = false;

  for(; k < fine.length; k++){
    const f = fine[k];
    if(!filled){
      /* the limit fills when the finer bar trades through it */
      const hit = dir === 'bull' ? f.l <= trade.entry : f.h >= trade.entry;
      if(!hit) continue;
      filled = true;
      /* within this same fine bar the ordering is still unknown, so fall
         through and apply the stop-first rule to it only */
    }
    const sHit = dir === 'bull' ? f.l <= trade.stop   : f.h >= trade.stop;
    const tHit = dir === 'bull' ? f.h >= trade.target : f.l <= trade.target;
    if(sHit) return 'stop';
    if(tHit) return 'target';
  }
  return 'open';
}

module.exports = {resolve, seek};
