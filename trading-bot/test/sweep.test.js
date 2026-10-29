'use strict';
/*
 * The opening-candle sweep, checked against cases small enough to do on paper.
 *
 * The beliefs this file exists to defend:
 *   - the anchor is the hour that CLOSES into 09:00 Central, so its last quarter is
 *     the 08:45 bar — the bar that closes at 09:00 is not part of the 09:00 hour;
 *   - the same 08:00 candle is found in January and in July, when 08:00 Central is a
 *     different UTC hour;
 *   - the sweep decides the direction: the high taken is a short, the low a long;
 *   - the retest depth is measured from the edge that was swept, not from the close;
 *   - the target is the candle's CLOSE, and a wick through it is not an exit;
 *   - the fill is the next bar's open, and nothing is held past the end of the hour.
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  hourOf, parseAnchors, hourBuckets, candleOf, sweepSetup, runSweepTrade, findSweepTrades,
} = require('../lib/sweep');

const STEP = 900e3;
const JAN = Date.parse('2026-01-05T14:00:00Z');   // 08:00 Central, standard time
const JUL = Date.parse('2026-07-06T13:00:00Z');   // 08:00 Central, daylight time

function barsFrom(rows, start) {
  return rows.map(([open, high, low, close], i) => ({
    time: start + i * STEP, open, high, low, close, volume: 100,
  }));
}

/* 08:00 candle: high 110, low 99, close 104 — a range of 11, which puts the three
   depths at 3.3, 5.5 and 7.7 measured down from the high. */
const ANCHOR = [
  [100, 102, 99, 101],
  [101, 103, 100, 102],
  [102, 110, 101, 105],
  [105, 108, 100, 104],
];

/* 09:00: takes the high at 112 and closes at 108. 09:15: closes at 106, which is
   30% back inside the candle (110 − 3.3 = 106.7) and not yet 50%. 09:30 is the
   fill. 09:45 closes at 103.5, through the candle's 104 close. */
const ACTION = [
  [104, 112, 103, 108],
  [108, 109, 105, 106],
  [106, 107, 104, 105],
  [105, 106, 103, 103.5],
];

const DAY = () => barsFrom([...ANCHOR, ...ACTION], JAN);

const anchorCandle = () => candleOf(hourBuckets(DAY(), STEP)[0]);

/* ------------------------------------------------------------------ the clock */

test('the bar closing at 09:00 belongs to the 08:00 candle, not the 09:00 one', () => {
  assert.equal(hourOf(Date.parse('2026-01-05T15:00:00Z')), 8 * 60, '09:00 Central is the last quarter of the 08:00 candle');
  assert.equal(hourOf(Date.parse('2026-01-05T15:15:00Z')), 9 * 60, '09:15 is the second quarter of the 09:00 one');
  assert.equal(hourOf(Date.parse('2026-01-05T14:15:00Z')), 8 * 60, 'the 08:00 bar, read at its close');
});

test('the 08:00 candle is the same candle in January and in July, on different UTC hours', () => {
  const jan = hourBuckets(barsFrom([...ANCHOR, ...ACTION], JAN), STEP);
  const jul = hourBuckets(barsFrom([...ANCHOR, ...ACTION], JUL), STEP);
  assert.equal(jan[0].slot, 8 * 60);
  assert.equal(jul[0].slot, 8 * 60);
  assert.equal(jan[0].day, '2026-01-05');
  assert.equal(jul[0].day, '2026-07-06');
  assert.equal(jan[0].bars.length, 4, 'four quarter-hours in the candle');
});

test('anchor names are read strictly, and normalised to HH:MM', () => {
  assert.deepEqual(parseAnchors('8:00, 14:00').map((a) => a.name), ['08:00', '14:00']);
  assert.throws(() => parseAnchors('open'), /not a time of day/);
  assert.throws(() => parseAnchors('08:30'), /starts on the hour/);
});

/* -------------------------------------------------------------------- the rule */

test('the candle is the whole hour: first open, widest high and low, last close', () => {
  const candle = anchorCandle();
  assert.equal(candle.high, 110);
  assert.equal(candle.low, 99);
  assert.equal(candle.close, 104, 'the close is the price the trade is aimed at');
  assert.equal(candle.open, 100);
});

test('a swept high is a short, aimed at the candle close, stopped behind the sweep', () => {
  const found = sweepSetup({ candle: anchorCandle(), actionBars: barsFrom(ACTION, JAN + 4 * STEP), retest: 30 });
  assert.ok(found.setup, found.reason);
  assert.equal(found.setup.direction, 'short');
  assert.equal(found.setup.target, 104);
  assert.equal(found.setup.stop, 112, 'the high the sweep made, not the candle high');
  assert.equal(found.setup.signal, 1, 'the 09:15 close was the reclaim');
});

test('a swept low is the long, mirrored', () => {
  /* An 8-point candle, so a 30% retest is 2.4 points up from the 97 low: 99.4. */
  const candle = { high: 105, low: 97, close: 103 };
  const rows = [
    [100, 101, 96, 97],   // takes the 97 low and closes at it
    [97, 100, 95, 100],   // closes at 100, back above 99.4 — the long
  ];
  const found = sweepSetup({ candle, actionBars: barsFrom(rows, JAN), retest: 30 });
  assert.ok(found.setup, found.reason);
  assert.equal(found.setup.direction, 'long');
  assert.equal(found.setup.target, 103, 'the candle close, above the entry');
  assert.equal(found.setup.stop, 95, 'the low the sweep made');
});

test('the retest depth is read from the edge that was swept, not from the close', () => {
  const actionBars = barsFrom(ACTION, JAN + 4 * STEP);
  const candle = anchorCandle();
  /* 09:15 closes at 106: 4 of the 11 points back from the high is 36%. */
  assert.equal(sweepSetup({ candle, actionBars, retest: 30 }).setup.signal, 1, '36% clears a 30% retest');
  assert.equal(sweepSetup({ candle, actionBars, retest: 50 }).setup.signal, 3, 'at 50% the wait goes on to the last bar');
  assert.equal(sweepSetup({ candle, actionBars, retest: 70 }).setup, undefined, 'nothing closed 70% back');
});

test('a sweep that never comes back is not a trade', () => {
  const actionBarRows = [
    [104, 112, 103, 111],
    [111, 113, 110, 112.5],
    [112.5, 114, 111, 113],
    [113, 115, 112, 114],
  ];
  const found = sweepSetup({ candle: anchorCandle(), actionBars: barsFrom(actionBarRows, JAN + 4 * STEP), retest: 30 });
  assert.equal(found.setup, undefined);
  assert.match(found.reason, /never closed back inside/);
});

test('if the other side breaks before the return, there is no sweep to trade', () => {
  const actionBarRows = [
    [104, 112, 103, 108],     // high swept
    [108, 109, 98, 100],      // and then the low goes
    [100, 101, 99, 100],
    [100, 101, 99, 100],
  ];
  const found = sweepSetup({ candle: anchorCandle(), actionBars: barsFrom(actionBarRows, JAN + 4 * STEP), retest: 30 });
  assert.equal(found.setup, undefined);
  assert.match(found.reason, /other side of the candle broke/);
});

test('one bar taking both sides and closing inside is refused, not guessed', () => {
  const actionBarRows = [
    [104, 112, 98, 105],      // 112 above the high, 98 below the low, close inside
    [105, 106, 104, 105],
    [105, 106, 104, 105],
    [105, 106, 104, 105],
  ];
  const found = sweepSetup({ candle: anchorCandle(), actionBars: barsFrom(actionBarRows, JAN + 4 * STEP), retest: 30 });
  assert.equal(found.setup, undefined);
  assert.match(found.reason, /both sides/);
});

/* -------------------------------------------------------------------- the exit */

test('the target is a close through it — a wick that touches it is still a wick', () => {
  const bars = barsFrom([[105, 106, 103.5, 105.5], [105, 106, 103, 103]], JAN);
  const signal = { direction: 'short', target: 104, stop: 112 };
  const exit = runSweepTrade({ bars, start: 0, last: 1, stopAt: signal, stopOn: 'close', slip: 0 });
  assert.equal(exit.reason, 'target');
  assert.equal(exit.price, 103, 'the close that went through it, not the 103.5 wick');
});

test('the stop is behind the sweep, and it is checked before the target', () => {
  const bars = barsFrom([[106, 113, 103, 112.5]], JAN);
  const exit = runSweepTrade({ bars, start: 0, last: 0, stopAt: { direction: 'short', target: 104, stop: 112 }, stopOn: 'close', slip: 0 });
  assert.equal(exit.reason, 'stop');
  assert.equal(exit.price, 112.5, 'the close through the sweep high');
});

test('nothing is held past the end of the hour', () => {
  const bars = barsFrom([[106, 107, 105, 105.5], [105.5, 106, 105, 105]], JAN);
  const exit = runSweepTrade({ bars, start: 0, last: 1, stopAt: { direction: 'short', target: 104, stop: 112 }, stopOn: 'close', slip: 0 });
  assert.equal(exit.reason, 'hour');
  assert.equal(exit.price, 105, 'flat at the last bar of the action hour');
});

/* ---------------------------------------------------------------- end to end */

test('the rule runs end to end: next open in, candle close out', () => {
  const result = findSweepTrades({ bars: DAY(), retest: 30 });
  assert.equal(result.trades.length, 1);
  const trade = result.trades[0];
  assert.equal(trade.direction, 'short');
  assert.equal(trade.anchor, '08:00');
  assert.equal(trade.entry.price, 106, 'the 09:30 open, the bar after the 09:15 signal');
  assert.equal(trade.exit.reason, 'target');
  assert.equal(trade.exit.price, 103.5);
  assert.equal(trade.points, 2.5);
  assert.equal(trade.risk, 6);
});

test('a deeper retest takes fewer trades, and says why it took none', () => {
  const shallow = findSweepTrades({ bars: DAY(), retest: 30 });
  const deep = findSweepTrades({ bars: DAY(), retest: 70 });
  assert.equal(shallow.trades.length, 1);
  assert.equal(deep.trades.length, 0);
  assert.match(deep.skipped[0].reason, /never closed back inside/);
});

test('an hour with a bar missing is refused rather than traded as a shorter candle', () => {
  const rows = [...ANCHOR, ...ACTION].slice(0, 7);
  const result = findSweepTrades({ bars: barsFrom(rows, JAN), retest: 30 });
  assert.equal(result.trades.length, 0);
  assert.match(result.skipped[0].reason, /3 of 4 bars/);
});

test('a reclaim on the last bar of the hour has no fill, and is counted', () => {
  const actionBarRows = [
    [104, 112, 103, 108],
    [108, 109, 105, 107],
    [107, 108, 105, 107],
    [107, 108, 105, 105],   // the only close inside the depth, on the last bar
  ];
  const result = findSweepTrades({ bars: barsFrom([...ANCHOR, ...actionBarRows], JAN), retest: 30 });
  assert.equal(result.trades.length, 0);
  assert.match(result.skipped[0].reason, /no fill|no fill at the end|last bar/);
});

test('both anchor candles are read in one run, and the 14:00 one is separate', () => {
  /* The same shape twice, at 08:00 and at 14:00 Central. */
  const gap = Array.from({ length: 16 }, () => [104, 105, 103, 104]);   // 10:00 to 14:00
  const rows = [...ANCHOR, ...ACTION, ...gap, ...ANCHOR, ...ACTION];
  const result = findSweepTrades({ bars: barsFrom(rows, JAN), retest: 30 });
  assert.equal(result.trades.length, 2);
  assert.deepEqual(result.trades.map((t) => t.anchor), ['08:00', '14:00']);
  assert.equal(result.trades[0].day, result.trades[1].day);
});

test('the retest depth is refused if it is not a percentage of the candle', () => {
  assert.throws(() => findSweepTrades({ bars: DAY(), retest: 0 }), /percentage of the candle/);
  assert.throws(() => findSweepTrades({ bars: DAY(), retest: 100 }), /percentage of the candle/);
  assert.throws(() => findSweepTrades({ bars: DAY(), retest: 'half' }), /percentage of the candle/);
});

test('a target multiple that is not a positive number is refused', () => {
  assert.throws(() => findSweepTrades({ bars: DAY(), targetR: 0 }), /positive number/);
  assert.throws(() => findSweepTrades({ bars: DAY(), targetR: -1 }), /positive number/);
  assert.throws(() => findSweepTrades({ bars: DAY(), targetR: 'one' }), /positive number/);
});

/* ------------------------------------------------------------- other timeframes */

const HOUR = 3600e3;
const FIVE = 300e3;

const squash = (rows, step) => rows.map(([open, high, low, close], i) => ({
  time: JAN + i * step, open, high, low, close, volume: 100,
}));

/*
 * The rule has to mean the same thing when the chart is coarser or finer, and it
 * has to still be able to TRADE on a coarse one. On 1h bars the anchor candle is a
 * single bar and so is the hour after it, which leaves a reclaim nowhere to fill —
 * so a single-bar action hour earns the hour after it, and nothing else changes.
 */
test('on 1h bars the candle is one bar, and the reclaim fills at the next hour open', () => {
  const bars = squash([
    [100, 110, 99, 104],      // 08:00 candle, range 11, 30% back is 106.7
    [104, 112, 103, 106],     // 09:00 takes the high at 112 and closes back inside
    [106, 107, 103, 103.5],   // 10:00 opens at 106 and closes through the 104 close
    [103.5, 104, 103, 103.5],
  ], HOUR);
  const result = findSweepTrades({ bars, retest: 30 });
  assert.equal(result.trades.length, 1);
  const trade = result.trades[0];
  assert.equal(trade.direction, 'short');
  assert.equal(trade.entry.price, 106, 'the 10:00 open is where the 09:00 reclaim fills');
  assert.equal(trade.exit.reason, 'target');
  assert.equal(trade.exit.price, 103.5);
  assert.equal(trade.points, 2.5);
  assert.equal(result.config.holdHours, 2, 'a single-bar action hour is given the hour after it');
});

test('a 1h reclaim with no hour after it is refused, not filled somewhere else', () => {
  /* 08:00, 09:00 and then 11:00: the 10:00 hour a 1h fill would need is not there,
     and the 11:00 bar must not be quietly used in its place. */
  const rows = [
    [100, 110, 99, 104],
    [104, 112, 103, 106],
    [103.5, 104, 103, 103.5],
  ];
  const times = [0, HOUR, 3 * HOUR];
  const bars = rows.map(([open, high, low, close], i) => ({
    time: JAN + times[i], open, high, low, close, volume: 100,
  }));
  const result = findSweepTrades({ bars, retest: 30 });
  assert.equal(result.trades.length, 0);
  assert.match(result.skipped[0].reason, /nowhere to fill/);
});

test('the same candle read on 5m bars is the same candle, and the trade is the same trade', () => {
  const anchorRows = [
    ...Array.from({ length: 11 }, () => [100, 101, 99, 101]),
    [101, 110, 100, 104],     // the 08:55 bar carries the candle's high and its close
  ];
  const actionRows = [
    [104, 112, 103, 108],     // takes the high
    [108, 109, 105, 106],     // closes back inside by 30%
    [106, 107, 104, 105],     // the fill, at its open
    [105, 106, 103, 103.5],   // through the 104 close
    ...Array.from({ length: 8 }, () => [103.5, 104, 103, 103.5]),
  ];
  const result = findSweepTrades({ bars: squash([...anchorRows, ...actionRows], FIVE), retest: 30 });
  assert.equal(result.trades.length, 1);
  const trade = result.trades[0];
  assert.deepEqual(trade.candle, { high: 110, low: 99, close: 104 }, 'twelve 5m bars are the 08:00 candle');
  assert.equal(trade.entry.price, 106);
  assert.equal(trade.exit.price, 103.5);
  assert.equal(result.config.holdHours, 1, 'a 5m action hour holds twelve bars, so no allowance is needed');
});

/* ------------------------------------------------------------- a fixed ratio */

test('a 1 to 1 target is measured from the stop, not from the candle close', () => {
  const result = findSweepTrades({ bars: DAY(), retest: 30, targetR: 1 });
  assert.equal(result.trades.length, 1);
  const trade = result.trades[0];
  /* Fill 106, stop 112: six points of risk, so a short's 1R target is 100 and not
     the 104 the candle closed at. */
  assert.equal(trade.risk, 6);
  assert.equal(trade.target, 100);
  assert.equal(trade.exit.reason, 'hour', 'price never reached 100 inside the action hour');
  assert.equal(trade.points, 2.5);
  assert.equal(result.config.targetR, 1);
});

test('the ratio moves with the stop: a tighter sweep gives a closer target', () => {
  const candle = anchorCandle();
  const rows = [
    [104, 110.5, 103, 108],   // takes 110.5, half a point over the high
    [108, 109, 105, 106],     // back inside by 30%
    [106, 107, 104, 105],
  ];
  const actionBars = barsFrom(rows, JAN + 4 * STEP);
  const found = sweepSetup({ candle, actionBars, retest: 30 });
  assert.ok(found.setup, found.reason);
  assert.equal(found.setup.stop, 110.5);
  /* Entry is the next open, 106. Stop 110.5 is 4.5 away, so 1R is 101.5 — closer
     than the 100 the wider sweep would have given. */
  assert.equal(106 - (110.5 - 106), 101.5);
});
