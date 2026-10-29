'use strict';
/*
 * The clock, checked on both sides of a time change.
 *
 * This is the quietest way to get a session strategy wrong: 08:30 Central is
 * 14:30 UTC in January and 13:30 UTC in July, so a session pinned to a UTC hour
 * trades the wrong window for half the year and a backtest never notices. These
 * cases are real instants, picked on either side of the change.
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  minutesOfDay, sessionKey, sessionWindow, inSession, describeSession, clock,
} = require('../lib/session');

const at = (iso) => Date.parse(iso);

test('an instant reads as the clock on your wall, in Central time', () => {
  assert.deepEqual(clock(at('2026-01-05T14:00:00Z')), { year: 2026, month: 1, day: 5, hour: 8, minute: 0 });
  assert.equal(minutesOfDay(at('2026-01-05T14:00:00Z')), 8 * 60);
  assert.equal(minutesOfDay(at('2026-01-05T14:30:00Z')), 8 * 60 + 30);
});

test('08:30 Central is the same rule in January and in July, and a different UTC hour', () => {
  /* Winter, UTC-6: 08:30 Central is 14:30Z. */
  assert.equal(inSession(at('2026-01-05T14:30:00Z')), true);
  assert.equal(inSession(at('2026-01-05T14:00:00Z')), false, '08:00 Central is half an hour early');
  /* Summer, UTC-5: 13:30Z is 08:30 Central. The same UTC hour that is early in
     January is the open in July — which is exactly what a fixed UTC window misses. */
  assert.equal(inSession(at('2026-07-06T13:30:00Z')), true);
  assert.equal(inSession(at('2026-07-06T14:00:00Z')), true, '09:00 Central, still inside');
  assert.equal(inSession(at('2026-01-05T13:30:00Z')), false, '07:30 Central in January');
});

test('the session ends at 15:00 Central, both edges included', () => {
  assert.equal(inSession(at('2026-01-05T21:00:00Z')), true, '15:00 exactly is the last bar of the session');
  assert.equal(inSession(at('2026-01-05T21:01:00Z')), false, 'one minute later is outside');
  assert.equal(inSession(at('2026-01-05T20:59:00Z')), true);
});

test('the overnight hours are outside it', () => {
  assert.equal(inSession(at('2026-01-06T05:00:00Z')), false, '23:00 Central is not the New York session');
  assert.equal(inSession(at('2026-01-05T09:00:00Z')), false, '03:00 Central, the London open, is not');
});

test('a Central day is the day the wall clock says, not the UTC one', () => {
  assert.equal(sessionKey(at('2026-01-06T05:00:00Z')), '2026-01-05', '23:00 Central on the 5th');
  assert.equal(sessionKey(at('2026-01-05T14:30:00Z')), '2026-01-05');
  assert.equal(sessionKey(at('2026-03-09T03:00:00Z')), '2026-03-08');
});

test('the window is described as it is used, so a report cannot mislead about it', () => {
  assert.equal(describeSession('ny'), '08:30–15:00 Central (America/Chicago)');
  assert.equal(sessionWindow('NY').key, 'ny', 'the name is forgiven in case, not in meaning');
});

test('a session nobody defined is refused instead of silently trading nothing', () => {
  assert.throws(() => sessionWindow('sydney'), /is not a session this bot knows/);
  assert.throws(() => sessionWindow(''), /is not a session this bot knows/);
});

test('a time that is not a time is refused', () => {
  assert.throws(() => minutesOfDay('half past eight'), /cannot read the clock/);
  assert.throws(() => sessionKey(NaN), /cannot read the clock/);
});

test('Asia crosses midnight, so one overnight session does not become two', () => {
  /* 19:00 Central on the 5th and 01:00 Central on the 6th are the same Asia session. */
  assert.equal(inSession(at('2026-01-06T01:00:00Z'), 'asia'), true, '19:00 Central');
  assert.equal(inSession(at('2026-01-06T07:00:00Z'), 'asia'), true, '01:00 Central, still inside');
  assert.equal(sessionKey(at('2026-01-06T01:00:00Z'), 'asia'), '2026-01-05');
  assert.equal(sessionKey(at('2026-01-06T07:00:00Z'), 'asia'), '2026-01-05', 'the small hours belong to the evening before');
  assert.equal(inSession(at('2026-01-06T09:00:00Z'), 'asia'), false, '03:00 Central is London\'s');
});

test('London and New York sit on the clock they are named for', () => {
  assert.equal(inSession(at('2026-01-06T09:00:00Z'), 'london'), true, '03:00 Central');
  assert.equal(inSession(at('2026-01-06T14:45:00Z'), 'london'), false, '08:45 Central is past it');
  assert.equal(inSession(at('2026-01-06T14:45:00Z'), 'ny'), true, 'and inside New York');
  assert.equal(inSession(at('2026-01-06T08:00:00Z'), 'ny'), false, '02:00 Central is not');
  assert.equal(describeSession('asia'), '18:00–02:00 Central (America/Chicago, running past midnight)');
});
