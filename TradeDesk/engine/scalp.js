'use strict';
/* ---------------------------------------------------------------------------
   The 5M scalp — SPEC.md §16.

   In your words: break LL LH, failed LL, makes HH, retest entry, exit LH.

   Read as a sequence, for the long side:

     1  the 5M is in bear structure — LL then LH
     2  a LOW FAILS: it does not make a new LL. Either it prints a higher low,
        or it dips through the prior low and closes back above it, which is the
        sweep already defined in §5
     3  price then makes a HIGH HIGHER than the last LH. That break is the
        bullish change of character
     4  ENTRY is the RETEST of the level just broken, not the break itself —
        a resting limit back at the old LH
     5  EXIT at the LH above: the previous lower high in the sequence, which in
        a downtrend sits higher than the one just taken

   Short side is the mirror: break HH HL, failed HH, makes LL, retest, exit HL.

   Stop goes beyond the failed low, because that low failing is the whole premise.

   Everything here is causal — the retest is only sought on bars after the break
   bar, and the break itself only uses swings already confirmed.
   --------------------------------------------------------------------------- */

const S = require('./structure');
const G = require('./gaps');

function findScalps(candles, opts){
  const o = Object.assign({
    fractalN: 2, maxWaitForRetest: 20, requireFailure: true,
    tickBuffer: 0.25, retestTolerance: 0,
    requireDisplacement: false, displaceWithin: 3
  }, opts || {});

  const res = S.analyze(candles, {fractalN: o.fractalN});
  /* Gaps are not a trade — fill inside five bars is close to a coin flip. They
     are used only as confluence: a break that skipped price displaced, and a
     break that merely drifted did not. */
  const gaps = o.requireDisplacement ? G.detect(candles) : null;
  const sw  = res.swings;
  const out = [];

  for(const ev of res.minor){
    if(ev.type !== 'CHoCH') continue;
    const dir = ev.dir;                        // 'bull' -> long
    const brokenIdx = sw.findIndex(s => s.i === ev.brokeSwingAt);
    if(brokenIdx < 0) continue;
    const broken = sw[brokenIdx];              // the LH taken out (long case)

    /* step 2 — the low that failed, immediately before the break */
    let failed = null;
    for(let k = brokenIdx - 1; k >= 0; k--){
      if(sw[k].kind !== broken.kind){ failed = sw[k]; break; }
    }
    if(!failed) continue;

    if(o.requireFailure){
      /* it failed if it did not extend the sequence: a higher low in a
         downtrend, or a sweep of the prior low that closed back inside */
      const wanted = dir === 'bull' ? 'HL' : 'LH';
      const swept  = res.sweeps.some(s =>
        s.sweptSwingAt === failed.i ||
        (Math.abs(s.level - failed.price) < 1e-9 && s.i <= ev.i));
      if(failed.label !== wanted && !swept) continue;
    }

    if(gaps && !G.displacedBy(gaps, ev.i, dir, o.displaceWithin)) continue;

    /* step 5 — the next LH above, i.e. the previous swing of the same kind
       that sits beyond the one just broken */
    let target = null;
    for(let k = brokenIdx - 1; k >= 0; k--){
      if(sw[k].kind !== broken.kind) continue;
      if(dir === 'bull' ? sw[k].price > broken.price : sw[k].price < broken.price){
        target = sw[k]; break;
      }
    }
    if(!target) continue;

    /* step 4 — wait for the retest of the broken level */
    const level = broken.price;
    const tol = o.retestTolerance;
    let entryAt = null;
    for(let i = ev.i + 1; i < Math.min(candles.length, ev.i + 1 + o.maxWaitForRetest); i++){
      const k = candles[i];
      /* the premise dies if price closes back through the failed low first */
      if(dir === 'bull' ? k.c < failed.price : k.c > failed.price) break;
      /* or if the target is reached before we ever got filled */
      if(dir === 'bull' ? k.h >= target.price : k.l <= target.price) break;
      const touched = dir === 'bull' ? k.l <= level + tol : k.h >= level - tol;
      if(touched){ entryAt = i; break; }
    }
    if(entryAt == null) continue;

    const entry = level;
    const stop  = dir === 'bull' ? failed.price - o.tickBuffer : failed.price + o.tickBuffer;
    const risk  = Math.abs(entry - stop);
    if(!(risk > 0)) continue;
    if(dir === 'bull' ? target.price <= entry : target.price >= entry) continue;

    out.push({
      kind:'scalp', dir, chochAt: ev.i, entryAt, t: candles[entryAt].t,
      brokenLevel: level, failedLow: failed.price, failedLabel: failed.label,
      entry, stop, target: target.price, risk,
      rr: Math.abs(target.price - entry) / risk,
      barsToRetest: entryAt - ev.i
    });
  }
  return out;
}

function run(scalps, candles){
  return scalps.map(s => {
    let outcome = 'open', barsHeld = 0;
    for(let i = s.entryAt; i < candles.length; i++){
      const k = candles[i]; barsHeld = i - s.entryAt;
      const hitStop   = s.dir === 'bull' ? k.l <= s.stop   : k.h >= s.stop;
      const hitTarget = s.dir === 'bull' ? k.h >= s.target : k.l <= s.target;
      if(hitStop)   { outcome = 'stop';   break; }   // stop first: conservative
      if(hitTarget) { outcome = 'target'; break; }
    }
    return {...s, outcome, barsHeld,
            r: outcome === 'target' ? s.rr : outcome === 'stop' ? -1 : null};
  });
}

module.exports = {findScalps, run};
