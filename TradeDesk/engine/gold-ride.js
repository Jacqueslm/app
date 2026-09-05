'use strict';
/* The one fast-ladder survivor, put under a harder light.
   Gold 15m, 4H structure agreeing, BOS -> pullback -> higher low proves
   itself -> enter, stop behind the zone, ride until a lower high prints.
   Questions: does it hold up year by year, long and short, after costs,
   and does an entry-quality filter (room to the previous high) help? */
const path = require('path');
const {load} = require('./csv');
const {structure, alignIndex, etStamp, HOUR} = require('./msb-sweep');

function run(c, et, S, htf, I, opt) {
  const buf = 4 * I.tick, cap = opt.cap ?? 2, pct = opt.pct ?? 0.5, minRoom = opt.minRoom ?? 0;
  const trades = []; const hi = [], lo = [];
  const st = {L: null, S: null};
  let open = null, day = '', took = 0;
  for (let i = 1; i < c.length; i++) {
    const b = c[i], p = c[i-1], e = et[i];
    if (e.date !== day) { day = e.date; took = 0; }
    const inSess = e.hm > I.from && e.hm <= I.to;
    const newHi = !isNaN(S.pivHi[i]) && S.pivHi[i] !== hi[0] ? S.pivHi[i] : null;
    const newLo = !isNaN(S.pivLo[i]) && S.pivLo[i] !== lo[0] ? S.pivLo[i] : null;
    if (open) {
      const L = open.dir === 1; let R = null;
      if (L ? b.l <= open.stop : b.h >= open.stop) R = -1;
      else if (L && newHi !== null) {
        if (open.lastHi !== null && newHi < open.lastHi) R = (b.c - open.entry) / open.risk;
        else open.lastHi = newHi;
      } else if (!L && newLo !== null) {
        if (open.lastLo !== null && newLo > open.lastLo) R = (open.entry - b.c) / open.risk;
        else open.lastLo = newLo;
      }
      if (R === null && e.hm >= I.to) R = ((b.c - open.entry) * open.dir) / open.risk;
      if (R !== null) { trades.push({R, dir: open.dir, t: b.t, riskPts: open.risk, room: open.room}); open = null; }
      if (open) continue;
    }
    if (newHi !== null) hi.unshift(newHi), hi.length = Math.min(hi.length, 3);
    if (newLo !== null) lo.unshift(newLo), lo.length = Math.min(lo.length, 3);
    if (hi.length < 2 || lo.length < 2) continue;
    let A = st.L;
    if (A) {
      A.age++;
      if (A.phase === 0) { A.high = Math.max(A.high, b.h); if (b.c < A.level) A.phase = 1; }
      else {
        const zone = A.high - pct * (A.high - A.legLo);
        A.plo = Math.min(A.plo ?? b.l, b.l);
        if (A.plo <= zone) A.tag = 1;
        if (b.c < A.legLo || b.c > A.high) st.L = null;
        else if (A.tag && b.c > p.h) {
          const entry = b.c, stop = A.legLo - buf, risk = entry - stop, room = (A.high - entry) / risk;
          st.L = null;
          if (inSess && took < cap && htf(i) > 0 && risk > 0 && room >= minRoom && room > 0.05) {
            open = {dir: 1, entry, stop, risk, room, lastHi: hi[0], lastLo: null}; took++;
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
      if (Z.phase === 0) { Z.low = Math.min(Z.low, b.l); if (b.c > Z.level) Z.phase = 1; }
      else {
        const zone = Z.low + pct * (Z.legHi - Z.low);
        Z.phi = Math.max(Z.phi ?? b.h, b.h);
        if (Z.phi >= zone) Z.tag = 1;
        if (b.c > Z.legHi || b.c < Z.low) st.S = null;
        else if (Z.tag && b.c < p.l) {
          const entry = b.c, stop = Z.legHi + buf, risk = stop - entry, room = (entry - Z.low) / risk;
          st.S = null;
          if (inSess && took < cap && htf(i) < 0 && risk > 0 && room >= minRoom && room > 0.05) {
            open = {dir: -1, entry, stop, risk, room, lastLo: lo[0], lastHi: null}; took++;
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

const I = {k: 'XAU', tick: 0.10, from: 800, to: 1300};
const dir = path.join(__dirname, '..', 'data');
const c = load(path.join(dir, 'XAU-15m.csv'));
const S = structure(c, 3, 3);
const et = c.map(x => etStamp(x.t + 15 * 60e3));
const h = load(path.join(dir, 'XAU-4h.csv'));
const HS = structure(h, 3, 3);
const map = alignIndex(c.map(x => x.t + 15 * 60e3), h, 4 * HOUR);
const htf = i => { const j = map[i]; return j >= 0 ? HS.trend[j] : 0; };

// MGC: $10 a point, ~$3 round trip with slippage of a tick each side ≈ $5 total
const COST = riskPts => Math.min(0.5, 5 / (riskPts * 10));

function agg(tr) {
  const n = tr.length; if (!n) return {n: 0};
  let g = 0, net = 0, w = 0, s = 0, worst = 0;
  for (const t of tr) {
    const cnet = t.R - COST(t.riskPts);
    g += t.R; net += cnet; if (t.R > 0) w++;
    if (t.R < 0) { s++; worst = Math.max(worst, s); } else s = 0;
  }
  return {n, win: w/n*100, g: g/n, net: net/n, totNet: net, worst};
}

const base = run(c, et, S, htf, I, {pct: 0.5, cap: 2});
console.log('\nGold 15m→4H, ride to the lower high — under a harder light\n');
console.log('overall:', JSON.stringify((({n,win,g,net,totNet,worst})=>({trades:n,win:+win.toFixed(0),grossR:+g.toFixed(3),netR:+net.toFixed(3),totalNetR:+totNet.toFixed(1),worstRun:worst}))(agg(base))));
console.log('\nby direction:');
for (const d of [1, -1]) {
  const a = agg(base.filter(t => t.dir === d));
  console.log(' ', d === 1 ? 'longs ' : 'shorts', a.n, 'trades  win', a.win.toFixed(0) + '%  gross', a.g.toFixed(3) + 'R  net', a.net.toFixed(3) + 'R');
}
console.log('\nby year (net R for the year):');
const byY = {};
for (const t of base) { const y = new Date(t.t).getUTCFullYear(); (byY[y] ??= []).push(t); }
for (const y of Object.keys(byY).sort()) {
  const a = agg(byY[y]);
  console.log(' ', y, String(a.n).padStart(4), 'trades  net/trade', a.net.toFixed(3).padStart(7), '  year total', a.totNet.toFixed(1).padStart(7) + 'R');
}
console.log('\nentry-quality filter (room to the previous high at entry):');
for (const mr of [0, 0.5, 1.0, 1.5]) {
  const a = agg(run(c, et, S, htf, I, {pct: 0.5, cap: 2, minRoom: mr}));
  console.log('  room >=', mr.toFixed(1), ' ', String(a.n).padStart(4), 'trades  win', a.win.toFixed(0) + '%  net/trade', a.net.toFixed(3).padStart(7), ' total', a.totNet.toFixed(1).padStart(7) + 'R  worst run', a.worst);
}
console.log('\none a day instead of two:');
const a1 = agg(run(c, et, S, htf, I, {pct: 0.5, cap: 1}));
console.log('  ', a1.n, 'trades  win', a1.win.toFixed(0) + '%  net/trade', a1.net.toFixed(3), ' total', a1.totNet.toFixed(1) + 'R');
