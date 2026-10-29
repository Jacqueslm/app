#!/usr/bin/env node
'use strict';
/*
 * Bring someone else's CSV into the shape this folder reads.
 *
 *   node import-bars.js --in raw.csv --out data/real/US500-15m.csv
 *   node import-bars.js --in raw.csv --out data/real/US500-15m.csv --limit 60000
 *
 * Written for the public 15-minute bar files (tab separated, a Time/Open/High/Low/
 * Close/Volume header, timestamps in UTC): a delimiter that is not a comma, a
 * header this loader would refuse, and 200,000 rows that need checking before a
 * backtest is allowed to believe them.
 *
 * Nothing is written until the whole file has been read and checked by the SAME
 * loader the strategy uses, so a bad import fails here with a line number instead of
 * quietly shortening a report.
 */

const fs = require('node:fs');
const path = require('node:path');
const { parseCandles, parseTime } = require('./lib/candles');
const { clock } = require('./lib/session');

const HELP = `node import-bars.js --in <raw.csv> --out <file.csv> [options]

  --in <file>        the file to read (required)
  --out <file>       where to write it in this folder's format (required)
  --delimiter <c>    , or tab (default: worked out from the first line)
  --limit <n>        keep only the last n bars
  --help             this list
`;

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument ${arg}`);
    const key = arg.slice(2);
    if (key === 'help') { opts.help = true; continue; }
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${key} needs a value`);
    opts[key] = value;
  }
  return opts;
}

const NAMED = {
  time: /^(time|date|datetime|timestamp)$/i,
  open: /^open$/i,
  high: /^high$/i,
  low: /^low$/i,
  close: /^(close|last)$/i,
  volume: /^(volume|vol)$/i,
};

function columnsOf(header, where) {
  const map = {};
  header.forEach((cell, i) => {
    for (const [name, pattern] of Object.entries(NAMED)) {
      if (pattern.test(cell.trim()) && map[name] === undefined) map[name] = i;
    }
  });
  const missing = Object.keys(NAMED).filter((n) => map[n] === undefined && n !== 'volume');
  if (map.time === undefined) missing.push('time');
  if (missing.length) {
    throw new Error(`${where}: the header is missing ${missing.join(', ')} — it reads ${JSON.stringify(header)}`);
  }
  return map;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(HELP); return; }
  if (!opts.in || !opts.out) {
    console.error(HELP);
    process.exitCode = 2;
    return;
  }

  let text;
  try {
    text = fs.readFileSync(opts.in, 'utf8');
  } catch (err) {
    throw new Error(`cannot read ${opts.in}: ${err.message}`);
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) throw new Error(`${opts.in} is empty`);
  const delimiter = opts.delimiter === 'tab' ? '\t'
    : opts.delimiter || (lines[0].includes('\t') ? '\t' : ',');

  const head = lines[0].split(delimiter).map((c) => c.trim());
  const columns = columnsOf(head, `${opts.in} line 1`);

  const rows = [];
  let dropped = 0;
  for (let n = 1; n < lines.length; n++) {
    const cells = lines[n].split(delimiter).map((c) => c.trim());
    const time = parseTime(cells[columns.time], n + 1);
    const open = Number(cells[columns.open]);
    const high = Number(cells[columns.high]);
    const low = Number(cells[columns.low]);
    const close = Number(cells[columns.close]);
    const volume = columns.volume === undefined ? 0 : Number(cells[columns.volume]);
    if (![open, high, low, close].every(Number.isFinite)) { dropped++; continue; }
    rows.push({
      time, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0,
    });
  }
  if (!rows.length) throw new Error(`${opts.in}: no usable bar in it`);

  const limit = opts.limit ? Number(opts.limit) : 0;
  if (opts.limit && (!Number.isInteger(limit) || limit < 1)) throw new Error('--limit has to be a whole number of bars');
  const kept = limit && rows.length > limit ? rows.slice(-limit) : rows;

  const out = ['time,open,high,low,close,volume'];
  for (const b of kept) {
    out.push([new Date(b.time).toISOString(), b.open, b.high, b.low, b.close, b.volume].join(','));
  }
  const csv = out.join('\n') + '\n';

  /* The strategy's own loader is the referee: if it refuses this, nothing is written. */
  const checked = parseCandles(csv, opts.out);

  fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
  fs.writeFileSync(opts.out, csv);

  const c = (ms) => {
    const k = clock(ms);
    const pad = (v) => String(v).padStart(2, '0');
    return `${k.year}-${pad(k.month)}-${pad(k.day)} ${pad(k.hour)}:${pad(k.minute)}`;
  };
  const first = checked[0].time;
  const last = checked[checked.length - 1].time;
  console.log(`${opts.out}`);
  console.log(`  ${checked.length} bars  ${c(first)} → ${c(last)} Central`);
  console.log(`  ${new Date(first).toISOString().slice(0, 10)} → ${new Date(last).toISOString().slice(0, 10)} UTC`);
  if (dropped) console.log(`  dropped ${dropped} row(s) with no price in them`);
  if (limit && rows.length > limit) console.log(`  kept the last ${limit} of ${rows.length} rows`);
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
