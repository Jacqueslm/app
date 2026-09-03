// The whole ninety-floor building.
//
// Phase 4: floors 11-90. A floor is a hand-written object plus a small map,
// and a map with a typo in it is not a crash - it is a room you can see and
// never reach, or a door that never opens, discovered by a person at 2am. So
// every floor is walked here: entry to door, door to stairs, every side room
// reachable, every rule and atmosphere one the engine actually implements.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const APP = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const slice = (start, end) => APP.slice(APP.indexOf(start), APP.indexOf(end, APP.indexOf(start)) + end.length);
const FLOORS = new Function(slice('const TOWER_FLOORS=[', '\n];') + ';return TOWER_FLOORS;')();
const ARTIFACTS = new Function(slice('const TOWER_ARTIFACTS={', '\n};') + ';return TOWER_ARTIFACTS;')();

// Only what towerAir and the draw code actually branch on. Anything else is a
// silent no-op: the floor renders with no atmosphere or with rule 'none'.
const AIRS = ['grain', 'grid', 'dust', 'glow', 'flicker', 'window', 'rain', 'embers', 'static'];
const RULES = ['none', 'dark', 'dim', 'echo', 'oneway', 'sequence', 'slow', 'quiet', 'fog', 'pull'];

const reachable = (f) => {
  const adj = {};
  Object.keys(f.rooms).forEach(k => adj[k] = []);
  f.edges.forEach(([a, b]) => { adj[a] && adj[a].push(b); adj[b] && adj[b].push(a); });
  const seen = new Set(['entry']), stack = ['entry'];
  while (stack.length) for (const nx of adj[stack.pop()] || []) if (!seen.has(nx)) { seen.add(nx); stack.push(nx); }
  return seen;
};

test('the building is ninety floors, numbered one to ninety', () => {
  assert.equal(FLOORS.length, 90);
  FLOORS.forEach((f, i) => assert.equal(f.n, i + 1, `floor at index ${i} says it is ${f.n}`));
});

test('every floor can actually be walked', () => {
  for (const f of FLOORS) {
    const seen = reachable(f);
    assert.ok(f.rooms.entry, `floor ${f.n}: no entry`);
    assert.ok(f.rooms.door, `floor ${f.n}: no door`);
    assert.ok(f.rooms.stairs, `floor ${f.n}: no stairs`);
    for (const k of Object.keys(f.rooms)) {
      assert.ok(seen.has(k), `floor ${f.n}: ${k} is drawn but cannot be reached from entry`);
    }
    for (const [a, b] of f.edges) {
      assert.ok(f.rooms[a], `floor ${f.n}: edge names room ${a}, which does not exist`);
      assert.ok(f.rooms[b], `floor ${f.n}: edge names room ${b}, which does not exist`);
    }
  }
});

test('every floor uses a rule and an atmosphere the engine implements', () => {
  for (const f of FLOORS) {
    assert.ok(RULES.includes(f.rule), `floor ${f.n}: rule '${f.rule}' is not implemented`);
    assert.ok(AIRS.includes(f.air), `floor ${f.n}: air '${f.air}' is not implemented`);
    if (f.rule === 'sequence') assert.ok(f.doorNeeds && f.doorNeeds.length, `floor ${f.n}: sequence with nothing to gate`);
    if (f.rule === 'oneway') assert.ok(f.oneway && f.oneway.length, `floor ${f.n}: oneway with no one-way edge`);
    (f.doorNeeds || []).forEach(k => assert.ok(f.rooms[k], `floor ${f.n}: doorNeeds '${k}' is not a room`));
    (f.oneway || []).forEach(([a, b]) => {
      assert.ok(f.rooms[a] && f.rooms[b], `floor ${f.n}: oneway names a room that does not exist`);
      assert.ok(f.edges.some(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a)),
        `floor ${f.n}: oneway ${a}->${b} is not an edge`);
    });
  }
});

test('every room is on the screen and every side room is described', () => {
  for (const f of FLOORS) {
    for (const [k, r] of Object.entries(f.rooms)) {
      assert.ok(r[0] >= 0.10 && r[0] <= 0.90, `floor ${f.n}: ${k} x=${r[0]} is off the edge`);
      assert.ok(r[1] >= 0.10 && r[1] <= 0.90, `floor ${f.n}: ${k} y=${r[1]} is off the edge`);
    }
    for (const k of Object.keys(f.rooms)) {
      if (!k.startsWith('side')) continue;
      assert.ok(f.sides && f.sides[k] && f.sides[k].name && f.sides[k].line,
        `floor ${f.n}: ${k} has no name or line`);
    }
    for (const k of Object.keys(f.sides || {})) {
      assert.ok(f.rooms[k], `floor ${f.n}: sides describes ${k}, which is not on the map`);
    }
  }
});

test('every floor has its own writing, and none of it is a placeholder', () => {
  const truths = new Set(), names = new Set();
  for (const f of FLOORS) {
    assert.equal(f.brief.length, 2, `floor ${f.n}: a briefing is two lines`);
    assert.ok(f.brief[0].startsWith('Floor '), `floor ${f.n}: the briefing must name the floor`);
    assert.ok(f.truth.endsWith('?'), `floor ${f.n}: the truth must be a question`);
    assert.ok(f.dare.text.length > 20 && f.dare.seconds >= 30, `floor ${f.n}: the dare is too thin`);
    assert.ok(f.line.length > 15, `floor ${f.n}: no atmosphere line`);
    assert.ok(!names.has(f.name), `floor ${f.n}: '${f.name}' is used twice`);
    assert.ok(!truths.has(f.truth), `floor ${f.n}: this truth is asked on another floor too`);
    names.add(f.name); truths.add(f.truth);
    assert.doesNotMatch(f.truth + f.dare.text + f.line, /TODO|TBD|placeholder|lorem/i);
  }
});

test('the tower never makes a medical claim or promises an ending', () => {
  // Two of the spec's own rules, checked against every line of writing.
  for (const f of FLOORS) {
    const all = [f.name, ...f.brief, f.truth, f.dare.text, f.line,
      ...Object.values(f.sides || {}).flatMap(s => [s.name, s.line])].join(' ');
    assert.doesNotMatch(all, /research shows|studies show|dopamine|brain chemistry|rewire|neural/i,
      `floor ${f.n} makes a medical claim`);
    assert.doesNotMatch(all, /you are cured|you are fixed|for good now|never again will you/i,
      `floor ${f.n} promises an ending`);
  }
});

test('every artifact sits in a room that exists', () => {
  for (const key of Object.keys(ARTIFACTS)) {
    const [n, room] = key.split(':');
    const f = FLOORS[Number(n) - 1];
    assert.ok(f, `artifact ${key} is on a floor that does not exist`);
    assert.ok(f.rooms[room], `artifact ${key} is in a room floor ${n} does not have`);
    assert.ok(room !== 'entry' && room !== 'door' && room !== 'stairs',
      `artifact ${key} is on the main path - it could not be missed`);
    const a = ARTIFACTS[key];
    assert.ok(['LETTER', 'LESSON', 'STORY'].includes(a.kind), `artifact ${key}: unknown kind ${a.kind}`);
    assert.ok(a.title && a.text.length > 80, `artifact ${key} is too thin to be worth finding`);
  }
});

test('the Vault is worth walking into and spread across the building', () => {
  const floorsWithArt = new Set(Object.keys(ARTIFACTS).map(k => Number(k.split(':')[0])));
  assert.ok(Object.keys(ARTIFACTS).length >= 40, 'ninety floors needs more than a handful');
  for (const lo of [1, 21, 41, 61, 81]) {
    const inBand = [...floorsWithArt].filter(n => n >= lo && n < lo + 20);
    assert.ok(inBand.length >= 3, `floors ${lo}-${lo + 19} hold only ${inBand.length} artifacts`);
  }
});

test('the whole tower is free - all ninety floors, no plan check', () => {
  // Jacques, 1 Sep 2026: "make the whole tower game free."
  assert.match(APP, /const TOWER_TOP_FLOOR=90;/);
  assert.match(APP, /function towerMaxFloor\(\)\{return TOWER_TOP_FLOOR;\}/,
    'the ceiling must not depend on the plan');
  assert.doesNotMatch(APP, /Floors eleven to ninety are part of Pro/,
    'the upsell at floor ten is gone');
  // nothing in the tower may read the subscription flag at all
  const tower = APP.slice(APP.indexOf('const TOWER_FREE_FLOORS'), APP.indexOf('// \u2500\u2500 THE URGE WAVE'));
  assert.doesNotMatch(tower, /S\.isPro/, 'the tower must not check S.isPro anywhere');
  // the only thing that gates a floor now is real days on The Climb
  assert.match(APP, /return Math\.max\(1,Math\.min\(towerMaxFloor\(\),climbSteps\(\)\)\);/);
});

test('a relapse still drops to a landing and never to the ground', () => {
  const fn = APP.match(/function towerOnRelapse\(\)\{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(fn, /floor=1\b/, 'never back to the ground');
  assert.match(fn, /10/, 'landings are every tenth floor');
});
