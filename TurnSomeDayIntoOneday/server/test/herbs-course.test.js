// The herb library's 30 days tab — the beginner course built out of the same
// two Llaila O. Afrika books as the rest of /herbs.
//
// What this checks is not the prose. It is the four places a course like this
// goes quietly wrong:
//
//   1. a day that teaches and then asks nothing, or a question whose answer
//      index points at an option that is not there — the page would then
//      mark every answer wrong and never say why;
//   2. the days not adding up to thirty, or a number used twice;
//   3. the score not actually following the answer, which is the only part of
//      the page a person can catch it lying about;
//   4. the lines on the Read this first tab going missing from the last weeks
//      of the course, because those are the lines that outrank every claim on
//      every other tab and they are the reason day 28 exists.
//
// The page is run for real in a stub DOM, the same way herbs-books.test.js runs
// it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function inlineScript(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  let out = '';
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(m[1])) continue;
    out += m[2] + '\n;\n';
  }
  return out;
}

function loadPage(file) {
  const els = new Map();
  const mk = (id) => ({
    id, value: '', textContent: '', innerHTML: '', disabled: false,
    className: '', style: {}, dataset: {},
    classList: { _s: new Set(), add(c) { this._s.add(c) }, remove(c) { this._s.delete(c) }, toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c) } else if (f) { this._s.add(c) } else { this._s.delete(c) } }, contains(c) { return this._s.has(c) } },
    addEventListener() {}, setAttribute() {}, removeAttribute() {},
    getAttribute() { return null }, focus() {}, closest() { return null },
    querySelectorAll() { return [] }, appendChild() {}, remove() {},
    setSelectionRange() {}, scrollIntoView() {},
  });
  const doc = {
    getElementById(id) { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener() {},
    createElement() { return mk('_new') },
    body: mk('body'),
    documentElement: mk('html'),
    readyState: 'complete',
  };
  const sandbox = {
    document: doc, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set, Intl,
    localStorage: { getItem() { return null }, setItem() {}, removeItem() {} },
    fetch: async () => ({ status: 200, ok: true, json: async () => ({ content: [] }) }),
    scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: 'node' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(inlineScript(file), sandbox, { filename: file });
  return { sandbox, els };
}

test('the herb library: the 30 days tab is a door in the page, and it renders', () => {
  const html = fs.readFileSync(path.join(ROOT, 'herbs.html'), 'utf8');
  assert.match(html, /data-t="course">30 days</, 'the tab is on the page');
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'course';
  p.sandbox.render();
  const view = p.els.get('view').innerHTML;
  assert.match(view, /data-h="d1"/, 'the first day renders');
  assert.match(view, /data-h="d30"/, 'and the last one does');
  assert.match(view, /of 29 days done/, 'the progress line counts the twenty-nine teaching days');
  assert.match(view, /Sixteen out of twenty is a pass/, 'and the test is announced before it is taken');
});

test('the herb library: the course is thirty days, numbered once each, all with a title', () => {
  const p = loadPage('herbs.html');
  const days = p.sandbox.COURSE;
  assert.strictEqual(days.length, 30, 'thirty days');
  const seen = [];
  for (const d of days) {
    assert.ok(d.t && d.t.length > 2, `day ${d.d} has a title`);
    assert.ok(Array.isArray(d.p) && d.p.length >= 2, `day ${d.d} teaches something`);
    assert.ok(!seen.includes(d.d), `day ${d.d} is numbered once`);
    seen.push(d.d);
  }
  for (let n = 1; n <= 30; n++) assert.ok(seen.includes(n), `day ${n} exists`);
});

test('the herb library: every day asks, and every answer index points at an option that is there', () => {
  const p = loadPage('herbs.html');
  for (const d of p.sandbox.COURSE) {
    assert.ok(Array.isArray(d.q) && d.q.length >= 3, `day ${d.d} has its questions`);
    d.q.forEach((q, i) => {
      const where = `day ${d.d} question ${i + 1}`;
      assert.ok(q.q && q.q.length > 5, `${where} asks something`);
      assert.ok(Array.isArray(q.a) && q.a.length >= 3, `${where} offers at least three answers`);
      assert.ok(Number.isInteger(q.k) && q.k >= 0 && q.k < q.a.length,
        `${where}: the answer index is one of its own options`);
      q.a.forEach((t) => assert.ok(t && t.length, `${where}: no blank option`));
      assert.strictEqual(new Set(q.a).size, q.a.length, `${where}: no option is offered twice`);
      assert.ok(q.w && q.w.length > 5, `${where} says why, which is the whole point of it`);
    });
  }
});

test('the herb library: the last day is the test, and its pass mark is inside it', () => {
  const p = loadPage('herbs.html');
  const last = p.sandbox.COURSE.filter((d) => d.d === 30)[0];
  assert.ok(last && last.test === 1, 'day 30 is the test');
  assert.strictEqual(last.q.length, 20, 'the test is twenty questions');
  assert.strictEqual(p.sandbox.EXAM_PASS, 16, 'sixteen is the pass mark');
  assert.ok(p.sandbox.EXAM_PASS > 0 && p.sandbox.EXAM_PASS <= last.q.length,
    'the pass mark is a score somebody could actually reach');
});

test('the herb library: the score follows the answer, and a day is done when it is answered', () => {
  const p = loadPage('herbs.html');
  const s = p.sandbox;
  const day = s.COURSE.filter((d) => d.d === 2)[0];

  // Nothing answered yet.
  assert.strictEqual(s.dayScore(2).done, false, 'a day is not done before it is answered');

  // The wrong answer counts as answered, and does not score.
  const wrong = (day.q[0].k + 1) % day.q[0].a.length;
  s.answer(2, 0, wrong);
  let score = s.dayScore(2);
  assert.strictEqual(score.right, 0, 'a wrong answer scores nothing');
  assert.strictEqual(score.done, false, 'and does not finish the day');

  // The right answer scores, and the choice can be changed.
  s.answer(2, 0, day.q[0].k);
  assert.strictEqual(s.dayScore(2).right, 1, 'the right answer scores');

  // Answer the rest, and the day completes.
  day.q.forEach((q, i) => s.answer(2, i, q.k));
  score = s.dayScore(2);
  assert.strictEqual(score.right, day.q.length, 'a full day of right answers scores the day');
  assert.strictEqual(score.done, true, 'and finishes it');
  assert.strictEqual(s.daysDone(), 1, 'and the progress line counts it');

  // The render says so too, in the day's own row and under its quiz.
  s.tab = 'course';
  s.openId = 'd2';
  s.render();
  const view = p.els.get('view').innerHTML;
  assert.match(view, /Day 2 done/, 'the day says it is done');
});

test('the herb library: the test scores, passes, and can be taken again', () => {
  const p = loadPage('herbs.html');
  const s = p.sandbox;
  const exam = s.COURSE.filter((d) => d.d === 30)[0];

  // Fifteen right, five left blank: not finished, so not scored yet.
  exam.q.forEach((q, i) => { if (i < 15) s.answer(30, i, q.k); });
  assert.strictEqual(s.dayScore(30).done, false, 'a half-answered test is not a result');

  // Deliberately get five wrong. Fifteen right is below the pass mark.
  for (let i = 15; i < 20; i++) s.answer(30, i, (exam.q[i].k + 1) % exam.q[i].a.length);
  let score = s.dayScore(30);
  assert.strictEqual(score.done, true, 'the test is finished once all twenty are answered');
  assert.strictEqual(score.right, 15, 'fifteen right');
  assert.ok(score.right < s.EXAM_PASS, 'which is below the pass mark');
  s.tab = 'course';
  s.openId = 'd30';
  s.render();
  assert.match(p.els.get('view').innerHTML, /Not yet/, 'and the page says so');

  // Take it again, all right this time.
  exam.q.forEach((q, i) => s.answer(30, i, q.k));
  score = s.dayScore(30);
  assert.strictEqual(score.right, 20, 'twenty right');
  assert.ok(score.right >= s.EXAM_PASS, 'which passes');
  s.render();
  assert.match(p.els.get('view').innerHTML, /Passed/, 'and the page says that too');
});

test('the herb library: the lines that never move are taught in the last week', () => {
  const p = loadPage('herbs.html');
  const day = p.sandbox.COURSE.filter((d) => d.d === 28)[0];
  const text = JSON.stringify(day);
  // Day 28 exists to carry the Read this first tab into the course. If it stops
  // carrying it, the course has a hole exactly where it cannot afford one.
  assert.match(text, /An infection is a doctor, not a tea/, 'the infection line is there');
  assert.match(text, /Coming off alcohol or a drug is a doctor/, 'so is the withdrawal line');
  assert.match(text, /prescription stays with the doctor who gave it/, 'and the prescription line');
  assert.match(text, /Pregnancy and children/, 'and pregnancy and children');
  assert.match(text, /kratom is not in this library/, 'and kratom');
  // The tab itself is still the page's, unsoftened.
  const html = fs.readFileSync(path.join(ROOT, 'herbs.html'), 'utf8');
  assert.match(html, /An infection is a doctor, not a tea/, 'the tab still says it');
  assert.match(html, /Alcohol withdrawal can kill/, 'and still says that');
});

test('the herb library: the course never talks anybody out of their medicine', () => {
  // The page's own rule, and the one line in the whole library that could hurt
  // somebody: nothing here is a reason to stop anything a doctor has given.
  // The course says so in its own voice on day 13, and the test is here so a
  // later edit cannot quietly take it out.
  const p = loadPage('herbs.html');
  const day = p.sandbox.COURSE.filter((d) => d.d === 13)[0];
  assert.match(JSON.stringify(day), /The drug line is the book's and it is not this page's/,
    'the course separates the book\'s drug line from the page\'s');
  assert.match(JSON.stringify(day), /nothing in this course, is a reason to stop anything a doctor has given you/,
    'and says the line plainly');
});
