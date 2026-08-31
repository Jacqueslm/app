// THE COUNT — the fight.
//
// Jacques, 31 Aug 2026: "dont like it, make it an actually boxing game."
// The first pass was tapping words as they floated up; it read as a mood board.
// This is a slipping game, which is what boxing is at close range: he winds up
// on one side, you slip the other way, and then he is open.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const APP = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const GAME = APP.slice(APP.indexOf('// ─── THE COUNT — the fight'), APP.indexOf('// ── THE URGE WAVE'));
const CODE = GAME.replace(/^\s*\/\/.*$/gm, '');   // comments quote the banned phrases on purpose

// The curve as shipped.
const tune = (round) => {
  const r = round - 1;
  return {
    windMs: Math.max(260, 620 - r * 45),
    openMs: Math.max(340, 620 - r * 35),
    restMs: Math.max(420, 1100 - r * 80),
    hit: Math.min(22, 10 + r * 1.5),
    give: Math.max(9, 16 - r * 0.7),
    hp: Math.min(180, 100 + r * 14),
  };
};

test('round one gives you time to see the punch coming', () => {
  const t = tune(1);
  assert.equal(t.windMs, 620, 'over half a second of tell');
  assert.equal(t.openMs, 620, 'and a real window to counter into');
});

test('every round is harder, and none of it inverts', () => {
  for (let r = 2; r <= 40; r++) {
    const a = tune(r - 1), b = tune(r);
    assert.ok(b.windMs <= a.windMs, `round ${r}: the tell must not get longer`);
    assert.ok(b.openMs <= a.openMs, `round ${r}: the opening must not get wider`);
    assert.ok(b.hit >= a.hit, `round ${r}: his punch must not soften`);
    assert.ok(b.give <= a.give, `round ${r}: your counter must not get stronger`);
    assert.ok(b.hp >= a.hp, `round ${r}: he must not get easier to drop`);
  }
});

test('a round is always winnable and always survivable', () => {
  for (let r = 1; r <= 40; r++) {
    const t = tune(r);
    // The tell has to stay long enough for a human to react to. 250ms is about
    // the floor for see-and-move; below that it is a coin toss, not a skill.
    assert.ok(t.windMs >= 260, `round ${r}: ${t.windMs}ms is not a tell, it is a coin toss`);
    // There has to be a breath between punches, or there is no time to counter.
    assert.ok(t.restMs > t.windMs, `round ${r}: no rest between punches`);
    // And he has to be droppable inside a round: hp over the best counter.
    const punches = Math.ceil(t.hp / (t.give + 6));
    assert.ok(punches <= 20, `round ${r}: ${punches} clean counters to drop him is a chore`);
  }
});

test('slipping the correct way is the only thing that beats a punch', () => {
  const tick = CODE.match(/function bxTick\(now\)\{[\s\S]*?\n\}/)[0];
  assert.match(tick, /if\(bx\.slip===-bx\.side\)/, 'you must slip AWAY from the side it comes from');
  assert.match(tick, /bx\.phase='open'/, 'and that is what opens him up');
  assert.match(tick, /else\{\s*bxHurt/, 'anything else and it lands');
});

test('throwing when he is not open is punished', () => {
  const thr = CODE.match(/function bxThrow\(now\)\{[\s\S]*?\n\}\n/)[0];
  assert.match(thr, /if\(bx\.phase==='open'\)/);
  assert.match(thr, /else\{[\s\S]*?bxHurt\(now,Math\.round\(bx\.tune\.hit\*0\.55\)\)/,
    'swinging at nothing has to cost something, or the middle is a free button');
});

test('a counter chain is worth more than single shots', () => {
  const thr = CODE.match(/function bxThrow\(now\)\{[\s\S]*?\n\}\n/)[0];
  assert.match(thr, /bx\.combo\+\+/);
  assert.match(thr, /bx\.tune\.give\+bx\.combo\*2/, 'the reward for stringing them together');
});

test('going down starts the count, and tapping gets you up', () => {
  assert.match(CODE, /function bxGoDown\(now\)\{[\s\S]*?bx\.down=true;bx\.count=0/);
  const tap = CODE.match(/function ctTap\(ev\)\{[\s\S]*?\n\}\n/)[0];
  assert.match(tap, /if\(bx\.down\)\{[\s\S]*?if\(bx\.taps>=6\)bxRise\(\)/,
    'six taps - getting up is work, and the count keeps running while you do it');
  assert.match(CODE, /function bxRise\(\)\{[\s\S]*?bx\.you=52/, 'you come back up hurt, not fresh');
});

test('the count runs to ten and then the fight ends', () => {
  assert.match(CODE, /bx\.count=\(now-bx\.countAt\)\/1000;\n\s*if\(bx\.count>=10\)bxLost\(\)/);
});

test('it can end a fight and never a person', () => {
  // The one rule, same as The Climb and the tower before it.
  const lost = CODE.match(/function bxLost\(\)\{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(lost, /you are finished|you failed|game over|down for good|you lose/i);
  assert.match(lost, /The fight is over\. You are not\./);
  assert.match(lost, /AGAIN/, 'the way back is always on the screen');
  assert.doesNotMatch(CODE, /game over|down for good/i);
});

test('a loss never takes the record with it', () => {
  const lost = CODE.match(/function bxLost\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(lost, /if\(bx\.round-1>st\.best\)st\.best=bx\.round-1/, 'the rounds you did win still count');
  assert.doesNotMatch(lost, /st\.best=0|st\.wins=0/);
});

test('three zones, no buttons', () => {
  const tap = CODE.match(/function ctTap\(ev\)\{[\s\S]*?\n\}\n/)[0];
  assert.match(tap, /if\(x<0\.34\)\{bx\.slip=-1/, 'left third slips left');
  assert.match(tap, /if\(x>0\.66\)\{bx\.slip=1/, 'right third slips right');
  assert.match(tap, /bxThrow\(now\)/, 'and the middle throws');
});

test('not one image anywhere in it', () => {
  // Sprites would ship with the app, load on every open, and could not animate
  // per frame. A glove whose radius is a function of time can.
  assert.doesNotMatch(CODE, /<img|url\(|\.png|\.jpg|\.svg|Image\(/i);
  assert.match(CODE, /function bxFighter\(g,W,H,now\)/, 'he is drawn, every frame');
});

test('the loop stops when the screen is left', () => {
  // This was broken when the fight replaced the old game: switchTo still
  // called ctStop, which no longer existed, so the throw was swallowed by the
  // try/catch and the loop ran on forever behind whatever screen you moved to.
  assert.match(APP, /if\(from==='count'&&id!=='count'\)\{try\{bxStop\(\);\}catch\(e\)\{\}\}/);
  assert.match(CODE, /function bxStop\(\)\{cancelAnimationFrame\(bxAnim\);bxAnim=null;\}/);
  const stops = APP.match(/try\{(\w+Stop)\(\);\}catch/g) || [];
  for (const st of stops) {
    const fn = st.match(/try\{(\w+Stop)\(\)/)[1];
    assert.match(APP, new RegExp('function ' + fn + '\\('), `switchTo calls ${fn}() but nothing defines it`);
  }
});
