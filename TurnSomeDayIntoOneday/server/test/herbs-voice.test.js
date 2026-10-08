// The herb library reads out loud — 4 Oct 2026.
//
// Jacques: "take a friendly off the herbs and add voice to herbs." Two changes,
// and both of them are quiet when they are wrong: an ask box left wired to a
// route nothing answers reads as a working page, and a read-aloud button that
// does nothing reads as a page that ignores the tap.
//
// So the page is run for real in a stub DOM with a stubbed phone voice, and the
// button is driven the way a thumb drives it. What is checked is what the page
// sends to the phone's own speech — nothing is sent anywhere else, which is the
// whole reason the voice is the browser's rather than a recording.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const HTML = fs.readFileSync(path.join(ROOT, 'herbs.html'), 'utf8');

// The page's own inline script, cut out by index rather than by a regex over
// HTML. The regex the sibling tests use is case-sensitive and silently misses an
// uppercase <SCRIPT>, which is exactly the bug CodeQL flagged in the first
// version of this file; a page is not a regular language, and this only has to
// find the blocks this page actually ships.
function inlineScript(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const lower = html.toLowerCase();
  const out = [];
  let i = 0;
  for (;;) {
    const open = lower.indexOf('<script', i);
    if (open === -1) break;
    const openEnd = lower.indexOf('>', open);
    const close = lower.indexOf('</script', openEnd);
    if (openEnd === -1 || close === -1) break;
    // A block with a src is somebody else's file, not the page's own script.
    if (lower.slice(open + 7, openEnd).indexOf('src=') === -1) out.push(html.slice(openEnd + 1, close));
    i = close + 1;
  }
  return out.join('\n;\n');
}

function loadPage() {
  const els = new Map();
  const mk = (id) => ({
    id, value: '', textContent: '', innerHTML: '', disabled: false, hidden: false,
    className: '', style: {}, dataset: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c) }, remove(c) { this._s.delete(c) },
      toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c) } else if (f) { this._s.add(c) } else { this._s.delete(c) } },
      contains(c) { return this._s.has(c) },
    },
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
  const cancelled = [];
  const sandbox = {
    document: doc, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set, Intl,
    localStorage: { getItem() { return null }, setItem() {}, removeItem() {} },
    fetch: async () => { throw new Error('this page must not call the network') },
    scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: 'node' },
    // The phone's own voice, stood up so the test can hear what it was given.
    speechSynthesis: {
      speak(u) { said.push(u) },
      cancel() { cancelled.push(1) },
      getVoices() { return [{ name: 'Phone voice', lang: 'en-GB', default: true }] },
      speaking: false,
      addEventListener() {},
    },
  };
  sandbox.SpeechSynthesisUtterance = function (text) { this.text = text };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(inlineScript('herbs.html'), sandbox, { filename: 'herbs.html' });
  return { sandbox, els, said, cancelled };
}

test('the herb library: Friendly is gone from the page, lock stock and barrel', () => {
  // The ask box was the only thing on this page that called the server, and the
  // only thing here that ran on the app's own AI key. All of it goes, and all of
  // it is asserted by name — a leftover class or a leftover listener is exactly
  // how half a feature stays behind.
  for (const gone of [
    /Friendly/, /\/api\/chat/, /ASK_SYS/, /askCtx/, /\bask\s*\(/, /data-ask/, /id="ask"/,
    /ask-who/, /ask-go/, /ask-hd/, /ask-badge/, /ask-fine/,
  ]) {
    assert.doesNotMatch(HTML, gone, `the herb library must not still carry ${gone}`);
  }
  const p = loadPage();
  assert.equal(typeof p.sandbox.ask, 'undefined', 'no ask() is left defined on the page');
  assert.equal(typeof p.sandbox.ASK_SYS, 'undefined', 'and no prompt is left in it');
  assert.equal(p.said.length, 0, 'nothing is spoken until a button is pressed');
});

test('the herb library: an open herb carries a read-aloud button', () => {
  const p = loadPage();
  const list = p.sandbox.allHerbs();
  assert.ok(list.length > 200, 'the library still loads');
  const fennel = list.filter((h) => /^Fennel/.test(h.n))[0];
  assert.ok(fennel, 'Fennel is in the library');
  p.sandbox.openId = fennel.id;
  p.sandbox.render();
  const html = p.els.get('view').innerHTML;
  assert.match(html, /data-say="/, 'the open card carries its own read button');
  assert.match(html, new RegExp('data-say="' + fennel.id + '"'), 'pointed at that herb, not at the library');
  assert.match(html, /Read it to me/, 'in words, not a bare icon');
  assert.match(html, /data-saystop/, 'and there is a way to stop it');
  assert.equal(p.said.length, 0, 'rendering does not start reading by itself');
});

test('the herb library: the voice is the phone\'s own, and it reads the entry whole', () => {
  const p = loadPage();
  const list = p.sandbox.allHerbs();
  const fennel = list.filter((h) => /^Fennel/.test(h.n))[0];
  p.sandbox.say(fennel.id);
  assert.equal(p.said.length, 1, 'one press, one reading');
  const text = p.said[0].text;
  // Everything the card shows, in the card's order — and the caution is not the
  // part that gets dropped on the way to audio.
  assert.match(text, /Fennel/, 'it names the plant');
  assert.match(text, new RegExp(fennel.u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'and what it is used for');
  assert.match(text, /Caution:/, 'the caution is read like the rest of it');
  assert.match(text, new RegExp(fennel.c.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'in the entry\'s own words');
  assert.match(text, /traditionally taken/, 'and how it is taken');
  // The browser's own speech. Nothing is fetched, downloaded or recorded.
  assert.equal(typeof p.sandbox.speechSynthesis.speak, 'function');
  const src = inlineScript('herbs.html');
  assert.doesNotMatch(src, /https?:\/\//, 'the voice never reaches for another site');
  assert.match(src, /SpeechSynthesisUtterance/, 'it is the browser speaking, not a file');
});

test('the herb library: a second press stops it, and the end of a reading clears up', () => {
  const p = loadPage();
  const list = p.sandbox.allHerbs();
  const first = list[0];
  p.sandbox.say(first.id);
  assert.equal(p.sandbox.SAY_BUSY, first.id, 'the page knows it is reading');
  const beforeStop = p.cancelled.length;
  p.sandbox.say(first.id);
  assert.equal(p.cancelled.length, beforeStop + 1, 'pressing it again stops the voice');
  assert.equal(p.sandbox.SAY_BUSY, null, 'and it stops being busy');
  // And the phone can end a reading on its own — that has to clear up the same way.
  p.sandbox.say(first.id);
  p.said[p.said.length - 1].onend();
  assert.equal(p.sandbox.SAY_BUSY, null, 'the end of a reading puts the button back');
  p.sandbox.sayStop();
  assert.equal(p.said.length, 2, 'and no extra reading has started along the way');
});

test('the herb library: no voice on the phone is said in words, not silence', () => {
  const p = loadPage();
  delete p.sandbox.speechSynthesis;
  delete p.sandbox.SpeechSynthesisUtterance;
  assert.equal(p.sandbox.speechOK(), false, 'the page checks rather than assuming');
  p.sandbox.say(p.sandbox.allHerbs()[0].id);
  assert.equal(p.said.length, 0, 'nothing is spoken when there is no voice');
  assert.match(HTML, /This phone has no voice/, 'the button says so instead of doing nothing');
});

test('the herb library: its own safety lines are still on the page', () => {
  // The ask box that carried these went with Friendly. The lines themselves are
  // the page's own, on the safety tab, and they are the part that never moves.
  const p = loadPage();
  p.sandbox.tab = 'safety';
  p.sandbox.render();
  const html = p.els.get('view').innerHTML;
  assert.match(html, /An infection is a doctor, not a tea/);
  assert.match(html, /Coming off alcohol or a drug/);
  assert.match(html, /Ask a pharmacist before you add a herb/);
});

// The read-aloud is not only for a herb: the rest of the page reads out loud too,
// in the same on-device voice and with the same pair of buttons.
test('the herb library: the book sections read out loud as well', () => {
  const p = loadPage();
  p.sandbox.tab = 'books';
  p.sandbox.openId = 'bk0';
  p.sandbox.render();
  const html = p.els.get('view').innerHTML;
  assert.match(html, /data-say="bk0"/, 'the open book section carries its own read button');
  assert.match(html, /Read it to me/);
  assert.equal(p.said.length, 0, 'drawing it does not start reading');
  p.sandbox.say('bk0');
  assert.equal(p.said.length, 1, 'one press, one reading');
  const text = p.said[0].text;
  assert.ok(text.indexOf(p.sandbox.BOOKS[0].h) === 0, 'it starts by naming the section');
  assert.doesNotMatch(text, /<[^>]*>/, 'and no HTML tag is read out loud');
});

test('the herb library: each day of the thirty days reads out loud', () => {
  const p = loadPage();
  p.sandbox.tab = 'course';
  p.sandbox.openId = 'd1';
  p.sandbox.render();
  const html = p.els.get('view').innerHTML;
  assert.match(html, /data-say="d1"/, 'the open day carries its own read button');
  p.sandbox.say('d1');
  assert.equal(p.said.length, 1, 'one press, one reading');
  assert.match(p.said[0].text, /^Day 1\./, 'it starts by naming the day');
  // The teaching is read; the quiz is not, because reading the questions and
  // answers out would spoil the thing the day is there to ask.
  const day1 = p.sandbox.COURSE.filter((d) => d.d === 1)[0];
  assert.ok(day1 && day1.q.length, 'day 1 still has its quiz');
  assert.ok(p.said[0].text.indexOf(day1.q[0].q) === -1, 'the quiz question stays on the screen');
});

test('the herb library: the safety tab can be read out loud', () => {
  const p = loadPage();
  p.sandbox.tab = 'safety';
  p.sandbox.render();
  const html = p.els.get('view').innerHTML;
  assert.match(html, /data-say="safety"/, 'the safety tab carries a read button');
  p.sandbox.say('safety');
  assert.equal(p.said.length, 1, 'one press, one reading');
  assert.match(p.said[0].text, /An infection is a doctor, not a tea/, 'the first safety line is read');
  assert.match(p.said[0].text, /Ask a pharmacist before you add a herb/, 'and the pharmacist line comes through too');
});
