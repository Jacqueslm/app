// The Fight of Your Life. Rebuilt again after 6 Sep 2026: one building per
// addiction, five floors and a roof, the fight itself in 3D on its own page
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
//   - the roof opens only after five floors; leaving a fight costs nothing;
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
// 4 Oct 2026: the fight is its own page now. Its markup, its CSS and its 669
// lines of JavaScript were lifted out of index.html into fight.html, and this
// is the file that has to be read if these tests are to describe what ships.
const APP = fs.readFileSync(path.join(ROOT, 'fight.html'), 'utf8');
// The shell that holds the three pages. What belongs to the shell (the way in
// to the fight, what the tab is called) is asserted here against this file, not
// against the fight's page.
const HUB = fs.readFileSync(path.join(ROOT, 'hub.html'), 'utf8');
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
  assert.strictEqual(GAME_FLOORS, 5, 'five floors, then the roof');
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
  assert.strictEqual(tierAt(2, 6).key, 'short', 'the whole of building two is still single words');
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

test('the roof opens only after five floors, and walking out of a fight costs nothing', () => {
  const floors = block('function renderFloors(){', 'function gameFloorGo(');
  assert.match(floors, /roofReady=Object\.keys\(g\.cleared\)\.length>=GAME_FLOORS/);
  assert.match(floors, /roofReady\?'fight':'five floors first'/);
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

test('strength is counted from this page, and the door shows what it is made of', () => {
  // 4 Oct 2026: the fight is a page of its own and there is no recovery app
  // around it. It can no longer count lessons done, pledges or cravings, so
  // strength is what this page actually holds: days here, floors cleared,
  // buildings behind you. The old numbers are gone, not faked.
  const fn = block('function gameStrength(){', 'let gmBusy=');
  for (const need of ['gameDays()', "k:'Days here'", "k:'Floors this building'", "k:'Buildings behind you'"]) {
    assert.ok(fn.includes(need), 'strength must count ' + need);
  }
  assert.doesNotMatch(fn, /lessonDoneDates|journals|pledged|cravings/,
    'nothing is counted that this page cannot see');
  assert.match(fn, /Math\.min\(120,/, 'strength is capped');
  const door = block('function renderRoofDoor(){', 'function game3dLines(){');
  assert.match(door, /<b>\$\{str\.total\}<\/b><span>Strength<\/span>/, 'the door shows the number');
  assert.match(door, /str\.parts\.map/, 'and it shows every part the number is made of');
  assert.match(door, /p\.hint\?`<small>/, 'a part may still say what is missing');
});

test('a relapse costs nothing in the game', () => {
  assert.match(APP, /function towerOnRelapse\(\)\{\}/);
});

test('the opponent is the building\'s own track, never somebody else\'s habit', () => {
  // The page no longer knows who is holding the phone, so it cannot decide for
  // them. The building does: a supporter's building is its own, which is what
  // keeps a supporter from fighting their person's habit.
  const fn = block('function gameTrack(){', 'function gameBossName');
  assert.match(fn, /const t=gameBuilding\(\)\.track;/, 'the track comes from the building in front of you');
  assert.match(fn, /return GAME_BOSSES\[t\]\?t:'Other';/, 'and it is only used when there is an opponent for it');
  assert.ok(GAME_BUILDINGS.some(b => b.track === 'Supporting Someone' && b.name === 'The Checking'),
    'the supporter still has their own building, so they still get their own opponent');
});

test('the vault, the ninety-floor tower and the game shows are gone from the page', () => {
  // The page the fight ships on is fight.html now, so this is the file that has
  // to be clean of them. The Fight tab and The Climb were part of the recovery
  // app around the game and went with it; the shell's own way into the fight is
  // asserted against hub.html, below.
  assert.doesNotMatch(APP, /renderTowerVault|TOWER_FLOORS|TOWER_ARTIFACTS|id="s-vault"|tw-door/);
  assert.doesNotMatch(APP, /GAME_TOP_FLOOR|function showWheel\(|function showWWR\(|function showHeal\(/, 'the shows were cleared out');
  assert.doesNotMatch(APP, /id="tw-climb-link"/, 'The Climb is not on the fight screen');
  assert.match(APP, /<div class="g2" id="g2">/, 'the fight is one screen of its own');
  assert.match(HUB, /<a class="card f" href="\/fight">[\s\S]{0,400}?<h2 class="name">The Fight<\/h2>/,
    'the shell opens the fight and calls it The Fight');
  assert.doesNotMatch(APP, /whole 2AM tower|all 90 floors|ninety floors/i);
});

test('the fight opens on its own, with nothing of the app around it', () => {
  // The page has to stand up by itself: its own state, its own save, its own
  // boot. Anything it used to borrow from the recovery app has to be here.
  assert.match(APP, /var FIGHT_KEY='tsid-fight-v1'/, 'it keeps its own state');
  assert.match(APP, /localStorage\.getItem\(FIGHT_KEY\)/, 'loaded from its own key');
  assert.match(APP, /localStorage\.setItem\(FIGHT_KEY,JSON\.stringify\(S\)\)/, 'and saved back to it');
  for (const shim of ['function save(){', 'function switchTo(){', 'function actBn(){', 'function appInfo(', 'function appConfirm(']) {
    assert.ok(APP.includes(shim), 'the page needs its own ' + shim);
  }
  assert.match(APP, /^renderTower\(\);$/m, 'and it boots itself');
  // Nothing about it reaches the network: there is no app to talk to.
  assert.doesNotMatch(APP, /\bfetch\(/, 'no page fetch');
});

test('the roof can never be left loading for good', () => {
  // Jacques, 20 Sep 2026: "the fight dont load to this next level" - the ring had
  // sat on LOADING THE ROOF. Eleven models are fetched, and they were counted in
  // one place and only on the way in: one model dropped on a phone line, or one
  // that loaded and then threw while it was being dressed, left the count short and
  // the screen up for good. Every load calls in now whether it arrives or not, a
  // throw while a body is dressed is caught instead of swallowed, and a deadline
  // opens the room with whatever did turn up.
  assert.match(FIGHT3D, /const KIT=11,ROOF_WAIT=\d+;/, 'the ring says what it waits for, and for how long');
  assert.match(FIGHT3D, /function ready\(\)\{if\(roofUp\)return;if\(\+\+loaded<KIT\)return;startRoof\(\);/,
    'ready() counts the models in and can only open the roof once');
  assert.match(FIGHT3D, /setTimeout\(\(\)=>\{if\(!roofUp\)\{console\.warn\('the roof is short '/,
    'a deadline opens the roof with however many arrived');
  assert.match(FIGHT3D, /\},ROOF_WAIT\);/, 'and the deadline is the one constant');
  // every model calls in on the way out, including the six in the crowd
  assert.match(FIGHT3D, /undefined,e=>\{console\.error\(e\);if\(cb\)cb\(\);\}\)/, 'a fighter that fails still calls in');
  assert.match(FIGHT3D, /const seated=\(\)=>\{if\(--left===0\)cb\(\);\};/, 'the crowd counts each seat in or out');
  assert.match(FIGHT3D, /undefined,e=>\{console\.error\(key,e\);seated\(\);\}\)/, 'a dropped body in the crowd still calls in');
  assert.match(FIGHT3D, /catch\(err\)\{console\.error\(key,err\);\}\}/, 'a throw while a cast member is dressed is caught');
  assert.match(FIGHT3D, /try\{const old=YOU;/, 'and the same around your fighter');
  // a body that never arrived is said out loud, and the bell will not ring on an empty ring
  assert.match(FIGHT3D, /if\(!YOU\|\|!BOSS\)\{\$\('v'\)\.innerHTML=/, 'the ring says so plainly instead of hanging');
  assert.match(FIGHT3D, /async function startFight\(\)\{if\(!fightOver\|\|!YOU\|\|!BOSS\|\|!REF\)return;/,
    'and the first bell needs both bodies and the referee');
  // and the page itself is small enough to arrive: the four place pictures used to
  // sit in it as base64, 650KB of the same bytes img/fight/ already holds, fetched
  // again by every phone that opened the roof.
  assert.doesNotMatch(FIGHT3D, /base64,/, 'the ring carries no inlined images');
  assert.match(FIGHT3D, /const PICS=\{temple:ART\+'temple\.jpg'/, 'the four places come from img/fight');
  for (const p of ['temple', 'tomb', 'monastery', 'rooftop']) {
    assert.ok(exists('img', 'fight', p + '.jpg'), 'the file the ring asks for is on disk: ' + p + '.jpg');
  }
});

test('five floors and a roof, and the ring counts them the same way as the app', () => {
  assert.strictEqual(GAME_FLOORS, 5, 'five floors to a building');
  assert.match(APP, /Math\.min\(GAME_FLOORS\+1,g\.f\|0\)/, 'the climb stops at the roof');
  assert.ok(APP.includes("gameFloorGo('+(GAME_FLOORS+1)+')"), 'the roof button opens the roof, whatever the floor count becomes');
  assert.match(APP, /grid-template-columns:repeat\(6,1fr\)/, 'five floors and the roof fit the bar');
  assert.match(FIGHT3D, /let floorN=Math\.max\(0,Math\.min\(5,\+/, 'the ring takes floors one to five');
  assert.match(FIGHT3D, /floorN=Math\.max\(0,Math\.min\(5,\+d\.floor\|\|0\)\)/, 'and the same when the app hands them in');
  assert.match(FIGHT3D, /function step\(\)\{return \(Math\.max\(1,building\)-1\)\*6\+\(floorN\|\|6\);\}/,
    'six fights a building, roof included - so the pace still tightens on the same schedule');
});
