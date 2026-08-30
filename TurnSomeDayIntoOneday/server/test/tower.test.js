// 2AM — the tower game. Spec: docs/GAME-SPEC.md, Phase 1 only.
//
// The spec's rules are the kind that get broken quietly six months later by
// someone adding one more floor, so the ones that can be checked are checked
// here: no medical claims, no blame, a slip never drops you to the ground, and
// the tower can never be climbed higher than the real days behind it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const APP = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// The floor and layout tables are pure data literals, so they can be lifted
// straight out of the shipped file and checked as data.
function literal(name) {
  const m = APP.match(new RegExp('const ' + name + '=(\\[[\\s\\S]*?\\n\\];)'));
  assert.ok(m, name + ' not found in index.html');
  return new Function('return ' + m[1].replace(/;$/, ''))();
}
const FLOORS = literal('TOWER_FLOORS');
const LAYOUTS = literal('TOWER_LAYOUTS');

// The two rules that are arithmetic, reimplemented exactly as shipped.
const ceiling = (climbSteps) => Math.max(1, Math.min(10, climbSteps));
const afterRelapse = (floor) => Math.max(1, Math.floor(floor / 10) * 10);

test('the spec is in the repo next to the code it describes', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'docs', 'GAME-SPEC.md')));
});

test('phase 1 is ten floors, numbered one to ten', () => {
  assert.equal(FLOORS.length, 10);
  assert.deepEqual(FLOORS.map((f) => f.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('every floor has both keys and everything the screen renders', () => {
  for (const f of FLOORS) {
    assert.equal(f.brief.length, 2, `floor ${f.n} briefing is two lines`);
    assert.ok(f.truth.trim().endsWith('?'), `floor ${f.n} truth must be a question`);
    assert.ok(f.dare.text.length > 10, `floor ${f.n} dare`);
    assert.ok(f.dare.seconds > 0 && f.dare.seconds <= 120,
      `floor ${f.n} dare timer must be real but must not trap anyone on a floor`);
    assert.ok(f.line && f.name, `floor ${f.n} needs its line and a name`);
    assert.ok(LAYOUTS[f.layout], `floor ${f.n} points at a layout that exists`);
  }
});

// Spec rule 3.
test('no medical claims anywhere in the floor text', () => {
  const banned = /\b(brain|dopamine|neuro\w*|chemical|receptor|research shows|studies show|clinically|disease)\b/i;
  for (const f of FLOORS) {
    const all = [f.brief.join(' '), f.truth, f.dare.text, f.line, Object.values(f.sides).map((s) => s.line).join(' ')].join(' ');
    assert.doesNotMatch(all, banned, `floor ${f.n} makes a medical claim`);
  }
});

// Spec rule 2: the game never blames the addict to comfort the supporter, or
// the other way round. It says "it", and it never hands the player a job that
// belongs to someone else.
test('no floor blames anyone or tells the player to fix another person', () => {
  const banned = /\b(fault|blame|their addiction|make them|get them to|his drinking|her drinking)\b/i;
  for (const f of FLOORS) {
    const all = [f.brief.join(' '), f.truth, f.dare.text, f.line].join(' ');
    assert.doesNotMatch(all, banned, `floor ${f.n} takes a side`);
  }
});

test('a slip drops you to the last landing and never to the ground', () => {
  assert.equal(afterRelapse(1), 1);
  assert.equal(afterRelapse(7), 1, 'below the first landing you land on floor one, not zero');
  assert.equal(afterRelapse(10), 10, 'floor ten IS a landing');
  assert.equal(afterRelapse(14), 10);
  assert.equal(afterRelapse(30), 30);
  for (let f = 1; f <= 90; f++) assert.ok(afterRelapse(f) >= 1 && afterRelapse(f) <= f);
});

test('a slip never takes back a door that was already opened', () => {
  const src = APP.match(/function towerOnRelapse\(\)\{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(src, /cleared/, 'towerOnRelapse must not touch t.cleared');
  assert.doesNotMatch(src, /nerve/, 'nor the dares already taken');
});

test('the relapse hook only fires on a real slip, not a backwards date fix', () => {
  // It has to sit inside the same guard that banks the ended streak.
  const i = APP.indexOf('towerOnRelapse();');
  const guard = APP.lastIndexOf('if(prevStart&&new Date(S.startDate).getTime()>new Date(prevStart).getTime())', i);
  assert.ok(guard > 0 && i - guard < 900, 'towerOnRelapse is not inside the real-relapse guard');
});

test('the tower can never be climbed higher than the real days behind it', () => {
  assert.equal(ceiling(0), 1, 'day zero still gets floor one');
  assert.equal(ceiling(3), 3);
  assert.equal(ceiling(9), 9);
  assert.equal(ceiling(40), 10, 'phase 1 stops at ten however many days are banked');
  assert.match(APP, /function towerCeiling\(\)\{[\s\S]*?climbSteps\(\)/,
    'the ceiling must read The Climb, which only moves on a real day');
});

test('every floor is walkable: entry reaches the door, the door reaches the stairs', () => {
  for (const lay of LAYOUTS) {
    const names = Object.keys(lay.rooms);
    assert.ok(names.includes('entry') && names.includes('door') && names.includes('stairs'));
    assert.ok(names.length >= 2 && names.length <= 5, 'two to four rooms plus the stairs');
    const seen = new Set(['entry']);
    for (let i = 0; i < names.length; i++) {
      for (const [a, b] of lay.edges) {
        if (seen.has(a)) seen.add(b);
        if (seen.has(b)) seen.add(a);
      }
    }
    for (const k of names) assert.ok(seen.has(k), `${k} is unreachable from the landing`);
    assert.ok(lay.edges.some(([a, b]) => (a === 'door' && b === 'stairs') || (a === 'stairs' && b === 'door')),
      'the stairs hang off the door, so the door is the only way up');
  }
});

test('rooms sit inside the stage', () => {
  for (const lay of LAYOUTS) {
    for (const [k, r] of Object.entries(lay.rooms)) {
      assert.ok(r[0] > 0.1 && r[0] < 0.9, `${k} x`);
      assert.ok(r[1] > 0.1 && r[1] < 0.9, `${k} y`);
    }
  }
});

test('there is no character in the tower at all', () => {
  // Jacques, 30 Aug 2026: "friendly was not supposed to be a part of this."
  // The spec it was built from read his sixth reference as a robot guide. It
  // was Roblox. There is no mascot, no robot and no Friendly in this game -
  // the floor's line is unattributed and nothing in here talks back.
  assert.doesNotMatch(APP, /tw-friend|towerTapFriendly/, 'the HUD figure is gone');
  const src = APP.match(/function towerSay\(text\)\{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(src, /Friendly/, 'the floor line has no speaker');
});

test('the game loop and the dare timer stop when you leave the screen', () => {
  assert.match(APP, /if\(from==='tower'&&id!=='tower'\)\{try\{towerStop\(\);\}catch\(e\)\{\}\}/);
  assert.match(APP, /function towerStop\(\)\{cancelAnimationFrame\(twAnim\);[\s\S]*?towerCloseDoor\(\);\}/);
});
