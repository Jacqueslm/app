// The supporter tower.
//
// Spec: "same tower, their own floors. Truth questions are about their own
// experience, dares are about their own boundaries and rest. Never framed as
// monitoring." The building is shared; every word is not.
//
// The two rules this file exists to defend:
//   1. A supporter is never addressed as the person recovering.
//   2. The tower never blames the addict to comfort the supporter, and never
//      blames the supporter to comfort the addict.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const APP = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const grab = (start, end) => APP.slice(APP.indexOf(start), APP.indexOf(end, APP.indexOf(start)) + end.length);

const FLOORS = new Function(grab('const TOWER_FLOORS=[', '\n];') + ';return TOWER_FLOORS;')();
const SUP = new Function(grab('const TOWER_FLOORS_SUP={', '\n};') + ';return TOWER_FLOORS_SUP;')();
const SUP_ART = new Function(grab('const TOWER_ARTIFACTS_SUP={', '\n};') + ';return TOWER_ARTIFACTS_SUP;')();

const words = (f) => [f.name, ...f.brief, f.truth, f.dare.text, f.line,
  ...Object.values(f.sides || {}).flatMap((s) => [s.name, s.line])].join(' ');

test('the supporter walks all ninety floors', () => {
  assert.equal(Object.keys(SUP).length, 90);
  for (let n = 1; n <= 90; n++) assert.ok(SUP[n], `no supporter floor ${n}`);
});

test('a supporter floor overlays writing only, never the map', () => {
  // The geometry, palette, rule, air and wave must come from the base floor,
  // or the supporter is walking a different building with the same name.
  for (let n = 1; n <= 90; n++) {
    const s = SUP[n];
    for (const forbidden of ['rooms', 'edges', 'pal', 'rule', 'air', 'wave', 'doorNeeds', 'oneway']) {
      assert.ok(!(forbidden in s), `supporter floor ${n} redefines ${forbidden}`);
    }
    // and it must name exactly the rooms the shared map has
    const base = FLOORS[n - 1];
    assert.deepEqual(Object.keys(s.sides).sort(), Object.keys(base.sides || {}).sort(),
      `supporter floor ${n} names different rooms from the map it is laid over`);
  }
});

test('every supporter floor is written, and written differently', () => {
  const truths = new Set();
  for (let n = 1; n <= 90; n++) {
    const s = SUP[n];
    assert.equal(s.brief.length, 2, `floor ${n}: a briefing is two lines`);
    assert.ok(s.brief[0].startsWith('Floor '), `floor ${n}: the briefing must name the floor`);
    assert.ok(s.truth.endsWith('?'), `floor ${n}: the truth must be a question`);
    assert.ok(s.dare.text.length > 20 && s.dare.seconds >= 30, `floor ${n}: the dare is too thin`);
    assert.ok(s.line.length > 15, `floor ${n}: no atmosphere line`);
    assert.ok(!truths.has(s.truth), `floor ${n}: this truth is asked on another floor too`);
    truths.add(s.truth);
    // and it must not simply repeat the recovery floor
    assert.notEqual(s.truth, FLOORS[n - 1].truth, `floor ${n}: same truth as the recovery tower`);
  }
});

test('the truths are about the supporter, not about the person they love', () => {
  for (let n = 1; n <= 90; n++) {
    const t = SUP[n].truth;
    assert.doesNotMatch(t, /\b(are they|is they|do they|did they|have they|their day count|their number|are you sure they)\b/i,
      `floor ${n} asks about them, not about you: "${t}"`);
  }
});

test('no dare turns the player into a monitor', () => {
  const banned = /\b(check on them|check their|search|count their|watch them|test them|confront|make them|get them to|look through|go through their)\b/i;
  for (let n = 1; n <= 90; n++) {
    assert.doesNotMatch(SUP[n].dare.text, banned, `floor ${n}'s dare is surveillance: "${SUP[n].dare.text}"`);
  }
});

test('the supporter tower never gives the other person a pronoun', () => {
  // Jacques had the whole app swept for "her" and "she" on 31 Aug; he is a
  // supporter himself. Nothing here may assume who is on the other side.
  for (let n = 1; n <= 90; n++) {
    assert.doesNotMatch(words(SUP[n]), /\b(he|she|him|her|his|hers|husband|wife|girlfriend|boyfriend)\b/i,
      `supporter floor ${n} assumes a gender`);
  }
  for (const [key, a] of Object.entries(SUP_ART)) {
    assert.doesNotMatch(a.title + ' ' + a.text, /\b(husband|wife|girlfriend|boyfriend)\b/i,
      `supporter artifact ${key} assumes a relationship`);
  }
});

test('it blames nobody, and makes no medical claim', () => {
  const blame = /\b(their fault|your fault|blame|they should|they need to|they must)\b/i;
  const medical = /research shows|studies show|dopamine|brain chemistry|rewire|neural|clinically/i;
  for (let n = 1; n <= 90; n++) {
    assert.doesNotMatch(words(SUP[n]), blame, `supporter floor ${n} takes a side`);
    assert.doesNotMatch(words(SUP[n]), medical, `supporter floor ${n} makes a medical claim`);
  }
  for (const [key, a] of Object.entries(SUP_ART)) {
    assert.doesNotMatch(a.text, medical, `supporter artifact ${key} makes a medical claim`);
  }
});

test('the supporter Vault is its own, and cannot be confused with the other', () => {
  assert.ok(Object.keys(SUP_ART).length >= 25, 'ninety floors needs a real vault');
  for (const [key, a] of Object.entries(SUP_ART)) {
    const [n, room] = key.split(':');
    const base = FLOORS[Number(n) - 1];
    assert.ok(base, `supporter artifact ${key} is on a floor that does not exist`);
    assert.ok(base.rooms[room], `supporter artifact ${key} is in a room floor ${n} does not have`);
    assert.ok(!['entry', 'door', 'stairs'].includes(room), `${key} is on the main path`);
    assert.ok(['LETTER', 'LESSON', 'STORY'].includes(a.kind), `${key}: unknown kind`);
    assert.ok(a.text.length > 200, `${key} is too thin to be worth finding`);
  }
  for (const lo of [1, 21, 41, 61]) {
    const inBand = Object.keys(SUP_ART).map((k) => Number(k.split(':')[0])).filter((n) => n >= lo && n < lo + 20);
    assert.ok(inBand.length >= 3, `floors ${lo}-${lo + 19} hold only ${inBand.length} supporter artifacts`);
  }
});

test('the two vaults never share their found state', () => {
  // Both towers use the same room coordinates, so an unprefixed key would mark
  // the recovery artifact found when a supporter walked into the same room -
  // and hand them writing addressed to the person recovering.
  assert.match(APP, /function towerArtifactKey\(n,room\)\{return \(towerIsSupporter\(\)\?'s:':''\)\+n\+':'\+room;\}/);
  assert.match(APP, /function towerArtifacts\(\)\{return towerIsSupporter\(\)\?TOWER_ARTIFACTS_SUP:TOWER_ARTIFACTS;\}/);
  const counts = APP.match(/function towerVaultCounts\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(counts, /towerKept\(pre\+k\)/, 'the count must read the prefixed state');
});

test('which tower you walk follows the track, not the account', () => {
  // Same rule as isSupporterTrack: somebody carrying both sides gets the
  // supporter tower while that is the track they are on, and their own back
  // when they switch.
  assert.match(APP, /function towerIsSupporter\(\)\{return isSupporterTrack\(\)\|\|S\.userType==='partner';\}/);
  const fn = APP.match(/function towerFloor\(n\)\{[\s\S]*?\n\}/)[0];
  assert.match(fn, /if\(!towerIsSupporter\(\)\)return base;/);
  assert.match(fn, /Object\.assign\(\{\},base,sup\)/, 'writing over the shared map');
});
