// The Fight of Your Life. Rebuilt again after 6 Sep 2026: one building per
// addiction, ten floors and a roof, the fight itself in 3D on its own page
// (game3d.html), a parachute out. This check was rewritten on 8 Sep to match.
//
// What this file guards:
//   - every track the app offers has a building, an opponent in all three
//     tiers, its own temptation lines, and its two photos
//   - every boss line has exactly one right counter and two wrong ones
//   - the pace starts slow (single words, long wind-up, dodge arrows) and
//     tightens; the app shell has no clock (the 3D ring's round clock is the
//     one settled exception)
//   - strength is earned in the app, and the door says what is missing
//   - the roof opens only after ten floors; leaving a fight costs nothing;
//     a relapse costs nothing
//   - the fight is handed this person's own things, never invented ones
//   - the house rules: no medical claims, never "finished", no pronouns for
//     a supporter's person, the supporter's opponent never blames them
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const APP = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const FIGHT3D = fs.readFileSync(path.join(ROOT, 'game3d.html'), 'utf8');
const exists = (...p) => fs.existsSync(path.join(ROOT, ...p));

// Pull the game's data tables out of the page and evaluate them on their own.
function block(startMarker, endMarker) {
  const a = APP.indexOf(startMarker); assert.ok(a > 0, 'missing ' + startMarker);
  const b = APP.indexOf(endMarker, a); assert.ok(b > a, 'missing ' + endMarker);
  return APP.slice(a, b);
}
const GAME = block('// ─── THE FIGHT OF YOUR LIFE', 'function towerStop()');
const src = block('const GAME_FLOORS=', 'function gameState(){');
const ctx = { S: { bld: { b: 1, f: 1 } } };
vm.runInNewContext(src + `
function gameState(){return S.bld;}
this.GAME_FLOORS=GAME_FLOORS;this.GAME_ELEMENTS=GAME_ELEMENTS;this.GAME_BUILDINGS=GAME_BUILDINGS;
this.GAME_TEMPT=GAME_TEMPT;this.GAME_BOSSES=GAME_BOSSES;this.GAME_RIDES=GAME_RIDES;
this.GAME_PLACES=GAME_PLACES;this.GAME_BOXERS=GAME_BOXERS;this.GAME_GLOVES=GAME_GLOVES;
this.tierAt=function(b,f){S.bld={b:b,f:f||1};return gameTier();};`, ctx);
const { GAME_FLOORS, GAME_ELEMENTS, GAME_BUILDINGS, GAME_TEMPT, GAME_BOSSES, GAME_RIDES, GAME_PLACES, GAME_BOXERS, GAME_GLOVES, tierAt } = ctx;

const LESSON_TRACKS = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'lessons.json'), 'utf8')));
const HABIT_TRACKS = LESSON_TRACKS.filter(t => t !== 'Together'); // a couples programme, not a habit

test('every track in the app has a building, an opponent, temptation lines and two photos', () => {
  for (const t of HABIT_TRACKS) {
    const b = GAME_BUILDINGS.find(x => x.track === t);
    assert.ok(b, 'no building for ' + t);
    assert.ok(b.k && b.name && b.kind, b.track + ' needs a key, a name and a kind of place');
    assert.ok(GAME_BOSSES[t], 'no boss for ' + t);
    assert.ok(Array.isArray(GAME_TEMPT[t]) && GAME_TEMPT[t].length >= 10, 'fewer than ten temptations for ' + t);
    assert.ok(exists('img', 'fight', 'boss-' + b.k + '.jpg'), 'missing img/fight/boss-' + b.k + '.jpg');
    assert.ok(exists('img', 'fight', 'bld-' + b.k + '.jpg'), 'missing img/fight/bld-' + b.k + '.jpg');
  }
  // (the tables come out of a separate realm, so compare as text)
  const tracks = JSON.stringify(Array.from(GAME_BUILDINGS, b => b.track).sort());
  assert.strictEqual(tracks, JSON.stringify(Object.keys(GAME_BOSSES).sort()), 'buildings and bosses are the same list');
  assert.strictEqual(tracks, JSON.stringify(Object.keys(GAME_TEMPT).sort()), 'buildings and temptations are the same list');
  assert.strictEqual(new Set(GAME_BUILDINGS.map(b => b.k)).size, GAME_BUILDINGS.length, 'building keys are unique');
});

test('every boss line has one right counter and two wrong ones, in all three tiers', () => {
  for (const [t, tiers] of Object.entries(GAME_BOSSES)) {
    for (const k of ['short', 'mid', 'long']) {
      assert.ok(Array.isArray(tiers[k]) && tiers[k].length >= 5, `${t}.${k} needs at least five lines`);
      for (const q of tiers[k]) {
        assert.ok(q.line && q.right, `${t}.${k}: line and right are required`);
        assert.strictEqual(q.wrong.length, 2, `${t}.${k} "${q.line}" needs exactly two wrong answers`);
        assert.ok(!q.wrong.includes(q.right), `${t}.${k} "${q.line}": a wrong answer equals the right one`);
      }
    }
  }
});

test('the art and the sound are on disk: rings, fighters, ref, boxers, gloves, the bell', () => {
  assert.strictEqual(GAME_FLOORS, 10, 'ten floors, then the roof');
  for (const el of GAME_ELEMENTS) assert.ok(exists('img', 'fight', 'ring-' + el.toLowerCase() + '.jpg'), 'missing ring for ' + el);
  for (const p of GAME_PLACES) assert.ok(exists('img', 'fight', p.k + '.jpg'), 'missing scene ' + p.k);
  for (const n of [1, 2, 3, 4, 5]) assert.ok(exists('img', 'fight', `fighter${n}.glb`), `missing fighter${n}.glb`);
  for (const f of ['ref.glb', 'ring.glb', 'chute.glb', 'city.glb']) assert.ok(exists('img', 'fight', f), 'missing ' + f);
  for (const n of GAME_BOXERS) for (const pose of ['punch', 'guard', 'corner', 'count', 'down']) {
    assert.ok(exists('img', 'fight', `boxer${n}-${pose}.jpg`), `missing boxer${n}-${pose}.jpg`);
  }
  for (const c of ['red', 'blue', 'white']) assert.ok(exists('img', 'fight', `glove-${c}.png`), 'missing glove ' + c);
  assert.ok(GAME_GLOVES.includes('red'), 'red gloves are the default');
  for (const f of ['bell', 'bell3', 'crowd', 'cheer', 'winner', 'saved', 'down', 'getup', 'ref-1', 'ref-10', 'round-1', 'round-6', 'boss-hit-1', 'boss-down', 'you-m-hit-1', 'you-w-hit-1']) {
    assert.ok(exists('audio', 'fight', f + '.mp3'), 'missing audio/fight/' + f + '.mp3');
  }
});

test('the pace starts slow: single words first, longer lines, a shorter wind-up, no clock in the app', () => {
  // Jacques on the demo: "start each rooftop level off slow and the questions
  // are too long - start them off with just a word."
  const words = s => s.trim().split(/\s+/).length;
  for (const [t, tiers] of Object.entries(GAME_BOSSES)) {
    for (const q of tiers.short) assert.ok(words(q.line) <= 3, `${t} short line too long: "${q.line}"`);
    for (const q of tiers.mid) assert.ok(words(q.line) <= 6, `${t} mid line too long: "${q.line}"`);
  }
  const early = tierAt(1, 1), mid = tierAt(3, 1), late = tierAt(6, 1);
  assert.strictEqual(early.key, 'short');
  assert.strictEqual(tierAt(2, 11).key, 'short', 'the whole of building two is still single words');
  assert.strictEqual(mid.key, 'mid');
  assert.strictEqual(late.key, 'long');
  assert.ok(early.tell > mid.tell && mid.tell > late.tell, 'the wind-up must shorten');
  assert.ok(early.hit < late.hit, 'the boss must hit harder later');
  assert.ok(early.arrows && !late.arrows, 'dodge arrows are shown early, then taken away');
  assert.ok(!early.feint && mid.feint && late.switch, 'feints arrive mid, the switch late');
  // Jacques: "no timer, it's added stress". The app shell counts nothing down.
  // The one settled exception (6 Sep) is the round clock inside the 3D ring.
  assert.doesNotMatch(GAME, /floorClock|timeLeft|ROUND_SECS|Too slow\. That's how it gets in/, 'no countdown clock in the app shell');
  assert.match(FIGHT3D, /ROUND_SECS/, 'the ring keeps real boxing rounds');
});

test('the roof opens only after ten floors, and walking out of a fight costs nothing', () => {
  const floors = block('function renderFloors(){', 'function gameFloorGo(');
  assert.match(floors, /roofReady=Object\.keys\(g\.cleared\)\.length>=GAME_FLOORS/);
  assert.match(floors, /roofReady\?'fight':'ten floors first'/);
  const leave = block('function gameLeaveFight(){', 'function game3dWon(){');
  assert.doesNotMatch(leave, /losses|cleared|g\.f=/, 'leaving the fight changes no score');
  assert.match(block('function game3dLost(', 'function gameNextBuilding'), /if\(!draw\)g\.losses\+\+/);
});

test('the fight is handed this person\'s own things, never invented ones', () => {
  const lines = block('function game3dLines(){', 'function game3dSupport(){');
  assert.ok(lines.includes('GAME_BOSSES[track]') && lines.includes('GAME_TEMPT[track]'), 'its lines are the addiction\'s own');
  const support = block('function game3dSupport(){', 'async function startFight(){');
  for (const need of ['S.journal', 'S.partnerName', 'gameDays()']) assert.ok(support.includes(need), 'the corner must read ' + need);
  const start = block('async function startFight(){', 'function game3dMessage(');
  for (const need of ['bossKey:', 'bossName:', 'lines:game3dLines()', 'support:game3dSupport()', 'name:(S.name']) assert.ok(start.includes(need), 'the ring is handed ' + need);
  assert.match(start, /src="\/game3d\.html\?/, 'the fight runs in game3d.html');
  assert.match(FIGHT3D, /type:\s*'fight-over'/, 'and the ring reports back how it ended');
  assert.doesNotMatch(GAME + JSON.stringify(GAME_TEMPT), /% of people|people on your track were|house:\[/, 'no made-up crowd numbers');
});

test('house rules: no medical claims, never finished, no pronouns for a supporter\'s person', () => {
  const text = JSON.stringify({ GAME_BOSSES, GAME_TEMPT, GAME_RIDES, GAME_BUILDINGS }) + GAME;
  assert.doesNotMatch(text, /research shows|studies show|dopamine|brain chem|neuro|rewir|prefrontal|clinically/i);
  assert.doesNotMatch(text, /you(?:'re| are) (?:cured|finished|done with this)/i);
  const sup = JSON.stringify({ b: GAME_BOSSES['Supporting Someone'], t: GAME_TEMPT['Supporting Someone'] });
  assert.doesNotMatch(sup, /\b(she|her|hers|he|him|his|husband|wife)\b/i, 'a supporter\'s person is "they"');
  // The supporter's opponent is the voice that blames them; every RIGHT counter must refuse the blame.
  for (const k of ['short', 'mid', 'long']) for (const q of GAME_BOSSES['Supporting Someone'][k]) {
    assert.doesNotMatch(q.right, /my fault|partly on me|if I'd noticed|missed the signs/i, `supporter counter accepts blame: "${q.right}"`);
  }
  assert.match(GAME, /Down\. Not out\. Same time tomorrow\./, 'the boss never says it is over');
  assert.match(GAME, /It is still down there and it will be back/, 'a building ends, the fight does not');
  for (const r of GAME_RIDES) assert.ok(r.key && r.line && typeof r.min === 'number', 'every ride has a key, a line and a floor');
});

test('strength is earned in the app and the door says what is missing', () => {
  const fn = block('function gameStrength(){', 'let gmBusy=');
  for (const need of ['lessonDoneDates', 'journals', 'pledged', 'cravings']) assert.ok(fn.includes(need), 'strength must read ' + need);
  assert.match(fn, /hint:lesson\?null:'Do today/);
  assert.match(fn, /hint:pledge\?null:'Take the pledge on Home/);
  assert.match(fn, /Math\.min\(120,/, 'strength is capped');
  const door = block('function renderRoofDoor(){', 'function game3dLines(){');
  assert.match(door, /Strength · earned in the app/);
  assert.match(door, /p\.hint\?`<small>/, 'the door prints what is missing');
});

test('a relapse costs nothing in the game', () => {
  assert.match(APP, /function towerOnRelapse\(\)\{\}/);
});

test('the supporter gets their own opponent, never their person\'s habit', () => {
  const fn = block('function gameTrack(){', 'function gameBossName');
  assert.match(fn, /S\.userType==='partner'[\s\S]*?return 'Supporting Someone'/);
  assert.ok(GAME_BUILDINGS.some(b => b.track === 'Supporting Someone' && b.name === 'The Checking'));
});

test('the vault, the ninety-floor tower and the game shows are gone from the page', () => {
  assert.doesNotMatch(APP, /renderTowerVault|TOWER_FLOORS|TOWER_ARTIFACTS|id="s-vault"|tw-door/);
  assert.doesNotMatch(APP, /GAME_TOP_FLOOR|function showWheel\(|function showWWR\(|function showHeal\(/, 'the shows were cleared out');
  assert.match(APP, /id="s-tower"/);
  // 6 Sep: The Climb moved off the fight screen. It lives on Today, under the
  // lesson that takes its step, and in Tools.
  assert.doesNotMatch(APP, /id="tw-climb-link"/, 'The Climb is no longer on the fight screen');
  assert.match(APP, /id="home-climb"[^>]*onclick="openClimb\(\)"/, 'The Climb is on Today');
  assert.match(APP, /<span>The Fight<\/span>/, 'the tab is called The Fight');
  assert.doesNotMatch(APP, /whole 2AM tower|all 90 floors|ninety floors/i);
});
