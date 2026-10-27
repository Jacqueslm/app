'use strict';
/*
 * The reader has one job: refuse data it cannot defend. These tests feed it bad
 * bars and check that it says which line is wrong, rather than reading the file
 * anyway and letting a backtest report a confident number built on nonsense.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseCandles, loadCandles, isSynthetic } = require('../lib/candles');

const HEAD = '# synthetic\n time,open,high,low,close,volume\n';

test('reads a plain file of bars', () => {
  const bars = parseCandles(
    HEAD
    + '2026-01-01T00:00:00Z,100,105,99,104,1200\n'
    + '2026-01-01T01:00:00Z,104,110,103,109,900\n',
    'test.csv',
  );
  assert.equal(bars.length, 2);
  assert.equal(bars[0].open, 100);
  assert.equal(bars[1].volume, 900);
  assert.equal(bars[0].time, Date.parse('2026-01-01T00:00:00Z'));
  assert.equal(bars[1].time - bars[0].time, 3600e3);
});

test('takes epoch milliseconds as a time', () => {
  const bars = parseCandles('1767225600000,100,105,99,104,10\n', 'test.csv');
  assert.equal(bars[0].time, 1767225600000);
});

test('takes a bare date, and reads a headerless file', () => {
  const bars = parseCandles('2026-01-01,100,105,99,104,10\n', 'test.csv');
  assert.equal(bars[0].time, Date.parse('2026-01-01T00:00:00Z'));
});

test('refuses a file with no bars in it', () => {
  assert.throws(() => parseCandles('# nothing here\n\n', 'empty.csv'), /no bars in it/);
});

test('refuses a line that is short of fields, and says which line', () => {
  assert.throws(
    () => parseCandles(HEAD + '2026-01-01T00:00:00Z,100,105,99\n', 'short.csv'),
    /short\.csv line 3: expected time,open,high,low,close,volume — got 4 field\(s\)/,
  );
});

test('refuses a price that is not a number', () => {
  assert.throws(
    () => parseCandles(HEAD + '2026-01-01T00:00:00Z,100,105,99,n/a,10\n', 'x.csv'),
    /line 3: close is "n\/a", not a number/,
  );
});

test('refuses a high below the open or close', () => {
  assert.throws(
    () => parseCandles(HEAD + '2026-01-01T00:00:00Z,100,101,99,105,10\n', 'x.csv'),
    /line 3: high 101 is below the open or close/,
  );
});

test('refuses a low above the open or close', () => {
  assert.throws(
    () => parseCandles(HEAD + '2026-01-01T00:00:00Z,100,105,104,95,10\n', 'x.csv'),
    /line 3: low 104 is above the open or close/,
  );
});

test('refuses a time that does not move forward', () => {
  const row = '2026-01-01T00:00:00Z,100,105,99,104,10\n';
  assert.throws(() => parseCandles(HEAD + row + row, 'x.csv'), /does not come after the previous bar/);
});

test('refuses a price of zero and a negative volume', () => {
  assert.throws(
    () => parseCandles(HEAD + '2026-01-01T00:00:00Z,0,0,0,0,10\n', 'x.csv'),
    /a price has to be above zero/,
  );
  assert.throws(
    () => parseCandles(HEAD + '2026-01-01T00:00:00Z,100,105,99,104,-1\n', 'x.csv'),
    /volume is -1; it cannot be negative/,
  );
});

test('the synthetic marker is read off the file, not off its name', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-mark-'));
  const marked = path.join(dir, 'bars.csv');
  const plain = path.join(dir, 'sample-looks-real.csv');
  fs.writeFileSync(marked, '# synthetic bars — generated. NOT market data.\n' + '2026-01-01T00:00:00Z,100,105,99,104,10\n');
  fs.writeFileSync(plain, 'time,open,high,low,close,volume\n2026-01-01T00:00:00Z,100,105,99,104,10\n');
  assert.equal(isSynthetic(marked), true);
  assert.equal(isSynthetic(plain), false, 'a real file named sample-something is still not synthetic');
  assert.equal(isSynthetic(path.join(dir, 'missing.csv')), false);
});

test('loads a file from disk and names a missing one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-candles-'));
  const file = path.join(dir, 'bars.csv');
  fs.writeFileSync(file, HEAD + '2026-01-01T00:00:00Z,100,105,99,104,10\n');
  assert.equal(loadCandles(file).length, 1);
  assert.throws(() => loadCandles(path.join(dir, 'nope.csv')), /cannot read .*nope\.csv/);
});
