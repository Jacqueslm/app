'use strict';
/* ---------------------------------------------------------------------------
   Live setup state — the read, for right now.

   Given a 1H series ending at the present bar, work out:
     what the daily and 4H bias are, from their last CLOSED bars
     whether a leg is live and where its origin sits
     where the pullback entry would rest, and the stop and target with it
     whether the 1H is in a range instead

   Deliberately conservative about the right-hand edge. The most recent swing is
   unconfirmed until N bars have printed after it, so a leg that has not yet
   confirmed is reported as forming rather than tradeable.
   --------------------------------------------------------------------------- */

function liveState(h1, opts){
  const o = Object.assign({
    fractalN: 2, depth: 0.75, exitFrac: 0.65, tickBuffer: 0.25, maxBars: 40
  }, opts || {});

  const S = typeof Structure !== 'undefined' ? Structure : require('./structure');
  const R = typeof Resample  !== 'undefined' ? Resample  : require('./resample');
  const A = typeof Align     !== 'undefined' ? Align     : require('./align');

  const h4 = R.resample(h1, 4*3600e3, h1[0].t);
  const d1 = R.resampleDaily(h1);

  const a = A.align({'1d':d1, '4h':h4, '1h':h1},
                    {exec:'1h', external:['1d','4h'], internal:[], fractalN:o.fractalN});
  const now = a.rows[a.rows.length - 1];
  const res = a.meta['1h'].res;

  const out = {
    at: h1[h1.length-1].t,
    price: h1[h1.length-1].c,
    daily: now.tf['1d'].bias, h4: now.tf['4h'].bias, h1: now.tf['1h'].bias,
    external: now.external,
    protectedLow: res.protectedLow, protectedHigh: res.protectedHigh,
    consolidating: S.isConsolidating(res),
    swings: res.swings.slice(-6).map(s => ({label:s.label, kind:s.kind, price:s.price})),
    setup: null, note: null
  };

  if(!out.external){ out.note = 'Daily and 4H disagree — no external bias, stand down.'; return out; }
  if(out.consolidating){ out.note = '1H is ranging. Not a swing environment.'; }

  /* the live leg: most recent BOS in the direction of external bias */
  const bos = [...res.major].reverse().find(e => e.type === 'BOS' && e.dir === out.external);
  if(!bos || bos.protectedNow == null){
    out.note = out.note || 'No leg yet in the direction of bias.';
    return out;
  }

  const barsSince = (h1.length - 1) - bos.i;
  if(barsSince > o.maxBars){ out.note = 'Last leg is stale — over 40 bars old.'; return out; }

  const dir = out.external, origin = bos.protectedNow;
  let extreme = dir === 'bull' ? -Infinity : Infinity;
  for(let i = bos.i; i < h1.length; i++)
    extreme = dir === 'bull' ? Math.max(extreme, h1[i].h) : Math.min(extreme, h1[i].l);

  const span = Math.abs(extreme - origin);
  if(!(span > 0)) return out;

  const entry  = dir === 'bull' ? extreme - o.depth*span : extreme + o.depth*span;
  const stop   = dir === 'bull' ? origin - o.tickBuffer  : origin + o.tickBuffer;
  const target = dir === 'bull' ? origin + o.exitFrac*span : origin - o.exitFrac*span;
  const risk   = Math.abs(entry - stop);

  const invalidated = dir === 'bull' ? out.price < origin : out.price > origin;
  const alreadyHit  = dir === 'bull' ? out.price <= entry : out.price >= entry;

  out.setup = {
    dir, origin, extreme, entry, stop, target, risk,
    rr: Math.abs(target - entry)/risk,
    barsSinceLeg: barsSince,
    distance: Math.abs(out.price - entry),
    status: invalidated ? 'invalidated'
          : alreadyHit  ? 'triggered'
          : 'waiting'
  };
  return out;
}

if(typeof module !== 'undefined' && module.exports) module.exports = {liveState};
if(typeof window !== 'undefined') window.LiveSetup = {liveState};
