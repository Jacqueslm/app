// The reading player on the Key — 18 Sep 2026.
//
// Jacques: "when you hit pause on a reading it starts back to the beginning ...
// let the zodiac app use the player inside the app so I can fast forward to
// rewind pause continue where it left off ... so iPhone has to go completely out
// to go to another part of the app."
//
// The bug he described was real and it was the plain kind: the button said Pause
// and did Stop. speechSynthesis.cancel() plus an emptied queue means the only way
// on is the top of the reading again, and a reading here is forty-odd paragraphs.
//
// The player is a script appended to the END of key.html, because the voice
// engine sits 1.30MB into a 1.3MB file. Top-level function declarations in a
// classic script land on window, so it works by replacing speakReading and
// stopSpeaking by assignment. That trick is the whole reason this file has to
// run the block for real: if it stops being true - the page gets wrapped in an
// IIFE, the block gets moved above the engine, a name is spelled differently -
// then the page keeps its old behaviour and every symptom he reported comes
// back, silently.
//
// So this runs the appended block in a stub DOM with a stub speech engine and
// drives it the way a thumb would: press Read, hear a word boundary, press
// Pause, press Continue. What is checked is what he asked for - that Continue
// says the REST of the line rather than starting over, that Back and Next move
// by paragraph, that the place survives leaving the page, and that stopping is
// not the same as finishing.
//
// Not a browser: it proves the wiring, the state machine and the words spoken.
// It cannot prove how the bar looks.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'key.html'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const MARK = 'THE READING PLAYER';

// The appended block: from the <script> after the marker to its closing tag.
function blockSource() {
  const at = PAGE.indexOf(MARK);
  assert.ok(at > -1, 'the reading player must be in key.html');
  const open = PAGE.indexOf('<script>', at);
  const close = PAGE.indexOf('</script>', open);
  assert.ok(open > -1 && close > open, 'the player lives in its own script block');
  return PAGE.slice(open + '<script>'.length, close);
}

/* ------------------------------------------------------------------ a stub DOM
   Small on purpose: only what this block touches. innerHTML is parsed, because
   the bar is built from markup and its buttons have to be findable afterwards. */
function mkEl(tag, attrs) {
  attrs = attrs || {};
  const el = {
    tag, attrs, parent: null, children: [], _text: '',
    hidden: false, style: {}, _l: {}, _id: attrs.id || '',
    get id() { return el._id; },
    set id(v) { el._id = String(v); },
    get className() { return el.attrs.class || ''; },
    set className(v) { el.attrs.class = String(v); },
    classList: {
      _s: new Set(String(attrs.class || '').split(/\s+/).filter(Boolean)),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, f) {
        if (f === undefined) f = !this._s.has(c);
        if (f) this._s.add(c); else this._s.delete(c);
        return f;
      },
    },
    get textContent() {
      return el.children.length ? el.children.map((c) => c.textContent).join('') : el._text;
    },
    set textContent(v) { el.children.length = 0; el._text = String(v); },
    get innerHTML() {
      if (!el.children.length) return el._text;
      return el.children.map((c) => (c.children.length ? `<${c.tag}>${c.innerHTML}</${c.tag}>` : c._text)).join('');
    },
    set innerHTML(v) { el.children.length = 0; el._text = ''; parse(String(v), el, ALL); },
    appendChild(c) { c.parent = el; el.children.push(c); ALL.push(c); return c; },
    insertAdjacentHTML(pos, html) {
      const frag = mkEl('_frag', {});
      parse(String(html), frag, ALL);
      if (!el.parent) return;
      const sibs = el.parent.children;
      const i = sibs.indexOf(el);
      frag.children.forEach((c) => { c.parent = el.parent; });
      sibs.splice(i + 1, 0, ...frag.children);
    },
    querySelector(sel) { return descendants(el).find((e) => matches(e, sel)) || null; },
    querySelectorAll(sel) { return descendants(el).filter((e) => matches(e, sel)); },
    closest(sel) { let p = el; while (p) { if (matches(p, sel)) return p; p = p.parent; } return null; },
    addEventListener(type, fn) { (el._l[type] = el._l[type] || []).push(fn); },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(el.attrs, k) ? el.attrs[k] : null; },
    remove() {
      if (!el.parent) return;
      const i = el.parent.children.indexOf(el);
      if (i > -1) el.parent.children.splice(i, 1);
    },
    scrollIntoView() {}, focus() {},
  };
  return el;
}

function descendants(el) {
  const out = [];
  for (const c of el.children) { out.push(c, ...descendants(c)); }
  return out;
}

function matches(el, sel) {
  sel = String(sel).trim();
  // [data-rp], [data-rp="play"], a[href="/app"] — the three shapes used here.
  const attr = sel.match(/^([a-zA-Z0-9]*)\[([\w-]+)(?:="([^"]*)")?\]$/);
  if (attr) {
    if (attr[1] && el.tag !== attr[1]) return false;
    if (!Object.prototype.hasOwnProperty.call(el.attrs, attr[2])) return false;
    return attr[3] === undefined ? true : el.attrs[attr[2]] === attr[3];
  }
  if (sel[0] === '#') return el.id === sel.slice(1);
  if (sel[0] === '.') return el.classList.contains(sel.slice(1));
  return el.tag === sel;
}

let ALL = [];
function parse(html, into, registry) {
  const re = /<(\/)?([a-zA-Z0-9]+)((?:[^>"]|"[^"]*")*)>|([^<]+)/g;
  const stack = [into];
  let m;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) {
      if (m[4].trim()) stack[stack.length - 1]._text += m[4];
      continue;
    }
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
    const attrs = {};
    const are = /([\w-:]+)\s*=\s*"([^"]*)"|([\w-:]+)/g;
    let am;
    while ((am = are.exec(m[3] || ''))) {
      if (am[1]) attrs[am[1]] = am[2];
      else if (am[3]) attrs[am[3]] = '';
    }
    const el = mkEl(m[2], attrs);
    stack[stack.length - 1].appendChild(el);
    registry.push(el);
    stack.push(el);
  }
  return into;
}

/* ---------------------------------------------------------------- the harness */
function loadPlayer(opts) {
  opts = opts || {};
  ALL = [];
  const body = mkEl('body', {});
  const head = mkEl('head', {});
  ALL.push(body, head);

  // The two buttons the page already has in its markup, on every panel.
  const speakBtns = [mkEl('button', { class: 'btn ghost sm speak-btn' }), mkEl('button', { class: 'btn ghost sm speak-btn' })];
  const stopBtns = [mkEl('button', { class: 'btn ghost sm stop-btn', hidden: '' })];
  const help = mkEl('button', { class: 'btn ghost sm', id: 'btn-help' });
  [speakBtns[0], speakBtns[1], stopBtns[0], help].forEach((e) => body.appendChild(e));

  const doc = {
    head, body, readyState: 'complete', hidden: false, _l: {},
    createElement(tag) { const e = mkEl(tag, {}); ALL.push(e); return e; },
    getElementById(id) { return ALL.find((e) => e.id === id) || null; },
    querySelector(sel) { return [body, head].flatMap(descendants).find((e) => matches(e, sel)) || null; },
    querySelectorAll(sel) { return [body, head].flatMap(descendants).filter((e) => matches(e, sel)); },
    addEventListener(type, fn) { (doc._l[type] = doc._l[type] || []).push(fn); },
  };

  const spoken = [];
  const prompts = [];
  const wakes = [];
  const notes = [];
  let blocks = (opts.blocks || [
    { text: 'Your day. July 3 is the third day of the Cancer period.' },
    { text: 'You. You carry the room without meaning to.' },
    { text: 'You and other people. You meet a slower mind and it steadies you.' },
  ]).map((b, i) => ({ el: mkEl('p', { id: 'blk' + i }), text: b.text }));

  class Utt {
    constructor(text) { this.text = text; }
  }
  const synth = {
    speaking: false,
    speak(u) { spoken.push(u); synth.speaking = true; },
    cancel() { synth.speaking = false; },
    pause() {}, resume() {},
  };

  const stored = Object.assign({}, opts.stored || {});
  const warned = [];
  const sandbox = {
    document: doc, console,
    setTimeout, clearTimeout,
    // Timers that never fire: the keep-awake nudge and the label safety net must
    // not move underneath an assertion.
    setInterval() { return 0; }, clearInterval() {},
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set,
    SpeechSynthesisUtterance: Utt,
    speechSynthesis: synth,
    navigator: { userAgent: opts.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    matchMedia: () => ({ matches: !!opts.standalone, addEventListener() {} }),
    localStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null; },
      setItem(k, v) { stored[k] = String(v); },
      removeItem(k) { delete stored[k]; },
    },
    // The page's own helpers, stubbed. The player is only allowed to reach for
    // these — anything else would be the player inventing a reading.
    readableBlocks: () => blocks.map((b) => ({ el: b.el, text: b.text })),
    voiceList: () => (opts.noVoice ? [] : [{ name: 'Test voice' }]),
    pickVoice: () => (opts.noVoice ? null : { name: 'Test voice' }),
    lightBlock(el) { sandbox.lit = el; },
    lightWord(at, len) { sandbox.litWord = [at, len]; },
    clearLit() { sandbox.lit = null; sandbox.litWord = null; },
    wakeAcquire(need) { wakes.push(['acquire', need]); },
    wakeRelease(need) { wakes.push(['release', need]); },
    toast(msg) { warned.push(msg); },
    _l: {},
    addEventListener(type, fn) { (sandbox._l[type] = sandbox._l[type] || []).push(fn); },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(blockSource(), sandbox, { filename: 'key-player.js' });

  const last = () => spoken[spoken.length - 1];

  function fire(el) {
    (doc._l.click || []).forEach((fn) => fn({ target: el }));
  }

  return {
    sandbox, spoken, stored, wakes, warned, prompts, notes, blocks, synth,
    // press the page's own Read it to me / Pause / Continue button
    speak() { sandbox.speakReading(); },
    // ...and its Stop
    stop() { sandbox.stopSpeaking(); },
    // a bar button, by its data-rp
    bar(key) { const b = doc.querySelector(`[data-rp="${key}"]`); assert.ok(b, `the bar must have a ${key} button`); fire(b); },
    header(id) { const b = doc.getElementById(id); assert.ok(b, `the header must have ${id}`); fire(b); },
    // the engine says it reached a word
    word(at, len) { if (last() && last().onboundary) last().onboundary({ name: 'word', charIndex: at, charLength: len || 4 }); },
    // ...and the end of the line
    end() { if (last() && last().onend) last().onend(); },
    label() { return speakBtns[0].textContent; },
    barShown() { const b = doc.getElementById('rp-bar'); return !!b && !b.hidden; },
    line() { const b = doc.getElementById('rp-count'); return b ? b.textContent : ''; },
    nowLine() { const b = doc.getElementById('rp-now'); return b ? b.textContent : ''; },
    mainLabel() { const b = doc.querySelector('[data-rp="play"]'); return b ? b.textContent : ''; },
    installLabel() { const b = doc.getElementById('rp-install'); return b ? b.textContent : ''; },
    installShown() { const b = doc.getElementById('rp-install'); return !!b && !b.hidden; },
    noteText() { const n = doc.getElementById('rp-note'); return n ? n.textContent : ''; },
    fireWindow(type, ev) { (sandbox._l[type] || []).forEach((fn) => fn(ev || { preventDefault() {} })); },
    fireDoc(type) { (doc._l[type] || []).forEach((fn) => fn({})); },
    setBlocks(next) { blocks = next.map((t, i) => ({ el: mkEl('p', { id: 'x' + i }), text: t })); },
    memory() { const raw = stored['personology.reading.v1']; return raw ? JSON.parse(raw) : null; },
  };
}

const P = () => loadPlayer();

/* ------------------------------------------------------------------ the wiring */

test('the player is appended after the page\'s own voice engine, and takes it over', () => {
  const at = PAGE.indexOf(MARK);
  assert.ok(at > -1, 'the player must be in key.html');
  assert.ok(at > PAGE.indexOf('function stopSpeaking'),
    'it has to come AFTER the engine it replaces, or the engine wins');
  const src = blockSource();
  assert.match(src, /window\.speakReading = rpPressed/, 'Read it to me is replaced by assignment');
  assert.match(src, /window\.stopSpeaking = rpStop/, 'and so are Stop, the voice picker and the tab switch');
  assert.match(src, /readableBlocks\(\)/, 'the words come from the page, never from this block');
  assert.match(src, /pickVoice\(\)/, 'and so does the voice');
});

test('the reading starts at the top, on the words the page handed over', () => {
  const p = P();
  p.speak();
  assert.strictEqual(p.spoken.length, 1);
  assert.strictEqual(p.spoken[0].text, p.blocks[0].text, 'the first line, whole');
  assert.strictEqual(p.mainLabel(), 'Pause');
  assert.ok(p.barShown(), 'and the bar is on screen while it reads');
  assert.strictEqual(p.line(), 'line 1 of 3');
});

test('Pause holds its place — Continue says the rest of the line, not the top of it', () => {
  const p = P();
  p.speak();
  p.word(8);                                  // the engine reaches the 8th character
  p.speak();                                  // the button is Pause
  assert.strictEqual(p.spoken.length, 1, 'pausing must not start a new utterance');
  assert.strictEqual(p.mainLabel(), 'Continue');
  assert.match(p.label(), /Continue/);

  p.speak();                                  // the button is Continue
  assert.strictEqual(p.spoken.length, 2);
  assert.notStrictEqual(p.spoken[1].text, p.blocks[0].text,
    'this is the bug he reported: continuing must not replay the paragraph');
  assert.ok(p.blocks[0].text.endsWith(p.spoken[1].text), 'it says the rest of the line');
  assert.ok(p.spoken[1].text.length < p.blocks[0].text.length, 'and it is shorter than the whole line');
});

test('a paused reading is still paused after leaving the page, and continues where it stopped', () => {
  const first = P();
  first.speak();
  first.word(12);
  first.bar('fwd');                            // move to the second paragraph
  first.speak();                               // and pause there
  const mem = first.memory();
  assert.ok(mem, 'the place is written to the device');
  assert.strictEqual(mem.at, 1, 'paragraph two');
  assert.strictEqual(mem.of, 3);

  // A fresh page load, same reading on screen — the phone was locked, or the
  // person went to another part of the app and came back.
  const back = loadPlayer({ stored: first.stored });
  assert.match(back.label(), /Continue where it left off/);
  back.speak();
  assert.strictEqual(back.spoken[0].text, back.blocks[1].text, 'and one tap carries on from there');
});

test('Back and Next move a paragraph at a time — a spoken reading has no scrub bar', () => {
  const p = P();
  p.speak();
  p.word(9, 3);
  p.bar('back');
  assert.strictEqual(p.spoken.length, 2);
  assert.strictEqual(p.spoken[1].text, p.blocks[0].text, 'back first restarts the line being said');

  p.bar('fwd');
  assert.strictEqual(p.spoken[2].text, p.blocks[1].text, 'next moves to the paragraph under it');
  assert.strictEqual(p.line(), 'line 2 of 3');
  assert.match(p.nowLine(), /carry the room/, 'and the bar says which line that is');

  p.bar('fwd');
  p.bar('fwd');
  assert.strictEqual(p.line(), 'line 3 of 3', 'and it stops at the last line rather than reading past it');
});

test('Stop keeps the place, and only Start over forgets it', () => {
  const p = P();
  p.speak();
  p.word(10);
  p.bar('stop');
  assert.ok(p.memory(), 'stopping is not throwing the reading away');
  assert.match(p.label(), /Continue where it left off/);
  assert.ok(!p.barShown(), 'and the bar goes away');

  p.bar('over');
  assert.strictEqual(p.memory(), null, 'start over is the button that forgets');
});

test('reaching the end is not the same as stopping halfway', () => {
  const p = P();
  p.speak();
  p.end();
  p.end();
  assert.strictEqual(p.spoken.length, 3, 'one utterance per paragraph');
  p.end();
  assert.strictEqual(p.memory(), null, 'a finished reading has nothing to continue');
  assert.match(p.label(), /Read it to me/);
  assert.ok(!p.barShown());
});

test('a long paragraph is cut up, so Continue can land inside it', () => {
  const long = 'This is a sentence about the day you were born. '.repeat(14);   // ~630 characters
  const p = loadPlayer({ blocks: [{ text: long }, { text: 'The next line.' }] });
  p.speak();
  assert.ok(p.spoken[0].text.length <= 240, 'no single utterance is longer than the engines cope with');
  p.bar('fwd');
  assert.strictEqual(p.spoken[1].text !== long && long.includes(p.spoken[1].text), true,
    'next moves within the same paragraph before it moves past it');
  assert.strictEqual(p.line(), 'line 2 of 4');
});

test('a read-along highlight is asked for, at the right character', () => {
  const p = P();
  p.speak();
  p.word(4, 5);
  assert.deepStrictEqual(p.sandbox.litWord, [4, 5], 'the page\'s own highlighter is told which word');
});

test('with a voice missing, it says so rather than sitting silent', () => {
  const p = loadPlayer({ noVoice: true });
  p.speak();
  assert.match(p.warned.join(' '), /No voice/, 'the page\'s toast carries the message');
  assert.strictEqual(p.spoken.length, 0);
});

/* ----------------------------------------------------------------- the install */

test('the header offers the app, the install, and says nothing when already saved', () => {
  const p = P();
  const app = p.sandbox.document.querySelector('a[href="/app"]');
  assert.ok(app, 'there is a way back to the rest of the app that does not close the page');
  assert.strictEqual(p.installLabel(), 'Save to my phone');
  assert.ok(p.installShown());

  const done = loadPlayer({ standalone: true });
  assert.ok(!done.installShown(), 'already on the home screen: the offer is not made again');
});

test('on an iPhone it gives the two taps, because Safari has no install button to press', () => {
  const p = loadPlayer({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  p.header('rp-install');
  const text = p.noteText();
  assert.match(text, /Share/, 'the Share button');
  assert.match(text, /Add to Home Screen/, 'and the exact words in Safari\'s list');
});

test('where the browser offers a real install, that is what is used', () => {
  const p = P();
  let prompted = 0;
  p.fireWindow('beforeinstallprompt', { preventDefault() {}, prompt() { prompted++; } });
  p.header('rp-install');
  assert.strictEqual(prompted, 1, 'the browser\'s own prompt, not a set of instructions');
  assert.strictEqual(p.noteText(), '', 'and no note, because nothing needed explaining');
});

/* ------------------------------------------------- the page stays private */

test('the offline cache still refuses the private page', () => {
  // The whole point of /key is that it is served only to a signed-in person on
  // the allowlist. A cached copy outlives that check, and the offline fallback
  // would hand it out unguarded — so the worker must keep skipping it.
  assert.match(SW, /url\.pathname === '\/key' \|\| url\.pathname === '\/key\.html'/,
    'the worker must still skip /key outright');
  assert.ok(!/'\/key'/.test(SW.slice(SW.indexOf('SHELL_FILES'), SW.indexOf('];', SW.indexOf('SHELL_FILES')))),
    'and /key must never be precached');
});

test('the manifest names this page, and its icons are real files', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest-zodiacs.json'), 'utf8'));
  assert.strictEqual(manifest.start_url, '/key', 'an icon saved from here opens here');
  assert.strictEqual(manifest.scope, '/key');
  assert.strictEqual(manifest.display, 'standalone');
  assert.ok(manifest.icons.length >= 2);
  for (const icon of manifest.icons) {
    const file = path.join(ROOT, icon.src);
    assert.ok(fs.existsSync(file), `${icon.src} must exist`);
    const buf = fs.readFileSync(file);
    assert.strictEqual(buf.slice(1, 4).toString('ascii'), 'PNG', `${icon.src} must be a real PNG`);
    const [w, h] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    assert.strictEqual(`${w}x${h}`, icon.sizes, `${icon.src} must be the size it claims`);
  }
  assert.match(PAGE, /<link rel="manifest" href="manifest-zodiacs\.json">/, 'and the page points at it');
  assert.match(PAGE, /apple-mobile-web-app-title" content="Zodiacs"/, 'iOS needs the same thing in its own language');
  assert.match(PAGE, /apple-mobile-web-app-capable" content="yes"/);
});
