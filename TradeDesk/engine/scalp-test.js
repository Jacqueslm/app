'use strict';
/* Do the hand-off scalps pay?
   The EYES panel offers, at any moment, a long "up to the last 15m swing high"
   with the stop under the last 15m swing low (mirror for shorts), and calls it
   OK when the reward is at least 0.8 of the risk. It never says whether that
   trade has ever made money. This measures it, with the same definitions the
   panel uses: pivots of strength 3 on the 15m, target taken AT the level,
   stop-first when a bar touches both, flat at the session close.
   Variants: every OK verdict, or only the ones the panel marks as a true
   hand-off (a lower high above / a higher low below). Two a day, or no cap.
   Not modelled: the 1H warnings that override the verdict. */
const path = require('path');
const {load} = require('./csv');
const {structure2} = require('./msb-trap');
const {etStamp} = require('./msb-sweep');

const INSTS = [
  {k: 'MES',    tick: 0.25, from: 930, to: 1500, m15: 'MES-15m.csv'},
  {k: 'NAS100', tick: 0.25, from: 930, to: 1500, m15: 'NAS100-15m.csv'},
  {k: 'XAU',    tick: 0.10, from: 800, to: 1300, m15: 'XAU-15m.csv'},
];

function run(c, S, et, I, opt) {
  const buf = 4 * I.tick, minR = 0.8;
  const cap = opt.cap ?? 2, handoffOnly = opt.handoff === true;
  const trades = []; let open = null, day = '', took = 0;
  for (let i = 1; i < c.length; i++) {
    const b = c[i], e = et[i];
    if (e.date !== day) { day = e.date; took = 0; }
    const inSess = e.hm > I.from && e.hm <= I.to;
    if (open) {
      const L = open.dir === 1;
      const hitStop = L ? b.l <= open.stop : b.h >= open.stop;
      const hitTgt  = L ? b.h >= open.tgt  : b.l <= open.tgt;
      let R = null;
      if (hitStop) R = -1;                                   // stop first, always
      else if (hitTgt) R = open.room;
      else if (!inSess || e.hm >= I.to) R = ((b.c - open.entry) * open.dir) / open.risk;  // flat at the close
      if (R !== null) { trades.push({R, handoff: open.handoff, t: b.t}); open = null; continue; }
      continue;
    }
    if (!inSess || took >= cap) continue;
    const hi = S.pivHi[i], lo = S.pivLo[i], hi2 = S.pivHi2[i], lo2 = S.pivLo2[i];
    // long: to the 15m high above, stop under the 15m low below
    if (!isNaN(hi) && !isNaN(lo) && hi > b.c && lo < b.c) {
      const risk = b.c - lo + buf, room = (hi - b.c) / risk, ho = !isNaN(hi2) && hi < hi2;
      if (room >= minR && (!handoffOnly || ho)) {
        open = {dir: 1, entry: b.c, stop: lo - buf, tgt: hi, risk, room, handoff: ho}; took++; continue;
      }
    }
    if (!isNaN(hi) && !isNaN(lo) && lo < b.c && hi > b.c) {
      const risk = hi - b.c + buf, room = (b.c - lo) / risk, ho = !isNaN(lo2) && lo > lo2;
      if (room >= minR && (!handoffOnly || ho)) {
        open = {dir: -1, entry: b.c, stop: hi + buf, tgt: lo, risk, room, handoff: ho}; took++;
      }
    }
  }
  return trades;
}

function stats(tr, months) {
  const n = tr.length; if (!n) return {n};
  let sum = 0, w = 0, st = 0, worst = 0;
  for (const t of tr) { sum += t.R; if (t.R > 0) w++; if (t.R < 0) { st++; worst = Math.max(worst, st); } else st = 0; }
  return {n, win: w / n * 100, exp: sum / n, tot: sum, perMo: n / months, worst};
}

const rows = [];
for (const I of INSTS) {
  const c = load(path.join(__dirname, '..', 'data', I.m15));
  const S = structure2(c, 3);
  const et = c.map(x => etStamp(x.t + 15 * 60e3));      // the bar's close, on the NY clock
  const months = (c[c.length - 1].t - c[0].t) / (30.44 * 864e5);
  const span = `${new Date(c[0].t).toISOString().slice(0, 10)} → ${new Date(c[c.length - 1].t).toISOString().slice(0, 10)}`;
  for (const v of [
    {name: 'every OK, 2/day',   cap: 2,   handoff: false},
    {name: 'hand-off only, 2/day', cap: 2, handoff: true},
    {name: 'every OK, no cap',  cap: 1e9, handoff: false},
    {name: 'hand-off only, no cap', cap: 1e9, handoff: true},
  ]) rows.push({k: I.k, span, v: v.name, ...stats(run(c, S, et, I, v), months)});
}
const H = ['market', 'rule', 'trades', '/month', 'win%', 'avg R', 'total R', 'worst run'];
const T = [H, ...rows.map(r => [r.k, r.v, r.n, r.perMo.toFixed(1), r.win.toFixed(0), r.exp.toFixed(3), r.tot.toFixed(1), r.worst].map(String))];
const w = H.map((_, i) => Math.max(...T.map(r => r[i].length)));
console.log('\nThe hand-off scalps, measured\n');
T.forEach((r, i) => { console.log(r.map((x, j) => j < 2 ? x.padEnd(w[j]) : x.padStart(w[j])).join('   ')); if (!i) console.log(w.map(x => '-'.repeat(x)).join('---')); });
console.log('\nspans:'); for (const I of INSTS) console.log(' ', I.k.padEnd(7), rows.find(r => r.k === I.k).span);
