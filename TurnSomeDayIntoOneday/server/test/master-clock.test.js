// Jacques, 30 Aug 2026, running three tracks — Porn & Sex 5 days, Food 1 day,
// Anger & Control 8 days — and the front of the app said "Days clean: 1".
//
//   "it keep saying day one on the one I failed on when I'm doing multiple
//    tracks fix it"
//
// syncMasterClock took the LATEST of the per-track start dates, which is by
// definition the most recent slip. Eight days of work disappeared off the
// headline because of a bad night on a different track — the very thing the
// per-track clocks were added to stop, happening one level up.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

// The two functions as shipped, with the state injected.
function master(selected, clocks) {
  const rows = selected.map((a) => ({ a, t: clocks[a] ? new Date(clocks[a]).getTime() : 0 }))
    .filter((r) => r.t > 0)
    .sort((x, y) => x.t - y.t);
  if (!rows.length) return null;
  return { name: rows[0].a, t: rows[0].t, mixed: rows.length > 1 && rows[0].t !== rows[rows.length - 1].t };
}
const DAY = 86400000;
const ago = (d) => new Date(Date.now() - d * DAY).toISOString();
const JACQUES = { 'Porn & Sex': ago(5), 'Food / Binging': ago(1), 'Anger & Control': ago(8) };
const TRACKS = Object.keys(JACQUES);
const days = (m) => Math.floor((Date.now() - m.t) / DAY);

test("Jacques's own screen: the headline is 8, not 1", () => {
  const m = master(TRACKS, JACQUES);
  assert.equal(days(m), 8);
  assert.equal(m.name, 'Anger & Control');
});

test('the headline never comes from the track that was slipped on most recently', () => {
  const m = master(TRACKS, JACQUES);
  const newest = TRACKS.reduce((a, b) => (new Date(JACQUES[a]) > new Date(JACQUES[b]) ? a : b));
  assert.equal(newest, 'Food / Binging', 'that is the one he failed on');
  assert.notEqual(m.name, newest);
});

test('slipping on one track does not move the headline off another', () => {
  const before = master(TRACKS, JACQUES);
  const after = master(TRACKS, Object.assign({}, JACQUES, { 'Porn & Sex': new Date().toISOString() }));
  assert.equal(days(after), days(before), '8 days of anger work survives a slip on porn');
  assert.equal(after.name, before.name);
});

test('one track, or all tracks equal, is not flagged as mixed', () => {
  assert.equal(master(['Alcohol'], { Alcohol: ago(3) }).mixed, false);
  const same = ago(4);
  assert.equal(master(['Alcohol', 'Vaping'], { Alcohol: same, Vaping: same }).mixed, false);
  assert.equal(master(TRACKS, JACQUES).mixed, true);
});

test('no tracks, or no clocks yet, returns nothing rather than a wrong date', () => {
  assert.equal(master([], {}), null);
  assert.equal(master(['Alcohol'], {}), null);
  assert.match(APP, /function syncMasterClock\(\)\{\n  const m=masterTrack\(\);\n  if\(m\)S\.startDate=new Date\(m\.t\)\.toISOString\(\);\n\}/,
    'and syncMasterClock leaves startDate alone in that case');
});

test('the shipped code takes the earliest clock, not the latest', () => {
  assert.match(APP, /\.sort\(\(x,y\)=>x\.t-y\.t\);\n  if\(!rows\.length\)return null;\n  return \{name:rows\[0\]\.a/);
  assert.doesNotMatch(APP, /S\.startDate=new Date\(Math\.max\(\.\.\.times\)\)/, 'the old rule is gone');
});

// The headline is now the longest track, so anywhere it is stated on its own
// it has to say which track, or it reads as a claim about all of them.
test('when the tracks disagree, the number says which track it belongs to', () => {
  const since = APP.match(/const sinceTxt='Since '[\s\S]*?sinceTxt;/)[0];
  assert.match(since, /mt&&mt\.mixed&&S\.userType!=='partner'/);
  assert.match(since, /mt\.name/);
  const share = APP.match(/function shareMyMilestone\(\)\{[\s\S]*?const text=`[^`]*`;/)[0];
  assert.match(share, /mt&&mt\.mixed&&S\.userType!=='partner'/);
  assert.match(share, /\$\{on\}/, 'the share names the track it is true of');
});

test('a supporter, who has no tracks to disagree, is left alone', () => {
  for (const src of [APP.match(/const sinceTxt='Since '[\s\S]*?sinceTxt;/)[0],
                     APP.match(/function shareMyMilestone\(\)\{[\s\S]*?const text=`[^`]*`;/)[0]]) {
    assert.match(src, /S\.userType!=='partner'/);
  }
});

test('a slip is banked against the track that was reset', () => {
  // With the master being the longest run, a slip on a short track often does
  // not move it at all. Measured against the master, that slip would bank
  // nothing, record no streak, and never reach the tower.
  assert.match(APP, /const priorStreakLength=resetTarget\?daysFor\(resetTarget\):getDays\(\);/);
  assert.match(APP, /const prevStart=guardIso;/);
  assert.match(APP, /if\(prevStart&&chosen\.getTime\(\)>new Date\(prevStart\)\.getTime\(\)\)\{/);
});

test('an account saved under the old rule corrects itself on the next open', () => {
  // Otherwise the fix only lands the next time something calls syncMasterClock,
  // which for most people is their next relapse.
  assert.match(APP, /if\(!S\.notifiedDay30Tracks\)S\.notifiedDay30Tracks=\[\];\n(?:\s*\/\/[^\n]*\n)+\s*try\{syncMasterClock\(\);\}catch\(e\)\{\}/,
    'load() must re-derive the master clock');
});
