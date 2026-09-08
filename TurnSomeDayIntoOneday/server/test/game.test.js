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
  // A draw never costs a loss, and neither does going back into a floor already
  // cleared - that is practice, so the record it would land on is the wrong one.
  const lost = block('function game3dLost(', 'function gameNextBuilding');
  assert.match(lost, /if\(!draw&&gmReplay==null\)g\.losses\+\+/);
  const won = block('function game3dWon(){', 'function renderJump(){');
  assert.match(won, /if\(gmReplay!=null\)/, 'a replay win must return before the climb moves');
  assert.ok(won.indexOf('if(gmReplay!=null)') < won.indexOf('g.wins++'),
    'the replay check comes before anything is counted');
});

test('the ringside camera is on your side of the ring, and fits a phone', () => {
  const tv = FIGHT3D.slice(FIGHT3D.indexOf('function tvPos('), FIGHT3D.indexOf('const SHOTS={corner:'));
  // Built off the line between the two of them, not a fixed +x that the boss stands on.
  assert.match(tv, /toYou=a\.clone\(\)\.sub\(b\)/, 'the shot is placed from you, not from a fixed corner');
  assert.match(tv, /addScaledVector\(toYou,back\)/, 'and it stands behind you');
  // A portrait phone cannot hold two fighters side by side, so it comes round.
  assert.match(tv, /port=cam\.aspect<0\.85/);
  assert.match(tv, /back=port\?/, 'a tall screen gets more of a behind-you angle');
  assert.doesNotMatch(FIGHT3D, /tv:\{pos:\(\)=>new T\.Vector3\(2\.35/, 'the old fixed broadside shot is gone');
});

test('the camera cannot end up behind the addiction mid-round', () => {
  // A horizontal drag is also how you dodge, so an unlimited swing meant a few
  // dodges the same way left the fight being watched from its opponent's shoulder.
  assert.match(FIGHT3D, /function yawLimit\(\)\{return \(running\|\|downState\)\?0\.5:Math\.PI;\}/,
    'penned in during the action, free on the picker');
  assert.match(FIGHT3D, /orbYaw=clampYaw\(orbYaw-dx\*0\.008\)/, 'the drag itself is clamped');
  assert.match(FIGHT3D, /function camDrift\(dt\)\{orbYaw=clampYaw\(orbYaw\)/, 'and so is anything already banked');
  // every bell puts the view back where it belongs
  const round = FIGHT3D.slice(FIGHT3D.indexOf('async function nextRound()'), FIGHT3D.indexOf('async function endRound()'));
  assert.match(round, /orbYaw=0;orbPitch=0;orbZoom=1;recentre\(\);manualUntil=0;/);
  // and a wrong-way drag is not held for a third of the round
  assert.match(FIGHT3D, /manualUntil=performance\.now\(\)\+\(\(running\|\|downState\)\?2200:9000\)/);
});

test('the ring lights always come back up', () => {
  const ko = FIGHT3D.slice(FIGHT3D.indexOf('function koLights('), FIGHT3D.indexOf('// sparks:'));
  // Saving unconditionally meant a second knockdown banked the already-dark values
  // as "normal", and every restore after that left the screen black for good.
  assert.match(ko, /if\(!koLightSaved\)koLightSaved=\{/, 'the room is only remembered once');
  assert.doesNotMatch(ko, /if\(on\)\{koLightSaved=\{/, 'never overwrite a saved room');
  assert.match(ko, /koLightSaved=null;/, 'and it is cleared on the way back up');
});

test('you can see yourself on the canvas while the count runs', () => {
  const down = FIGHT3D.slice(FIGHT3D.indexOf('async function meDown('), FIGHT3D.indexOf('async function decision('));
  assert.match(down, /shot\('down',900\);/, 'the count has its own camera');
  assert.match(FIGHT3D, /down:\{pos:\(\)=>YOU\?downPos\(YOU\)/, 'and it is built from where they fell');
});

test('nobody is counted out, and nobody is stood up for', () => {
  const down = FIGHT3D.slice(FIGHT3D.indexOf('async function meDown('), FIGHT3D.indexOf('async function decision('));
  // The app must never stand a person up on its own, and never count them out.
  assert.doesNotMatch(down, /refCount\(/, 'the fixed count would stand them up at eight by itself');
  assert.match(down, /await refCountToTap\(/, 'the count waits for the person to get up');
  const counter = FIGHT3D.slice(FIGHT3D.indexOf('function refCountToTap('), FIGHT3D.indexOf('async function meDown('));
  assert.ok(!/'Ten\.'/.test(counter), 'there is no ten in this count');
  assert.match(counter, /if\(n<9\)/, 'the count stops at nine');
  assert.match(counter, /Come on\. Come on\./, 'and holds there for as long as it takes');
  assert.match(counter, /chant\('R',SUPPORT\)/, 'their own lines come up while it waits');
  // Getting up sooner is worth more, and getting up late is still getting up.
  assert.match(down, /youHP=Math\.max\(26,44-at\*2\)/);
});

test('every element fights differently, and none of them is unwinnable', () => {
  const m = FIGHT3D.match(/const FLOORS=\[([\s\S]*?)\n\s*\/\/ The roof has no element/);
  assert.ok(m, 'FLOORS still carries the per-element styles');
  const styles = [...m[1].matchAll(/\{k:'(\w+)'[\s\S]*?st:\{tell:([\d.]+),dmg:([\d.]+),chin:([\d.]+),gap:([\d.]+),feint:([\d.]+),how:'([^']+)'/g)];
  assert.equal(styles.length, 13, 'all thirteen elements have a style');
  for (const [, k, tell, dmg, chin, gap, feint, how] of styles) {
    for (const [name, v] of [['tell', +tell], ['dmg', +dmg], ['chin', +chin], ['gap', +gap]]) {
      assert.ok(v >= 0.55 && v <= 1.5, `${k} ${name} is ${v} - a floor is a different fight, never an unwinnable one`);
    }
    assert.ok(+feint >= 0 && +feint <= 0.4, `${k} feints ${feint} of the time - over 0.4 is unreadable`);
    assert.ok(how.length > 8, `${k} must say how it fights, so nobody walks into Ice expecting Lightning`);
  }
  // The three numbers have to actually reach the fight, or the styles are decoration.
  assert.match(FIGHT3D, /function tellMs\(\)\{return \(1900-1000\*ease\(step\(\)-1\)\)\*STY\(\)\.tell/);
  assert.match(FIGHT3D, /function hitDmg\(\)\{return Math\.round\(\(10\+16\*ease\(step\(\)-1\)\)\*STY\(\)\.dmg\)/);
  assert.match(FIGHT3D, /dmg=Math\.max\(2,Math\.round\(dmg\*STY\(\)\.chin\)\)/);
  assert.match(FIGHT3D, /\*STY\(\)\.gap;await wait\(gap\)/);
  // A feint never comes twice running - the follow-up is called with fast=true,
  // and that path skips the feint check.
  assert.match(FIGHT3D, /if\(!fast&&Math\.random\(\)<STY\(\)\.feint\)/);
  assert.match(FIGHT3D, /return bossSwing\(true\);/);
  // and the words match the numbers, screen for screen
  const how3d = Object.fromEntries(styles.map(([, k, , , , , , how]) => [k, how]));
  const app = GAME.match(/const GAME_ELEMENT_HOW=\{([\s\S]*?)\};/);
  assert.ok(app, 'the app tells people how the element fights');
  for (const [, name, line] of app[1].matchAll(/(\w+):'([^']+)'/g)) {
    assert.equal(how3d[name.toLowerCase()], line, `${name} reads differently in the app than it fights`);
  }
});

test('a cleared floor can be walked back into, and it changes nothing', () => {
  const floors = block('function renderFloors(){', 'function gameFloorGo(');
  assert.match(floors, /done\?'gameFloorReplay\('\+n\+'\)'/, 'a cleared floor is tappable again');
  assert.match(floors, /gmReplay=null/, 'walking the stairs clears any replay');
  // Going back to floor two on the way up must never move the climb back to two.
  const go = block('function gameFloorGo(n){', 'function gmFloor(');
  assert.match(go, /gmReplay=null/, 'picking the live floor is not a replay');
  const again = block('function gameFightAgain(){', 'function gameStartOver(){');
  assert.match(again, /g\.cleared\[gmFloor\(\)\]\?gmFloor\(\):null/,
    'a lost fight is a straight retry; a won one is a replay');
  // Starting over is asked for out loud and never touches recovery data.
  const over = block('function gameStartOver(){', 'function gameFighter(){');
  assert.match(over, /appConfirm\(/, 'starting over asks first');
  assert.doesNotMatch(over, /S\.journal|S\.startDate|S\.lessonDay/, 'it resets the game, not the recovery');
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
