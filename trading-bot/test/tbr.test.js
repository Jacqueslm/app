'use strict';
/*
 * The TBR scalp: the same two candles, entered on the retrace instead of a close.
 *
 * The beliefs this file exists to defend:
 *   - the retrace level is measured IN from the edge that was swept, so a short's
 *     30% is 3.3 points under a 110 high on an 11-point candle;
 *   - the bar that takes the edge is not the fill bar — the trade is the come back;
 *   - a short's limit fills when price trades back DOWN through it, a long's when it
 *     trades back UP, and the fill is the level itself rather than the bar's close;
 *   - the stop is the wick behind the sweep, and the target is still the candle close;
 *   - every trade from this rule is tagged a scalp;
 *   - 'both' uses the retrace when it fills and the sweep when it never does.
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  parseFibs, sweepSetup, fibSetup, findSweepTrades,
} = require('../lib/sweep');

const STEP = 900e3;
const JAN = Date.parse('2026-01-05T14:00:00Z');   // 08:00 Central

function barsFrom(rows, start) {
  return rows.map(([open, high, low, close], i) => ({
    time: start + i * STEP, open, high, low, close, volume: 100,
  }));
}

/* 08:00 candle: high 110, low 99, close 104 — an 11-point range, so the three
   depths sit at 106.7 (30%), 104.5 (50%) and 102.3 (70%) under the high. */
const ANCHOR = [
  [100, 102, 99, 101],
  [101, 103, 100, 102],
  [102, 110, 101, 105],
  [105, 108, 100, 104],
];

/* 09:00 takes the high at 112. 09:15 trades back down to 105, through the 106.7
   level. 09:30 is quiet. 09:45 closes at 103.5, through the candle's 104 close. */
const ACTION = [
  [104, 112, 103, 108],
  [108, 109, 105, 106],
  [106, 107, 104, 105],
  [105, 106, 103, 103.5],
];

const DAY = () => barsFrom([...ANCHOR, ...ACTION], JAN);
const actionBars = () => barsFrom(ACTION, JAN + 4 * STEP);

/* ------------------------------------------------------------------ the levels */

test('the retrace depths are percentages of the candle, shallow first', () => {
  assert.deepEqual(parseFibs('70,30,50'), [30, 50, 70]);
  assert.deepEqual(parseFibs([50, 50, 30]), [30, 50]);
  assert.throws(() => parseFibs('0'), /between 0 and 100/);
  assert.throws(() => parseFibs('100'), /between 0 and 100/);
  assert.throws(() => parseFibs('half'), /between 0 and 100/);
  assert.throws(() => parseFibs(''), /no retrace depth/);
});

/* ------------------------------------------------------------------- the entry */

test('a swept high fills a short at the 30% level, not at the bar close', () => {
  const candle = { high: 110, low: 99, close: 104 };
  const found = fibSetup({ candle, actionBars: actionBars(), fibs: [30] });
  assert.ok(found.setup, found.reason);
  assert.equal(found.setup.direction, 'short');
  assert.equal(found.setup.entry, 106.7, '110 − 30% of 11');
  assert.equal(found.setup.signal, 1, 'the 09:15 bar traded down through it');
  assert.equal(found.setup.target, 104, 'the candle close is still the target');
  assert.equal(found.setup.stop, 112, 'the wick behind the sweep, not the candle high');
});

test('the bar that takes the edge is not the fill bar', () => {
  /* One bar takes the 110 high, and on the way back down trades through 106.7 in
     the same bar. That is not a retrace — the trade is the come back, and no later
     bar returns to the level. */
  const candle = { high: 110, low: 99, close: 104 };
  const rows = [
    [104, 112, 105.5, 108],   // takes the high, and dips through 106.7 on the way
    [108, 109, 107, 108],     // never gets back down to 106.7
    [107, 108, 106.9, 107.5],
  ];
  const found = fibSetup({ candle, actionBars: barsFrom(rows, JAN), fibs: [30] });
  assert.equal(found.setup, undefined);
  assert.match(found.reason, /never traded back to the 30%/);
});

test('a deeper depth needs a deeper retrace', () => {
  const candle = { high: 110, low: 99, close: 104 };
  const depth30 = fibSetup({ candle, actionBars: actionBars(), fibs: [30] });
  const depth50 = fibSetup({ candle, actionBars: actionBars(), fibs: [50] });
  const depth70 = fibSetup({ candle, actionBars: actionBars(), fibs: [70] });
  assert.equal(depth30.setup.signal, 1);
  assert.equal(depth50.setup.signal, 2, '104.5 is reached on the next bar, at 104');
  assert.equal(depth50.setup.entry, 104.5);
  assert.equal(depth70.setup, undefined, 'nothing traded down to 102.3');
  assert.match(depth70.reason, /never traded back to the 70%/);
});

test('the stop is the wick behind the sweep, read up to the fill bar', () => {
  const candle = { high: 110, low: 99, close: 104 };
  const rows = [
    [104, 112, 103, 108],
    [108, 114, 105, 106],   // a higher wick, then back down through 106.7
    [106, 107, 104, 105],
  ];
  const found = fibSetup({ candle, actionBars: barsFrom(rows, JAN), fibs: [30] });
  assert.ok(found.setup, found.reason);
  assert.equal(found.setup.stop, 114, 'the wick made before the fill, not the 112 one');
});

test('a swept low fills a long at the retrace, mirrored', () => {
  const candle = { high: 110, low: 99, close: 104 };
  const rows = [
    [104, 105, 97, 100],    // takes the 99 low at 97
    [100, 101.5, 99.5, 101], // back up through 99 + 3.3 = 102.3? no — needs 102.3
    [101, 103, 100, 102.5],
  ];
  const found = fibSetup({ candle, actionBars: barsFrom(rows, JAN), fibs: [30] });
  assert.ok(found.setup, found.reason);
  assert.equal(found.setup.direction, 'long');
  assert.equal(found.setup.entry, 102.3, '99 + 30% of 11');
  assert.equal(found.setup.signal, 2);
  assert.equal(found.setup.stop, 97);
  assert.equal(found.setup.target, 104);
});

test('if the other side breaks first, there is no retrace to trade', () => {
  const candle = { high: 110, low: 99, close: 104 };
  const rows = [
    [104, 112, 103, 108],
    [108, 109, 98, 100],    // the low goes before the retrace
    [100, 101, 99, 100],
  ];
  const found = fibSetup({ candle, actionBars: barsFrom(rows, JAN), fibs: [30] });
  assert.equal(found.setup, undefined);
  assert.match(found.reason, /other side of the candle broke/);
});

/* ---------------------------------------------------------------- end to end */

test('the retrace run: filled at the level, out on the candle close', () => {
  const result = findSweepTrades({ bars: DAY(), entry: 'fib', fibs: [30] });
  assert.equal(result.trades.length, 1);
  const trade = result.trades[0];
  assert.equal(trade.direction, 'short');
  assert.equal(trade.entryRule, 'fib');
  assert.equal(trade.fib, 30);
  assert.equal(trade.entry.price, 106.7);
  assert.equal(trade.entry.index, 5, 'the 09:15 bar, the first one back to the level');
  assert.equal(trade.stop, 112);
  assert.equal(trade.target, 104);
  assert.equal(trade.exit.reason, 'target');
  assert.equal(trade.exit.price, 103.5);
  assert.equal(trade.points.toFixed(2), '3.20');
});

test('every TBR trade is a scalp, whichever entry filled it', () => {
  const fib = findSweepTrades({ bars: DAY(), entry: 'fib', fibs: [30] });
  const sweep = findSweepTrades({ bars: DAY(), retest: 30 });
  for (const run of [fib, sweep]) {
    assert.equal(run.config.scalp, true);
    assert.equal(run.config.entry, run === fib ? 'fib' : 'sweep');
    for (const trade of run.trades) {
      assert.equal(trade.kind, 'scalp');
      assert.equal(trade.scalp, true);
    }
  }
});

test('both: the retrace fills when price comes back, and the sweep is not used', () => {
  const result = findSweepTrades({ bars: DAY(), entry: 'both', fibs: [30], retest: 30 });
  assert.equal(result.trades.length, 1, 'one candle is one trade, not two');
  assert.equal(result.trades[0].entryRule, 'fib');
  assert.equal(result.trades[0].entry.price, 106.7);
});

test('both: with a depth price never reaches, the sweep entry takes the trade', () => {
  const result = findSweepTrades({ bars: DAY(), entry: 'both', fibs: [70], retest: 30 });
  assert.equal(result.trades.length, 1);
  const trade = result.trades[0];
  assert.equal(trade.entryRule, 'sweep');
  assert.equal(trade.fib, null);
  assert.equal(trade.entry.price, 106, 'the next open after the reclaim close');
});

test('a retrace with no room to the candle close is refused, not re-priced', () => {
  /* A candle that closed under its own 30% level: the short's target would be
     above the fill, so there is no trade. */
  const anchorRows = [
    [100, 110, 99, 109],    // closes at the high, above the short's 106.7 level
    [100, 110, 99, 109],
    [100, 110, 99, 109],
    [100, 110, 99, 109],
  ];
  const actionRows = [
    [100, 112, 99.5, 111],
    [111, 111.5, 105, 106],  // back through 110 − 3.3 = 106.7
    [106, 107, 105, 105.5],
    [105, 106, 104, 105],
  ];
  const result = findSweepTrades({ bars: barsFrom([...anchorRows, ...actionRows], JAN), entry: 'fib', fibs: [30] });
  assert.equal(result.trades.length, 0);
  assert.match(result.skipped[0].reason, /no room to its close/);
});

test('the entry mode and the depths are refused loudly when misspelled', () => {
  assert.throws(() => findSweepTrades({ bars: DAY(), entry: 'limit' }), /sweep, fib or both/);
  assert.throws(() => findSweepTrades({ bars: DAY(), entry: 'fib', fibs: ['half'] }), /between 0 and 100/);
});

/* --------------------------------------------------------------- 1h bars */

test('on 1h bars the retrace fills on the bar after the sweep, and holds two hours', () => {
  const HOUR = 3600e3;
  const rows = [
    [100, 110, 99, 104],    // 08:00 candle
    [104, 112, 105, 108],   // 09:00: takes the high, closes at 108
    [108, 109, 106, 107],   // 10:00: back down through 106.7 — the fill
    [107, 108, 103, 103.5], // 11:00: through the 104 close
  ];
  const bars = rows.map(([open, high, low, close], i) => ({
    time: JAN + i * HOUR, open, high, low, close, volume: 100,
  }));
  const result = findSweepTrades({ bars, entry: 'fib', fibs: [30] });
  assert.equal(result.trades.length, 1);
  const trade = result.trades[0];
  assert.equal(trade.entry.price, 106.7);
  assert.equal(trade.entry.index, 2, 'the 10:00 bar');
  assert.equal(trade.exit.price, 103.5);
  assert.equal(result.config.holdHours, 3, 'the retrace hour plus the hour it exits in');
});

/* ----------------------------------------------------------------- the close */

test('the sweep entry is untouched by the retrace code', () => {
  const candle = { high: 110, low: 99, close: 104 };
  const before = sweepSetup({ candle, actionBars: actionBars(), retest: 30 });
  assert.equal(before.setup.signal, 1);
  assert.equal(before.setup.stop, 112);
  assert.equal(before.setup.target, 104);
});
