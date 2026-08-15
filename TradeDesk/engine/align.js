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
  if(!candles || candles.length < 2)
    throw new Error(`barDuration(): need at least 2 bars, got ${candles ? candles.length : 0}. ` +
      `Usually this means two timeframes were combined whose histories do not overlap.`);
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
  /* on: 'swing' — the leg is defined by a swing high LABELLED HH (or a low
          labelled LL). It need not have broken anything: that high may itself
          be a lower high on a bigger timeframe, and the leg is still a leg.
     on: 'bos'   — the older reading, where the leg had to break structure.

     tickBuffer: the stop sits this far BEYOND the origin. At depth 1.00 the
     entry is the origin, so a stop placed exactly on it gives zero risk and
     the setup silently vanishes — which is how this was found. */
  const o = Object.assign({depth: 0.5, maxBars: 40, tickBuffer: 0.25,
                           on: 'swing'}, opts || {});
  const ex = aligned.meta[aligned.opt.exec];
  const res = ex.res, candles = ex.candles;
  const out = [];

  /* legs: {dir, origin, extreme, from} where `from` is the first bar on which
     the leg was knowable — the swing's confirmation bar, never the swing bar
     itself, or the scan would be reading N bars into the future. */
  const legs = [];
  if(o.on === 'bos'){
    for(const e of res.major){
      if(e.type === 'BOS' && e.protectedNow != null)
        legs.push({dir:e.dir, origin:e.protectedNow,
                   seed: e.dir === 'bull' ? candles[e.i].h : candles[e.i].l, from:e.i});
    }
  } else {
    for(let k = 0; k < res.swings.length; k++){
      const sw = res.swings[k];
      const isHH = sw.kind === 'high' && sw.label === 'HH';
      const isLL = sw.kind === 'low'  && sw.label === 'LL';
      if(!isHH && !isLL) continue;
      /* the leg came from the opposite swing immediately before it */
      let origin = null;
      for(let j = k - 1; j >= 0; j--){
        if(res.swings[j].kind !== sw.kind){ origin = res.swings[j]; break; }
      }
      if(!origin) continue;
      legs.push({dir: isHH ? 'bull' : 'bear', origin: origin.price,
                 seed: sw.price, from: sw.confirmedAt});
    }
  }

  for(const leg of legs){
    const {dir, origin} = leg;
    const row = aligned.rows[leg.from];
    if(!row || row.external !== dir) continue;

    let extreme = leg.seed;
    /* start the bar AFTER the leg became knowable. A swing is confirmed at the
       close of leg.from, so an order resting during that same bar would be
       trading on information that bar had not yet finished producing. */
    for(let i = leg.from + 1; i < Math.min(candles.length, leg.from + 1 + o.maxBars); i++){
      const k = candles[i];

      /* closing through the origin invalidates the leg */
      if(dir === 'bull' ? k.c < origin : k.c > origin) break;
      /* a newer leg the same way supersedes this one */
      if(i > leg.from && legs.some(l => l !== leg && l.dir === dir && l.from === i)) break;

      extreme = dir === 'bull' ? Math.max(extreme, k.h) : Math.min(extreme, k.l);
      const span = Math.abs(extreme - origin);
      if(!(span > 0)) continue;
      const trigger = dir === 'bull' ? extreme - o.depth*span : extreme + o.depth*span;

      if(dir === 'bull' ? k.l <= trigger : k.h >= trigger){
        const entry = trigger;
        const stop  = dir === 'bull' ? origin - o.tickBuffer : origin + o.tickBuffer;
        const risk  = Math.abs(entry - stop);
        if(risk > 0){
          out.push({
            kind:'pullback', dir, bosAt: leg.from, entryAt: i, t: k.t,
            origin, extreme, entry, stop, risk,
            legTarget: extreme, barsToPullback: i - leg.from,
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

/* Exit at a fraction of the way back to the prior extreme.

   frame 'origin' — the leg is measured from where it came from. Origin is 0%,
     the prior extreme is 100%, and the exit sits at `frac`. Note this is only
     reachable when the entry is deeper than the target: entry sits at
     (1 - depth) of the leg, so frac must exceed that or the target is already
     behind price at entry.

   frame 'entry'  — the remaining distance from the fill to the prior extreme
     is 100%, and the exit takes `frac` of it. Always reachable.

   `frac` may be an array, in which case the position is scaled out in equal
   parts at each level and the result is the average R across those parts. The
   stop applies to whatever is still on. */
function evaluateFraction(setups, candles, frac, frame, opts){
  const fracs = Array.isArray(frac) ? frac.slice().sort((a,b)=>a-b) : [frac];
  const f = frame || 'origin';
  /* A target is NOT honoured on the entry bar unless explicitly asked for. The
     limit fills when the bar trades to it, and that bar's extreme in the other
     direction may have printed first — OHLC cannot say. The stop is honoured
     there, because taking the pessimistic side of an unknowable ordering is the
     only safe asymmetry. Passing targetOnEntryBar:true gives the optimistic
     bound, which is useful only for bracketing. */
  const sameBarTarget = !!(opts && opts.targetOnEntryBar);

  return setups.map(s => {
    const span = Math.abs(s.extreme - s.origin);
    const targets = fracs.map(x => f === 'origin'
      ? (s.dir === 'bull' ? s.origin + x*span        : s.origin - x*span)
      : (s.dir === 'bull' ? s.entry + x*(s.extreme - s.entry)
                          : s.entry - x*(s.entry - s.extreme)));

    /* a target already behind price at the fill cannot be traded */
    const reachable = targets.map(t => s.dir === 'bull' ? t > s.entry : t < s.entry);
    if(!reachable.some(Boolean)) return {...s, outcome:'unreachable', r:null, barsHeld:0};

    const live = targets.filter((t,i) => reachable[i]);
    const part = 1 / live.length;
    let filled = 0, realised = 0, outcome = 'open', barsHeld = 0;

    for(let i = s.entryAt; i < candles.length; i++){
      const k = candles[i]; barsHeld = i - s.entryAt;
      const hitStop = s.dir === 'bull' ? k.l <= s.stop : k.h >= s.stop;
      /* stop first: both inside one bar is unresolvable from OHLC, so take the
         reading that does not flatter the result */
      if(hitStop){
        realised += (1 - filled) * -1;
        outcome = filled > 0 ? 'partial' : 'stop';
        break;
      }
      if(i === s.entryAt && !sameBarTarget) continue;
      while(filled < 1 - 1e-9){
        const idx = Math.round(filled / part);
        if(idx >= live.length) break;
        const t = live[idx];
        const hit = s.dir === 'bull' ? k.h >= t : k.l <= t;
        if(!hit) break;
        realised += part * (Math.abs(t - s.entry) / s.risk);
        filled += part;
      }
      if(filled >= 1 - 1e-9){ outcome = 'target'; break; }
    }
    return {...s, outcome, barsHeld, r: outcome === 'open' ? null : realised};
  });
}

module.exports = {align, findSetups, findPullbacks, evaluate, evaluateToLevel,
                  evaluateFraction, barDuration, lastClosedAt};
