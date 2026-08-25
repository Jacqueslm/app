'use strict';
/* =============================================================================
   HOW HE SEES PRICE — one pattern, straightened up.

   Long (short is the mirror):
     1  a high, a HIGHER LOW, then a HIGHER HIGH        - the up leg on record
     2  pullback: a low, then a LOWER HIGH under the HH
     3  price BREAKS the higher low                     - the shakeout
     4  price closes BACK ABOVE the lower high          -> ENTER
     5  stop under the breakdown low (the 15m swing when it is tighter)
     6  target: the HH - taken in full, or at 60-80% of the way there

   Nothing else. No Daily, no indicators. The 4H shows the same pattern bigger;
   this runs wherever it is pointed - the 1H by default.
   ========================================================================== */

const path = require('path');
const {load} = require('./csv');
const {structure, alignIndex, etStamp, HOUR} = require('./msb-sweep');

function run(D, opt) {
  const {exec, execET} = D;
  const buf = (opt.stopTicks ?? 4) * (opt.tick ?? 0.25);
  const maxPerDay = opt.maxPerDay ?? 2;
  const sessFrom = opt.sessFrom ?? 930, sessTo = opt.sessTo ?? 1500;
  const useT1 = opt.useT1 !== false;
  const stop15 = opt.stop15 === true;
  const tgtPct = opt.tgtPct ?? 0.7;              // 0.6-0.8 of the way to the HH; 1.0 = the HH itself
  const entryRetest = opt.entryRetest === true;  // enter on the retest of the LH, not the reclaim close
  const expireBars = opt.expireBars ?? 400;
  const minRoom = opt.minRoom ?? 1.0;
  const S = D.S;                                  // big-swing structure on the exec chart

  // state per direction: 0 watching · 1 HL broken (shakeout live) - waiting the reclaim
  const st = {
    L: {on: 0, pend: 0, HH: NaN, HL: NaN, LH: NaN, ext: NaN, age: 0},
    S: {on: 0, pend: 0, HH: NaN, HL: NaN, LH: NaN, ext: NaN, age: 0}
  };

  let day = '', took = 0, open = null, evPtr = 0;
  const g = {arm: 0, break_: 0, reclaim: 0, blockedOpen: 0, blockedDay: 0, blockedSess: 0, rejRisk: 0, rejTgt: 0, rejRoom: 0, roomSum: 0, roomN: 0, entered: 0};
  const hist = {H: [], L: []};
  const arm = {L: null, S: null};
  const trades = [];

  for (let i = 0; i < exec.length; i++) {
    const c = exec[i], et = execET[i];
    if (et.date !== day) { day = et.date; took = 0; }

    if (open) {
      const L = open.dir === 1, half = useT1 ? 0.5 : 0;
      if (L ? c.l <= open.stop : c.h >= open.stop) {
        open.R += open.t1 ? 0 : -1;
        trades.push({R: open.R, how: open.t1 ? 'BE' : 'stop', t: open.tIn, feat: open.feat}); open = null;
      } else {
        const hitT1 = half && !open.t1 && (L ? c.h >= open.T1 : c.l <= open.T1);
        const hitT2 = L ? c.h >= open.T2 : c.l <= open.T2;
        if (hitT1 && hitT2) { open.R += half + (1 - half) * open.room; trades.push({R: open.R, how: 'T2', t: open.tIn, feat: open.feat}); open = null; }
        else {
          if (hitT1) { open.t1 = true; open.R += half; open.stop = open.entry; }
          if (open && hitT2 && (open.t1 || !half)) { open.R += (open.t1 ? 1 - half : 1) * open.room; trades.push({R: open.R, how: 'T2', t: open.tIn, feat: open.feat}); open = null; }
        }
      }
      if (open && et.hm >= sessTo) {
        const px = c.c, r = (open.dir === 1 ? px - open.entry : open.entry - px) / open.risk;
        open.R += (open.t1 ? (useT1 ? 0.5 : 1) : 1) * r;
        trades.push({R: open.R, how: 'EOD', t: open.tIn, feat: open.feat}); open = null;
      }
    }

    // ingest every swing that became knowable by this bar's close
    while (evPtr < D.events.length && D.events[evPtr].at <= i) {
      const e = D.events[evPtr++];
      if (e.t === 'H') { hist.H.push(e.px); if (hist.H.length > 8) hist.H.shift(); }
      else             { hist.L.push(e.px); if (hist.L.length > 8) hist.L.shift(); }
      // a NEW swing high that is a lower high re-arms the long side, and the
      // mirror re-arms the short side - read off the tape, not a snapshot
      if (e.t === 'H' && hist.H.length >= 3 && hist.L.length >= 2) {
        const [Hd, HH, LH] = hist.H.slice(-3);
        const [pL, HL] = hist.L.slice(-2);
        if (HH > Hd && HL > pL && LH < HH && LH > HL)
          { arm.L = {HH, LH, HL}; g.arm++; }
      }
      if (e.t === 'L' && hist.L.length >= 3 && hist.H.length >= 2) {
        const [Ld, LL, HL2] = hist.L.slice(-3);
        const [pH, LH2] = hist.H.slice(-2);
        if (LL < Ld && LH2 < pH && HL2 > LL && HL2 < LH2)
          { arm.S = {HH: LL, LH: HL2, HL: LH2}; g.arm++; }
      }
    }

    step(st.L, 1); step(st.S, -1);

    function step(s, dir) {
      const up = dir === 1;
      if (s.on && ++s.age > expireBars) { s.on = 0; s.pend = 0; return; }

      if (!s.on) {
        const a = up ? arm.L : arm.S;
        if (!a) return;
        // the shakeout: price breaks the higher low
        if (up ? c.l < a.HL : c.h > a.HL) {
          g.break_++;
          s.on = 1; s.HH = a.HH; s.LH = a.LH; s.HL = a.HL;
          s.ext = up ? c.l : c.h; s.age = 0;
          if (up) arm.L = null; else arm.S = null;
        }
        return;
      }

      // shakeout live: track its extreme, wait for the reclaim of the LH
      s.ext = up ? Math.min(s.ext, c.l) : Math.max(s.ext, c.h);
      // if it instead runs to a close beyond the HH, the chance is gone
      if (up ? c.c > s.HH : c.c < s.HH) { s.on = 0; s.pend = 0; return; }

      // retest entry: the reclaim happened earlier; fill when price comes back
      // to the lower high. Better price, tighter risk - the retest is the trade.
      if (entryRetest && s.pend) {
        if (up ? c.l <= s.LH : c.h >= s.LH) {
          if (!open && took < maxPerDay && et.hm >= sessFrom && et.hm <= sessTo) {
            s.on = 0; s.pend = 0;
            enter(up ? 1 : -1, s.LH, s);
          }
        }
        return;
      }

      if (up ? c.c > s.LH : c.c < s.LH) {
        g.reclaim++;
        if (entryRetest) { s.pend = 1; return; }
        // THE ENTRY: the first close back above the lower high that the rules
        // allow. An overnight reclaim WAITS for the session instead of dying -
        // the abort on a close beyond the HH already caps how far it can run.
        if (open) { g.blockedOpen++; return; }
        if (took >= maxPerDay) { g.blockedDay++; return; }
        if (et.hm < sessFrom || et.hm > sessTo) { g.blockedSess++; return; }
        s.on = 0;
        enter(dir, c.c, s);
      }

      function enter(d, entry, s2) {
        const u = d === 1;
        let anchor = s2.ext;
        if (stop15 && D.m15) {
          const mj = D.m15.map[i];
          if (mj >= 0) {
            const p15 = u ? D.m15.S.pivLo[mj] : D.m15.S.pivHi[mj];
            if (!isNaN(p15) && (u ? (p15 > anchor && p15 < entry) : (p15 < anchor && p15 > entry))) anchor = p15;
          }
        }
        const stop = u ? anchor - buf : anchor + buf;
        const risk = Math.abs(entry - stop);
        if (!(risk > 0)) { g.rejRisk++; return; }
        const tgt = u ? entry + tgtPct * (s2.HH - entry) : entry - tgtPct * (entry - s2.HH);
        if (u ? tgt <= entry : tgt >= entry) { g.rejTgt++; return; }
        const room = Math.abs(tgt - entry) / risk;
        g.roomSum += room; g.roomN++;
        if (room < minRoom) { g.rejRoom++; return; }
        took++; g.entered++;
        // features for the analysis layer: how fast the reclaim came, how deep
        // the shakeout went relative to the wave, and when it fired (ET hour)
        const depth = Math.abs(s2.HH - s2.LH) > 0 ? Math.abs(s2.LH - s2.ext) / Math.abs(s2.HH - s2.ext) : NaN;
        open = {dir: d, entry, stop, risk, room, t1: false, R: 0, tIn: c.t,
                feat: {bars: s2.age, depth, hr: Math.floor(et.hm / 100), room},
                T1: u ? entry + risk : entry - risk, T2: tgt};
      }
    }
  }
  trades.gates = g;
  return trades;
}

/* structure() keeps only the latest swing; the pattern needs the one before
   it too, so track both. */
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
  const exec = load(path.join(dir, files.exec));
  const execTfMs = opt.execTfMs ?? HOUR;
  const execET = exec.map(c => etStamp(c.t));
  const closeT = exec.map(c => c.t + execTfMs);
  let m15 = null;
  if (files.m15) {
    const m = load(path.join(dir, files.m15));
    m15 = {S: structure2(m, opt.pv15 ?? 3), map: alignIndex(closeT, m, 15 * 60e3)};
  }
  const S = structure2(exec, opt.pv ?? 5);
  // the swing tape: every confirmed swing, in the order it became knowable
  const events = [];
  {
    let h = NaN, l = NaN;
    for (let i = 0; i < exec.length; i++) {
      if (!isNaN(S.pivHi[i]) && S.pivHi[i] !== h) { h = S.pivHi[i]; events.push({t: 'H', px: h, at: i}); }
      if (!isNaN(S.pivLo[i]) && S.pivLo[i] !== l) { l = S.pivLo[i]; events.push({t: 'L', px: l, at: i}); }
    }
  }
  return {
    exec, execET, m15, events,
    S,
    months: (exec[exec.length - 1].t - exec[0].t) / (30.44 * 24 * HOUR),
    span: `${new Date(exec[0].t).toISOString().slice(0, 10)} → ${new Date(exec[exec.length - 1].t).toISOString().slice(0, 10)}`
  };
}

module.exports = {run, prep, structure2};
