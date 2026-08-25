'use strict';
/* Round 2: combine the winners, and check they survive a half-split. */
const path = require('path');
const {load} = require('./csv');
const {etStamp} = require('./msb-sweep');

function dailyBars(h1) {
  const days = new Map();
  for (const c of h1) {
    const d = etStamp(c.t).date;
    let b = days.get(d);
    if (!b) days.set(d, b = {d, t: c.t, o: c.o, h: c.h, l: c.l, c: c.c});
    else { b.h = Math.max(b.h, c.h); b.l = Math.min(b.l, c.l); b.c = c.c; }
  }
  return [...days.values()];
}
const SMA = (a, n, i) => i + 1 < n ? NaN : a.slice(i - n + 1, i + 1).reduce((x, y) => x + y, 0) / n;
function atrSeries(bars, n = 14) {
  const out = new Float64Array(bars.length).fill(NaN);
  let prev = NaN, a = NaN;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const tr = isNaN(prev) ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - prev), Math.abs(b.l - prev));
    a = isNaN(a) ? tr : (a * (n - 1) + tr) / n;
    out[i] = a; prev = b.c;
  }
  return out;
}
function rsiSeries(closes, n) {
  const out = new Float64Array(closes.length).fill(NaN);
  let up = 0, dn = 0;
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const u = Math.max(ch, 0), d = Math.max(-ch, 0);
    if (i <= n) { up += u / n; dn += d / n; }
    else { up = (up * (n - 1) + u) / n; dn = (dn * (n - 1) + d) / n; }
    if (i >= n) out[i] = dn === 0 ? 100 : 100 - 100 / (1 + up / dn);
  }
  return out;
}
function summar(trades) {
  const n = trades.length;
  if (!n) return null;
  let s = 0, w = 0, worst = 0, aw = 0, al = 0, nl = 0;
  for (const r of trades) { s += r; if (r > 0) { w++; aw += r; } else { al += r; nl++; } if (r < worst) worst = r; }
  return {n, win: 100 * w / n, exp: s / n, avgW: w ? aw / w : 0, avgL: nl ? al / nl : 0, worst, tot: s};
}

/* the combined long-side machine: entry modes on daily bars */
function runDaily(daily, mode, stopAtr) {
  const c = daily.map(b => b.c), atr = atrSeries(daily), rsi = rsiSeries(c, 2);
  const out = []; let pos = 0, ent = 0, ea = 1, stop = NaN;
  for (let i = 210; i < daily.length; i++) {
    const ma200 = SMA(c, 200, i), ma5 = SMA(c, 5, i), m20 = SMA(c, 20, i);
    const sd = Math.sqrt(c.slice(i - 19, i + 1).reduce((s, x) => s + (x - m20) ** 2, 0) / 20);
    const lowBand = m20 - 2 * sd;
    const low5 = Math.min(...c.slice(i - 5, i));
    const sig = {
      rsi2: c[i] > ma200 && rsi[i] < 10,
      boll: c[i] > ma200 && c[i] < lowBand,
      dip5: c[i] > ma200 && c[i] < low5,
    };
    const enter = mode === 'rsi2+boll' ? sig.rsi2 && sig.boll :
                  mode === 'rsi2+dip5' ? sig.rsi2 && sig.dip5 :
                  mode === 'all3'      ? sig.rsi2 && sig.boll && sig.dip5 :
                  mode === 'any'       ? sig.rsi2 || sig.boll || sig.dip5 : false;
    if (pos === 0 && enter) { pos = 1; ent = c[i]; ea = atr[i]; stop = stopAtr ? ent - stopAtr * ea : NaN; }
    else if (pos === 1) {
      if (!isNaN(stop) && daily[i].l <= stop) { out.push({r: (stop - ent) / ea, t: daily[i].t}); pos = 0; }
      else if (c[i] > ma5 || c[i] >= m20) { out.push({r: (c[i] - ent) / ea, t: daily[i].t}); pos = 0; }
    }
  }
  return out;
}

const dir = path.join(__dirname, '..', 'data');
const MKTS = [
  {k: 'NAS100', h1: 'NAS100-1h.csv'},
  {k: 'XAU', h1: 'XAU-1h.csv'},
  {k: 'MES', h1: 'MES-1h.csv'},
];
console.log('\nCOMBINATIONS — long side, daily bars, 200SMA trend filter, ATR units\n');
const H = ['combo', 'market', 'stop', 'n', 'win%', 'exp/ATR', 'worst', 'total'];
const rows = [];
for (const M of MKTS) {
  const daily = dailyBars(load(path.join(dir, M.h1)));
  for (const mode of ['rsi2+boll', 'rsi2+dip5', 'all3', 'any'])
    for (const stopAtr of [0, 3]) {
      const tr = runDaily(daily, mode, stopAtr);
      const s = summar(tr.map(x => x.r));
      if (s && s.n >= 10) rows.push({mode, mkt: M.k, stopAtr, ...s, tr});
    }
}
rows.sort((a, b) => b.win - a.win);
const T = [H, ...rows.map(r => [r.mode, r.mkt, r.stopAtr ? r.stopAtr + 'ATR' : 'none', r.n, r.win.toFixed(0), r.exp.toFixed(2), r.worst.toFixed(1), r.tot.toFixed(0)])].map(r => r.map(String));
const w = H.map((_, i) => Math.max(...T.map(r => r[i].length)));
T.forEach((r, i) => { console.log(r.map((c, j) => j < 3 ? c.padEnd(w[j]) : c.padStart(w[j])).join('  ')); if (!i) console.log(w.map(x => '-'.repeat(x)).join('  ')); });

console.log('\nSTABILITY — the best combos, first half of the data vs second half\n');
for (const r of rows.filter(r => r.win >= 70 && r.n >= 30)) {
  const mid = r.tr[Math.floor(r.tr.length / 2)].t;
  const a = summar(r.tr.filter(x => x.t < mid).map(x => x.r));
  const b = summar(r.tr.filter(x => x.t >= mid).map(x => x.r));
  console.log(`  ${r.mode} ${r.mkt} (stop ${r.stopAtr || 'none'}):  1st half ${a.win.toFixed(0)}% / ${a.exp.toFixed(2)}   2nd half ${b.win.toFixed(0)}% / ${b.exp.toFixed(2)}`);
}
