'use strict';
/* His new idea, measured. Long side (short is the mirror):
     1  downtrend on the exec chart: lower highs AND lower lows on the books
     2  BREAK: a close above the last lower high            - structure breaks
     3  price runs up to a high, then COMES BACK
     4  entry on the pullback: at the broken swing level, or a tap 30/50/70%
        into the leg that broke (the "zone" - measured from the leg low)
     5  stop under the leg low; TARGET THE PREVIOUS HIGH - the high the break
        just made, never a projected new one
   Alignment: the higher timeframe's structure must agree with the direction -
   5m trades only with the 1H trend, 15m only with the 4H trend.
   Fills are pessimistic: limit at the level, stop-first when a bar touches
   both, flat at the session close, entries only inside NY hours. */
const path = require('path');
const {load} = require('./csv');
const {structure, alignIndex, etStamp, HOUR} = require('./msb-sweep');

function run(c, et, S, htf, I, opt) {
  const buf = 4 * I.tick;
  const cap = opt.cap ?? 2;
  const pct = opt.pct;                 // null = entry at the broken swing level
  const trades = [];
  // per-direction setup state and the two-deep swing history
  const st = {L: null, S: null};
  const hi = [], lo = [];
  let open = null, day = '', took = 0;

  for (let i = 0; i < c.length; i++) {
    const b = c[i], e = et[i];
    if (e.date !== day) { day = e.date; took = 0; }
    const inSess = e.hm > I.from && e.hm <= I.to;

    // manage an open trade: stop first, then target, flat at the close
    if (open) {
      const L = open.dir === 1;
      let R = null;
      if (L ? b.l <= open.stop : b.h >= open.stop) R = -1;
      else if (L ? b.h >= open.tgt : b.l <= open.tgt) R = open.room;
      else if (e.hm >= I.to) R = ((b.c - open.entry) * open.dir) / open.risk;
      if (R !== null) { trades.push({R}); open = null; }
      if (open) continue;
    }

    // the swing history, as it becomes knowable
    if (!isNaN(S.pivHi[i]) && S.pivHi[i] !== hi[0]) hi.unshift(S.pivHi[i]), hi.length = Math.min(hi.length, 3);
    if (!isNaN(S.pivLo[i]) && S.pivLo[i] !== lo[0]) lo.unshift(S.pivLo[i]), lo.length = Math.min(lo.length, 3);
    if (hi.length < 2 || lo.length < 2) continue;

    const trendUpOK   = htf(i) > 0;    // 1H (or 4H) structure agrees
    const trendDownOK = htf(i) < 0;

    // ── LONG setup ───────────────────────────────────────────────────────────
    let A = st.L;
    if (A) {
      A.age++;
      if (A.phase === 0) {                       // waiting for the run to top out
        A.high = Math.max(A.high, b.h);
        if (b.c < A.level) A.phase = 1;          // it has come back below the broken level: the pullback is on
        else if (A.age > (opt.expire ?? 120)) st.L = null;
      }
      if (A && A.phase === 1) {
        const entry = pct == null ? A.level : A.high - pct * (A.high - A.legLo);
        const stop = A.legLo - buf, risk = entry - stop, room = (A.high - entry) / risk;
        if (b.c < A.legLo) st.L = null;          // leg low gone - no higher low, setup dead
        else if (b.c > A.high) st.L = null;      // ran to new highs without filling - missed
        else if (b.l <= entry && risk > 0 && room > 0.05) {
          st.L = null;
          if (inSess && took < cap && trendUpOK) {
            open = {dir: 1, entry, stop, risk, tgt: A.high, room}; took++;
          }
        } else if (A.age > (opt.expire ?? 120)) st.L = null;
      }
    }
    // arm: downtrend on the books, and a close through the last lower high
    if (!st.L && hi[0] < hi[1] && lo[0] < lo[1] && b.c > hi[0])
      st.L = {level: hi[0], legLo: Math.min(lo[0], b.l), high: b.h, phase: 0, age: 0};

    // ── SHORT setup (the mirror) ─────────────────────────────────────────────
    let Z = st.S;
    if (Z) {
      Z.age++;
      if (Z.phase === 0) {
        Z.low = Math.min(Z.low, b.l);
        if (b.c > Z.level) Z.phase = 1;
        else if (Z.age > (opt.expire ?? 120)) st.S = null;
      }
      if (Z && Z.phase === 1) {
        const entry = pct == null ? Z.level : Z.low + pct * (Z.legHi - Z.low);
        const stop = Z.legHi + buf, risk = stop - entry, room = (entry - Z.low) / risk;
        if (b.c > Z.legHi) st.S = null;
        else if (b.c < Z.low) st.S = null;
        else if (b.h >= entry && risk > 0 && room > 0.05) {
          st.S = null;
          if (inSess && took < cap && trendDownOK) {
            open = {dir: -1, entry, stop, risk, tgt: Z.low, room}; took++;
          }
        } else if (Z.age > (opt.expire ?? 120)) st.S = null;
      }
    }
    if (!st.S && hi[0] > hi[1] && lo[0] > lo[1] && b.c < lo[0])
      st.S = {level: lo[0], legHi: Math.max(hi[0], b.h), low: b.l, phase: 0, age: 0};
  }
  return trades;
}

function stats(tr, months) {
  const n = tr.length; if (!n) return {n};
  let sum = 0, w = 0, s = 0, worst = 0;
  for (const t of tr) { sum += t.R; if (t.R > 0) w++; if (t.R < 0) { s++; worst = Math.max(worst, s); } else s = 0; }
  return {n, win: w / n * 100, exp: sum / n, tot: sum, perMo: n / months, worst};
}

const SETS = [
  {k: 'MES 5m→1H',     exec: 'MES-5m.csv',     htf: 'MES-1h.csv',    htfMs: HOUR,     tfMs: 5*60e3,  tick: 0.25, from: 930, to: 1500},
  {k: 'MES 15m→4H',    exec: 'MES-15m.csv',    htf: 'MES-4h.csv',    htfMs: 4*HOUR,   tfMs: 15*60e3, tick: 0.25, from: 930, to: 1500},
  {k: 'NAS100 15m→4H', exec: 'NAS100-15m.csv', htf: 'NAS100-4h.csv', htfMs: 4*HOUR,   tfMs: 15*60e3, tick: 0.25, from: 930, to: 1500},
  {k: 'XAU 15m→4H',    exec: 'XAU-15m.csv',    htf: 'XAU-4h.csv',    htfMs: 4*HOUR,   tfMs: 15*60e3, tick: 0.10, from: 800, to: 1300},
];

const rows = [];
for (const I of SETS) {
  const dir = path.join(__dirname, '..', 'data');
  const c = load(path.join(dir, I.exec));
  const S = structure(c, 3, 3);
  const et = c.map(x => etStamp(x.t + I.tfMs));
  const h = load(path.join(dir, I.htf));
  const HS = structure(h, 3, 3);
  const map = alignIndex(c.map(x => x.t + I.tfMs), h, I.htfMs);
  const htf = i => { const j = map[i]; return j >= 0 ? HS.trend[j] : 0; };
  const months = (c[c.length-1].t - c[0].t) / (30.44 * 864e5);
  for (const v of [
    {name: 'swing retest', pct: null},
    {name: 'zone 30%', pct: 0.3},
    {name: 'zone 50%', pct: 0.5},
    {name: 'zone 70%', pct: 0.7},
  ]) rows.push({k: I.k, v: v.name, ...stats(run(c, et, S, htf, I, {pct: v.pct, cap: 2}), months)});
}
const H = ['ladder', 'entry', 'trades', '/month', 'win%', 'avg R', 'total R', 'worst run'];
const T = [H, ...rows.map(r => r.n
  ? [r.k, r.v, r.n, r.perMo.toFixed(1), r.win.toFixed(0), r.exp.toFixed(3), r.tot.toFixed(1), r.worst]
  : [r.k, r.v, 0, '-', '-', '-', '-', '-']).map(r => r.map(String))];
const w = H.map((_, i) => Math.max(...T.map(r => r[i].length)));
console.log('\nBreak of structure, pull back to the level/zone, target the previous high\nHTF structure must agree · 2 a day · NY session · flat at the close\n');
T.forEach((r, i) => { console.log(r.map((x, j) => j < 2 ? x.padEnd(w[j]) : x.padStart(w[j])).join('   ')); if (!i) console.log(w.map(x => '-'.repeat(x)).join('---')); });

/* Variant B — the stricter reading: touch the zone, then WAIT for the higher
   low to prove itself (a close back above the previous bar's high). Enter on
   that close, stop under the pullback low itself, target the previous high. */
function runB(c, et, S, htf, I, opt) {
  const buf = 4 * I.tick, cap = 2, pct = opt.pct;
  const trades = []; const hi = [], lo = [];
  const st = {L: null, S: null};
  let open = null, day = '', took = 0;
  for (let i = 1; i < c.length; i++) {
    const b = c[i], p = c[i-1], e = et[i];
    if (e.date !== day) { day = e.date; took = 0; }
    const inSess = e.hm > I.from && e.hm <= I.to;
    if (open) {
      const L = open.dir === 1; let R = null;
      if (L ? b.l <= open.stop : b.h >= open.stop) R = -1;
      else if (L ? b.h >= open.tgt : b.l <= open.tgt) R = open.room;
      else if (e.hm >= I.to) R = ((b.c - open.entry) * open.dir) / open.risk;
      if (R !== null) { trades.push({R}); open = null; }
      if (open) continue;
    }
    if (!isNaN(S.pivHi[i]) && S.pivHi[i] !== hi[0]) hi.unshift(S.pivHi[i]), hi.length = Math.min(hi.length, 3);
    if (!isNaN(S.pivLo[i]) && S.pivLo[i] !== lo[0]) lo.unshift(S.pivLo[i]), lo.length = Math.min(lo.length, 3);
    if (hi.length < 2 || lo.length < 2) continue;
    let A = st.L;
    if (A) {
      A.age++;
      if (A.phase === 0) {
        A.high = Math.max(A.high, b.h);
        if (b.c < A.level) A.phase = 1;
      } else {
        const zone = pct == null ? A.level : A.high - pct * (A.high - A.legLo);
        A.plo = Math.min(A.plo ?? b.l, b.l);
        if (A.plo <= zone) A.tag = 1;                       // the zone got tapped
        if (b.c < A.legLo || b.c > A.high) st.L = null;
        else if (A.tag && b.c > p.h) {                      // the turn: higher low proven
          const entry = b.c, stop = A.plo - buf, risk = entry - stop, room = (A.high - entry) / risk;
          st.L = null;
          if (inSess && took < cap && htf(i) > 0 && risk > 0 && room > 0.05) {
            open = {dir: 1, entry, stop, risk, tgt: A.high, room}; took++;
          }
        }
      }
      if (st.L && A.age > 120) st.L = null;
    }
    if (!st.L && hi[0] < hi[1] && lo[0] < lo[1] && b.c > hi[0])
      st.L = {level: hi[0], legLo: Math.min(lo[0], b.l), high: b.h, phase: 0, age: 0};
    let Z = st.S;
    if (Z) {
      Z.age++;
      if (Z.phase === 0) {
        Z.low = Math.min(Z.low, b.l);
        if (b.c > Z.level) Z.phase = 1;
      } else {
        const zone = pct == null ? Z.level : Z.low + pct * (Z.legHi - Z.low);
        Z.phi = Math.max(Z.phi ?? b.h, b.h);
        if (Z.phi >= zone) Z.tag = 1;
        if (b.c > Z.legHi || b.c < Z.low) st.S = null;
        else if (Z.tag && b.c < p.l) {
          const entry = b.c, stop = Z.phi + buf, risk = stop - entry, room = (entry - Z.low) / risk;
          st.S = null;
          if (inSess && took < cap && htf(i) < 0 && risk > 0 && room > 0.05) {
            open = {dir: -1, entry, stop, risk, tgt: Z.low, room}; took++;
          }
        }
      }
      if (st.S && Z.age > 120) st.S = null;
    }
    if (!st.S && hi[0] > hi[1] && lo[0] > lo[1] && b.c < lo[0])
      st.S = {level: lo[0], legHi: Math.max(hi[0], b.h), low: b.l, phase: 0, age: 0};
  }
  return trades;
}

const rows2 = [];
for (const I of SETS) {
  const dir = path.join(__dirname, '..', 'data');
  const c = load(path.join(dir, I.exec));
  const S = structure(c, 3, 3);
  const et = c.map(x => etStamp(x.t + I.tfMs));
  const h = load(path.join(dir, I.htf));
  const HS = structure(h, 3, 3);
  const map = alignIndex(c.map(x => x.t + I.tfMs), h, I.htfMs);
  const htf = i => { const j = map[i]; return j >= 0 ? HS.trend[j] : 0; };
  const months = (c[c.length-1].t - c[0].t) / (30.44 * 864e5);
  for (const v of [{name: 'HL @ level', pct: null}, {name: 'HL @ 50%', pct: 0.5}, {name: 'HL @ 70%', pct: 0.7}])
    rows2.push({k: I.k, v: v.name, ...stats(runB(c, et, S, htf, I, {pct: v.pct}), months)});
}
const T2 = [H, ...rows2.map(r => r.n
  ? [r.k, r.v, r.n, r.perMo.toFixed(1), r.win.toFixed(0), r.exp.toFixed(3), r.tot.toFixed(1), r.worst]
  : [r.k, r.v, 0, '-', '-', '-', '-', '-']).map(r => r.map(String))];
const w2 = H.map((_, i) => Math.max(...T2.map(r => r[i].length)));
console.log('\nVariant B — wait for the higher low to prove itself, stop under it\n');
T2.forEach((r, i) => { console.log(r.map((x, j) => j < 2 ? x.padEnd(w2[j]) : x.padStart(w2[j])).join('   ')); if (!i) console.log(w2.map(x => '-'.repeat(x)).join('---')); });
