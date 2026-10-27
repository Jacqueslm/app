#!/usr/bin/env node
'use strict';
/*
 * Read the market structure, on every timeframe, and print it.
 *
 *   node structure.js --data data/sample-synthetic-1h.csv
 *   node structure.js --data bars.csv --timeframes 15m,1h,4h,1d
 *
 * This reports; it does not trade. There is no entry rule, no exit rule and no
 * size yet, so there is nothing to measure — this is the read a rule will be
 * built on, and it is deliberately separated so the read can be checked on its
 * own.
 */

const path = require('node:path');
const { loadCandles, isSynthetic, parseTime } = require('./lib/candles');
const { multiTimeframe, nameOf, DEFAULTS } = require('./lib/structure');

const HELP = `node structure.js --data <file.csv> [options]

  --data <file>            the bars to read (required)
  --timeframes <list>      comma separated, e.g. 15m,1h,4h,1d
                           (default: the bar size itself, plus 4x and 24x it)
  --swing-left <n>         bars before a swing that must be lower/higher (default ${DEFAULTS.left})
  --swing-right <n>        bars after it — and so how late the swing is known (default ${DEFAULTS.right})
  --session-anchor <time>  where the day starts, ISO or epoch ms (default the epoch: UTC midnight)
  --at <time>              read the structure as it stood at that moment, not at the end
  --json                   print the raw read instead of the report
  --help                   this list
`;

function parseArgs(argv) {
  const out = { flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument ${arg}`);
    const key = arg.slice(2);
    if (key === 'help') { out.help = true; continue; }
    if (key === 'json') { out.flags[key] = true; continue; }
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${key} needs a value`);
    out.flags[key] = value;
  }
  return out;
}

const iso = (ms) => new Date(ms).toISOString();
const price = (n) => n.toFixed(2);
const ago = (bars) => (bars === 0 ? 'this bar' : bars === 1 ? '1 bar ago' : `${bars} bars ago`);

/* The default set: the bars themselves, four times bigger, and 24 times bigger,
   which is the smallest set that answers "every timeframe" without pretending to
   know which ones you trade. */
function defaultTimeframes(base) {
  return [...new Set([nameOf(base), nameOf(base * 4), nameOf(base * 24)])];
}

function stateLine(state) {
  if (!state) return { trend: 'unknown', high: '—', low: '—', event: '—' };
  const high = state.high ? `${price(state.high.price)} (${state.index - state.high.index} bars)` : '—';
  const low = state.low ? `${price(state.low.price)} (${state.index - state.low.index} bars)` : '—';
  const event = state.event
    ? `${state.event.kind} ${state.event.direction} ${price(state.event.level)} this bar`
    : '—';
  return { trend: state.trend, high, low, event };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error('\n' + HELP);
    process.exitCode = 2;
    return;
  }
  if (args.help || !args.flags.data) {
    console.log(HELP);
    if (!args.help) process.exitCode = 2;
    return;
  }

  const f = args.flags;
  const candles = loadCandles(f.data);
  const base = candles.length > 1 ? candles[1].time - candles[0].time : null;
  const timeframes = f.timeframes ? String(f.timeframes).split(',').map((s) => s.trim()).filter(Boolean) : defaultTimeframes(base || 3600e3);
  const anchorMs = f['session-anchor'] !== undefined ? parseTime(f['session-anchor'], 0) : 0;

  const read = multiTimeframe(candles, {
    timeframes,
    left: f['swing-left'],
    right: f['swing-right'],
    anchorMs,
  });

  let index = candles.length - 1;
  if (f.at !== undefined) {
    const when = parseTime(f.at, 0);
    if (when < candles[0].time) throw new Error(`--at is before the first bar, ${iso(candles[0].time)}`);
    index = candles.length - 1;
    while (index > 0 && candles[index].time > when) index--;
  }

  const synthetic = isSynthetic(f.data);
  const at = read.at(index);

  if (f.json) {
    console.log(JSON.stringify({
      data: path.relative(process.cwd(), f.data),
      synthetic,
      baseInterval: nameOf(read.baseIntervalMs),
      at: { index, time: at.time },
      swings: { left: read.reads[0].tracked.left, right: read.reads[0].tracked.right },
      reads: read.reads.map((entry) => ({
        name: entry.name,
        bars: entry.bars.length,
        swings: entry.tracked.swings.length,
        breaks: entry.tracked.events.length,
        state: entry.stateAt[index],
      })),
      alignment: { verdict: at.alignment, counts: at.counts },
    }, null, 2));
    return;
  }

  console.log(`market structure — ${f.data}`);
  console.log(`bars     ${nameOf(read.baseIntervalMs)}, ${candles.length} of them, ${iso(candles[0].time)} → ${iso(candles[candles.length - 1].time)}`);
  console.log(`swings   a high or low beyond ${read.reads[0].tracked.left} bar(s) either side, known only ${read.reads[0].tracked.right} bar(s) later`);
  console.log(`reading  as it stood at the close of ${iso(at.time)} (bar ${index} of ${candles.length - 1})`);
  console.log('');
  console.log('timeframe  trend    last high        last low         last break');
  for (const entry of at.perTimeframe) {
    const line = stateLine(entry.state);
    console.log(
      `${entry.name.padEnd(10)} ${line.trend.padEnd(8)} ${line.high.padEnd(16)} ${line.low.padEnd(16)} ${line.event}`,
    );
  }
  console.log('');
  const c = at.counts;
  console.log(`alignment  ${at.alignment}  —  up ${c.up}, down ${c.down}, range ${c.range}, forming ${c.forming}, not enough history ${c.unknown}`);

  const notes = [];
  if (synthetic) notes.push('the bars are synthetic, so this read is about the plumbing and not about any real market');
  if (c.unknown > 0) notes.push(`${c.unknown} timeframe(s) have no closed bar yet at this point, so they are silent rather than guessed`);
  if (c.forming > 0) notes.push(`${c.forming} timeframe(s) do not have two confirmed swings each way yet, so their structure is unread`);
  for (const entry of read.reads) {
    if (entry.name !== timeframes[0] && entry.bars.length === candles.length) {
      notes.push(`${entry.name} is the same size as the bars, so it is the same read`);
    }
    const stillOpen = entry.bars.length && entry.ms !== read.baseIntervalMs
      && entry.bars[entry.bars.length - 1].time + entry.ms > candles[candles.length - 1].time;
    if (stillOpen) notes.push(`the newest ${entry.name} bar is still forming and is not counted; it is only read once it closes`);
  }
  if (at.alignment === 'mixed') notes.push('mixed means the timeframes disagree or some have nothing to say yet: it is a description, not a signal');
  for (const note of notes) console.log(`- ${note}`);
  console.log('');
  console.log('a break here is a close beyond a swing, never a wick, and each level can break once');
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
