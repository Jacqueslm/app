'use strict';
/* ---------------------------------------------------------------------------
   Market structure engine — swings, HH/HL/LH/LL, BOS, CHoCH, sweeps.

   Pure price action. No indicators, no averages, no smoothing. Inputs are
   open/high/low/close/time and nothing else.

   Causal by construction: a swing at bar i is not visible to the engine until
   bar i+N has closed, so every level it acts on was knowable at the time. See
   SPEC.md for the definitions this implements.
   --------------------------------------------------------------------------- */

const DEFAULTS = {
  fractalN : 2,        // bars required either side to confirm a swing
  breakOn  : 'close'   // 'close' | 'wick' — see SPEC.md §4, open question 2
};

/* --- §2 swing points -------------------------------------------------------
   Strict on the left, non-strict on the right, so a double top resolves to
   the first bar rather than printing twice or not at all. */

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

/* --- main pass -------------------------------------------------------------
   One chronological walk. At each bar we first confirm any swing that became
   knowable on this bar, then test the bar's break against the levels that were
   already confirmed. Order matters: a swing cannot be broken by the same bar
   that confirms it. */

function analyze(candles, options){
  const opt = Object.assign({}, DEFAULTS, options || {});
  const N = opt.fractalN;

  const swings = [];   // alternating, confirmed chain
  const events = [];   // BOS / CHoCH
  const sweeps = [];   // §5

  let bias = null;             // 'bull' | 'bear' | null
  let pendingHigh = null;      // most recent confirmed, unbroken swing high
  let pendingLow  = null;      // most recent confirmed, unbroken swing low

  /* Append to the alternating chain, collapsing same-kind runs into the more
     extreme swing (§2 alternation), then label against the previous swing of
     the same kind (§3). */
  function pushSwing(sw){
    const last = swings[swings.length - 1];

    if(last && last.kind === sw.kind){
      const moreExtreme = sw.kind === 'high' ? sw.price > last.price : sw.price < last.price;
      if(!moreExtreme) return null;          // keep the one already there
      swings.pop();                          // replace it
      if(last.kind === 'high' && pendingHigh === last) pendingHigh = null;
      if(last.kind === 'low'  && pendingLow  === last) pendingLow  = null;
    }

    let prev = null;
    for(let k = swings.length - 1; k >= 0; k--){
      if(swings[k].kind === sw.kind){ prev = swings[k]; break; }
    }
    sw.label = !prev ? '—'
      : sw.kind === 'high' ? (sw.price > prev.price ? 'HH' : 'LH')
                           : (sw.price > prev.price ? 'HL' : 'LL');

    swings.push(sw);
    if(sw.kind === 'high') pendingHigh = sw; else pendingLow = sw;
    return sw;
  }

  for(let i = 0; i < candles.length; i++){

    /* 1. confirm the swing that sits N bars back, if there is one */
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

    /* 2. test this bar against confirmed, unbroken levels */
    const bar = candles[i];
    const upLevel   = opt.breakOn === 'wick' ? bar.h : bar.c;
    const downLevel = opt.breakOn === 'wick' ? bar.l : bar.c;

    const brokeUp   = pendingHigh && pendingHigh.confirmedAt < i && upLevel   > pendingHigh.price;
    const brokeDown = pendingLow  && pendingLow.confirmedAt  < i && downLevel < pendingLow.price;

    /* One bar can close beyond both. Resolve by body direction and flag it
       rather than silently picking one (SPEC.md §4). */
    let ambiguous = false, dir = null;
    if(brokeUp && brokeDown){
      ambiguous = true;
      dir = bar.c >= bar.o ? 'bull' : 'bear';
    } else if(brokeUp)   dir = 'bull';
    else if(brokeDown)   dir = 'bear';

    if(dir === 'bull'){
      const type = bias === 'bear' ? 'CHoCH' : 'BOS';
      events.push({i, t:bar.t, type, dir:'bull', level:pendingHigh.price,
                   brokeSwingAt:pendingHigh.i, ambiguous});
      pendingHigh.broken = true;
      pendingHigh = null;
      bias = 'bull';
    } else if(dir === 'bear'){
      const type = bias === 'bull' ? 'CHoCH' : 'BOS';
      events.push({i, t:bar.t, type, dir:'bear', level:pendingLow.price,
                   brokeSwingAt:pendingLow.i, ambiguous});
      pendingLow.broken = true;
      pendingLow = null;
      bias = 'bear';
    }

    /* 3. sweeps (§5) — wick through, close back inside. Mutually exclusive
       with a break by construction, so this only runs when no break fired. */
    if(!dir){
      if(pendingHigh && pendingHigh.confirmedAt < i &&
         bar.h > pendingHigh.price && bar.c <= pendingHigh.price){
        sweeps.push({i, t:bar.t, side:'bearish', level:pendingHigh.price,
                     sweptSwingAt:pendingHigh.i, penetration:bar.h - pendingHigh.price});
      }
      if(pendingLow && pendingLow.confirmedAt < i &&
         bar.l < pendingLow.price && bar.c >= pendingLow.price){
        sweeps.push({i, t:bar.t, side:'bullish', level:pendingLow.price,
                     sweptSwingAt:pendingLow.i, penetration:pendingLow.price - bar.l});
      }
    }
  }

  return {swings, events, sweeps, bias, opt};
}

/* --- §6 consolidation ------------------------------------------------------
   Both label families present across the recent window, and no BOS across the
   same span. Flagged as an open question in SPEC.md — this is a reading of
   "HH HL LL LH", not a settled rule. */

function isConsolidating(res, window){
  const w = window || 4;
  const recent = res.swings.slice(-w);
  if(recent.length < w) return false;

  const labels = recent.map(s => s.label);
  const bullish = labels.some(l => l === 'HH' || l === 'HL');
  const bearish = labels.some(l => l === 'LL' || l === 'LH');
  if(!(bullish && bearish)) return false;

  const from = recent[0].i;
  return !res.events.some(e => e.type === 'BOS' && e.i >= from);
}

/* --- readable timeline, for checking output against a real chart ---------- */

function describe(res, candles){
  const stamp = t => typeof t === 'number' && t > 1e11
    ? new Date(t).toISOString().slice(0,16).replace('T',' ')
    : String(t);
  const rows = [];

  res.swings.forEach(s => rows.push({
    i: s.i, sort: s.confirmedAt,
    line: `${stamp(s.t)}  swing ${s.kind === 'high' ? 'high' : 'low '}  ` +
          `${String(s.price).padStart(10)}  ${s.label}` +
          (s.broken ? '  (broken)' : '')
  }));
  res.events.forEach(e => rows.push({
    i: e.i, sort: e.i,
    line: `${stamp(e.t)}  ${e.type.padEnd(5)} ${e.dir.padEnd(4)} ` +
          `through ${String(e.level).padStart(10)}` + (e.ambiguous ? '  [ambiguous bar]' : '')
  }));
  res.sweeps.forEach(s => rows.push({
    i: s.i, sort: s.i,
    line: `${stamp(s.t)}  sweep ${s.side.padEnd(8)} of ${String(s.level).padStart(10)}  ` +
          `by ${s.penetration.toFixed(4)}`
  }));

  rows.sort((a,b) => a.sort - b.sort || a.i - b.i);
  return rows.map(r => r.line).join('\n');
}

const API = {analyze, isConsolidating, describe, isSwingHigh, isSwingLow, DEFAULTS};
if(typeof module !== 'undefined' && module.exports) module.exports = API;
if(typeof window !== 'undefined') window.Structure = API;
