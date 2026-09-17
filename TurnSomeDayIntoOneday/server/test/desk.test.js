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
    addEventListener() {}, setAttribute() {}, removeAttribute() {},
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
// everything sent to /api/chat, and what the page wrote to the device.
async function loadPage() {
  const { doc, els } = stubDom();
  const calls = [];
  const stored = {};
  let reply = { status: 200, body: { content: [{ type: 'text', text: '4h: up.\nEntry: the reclaim.\nWrong if: a close back inside.' }] } };
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
      calls.push({ url, body: JSON.parse(opts.body) });
      return { status: reply.status, ok: reply.status === 200, json: async () => reply.body };
    },
    scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: 'node' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.confirm = () => false;
  vm.createContext(sandbox);
  vm.runInContext(inlineScript(PAGE), sandbox, { filename: 'desk.html' });
  return { sandbox, els, calls, stored, setReply(r) { reply = r } };
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
  p.sandbox.picked = fields.tf || [];
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
  assert.match(text, /answer nothing else as if one of his setups matched/);
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

  assert.strictEqual(p.calls.length, 1);
  assert.strictEqual(p.calls[0].url, '/api/chat', 'the same route the Friendly tab uses, so the same brake covers it');
  const system = p.calls[0].body.system[0].text;
  assert.match(system, /London sweep and reclaim/, 'the setup goes with the question');
  assert.match(system, /Has to be true first: 4h is in an uptrend/);
  assert.match(system, /Wrong if: 15 min close back under the level/);
  assert.match(system, /4 hours, 1 hour, 15 minutes, 5 minutes/, 'the timeframes it lives on are spelled out');
  assert.match(system, /NQ, long/, 'and so does the chart in front of him');
  assert.match(system, /1h close back inside/);
  assert.strictEqual(p.calls[0].body.messages.length, 1, 'one question, no history to drift out of the rules');
  assert.strictEqual(p.calls[0].body.messages[0].role, 'user');
  assert.match(p.calls[0].body.messages[0].content, /Should I take this one\?/);
  assert.match(p.els.get('askA').innerHTML, /Wrong if/, 'and the answer lands on the page');
});

test('the assistant is told what it cannot know, and to ask instead of filling it in', async () => {
  const p = await loadPage();
  const system = p.sandbox.askSystem();
  // The chart block was left empty. A model with no prices and no instruction
  // would happily produce levels; this is the instruction that stops it.
  assert.match(system, /Market: NOT SAID/);
  assert.match(system, /has not filled this in properly/);
  assert.match(system, /ASK him for the missing line before you answer, and give no levels in that first reply/);
});

test('the rules it answers under: no invented numbers, wrong-first, and the four timeframes', async () => {
  const p = await loadPage();
  const sys = p.sandbox.DESK_SYS;
  // No data on the page, so the one thing that must not happen is invention —
  // and honesty about the backtest that does not exist yet.
  assert.match(sys, /Never invent a number/, 'no invented prices, levels or statistics');
  assert.match(sys, /There is no price feed on this page and no backtest has been run/);
  assert.match(sys, /never imply you checked one/);
  // Wrong before right.
  assert.match(sys, /Invalidation comes first, every time/);
  // The four timeframes, each with its job, in his words.
  assert.match(sys, /4h is the tide/);
  assert.match(sys, /5m is only the trigger/);
  assert.match(sys, /HOLD OR SCALP/);
  // And the lines that carry over from the rest of the app.
  assert.match(sys, /Never promise an outcome/);
  assert.match(sys, /Never tell him to make a loss back/);
  assert.match(sys, /Never tell him he is finished/);
  assert.match(sys, /Plain English, always/, 'and it answers in English');
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

test('the desk reads no feed and loads nothing from outside', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  const fetches = html.match(/fetch\(/g) || [];
  assert.strictEqual(fetches.length, 1, 'the only thing this page ever calls is the app\'s own AI');
  assert.match(html, /fetch\('\/api\/chat'/);
  for (const banned of ['googletagmanager', 'gtag(', '<script src="http', 'facebook.net',
    'binance', 'twelvedata', 'polygon.io', 'alphavantage', 'yahoo']) {
    assert.ok(!html.toLowerCase().includes(banned.toLowerCase()), `the desk must not reach for ${banned}`);
  }
});

// ── the door ────────────────────────────────────────────────────────────────

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
