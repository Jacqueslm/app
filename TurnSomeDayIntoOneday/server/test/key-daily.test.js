// The daily — the "Today" tab in key.html — 19 Sep 2026.
//
// Jacques was shown another app's listing that sells a "free daily horoscope,
// tarot, numerology, birth chart and love compatibility". Four of those five
// this app already reads properly. The fifth was missing for a real reason: a
// birthday reading says the same thing on a Tuesday as it does in June, so
// there was nothing to open in the morning.
//
// The daily is built out of tables this page already has, read for TODAY's date
// rather than for a birthday. That is the whole idea and also the whole risk,
// which is why the engine is RUN here rather than inspected as text: the ways a
// daily goes wrong are arithmetic (a month off by one, a birthday counted a day
// late, a weekday read off the wrong date) and composition — asking PERIODS for
// the wrong week, or looking up an element pair the table does not have, which
// fails silently and simply drops a line off the page.
//
// So the page's own tables and its own helpers are read straight out of
// key.html and given to the engine, not copied into this file. A stub would
// agree with whatever mistake the engine had made. The wiring is then run in a
// pretend page, because the fault this found was an ordering one that a text
// check cannot see: the page's own script calls the daily from the bottom of
// the body, before the months have been put into the two selects, and an empty
// select is a birthday of 0/0.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'key.html'), 'utf8');

// The block, from its banner to the end of its own script.
const MARK = 'TODAY — THE DAILY, OFF THE TABLES THIS PAGE ALREADY HAS';
const at = PAGE.indexOf(MARK);
const BLOCK = at === -1 ? '' : PAGE.slice(at, PAGE.indexOf('</script>', PAGE.indexOf('TODAY ENGINE', at)));

// The engine only: the pure part, no DOM, no wiring.
function engineSource(){
  const a = BLOCK.indexOf('/* ─── TODAY ENGINE');
  const b = BLOCK.indexOf('/* ─── END TODAY ENGINE ─── */');
  assert.ok(a > -1 && b > a, 'the engine markers must both be in the block');
  return BLOCK.slice(a, b);
}
// The wiring, which runs in a pretend page below.
function wiringSource(){
  const a = BLOCK.indexOf('(function(){', BLOCK.indexOf('/* ─── END TODAY ENGINE ─── */'));
  assert.ok(a > -1, 'the wiring must be in the block');
  return BLOCK.slice(a);
}

/* -------------------------------------------------------- the page's own tables */

// A const out of the page, as written: the object or array literal after the =.
// It ends at the first ]; or }; — whichever comes first — because the page
// writes the small ones on one line and the big ones across several. The
// bracket is taken and the semicolon is left behind.
function grabConst(name){
  const head = 'const ' + name + ' = ';
  const start = PAGE.indexOf('\n' + head);
  assert.ok(start > -1, `const ${name} is not in key.html`);
  const tail = PAGE.slice(start + 1 + head.length);
  const arr = tail.indexOf('];'), obj = tail.indexOf('};');
  const end = (arr > -1 && (obj === -1 || arr < obj)) ? arr : obj;
  assert.ok(end > -1, `the end of const ${name} was not found`);
  return tail.slice(0, end + 1).trim();
}
function grabFn(re){
  const m = PAGE.match(re);
  assert.ok(m, `not found in key.html: ${re}`);
  return m[0];
}

/* A pretend page: a real Date crate of one morning, the elements the wiring
   asks for, and storage that answers. Everything the daily never reads (the
   per-period prose profileOf reaches for) is empty on purpose — if the daily
   ever starts drawing from one of them this fails loudly rather than rendering
   an undefined. */
const NOW = new Date(2026, 8, 19, 9, 30);          // Saturday morning, Central.
const FixedDate = function(...args){ return args.length ? new Date(...args) : new Date(NOW.getTime()); };

function sandbox(){
  const els = {}, store = {}, ready = [];
  const node = (id) => {
    if(els[id]) return els[id];
    const made = {
      id: id, innerHTML: '', textContent: '', hidden: false, listeners: {}, _value: '',
      /* Two things worth being faithful about, because both have caught this
         feature already: a real input and select read back as TEXT whatever
         was put in them (1988 is not 1988), and a real select with no options
         in it reads back as an empty value, which is a birthday of 0/0. */
      get value(){ return this._value; },
      set value(v){ this._value = v == null ? '' : String(v); },
      get options(){ return (this.innerHTML.match(/<option/g) || []).map(() => ({})); },
      addEventListener(type, fn){ (this.listeners[type] = this.listeners[type] || []).push(fn); },
      fire(type){ (this.listeners[type] || []).forEach((fn) => fn({})); },
    };
    els[id] = made;
    return made;
  };

  const ctx = {
    Math, JSON, String, Number, Array, Object, console,
    Date: FixedDate,
    document: {
      getElementById: node,
      addEventListener(type, fn){ if(type === 'DOMContentLoaded') ready.push(fn); },
    },
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
    currentInput: () => ({ person: { name: 'Ada Marchetti', month: 11, day: 30, year: null } }),
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.__els = els; ctx.__store = store; ctx.__ready = ready;
  vm.createContext(ctx);

  vm.runInContext('var LORE={},PORTRAIT={},WELLBEING={},DESTINY={},PLANET_LORE={},SIGN_BODY={},BIRTHSTONE=[];', ctx);
  ['PERIODS', 'SIGNS', 'NUMBERS', 'TAROT', 'EL_REL', 'Q_REL', 'MONTHS']
    .forEach((n) => vm.runInContext(`var ${n} = ${grabConst(n)};`, ctx, { filename: n + '.js' }));
  [
    /const relKey = [^\n]*/,
    /const signsOf = [^\n]*/,
    /const esc = [^\n]*/,
    /const firstName = [^\n]*/,
    /const isLeap = [^\n]*/,
    /const DIM = [^\n]*/,
    /function reduceNum\([^\n]*/,
    /function digitSum\([^\n]*/,
    /function tarotIndex\([^\n]*/,
    /function tarotFor\([^\n]*/,
    /function findPeriod\(month, day\)\{[\s\S]*?\n\}/,
    /function profileOf\(person\)\{[\s\S]*?\n\}/,
  ].forEach((re) => vm.runInContext(grabFn(re), ctx, { filename: 'page-helper.js' }));
  vm.runInContext(engineSource(), ctx, { filename: 'today-engine.js' });
  vm.runInContext(wiringSource(), ctx, { filename: 'today-wiring.js' });
  return ctx;
}

const S = sandbox();
const run = (expr) => vm.runInContext(expr, S);
const read = (v) => JSON.parse(JSON.stringify(v));

const JACQUES = '{ name: "Jacques L", month: 11, day: 29, year: 1988 }';
const SATURDAY = 'new Date(2026, 8, 19)';           // Saturday, 19 September 2026.
const daily = (now, person) => run(`todayHtml(todayReading(${now}, ${person}))`);

/* ------------------------------------------------------------------- the date */

test('the daily reads the day it is given, not the day before', () => {
  assert.match(daily(SATURDAY, JACQUES), /Saturday, September 19, 2026/,
    'the weekday, the date and the year all come off the one date, in local time');
});

test('a birthday is counted to the day, forwards and backwards', () => {
  assert.strictEqual(run(`todayInDays(${SATURDAY}, 11, 29)`), 71, '19 Sep to 29 Nov');
  assert.strictEqual(run(`todayInDays(new Date(2026, 8, 20), 11, 29)`), 70, 'and one day later, one less');
  assert.strictEqual(run(`todayInDays(new Date(2026, 10, 29), 11, 29)`), 0, 'today is 0, not 365');
  assert.strictEqual(run(`todayInDays(new Date(2026, 10, 30), 11, 29)`), 364, 'the day after it is next year');
  assert.strictEqual(run(`todayInDays(new Date(2026, 11, 31), 1, 1)`), 1, 'and it rolls over the new year');
});

test('a 29 February is answered on a day the calendar actually has', () => {
  // new Date(year, 1, 29) rolls to 1 March in a common year. That is the
  // nearest thing the calendar has to the birthday, so it is what is used.
  assert.strictEqual(run(`todayInDays(new Date(2027, 1, 28), 2, 29)`), 1);
  assert.strictEqual(run(`todayInDays(new Date(2028, 1, 28), 2, 29)`), 1);
});

test('the age is whole years, and it turns over on the birthday itself', () => {
  assert.strictEqual(read(run(`todayAge(${SATURDAY}, 11, 29, 1988)`)).years, 37,
    'still 37 on 19 September');
  assert.strictEqual(read(run(`todayAge(new Date(2026, 10, 29), 11, 29, 1988)`)).years, 38,
    '38 on the day');
  assert.strictEqual(read(run(`todayAge(new Date(2026, 10, 29), 11, 29, 1988)`)).days, 0);
  assert.strictEqual(run(`todayAge(${SATURDAY}, 11, 29, null)`), null,
    'no year given: no age invented');
});

test('the days-so-far count is the same number as a UTC difference', () => {
  const utc = Math.round((Date.UTC(2026, 10, 29) - Date.UTC(1988, 10, 29)) / 86400000);
  assert.strictEqual(run(`todayAlive(new Date(2026, 10, 29), 11, 29, 1988)`), utc);
  assert.strictEqual(run(`todayAlive(${SATURDAY}, 11, 29, null)`), null);
});

/* ------------------------------------------------------- the reading it draws */

test('the week is the page\'s own week for today, and the number and card are its own rules', () => {
  const html = daily(SATURDAY, JACQUES);
  const world = read(run('findPeriod(9, 19)'));
  const rx = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  assert.match(html, rx(world.n), 'the week the calendar is in');
  assert.match(html, rx(world.r), 'with its dates');

  // 19 reduces to 1, and the 19th draws XIX. Both come from the page's own
  // rules for a birthday's day, run on today's date.
  assert.strictEqual(run('reduceNum(19)'), 1);
  assert.strictEqual(run('tarotIndex(19)'), 19);
  assert.match(html, /the Sun, self-definition/, 'today\'s number, out of NUMBERS');
  assert.match(html, /XIX The Sun/, 'today\'s card, out of TAROT');

  // His own: 29 November reduces to 2, and the 29th draws XI (2+9), not II.
  assert.match(html, /2 &mdash; the Moon/, 'his number');
  assert.match(html, /XI Justice/, 'his card');
});

test('his own week is read by the pair engine\'s tables, not by a copy of them', () => {
  const html = daily(SATURDAY, JACQUES);
  const mine = read(run('findPeriod(11, 29)'));
  const q = (s) => JSON.stringify(s);
  const elLine = run(`EL_REL[relKey(${q(run('SIGNS[findPeriod(11, 29).signs[0]].e'))}, ` +
    `${q(run('SIGNS[findPeriod(9, 19).signs[0]].e'))})].line`);
  assert.ok(elLine.length > 10, 'the element table answers for those two elements');
  assert.ok(html.includes(elLine.slice(0, 24)),
    'and its own words for that pair are on the page');
  assert.ok(html.includes(mine.n), 'the week he came in under is named');
  assert.ok(html.includes(mine.t.replace(/^The /, 'the ')),
    'written the way the rest of the app writes a period');
});

test('every pair the daily can look up is in the two tables', () => {
  // relKey sorts the two names before joining them. If that ever stopped
  // matching the keys in EL_REL and Q_REL the lookup would return undefined and
  // the line would simply vanish off the page, with nothing failing anywhere.
  const missing = run(`(function(){
    const els = ['Fire','Earth','Air','Water'], qs = ['Cardinal','Fixed','Mutable'];
    const out = [];
    els.forEach(a => els.forEach(b => { if(!EL_REL[relKey(a,b)]) out.push(a + '|' + b); }));
    qs.forEach(a => qs.forEach(b => { if(!Q_REL[relKey(a,b)]) out.push(a + '|' + b); }));
    return out.join(', ');
  })()`);
  assert.strictEqual(missing, '', 'EL_REL and Q_REL between them cover every pair');
});

test('the birthday line says today on the day, and how far off otherwise', () => {
  assert.match(daily(SATURDAY, JACQUES), /In 71 days &mdash; you turn 38\./);
  assert.match(daily('new Date(2026, 10, 29)', JACQUES), /Today &mdash; 38\./);
  assert.match(daily(SATURDAY, '{ name: "Ada", month: 11, day: 30, year: null }'), /In 72 days\./,
    'no year: the count is given and no age is invented');
  assert.match(daily(SATURDAY, '{ name: "Ada", month: 9, day: 20, year: null }'), /In 1 day\./,
    'and one day is "day", not "days"');
});

test('with no birthday in yet it still reads the date, and asks for the rest', () => {
  const html = daily(SATURDAY, 'null');
  assert.match(html, /Saturday, September 19, 2026/, 'the date is about the date');
  assert.match(html, /XIX The Sun/, 'and so are the number and the card');
  assert.ok(!/Your birthday/.test(html), 'nothing personal is invented');
  assert.ok(!/Your week/.test(html));
  assert.match(html, /Put a name and a birthday in above/, 'and it says what would fill in');
});

/* ------------------------------------------------------------------ the wiring */

test('opening the page draws the morning, before anything has been typed', () => {
  const ctx = sandbox();
  // The page's own script calls this from the bottom of the body, which is
  // BEFORE DOMContentLoaded and before wire() would have filled the months in.
  ctx.todayLoad();
  const out = ctx.__els['td-result'].innerHTML;
  assert.match(out, /Saturday, September 19, 2026/);
  assert.ok(!/Your birthday/.test(out), 'nobody has said whose morning it is yet');
  assert.strictEqual(ctx.__els['td-err'].textContent, '', 'and it is not an error');
  assert.strictEqual(ctx.__els['td-result'].innerHTML, out,
    'and an empty form is drawn as the date, not thrown on');

  ctx.__ready.forEach((fn) => fn());                        // DOMContentLoaded
  assert.match(ctx.__els['td-result'].innerHTML, /Saturday, September 19, 2026/,
    'and it survives the wiring that runs after it');
  assert.strictEqual(ctx.__els['td-result'].innerHTML, out, 'with the same answer, not a second one');
});

test('the daily takes whoever was just read on the Read tab', () => {
  const ctx = sandbox();
  ctx.todayLoad();
  ctx.__ready.forEach((fn) => fn());
  ctx.__els['btn-read'].fire('click');
  const out = ctx.__els['td-result'].innerHTML;
  assert.match(out, /Ada/, 'the name from the Read tab');
  assert.match(out, /In 72 days/, 'and their birthday, counted from today');
  assert.match(ctx.__store['personology.today.v1'], /"month":11/,
    'and it is remembered for tomorrow morning');
});

test('the birthday is the only thing kept, and it comes back next time', () => {
  const first = sandbox();
  first.todayLoad();
  first.__ready.forEach((fn) => fn());
  first.__els['td-month'].value = '11';
  first.__els['td-day'].value = '29';
  first.__els['td-year'].value = '1988';
  first.__els['td-name'].value = 'Jacques';
  first.__els['td-show'].fire('click');

  // A second open of the same page, with that storage still in place.
  const again = sandbox();
  again.localStorage.getItem = (k) => (k in first.__store ? first.__store[k] : null);
  again.todayLoad();
  const out = again.__els['td-result'].innerHTML;
  assert.match(out, /Jacques/, 'the name is back');
  assert.match(out, /In 71 days &mdash; you turn 38\./, 'and the count');
  assert.strictEqual(again.__els['td-year'].value, '1988', 'the year is back in the form');
  assert.deepStrictEqual(Object.keys(first.__store), ['personology.today.v1'],
    'and that one key is the whole of what the daily keeps');
});

test('a year that never happened is refused, in the Read tab\'s own words', () => {
  const ctx = sandbox();
  ctx.todayLoad();
  ctx.__ready.forEach((fn) => fn());
  ctx.__els['td-day'].value = '29';
  ctx.__els['td-month'].value = '2';
  ctx.__els['td-year'].value = '2027';
  ctx.__els['td-show'].fire('click');
  assert.match(ctx.__els['td-err'].textContent, /2027 was not a leap year/);
  assert.strictEqual(ctx.__els['td-result'].innerHTML, '');
});

test('the month change moves the day count, so February cannot keep the 31st', () => {
  const ctx = sandbox();
  ctx.todayLoad();
  ctx.__ready.forEach((fn) => fn());
  ctx.__els['td-month'].value = '2';
  ctx.__els['td-month'].fire('change');
  const days = (ctx.__els['td-day'].innerHTML.match(/<option/g) || []).length;
  assert.strictEqual(days, 29, 'February has 29 options, as it does on the Read tab');
  ctx.__els['td-month'].value = '4';
  ctx.__els['td-month'].fire('change');
  assert.strictEqual((ctx.__els['td-day'].innerHTML.match(/<option/g) || []).length, 30, 'April has 30');
});

/* ------------------------------------------------------------- the page itself */

test('the block is in key.html, in the head, before the page\'s own script', () => {
  assert.ok(at > -1, 'the daily must be in key.html');
  assert.ok(at < PAGE.indexOf('</head>'), 'it goes in the head, like the voice block');
  assert.ok(at < PAGE.lastIndexOf('<script>'),
    'and before the page script, so it has to wait for DOMContentLoaded');
  assert.match(BLOCK, /DOMContentLoaded/, 'and it does wait');
});

test('Today is the tab the page opens on, and the reading is one tap away', () => {
  const nav = PAGE.slice(PAGE.indexOf('<nav class="tabs"'), PAGE.indexOf('</nav>'));
  assert.match(nav, /id="tab-today"\s+aria-selected="true"\s+data-panel="panel-today"/,
    'Today is offered, and selected');
  assert.ok(nav.indexOf('tab-today') < nav.indexOf('tab-read'), 'ahead of Read a birthday');
  assert.match(nav, /id="tab-read"\s+aria-selected="false"/, 'which no longer opens the page');
  assert.match(PAGE, /<section class="panel" id="panel-today" role="tabpanel">/,
    'and its panel is the one that is showing');
  assert.match(PAGE, /<section class="panel" id="panel-read" role="tabpanel" hidden>/,
    'so Read a birthday starts hidden');
  // The old opening move put the cursor in the name box on a screen nobody had
  // asked for, which on a phone throws the keyboard up over the whole page.
  assert.match(PAGE, /if\(!applyHash\(\)\) todayLoad\(\);/);
  assert.ok(!/if\(!applyHash\(\)\) \$\(.f-name.\)\.focus\(\);/.test(PAGE), 'the old one is gone');
});

test('a shared link still opens its reading', () => {
  // The address bar wins: applyHash runs first, and only a page with no reading
  // in it opens on the daily.
  assert.match(PAGE, /function applyHash\(\)\{[\s\S]{0,400}showTab\('tab-read'\); doRead\(\);/);
});

test('the daily is read aloud like every other tab', () => {
  const voice = PAGE.slice(PAGE.indexOf('const BARS = '), PAGE.indexOf('const ROOT = {'));
  assert.match(voice, /'panel-today'/, 'the voice block mounts its read bar on the daily');
  assert.match(PAGE, /'panel-today':\s*'td-result'/, 'and reads the words out of the result box');
});

test('every box the daily draws into exists in the page, and the form is the page\'s', () => {
  const start = PAGE.indexOf('id="panel-today"');
  const panel = PAGE.slice(start, PAGE.indexOf('</section>', start));
  for (const id of ['td-name', 'td-month', 'td-day', 'td-year', 'td-show', 'td-err', 'td-result']) {
    assert.ok(panel.includes(`id="${id}"`), `${id} must be in the panel markup`);
    assert.ok(BLOCK.includes(`'${id}'`), `${id} must be wired in the block`);
  }
  assert.match(BLOCK, /const r = currentInput\(\);/, 'and it takes whoever was just read');
  assert.match(BLOCK, /!isLeap\(year\)/, 'and the year rules are the Read tab\'s, not its own');
});

/* ---------------------------------------------------------------- what it says */

test('it is not a horoscope and it flatters nobody', () => {
  for (const banned of ['research', 'brain', 'chemical', 'study', 'proven', 'cure']) {
    assert.ok(!BLOCK.toLowerCase().includes(banned), `the daily must not say "${banned}"`);
  }
  assert.ok(!/https?:\/\//.test(BLOCK), 'and it never sends anybody anywhere');
  assert.ok(!/[^a-zA-Z]fetch\(/.test(BLOCK), 'and it calls nothing: it works with no signal');

  // One thing is written to the device and it is the name and the birthday.
  // The boxes on The Key stay where they are and the daily never writes prose.
  const writes = BLOCK.match(/localStorage\.setItem\(([^;]*)\)/g) || [];
  assert.strictEqual(writes.length, 1, 'the daily writes to the device exactly once');
  assert.match(writes[0], /name:[^}]*month:[^}]*day:[^}]*year:/,
    'and it is the name and birthday, nothing else');
});

test('the page says out loud what the daily is made of', () => {
  const html = daily(SATURDAY, JACQUES);
  assert.match(html, /Nothing was written for this and nothing is guessed/);
  assert.match(html, /what changes every\s+single morning is the date/, 'including its own limit');
  assert.match(BLOCK, /read for TODAY/, 'and the banner says the same in the source');
});
