// The herb library's 60 days tab — the beginner course built out of the same
// two Llaila O. Afrika books as the rest of /herbs. It was thirty days until
// 11 Oct 2026, when Jacques asked for it gone deeper: thirty new days were
// added (the books' own theory, the history, the money, and coming off sugar)
// and the test moved from day 30 to day 60 with thirty questions on it.
//
// What this checks is not the prose. It is the four places a course like this
// goes quietly wrong:
//
//   1. a day that teaches and then asks nothing, or a question whose answer
//      index points at an option that is not there — the page would then
//      mark every answer wrong and never say why;
//   2. the days not adding up to sixty, or a number used twice;
//   2b. the extra forty-one questions on the new days repeating an option or
//      blanking one, which marks a right answer wrong;
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

test('the herb library: the 60 days tab also renders all ten supplied source lessons separately', () => {
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'course';
  p.sandbox.render();
  const html = p.els.get('view').innerHTML;
  assert.match(html, /Additional lessons · your lived experience/);
  assert.match(html, /Your perspective/);
  assert.match(html, /Your personal perspective and experiences/);
  assert.match(html, /not medical advice/);
  assert.match(html, /data-h="submitted1"/);
  assert.match(html, /data-h="submitted10"/);
  const lessons = p.sandbox.SUBMITTED_STUDY;
  assert.strictEqual(lessons.length, 10, 'ten supplied lessons');
  for (const [i, lesson] of lessons.entries()) {
    assert.ok(lesson.t && lesson.claims.length === 5, `personal account ${i + 1} preserves its five claims`);
  }
});

test('the herb library: personal account lesson text preserves the supplied claims verbatim', () => {
  const p = loadPage('herbs.html');
  const lessons = p.sandbox.SUBMITTED_STUDY;
  assert.match(lessons[0].claims[0], /The nutritional genocide of African people, which is called Nutricide, is a reality that must be faced by Africans\./);
  assert.match(lessons[2].claims[0], /among at least 99% of the Caucasians\./);
  assert.match(lessons[5].claims[0], /AIDS \(Acquired Immune Deficiency Syndrome\) and Venereal Disease \(VD\) are not contagious/);
  assert.match(lessons[9].claims[3], /negative grounding charge can work to neutralize the excess positive charge/);
  assert.match(lessons[9].claims[4], /Constant negativity can take its toll/);
});

test('the herb library: the supplied European Mythology summary renders as separate lecture notes', () => {
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'course';
  p.sandbox.render();
  const html = p.els.get('view').innerHTML;
  assert.match(html, /Lecture summary · European Mythology/);
  assert.match(html, /Your account of the lecture/);
  assert.match(html, /not a verbatim transcript/);
  assert.match(html, /data-h="lecture-note-1"/);
  assert.match(html, /data-h="lecture-note-5"/);
  const notes = p.sandbox.LECTURE_NOTES;
  assert.strictEqual(notes.length, 5, 'five organized lecture notes');
  assert.match(notes[0].notes[0], /In his lecture European Mythology/);
  assert.match(notes[1].notes[0], /traditional African oral historians—the griots/);
  assert.match(notes[2].notes[0], /Sigmund Freud, Ivan Pavlov, and the Oedipus complex/);
  assert.match(notes[3].notes[0], /African cognitive style with the European/);
  assert.match(notes[4].notes[0], /communities of African descent should prioritize indigenous African folk tales/);
});

test('the herb library: the 60 days tab is a door in the page, and it renders', () => {
  const html = fs.readFileSync(path.join(ROOT, 'herbs.html'), 'utf8');
  assert.match(html, /data-t="course">60 days</, 'the tab is on the page');
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'course';
  p.sandbox.render();
  const view = p.els.get('view').innerHTML;
  assert.match(view, /data-h="d1"/, 'the first day renders');
  assert.match(view, /data-h="d60"/, 'and the last one does');
  assert.match(view, /of 59 days done/, 'the progress line counts the fifty-nine teaching days');
  assert.match(view, /Twenty-four out of thirty is a pass/, 'and the test is announced before it is taken');
});

test('the herb library: the course is sixty days, numbered once each, all with a title', () => {
  const p = loadPage('herbs.html');
  const days = p.sandbox.COURSE;
  assert.strictEqual(days.length, 60, 'sixty days');
  const seen = [];
  for (const d of days) {
    assert.ok(d.t && d.t.length > 2, `day ${d.d} has a title`);
    assert.ok(Array.isArray(d.p) && d.p.length >= 2, `day ${d.d} teaches something`);
    assert.ok(!seen.includes(d.d), `day ${d.d} is numbered once`);
    seen.push(d.d);
  }
  for (let n = 1; n <= 60; n++) assert.ok(seen.includes(n), `day ${n} exists`);
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
  const last = p.sandbox.COURSE.filter((d) => d.d === 60)[0];
  assert.ok(last && last.test === 1, 'day 60 is the test');
  assert.strictEqual(last.q.length, 30, 'the test is thirty questions');
  assert.strictEqual(p.sandbox.EXAM_PASS, 24, 'twenty-four is the pass mark');
  assert.ok(p.sandbox.EXAM_PASS > 0 && p.sandbox.EXAM_PASS <= last.q.length,
    'the pass mark is a score somebody could actually reach');
  // And every question on it points back at a day that exists, because the
  // reason under each answer is how the test teaches rather than scores.
  const days = p.sandbox.COURSE.map((d) => d.d);
  for (const q of last.q) {
    const m = String(q.w).match(/Day (\d+)/);
    assert.ok(m, `every test question names its day: ${q.q}`);
    assert.ok(days.includes(Number(m[1])), `day ${m[1]} is a real day`);
  }
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
  const exam = s.COURSE.filter((d) => d.d === 60)[0];

  // Twenty-three right, seven left blank: not finished, so not scored yet.
  exam.q.forEach((q, i) => { if (i < 23) s.answer(60, i, q.k); });
  assert.strictEqual(s.dayScore(60).done, false, 'a half-answered test is not a result');

  // Deliberately get seven wrong. Twenty-three right is below the pass mark.
  for (let i = 23; i < 30; i++) s.answer(60, i, (exam.q[i].k + 1) % exam.q[i].a.length);
  let score = s.dayScore(60);
  assert.strictEqual(score.done, true, 'the test is finished once all thirty are answered');
  assert.strictEqual(score.right, 23, 'twenty-three right');
  assert.ok(score.right < s.EXAM_PASS, 'which is below the pass mark');
  s.tab = 'course';
  s.openId = 'd60';
  s.render();
  assert.match(p.els.get('view').innerHTML, /Not yet/, 'and the page says so');

  // Take it again, all right this time.
  exam.q.forEach((q, i) => s.answer(60, i, q.k));
  score = s.dayScore(60);
  assert.strictEqual(score.right, 30, 'thirty right');
  assert.ok(score.right >= s.EXAM_PASS, 'which passes');
  s.render();
  assert.match(p.els.get('view').innerHTML, /Passed/, 'and the page says that too');
});

test('the herb library: the course header reports the day-60 test, not day 30', () => {
  // The progress line above the days says "The test: …", but it was reading
  // dayScore(30) — a leftover from when the exam was day 30 and the course was
  // thirty days. Day 30 is an ordinary teaching day now, with only four
  // questions, so the header could report a four-question "test". The header is
  // what a person reads before the days themselves, so it is pinned here.
  const p = loadPage('herbs.html');
  const s = p.sandbox;
  const exam = s.COURSE.filter((d) => d.d === 60)[0];
  const day30 = s.COURSE.filter((d) => d.d === 30)[0];
  assert.strictEqual(exam.q.length, 30, 'the test is thirty questions');
  assert.notStrictEqual(day30.q.length, exam.q.length,
    'day 30 is not the exam, so the header cannot be right by reading it');

  // Twenty-six right, four wrong: all thirty answered, above the pass mark.
  exam.q.forEach((q, i) => s.answer(60, i, i < 26 ? q.k : (q.k + 1) % q.a.length));
  s.tab = 'course';
  s.render();
  let view = p.els.get('view').innerHTML;
  assert.match(view, /The test: 26 of 30 \u2014 passed/, 'the header carries the exam score');
  assert.doesNotMatch(view, /The test is day 60/, 'and not the not-yet-taken line');

  // Answering day 30 does not change it — the header is the exam's, not day 30's.
  day30.q.forEach((q, i) => s.answer(30, i, q.k));
  s.render();
  view = p.els.get('view').innerHTML;
  assert.match(view, /The test: 26 of 30 \u2014 passed/, 'still the exam once day 30 is answered');

  // Below the pass mark, the header says so with the exam's own numbers.
  exam.q.forEach((q, i) => s.answer(60, i, i < 23 ? q.k : (q.k + 1) % q.a.length));
  s.render();
  view = p.els.get('view').innerHTML;
  assert.match(view, /The test: 23 of 30 \u2014 the pass mark is 24/, 'and reports a fail honestly');
});

test('the herb library: the lines that never move are taught in the last week', () => {
  const p = loadPage('herbs.html');
  const day = p.sandbox.COURSE.filter((d) => d.d === 28)[0];
  const text = JSON.stringify(day);
  // Day 28 exists to carry the Read this first tab into the course. If it stops
  // carrying it, the course has a hole exactly where it cannot afford one.
  // The wording was rewritten on 12 Oct 2026 at the owner's request, so that the
  // page never sends anybody to a doctor: same warnings, no "go and see" lines.
  // What is checked here is what was always checked — that the warnings are on
  // the day at all — so a later edit still cannot quietly take them out.
  assert.match(text, /Nothing on this shelf answers an infection/, 'the infection line is there');
  assert.match(text, /Alcohol withdrawal can kill/, 'so is the withdrawal line');
  assert.match(text, /nothing on this shelf is ever a reason to stop something you are already taking/, 'and the line about what somebody is already taking');
  assert.match(text, /Pregnancy and children/, 'and pregnancy and children');
  assert.match(text, /kratom is not in this library/, 'and kratom');
  // The tab itself is still the page's, unsoftened.
  const html = fs.readFileSync(path.join(ROOT, 'herbs.html'), 'utf8');
  assert.match(html, /Nothing here answers an infection/, 'the tab still says it');
  assert.match(html, /Alcohol withdrawal can kill/, 'and still says that');
});

test('the herb library: the course never talks anybody out of their medicine', () => {
  // The page's own rule, and the one line in the whole library that could hurt
  // somebody: nothing here is a reason to stop anything a doctor has given.
  // The course says so in its own voice on day 13, and the test is here so a
  // later edit cannot quietly take it out. The thirty new days keep it too:
  // day 47 is where the books' argument about a system is separated from the
  // person in the room, and day 49 names the claims the page will not make.
  const p = loadPage('herbs.html');
  const day = p.sandbox.COURSE.filter((d) => d.d === 13)[0];
  assert.match(JSON.stringify(day), /The drug line is the book's and it is not this page's/,
    'the course separates the book\'s drug line from the page\'s');
  assert.match(JSON.stringify(day), /nothing in this course, is a reason to stop any of it/,
    'and says the line plainly');
  const d47 = JSON.stringify(p.sandbox.COURSE.filter((d) => d.d === 47)[0]);
  assert.match(d47, /What is already in your hand stays yours to keep taking/,
    'the new days keep what somebody is already taking where it is too');
  assert.match(d47, /none of this is a reason to be rude to somebody who is trying to help/,
    'and do not turn the books\' argument about a system into a fight with a person');
  const d49 = JSON.stringify(p.sandbox.COURSE.filter((d) => d.d === 49)[0]);
  assert.match(d49, /Nothing on this shelf answers an infection, and that is the oldest line on this page/,
    'and the infection line is taught again where the books\' claims are sorted');
});

test('the herb library: the new days are the books\u2019 material, not invented', () => {
  // The thirty days added on 11 Oct 2026 were asked for as "the theory behind
  // why those herbs work", the history, the money and coming off sugar. What
  // this checks is that they carry the books' own words where the books have
  // them, and that the page's own lines are still marked as the page's.
  const p = loadPage('herbs.html');
  const d = (n) => p.sandbox.COURSE.filter((x) => x.d === n)[0];
  const must = [
    [30, /destructive depressive immune retardants/, 'the book on sugar'],
    [31, /Yeast causes desires for sugar/, 'the sugar craving page'],
    [32, /liquid, slimy manure called mucus or plaque/, 'the book on mucus'],
    [34, /Starches should not be combined with sugar/, 'the food combining laws'],
    [35, /Food should ideally be eaten between the hours of 12 noon and 7 p\.m\./, 'the twenty-four hour cycle'],
    [37, /This is a breakfast that can greet you at the cemetery/, 'the breakfast chapter'],
    [38, /A diet of raw fruits and vegetables naturally brushes the teeth/, 'the teeth chapter'],
    [39, /constipating and disease causing bleached white flour/, 'the flour line'],
    [41, /These two branches grow from the tree/, 'the chart of the two principles'],
    [42, /alfalfa or chamomile would help to balance the energy drain of yohimbe/, 'the chart at work'],
    [45, /Diseases create wealth for the Disease Industry/, 'the economics'],
    [53, /naturally colorful raw food and health food can stop Nutricide/, 'the colour line'],
    [56, /has adjusted to that place, and is generally good for the diseases of that environment/, 'food and place'],
  ];
  for (const [n, re, what] of must) {
    const day = d(n);
    assert.ok(day, `day ${n} exists`);
    assert.match(JSON.stringify(day), re, `day ${n} carries ${what}`);
  }
  // And the page's own lines are still labelled as the page's, not passed off
  // as the books'. The days that are the page's own say so on the card.
  for (const n of [51, 52, 58]) {
    assert.match(JSON.stringify(d(n)), /"note":"/, `day ${n} marks its own line`);
  }
});
