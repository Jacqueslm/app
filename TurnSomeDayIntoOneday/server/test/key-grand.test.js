// The Grand Cycle — the last section of the frame the page did not carry.
//
// The page already had the day, the 48 periods, the twelve signs, the four
// seasons, the four elements and the three qualities. What it had no version of
// was the widest reading in the system: the year laid over a life — four seasons
// of twenty-one years, two halves, and the twelve signs taking seven years each.
// Added 14 Oct 2026, with the writing done for this app rather than taken from
// any book.
//
// The failure this guards is the arithmetic kind. An age band that overlaps the
// next one, or leaves a year out, or drifts from the band the sign page prints,
// still reads as authoritative — and nothing else in the suite would notice.
// It also holds the house rules over the new copy and keeps the widest screen
// reachable from the Learn menu, so it cannot be orphaned by a later edit.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'key.html'), 'utf8');

// The length of the life the whole section is built on, read out of the page
// rather than written down here. The two tables below end on it by name, so it
// has to be in scope when they are read.
const LIFE = +PAGE.match(/const GRAND_LIFE = (\d+)/)[1];

// The three tables, read out of the page as data so the tests below are about
// the numbers rather than about a copy of them kept in here.
function sliceAfter(marker){
  const at = PAGE.indexOf(marker);
  assert.ok(at >= 0, `${marker} is gone`);
  const end = PAGE.indexOf('\n];', at);
  assert.ok(end > at, `${marker} is not closed`);
  return PAGE.slice(PAGE.indexOf('[', at), end + 2);
}
const GRAND_SRC  = sliceAfter('const GRAND = [');
const HALVES_SRC = sliceAfter('const GRAND_HALVES = [');
const BANDS_SRC  = sliceAfter('const GRAND_BANDS = [');
// The two ends of the life are written as GRAND_LIFE in the page, so it has to
// be in scope to read them back.
const GRAND  = new Function('GRAND_LIFE', `return ${GRAND_SRC}`)(LIFE);
const HALVES = new Function('GRAND_LIFE', `return ${HALVES_SRC}`)(LIFE);
const BANDS  = new Function('GRAND_LIFE', `return ${BANDS_SRC}`)(LIFE);

// A function out of the page, matched to its own closing brace.
function fnSource(name){
  const at = PAGE.indexOf(`function ${name}(`);
  assert.ok(at > -1, `function ${name} is gone`);
  let depth = 0;
  for(let i = PAGE.indexOf('{', at); i < PAGE.length; i++){
    if(PAGE[i] === '{') depth++;
    else if(PAGE[i] === '}'){ depth--; if(!depth) return PAGE.slice(at, i + 1); }
  }
  throw new Error(`function ${name} is not closed`);
}

// An object literal out of the page, matched to its own closing brace.
function objectAfter(marker){
  const at = PAGE.indexOf(marker);
  assert.ok(at >= 0, `${marker} is gone`);
  const open = PAGE.indexOf('{', at);
  let depth = 0;
  for(let i = open; i < PAGE.length; i++){
    if(PAGE[i] === '{') depth++;
    else if(PAGE[i] === '}'){ depth--; if(!depth) return PAGE.slice(open, i + 1); }
  }
  throw new Error(`${marker} is not closed`);
}

// The whole screen, for the house-rule checks: the tables and the function that
// prints them.
const DATA  = PAGE.slice(PAGE.indexOf('const GRAND_LIFE'), PAGE.indexOf('const ELEMENT_LORE'));
const RENDER = PAGE.slice(PAGE.indexOf('function learnGrand('), PAGE.indexOf('\n}', PAGE.indexOf('function learnGrand(')));
const COPY = `${DATA}\n${RENDER}`;

// The twelve in the order the year holds them. Both tables have to agree with
// it, or the wheel and the life are two different wheels.
const WHEEL = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
               'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

test('the widest screen is in the Learn menu, and it opens', () => {
  assert.match(PAGE, /class="mbtn" id="g-grand">/, 'the Learn menu must offer it');
  assert.match(PAGE, /The Grand Cycle/, 'and name it');
  assert.match(PAGE, /if\(t\.id === 'g-grand'\)\s*\{ LEARN = 'grand'/, 'the button must set the screen');
  assert.match(PAGE, /if\(LEARN === 'grand'\)\s*\{ box\.innerHTML = learnGrand\(\)/, 'and renderGame must draw it');
  assert.match(RENDER, /id="g-back"/, 'the screen needs the same way back as its four neighbours');
  // The Learn tab is the panel the voice mounts a bar on, so a screen inside it
  // is readable aloud without a second bar.
  assert.match(PAGE, /data-panel="panel-game"/, 'the screen lives on the Learn tab');
});

test('the four seasons cover the whole life, in order, with no gap', () => {
  assert.strictEqual(GRAND.length, 4, 'four seasons');
  assert.deepStrictEqual(GRAND.map(q => q.season), ['Spring','Summer','Autumn','Winter'],
    'and in the order the year runs them');
  assert.strictEqual(GRAND[0].from, 0, 'spring starts at birth');
  for(let i = 1; i < GRAND.length; i++){
    assert.strictEqual(GRAND[i].from, GRAND[i - 1].to,
      `${GRAND[i].season} must start where ${GRAND[i - 1].season} ends`);
  }
  assert.strictEqual(GRAND[3].to, LIFE, `winter must end the life, at ${LIFE}`);
  for(const q of GRAND){
    assert.strictEqual(q.to - q.from, LIFE / 4, `${q.season} is one quarter of the life`);
  }
  assert.deepStrictEqual(GRAND.flatMap(q => q.signs), WHEEL,
    'the three signs of each season, in the wheel\'s own order');
});

test('the twelve bands are seven years each and tile the same life', () => {
  assert.strictEqual(BANDS.length, 12, 'twelve bands');
  assert.deepStrictEqual(BANDS.map(b => b.sign), WHEEL, 'in the wheel\'s own order');
  assert.strictEqual(BANDS[0].from, 0, 'the first band starts at birth');
  for(let i = 1; i < BANDS.length; i++){
    assert.strictEqual(BANDS[i].from, BANDS[i - 1].to,
      `${BANDS[i].sign} must start where ${BANDS[i - 1].sign} ends`);
  }
  for(const b of BANDS){
    assert.strictEqual(b.to - b.from, 7, `${b.sign} is seven years`);
  }
  assert.strictEqual(BANDS[11].to, LIFE, `the last band must end the life, at ${LIFE}`);
});

test('every band sits inside the season that holds its sign', () => {
  for(const b of BANDS){
    const q = GRAND.find(x => x.signs.includes(b.sign));
    assert.ok(q, `${b.sign} belongs to no season`);
    assert.ok(b.from >= q.from && b.to <= q.to,
      `${b.sign} (${b.from}–${b.to}) runs outside ${q.season} (${q.from}–${q.to})`);
  }
  // The sign page prints the band rather than its own copy of the numbers, so
  // the two can only ever agree.
  assert.match(PAGE, /const band = grandBand\(name\)/, 'the sign page must look the band up');
  assert.match(PAGE, /In the Grand Cycle:<\/strong> \$\{nm\} is the seven years/,
    'and say which seven years they are');
});

test('the two halves split the life exactly once', () => {
  assert.strictEqual(HALVES.length, 2, 'there are two halves');
  assert.strictEqual(HALVES[0].to, LIFE / 2, `the outward half ends at ${LIFE / 2}`);
  assert.strictEqual(HALVES[1].to, LIFE, 'and the inward half ends the life');
  for(const h of HALVES){
    assert.ok(h.n && h.t && h.t.length > 80, `${h.n} is a heading with nothing under it`);
  }
});

test('every quadrant and every band carries its own prose, and none of them repeat', () => {
  const said = new Map();
  const add = (where, text) => {
    assert.strictEqual(typeof text, 'string', `${where} is missing`);
    assert.ok(text.trim().length > 40, `${where} is too thin to be a reading`);
    const key = text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    assert.ok(!said.has(key), `${where} restates ${said.get(key)}`);
    said.set(key, where);
  };
  for(const q of GRAND){
    add(`${q.season} — what it is for`, q.forWhat);
    add(`${q.season} — what it does`, q.shape);
    add(`${q.season} — where it goes wrong`, q.goesWrong);
    add(`${q.season} — carried forward`, q.carried);
  }
  for(const b of BANDS) add(`${b.sign} band`, b.line);
  assert.ok(said.size >= 28, `the screen should hold real prose (saw ${said.size})`);
});

test('the screen prints all four seasons and all twelve bands, and takes the length of the life from one place', () => {
  // The other tests read the tables. This one runs the screen, which is the only
  // way to see an age that never got interpolated or a band row that dropped out.
  const learnGrand = fnSource('learnGrand');
  const ctx = { Math, JSON, String, Number, Array, Object, Set, console };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext([
    `var GRAND_LIFE = ${LIFE};`,
    `var SIGNS = ${objectAfter('const SIGNS = {')};`,
    `var SEASONS = ${objectAfter('const SEASONS = {')};`,
    `var GRAND = ${GRAND_SRC};`,
    `var GRAND_HALVES = ${HALVES_SRC};`,
    `var GRAND_BANDS = ${BANDS_SRC};`,
    learnGrand,
    'var OUT = learnGrand();',
  ].join('\n'), ctx, { filename: 'learn-grand.js' });
  const html = ctx.OUT;

  assert.match(html, new RegExp(`about ${LIFE} years`),
    'the sentence carries the length from the constant rather than its own copy of it');
  for(const q of GRAND)
    assert.ok(html.includes(`ages ${q.from}&ndash;${q.to}`), `${q.season} prints its ages`);
  for(const b of BANDS)
    assert.ok(html.includes(`<b>${b.sign}</b> <span>ages ${b.from}&ndash;${b.to}</span>`),
      `${b.sign} prints its band`);
  for(const h of HALVES) assert.ok(html.includes(`<small>${h.n}</small>`), `${h.n} prints`);
  assert.ok(!/undefined|NaN|\[object|\$\{/.test(html), 'nothing unresolved reaches the screen');
  assert.match(html, /id="g-back"/, 'and there is a way back to the menu');
  // The menu entry quotes the same number from the same constant.
  assert.match(PAGE, /four seasons over \$\{GRAND_LIFE\} years/,
    'the menu prints the length from the constant too');
});

test('the quiz asks about it, and every question it asks comes out whole', () => {
  // The newest teaching screen was the only one with nothing behind it: the quiz
  // covered the elements, the qualities and the seasons, and stopped there.
  const mark = 'Object.assign(QUIZ_KINDS, {';
  const at = PAGE.indexOf(mark);
  assert.ok(at > -1, 'the teaching half of the quiz is gone');
  const body = objectAfter(mark);

  const ctx = { Math, JSON, String, Number, Array, Object, Set, console };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext([
    'var GRAND_LIFE = ' + LIFE + ';',
    'var GRAND = ' + GRAND_SRC + ';',
    'var GRAND_BANDS = ' + BANDS_SRC + ';',
    'var SEASONS = ' + objectAfter('const SEASONS = {') + ';',
    'var QUIZ_KINDS = {};',
    fnSource('pick'), fnSource('distractors'), fnSource('shuffled'), fnSource('assemble'),
    'Object.assign(QUIZ_KINDS, ' + body + ');',
    'var SEED = 7;',
    'function next(){ SEED = (SEED * 1103515245 + 12345) % 2147483648; return SEED / 2147483648; }',
    'function ask(kind, n){ var out = []; for(var i = 0; i < n; i++) out.push(QUIZ_KINDS[kind](next)); return out; }',
  ].join('\n'), ctx, { filename: 'quiz-grand.js' });

  const POOLS = {
    grandSpan: GRAND.map(q=>q.from + ' to ' + q.to),
    grandSeason: GRAND.map(q=>q.season),
    grandBand: BANDS.map(b=>b.from + ' to ' + b.to),
  };
  const asked = {};
  for(const kind of Object.keys(POOLS)){
    const qs = JSON.parse(JSON.stringify(vm.runInContext('ask(' + JSON.stringify(kind) + ', 200)', ctx)));
    assert.strictEqual(qs.length, 200, kind + ' did not answer every time');
    asked[kind] = qs;
    for(const q of qs){
      assert.strictEqual(q.kind, kind, 'the question reports the wrong kind');
      assert.match(q.prompt, /Grand Cycle/, 'a question must name the frame it is asking about');
      assert.strictEqual(q.options.length, 4, kind + ' should offer four options');
      assert.strictEqual(new Set(q.options).size, 4, 'two options came out the same');
      assert.ok(q.options.every(o=>typeof o === 'string' && o.trim()), 'an option is empty');
      assert.ok(q.options.every(o=>POOLS[kind].includes(o)), 'an option is not from the page\'s own table');
      assert.ok(q.answerIndex >= 0 && q.options[q.answerIndex] === q.answer,
        'the answer is not where the question says it is');
      assert.ok(typeof q.note === 'string' && q.note.length > 40, 'the note explains nothing');
      for(const banned of ['research','brain','chemical','study','proven','cure','diagnos'])
        assert.ok(!q.note.toLowerCase().includes(banned), 'the note claims "' + banned + '"');
      const printed = q.prompt + q.options.join('') + q.note;
      assert.ok(!printed.includes('undefined') && !printed.includes('NaN') && !printed.includes('[object'),
        'something unresolved is being printed on the quiz');
    }
  }
  // And they cover the whole frame rather than one corner of it.
  assert.strictEqual(new Set(asked.grandSeason.map(q=>q.answer)).size, 4,
    'all four quarters must come up');
  assert.ok(new Set(asked.grandSpan.map(q=>q.answer)).size >= 4, 'the quarters must all be asked about');
  assert.ok(new Set(asked.grandBand.map(q=>q.answer)).size >= 6, 'the bands must not come up as one or two');
  // The line above the button promises what the quiz actually tests.
  assert.match(PAGE, /the seasons, how they\s+combine, and the Grand Cycle/,
    'the Learn menu must say the Grand Cycle is tested');
});

test('the house rules hold on the new copy', () => {
  for(const banned of ['research','brain','chemical','study','proven','cure','diagnos']){
    assert.ok(!COPY.toLowerCase().includes(banned), `the section must not say "${banned}"`);
  }
  // Nobody is written about in the third person, so the sweep for she/her and
  // the stray he/him both have to come back empty.
  assert.doesNotMatch(COPY, /\b(she|her|hers|herself)\b/i, 'the sweep for she/her must hold');
  assert.doesNotMatch(COPY, /\b(he|him|his)\b/i, 'and nothing is written about a man in the third person');
  assert.ok(!/https?:\/\//.test(COPY), 'and it sends nobody anywhere');
  // It says out loud what it is, which is the rule the other screens keep.
  assert.match(RENDER, /not a forecast/, 'it must say it is not a forecast');
  assert.match(RENDER, /this app's own writing/, 'and say whose writing it is');
  assert.match(RENDER, /description rather\n?\s*than instruction|description rather/,
    'and that it describes rather than instructs');
});
