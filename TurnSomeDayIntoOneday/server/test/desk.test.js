// The Trading Desk (/desk) — 17 Sep 2026.
//
// Jacques: "something that helps me make better trading decisions that knows all
// my set ups and can back test for me and an indicator that aligns with it,
// letting me know high probability swings and zones and the best time to hold a
// move or scalp using 4hr 1hr 15mon and 5 min."
//
// This is step one of that: his setups written down, and the assistant that
// reads them. The indicator and the backtest come after and both read what this
// page writes, so the three things that can go wrong quietly are all checked
// here:
//   1. The assistant answering as though the page had data it does not have.
//      There is no price feed on this page and no backtest has been run, and
//      the instructions have to say so rather than leave room for a model to
//      imply it checked something.
//   2. A target coming before an invalidation. Where he is wrong is the part
//      that keeps him solvent, so the prompt is checked for the order.
//   3. His setups being ignored in favour of a general chat answer — which is
//      the whole difference between this and the Friendly tab.
//
// It runs the page's real inline script in a stub DOM and drives its own form
// and ask box, the way a thumb would. Not a browser: it proves the wiring, the
// prompt and the request, not the pixels.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = path.join(ROOT, 'desk.html');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
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
  const mk = (id) => ({
    id, value: '', textContent: '', innerHTML: '', disabled: false,
    className: '', style: {}, dataset: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c) },
      remove(c) { this._s.delete(c) },
      toggle(c, f) {
        if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
        else if (f) { this._s.add(c); } else { this._s.delete(c); }
      },
      contains(c) { return this._s.has(c); },
    },
    _on: {},
    addEventListener(t, f) { this._on[t] = f }, setAttribute() {}, removeAttribute() {},
    getAttribute() { return null }, focus() {}, closest() { return null; },
    querySelectorAll() { return [] }, appendChild() {}, remove() {},
    scrollIntoView() {}, confirm() { return false }, onclick: null,
  });
  return {
    els,
    doc: {
      getElementById(id) { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); },
      querySelectorAll() { return []; },
      querySelector() { return null; },
      addEventListener() {},
      createElement() { return mk('_new'); },
      body: mk('body'),
      documentElement: mk('html'),
      readyState: 'complete',
    },
  };
}

// Runs the page for real and hands back its globals, the stub elements, a log of
// everything the page asked its own server for, and what it wrote to the device.
//
// The feed answer defaults to a broken one on purpose: every test below then
// starts from the state that matters most — a desk with no candles, where the
// only thing that must not happen is a price appearing from nowhere. The feed
// tests set a real answer with setCandles().
async function loadPage(opts) {
  const { doc, els } = stubDom();
  const calls = [];
  const chats = [];
  const stored = {};
  let reply = { status: 200, body: { content: [{ type: 'text', text: '4h: up.\nEntry: the reclaim.\nWrong if: a close back inside.' }] } };
  // `feed` is the /api/candles body the page will be handed, as a 200 — the
  // shape most tests want. setCandles() takes the whole status+body when a test
  // needs to change the answer partway through.
  let candles = opts && opts.feed
    ? { status: 200, body: opts.feed }
    : { status: 502, body: { ok: false, error: 'NQ: the feed could not be reached.' } };
  const sandbox = {
    document: doc, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set, Intl,
    localStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null },
      setItem(k, v) { stored[k] = v },
      removeItem(k) { delete stored[k] },
    },
    window: null,
    fetch: async (url, opts) => {
      const isChat = String(url).indexOf('/api/chat') === 0;
      const rec = {
        url,
        method: (opts && opts.method) || 'GET',
        body: opts && opts.body ? JSON.parse(opts.body) : null,
      };
      calls.push(rec);
      if (isChat) chats.push(rec);
      const r = isChat ? reply : candles;
      return { status: r.status, ok: r.status === 200, json: async () => r.body };
    },
    scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: 'node' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.confirm = () => false;
  vm.createContext(sandbox);
  vm.runInContext(inlineScript(PAGE), sandbox, { filename: 'desk.html' });
  // The page loads its assistant patch with <script defer src=...>, and defer
  // means after the page has parsed — so after the page's own script, here as in
  // a browser. Skipping it would test a prompt no phone ever gets.
  const patch = path.join(ROOT, 'desk-assistant.js');
  if (fs.existsSync(patch)) {
    vm.runInContext(fs.readFileSync(patch, 'utf8'), sandbox, { filename: 'desk-assistant.js' });
  }
  // The page loads its candles on open. Let that one request settle before the
  // test touches anything, so nothing it does can race with the open.
  await new Promise((done) => setImmediate(done));
  return {
    sandbox, els, calls, chats, stored,
    setReply(r) { reply = r },
    setCandles(r) { candles = r },
  };
}

// A feed answer in the shape /api/candles returns, with bars whose numbers are
// known, so a test can say exactly which ones the assistant was handed.
function candleSet(overrides) {
  const base = Date.parse('2026-09-17T00:00:00Z');
  const mk = (n, step, from) => Array.from({ length: n }, (_, i) => ({
    t: base + i * step,
    o: from + i, h: from + i + 4, l: from + i - 4, c: from + i + 1,
    v: 100 + i,
  }));
  return Object.assign({
    ok: true, symbol: 'NQ=F', name: 'Nasdaq 100', partial: null, error: null,
    timeframes: {
      '5m': { ok: true, symbol: 'NQ=F', tf: '5m', asOf: '2026-09-17T00:10:00.000Z', bars: 3, candles: mk(3, 5 * 60000, 21000) },
      '15m': { ok: true, symbol: 'NQ=F', tf: '15m', asOf: '2026-09-17T00:30:00.000Z', bars: 3, candles: mk(3, 15 * 60000, 20000) },
      '1h': { ok: true, symbol: 'NQ=F', tf: '1h', asOf: '2026-09-17T02:00:00.000Z', bars: 3, candles: mk(3, 60 * 60000, 19000) },
      '4h': { ok: true, symbol: 'NQ=F', tf: '4h', asOf: '2026-09-17T04:00:00.000Z', bars: 3, candles: mk(3, 4 * 60 * 60000, 18000) },
    },
  }, overrides || {});
}

// Writes a setup the way the form does, through the page's own open/save
// buttons. openForm() first, because that is what creates the fields.
function writeSetup(p, fields) {
  p.sandbox.openForm();
  const el = (id) => p.els.get(id);
  el('sN').value = fields.n || '';
  el('sR').value = fields.r || '';
  el('sE').value = fields.e || '';
  el('sS').value = fields.s || '';
  el('sT').value = fields.t || '';
  el('sH').value = fields.h || 'hold';
  el('sTfIn').value = (fields.tf || []).join(', ');
  el('saveS').onclick();
}

const SWEEP = {
  n: 'London sweep and reclaim',
  tf: ['4h', '1h', '15m', '5m'],
  r: '4h is in an uptrend and price sweeps the overnight low.',
  e: 'First 5 min close back above the swept level.',
  s: '15 min close back under the level.',
  t: 'The far side of the range.',
  h: 'hold',
};

// ── the page as a tool ──────────────────────────────────────────────────────

test('an empty desk says it is empty instead of inventing a setup', async () => {
  const p = await loadPage();
  assert.strictEqual(p.sandbox.SETUPS.length, 0, 'a fresh desk starts with nothing written');
  const text = p.sandbox.setupsText();
  assert.match(text, /NOT WRITTEN ANY SETUPS YET/);
  // 21 Sep 2026: it used to say "answer nothing else as if one of his setups
  // matched", which on a phone came out as opening the reply with the fact that
  // he has not written a setup down yet. The read comes first now; that line is
  // one short line after it.
  assert.match(text, /Do not open with that and do not let it shorten the answer/);
  assert.doesNotMatch(text, /Say so in the first line/);
  assert.strictEqual(p.els.get('list').innerHTML, '', 'and the list is empty, not a placeholder setup');
  assert.strictEqual(p.els.get('none').style.display, 'block', 'so the page asks him to write one');
});

test('a setup written on the page is kept, and kept on the device', async () => {
  const p = await loadPage();
  writeSetup(p, SWEEP);
  assert.strictEqual(p.sandbox.SETUPS.length, 1);
  assert.strictEqual(p.sandbox.SETUPS[0].n, SWEEP.n);
  assert.strictEqual(p.sandbox.SETUPS[0].tf.join(','), '4h,1h,15m,5m');
  assert.ok(p.stored['tsid.desk.setups'], 'the setups are written to the device');
  assert.match(p.stored['tsid.desk.setups'], /London sweep and reclaim/);
  assert.match(p.els.get('list').innerHTML, /London sweep and reclaim/, 'and it appears in the list');
  assert.strictEqual(p.els.get('none').style.display, 'none', 'the empty message goes away');
});

// Jacques, 21 Sep 2026, on the indicator and again on this form: "you should
// build for all timeframes anyone i decided to use if i list it or not not just
// the ones i listed thats not growth thats restraint". So the field is his own
// words in a text box — a timeframe that did not exist on the day this was
// written is kept exactly like the four that happened to be listed here.
test('a timeframe nobody thought of is kept like any other', async () => {
  const p = await loadPage();
  writeSetup(p, Object.assign({}, SWEEP, { tf: ['5s', '2m', 'daily'] }));
  assert.strictEqual(p.sandbox.SETUPS[0].tf.join(','), '5s,2m,daily', 'kept as he typed them');
  assert.match(p.sandbox.setupsText(), /Timeframes: 5s and 2m and daily/, 'and read back the same way');
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.ok(html.includes('id="sTfIn"'), 'the field is a text box');
  assert.ok(!/id="sTf"/.test(html), 'with no fixed list left beside the four timeframes');
});

test('a setup named with markup cannot put markup on the page', async () => {
  const p = await loadPage();
  writeSetup(p, { n: '<img src=x onerror=alert(1)>', tf: ['1h'], r: 'r', e: 'e', s: 's', t: 't' });
  const shown = p.els.get('list').innerHTML;
  assert.ok(!/<img/.test(shown), 'the setup name was inserted as markup');
  assert.match(shown, /&lt;img/);
});

test('his setups travel with every question, by the names he gave them', async () => {
  const p = await loadPage();
  writeSetup(p, SWEEP);
  p.els.get('dMk').value = 'NQ, long';
  p.els.get('dPx').value = '21,480';
  p.els.get('dRd').value = '4h took the overnight high';
  p.els.get('dIn').value = '1h close back inside';

  p.els.get('askQ').value = 'Should I take this one?';
  await p.sandbox.ask();

  assert.strictEqual(p.chats.length, 1);
  assert.strictEqual(p.chats[0].url, '/api/chat', 'the same route the Friendly tab uses, so the same brake covers it');
  const system = p.chats[0].body.system[0].text;
  assert.match(system, /London sweep and reclaim/, 'the setup goes with the question');
  assert.match(system, /Has to be true first: 4h is in an uptrend/);
  assert.match(system, /Wrong if: 15 min close back under the level/);
  assert.match(system, /4 hours, 1 hour, 15 minutes, 5 minutes/, 'the timeframes it lives on are spelled out');
  assert.match(system, /NQ, long/, 'and so does the chart in front of him');
  assert.match(system, /1h close back inside/);
  assert.strictEqual(p.chats[0].body.messages.length, 1, 'one question, no history to drift out of the rules');
  assert.strictEqual(p.chats[0].body.messages[0].role, 'user');
  // The question travels as a content array now, so a picture can ride with
  // it. With nothing attached it must be the text part and nothing else.
  const asked = p.chats[0].body.messages[0].content;
  assert.ok(Array.isArray(asked), 'the content is a block list');
  assert.strictEqual(asked.length, 1, 'no picture attached means no image block');
  assert.deepStrictEqual(asked[0], { type: 'text', text: 'Should I take this one?' });
  assert.match(p.els.get('askA').innerHTML, /Wrong if/, 'and the answer lands on the page');
});

test('a chart picture rides with the question, and the assistant is told it is there', async () => {
  const p = await loadPage();
  writeSetup(p, SWEEP);

  // What the picker holds once a file has been shrunk and accepted. Set
  // directly because the shrinking is a canvas operation and this harness has
  // no canvas - chart-picture.test.js checks the shrink itself.
  const PIC = { data: 'QUJD', media: 'image/jpeg', url: 'data:image/jpeg;base64,QUJD', w: 1200, h: 800 };
  p.sandbox.PIC = PIC;
  p.els.get('askQ').value = 'Is this one of my setups?';
  await p.sandbox.ask();

  const msg = p.chats[0].body.messages[0];
  assert.strictEqual(msg.content.length, 2, 'the question and the picture, nothing else');
  assert.strictEqual(msg.content[1].type, 'image');
  assert.strictEqual(msg.content[1].media_type, 'image/jpeg');
  assert.strictEqual(msg.content[1].data, 'QUJD', 'the bytes the picker holds are the bytes that are sent');
  assert.match(p.chats[0].body.system[0].text, /A CHART PICTURE IS ATTACHED/,
    'the rules for reading a picture are useless if the assistant is not told one is there');
  assert.match(p.chats[0].body.system[0].text, /outrank the CANDLES block/,
    'his own chart beats the feed - they can be different contracts and different days');

  // Taken off, it stops being sent, and the assistant is told that instead.
  p.sandbox.PIC = null;
  await p.sandbox.ask();
  const second = p.chats[1].body.messages[0];
  assert.strictEqual(second.content.length, 1, 'removed means removed');
  assert.match(p.chats[1].body.system[0].text, /NO CHART PICTURE IS ATTACHED/);
});

// ── the picture is the answer ───────────────────────────────────────────────
//
// Jacques, 21 Sep 2026, his own 4h chart on screen with a screenshot of it
// attached: "The assistant in not helpful at all." What came back was a column of
// "Not provided" lines. The instructions had told it to ask for the missing line
// and give no levels at all in that first reply, and the note about a picture
// never said that the picture he sent WAS the missing line. Both were wrong and
// both are checked here, because this is the exact complaint and it must not come
// back by a later edit to the prompt.
test('a picture he sends is the answer, not a reason to withhold the read', async () => {
  const p = await loadPage();
  p.sandbox.PIC = { data: 'QUJD', media_type: 'image/jpeg' };
  const sent = p.sandbox.askSystem();
  assert.match(sent, /BUT HE ATTACHED A CHART PICTURE WITH THE QUESTION/,
    'an empty form and a real picture is not an empty question');
  assert.match(sent, /HE SENT IT BECAUSE HE WANTS THE READ OUT OF IT/);
  assert.match(sent, /give him the Entry, the Wrong if and the Target you can read in it/);

  // With no picture at all, asking for the missing line is still the right answer.
  p.sandbox.PIC = null;
  const none = p.sandbox.askSystem();
  assert.match(none, /ASK him for the missing line before you answer, and give no levels in that first reply/);
  assert.doesNotMatch(none, /HE SENT IT BECAUSE HE WANTS THE READ/);
});

test('the rules read his own picture, and never answer one with Not provided', async () => {
  const p = await loadPage();
  const sys = String(p.sandbox.DESK_SYS);
  assert.match(sys, /read the invalidation you can see in his picture and say it is off his screenshot/,
    'where he is wrong is still first, and now it can come off his chart');
  assert.match(sys, /read it off the picture he attached and answer from it/);
  assert.match(sys, /the read IS the answer/);
  assert.match(sys, /Never answer a picture with Not provided on its own/);
  assert.match(sys, /never leave the Entry, Wrong if or Target lines out because the form on the page is empty/);
  assert.match(fs.readFileSync(PAGE, 'utf8'), /<script defer src="\/desk-assistant\.js">/,
    'the page has to load the file, or the prompt it builds is the old one');
});

// ── a refusal says why ──────────────────────────────────────────────────────
//
// Jacques, 21 Sep 2026, chart attached: the answer area read "[object Object]".
// On a refusal /api/chat hands back the AI provider's own error body, and that
// body's `error` is an object, so escaping it printed the object. What he needs
// on that screen is the sentence inside it - and words, always, never a brace.
test('a refusal shows the sentence inside it, never [object Object]', async () => {
  const p = await loadPage();
  assert.strictEqual(p.sandbox.esc({ message: 'API key not valid' }), 'API key not valid',
    'the message inside the object is the useful thing on screen');
  assert.strictEqual(p.sandbox.esc({ error: { message: 'quota exceeded' } }), 'quota exceeded',
    'including when the message is nested');
  assert.doesNotMatch(p.sandbox.esc({}), /\[object Object\]/,
    'an object with nothing readable in it still says something in words');

  // And the whole way through the ask box, which is the path he was on.
  p.setReply({ status: 400, body: { error: { message: 'API key not valid', code: 400 } } });
  p.els.get('askQ').value = 'What does the feed say?';
  await p.sandbox.ask();
  const shown = p.els.get('askA').innerHTML;
  assert.doesNotMatch(shown, /\[object Object\]/, 'nothing prints the object');
  assert.match(shown, /API key not valid/, 'the real reason reaches him');
});

test('an empty desk still gives the read instead of opening with the setup list', async () => {
  const p = await loadPage();
  const text = String(p.sandbox.setupsText());
  assert.match(text, /NOT WRITTEN ANY SETUPS YET/);
  assert.match(text, /Do not open with that and do not let it shorten the answer/);
  assert.doesNotMatch(text, /Say so in the first line/,
    'the first line is the read, not the fact that he has not written a setup down yet');
});

test('the assistant is told what it cannot know, and to ask instead of filling it in', async () => {
  const p = await loadPage();
  const system = p.sandbox.askSystem();
  // The chart block was left empty. A model with no prices and no instruction
  // would happily produce levels; this is the instruction that stops it.
  assert.match(system, /Market: NOT SAID/);
  assert.match(system, /has not filled this in and no picture came with the question/);
  assert.match(system, /ASK him for the missing line before you answer, and give no levels in that first reply/);
});

test('the rules it answers under: no invented numbers, wrong-first, and the four timeframes', async () => {
  const p = await loadPage();
  const sys = p.sandbox.DESK_SYS;
  // No data on the page, so the one thing that must not happen is invention —
  // and honesty about the backtest that does not exist yet.
  assert.match(sys, /Never invent a number/, 'no invented prices, levels or statistics');
  // There IS a feed now. What matters is that the only numbers it may quote are
  // the ones that came back from it, and that the backtest still does not exist.
  assert.match(sys, /The ONLY numbers you may quote are the ones in the CANDLES block/);
  assert.match(sys, /The only backtest that exists is the backtest block below/);
  assert.match(sys, /never imply any other test was run/);
  assert.match(sys, /If his own price disagrees with it, his chart wins/, 'the feed never overrules his own chart');
  assert.match(sys, /name the timeframe it came from/);
  // Wrong before right.
  assert.match(sys, /Invalidation comes first, every time/);
  // The timeframe roles and the trade sequence, in his own method. This block
  // replaced the old shorthand ("4h is the tide", "5m is only the trigger",
  // "HOLD OR SCALP") on 20 Sep 2026, when he explained the method again: context
  // and origin, a guide, a path, an execution refinement, and the gate.
  assert.match(sys, /4h is context and origin, not an automatic direction/);
  assert.match(sys, /1h is the guide/);
  assert.match(sys, /1m and 5-second refine execution only/);
  assert.match(sys, /to actually be tested/);
  assert.match(sys, /previous confirmed high or low as the target/, 'the prior level is the target, not the newest extreme');
  assert.match(sys, /PULLBACK OR TREND/);
  assert.match(sys, /the 1:1 gate passes/, 'a countertrend scalp still has to clear the gate');
  assert.match(sys, /never holds overnight/);
  assert.match(sys, /If the reward is smaller than the risk, the answer is wait/);
  assert.doesNotMatch(sys, /4h is the tide|5m is only the trigger|HOLD OR SCALP/, 'the old shorthand is gone, not resting beside the new rules');
  // And the lines that carry over from the rest of the app.
  assert.match(sys, /Never promise an outcome/);
  assert.match(sys, /Never tell him to make a loss back/);
  assert.match(sys, /Never tell him he is finished/);
  assert.match(sys, /Plain English, always/, 'and it answers in English');
});

// 20 Sep 2026. "I just need to get better at the 1:1 I look for because
// sometimes it just don't add up. I risk more than I make." The page does that
// one sum from his own three prices, and the gate blocks rather than guesses -
// a missing price is never filled in with a level the page does not have.
test('the 1:1 gate does the sum from his three prices, and blocks when one is missing', async () => {
  const p = await loadPage();

  // Nothing typed: blocked, no ratio, and told not to invent the missing price.
  const empty = p.sandbox.riskGateText({ entry: null, stop: null, target: null }, 'NQ, short');
  assert.match(empty, /1:1 GATE: BLOCKED/);
  assert.match(empty, /Do not approve a trade or invent a missing price/);
  assert.doesNotMatch(empty, /:1\./, 'no ratio is worked out from prices it does not have');

  // 20 points risked to make 40: through.
  const good = p.sandbox.riskGateText({ entry: 20000, stop: 20020, target: 19960 }, 'NQ, short');
  assert.match(good, /1:1 GATE: PASSES/);
  assert.match(good, /risk 20\.00 points; reward 40\.00 points; ratio 2\.00:1/);

  // 20 points risked to make 10: the answer is wait, not a smaller stop.
  const poor = p.sandbox.riskGateText({ entry: 20000, stop: 20020, target: 19990 }, 'NQ, short');
  assert.match(poor, /1:1 GATE: BLOCKED/);
  assert.match(poor, /risk 20\.00 points; reward 10\.00 points; ratio 0\.50:1/);

  // A target on the wrong side of the entry is not a small reward, it is a
  // different trade, and it is said that way.
  const wrongSide = p.sandbox.riskGateText({ entry: 20000, stop: 20020, target: 20040 }, 'NQ, short');
  assert.match(wrongSide, /the previous target is on the wrong side of the entry/);

  // Long is the same arithmetic the other way round.
  const long = p.sandbox.riskGateText({ entry: 20000, stop: 19980, target: 20040 }, 'NQ, long');
  assert.match(long, /1:1 GATE: PASSES/);

  // Without a direction there is nothing to measure the reward against.
  const noDir = p.sandbox.riskGateText({ entry: 20000, stop: 19980, target: 20040 }, 'NQ, watching');
  assert.match(noDir, /direction must say long or short/);
});

test('his plan and the gate travel with every question', async () => {
  const p = await loadPage();
  p.els.get('dMk').value = 'NQ, short';
  p.els.get('dPx').value = '20,000';
  p.els.get('dRd').value = '4h made the lower low, 5m is making HH HL';
  p.els.get('dIn').value = 'a 15m close back over the 4h low';
  p.els.get('dEn').value = '20000';
  p.els.get('dSt').value = '20020';
  p.els.get('dTg').value = '19960';

  const now = p.sandbox.nowText();
  assert.match(now, /Planned entry: 20000\.00/);
  assert.match(now, /Planned invalidation \/ stop: 20020\.00/);
  assert.match(now, /Previous confirmed target: 19960\.00/);
  assert.match(now, /1:1 GATE: PASSES/);
  assert.match(now, /METHOD FACTS: /, 'the method rides with the chart, not only in the system block');

  p.els.get('askQ').value = 'Does this one add up?';
  await p.sandbox.ask();
  const system = p.chats[0].body.system[0].text;
  assert.match(system, /METHOD OVERRIDE: /);
  assert.match(system, /Previous confirmed target: 19960\.00/, 'the three prices are handed over with the question');
  assert.match(system, /1:1 GATE: PASSES/);
  assert.match(system, /Arithmetic only, not a signal/, 'the gate is his sum, not a prediction');
});

test('a failure says so, and an answer cannot put markup on the page', async () => {
  const p = await loadPage();
  p.setReply({ status: 200, body: { content: [{ type: 'text', text: '<img src=x onerror=alert(1)>done' }] } });
  p.els.get('askQ').value = 'anything';
  await p.sandbox.ask();
  assert.doesNotMatch(p.els.get('askA').innerHTML, /<img/, 'the answer is escaped before it lands');

  for (const [status, expect] of [[429, /today's lot/], [401, /Sign in again/], [403, /Not switched on/], [500, /No answer came back/]]) {
    p.setReply({ status, body: {} });
    p.els.get('askQ').value = 'one more';
    await p.sandbox.ask();
    assert.match(p.els.get('askA').innerHTML, expect, `status ${status} must be said in words`);
  }
});

// ── it looks at nothing else ────────────────────────────────────────────────

test('the desk asks this app\'s server and nobody else', () => {
  // The feed arrived 17 Sep 2026 and the rule did NOT change with it: the page
  // still holds no address of anybody else's. It asks /api/candles, which is
  // this app's server, and the server is where the feed is — so no key is ever
  // in this file and no data vendor ever learns who is reading it.
  const html = fs.readFileSync(PAGE, 'utf8');
  const calls = [...html.matchAll(/fetch\('([^']*)'/g)].map((m) => m[1]);
  assert.deepEqual(calls.sort(), ['/api/candles?bars=', '/api/candles?bars=120&symbol=', '/api/chat'],
    'the page calls its own server and nowhere else: the read, the study that counts the bars, and the assistant');
  for (const r of calls) assert.ok(r.startsWith('/api/'), `${r} must be this app's own route`);
  for (const banned of ['googletagmanager', 'gtag(', '<script src="http', 'facebook.net',
    'binance', 'twelvedata', 'polygon.io', 'alphavantage', 'yahoo', 'query1.finance']) {
    assert.ok(!html.toLowerCase().includes(banned.toLowerCase()), `the desk must not reach for ${banned}`);
  }
});

// ── the feed ────────────────────────────────────────────────────────────────

test('the candles that came back are the only numbers the assistant is handed', async () => {
  const p = await loadPage({ feed: candleSet() });

  assert.ok(p.sandbox.FEED && p.sandbox.FEED.ok, 'the feed answer is kept');
  assert.strictEqual(p.sandbox.FEED.symbol, 'NQ=F');

  const feed = p.sandbox.feedText();
  assert.match(feed, /CANDLES FROM THE FEED/);
  assert.doesNotMatch(feed, /NOT LOADED/);
  // The numbers are the ones the feed sent, to the penny — and nothing on the
  // page rounds, averages or otherwise creates a price of its own.
  assert.match(feed, /o21001 h21005 l20997 c21002/, 'the 5m bars arrive as they came back');
  assert.match(feed, /4h: 3 bars/, 'each timeframe is labelled with how many bars it has');
  assert.match(feed, /not his broker's chart/);

  const system = p.sandbox.askSystem();
  assert.match(system, /21002/, 'the candles travel with the question');
  assert.match(system, /Nasdaq 100/, 'and so does what the feed called it');
  assert.match(p.els.get('fOut').innerHTML, /21,003\.00/, 'and the page shows the same last close it gave the assistant');
  assert.match(p.els.get('fOut').innerHTML, /4h/, 'one row per timeframe, so a number can be read against its own timeframe');
});

test('a feed that did not answer leaves the assistant with no prices at all', async () => {
  const p = await loadPage();
  // loadPage() already ran one load against a failing feed, exactly as the page
  // does on open.
  assert.strictEqual(p.sandbox.FEED, null, 'nothing is kept from a failed fetch');
  assert.match(p.sandbox.feedText(), /CANDLES FROM THE FEED: NOT LOADED/);
  assert.match(p.sandbox.feedText(), /Do not describe a chart, do not name a level and do not price anything/);
  assert.match(p.sandbox.askSystem(), /NOT LOADED/);
  assert.strictEqual(p.els.get('fOut').innerHTML, '', 'and no row is drawn');
  assert.match(p.els.get('fWhen').textContent, /NQ: the feed could not be reached/, 'the feed\'s own words, not a made-up price');
});

test('the candles are dropped the moment the feed stops answering', async () => {
  // The failure that matters: good candles on screen from a minute ago, then a
  // refresh that fails. Leaving them up would read as if the feed still said it.
  const p = await loadPage({ feed: candleSet() });
  assert.ok(p.sandbox.FEED, 'first load works');

  p.setCandles({ status: 502, body: { ok: false, error: 'NQ=F 1h: the feed took too long to answer.' } });
  await p.sandbox.loadFeed();
  assert.strictEqual(p.sandbox.FEED, null, 'the old candles do not survive a failed refresh');
  assert.strictEqual(p.els.get('fOut').innerHTML, '', 'and they come off the page');
  assert.match(p.els.get('fWhen').textContent, /took too long/);
});

test('a price the page shows can only have come from the feed', async () => {
  // No feed, no number: the page's own renderer is asked to paint a set that
  // never arrived and must draw nothing rather than a placeholder.
  const p = await loadPage();
  p.sandbox.FEED = { ok: false, error: 'nope' };
  p.sandbox.paintFeed();
  assert.strictEqual(p.els.get('fOut').innerHTML, '', 'no bars, no rows');
  p.sandbox.FEED = null;
  p.sandbox.paintFeed();
  assert.strictEqual(p.els.get('fOut').innerHTML, '');
  assert.doesNotMatch(p.sandbox.feedText(), /\d{4,}/, 'and the assistant is handed no number to quote');
});

test('the feed asks the server for all four timeframes in one call, and remembers the symbol', async () => {
  const p = await loadPage();
  const get = p.calls.filter((c) => c.url.startsWith('/api/candles'));
  assert.ok(get.length >= 1, 'the page loads candles on open rather than waiting to be asked');
  assert.match(get[0].url, /bars=120/, 'one request, one answer, so the four timeframes are read together');
  assert.match(get[0].url, /symbol=NQ/, 'and it opens on the symbol he last used');

  p.setCandles({ status: 200, body: candleSet({ symbol: 'BTC-USD' }) });
  p.els.get('fSym').value = 'BTC';
  await p.sandbox.loadFeed();
  assert.match(p.stored['tsid.desk.sym'], /BTC-USD/, 'the symbol he typed is the one it opens on next time');
});

// ── the chart ───────────────────────────────────────────────────────────────
//
// Jacques: "can I make my own personal tradingview for personal trading and get
// real live data for free". Half of that is possible and half is not, and the
// chart is where the half that is not could cost him money: the engine is free,
// the data is delayed. So these check three things:
//   1. The engine is this app's own copy — no third-party address on the page,
//      and the licence it ships under sits beside it.
//   2. Every function the page calls is one this build of the engine actually
//      exports. A renamed API draws nothing, silently, on his phone.
//   3. What is handed over is the feed's own bars and this page's own swings —
//      and nothing at all when there is nothing to draw.
const VENDOR = path.join(ROOT, 'vendor', 'lightweight-charts');
// The version is part of the path on purpose: the service worker serves static
// assets cache-first, so a new build under the old name would reach the page
// after the code that calls it — a renamed API and a chart that draws nothing.
const ENGINE_VERSION = '5.2.1';
const ENGINE = path.join(VENDOR, ENGINE_VERSION, 'lightweight-charts.standalone.production.js');

// Enough bars for a swing to exist at all: the page will not name one inside
// four bars. A four-bar zig-zag gives a strict high and a strict low, so the
// fixture has both kinds — a flat top or bottom is deliberately not a swing.
function chartFeed() {
  const base = Date.parse('2026-09-17T00:00:00Z');
  const pat = [0, 6, 12, 6];
  const mk = (n, step, from) => Array.from({ length: n }, (_, i) => {
    const mid = from + pat[i % 4];
    return { t: base + i * step, o: mid, h: mid + 3, l: mid - 3, c: mid + 1, v: 100 + i };
  });
  return {
    ok: true, symbol: 'NQ=F', name: 'Nasdaq 100', partial: null, error: null,
    timeframes: {
      '5m': { ok: true, candles: mk(9, 5 * 60000, 21000) },
      '15m': { ok: true, candles: mk(11, 15 * 60000, 20000) },
      '1h': { ok: true, candles: mk(13, 60 * 60000, 19000) },
      '4h': { ok: true, candles: mk(15, 4 * 60 * 60000, 18000) },
    },
  };
}

// A stand-in for the engine. The real one is 193KB of somebody else's canvas
// code and cannot run under node — so what is checked here is every part that is
// this page's own: the bars, the labels and the levels it hands over.
function fakeEngine() {
  const log = [];
  const series = {
    setData(data) { log.push({ call: 'setData', data }) },
    createPriceLine(options) { log.push({ call: 'createPriceLine', options }); return { id: log.length } },
    removePriceLine() { log.push({ call: 'removePriceLine' }) },
  };
  const chart = {
    addSeries(definition, options) { log.push({ call: 'addSeries', definition, options }); return series },
    timeScale() { return { fitContent() { log.push({ call: 'fitContent' }) } } },
  };
  const engine = {
    createChart(host, options) { log.push({ call: 'createChart', options }); return chart },
    createSeriesMarkers() { log.push({ call: 'createSeriesMarkers' }); return { setMarkers(m) { log.push({ call: 'setMarkers', markers: m }) } } },
    CandlestickSeries: { type: 'Candlestick' },
    ColorType: { Solid: 'solid' },
  };
  return { engine, log };
}

const lastOf = (log, call) => { const hits = log.filter((c) => c.call === call); return hits[hits.length - 1] };

test('the chart engine is this app\'s own copy, with its licence, and the page names the version it ships', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.match(html, /<script src="\/vendor\/lightweight-charts\/5\.2\.1\/lightweight-charts\.standalone\.production\.js"><\/script>/,
    'the engine is served by this app, not fetched from a CDN');

  const bundle = fs.readFileSync(ENGINE, 'utf8');
  const version = (bundle.slice(0, 400).match(/Lightweight Charts\u2122 v(\d+\.\d+\.\d+)/) || [])[1];
  assert.ok(version, 'the vendored build says which version it is');
  assert.strictEqual(version, ENGINE_VERSION, 'and it is where the test says it is, under that version in the path');
  assert.match(html, new RegExp('Lightweight Charts v' + version.replace(/\./g, '\\.')),
    'and the credit on the page names that same version');
  assert.match(html, /Apache 2\.0/, 'with the licence it is under');
  assert.match(fs.readFileSync(path.join(VENDOR, 'LICENSE'), 'utf8'), /Apache License[\s\S]*Version 2\.0/,
    'and the licence text itself sits beside it, which is the condition of shipping it');
  assert.match(bundle.slice(0, 200), /Copyright \(c\) \d{4} TradingView/, 'the build keeps its own copyright header');
});

test('every chart-engine function the page calls is one this build actually exports', () => {
  // v4's addCandlestickSeries does not exist in v5 — an upgrade that renames an
  // API draws nothing and throws nothing a user would ever see. This is the
  // check that catches the rename before it reaches his phone.
  const html = fs.readFileSync(PAGE, 'utf8');
  const bundle = fs.readFileSync(ENGINE, 'utf8');
  const names = [...new Set([...html.matchAll(/LightweightCharts\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]))];
  assert.ok(names.length >= 3, 'the page calls the engine by name');
  for (const n of names) {
    const exported = new RegExp(`[,{]${n}:`).test(bundle) || new RegExp(`[,{]get ${n}\\(\\)`).test(bundle);
    assert.ok(exported, `the page calls LightweightCharts.${n} and this build does not export it`);
  }
  for (const m of ['addSeries', 'setData', 'setMarkers', 'createPriceLine', 'removePriceLine', 'fitContent', 'timeScale']) {
    assert.ok(bundle.includes(m), `the page calls .${m}() and this build has no such method`);
  }
});

test('with no engine at all the chart says so and draws nothing', async () => {
  const p = await loadPage({ feed: chartFeed() });
  assert.strictEqual(p.sandbox.CHART, null, 'nothing was created');
  assert.match(p.els.get('chWhen').textContent, /The chart engine did not load/,
    'and the page says which of the two things failed');
  assert.match(p.els.get('chWhen').textContent, /candles above are still the feed/,
    'without pretending the candles are wrong as well');
});

test('the chart is handed the feed\'s bars, marked with the page\'s own swings', async () => {
  const p = await loadPage({ feed: chartFeed() });
  const { engine, log } = fakeEngine();
  p.sandbox.LightweightCharts = engine;
  p.sandbox.setChartTf('4h');

  const bars = p.sandbox.FEED.timeframes['4h'].candles;
  const drawn = lastOf(log, 'setData');
  assert.ok(drawn, 'the chart was given data');
  assert.strictEqual(drawn.data.length, bars.length, 'one candle per bar that came back');
  // Field by field, not deepStrictEqual: the candle was built inside the page's
  // own context, so its prototype is the page's Object and never this file's.
  const first = drawn.data[0];
  assert.strictEqual(first.time, Math.round(bars[0].t / 1000), 'the first candle is the first bar, in seconds');
  assert.strictEqual(first.open, bars[0].o, 'and its open is the bar\'s open, to the penny');
  assert.strictEqual(first.high, bars[0].h);
  assert.strictEqual(first.low, bars[0].l);
  assert.strictEqual(first.close, bars[0].c);

  const st = p.sandbox.structure(bars, 2);
  assert.ok(st.swings.length >= 2, 'the fixture has swings to find');
  const marks = lastOf(log, 'setMarkers').markers;
  assert.deepStrictEqual(marks.map((m) => m.text), st.labels,
    'the letters on the candles are the same letters the structure block prints');
  const times = new Set(drawn.data.map((d) => d.time));
  for (const m of marks) assert.ok(times.has(m.time), 'a marker sits on a bar that is actually on the chart');

  const lines = log.filter((c) => c.call === 'createPriceLine').map((c) => c.options);
  assert.strictEqual(lines.length, 2, 'the last high and the last low are drawn across');
  const highs = st.swings.filter((s) => s.kind === 'H');
  const lows = st.swings.filter((s) => s.kind === 'L');
  assert.ok(highs.length && lows.length, 'the fixture has both a swing high and a swing low');
  assert.strictEqual(lines.find((l) => l.title === 'last high').price, highs[highs.length - 1].p);
  assert.strictEqual(lines.find((l) => l.title === 'last low').price, lows[lows.length - 1].p);
});

test('the chart redraws on the timeframe he picks, and remembers it', async () => {
  const p = await loadPage({ feed: chartFeed() });
  const { engine, log } = fakeEngine();
  p.sandbox.LightweightCharts = engine;
  p.sandbox.setChartTf('4h');
  assert.ok(lastOf(log, 'setData'), 'the 4h draw happened');

  p.sandbox.setChartTf('15m');
  const drawn = lastOf(log, 'setData');
  assert.strictEqual(drawn.data.length, p.sandbox.FEED.timeframes['15m'].candles.length,
    'the 15m bars are the ones drawn after he picks 15m');
  assert.strictEqual(drawn.data[0].close, p.sandbox.FEED.timeframes['15m'].candles[0].c,
    'and they are the 15m bars, not the 4h ones again');
  assert.match(p.stored['tsid.desk.charttf'], /15m/, 'the choice is kept on the device');
  assert.ok(log.some((c) => c.call === 'removePriceLine'),
    'the old levels come off before new ones go on, instead of stacking up');
  assert.strictEqual(log.filter((c) => c.call === 'createChart').length, 1,
    'and the chart itself is made once, not rebuilt on every change');
});

test('a timeframe with no bars leaves the chart empty and says so', async () => {
  const p = await loadPage({ feed: chartFeed() });
  const { engine, log } = fakeEngine();
  p.sandbox.LightweightCharts = engine;
  p.sandbox.FEED.timeframes['4h'].candles = [];
  p.sandbox.setChartTf('4h');
  const drawn = lastOf(log, 'setData');
  assert.strictEqual(drawn.data.length, 0, 'nothing is drawn for a timeframe that brought nothing back');
  assert.match(p.els.get('chWhen').textContent, /No 4h bars came back/, 'the page says which timeframe is empty');
  assert.doesNotMatch(p.els.get('chWhen').textContent, /\d{4,}/, 'and no price appears in the sentence');
});

test('an engine that will not start is reported, not worked around', async () => {
  const p = await loadPage({ feed: chartFeed() });
  const { engine } = fakeEngine();
  engine.createChart = () => { throw new Error('no canvas here') };
  p.sandbox.LightweightCharts = engine;
  p.sandbox.drawChart();
  assert.strictEqual(p.sandbox.CHART, null, 'nothing is left half-built');
  assert.match(p.els.get('chWhen').textContent, /would not start/, 'and the page says so in its own words');
  assert.match(p.els.get('chWhen').textContent, /Nothing was invented in its place/, 'the rule the whole page runs on');
});

test('the delay is stated on the chart itself, not in a footnote', async () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.match(html, /Delayed &mdash; your broker's chart wins/, 'the flag sits over the candles');
  assert.match(html, /class="chartflag"/, 'and is drawn on the chart box, not under it');
  const p = await loadPage({ feed: chartFeed() });
  const { engine } = fakeEngine();
  p.sandbox.LightweightCharts = engine;
  p.sandbox.setChartTf('4h');
  assert.match(p.els.get('chWhen').textContent, /Free feed: delayed/,
    'and the line under it says the same thing after a draw');
  assert.match(p.els.get('chWhen').textContent, /different contract/,
    'including the other thing that makes a free feed not his chart');
});

// ── the trade log ───────────────────────────────────────────────────────────

// Logs a trade the way the form does, through the page's own open/save buttons.
function logTrade(p, fields) {
  p.sandbox.openTrade();
  const el = (id) => p.els.get(id);
  const n = (v) => (v === null || v === undefined ? '' : String(v));
  el('tMk').value = fields.mk || '';
  el('tSu').value = fields.su || '';
  el('tDir').value = fields.dir || 'long';
  el('tEn').value = n(fields.en);
  el('tSt').value = n(fields.st);
  el('tTg').value = n(fields.tg);
  el('tEx').value = n(fields.ex);
  el('tPv').value = n(fields.pv);
  el('tC').value = n(fields.c);
  el('tNote').value = fields.note || '';
  el('saveT').onclick();
}

test('a trade logged on the page is kept, and the R is arithmetic on his own numbers', async () => {
  const p = await loadPage();
  assert.strictEqual(p.sandbox.TRADES.length, 0, 'a fresh desk starts with nothing logged');
  assert.strictEqual(p.els.get('tnone').style.display, 'block', 'and says so rather than showing a trade');

  writeSetup(p, SWEEP);
  logTrade(p, {
    mk: 'NQ', su: SWEEP.n, dir: 'long',
    en: 21480, st: 21470, tg: 21510, ex: 21500,
    note: 'swept the overnight low and reclaimed it on the 5m',
  });

  assert.strictEqual(p.sandbox.TRADES.length, 1);
  const t = p.sandbox.TRADES[0];
  assert.strictEqual(t.en, 21480, 'his entry, as he typed it');
  assert.strictEqual(p.sandbox.riskPoints(t), 10, 'the risk is the distance to his stop, in points');
  assert.strictEqual(p.sandbox.rOf(t), 2, 'twenty points his way against ten at risk is 2R');
  assert.ok(p.stored['tsid.desk.trades'], 'and it is kept on the device');
  assert.match(p.stored['tsid.desk.trades'], /London sweep and reclaim/);
  assert.match(p.els.get('tlist').innerHTML, /\+2\.00R/, 'the page shows the result it worked out');
  assert.strictEqual(p.els.get('tnone').style.display, 'none');
});

test('a short trade works the same way, the other way up', async () => {
  const p = await loadPage();
  logTrade(p, { dir: 'short', mk: 'ES', en: 100, st: 101, ex: 98 });
  const t = p.sandbox.TRADES[0];
  assert.strictEqual(t.dir, 'short');
  assert.strictEqual(p.sandbox.riskPoints(t), 1);
  assert.strictEqual(p.sandbox.rOf(t), 2, 'two points his way against one at risk');
});

test('no exit, no stop, or a stop sitting on the entry is never given a made-up result', async () => {
  const p = await loadPage();
  logTrade(p, { mk: 'NQ', en: 100, st: 99 });
  logTrade(p, { mk: 'NQ', en: 100, st: null, ex: 102 });
  logTrade(p, { mk: 'NQ', en: 100, st: 100, ex: 102, note: 'stop on the entry' });
  assert.strictEqual(p.sandbox.TRADES.length, 3);
  for (const t of p.sandbox.TRADES) {
    assert.strictEqual(p.sandbox.rOf(t), null, 'a result with no risk behind it is not a result');
    assert.strictEqual(p.sandbox.riskPoints(t) === null || p.sandbox.riskPoints(t) > 0, true);
  }
  const html = p.els.get('tlist').innerHTML;
  assert.ok(!/NaN|Infinity/.test(html), 'nothing divides by zero on the page');
  assert.match(html, /open — no exit written down/);
  assert.match(html, /no result: needs an entry and a stop/);
  assert.match(p.els.get('jsum').innerHTML, /counted nowhere/,
    'and the journal says which ones it left out rather than quietly dropping them');
});

test('a trade with no entry is not stored as a row of blanks', async () => {
  const p = await loadPage();
  logTrade(p, { mk: 'NQ', en: null, st: 99, ex: 101 });
  assert.strictEqual(p.sandbox.TRADES.length, 0, 'no entry, no trade');
});

test('the journal adds up his own numbers, and the count rides with the percentage', async () => {
  const p = await loadPage();
  logTrade(p, { su: 'Sweep', en: 100, st: 99, ex: 102 });   // +2R
  logTrade(p, { su: 'Sweep', en: 100, st: 99, ex: 99 });    // -1R
  const sum = p.sandbox.journalHtml();
  assert.strictEqual(p.sandbox.closedTrades().length, 2);
  assert.match(sum, /2 trades written down/, 'his own count');
  assert.match(sum, /2<\/b> closed|2 closed|1<\/b> closed/, 'and how many of them are closed');
  assert.match(sum, /Win rate: <b>50%<\/b> — 1 won of 2 closed/,
    'the count sits on the same line as the percentage, which is the whole condition on printing one');
  assert.match(sum, /\+1\.00R/, 'his own arithmetic, added up');
  assert.match(sum, /Sweep: 2 closed, 1 won, 1 lost/, 'and grouped by the setup he named');
  assert.match(sum, /not a backtest, it is not a measurement of an edge/);
  assert.ok(!/you are due|expect/i.test(sum), 'and nothing in it reads as a forecast');
});

test('his trade log travels with every question, and an empty log says so', async () => {
  const p = await loadPage();
  // Empty first: the instruction that matters is the one that stops a model
  // reviewing a trade that does not exist.
  assert.match(p.sandbox.tradesText(), /NOTHING LOGGED YET/);
  assert.match(p.sandbox.tradesText(), /Do not invent a trade, a result or a pattern to review/);
  assert.match(p.sandbox.askSystem(), /NOTHING LOGGED YET/, 'and it rides along with the question');

  writeSetup(p, SWEEP);
  logTrade(p, { mk: 'NQ', su: SWEEP.n, en: 100, st: 99, ex: 102 });
  p.els.get('askQ').value = 'Should I take this one?';
  await p.sandbox.ask();

  const system = p.chats[0].body.system[0].text;
  assert.match(system, /HIS OWN TRADE LOG/);
  assert.match(system, /1 written down, 1 with a result, 0 still open/);
  assert.match(system, /result \+2\.00R/, 'the trade goes with the question, with its own arithmetic');
  assert.match(system, /do not work out an expectancy, an "edge"/,
    'the log is never turned into an edge - only the journal numbers below it may be used');
  assert.match(system, /HIS JOURNAL/, 'and the journal rides with the question too');
  assert.match(system, /Win rate: 100% — 1 won, 0 lost/, 'with the real numbers, not sums done in its head');
  assert.match(system, /London sweep and reclaim/, 'the setups still travel with it, as before');
});

test('reviewing a trade sends the trade, his setups, and the rules that mark the decision', async () => {
  const p = await loadPage();
  writeSetup(p, SWEEP);
  logTrade(p, {
    mk: 'NQ', su: SWEEP.n, dir: 'long',
    en: 100, st: 99, tg: 103, ex: 99.5,
    note: 'swept the low and reclaimed it on the 5m',
  });

  await p.sandbox.reviewTrade(0);
  assert.strictEqual(p.chats.length, 1);
  const system = p.chats[0].body.system[0].text;
  const question = p.chats[0].body.messages[0].content
    .filter((b) => b && b.type === 'text').map((b) => b.text).join('');

  assert.match(system, /THE TRADE BEING REVIEWED/);
  assert.match(system, /Setup he says it was: London sweep and reclaim/);
  assert.match(system, /Entry: 100\.00/, 'the numbers he gave are handed over');
  assert.match(system, /Risk, in points: 1\.00/);
  assert.match(system, /Result, in R: -0\.50R/, 'a loser, and it is still reviewed on the decision');
  assert.match(system, /What he saw, in his words: swept the low and reclaimed it on the 5m/);

  // The rules that make this a review rather than a chat.
  assert.match(system, /MARK THE DECISION, NOT THE RESULT/);
  assert.match(system, /A trade that paid can still have been a bad decision and a loss can be a good one/);
  assert.match(system, /Was the entry at his own trigger, or did he get in early on the idea\?/);
  assert.match(system, /Was the stop where his setup says the stop goes/);
  assert.match(system, /END WITH|ONE thing to do differently next time/);
  assert.match(system, /far too few trades for that to mean anything/);
  assert.match(system, /Never size a position and never invent a money figure/);
  assert.match(system, /never how many contracts to trade/, 'and it never sizes the trade for him');
  assert.match(system, /Never tell him he is finished/);
  assert.match(question, /Where was the decision wrong/, 'it asks for a review, not a chat');
  assert.match(p.els.get('askA').innerHTML, /Wrong if|4h|Entry/, 'and the answer lands on the page');
});

test('a review of a half-written trade says which field is missing instead of guessing it', async () => {
  const p = await loadPage();
  logTrade(p, { mk: 'NQ', en: 100, st: null, ex: 101 });
  const text = p.sandbox.tradeText(p.sandbox.TRADES[0]);
  assert.match(text, /Stop: not said/);
  assert.match(text, /Setup he says it was: he did not name one/);
  assert.match(text, /Risk, in points: cannot be worked out: entry or stop is missing/);
  assert.match(text, /Result, in R: cannot be worked out yet/);
  assert.match(text, /If a field the review needs is missing, name it and review what is there/);
});

test('markup in a trade cannot put markup on the page', async () => {
  const p = await loadPage();
  logTrade(p, {
    mk: '<img src=x onerror=alert(1)>', su: '<b>bold</b>',
    en: 100, st: 99, ex: 101, note: '<script>alert(1)</script>',
  });
  const html = p.els.get('tlist').innerHTML;
  // <b> is this page's own markup; what must not appear is the tag a trade
  // field carried in with it.
  assert.ok(!/<img|<script/.test(html), 'a trade field was inserted as markup');
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script/);
});

// ── the journal ─────────────────────────────────────────────────────────────

test('the journal counts wins, losses, break-evens, and leaves open trades out', async () => {
  const p = await loadPage();
  logTrade(p, { su: 'Sweep', dir: 'long', en: 100, st: 99, ex: 102 });   // +2R won
  logTrade(p, { su: 'Sweep', dir: 'long', en: 100, st: 99, ex: 101 });   // +1R won
  logTrade(p, { su: 'Sweep', dir: 'long', en: 100, st: 99, ex: 103 });   // +3R won
  logTrade(p, { su: 'Retest', dir: 'long', en: 100, st: 99, ex: 99 });   // -1R lost
  logTrade(p, { su: 'Retest', dir: 'long', en: 100, st: 99, ex: 100 });  // 0R break-even
  logTrade(p, { su: 'Retest', dir: 'long', en: 100, st: 99, ex: null }); // still open

  const s = p.sandbox.journalStats();
  assert.strictEqual(s.written, 6, 'everything he wrote down is accounted for');
  assert.strictEqual(s.closed, 5, 'the open one is not a result');
  assert.strictEqual(s.missing, 1);
  assert.strictEqual(s.won, 3);
  assert.strictEqual(s.lost, 1);
  assert.strictEqual(s.flat, 1);
  assert.strictEqual(s.winRate, 60, '3 of 5 closed - the open trade is in neither half');
  assert.strictEqual(Math.round(s.netR * 100) / 100, 5, '+2+1+3-1+0');
  assert.strictEqual(Math.round(s.grossWin * 100) / 100, 6, 'what the winners paid');
  assert.strictEqual(Math.round(s.grossLoss * 100) / 100, -1, 'what the losers cost');
  assert.strictEqual(Math.round(s.avgWin * 100) / 100, 2, 'winners averaged +2R');
  assert.strictEqual(Math.round(s.avgLoss * 100) / 100, -1, 'losers averaged -1R');
  assert.strictEqual(s.bestR, 3);
  assert.strictEqual(s.worstR, -1);

  const html = p.sandbox.journalHtml();
  assert.match(html, /Win rate: <b>60%<\/b> — 3 won of 5 closed/, 'the count is welded to the percentage');
  assert.match(html, /1 lost/, 'and the losses are named, not folded into the rate');
  assert.match(html, /1 at break-even/, 'a break-even trade is neither a win nor a loss');
  assert.match(html, /\+5\.00R/, 'profit and loss, in R');
  assert.match(html, /won \+6\.00R against -1\.00R lost/);
  assert.match(html, /Your winners averaged \+2\.00R each; your losers averaged -1\.00R each/,
    'this is the risk against reward he asked for');
});

test('nothing closed means no percentage at all, not zero per cent', async () => {
  const p = await loadPage();
  logTrade(p, { su: 'Sweep', en: 100, st: 99, ex: null });
  const s = p.sandbox.journalStats();
  assert.strictEqual(s.closed, 0);
  assert.strictEqual(s.winRate, null, 'null, so nothing downstream can print it as 0%');
  assert.strictEqual(s.avgWin, null);
  assert.strictEqual(s.avgLoss, null);
  const html = p.sandbox.journalHtml();
  assert.ok(!/%/.test(html), 'a 0% win rate would read as a losing record rather than an empty one');
  assert.match(html, /Nothing closed yet: no win rate, no profit and loss\. Not zero — blank\./);
  assert.match(html, /1 trade written down, <b>0<\/b> closed/, 'and it says how much is there');
  assert.ok(!/NaN|Infinity|undefined/.test(html), 'no arithmetic leaks onto the page');
});

test('points follow the direction, so a short is not counted as a loss by accident', async () => {
  const p = await loadPage();
  logTrade(p, { su: 'Sweep', dir: 'short', en: 100, st: 101, ex: 95 });  // +5R on 1 point of risk, +5 points
  const s = p.sandbox.journalStats();
  assert.strictEqual(s.won, 1);
  assert.strictEqual(Math.round(s.netPts * 100) / 100, 5,
    'a short that went his way is profit in points, not a negative number');
  assert.strictEqual(Math.round(s.netR * 100) / 100, 5);
});

test('the journal is handed to the assistant, and told what it is not', async () => {
  const p = await loadPage();

  // Empty: the instruction that stops a model inventing a record.
  const empty = p.sandbox.journalText();
  assert.match(empty, /NOTHING IS CLOSED YET/);
  assert.match(empty, /Do not report 0% and do not describe a record he does not have/);

  logTrade(p, { su: 'Sweep', dir: 'long', en: 100, st: 99, ex: 102 });
  const one = p.sandbox.journalText();
  assert.match(one, /Win rate: 100% — 1 won, 0 lost/);
  assert.match(one, /Net: \+2\.00R \(won \+2\.00R, lost \+0\.00R\), net \+2\.00 points\./);
  assert.match(one, /They are not a prediction, not an edge, and not evidence about the next one/);
  assert.match(one, /never tell him to size up because he is winning, and never tell him to win it back because he is losing/,
    'the two ways a record like this gets somebody hurt');
  assert.match(p.sandbox.askSystem(), /HIS JOURNAL/, 'and it rides with every question');
});

test('the record is a dated list, newest first, with what he saw at the time', async () => {
  const p = await loadPage();
  logTrade(p, { mk: 'NQ', su: 'Sweep', en: 100, st: 99, ex: 102, note: 'swept the low and reclaimed it' });
  logTrade(p, { mk: 'ES', su: 'Retest', dir: 'short', en: 200, st: 202, ex: 203, note: 'took it before the trigger' });

  const rec = p.sandbox.journalRecordHtml();
  const newest = rec.indexOf('ES short');
  const oldest = rec.indexOf('NQ long');
  assert.ok(newest !== -1 && oldest !== -1, 'both trades are in the record');
  assert.ok(newest < oldest, 'newest first - the trade he has just taken is the one he wants to see');
  assert.match(rec, /swept the low and reclaimed it/, 'his own words survive into the record');
  assert.match(rec, /\+2\.00R/);
  assert.match(rec, /-1\.50R/, 'a short stopped out is a negative R');
  assert.match(rec, /class="jdate"/, 'every line is dated - that is what makes it a journal');
});

test('the log chip answers under the review rules, not the general ones', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.match(html, /data-sys="trade">Read me my journal</, 'the chip has to say which rules it runs under');
  assert.match(html, /sys==='trade' \? askSystem\(TRADE_SYS\)/, 'and it is read under them and nothing else');
});

// ── the door ────────────────────────────────────────────────────────────────

// -- what the trade cost to place ------------------------------------------
// 21 Sep 2026. "NinjaTrader micros, I pay .39 a contract." Everything on this
// page was worked out at the market's price, and nobody is filled at the
// market's price. That gap is the whole difference between a backtest and an
// account, so the desk now pays the commission - his rate, typed in by him and
// never assumed - and says plainly when it has no rate to pay it with.

test('with no commission rate the money stays gross, and the page says so', async () => {
  const p = await loadPage();
  logTrade(p, { mk: 'MNQ', su: 'Sweep', dir: 'long', en: 100, st: 99, ex: 102, pv: 2 });
  const t = p.sandbox.TRADES[0];
  assert.strictEqual(p.sandbox.rateOf(), null, 'nothing is assumed');
  assert.strictEqual(p.sandbox.costOf(t), null,
    'no rate means no cost - not a zero, which would read as free');
  assert.strictEqual(p.sandbox.netMoneyOf(t), null, 'and no net figure to mistake for what he kept');
  assert.strictEqual(p.sandbox.moneyOf(t), 4, 'the gross is still his own arithmetic');
  const html = p.els.get('tlist').innerHTML;
  assert.match(html, /before costs/, 'the one money figure is labelled');
  assert.ok(!/After costs/.test(html), 'and there is no net line to misread');
  assert.match(p.els.get('cRateHint').textContent, /Nothing is assumed/);
  assert.match(p.sandbox.tradesText(), /every money figure in this log is BEFORE costs/);
});

test('the commission comes off both ends, and the net is what he actually kept', async () => {
  const p = await loadPage();
  p.sandbox.COST.rate = 0.78;   // .39 a side, in and out
  logTrade(p, { mk: 'MNQ', su: 'Sweep', dir: 'long', en: 100, st: 99, ex: 102, pv: 2, c: 1 });
  const t = p.sandbox.TRADES[0];
  assert.strictEqual(Math.round(p.sandbox.moneyOf(t) * 100) / 100, 4, '2 points at $2 - the market price');
  assert.strictEqual(Math.round(p.sandbox.costOf(t) * 100) / 100, 0.78);
  assert.strictEqual(Math.round(p.sandbox.netMoneyOf(t) * 100) / 100, 3.22);

  const html = p.els.get('tlist').innerHTML;
  assert.match(html, /before costs/);
  assert.match(html, /After costs/);
  assert.match(html, /\$3\.22/);
  assert.match(html, /\$0\.78 commission on 1 contract at \$0\.78 each, in and out/);
  assert.match(p.sandbox.tradesText(), /gross \$4\.00 and net \$3\.22 after \$0\.78 of commission/,
    'the assistant is handed both, so it can never quote the flattering one');
});

test('the cost follows the contract count, and a missing count is one contract', async () => {
  const p = await loadPage();
  p.sandbox.COST.rate = 0.78;
  logTrade(p, { su: 'Sweep', dir: 'long', en: 100, st: 99, ex: 102, pv: 6, c: 3 });
  logTrade(p, { su: 'Sweep', dir: 'long', en: 100, st: 99, ex: 102, pv: 2 });
  const three = p.sandbox.TRADES[0];
  assert.strictEqual(p.sandbox.contractsOf(three), 3);
  assert.strictEqual(Math.round(p.sandbox.costOf(three) * 100) / 100, 2.34, 'three round turns, not one');
  assert.strictEqual(Math.round(p.sandbox.netMoneyOf(three) * 100) / 100, 9.66);
  assert.strictEqual(p.sandbox.contractsOf(p.sandbox.TRADES[1]), 1,
    'a micro is one contract when he does not say');
  // A zero or a nonsense count must never quietly make the trade free.
  assert.strictEqual(p.sandbox.contractsOf({ c: 0 }), 1);
  assert.strictEqual(p.sandbox.contractsOf({ c: -4 }), 1);
  assert.strictEqual(p.sandbox.contractsOf({ c: 'nonsense' }), 1);
  assert.strictEqual(Math.round(p.sandbox.costOf({ c: 0 }) * 100) / 100, 0.78);
});

test('the journal shows what was kept, not just what the market paid', async () => {
  const p = await loadPage();
  p.sandbox.COST.rate = 0.78;
  logTrade(p, { su: 'Sweep', dir: 'long', en: 100, st: 99, ex: 102, pv: 2 });   // +$4 gross
  logTrade(p, { su: 'Retest', dir: 'long', en: 100, st: 99, ex: 99, pv: 2 });   // -$2 gross
  const s = p.sandbox.journalStats();
  assert.strictEqual(Math.round(s.netMoney * 100) / 100, 2, 'gross: +4 and -2');
  assert.strictEqual(Math.round(s.costTotal * 100) / 100, 1.56, 'two round turns');
  assert.strictEqual(Math.round(s.netAfter * 100) / 100, 0.44, 'and this is the honest one');
  assert.strictEqual(s.afterN, 2, 'both closed trades carry a rate');

  const html = p.sandbox.journalHtml();
  assert.match(html, /After costs/);
  assert.match(html, /\$0\.44/);
  assert.match(html, /A backtest with no commission in it and a log with one are not the same trade/);
});

test('a trade with no point value is left out of the net, and the count travels with the total', async () => {
  const p = await loadPage();
  p.sandbox.COST.rate = 0.78;
  logTrade(p, { su: 'Sweep', dir: 'long', en: 100, st: 99, ex: 102, pv: 2 });
  logTrade(p, { su: 'Sweep', dir: 'long', en: 100, st: 99, ex: 103, pv: null });
  const s = p.sandbox.journalStats();
  assert.strictEqual(s.closed, 2);
  assert.strictEqual(s.afterN, 1, 'only one of them can carry a net figure');
  assert.match(p.sandbox.journalHtml(), /1 left out/,
    'a total that quietly covers half the trades is a lie by omission');
});

test('the rules keep gross and net apart, and never let a backtest be a measurement', async () => {
  const p = await loadPage();
  const sys = p.sandbox.TRADE_SYS;
  assert.match(sys, /Gross and net are different numbers and you never use the flattering one/);
  assert.match(sys, /the net figure is what he kept/);
  assert.match(sys, /Never treat a backtest as a measurement/);
  assert.match(sys, /Never size a position and never invent a money figure/,
    'the older rule is still there');
});

test('the rate he types is the rate that is saved and used', async () => {
  const p = await loadPage();
  const el = p.els.get('cRate');
  el.value = '0.39';
  el._on.input();
  assert.strictEqual(p.sandbox.rateOf(), 0.39, 'his own number, not a default');
  assert.match(p.stored['tsid.desk.cost'], /0\.39/, 'and it is kept on the device');
  assert.match(p.els.get('cRateHint').textContent, /Counted at \$0\.39 a contract, in and out/);
  el.value = '';
  el._on.input();
  assert.strictEqual(p.sandbox.rateOf(), null, 'clearing it goes back to gross rather than to zero');
});

test('the desk is behind the door, at both of its addresses', () => {
  for (const url of ['/desk', '/desk.html']) {
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

test('the worker never caches the desk', () => {
  assert.match(SW, /\['\/desk', '\/desk\.html'\]\.includes\(url\.pathname\)\) return;/,
    'a cached copy would outlive the sign-in check');
});

test('the app has a way in to the desk', () => {
  assert.ok(APP.includes("location.href='/desk'"), 'the Tools row must point at it or it cannot be reached');
});

test('a signed-out request for the desk never gets the file', async () => {
  // The text checks above cannot see the failure that matters: express.static
  // answering /desk.html first because the gated route was registered after it.
  // So this boots the real static over the real app folder, with the gate in
  // front exactly as server.js has it, and makes the request.
  const express = require('express');
  const app = express();
  const gate = (req, res) => {
    if (req.get('x-signed-in') !== 'yes') return res.redirect('/app');
    res.sendFile(PAGE);
  };
  app.get('/desk', gate);
  app.get('/desk.html', gate);
  app.use(express.static(ROOT));
  app.get('/app', (req, res) => res.type('text/plain').send('the app'));

  const server = app.listen(0);
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (p2, signedIn) => fetch(base + p2, {
    redirect: 'manual',
    headers: signedIn ? { 'x-signed-in': 'yes' } : {},
  }).then(async (r) => ({ status: r.status, location: r.headers.get('location'), body: await r.text() }));
  try {
    for (const url of ['/desk', '/desk.html']) {
      const cold = await get(url);
      assert.strictEqual(cold.status, 302, `${url}: signed out must be redirected, not served`);
      assert.strictEqual(cold.location, '/app');
      assert.ok(!cold.body.includes('Trading Desk'), `${url}: no part of the page may come back`);

      const warm = await get(url, true);
      assert.strictEqual(warm.status, 200, `${url}: signed in and on the list gets the page`);
      assert.ok(warm.body.length > 8000, `${url}: and it is the page, not a stub`);
    }
  } finally {
    server.close();
  }
});

// ── the frame, read off the page's own bars ─────────────────────────────────
//
// Jacques, 19 Sep 2026: "build the desk reading its own chart". The script on
// his TradingView chart (Someday) reads a frame — a lower low sets the level and
// the frame low, only a CLOSE above the level cancels it, and the small chart is
// read for higher highs with the last higher low still holding — and he had to
// carry that read to the assistant by hand. The page works it out now, from its
// own candles, so the two can be held against each other.
//
// What is checked here is the two things that would make this worse than no read
// at all:
//   1. A cancelled frame left standing. A level from hours ago next to a live
//      price is exactly what he complained about on his own chart — so a
//      cancelled frame must show NO price, and the assistant must be told not to
//      supply one.
//   2. A verdict read off nothing. "short" and "long scalp" may only come out of
//      bars that actually came back, on the timeframe the page names.

// The fixtures. Each value is a bar's MID; its high is mid+1 and its low is
// mid-1, so every number below can be checked by eye: the swing high at mid 115
// is the level 116, and the lower low at mid 85 is the frame low 84.
const FRAME_DOWN = [100, 110, 120, 110, 100, 90, 95, 105, 115, 105, 95, 85, 90, 95, 100, 95, 90];
const FRAME_AT = FRAME_DOWN.concat([115]);
const FRAME_GONE = [100, 110, 120, 110, 100, 90, 95, 105, 115, 105, 95, 85, 120, 95, 100, 95, 90];
const FRAME_NONE = [100, 110, 120, 110, 100, 110, 120, 110, 100, 110, 120];
const SMALL_UP = [100, 110, 120, 110, 100, 90, 95, 105, 115, 105, 95, 92, 100, 110, 120, 115, 110, 115];

function frameFeed(bars, small) {
  const base = Date.parse('2026-09-18T00:00:00Z');
  const mk = (vals, step) => vals.map((v, i) => ({ t: base + i * step, o: v, h: v + 1, l: v - 1, c: v, v: 100 + i }));
  return {
    ok: true, symbol: 'NQ=F', name: 'Nasdaq 100', partial: null, error: null,
    timeframes: {
      '5m': { ok: true, candles: mk(small || FRAME_NONE, 5 * 60000) },
      '15m': { ok: true, candles: mk(small || FRAME_NONE, 15 * 60000) },
      '1h': { ok: true, candles: mk(bars, 60 * 60000) },
      '4h': { ok: true, candles: mk(bars, 4 * 60 * 60000) },
    },
  };
}

test('the desk reads the frame off its own bars, and names the numbers', async () => {
  const p = await loadPage({ feed: frameFeed(FRAME_DOWN) });
  const r = p.sandbox.frameRead();
  assert.strictEqual(r.tf, '1h', 'it opens on the frame he reads');
  assert.strictEqual(r.smallTf, '15m', 'and the small chart is the step below it');
  assert.strictEqual(r.level, 116, 'the level is the swing high the drop came from');
  assert.strictEqual(r.low, 84, 'and the frame low is the lower low');
  assert.strictEqual(r.lowerLow, true);
  assert.strictEqual(r.state, 'retracing', 'price is back under the level and above the low');
  assert.strictEqual(r.atLevel, false, 'nothing reached the level in these bars');
  assert.strictEqual(r.verdict, 'wait', 'so there is nothing to do — and wait is a complete answer');
  assert.ok(r.highs >= 2 && r.lows >= 2, 'and it counts the swings the frame gave it');
  assert.ok(!/NaN|Infinity/.test(p.sandbox.frameText()), 'nothing divides by zero');
});

test('a frame is only down while no bar has CLOSED above its level', async () => {
  const p = await loadPage({ feed: frameFeed(FRAME_AT) });
  const r = p.sandbox.frameRead();
  assert.strictEqual(r.changed, false, 'a poke up to the level cancels nothing');
  assert.strictEqual(r.level, 116, 'the level is still the level');
  assert.strictEqual(r.atLevel, true, 'and price is at it');
  assert.strictEqual(r.verdict, 'short', 'which is his own entry, by his own rules');
});

test('a close above the level cancels the frame, and no price is left standing', async () => {
  const p = await loadPage({ feed: frameFeed(FRAME_GONE) });
  const r = p.sandbox.frameRead();
  assert.strictEqual(r.changed, true);
  assert.strictEqual(r.state, 'frame changed');
  assert.strictEqual(r.verdict, 'wait - the frame changed');
  assert.strictEqual(r.cancelAgo, 4, 'and it says how long ago, in bars of that frame');
  assert.strictEqual(r.level, null, 'the level is dropped rather than left up beside a live price');
  assert.strictEqual(r.low, null, 'and so is the low');

  const text = p.sandbox.frameText();
  assert.match(text, /NO LEVEL IS SHOWN/);
  assert.match(text, /Do not supply one/);
  assert.doesNotMatch(text, /116/, 'and there is no number in the block for the assistant to repeat');
  p.sandbox.paintFrame();
  const shown = p.els.get('frOut').innerHTML;
  assert.match(shown, /frame changed/);
  assert.doesNotMatch(shown, /116\.00/, 'the card shows no level either');
});

test('no lower low means no frame, and the page says which of the two it is', async () => {
  const p = await loadPage({ feed: frameFeed(FRAME_NONE) });
  const r = p.sandbox.frameRead();
  assert.strictEqual(r.ok, true, 'the bars came back and were read');
  assert.strictEqual(r.lowerLow, false);
  assert.strictEqual(r.level, null);
  assert.strictEqual(r.state, 'no frame yet');
  assert.strictEqual(r.verdict, 'wait');
  assert.match(r.why, /no lower low on 1h/);
  assert.match(p.sandbox.frameText(), /Swings the frame gave it: \d+ highs and \d+ lows/,
    'and it still says what it was given, so an empty read explains itself');
  p.sandbox.paintFrame();
  assert.match(p.els.get('frWhen').textContent, /no lower low on 1h/);
});

test('the small chart has to turn up, and then the verdict is his long scalp', async () => {
  const p = await loadPage({ feed: frameFeed(FRAME_DOWN, SMALL_UP) });
  const s = p.sandbox.smallChart(p.sandbox.FEED.timeframes['15m'].candles);
  assert.strictEqual(s.up, true, 'a higher high, and the last higher low still holding');
  assert.strictEqual(s.hold, 91, 'the hold is a number and not a feeling');
  const r = p.sandbox.frameRead();
  assert.strictEqual(r.state, 'retracing');
  assert.strictEqual(r.verdict, 'long scalp');

  const closedUnder = SMALL_UP.slice(0, 17).concat([90]);
  const p2 = await loadPage({ feed: frameFeed(FRAME_DOWN, closedUnder) });
  const r2 = p2.sandbox.frameRead();
  assert.strictEqual(r2.up, false, 'a close under that low ends the hold');
  assert.strictEqual(r2.verdict, 'wait', 'so the scalp is off');
});

test('the frame is read on the timeframe he picks, and kept', async () => {
  const p = await loadPage({ feed: frameFeed(FRAME_DOWN) });
  assert.strictEqual(p.sandbox.frameRead().tf, '1h');
  p.sandbox.setFrameTf('4h');
  assert.strictEqual(p.sandbox.FRAMETF, '4h');
  assert.match(p.stored['tsid.desk.frame'], /4h/, 'so it opens on the one he was reading');
  assert.strictEqual(p.sandbox.frameRead().tf, '4h');
  p.sandbox.setFrameTf('15m');
  assert.strictEqual(p.sandbox.frameRead().smallTf, '5m',
    'and the small chart steps below it, so the same bars are never read twice');
  p.sandbox.setFrameTf('1D');
  assert.strictEqual(p.sandbox.FRAMETF, '15m', 'a timeframe it has no bars for changes nothing');
});

test('the page and the assistant are handed the same frame, off the same bars', async () => {
  const p = await loadPage({ feed: frameFeed(FRAME_DOWN, SMALL_UP) });
  p.sandbox.paintFrame();
  const shown = p.els.get('frOut').innerHTML;
  const text = p.sandbox.frameText();
  for (const bit of ['116.00', '84.00', 'long scalp']) {
    assert.ok(shown.includes(bit), `${bit} is on the page`);
    assert.ok(text.includes(bit), `${bit} is in what the assistant is handed`);
  }
  assert.ok(!/NaN|Infinity/.test(shown + text), 'nothing divides by zero');
  assert.match(p.sandbox.askSystem(), /THE FRAME - his own rules/, 'and every question carries it');
  assert.match(p.els.get('frWhen').textContent, /The same rules the script on your chart runs/);
  assert.match(text, /never turn the verdict into a promise/i, 'with the rule about what it may not become');
});

test('no candles, no frame — and the assistant is told not to invent one', async () => {
  const p = await loadPage();
  assert.strictEqual(p.sandbox.frameRead().ok, false);
  const text = p.sandbox.frameText();
  assert.match(text, /NOT READ - no candles/);
  assert.match(text, /do not name a level/);
  p.sandbox.paintFrame();
  assert.strictEqual(p.els.get('frOut').innerHTML, '', 'and no card is drawn');
  assert.match(p.els.get('frWhen').textContent, /No candles loaded/);
  assert.doesNotMatch(text, /\d{4,}/, 'and no number of any kind reaches the assistant');
});

test('three bars are not a frame, and none is claimed from them', async () => {
  const p = await loadPage({ feed: candleSet() });
  const r = p.sandbox.frameRead();
  assert.strictEqual(r.ok, false);
  assert.match(r.why, /not enough 1h bars/);
  assert.strictEqual(r.level, null);
  assert.strictEqual(r.verdict, 'wait');
  assert.match(p.sandbox.frameText(), /not enough 1h bars came back to read a swing off/);
  assert.match(p.sandbox.frameText(), /NO LEVEL IS SHOWN/);
});

test('the house rules name the frame block, and the verdict is not a promise', async () => {
  const p = await loadPage();
  const desk = String(p.sandbox.DESK_SYS);
  assert.ok(desk.includes('THE FRAME BLOCK is the script on his chart run on this page'));
  assert.ok(desk.includes('a verdict that is only ever wait, short or long scalp'));
  assert.ok(desk.includes('Never turn that verdict into a promise, a probability or a target'));
  assert.ok(desk.includes('the session block, the frame block and the STUDY block are the only basis'));
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.ok(html.includes("closest('#frTf .tf')"), 'and its timeframe is picked on the page');
  assert.ok(html.includes('id="frOut"'), 'which has somewhere for the read to land');
});

// ── structure and the session ───────────────────────────────────────────────
//
// Jacques, 17 Sep 2026: "do you have a analyzer can it predict an earlier trend
// or consolidation based on what happened before like hh hl hh hl hh is close to
// the previous hh not really breaking structure with a lot of mommentum showing
// earling sings of a reversal or pullback to catch scalp and i only trade new
// york session im in central time zone saint louis missouri."
//
// Two things had to be built for that, and both of them are places a tool like
// this goes wrong:
//   1. Structure read as a forecast. The swings, the distance to the old high
//      and whether the bars are shrinking are arithmetic on closed bars. They
//      are useful, and they are not a prediction — the page never calls a turn
//      and the assistant is told it may not either.
//   2. A session asserted rather than read. His window is on HIS clock, the
//      page names the zone it actually read, and bars outside it are context.

// Bars built to his own description: an up run of higher highs and higher lows,
// price stalling just under the old high, with the last bars smaller than the
// ones before them. Handed over as a feed answer, so the whole read is driven
// the way the page drives it.
function stallingFeed() {
  const t0 = Date.parse('2026-09-17T14:00:00Z');
  const HL = [
    [100.5, 98], [101.5, 99], [103, 100], [102, 100.5], [100.5, 99.5], [99.5, 98.5],
    [100.5, 99.5], [102, 101], [104.5, 102.5], [107, 104], [105.5, 103.5], [103.5, 102],
    [102.5, 101.5], [104, 102.5], [106, 104], [109, 106.5], [112, 108], [110, 107.5],
    [108, 106], [107, 105.5], [109.5, 107], [111, 109], [111.5, 110], [111.8, 110.8], [111.6, 111],
  ];
  const candles = HL.map(([h, l], i) => ({
    t: t0 + i * 300000,
    o: i ? (HL[i - 1][0] + HL[i - 1][1]) / 2 : 99,
    h, l, c: (h + l) / 2, v: 10,
  }));
  return {
    ok: true, symbol: 'NQ=F', name: 'Nasdaq 100', partial: null, error: null,
    timeframes: {
      '5m': { ok: true, symbol: 'NQ=F', tf: '5m', asOf: '2026-09-17T16:00:00.000Z', bars: candles.length, candles },
    },
  };
}
const read5m = (p) => p.sandbox.readOf('5m', p.sandbox.FEED.timeframes['5m'].candles);

test('the structure read names the pattern he asked about, and puts a number on it', async () => {
  const p = await loadPage({ feed: stallingFeed() });
  const r = read5m(p);
  assert.ok(r, 'a read comes off the bars');
  assert.deepEqual(r.labels, ['HH', 'HL', 'HH', 'HL'], 'the swings he says out loud');
  assert.strictEqual(r.trend, 'up');
  assert.strictEqual(r.lastH, 112, 'the old high');
  assert.ok(Math.abs(r.gapHigh + 0.7) < 1e-9, 'price is under it, and has not taken it');
  assert.ok(r.mom < 0.8, 'the last bars are smaller than the eight before them');
  assert.ok(r.spanBars <= 3, 'and the last five are overlapping');

  const line = p.sandbox.structureLine(r);
  assert.match(line, /HH HL HH HL/);
  assert.match(line, /0\.70 under the last swing high \(112\.00\)/);
  assert.match(line, /the bars are getting smaller/);
  assert.match(line, /compressed/);
  assert.match(line, /105\.50/, 'the last higher low, which is where the run would end');

  const text = p.sandbox.structureText();
  assert.match(text, /THIS IS THE PICTURE HE DESCRIBED/);
  assert.match(text, /not through it/);
  assert.match(text, /105\.50/, 'and what would end it travels with the read');
  assert.match(text, /not "a reversal is coming"/, 'with the rule that it may not be turned into a call');
});

test('no candles means no structure, and not one number to quote', async () => {
  const p = await loadPage();
  const text = p.sandbox.structureText();
  assert.match(text, /NOT COMPUTED/);
  assert.match(text, /cannot read structure without candles/);
  assert.doesNotMatch(text, /\d{4,}/, 'not even a price hiding among the yardsticks');
  assert.strictEqual(p.els.get('stOut').innerHTML, '', 'and nothing is drawn');
  assert.match(p.els.get('stWhen').textContent, /No candles loaded/);
  assert.match(p.sandbox.askSystem(), /NOT COMPUTED/, 'the assistant is told it cannot read structure');
});

test('three bars are not structure, so none is claimed from them', async () => {
  const p = await loadPage({ feed: candleSet() });
  assert.strictEqual(p.sandbox.readOf('5m', p.sandbox.FEED.timeframes['5m'].candles), null);
  assert.match(p.sandbox.structureText(), /not enough bars came back to read a swing off/);
  assert.doesNotMatch(p.els.get('stOut').innerHTML, /HH|HL|LL/, 'no label is invented from three bars');
  assert.match(p.els.get('stOut').innerHTML, /not enough bars came back/);
});

test('the page shows the same structure it hands to the assistant', async () => {
  const p = await loadPage({ feed: stallingFeed() });
  const drawn = p.els.get('stOut').innerHTML;
  assert.match(drawn, /HH HL HH HL/);
  assert.match(drawn, /112\.00/);
  assert.match(drawn, /Run into the old high, not through it/);
  assert.match(p.els.get('stWhen').textContent, /it does not predict/);
  assert.match(p.sandbox.askSystem(), /HH HL HH HL/, 'and the same read travels with the question');
  assert.ok(!/NaN|Infinity/.test(drawn + p.sandbox.structureText()), 'nothing divides by zero');
});

test('the session is the New York one, on his own clock, and it is his to move', async () => {
  const p = await loadPage();
  assert.deepEqual(p.sandbox.SESS, { a: '08:30', b: '15:00' }, 'the US cash session, in his time');

  // The start counts, the end does not, and a window may run past midnight.
  assert.strictEqual(p.sandbox.inWindow(510, { a: '08:30', b: '15:00' }), true);
  assert.strictEqual(p.sandbox.inWindow(899, { a: '08:30', b: '15:00' }), true);
  assert.strictEqual(p.sandbox.inWindow(900, { a: '08:30', b: '15:00' }), false);
  assert.strictEqual(p.sandbox.inWindow(480, { a: '08:30', b: '15:00' }), false);
  assert.strictEqual(p.sandbox.inWindow(60, { a: '22:00', b: '02:00' }), true);
  assert.strictEqual(p.sandbox.inWindow(600, { a: '10:00', b: '10:00' }), null, 'no minutes is not a window');

  const text = p.sandbox.sessionText();
  assert.match(text, /New York session and nothing else/);
  assert.match(text, /08:30-15:00/);
  assert.match(text, /his own clock/);
  assert.match(text, /(IN his session|OUTSIDE his session)/);
  assert.match(text, /context, never a trigger/);
  assert.match(p.sandbox.askSystem(), /HIS SESSION/, 'and it rides along with every question');

  p.els.get('sA').value = '07:30';
  p.els.get('sB').value = '13:00';
  p.sandbox.saveSession();
  assert.deepEqual(p.sandbox.SESS, { a: '07:30', b: '13:00' }, 'the window is his, not ours');
  assert.match(p.stored['tsid.desk.session'], /07:30/, 'and it is kept on the device');

  p.els.get('sA').value = 'nonsense';
  p.sandbox.saveSession();
  assert.deepEqual(p.sandbox.SESS, { a: '07:30', b: '13:00' }, 'an unusable window is not saved over a real one');
});

test('the assistant is told what structure is for, and that it may not call a turn', async () => {
  const p = await loadPage();
  const sys = p.sandbox.DESK_SYS;
  assert.match(sys, /STRUCTURE, NOT A FORECAST/);
  assert.match(sys, /bars that have already closed/);
  assert.match(sys, /Never say a reversal, a pullback or a continuation is coming/);
  assert.match(sys, /The only thing that turns a read into a trade is his own 5m trigger/);
  assert.match(sys, /Bars outside that window are context and never a trigger/);
  assert.match(sys, /the only basis you have for structure and for timing/);

  // The never-do list is still in order — rule 9 landed above rule 8 once.
  assert.ok(sys.indexOf('7. Never tell him he is finished') < sys.indexOf('8. He already knows'));
  assert.ok(sys.indexOf('8. He already knows') < sys.indexOf('9. The structure block'));

  // And the blocks arrive in the order they are read: candles, then the read
  // off them, then the clock he trades them on.
  const sent = p.sandbox.askSystem();
  assert.ok(sent.indexOf('CANDLES FROM THE FEED') < sent.indexOf('STRUCTURE OFF THE BARS'));
  assert.ok(sent.indexOf('STRUCTURE OFF THE BARS') < sent.indexOf('Right now that clock reads'));
});

test('the desk has a chip for the question he actually asked', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.match(html, /is this a run of higher highs and higher lows pushing into the old high without taking it/);
  assert.match(html, /id="sA"/, 'and somewhere to put his own session window');
  assert.match(html, /id="stOut"/, 'and somewhere for the structure read to land');
});

// ── readable numbers, and what a point is worth ─────────────────────────────
//
// Jacques, 17 Sep 2026, with the desk open and the structure block in front of
// him: "i dont understand the numbers here kind of difficult to read simplify
// this and you pulled the charts you dont know how much a point is worth and
// actually right now i trading macros mnq mgc mes etcc.. look it up".
//
// Two things had to be true after that:
//   1. Every figure on the structure read sits behind a word. The arithmetic is
//      untouched — the same numbers — but no fact is a paragraph any more.
//   2. He trades micros, so the page knows what one point pays on a contract and
//      his own points can finally be money. A symbol the page does not know gets
//      NO figure rather than a guessed one, and the point value that counts is
//      the one on the trade, which he can overrule.

test('the structure read is one fact per line, with the word in front of the number', async () => {
  const p = await loadPage({ feed: stallingFeed() });
  const drawn = p.els.get('stOut').innerHTML;
  assert.match(drawn, /class="sttrend">Higher highs, higher lows</, 'the run, in words');
  assert.match(drawn, /class="stk">Price<\/span>/, 'a label on the distance to the old high');
  assert.match(drawn, /class="stk">Bars<\/span>/, 'and on the size of the bars');
  assert.match(drawn, /class="stk">Range<\/span>/);
  assert.match(drawn, /class="stk">Watch<\/span>/, 'and on the level that would end the run');
  assert.match(drawn, /Getting smaller/, 'the size of the bars as a word, not a ratio on its own');
  assert.match(drawn, /squeezed/);
  assert.match(drawn, /0\.70<\/b> under the last high \(112\.00\)/, 'the numbers he acts on are still there');
  assert.match(drawn, /105\.50/, 'and so is the last higher low');
  assert.match(drawn, /class="stflag">Run into the old high, not through it\./, 'the flag stays');
  assert.ok(!/class="sdet"/.test(drawn), 'no paragraph of numbers left on the page');
  assert.ok(!/NaN|Infinity/.test(drawn), 'nothing divides by zero');
});

test('the page knows what one point pays on the contracts he actually trades', async () => {
  const p = await loadPage();
  const pv = (s) => p.sandbox.pointValueOf(s);
  assert.strictEqual(pv('MNQ'), 2, 'micro Nasdaq');
  assert.strictEqual(pv('MNQ=F'), 2, 'the feed answers MNQ=F — the same contract');
  assert.strictEqual(pv('/MES'), 5, 'micro S&P');
  assert.strictEqual(pv('mgc'), 10, 'micro gold, whatever case he types it in');
  assert.strictEqual(pv('MCL'), 100, 'micro crude');
  assert.strictEqual(pv('GC=F'), 100, 'and the full-size ones are not mixed up with the micros');
  assert.strictEqual(pv('NQ'), 20);
  assert.strictEqual(pv('BTC-USD'), null, 'a symbol with no published size gets no figure at all');
  assert.strictEqual(pv('SPY'), null);
  assert.strictEqual(pv(''), null);
});

test('the feed card says what a point is worth on the symbol it loaded', async () => {
  const p = await loadPage({ feed: candleSet({ symbol: 'MNQ=F' }) });
  assert.match(p.els.get('fOut').innerHTML, /one point is <b>\$2\.00<\/b>/, 'the contract size is on the card');
  assert.match(p.sandbox.askSystem(), /One point on MNQ is \$2\.00 per contract/,
    'and it goes to the assistant with the candles');
  assert.match(p.sandbox.askSystem(), /ONLY to repeat the money line in the JOURNAL block/,
    'told what it may do with it, and what it may not');

  // A symbol the page cannot price says so instead of quietly having none.
  const q = await loadPage({ feed: candleSet({ symbol: 'BTC-USD' }) });
  assert.match(q.els.get('fOut').innerHTML, /No published contract size for BTC/);
  assert.match(q.sandbox.askSystem(), /is NOT known to this page, so there is no money figure/);
});

test('an answer that is not the contract is never priced as one', async () => {
  // His screenshot, 19 Sep 2026: typed MGC, got "Vanguard Morningstar Mega Cap
  // E" at 281.72, and the card printed gold's published size underneath a share
  // price. The feed refuses that answer now; if one ever reaches the page, the
  // page says what came back rather than pricing it as the contract.
  const p = await loadPage({
    feed: candleSet({ symbol: 'MGC', name: 'Vanguard Morningstar Mega Cap E', type: 'ETF', exchange: 'NYSEArca' }),
  });
  const card = p.els.get('fOut').innerHTML;
  assert.match(card, /one point is <b>\$10\.00<\/b>/, 'the contract size is still stated');
  assert.match(card, /What came back is ETF \(Vanguard Morningstar Mega Cap E\)/, 'named as what it is');
  assert.match(card, /not the MGC contract/, 'and named as not the contract');
  assert.match(card, /the prices above are not its market either/, 'so no gold price is implied by them');

  const told = p.sandbox.feedText();
  assert.match(told, /The feed says this instrument is ETF on NYSEArca/);
  assert.match(told, /do not read these bars as MGC/);
  assert.match(p.sandbox.askSystem(), /do not price a level off them/);
  assert.match(p.els.get('fWhen').textContent, /not a contract/, 'and the load line says so too');

  // A contract is left completely alone by all of it.
  const q = await loadPage({ feed: candleSet({ symbol: 'MNQ=F', type: 'FUTURE', exchange: 'CME' }) });
  assert.doesNotMatch(q.els.get('fOut').innerHTML, /What came back is/);
  assert.match(q.els.get('fWhen').textContent, /MNQ=F loaded\./);
  assert.match(q.sandbox.feedText(), /The feed says this instrument is FUTURE on CME/);

  // And a code he reads as an index on purpose is not accused of anything: the
  // feed only has the VIX index, so asking for it is the whole point.
  const v = await loadPage({
    feed: candleSet({ symbol: 'VIX', name: 'CBOE Volatility Index', type: 'INDEX', exchange: 'Cboe Indices' }),
  });
  assert.doesNotMatch(v.els.get('fOut').innerHTML, /What came back is/);
  assert.match(v.els.get('fOut').innerHTML, /No published contract size for VIX/);
  assert.doesNotMatch(v.els.get('fWhen').textContent, /not a contract/);
  assert.doesNotMatch(v.sandbox.feedText(), /do not read these bars as VIX/);
});

test('points become money only from the point value he put on the trade', async () => {
  const p = await loadPage();
  logTrade(p, { mk: 'MNQ', su: SWEEP.n, en: 21000, st: 20990, ex: 21020, pv: 2 });  // +20 pts, 2R, +$40
  const s = p.sandbox.journalStats();
  assert.strictEqual(s.moneyN, 1, 'the trade is priced');
  assert.strictEqual(s.netMoney, 40, 'twenty points at two dollars');
  assert.match(p.sandbox.journalHtml(), /\$40\.00/);
  assert.match(p.sandbox.journalText(), /Money: \$40\.00 across 1 of 1 closed trades/);
});

test('a trade with no point value is in no money total, and the page says which', async () => {
  const p = await loadPage();
  logTrade(p, { mk: 'MNQ', su: SWEEP.n, en: 100, st: 99, ex: 102, pv: 2 });   // +$2.00
  logTrade(p, { mk: 'SPY', su: SWEEP.n, en: 500, st: 499, ex: 503 });          // no point value
  const s = p.sandbox.journalStats();
  assert.strictEqual(s.closed, 2);
  assert.strictEqual(s.moneyN, 1);
  assert.strictEqual(s.moneyMissing, 1);
  assert.strictEqual(s.netMoney, 4, 'only the priced trade is in the total');
  const html = p.sandbox.journalHtml();
  assert.match(html, /\$4\.00/, 'the money is shown');
  assert.match(html, /1 left out, no point value on it/, 'with the count of what it does not cover');
  assert.match(p.sandbox.journalText(), /with 1 left out because no point value is on it/);
});

test('no point value anywhere means no money figure — not zero', async () => {
  const p = await loadPage();
  logTrade(p, { mk: 'SPY', su: SWEEP.n, en: 500, st: 499, ex: 503 });
  const s = p.sandbox.journalStats();
  assert.strictEqual(s.moneyN, 0);
  assert.ok(!/\$/.test(p.sandbox.journalHtml()), 'no dollar sign from nowhere');
  assert.match(p.sandbox.journalHtml(), /no point value on any closed trade yet/);
  assert.match(p.sandbox.journalText(), /there is no money figure\. Say that instead of working one out/);
  assert.match(p.sandbox.moneyRow(s), /no point value on any closed trade yet/);
});

test('the point value fills itself in from the market, and he can overrule it', async () => {
  const p = await loadPage();
  p.sandbox.openTrade();
  p.els.get('tMk').value = 'MNQ';
  p.sandbox.fillPointValue();
  assert.strictEqual(p.els.get('tPv').value, '2', 'filled in from the contract size');
  assert.match(p.els.get('tPvHint').textContent, /one point is \$2\.00/);

  // His own figure is never overwritten by the table.
  p.els.get('tPv').value = '3';
  p.els.get('tMk').value = 'MGC';
  p.sandbox.fillPointValue();
  assert.strictEqual(p.els.get('tPv').value, '3', 'what he typed wins');

  p.els.get('tEn').value = '4000';
  p.els.get('tSt').value = '3990';
  p.els.get('tEx').value = '4005';
  p.els.get('saveT').onclick();
  assert.strictEqual(p.sandbox.TRADES[0].pv, 3, 'and it saves with the trade');
  assert.strictEqual(p.sandbox.moneyOf(p.sandbox.TRADES[0]), 15, 'five points at his three dollars');

  // An unknown market gets no figure and the hint says why.
  const q = await loadPage();
  q.sandbox.openTrade();
  q.els.get('tMk').value = 'SPY';
  q.sandbox.fillPointValue();
  assert.strictEqual(q.els.get('tPv').value, '', 'nothing invented for a symbol it does not know');
  assert.match(q.els.get('tPvHint').textContent, /No published contract size for SPY/);
});

test('the money is turned off in the log when the point value could not be worked out', async () => {
  const p = await loadPage();
  logTrade(p, { mk: 'MNQ', su: SWEEP.n, en: 100, st: null, ex: 102, pv: 2 });
  const t = p.sandbox.TRADES[0];
  assert.strictEqual(p.sandbox.riskMoney(t), null, 'no stop, no risk in money');
  assert.strictEqual(p.sandbox.moneyOf(t), 4, 'but the result is priced');
  const text = p.sandbox.tradeText(t);
  assert.match(text, /Risk, in points: cannot be worked out: entry or stop is missing/);
  assert.match(text, /Result, in R: cannot be worked out yet/, 'no stop means no R, and the review is told that');
});

test('the assistant may repeat the journal money and never size a trade', async () => {
  const p = await loadPage();
  const desk = String(p.sandbox.DESK_SYS);
  assert.match(desk, /never invent a money figure/);
  assert.match(desk, /Use it ONLY to repeat the money line in the JOURNAL block/);
  assert.match(desk, /never a balance, never an account size, never how many contracts to trade/);
  const trade = String(p.sandbox.TRADE_SYS);
  assert.match(trade, /The only money in this review is what the trade block already worked out/);
  assert.match(trade, /never what it could have made/);
});

test('markup in a point value cannot put markup on the page', async () => {
  const p = await loadPage();
  logTrade(p, { mk: 'MNQ', su: SWEEP.n, en: 100, st: 99, ex: 102, pv: '<b>2</b>' });
  const t = p.sandbox.TRADES[0];
  assert.strictEqual(t.pv, null, 'a point value that is not a number is dropped at the form');
  assert.strictEqual(p.sandbox.pvOf(t), null, 'a point value that is not a number is no point value');
  assert.strictEqual(p.sandbox.moneyOf(t), null, 'and it buys no money figure');
  assert.match(p.sandbox.journalHtml(), /no point value on any closed trade yet/,
    'so the page says there is none rather than rendering his markup');
});
// ── the timing study ────────────────────────────────────────────────────────
// Jacques, 19 Sep 2026: "the trading desk needs a part in there where it helps
// me ... research for me to get better timing".
//
// So the desk counts what his own bars did, on his own rules: how often a 4h
// level was only poked and never closed above, how far the down legs came back
// to the high that started them, how many 15m bars a higher low lasted, and how
// much of a day's range was made inside his session window. What these check is
// that the counting is the bars' arithmetic and not the page's opinion, that a
// figure is always printed with the count it came from, and that with no bars
// loaded there is no count at all — the failure that would matter most, because
// a study that invents a number is worse than no study.
//
// The bars below are placed by hand: a particular bar is the swing, a
// particular bar pokes the level, and a particular bar closes above it, so the
// expected count can be worked out on paper before it is asserted here.
const STEP_MS = { '5m': 5 * 60000, '15m': 15 * 60000, '1h': 60 * 60000, '4h': 4 * 60 * 60000 };

// [open, high, low, close] per bar in, a bar with a time on it out.
function mkBars(tf, rows, base) {
  const step = STEP_MS[tf];
  const from = base == null ? Date.parse('2026-09-14T13:30:00Z') : base;
  return rows.map((r, i) => ({ t: from + i * step, o: r[0], h: r[1], l: r[2], c: r[3], v: 100 + i }));
}
function feedOf(b4, b15) {
  return { ok: true, symbol: 'NQ=F', name: 'Nasdaq 100', partial: null, error: null,
    timeframes: { '4h': { ok: true, tf: '4h', candles: b4 }, '15m': { ok: true, tf: '15m', candles: b15 } } };
}

// A swing high at 110 on the third bar, poked by the sixth: 112 trades through
// it and the close stays under the level. WING is 2, so the pivot needs two bars
// either side of it and the fixture has to carry one.
const POKE_FAIL = [
  [96, 100, 95, 98],
  [98, 102, 97, 99],
  [99, 110, 98, 105],
  [105, 104, 96, 99],
  [99, 101, 94, 97],
  [97, 112, 96, 104],
  [104, 105, 98, 100],
  [100, 103, 95, 97],
];
// The same bars with the poke bar closing above the level instead: 111 over 110.
const POKE_CLOSE = [
  [96, 100, 95, 98],
  [98, 102, 97, 99],
  [99, 110, 98, 105],
  [105, 104, 96, 99],
  [99, 101, 94, 97],
  [97, 112, 96, 111],
  [111, 112, 108, 110],
  [110, 111, 105, 107],
];
// One down leg: swing high 110, swing low 90, then price works all the way back
// to 112 — past the high that started the leg — before a close under 90 ends it.
// The leg is 20 points and the retrace is 22, so it came back 110% of itself.
const LEG_BACK = [
  [96, 100, 95, 98],
  [98, 102, 97, 99],
  [99, 110, 98, 105],
  [105, 104, 96, 99],
  [99, 101, 94, 97],
  [97, 100, 90, 92],
  [92, 97, 91, 96],
  [96, 108, 95, 105],
  [105, 112, 104, 110],
  [110, 111, 100, 99],
  [99, 98, 88, 89],
];
// The same leg with the low given up at once: the first bar after it closes
// under 90, so nothing retraced — 15% of the leg, and it never came close.
const LEG_AWAY = [
  [96, 100, 95, 98],
  [98, 102, 97, 99],
  [99, 110, 98, 105],
  [105, 104, 96, 99],
  [99, 101, 94, 97],
  [97, 100, 90, 92],
  [92, 93, 91, 92],
  [92, 93, 91, 92],
  [92, 93, 89, 88],
];
// A higher low at 93 on the eighth bar, and the first close under it three bars
// later — so the hold lasted three bars of 15 minutes.
const HOLD_3 = [
  [96, 100, 95, 98],
  [98, 102, 97, 99],
  [99, 101, 90, 92],
  [92, 99, 93, 95],
  [95, 103, 94, 100],
  [100, 104, 97, 101],
  [101, 102, 96, 99],
  [99, 100, 93, 95],
  [95, 97, 94, 96],
  [96, 98, 95, 97],
  [97, 96, 92, 91],
];

// A bar at a time of day on THIS machine's clock, which is the clock the page
// reads too: the wall clock of the device it is open on.
function atLocal(day, hour, min) {
  return new Date(2026, 8, day, hour, min, 0, 0).getTime();
}
function barAt(ms, o, h, l, c) {
  return { t: ms, o, h, l, c, v: null };
}

test('a desk with no study loaded says so, and quotes no count at all', async () => {
  const p = await loadPage();
  assert.strictEqual(p.sandbox.STUDY, null, 'a fresh desk has loaded no study bars');
  const text = p.sandbox.studyText();
  assert.ok(text.includes('NOT LOADED.'), 'the assistant is told there is nothing to quote');
  assert.ok(text.includes('Do not describe a study, do not invent a count'));
  assert.strictEqual(p.els.get('studyOut').innerHTML, '', 'and the card draws nothing');
  assert.ok(p.sandbox.askSystem().includes('NOT LOADED.'),
    'it is on every question, so a question about it cannot turn into a made-up one');
});

test('the study card is on the page, filled by the one press, with its own limits', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.ok(html.includes('<div class="sec-hd">Study the timing</div>'));
  assert.ok(html.includes('await loadStudy();'), 'the one press fills it, so it needs no button of its own');
  assert.ok(!html.includes('id="studyGo"'), 'and there is no separate button to press');
  assert.ok(html.includes('id="studyOut"></div>'));
  assert.ok(html.includes('Nothing here is a backtest and nothing here is a forecast'),
    'the card says on its face what it is not');
});

test('the study pulls its own stretch of bars, and a failed pull leaves nothing behind', async () => {
  const p = await loadPage({ feed: feedOf(mkBars('4h', POKE_FAIL), mkBars('15m', HOLD_3)) });
  await p.sandbox.loadStudy();
  const asked = p.calls.filter((c) => String(c.url).indexOf('/api/candles') === 0).map((c) => c.url);
  assert.ok(asked.some((u) => /bars=500/.test(u)),
    'the study asks for 500 bars: the read above only holds the last few of each');
  assert.ok(p.sandbox.STUDY, 'what came back is kept');
  assert.ok(p.els.get('studyOut').innerHTML.length > 0, 'and it is painted on the page');

  // Now a feed that answers with nothing. The old study must not survive it.
  p.setCandles({ status: 502, body: { ok: false, error: 'NQ: the feed could not be reached.' } });
  await p.sandbox.loadStudy();
  assert.strictEqual(p.sandbox.STUDY, null, 'the previous study does not survive a failed pull');
  assert.strictEqual(p.els.get('studyOut').innerHTML, '', 'and the card is emptied with it');
  assert.ok(p.els.get('studyMsg').textContent.includes('could not be reached'));
  assert.ok(p.sandbox.studyText().includes('NOT LOADED.'), 'so the assistant has no count to quote');
});

test('a level traded through is a poke only when no bar closed above it', async () => {
  const p = await loadPage();
  const fail = p.sandbox.pokeStudy(mkBars('4h', POKE_FAIL));
  assert.strictEqual(fail.pokes, 1, 'one swing high was traded above');
  assert.strictEqual(fail.closed, 0, 'and no bar closed above it');
  assert.strictEqual(fail.failed, 1, 'so it is a poke and nothing else');
  assert.strictEqual(fail.deep, 2, 'two points past the level, which is what a stop has to sit outside of');
  assert.strictEqual(fail.level, 110, 'and the level is the swing high itself');

  const closed = p.sandbox.pokeStudy(mkBars('4h', POKE_CLOSE));
  assert.strictEqual(closed.pokes, 1);
  assert.strictEqual(closed.closed, 1, 'a close above the level is the frame changing');
  assert.strictEqual(closed.failed, 0);
  assert.strictEqual(closed.deep, null, 'so there is no failed poke to measure');
});

test('the study prints every figure with the count it came from', async () => {
  const p = await loadPage();
  p.sandbox.STUDY = feedOf(mkBars('4h', POKE_FAIL), mkBars('15m', HOLD_3));
  p.sandbox.paintStudy();
  const shown = p.els.get('studyOut').innerHTML;
  assert.ok(shown.includes('<b>1</b> of 1 never closed above — the grab'), 'the poke, with its count');
  assert.ok(shown.includes('went <b>2.00</b> past the level and came back'), 'and how far it went');
  assert.ok(shown.includes('<b>3</b> bars &middot; 45m on the 15m'), 'a hold is a number of bars');
  assert.ok(/bars, \d+ [A-Z][a-z]{2} to \d+ [A-Z][a-z]{2}/.test(shown),
    'and the card says which window of bars it counted');
});

test('the retrace is measured against the high that started the leg', async () => {
  const p = await loadPage();
  const back = p.sandbox.retraceStudy(mkBars('4h', LEG_BACK));
  assert.strictEqual(back.n, 1, 'one finished down leg in these bars');
  assert.strictEqual(back.live, 0, 'and its low has gone, so it is not still running');
  assert.strictEqual(back.whole, 1, 'it came all the way back to the swing high');
  assert.strictEqual(Math.round(back.mid * 100), 110, 'and past it, which is what 110% says');

  const away = p.sandbox.retraceStudy(mkBars('4h', LEG_AWAY));
  assert.strictEqual(away.n, 1);
  assert.strictEqual(away.whole, 0, 'a leg with no retrace is not one that came back');
  assert.strictEqual(away.under, 1, 'it never got past a third of itself');
});

test('a leg still running is counted as live, never as one that failed to retrace', async () => {
  // The low of this leg has not been taken, so the bars have not finished
  // saying what it did. Counting it would print "never got past a third" about
  // a leg that is still in front of him.
  const p = await loadPage();
  const r = p.sandbox.retraceStudy(mkBars('4h', LEG_BACK.slice(0, 10)));
  assert.strictEqual(r.n, 0, 'nothing finished in these bars');
  assert.strictEqual(r.live, 1, 'one leg is still live');
  assert.strictEqual(r.under, 0, 'and it is not counted among the ones that went nowhere');
});

test('a higher low is held until a bar CLOSES below it, and counted in bars', async () => {
  const p = await loadPage();
  const h = p.sandbox.holdStudy(mkBars('15m', HOLD_3));
  // Length and value, not deepStrictEqual: the array was built inside the
  // page's own context, so its prototype is the page's Array and never this
  // file's.
  assert.strictEqual(h.holds.length, 1, 'one higher low failed in these bars');
  assert.strictEqual(h.holds[0], 3, 'and the hold lasted three bars of 15 minutes');
  assert.strictEqual(h.mid, 3);
  assert.strictEqual(h.holding, 0, 'and it did fail, so it is not still standing');

  // The same bars with the close under 93 taken out: nothing closed below it,
  // so it is still holding and has no length yet.
  const still = p.sandbox.holdStudy(mkBars('15m', HOLD_3.slice(0, 10)));
  assert.strictEqual(still.n, 0, 'a hold with no close below it has no length');
  assert.strictEqual(still.holding, 1, 'it is counted as still holding instead');
});

test('the window counts a day on his own clock, and a day outside it honestly', async () => {
  const p = await loadPage();
  p.sandbox.SESS = { a: '08:30', b: '15:00' };
  // Day one, both bars inside the window: 105 high, 90 low, range 15, all of it
  // inside. Day two, one bar inside (110/100) and the high of the day made after
  // the window closed at 130 — so ten of that day's thirty points were his.
  const bars = [
    barAt(atLocal(14, 9, 0), 91, 100, 90, 95),
    barAt(atLocal(14, 10, 0), 95, 105, 95, 104),
    barAt(atLocal(15, 9, 0), 101, 110, 100, 105),
    barAt(atLocal(15, 16, 0), 105, 130, 120, 129),
  ];
  const w = p.sandbox.windowStudy(bars);
  assert.strictEqual(w.ok, true);
  assert.strictEqual(w.days, 2, 'two days on this clock');
  assert.strictEqual(Math.round(w.share * 100), 56, '25 of the 45 points those days made were inside it');
  assert.strictEqual(w.hi, 1, 'the high of the day was made in his window on one of the two days');
  assert.strictEqual(w.lo, 2, 'the low of the day was made in there on both');

  // With no usable window there is nothing to count inside, and the page says
  // that rather than dividing by a window it does not have.
  p.sandbox.SESS = { a: '09:00', b: '09:00' };
  assert.strictEqual(p.sandbox.windowStudy(bars).ok, false, 'a window with no length is not a window');
});

test('the assistant is handed the counts, and told what they can never be', async () => {
  const p = await loadPage();
  p.sandbox.STUDY = feedOf(mkBars('4h', POKE_FAIL), mkBars('15m', HOLD_3));
  const text = p.sandbox.studyText();
  assert.ok(text.includes('NOT a backtest'), 'the study says on its face what it is not');
  assert.ok(text.includes('THE POKE (4h, 8 bars'), 'the count comes with the timeframe it came from');
  assert.ok(text.includes('CLOSED above the level within the next 6 bars on 0 of those 1'),
    'and with what it was a count of');
  assert.ok(text.includes('THE HOLD (15m): 1 higher low failed in these bars, the middle one lasting 3 bars'));
  assert.ok(text.includes('WHAT THIS CANNOT SAY: it is one loaded window of bars and a small sample'));
  assert.ok(text.includes('THE BARS IT COUNTED ARE ITS OWN'),
    'the study counts a longer window than the candles block, and says so');
  assert.ok(p.sandbox.askSystem().includes('THE POKE (4h, 8 bars'), 'and every question carries it');

  const sys = String(p.sandbox.STUDY_SYS);
  assert.ok(sys.includes('keep the figure and its count welded together'));
  assert.ok(sys.includes('WHEN A COUNT IS SMALL, SAY SO IN THE SAME SENTENCE'));
  assert.ok(sys.includes('NEVER: call the study a backtest'));
  assert.ok(sys.includes('END WITH ONE CHANGE'));
});

test('the house rules name the study, and it is still not a backtest', async () => {
  const p = await loadPage();
  const desk = String(p.sandbox.DESK_SYS);
  assert.ok(desk.includes('the counts in the STUDY block, which this page worked out itself from bars that loaded'));
  assert.ok(desk.includes('no backtest result, and no study of your own'),
    'so the assistant may not run one of its own either');
  assert.ok(desk.includes('The only backtest that exists is the backtest block below, worked out from bars that loaded'),
    'the backtest that does exist is named, and no other one is allowed');
  assert.ok(desk.includes('The backtest block is the only basis you have for what his rules returned'));
  assert.ok(desk.includes('It fills at the exact price of every level, one contract, with no spread and no slippage'),
    'and the best case is never left to read as what he kept');
  assert.ok(desk.includes('the session block, the frame block and the STUDY block are the only basis you have for structure and for timing'));
});

test('the study chip answers under the study rules, not the desk ones', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.ok(html.includes('data-sys="study">Study my timing'));
  assert.ok(html.includes("sys==='study' ? askSystem(STUDY_SYS)"),
    'the one chip that reads the study is read under the study rules');
  assert.ok(html.includes('async function loadAll()'), 'and the one press is what loads it');
});

// ── the backtest ────────────────────────────────────────────────────────────
//
// Jacques, 21 Sep 2026: "make me a backtester with my trading logic." His logic
// is the frame block's, as numbers: a new lower low turns the frame down; the
// level is the swing high the drop came from; only a CLOSE above the level
// cancels it; the short is the retrace back to that level; the stop is one
// average bar above it; the target is the low the frame turned down on.
//
// The bars below are written out by hand so the answer is known before the
// engine is asked: a swing high at 108, a low at 99, a higher high at 110 and a
// LOWER low at 97.5 — so the level is 110 and the target 97.5 — then a retrace
// that reaches 110 and closes under it (106), then a bar down to 96.
function bars(rows) {
  const base = Date.parse('2026-09-21T13:00:00Z');
  return rows.map((r, i) => ({ t: base + i * 300000, o: r[0], h: r[1], l: r[2], c: r[3], v: 100 }));
}
const FRAME_BARS = [
  [100, 101, 99, 100],
  [101, 103, 100, 102],
  [103, 108, 102, 106],
  [105, 105, 101, 103],
  [101, 102, 99, 100],
  [100, 101, 100.5, 100.5],
  [102, 104, 102, 103],
  [104, 106, 103, 105],
  [107, 110, 105, 108],
  [106, 107, 104, 105],
  [104, 105, 102, 103],
  [102, 104, 100, 101],
  [100, 103, 98, 99],
  [99, 102, 97.5, 101],
  [100, 101, 98, 100],
  [99, 100, 98.5, 99],
  [99, 104.5, 98, 100],
  [104, 110.5, 105, 106],
  [106, 107, 96, 97],
];
const withBar = (i, row) => FRAME_BARS.map((r, k) => (k === i ? row : r));

test('his own rules, entered and priced: the retrace to the level, then the low', async () => {
  const p = await loadPage();
  const r = p.sandbox.backtest('MNQ', '5m', bars(FRAME_BARS), 0.78);
  assert.ok(r.ok, 'the bars carry a swing');
  assert.strictEqual(r.frames, 1, 'exactly one lower low in these bars');
  assert.strictEqual(r.taken, 1, 'and it is taken');
  assert.strictEqual(r.cancelled, 0, 'nothing cancelled it');
  assert.strictEqual(r.noRetrace, 0);
  assert.strictEqual(r.wins, 1, 'it reached the low the frame turned down on');
  assert.strictEqual(r.losses, 0);
  assert.ok(Math.abs(r.grossPts - 12.5) < 1e-9, '110 down to 97.5 is 12.5 points');
  assert.strictEqual(r.trades[0].level, 110, 'short at the level the drop came from');
  assert.strictEqual(r.trades[0].ex, 97.5, 'out at the frame low');
  assert.strictEqual(r.trades[0].why, 'target');
});

test('the money is after his commission, and there is no net figure without one', async () => {
  const p = await loadPage();
  const paid = p.sandbox.backtest('MNQ', '5m', bars(FRAME_BARS), 0.78);
  assert.strictEqual(paid.pv, 2, 'MNQ is two dollars a point on one contract');
  assert.strictEqual(paid.gross, 25, '12.5 points on one micro');
  assert.strictEqual(paid.cost, 0.78, 'one contract, in and out');
  assert.ok(Math.abs(paid.net - 24.22) < 1e-9, 'gross minus the commission');
  const blank = p.sandbox.backtest('MNQ', '5m', bars(FRAME_BARS), null);
  assert.strictEqual(blank.net, null, 'no rate, no net figure — never a zero that reads as free');
  assert.strictEqual(blank.cost, null);
  assert.strictEqual(blank.gross, 25, 'the gross is still the market price');
  const unknown = p.sandbox.backtest('ZZZ', '5m', bars(FRAME_BARS), 0.78);
  assert.strictEqual(unknown.pv, null, 'a symbol with no published size gets no money figure');
  assert.strictEqual(unknown.gross, null);
  assert.strictEqual(unknown.net, null);
});

test('a close above the level ends the frame and there is no trade', async () => {
  const p = await loadPage();
  // The retrace bar closes at 110.5, above the level: his own rule, and the one
  // that has been costing him, so it is tested rather than assumed away.
  const r = p.sandbox.backtest('MNQ', '5m', bars(withBar(17, [104, 111.5, 105, 110.5])), 0.78);
  assert.strictEqual(r.frames, 1);
  assert.strictEqual(r.cancelled, 1, 'the frame is counted as cancelled');
  assert.strictEqual(r.taken, 0, 'and nothing is entered on it');
  assert.strictEqual(r.gross, null, 'so there is no money either');
});

test('a frame price never came back to is counted, not traded', async () => {
  const p = await loadPage();
  const rows = withBar(17, [104, 106, 103, 105]);
  const r = p.sandbox.backtest('MNQ', '5m', bars(rows.map((x, i) => (i === 18 ? [103, 104, 100, 101] : x))), 0.78);
  assert.strictEqual(r.taken, 0);
  assert.strictEqual(r.noRetrace, 1, 'it never reached the level');
  assert.strictEqual(r.cancelled, 0, 'and nothing closed above it');
});

test('a trade still open at the last bar is counted nowhere', async () => {
  const p = await loadPage();
  const r = p.sandbox.backtest('MNQ', '5m', bars(withBar(18, [106, 108, 100, 102])), 0.78);
  assert.strictEqual(r.taken, 1, 'it was entered');
  assert.strictEqual(r.open, 1, 'and it is still open');
  assert.strictEqual(r.closed, 0, 'so it is in no count');
  assert.strictEqual(r.wins + r.losses, 0);
  assert.strictEqual(r.net, null, 'and in no money figure either');
});

test('no bars to test means it says so rather than printing a result', async () => {
  const p = await loadPage();
  assert.strictEqual(p.sandbox.BTLAST, null, 'nothing has been run');
  assert.match(p.sandbox.backtestText(), /NOT RUN/, 'and the assistant is told there is no result');
  p.sandbox.runBacktest();
  assert.strictEqual(p.sandbox.BTLAST, null, 'running it with no bars leaves nothing behind');
  assert.match(p.els.get('btMsg').textContent, /Load the candles first/);
  const short = p.sandbox.backtest('MNQ', '5m', bars(FRAME_BARS.slice(0, 4)), 0.78);
  assert.ok(!short.ok && /too few bars/.test(short.why), 'and too few bars is a reason, not a guess');
});

test('the test is wired to the page, and priced in points when it has to be', async () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.ok(!html.includes('id="btGo"'), 'there is no separate button: the one press runs it');
  assert.ok(html.includes('if(STUDY&&STUDY.ok) runBacktest();'),
    'and it runs itself on the same bars the one press loaded');
  assert.ok(html.includes('It is not a promise about the next trade and it is not a measurement of the market'),
    'the card names what it is not');
  assert.ok(html.includes('No spread, no slippage, no fill you may not have got'), 'on the card, where he reads it');
});

// ── one press, and folded readings — 22 Sep 2026 ─────────────────────────────
//
// Jacques: "simplify my trading desk its kind of complicated". The page used to
// ask for three presses (candles, study bars, then the test) and stack eleven
// blocks so the assistant was pushed off the screen. Now one press fills the
// lot and the readings fold away. Nothing about what the assistant may say
// changed, so these tests are about the presses and the folds only.

test('one press fills the candles, then the study, then the test on those same bars', async () => {
  const p = await loadPage({ feed: feedOf(mkBars('4h', POKE_FAIL), mkBars('15m', HOLD_3)) });
  assert.strictEqual(p.sandbox.STUDY, null, 'nothing is studied before the press');
  assert.strictEqual(p.sandbox.BTLAST, null, 'and nothing is tested');
  await p.sandbox.loadAll();
  assert.ok(p.sandbox.FEED && p.sandbox.FEED.ok, 'the press pulls the candles');
  assert.ok(p.sandbox.STUDY && p.sandbox.STUDY.ok, 'then the study bars');
  assert.ok(Array.isArray(p.sandbox.BTLAST), 'and then runs the test on them');
  const asked = p.calls.filter((c) => String(c.url).indexOf('/api/candles') === 0);
  assert.ok(asked.length >= 2, 'two pulls and no more: the test fetches nothing of its own');
});

test('a press that gets no candles stops there rather than studying or testing nothing', async () => {
  const p = await loadPage();
  await p.sandbox.loadAll();
  assert.ok(!(p.sandbox.FEED && p.sandbox.FEED.ok), 'the feed gave nothing');
  assert.strictEqual(p.sandbox.STUDY, null, 'so nothing is studied');
  assert.strictEqual(p.sandbox.BTLAST, null, 'and nothing is tested');
});

test('the readings, the context and the journal fold away; the assistant and the setups never do', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  for (const id of ['readings', 'context', 'journal']) {
    assert.ok(html.includes('<details class="fold" id="' + id + '">'), id + ' is a fold you open');
  }
  assert.ok(!html.includes('id="ask" class="fold"'), 'the assistant is never folded away');
  assert.ok(html.includes('id="list"'), 'nor the setups the assistant answers from');
  assert.ok(html.includes('id="fGo">Load everything'), 'and the one press sits on the feed card');
});
