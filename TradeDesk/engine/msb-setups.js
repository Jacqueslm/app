'use strict';
/* =============================================================================
   The other two setups — measured before anything is wired into the bot.

   Setup A (aligned continuation) already lives in msb-sweep.js and produces
   about 1.2 trades a month. These are the two that account for the rest of a
   2-4 trade week, and neither can exist in the current bot: one is explicitly
   counter-trend so the alignment gate rejects it by definition, and the other
   needs a concept of a range that nothing in the codebase has.

   Both are built from swing highs and swing lows and nothing else. No ATR, no
   ADX, no efficiency ratio, no volume, no institutional anything. Where a
   "narrow" range has to be judged, it is judged against the market's own
   preceding range, which is still just highs and lows.

   THE STOP IS THE POINT. Both setups execute on the 5m or 15m and put the stop
   on the SAME timeframe - just past the bar that did the rejecting, or the far
   side of the box. Placing a 5m entry's stop behind a 1H swing is what turns a
   small target and a large stop into a break-even record: you end up risking a
   1H swing to make a 5m one. That is the whole 3-to-1 inversion, and it is a
   stop-placement problem rather than a discipline problem.
   ========================================================================== */

const path = require('path');
const {load} = require('./csv');
const {structure, etStamp} = require('./msb-sweep');

const MIN = 60e3;

/* Every confirmed swing on the reference timeframe becomes a level, stamped
   with the moment it became knowable (pvR bars after it formed). A level dies
   when price CLOSES through it — at that point it is not a level any more, it
   is just a price something went past. */
function levelsFrom(c, pv, tfMs){
  const S = structure(c, pv, pv);
  const out = [];
  let lastH = NaN, lastL = NaN;
  for(let i = 0; i < c.length; i++){
    if(S.pivHi[i] !== lastH && !isNaN(S.pivHi[i])){ lastH = S.pivHi[i]; out.push({p: lastH, t: c[i].t + tfMs, k: 'H'}); }
    if(S.pivLo[i] !== lastL && !isNaN(S.pivLo[i])){ lastL = S.pivLo[i]; out.push({p: lastL, t: c[i].t + tfMs, k: 'L'}); }
  }
  return out.sort((a, b) => a.t - b.t);
}

/* ── Setup B: rejection at a level (this is the counter-trend scalp) ────────
   Price reaches a reference high, fails to close above it, and closes back
   below. That failure is the whole signal — a level being answered, on the
   record, in a closed candle. Stop just past the failure's extreme; target the
   previous swing the other way, which is what "next previous high or low"
   means when you say it. */
function runRejection(exec, execET, levels, opt){
  const pv = opt.pv ?? 3, buf = (opt.stopTicks ?? 4) * 0.25;
  const S = structure(exec, pv, pv);
  const maxPerDay = opt.maxPerDay ?? 2, minR = opt.minR ?? 1.0;
  const sessFrom = opt.sessFrom ?? 930, sessTo = opt.sessTo ?? 1500;
  const trades = [];
  let live = [], li = 0, day = '', took = 0, open = null;
  const g = {touch: 0, reject: 0, noTarget: 0, thinR: 0, rejDay: 0, rejSess: 0, taken: 0};

  for(let i = 0; i < exec.length; i++){
    const c = exec[i], et = execET[i], tClose = c.t + (opt.tfMs || 15 * MIN);
    if(et.date !== day){ day = et.date; took = 0; }

    if(open){ const r = step(open, c); if(r){ trades.push(r); open = null; } }
    if(open && et.hm >= sessTo){ trades.push(closeAt(open, c.c)); open = null; }

    while(li < levels.length && levels[li].t <= tClose) live.push(levels[li++]);
    if(live.length > 40) live = live.slice(-40);

    // A close through a level retires it. Do this AFTER testing for rejection
    // so the rejection bar itself is still allowed to trade.
    const rejects = [];
    for(const L of live){
      if(L.k === 'H' && c.h >= L.p && c.c < L.p) rejects.push({L, dir: -1});
      if(L.k === 'L' && c.l <= L.p && c.c > L.p) rejects.push({L, dir: 1});
    }
    if(rejects.length) g.touch++;
    live = live.filter(L => !(L.k === 'H' && c.c > L.p) && !(L.k === 'L' && c.c < L.p));

    if(!rejects.length || open) continue;
    g.reject++;
    if(took >= maxPerDay){ g.rejDay++; continue; }
    if(et.hm < sessFrom || et.hm > sessTo){ g.rejSess++; continue; }

    const {dir} = rejects[0];
    const entry = c.c;
    const stop = dir === 1 ? c.l - buf : c.h + buf;
    const risk = Math.abs(entry - stop);
    // Target: the previous swing the other way, on THIS timeframe.
    const tgt = dir === 1 ? S.pivHi[i] : S.pivLo[i];
    if(!(risk > 0) || isNaN(tgt) || (dir === 1 ? tgt <= entry : tgt >= entry)){ g.noTarget++; continue; }
    const room = Math.abs(tgt - entry) / risk;
    if(room < minR){ g.thinR++; continue; }

    g.taken++; took++;
    open = {dir, entry, stop, risk, room, T1: dir === 1 ? entry + risk : entry - risk, T2: tgt, t1: false, R: 0};
  }
  return {trades, g};
}

/* ── Setup C: the break of a consolidation ──────────────────────────────────
   A box is the highest high and lowest low of the last K bars. It counts as
   consolidation when it is materially tighter than the K bars before it —
   which is a comparison of highs and lows against highs and lows, not an
   indicator. The break is a close outside the box; the stop is the far side,
   so the box's own height is the risk. */
function runBreakout(exec, execET, opt){
  const K = opt.box ?? 12, tight = opt.tight ?? 0.6, buf = (opt.stopTicks ?? 4) * 0.25;
  // Stop at the far side of the box, with a target of one box height, is a 1:1
  // BY CONSTRUCTION - and slightly under it once the buffer is added, which is
  // why that version never passes a 1R filter. The box has to be exited either
  // on a tighter stop (the broken edge) or toward a real level further out.
  const stopMode = opt.stopMode ?? 'far';      // 'far' = other side of box, 'edge' = the broken edge
  const tgtMode  = opt.tgtMode  ?? 'box';      // 'box' = one box height, 'level' = next opposing swing
  const S = structure(exec, opt.pv ?? 3, opt.pv ?? 3);
  const maxPerDay = opt.maxPerDay ?? 2, minR = opt.minR ?? 1.0;
  const sessFrom = opt.sessFrom ?? 930, sessTo = opt.sessTo ?? 1500;
  const trades = [];
  let day = '', took = 0, open = null, cooldown = 0;
  const g = {boxes: 0, breaks: 0, thinR: 0, rejDay: 0, rejSess: 0, taken: 0};

  for(let i = 2 * K; i < exec.length; i++){
    const c = exec[i], et = execET[i];
    if(et.date !== day){ day = et.date; took = 0; }
    if(open){ const r = step(open, c); if(r){ trades.push(r); open = null; cooldown = K; } }
    if(open && et.hm >= sessTo){ trades.push(closeAt(open, c.c)); open = null; }
    if(cooldown > 0) cooldown--;
    if(open || cooldown > 0) continue;

    let hi = -Infinity, lo = Infinity, phi = -Infinity, plo = Infinity;
    for(let k = i - K; k < i; k++){ hi = Math.max(hi, exec[k].h); lo = Math.min(lo, exec[k].l); }
    for(let k = i - 2 * K; k < i - K; k++){ phi = Math.max(phi, exec[k].h); plo = Math.min(plo, exec[k].l); }
    const h = hi - lo, ph = phi - plo;
    if(!(h > 0 && ph > 0 && h < tight * ph)) continue;   // not a consolidation
    g.boxes++;

    const dir = c.c > hi ? 1 : c.c < lo ? -1 : 0;
    if(!dir) continue;
    g.breaks++;
    if(took >= maxPerDay){ g.rejDay++; continue; }
    if(et.hm < sessFrom || et.hm > sessTo){ g.rejSess++; continue; }

    const entry = c.c;
    const stop = stopMode === 'edge'
      ? (dir === 1 ? hi - buf : lo + buf)          // just back inside the broken edge
      : (dir === 1 ? lo - buf : hi + buf);         // the far side of the box
    const risk = Math.abs(entry - stop);
    let tgt;
    if(tgtMode === 'level'){
      tgt = dir === 1 ? S.pivHi[i] : S.pivLo[i];   // the next previous high or low
      if(isNaN(tgt) || (dir === 1 ? tgt <= entry : tgt >= entry)) tgt = dir === 1 ? entry + h : entry - h;
    } else tgt = dir === 1 ? entry + h : entry - h;
    const room = risk > 0 ? Math.abs(tgt - entry) / risk : 0;
    if(!(risk > 0) || room < minR){ g.thinR++; continue; }

    g.taken++; took++;
    open = {dir, entry, stop, risk, room, T1: dir === 1 ? entry + risk : entry - risk, T2: tgt, t1: false, R: 0};
  }
  return {trades, g};
}

/* Shared bracket: half at 1R then break-even, the rest at target. If the stop
   and a target are both inside one bar, the stop is assumed to have gone
   first — the pessimistic reading, because the other one flatters everything. */
function step(o, c){
  const L = o.dir === 1;
  if(L ? c.l <= o.stop : c.h >= o.stop){ o.R += o.t1 ? 0 : -1; return {R: o.R, how: o.t1 ? 'BE' : 'stop'}; }
  const hitT1 = !o.t1 && (L ? c.h >= o.T1 : c.l <= o.T1);
  const hitT2 = L ? c.h >= o.T2 : c.l <= o.T2;
  if(hitT1 && hitT2){ o.R += 0.5 + 0.5 * o.room; return {R: o.R, how: 'T2'}; }
  if(hitT1){ o.t1 = true; o.R += 0.5; o.stop = o.entry; }
  if(hitT2 && o.t1){ o.R += 0.5 * o.room; return {R: o.R, how: 'T2'}; }
  return null;
}
const closeAt = (o, px) => {
  const r = (o.dir === 1 ? px - o.entry : o.entry - px) / o.risk;
  o.R += (o.t1 ? 0.5 : 1) * r; return {R: o.R, how: 'EOD'};
};

function stats(trades, months, riskPct){
  const n = trades.length;
  if(!n) return {n: 0};
  let sum = 0, wins = 0, eq = 1, peak = 1, dd = 0, streak = 0, maxStreak = 0;
  for(const t of trades){
    sum += t.R; if(t.R > 0) wins++;
    if(t.R < 0){ streak++; maxStreak = Math.max(maxStreak, streak); } else streak = 0;
    eq *= (1 + riskPct / 100 * t.R); peak = Math.max(peak, eq); dd = Math.max(dd, (peak - eq) / peak);
  }
  return {n, win: wins / n * 100, exp: sum / n, totR: sum, perWk: n / (months * 4.345),
          eq, ddPct: dd * 100, maxStreak};
}

function prepExec(file, tfMs){
  const c = load(path.join(__dirname, '..', 'data', file));
  return {c, et: c.map(x => etStamp(x.t)), tfMs,
          months: (c[c.length - 1].t - c[0].t) / (30.44 * 24 * 3600e3),
          span: `${new Date(c[0].t).toISOString().slice(0,10)} → ${new Date(c[c.length-1].t).toISOString().slice(0,10)}`};
}

module.exports = {levelsFrom, runRejection, runBreakout, stats, prepExec};
