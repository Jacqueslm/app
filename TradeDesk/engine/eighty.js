'use strict';
/* =============================================================================
   THE 80% TOURNAMENT
   Every high-win-rate family I know, tested on NAS100 (16y), XAU (15y) and
   MES futures (43mo). PnL is normalised by ATR(14) at entry so strategies
   with and without hard stops can sit in one table honestly.
   ========================================================================== */
const path = require('path');
const {load} = require('./csv');
const {etStamp} = require('./msb-sweep');

function dailyBars(h1) {
  const days = new Map();
  for (const c of h1) {
    const d = etStamp(c.t).date;
    let b = days.get(d);
    if (!b) days.set(d, b = {d, o: c.o, h: c.h, l: c.l, c: c.c});
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
  let s = 0, w = 0, win = 0, loss = 0, nl = 0, worst = 0;
  for (const r of trades) { s += r; if (r > 0) { w++; win += r; } else { loss += r; nl++; } if (r < worst) worst = r; }
  return {n, win: 100 * w / n, exp: s / n, avgW: w ? win / w : 0, avgL: nl ? loss / nl : 0, worst, tot: s};
}

/* every strategy returns a list of PnL values in ATR units */
const S = {};

// A. RSI(2) mean reversion (Connors) - daily, with the 200SMA trend filter
S.rsi2 = (D) => {
  const c = D.daily.map(b => b.c), atr = atrSeries(D.daily), rsi = rsiSeries(c, 2);
  const out = []; let pos = 0, ent = 0, ea = 1;
  for (let i = 210; i < D.daily.length; i++) {
    const ma200 = SMA(c, 200, i), ma5 = SMA(c, 5, i);
    if (pos === 0 && c[i] > ma200 && rsi[i] < 10) { pos = 1; ent = c[i]; ea = atr[i]; }
    else if (pos === 1 && c[i] > ma5) { out.push((c[i] - ent) / ea); pos = 0; }
    else if (pos === 0 && c[i] < ma200 && rsi[i] > 90) { pos = -1; ent = c[i]; ea = atr[i]; }
    else if (pos === -1 && c[i] < ma5) { out.push((ent - c[i]) / ea); pos = 0; }
  }
  return out;
};

// B. N-day-low pullback in an uptrend - daily
S.dip5 = (D) => {
  const c = D.daily.map(b => b.c), atr = atrSeries(D.daily);
  const out = []; let pos = 0, ent = 0, ea = 1;
  for (let i = 210; i < D.daily.length; i++) {
    const ma200 = SMA(c, 200, i), ma5 = SMA(c, 5, i);
    const low5 = Math.min(...c.slice(i - 5, i));
    if (pos === 0 && c[i] > ma200 && c[i] < low5) { pos = 1; ent = c[i]; ea = atr[i]; }
    else if (pos === 1 && c[i] > ma5) { out.push((c[i] - ent) / ea); pos = 0; }
  }
  return out;
};

// C. Bollinger fade - daily: close below lower band in uptrend, exit mid-band
S.boll = (D) => {
  const c = D.daily.map(b => b.c), atr = atrSeries(D.daily);
  const out = []; let pos = 0, ent = 0, ea = 1;
  for (let i = 210; i < D.daily.length; i++) {
    const m = SMA(c, 20, i);
    const sd = Math.sqrt(c.slice(i - 19, i + 1).reduce((s, x) => s + (x - m) ** 2, 0) / 20);
    const ma200 = SMA(c, 200, i);
    if (pos === 0 && c[i] > ma200 && c[i] < m - 2 * sd) { pos = 1; ent = c[i]; ea = atr[i]; }
    else if (pos === 1 && c[i] >= m) { out.push((c[i] - ent) / ea); pos = 0; }
  }
  return out;
};

// D. Gap fade - 15m: RTH open gaps vs yesterday's 16:00 close, fade toward the fill
S.gap = (D) => {
  const out = []; const atr = atrSeries(D.m15, 56);
  let prevClose = NaN, curDay = '', openIdx = -1;
  for (let i = 0; i < D.m15.length; i++) {
    const b = D.m15[i], et = D.et15[i];
    if (et.date !== curDay) { curDay = et.date; openIdx = -1; }
    if (et.hm === 1545) prevClose = b.c;               // 15:45 bar closes at 16:00 ET
    if (et.hm === 930 && !isNaN(prevClose) && openIdx < 0) {
      openIdx = i;
      const gap = b.o - prevClose, ea = atr[i] || 1;
      if (Math.abs(gap) > 0.3 * ea && Math.abs(gap) < 3 * ea) {
        // fade the gap: target the fill, stop one gap-size beyond, give it the day
        const dir = gap > 0 ? -1 : 1, entry = b.o, tgt = prevClose, stop = entry - dir * Math.abs(gap);
        let res = null;
        for (let j = i; j < Math.min(i + 26, D.m15.length) && D.et15[j].date === curDay; j++) {
          const x = D.m15[j];
          if (dir === 1 ? x.l <= stop : x.h >= stop) { res = -Math.abs(gap); break; }
          if (dir === 1 ? x.h >= tgt : x.l <= tgt) { res = Math.abs(gap); break; }
          res = dir * (x.c - entry);
        }
        if (res !== null) out.push(res / ea);
      }
    }
  }
  return out;
};

// E. First-hour-range fade - 15m: touch of the IB extreme, back to the midpoint
S.ibFade = (D) => {
  const out = []; const atr = atrSeries(D.m15, 56);
  let day = '', ibH = -Infinity, ibL = Infinity, ibDone = false, used = 0;
  for (let i = 0; i < D.m15.length; i++) {
    const b = D.m15[i], et = D.et15[i];
    if (et.date !== day) { day = et.date; ibH = -Infinity; ibL = Infinity; ibDone = false; used = 0; }
    if (et.hm >= 930 && et.hm < 1030) { ibH = Math.max(ibH, b.h); ibL = Math.min(ibL, b.l); }
    if (et.hm >= 1030) ibDone = true;
    if (ibDone && used < 2 && isFinite(ibH) && et.hm < 1500) {
      const mid = (ibH + ibL) / 2, ea = atr[i] || 1, rng = ibH - ibL;
      if (rng < 0.8 * ea) continue;                     // dead day, nothing to fade
      let dir = 0, entry = 0;
      if (b.h >= ibH && b.c < ibH) { dir = -1; entry = b.c; }
      else if (b.l <= ibL && b.c > ibL) { dir = 1; entry = b.c; }
      if (dir) {
        used++;
        const stop = dir === 1 ? ibL - 0.25 * rng : ibH + 0.25 * rng, tgt = mid;
        let res = null;
        for (let j = i + 1; j < D.m15.length && D.et15[j].date === day; j++) {
          const x = D.m15[j];
          if (dir === 1 ? x.l <= stop : x.h >= stop) { res = -Math.abs(entry - stop); break; }
          if (dir === 1 ? x.h >= tgt : x.l <= tgt) { res = Math.abs(tgt - entry); break; }
          res = dir * (x.c - entry);
        }
        if (res !== null) out.push(res / ea);
      }
    }
  }
  return out;
};

// F. Opening range BREAKOUT - the control group (famously low win rate)
S.orb = (D) => {
  const out = []; const atr = atrSeries(D.m15, 56);
  let day = '', ibH = -Infinity, ibL = Infinity, done = false, taken = false;
  for (let i = 0; i < D.m15.length; i++) {
    const b = D.m15[i], et = D.et15[i];
    if (et.date !== day) { day = et.date; ibH = -Infinity; ibL = Infinity; done = false; taken = false; }
    if (et.hm >= 930 && et.hm < 1030) { ibH = Math.max(ibH, b.h); ibL = Math.min(ibL, b.l); }
    if (et.hm >= 1030) done = true;
    if (done && !taken && isFinite(ibH) && et.hm < 1400) {
      const rng = ibH - ibL, ea = atr[i] || 1;
      let dir = 0;
      if (b.c > ibH) dir = 1; else if (b.c < ibL) dir = -1;
      if (dir) {
        taken = true;
        const entry = b.c, stop = dir === 1 ? ibH - 0.5 * rng : ibL + 0.5 * rng, tgt = entry + dir * rng;
        let res = null;
        for (let j = i + 1; j < D.m15.length && D.et15[j].date === day; j++) {
          const x = D.m15[j];
          if (dir === 1 ? x.l <= stop : x.h >= stop) { res = -Math.abs(entry - stop); break; }
          if (dir === 1 ? x.h >= tgt : x.l <= tgt) { res = Math.abs(tgt - entry); break; }
          res = dir * (x.c - entry);
        }
        if (res !== null) out.push(res / ea);
      }
    }
  }
  return out;
};

// G. VWAP band fade - 15m: 2 sigma from the session VWAP back to VWAP
S.vwap = (D) => {
  const out = []; const atr = atrSeries(D.m15, 56);
  let day = '', pv = 0, vv = 0, p2 = 0, used = 0;
  for (let i = 0; i < D.m15.length; i++) {
    const b = D.m15[i], et = D.et15[i], vol = b.n || 1;
    if (et.date !== day) { day = et.date; pv = 0; vv = 0; p2 = 0; used = 0; }
    const tp = (b.h + b.l + b.c) / 3;
    pv += tp * vol; vv += vol; p2 += tp * tp * vol;
    if (vv <= 0) continue;
    const vw = pv / vv, sd = Math.sqrt(Math.max(0, p2 / vv - vw * vw));
    if (et.hm >= 1030 && et.hm <= 1430 && used < 2 && sd > 0) {
      const ea = atr[i] || 1;
      let dir = 0;
      if (b.c > vw + 2 * sd) dir = -1; else if (b.c < vw - 2 * sd) dir = 1;
      if (dir) {
        used++;
        const entry = b.c, stop = entry - dir * 1.5 * sd, tgt = vw;
        let res = null;
        for (let j = i + 1; j < D.m15.length && D.et15[j].date === day; j++) {
          const x = D.m15[j];
          if (dir === 1 ? x.l <= stop : x.h >= stop) { res = -Math.abs(entry - stop); break; }
          if (dir === 1 ? x.h >= tgt : x.l <= tgt) { res = Math.abs(tgt - entry); break; }
          res = dir * (x.c - entry);
        }
        if (res !== null) out.push(res / ea);
      }
    }
  }
  return out;
};

/* ── load, run, report ─────────────────────────────────────────────────────── */
const MKTS = [
  {k: 'NAS100', h1: 'NAS100-1h.csv', m15: 'NAS100-15m.csv'},
  {k: 'XAU', h1: 'XAU-1h.csv', m15: 'XAU-15m.csv'},
  {k: 'MES', h1: 'MES-1h.csv', m15: 'MES-15m.csv'},
];
const dir = path.join(__dirname, '..', 'data');
const rows = [];
for (const M of MKTS) {
  const h1 = load(path.join(dir, M.h1)), m15 = load(path.join(dir, M.m15));
  const D = {daily: dailyBars(h1), m15, et15: m15.map(b => etStamp(b.t))};
  for (const [name, fn] of Object.entries(S)) {
    const r = summar(fn(D));
    if (r && r.n >= 15) rows.push({strat: name, mkt: M.k, ...r});
  }
}
rows.sort((a, b) => b.win - a.win);
const H = ['strategy', 'market', 'n', 'win%', 'avg win', 'avg loss', 'exp/ATR', 'worst', 'total'];
const T = [H, ...rows.map(r => [r.strat, r.mkt, r.n, r.win.toFixed(0), '+' + r.avgW.toFixed(2), r.avgL.toFixed(2), r.exp.toFixed(3), r.worst.toFixed(1), r.tot.toFixed(0)])].map(r => r.map(String));
const w = H.map((_, i) => Math.max(...T.map(r => r[i].length)));
console.log('\nTHE 80%% TOURNAMENT — everything in ATR units, sorted by win rate\n');
T.forEach((r, i) => { console.log(r.map((c, j) => j < 2 ? c.padEnd(w[j]) : c.padStart(w[j])).join('  ')); if (!i) console.log(w.map(x => '-'.repeat(x)).join('  ')); });
