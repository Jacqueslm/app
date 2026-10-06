#!/usr/bin/env node
// Backtester for the method in trading/METHOD.md.
//
// WHAT IT TESTS
//   The range candle (the 9:00 and 15:00 New York hour — the same two the
//   "Jacques TBR Zones" indicator builds), and the two entries:
//     Fib    - price comes back to a 30 / 50 / 70 level inside the candle and holds
//     Sweep  - price pokes past the candle's edge and closes back inside
//   Both range candles stay live through the day, the way the indicator keeps
//   them. Exit and stop are the method's: out when price closes back past the
//   edge the trade came from, stopped when it closes past the other edge.
//
// WHAT IT DOES NOT KNOW
//   It prints what actually happened on the file you give it, one row per
//   setting, so the level with the best record is visible instead of assumed.
//   Small trade counts prove nothing — read the trades column first.
//
// USAGE
//   node trading/backtest.js prices.csv                     every setting
//   node trading/backtest.js prices.csv --zones             only trades inside a zone
//   node trading/backtest.js prices.csv --align             only when 4h and daily agree
//   node trading/backtest.js prices.csv --pv 10 --cost 1.18 money per point, cost per trade
//   node trading/backtest.js --selftest                     checks the engine itself
//
// THE CSV
//   TradingView's export works as-is. Columns are read by name, not position, so
//   time / date / datetime, open, high, low, close all work. Times must carry a
//   zone (2026-01-05T14:00:00Z or ...-05:00). Any timeframe that divides the
//   hour works: 1h, 15m, 5m.

'use strict';

const fs = require('fs');

const HOUR = 3600e3;
const NY = 'America/New_York';

// ------------------------------------------------------------------ the CSV --

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) throw new Error('the file is empty');
  const head = splitRow(lines[0]).map((c) => c.trim().toLowerCase());
  const find = (...names) => head.findIndex((h) => names.some((n) => h === n || h.startsWith(n)));
  const iTime = find('time', 'date', 'datetime');
  const iO = find('open');
  const iH = find('high');
  const iL = find('low');
  const iC = find('close');
  if ([iTime, iO, iH, iL, iC].some((i) => i < 0)) {
    throw new Error('need time, open, high, low and close columns — found: ' + head.join(', '));
  }
  const bars = [];
  for (let i = 1; i < lines.length; i++) {
    const c = splitRow(lines[i]);
    const t = toTime(c[iTime]);
    const o = Number(c[iO]), h = Number(c[iH]), l = Number(c[iL]), cl = Number(c[iC]);
    if (t == null || ![o, h, l, cl].every(Number.isFinite)) continue;
    bars.push({ t, o, h, l, c: cl });
  }
  bars.sort((a, b) => a.t - b.t);
  if (!bars.length) throw new Error('no usable rows');
  return bars;
}

function splitRow(line) {
  const out = [];
  let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function toTime(s) {
  const raw = String(s).trim().replace(/^"|"$/g, '');
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return n > 1e12 ? n : n * 1000;          // seconds or milliseconds
  }
  if (!/[Zz]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    // No zone on the stamp: read it as UTC rather than as the machine's clock,
    // so the same file gives the same answer on any computer.
    return Date.parse(raw.replace(' ', 'T') + 'Z');
  }
  return Date.parse(raw.replace(' ', 'T'));
}

// ------------------------------------------------------------------- clocks --

const hourFmt = new Intl.DateTimeFormat('en-US', { timeZone: NY, hour: '2-digit', hour12: false });
const minFmt = new Intl.DateTimeFormat('en-US', { timeZone: NY, minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: NY, year: 'numeric', month: '2-digit', day: '2-digit' });
function nyHour(ms) { return Number(hourFmt.format(new Date(ms))) % 24; }
function nyDay(ms) { return dayFmt.format(new Date(ms)); }
// The 09:30-16:00 New York session the indicator gates on.
function inSession(ms) {
  return nyHour(ms) * 60 + Number(minFmt.format(new Date(ms))) >= 9 * 60 + 30;
}

// ------------------------------------------------------- the range candles --

// Every 9:00 and 15:00 New York hour, in order, with that hour's high and low.
function rangeCandles(bars) {
  const out = [];
  let cur = null;
  for (const b of bars) {
    const key = Math.floor(b.t / HOUR);
    if (!cur || cur.key !== key) {
      if (cur && (cur.hr === 9 || cur.hr === 15)) out.push(cur);
      cur = { key, hr: nyHour(b.t), top: b.h, bot: b.l, close: b.c, end: b.t };
    } else {
      cur.top = Math.max(cur.top, b.h);
      cur.bot = Math.min(cur.bot, b.l);
      cur.close = b.c;
      cur.end = b.t;
    }
  }
  if (cur && (cur.hr === 9 || cur.hr === 15)) out.push(cur);
  return out;
}

// ---------------------------------------------------------- the zone engine --

// A port of the zone half of trading/jacques-zones.pine: swing structure, break
// of structure and change of character. Same rules and numbers, so the chart and
// the backtest agree about what a zone is.
function zoneEngine(bars, len) {
  const n = bars.length;
  const bull = new Array(n).fill(null);   // newest bull (demand) zone at this bar
  const bear = new Array(n).fill(null);   // newest bear (supply) zone
  let zd = 0, zHigh = null, zLow = null;
  let zsTopP = null, zsBotP = null, zBosUp = false, zBosDn = false, ztDir = 0;
  let curBull = null, curBear = null;

  for (let i = 0; i < n; i++) {
    if (i >= len) {
      // ta.highest(len) / ta.lowest(len) — the last len bars, current one
      // included. The bar BEFORE that window is the one tested against it.
      let hi = -Infinity, lo = Infinity;
      for (let k = i - len + 1; k <= i; k++) { hi = Math.max(hi, bars[k].h); lo = Math.min(lo, bars[k].l); }
      if (zd >= 0 && bars[i - len].h > hi) { zd = -1; zHigh = bars[i - len].h; }
      if (zd <= 0 && bars[i - len].l < lo) { zd = 1; zLow = bars[i - len].l; }
      if (zHigh != null) { zsTopP = zHigh; zBosUp = true; }
      if (zLow != null) { zsBotP = zLow; zBosDn = true; }

      const c = bars[i].c, p = bars[i - 1].c;
      const chochUp = zsTopP != null && c > zsTopP && p <= zsTopP && bars[i].h === hi && ztDir <= 0;
      const chochDn = zsBotP != null && c < zsBotP && p >= zsBotP && bars[i].l === lo && ztDir >= 0;
      if (chochUp) ztDir = 1;
      if (chochDn) ztDir = -1;
      const mssUp = (zsTopP != null && c > zsTopP && p <= zsTopP && zBosUp && ztDir >= 0) || chochUp;
      const mssDn = (zsBotP != null && c < zsBotP && p >= zsBotP && zBosDn && ztDir <= 0) || chochDn;
      if (mssUp) { zBosUp = false; curBull = { top: zsTopP, bot: zd === -1 ? lo : zd === 1 ? zsBotP : 0 }; }
      if (mssDn) { zBosDn = false; curBear = { top: zsBotP, bot: zd === 1 ? hi : zd === -1 ? zsTopP : 0 }; }
    }
    bull[i] = curBull;
    bear[i] = curBear;
  }
  return { bull, bear };
}

// ------------------------------------------------------------- higher frames --

// The big picture the method asks for: 4h and daily. A frame is up when it
// closes above its own average and down when below. Deliberately simple, and
// written here so it can be argued with.
function aggregate(bars, keyOf) {
  const out = [];
  let cur = null;
  for (const b of bars) {
    const k = keyOf(b.t);
    if (!cur || cur.key !== k) {
      if (cur) out.push(cur);
      cur = { key: k, h: b.h, l: b.l, c: b.c, t: b.t };
    } else {
      cur.h = Math.max(cur.h, b.h);
      cur.l = Math.min(cur.l, b.l);
      cur.c = b.c;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function trendSeries(htf, len) {
  const dir = [];
  let sum = 0;
  for (let i = 0; i < htf.length; i++) {
    sum += htf[i].c;
    if (i >= len) sum -= htf[i - len].c;
    if (i < len) dir.push(0);
    else dir.push(htf[i].c > sum / len ? 1 : htf[i].c < sum / len ? -1 : 0);
  }
  return dir;
}

// The higher-frame direction in force at each base bar. Only the last frame
// that had already CLOSED counts — a half-finished 4h bar is not a signal.
function mapTrend(bars, htf, dir) {
  const out = new Array(bars.length).fill(0);
  let j = -1;
  for (let i = 0; i < bars.length; i++) {
    while (j + 1 < htf.length && htf[j + 1].t <= bars[i].t) j++;
    out[i] = j - 1 >= 0 ? dir[j - 1] : 0;
  }
  return out;
}

// ----------------------------------------------------------------- the rules --

function zoneAllows(zones, i, bar, isLong, opts) {
  if (!opts.zoneFilter) return true;
  const z = isLong ? zones.bull[i] : zones.bear[i];
  return !!z && bar.c <= z.top && bar.c >= z.bot;
}

function run(bars, opts) {
  const ranges = rangeCandles(bars);
  const byKey = new Map(ranges.map((r) => [r.key, r]));
  const zones = zoneEngine(bars, opts.structure);
  const agg4 = aggregate(bars, (t) => Math.floor(t / (4 * HOUR)));
  const aggD = aggregate(bars, (t) => nyDay(t));
  const t4 = mapTrend(bars, agg4, trendSeries(agg4, opts.trendLen));
  const td = mapTrend(bars, aggD, trendSeries(aggD, opts.trendLen));

  const results = {};
  for (const style of ['fib', 'sweep']) {
    for (const lvl of (style === 'sweep' ? ['sweep'] : ['30', '50', '70'])) {
      const f = lvl === '30' ? 0.3 : lvl === '70' ? 0.7 : 0.5;
      const trades = [];
      // A is the 9:00 candle, B the 15:00 candle. Both stay live through the
      // day, exactly like the indicator's two range boxes.
      const A = { has: false }, B = { has: false };
      let pos = null;
      let lz = null, sz = null;

      for (let i = 0; i < bars.length; i++) {
        const b = bars[i], k = Math.floor(b.t / HOUR);

        // A finished 9:00 or 15:00 hour becomes (or refreshes) a range candle.
        const done = byKey.get(k - 1);
        if (done) {
          const slot = done.hr === 9 ? A : B;
          slot.has = true; slot.top = done.top; slot.bot = done.bot;
          slot.tim = done.key; slot.alive = false; slot.up = false;
        }
        for (const slot of [A, B]) {
          if (slot.has && !slot.alive) {
            if (b.c > slot.top) { slot.alive = true; slot.up = true; }
            else if (b.c < slot.bot) { slot.alive = true; slot.up = false; }
          }
        }

        // Leave an open trade: out past the far edge, or stopped the other side.
        if (pos) {
          const out = pos.dir > 0 ? (b.c > pos.target || b.c < pos.stop)
                                  : (b.c < pos.target || b.c > pos.stop);
          if (out) {
            trades.push({ points: pos.dir > 0 ? b.c - pos.entry : pos.entry - b.c });
            pos = null;
          }
          if (pos) continue;
        }
        if (!inSession(b.t)) continue;

        const upA = A.has && A.alive && A.up, upB = B.has && B.alive && B.up;
        const dnA = A.has && A.alive && !A.up, dnB = B.has && B.alive && !B.up;

        if (upA || upB) {
          const top = upB ? B.top : A.top, bot = upB ? B.bot : A.bot, tim = upB ? B.tim : A.tim;
          if (tim !== lz) {
            const level = top - f * (top - bot);
            const hit = style === 'fib'
              ? (b.l <= level && b.c >= level && b.c <= top)
              : (b.l < bot && b.c > bot && b.c <= top);
            const alignOK = !opts.align || (t4[i] > 0 && td[i] > 0);
            if (hit && alignOK && zoneAllows(zones, i, b, true, opts)) {
              lz = tim;
              pos = { dir: 1, entry: b.c, target: top, stop: bot };
              continue;
            }
          }
        }
        if (dnA || dnB) {
          const top = dnB ? B.top : A.top, bot = dnB ? B.bot : A.bot, tim = dnB ? B.tim : A.tim;
          if (tim !== sz) {
            const level = bot + f * (top - bot);
            const hit = style === 'fib'
              ? (b.h >= level && b.c <= level && b.c >= bot)
              : (b.h > top && b.c < top && b.c >= bot);
            const alignOK = !opts.align || (t4[i] < 0 && td[i] < 0);
            if (hit && alignOK && zoneAllows(zones, i, b, false, opts)) {
              sz = tim;
              pos = { dir: -1, entry: b.c, target: bot, stop: top };
            }
          }
        }
      }
      // Anything still open at the end is marked to the last close, not dropped.
      if (pos) {
        const last = bars[bars.length - 1].c;
        trades.push({ points: pos.dir > 0 ? last - pos.entry : pos.entry - last });
      }
      // Sweep does not use a level (METHOD.md: Sweep 30, 50 and 70 are the same
      // trades), so its row is named once. It used to print as "sweep sweep".
      results[style === 'sweep' ? 'sweep' : style + ' ' + lvl] = stats(trades, opts);
    }
  }
  return results;
}

function stats(trades, opts) {
  const n = trades.length;
  if (!n) return { n: 0, win: 0, loss: 0, winRate: 0, net: 0, pf: 0, expectancy: 0, dd: 0 };
  let wins = 0, grossWin = 0, grossLoss = 0, net = 0, peak = 0, dd = 0;
  for (const t of trades) {
    const dollars = t.points * opts.pv - opts.cost;
    net += dollars;
    if (dollars > 0) { wins++; grossWin += dollars; } else grossLoss += dollars;
    peak = Math.max(peak, net);
    dd = Math.max(dd, peak - net);
  }
  return {
    n, win: wins, loss: n - wins, winRate: wins / n, net,
    pf: grossLoss === 0 ? Infinity : grossWin / -grossLoss,
    expectancy: net / n, dd,
  };
}

// ------------------------------------------------------------------- report --

function pct(x) { return (x * 100).toFixed(1) + '%'; }
function money(x) { return (x >= 0 ? '+' : '-') + '$' + Math.abs(x).toFixed(2); }

function report(all, opts) {
  console.log('');
  console.log(`Ran on ${opts.bars} bars. $${opts.pv} a point, $${opts.cost} a trade.`);
  console.log(`Filters: zones ${opts.zoneFilter ? 'ON' : 'off'}, 4h+daily alignment ${opts.align ? 'ON' : 'off'}.`);
  console.log('');
  console.log('setting'.padEnd(14) + 'trades'.padStart(7) + 'win'.padStart(6) + 'loss'.padStart(6) +
    'win %'.padStart(8) + 'net'.padStart(12) + 'PF'.padStart(8) + 'per trade'.padStart(11) + 'worst dip'.padStart(11));
  for (const [name, s] of Object.entries(all)) {
    console.log(
      name.padEnd(14) + String(s.n).padStart(7) + String(s.win).padStart(6) + String(s.loss).padStart(6) +
      (s.n ? pct(s.winRate) : '—').padStart(8) +
      money(s.net).padStart(12) +
      (s.n ? (s.pf === Infinity ? '∞' : s.pf.toFixed(2)) : '—').padStart(8) +
      (s.n ? money(s.expectancy) : '—').padStart(11) +
      money(-s.dd).padStart(11));
  }
  const best = Object.entries(all).filter(([, s]) => s.n >= 20)
    .sort((a, b) => b[1].expectancy - a[1].expectancy)[0];
  console.log('');
  console.log(best
    ? `Best record with 20+ trades: ${best[0]} — ${money(best[1].expectancy)} a trade over ${best[1].n}.`
    : 'No setting reached 20 trades. Give it more data before reading anything into this.');
  console.log('Small trade counts prove nothing. Read the trades column before the win %.');
}

// --------------------------------------------------------------- self-check --

// Not market data and not a result: a hand-built four-bar fixture that only
// proves the engine finds an entry it should find and leaves where it should.
function selftest() {
  const at = (iso, o, h, l, c) => ({ t: Date.parse(iso), o, h, l, c });
  const bars = [
    at('2026-01-05T14:00:00Z', 105, 110, 100, 105),   // NY 09:00 — the range candle
    at('2026-01-05T15:00:00Z', 105, 115, 105, 115),   // price leaves the top
    at('2026-01-05T16:00:00Z', 115, 116, 106, 108),   // back to the 30 level and holds
    at('2026-01-05T17:00:00Z', 108, 112, 108, 111),   // closes back above the top
  ];
  const opts = { structure: 10, trendLen: 20, pv: 10, cost: 0, zoneFilter: false, align: false };
  const fib30 = run(bars, opts)['fib 30'];
  const ok = fib30.n === 1 && fib30.win === 1 && Math.abs(fib30.net - 30) < 1e-6;
  console.log('self-check: ' + (ok ? 'PASS' : 'FAIL') + ' — fib 30 found ' + fib30.n +
    ' trade(s), ' + fib30.win + ' winner(s), net ' + money(fib30.net));
  console.log('(self-check uses a made-up 4-bar fixture. It is not a result.)');
  process.exit(ok ? 0 : 1);
}

// --------------------------------------------------------------------- main --

function main(argv) {
  const opts = { pv: 10, cost: 1.18, structure: 10, trendLen: 20, zoneFilter: false, align: false };
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--selftest') return selftest();
    else if (a === '--zones') opts.zoneFilter = true;
    else if (a === '--align') opts.align = true;
    else if (a === '--pv') opts.pv = Number(argv[++i]);
    else if (a === '--cost') opts.cost = Number(argv[++i]);
    else if (a === '--structure') opts.structure = Number(argv[++i]);
    else if (a === '--trend') opts.trendLen = Number(argv[++i]);
    else if (a.startsWith('--')) { console.error('unknown option ' + a); process.exit(2); }
    else files.push(a);
  }
  if (!files.length) {
    console.error('Give it a price CSV:  node trading/backtest.js prices.csv');
    console.error('Or check the engine:   node trading/backtest.js --selftest');
    process.exit(2);
  }
  const bars = parseCsv(fs.readFileSync(files[0], 'utf8'));
  opts.bars = bars.length;
  report(run(bars, opts), opts);
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { parseCsv, rangeCandles, zoneEngine, run, stats, nyHour, inSession };
