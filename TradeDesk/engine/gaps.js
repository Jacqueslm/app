'use strict';
/* ---------------------------------------------------------------------------
   Fair value gaps — inefficiency, and the displacement §5 left undefined.

   Three candles. If the move through the middle one is violent enough that
   candle 3 never trades where candle 1 traded, a band of price has been skipped:

     bullish gap   low[i]  > high[i-2]     zone = high[i-2] .. low[i]
     bearish gap   high[i] < low[i-2]      zone = high[i]   .. low[i-2]

   No indicator, no threshold, no average. Either the two candles overlap or
   they do not. That is the whole definition.

   A gap is "filled" when price trades back through it. Two thresholds are
   tracked because they answer different questions: the near edge (first touch)
   and the far edge (fully consumed). The midpoint is tracked too, since a gap
   half-filled is the level most people actually treat as the trade.

   --- speed ------------------------------------------------------------------
   Detection is a single pass and touches each bar three times. Fill tracking
   keeps only the OPEN gaps in a working list and drops each one the moment it
   is consumed, so the inner loop is over live gaps rather than all history.

   For live use there is update(): feed it one new candle and it does the work
   for that bar alone, no re-scan. That is what makes a per-tick decision cheap.
   --------------------------------------------------------------------------- */

function create(){
  return {gaps: [], open: [], n: 0, prev: [null, null]};
}

/* Feed one candle. Returns the gap created on this bar, if any. */
function update(st, c){
  const i = st.n++;
  const c2 = st.prev[0];             // candle i-2
  let made = null;

  if(c2){
    if(c.l > c2.h){
      made = {i, dir:'bull', bottom:c2.h, top:c.l, size:c.l - c2.h, t:c.t,
              touchedAt:null, midAt:null, filledAt:null};
    } else if(c.h < c2.l){
      made = {i, dir:'bear', bottom:c.h, top:c2.l, size:c2.l - c.h, t:c.t,
              touchedAt:null, midAt:null, filledAt:null};
    }
  }
  if(made){ st.gaps.push(made); st.open.push(made); }

  /* fills — walk the live list backwards so removal is cheap */
  for(let k = st.open.length - 1; k >= 0; k--){
    const g = st.open[k];
    if(g.i >= i) continue;                    // a gap cannot fill on its own bar
    const mid = (g.top + g.bottom) / 2;

    if(g.dir === 'bull'){
      if(g.touchedAt === null && c.l <= g.top)    g.touchedAt = i;
      if(g.midAt     === null && c.l <= mid)      g.midAt     = i;
      if(c.l <= g.bottom){ g.filledAt = i; st.open.splice(k,1); }
    } else {
      if(g.touchedAt === null && c.h >= g.bottom) g.touchedAt = i;
      if(g.midAt     === null && c.h >= mid)      g.midAt     = i;
      if(c.h >= g.top){ g.filledAt = i; st.open.splice(k,1); }
    }
  }

  st.prev[0] = st.prev[1]; st.prev[1] = c;
  return made;
}

function detect(candles){
  const st = create();
  for(const c of candles) update(st, c);
  return st;
}

/* Gaps still unfilled as of bar i — the magnets price has left behind. */
function openAt(st, i){
  return st.gaps.filter(g => g.i < i && (g.filledAt === null || g.filledAt > i));
}

/* Was there displacement in `dir` within `within` bars ending at bar i?
   This is the §5 answer: a sweep is manipulation when the move away from it
   skips price rather than merely drifting. */
function displacedBy(st, i, dir, within){
  const w = within || 3;
  for(const g of st.gaps){
    if(g.dir !== dir) continue;
    if(g.i > i) break;
    if(g.i >= i - w) return g;
  }
  return null;
}

module.exports = {create, update, detect, openAt, displacedBy};
