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
function literal2(name) {
  const m = APP.match(new RegExp('const ' + name + '=(\\{[\\s\\S]*?\\n\\};)'));
  assert.ok(m, name + ' not found in index.html');
  return new Function('return ' + m[1].replace(/;$/, ''))();
}

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
  // It has to sit inside the same guard that banks the ended streak, and that
  // guard measures the clock being reset - not the master, which since 30 Aug
  // is the longest run and often does not move when a short track slips.
  const i = APP.indexOf('towerOnRelapse();');
  const guard = APP.lastIndexOf('if(prevStart&&chosen.getTime()>new Date(prevStart).getTime())', i);
  assert.ok(guard > 0 && i - guard < 900, 'towerOnRelapse is not inside the real-relapse guard');
  assert.match(APP, /const prevStart=guardIso;/, 'measured against the track that was reset');
});

test('the tower can never be climbed higher than the real days behind it', () => {
  assert.equal(ceiling(0), 1, 'day zero still gets floor one');
  assert.equal(ceiling(3), 3);
  assert.equal(ceiling(9), 9);
  assert.equal(ceiling(40), 10, 'phase 1 stops at ten however many days are banked');
  assert.match(APP, /function towerCeiling\(\)\{[\s\S]*?climbSteps\(\)/,
    'the ceiling must read The Climb, which only moves on a real day');
});

test('every floor is its own place, not the same map ten times', () => {
  // Jacques, 30 Aug 2026, on the Roblox reference: "floor 3 doesn't look or
  // play like floor 7." So no two floors may share a layout, and every floor
  // carries its own palette and its own air.
  const shapes = FLOORS.map((f) => JSON.stringify([f.rooms, f.edges]));
  assert.equal(new Set(shapes).size, 10, 'two floors have identical maps');
  const airs = FLOORS.map((f) => f.air);
  assert.ok(new Set(airs).size >= 5, 'the floors should not all breathe the same');
  for (const f of FLOORS) {
    for (const k of ['bg', 'room', 'roomOn', 'stroke', 'strokeOn', 'line', 'label']) {
      assert.match(f.pal[k], /^#[0-9a-f]{6}$/i, `floor ${f.n} palette ${k}`);
    }
  }
  assert.ok(new Set(FLOORS.map((f) => f.pal.bg)).size >= 8, 'the floors look too alike');
});

// The rules are a fixed set implemented once and reused. A floor inventing its
// own is how this becomes ten games instead of one.
const RULES = ['none', 'dark', 'dim', 'echo', 'oneway', 'sequence', 'slow'];
const AIRS = ['grain', 'grid', 'dust', 'glow', 'flicker', 'window'];
test('every floor rule comes from the shared set', () => {
  for (const f of FLOORS) {
    assert.ok(RULES.includes(f.rule), `floor ${f.n} rule "${f.rule}" is not implemented`);
    assert.ok(AIRS.includes(f.air), `floor ${f.n} air "${f.air}" is not implemented`);
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    if (f.rule !== 'none') assert.ok(src.includes(`'${f.rule}'`), `${f.rule} is declared but never used`);
  }
  assert.ok(new Set(FLOORS.map((f) => f.rule)).size >= 5, 'the floors should not all play the same');
});

test('a rule can never seal a floor: the door and the stairs stay reachable', () => {
  for (const f of FLOORS) {
    // Walk it the way a player has to, respecting one-way corridors and the
    // rooms the door insists on first.
    const need = f.doorNeeds || [];
    const oneway = f.oneway || [];
    const canGo = (from, to, visited) => {
      if (!f.edges.some(([a, b]) => (a === from && b === to) || (a === to && b === from))) return false;
      if (oneway.some(([a, b]) => a === to && b === from)) return false;
      if (to === 'door' && need.some((k) => !visited.has(k))) return false;
      return true;
    };
    // Breadth-first over (room, set of rooms seen) - small enough to brute force.
    const seen = new Set();
    const queue = [['entry', new Set(['entry'])]];
    let reachedDoor = false;
    while (queue.length) {
      const [at, vis] = queue.shift();
      const key = at + '|' + [...vis].sort().join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      if (at === 'door') reachedDoor = true;
      for (const to of Object.keys(f.rooms)) {
        if (to === at || to === 'stairs') continue;
        if (!canGo(at, to, vis)) continue;
        const nv = new Set(vis); nv.add(to);
        queue.push([to, nv]);
      }
    }
    assert.ok(reachedDoor, `floor ${f.n}: the door cannot be reached at all`);
    assert.ok(f.edges.some(([a, b]) => (a === 'door' && b === 'stairs') || (a === 'stairs' && b === 'door')),
      `floor ${f.n}: the stairs must hang off the door, so the door is the only way up`);
  }
});

test('one-way corridors and door conditions point at rooms that exist', () => {
  for (const f of FLOORS) {
    for (const [a, b] of f.oneway || []) {
      assert.ok(f.rooms[a] && f.rooms[b], `floor ${f.n} oneway names a missing room`);
      assert.ok(f.edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a)),
        `floor ${f.n} oneway is not on a corridor that exists`);
    }
    for (const k of f.doorNeeds || []) {
      assert.ok(f.rooms[k], `floor ${f.n} doorNeeds names a missing room`);
      assert.ok(k !== 'door' && k !== 'stairs', `floor ${f.n} doorNeeds must name a side room`);
    }
  }
});

test('a rule the player cannot see is a bug, so a refused room says why', () => {
  assert.match(APP, /function towerRefused\(n,hit\)\{[\s\S]*?towerDoorBlocked[\s\S]*?oneway/,
    'both blocking rules must explain themselves');
});

test('rooms sit inside the stage', () => {
  for (const f of FLOORS) {
    for (const [k, r] of Object.entries(f.rooms)) {
      assert.ok(r[0] > 0.1 && r[0] < 0.9, `floor ${f.n} ${k} x`);
      assert.ok(r[1] > 0.1 && r[1] < 0.9, `floor ${f.n} ${k} y`);
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
  assert.match(APP, /function towerStop\(\)\{cancelAnimationFrame\(twAnim\);[\s\S]*?towerCloseDoor\(\);towerWaveStop\(\);towerBriefStop\(\);towerBoardStop\(\);\}/,
    'the wave (a rAF loop, an interval and a stack of timeouts), the voice, the board');
});

// ── THE URGE WAVE (Phase 2) ─────────────────────────────────────────────────
// The whole mechanic rests on one thing: nothing the player does moves the
// clock. Every test here exists to stop someone "improving" that later.
const WAVE = APP.slice(APP.indexOf('// ── THE URGE WAVE'), APP.indexOf('function towerOpenDoor()'));

test('the wave runs ninety seconds, as specced', () => {
  assert.match(APP, /const TOWER_WAVE_SECONDS=90;/);
  assert.match(APP, /const TOWER_WAVE_MIN=3,TOWER_WAVE_MAX=7;/, 'three to seven pulses');
});

test('the wave is on about one floor in four, and always on floors ending in zero', () => {
  const declared = FLOORS.filter((f) => f.wave).map((f) => f.n);
  const has = (n) => n % 10 === 0 || declared.includes(n);
  const on = FLOORS.map((f) => f.n).filter(has);
  assert.ok(on.includes(10), 'floor ten ends in zero, so it always has one');
  assert.ok(on.length >= 2 && on.length <= 4, `~1 in 4 of ten floors, got ${on.length}`);
  assert.match(APP, /function towerFloorHasWave\(n\)\{return n%10===0\|\|!!towerFloor\(n\)\.wave;\}/);
});

test('the clock is read from the start time and nothing else', () => {
  const left = WAVE.match(/function towerWaveLeft\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(left, /TOWER_WAVE_SECONDS-Math\.floor\(\(Date\.now\(\)-twWave\.started\)/);
  // Nothing anywhere may push the finish line around. It is stamped once, in
  // the object the wave is built from, and never assigned again after that.
  assert.match(WAVE, /started:Date\.now\(\)/, 'stamped when the wave begins');
  const writes = WAVE.match(/twWave\.started\s*=[^=]/g) || [];
  assert.equal(writes.length, 0, 'twWave.started must never be reassigned');
});

test('winning a round buys a longer pattern and not one second', () => {
  const tap = WAVE.match(/function towerWaveTap\(i\)\{[\s\S]*?\n\}\n/)[0];
  const won = tap.slice(tap.indexOf('twWave.at>=twWave.seq.length'), tap.indexOf('// Wrong'));
  assert.match(won, /twWave\.len=Math\.min\(TOWER_WAVE_MAX,twWave\.len\+1\)/);
  assert.doesNotMatch(won, /started|TOWER_WAVE_SECONDS|towerWaveBreak/,
    'a good round must never shorten the wave or end it early');
});

test('getting it wrong restarts the sequence and ends nothing', () => {
  const tap = WAVE.match(/function towerWaveTap\(i\)\{[\s\S]*?\n\}\n/)[0];
  const wrong = tap.slice(tap.indexOf('// Wrong'));
  assert.match(wrong, /twWave\.len=TOWER_WAVE_MIN/, 'the sequence starts again');
  assert.match(wrong, /towerWaveNext\(/, 'and it keeps going');
  assert.doesNotMatch(wrong, /towerWaveBreak|towerWaveStop|started/,
    'failing must not end the wave, and must not extend it either');
});

test('the wave counts as survived only when it breaks on its own', () => {
  const brk = WAVE.match(/function towerWaveBreak\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(brk, /t\.waves\[n\]=true;save\(\)/);
  const stop = WAVE.match(/function towerWaveStop\(\)\{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(stop, /waves\[/, 'walking away mid-wave must not bank it');
});

test('the wave stands between the player and the door, once', () => {
  const open = APP.match(/function towerOpenDoor\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(open, /towerFloorHasWave\(n\)&&!towerWaveSurvived\(n\)&&!towerCleared\(n\)/);
  assert.match(open, /towerStartWave\(n\);return;/, 'the door does not open behind it');
});

test('the whole curve is drawn from the first second, end included', () => {
  // Being able to see that it stops is the point; a bar that only fills in
  // behind you would hide exactly the thing the mechanic is teaching.
  const draw = WAVE.match(/function towerWaveDraw\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(draw, /for\(let i=0;i<=W;i\+=2\)/, 'the faint pass covers the full width');
});

// ── THE SPOKEN BRIEFING (Phase 2) ───────────────────────────────────────────
test('the briefing is read in the voice the member already chose', () => {
  const src = APP.match(/function towerBriefUrl\(n\)\{[\s\S]*?\n\}/)[0];
  assert.match(src, /lessonVoiceKey\(\)/, 'no second voice picker for the game');
  assert.match(src, /'tower\/'\+v\+'\/floor-'\+String\(n\)\.padStart\(2,'0'\)\+'\.mp3'/);
  assert.match(src, /LESSON_AUDIO_MANIFEST[\s\S]*?STORY_AUDIO_BASE/, 'same base as the lessons');
});

test('the six recorded voices are the six the app offers', () => {
  const gen = fs.readFileSync(path.join(ROOT, 'tools', 'generate-tower-audio.py'), 'utf8');
  const recorded = [...gen.matchAll(/^    '(\w+)':\s+\('vits-piper/gm)].map((m) => m[1]);
  const offered = APP.match(/const VG_VOICE_ORDER=\[([^\]]+)\]/)[1].replace(/'/g, '').split(',');
  assert.deepEqual(recorded.slice().sort(), offered.slice().sort());
});

test('a recording that will not load never interrupts the floor', () => {
  // The two lines are already on the screen. A missing mp3 is silent.
  const src = APP.match(/function towerBriefPlay\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(src, /a\.onerror=\(\)=>\{[^}]*towerBriefBtn\('gone'\)/);
  assert.doesNotMatch(src, /appInfo|alert\(|confirm\(/, 'no dialog on a failed briefing');
  assert.match(src, /pr\.catch/, 'a blocked autoplay must not throw either');
});

test('the briefing is generated from the same twenty lines the screen shows', () => {
  const gen = fs.readFileSync(path.join(ROOT, 'tools', 'generate-tower-audio.py'), 'utf8');
  assert.match(gen, /TOWER_FLOORS/, 'the generator reads index.html, it does not keep a copy');
  assert.doesNotMatch(gen, /Floor one\. It is dark/, 'the briefing text must not be duplicated here');
});

test('the voice stops when anything else takes the screen', () => {
  for (const fn of ['towerStartWave', 'towerOpenDoor']) {
    const src = APP.match(new RegExp('function ' + fn + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'))[0];
    assert.match(src, /towerBriefStop\(\)/, fn + ' must silence the briefing');
  }
  assert.match(APP, /towerBriefStop\(\);\n  if\(t\.readBriefs\)towerBriefPlay\(\);/,
    'and a new floor replaces it rather than talking over it');
});

// ── ARTIFACTS, THE VAULT AND THE TRIGGER BOARD (Phase 3) ────────────────────
const ART = literal2('TOWER_ARTIFACTS');
const COPING = literal('TOWER_COPING');

test('every artifact sits in a side room that actually exists', () => {
  for (const key of Object.keys(ART)) {
    const [n, room] = key.split(':');
    const f = FLOORS.find((x) => x.n === Number(n));
    assert.ok(f, `artifact ${key} is on a floor that does not exist`);
    assert.ok(f.rooms[room], `artifact ${key} is in a room that does not exist`);
    assert.ok(f.sides[room], `artifact ${key} must be in an optional room, not the door or the stairs`);
  }
});

test('the artifacts are the three kinds the spec names, and they are written', () => {
  const kinds = new Set();
  for (const [key, a] of Object.entries(ART)) {
    assert.ok(['LESSON', 'STORY', 'LETTER'].includes(a.kind), `${key} kind`);
    kinds.add(a.kind);
    assert.ok(a.title && a.title.length > 3, `${key} title`);
    assert.ok(a.text.length > 200, `${key} is too short to be worth finding`);
  }
  assert.deepEqual([...kinds].sort(), ['LESSON', 'LETTER', 'STORY']);
  assert.ok(Object.keys(ART).length >= 12, 'most side rooms should hold something');
});

test('no artifact makes a medical claim or takes a side', () => {
  const banned = /\b(brain|dopamine|neuro\w*|receptor|research shows|studies show|clinically|fault|blame|make them|get them to)\b/i;
  for (const [key, a] of Object.entries(ART)) assert.doesNotMatch(a.title + ' ' + a.text, banned, key);
});

test('walking into the room is all it takes, and it is kept once', () => {
  const src = APP.match(/function towerCollect\(n,room\)\{[\s\S]*?\n\}/)[0];
  assert.match(src, /if\(!t\.kept\[key\]\)/, 'collecting twice must not re-log or re-stamp it');
  assert.match(APP, /towerCollect\(t\.floor,t\.room\);/, 'the room you are standing in counts');
  assert.match(APP, /towerCollect\(n,hit\);/, 'and so does the one you walk into');
});

test('the vault lists the whole building, gaps included', () => {
  const src = APP.match(/function renderTowerVault\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(src, /Object\.keys\(TOWER_ARTIFACTS\)\.map/, 'every artifact, not only the found ones');
  assert.match(src, /vault-card locked/, 'the ones still out there show as gaps');
  assert.doesNotMatch(src, /a\.text[\s\S]{0,80}locked/, 'a locked card must never leak its text');
});

// The board is the only place in 2AM that can be lost, so it gets the most care.
test('the board is a landing-floor thing only', () => {
  assert.match(APP, /function towerFloorIsLanding\(n\)\{return n%10===0;\}/);
  const panel = APP.match(/function towerPanel\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(panel, /towerFloorIsLanding\(n\)&&!towerLanded\(n\)/);
});

test('eight moves on the first landing, tightening as the tower rises, never below four', () => {
  const moves = (n) => Math.max(4, 8 - Math.floor((n - 10) / 10));
  assert.equal(moves(10), 8);
  assert.equal(moves(20), 7);
  assert.equal(moves(50), 4);
  assert.equal(moves(90), 4, 'it must not fall to nothing at the top of the tower');
  assert.match(APP, /function towerBoardMoves\(n\)\{return Math\.max\(4,8-Math\.floor\(\(n-10\)\/10\)\);\}/);
});

test('every coping tile answers real triggers, and every trigger has an answer', () => {
  const src = APP.match(/const TOWER_TRIGGERS=\{[\s\S]*?\};/)[0];
  const triggers = [...src.matchAll(/(\w+):'/g)].map((m) => m[1]);
  const answered = new Set();
  for (const c of COPING) {
    assert.ok(c.clears.length >= 1, `${c.k} clears nothing`);
    for (const t of c.clears) {
      assert.ok(triggers.includes(t), `${c.k} clears "${t}", which is not a trigger`);
      answered.add(t);
    }
  }
  for (const t of triggers) assert.ok(answered.has(t), `nothing answers "${t}" - the board would be unwinnable`);
});

test('a board is built backwards from a solution, so it can never be unsolvable', () => {
  const src = APP.match(/function towerBoardBuild\(moves\)\{[\s\S]*?\n\}/)[0];
  assert.match(src, /const wanted=Math\.max\(3,moves-1\);/, 'a winning run always fits inside the moves allowed');
  assert.match(src, /!isSpot\(j\)/, 'and a trigger never lands on a square that run needs');
});

test('running out of moves is a retry, not a loss', () => {
  const src = APP.match(/function towerBoardRender\(\)\{[\s\S]*?\n\}/)[0];
  const out = src.slice(src.indexOf('twBoard.left<=0&&left>0'));
  assert.match(out, /towerStartBoard\(\)/, 'a fresh board');
  assert.doesNotMatch(out, /cleared\[|landings\[|floor=|nerve/, 'nothing is taken back');
});
