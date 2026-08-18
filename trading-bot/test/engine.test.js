'use strict';

const assert = require('assert');
const path = require('path');

const { aggregate, findSwings } = require('../src/candles');
const { analyzeStructure, sweepAt, computeBias } = require('../src/structure');
const { scanSignal } = require('../src/signal');
const { stepPosition } = require('../src/paper');
const { backtest } = require('../src/backtest');
const { syntheticSeries } = require('../src/synthetic');
const { loadJson } = require('../src/util');

const cfg = loadJson(path.join(__dirname, '..', 'config.json'), {});

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    process.exitCode = 1;
  }
}

console.log('Market Structure Bot — unit tests\n');

// 1. Aggregation
test('aggregate: three 5m bars → one 15m candle', () => {
  const m5 = [
    { t: 900000, o: 10, h: 12, l: 9, c: 11, v: 1 },
    { t: 1200000, o: 11, h: 13, l: 10, c: 12, v: 2 },
    { t: 1500000, o: 12, h: 14, l: 11, c: 13, v: 3 },
  ];
  const m15 = aggregate(m5, 900000);
  assert.strictEqual(m15.length, 1);
  assert.strictEqual(m15[0].o, 10);
  assert.strictEqual(m15[0].h, 14);
  assert.strictEqual(m15[0].l, 9);
  assert.strictEqual(m15[0].c, 13);
  assert.strictEqual(m15[0].v, 6);
});

// 2. Swings
test('findSwings: local peak and valley detected', () => {
  // highs: index 2 (105) is a clear peak; lows: index 5 (90) a clear valley
  const hs = [100, 101, 105, 101, 100, 95, 100, 99];
  const candles = hs.map((h, i) => ({ t: i, o: h, h, l: h - 5, c: h, v: 1 }));
  const { highs, lows } = findSwings(candles, 2);
  assert.ok(highs.some((s) => s.index === 2), 'peak at index 2');
  assert.ok(lows.some((s) => s.index === 5), 'valley at index 5');
});

// 3. Structure trend
test('analyzeStructure: rising zigzag reads as up', () => {
  const closes = [10, 12, 11, 13, 12, 15, 14, 17, 16, 19];
  const candles = closes.map((c, i) => ({ t: i, o: c, h: c + 0.5, l: c - 0.5, c, v: 1 }));
  const res = analyzeStructure(candles, 1);
  assert.strictEqual(res.trend, 'up');
});

test('analyzeStructure: falling zigzag reads as down', () => {
  const closes = [19, 17, 18, 15, 16, 13, 14, 11, 12, 9];
  const candles = closes.map((c, i) => ({ t: i, o: c, h: c + 0.5, l: c - 0.5, c, v: 1 }));
  const res = analyzeStructure(candles, 1);
  assert.strictEqual(res.trend, 'down');
});

// 4. Bias
test('computeBias: daily anchors the bias', () => {
  assert.strictEqual(computeBias({ daily: 'up', h4: 'up', h1: 'down' }), 'bull');
  assert.strictEqual(computeBias({ daily: 'down', h4: 'down', h1: 'up' }), 'bear');
  assert.strictEqual(computeBias({ daily: 'up', h4: 'down', h1: 'down' }), 'neutral');
  assert.strictEqual(computeBias({ daily: 'flat', h4: 'up', h1: 'up' }), 'bull');
});

// 5. Sweep detection
test('sweepAt: wick through the level and close back', () => {
  const level = { price: 95 };
  // sell-side sweep (bullish): dips below 95, closes back above
  assert.strictEqual(sweepAt({ h: 98, l: 90, c: 97 }, level, 'down'), true);
  // buy-side sweep (bearish): spikes above 95, closes back below
  assert.strictEqual(sweepAt({ h: 98, l: 90, c: 94 }, level, 'up'), true);
  // pierced but did NOT close back through → not a sweep
  assert.strictEqual(sweepAt({ h: 98, l: 90, c: 92 }, level, 'down'), false);
});

// 6. Signal rules (fabricated context)
test('scanSignal: bias + manipulation + 15m BOS + 5m BOS → long', () => {
  const ctx = {
    symbol: 'MNQ',
    bias: 'bull',
    tf15: {
      candles: [
        { t: 0, o: 100, h: 101, l: 99, c: 100, v: 1 },
        { t: 1, o: 100, h: 100, l: 90, c: 102, v: 1 },
      ],
      levels: { bsl: [], ssl: [{ index: 0, time: 0, price: 95, kind: 'swing-low' }] },
      structure: { trend: 'up', events: [{ type: 'bos', dir: 'up', index: 2, time: 2, price: 104 }] },
    },
    tf5: {
      candles: [],
      levels: { bsl: [], ssl: [] },
      structure: { trend: 'up', events: [{ type: 'bos', dir: 'up', index: 5, time: 5, price: 105 }] },
    },
  };
  const signal = scanSignal(ctx, cfg);
  assert.ok(signal, 'a signal should be produced');
  assert.strictEqual(signal.dir, 'long');
  assert.strictEqual(signal.entry, 105);
  assert.strictEqual(signal.stop, 89.5); // sweep extreme 90 − 2 ticks (0.5)
  assert.ok(signal.t2 > signal.t1 && signal.t1 > signal.entry);
});

test('scanSignal: neutral bias → no signal', () => {
  const ctx = { symbol: 'MNQ', bias: 'neutral', tf15: { candles: [], levels: { bsl: [], ssl: [] }, structure: { events: [] } }, tf5: { candles: [], levels: { bsl: [], ssl: [] }, structure: { events: [] } } };
  assert.strictEqual(scanSignal(ctx, cfg), null);
});

// 7. Position manager
test('stepPosition: long hits 2R target', () => {
  const pos = { dir: 'long', entry: 100, stop: 95, t1: 105, t2: 110, risk: 5, pointValue: 5, contracts: 1, beMoved: false };
  const closed = stepPosition(pos, { t: 1, o: 100, h: 111, l: 99, c: 108 });
  assert.ok(closed);
  assert.strictEqual(closed.reason, 'target');
  assert.strictEqual(closed.pnl, 50); // +10 pts × $5
  assert.strictEqual(closed.r, 2);
});

test('stepPosition: short stops out for -1R', () => {
  const pos = { dir: 'short', entry: 100, stop: 105, t1: 95, t2: 90, risk: 5, pointValue: 2, contracts: 1, beMoved: false };
  const closed = stepPosition(pos, { t: 1, o: 100, h: 106, l: 99, c: 104 });
  assert.ok(closed);
  assert.strictEqual(closed.reason, 'stop');
  assert.strictEqual(closed.pnl, -10);
  assert.strictEqual(closed.r, -1);
});

test('stepPosition: 1R touch moves stop to breakeven', () => {
  const pos = { dir: 'long', entry: 100, stop: 95, t1: 105, t2: 110, risk: 5, pointValue: 5, contracts: 1, beMoved: false };
  const first = stepPosition(pos, { t: 1, o: 100, h: 106, l: 100.2, c: 105 });
  assert.strictEqual(first, null, 'still open after 1R touch');
  assert.strictEqual(pos.beMoved, true);
  assert.strictEqual(pos.stop, 100);
  const second = stepPosition(pos, { t: 2, o: 100, h: 101, l: 99.5, c: 100 });
  assert.ok(second);
  assert.strictEqual(second.reason, 'breakeven');
  assert.strictEqual(second.r, 0);
});

// 8. Backtest smoke test on synthetic data (must not throw)
test('backtest: synthetic series runs end to end', () => {
  const series = syntheticSeries('MNQ', cfg);
  const res = backtest(series, 'MNQ', cfg, { warmup5m: 200 });
  assert.ok(Array.isArray(res.trades));
  assert.strictEqual(typeof res.total, 'number');
  assert.strictEqual(typeof res.sumPnl, 'number');
});

console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}\n`);
if (process.exitCode) process.exit(process.exitCode);
