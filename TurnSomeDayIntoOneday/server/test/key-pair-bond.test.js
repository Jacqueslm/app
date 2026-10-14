// The long bond, and the third thing — the two layers added to Pair on
// 14 Oct 2026, held here the same day.
//
// The Pair tab already read love, friendship, work and family out of the two
// periods' elements and qualities. The two new layers work differently and
// that is exactly why they need running rather than reading: the marriage room
// and the third thing both reach into the period's own deep tables (DEPTH and
// DESTINY) by name, and a name that is not there does not throw — it prints
// "undefined" into somebody's reading, or drops the whole section when
// pairThird returns its empty string. All 48 periods against all 48, 1,176 of
// them, or the gap is only found by the person it happens to.
//
// So the engine is run here, off the page's own tables, exactly as the daily is
// (key-daily.test.js). A copy of the tables in this file would agree with
// whatever mistake the page had made.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'key.html'), 'utf8');

/* --------------------------------------------------- the page's own tables */

// A literal out of the page, matched to its own closing bracket. key-daily's
// grabConst stops at the first `];` it finds, which is right for the arrays it
// takes there and wrong for DEPTH and DOMAINS — both hold `}` and `];` inside
// template literals and arrow bodies.
function literal(name){
  const head = `const ${name} = `;
  const at = PAGE.indexOf('\n' + head);
  assert.ok(at > -1, `const ${name} is not in key.html`);
  const text = PAGE.slice(at + 1 + head.length);
  const open = text[0], close = open === '[' ? ']' : '}';
  assert.ok(open === '[' || open === '{', `const ${name} does not start with a bracket`);
  let depth = 0;
  for(let i = 0; i < text.length; i++){
    if(text[i] === open) depth++;
    else if(text[i] === close){ depth--; if(!depth) return text.slice(0, i + 1); }
  }
  throw new Error(`const ${name} is not closed`);
}
function fnSource(name){
  const at = PAGE.indexOf(`\nfunction ${name}(`);
  assert.ok(at > -1, `function ${name} is not in key.html`);
  const open = PAGE.indexOf('{', at);
  let depth = 0;
  for(let i = open; i < PAGE.length; i++){
    if(PAGE[i] === '{') depth++;
    else if(PAGE[i] === '}'){ depth--; if(!depth) return PAGE.slice(at + 1, i + 1); }
  }
  throw new Error(`function ${name} is not closed`);
}
const oneLine = (re, what) => {
  const m = PAGE.match(re);
  assert.ok(m, `${what} is not in key.html`);
  return m[0];
};

const S = (() => {
  const ctx = { Math, JSON, String, Number, Array, Object, Set, console, Date };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  // The lore a person's *reading* needs is not needed here and is left empty on
  // purpose: if the pair engine ever starts reaching into it, it fails loudly
  // here instead of printing an undefined.
  vm.runInContext('var LORE={},PORTRAIT={},WELLBEING={},PLANET_LORE={};', ctx);
  for(const name of ['PERIODS','SIGNS','NUMBERS','TAROT','EL_REL','Q_REL',
                     'SIGN_BODY','BIRTHSTONE','DEPTH','DESTINY','BOND_FRAME','DOMAINS'])
    vm.runInContext(`var ${name} = ${literal(name)};`, ctx, { filename: name + '.js' });
  [
    [/const relKey = [^\n]*/, 'relKey'],
    [/const signsOf = [^\n]*/, 'signsOf'],
    [/const esc = [^\n]*/, 'esc'],
    [/const firstName = [^\n]*/, 'firstName'],
  ].forEach(([re, what]) => vm.runInContext(oneLine(re, what), ctx, { filename: what + '.js' }));
  for(const name of ['reduceNum','digitSum','tarotIndex','tarotFor','findPeriod',
                     'profileOf','pairContext','bondFrame','pairThird'])
    vm.runInContext(fnSource(name), ctx, { filename: name + '.js' });
  // One pairing, read the way the Pair tab reads it: the fifth room's own
  // function, and the third thing beside it.
  vm.runInContext(`
    function pairRead(moA, dA, moB, dB){
      const A = profileOf({ name: 'A', month: moA, day: dA, year: null });
      const B = profileOf({ name: 'B', month: moB, day: dB, year: null });
      const c = pairContext(A, B);
      const room = DOMAINS.filter(d => /Marriage/.test(d.t))[0];
      return { one: A.per.n, two: B.per.n, marriage: room.f(c), third: pairThird(A, B) };
    }`, ctx, { filename: 'pair-read.js' });
  return ctx;
})();

const run = (expr) => JSON.parse(JSON.stringify(vm.runInContext(expr, S)));
const PERIODS = run('PERIODS');
const DOMAINS = run('DOMAINS');
const BOND_FRAME = run('BOND_FRAME');
const EL_REL = run('EL_REL');
const DEPTH = run('DEPTH');
const DESTINY = run('DESTINY');

/* ----------------------------------------------------------------- the room */

test('the fifth room is on the list, once, and it is the marriage one', () => {
  assert.strictEqual(DOMAINS.length, 5, 'Pair reads five rooms');
  const marriage = DOMAINS.filter(d => /Marriage/.test(d.t));
  assert.strictEqual(marriage.length, 1, 'exactly one marriage room');
  assert.match(marriage[0].t, /long bond/, 'and it says which bond it means');
  const labels = DOMAINS.map(d => d.t);
  assert.strictEqual(new Set(labels).size, labels.length, 'no two rooms with the same heading');
  // The heading the reader is shown has to be the heading the copy promises.
  assert.match(PAGE, /<h4>Across the five rooms<\/h4>/, 'the pair legend says five');
  assert.ok(!/four rooms/.test(PAGE), 'and nothing still says four');
});

test('every mode the element table can produce has a frame of its own', () => {
  // EL_REL is keyed by the relation, not a list.
  const modes = [...new Set(Object.values(EL_REL).map(r => r.mode))].sort();
  assert.deepStrictEqual(modes, Object.keys(BOND_FRAME).sort(),
    'the frames and the element relations must be the same set, or a mode renders undefined');
  const said = new Set();
  for(const [mode, text] of Object.entries(BOND_FRAME)){
    assert.ok(typeof text === 'string' && text.length > 80, `${mode} is too thin to open a reading`);
    const key = text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    assert.ok(!said.has(key), `${mode} says what another mode says`);
    said.add(key);
  }
});

test('every period carries the two things the new layers read', () => {
  assert.strictEqual(Object.keys(DEPTH).length, 48, 'the deep layer holds all 48 periods');
  assert.strictEqual(Object.keys(DESTINY).length, 48, 'and so does the path table');
  const thin = [];
  for(const p of PERIODS){
    const d = DEPTH[p.n], y = DESTINY[p.n];
    if(!d || typeof d.bond !== 'string' || d.bond.trim().length < 40) thin.push(`${p.n} bond`);
    if(!y) thin.push(`${p.n} destiny`);
    else for(const f of ['toward','pitfall','release','reward'])
      if(typeof y[f] !== 'string' || !y[f].trim()) thin.push(`${p.n}.${f}`);
  }
  assert.deepStrictEqual(thin, [], `periods the pair engine would print blank or "undefined" for: ${thin.join(', ')}`);
});

/* ------------------------------------------------------------- the pairings */

// Every pairing the tab can be asked for. The heading on the page counts the
// 1,176 combinations (each pair once); both ways round are reachable from the
// two dropdowns and read differently, so both are run here — 2,304 readings.
const READS = [];
for(const a of PERIODS){
  for(const b of PERIODS){
    READS.push({ a: a.n, b: b.n, ...run(`pairRead(${a.sm}, ${a.sd}, ${b.sm}, ${b.sd})`) });
  }
}

test('the engine answers every pairing, and the period it answers for is the one it looked up', () => {
  assert.strictEqual(PERIODS.length, 48, '48 periods');
  assert.strictEqual(READS.length, 48 * 48, 'each against each, both ways round');
  const combinations = new Set(READS.map(r => [r.a, r.b].sort().join(' × ')));
  assert.strictEqual(combinations.size, 1176,
    'and that is the tab\'s own 1,176 combinations, not a different set of them');
  const wrong = READS.filter(r => r.one !== r.a || r.two !== r.b);
  assert.deepStrictEqual(wrong.slice(0, 3), [],
    'a period\'s first day must read back as that same period');
});

test('no pairing comes back blank, or with an undefined in it', () => {
  const bad = READS.filter(r =>
    !r.marriage || !r.marriage.trim() || !r.third || !r.third.trim() ||
    /undefined|NaN|\[object/.test(r.marriage + r.third));
  assert.deepStrictEqual(bad.slice(0, 5).map(r => `${r.a} × ${r.b}`), [],
    'these pairings would print a hole or an "undefined" on somebody\'s phone');
});

test('no two readings are the same one with the names swapped', () => {
  const seen = new Map();
  const same = [];
  for(const r of READS){
    const key = `${r.marriage}\u0000${r.third}`;
    if(seen.has(key)) same.push(`${r.a} × ${r.b} reads exactly as ${seen.get(key)}`);
    else seen.set(key, `${r.a} × ${r.b}`);
  }
  assert.deepStrictEqual(same, [], same.join('; '));
});

test('the two layers say different things about the same pairing', () => {
  // The room is about what a bond asks of each of them; the third thing is what
  // they make between them. If one ever starts restating the other, the Pair tab
  // is longer for no reason.
  const both = READS.filter(r => r.marriage.includes(r.third.slice(0, 120)));
  assert.deepStrictEqual(both.slice(0, 3).map(r => `${r.a} × ${r.b}`), [],
    'the third thing is repeating the marriage room');
});

/* ------------------------------------------------------------- the house rules */

test('the house rules hold on both layers, as printed', () => {
  for(const r of READS){
    const text = r.marriage + r.third;
    for(const banned of ['research','brain','chemical','study','proven','cure','diagnos'])
      assert.ok(!text.toLowerCase().includes(banned), `${r.a} × ${r.b} claims "${banned}"`);
    assert.doesNotMatch(text, /\b(she|her|hers|herself)\b/i,
      `${r.a} × ${r.b} writes about somebody as "she" — the sweep must hold`);
    assert.doesNotMatch(text, /\b(he|him|his)\b/i,
      `${r.a} × ${r.b} writes about somebody as "he"`);
    assert.ok(!/https?:\/\//.test(text), `${r.a} × ${r.b} sends the reader somewhere`);
  }
  // And it says out loud what it is, which is the rule the other layers keep.
  // It used to say so on one branch of the third thing and not the other, so
  // the 48 same-period pairings went without it; this is the line that noticed.
  const quiet = READS.filter(r => !r.third.includes('None of this is a prediction'));
  assert.deepStrictEqual(quiet.slice(0, 3).map(r => `${r.a} × ${r.b}`), [],
    'the third thing must say it is not a prediction, on every pairing');
});

test('the note on a single reading names the layers the Pair tab now keeps', () => {
  // Layer II is pointed at from the Read tab. When the tab gained marriage and
  // the third thing, that note stopped listing what Pair actually reads.
  assert.match(PAGE, /elemental and quality currents, love, marriage, friendship/,
    'the pointer must name marriage');
  assert.match(PAGE, /what the two of them make between them/,
    'and the third thing');
});
