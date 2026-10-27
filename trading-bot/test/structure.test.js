'use strict';
/*
 * Market structure is the read every later rule rests on, so it is pinned down
 * here: what a swing is, when it becomes knowable, how a trend is called, and
 * what counts as a break. The load-bearing test is the anti-lookahead one — the
 * read at a bar must be identical whether or not the later bars have been seen
 * yet. A structure read that quietly uses the future is the mistake that makes
 * market-structure backtests look beautiful and lose money.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  findSwings, track, resample, baseInterval, multiTimeframe, parseInterval, nameOf,
} = require('../lib/structure');

/* Bars written as [high, low, close]; open is the close, which structure never
   reads. Highs and lows are what a swing is, so they are what the tests spell out. */
function bars(rows, stepMs = 3600e3, startIso = '2026-01-01T00:00:00Z') {
  const start = Date.parse(startIso);
  return rows.map(([high, low, close], i) => ({
    time: start + i * stepMs,
    open: close, high, low, close, volume: 100,
  }));
}

/*
 * A rising staircase with real pullbacks, so it has swings on both sides.
 * Verified by hand: the hourly swings are H@1, L@3, H@5, L@7, H@9, each known two
 * bars later, giving a higher high and a higher low — so the trend turns up at
 * bar 8, the moment the low at bar 7 becomes knowable.
 */
const RISING = [
  [10, 9, 9.5], [12, 9.5, 11.5], [11, 8.5, 9], [11.5, 8, 10],
  [13, 8.2, 9.5], [14, 9.5, 13.5], [12.5, 9.1, 10], [12, 8.9, 11],
  [13.5, 10, 13], [16, 10.5, 15.5], [15, 11, 12], [14, 12, 13],
];

/* The same series upside down, so every up read has to come back as a down one. */
const MIRROR = 60;
const falling = (rows) => rows.map(([high, low, close]) => [MIRROR - low, MIRROR - high, MIRROR - close]);

/* A deterministic walk, for the properties that need length rather than shape. */
function walk(count, seed = 11) {
  let state = seed, price = 100;
  const rows = [];
  for (let i = 0; i < count; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const drift = ((state / 4294967296) - 0.5) * 4;
    const open = price;
    const close = price + drift;
    const wick = 0.4 + Math.abs(drift) / 2;
    rows.push([Math.max(open, close) + wick, Math.min(open, close) - wick, close]);
    price = close;
  }
  return bars(rows);
}

test('a swing is a high or low beyond its neighbours, and it says when it becomes known', () => {
  const swings = findSwings(bars(RISING), { left: 1, right: 1 });
  assert.deepEqual(
    swings.map((s) => [s.index, s.kind, s.price, s.confirmedAt]),
    [[1, 'high', 12, 2], [3, 'low', 8, 4], [5, 'high', 14, 6], [7, 'low', 8.9, 8], [9, 'high', 16, 10]],
  );
});

test('a swing is not knowable on the bar it printed on', () => {
  /* With one bar either side, the high at bar 1 needs bar 2 to exist. So at the
     close of bar 1 nothing is known, and at the close of bar 2 there it is. */
  const one = track(bars(RISING), { left: 1, right: 1 });
  assert.equal(one.states[0].high, null);
  assert.equal(one.states[1].high, null, 'bar 1 cannot know its own high is a high');
  assert.equal(one.states[2].high.price, 12, 'by the close of bar 2 it can');
  assert.equal(one.states[2].high.index, 1);
});

test('higher highs and higher lows read as up, and lower highs and lower lows as down', () => {
  const up = track(bars(RISING), { left: 1, right: 1 });
  assert.equal(up.states[7].trend, 'forming', 'the low at bar 7 is not known until bar 8');
  assert.equal(up.states[8].trend, 'up');
  assert.equal(up.states[11].trend, 'up');

  /* The same series upside down: the read has to come back the other way. */
  const down = track(bars(falling(RISING)), { left: 1, right: 1 });
  assert.equal(down.states[7].trend, 'forming');
  assert.equal(down.states[8].trend, 'down');
});

test('with too little confirmed to compare, the trend is forming and says so', () => {
  const state = track(bars(RISING), { left: 1, right: 1 }).states[4];
  assert.equal(state.trend, 'forming', 'two highs but only one low so far');
  assert.equal(state.ready, false);
  assert.ok(state.high, 'but the levels it does know are still reported');
});

test('a close above the last swing high in an up trend is a BOS', () => {
  const tracked = track(bars(RISING), { left: 1, right: 1 });
  assert.deepEqual(
    tracked.events.map((e) => [e.index, e.kind, e.direction, e.level]),
    [[5, 'break', 'up', 12], [9, 'BOS', 'up', 14]],
  );
  assert.equal(tracked.states[9].event.kind, 'BOS', 'and the bar that broke it carries it');
  assert.equal(tracked.states[9].event.time, bars(RISING)[9].time);
  assert.equal(
    tracked.states[5].event.kind, 'break',
    'the first break arrived before two lows were confirmed, so there was no trend to call it against',
  );
});

test('a close below the last swing low in an up trend is a CHoCH', () => {
  /* The rising series, then a bar that closes back under the last swing low. */
  const withReversal = bars([...RISING, [10.5, 7.5, 8]]);
  const tracked = track(withReversal, { left: 1, right: 1 });
  const last = tracked.events[tracked.events.length - 1];
  assert.equal(last.index, 12);
  assert.equal(last.kind, 'CHoCH', 'against an up trend, that is a change of character');
  assert.equal(last.direction, 'down');
  assert.equal(last.level, 8.9, 'the level was the last confirmed swing low');
  assert.deepEqual(
    tracked.events.map((e) => [e.kind, e.direction, e.level]),
    [['break', 'up', 12], ['BOS', 'up', 14], ['CHoCH', 'down', 8.9]],
  );
});

test('the mirror image of that series breaks the other way', () => {
  const tracked = track(bars(falling([...RISING, [10.5, 7.5, 8]])), { left: 1, right: 1 });
  assert.deepEqual(
    tracked.events.map((e) => [e.kind, e.direction]),
    [['break', 'down'], ['BOS', 'down'], ['CHoCH', 'up']],
  );
});

test('a wick through the level is not a break: the close has to be beyond it', () => {
  /* Bar 7 pokes up to 16 but closes at 14, under the 15 level in force. */
  const wicky = [...RISING.slice(0, 7), [16, 10, 14], ...RISING.slice(7)];
  const tracked = track(bars(wicky), { left: 1, right: 1 });
  assert.equal(tracked.events.some((e) => e.index === 7), false);
  assert.equal(tracked.events.length, 1, 'only the break at bar 5, where the close was beyond the level');
});

test('with no trend to compare it to, a break is reported as a break, not dressed up', () => {
  const early = [[10, 8, 9], [12, 9, 11], [9, 7, 8], [14, 8, 13]];
  const tracked = track(bars(early), { left: 1, right: 1 });
  assert.equal(tracked.states[3].trend, 'forming', 'one high and one low confirmed is not a trend');
  assert.equal(tracked.events.length, 1);
  assert.equal(tracked.events[0].kind, 'break');
  assert.equal(tracked.events[0].level, 12);
});

test('no level breaks twice', () => {
  const tracked = track(walk(500), { left: 2, right: 2 });
  /* Keyed by direction as well as level, because one outside bar — a bar that is
     the highest high and the lowest low of its neighbourhood at once — is a swing
     high and a swing low on the same index, and the two are different levels. */
  const fired = tracked.events.map((e) => `${e.direction}@${e.levelIndex}`);
  assert.equal(new Set(fired).size, fired.length, `a level fired twice: ${fired.join(', ')}`);
  assert.ok(tracked.events.length > 5, 'and the walk really does break levels, so the check is not vacuous');
});

test('the read at a bar is the same whether or not the later bars have been seen', () => {
  /* This is the rule the whole thing stands on. Computing the structure over a
     prefix of the bars must give the same answer at every bar in the prefix. */
  const all = walk(200);
  const full = track(all, { left: 2, right: 2 });
  for (let i = 0; i < all.length; i += 7) {
    const prefix = track(all.slice(0, i + 1), { left: 2, right: 2 });
    assert.deepEqual(
      JSON.parse(JSON.stringify(prefix.states[i])),
      JSON.parse(JSON.stringify(full.states[i])),
      `the read at bar ${i} changed once later bars were added`,
    );
  }
});

test('bigger bars are built out of smaller ones, open to close', () => {
  const hourly = bars([[10, 9, 9.5], [12, 11, 11.5], [9, 8, 8.5], [13, 12, 12.5], [11, 10, 10.5]]);
  const four = resample(hourly, 4 * 3600e3);
  assert.equal(four.length, 2);
  assert.equal(four[0].open, 9.5);
  assert.equal(four[0].high, 13, 'the highest high of the four bars in the bucket');
  assert.equal(four[0].low, 8);
  assert.equal(four[0].close, 12.5);
  assert.equal(four[0].volume, 400);
  assert.equal(four[1].close, 10.5);
  assert.equal(four[0].time, hourly[0].time, 'the bar is stamped where its bucket starts');
});

test('the day is cut where the session opens, not where the clock happens to be', () => {
  /* Eight hours from a 02:00 open, which is not where UTC midnight is. */
  const hourly = bars(Array.from({ length: 8 }, () => [10, 9, 9.5]), 3600e3, '2026-01-01T02:00:00Z');
  assert.equal(resample(hourly, 86400e3).length, 1, 'all eight hours sit inside one UTC day');
  const anchored = resample(hourly, 4 * 3600e3, Date.parse('2026-01-01T02:00:00Z'));
  assert.equal(anchored.length, 2, 'cut on the session open, they are two bars');
  assert.equal(anchored[0].time, Date.parse('2026-01-01T02:00:00Z'));
  assert.equal(anchored[0].low, 9);
  assert.equal(anchored[1].time, Date.parse('2026-01-01T06:00:00Z'));
});

test('the bar spacing is taken from the smallest gap, so a weekend does not stretch it', () => {
  const gapped = [
    { time: 0, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    { time: 3600e3, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    { time: 3600e3 * 2, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    { time: 3600e3 * 50, open: 1, high: 1, low: 1, close: 1, volume: 1 },
  ];
  assert.equal(baseInterval(gapped), 3600e3);
});

test('a timeframe that is not a whole number of bars is refused', () => {
  const hourly = bars(RISING);
  assert.throws(
    () => multiTimeframe(hourly, { timeframes: ['90m'] }),
    /90m is 5400000ms and the bars are 3600000ms apart/,
  );
  assert.throws(() => multiTimeframe(hourly, { timeframes: ['5m'] }), /smaller than the bars themselves/);
});

test('a higher timeframe stays silent until its own bar closes', () => {
  /* Four hourly bars make one 4h bar. While standing inside that 4h bar, there is
     nothing to read from it: it has not closed, so its structure is not known. */
  const hourly = bars(RISING);
  const read = multiTimeframe(hourly, { timeframes: ['4h'], left: 1, right: 1 });
  assert.equal(read.reads[0].bars.length, 3, 'twelve hours is three 4h bars');
  for (const i of [0, 1, 2, 3]) {
    assert.equal(read.reads[0].stateAt[i], null, `bar ${i} is inside the first 4h bar, which is still forming`);
  }
  assert.ok(read.reads[0].stateAt[4], 'bar 4 is the first bar after that 4h bar closed, so now it can be read');
  assert.equal(read.reads[0].stateAt[11].index, 1, 'and it is still the newest CLOSED 4h bar, not the forming one');
});

test('every timeframe is aligned onto the base bars, the base one included', () => {
  const hourly = bars(RISING);
  const read = multiTimeframe(hourly, { timeframes: ['1h', '4h'], left: 1, right: 1 });
  const base = read.reads[0];
  assert.equal(base.name, '1h');
  for (let i = 0; i < hourly.length; i++) {
    assert.deepEqual(
      JSON.parse(JSON.stringify(base.stateAt[i])),
      JSON.parse(JSON.stringify(base.tracked.states[i])),
      `the base read at bar ${i} is its own closed bar, not the one before it`,
    );
  }
});

test('the alignment says one thing only when the timeframes agree', () => {
  const hourly = bars(RISING);
  const both = multiTimeframe(hourly, { timeframes: ['1h', '4h'], left: 1, right: 1 }).at(11);
  assert.equal(both.perTimeframe[0].state.trend, 'up');
  assert.equal(both.perTimeframe[1].state.trend, 'forming', 'two closed 4h bars are not enough for a swing each way');
  assert.equal(both.alignment, 'mixed');
  assert.deepEqual(both.counts, { up: 1, down: 0, range: 0, forming: 1, unknown: 0, none: 0 });

  assert.equal(multiTimeframe(hourly, { timeframes: ['1h'], left: 1, right: 1 }).at(11).alignment, 'up');
  assert.equal(multiTimeframe(hourly, { timeframes: ['4h'], left: 1, right: 1 }).at(11).alignment, 'forming');
  assert.equal(
    multiTimeframe(hourly, { timeframes: ['4h'], left: 1, right: 1 }).at(3).alignment,
    'unknown',
    'nothing has closed yet, so nothing is claimed',
  );
});

test('timeframes are read off their names, and nonsense is refused', () => {
  assert.equal(parseInterval('15m'), 900e3);
  assert.equal(parseInterval('1h'), 3600e3);
  assert.equal(parseInterval('4h'), 4 * 3600e3);
  assert.equal(parseInterval('1d'), 86400e3);
  assert.equal(parseInterval('240m'), 4 * 3600e3);
  assert.equal(nameOf(4 * 3600e3), '4h');
  assert.throws(() => parseInterval('soon'), /is not a timeframe/);
  assert.throws(() => parseInterval(''), /cannot be empty/);
});

test('the command prints the read, and its json is the same read', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-structure-'));
  const file = path.join(dir, 'bars.csv');
  const rows = walk(120).map((b) => [new Date(b.time).toISOString(), b.open, b.high, b.low, b.close, b.volume].join(','));
  fs.writeFileSync(file, ['# synthetic', 'time,open,high,low,close,volume', ...rows].join('\n') + '\n');

  const cli = path.join(__dirname, '..', 'structure.js');
  const report = spawnSync(process.execPath, [cli, '--data', file, '--timeframes', '1h,4h'], { encoding: 'utf8' });
  assert.equal(report.status, 0, report.stderr);
  assert.match(report.stdout, /market structure/);
  assert.match(report.stdout, /timeframe {2}trend/);
  assert.match(report.stdout, /alignment/);
  assert.match(report.stdout, /the bars are synthetic/);

  const json = spawnSync(process.execPath, [cli, '--data', file, '--timeframes', '1h,4h', '--json'], { encoding: 'utf8' });
  assert.equal(json.status, 0, json.stderr);
  const parsed = JSON.parse(json.stdout);
  assert.equal(parsed.reads.length, 2);
  assert.equal(parsed.reads[0].name, '1h');
  assert.equal(parsed.reads[1].name, '4h');
  assert.equal(parsed.synthetic, true);
  assert.ok(parsed.alignment.verdict);

  const bad = spawnSync(process.execPath, [cli, '--data', file, '--timeframes', '90m'], { encoding: 'utf8' });
  assert.equal(bad.status, 1, 'a timeframe the bars cannot make is refused');
  assert.match(bad.stderr, /a higher timeframe has to be a whole number of them/);
});
