// The Trainer's first page — 11 Oct 2026.
//
// Jacques: "then create the trainer we will be slowly so start off with just
// basic input information that's it". So there is one page and one job on it:
// ask for the basic information and keep it. Nothing is planned, nothing is
// prescribed, and nothing leaves the phone.
//
// 13 Oct 2026, who it is for. Jacques: "its for my clients ... rewrite it for my
// people I'll put they information in". The page had been written to the person
// being trained ("What to call you"); it is actually filled in by the coach, for
// one of the people he trains. The first test below is the one that holds that:
// the questions ask about "them" and never about the reader.
//
// That last part is the claim the page makes in its own words ("Everything here
// stays on this phone and nothing is sent anywhere"), so it is checked here
// rather than left to a comment: no fetch, no XMLHttpRequest, no form action,
// and no address that is not this app.
//
// The rest of this file drives the page's own script the way a thumb does — it
// fills the fields, submits, clears, and re-opens the page with what was stored
// — because "the tests pass" is not the same as "the form works". The herb
// library's tests load a page the same way; this one needs a little more of a
// DOM, because a form that saves has fields that hold values and boxes that tick.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = path.join(ROOT, 'trainer.html');

const TEXT_IDS = ['name', 'age', 'build', 'days', 'when', 'hurts', 'rules', 'dayone'];
const KIT = ['Dumbbells', 'A pull-up bar', 'Push-up bars', 'A bench or a chair', 'A band', 'Floor space', 'Nothing yet'];
const WANT = ['Stronger', 'Breathing', 'Moving better', 'Sleep', 'All of it'];

const JS_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'module']);
function inlineScript(file) {
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(m[1])) continue;
    const type = (m[1].match(/\btype\s*=\s*["']([^"']*)["']/) || ['', ''])[1].toLowerCase().trim();
    if (!JS_TYPES.has(type)) continue;
    return m[2];
  }
  throw new Error(`${file} has no inline script to run`);
}

// A page as small as this one needs only four things from a DOM: an element by
// id, the tick boxes by their data attribute, somewhere to hang an event
// listener, and a localStorage that actually stores. Everything the page asks
// for beyond that is stubbed rather than provided, so a page that starts
// reaching for something new fails loudly here instead of quietly working.
function loadPage(storage) {
  const els = new Map();
  const listeners = new Map();

  function element(id, attrs) {
    const o = {
      id, value: '', textContent: '', innerHTML: '', checked: false,
      className: '', style: {}, dataset: {}, disabled: false,
      attrs: attrs || {},
      getAttribute: (k) => (attrs && k in attrs ? attrs[k] : null),
      setAttribute() {}, removeAttribute() {}, focus() {}, closest: () => null,
      querySelectorAll: () => [], appendChild() {}, remove() {},
      addEventListener(type, fn) {
        if (!listeners.has(id)) listeners.set(id, {});
        listeners.get(id)[type] = fn;
      },
    };
    return o;
  }

  function byId(id) {
    if (!els.has(id)) els.set(id, element(id));
    return els.get(id);
  }

  const boxes = [];
  for (const k of KIT) { const b = element(`kit:${k}`, { 'data-kit': k }); boxes.push(b); els.set(`kit:${k}`, b); }
  for (const w of WANT) { const b = element(`want:${w}`, { 'data-want': w }); boxes.push(b); els.set(`want:${w}`, b); }

  const doc = {
    getElementById: byId,
    querySelectorAll(sel) {
      if (/data-kit/.test(sel)) return boxes.filter((b) => 'data-kit' in b.attrs);
      if (/data-want/.test(sel)) return boxes.filter((b) => 'data-want' in b.attrs);
      return [];
    },
    querySelector: () => null,
    addEventListener() {},
    createElement: () => element('_new'),
    body: element('body'),
    documentElement: element('html'),
    readyState: 'complete',
  };

  const store = storage || {};
  const sandbox = {
    document: doc, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set, Intl,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    // Kept as a tripwire: the page promises nothing is sent anywhere, and the
    // tests below assert this was never reached.
    fetch: async () => { sandbox.sent += 1; return { ok: true, status: 200, json: async () => ({}) }; },
    sent: 0,
    scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: 'node' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(inlineScript(PAGE), sandbox, { filename: 'trainer.html' });
  return {
    sandbox, els, store, listeners,
    fire(id, type, ev) {
      const fn = listeners.get(id) && listeners.get(id)[type];
      if (!fn) return false;
      fn(ev || { preventDefault() {} });
      return true;
    },
    box: (name) => els.get(name),
  };
}

test('the trainer page is the intake, and says what it is', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.match(html, /<h1>The Trainer<\/h1>/, 'the page names itself');
  assert.match(html, /Step one: their information/, 'and says which step it is');
  // Written for the coach holding the phone, not the person being trained —
  // 13 Oct 2026. The fields ask about "them"; there is no field addressed to the
  // reader about themselves.
  assert.match(html, /What to call them/, 'the fields ask about the person being trained');
  assert.doesNotMatch(html, /What to call you/, 'and none of them ask the reader about themselves');
  assert.match(html, /For the people you train/, 'the page says who it is for');
  assert.match(html, /There is no plan on it yet/,
    'and says plainly that nothing is planned yet, rather than looking finished');
  // Every field the step is for is on the page.
  for (const id of TEXT_IDS) assert.match(html, new RegExp(`id="${id}"`), `the ${id} field is on the page`);
  for (const k of [...KIT, ...WANT]) assert.ok(html.includes(k), `${k} is offered on the page`);
  // And it is reachable from the app's own door.
  assert.match(html, /href="\/app"/, 'the way back to the app is on the page');
});

test('nothing on the trainer page leaves the phone', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.doesNotMatch(html, /\bfetch\s*\(/, 'the page must not call fetch');
  assert.doesNotMatch(html, /XMLHttpRequest|sendBeacon|WebSocket/, 'nor any other way of sending');
  assert.doesNotMatch(html, /<form[^>]*\baction=/, 'and the form must have nowhere to post to');
  assert.doesNotMatch(html, /\bmethod="post"/i, 'nor a post method');
  // Addresses it may name: its own pages, its own files. Nothing off this app.
  // The SVG namespace is not an address and is not fetched — it is the word
  // browsers want above an inline <svg>.
  const urls = [...html.matchAll(/https?:\/\/[^"'\s)]+/g)]
    .map((m) => m[0])
    .filter((u) => u !== 'http://www.w3.org/2000/svg');
  assert.deepStrictEqual(urls, [], `the page must not call out to any other site: ${urls.join(', ')}`);
});

test('the page keeps what is typed, and hands it back on the next open', () => {
  const store = {};
  const p = loadPage(store);
  const T = p.sandbox.TRAINER;
  assert.ok(T, 'the page puts its own surface on window, so this check drives the real script');
  assert.equal(T.KEY, 'tsid_trainer_intake_v1');

  // A thumb, filling the form in.
  p.box('name').value = 'Jacques';
  p.box('age').value = '47';
  p.box('build').value = "5'11, 15 stone";
  p.box('days').value = '4';
  p.box('when').value = 'before work';
  p.box('hurts').value = 'a knee from the old days';
  p.box('rules').value = 'nothing overhead';
  p.box('dayone').value = '2026-10-11';
  p.box('kit:Dumbbells').checked = true;
  p.box('kit:Floor space').checked = true;
  p.box('want:Stronger').checked = true;

  // Typing saves by itself — there is no save button to forget on a phone.
  p.fire('intake', 'input');
  const kept = JSON.parse(store[T.KEY]);
  assert.equal(kept.name, 'Jacques');
  assert.equal(kept.age, '47');
  assert.equal(kept.days, '4');
  assert.equal(kept.dayone, '2026-10-11');
  assert.deepStrictEqual(kept.kit, ['Dumbbells', 'Floor space']);
  assert.deepStrictEqual(kept.want, ['Stronger']);

  // And the button saves the same thing — and stops the form from navigating,
  // which is the one thing a plain <form> does by itself and would throw every
  // answer away on the way out.
  let navigated = false;
  p.fire('intake', 'submit', { preventDefault() { navigated = true; } });
  assert.equal(navigated, true, 'submitting must not reload the page');
  assert.deepStrictEqual(JSON.parse(store[T.KEY]), kept);

  // Re-opening the page puts every answer back where it was.
  const again = loadPage(store);
  assert.equal(again.box('name').value, 'Jacques');
  assert.equal(again.box('hurts').value, 'a knee from the old days');
  assert.equal(again.box('dayone').value, '2026-10-11');
  assert.equal(again.box('kit:Dumbbells').checked, true);
  assert.equal(again.box('kit:Nothing yet').checked, false, 'a box that was not ticked stays unticked');
  assert.equal(again.box('want:Stronger').checked, true);
  assert.match(again.box('savedLine').textContent, /Saved on this phone/);

  // Nothing was sent anywhere, in either run.
  assert.equal(p.sandbox.sent, 0, 'the page must not have sent anything');
  assert.equal(again.sandbox.sent, 0, 'nor on the second open');
});

test('an answer left blank is left out, not stored as empty', () => {
  // A half-filled form is a half-filled form, not an error, and it must not
  // write empty strings that later look like answers somebody gave.
  const store = {};
  const p = loadPage(store);
  p.box('name').value = '   ';
  p.box('days').value = '3';
  p.fire('intake', 'submit');
  const kept = JSON.parse(store[p.sandbox.TRAINER.KEY]);
  assert.deepStrictEqual(Object.keys(kept), ['days'], 'only what was answered is kept');
  assert.equal(kept.name, undefined, 'a space is not a name');
});

test('clearing clears all of it, on the page and on the phone', () => {
  const store = {};
  const p = loadPage(store);
  p.box('name').value = 'Jacques';
  p.box('kit:Dumbbells').checked = true;
  p.fire('intake', 'submit');
  assert.ok(store[p.sandbox.TRAINER.KEY], 'there is something kept to clear');

  assert.ok(p.fire('clearBtn', 'click'), 'the Clear button is wired up');
  assert.equal(store[p.sandbox.TRAINER.KEY], undefined, 'the phone is cleared');
  assert.equal(p.box('name').value, '', 'and so is the page');
  assert.equal(p.box('kit:Dumbbells').checked, false, 'boxes included');
  assert.match(p.box('savedLine').textContent, /Nothing filled in yet/,
    'and the page says so rather than claiming something was saved');

  // A cleared phone opens as a fresh form, not somebody else's answers.
  const fresh = loadPage(store);
  assert.equal(fresh.box('name').value, '');
  assert.equal(fresh.box('savedLine').textContent, 'Nothing filled in yet.');
});

test('a browser that has been cleared starts empty instead of breaking', () => {
  // Reading the kept answers is the first thing the page does, so a stored
  // value that is not JSON must not leave a dead form behind it.
  const store = { tsid_trainer_intake_v1: 'not json at all' };
  const p = loadPage(store);
  assert.ok(p.sandbox.TRAINER, 'the page still comes up');
  assert.equal(p.box('name').value, '');
  assert.match(p.box('savedLine').textContent, /Nothing filled in yet/);
});

test('the page never promises a plan it does not have, and puts a doctor first', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  // The words that would turn an information form into a program.
  assert.match(html, /there is no plan on it yet/i, 'it says so, rather than implying otherwise');
  // And the two lines that outrank anything a later plan will say.
  assert.match(html, /A doctor's rule wins over this page, always/,
    'a doctor comes first, and says so before anything is planned');
  assert.match(html, /stop, on the day, if there is chest pain/i,
    'and it names the day it should stop');
});
