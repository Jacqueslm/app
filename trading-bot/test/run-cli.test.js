'use strict';
/*
 * The two scripts a person actually runs, tested the way a person runs them: as
 * separate processes, checking the exit status and what came back. A CLI that
 * only works when called from a test harness is not a working CLI.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BOT = path.join(__dirname, '..');
const run = (...args) => spawnSync(process.execPath, [path.join(BOT, 'run.js'), ...args], { cwd: BOT, encoding: 'utf8' });
const sample = (...args) => spawnSync(process.execPath, [path.join(BOT, 'make-sample.js'), ...args], { cwd: BOT, encoding: 'utf8' });

function makeBars(bars = 400, seed = 3) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-cli-'));
  const file = path.join(dir, 'bars.csv');
  const made = sample('--bars', String(bars), '--seed', String(seed), '--out', file);
  assert.equal(made.status, 0, made.stderr);
  return file;
}

test('the generator writes bars the reader accepts, and says they are synthetic', () => {
  const file = makeBars(50);
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text.split('\n')[0], /synthetic.*NOT market data/);
  const { loadCandles } = require('../lib/candles');
  assert.equal(loadCandles(file).length, 50);
});

test('the same seed writes the same bytes, so a run can be repeated', () => {
  const one = makeBars(30, 11);
  const two = makeBars(30, 11);
  assert.equal(fs.readFileSync(one, 'utf8'), fs.readFileSync(two, 'utf8'));
  const other = makeBars(30, 12);
  assert.notEqual(fs.readFileSync(one, 'utf8'), fs.readFileSync(other, 'utf8'));
});

test('a run prints the result, the benchmark and the honest notes', () => {
  const file = makeBars(500);
  const out = run('--data', file, '--strategy', 'example-sma', '--fee-bps', '5', '--slippage-bps', '10');
  assert.equal(out.status, 0, out.stderr);
  for (const line of ['buy&hold', 'max fall', 'fills', 'costs paid', 'sharpe']) {
    assert.match(out.stdout, new RegExp(line.replace('&', '&')), `the report should carry ${line}`);
  }
  assert.match(out.stdout, /synthetic/, 'it should say the bars are synthetic');
  assert.match(out.stdout, /this is not a prediction|none of this is a prediction/);
});

test('bars that carry no synthetic marker are not reported as synthetic', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-real-'));
  const file = path.join(dir, 'sample-real-bars.csv');
  const rows = ['time,open,high,low,close,volume'];
  for (let i = 0; i < 60; i++) {
    rows.push(`${new Date(Date.parse('2026-01-01T00:00:00Z') + i * 3600e3).toISOString()},100,105,99,101,10`);
  }
  fs.writeFileSync(file, rows.join('\n') + '\n');
  const out = run('--data', file, '--strategy', 'example-sma');
  assert.equal(out.status, 0, out.stderr);
  assert.doesNotMatch(out.stdout, /synthetic/);
  assert.match(out.stdout, /only 60 bars/, 'it should still say the run is too small to mean much');
});

test('--json gives a parseable result', () => {
  const file = makeBars(200);
  const out = run('--data', file, '--strategy', 'example-sma', '--json');
  assert.equal(out.status, 0, out.stderr);
  const parsed = JSON.parse(out.stdout);
  assert.equal(parsed.metrics.bars, 200);
  assert.equal(parsed.synthetic, true);
  assert.equal(parsed.equity.length, 200);
  assert.ok(Number.isFinite(parsed.metrics.finalEquity));
  assert.ok(Number.isFinite(parsed.metrics.buyHoldReturnPct));
  assert.ok(Array.isArray(parsed.fills));
});

test('a strategy file can be named by path', () => {
  const file = makeBars(120);
  const out = run('--data', file, '--strategy', path.join('strategies', 'example-sma.js'));
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /example-sma/);
});

test('bad bars stop the run instead of being read anyway', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-bad-'));
  const file = path.join(dir, 'bad.csv');
  fs.writeFileSync(file, 'time,open,high,low,close,volume\n2026-01-01T00:00:00Z,100,101,99,105,10\n');
  const out = run('--data', file, '--strategy', 'example-sma');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /bad\.csv line 2: high 101 is below the open or close/);
});

test('missing arguments and a missing strategy are reported, not crashed through', () => {
  const noData = run('--strategy', 'example-sma');
  assert.equal(noData.status, 1);
  assert.match(noData.stderr, /--data is required/);

  const file = makeBars(50);
  const noStrategy = run('--data', file);
  assert.equal(noStrategy.status, 1);
  assert.match(noStrategy.stderr, /--strategy is required/);

  const wrongName = run('--data', file, '--strategy', 'not-a-strategy');
  assert.equal(wrongName.status, 1);
  assert.match(wrongName.stderr, /cannot load the strategy not-a-strategy/);

  const noValue = run('--data', file, '--strategy', 'example-sma', '--cash');
  assert.equal(noValue.status, 2);
  assert.match(noValue.stderr, /--cash needs a value/);
});

test('--help lists the options and stops', () => {
  const out = run('--help');
  assert.equal(out.status, 0);
  assert.match(out.stdout, /--fee-bps/);
  assert.match(out.stdout, /--allow-short/);
});
