// THE COUNT — the ten-count as an arcade round.
//
// Jacques, 31 Aug 2026: the tower was boring. It was a mood with no game in
// it. This replaced it. The tests here guard the two things that matter: the
// difficulty actually curves, and the game can never tell somebody they are
// finished.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const APP = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const GAME = APP.slice(APP.indexOf('// ─── THE COUNT ───'), APP.indexOf('// ── THE URGE WAVE'));

// The curve as shipped.
const tune = (round) => {
  const r = round - 1;
  return {
    countMs: Math.max(6000, 10000 - r * 420),
    spawnMs: Math.max(520, 1350 - r * 70),
    travelMs: Math.max(1700, 3300 - r * 110),
    needed: Math.min(8, 4 + Math.floor(r / 3)),
  };
};

test('round one is ten seconds and four thoughts', () => {
  const t = tune(1);
  assert.equal(t.countMs, 10000);
  assert.equal(t.needed, 4);
});

test('every round is harder than the one before, until it plateaus', () => {
  for (let r = 2; r <= 30; r++) {
    const a = tune(r - 1), b = tune(r);
    assert.ok(b.countMs <= a.countMs, `round ${r} must not give more time`);
    assert.ok(b.spawnMs <= a.spawnMs, `round ${r} must not spawn slower`);
    assert.ok(b.travelMs <= a.travelMs, `round ${r} must not travel slower`);
    assert.ok(b.needed >= a.needed, `round ${r} must not ask for less`);
  }
});

test('it never becomes impossible', () => {
  // A thought is tappable from the moment it spawns, so what has to be true is
  // that enough of them START inside the count - not that they land. Spawning
  // carries up to 25% jitter, so the worst case is what gets checked.
  for (let r = 1; r <= 60; r++) {
    const t = tune(r);
    const slowest = t.spawnMs * 1.25;
    const canSpawn = Math.floor((t.countMs - 400) / slowest) + 1;
    assert.ok(canSpawn >= t.needed,
      `round ${r}: needs ${t.needed}, at worst only ${canSpawn} appear in time`);
  }
  const far = tune(200);
  assert.equal(far.countMs, 6000, 'the clock floors');
  assert.equal(far.needed, 8, 'and so does the ask');
});

test('missing compounds, which is the honest part', () => {
  assert.match(GAME, /ct\.piled\+\+/, 'a landed thought is counted');
  assert.match(GAME, /base\+ct\.piled\*0\.42/, 'and pushes the count forward');
  assert.match(GAME, /ct\.up=Math\.max\(0,ct\.up-0\.6\)/, 'and knocks you back down');
});

test('the game can never tell anybody they are finished', () => {
  // The one rule. Read by people at their worst, on the night they slipped.
  const lost = GAME.match(/function ctLost\(\)\{[\s\S]*?\n\}/)[0]
    .replace(/^\s*\/\/.*$/gm, '');   // the comment above it quotes the banned phrase
  assert.doesNotMatch(lost, /down for good|you failed|game over|you lose/i);
  assert.match(lost, /It does not get to keep you/);
  assert.match(lost, /RISE AGAIN/, 'the way back is always on the screen');
  const code = GAME.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /down for good/i, 'the phrase may appear in a warning comment, never in code');
});

test('a best score survives a loss', () => {
  const won = GAME.match(/function ctWon\(now\)\{[\s\S]*?\n\}/)[0];
  assert.match(won, /if\(ct\.roundsThisRun>st\.best\)st\.best=ct\.roundsThisRun/);
  const lost = GAME.match(/function ctLost\(\)\{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(lost, /st\.best=0|rounds=0/, 'losing must not wipe anything');
});

test('the rise is written once, not twice', () => {
  // Both the drawing and the hit test have to agree about where a moving
  // target is. Two copies of that formula only ever drift apart.
  assert.match(GAME, /function ctThoughtY\(th,now,t\)\{[\s\S]*?return 1\.03-/);
  assert.match(GAME, /const ty=ctThoughtY\(th,now,t\);/, 'the tap uses it');
  assert.match(GAME, /const y=ctThoughtY\(th,now,t\)\*H;/, 'and so does the drawing');
  const stray = (GAME.match(/1-p\*0\.92/g) || []);
  assert.deepEqual(stray, [], 'no hand-written copy of the rise is left');
});

test('a thought can never be drawn where it cannot be tapped', () => {
  // It spawned with its centre near the edge, drew half off-screen, and still
  // landed on you. One x, shared by the drawing and the hit test.
  assert.match(GAME, /function ctThoughtX\(th,W,g\)\{[\s\S]*?Math\.min\(1-half,Math\.max\(half,th\.x\)\)/);
  assert.match(GAME, /const x=ctThoughtX\(th,W,g\)\*W;/, 'the drawing uses it');
  assert.match(GAME, /Math\.abs\(x-ctThoughtX\(th,r\.width,g\)\)/, 'and so does the tap');
});

test('ending a round mid-frame does not repaint over the screen it just drew', () => {
  assert.match(GAME, /if\(ct\.state==='down'\)return;\n\s*ctDraw\(now\);/);
});

test('the loop stops when the screen is left', () => {
  assert.match(APP, /if\(from==='count'&&id!=='count'\)\{try\{ctStop\(\);\}catch\(e\)\{\}\}/);
  assert.match(GAME, /function ctStop\(\)\{\n\s*cancelAnimationFrame\(ctAnim\);ctAnim=null;\n\}/);
});

test('the thoughts are real relapse thinking, not filler', () => {
  const lines = GAME.match(/const CT_LINES=\[([\s\S]*?)\];/)[1];
  // Counting quotes is wrong here: half these lines contain an escaped one.
  const n = (lines.match(/,/g) || []).length;
  assert.ok(n >= 20, `only ${n} thoughts - they repeat too fast`);
  assert.match(lines, /one won\\?'t hurt/);
  assert.match(lines, /you already blew it/);
});

test('the Game tab opens this, and the tower is still reachable', () => {
  assert.match(APP, /id="bn-game" onclick="switchTo\('count'\);actBn\('bn-game'\)/);
  assert.match(APP, /onclick="openTower\(\)"/, 'the tower keeps its door in Tools until Jacques picks');
});
