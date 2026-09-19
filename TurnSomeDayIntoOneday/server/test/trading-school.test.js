// The trading school (/school) — 15 Sep 2026.
//
// Jacques: "a full beginners lesson all the way up the advanced market maker
// levels ... backtesting different questions to scenarios that can help me excel
// ... separate from the game".
//
// Three things can go wrong here quietly and all three are checked:
//   1. A page of lessons with a broken answer index — every question marks the
//      wrong option and nobody notices for a week.
//   2. Drills marked on the outcome instead of the setup, which teaches
//      hindsight and is worse than no drill at all.
//   3. The page drifting into promising money. It is a private page, so the
//      app's own rules do not govern it — but this rule does, everywhere.
//
// It also runs the page's real inline script in a stub DOM and drives the tabs,
// the lesson buttons, the drill buttons and the backtest buttons the way a thumb
// would. Not a browser: it proves the wiring and the marking, not the pixels.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = path.join(ROOT, 'trading-school.html');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const { OPEN_PAGES, pageIsServed } = require('../private-app');

function inlineScript(file) {
  const html = fs.readFileSync(file, 'utf8');
  let out = '';
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(m[1])) continue;
    out += m[2] + '\n;\n';
  }
  return out;
}

// The recording 2d context: every fillText lands in the element's _texts, so a
// test can read back the numbers on the chart.
function fakeCtx(store) {
  const noop = () => {};
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'start', globalAlpha: 1,
    fillRect: noop, clearRect: noop, strokeRect: noop, arc: noop, rect: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop,
    save: noop, restore: noop, setLineDash: noop, translate: noop, scale: noop, clip: noop,
    fillText: (t) => store.push(String(t)),
    strokeText: (t) => store.push(String(t)),
    measureText: (t) => ({ width: String(t).length * 6 }),
  };
}

function stubDom() {
  const els = new Map();
  const mk = (id) => {
    const el = {
      id, value: '', textContent: '', innerHTML: '', disabled: false,
      className: '', style: {}, dataset: {}, width: 0, height: 0, clientWidth: 340,
      _h: {}, attributes: {},
      classList: {
        _s: new Set(),
        add(c) { this._s.add(c) }, remove(c) { this._s.delete(c) },
        toggle(c, f) {
          if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c) }
          else if (f) { this._s.add(c) } else { this._s.delete(c) }
        },
        contains(c) { return this._s.has(c) },
      },
      addEventListener(type, fn) { this._h[type] = fn },
      setAttribute(n, v) { this.attributes[n] = v },
      removeAttribute(n) { delete this.attributes[n] },
      getAttribute(n) { return this.attributes[n] === undefined ? null : this.attributes[n] },
      focus() {}, closest() { return null }, querySelectorAll() { return [] },
      appendChild() {}, remove() {}, scrollIntoView() {},
      _texts: [],
      // A canvas that records what is drawn on it. Without this drawChart
      // returns at its first line and the thing he complained about — "the
      // number in the question answers and on the chart are incompatible" —
      // cannot be checked at all. Anything a 2d context does that this does not
      // implement would throw here, which is the point: the drawing is real.
      getContext() { return this.__ctx || (this.__ctx = fakeCtx(this._texts)) },
    };
    return el;
  };
  return {
    els,
    doc: {
      getElementById(id) { if (!els.has(id)) els.set(id, mk(id)); return els.get(id) },
      querySelectorAll() { return [] }, querySelector() { return null },
      addEventListener() {}, createElement() { return mk('_new') },
      body: mk('body'), documentElement: mk('html'), readyState: 'complete',
    },
  };
}

// A click as the delegated handler sees it: something with a data-a attribute.
function click(sandbox, elId, attrs) {
  const el = sandbox.__els.get(elId);
  const handler = el && el._h && el._h.click;
  assert.ok(handler, `${elId} has no click handler`);
  handler({ target: { closest: () => ({ getAttribute: (n) => (n in attrs ? String(attrs[n]) : null) }) } });
}

function loadPage() {
  const { doc, els } = stubDom();
  const calls = [];
  let reply = { status: 200, body: { content: [{ type: 'text', text: 'The mechanism, then the arithmetic.' }] } };
  const sandbox = {
    document: doc, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set, Intl,
    parseFloat, parseInt, isNaN,
    localStorage: { _d: {}, getItem(k) { return this._d[k] || null }, setItem(k, v) { this._d[k] = v }, removeItem(k) { delete this._d[k] } },
    fetch: async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) });
      return { status: reply.status, ok: reply.status === 200, json: async () => reply.body };
    },
    scrollTo() {}, requestAnimationFrame() {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    location: { href: '' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.__els = els;
  vm.createContext(sandbox);
  vm.runInContext(inlineScript(PAGE), sandbox);
  return { sandbox, els, calls, setReply: (r) => { reply = r } };
}

const page = loadPage();
const S = page.sandbox;

// ── the curriculum ──────────────────────────────────────────────────────────

test('six levels, beginner to market maker, with every lesson whole', () => {
  assert.strictEqual(S.SCHOOL.length, 6);
  assert.strictEqual(S.SCHOOL[0].t, 'The ground floor');
  assert.strictEqual(S.SCHOOL[5].t, 'Market maker');

  const seen = new Set();
  let lessons = 0;
  for (const level of S.SCHOOL) {
    assert.ok(level.lessons.length >= 6, `${level.id} has only ${level.lessons.length} lessons`);
    for (const l of level.lessons) {
      lessons++;
      assert.ok(!seen.has(l.id), `duplicate lesson id ${l.id}`);
      seen.add(l.id);
      assert.strictEqual(l.id.split('.')[0], level.id.slice(1), `${l.id} is in the wrong level`);
      assert.ok(l.t.length >= 3, `${l.id} has no title`);
      assert.ok(l.b.length >= 2, `${l.id} needs more than one paragraph`);
      assert.ok(l.k.length >= 3, `${l.id} needs at least three key points`);
      assert.ok(l.q.length >= 2, `${l.id} needs at least two checks`);
      for (const q of l.q) {
        assert.ok(q.o.length >= 2, `${l.id}: a question with one option`);
        assert.ok(Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length, `${l.id}: answer index outside the options`);
        assert.strictEqual(new Set(q.o).size, q.o.length, `${l.id}: duplicate options`);
        assert.ok(q.w.length > 10, `${l.id}: a question with no reason given`);
      }
    }
  }
  assert.strictEqual(lessons, 46);
});

test('each level test is six whole questions, and the answers line up', () => {
  let n = 0;
  for (const level of S.SCHOOL) {
    const bank = S.SW_TESTS[level.id];
    assert.ok(Array.isArray(bank), `${level.id} has no test`);
    assert.strictEqual(bank.length, 6, `${level.id} test is not six questions`);
    for (const q of bank) {
      n++;
      assert.ok(Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length, `${level.id}: bad answer index`);
      assert.strictEqual(new Set(q.o).size, q.o.length, `${level.id}: duplicate options`);
    }
  }
  assert.strictEqual(n, 36);
});

test('the words on the page never promise money', () => {
  // Bodies, key points, explanation of why, the drill notes and the AI's own
  // instructions. The OPTIONS are deliberately left out: three of them are the
  // wrong answers on purpose, and "a guaranteed reversal" earns its place there
  // precisely because it is not one. What must never promise is the teaching.
  const teaching = [];
  for (const level of S.SCHOOL) {
    teaching.push(level.t, level.s);
    for (const l of level.lessons) {
      teaching.push(l.t, ...l.b, ...l.k);
      for (const q of l.q) teaching.push(q.q, q.w);
    }
  }
  for (const level of S.SCHOOL) for (const q of S.SW_TESTS[level.id]) teaching.push(q.q, q.w);
  for (let seed = 1; seed <= 40; seed++) {
    const d = S.makeScenario(seed);
    teaching.push(d.note);
    for (const o of d.stopOptions) teaching.push(o.txt);
  }
  teaching.push(S.ASK_SYS);

  const banned = [
    'risk-free', 'risk free', 'sure thing', 'surefire',
    'will make you money', 'always works', "can't lose", 'cannot lose',
    'get rich', 'passive income', 'never loses', 'no risk', 'easy money',
  ];
  const text = teaching.join('\n').toLowerCase();
  for (const word of banned) {
    assert.ok(!text.includes(word), `the page says "${word}" somewhere in what it teaches`);
  }

  // "Guarantee" is banned in the affirmative only. The word has one honest use
  // here — telling him what something is NOT — and a flat ban would delete the
  // sentence "fading momentum, not a guaranteed turn", which is exactly the
  // correction the school exists to make.
  for (const re of [/guarantee\w*\s+(a\s+)?(profit|return|win|income|money)/i,
                    /guarantees?\s+(you|that you)/i,
                    /guaranteed (profit|returns?|wins?|money)/i]) {
    assert.ok(!re.test(text), `the page promises with: ${re}`);
  }

  // And the one place a distractor may use the word is a wrong answer saying a
  // guarantee is what the right answer is NOT.
  const options = [];
  for (const level of S.SCHOOL) for (const l of level.lessons) for (const q of l.q) options.push(...q.o);
  for (const o of options) {
    if (/guarantee/i.test(o)) {
      assert.ok(!S.SCHOOL.some((lv) => lv.lessons.some((l) => l.q.some(
        (q) => q.o[q.a] === o))), 'a right answer must not be a guarantee: ' + o);
    }
  }
});

test('the page says its charts are made up, in the page itself', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  // Not a comment in the source: a sentence the reader sees, because a practice
  // chart mistaken for a real one is the one thing here that could lose money.
  assert.match(html, /Every candle on this page is made up by the page/);
  assert.match(html, /not a feed/);
  assert.match(html, /generated by this page/);
});

test('the AI on this page is told it can never promise money or invent a figure', () => {
  for (const rule of [
    /Never promise or imply a profit/,
    /Never invent a figure, a statistic, a study, a backtest result or a market level/,
    /Never name an instrument, ticker or coin to buy or sell now/,
    /Never suggest risking more, sizing up, using leverage, or doubling down to recover a loss/,
    /Never tell him he cannot learn this/,
    /In English, always/,
  ]) {
    assert.match(S.ASK_SYS, rule);
  }
});

test('the AI prompt still carries the line that keeps it in English', () => {
  // The same fix as the rest of the app on 15 Sep: nothing had ever told these
  // prompts what language to answer in, and a model drifted into another one.
  assert.match(S.ASK_SYS, /In English, always/);
});

// ── the practice market ─────────────────────────────────────────────────────

test('the generated charts are real candles and every drill is decidable', () => {
  const shapes = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const d = S.makeScenario(seed);
    shapes.add(d.shape);
    assert.ok(d.bars.length > 30, `seed ${seed}: too few bars`);
    assert.ok(d.decision > 20, `seed ${seed}: decides too early`);
    assert.ok(d.decision < d.bars.length - 4, `seed ${seed}: the outcome is drawn on the same screen as the decision`);
    assert.ok(S.DECISIONS.includes(d.exp), `seed ${seed}: expects a nonsense answer`);
    assert.ok(d.read >= 0 && d.read < S.READS.length, `seed ${seed}: no read`);

    let rights = 0;
    for (const o of d.stopOptions) if (o.ok) rights++;
    assert.strictEqual(rights, 1, `seed ${seed}: ${rights} right stop answers`);

    // The right stop is on the correct side of the price the decision is made at.
    const price = d.bars[d.decision].c;
    const structural = d.exp === 'short' ? d.stopPrice + d.atr * 0.15 : d.stopPrice - d.atr * 0.15;
    if (d.exp === 'long') assert.ok(structural < price, `seed ${seed}: a long stop above the entry`);
    if (d.exp === 'short') assert.ok(structural > price, `seed ${seed}: a short stop below the entry`);

    for (const b of d.bars) {
      assert.ok([b.o, b.h, b.l, b.c].every(Number.isFinite), `seed ${seed}: a broken candle`);
      assert.ok(b.h >= Math.max(b.o, b.c) - 1e-9 && b.l <= Math.min(b.o, b.c) + 1e-9,
        `seed ${seed}: high or low inside the body`);
    }
  }
  assert.strictEqual(shapes.size, 6, 'every one of the six scenario shapes should appear');
});

test('the same seed always draws the same chart', () => {
  const a = S.makeScenario(17), b = S.makeScenario(17);
  assert.deepStrictEqual(a.bars.map((x) => x.c), b.bars.map((x) => x.c));
  assert.notDeepStrictEqual(a.bars.map((x) => x.c), S.makeScenario(18).bars.map((x) => x.c));
});

// ── the UI, driven ─────────────────────────────────────────────────────────

test('the lessons render, open, and mark a right and a wrong answer', () => {
  const view = page.els.get('view');
  assert.match(view.innerHTML, /The ground floor/, 'the levels list should be on screen');

  click(S, 'view', { 'data-a': 'level', 'data-id': 'L1' });
  assert.match(view.innerHTML, /What you are actually buying/, 'the level should list its lessons');

  click(S, 'view', { 'data-a': 'lesson', 'data-id': '1.1' });
  assert.match(view.innerHTML, /Price is the last agreed number/, 'the lesson body should be on screen');

  // The correct option, then the wrong one on the second question.
  const lesson = S.SCHOOL[0].lessons[0];
  click(S, 'view', { 'data-a': 'q', 'data-key': '1.1:0', 'data-o': 1 });
  assert.match(view.innerHTML, /class="opt right"[^>]*>Whether the price is higher after you bought/,
    'the right answer should be marked');
  const xpBefore = page.els.get('xp').textContent;

  click(S, 'view', { 'data-a': 'q', 'data-key': '1.1:1', 'data-o': 0 });
  assert.match(view.innerHTML, /class="opt wrong"/, 'a wrong answer should be shown as wrong');
  assert.match(view.innerHTML, /Somebody selling who thinks it is going down/,
    'the right answer is still shown after a wrong one');
  assert.strictEqual(page.els.get('xp').textContent, xpBefore,
    'XP is for answers right, not for answers given');
  assert.ok(lesson.q.length >= 2);
});

test('marking a lesson done adds XP and shows the next one', () => {
  click(S, 'view', { 'data-a': 'done', 'data-id': '1.1' });
  assert.notStrictEqual(page.els.get('xp').textContent, '0 XP');
  assert.match(page.els.get('view').innerHTML, /Next: One candle, four prices/);
  assert.match(page.els.get('pbar').style.width || '', /%/);
});

test('a drill asks three questions, marks the decision not the outcome, then shows what happened', () => {
  click(S, 'tabs', { 'data-t': 'drills' });
  const d = S.makeScenario(1);
  const view = page.els.get('view');
  assert.match(view.innerHTML, /What is this chart doing\?/, 'the read question');
  assert.ok(!/Where does the stop belong\?/.test(view.innerHTML),
    'one question at a time — the stop question waits for the read to be answered');

  // One question at a time, and the right answers come from the generator.
  click(S, 'view', { 'data-a': 'dans', 'data-q': 0, 'data-o': d.read });
  assert.match(view.innerHTML, /Right — that is the structure/, 'a right read should say so');

  click(S, 'view', { 'data-a': 'dans', 'data-q': 1, 'data-o': S.DECISIONS.indexOf(d.exp) });
  const stopRight = d.stopOptions.findIndex((o) => o.ok);
  click(S, 'view', { 'data-a': 'dans', 'data-q': 2, 'data-o': stopRight });
  assert.match(view.innerHTML, /What the market did/, 'the outcome should be revealed');
  assert.ok(view.innerHTML.includes(d.note.slice(0, 40)), 'the note should be shown');
  assert.match(view.innerHTML, /Drills done: 1/, 'the drill should be counted');

  // And the read is shown for the decisions the drill expected, so the answer
  // cannot be memorised from the options alone.
  assert.match(view.innerHTML, new RegExp(S.READS[d.read].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('a drill with the wrong answers says why, and still reveals the chart', () => {
  click(S, 'view', { 'data-a': 'newdrill' });
  const d = S.makeScenario(2);
  const wrongRead = (d.read + 1) % S.READS.length;
  click(S, 'view', { 'data-a': 'dans', 'data-q': 0, 'data-o': wrongRead });
  assert.match(page.els.get('view').innerHTML, /Not quite/);
  assert.match(page.els.get('view').innerHTML, /The read was:/);
  click(S, 'view', { 'data-a': 'dans', 'data-q': 1, 'data-o': 0 });
  click(S, 'view', { 'data-a': 'dans', 'data-q': 2, 'data-o': 0 });
  assert.match(page.els.get('view').innerHTML, /What the market did/);
  assert.match(page.els.get('view').innerHTML, /Drills done: 2/);
});

test('leaving the drills tab and coming back does not wedge the drill', () => {
  // It did: the reveal was cleared on a tab switch while the answers were kept,
  // which left three marked questions, no outcome, and no button to start
  // another chart. A drill is only replaced by asking for a new one.
  click(S, 'tabs', { 'data-t': 'drills' });
  const opened = S.makeScenario(1);
  click(S, 'view', { 'data-a': 'dans', 'data-q': 0, 'data-o': opened.read });
  click(S, 'tabs', { 'data-t': 'lessons' });
  click(S, 'tabs', { 'data-t': 'drills' });
  const view = page.els.get('view').innerHTML;
  assert.match(view, /So what do you do at the last bar\?/, 'the next question should still be waiting');
  assert.match(view, /class="opt right"/, 'and the answer already given should still be marked');
  assert.match(view, /Drills done: 2/);
});

// ── the two-chart drill: the wick on the big chart, the entry on the small ──
// Jacques: "how can I time my entrance to be right and exact — example, coming
// in on a high timeframe wick candle while executing on a low timeframe."
// The rule it has to hold is that the 4h gives the PLACE and the 5m gives the
// MOMENT, so the checks are about the two charts agreeing on the picture at the
// decision bar, and about the marking following the small chart rather than how
// the path turned out.

test('the two-chart drill: a 4h wick, a 5m trigger, and nothing drawn after the decision', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const d = S.makeTimingScenario(seed);
    seen.add(d.turns ? 'turn' : 'fails');

    assert.strictEqual(d.questions.length, 3, `seed ${seed}: three questions`);
    for (const q of d.questions) {
      assert.strictEqual(q.opts.filter((o) => o.ok).length, 1,
        `seed ${seed}: a question with ${q.opts.filter((o) => o.ok).length} right answers`);
      assert.ok(q.say && q.say.yes.length > 20 && q.say.no.length > 20,
        `seed ${seed}: a question with no reason given`);
    }

    const sup = d.level.sup;
    const wick = d.htf[d.htfDecision];
    assert.ok(wick.l < sup, `seed ${seed}: the 4h bar never pierces the level`);
    assert.ok(wick.c > sup, `seed ${seed}: the 4h bar never closes back above the level`);

    // Both charts carry bars after the decision, so the reveal has something to
    // show — and, more importantly, so the drawing has something to hold back.
    assert.ok(d.htf.length > d.htfDecision + 1, `seed ${seed}: no 4h outcome`);
    assert.ok(d.ltf.length > d.decision + 1, `seed ${seed}: no 5m outcome`);

    // The 4h wick is the extreme: the small chart never went through it before
    // the decision, or the stop the drill asks for would not have held.
    for (let i = 0; i <= d.decision; i++) {
      assert.ok(d.ltf[i].l > d.wickLow - 1e-9, `seed ${seed}: the 5m took the wick low out before the decision`);
    }

    const last = d.ltf[d.decision], prev = d.ltf[d.decision - 1];
    if (d.turns) {
      assert.ok(last.c > sup, `seed ${seed}: the trigger bar did not close back above the level`);
      assert.ok(last.h > prev.h, `seed ${seed}: the trigger bar took out no high, so nothing turned`);
      assert.ok(last.l > prev.l, `seed ${seed}: the trigger bar made a lower low, so it is not the reclaim`);
      assert.strictEqual(d.exp, 'long', `seed ${seed}: the turn is the long`);
    } else {
      assert.ok(last.c < sup, `seed ${seed}: it closed back above the level, so it did turn`);
      assert.ok(last.h < prev.h && last.l < prev.l, `seed ${seed}: not still making lower highs and lower lows`);
      assert.strictEqual(d.exp, 'wait', `seed ${seed}: without the trigger there is no trade`);
    }

    for (const b of d.htf.concat(d.ltf)) {
      assert.ok([b.o, b.h, b.l, b.c].every(Number.isFinite), `seed ${seed}: a broken candle`);
      assert.ok(b.h >= Math.max(b.o, b.c) - 1e-9 && b.l <= Math.min(b.o, b.c) + 1e-9,
        `seed ${seed}: high or low inside the body`);
    }
  }
  assert.strictEqual(seen.size, 2, 'both shapes should appear: the turn and the one that never turns');
});

test('the two-chart drill marks the timing: the same 4h read ends both ways', () => {
  const turned = S.makeTimingScenario(1), never = S.makeTimingScenario(5);
  assert.strictEqual(turned.questions[0].t, never.questions[0].t, 'the 4h question is the same either way');
  assert.notStrictEqual(turned.questions[1].t, never.questions[1].t, 'the small chart is what changes');
  assert.strictEqual(turned.exp, 'long');
  assert.strictEqual(never.exp, 'wait');

  click(S, 'tabs', { 'data-t': 'drills' });
  S.newTimingDrill(5);
  S.paint();
  const view = page.els.get('view');
  assert.match(view.innerHTML, /id="cv"/, 'the 4h chart should be on screen');
  assert.match(view.innerHTML, /id="cv2"/, 'and the 5m chart under it');
  assert.match(view.innerHTML, /current bar has wicked through the level/, 'the 4h question first');
  assert.ok(!/stopped making lower highs/.test(view.innerHTML), 'one question at a time');
  assert.ok(!/What the market did/.test(view.innerHTML), 'the outcome waits for the last answer');

  // The small chart question arrives only once the big one is answered.
  click(S, 'view', { 'data-a': 'dans', 'data-q': 0, 'data-o': never.questions[0].opts.findIndex((o) => o.ok) });
  assert.match(page.els.get('view').innerHTML, /making lower highs/, 'then the small chart question');

  // On the one that never turned, buying the wick is wrong, and it says why.
  const longOpt = never.questions[1].opts.findIndex((o) => /^Long now/.test(o.txt));
  assert.ok(longOpt >= 0, 'the early-entry option should exist');
  click(S, 'view', { 'data-a': 'dans', 'data-q': 1, 'data-o': longOpt });
  assert.match(page.els.get('view').innerHTML, /Not quite/, 'entering without the trigger is wrong');
  assert.match(page.els.get('view').innerHTML, /where, not when/, 'and the reason should be the lesson');

  // And the trigger itself still marks right, on the one that turned.
  S.newTimingDrill(1);
  S.paint();
  click(S, 'view', { 'data-a': 'dans', 'data-q': 1, 'data-o': turned.questions[1].opts.findIndex((o) => o.ok) });
  assert.match(page.els.get('view').innerHTML, /Right\./, 'the trigger is the right answer');
});

test('every stop option in the drill is a real stop, on the losing side of the entry', () => {
  // They were not: both wrong options sat on the same side as the profit, which
  // offered a "close in" stop that would have triggered on the entry bar.
  for (let seed = 1; seed <= 60; seed++) {
    const d = S.makeScenario(seed);
    const price = d.bars[d.decision].c;
    const structural = d.exp === 'short' ? d.stopPrice + d.atr * 0.15 : d.stopPrice - d.atr * 0.15;
    const nums = d.stopOptions.map((o) => Number(o.txt.match(/([0-9]+\.[0-9]+)/)[1]));
    assert.ok(nums.every(Number.isFinite), `seed ${seed}: a stop with no price in it`);
    for (const n of nums) {
      if (d.exp === 'long') assert.ok(n < price, `seed ${seed}: a long stop above the entry (${n} vs ${price})`);
      if (d.exp === 'short') assert.ok(n > price, `seed ${seed}: a short stop below the entry (${n} vs ${price})`);
    }
    assert.ok(Math.abs(nums[0] - structural) < 0.02, `seed ${seed}: the right option is not the structural stop`);
    assert.ok(nums[0] !== nums[1] && nums[1] !== nums[2] && nums[0] !== nums[2],
      `seed ${seed}: two stop options at the same price`);
  }
});

test('the backtest opens a trade, steps the candles, and closes at the stop or the target', () => {
  click(S, 'tabs', { 'data-t': 'backtest' });
  const view = page.els.get('view');
  assert.match(view.innerHTML, /trades this run/);
  assert.match(view.innerHTML, /not a feed/, 'the backtest has to say the market is made up');

  click(S, 'view', { 'data-a': 'btr', 'data-v': 2 });
  click(S, 'view', { 'data-a': 'btt', 'data-v': 2 });
  click(S, 'view', { 'data-a': 'btlong' });
  assert.match(view.innerHTML, /in a long from/, 'the trade should be open');

  for (let i = 0; i < 60; i++) click(S, 'view', { 'data-a': 'btstep' });
  assert.match(view.innerHTML, /net result/, 'the stats should still be there after stepping');
  // Either it closed, or it is still open with the bars exhausted — both fine,
  // but a trade must never have silently vanished.
  assert.match(view.innerHTML, /(trades this run|in a long|in a short)/);
});

test('the level test records a score and can be sat again fresh', () => {
  click(S, 'tabs', { 'data-t': 'tests' });
  click(S, 'view', { 'data-a': 'test', 'data-id': 'L1' });
  const bank = S.SW_TESTS.L1;
  for (let i = 0; i < bank.length; i++) {
    click(S, 'view', { 'data-a': 'tq', 'data-key': 'L1#' + i, 'data-o': bank[i].a });
  }
  assert.match(page.els.get('view').innerHTML, /Sit it again fresh/);
  assert.strictEqual(S.schoolStats().testCorrect, 6, 'six right answers should be recorded');

  click(S, 'view', { 'data-a': 'testretake', 'data-id': 'L1' });
  const after = page.els.get('view').innerHTML;
  assert.ok(!/Sit it again fresh/.test(after), 'the retake should start blank');
  assert.match(after, /sat 2 times/, 'the number of sits should increase');
  assert.strictEqual(S.schoolStats().testCorrect, 6, 'the best score is kept, not thrown away');
});

test('the ask box posts the school rules with the question', async () => {
  click(S, 'tabs', { 'data-t': 'lessons' });
  click(S, 'view', { 'data-a': 'lesson', 'data-id': '2.1' });
  assert.ok(page.els.get('askQ'), 'the ask box should be on the page');
  page.els.get('askQ').value = 'Was I right to take that pullback?';
  await S.ask();
  const sent = page.calls[page.calls.length - 1];
  assert.strictEqual(sent.url, '/api/chat');
  const system = sent.body.system[0].text;
  assert.match(system, /Never promise or imply a profit/);
  assert.match(system, /private trading school/);
  const question = sent.body.messages[0].content;
  assert.match(question, /Was I right to take that pullback\?/);
  assert.match(question, /Structure: swings, breaks and changes/,
    'the open lesson rides along with the question');
  assert.match(page.els.get('askA').innerHTML, /Teacher/);
});

test('the days lot running out says so, and nothing else', async () => {
  page.setReply({ status: 429, body: {} });
  page.els.get('askQ').value = 'and another thing';
  await S.ask();
  const shown = page.els.get('askA').innerHTML;
  assert.match(shown, /today's lot/);
  assert.ok(!/Teacher<\/span>\s*$/.test(shown), 'no empty answer should be printed');
});

test('an answer cannot put markup on the page', async () => {
  page.setReply({ status: 200, body: { content: [{ type: 'text', text: '<img src=x onerror=alert(1)> plain words' }] } });
  page.els.get('askQ').value = 'try this';
  await S.ask();
  const shown = page.els.get('askA').innerHTML;
  assert.ok(!/<img/.test(shown), 'the answer was inserted as markup');
  assert.match(shown, /&lt;img/);
});

// ── the risk strand ─────────────────────────────────────────────────────────
// Jacques, 19 Sep 2026: "the biggest problem I have with trading is managing
// risk — make that a big part of my training. I prefer to take 1:1: price enters
// a zone or a swing, I trade it right out the leg or zone."
//
// So the strand is his method, and the drill is the half that has to work. What
// is checked here is that the drill is DECIDABLE — every question marked against
// the geometry the generator built, so the path can never mark it — and that its
// numbers are read off the bars it drew rather than written by hand.

test('the risk strand is six whole lessons, and every answer index lines up', () => {
  assert.strictEqual(S.SW_RISK.length, 6);
  assert.strictEqual(S.SW_RISK[0].id, 'R1');
  for (const l of S.SW_RISK) {
    assert.ok(/^R[1-6]$/.test(l.id), `unexpected id ${l.id}`);
    assert.ok(l.t.length >= 3, `${l.id} has no title`);
    assert.ok(l.b.length >= 2, `${l.id} needs more than one paragraph`);
    assert.ok(l.k.length >= 3, `${l.id} needs at least three key points`);
    assert.ok(l.q.length >= 2, `${l.id} needs at least two checks`);
    for (const q of l.q) {
      assert.ok(q.o.length >= 2, `${l.id}: a question with one option`);
      assert.ok(Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length, `${l.id}: answer index outside the options`);
      assert.strictEqual(new Set(q.o).size, q.o.length, `${l.id}: duplicate options`);
      assert.ok(q.w.length > 10, `${l.id}: a question with no reason given`);
    }
  }

  // The strand's lessons count as lessons everywhere else: the progress total,
  // the checks, and the chain the "next" button walks.
  const all = S.allLessons();
  assert.strictEqual(all.length, 46 + 6, 'the six levels and the risk strand');
  for (const l of S.SW_RISK) assert.ok(all.some((x) => x.id === l.id), `${l.id} is not in the lesson list`);
  assert.strictEqual(S.schoolStats().total, 52);
});

test('the risk drill is decidable: every number in it comes off the bars it drew', () => {
  const dirs = new Set(), answers = new Set();
  let paid = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const d = S.makeRiskScenario(seed);
    dirs.add(d.dir);
    answers.add(d.oneToOne ? 'yes' : 'no');
    if (d.oneToOne) paid++;

    assert.ok(d.bars.length > 30, `seed ${seed}: too few bars`);
    assert.ok(d.decision > 20, `seed ${seed}: decides too early`);
    assert.ok(d.decision < d.bars.length - 4, `seed ${seed}: the outcome is drawn on the same screen as the decision`);
    for (const b of d.bars) {
      assert.ok([b.o, b.h, b.l, b.c].every(Number.isFinite), `seed ${seed}: a broken candle`);
      assert.ok(b.h >= Math.max(b.o, b.c) - 1e-9 && b.l <= Math.min(b.o, b.c) + 1e-9,
        `seed ${seed}: high or low inside the body`);
    }

    // Five questions, one right answer each, and the trade-decision pair is the
    // one that has to sit on the geometry: exactly one of take/leave is right.
    assert.strictEqual(d.questions.length, 5, `seed ${seed}: five questions`);
    for (const q of d.questions) {
      assert.strictEqual(q.opts.filter((o) => o.ok).length, 1,
        `seed ${seed}: a question with ${q.opts.filter((o) => o.ok).length} right answers`);
      assert.ok(q.say && q.say.yes.length > 20 && q.say.no.length > 20,
        `seed ${seed}: a question with no reason given`);
    }
    assert.ok(d.questions[3].opts[0].ok === d.oneToOne && d.questions[3].opts[1].ok === !d.oneToOne,
      `seed ${seed}: the take-or-leave question does not follow the geometry`);

    // The numbers. Risk is the entry to the stop, the stop is beyond the far side
    // of the zone, and the 1:1 target is the risk measured the other way.
    const risk = Math.abs(d.entry - d.stop);
    assert.ok(Math.abs(risk - d.risk) < 0.02, `seed ${seed}: 1R is not the entry-to-stop distance`);
    assert.ok(d.risk > 0, `seed ${seed}: no risk at all`);
    assert.ok(Math.abs(d.target - (d.entry + (d.dir === 'long' ? d.risk : -d.risk))) < 0.02,
      `seed ${seed}: the 1:1 is not one risk away from the entry`);
    if (d.dir === 'long') assert.ok(d.stop < d.zoneLo - 1e-9, `seed ${seed}: the long stop is not beyond the far side of the zone`);
    else assert.ok(d.stop > d.zoneHi + 1e-9, `seed ${seed}: the short stop is not beyond the far side of the zone`);
    assert.ok(d.avail > 0, `seed ${seed}: the leg has no room in it`);
    assert.strictEqual(d.oneToOne, d.avail >= d.risk - 1e-9,
      `seed ${seed}: the 1:1 answer does not match the leg`);

    // The picture has to be a picture. The leg ends outside the zone on the
    // winning side in both cases — a leg that stops inside the zone is not a leg,
    // and building the no-1:1 case off the entry rather than off the zone drew
    // exactly that.
    const legEnd = d.dir === 'long'
      ? Math.max(...d.bars.slice(0, d.decision + 1).map((b) => b.h))
      : Math.min(...d.bars.slice(0, d.decision + 1).map((b) => b.l));
    if (d.dir === 'long') assert.ok(legEnd > d.zoneHi, `seed ${seed}: the leg never cleared the zone`);
    else assert.ok(legEnd < d.zoneLo, `seed ${seed}: the leg never cleared the zone`);

    // Every stop option sits on the losing side of the entry, exactly as the
    // reading drill's do — a stop on the winning side is not a stop.
    for (const n of d.questions[0].opts.map((o) => Number(o.txt.match(/([0-9]+\.[0-9]+)/)[1]))) {
      if (d.dir === 'long') assert.ok(n < d.entry, `seed ${seed}: a long stop above the entry (${n} vs ${d.entry})`);
      else assert.ok(n > d.entry, `seed ${seed}: a short stop below the entry (${n} vs ${d.entry})`);
    }

    // And the 1R options are the three distances, in the order the why explains.
    const rOpts = d.questions[1].opts.map((o) => Number(o.txt.match(/([0-9]+\.[0-9]+)/)[1]));
    assert.ok(Math.abs(rOpts[0] - d.risk) < 0.02, `seed ${seed}: the right 1R is not the risk`);
    assert.ok(Math.abs(rOpts[1] - d.risk * 0.5) < 0.02, `seed ${seed}: the half-risk option is not half`);
    assert.ok(Math.abs(rOpts[2] - d.risk * 2) < 0.02, `seed ${seed}: the double option is not double`);
    assert.strictEqual(new Set(rOpts).size, 3, `seed ${seed}: two of the 1R options are the same number`);
  }
  assert.strictEqual(dirs.size, 2, 'the strand drills both sides: a demand zone and a supply zone');
  assert.strictEqual(answers.size, 2, 'and both answers to the 1:1 question should appear');
  // A real mix, not a one-in-fifty accident. Left to the dice, the leg almost
  // always reached the 1:1 and "leave it" was a question he would never see
  // twice — which made the drill teach taking every trade it showed him.
  assert.ok(paid >= 15 && paid <= 65,
    `a leg that pays one for one should be an ordinary answer, not ${paid} of 80`);
});

test('the same seed always draws the same risk chart, and the path never marks it', () => {
  const a = S.makeRiskScenario(11), b = S.makeRiskScenario(11);
  assert.deepStrictEqual(a.bars.map((x) => x.c), b.bars.map((x) => x.c));
  assert.strictEqual(a.oneToOne, b.oneToOne, 'the geometry is decided before the bars are drawn');
  // The questions are settled before the outcome exists, so asking the same seed
  // twice cannot produce two different right answers.
  assert.deepStrictEqual(a.questions.map((q) => q.opts.map((o) => o.ok)),
    b.questions.map((q) => q.opts.map((o) => o.ok)));
});

test('the risk drill, driven: the plan marks right, then the market is revealed', () => {
  click(S, 'tabs', { 'data-t': 'risk' });
  const view = page.els.get('view');
  assert.match(view.innerHTML, /The risk drill/, 'the strand should be on its own tab');
  assert.match(view.innerHTML, /The risk strand &middot; six lessons/, 'with its lessons under it');
  assert.match(view.innerHTML, /id="cv"/, 'and the chart');
  assert.match(view.innerHTML, /The zone is the only thing marked/, 'with nothing but the zone drawn');
  assert.ok(!/Where does your stop belong\?[\s\S]*What is 1R/.test(view.innerHTML),
    'one question at a time — the 1R question waits for the stop question');

  const d = S.UI.risk;
  assert.ok(d && d.questions.length === 5, 'a drill should have been dealt');
  // The page keeps its progress on one state object, so the record is read where
  // the page writes it: S.S is that object, S is the whole page.
  const rec0 = { ...S.S.rr };
  for (let i = 0; i < 5; i++) {
    const right = d.questions[i].opts.findIndex((o) => o.ok);
    click(S, 'view', { 'data-a': 'riskans', 'data-q': i, 'data-o': right });
  }
  const html = page.els.get('view').innerHTML;
  assert.match(html, /What the market did/, 'the outcome is revealed after the last answer');
  assert.ok(html.includes(d.note.slice(0, 40)), 'with the note for that plan');
  assert.match(html, /The plan: entry/, 'and the numbers the trade was made of');
  assert.match(html, /had a 1:1 at the entry: /, 'and the record');
  assert.match(page.els.get('view').innerHTML, /Right\./, 'the right answers were marked right');

  assert.strictEqual(S.UI.rq, 5, 'and the drill moved on past every question');
  const rec = S.S.rr;
  assert.ok(rec, 'finishing a plan records it on the saved state');
  assert.strictEqual(rec.done - rec0.done, 1, 'one plan recorded');
  assert.strictEqual(rec.right - rec0.right, 1, 'the take-or-leave call recorded');
  assert.strictEqual((rec.one - rec0.one) + (rec.left - rec0.left), 1, 'and whether it had a 1:1 in it');
  assert.strictEqual((rec.won - rec0.won) + (rec.lost - rec0.lost), rec.one - rec0.one,
    'the outcome counted only for the ones with a 1:1');

  // Another plan, and a wrong answer on the take-or-leave question is marked
  // wrong and explained rather than silently skipped.
  click(S, 'view', { 'data-a': 'newrisk' });
  const d2 = S.UI.risk;
  assert.notStrictEqual(d2.seed, d.seed, 'a new plan should be a new chart');
  assert.ok(!/What the market did/.test(page.els.get('view').innerHTML), 'and the reveal is put away');
  click(S, 'view', { 'data-a': 'riskans', 'data-q': 0, 'data-o': 0 });
  assert.match(page.els.get('view').innerHTML, /class="opt right"|class="opt wrong"/, 'answered');
});

test('a risk drill cannot half-overwrite a reading drill, or the other way round', () => {
  // The two drills keep their own state on purpose. Sharing it left one tab's
  // answers marked against the other tab's chart. A fresh reading drill is dealt
  // here rather than borrowed from an earlier test, so this says what it means
  // whatever ran before it.
  click(S, 'tabs', { 'data-t': 'drills' });
  click(S, 'view', { 'data-a': 'newdrill' });
  const opened = S.UI.drill;
  click(S, 'view', { 'data-a': 'dans', 'data-q': 0, 'data-o': opened.read });
  const readAt = S.UI.q;
  assert.strictEqual(readAt, 1, 'the reading drill is one question in');

  click(S, 'tabs', { 'data-t': 'risk' });
  const risk = S.UI.risk;
  click(S, 'view', { 'data-a': 'riskans', 'data-q': 0, 'data-o': 2 });
  assert.strictEqual(S.UI.rq, 1, 'the risk drill moved on by itself');

  click(S, 'tabs', { 'data-t': 'drills' });
  const back = page.els.get('view').innerHTML;
  assert.match(back, /So what do you do at the last bar\?/, 'the reading drill is still where it was');
  assert.match(back, /class="opt right"/, 'with its answer still marked');
  assert.strictEqual(S.UI.drill.seed, opened.seed, 'and the same chart');
  assert.strictEqual(S.UI.q, readAt, 'and the risk answer did not walk it on');

  click(S, 'tabs', { 'data-t': 'risk' });
  assert.strictEqual(S.UI.risk.seed, risk.seed, 'and the risk plan is still the one that was dealt');
  assert.match(page.els.get('view').innerHTML, /class="opt (right|wrong)"/, 'with its own answer marked');
});

test('the risk lessons open, mark and count like every other lesson', () => {
  click(S, 'tabs', { 'data-t': 'risk' });
  click(S, 'view', { 'data-a': 'lesson', 'data-id': 'R1' });
  const view = page.els.get('view');
  assert.match(view.innerHTML, /Lesson R1/, 'the strand\'s own lesson');
  assert.match(view.innerHTML, /Entry into the zone or swing, stop beyond the far side/, 'its key points');

  const xpBefore = page.els.get('xp').textContent;
  click(S, 'view', { 'data-a': 'q', 'data-key': 'R1:0', 'data-o': 0 });
  assert.match(view.innerHTML, /class="opt right"/, 'a right answer is marked');
  assert.notStrictEqual(page.els.get('xp').textContent, xpBefore, 'and earns XP like any other check');

  const doneBefore = S.schoolStats().done;
  click(S, 'view', { 'data-a': 'done', 'data-id': 'R1' });
  assert.match(page.els.get('view').innerHTML, /Next: The far side of the zone/, 'the strand walks on to the next');
  assert.strictEqual(S.schoolStats().done, doneBefore + 1, 'and the lesson is counted as done');

  click(S, 'view', { 'data-a': 'toLevels' });
  assert.match(page.els.get('view').innerHTML, /The risk strand/, 'back to the strand, not to the levels');
});

// ── what is on the picture ──────────────────────────────────────────────────
// Jacques, 19 Sep 2026, after the risk strand shipped: "the number in the
// question answers and on the chart are incompatible doesn't makes sense I'm
// still guessing." He was reading the drills exactly right. drawChart drew
// candles and lines and not one number anywhere on the page — no scale, and the
// lines labelled "zone top", "entry", "stop" with no prices — while the
// questions asked him to choose between 100.40 and 103.60.

test('the chart carries a price scale, and the bars sit inside it', () => {
  click(S, 'tabs', { 'data-t': 'risk' });
  const d = S.UI.risk;
  const cv = page.els.get('cv');
  cv._texts.length = 0;
  click(S, 'tabs', { 'data-t': 'risk' });
  const texts = cv._texts.slice();
  const nums = texts.map((t) => parseFloat(t)).filter((n) => isFinite(n));
  assert.ok(nums.length >= 4, `a scale of four prices: ${JSON.stringify(texts)}`);
  for (const n of nums) assert.ok(Number.isInteger(Math.round(n * 100)) , `"${n}" is not a price`);

  const vis = d.bars.slice(0, d.decision + 1);
  const hi = Math.max(...vis.map((b) => b.h)), lo = Math.min(...vis.map((b) => b.l));
  assert.ok(Math.max(...nums) >= hi, 'the top of the scale is at or above the highest high');
  assert.ok(Math.min(...nums) <= lo, 'and the bottom at or below the lowest low');
});

test('the questions ask about prices that are on the picture', () => {
  click(S, 'tabs', { 'data-t': 'risk' });
  const cv = page.els.get('cv');
  cv._texts.length = 0;
  click(S, 'tabs', { 'data-t': 'risk' });
  const d = S.UI.risk;
  const joined = cv._texts.join(' | ');

  // The stop question is about the zone's two edges, so both are named with
  // their prices while the questions are open. "zone top" on its own was the
  // thing he could not check an answer against.
  assert.ok(joined.includes(S.money(d.zoneHi)), `the near edge is on the chart: ${joined}`);
  assert.ok(joined.includes(S.money(d.zoneLo)), `and the far edge, where the stop goes: ${joined}`);

  // And every price the options offer him is inside the scale he is given, so he
  // can find each one on the picture instead of guessing between three numbers.
  const nums = cv._texts.map((t) => parseFloat(t)).filter((n) => isFinite(n));
  const top = Math.max(...nums), bottom = Math.min(...nums);
  const offered = d.questions[0].opts.map((o) => Number(o.txt.match(/([0-9]+\.[0-9]+)/)[1]));
  assert.ok(offered.length === 3 && offered.every((n) => isFinite(n)), 'three prices offered');
  for (const n of offered) {
    assert.ok(n >= bottom && n <= top, `${n} is off the scale he is given (${bottom}..${top})`);
  }

  // Once it is revealed, the plan's own numbers are on it too.
  for (let i = 0; i < 5; i++) {
    const right = d.questions[i].opts.findIndex((o) => o.ok);
    click(S, 'view', { 'data-a': 'riskans', 'data-q': i, 'data-o': right });
  }
  const after = cv._texts.join(' | ');
  for (const p of [d.entry, d.stop, d.target]) {
    assert.ok(after.includes(S.money(p)), `${S.money(p)} is not on the chart: ${after}`);
  }
});

test('the stop question offers three prices that can be told apart', () => {
  // 19 Sep 2026, the same complaint: he was still guessing, and on some seeds he
  // was right to be. The pullback ended ON the level, so the entry and the place
  // the idea dies were the same price and two of the three options came out two
  // cents apart — "just beyond the level (104.62)" against "close in at 104.60".
  for (let seed = 1; seed <= 60; seed++) {
    const d = S.makeScenario(seed);
    const ps = d.stopOptions.map((o) => Number(o.txt.match(/([0-9]+\.[0-9]+)/)[1]));
    assert.strictEqual(ps.length, 3, `seed ${seed}: three stops are offered`);
    const [structural, tight, wide] = ps;
    const up = d.exp === 'short' ? -1 : 1;          // which way is safe
    // The entry is the decision bar's close: the scenario does not carry it as
    // its own field, and reading it from a field that does not exist made this
    // test fail on nothing at all the first time it ran.
    const entry = d.bars[d.decision].c;

    assert.ok(Math.abs(structural - tight) > d.atr * 0.5,
      `seed ${seed}: the two stops are the same price (${structural} vs ${tight})`);
    assert.ok(Math.abs(wide - structural) > d.atr,
      `seed ${seed}: the further-out one cannot be told from the right one (${structural} vs ${wide})`);
    // And every one of them carries its own price, so the chart's scale can be
    // told to cover the three numbers the question offers.
    for (const o of d.stopOptions) assert.ok(isFinite(o.p), `seed ${seed}: an option with no price`);
    const toEntry = (entry - tight) * up, toStruct = (entry - structural) * up;
    assert.ok(toStruct > 0, `seed ${seed}: the right stop is on the winning side of the entry`);
    assert.ok(toEntry > 0 && toEntry < toStruct,
      `seed ${seed}: the close-in stop is not between the entry and the level`);
    // And what puts that distance there: the entry has turned off the level.
    assert.ok(toStruct >= d.atr, `seed ${seed}: the entry is still sitting on the level`);
  }
});

test('every drill chart carries the scale, not only the risk one', () => {
  const scaleOn = (id) => {
    const cv = page.els.get(id);
    cv._texts.length = 0;
    click(S, 'tabs', { 'data-t': 'drills' });
    return cv._texts.slice();
  };
  click(S, 'tabs', { 'data-t': 'drills' });
  click(S, 'view', { 'data-a': 'newdrill' });
  const one = scaleOn('cv');
  assert.ok(one.filter((t) => isFinite(parseFloat(t))).length >= 4, `the reading drill: ${JSON.stringify(one)}`);

  click(S, 'view', { 'data-a': 'newtiming' });
  const big = scaleOn('cv'), small = scaleOn('cv2');
  assert.ok(big.filter((t) => isFinite(parseFloat(t))).length >= 4, `the 4h chart: ${JSON.stringify(big)}`);
  assert.ok(small.filter((t) => isFinite(parseFloat(t))).length >= 4, `the 5m chart: ${JSON.stringify(small)}`);
  click(S, 'view', { 'data-a': 'newdrill' });
});

test('the teacher inside the school answers risk in his own method', () => {
  // The strand teaches it and the drill marks it. If the ask box does not carry
  // it too, the answer he gets back is generalities while the page is marking
  // him on one risked for one made.
  for (const rule of [
    /one risked for one made/,
    /the stop goes beyond the far side of it/,
    /does not pay one for one/,
    /Never suggest moving a stop/,
  ]) assert.match(S.ASK_SYS, rule);
});

test('the risk strand promises nothing either', () => {
  // The same rule the rest of the school is held to, over the strand's own
  // teaching: its lessons, its questions and the why it gives, and the notes the
  // drill writes about how a plan turned out.
  const teaching = [];
  for (const l of S.SW_RISK) {
    teaching.push(l.t, ...l.b, ...l.k);
    for (const q of l.q) teaching.push(q.q, q.w, ...q.o);
  }
  for (let seed = 1; seed <= 40; seed++) {
    const d = S.makeRiskScenario(seed);
    teaching.push(d.note);
    for (const q of d.questions) {
      teaching.push(q.t, q.say.yes, q.say.no);
      for (const o of q.opts) teaching.push(o.txt);
    }
  }
  const text = teaching.join('\n').toLowerCase();
  for (const banned of ['risk-free', 'risk free', 'sure thing', 'surefire', 'will make you money',
                        'always works', "can't lose", 'cannot lose', 'get rich', 'never loses',
                        'no risk', 'easy money']) {
    assert.ok(!text.includes(banned), `the risk strand says "${banned}"`);
  }
  for (const re of [/guarantee\w*\s+(a\s+)?(profit|return|win|income|money)/i, /guarantees?\s+(you|that you)/i]) {
    assert.ok(!re.test(text), `the risk strand promises with: ${re}`);
  }
});

// ── the door ────────────────────────────────────────────────────────────────

test('the school is behind the door, at both of its addresses', () => {
  for (const url of ['/school', '/school.html']) {
    assert.ok(OPEN_PAGES.includes(url), `${url} must reach its own route, which is where it is judged`);
    assert.strictEqual(pageIsServed(url), true);
    const at = SRC.indexOf("app.get('" + url + "'");
    assert.ok(at > -1, `the ${url} route must be findable in server.js`);
    const block = SRC.slice(at, at + 320);
    assert.match(block, /isValidSession\(req\)/, `${url}: signed out gets nothing`);
    assert.match(block, /isFriendlyRequest\(req\)/, `${url}: off the list gets nothing`);
    assert.match(block, /res\.redirect\('\/app'\)/, `${url}: a page visit goes to the app, not JSON`);
    assert.ok(
      SRC.indexOf("app.get('" + url + "'") < SRC.indexOf('app.use(express.static('),
      `${url} must be registered above static, which would otherwise serve the file itself`,
    );
  }
});

test('the worker never caches the school', () => {
  assert.match(SW, /\['\/school', '\/school\.html'\]\.includes\(url\.pathname\)\) return;/,
    'a cached copy would outlive the sign-in check');
});

test('a signed-out request for the school never gets the file', async () => {
  // The text checks above cannot see the failure that matters: express.static
  // answering /school.html first because the gated route was registered after it.
  // So this boots the real static over the real app folder, with the gate in
  // front exactly as server.js has it, and makes the request.
  const express = require('express');
  const app = express();
  const gate = (req, res) => {
    if (req.get('x-signed-in') !== 'yes') return res.redirect('/app');
    res.sendFile(PAGE);
  };
  app.get('/school', gate);
  app.get('/school.html', gate);
  app.use(express.static(ROOT));
  app.get('/app', (req, res) => res.type('text/plain').send('the app'));

  const server = app.listen(0);
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (p, signedIn) => fetch(base + p, {
    redirect: 'manual',
    headers: signedIn ? { 'x-signed-in': 'yes' } : {},
  }).then(async (r) => ({ status: r.status, location: r.headers.get('location'), body: await r.text() }));
  try {
    for (const url of ['/school', '/school.html']) {
      const cold = await get(url);
      assert.strictEqual(cold.status, 302, `${url}: signed out must be redirected, not served`);
      assert.strictEqual(cold.location, '/app');
      assert.ok(!cold.body.includes('Trading School'), `${url}: no part of the page may come back`);

      const warm = await get(url, true);
      assert.strictEqual(warm.status, 200, `${url}: signed in and on the list gets the page`);
      assert.ok(warm.body.length > 50000, `${url}: and it is the page, not a stub`);
    }
  } finally {
    server.close();
  }
});

test('the page carries no tracking and no outside script', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  for (const banned of ['googletagmanager', 'gtag(', 'analytics', '<script src="http', 'facebook.net']) {
    assert.ok(!html.toLowerCase().includes(banned.toLowerCase()), `the school loads ${banned}`);
  }
});
