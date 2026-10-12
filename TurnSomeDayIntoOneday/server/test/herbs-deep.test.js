// The herb library's two new tabs, added 11 Oct 2026 — the Meal plan and the
// Deep story.
//
// Jacques, in one message: "really build out the herb app go deep more quiz and
// lessons ... longer quiz in depth lessons meal plans based around all that for
// beginners trying to break sugar and food addictions ... the theory behind why
// those herbs work ... the history ... the real purpose of modern day food and
// medicine ... the number one deadly disease mucus".
//
// What this checks is not the prose. It is the places a tab like this goes
// quietly wrong:
//
//   1. a section that opens onto nothing, or a row that is half a row;
//   2. the books' claims drifting into the page's own voice, which is the one
//      thing the whole library is careful about;
//   3. a meal plan with dairy or fried food on it, which is the one thing the
//      books exclude;
//   4. a quiz whose answer index points at an option that is not there, or a
//      pass mark nobody can reach — the page would then mark every answer
//      wrong, or refuse to pass anybody;
//   5. the four claims the page promises not to make coming back.
//
// The page is run for real in a stub DOM, the same way herbs-course.test.js
// runs it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const HTML = fs.readFileSync(path.join(ROOT, 'herbs.html'), 'utf8');

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
  const said = [];
  const sandbox = {
    document: doc, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set, Intl,
    localStorage: { getItem() { return null }, setItem() {}, removeItem() {} },
    fetch: async () => ({ status: 200, ok: true, json: async () => ({ content: [] }) }),
    scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: 'node' },
    speechSynthesis: {
      speak(u) { said.push(u) }, cancel() {}, getVoices() { return [{ name: 'Phone voice', lang: 'en-GB', default: true }] },
      speaking: false, addEventListener() {},
    },
  };
  sandbox.SpeechSynthesisUtterance = function (text) { this.text = text };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(inlineScript(file), sandbox, { filename: file });
  return { sandbox, els, said };
}

const TABS = ['data-t="meal">Meal plan', 'data-t="deep">The deep story'];

test('the herb library: the two new tabs are doors in the page, and both render', () => {
  for (const t of TABS) assert.ok(HTML.includes(t), `the tab is on the page: ${t}`);
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'deep';
  p.sandbox.render();
  assert.match(p.els.get('view').innerHTML, /data-h="dp0"/, 'the deep story renders its first section');
  assert.match(p.els.get('view').innerHTML, /data-h="dp13"/, 'and its last one');
  p.sandbox.tab = 'meal';
  p.sandbox.render();
  const meal = p.els.get('view').innerHTML;
  assert.match(meal, /data-h="mp0"/, 'the meal plan renders its rules');
  assert.match(meal, /data-h="m1"/, 'its first day');
  assert.match(meal, /data-h="m30"/, 'and its last one');
  assert.match(meal, /data-ansm="0:0"/, 'and its quiz');
});

test('the herb library: every new section opens onto something', () => {
  const p = loadPage('herbs.html');
  for (const [name, list] of [['DEEP', p.sandbox.DEEP], ['MEALP', p.sandbox.MEALP]]) {
    assert.ok(list.length >= 8, `${name} has its sections: ${list.length}`);
    for (const b of list) {
      assert.ok(b.h && b.h.length > 5, `${name}: a section is titled "${b.h}"`);
      assert.ok(b.s && b.s.length > 3, `${name}: "${b.h}" has a subtitle`);
      assert.ok(Array.isArray(b.rows) && b.rows.length >= 1, `${name}: "${b.h}" has rows`);
      for (const r of b.rows) {
        assert.strictEqual(r.length, 2, `${name}: "${b.h}" has a half a row`);
        assert.ok(r[0] && r[0].length > 1, `${name}: a row has no label`);
        assert.ok(r[1] && r[1].length > 10, `${name}: the row "${r[0]}" says nothing`);
      }
    }
  }
});

test('the herb library: the deep story carries the books\u2019 own lines, by name', () => {
  // The whole point of the tab is that it is the books' material in one place,
  // so the lines that were pulled out of the books have to be in the data and
  // not only in the course.
  const p = loadPage('herbs.html');
  const data = JSON.stringify(p.sandbox.DEEP);
  const must = [
    [/destructive depressive immune retardants/, 'the book on sugar'],
    [/seventy percent fruit sugar and thirty percent sucrose/, 'the honey chart'],
    [/the chart of the two great truths/i, 'the chart'],
    [/alfalfa or chamomile, balances that drain/, 'the chart at work'],
    [/the liver is at its most active at one in the morning/, 'the organ clock'],
    [/Twelve noon to seven in the evening/, 'the twenty-four hour cycle'],
    [/This is a breakfast that can greet you at the cemetery/, 'the breakfast chapter'],
    [/A diet of raw fruit and vegetables naturally brushes the teeth/, 'the teeth chapter'],
    [/three pounds of caked-up waste in the rectum/, 'mucus, and the figure it gives'],
    [/liquid, slimy manure called mucus or plaque/, 'what the book calls mucus'],
    [/Diseases create wealth for the disease industry/, 'the economics'],
    [/cannot be separated any more than technology and pollution can/, 'the two industries'],
    [/Sickness is a profitable business controlled and created by the disease industry/, 'the history'],
    [/has adjusted to that place, and is generally good for the diseases of that environment/, 'food and place'],
  ];
  for (const [re, what] of must) {
    assert.match(data, re, `the deep story carries ${what}`);
  }
  assert.strictEqual(p.sandbox.DEEP.length, 14, 'and the shelf is whole');
});

test('the herb library: the deep story says whose claims these are, and who outranks it', () => {
  const p = loadPage('herbs.html');
  const data = JSON.stringify(p.sandbox.DEEP);
  assert.match(data, /printed as its claim/, 'the tab says the claims are the books\u2019');
  assert.match(data, /The safety tab outranks this tab/, 'and that the safety tab outranks it');
  // Reworded on 12 Oct 2026 at the owner's request: the warnings stay, the
  // "go and see a doctor" wording is gone.
  assert.match(data, /An infection outranks this section/, 'the infection line comes first');
  assert.match(data, /stays in the book/, 'and the claims that stay in the book are named');
  // The four claims the page promises not to make, each named as left behind.
  for (const t of [/not passed from person to person/, /inoculations cause epidemics/, /a herb undoes junk food/, /blame a people rather than a system/]) {
    assert.match(data, t, `the tab names the claim it leaves: ${t}`);
  }
  // And a figure the book gives without a study says so, rather than being
  // sharpened into a fact.
  assert.match(data, /gives no study for those figures/, 'the figures are not sharpened');
});

test('the herb library: the deep story reads out loud like the rest of the page', () => {
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'deep';
  p.sandbox.openId = 'dp0';
  p.sandbox.render();
  assert.match(p.els.get('view').innerHTML, /data-say="dp0"/, 'an open section carries its own read button');
  assert.equal(p.said.length, 0, 'drawing it does not start reading');
  p.sandbox.say('dp0');
  assert.equal(p.said.length, 1, 'one press, one reading');
  assert.ok(p.said[0].text.indexOf(p.sandbox.DEEP[0].h) === 0, 'it starts by naming the section');
  assert.doesNotMatch(p.said[0].text, /<[^>]*>/, 'and no HTML tag is read out loud');
});

test('the herb library: the meal plan is thirty days, numbered once each, with a morning and an evening', () => {
  const p = loadPage('herbs.html');
  const days = p.sandbox.MEALS;
  assert.strictEqual(days.length, 30, 'thirty days');
  const seen = [];
  for (const m of days) {
    assert.ok(m.t && m.t.length > 3, `day ${m.d} has a name`);
    assert.ok(m.b && m.b.length > 5, `day ${m.d} has a morning`);
    assert.ok(m.l && m.l.length > 20, `day ${m.d} has a midday`);
    assert.ok(m.dn && m.dn.length > 20, `day ${m.d} has an evening`);
    assert.ok(m.dr && m.dr.length > 3, `day ${m.d} says what to drink`);
    assert.ok(!seen.includes(m.d), `day ${m.d} is numbered once`);
    seen.push(m.d);
  }
  for (let n = 1; n <= 30; n++) assert.ok(seen.includes(n), `day ${n} exists`);
  // Every morning is fruit and water, which is the book's African breakfast.
  for (const m of days) {
    assert.match(m.b, /Water/, `day ${m.d} starts with water`);
  }
});

test('the herb library: nothing on the meal plan is dairy or fried', () => {
  // The book's two exclusions. A plan that carried either one would be
  // claiming the books and not keeping them.
  const p = loadPage('herbs.html');
  const BANNED = /\b(milk|cheese|butter|cream|yogurt|yoghurt|fried|fry|deep-fat)\b/i;
  for (const m of p.sandbox.MEALS) {
    // "butter beans" is a bean and not the dairy, so the two words are taken
    // out before the check rather than the check being loosened.
    const text = [m.t, m.b, m.l, m.dn, m.sk, m.dr, m.note || ''].join(' ')
      .replace(/butter\s+beans?/gi, 'beans');
    assert.doesNotMatch(text, BANNED, `day ${m.d} carries dairy or fried food: ${text}`);
  }
  // And the plan says so on its own rules, rather than leaving it to be noticed.
  const data = JSON.stringify(p.sandbox.MEALP);
  assert.match(data, /No dairy and no fried food/, 'the rules name the two exclusions');
  assert.match(data, /three things off the list/i, 'and the three white things');
});

test('the herb library: the meal quiz is well formed, and its pass mark is reachable', () => {
  const p = loadPage('herbs.html');
  const quiz = p.sandbox.MEAL_QUIZ;
  assert.ok(quiz.length >= 10, `the quiz has its questions: ${quiz.length}`);
  quiz.forEach((q, i) => {
    const where = `meal question ${i + 1}`;
    assert.ok(q.q && q.q.length > 5, `${where} asks something`);
    assert.ok(Array.isArray(q.a) && q.a.length >= 3, `${where} offers at least three answers`);
    assert.ok(Number.isInteger(q.k) && q.k >= 0 && q.k < q.a.length, `${where}: the answer index is one of its options`);
    q.a.forEach((t) => assert.ok(t && t.length, `${where}: no blank option`));
    assert.strictEqual(new Set(q.a).size, q.a.length, `${where}: no option is offered twice`);
    assert.ok(q.w && q.w.length > 5, `${where} says why`);
  });
  const pass = p.sandbox.MEAL_PASS;
  assert.ok(pass > 0 && pass <= quiz.length, 'the pass mark is a score somebody could reach');
});

test('the herb library: the meal quiz scores, passes, and can be taken again', () => {
  const p = loadPage('herbs.html');
  const s = p.sandbox;
  const quiz = s.MEAL_QUIZ;

  // Nothing answered: no score yet.
  assert.strictEqual(s.mealScore().done, false, 'nothing is scored before it is answered');
  assert.strictEqual(s.mealPicked(0), -1, 'and no answer is assumed');

  // One wrong answer counts as answered and does not score.
  const wrong = (quiz[0].k + 1) % quiz[0].a.length;
  s.mealPick(0, wrong);
  assert.strictEqual(s.mealScore().right, 0, 'a wrong answer scores nothing');
  s.mealPick(0, quiz[0].k);
  assert.strictEqual(s.mealScore().right, 1, 'and the answer can be changed to the right one');

  // Answer them all right, and the plan says so.
  quiz.forEach((q, i) => s.mealPick(i, q.k));
  const score = s.mealScore();
  assert.strictEqual(score.done, true, 'a full set of answers is a result');
  assert.strictEqual(score.right, quiz.length, 'all of them right');
  assert.ok(score.right >= s.MEAL_PASS, 'which passes');
  s.tab = 'meal';
  s.render();
  assert.match(p.els.get('view').innerHTML, /Passed/, 'and the page says so');

  // And a failing run is a result too, not a blank.
  for (let i = 0; i < quiz.length; i++) s.mealPick(i, (quiz[i].k + 1) % quiz[i].a.length);
  const failed = s.mealScore();
  assert.strictEqual(failed.done, true, 'a wrong run is finished');
  assert.strictEqual(failed.right, 0, 'with nothing right');
  s.render();
  assert.match(p.els.get('view').innerHTML, /Not yet/, 'and the page says that too');
});

test('the herb library: the meal plan sends a condition to a doctor, and says the plan is not a cure', () => {
  const p = loadPage('herbs.html');
  const data = JSON.stringify(p.sandbox.MEALP);
  assert.match(data, /diabetes/i, 'the plan speaks about diabetes');
  assert.match(data, /This page does not manage diabetes/, 'and says plainly that it does not manage it');
  // Reworded on 12 Oct 2026 at the owner's request, as above.
  assert.match(data, /made with whoever is managing it/, 'and puts the change with whoever is managing it');
  assert.match(data, /Alcohol withdrawal can kill/, 'the withdrawal line is on the plan too');
  assert.match(data, /is a reason to stop anything somebody is already taking/, 'and what somebody takes stays where it was');
  assert.match(data, /Food, not a cure/, 'and the plan says what it is');
  // And the tab's own section on conditions is the loud one, not a footnote.
  const last = p.sandbox.MEALP.filter((b) => /condition in the house/.test(b.h))[0];
  assert.ok(last, 'there is a section on conditions in the house');
  assert.strictEqual(last.noteCls, 'redbox', 'and it is the loud one');
});

test('the herb library: the meals read out loud, one press and one reading', () => {
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'meal';
  p.sandbox.openId = 'm1';
  p.sandbox.render();
  assert.match(p.els.get('view').innerHTML, /data-say="m1"/, 'an open day carries its own read button');
  assert.equal(p.said.length, 0, 'drawing it does not start reading');
  p.sandbox.say('m1');
  assert.equal(p.said.length, 1, 'one press, one reading');
  assert.match(p.said[0].text, /^Day 1\./, 'it starts by naming the day');
  assert.match(p.said[0].text, /Morning\./, 'it reads the morning');
  assert.match(p.said[0].text, /Evening\./, 'and the evening');
  assert.doesNotMatch(p.said[0].text, /<[^>]*>/, 'and no HTML tag is read out loud');
});
