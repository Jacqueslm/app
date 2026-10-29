'use strict';
/*
 * The reader for the free delayed feed, checked against saved responses.
 *
 * No network here on purpose: what matters is that a forming bar is refused, a
 * null row is dropped and counted rather than filled in, and what comes out is a
 * file the rest of the folder can read.
 *
 * The clock in these cases is deliberate. A bar is finished when its own interval
 * is behind the feed's lag, so "is this bar whole" is always asked against a
 * stated moment — a fixture that leaves that vague tests nothing.
 */

const test = require('node:test');
const assert = require('node:assert');
const { barsFromChart, toCsv, intervalMs, tickerFor } = require('../lib/yahoo');
const { parseCandles } = require('../lib/candles');

const MIN = 60e3;
const BAR = 15 * MIN;
const LAG = 10 * MIN;
const T0 = Date.parse('2026-10-27T14:30:00Z');   // 09:30 Central

/* n finished 15m bars from T0. */
function response(rows) {
  return {
    chart: {
      result: [{
        meta: { symbol: 'MES=F' },
        timestamp: rows.map((r) => r.time / 1000),
        indicators: {
          quote: [{
            open: rows.map((r) => r.open),
            high: rows.map((r) => r.high),
            low: rows.map((r) => r.low),
            close: rows.map((r) => r.close),
            volume: rows.map((r) => r.volume),
          }],
        },
      }],
      error: null,
    },
  };
}

const bar = (i, overrides = {}) => {
  const open = 5000 + i;
  return { time: T0 + i * BAR, open, high: open + 2, low: open - 2, close: open, volume: 100, ...overrides };
};

const endOf = (row) => row.time + BAR;
/* A moment well past the last bar's close and past the lag: everything here is whole. */
const settled = (row) => endOf(row) + 20 * MIN;

test('a finished 15-minute bar comes out whole', () => {
  const rows = [0, 1, 2].map((i) => bar(i));
  const { bars, droppedIncomplete, droppedNull } = barsFromChart(response(rows), { intervalMs: '15m', now: settled(rows[2]) });
  assert.equal(bars.length, 3);
  assert.equal(droppedIncomplete, 0);
  assert.equal(droppedNull, 0);
  assert.equal(bars[0].time, T0);
  assert.equal(bars[2].close, 5002);
});

test('the last bar is dropped while it is still forming', () => {
  const rows = [0, 1, 2, 3, 4].map((i) => bar(i));
  /* One minute into the fifth bar, with no lag applied: the fifth has not closed,
     and the one before it has. */
  const { bars, droppedIncomplete } = barsFromChart(response(rows), {
    intervalMs: '15m', now: rows[4].time + MIN, delayMs: 0,
  });
  assert.equal(bars.length, 4);
  assert.equal(droppedIncomplete, 1, 'the forming bar is not data');
  assert.equal(bars[bars.length - 1].time, rows[3].time);
});

test('a bar that closed a minute ago is still dropped while the feed lags ten', () => {
  const rows = [0, 1, 2, 3, 4].map((i) => bar(i));
  const { bars, droppedIncomplete } = barsFromChart(response(rows), {
    intervalMs: '15m', now: endOf(rows[4]) + 2 * MIN, delayMs: LAG,
  });
  assert.equal(bars.length, 4, 'two minutes after the close, the feed has not printed it yet');
  assert.equal(droppedIncomplete, 1);
});

test('a null quote row is dropped and counted, never filled with the last close', () => {
  const rows = [0, 1, 2].map((i) => bar(i));
  const json = response(rows);
  json.chart.result[0].indicators.quote[0].open[1] = null;
  json.chart.result[0].indicators.quote[0].close[1] = null;
  const { bars, droppedNull } = barsFromChart(json, { intervalMs: '15m', now: settled(rows[2]) });
  assert.equal(bars.length, 2, 'the gap is a gap');
  assert.equal(droppedNull, 1);
  assert.deepEqual(bars.map((b) => b.time), [rows[0].time, rows[2].time], 'and it is not stitched over');
});

test('a missing volume is volume zero, not a reason to lose the bar', () => {
  const rows = [0, 1].map((i) => bar(i));
  const json = response(rows);
  json.chart.result[0].indicators.quote[0].volume[0] = null;
  const { bars } = barsFromChart(json, { intervalMs: '15m', now: settled(rows[1]) });
  assert.equal(bars[0].volume, 0);
});

test('columns that do not line up are refused rather than read crooked', () => {
  const rows = [0, 1, 2].map((i) => bar(i));
  const json = response(rows);
  json.chart.result[0].indicators.quote[0].close.pop();
  assert.throws(() => barsFromChart(json, { intervalMs: '15m', now: settled(rows[2]) }), /do not line up/);
});

test('a feed that answers with an error says what it said', () => {
  const json = { chart: { result: null, error: { code: 'Not Found', description: 'No data found, symbol may be delisted' } } };
  assert.throws(() => barsFromChart(json, { intervalMs: '15m' }), /No data found, symbol may be delisted/);
});

test('a high under the close is refused, because the file would be lying', () => {
  const rows = [bar(0), bar(1, { close: 5010 })];
  rows[1].high = 5005;
  assert.throws(
    () => barsFromChart(response(rows), { intervalMs: '15m', now: settled(rows[1]) }),
    /high 5005 is below the open or close/,
  );
});

test('a response with only the forming bar in it is an error, not an empty file', () => {
  const rows = [bar(0)];
  assert.throws(
    () => barsFromChart(response(rows), { intervalMs: '15m', now: rows[0].time + MIN, delayMs: 0 }),
    /no complete bar/,
  );
});

test('what it writes is what the rest of the folder reads', () => {
  const rows = [0, 1, 2, 3].map((i) => bar(i));
  const { bars } = barsFromChart(response(rows), { intervalMs: '15m', now: settled(rows[3]) });
  const csv = toCsv(bars, { instrument: 'MES', source: 'yahoo', interval: '15m', fetchedAt: Date.parse('2026-10-27T21:00:00Z') });
  assert.match(csv.split('\n')[0], /delayed bars for MES/);
  assert.match(csv, /ten minutes behind/, 'the file says on it that it lags');
  const read = parseCandles(csv, 'roundtrip');
  assert.equal(read.length, 4);
  assert.deepEqual(read.map((b) => b.time), rows.map((r) => r.time));
  assert.equal(read[0].open, bars[0].open);
});

test('the instrument is mapped to the feed ticker, and an explicit one is left alone', () => {
  assert.equal(tickerFor('MES'), 'MES=F');
  assert.equal(tickerFor('mes'), 'MES=F');
  assert.equal(tickerFor('MNQ=F'), 'MNQ=F');
});

test('an interval nobody supports is refused with the list of what is', () => {
  assert.equal(intervalMs('15m'), 900e3);
  assert.throws(() => intervalMs('17m'), /has to be one of/);
});
