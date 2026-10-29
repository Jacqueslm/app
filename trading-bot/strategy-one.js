#!/usr/bin/env node
'use strict';
/*
 * Measure strategy one.
 *
 *   node strategy-one.js --data data/sample-synthetic-15m.csv --instrument MES
 *
 * This is a separate runner from run.js on purpose. run.js sizes a strategy in
 * fractions of equity and has no notion of a stop or a target, which is exactly
 * what strategy one is made of. Reports win rate, profit and loss factor, and the
 * dollars at four contracts when an instrument is named.
 *
 * The bars are the ENTRY timeframe — 15 minutes — because that is where the trade
 * is taken. The 1-hour and the 4-hour are built from them, and each is only read
 * once its own bar has closed.
 */

const path = require('node:path');
const { loadCandles, isSynthetic } = require('./lib/candles');
const { describeSession } = require('./lib/session');
const { findTrades, stats } = require('./lib/reclaim');
const { findSweepTrades } = require('./lib/sweep');
const { findScalpSignals } = require('./lib/tbr-scalp');
const { parseInterval, baseInterval, resample, nameOf } = require('./lib/structure');
const { KNOWN } = require('./lib/contracts');

const HELP = `node strategy-one.js --data <file.csv> [options]

  --data <file>           the bars to run on, 15m for strategy one (required)
  --instrument <symbol>   ${KNOWN.join(', ')} — reports dollars at that instrument
  --contracts <n>         contracts per trade (default 4)
  --commission <n>        dollars per contract per side (default 0 — say it out loud)
  --slippage-ticks <n>    ticks against you on a stop (default 0)
  --entry <tf>            the bars' own timeframe; checked against the file (default: read off the bars)
  --resample <tf>         build bigger bars from the file's own before running (e.g. 1h from 15m)
  --direction <tf>        1h by default — the trend and the two levels
  --bias <tf>             4h by default
  --rule <name>           reclaim (default), sweep, or scalp — which rule to run
  --stop-buffer <points>  scalp: points beyond the break candle's wick (default 0.25)
  --session <name>        asia, london or ny, on Central time (default ny)
  --anchor <times>        sweep/TBR only: the candles to read, 08:00,14:00 Central (09:00,15:00 Eastern)
  --retest <pct>          sweep/TBR only: how far back inside the candle a close must land (default 50)
  --fill <mode>           sweep/TBR only: sweep (default), fib or both — fib fills a limit at the retrace level
  --fib <pcts>            fib only: the retrace depths, comma separated (default 30,50,70)
  --impulse <n>           only take a trigger bar n times the usual 15m range
  --swing-left <n>        bars before a swing (default 2)
  --swing-right <n>       bars after a swing (default 2)
  --stop-on-touch         the stop fills where it sits; the default is a close through it
  --stop-swing            measure the stop behind the 15m swing, not the 1h higher low
  --target-r <n>          target n multiples of the risk away: sweep — not the candle close;
                          reclaim — not the 1h high
  --long-only             only take the long side
  --short-only            only take the short side
  --all-entries           allow more than the first entry in a session
  --session-anchor <iso>  where the bigger bars are cut (default UTC midnight)
  --json                  the raw result
  --help                  this list
`;

function parseArgs(argv) {
  const out = { flags: {} };
  const bools = new Set(['help', 'json', 'long-only', 'short-only', 'all-entries', 'stop-on-touch', 'stop-swing']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument ${arg}`);
    const key = arg.slice(2);
    if (bools.has(key)) {
      out.flags[key] = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${key} needs a value`);
    out.flags[key] = value;
  }
  return out;
}

const money = (n) => (n === null || n === undefined ? 'n/a' : `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`);
const num = (n, places = 2) => (n === null || n === undefined ? 'n/a' : n.toFixed(places));
const pctf = (n) => (n === null || n === undefined ? 'n/a' : `${n.toFixed(2)}%`);
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');

/*
 * The sweep rule's report. Its own shape because its clock is not a session: the
 * two candles are fixed times of day and the trade ends with the hour after them.
 */
function reportSweep(f, bars, directions, built) {
  const result = findSweepTrades({
    bars,
    anchors: f.anchor ? String(f.anchor).split(',') : undefined,
    retest: f.retest === undefined ? undefined : f.retest,
    entry: f.fill === undefined ? undefined : f.fill,
    fibs: f.fib === undefined ? undefined : String(f.fib).split(','),
    targetR: f['target-r'] === undefined ? null : f['target-r'],
    stopOn: f['stop-on-touch'] ? 'touch' : 'close',
    slippageTicks: f['slippage-ticks'],
    instrument: f.instrument || null,
    contracts: f.contracts,
    commission: f.commission,
    directions,
  });

  const key = f.instrument ? 'dollars' : 'points';
  const all = stats(result.trades, key);
  const longs = stats(result.trades.filter((t) => t.direction === 'long'), key);
  const shorts = stats(result.trades.filter((t) => t.direction === 'short'), key);
  const synthetic = isSynthetic(f.data);
  const unit = f.instrument ? `$ at ${result.config.contracts} ${result.config.instrument}` : 'points';

  if (f.json) {
    console.log(JSON.stringify({
      data: path.relative(process.cwd(), f.data),
      rule: 'sweep',
      synthetic,
      config: result.config,
      setups: result.setups.length,
      skipped: result.skipped,
      stats: { all, long: longs, short: shorts },
      trades: result.trades,
    }, null, 2));
    return;
  }

  const w = 22;
  const row = (label, a, b, c) => {
    const cell = (v) => String(v).padStart(11);
    console.log(`${String(label).padEnd(w)}${cell(a)}${cell(b)}${cell(c)}`);
  };

  console.log('the time-based range — 09:00 and 15:00 Eastern, traded as a scalp');
  console.log(`data      ${f.data}  (${result.config.bars} bars, ${iso(result.config.firstTime)} → ${iso(result.config.lastTime)})`);
  if (built) console.log(`built     ${nameOf(result.config.base)} bars out of the file's own ${built} — the candle is the same candle, read finer`);
  console.log(`clock     the ${result.config.anchors.join(' and ')} Central candle, and the hour after each`);
  if (result.config.holdHours > 1) {
    if (result.config.entry === 'sweep') {
      console.log('          one bar of room is not a trade, so a reclaim on a single-bar action hour fills at the');
      console.log('          next hour\'s open and runs to the end of it');
    } else {
      console.log('          a one-bar hour has no later bar to retrace on, so on 1h bars the fill may come in the');
      console.log('          next hour and the trade runs to the end of the one after it');
    }
  }
  console.log(`          nothing opens outside those hours, and nothing is held past the end of one`);
  if (result.config.entry === 'sweep') {
    console.log(`rules     price leaves the candle, then closes back inside it by ${result.config.retest}% of its range;`);
  } else {
    console.log('rules     price leaves the candle, then comes back to the retrace level;');
  }
  console.log('          trade back toward the candle close, stop behind the sweep; the short is the mirror.');
  if (result.config.entry !== 'sweep') {
    const depths = result.config.fibs.map((p) => `${p}%`).join('/');
    console.log(`entry     ${result.config.entry === 'both' ? 'the retrace first, the sweep as the fallback' : 'a resting limit'} at the ${depths} retrace`);
    console.log('          of the candle, counted in from the edge that was swept — price has to come back to it');
  }
  console.log('scalp     one candle, one hour to work in, flat at the end of it');
  if (result.config.targetR !== null) {
    console.log(`target    ${result.config.targetR}R — the stop is the rule's own, and the target is that many times`);
    console.log('          the risk, instead of the anchor candle close');
  }
  console.log(`exits     on a close through a level, not a wick — target and ${result.config.stopOn === 'touch' ? 'stop on touch' : 'stop'};`);
  console.log('          flat at the last bar of the action hour if neither is closed through');
  console.log(`costs     ${money(result.config.commission)} per contract per side, ${result.config.slippageTicks} tick(s) of slip on a stop`);
  console.log('');
  console.log(`${''.padEnd(w)}${'all'.padStart(11)}${'long'.padStart(11)}${'short'.padStart(11)}`);
  row('trades taken', all.trades, longs.trades, shorts.trades);
  row('setups seen', result.setups.length, result.setups.filter((s) => s.direction === 'long').length, result.setups.filter((s) => s.direction === 'short').length);
  if (result.config.entry !== 'sweep') {
    const onFib = result.trades.filter((t) => t.entryRule === 'fib');
    const onSweep = result.trades.filter((t) => t.entryRule === 'sweep');
    const byDepth = result.config.fibs.map((p) => `${p}% ${onFib.filter((t) => t.fib === p).length}`).join(', ');
    console.log(`entries                  ${onFib.length} on the retrace (${byDepth}), ${onSweep.length} on the sweep`);
  }
  row('win rate', pctf(all.winRatePct), pctf(longs.winRatePct), pctf(shorts.winRatePct));
  row(`net (${unit})`, num(all.net), num(longs.net), num(shorts.net));
  row('profit factor', num(all.profitFactor), num(longs.profitFactor), num(shorts.profitFactor));
  row('payoff (avg win/loss)', num(all.payoffRatio), num(longs.payoffRatio), num(shorts.payoffRatio));
  row('avg win', num(all.averageWin), num(longs.averageWin), num(shorts.averageWin));
  row('avg loss', num(all.averageLoss), num(longs.averageLoss), num(shorts.averageLoss));
  row('net in R', num(all.totalR), num(longs.totalR), num(shorts.totalR));
  row('worst run down', num(all.maxRunDown), num(longs.maxRunDown), num(shorts.maxRunDown));
  row('losses in a row', all.maxLossesInARow, longs.maxLossesInARow, shorts.maxLossesInARow);
  console.log('');
  for (const reason of ['target', 'stop', 'hour']) {
    const countOf = result.trades.filter((t) => t.exit.reason === reason).length;
    console.log(`exits     ${String(countOf).padStart(3)} on the ${reason === 'hour' ? 'action hour close (neither level closed through)' : reason}`);
  }
  if (result.skipped.length) {
    const byReason = new Map();
    for (const s of result.skipped) byReason.set(s.reason, (byReason.get(s.reason) || 0) + 1);
    console.log('');
    for (const [reason, count] of [...byReason].sort((a, b) => b[1] - a[1])) {
      console.log(`skipped   ${String(count).padStart(3)} — ${reason}`);
    }
  }

  const notes = [];
  if (synthetic) notes.push('the bars are synthetic random numbers: this run tests the rules and says nothing about profit');
  if (all.trades === 0) notes.push('no trade was taken, so nothing was measured — the rules never lined up on this data');
  if (result.config.bars < 2000) notes.push(`only ${result.config.bars} bars: any figure off this is noise`);
  if (all.trades > 0 && all.trades < 30) notes.push(`${all.trades} trades is too few to mean anything; 100+ before a number is worth reading`);
  if (all.profitFactor === null && all.trades > 0) notes.push('no losing trade in the run, so the profit factor is unknown rather than infinite');
  if (all.winRatePct !== null && all.breakevenWinRatePct !== null && all.winRatePct < all.breakevenWinRatePct) {
    notes.push(`this mix of win and loss needs ${pctf(all.breakevenWinRatePct)} wins to break even; it got ${pctf(all.winRatePct)}`);
  }
  if (!f.instrument) notes.push('no --instrument, so every figure is in points; four contracts make a point worth $10 on MGC, $2 on MNQ, $5 on MES');
  if (f.instrument && !Number(f.commission)) notes.push('commission is 0, so the win rate is honest and the profit is optimistic');

  if (notes.length) {
    console.log('');
    for (const note of notes) console.log(`- ${note}`);
  }
  console.log('');
  console.log('this is what these rules would have done on these bars. it is not a prediction.');
}

/*
 * The TBR scalp's report. Its clock is the session, not an anchor candle: the range
 * is the session's own high and low, a close beyond it is the break, and the signal
 * is the return into the 30, 50 or 70 per cent fib of that leg.
 *
 * The gating is findScalpSignals' own, read through inTbrSession in lib/session.js,
 * so the window here is the same one the rest of the bot reads and there is no
 * second copy of 09:00–15:00 anywhere.
 */
function reportScalp(f, bars, directions) {
  const fibs = f.fib === undefined ? undefined : String(f.fib).split(',').map((p) => Number(p) / 100);
  const result = findScalpSignals({
    bars,
    fibs,
    stopBuffer: f['stop-buffer'] === undefined ? undefined : f['stop-buffer'],
    directions,
  });
  const signals = result.signals;
  const synthetic = isSynthetic(f.data);

  if (f.json) {
    console.log(JSON.stringify({
      data: path.relative(process.cwd(), f.data),
      rule: 'scalp',
      synthetic,
      window: result.window,
      config: result.config,
      signals,
      rejections: result.rejections,
    }, null, 2));
    return;
  }

  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const where = `${hhmm(result.window.et.open)}–${hhmm(result.window.et.close)} ${result.window.et.zone}`
    + ` = ${hhmm(result.window.ct.open)}–${hhmm(result.window.ct.close)} ${result.window.ct.zone}`;

  console.log('the TBR scalp — break the range, return into the fib, stop behind the wick');
  console.log(`data      ${f.data}  (${result.config.bars} bars)`);
  console.log(`clock     ${where}`);
  console.log('          signals only fire while that window is open, both edges included');
  console.log(`fibs      ${result.config.fibs.map((x) => `${Math.round(x * 100)}%`).join(', ')} of the break leg`);
  console.log(`stop      the break candle's wick plus ${result.config.stopBuffer} point(s)`);
  console.log('target    the break candle\'s close');
  console.log('');
  if (!signals.length) console.log('signals   none');
  for (const s of signals) {
    console.log(`signal    ${s.side.padEnd(5)} entry ${s.entry}  stop ${s.stop}  target ${s.target}`
      + `  isScalp ${s.isScalp}  fib ${Math.round(s.fib * 100)}%  ${iso(s.time)}  window ${where}`);
  }
  const byReason = new Map();
  for (const r of result.rejections) byReason.set(r.reason, (byReason.get(r.reason) || 0) + 1);
  if (byReason.size) {
    console.log('');
  for (const [reason, count] of [...byReason].sort((a, b) => b[1] - a[1])) {
    const first = result.rejections.find((x) => x.reason === reason);
    console.log(`rejected  ${String(count).padStart(3)} — ${reason}`);
    console.log(`          ${first.side} · isScalp ${first.isScalp} · no entry, stop or target: nothing was priced`
      + ` · ${iso(first.time)} · window ${where}`);
  }
  }
  console.log('');
  console.log(`${signals.length} scalp signal(s), ${result.rejections.length} refused candidate(s).`);
  const notes = [];
  if (synthetic) notes.push('the bars are synthetic: this run tests the rule and says nothing about profit');
  if (!signals.length) notes.push('no signal was taken, so nothing was measured');
  for (const note of notes) console.log(`- ${note}`);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error(`\n${HELP}`);
    process.exitCode = 2;
    return;
  }
  if (args.help || !args.flags.data) {
    console.log(HELP);
    return;
  }
  const f = args.flags;
  let bars = loadCandles(f.data);
  let built = null;
  if (f.resample !== undefined) {
    const ms = parseInterval(f.resample);
    const base = baseInterval(bars);
    if (ms <= base) throw new Error(`--resample ${f.resample} is not bigger than the bars in the file (${nameOf(base)})`);
    if (ms % base !== 0) throw new Error(`--resample ${f.resample} is not a whole number of ${nameOf(base)} bars`);
    built = nameOf(base);
    bars = resample(bars, ms, 0);
  }
  const directions = f['long-only'] ? ['long'] : f['short-only'] ? ['short'] : ['long', 'short'];

  /* --fill is a TBR flag, so naming one is the same as asking for the TBR rule. */
  const rule = f.fill !== undefined ? 'sweep' : f.rule === undefined ? 'reclaim' : String(f.rule).trim().toLowerCase();
  if (rule !== 'reclaim' && rule !== 'sweep' && rule !== 'scalp') {
    console.error(`--rule is reclaim, sweep or scalp, got ${JSON.stringify(f.rule)}`);
    process.exitCode = 2;
    return;
  }
  if (rule === 'scalp') { reportScalp(f, bars, directions); return; }
  if (rule === 'sweep') { reportSweep(f, bars, directions, built); return; }

  const result = findTrades({
    bars,
    biasTimeframe: f.bias || '4h',
    directionTimeframe: f.direction || '1h',
    entryTimeframe: f.entry || null,
    session: f.session || 'ny',
    left: f['swing-left'],
    right: f['swing-right'],
    directions,
    onePerSession: !f['all-entries'],
    stopOn: f['stop-on-touch'] ? 'touch' : 'close',
    stopAt: f['stop-swing'] ? 'swing' : 'structure',
    targetR: f['target-r'] === undefined ? null : f['target-r'],
    impulse: f.impulse === undefined ? null : f.impulse,
    slippageTicks: f['slippage-ticks'],
    instrument: f.instrument || null,
    contracts: f.contracts,
    commission: f.commission,
    anchorMs: f['session-anchor'] ? Date.parse(f['session-anchor']) : 0,
  });

  const key = f.instrument ? 'dollars' : 'points';
  const all = stats(result.trades, key);
  const longs = stats(result.trades.filter((t) => t.direction === 'long'), key);
  const shorts = stats(result.trades.filter((t) => t.direction === 'short'), key);
  const synthetic = isSynthetic(f.data);
  const unit = f.instrument ? `$ at ${result.config.contracts} ${result.config.instrument}` : 'points';

  if (f.json) {
    console.log(JSON.stringify({
      data: path.relative(process.cwd(), f.data),
      synthetic,
      config: result.config,
      window: result.window,
      setups: result.setups.length,
      skipped: result.skipped,
      stats: { all, long: longs, short: shorts },
      trades: result.trades,
    }, null, 2));
    return;
  }

  const w = 22;
  const row = (label, a, b, c) => {
    const cell = (v) => String(v).padStart(11);
    console.log(`${String(label).padEnd(w)}${cell(a)}${cell(b)}${cell(c)}`);
  };

  console.log('strategy one — the high the market last made');
  console.log(`data      ${f.data}  (${result.config.bars} bars, ${iso(result.config.firstTime)} → ${iso(result.config.lastTime)})`);
  console.log(`clock     ${describeSession(result.config.session)} — nothing opens outside it, flat at its close`);
  console.log(`structure ${result.config.biasTimeframe} for bias, ${result.config.directionTimeframe} for direction, `
    + `entries taken on the ${result.config.entryTimeframe}`);
  console.log(`          (swing ${result.config.left} left / ${result.config.right} right)`);
  console.log('rules     4h up + 1h HH/HL, then a close back above the previous swing high on the entry timeframe;');
  console.log('          target the 1h high already made, stop behind the 1h higher low; the short is the mirror.');
  console.log('          First entry of the session only.');
  console.log(`exits     on a close through a level, not a wick — target and ${result.config.stopOn === 'touch' ? 'stop on touch' : 'stop'};`);
  console.log('          flat at 15:00 Central if neither is closed through');
  if (result.config.stopAt === 'swing') console.log('variant   stop behind the 15m swing (the rule puts it behind the 1h higher low)');
  if (result.config.targetR !== null) console.log(`variant   target ${result.config.targetR}R away (the rule puts it at the 1h high already made)`);
  if (result.config.impulse !== null) console.log(`variant   only triggers ${result.config.impulse}x the usual 15m range (the rule takes any)`);
  console.log(`costs     ${money(result.config.commission)} per contract per side, ${result.config.slippageTicks} tick(s) of slip on a stop`);
  console.log('');
  console.log(`${''.padEnd(w)}${'all'.padStart(11)}${'long'.padStart(11)}${'short'.padStart(11)}`);
  row('trades taken', all.trades, longs.trades, shorts.trades);
  row('setups seen', result.setups.length, result.setups.filter((s) => s.direction === 'long').length, result.setups.filter((s) => s.direction === 'short').length);
  row('win rate', pctf(all.winRatePct), pctf(longs.winRatePct), pctf(shorts.winRatePct));
  row(`net (${unit})`, num(all.net), num(longs.net), num(shorts.net));
  row('profit factor', num(all.profitFactor), num(longs.profitFactor), num(shorts.profitFactor));
  row('payoff (avg win/loss)', num(all.payoffRatio), num(longs.payoffRatio), num(shorts.payoffRatio));
  row('avg win', num(all.averageWin), num(longs.averageWin), num(shorts.averageWin));
  row('avg loss', num(all.averageLoss), num(longs.averageLoss), num(shorts.averageLoss));
  row('net in R', num(all.totalR), num(longs.totalR), num(shorts.totalR));
  row('worst run down', num(all.maxRunDown), num(longs.maxRunDown), num(shorts.maxRunDown));
  row('losses in a row', all.maxLossesInARow, longs.maxLossesInARow, shorts.maxLossesInARow);
  console.log('');
  const reasons = ['target', 'stop', 'session'];
  for (const reason of reasons) {
    const countOf = result.trades.filter((t) => t.exit.reason === reason).length;
    console.log(`exits     ${String(countOf).padStart(3)} on the ${reason === 'session' ? 'session close (neither level closed through)' : reason}`);
  }
  if (result.trades.length) {
    const byReason = new Map();
    for (const s of result.skipped) byReason.set(s.reason, (byReason.get(s.reason) || 0) + 1);
    if (byReason.size) {
      console.log('');
      for (const [reason, count] of [...byReason].sort((a, b) => b[1] - a[1])) {
        console.log(`skipped   ${String(count).padStart(3)} — ${reason}`);
      }
    }
  }

  const notes = [];
  if (synthetic) notes.push('the bars are synthetic random numbers: this run tests the rules and says nothing about profit');
  if (all.trades === 0) notes.push('no trade was taken, so nothing was measured — the rules never lined up on this data');
  if (result.config.bars < 2000) notes.push(`only ${result.config.bars} bars: any figure off this is noise`);
  if (all.trades > 0 && all.trades < 30) notes.push(`${all.trades} trades is too few to mean anything; 100+ before a number is worth reading`);
  if (all.profitFactor === null && all.trades > 0) notes.push('no losing trade in the run, so the profit factor is unknown rather than infinite');
  if (all.winRatePct !== null && all.breakevenWinRatePct !== null && all.winRatePct < all.breakevenWinRatePct) {
    notes.push(`this mix of win and loss needs ${pctf(all.breakevenWinRatePct)} wins to break even; it got ${pctf(all.winRatePct)}`);
  }
  if (all.trades > 0 && Math.abs(all.totalR) < 1) notes.push('inside one R of flat: that is noise, not an edge either way');
  if (!f.instrument) notes.push('no --instrument, so every figure is in points; four contracts make a point worth $10 on MGC, $2 on MNQ, $5 on MES');
  if (f.instrument && !Number(f.commission)) notes.push('commission is 0, so the win rate is honest and the profit is optimistic');

  if (notes.length) {
    console.log('');
    for (const note of notes) console.log(`- ${note}`);
  }
  console.log('');
  console.log('this is what these rules would have done on these bars, with the stop and the session-close exit');
  console.log('as stated above. it is not a prediction, and it is not a reason to trade real money.');
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
