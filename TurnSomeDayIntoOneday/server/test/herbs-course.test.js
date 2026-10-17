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

function loadPage(file, seeded) {
  const mem = seeded || {};
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
    localStorage: {
      getItem(k) { return k in mem ? mem[k] : null },
      setItem(k, v) { mem[k] = String(v) },
      removeItem(k) { delete mem[k] },
    },
    fetch: async () => ({ status: 200, ok: true, json: async () => ({ content: [] }) }),
    scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: 'node' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(inlineScript(file), sandbox, { filename: file });
  return { sandbox, els, store: mem };
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

// 15 Oct 2026. Jacques: "As I'm doing to herb certification i dont its confusing
// rewrite it on the level a 2nd grader would understand in the quiz give 5
// questions." Both herb courses were rewritten in plainer words, five questions
// to a teaching day. Day 60 is the test rather than a lesson, so it keeps its
// thirty. The count is pinned here so a later edit cannot quietly drop it back.
test('the herb library: every teaching day asks five questions, and every answer index points at an option that is there', () => {
  const p = loadPage('herbs.html');
  for (const d of p.sandbox.COURSE) {
    assert.ok(Array.isArray(d.q) && d.q.length >= 3, `day ${d.d} has its questions`);
    if (d.d < 60) assert.strictEqual(d.q.length, 5, `day ${d.d} asks five questions`);
    // QUIZ_N is the number a stored answer is measured against when the page
    // opens (dropStaleDays). It is a hand-set constant, so an edit that changes
    // how many questions a day asks can leave it behind and nothing would say
    // so - it is pinned to the days themselves here.
    if (!d.test) assert.strictEqual(p.sandbox.QUIZ_N, d.q.length,
      `QUIZ_N is the ${d.q.length} questions day ${d.d} asks`);
    d.q.forEach((q, i) => {
      const where = `day ${d.d} question ${i + 1}`;
      assert.ok(q.q && q.q.length > 5, `${where} asks something`);
      assert.ok(Array.isArray(q.a) && q.a.length >= 3, `${where} offers at least three answers`);
      assert.ok(Number.isInteger(q.k) && q.k >= 0 && q.k < q.a.length,
        `${where}: the answer index is one of its own options`);
      q.a.forEach((t) => assert.ok(t && t.length, `${where}: no blank option`));
      assert.strictEqual(new Set(q.a).size, q.a.length, `${where}: no option is offered twice`);
      assert.ok(q.w && q.w.length > 5, `${where} says why, which is the whole point of it`);
      // The same roof the Certification's herbalist track is held to: the ask
      // was a second grader's reading, and a question is a sentence, not a
      // paragraph. Both roofs are 14 words so the two herb tracks read alike.
      const words = q.q.trim().split(/\s+/).length;
      assert.ok(words <= 14, `${where} is ${words} words - too long for a beginner`);
      const why = q.w.trim().split(/\s+/).length;
      assert.ok(why <= 22, `${where}: the reason is ${why} words long`);
    });
  }
});

test('the herb library: a record written before answers were stamped is judged by what it holds', () => {
  // Before 15 Oct 2026 a record carried no count, only its answers. A teaching
  // day then asked three or four, so a record holding three or four cannot be
  // matched to the five it asks now and goes. The test asked thirty and still
  // does, so its records stand at any depth the person reached.
  const seeded = {
    tsid_herb_notes_v1: JSON.stringify({
      'day:3': { a: [0, 1, 2, 3] },                       // all four of an old quiz
      'day:60': { a: new Array(12).fill(0) },             // part of the test, unchanged
    }),
  };
  const p = loadPage('herbs.html', seeded);
  const s = p.sandbox;

  assert.strictEqual(s.dayRec(3).a.length, 0, 'an unstamped record of an old four-question day is dropped');
  assert.strictEqual(s.dayRec(60).a.length, 12, 'an unstamped test record is kept, because the test did not change');
  assert.strictEqual(s.dayScore(60).done, false, 'and a part of the test is still not a finished test');
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

test('the herb library: answers given to a quiz since rewritten are dropped, never repainted onto the new one', () => {
  // 15 Oct 2026. The teaching days went from three or four questions to five.
  // An answer is kept against the position it was given at, so the old ones
  // would land on questions nobody read, be marked right or wrong against them,
  // and be counted in a score. The day opens again instead. The day-60 test
  // kept its thirty questions through the rewrite, so a record of it stands.
  const seeded = {
    tsid_herb_notes_v1: JSON.stringify({
      'day:1': { a: [0, 1, 2] },               // three answers to a three-question day
      'day:60': { a: new Array(30).fill(0) },  // the test's own thirty, unchanged
    }),
  };
  const p = loadPage('herbs.html', seeded);
  const s = p.sandbox;

  assert.strictEqual(s.dayRec(1).a.length, 0, 'the answers to the old quiz are gone');
  assert.strictEqual(s.dayScore(1).done, false, 'so the day is not a finished day');
  assert.strictEqual(s.daysDone(), 0, 'and the course reports nothing done');
  assert.strictEqual(s.dayRec(60).a.length, 30, 'the test kept its thirty questions, so its record stands');
  assert.strictEqual(s.dayScore(60).done, true, 'and it is still read as a finished test');

  // The summary the Certification reads is rewritten in the same breath, or the
  // other half of the app would go on reporting sixty days done over a course
  // that has just gone back to the beginning.
  const bridge = JSON.parse(p.store.tsid_herb_progress_v1);
  assert.strictEqual(bridge.done, 0, 'the library tells the Certification the truth about the reset');
  assert.strictEqual(bridge.total, 59);

  // A fresh answer is stamped with the quiz it was given to, and survives the
  // next open - the page is not a wrecking ball, it is one question long: does
  // this answer belong to the quiz that is here now.
  const q0 = s.COURSE.filter((d) => d.d === 2)[0].q[0].k;
  s.answer(2, 0, q0);
  assert.strictEqual(s.dayRec(2).n, 5, 'the answer records how many questions the day asked');
  const again = loadPage('herbs.html', p.store);
  assert.strictEqual(again.sandbox.picked(2, 0), q0, 'and a later open keeps it');
  assert.strictEqual(again.sandbox.dayRec(60).a.length, 30, 'beside the test it never touched');
});

test('the herb library: the check runs on every open, and the test day is no exception', () => {
  // 17 Oct 2026. The check above only ran while the store's quizN marker
  // disagreed with QUIZ_N, so it cleaned a phone once and then switched itself
  // off: a second rewrite would repaint the old answers. And its day-60 branch
  // compared the test's length with itself, so no test record was ever dropped.
  // Both are the same promise, so both are checked here on a store that has
  // already been through the marker once.
  const seeded = {
    tsid_herb_notes_v1: JSON.stringify({
      quizN: 5,
      'day:1': { a: [0, 1, 2], n: 3 },                // stamped, for a 3-question quiz
      'day:60': { a: new Array(20).fill(0), n: 20 },  // the test holds thirty now
      'day:2': { a: [0], n: 5 },                      // half of today's quiz
    }),
  };
  const p = loadPage('herbs.html', seeded);
  const s = p.sandbox;

  assert.strictEqual(s.dayRec(1).a.length, 0, 'a record stamped for another quiz is dropped on any open');
  assert.strictEqual(s.dayRec(60).a.length, 0, 'and so is a test record written against twenty questions');
  assert.strictEqual(s.dayScore(60).right, 0, 'so nothing is scored against a question nobody read');
  assert.strictEqual(s.dayRec(2).a.length, 1, 'a record that matches the quiz in front of it is kept, even half-done');
  assert.strictEqual(s.picked(2, 0), 0, 'and its answer is still the answer given');
  assert.strictEqual(JSON.parse(p.store.tsid_herb_notes_v1).quizN, s.QUIZ_N, 'the marker is written back');
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
  // thirty days. Day 30 is an ordinary teaching day now, with only five
  // questions, so the header could report a five-question "test". The header is
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

// 13 Oct 2026, at Jacques's word "link them and deepen them": the library and the
// Certification were two islands. The course now opens the ninety-day
// Certification, and a link from the Certification lands on the exact tab and
// day it names - #d12 on the course, #safety on the lines that outrank it.
test('the herb library links out to the Certification and reads a deep link', () => {
  const html = fs.readFileSync(path.join(ROOT, 'herbs.html'), 'utf8');
  assert.match(html, /href="\/certify#herbalist"/, 'the course links to the ninety-day Certification');

  const p = loadPage('herbs.html');
  // A completion link from a course-lesson opens the tab and the day it names.
  p.sandbox.window.location = { hash: '#d12', search: '' };
  p.sandbox.applyDeepLink();
  assert.strictEqual(p.sandbox.tab, 'course', 'a course-day link opens the 60 days tab');
  assert.strictEqual(p.sandbox.openId, 'd12', 'and the day it names');

  // The safety tab, the plant cards and the rest are reachable the same way.
  p.sandbox.window.location = { hash: '#safety', search: '' };
  p.sandbox.applyDeepLink();
  assert.strictEqual(p.sandbox.tab, 'safety', 'the read-first tab is a real address');
  assert.strictEqual(p.sandbox.openId, null, 'and opens no card of its own');

  // The query shape a shared link travels in works too.
  p.sandbox.window.location = { hash: '', search: '?tab=course&day=30' };
  p.sandbox.applyDeepLink();
  assert.strictEqual(p.sandbox.tab, 'course');
  assert.strictEqual(p.sandbox.openId, 'd30');
});

// 13 Oct 2026, at Jacques's next word: "link to plant cards add cross progress
// bridge". The lessons no longer stop at the shelf - a lesson that names garlic
// opens the garlic card - and the two pages report each other's progress.
//
// Guarded here, the two quiet failures: an address that lands on the wrong card
// (or on none, blanking the shelf), and a bridge that reads a key nothing writes
// so progress never actually crosses.
test('the herb library: a plant has its own address, and a lesson can land on it', () => {
  const p = loadPage('herbs.html');
  const s = p.sandbox;
  assert.strictEqual(s.plantSlug('Marshmallow root'), 'marshmallow-root', 'the slug rule');
  assert.strictEqual(s.plantSlug("St John\u2019s wort"), 'st-john-s-wort', 'and it matches the Certification\u2019s');

  // An exact name, and a name a lesson gives in passing, both resolve.
  assert.ok(s.findPlant('Garlic'), 'an exact name resolves to a card');
  assert.ok(s.findPlant('Marshmallow'), 'a shortened name resolves to the full card');
  assert.ok(s.findPlant('Aloe'), 'and so does aloe');
  assert.strictEqual(s.findPlant('nothing here'), null, 'a name the library does not have resolves to nothing');

  // Every plant card carries its own address, so a link can land on it.
  assert.match(s.card({ n: 'Garlic', u: 'x' }), /id="p-garlic"/);

  // #p-<slug> opens the A-Z shelf on that card.
  s.window.location = { hash: '#p-garlic', search: '' };
  s.applyDeepLink();
  assert.strictEqual(s.tab, 'az', 'a plant link opens the A-Z tab');
  assert.ok(s.openId, 'and opens a card');

  // ?plant=<name> is the same address in the shape a shared link travels in.
  s.window.location = { hash: '', search: '?plant=marshmallow' };
  s.applyDeepLink();
  assert.strictEqual(s.tab, 'az');
  assert.ok(s.openId, 'the query shape opens the card too');

  // A name the library does not have leaves the A-Z shelf open rather than blank.
  s.window.location = { hash: '#p-nonesuch', search: '' };
  s.applyDeepLink();
  assert.strictEqual(s.tab, 'az');
  assert.strictEqual(s.openId, null, 'nothing is opened for a name that is not here');
});

test('the herb library: every plant the Certification links to resolves to a card here', () => {
  // This is the cross-page half of "link to plant cards": the Certification's own
  // GO_DEEPER names the plants, and every one of those names has to open a card
  // on this page. A mistyped or renamed plant would otherwise send a student to
  // the shelf and not the plant.
  const cert = fs.readFileSync(path.join(ROOT, 'certify.html'), 'utf8');
  const m = cert.match(/var GO_DEEPER = (\{[\s\S]*?\n\});/);
  assert.ok(m, 'the Certification keeps its deeper layers in GO_DEEPER');
  const deeper = new Function('return ' + m[1])();
  const p = loadPage('herbs.html');
  const s = p.sandbox;
  let links = 0;
  for (const tid of Object.keys(deeper)) {
    for (const d of Object.keys(deeper[tid])) {
      for (const name of (deeper[tid][d].cards || [])) {
        links++;
        assert.ok(s.findPlant(name), `the Certification links "${name}" but the library has no such card`);
      }
    }
  }
  assert.ok(links >= 30, `the Certification links its plants (${links} found)`);
});

test('the herb library: the course shows the Certification progress beside its own', () => {
  const p = loadPage('herbs.html', {
    tsid_certify_v1: JSON.stringify({ name: '', tracks: { herbalist: {
      days: { 1: { passed: true }, 2: { passed: true }, 3: { passed: true } }, tests: {}, exam: null,
    } } }),
  });
  const s = p.sandbox;
  const c = s.certProgress();
  assert.strictEqual(c.done, 3, 'three passed days are read from the Certification store');
  assert.strictEqual(c.total, 90);
  assert.match(s.certBridgeText(), /3 of 90 days done/);

  s.tab = 'course';
  s.render();
  const view = p.els.get('view').innerHTML;
  assert.match(view, /Cross progress &middot; the Certification/, 'the bridge is on the course view');
  assert.match(view, /3 of 90 days done/, 'and reports the Certification\u2019s own numbers');

  // An untouched Certification reads as not started, never as an error.
  const q = loadPage('herbs.html');
  assert.match(q.sandbox.certBridgeText(), /has not been started yet/);
});

test('the herb library: saving a day writes the progress the Certification reads', () => {
  const p = loadPage('herbs.html');
  const s = p.sandbox;
  const day = s.COURSE.filter((d) => d.d === 2)[0];
  day.q.forEach((q, i) => s.answer(2, i, q.k));
  const written = JSON.parse(s.localStorage.getItem('tsid_herb_progress_v1'));
  assert.strictEqual(written.done, 1, 'the day is counted');
  assert.strictEqual(written.total, 59, 'against the fifty-nine teaching days');
  assert.strictEqual(written.passed, false, 'and the test is not claimed until it is passed');
});
