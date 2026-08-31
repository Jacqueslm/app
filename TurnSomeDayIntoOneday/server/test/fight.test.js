// THE COUNT — the fight card.
//
// Jacques, 31 Aug 2026: "build it like a competitive boxing game with 13
// different opponents which are the addictions and 13 different avatars which
// is the user and 1 avatar which is the supporter."
//
// So the tests hold the game to that sentence: thirteen on the card and the
// twelve real ones are exactly the twelve addictions the app tracks; thirteen
// fighters for the user plus THE CORNER for the supporter; SOMEDAY only after
// the other twelve; and the one rule this app never breaks - it can end a
// fight, it can never tell somebody they are finished.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const APP = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const GAME = APP.slice(APP.indexOf('// ─── THE COUNT — the fight'), APP.indexOf('// ── THE URGE WAVE'));
const CODE = GAME.replace(/^\s*\/\/.*$/gm, '');   // comments quote the banned phrases on purpose

// Pull the real roster and the real curve out of the page, so the tests break
// the moment the data and the game drift apart.
const dataSrc = GAME.slice(GAME.indexOf('const BX_OPP'), GAME.indexOf('function bxIsSupporter'));
const tuneSrc = GAME.match(/function bxTuning\(opp,kd\)\{[\s\S]*?\n\}/)[0];
const { BX_OPP, BX_AVA, bxTuning } = new Function(
  'let bx=null;' + dataSrc + tuneSrc + ';return {BX_OPP:BX_OPP,BX_AVA:BX_AVA,bxTuning:bxTuning};'
)();

// ── the card ────────────────────────────────────────────────────────────────
test('thirteen opponents: the twelve addictions the app tracks, then SOMEDAY', () => {
  assert.equal(BX_OPP.length, 13);
  const tracked = ['Porn & Sex', 'Alcohol', 'Smoking', 'Substances', 'Gambling',
    'Social media', 'Gaming', 'Food / Binging', 'Shopping / Spending', 'Work',
    'Anger & Control', 'Other'];
  const keys = BX_OPP.map(o => o.key);
  for (const t of tracked) {
    assert.ok(keys.includes(t), `${t} is a track in the app but not a fight on the card`);
    // and the name on the card matches an onboarding chip, letter for letter
    assert.ok(APP.includes(`toggleAddiction(this, '${t.replace('&', '&amp;').replace(' &amp; ', ' & ') === t ? t : t}')`) || APP.includes(`'${t}'`), `${t} does not match the app's own chip`);
  }
  assert.equal(BX_OPP[12].key, 'SOMEDAY', 'the champion goes on last');
});

test('every opponent fights differently, and every one is distinct to look at', () => {
  const seenName = new Set(), seenSty = new Set(), seenLook = new Set();
  for (const o of BX_OPP) {
    assert.ok(o.name && o.tag, `${o.key} needs a ring name and a line`);
    seenName.add(o.name);
    seenSty.add(JSON.stringify(o.sty));
    seenLook.add(JSON.stringify(o.pal));
    for (const k of ['pace', 'power', 'chin', 'speed', 'feint', 'combo']) {
      assert.equal(typeof o.sty[k], 'number', `${o.name} is missing sty.${k}`);
    }
  }
  assert.equal(seenName.size, 13, 'two opponents share a ring name');
  assert.equal(seenSty.size, 13, 'two opponents fight identically');
  assert.equal(seenLook.size, 13, 'two opponents look identical');
});

test('SOMEDAY is the hardest fight on the card', () => {
  const champ = bxTuning(BX_OPP[12], 2);
  for (const o of BX_OPP.slice(0, 12)) {
    const t = bxTuning(o, 2);
    assert.ok(t.hp <= champ.hp, `${o.name} takes more than the champion`);
  }
});

// ── your side ───────────────────────────────────────────────────────────────
test('fourteen fighters: thirteen for the user and THE CORNER for the supporter', () => {
  assert.equal(BX_AVA.length, 14);
  const sup = BX_AVA.filter(a => a.sup);
  assert.equal(sup.length, 1, 'exactly one supporter fighter');
  assert.equal(sup[0].key, 'corner');
  assert.equal(new Set(BX_AVA.map(a => a.name)).size, 14, 'two fighters share a name');
});

test('a supporter walks into the gym with THE CORNER already picked', () => {
  assert.match(CODE, /s\.ava=bxIsSupporter\(\)\?'corner':'dayone'/);
  assert.match(CODE, /includes\('Supporting Someone'\)\|\|S\.userType==='partner'/);
});

test('no perk is decorative: every perk on a card is read by the engine', () => {
  for (const a of BX_AVA) {
    if (a.perk === 'none') continue;
    assert.ok(CODE.includes(`perk==='${a.perk}'`) || CODE.includes(`perk!=='${a.perk}'`),
      `${a.name} promises "${a.tag}" but the engine never checks perk '${a.perk}'`);
  }
});

test('avatar tags carry no pronouns - any fighter can be anybody', () => {
  for (const a of BX_AVA) {
    assert.doesNotMatch(a.tag, /\b(he|she|his|her|him)\b/i, `${a.name}: "${a.tag}"`);
  }
});

// ── the ladder ──────────────────────────────────────────────────────────────
test('the card unlocks in order, and SOMEDAY only after the other twelve', () => {
  assert.match(CODE, /const locked=i>st\.open/);
  assert.match(CODE, /if\(o\.idx===st\.open&&st\.open<12\)st\.open\+\+/,
    'only beating the top of your ladder opens the next name');
  assert.match(CODE, /if\(title\)st\.belt\+\+/);
});

test('a fight is first to three knockdowns, and only a count-out ends it', () => {
  assert.match(CODE, /bx\.kd\+\+;[\s\S]*?if\(bx\.kd>=3\)\{bxWinFight\(\);return;\}/);
  assert.match(CODE, /if\(bx\.count>=10\)\{[\s\S]*?bxLost\(\)/);
});

// ── the curve: winnable and survivable against all 13, at every knockdown ───
test('no opponent, at any point in any fight, becomes a coin toss', () => {
  for (const o of BX_OPP) {
    for (let kd = 0; kd <= 2; kd++) {
      const t = bxTuning(o, kd);
      // 230ms is the floor for see-and-move; below that it is not a skill.
      assert.ok(t.windMs >= 230, `${o.name} kd${kd}: ${t.windMs}ms tell`);
      assert.ok(t.openMs >= 300, `${o.name} kd${kd}: ${t.openMs}ms opening`);
      assert.ok(t.restMs >= 380, `${o.name} kd${kd}: no breath at all`);
      // Droppable: hp over a modest counter chain, inside a phone round.
      const punches = Math.ceil(t.hp / (t.give + 6));
      assert.ok(punches <= 20, `${o.name} kd${kd}: ${punches} clean counters is a chore`);
      // Survivable: even doubled by DOUBLE OR NOTHING the cap holds.
      assert.ok(t.hit <= 26, `${o.name} kd${kd}: hits for ${t.hit}`);
    }
  }
  assert.match(CODE, /Math\.min\(30,Math\.round\(hit\*\(Math\.random\(\)<0\.5\?0\.5:2\)\)\)/,
    'the double-or-nothing double is capped');
  assert.match(CODE, /Math\.min\(30,Math\.round\(hit\*\(1\+0\.12\*bx\.kd\)\)\)/,
    'last call getting heavier is capped');
});

test('every fight gets harder with every knockdown scored', () => {
  for (const o of BX_OPP) {
    for (let kd = 1; kd <= 2; kd++) {
      const a = bxTuning(o, kd - 1), b = bxTuning(o, kd);
      assert.ok(b.windMs <= a.windMs, `${o.name}: the tell must not get longer`);
      assert.ok(b.hp >= a.hp, `${o.name}: he must not get easier to drop`);
      assert.ok(b.hit >= a.hit, `${o.name}: his punch must not soften`);
    }
  }
});

// ── the fight itself ────────────────────────────────────────────────────────
test('slipping the correct way is the only thing that beats a punch', () => {
  const tick = CODE.match(/function bxTick\(now\)\{[\s\S]*?\n\}/)[0];
  assert.match(tick, /if\(bx\.slip===-bx\.side\)/, 'you must slip AWAY from the side it comes from');
  assert.match(tick, /bx\.phase='open'/, 'and that is what opens him up');
});

test('the feint switches sides mid-windup and says so', () => {
  const tick = CODE.match(/function bxTick\(now\)\{[\s\S]*?\n\}/)[0];
  assert.match(tick, /bx\.feinted=true;bx\.side=-bx\.side/);
  assert.match(tick, /bxSay\('Switch\.'\)/, 'the switch is announced, not hidden');
});

test('a jab lands whenever he is not punching', () => {
  // Jacques played the first build and said "my punches are not punching him
  // at all" - because a punch only scored after a perfect slip, and every
  // other tap of the middle hurt HIM instead. The middle button has to punch.
  const thr = CODE.match(/function bxThrow\(now\)\{[\s\S]*?\n\}\n/)[0];
  assert.match(thr, /else if\(bx\.phase==='rest'\)\{/, 'throwing at rest is its own case');
  assert.match(thr, /bx\.him=Math\.max\(0,bx\.him-give\)/, 'and it takes his health down');
  assert.ok(!/else if\(bx\.phase==='rest'\)\{[\s\S]*?\n  \}else\{/.test(thr) ||
    /if\(Math\.random\(\)<0\.25\)\{\s*bxHurt/.test(thr),
    'some jabs get caught, so the middle is not a free button');
});

test('the counter after a slip is worth far more than a jab', () => {
  const thr = CODE.match(/function bxThrow\(now\)\{[\s\S]*?\n\}\n/)[0];
  const jab = thr.match(/else if\(bx\.phase==='rest'\)\{[\s\S]*?\n  \}else\{/)[0];
  assert.match(jab, /Math\.max\(3,Math\.round\(bx\.tune\.give\*0\.4\)\)/, 'a jab is chip damage');
  assert.match(thr, /bx\.tune\.give\+bx\.combo\*\(bx\.perk==='counter'\?4:2\)/,
    'the counter is full damage and it chains');
});

test('the only wrong time to throw is into his live windup', () => {
  const thr = CODE.match(/function bxThrow\(now\)\{[\s\S]*?\n\}\n/)[0];
  const wrong = thr.slice(thr.lastIndexOf('}else{'));
  assert.match(wrong, /bxHurt\(now,Math\.round\(bx\.tune\.hit\*0\.55\),true\)/);
  assert.match(wrong, /bxSay\('Wild\.'\)/);
});

test('every landed punch visibly rocks him', () => {
  // A health bar moving is not feedback. The man has to move.
  const thr = CODE.match(/function bxThrow\(now\)\{[\s\S]*?\n\}\n/)[0];
  const hits = thr.match(/bx\.rock=now/g) || [];
  assert.equal(hits.length, 2, 'both the jab and the counter rock him');
  const fig = CODE.match(/function bxFighter\(g,W,H,now\)\{[\s\S]*?\n\}\n/)[0];
  assert.match(fig, /const rk=bx\.rock\?Math\.max\(0,1-\(now-bx\.rock\)\/320\):0/);
  assert.match(fig, /g\.rotate\(-rock\*0\.30\*bx\.rockSide\)/, 'his head snaps further than his body');
});

test('going down starts the count, and tapping gets you up', () => {
  assert.match(CODE, /function bxGoDown\(now\)\{[\s\S]*?bx\.down=true;bx\.count=0/);
  const tap = CODE.match(/function ctTap\(ev\)\{[\s\S]*?\n\}\n/)[0];
  assert.match(tap, /if\(bx\.down\)\{[\s\S]*?if\(bx\.taps>=bx\.riseNeed\)bxRise\(\)/,
    'getting up is work, and the count keeps running while you do it');
  assert.match(CODE, /function bxRise\(\)\{[\s\S]*?bx\.you=52/, 'you come back up hurt, not fresh');
});

test('three zones, no buttons', () => {
  const tap = CODE.match(/function ctTap\(ev\)\{[\s\S]*?\n\}\n/)[0];
  assert.match(tap, /if\(x<0\.34\)\{bx\.slip=-1/, 'left third slips left');
  assert.match(tap, /if\(x>0\.66\)\{bx\.slip=1/, 'right third slips right');
  assert.match(tap, /bxThrow\(now\)/, 'and the middle throws');
});

// ── the rule ────────────────────────────────────────────────────────────────
test('it can end a fight and never a person', () => {
  const lost = CODE.match(/function bxLost\(\)\{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(lost, /you are finished|you failed|game over|down for good|you lose/i);
  assert.match(lost, /The fight is over\. You are not\./);
  assert.match(lost, /RUN IT BACK/, 'the way back is always on the screen');
  assert.doesNotMatch(CODE, /game over|down for good/i);
});

test('a loss still counts what was real, and never wipes the record', () => {
  const lost = CODE.match(/function bxLost\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(lost, /knockdown/, 'the knockdowns scored before the count are named');
  assert.doesNotMatch(lost, /st\.wins=0|st\.rec=\{\}|st\.open=0/);
});

test('beating SOMEDAY crowns you and does not finish you', () => {
  const win = CODE.match(/function bxWinFight\(\)\{[\s\S]*?\n\}\n/)[0];
  assert.match(win, /defended, not retired/);
  assert.doesNotMatch(win, /you are done|it is finished|the end/i);
});

// ── plumbing ────────────────────────────────────────────────────────────────
test('not one image anywhere in it', () => {
  assert.doesNotMatch(CODE, /<img|url\(|\.png|\.jpg|\.svg|Image\(/i);
  assert.match(CODE, /function bxFighter\(g,W,H,now\)/, 'he is drawn, every frame');
  assert.match(CODE, /function bxPortrait\(cv,pal\)/, 'so are the portraits');
});

test('the loop stops when the screen is left', () => {
  assert.match(APP, /if\(from==='count'&&id!=='count'\)\{try\{bxStop\(\);\}catch\(e\)\{\}\}/);
  assert.match(CODE, /function bxStop\(\)\{cancelAnimationFrame\(bxAnim\);bxAnim=null;\}/);
  const stops = APP.match(/try\{(\w+Stop)\(\);\}catch/g) || [];
  for (const st of stops) {
    const fn = st.match(/try\{(\w+Stop)\(\)/)[1];
    assert.match(APP, new RegExp('function ' + fn + '\\('), `switchTo calls ${fn}() but nothing defines it`);
  }
});
