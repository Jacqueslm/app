// The ask box on the tax centre (/tax) — the last of the two reference ask boxes.
//
// These pages are static HTML with their whole logic in one inline script, and
// nothing was checking them: app-syntax.test.js did not read them until
// 15 Sep 2026, when the ask box was added. A SyntaxError in either page would
// leave it looking fine and doing nothing.
//
// 4 Oct 2026: the herb library's ask box went with Friendly — "take a friendly
// off the herbs and add voice to herbs" — so this file now guards the tax box on
// its own. The herb page kept its read-aloud voice, and that is checked in
// herbs-voice.test.js, which runs the page the same way this does.
//
// So this runs the page's real inline script in a stub DOM, with fetch stubbed
// to a fake /api/chat, and drives the box the way a person's thumb does. It is
// not a browser - it proves the wiring and the request, not the pixels.
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
    addEventListener() {}, setAttribute() {}, removeAttribute() {},
    getAttribute() { return null }, focus() {}, closest() { return null },
    querySelectorAll() { return [] }, appendChild() {}, remove() {},
    setSelectionRange() {}, scrollIntoView() {},
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

// Runs one page for real and hands back its globals, the stub elements and a
// log of everything it sent to /api/chat.
async function loadPage(file) {
  const { doc, els } = stubDom();
  const calls = [];
  let reply = { status: 200, body: { content: [{ type: 'text', text: 'Tradition, then the caution.\n\nAsk a pharmacist.' }] } };
  const sandbox = {
    document: doc, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set, Intl,
    localStorage: { getItem() { return null }, setItem() {}, removeItem() {} },
    fetch: async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) });
      return { status: reply.status, ok: reply.status === 200, json: async () => reply.body };
    },
    scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: 'node' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(inlineScript(file), sandbox, { filename: file });
  return { sandbox, els, calls, setReply(r) { reply = r } };
}

// The tax page's rules are its own and they are a decision, not drift: the box
// there is not allowed to recall a figure, because every number on that page
// came from the IRS. (The herb library's box, which was under safety rules
// instead, went with Friendly on 4 Oct 2026 - see herbs-voice.test.js.)
const file = 'tax.html';
const must = /THE ONE THING THAT HOLDS/;

test('tax centre: the ask box is wired to the app\'s own AI', async () => {
  const p = await loadPage(file);
  assert.equal(typeof p.sandbox.ask, 'function', 'the page must define its own ask()');
  assert.equal(typeof p.sandbox.askCtx, 'function', 'the page must say what it is being asked about');
  assert.ok(p.sandbox.ASK_SYS.length > 400, 'the answer must run under real instructions');
  assert.match(p.sandbox.ASK_SYS, must);

  await p.sandbox.ask('can I take this with my blood pressure pills?', p.sandbox.askCtx());

  assert.equal(p.calls.length, 1);
  assert.equal(p.calls[0].url, '/api/chat', 'the same route the Friendly tab uses, so the same brake covers it');
  const sent = p.calls[0].body;
  assert.ok(Array.isArray(sent.system) && must.test(sent.system[0].text),
    'the rules must travel with every single question');
  assert.equal(sent.messages.length, 1, 'no client-side history to drift out of the rules');
  assert.equal(sent.messages[0].role, 'user');
  assert.match(sent.messages[0].content, /blood pressure/);
  assert.match(p.els.get('askA').innerHTML, /Ask a pharmacist/);
  assert.match(p.els.get('askA').innerHTML, /<br>/, 'newlines become line breaks');
});

test('tax centre: an answer cannot inject markup, and a failure invents nothing', async () => {
  const p = await loadPage(file);
  p.setReply({ status: 200, body: { content: [{ type: 'text', text: '<img src=x onerror=alert(1)>done' }] } });
  await p.sandbox.ask('anything', '');
  assert.doesNotMatch(p.els.get('askA').innerHTML, /<img/, 'the answer is escaped before it lands');

  // The three ways it can come back with nothing, each of which has to read
  // plainly instead of silently doing nothing.
  for (const [status, expect] of [[429, /today's lot/], [401, /Sign in again/], [500, /No answer came back/]]) {
    p.setReply({ status, body: {} });
    await p.sandbox.ask('one more', '');
    assert.match(p.els.get('askA').innerHTML, expect, `status ${status} must be said in words`);
  }
});

test('the tax centre: the tab they are on rides along, and no figure is recalled', async () => {
  const p = await loadPage(file);
  p.sandbox.TAB = 'mil';
  assert.match(p.sandbox.askCtx(), /Mileage/);
  p.sandbox.TAB = 'ded';
  assert.match(p.sandbox.askCtx(), /Deductions/);
  // The page's whole value is that every number on it came from the IRS, so
  // inventing one is the only mistake that costs money here. That rule stays.
  assert.match(p.sandbox.ASK_SYS, /never invent a number/i);
  // The preparer disclaimers do not: this is his own page, for his own use.
  assert.doesNotMatch(p.sandbox.ASK_SYS, /not their tax preparer/);
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert.equal((html.match(/id="ask"/g) || []).length, 1);
  assert.ok(html.indexOf('id="ask"') < html.indexOf('class="tabs"'), 'the box sits above the tabs');
});
