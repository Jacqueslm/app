'use strict';
/*
 * The engine's arithmetic is checked by hand here, on small series where the
 * right answer can be worked out on paper. Everything the bot does later is
 * measured with this instrument, so an error in it would be an error in every
 * number the bot ever reports.
 */

const test = require('node:test');
const assert = require('node:assert');
const { runBacktest, maxDrawdown } = require('../lib/backtest');

const close = (m) => (x) => Math.abs(x - m) < 1e-9;

/*
 * Bars written the way they read on paper: [open, close] pairs, one hour apart.
 * High and low are derived from those two. Written out in full rather than
 * shortened, because a helper that quietly means something else is how a test
 * ends up checking nothing.
 */
function bars(shape) {
  return shape.map((b, i) => {
    const open = b[0];
    const close = b[1] === undefined ? b[0] : b[1];
    return {
      time: Date.parse('2026-01-01T00:00:00Z') + i * 3600e3,
      open, close, high: Math.max(open, close), low: Math.min(open, close), volume: 100,
    };
  });
}

const inThenHold = () => {
  let done = false;
  return { name: 'in-then-hold', signal: () => (done ? undefined : (done = true, 1)) };
};

test('a signal is filled at the next open, at a price that bar really had', () => {
  const candles = bars([[100, 100], [100, 110], [110, 100]]);
  const run = runBacktest({ candles, strategy: inThenHold(), cash: 1000 });
  assert.equal(run.fills.length, 1);
  assert.equal(run.fills[0].time, candles[1].time, 'filled on the bar after the decision');
  assert.equal(run.fills[0].price, 100, "filled at that bar's open");
  assert.equal(run.fills[0].side, 'buy');
});

test('no fees, no slippage: the arithmetic comes out on paper', () => {
  const candles = bars([[100, 100], [100, 110], [110, 100]]);
  const run = runBacktest({ candles, strategy: inThenHold(), cash: 1000 });
  assert.ok(Math.abs(run.fills[0].units - 10) < 1e-9, '1000 of cash at 100 is 10 units');
  assert.ok(close(1000)(run.metrics.finalEquity), 'up to 1100 then back to 1000: flat overall');
  assert.ok(close(0)(run.metrics.totalReturnPct));
  assert.ok(close(1000)(run.metrics.buyHoldFinalEquity), 'and buy and hold is flat too, from the same engine');
});

test('the fee is charged on the notional, and taken out of the money invested', () => {
  const candles = bars([[100, 100], [100, 100]]);
  const run = runBacktest({ candles, strategy: inThenHold(), cash: 1000, feeBps: 10, rebalancePct: 0 });
  // 0.1% of the 999 invested, so 999 units of value, 9.99 units, 0.999 in fees.
  assert.ok(close(9.99)(run.fills[0].units));
  assert.ok(close(0.999)(run.metrics.feesPaid));
  assert.ok(close(999.001)(run.metrics.finalEquity), 'the account pays the fee, it does not borrow it');
});

test('slippage moves the fill against the trade', () => {
  const candles = bars([[100, 100], [100, 100]]);
  const buy = runBacktest({ candles, strategy: inThenHold(), cash: 1000, slippageBps: 100, rebalancePct: 0 });
  assert.ok(close(101)(buy.fills[0].price), 'a buy pays one percent more');
  assert.ok(close(1000 / 101)(buy.fills[0].units));
  assert.ok(buy.metrics.slippageCost > 0);
});

test('buy and hold is the same engine told to be fully invested', () => {
  const candles = bars([[100, 100], [100, 100], [100, 120], [120, 130]]);
  const run = runBacktest({ candles, strategy: inThenHold(), cash: 1000 });
  assert.ok(close(30)(run.metrics.buyHoldReturnPct), '1000 fills at 100 and is worth 1300');
  assert.ok(close(30)(run.metrics.totalReturnPct), 'and the strategy that stayed in matches it');
});

test('a decision made on the last bar cannot be filled, and is reported as dropped', () => {
  const candles = bars([[100, 100], [100, 100], [100, 100]]);
  const late = { signal: (ctx) => (ctx.i === 2 ? 1 : 0) };
  const run = runBacktest({ candles, strategy: late, cash: 1000 });
  assert.equal(run.metrics.droppedSignals, 1);
  assert.equal(run.fills.length, 0);
});

test('a strategy that never says anything never trades', () => {
  const candles = bars([[100, 100], [100, 110], [110, 120]]);
  const run = runBacktest({ candles, strategy: { signal: () => undefined }, cash: 1000 });
  assert.equal(run.fills.length, 0);
  assert.ok(close(0)(run.metrics.exposurePct));
  assert.ok(close(1000)(run.metrics.finalEquity));
});

test('in and out: two fills, and the exposure is what it was told', () => {
  const candles = bars([[100, 100], [100, 100], [100, 100], [100, 100], [100, 100], [100, 100]]);
  const run = runBacktest({
    candles, cash: 1000, rebalancePct: 0,
    strategy: { signal: (ctx) => (ctx.i <= 2 ? 1 : 0) },
  });
  assert.equal(run.fills.length, 2, 'one way in, one way out');
  assert.equal(run.fills[0].side, 'buy');
  assert.equal(run.fills[1].side, 'sell');
  assert.ok(close(50)(run.metrics.exposurePct), 'held through three of six bars');
  assert.ok(close(1000)(run.metrics.finalEquity), 'flat prices, no fees, so the account is untouched');
});

test('looking at a bar that has not happened yet throws', () => {
  const candles = bars([[100, 100], [100, 100], [100, 100]]);
  const peeker = { signal: (ctx) => ctx.history[ctx.i + 1].close };
  assert.throws(() => runBacktest({ candles, strategy: peeker }), /lookahead: bar 1 has not happened yet/);
});

test('the bars cannot be written to either', () => {
  const candles = bars([[100, 100], [100, 100]]);
  const writer = { signal: (ctx) => { ctx.history[0] = { close: 0 }; return 0; } };
  assert.throws(() => runBacktest({ candles, strategy: writer }), /must not change the bars/);
});

test('going short is refused unless it is asked for, and allowed when it is', () => {
  const candles = bars([[100, 105], [105, 95], [95, 90]]);
  const shorter = { signal: () => -1 };
  assert.throws(
    () => runBacktest({ candles, strategy: shorter, cash: 1000 }),
    /asked to go short \(-1\) but shorts are off/,
  );
  const allowed = runBacktest({ candles, strategy: shorter, cash: 1000, allowShort: true, rebalancePct: 0 });
  assert.equal(allowed.fills[0].side, 'sell');
  assert.ok(allowed.metrics.finalEquity > 1000, 'a short makes money when the price falls');
});

test('an exposure outside -1 to 1 is refused, and so is a non-number', () => {
  const candles = bars([[100, 100], [100, 100]]);
  assert.throws(() => runBacktest({ candles, strategy: { signal: () => 2 } }), /exposure runs from -1/);
  assert.throws(() => runBacktest({ candles, strategy: { signal: () => 'buy' } }), /has to return a number/);
  assert.throws(() => runBacktest({ candles, strategy: { signal: () => NaN } }), /has to return a number/);
});

test('the rebalance threshold is what stops a fixed size churning every bar', () => {
  const rising = Array.from({ length: 50 }, (_, i) => [100 * 1.005 ** i, 100 * 1.005 ** i]);
  const candles = bars(rising);
  const half = { signal: () => 0.5 };
  const steady = runBacktest({ candles, strategy: half, cash: 1000 });
  const chase = runBacktest({ candles, strategy: half, cash: 1000, rebalancePct: 0 });
  assert.equal(chase.fills.length, candles.length - 1, 'at zero threshold it nudges on every bar after the first');
  assert.ok(steady.fills.length <= 12, `the default threshold kept it to ${steady.fills.length} fills`);
  assert.ok(steady.fills.length > 1, 'but it does still rebalance as the drift grows');
});

test('the deepest fall from a peak is measured off the curve', () => {
  assert.ok(close(0.5)(maxDrawdown([100, 120, 60, 90])));
  assert.ok(close(0)(maxDrawdown([100, 110, 120])));
  assert.ok(close(0.25)(maxDrawdown([100, 75, 100])));
});

test('the Sharpe figure is withheld when there is too little to compute one', () => {
  const candles = bars([[100, 100], [100, 100], [100, 100]]);
  const flat = runBacktest({ candles, strategy: inThenHold(), cash: 1000 });
  assert.equal(flat.metrics.sharpe, null, 'a flat curve has no variation, so no Sharpe');
});

test('a run needs bars and a strategy, and says so', () => {
  assert.throws(() => runBacktest({ candles: [], strategy: inThenHold() }), /needs at least one bar/);
  assert.throws(() => runBacktest({ candles: bars([[100, 100]]), strategy: {} }), /needs a strategy with a signal/);
});

test('the example strategy runs end to end and reports both numbers', () => {
  const candles = bars(Array.from({ length: 120 }, (_, i) => {
    const base = 100 + 10 * Math.sin(i / 6);
    return [base, base + 1];
  }));
  const run = runBacktest({ candles, strategy: require('../strategies/example-sma'), cash: 1000, feeBps: 5 });
  assert.equal(run.equity.length, 120);
  assert.ok(Number.isFinite(run.metrics.totalReturnPct));
  assert.ok(Number.isFinite(run.metrics.buyHoldReturnPct));
  assert.ok(run.metrics.fills > 0, 'the example is in and out on a wave like this');
  assert.ok(run.metrics.feesPaid > 0);
  assert.ok(Number.isFinite(run.metrics.maxDrawdownPct));
});
