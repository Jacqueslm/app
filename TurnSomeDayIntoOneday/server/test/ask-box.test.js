// The ask box on the two reference pages (/herbs and /tax).
//
// These pages are static HTML with their whole logic in one inline script, and
// nothing was checking them: app-syntax.test.js only looked at index.html,
// key.html, letter.html, admin-stats.html and landing.html until 15 Sep 2026,
// when the ask box was added. A SyntaxError in either page would leave it
// looking fine and doing nothing.
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

for (const [label, file] of [['herb library', 'herbs.html'], ['tax centre', 'tax.html']]) {
  test(`${label}: the ask box is wired to the app's own AI`, async () => {
    const p = await loadPage(file);
    assert.equal(typeof p.sandbox.ask, 'function', 'the page must define its own ask()');
    assert.equal(typeof p.sandbox.askCtx, 'function', 'the page must say what it is being asked about');
    assert.ok(p.sandbox.ASK_SYS.length > 400, 'the answer must run under real instructions');
    assert.match(p.sandbox.ASK_SYS, /RULES OF THIS HOUSE/);

    await p.sandbox.ask('can I take this with my blood pressure pills?', p.sandbox.askCtx());

    assert.equal(p.calls.length, 1);
    assert.equal(p.calls[0].url, '/api/chat', 'the same route the Friendly tab uses, so the same brake covers it');
    const sent = p.calls[0].body;
    assert.ok(Array.isArray(sent.system) && /RULES OF THIS HOUSE/.test(sent.system[0].text),
      'the house rules must travel with every single question');
    assert.equal(sent.messages.length, 1, 'no client-side history to drift out of the rules');
    assert.equal(sent.messages[0].role, 'user');
    assert.match(sent.messages[0].content, /blood pressure/);
    assert.match(p.els.get('askA').innerHTML, /Ask a pharmacist/);
    assert.match(p.els.get('askA').innerHTML, /<br>/, 'newlines become line breaks');
  });

  test(`${label}: an answer cannot inject markup, and a failure invents nothing`, async () => {
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
}

test('the herb library: the open herb rides along with the question', async () => {
  const p = await loadPage('herbs.html');
  const list = p.sandbox.allHerbs();
  assert.ok(list.length > 200, 'the library still loads');
  assert.equal(p.sandbox.askCtx(), '', 'with nothing open, nothing extra is sent');
  const fennel = list.filter((h) => /^Fennel/.test(h.n))[0];
  assert.ok(fennel, 'Fennel is in the library');
  p.sandbox.openId = fennel.id;
  const ctx = p.sandbox.askCtx();
  assert.match(ctx, /Herb: Fennel/);
  assert.match(ctx, /Caution on the entry/, 'the caution goes with it - it is the part that must not be dropped');
  const html = fs.readFileSync(path.join(ROOT, 'herbs.html'), 'utf8');
  assert.equal((html.match(/id="ask"/g) || []).length, 1, 'exactly one ask box');
  assert.match(html, /data-ask=/, 'an open herb carries its own ask button');
});

test('the tax centre: the tab they are on rides along, and no figure is recalled', async () => {
  const p = await loadPage('tax.html');
  p.sandbox.TAB = 'mil';
  assert.match(p.sandbox.askCtx(), /Mileage/);
  p.sandbox.TAB = 'ded';
  assert.match(p.sandbox.askCtx(), /Deductions/);
  // The page's whole value is that every number on it came from the IRS. The
  // box must send them to the page rather than recite one from memory.
  assert.match(p.sandbox.ASK_SYS, /Never invent a number/);
  assert.match(p.sandbox.ASK_SYS, /not their tax preparer/);
  const html = fs.readFileSync(path.join(ROOT, 'tax.html'), 'utf8');
  assert.equal((html.match(/id="ask"/g) || []).length, 1);
  assert.ok(html.indexOf('id="ask"') < html.indexOf('class="tabs"'), 'the box sits above the tabs');
});
