// 2AM - the buildings. Jacques, 3 Sep 2026: "make it fun and challenging to
// want to do better in your recovery - that's the point."
//
// What this file guards:
//   - every track the app offers has an opponent, in all three tiers
//   - every line has exactly one right counter and two wrong ones
//   - the pace starts slow (single words, long clock) and tightens
//   - strength is earned in the app, and the door says what is missing
//   - a loss locks the roof until one real thing is done in the app
//   - the house rules: no medical claims, never "finished", no pronouns for
//     a supporter's person, and the supporter's opponent never blames them
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
vm.runInNewContext(src + '\nthis.GAME_TRACKS=GAME_TRACKS;this.BOSS_NAME=BOSS_NAME;this.GAME_BOSSES=GAME_BOSSES;this.GAME_EXITS=GAME_EXITS;this.GAME_QUICK_GENERIC=GAME_QUICK_GENERIC;this.GAME_QUICK_TRACK=GAME_QUICK_TRACK;this.GAME_RIDES=GAME_RIDES;this.gameTier=gameTier;', ctx);
const { GAME_TRACKS, BOSS_NAME, GAME_BOSSES, GAME_EXITS, GAME_QUICK_GENERIC, GAME_QUICK_TRACK, GAME_RIDES, gameTier } = ctx;

const LESSON_TRACKS = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'lessons.json'), 'utf8')));

test('every track in the app has an opponent with a name', () => {
  for (const t of LESSON_TRACKS) {
    if (t === 'Together') continue; // a couples programme, not a habit
    assert.ok(GAME_BOSSES[t], 'no boss for ' + t);
    assert.ok(BOSS_NAME[t], 'no boss name for ' + t);
    assert.ok(GAME_EXITS[t] && GAME_EXITS[t].length >= 4, 'fewer than four exits for ' + t);
    assert.ok(GAME_QUICK_TRACK[t] && GAME_QUICK_TRACK[t].length >= 5, 'fewer than five quick-fire lines for ' + t);
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

test('the pace starts slow: single words first, longer lines and a faster clock later', () => {
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
  assert.ok(gameTier(1).clock > gameTier(3).clock && gameTier(3).clock > gameTier(5).clock, 'the clock must tighten');
  assert.ok(gameTier(1).hit[0] < gameTier(5).hit[0], 'the boss must hit harder later');
});

test('every exit has exactly one way out', () => {
  for (const [t, scenes] of Object.entries(GAME_EXITS)) {
    for (const sc of scenes) {
      assert.strictEqual(sc.moves.length, 3, `${t} "${sc.scene}" needs three moves`);
      assert.strictEqual(sc.moves.filter(m => m.ok).length, 1, `${t} "${sc.scene}" needs exactly one exit`);
    }
  }
});

test('quick-fire is balanced and every statement is a plain true/false', () => {
  const all = GAME_QUICK_GENERIC.concat(...Object.values(GAME_QUICK_TRACK));
  for (const q of all) assert.strictEqual(typeof q.a, 'boolean', q.s);
  const trues = GAME_QUICK_GENERIC.filter(q => q.a).length;
  assert.ok(trues >= 8 && GAME_QUICK_GENERIC.length - trues >= 6, 'generic pool must have both answers well represented');
});

test('house rules: no medical claims, never finished, no pronouns for a supporter\'s person', () => {
  const text = JSON.stringify({ GAME_BOSSES, GAME_EXITS, GAME_QUICK_GENERIC, GAME_QUICK_TRACK, GAME_RIDES });
  assert.doesNotMatch(text, /research shows|studies show|dopamine|brain chem|neuro|rewir|prefrontal|clinically/i);
  assert.doesNotMatch(text, /you(?:'re| are) (?:cured|finished|done with this)/i);
  const sup = JSON.stringify({ b: GAME_BOSSES['Supporting Someone'], e: GAME_EXITS['Supporting Someone'], q: GAME_QUICK_TRACK['Supporting Someone'] });
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
