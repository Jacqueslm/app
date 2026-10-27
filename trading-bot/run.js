#!/usr/bin/env node
'use strict';
/*
 * Measure one strategy against one file of bars.
 *
 *   node run.js --data data/sample-synthetic-1h.csv --strategy example-sma
 *
 * The report always carries buy and hold beside the result, because a number on
 * its own says nothing. It also says out loud when the run is too small, or when
 * the strategy never traded, instead of printing a confident percentage over
 * nothing.
 */

const path = require('node:path');
const { loadCandles, isSynthetic } = require('./lib/candles');
const { runBacktest } = require('./lib/backtest');

const HELP = `node run.js --data <file.csv> --strategy <name> [options]

  --data <file>            the bars to run on (required)
  --strategy <name>        a file in strategies/, or a path to one (required)
  --cash <n>               starting cash (default 10000)
  --fee-bps <n>            commission per fill, in basis points (default 0)
  --slippage-bps <n>       slippage per fill, in basis points (default 0)
  --rebalance-pct <n>      ignore drift under this fraction of equity (default 0.01)
  --periods-per-year <n>   bars per year, for the Sharpe figure (default 8760 = 1h)
  --allow-short            permit short exposure
  --json                   print the raw result instead of the report
  --help                   this list
`;

function parseArgs(argv) {
  const out = { flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument ${arg}`);
    const key = arg.slice(2);
    if (key === 'help') { out.help = true; continue; }
    if (key === 'json' || key === 'allow-short') { out.flags[key] = true; continue; }
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${key} needs a value`);
    out.flags[key] = value;
  }
  return out;
}

function loadStrategy(name) {
  const file = name.includes('/') || name.endsWith('.js')
    ? path.resolve(process.cwd(), name)
    : path.join(__dirname, 'strategies', `${name}.js`);
  let mod;
  try {
    mod = require(file);
  } catch (err) {
    throw new Error(`cannot load the strategy ${name}: ${err.message}`);
  }
  if (!mod || typeof mod.signal !== 'function') {
    throw new Error(`${file} does not export a signal(ctx) function`);
  }
  return mod;
}

const money = (n) => `$${n.toFixed(2)}`;
const pct = (n) => (n === null || n === undefined ? 'n/a' : `${n.toFixed(2)}%`);
const iso = (ms) => new Date(ms).toISOString();
const bps = (v) => (v ? Number(v) : 0);

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
  if (args.help || (!args.flags.data && !args.flags.strategy)) {
    console.log(HELP);
    return;
  }
  if (!args.flags.data) throw new Error('--data is required');
  if (!args.flags.strategy) throw new Error('--strategy is required');

  const f = args.flags;
  const candles = loadCandles(f.data);
  const strategy = loadStrategy(f.strategy);
  const opts = {
    cash: f.cash,
    feeBps: f['fee-bps'],
    slippageBps: f['slippage-bps'],
    rebalancePct: f['rebalance-pct'],
    periodsPerYear: f['periods-per-year'],
    allowShort: !!f['allow-short'],
  };
  const result = runBacktest({ candles, strategy, ...opts });
  /* Read off the file's own marker: the generator labels what it makes, so the
     report can say the bars are synthetic without guessing from a file name. */
  const synthetic = isSynthetic(f.data);

  if (f.json) {
    console.log(JSON.stringify({
      strategy: { name: strategy.name || f.strategy, describe: strategy.describe ? strategy.describe() : null },
      data: path.relative(process.cwd(), f.data),
      synthetic,
      costs: { feeBps: bps(f['fee-bps']), slippageBps: bps(f['slippage-bps']), allowShort: !!f['allow-short'], rebalancePct: result.config.rebalance },
      metrics: result.metrics,
      fills: result.fills,
      equity: result.equity,
    }, null, 2));
    return;
  }

  const m = result.metrics;
  console.log(`${strategy.name || f.strategy}${strategy.describe ? ` — ${strategy.describe()}` : ''}`);
  console.log(`data      ${f.data}  (${m.bars} bars, ${iso(m.firstTime)} → ${iso(m.lastTime)})`);
  console.log(`costs     ${bps(f['fee-bps'])} bps fee, ${bps(f['slippage-bps'])} bps slippage, rebalance over ${pct(result.config.rebalance * 100)}, shorts ${opts.allowShort ? 'on' : 'off'}`);
  console.log('');
  console.log(`cash      ${money(m.initialCash)} → ${money(m.finalEquity)}`);
  console.log(`return    ${pct(m.totalReturnPct)}`);
  console.log(`buy&hold  ${pct(m.buyHoldReturnPct)}   ← the number that matters most`);
  console.log(`max fall  ${pct(m.maxDrawdownPct)} from a peak`);
  console.log(`fills     ${m.fills}, in the market ${pct(m.exposurePct)} of the bars`);
  console.log(`costs paid ${money(m.feesPaid)} in fees, ${money(m.slippageCost)} to slippage`);
  console.log(`sharpe    ${m.sharpe === null ? 'n/a' : m.sharpe.toFixed(2)} (annualised over ${result.config.periodsPerYear} bars/yr — a rough figure, not a promise)`);
  console.log('');

  const notes = [];
  if (synthetic) notes.push('the bars are synthetic, so this run tests the plumbing and says nothing about profit');
  if (m.bars < 200) notes.push(`only ${m.bars} bars: any figure off this is noise`);
  if (m.fills === 0) notes.push('the strategy never traded, so nothing was measured');
  if (m.droppedSignals > 0) notes.push(`${m.droppedSignals} signal(s) on the final bar had no next open to fill at and were dropped`);
  if (m.buyHoldReturnPct !== null && m.totalReturnPct !== null && m.totalReturnPct > m.buyHoldReturnPct) {
    notes.push(`beat buy and hold by ${(m.totalReturnPct - m.buyHoldReturnPct).toFixed(2)} points on this data`);
  } else if (m.buyHoldReturnPct !== null) {
    notes.push('did not beat buy and hold on this data');
  }
  if (m.sharpe !== null && Math.abs(m.sharpe) > 3 && m.bars < 1000) notes.push('a Sharpe that high over a run this short usually means the data is too kind, not that the edge is real');

  for (const note of notes) console.log(`- ${note}`);
  console.log('');
  console.log('none of this is a prediction: it is what this strategy would have done on these bars, with the rules in lib/backtest.js');
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
