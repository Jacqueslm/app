'use strict';
/* ---------------------------------------------------------------------------
   Multi-timeframe alignment — §1 of SPEC.md.

   External bias comes from the Daily and 4H. Internal state comes from the 1H.
   Execution happens on the 15M. The whole job of this file is to answer, for
   any bar on the execution timeframe: what did each higher timeframe actually
   know at that instant?

   The trap this exists to avoid: a 4H bar stamped 10:00 does not finish until
   14:00. Reading its bias while executing an 11:15 bar on the 15M uses three
   hours of price that had not happened yet. Every rule tested on top of that
   looks better than it is, and the error is invisible in the output — the
   equity curve just comes out too good.

   So higher timeframes are consulted only through their last CLOSED bar, and
   only through Structure.stateAt(). TradingView stamps a bar with its OPEN
   time, so close time is stamp + duration, and duration is measured from the
   data rather than assumed.
   --------------------------------------------------------------------------- */

const S = require('./structure');

/* Modal spacing between bars — the nominal duration, immune to session gaps. */
function barDuration(candles){
  const gaps = {};
  for(let i = 1; i < candles.length; i++){
    const g = candles[i].t - candles[i-1].t;
    gaps[g] = (gaps[g] || 0) + 1;
  }
  return Number(Object.entries(gaps).sort((a,b) => b[1] - a[1])[0][0]);
}

/* Index of the last bar to have CLOSED at or before time t. -1 if none has. */
function lastClosedAt(candles, dur, t, hint){
  let i = Math.min(hint || 0, candles.length - 1);
  if(i < 0) i = 0;
  while(i < candles.length && candles[i].t + dur <= t) i++;
  while(i > 0 && candles[i-1].t + dur > t) i--;
  return i - 1;
}

/* Build a per-execution-bar view of every timeframe.

   series : { '1d': candles, '4h': candles, '1h': candles, '15m': candles }
   opts   : { exec: '15m', external: ['1d','4h'], internal: ['1h'], fractalN }   */
function align(series, opts){
  const o = Object.assign({
    exec: '15m', external: ['1d','4h'], internal: ['1h'], fractalN: 2
  }, opts || {});

  const tfs = [...new Set([...o.external, ...o.internal, o.exec])];
  const meta = {};
  for(const tf of tfs){
    if(!series[tf]) throw new Error(`align(): no candles supplied for "${tf}"`);
    meta[tf] = {
      candles: series[tf],
      dur    : barDuration(series[tf]),
      res    : S.analyze(series[tf], {fractalN: o.fractalN}),
      cursor : 0
    };
  }

  const ex = meta[o.exec];
  const rows = [];

  for(let i = 0; i < ex.candles.length; i++){
    const t = ex.candles[i].t + ex.dur;      // this bar has just closed
    const row = {i, t: ex.candles[i].t, tf: {}};

    for(const tf of tfs){
      const m = meta[tf];
      /* the execution timeframe knows its own bar i; everything else is
         consulted only as far as its last closed bar */
      const j = tf === o.exec ? i : lastClosedAt(m.candles, m.dur, t, m.cursor);
      m.cursor = Math.max(0, j);
      row.tf[tf] = {
        barIndex: j,
        barTime : j >= 0 ? m.candles[j].t : null,
        ...S.stateAt(m.res, j)
      };
    }

    /* external agreement — every external timeframe pointing the same way */
    const ext = o.external.map(tf => row.tf[tf].bias);
    row.external = ext.every(b => b === 'bull') ? 'bull'
                 : ext.every(b => b === 'bear') ? 'bear' : null;

    /* internal agreement with it */
    const int = o.internal.map(tf => row.tf[tf].bias);
    row.internal = int.every(b => b === 'bull') ? 'bull'
                 : int.every(b => b === 'bear') ? 'bear' : null;

    row.aligned = row.external !== null && row.external === row.internal
                ? row.external : null;
    rows.push(row);
  }

  return {rows, meta, opt: o};
}

/* --- setups ----------------------------------------------------------------
   The method minus displacement, which stays undefined until it is defined
   against real charts (SPEC.md §5, open question 4):

     external bias set by D and 4H
     a sweep on the execution timeframe in that direction — the manipulation
     a minor shift on the execution timeframe confirming it, within `within`
       bars — the internal aligning with the external

   Stop sits beyond the swept extreme, because if price accepts back through
   the level the read was simply wrong.                                       */

function findSetups(aligned, opts){
  const o = Object.assign({within: 6, requireInternal: false}, opts || {});
  const ex = aligned.meta[aligned.opt.exec];
  const res = ex.res, candles = ex.candles;
  const out = [];

  for(const sweep of res.sweeps){
    const row = aligned.rows[sweep.i];
    if(!row) continue;

    /* a bullish sweep takes sell-side liquidity below, and is only tradable
       long, so it has to sit under a bullish external bias */
    const dir = sweep.side === 'bullish' ? 'bull' : 'bear';
    if(row.external !== dir) continue;
    if(o.requireInternal && row.internal !== dir) continue;

    /* confirmation: a minor break the same way, shortly after */
    const shift = res.minor.find(e =>
      e.i > sweep.i && e.i <= sweep.i + o.within && e.dir === dir);
    if(!shift) continue;

    const entry = candles[shift.i].c;
    const stop  = dir === 'bull' ? candles[sweep.i].l : candles[sweep.i].h;
    const risk  = Math.abs(entry - stop);
    if(!(risk > 0)) continue;

    out.push({
      dir, sweepAt: sweep.i, shiftAt: shift.i,
      t: candles[shift.i].t,
      sweptLevel: sweep.level, isProtected: sweep.isProtected,
      entry, stop, risk,
      barsToConfirm: shift.i - sweep.i,
      external: row.external, internal: row.internal
    });
  }
  return out;
}

/* Walk each setup forward to a fixed R multiple or the stop, whichever the
   bars reach first. Not a strategy result — the exit rule is a placeholder —
   but enough to see whether the entries land anywhere useful. */
function evaluate(setups, candles, rMultiple){
  const R = rMultiple || 2;
  return setups.map(s => {
    const from = s.entryAt != null ? s.entryAt : s.shiftAt;
    const target = s.dir === 'bull' ? s.entry + R*s.risk : s.entry - R*s.risk;
    let outcome = 'open', barsHeld = 0;
    /* start ON the entry bar. A limit filled intrabar can be stopped by the
       same bar, and skipping it scores those as wins. */
    for(let i = from; i < candles.length; i++){
      const k = candles[i]; barsHeld = i - from;
      const hitStop   = s.dir === 'bull' ? k.l <= s.stop   : k.h >= s.stop;
      const hitTarget = s.dir === 'bull' ? k.h >= target   : k.l <= target;
      /* both inside one bar is unresolvable from OHLC alone; count it as the
         stop rather than flattering the result */
      if(hitStop)        { outcome = 'stop';   break; }
      if(hitTarget)      { outcome = 'target'; break; }
    }
    return {...s, target, outcome, barsHeld, r: outcome === 'target' ? R : outcome === 'stop' ? -1 : 0};
  });
}



/* --- pullback to origin ----------------------------------------------------
   The other setup: a 4H or daily swing is running, the execution timeframe
   makes a higher high confirming it, price pulls back toward where that leg
   came from, and the trade is taken there in the direction of the swing.

   "Where it came from" is the origin of the impulse — the swing low that the
   leg launched from, which is precisely the protected level (§4). No new
   concept is needed and no new number is invented, except how far back into
   the leg counts as a pullback, which is `depth` and is meant to be scanned
   rather than assumed.

     depth 1.00  price must return all the way to the origin
     depth 0.50  halfway back into the leg
     depth 0.33  a shallow pullback

   The leg is measured to its running extreme, so a leg that extends further
   raises the entry with it. The trade dies if price closes through the origin,
   because that is a change of character and the read was wrong.            */

function findPullbacks(aligned, opts){
  /* tickBuffer: the stop sits this far BEYOND the origin. At depth 1.00 the
     entry is the origin, so a stop placed exactly on it gives zero risk and
     the setup silently vanishes — which is how this was found. */
  const o = Object.assign({depth: 0.5, maxBars: 40, tickBuffer: 0.25}, opts || {});
  const ex = aligned.meta[aligned.opt.exec];
  const res = ex.res, candles = ex.candles;
  const out = [];

  for(const bos of res.major){
    if(bos.type !== 'BOS') continue;
    const dir = bos.dir;
    const origin = bos.protectedNow;          // the low/high the leg launched from
    if(origin == null) continue;

    /* only with the higher timeframes behind it */
    const row = aligned.rows[bos.i];
    if(!row || row.external !== dir) continue;

    let extreme = dir === 'bull' ? candles[bos.i].h : candles[bos.i].l;

    for(let i = bos.i + 1; i < Math.min(candles.length, bos.i + 1 + o.maxBars); i++){
      const k = candles[i];

      /* closing through the origin invalidates the leg */
      if(dir === 'bull' ? k.c < origin : k.c > origin) break;

      /* a fresh BOS starts a new leg; this one stops being the live setup */
      if(res.major.some(e => e.i === i && e.type === 'BOS' && e.dir === dir)) break;

      extreme = dir === 'bull' ? Math.max(extreme, k.h) : Math.min(extreme, k.l);
      const span = Math.abs(extreme - origin);
      if(!(span > 0)) continue;
      const trigger = dir === 'bull' ? extreme - o.depth*span : extreme + o.depth*span;

      const touched = dir === 'bull' ? k.l <= trigger : k.h >= trigger;
      if(touched){
        const entry = trigger;                       // a resting limit at the level
        const stop  = dir === 'bull' ? origin - o.tickBuffer : origin + o.tickBuffer;
        const risk  = Math.abs(entry - stop);
        if(risk > 0){
          out.push({
            kind:'pullback', dir, bosAt: bos.i, entryAt: i, t: k.t,
            origin, extreme, entry, stop, risk,
            legTarget: extreme, barsToPullback: i - bos.i,
            external: row.external, internal: row.internal
          });
        }
        break;
      }
    }
  }
  return out;
}

/* Exit at a FIXED PRICE rather than a fixed R. Comparing pullback depths by
   R-multiple is not a fair test: a deeper entry has a tighter stop, so its 2R
   target sits nearer in absolute price and is easier to reach. Aiming every
   depth at the same level — the extreme the leg already made — isolates
   whether the entry is actually better, rather than merely closer. */
function evaluateToLevel(setups, candles){
  return setups.map(s => {
    const target = s.legTarget;
    let outcome = 'open', barsHeld = 0;
    for(let i = s.entryAt; i < candles.length; i++){
      const k = candles[i]; barsHeld = i - s.entryAt;
      const hitStop   = s.dir === 'bull' ? k.l <= s.stop : k.h >= s.stop;
      const hitTarget = s.dir === 'bull' ? k.h >= target : k.l <= target;
      if(hitStop)   { outcome = 'stop';   break; }
      if(hitTarget) { outcome = 'target'; break; }
    }
    const reward = Math.abs(target - s.entry) / s.risk;
    return {...s, target, outcome, barsHeld, rr: reward,
            r: outcome === 'target' ? reward : outcome === 'stop' ? -1 : 0};
  });
}

module.exports = {align, findSetups, findPullbacks, evaluate, evaluateToLevel,
                  barDuration, lastClosedAt};
