'use strict';
/*
 * The TBR scalp: 09:00–15:00 New York, which has to be 08:00–14:00 Chicago in
 * January and in July.
 *
 * The beliefs this file exists to defend:
 *   - the Chicago window is DERIVED from the New York one at the instant asked
 *     about, and the two agree either side of both daylight-saving changes;
 *   - a candidate outside the session is refused and named, not dropped quietly;
 *   - a close below the session range starts a SHORT setup, and a return into the
 *     0.30 / 0.50 / 0.70 fib of that leg is the signal;
 *   - a close above the range starts the LONG, mirrored;
 *   - the stop sits beyond the break candle's wick by the buffer;
 *   - the target is the break candle's close, exactly.
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  tbrWindow, inTbrSession, describeTbr, zoneMinutesOfDay, TIME_ZONE, ET_ZONE,
} = require('../lib/session');
const { findScalpSignals, checkFibs, DEFAULTS } = require('../lib/tbr-scalp');

const STEP = 900e3;
const OPEN = Date.parse('2026-01-05T14:00:00Z');   // 09:00 New York, 08:00 Chicago

function barsFrom(rows, start = OPEN) {
  return rows.map(([open, high, low, close], i) => ({
    time: start + i * STEP, open, high, low, close, volume: 100,
  }));
}

/* A quiet session: twelve bars inside a 99–100 range. */
const QUIET = Array.from({ length: 12 }, () => [99.5, 100, 99, 99.5]);

/* --------------------------------------------------------------- the window */

test('the session is the same hour on both clocks, winter and summer', () => {
  for (const ms of [Date.parse('2026-01-05T15:00:00Z'), Date.parse('2026-07-06T15:00:00Z')]) {
    const w = tbrWindow(ms);
    assert.equal(w.et.open, 9 * 60, '09:00 New York');
    assert.equal(w.et.close, 15 * 60, '15:00 New York');
    assert.equal(w.ct.open, 8 * 60, '08:00 Chicago');
    assert.equal(w.ct.close, 14 * 60, '14:00 Chicago');
    assert.equal(w.et.open - w.ct.open, 60, 'one hour apart, as the zones are');
  }
});

test('both daylight-saving changes keep 09:00 ET equal to 08:00 CT', () => {
  /* 8 March 2026: the change is at 07:00Z. Before it New York is -5, after it -4;
     Chicago moves with it, so the pair never separates. */
  for (const ms of [Date.parse('2026-03-08T06:00:00Z'), Date.parse('2026-03-08T12:00:00Z')]) {
    const w = tbrWindow(ms);
    assert.equal(w.ct.open, 8 * 60, `spring change: ${new Date(ms).toISOString()}`);
    assert.equal(w.ct.close, 14 * 60);
  }
  /* 1 November 2026: the change is at 06:00Z, the other way. */
  for (const ms of [Date.parse('2026-11-01T05:00:00Z'), Date.parse('2026-11-01T12:00:00Z')]) {
    const w = tbrWindow(ms);
    assert.equal(w.ct.open, 8 * 60, `autumn change: ${new Date(ms).toISOString()}`);
    assert.equal(w.ct.close, 14 * 60);
  }
});

test('the same instant reads 09:00 in New York and 08:00 in Chicago', () => {
  const winter = Date.parse('2026-01-05T14:00:00Z');
  const summer = Date.parse('2026-07-06T13:00:00Z');
  for (const ms of [winter, summer]) {
    assert.equal(zoneMinutesOfDay(ms, ET_ZONE), 9 * 60);
    assert.equal(zoneMinutesOfDay(ms, TIME_ZONE), 8 * 60);
    assert.equal(inTbrSession(ms), true);
  }
  assert.equal(inTbrSession(Date.parse('2026-01-05T13:59:00Z')), false, 'a minute early is outside');
  assert.equal(inTbrSession(Date.parse('2026-01-05T20:00:00Z')), true, '15:00 Eastern is the last minute');
  assert.equal(inTbrSession(Date.parse('2026-01-05T20:01:00Z')), false, 'a minute late is outside');
  assert.equal(describeTbr(winter), '09:00–15:00 America/New_York (08:00–14:00 America/Chicago)');
});

/* ---------------------------------------------------------------- the short */

test('a close below the range, then a return into the 30% fib, is a short scalp', () => {
  const rows = [
    ...QUIET,
    [99.5, 99.6, 97.0, 97.2],   // closes below 99 — the break, and the qualifying candle
    [97.4, 97.7, 97.1, 97.5],   // returns to 97 + 2.0 × 0.30 = 97.6
  ];
  const r = findScalpSignals({ bars: barsFrom(rows), stopBuffer: 0.25 });
  assert.equal(r.signals.length, 1, JSON.stringify(r.rejections));
  const s = r.signals[0];
  assert.equal(s.side, 'short');
  assert.equal(s.fib, 0.30, 'the 30% level, exactly as stated');
  assert.equal(s.entry, 97.6, '97 extreme + 30% of the 2.0 point leg');
  assert.equal(s.stop, 99.85, 'the break candle high 99.6, plus the 0.25 buffer');
  assert.equal(s.target, 97.2, 'the break candle close');
  assert.equal(s.isScalp, true);
  assert.equal(r.rejections.length, 0);
});

test('the stop is strictly behind the wick, by the buffer', () => {
  const rows = [
    ...QUIET,
    [99.5, 100.4, 97.0, 97.2],
    [97.4, 97.7, 97.1, 97.5],
  ];
  const noBuffer = findScalpSignals({ bars: barsFrom(rows), stopBuffer: 0 });
  const buffered = findScalpSignals({ bars: barsFrom(rows), stopBuffer: 0.5 });
  assert.equal(noBuffer.signals[0].stop, 100.4, 'the wick itself with no buffer');
  assert.equal(buffered.signals[0].stop, 100.9, 'half a point beyond it');
  assert.ok(buffered.signals[0].stop > noBuffer.signals[0].stop);
});

test('the 50% and 70% levels are the same leg, further back', () => {
  const rows = [
    ...QUIET,
    [99.5, 99.6, 97.0, 97.2],
    [97.4, 98.1, 97.1, 97.8],   // 97 + 2.0 × 0.50 = 98.0 is reached; 0.30 is skipped
  ];
  const r = findScalpSignals({ bars: barsFrom(rows), stopBuffer: 0.25 });
  const s = r.signals[0];
  assert.equal(s.fib, 0.30, 'the nearest level is the one that fills');
  assert.equal(s.entry, 97.6);
  const deeper = findScalpSignals({ bars: barsFrom(rows), fibs: [0.50], stopBuffer: 0.25 });
  assert.equal(deeper.signals[0].fib, 0.50);
  assert.equal(deeper.signals[0].entry, 98.0);
});

test('a leg that is fully retraced is a failure, not a deeper entry', () => {
  const rows = [
    ...QUIET,
    [99.5, 99.6, 97.0, 97.2],
    [97.4, 100.2, 97.1, 99.8],  // closes back through the 99 edge
  ];
  const r = findScalpSignals({ bars: barsFrom(rows), stopBuffer: 0.25 });
  assert.equal(r.signals.length, 0);
  assert.match(r.rejections[0].reason, /reclaimed/);
  assert.equal(r.rejections[0].isScalp, false, 'a refused candidate is not a scalp');
});

/* ----------------------------------------------------------------- the long */

test('a close above the range, then a return into the fib, is a long scalp', () => {
  const rows = [
    ...QUIET,
    [99.5, 103.0, 102.0, 102.8],   // closes above 100 — the break, leg 100 → 103
    [102.6, 102.7, 102.0, 102.5],  // returns to 103 − 3.0 × 0.30 = 102.1
  ];
  const r = findScalpSignals({ bars: barsFrom(rows), stopBuffer: 0.25 });
  assert.equal(r.signals.length, 1, JSON.stringify(r.rejections));
  const s = r.signals[0];
  assert.equal(s.side, 'long');
  assert.equal(s.fib, 0.30);
  assert.equal(s.entry, 102.1);
  assert.equal(s.stop, 101.75, 'the break candle low 102.0, less the 0.25 buffer');
  assert.equal(s.target, 102.8, 'the break candle close');
  assert.equal(s.isScalp, true);
});

/* ------------------------------------------------------------- the session */

test('a break outside the session is refused, and says why', () => {
  /* The same quiet range, then the break on the bar stamped 15:15 Eastern. */
  const closeOut = Date.parse('2026-01-05T20:15:00Z');   // 15:15 ET
  const rows = [
    ...QUIET,
    [99.5, 99.6, 97.0, 97.2],
    [97.4, 97.7, 97.1, 97.5],
  ];
  const bars = barsFrom(rows);
  const shift = closeOut - (OPEN + 13 * STEP);
  for (const b of bars) b.time += shift;
  const r = findScalpSignals({ bars, stopBuffer: 0.25 });
  assert.equal(r.signals.length, 0, 'nothing fires after the close');
  assert.ok(r.rejections.some((x) => /outside the TBR session/.test(x.reason)), JSON.stringify(r.rejections));
  assert.equal(r.rejections[0].isScalp, false);
});

test('a signal inside the window is accepted, a minute for a second bar late is not', () => {
  const inside = findScalpSignals({ bars: barsFrom([
    ...QUIET,
    [99.5, 99.6, 97.0, 97.2],
    [97.4, 97.7, 97.1, 97.5],
  ]), stopBuffer: 0.25 });
  assert.equal(inside.signals.length, 1);

  /* The same break, pushed past 15:00 Eastern. */
  const bars = barsFrom([
    ...QUIET,
    [99.5, 99.6, 97.0, 97.2],
    [97.4, 97.7, 97.1, 97.5],
  ]);
  /* Move the BREAK bar's close to 15:15 Eastern: it closes at OPEN + 13 bars. */
  const shift = Date.parse('2026-01-05T20:15:00Z') - (OPEN + 13 * STEP);
  for (const b of bars) b.time += shift;
  const outside = findScalpSignals({ bars, stopBuffer: 0.25 });
  assert.equal(outside.signals.length, 0);
  assert.match(outside.rejections[0].reason, /outside the TBR session/);
});

/* ------------------------------------------------------------------ inputs */

test('the fib levels are the three stated, and anything else is refused', () => {
  assert.deepEqual(DEFAULTS.fibs, [0.30, 0.50, 0.70], 'exactly 30, 50 and 70 per cent, not the golden ratio');
  assert.deepEqual(checkFibs([0.30, 0.50, 0.70]), [0.30, 0.50, 0.70]);
  assert.throws(() => checkFibs([1.2]), /between 0 and 1/);
  assert.throws(() => checkFibs([30]), /between 0 and 1/);
  assert.throws(() => checkFibs([]), /no fib level/);
  assert.throws(() => findScalpSignals({ bars: barsFrom(QUIET), stopBuffer: -1 }), /cannot be negative/);
});

/* ---------------------------------------------------------------- the runner */
/*
 * The module being right is half of it. The other half is the bot actually
 * reaching it: strategy-one.js takes --rule scalp, and the signals, the window and
 * the refusal all come back through the process a person would run.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BOT = path.join(__dirname, '..');

function writeFixture() {
  const rows = ['time,open,high,low,close,volume'];
  const push = (t, o, h, l, c) => rows.push([new Date(t).toISOString(), o, h, l, c, 100].join(','));
  const quiet = (t) => { for (let i = 0; i < 12; i++) push(t + i * STEP, 99.5, 100, 99, 99.5); };

  const short = Date.parse('2026-01-05T14:00:00Z');
  quiet(short);
  push(short + 12 * STEP, 99.5, 99.6, 97.0, 97.2);
  push(short + 13 * STEP, 97.4, 97.7, 97.1, 97.5);

  const long = Date.parse('2026-01-06T14:00:00Z');
  quiet(long);
  push(long + 12 * STEP, 99.5, 103.0, 99.5, 102.8);
  push(long + 13 * STEP, 102.6, 102.7, 102.0, 102.5);

  /* The same break on the bar stamped 15:00 Eastern: it closes at 15:15, outside. */
  const late = Date.parse('2026-01-07T14:00:00Z');
  quiet(late);
  for (let i = 12; i < 24; i++) push(late + i * STEP, 99.5, 100, 99, 99.5);
  push(late + 24 * STEP, 99.5, 99.6, 97.0, 97.2);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-scalp-'));
  const file = path.join(dir, 'tbr.csv');
  fs.writeFileSync(file, rows.join('\n') + '\n');
  return file;
}

test('the runner takes --rule scalp and the signals come back through it', () => {
  const file = writeFixture();
  const out = spawnSync(process.execPath,
    [path.join(BOT, 'strategy-one.js'), '--data', file, '--rule', 'scalp', '--stop-buffer', '0.25'],
    { cwd: BOT, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /09:00–15:00 America\/New_York = 08:00–14:00 America\/Chicago/, 'the window, both zones');
  assert.match(out.stdout, /short entry 97\.6\s+stop 99\.85\s+target 97\.2\s+isScalp true/, 'the short via the runner');
  assert.match(out.stdout, /long\s+entry 102\.1\s+stop 99\.25\s+target 102\.8\s+isScalp true/, 'the long via the runner');
  assert.match(out.stdout, /outside the TBR session/, 'the refusal is reported, not dropped');
  assert.match(out.stdout, /2 scalp signal\(s\), 1 refused candidate\(s\)/);

  const asJson = spawnSync(process.execPath,
    [path.join(BOT, 'strategy-one.js'), '--data', file, '--rule', 'scalp', '--json'],
    { cwd: BOT, encoding: 'utf8' });
  assert.equal(asJson.status, 0, asJson.stderr);
  const parsed = JSON.parse(asJson.stdout);
  assert.equal(parsed.rule, 'scalp');
  assert.deepEqual(parsed.signals.map((s) => s.side), ['short', 'long']);
  for (const s of parsed.signals) {
    assert.equal(s.isScalp, true, 'every signal is flagged as a scalp');
    assert.ok(Number.isFinite(s.entry) && Number.isFinite(s.stop) && Number.isFinite(s.target));
  }
  assert.equal(parsed.window.et.zone, 'America/New_York');
  assert.equal(parsed.window.ct.zone, 'America/Chicago');
});
