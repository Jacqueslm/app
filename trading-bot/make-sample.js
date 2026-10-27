#!/usr/bin/env node
'use strict';
/*
 * Make bars to test the plumbing with.
 *
 * These are SYNTHETIC. They come from a seeded random walk, not from any market,
 * and the file says so on its first line. A strategy that looks good on these has
 * proven that it runs, and nothing else.
 *
 *   node make-sample.js --bars 2000 --interval 1h --seed 7
 *
 * The same seed makes the same bytes every time, so a run can be repeated exactly.
 */

const fs = require('node:fs');
const path = require('node:path');

const INTERVALS = { '1m': 60e3, '5m': 300e3, '15m': 900e3, '1h': 3600e3, '4h': 4 * 3600e3, '1d': 86400e3 };

function lcg(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/* Box-Muller, so the walk has normal-ish steps instead of uniform ones. */
function normal(rand) {
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function parseArgs(argv) {
  const opts = { bars: 2000, interval: '1h', seed: 7, price: 100, vol: 0.004, start: '2026-01-01T00:00:00Z' };
  const names = { bars: 'bars', interval: 'interval', seed: 'seed', price: 'price', vol: 'vol', start: 'start', out: 'out' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument ${arg}`);
    const key = arg.slice(2);
    if (key === 'help') { opts.help = true; continue; }
    const value = argv[++i];
    if (value === undefined) throw new Error(`--${key} needs a value`);
    if (!(key in names)) throw new Error(`unknown option --${key}`);
    opts[key] = key === 'interval' || key === 'start' || key === 'out' ? value : Number(value);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('node make-sample.js [--bars 2000] [--interval 1h] [--seed 7] [--price 100] [--vol 0.004] [--start 2026-01-01T00:00:00Z] [--out data/sample-synthetic-1h.csv]');
    return;
  }
  const step = INTERVALS[opts.interval];
  if (!step) throw new Error(`--interval has to be one of ${Object.keys(INTERVALS).join(', ')}`);
  if (!(opts.bars > 0)) throw new Error('--bars has to be above zero');
  const start = Date.parse(opts.start);
  if (!Number.isFinite(start)) throw new Error(`--start is not a time: ${opts.start}`);

  const rand = lcg(opts.seed);
  const rows = ['# synthetic bars — a seeded random walk from make-sample.js. NOT market data.'];
  rows.push('time,open,high,low,close,volume');

  let price = opts.price;
  for (let i = 0; i < opts.bars; i++) {
    const open = price;
    const drift = opts.vol * normal(rand);
    const close = open * (1 + drift);
    const wick = opts.vol * (0.3 + rand());
    const high = Math.max(open, close) * (1 + wick * rand());
    const low = Math.min(open, close) * (1 - wick * rand());
    const volume = Math.round(1000 * (0.5 + rand()));
    rows.push([
      new Date(start + i * step).toISOString(),
      open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2), volume,
    ].join(','));
    price = close;
  }

  const out = opts.out || path.join(__dirname, 'data', `sample-synthetic-${opts.interval}.csv`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, rows.join('\n') + '\n');
  console.log(`wrote ${out}: ${opts.bars} synthetic ${opts.interval} bars from seed ${opts.seed}`);
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
