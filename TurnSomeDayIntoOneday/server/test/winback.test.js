// 28 Aug 2026: an active member was emailed "You haven't been in for a couple of
// weeks." She had been in. The win-back measured quiet from the activity log
// alone, and that log only records 33 specific actions - opening the app and
// reading leaves no trace in it. These guard the fix: any one of the three
// signals being recent is enough to prove somebody was here.
const test = require('node:test');
const assert = require('node:assert');
process.env.DB_PATH = '/tmp/winback-test.sqlite';
try { require('fs').unlinkSync('/tmp/winback-test.sqlite'); } catch (_) {}
const emailer = require('../email.js');

const NOW = Date.parse('2026-08-28T12:00:00Z');
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();
const quiet = (row, state) => emailer.quietDaysFor(row, state, NOW);

test('a stale activity log alone no longer makes an active member look gone', () => {
  // Her app has been syncing every day; she just has not done anything the
  // activity log counts. This is the exact shape of the 28 Aug false send.
  const days = quiet(
    { state_updated_at: daysAgo(0), last_seen_at: null },
    { activityLog: [{ ts: daysAgo(30) }] }
  );
  assert.equal(days, 0);
  assert.ok(days < emailer.WINBACK_QUIET_DAYS, 'must not qualify for the win-back');
});

test('opening the app counts even when nothing syncs and nothing is logged', () => {
  const days = quiet(
    { state_updated_at: daysAgo(40), last_seen_at: daysAgo(1) },
    { activityLog: [{ ts: daysAgo(40) }] }
  );
  assert.equal(days, 1);
});

test('somebody genuinely gone still qualifies', () => {
  const days = quiet(
    { state_updated_at: daysAgo(21), last_seen_at: daysAgo(21) },
    { activityLog: [{ ts: daysAgo(21) }] }
  );
  assert.equal(days, 21);
  assert.ok(days >= emailer.WINBACK_QUIET_DAYS, 'still gets the win-back');
});

test('the newest signal wins no matter which one it is', () => {
  assert.equal(quiet({ state_updated_at: daysAgo(50), last_seen_at: daysAgo(50) }, { activityLog: [{ ts: daysAgo(2) }] }), 2);
  assert.equal(quiet({ state_updated_at: daysAgo(2), last_seen_at: daysAgo(50) }, { activityLog: [{ ts: daysAgo(50) }] }), 2);
  assert.equal(quiet({ state_updated_at: daysAgo(50), last_seen_at: daysAgo(2) }, { activityLog: [{ ts: daysAgo(50) }] }), 2);
});

test('no usable timestamp anywhere means no email, not a zero', () => {
  assert.equal(quiet({ state_updated_at: null, last_seen_at: null }, { activityLog: [] }), null);
  assert.equal(quiet({ state_updated_at: 'not a date', last_seen_at: null }, { activityLog: [{ ts: 'rubbish' }] }), null);
});
