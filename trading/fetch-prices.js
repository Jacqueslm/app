#!/usr/bin/env node
// Pulls real gold futures prices and writes the CSV trading/backtest.js reads.
//
// WHERE THE DATA COMES FROM
//   Yahoo Finance's public chart endpoint. No key, no account. The symbol is
//   gold on COMEX:
//     MGC=F  Micro Gold futures  — the one his charts are on. $10 a point.
//     GC=F   Gold futures        — the full-size contract, $100 a point.
//   Same price per ounce, different money per point. MGC=F is the default.
//
//   These are the front-month continuous series Yahoo serves, not contract
//   MGCZ2026 specifically. Around a roll the two differ by a few dollars, so a
//   trade taken across a roll date is not identical to trading one contract.
//
// USAGE
//   node trading/fetch-prices.js                          the three sets below
//   node trading/fetch-prices.js MGC=F 1h 730d out.csv    one series on its own
//
//   Interval and range are Yahoo's rules, not ours: hourly goes back 730 days,
//   anything under an hour (15m, 5m) only 60 days.
//
// No packages. Node 22 has fetch built in.

'use strict';

const fs = require('fs');
const path = require('path');

// Yahoo answers some user-agent strings with 429 and others with the data, so this
// is left exactly as written and checked, not tidied into something prettier.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const STEP = { '1h': 3600, '30m': 1800, '15m': 900, '5m': 300 };

// What `npm`-less default run writes. MGC=F first because that is his market.
const WANTED = [
  { symbol: 'MGC=F', interval: '1h', range: '730d', out: 'trading/data/mgc-1h-730d.csv' },
  { symbol: 'MGC=F', interval: '15m', range: '60d', out: 'trading/data/mgc-15m-60d.csv' },
  { symbol: 'MGC=F', interval: '5m', range: '60d', out: 'trading/data/mgc-5m-60d.csv' },
  { symbol: 'GC=F', interval: '1h', range: '730d', out: 'trading/data/gc-1h-730d.csv' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Yahoo rate-limits a machine by IP, so the same request that worked a minute
// ago can come back 429. Wait and try again rather than failing the pull.
async function chart(symbol, interval, range, tries = 6) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) + '?interval=' + interval + '&range=' + range;
  let last = '';
  for (let i = 0; i < tries; i++) {
    if (i) await sleep(8000 * i);
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    } catch (e) { last = e.message; continue; }
    if (res.status === 429) { last = '429 Too Many Requests'; continue; }
    if (!res.ok) { last = res.status + ' ' + res.statusText; continue; }
    const body = await res.json();
    const r = body && body.chart && body.chart.result && body.chart.result[0];
    if (!r || !r.timestamp) { last = 'no chart result — ' + JSON.stringify(body.chart && body.chart.error); continue; }
    return r;
  }
  throw new Error(symbol + ' ' + interval + ': ' + last);
}

// Yahoo bars carry epoch seconds in UTC and one row per bar the exchange traded.
// Rows with no close are holidays and gaps, not prices — dropped. The last bar of
// a live request is the one being built right now and does not sit on the
// interval boundary; it is dropped too, so no half-formed hour ever becomes a
// range candle.
function toRows(r, interval) {
  const step = STEP[interval];
  if (!step) throw new Error('unknown interval ' + interval);
  const q = r.indicators.quote[0];
  const rows = [];
  const seen = new Set();
  let skippedNull = 0, skippedPartial = 0, skippedDup = 0;
  for (let i = 0; i < r.timestamp.length; i++) {
    const t = r.timestamp[i];
    const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
    if (![o, h, l, c].every((x) => typeof x === 'number' && Number.isFinite(x))) { skippedNull++; continue; }
    if (t % step !== 0) { skippedPartial++; continue; }
    if (seen.has(t)) { skippedDup++; continue; }
    seen.add(t);
    rows.push({ t, o, h, l, c, v: Number.isFinite(q.volume[i]) ? q.volume[i] : 0 });
  }
  rows.sort((a, b) => a.t - b.t);
  return { rows, skippedNull, skippedPartial, skippedDup };
}

function toCsv(rows) {
  const out = ['time,open,high,low,close,volume'];
  for (const r of rows) {
    out.push(new Date(r.t * 1000).toISOString().replace('.000Z', 'Z') + ',' +
      r.o + ',' + r.h + ',' + r.l + ',' + r.c + ',' + r.v);
  }
  return out.join('\n') + '\n';
}

async function pull(symbol, interval, range, out) {
  const r = await chart(symbol, interval, range);
  const { rows, skippedNull, skippedPartial, skippedDup } = toRows(r, interval);
  if (!rows.length) throw new Error(symbol + ' ' + interval + ': no usable bars');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, toCsv(rows));
  const from = new Date(rows[0].t * 1000).toISOString().slice(0, 10);
  const to = new Date(rows[rows.length - 1].t * 1000).toISOString().slice(0, 10);
  console.log(out.padEnd(32) + rows.length + ' bars  ' + from + ' to ' + to +
    '  (' + (skippedNull + skippedPartial + skippedDup) + ' dropped: ' +
    skippedNull + ' no close, ' + skippedPartial + ' unfinished, ' + skippedDup + ' repeat)');
  return rows.length;
}

async function main(argv) {
  if (argv[0] === '--help' || argv[0] === '-h') {
    console.log('node trading/fetch-prices.js                       all the sets below');
    console.log('node trading/fetch-prices.js MGC=F 1h 730d out.csv  one series');
    console.log('sets: ' + WANTED.map((w) => w.symbol + ' ' + w.interval + ' ' + w.range).join(', '));
    return;
  }
  const jobs = argv.length
    ? [{ symbol: argv[0], interval: argv[1] || '1h', range: argv[2] || '730d', out: argv[3] || 'trading/data/prices.csv' }]
    : WANTED;
  let total = 0;
  for (const j of jobs) {
    total += await pull(j.symbol, j.interval, j.range, j.out);
    await sleep(1500);
  }
  console.log('Pulled ' + total + ' bars. Run it through:  node trading/backtest.js ' + jobs[0].out);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => { console.error('pull failed — ' + e.message); process.exit(1); });
}

module.exports = { toRows, toCsv, chart, WANTED };
