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
    const target = s.dir === 'bull' ? s.entry + R*s.risk : s.entry - R*s.risk;
    let outcome = 'open', barsHeld = 0;
    for(let i = s.shiftAt + 1; i < candles.length; i++){
      const k = candles[i]; barsHeld = i - s.shiftAt;
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

module.exports = {align, findSetups, evaluate, barDuration, lastClosedAt};
