// The Fight of Your Life. Jacques, 6 Sep 2026: game shows on the floors, a
// Punch-Out fight on the roof, no clock anywhere, nothing invented.
//
// What this file guards:
//   - every track the app offers has an opponent, in all three tiers, with a
//     shadow photo and a fighting pattern
//   - every line has exactly one right counter and two wrong ones
//   - the pace starts slow (single words, long wind-up, dodge arrows) and
//     tightens; there is no clock
//   - strength is earned in the app, and the door says what is missing
//   - a loss locks the roof until one real thing is done in the app
//   - the house rules: no medical claims, never "finished", no pronouns for
//     a supporter's person, the supporter's opponent never blames them, and
//     no invented numbers ("% of people") anywhere in the game
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

// Pull the game's data tables out of the page and evaluate them on their own.
function block(startMarker, endMarker) {
  const a = APP.indexOf(startMarker); assert.ok(a > 0, 'missing ' + startMarker);
  const b = APP.indexOf(endMarker, a); assert.ok(b > a, 'missing ' + endMarker);
  return APP.slice(a, b);
}
const src = block('const GAME_TOP_FLOOR=', '// ─── State ───');
const ctx = {};
vm.runInNewContext(src + '\nthis.GAME_TRACKS=GAME_TRACKS;this.BOSS_NAME=BOSS_NAME;this.GAME_BOSSES=GAME_BOSSES;this.GAME_EXITS=GAME_EXITS;this.GAME_RIDES=GAME_RIDES;this.gameTier=gameTier;this.BOSS_IMG=BOSS_IMG;this.GAME_PATTERNS=GAME_PATTERNS;this.GAME_BOXERS=GAME_BOXERS;this.GAME_SHOWS=typeof GAME_SHOWS!=="undefined"?GAME_SHOWS:null;', ctx);
const { GAME_TRACKS, BOSS_NAME, GAME_BOSSES, GAME_EXITS, GAME_RIDES, gameTier, BOSS_IMG, GAME_PATTERNS, GAME_BOXERS } = ctx;

const LESSON_TRACKS = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'lessons.json'), 'utf8')));

test('every track in the app has an opponent with a name', () => {
  for (const t of LESSON_TRACKS) {
    if (t === 'Together') continue; // a couples programme, not a habit
    assert.ok(GAME_BOSSES[t], 'no boss for ' + t);
    assert.ok(BOSS_NAME[t], 'no boss name for ' + t);
    assert.ok(GAME_EXITS[t] && GAME_EXITS[t].length >= 4, 'fewer than four exits for ' + t);
    const img = BOSS_IMG[BOSS_NAME[t]];
    assert.ok(img, 'no shadow photo key for ' + BOSS_NAME[t]);
    assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'img', 'fight', 'boss-' + img + '.jpg')), 'missing img/fight/boss-' + img + '.jpg');
  }
  assert.ok(GAME_PATTERNS.default, 'a default fighting pattern');
  for (const [name, p] of Object.entries(GAME_PATTERNS)) {
    assert.ok(Array.isArray(p.seq) && p.seq.length >= 3, name + ' pattern needs at least three moves');
    for (const m of p.seq) assert.ok(['L', 'R', 'F', 'S'].includes(m), name + ' has an unknown move ' + m);
  }
  assert.strictEqual(JSON.stringify(GAME_TRACKS.slice().sort()), JSON.stringify(Object.keys(GAME_BOSSES).sort()));
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

test('every boxer people can pick has all five photos, and the gloves exist', () => {
  for (const n of GAME_BOXERS) for (const pose of ['punch', 'guard', 'corner', 'count', 'down']) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'img', 'fight', `boxer${n}-${pose}.jpg`)), `missing boxer${n}-${pose}.jpg`);
  }
  for (const c of ['red', 'blue', 'white']) assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'img', 'fight', `glove-${c}.png`)), 'missing glove ' + c);
  for (const f of ['bell', 'bell3', 'crowd', 'cheer', 'winner', 'saved', 'down', 'getup', 'ref-1', 'ref-10', 'round-1', 'round-6', 'boss-hit-1', 'boss-down', 'you-m-hit-1', 'you-w-hit-1']) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'audio', 'fight', f + '.mp3')), 'missing audio/fight/' + f + '.mp3');
  }
});

test('the pace starts slow: single words first, longer lines, a shorter wind-up, no clock', () => {
  // Jacques on the demo: "start each rooftop level off slow and the questions
  // are too long - start them off with just a word."
  const words = s => s.trim().split(/\s+/).length;
  for (const [t, tiers] of Object.entries(GAME_BOSSES)) {
    for (const q of tiers.short) assert.ok(words(q.line) <= 3, `${t} short line too long: "${q.line}"`);
    for (const q of tiers.mid) assert.ok(words(q.line) <= 6, `${t} mid line too long: "${q.line}"`);
  }
  assert.strictEqual(gameTier(1).key, 'short');
  assert.strictEqual(gameTier(3).key, 'mid');
  assert.strictEqual(gameTier(5).key, 'long');
  assert.ok(gameTier(1).tell > gameTier(3).tell && gameTier(3).tell > gameTier(5).tell, 'the wind-up must shorten');
  assert.ok(gameTier(1).hit < gameTier(5).hit, 'the boss must hit harder later');
  assert.ok(gameTier(1).arrows && !gameTier(5).arrows, 'dodge arrows are shown early, then taken away');
  assert.ok(!gameTier(1).feint && gameTier(3).feint && gameTier(5).switch, 'feints arrive mid, the switch late');
  // Jacques: "no timer, it's added stress". Nothing in the game counts down.
  const game = block('// ─── THE FIGHT OF YOUR LIFE', 'function towerStop()');
  assert.doesNotMatch(game, /floorClock|setInterval\([^)]*1000\)|Too slow\. That's how it gets in/, 'no countdown clock in the game');
});

test('every exit has exactly one way out', () => {
  for (const [t, scenes] of Object.entries(GAME_EXITS)) {
    for (const sc of scenes) {
      assert.strictEqual(sc.moves.length, 3, `${t} "${sc.scene}" needs three moves`);
      assert.strictEqual(sc.moves.filter(m => m.ok).length, 1, `${t} "${sc.scene}" needs exactly one exit`);
    }
  }
});

test('nothing in the game is invented: no "% of people", every card reads from the app', () => {
  const game = block('// ─── THE FIGHT OF YOUR LIFE', 'function towerStop()');
  assert.doesNotMatch(game, /% of people|people on your track were|house:\[/, 'no made-up crowd numbers');
  const heals = block('function gameHeals(){', 'function showHeal()');
  for (const need of ['gameDays()', 'dailySpend', 'S.journals', 'gamePerson()', 'gameLessonToday()']) assert.ok(heals.includes(need), 'heals must read ' + need);
  const puzzle = block('function gmPuzzleSource(){', 'function showWheel()');
  assert.ok(puzzle.includes('gmJournalText()') && puzzle.includes('gmSentenceFrom(track)'), 'the puzzle reads the journal and the lessons');
});

test('house rules: no medical claims, never finished, no pronouns for a supporter\'s person', () => {
  const text = JSON.stringify({ GAME_BOSSES, GAME_EXITS, GAME_RIDES }) + block('// ─── THE FIGHT OF YOUR LIFE', 'function towerStop()');
  assert.doesNotMatch(text, /research shows|studies show|dopamine|brain chem|neuro|rewir|prefrontal|clinically/i);
  assert.doesNotMatch(text, /you(?:'re| are) (?:cured|finished|done with this)/i);
  const sup = JSON.stringify({ b: GAME_BOSSES['Supporting Someone'], e: GAME_EXITS['Supporting Someone'] });
  assert.doesNotMatch(sup, /\b(she|her|hers|he|him|his|husband|wife)\b/i, 'a supporter\'s person is "they"');
  // The supporter's opponent is the voice that blames them; every RIGHT counter must refuse the blame.
  for (const k of ['short', 'mid', 'long']) for (const q of GAME_BOSSES['Supporting Someone'][k]) {
    assert.doesNotMatch(q.right, /my fault|partly on me|if I'd noticed|missed the signs/i, `supporter counter accepts blame: "${q.right}"`);
  }
  assert.match(APP, /Down\. Not out\. Same time tomorrow\./, 'the boss never says it is over');
  assert.match(APP, /It ends the fight, not the war\./);
});

test('strength is earned in the app and the door says what is missing', () => {
  const fn = block('function gameStrength(){', 'function gameBossHP');
  for (const need of ['lessonDoneDates', 'journals', 'pledged', 'cravings']) assert.ok(fn.includes(need), 'strength must read ' + need);
  assert.match(fn, /hint:lesson\?null:'Do today/);
  assert.match(fn, /hint:pledge\?null:'Take the pledge on Home/);
  assert.match(fn, /Math\.min\(120,/, 'strength is capped');
  const stars = block('function gameStars(){', 'function gameBossHP');
  for (const need of ['gamePledgeToday()', 'gameJournalToday()', 'gameLessonToday()']) assert.ok(stars.includes(need), 'uppercuts are earned by ' + need);
});

test('a loss locks the roof until one real thing is done in the app', () => {
  const lock = block('function gameLock(){', '// ─── Rendering');
  assert.match(lock, /lessonsCompletedCount\|\|0\)>L\.lessons/);
  assert.match(lock, /journals\|\|\[\]\)\.length>L\.journals/);
  assert.match(lock, /cravings\|\|\[\]\)\.length>L\.cravings/);
  assert.match(lock, /S\.pledged&&S\.pledgeDate===today/);
  assert.match(APP, /function gmSaved\(\)\{[\s\S]*?gameLock\(\);/);
});

test('a relapse costs nothing in the game', () => {
  assert.match(APP, /function towerOnRelapse\(\)\{\}/);
});

test('the supporter gets their own opponent, never their person\'s habit', () => {
  const fn = block('function gameTrack(){', 'function gameBossName');
  assert.match(fn, /S\.userType==='partner'[\s\S]*?return 'Supporting Someone'/);
});

test('the vault and the ninety-floor tower are gone from the page', () => {
  assert.doesNotMatch(APP, /renderTowerVault|TOWER_FLOORS|TOWER_ARTIFACTS|id="s-vault"|tw-door/);
  assert.match(APP, /id="s-tower"/);
  assert.match(APP, /id="tw-climb-link"/, 'The Climb stays on the Game screen');
  assert.doesNotMatch(APP, /whole 2AM tower|all 90 floors|ninety floors/i);
});
