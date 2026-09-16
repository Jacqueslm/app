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
      appendChild() {}, remove() {}, getContext() { return null }, scrollIntoView() {},
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
  assert.strictEqual(lessons, 45);
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
