'use strict';
/*
 * The "drastic move" filter, and the arithmetic behind it.
 *
 * The rule as written takes any close back above the last 15m swing high. Most of
 * those are quiet drifting closes that happen to cross a line. A drastic one is a
 * bar that covered far more ground than the bars around it — a displacement, not a
 * drift.
 *
 * Measured honestly: the trigger bar's own high-low is compared with the MEDIAN
 * range of the fifty bars BEFORE it. The median rather than the average, because one
 * news candle can drag an average up and make every later bar look quiet. Only bars
 * before it are used, so the filter cannot see the bar it is judging.
 */

const test = require('node:test');
const assert = require('node:assert');
const { medianRange, findTrades } = require('../lib/reclaim');

const bar = (i, range) => ({
  time: Date.parse('2026-01-05T14:30:00Z') + i * 900e3,
  open: 100, high: 100 + range, low: 100, close: 100 + range, volume: 100,
});

test('the usual range is the median of the bars before, not the bar being judged', () => {
  const bars = Array.from({ length: 25 }, (_, i) => bar(i, 1));
  bars[24] = bar(24, 9);                      // the trigger bar: huge
  assert.equal(medianRange(bars, 24), 1, 'the trigger bar is not part of its own baseline');
});

test('one news candle does not drag the baseline up', () => {
  const bars = Array.from({ length: 25 }, (_, i) => bar(i, 1));
  bars[10] = bar(10, 40);                     // a single violent bar in the past
  const values = bars.slice(0, 24).map((b) => b.high - b.low).sort((a, b) => a - b);
  assert.equal(medianRange(bars, 24), values[12], 'the median ignores the outlier, an average would not');
});

test('too little history means no baseline rather than a guess', () => {
  const bars = Array.from({ length: 5 }, (_, i) => bar(i, 1));
  assert.equal(medianRange(bars, 4), null);
});

test('the filter is refused if it is not a positive multiple', () => {
  const bars = Array.from({ length: 80 }, (_, i) => bar(i, 1));
  assert.throws(() => findTrades({ bars, impulse: 0 }), /has to be a positive multiple/);
  assert.throws(() => findTrades({ bars, impulse: -2 }), /has to be a positive multiple/);
});
