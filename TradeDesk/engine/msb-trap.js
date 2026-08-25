'use strict';
/* =============================================================================
   THE TRAP — the setup from the drawing, exactly.

   Long version (shorts are the mirror):
     1. Daily makes HH + HL and holds        -> longs only
     2. 4H must not be trending against      -> the map is a consolidation
     3. 1H prints a lower high (LH) under the bigger high H1
     4. Price pokes ABOVE the LH...          -> wick or close, either counts
     5. ...then a 1H close BACK BELOW it     -> the trap. Buyers above are stuck.
        (a close above H1 instead = the move was real. Stand down, no chase.)
     6. Price falls to "something": the last 1H swing low L* below the LH
     7. The trigger chart SWEEPS it: low takes out L*, close back above
     8. The FLIP: a trigger-chart close above its own last lower swing high
     9. ENTER. Stop under the sweep low. Target H1 - the high from BEFORE
        the lower high, never the LH itself.

   Pure structure: every number is a swing high, a swing low, or a close.
   Trigger chart is a parameter: 15m (the real thing) or 1H (long history).
   ========================================================================== */

const path = require('path');
const {load} = require('./csv');
const {structure, alignIndex, etStamp, HOUR} = require('./msb-sweep');
const MIN = 60e3;

function run(D, opt) {
  const {exec, execET, X, H1S, i1h, d1, i4, b4} = D;
  const buf = (opt.stopTicks ?? 4) * (opt.tick ?? 0.25);
  const maxPerDay = opt.maxPerDay ?? 1;
  const sessFrom = opt.sessFrom ?? 930, sessTo = opt.sessTo ?? 1500;
  const useT1 = opt.useT1 !== false;
  const need4hFlat = opt.need4hFlat !== false;   // 4H must not trend against
  const expireBars = opt.expireBars ?? 400;      // trigger-chart bars a trap stays live

  // state per direction:
  //   0 idle · 1 poked beyond the LH (waiting for the failing close)
  //   2 trapped (waiting for the drop to L*) · 3 at the level (sweep+reclaim)
  //   4 swept (waiting for the flip)
  const S = {L: mk(), S: mk()};
  function mk(){ return {st: 0, H1: NaN, LH: NaN, Lstar: NaN, sweepExt: NaN, flipLvl: NaN, age: 0}; }

  let day = '', took = 0, open = null;
  const trades = [];

  for (let i = 0; i < exec.length; i++) {
    const c = exec[i], et = execET[i];
    if (et.date !== day) { day = et.date; took = 0; }

    // manage the open position on this bar's range
    if (open) {
      const L = open.dir === 1, half = useT1 ? 0.5 : 0;
      if (L ? c.l <= open.stop : c.h >= open.stop) {
        open.R += open.t1 ? 0 : -1;
        trades.push({R: open.R, how: open.t1 ? 'BE' : 'stop', t: open.tIn}); open = null;
      } else {
        const hitT1 = half && !open.t1 && (L ? c.h >= open.T1 : c.l <= open.T1);
        const hitT2 = L ? c.h >= open.T2 : c.l <= open.T2;
        if (hitT1 && hitT2) { open.R += half + (1 - half) * open.room; trades.push({R: open.R, how: 'T2', t: open.tIn}); open = null; }
        else {
          if (hitT1) { open.t1 = true; open.R += half; open.stop = open.entry; }
          if (open && hitT2 && (open.t1 || !half)) { open.R += (open.t1 ? 1 - half : 1) * open.room; trades.push({R: open.R, how: 'T2', t: open.tIn}); open = null; }
        }
      }
      if (open && et.hm >= sessTo) {
        const px = c.c, r = (open.dir === 1 ? px - open.entry : open.entry - px) / open.risk;
        open.R += (open.t1 ? (useT1 ? 0.5 : 1) : 1) * r;
        trades.push({R: open.R, how: 'EOD', t: open.tIn}); open = null;
      }
    }

    // structure known at this bar's close
    const j = i1h[i]; if (j < 0) continue;
    const dj = d1.map[i], fj = i4[i]; if (dj < 0 || fj < 0) continue;
    const dT = d1.S.trend[dj], fT = b4.S.trend[fj];

    // ── LONG side ──────────────────────────────────────────────────────────
    stepSide(S.L, 1, dT === 1 && (!need4hFlat || fT >= 0));
    // ── SHORT side ─────────────────────────────────────────────────────────
    stepSide(S.S, -1, dT === -1 && (!need4hFlat || fT <= 0));

    function stepSide(s, dir, allowed) {
      const up = dir === 1;
      // 1H swings as of now
      const hiNow = H1S.pivHi[j], loNow = H1S.pivLo[j];
      const hi2 = H1S.pivHi2[j], lo2 = H1S.pivLo2[j];

      if (!allowed) { s.st = 0; return; }
      if (s.st > 0 && ++s.age > expireBars) { s.st = 0; return; }

      if (s.st === 0) {
        // need: previous swing (H1) and a LOWER one after it (LH), for longs.
        // pivHi = most recent confirmed 1H swing high, pivHi2 = the one before.
        const A = up ? hi2 : lo2;     // H1  (the big one, earlier)
        const B = up ? hiNow : loNow; // LH  (the recent, lower one)
        if (isNaN(A) || isNaN(B)) return;
        if ((up ? B < A : B > A) && (up ? c.h > B : c.l < B)) {
          // the poke: price trades beyond the lower high. Wick or close - either.
          s.st = 1; s.H1 = A; s.LH = B;
          s.Lstar = up ? loNow : hiNow;        // "something": the last 1H swing low
          s.age = 0;
        }
        return;
      }

      // any close beyond H1 = the move was real, no chase, reset
      if (up ? c.c > s.H1 : c.c < s.H1) { s.st = 0; return; }

      if (s.st === 1) {
        // the fail: a CLOSE back on the wrong side of the LH = the trap is set
        if (up ? c.c < s.LH : c.c > s.LH) s.st = 2;
        return;
      }

      if (s.st === 2) {
        if (isNaN(s.Lstar)) { s.st = 0; return; }
        // price must come down and TOUCH the level
        if (up ? c.l <= s.Lstar : c.h >= s.Lstar) { s.st = 3; s.sweepExt = up ? c.l : c.h; }
        return;
      }

      if (s.st === 3) {
        s.sweepExt = up ? Math.min(s.sweepExt, c.l) : Math.max(s.sweepExt, c.h);
        // sweep + reclaim: we went below L* and now CLOSE back above it
        if (up ? (s.sweepExt < s.Lstar && c.c > s.Lstar) : (s.sweepExt > s.Lstar && c.c < s.Lstar)) {
          s.st = 4;
          // the flip level: the trigger chart's own last swing against us
          s.flipLvl = up ? X.pivHi[i] : X.pivLo[i];
        }
        return;
      }

      if (s.st === 4) {
        s.sweepExt = up ? Math.min(s.sweepExt, c.l) : Math.max(s.sweepExt, c.h);
        // keep the flip level fresh: the most recent trigger-chart swing
        const f = up ? X.pivHi[i] : X.pivLo[i];
        if (!isNaN(f) && (up ? f < s.LH : f > s.LH)) s.flipLvl = f;
        // a close back through the level = failed reaction, wait for the next sweep
        if (up ? c.c < s.Lstar : c.c > s.Lstar) { s.st = 3; return; }
        // THE FLIP: close beyond the trigger chart's last opposing swing.
        // Entry only while price hasn't already run back to the LH - no chasing.
        if (isNaN(s.flipLvl)) return;
        if ((up ? c.c > s.flipLvl : c.c < s.flipLvl) && (up ? c.c < s.LH : c.c > s.LH)) {
          if (open || took >= maxPerDay) { s.st = 0; return; }
          if (et.hm < sessFrom || et.hm > sessTo) return;   // wait for the session, setup stays live
          const entry = c.c;
          const stop = up ? s.sweepExt - buf : s.sweepExt + buf;
          const risk = Math.abs(entry - stop);
          const tgt = s.H1;                       // the high BEFORE the lower high
          const room = risk > 0 ? Math.abs(tgt - entry) / risk : 0;
          if (risk > 0 && room >= (opt.minRoom ?? 1.0) && (up ? tgt > entry : tgt < entry)) {
            took++;
            open = {dir, entry, stop, risk, room, t1: false, R: 0, tIn: c.t,
                    T1: up ? entry + risk : entry - risk, T2: tgt};
          }
          s.st = 0;
        }
      }
    }
  }
  return trades;
}

/* structure() only keeps the latest swing; the trap needs the one BEFORE it
   too (H1 vs LH), so track both. */
function structure2(c, pv) {
  const S = structure(c, pv, pv);
  const n = c.length;
  const pivHi2 = new Float64Array(n).fill(NaN), pivLo2 = new Float64Array(n).fill(NaN);
  let h1 = NaN, h2 = NaN, l1 = NaN, l2 = NaN;
  for (let i = 0; i < n; i++) {
    if (!isNaN(S.pivHi[i]) && S.pivHi[i] !== h1) { h2 = h1; h1 = S.pivHi[i]; }
    if (!isNaN(S.pivLo[i]) && S.pivLo[i] !== l1) { l2 = l1; l1 = S.pivLo[i]; }
    pivHi2[i] = h2; pivLo2[i] = l2;
  }
  return Object.assign(S, {pivHi2, pivLo2});
}

function prep(files, opt) {
  const dir = path.join(__dirname, '..', 'data');
  const {resample, resampleDaily} = require('./resample');
  const h1 = load(path.join(dir, files.h1));
  const exec = files.exec === files.h1 ? h1 : load(path.join(dir, files.exec));
  const execTfMs = opt.execTfMs;
  const from = Math.max(h1[0].t, exec[0].t);
  const ex = exec.filter(c => c.t >= from);
  const execET = ex.map(c => etStamp(c.t));
  const closeT = ex.map(c => c.t + execTfMs);
  const b4c = resample(h1, 4 * HOUR), d1c = resampleDaily(h1);
  const pv = opt.pv ?? 3, pvH = opt.pvHtf ?? pv;
  return {
    exec: ex, execET,
    X: structure2(ex, pv),
    H1S: structure2(h1, pvH),
    i1h: alignIndex(closeT, h1, HOUR),
    b4: {S: structure2(b4c, pvH)}, i4: alignIndex(closeT, b4c, 4 * HOUR),
    d1: {S: structure2(d1c, pvH), map: alignIndex(closeT, d1c, 24 * HOUR)},
    months: (ex[ex.length - 1].t - ex[0].t) / (30.44 * 24 * HOUR),
    span: `${new Date(ex[0].t).toISOString().slice(0, 10)} → ${new Date(ex[ex.length - 1].t).toISOString().slice(0, 10)}`
  };
}

module.exports = {run, prep};
