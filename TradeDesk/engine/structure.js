'use strict';
/* ---------------------------------------------------------------------------
   Market structure engine — swings, HH/HL/LH/LL, BOS, CHoCH, sweeps.

   Pure price action. No indicators, no averages, no smoothing. Inputs are
   open/high/low/close/time and nothing else.

   Two levels of structure are tracked at once, because they answer different
   questions and conflating them is what makes naive implementations flip bias
   on every pullback:

     minor — breaks of the most recent confirmed swing. Every shallow pullback
             that fails registers here. This is the pullback-level detail you
             execute against.

     major — breaks of the *protected* level: the swing low that launched the
             current bullish leg, or the high that launched the bearish one.
             It advances only when a BOS occurs, never on an ordinary swing.
             Breaking it is what actually ends the leg.

   Inside one timeframe that is swing structure versus internal structure. Read
   across timeframes it is the same idea: major on the Daily and 4H is the
   external bias; minor on the 1H and 15M is where entries live.

   Causal by construction: a swing at bar i is invisible until bar i+N closes,
   so every level acted on was knowable at the time. See SPEC.md.
   --------------------------------------------------------------------------- */

const DEFAULTS = {
  fractalN : 2,        // bars required either side to confirm a swing
  breakOn  : 'close'   // 'close' | 'wick'
};

/* --- §2 swing points -------------------------------------------------------
   Strict on the left, non-strict on the right, so a double top resolves to the
   first bar rather than printing twice or not at all. */

function isSwingHigh(c, i, N){
  if(i - N < 0 || i + N >= c.length) return false;
  for(let j = i - N; j < i; j++) if(!(c[i].h >  c[j].h)) return false;
  for(let j = i + 1; j <= i + N; j++) if(!(c[i].h >= c[j].h)) return false;
  return true;
}
function isSwingLow(c, i, N){
  if(i - N < 0 || i + N >= c.length) return false;
  for(let j = i - N; j < i; j++) if(!(c[i].l <  c[j].l)) return false;
  for(let j = i + 1; j <= i + N; j++) if(!(c[i].l <= c[j].l)) return false;
  return true;
}

function analyze(candles, options){
  const opt = Object.assign({}, DEFAULTS, options || {});
  const N = opt.fractalN;

  const swings = [];
  const minor  = [];   // breaks of the most recent swing
  const major  = [];   // breaks of the protected level
  const sweeps = [];

  let minorBias = null, bias = null;
  let pendingHigh = null, pendingLow = null;      // most recent confirmed, unbroken
  let lastHigh    = null, lastLow    = null;      // most recent confirmed, broken or not
  let protectedLow = null, protectedHigh = null;  // advance only on a major BOS

  function pushSwing(sw){
    const last = swings[swings.length - 1];
    if(last && last.kind === sw.kind){
      const moreExtreme = sw.kind === 'high' ? sw.price > last.price : sw.price < last.price;
      if(!moreExtreme) return;
      swings.pop();
      if(pendingHigh === last) pendingHigh = null;
      if(pendingLow  === last) pendingLow  = null;
    }
    let prev = null;
    for(let k = swings.length - 1; k >= 0; k--){
      if(swings[k].kind === sw.kind){ prev = swings[k]; break; }
    }
    sw.label = !prev ? '—'
      : sw.kind === 'high' ? (sw.price > prev.price ? 'HH' : 'LH')
                           : (sw.price > prev.price ? 'HL' : 'LL');
    swings.push(sw);
    if(sw.kind === 'high'){ pendingHigh = sw; lastHigh = sw; }
    else                  { pendingLow  = sw; lastLow  = sw; }
  }

  for(let i = 0; i < candles.length; i++){

    /* 1. confirm the swing sitting N bars back */
    const p = i - N;
    if(p >= 0){
      if(isSwingHigh(candles, p, N)){
        pushSwing({i:p, t:candles[p].t, kind:'high', price:candles[p].h,
                   confirmedAt:i, broken:false, label:null});
      } else if(isSwingLow(candles, p, N)){
        pushSwing({i:p, t:candles[p].t, kind:'low', price:candles[p].l,
                   confirmedAt:i, broken:false, label:null});
      }
    }

    const bar = candles[i];
    const up   = opt.breakOn === 'wick' ? bar.h : bar.c;
    const down = opt.breakOn === 'wick' ? bar.l : bar.c;

    /* 2. minor track — the most recent confirmed swing in each direction */
    const mUp   = pendingHigh && pendingHigh.confirmedAt < i && up   > pendingHigh.price;
    const mDown = pendingLow  && pendingLow.confirmedAt  < i && down < pendingLow.price;

    let mDir = null, mAmbiguous = false;
    if(mUp && mDown){ mAmbiguous = true; mDir = bar.c >= bar.o ? 'bull' : 'bear'; }
    else if(mUp)   mDir = 'bull';
    else if(mDown) mDir = 'bear';

    if(mDir === 'bull'){
      minor.push({i, t:bar.t, scope:'minor',
                  type: minorBias === 'bear' ? 'CHoCH' : 'BOS', dir:'bull',
                  level:pendingHigh.price, brokeSwingAt:pendingHigh.i, ambiguous:mAmbiguous});
      pendingHigh.broken = true; pendingHigh = null; minorBias = 'bull';
    } else if(mDir === 'bear'){
      minor.push({i, t:bar.t, scope:'minor',
                  type: minorBias === 'bull' ? 'CHoCH' : 'BOS', dir:'bear',
                  level:pendingLow.price, brokeSwingAt:pendingLow.i, ambiguous:mAmbiguous});
      pendingLow.broken = true; pendingLow = null; minorBias = 'bear';
    }

    /* 3. major track — a BOS extends the leg and drags the protected level up
          behind it; only the protected level can end the leg. */
    if(bias === 'bull'){
      if(mDir === 'bull'){
        major.push({i, t:bar.t, scope:'major', type:'BOS', dir:'bull',
                    level:minor[minor.length-1].level, protectedNow:lastLow ? lastLow.price : null});
        if(lastLow) protectedLow = lastLow;
      } else if(protectedLow && down < protectedLow.price){
        major.push({i, t:bar.t, scope:'major', type:'CHoCH', dir:'bear',
                    level:protectedLow.price, brokeSwingAt:protectedLow.i});
        bias = 'bear'; protectedHigh = lastHigh; protectedLow = null;
      }
    } else if(bias === 'bear'){
      if(mDir === 'bear'){
        major.push({i, t:bar.t, scope:'major', type:'BOS', dir:'bear',
                    level:minor[minor.length-1].level, protectedNow:lastHigh ? lastHigh.price : null});
        if(lastHigh) protectedHigh = lastHigh;
      } else if(protectedHigh && up > protectedHigh.price){
        major.push({i, t:bar.t, scope:'major', type:'CHoCH', dir:'bull',
                    level:protectedHigh.price, brokeSwingAt:protectedHigh.i});
        bias = 'bull'; protectedLow = lastLow; protectedHigh = null;
      }
    } else if(mDir){
      /* bootstrap: the first break in either direction sets the leg */
      bias = mDir;
      major.push({i, t:bar.t, scope:'major', type:'BOS', dir:mDir,
                  level:minor[minor.length-1].level});
      if(mDir === 'bull') protectedLow = lastLow; else protectedHigh = lastHigh;
    }

    /* 4. sweeps — wick through, close back inside. Mutually exclusive with a
          break by construction. A sweep of the protected level is the one that
          matters: liquidity taken at the level defending the whole leg. */
    if(!mDir){
      if(pendingHigh && pendingHigh.confirmedAt < i &&
         bar.h > pendingHigh.price && bar.c <= pendingHigh.price){
        sweeps.push({i, t:bar.t, side:'bearish', level:pendingHigh.price,
                     sweptSwingAt:pendingHigh.i, penetration:bar.h - pendingHigh.price,
                     isProtected: !!(protectedHigh && protectedHigh.i === pendingHigh.i)});
      }
      if(pendingLow && pendingLow.confirmedAt < i &&
         bar.l < pendingLow.price && bar.c >= pendingLow.price){
        sweeps.push({i, t:bar.t, side:'bullish', level:pendingLow.price,
                     sweptSwingAt:pendingLow.i, penetration:pendingLow.price - bar.l,
                     isProtected: !!(protectedLow && protectedLow.i === pendingLow.i)});
      }
    }
  }

  return {
    swings, minor, major, sweeps,
    bias, minorBias,
    protectedLow : protectedLow  ? protectedLow.price  : null,
    protectedHigh: protectedHigh ? protectedHigh.price : null,
    opt
  };
}

/* --- §6 consolidation ------------------------------------------------------
   Both label families present across the recent window, and no major BOS over
   the same span. Flagged as an open question in SPEC.md. */

function isConsolidating(res, window){
  const w = window || 4;
  const recent = res.swings.slice(-w);
  if(recent.length < w) return false;
  const labels = recent.map(s => s.label);
  if(!(labels.some(l => l === 'HH' || l === 'HL') &&
       labels.some(l => l === 'LL' || l === 'LH'))) return false;
  const from = recent[0].i;
  return !res.major.some(e => e.type === 'BOS' && e.i >= from);
}

function describe(res){
  const stamp = t => typeof t === 'number' && t > 1e11
    ? new Date(t).toISOString().slice(0,16).replace('T',' ') : String(t);
  const rows = [];
  res.swings.forEach(s => rows.push({k:s.confirmedAt, i:s.i, line:
    `${stamp(s.t)}  swing ${s.kind === 'high' ? 'high' : 'low '}  ` +
    `${String(s.price).padStart(10)}  ${s.label}${s.broken ? '  (broken)' : ''}`}));
  res.major.forEach(e => rows.push({k:e.i, i:e.i, line:
    `${stamp(e.t)}  MAJOR ${e.type.padEnd(5)} ${e.dir.padEnd(4)} through ${String(e.level).padStart(10)}`}));
  res.minor.forEach(e => rows.push({k:e.i, i:e.i, line:
    `${stamp(e.t)}  minor ${e.type.padEnd(5)} ${e.dir.padEnd(4)} through ${String(e.level).padStart(10)}`}));
  res.sweeps.forEach(s => rows.push({k:s.i, i:s.i, line:
    `${stamp(s.t)}  sweep ${s.side.padEnd(8)} of ${String(s.level).padStart(10)}` +
    `${s.isProtected ? '  [PROTECTED]' : ''}`}));
  rows.sort((a,b) => a.k - b.k || a.i - b.i);
  return rows.map(r => r.line).join('\n');
}

const API = {analyze, isConsolidating, describe, isSwingHigh, isSwingLow, DEFAULTS};
if(typeof module !== 'undefined' && module.exports) module.exports = API;
if(typeof window !== 'undefined') window.Structure = API;
