'use strict';
/* His fast ladder, ready to run the moment 1-minute data exists.
   Usage:  node fast-ladder.js <exec.csv> <htf.csv> <htfMinutes> <tickSize> [sessFrom sessTo]
   e.g.    node fast-ladder.js MES-1m.csv MES-1h.csv 60 0.25

   The rules, as he described them:
     1H (or whatever HTF is passed) sets the direction — trade only with it.
     On the exec chart: a downtrend breaks (close through the last lower high),
     price runs up, then comes back to the broken level or a 50% tap of the leg.
     The 5-SECOND TRIGGER, standing in: rather than buying the tap, wait for the
     small structure to turn inside the zone — a close back above the previous
     bar's high. On a 1m chart that close IS the finer break; it is the same
     event a 5s chart shows sooner, and it is the step that measured positive.
     Stop behind the zone. Out at the previous high, or when a lower high prints.
   Fills are pessimistic: stop before target on any bar that touches both. */
const path = require('path');
const {load} = require('./csv');
const {structure, alignIndex, etStamp} = require('./msb-sweep');

const [,, execFile, htfFile, htfMin, tickArg, fromArg, toArg] = process.argv;
if (!execFile || !htfFile) {
  console.log('usage: node fast-ladder.js <exec.csv> <htf.csv> <htfMinutes> <tick> [sessFrom sessTo]');
  process.exit(1);
}
const I = {tick: +(tickArg || 0.25), from: +(fromArg || 930), to: +(toArg || 1500)};
const htfMs = (+(htfMin || 60)) * 60e3;
const dir = path.join(__dirname, '..', 'data');
const c = load(path.join(dir, execFile));
const execMs = c.length > 1 ? c[1].t - c[0].t : 60e3;
const S = structure(c, 3, 3);
const et = c.map(x => etStamp(x.t + execMs));
const h = load(path.join(dir, htfFile));
const HS = structure(h, 3, 3);
const map = alignIndex(c.map(x => x.t + execMs), h, htfMs);
const htf = i => { const j = map[i]; return j >= 0 ? HS.trend[j] : 0; };

function run(opt) {
  const buf = 4 * I.tick, cap = opt.cap ?? 2, pct = opt.pct;
  const trades = []; const hi = [], lo = [];
  const st = {L: null, S: null};
  let open = null, day = '', took = 0;
  for (let i = 1; i < c.length; i++) {
    const b = c[i], p = c[i-1], e = et[i];
    if (e.date !== day) { day = e.date; took = 0; }
    const inSess = e.hm > I.from && e.hm <= I.to;
    const nH = !isNaN(S.pivHi[i]) && S.pivHi[i] !== hi[0] ? S.pivHi[i] : null;
    const nL = !isNaN(S.pivLo[i]) && S.pivLo[i] !== lo[0] ? S.pivLo[i] : null;
    if (open) {
      const L = open.dir === 1; let R = null;
      if (L ? b.l <= open.stop : b.h >= open.stop) R = -1;
      else if (!opt.ride && (L ? b.h >= open.tgt : b.l <= open.tgt)) R = open.room;
      else if (L && nH !== null) { if (open.lastHi !== null && nH < open.lastHi) R = (b.c - open.entry) / open.risk; else open.lastHi = nH; }
      else if (!L && nL !== null) { if (open.lastLo !== null && nL > open.lastLo) R = (open.entry - b.c) / open.risk; else open.lastLo = nL; }
      if (R === null && e.hm >= I.to) R = ((b.c - open.entry) * open.dir) / open.risk;
      if (R !== null) { trades.push({R, riskPts: open.risk}); open = null; }
      if (open) continue;
    }
    if (nH !== null) hi.unshift(nH), hi.length = Math.min(hi.length, 3);
    if (nL !== null) lo.unshift(nL), lo.length = Math.min(lo.length, 3);
    if (hi.length < 2 || lo.length < 2) continue;
    let A = st.L;
    if (A) {
      A.age++;
      if (A.phase === 0) { A.high = Math.max(A.high, b.h); if (b.c < A.level) A.phase = 1; }
      else {
        const zone = pct == null ? A.level : A.high - pct * (A.high - A.legLo);
        A.plo = Math.min(A.plo ?? b.l, b.l);
        if (A.plo <= zone) A.tag = 1;
        if (b.c < A.legLo || b.c > A.high) st.L = null;
        else if (A.tag && b.c > p.h) {
          const entry = b.c, stop = A.legLo - buf, risk = entry - stop, room = (A.high - entry) / risk;
          st.L = null;
          if (inSess && took < cap && htf(i) > 0 && risk > 0 && room > 0.05) {
            open = {dir: 1, entry, stop, risk, tgt: A.high, room, lastHi: hi[0], lastLo: null}; took++;
          }
        }
      }
      if (st.L && A.age > opt.expire) st.L = null;
    }
    if (!st.L && hi[0] < hi[1] && lo[0] < lo[1] && b.c > hi[0])
      st.L = {level: hi[0], legLo: Math.min(lo[0], b.l), high: b.h, phase: 0, age: 0};
    let Z = st.S;
    if (Z) {
      Z.age++;
      if (Z.phase === 0) { Z.low = Math.min(Z.low, b.l); if (b.c > Z.level) Z.phase = 1; }
      else {
        const zone = pct == null ? Z.level : Z.low + pct * (Z.legHi - Z.low);
        Z.phi = Math.max(Z.phi ?? b.h, b.h);
        if (Z.phi >= zone) Z.tag = 1;
        if (b.c > Z.legHi || b.c < Z.low) st.S = null;
        else if (Z.tag && b.c < p.l) {
          const entry = b.c, stop = Z.legHi + buf, risk = stop - entry, room = (entry - Z.low) / risk;
          st.S = null;
          if (inSess && took < cap && htf(i) < 0 && risk > 0 && room > 0.05) {
            open = {dir: -1, entry, stop, risk, tgt: Z.low, room, lastLo: lo[0], lastHi: null}; took++;
          }
        }
      }
      if (st.S && Z.age > opt.expire) st.S = null;
    }
    if (!st.S && hi[0] > hi[1] && lo[0] > lo[1] && b.c < lo[0])
      st.S = {level: lo[0], legHi: Math.max(hi[0], b.h), low: b.l, phase: 0, age: 0};
  }
  return trades;
}

// Cost in R: a round turn plus a tick of slippage each side, over the stop.
const perPoint = I.tick === 0.10 ? 10 : 5;          // MGC $10/pt, MES $5/pt
const RT = 3.50 + 2 * I.tick * perPoint;
const cost = r => Math.min(0.6, RT / (r * perPoint));

function stats(tr) {
  const n = tr.length; if (!n) return null;
  let g = 0, net = 0, w = 0, s = 0, worst = 0, rs = 0;
  for (const t of tr) { g += t.R; net += t.R - cost(t.riskPts); if (t.R > 0) w++; rs += t.riskPts;
    if (t.R < 0) { s++; worst = Math.max(worst, s); } else s = 0; }
  return {n, win: w/n*100, g: g/n, net: net/n, tot: net, worst, avgStop: rs/n};
}

const days = (c[c.length-1].t - c[0].t) / 864e5;
console.log(`\n${execFile}  ${c.length} bars  ${(execMs/60e3)}m  ·  ${days.toFixed(1)} days  ·  HTF ${htfFile}\n`);
const H = ['entry zone', 'exit', 'trades', '/day', 'win%', 'gross R', 'net R', 'total', 'worst', 'avg stop'];
const rows = [];
for (const z of [{n: 'level', pct: null}, {n: '50% tap', pct: 0.5}, {n: '70% tap', pct: 0.7}])
  for (const x of [{n: 'prev high', ride: false}, {n: 'ride to LH', ride: true}]) {
    const a = stats(run({pct: z.pct, ride: x.ride, cap: 2, expire: 240}));
    rows.push(a ? [z.n, x.n, a.n, (a.n/days).toFixed(1), a.win.toFixed(0), a.g.toFixed(3), a.net.toFixed(3), a.tot.toFixed(1), a.worst, a.avgStop.toFixed(2)]
                : [z.n, x.n, 0, '-', '-', '-', '-', '-', '-', '-']);
  }
const T = [H, ...rows].map(r => r.map(String));
const w = H.map((_, i) => Math.max(...T.map(r => r[i].length)));
T.forEach((r, i) => { console.log(r.map((x, j) => j < 2 ? x.padEnd(w[j]) : x.padStart(w[j])).join('   ')); if (!i) console.log(w.map(x => '-'.repeat(x)).join('---')); });
console.log(`\ncosts charged: $${RT.toFixed(2)} a contract round turn (commission + a tick of slippage each side)`);
