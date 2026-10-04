// "Save to my phone" — the one install offer that still ships.
//
// Jacques, 18 Sep: "Put the same Save to my phone button in the main Day One
// app." The Zodiacs page (key.html) had one already; the recovery app got its
// own copy of the same offer in Profile.
//
// 4 Oct 2026: the recovery app is deleted, along with the tests that read its
// page. The Zodiacs page is what is left, and this file now guards that one
// offer instead of two. The parts of it that matter are unchanged, because
// they are the difference between a button that hands the job to the browser's
// own installer and a button that tells an iPhone owner to go looking for a
// button Safari does not have.
//
// rpInstall is taken out of the page and RUN here rather than inspected as text:
// a regex can prove the function exists, it cannot prove which answer a phone
// gets.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KEY = path.join(__dirname, '..', '..', 'key.html');
const html = fs.readFileSync(KEY, 'utf8');

// The functions as the page ships them: the banner and the two answers, then the
// handler itself. rpNote is left out on purpose - the note it draws is DOM, and
// this is the behaviour underneath it. Both markers are asserted, so a rename
// fails loudly instead of quietly testing three lines of something else.
function installSource() {
  const start = html.indexOf('  var installEvent = null;\n  function rpStandalone(){');
  assert.ok(start > -1, 'the install banner must be in key.html');
  const mid = html.indexOf('  function rpNote(', start);
  assert.ok(mid > start, 'the banner must end where the note is drawn');
  const tap = html.indexOf('  function rpInstall(){');
  assert.ok(tap > mid, 'the handler must sit below the note');
  const end = html.indexOf('  window.addEventListener(\'beforeinstallprompt\'', tap);
  assert.ok(end > tap, 'the handler must end at the browser offer');
  const src = html.slice(start, mid) + html.slice(tap, end);
  assert.ok(/function rpStandalone\(\)/.test(src) && /function rpApple\(\)/.test(src) && /function rpInstall\(\)/.test(src),
    'the whole offer is read from the same place');
  return src;
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';

function page(opts) {
  opts = opts || {};
  const notes = [];
  const prompted = [];
  const sandbox = {
    console, Object, Array, String, Number, Boolean, RegExp, Error, JSON,
    document: opts.touch ? { addEventListener() {}, ontouchend: null } : { addEventListener() {} },
    navigator: { userAgent: opts.ua || ANDROID, standalone: !!opts.iosStandalone },
    matchMedia: () => ({ matches: !!opts.standalone }),
    rpNote: (title, body) => notes.push({ title, body }),
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(installSource() + '\nthis.rpInstall=rpInstall;this.rpStandalone=rpStandalone;this.rpApple=rpApple;', sandbox,
    { filename: 'key-install.js' });
  // installEvent is set by the page's own beforeinstallprompt listener; here it
  // is set the same way, before the tap, exactly as a browser would.
  sandbox.installEvent = opts.pending ? { prompt: () => prompted.push(1) } : null;
  return { notes, prompted, sandbox, tap: () => sandbox.rpInstall() };
}

test('the Zodiacs page carries the offer, and it is wired to something', () => {
  assert.match(html, />Save to my phone</, 'the button is there, in those words');
  assert.match(html, /id="rp-install"/, 'and it has the id the handler looks for');
  assert.match(html, /if\(t\.id === 'rp-install'\)\{ rpInstall\(\); return; \}/, 'a tap on it calls rpInstall');
  assert.match(html, /if\(ib\) ib\.hidden = rpStandalone\(\);/, 'already saved: the button is retired, not left doing nothing');
  // One button and one handler — a leftover id from an earlier pass would be two.
  assert.strictEqual(html.split('id="rp-install"').length - 1, 1);
  assert.match(html, /window\.addEventListener\('beforeinstallprompt'/, 'the browser offer is caught when it comes');
});

test('where the browser offers a real install, that is what gets used', () => {
  const p = page({ pending: true });
  p.tap();
  assert.strictEqual(p.prompted.length, 1, "the browser's own prompt is what runs");
  assert.strictEqual(p.notes.length, 0, 'so no explanation is needed');
});

test('on an iPhone it gives the two taps, because Safari has no install button', () => {
  const p = page({ ua: IPHONE });
  p.tap();
  assert.strictEqual(p.notes.length, 1);
  const [note] = p.notes;
  assert.match(note.title, /home screen/i);
  assert.match(note.body, /Share/, 'the button that exists');
  assert.match(note.body, /Add to Home Screen/, 'and where to go in it');
  assert.doesNotMatch(note.body, /browser menu/, 'never the Android answer on an iPhone');
  assert.match(note.body, /Nothing is downloaded and nothing is charged/,
    'it never claims to be something it is not');
});

test('an iPad that calls itself a Mac is still an iPad', () => {
  // iPadOS 13+ reports itself as a Macintosh. Without the touch check it would
  // be sent down the desktop answer, which is the wrong two taps.
  const p = page({ ua: MAC, touch: true });
  p.tap();
  assert.match(p.notes[0].body, /Add to Home Screen/, 'given the iPad answer');
  assert.doesNotMatch(p.notes[0].body, /browser menu/);
});

test('everywhere else it points at the browser menu, not at Safari', () => {
  const p = page({ ua: ANDROID });
  p.tap();
  const [note] = p.notes;
  assert.match(note.body, /browser menu/);
  assert.match(note.body, /Add to Home screen/i);
  assert.doesNotMatch(note.body, /Share button in Safari/, 'never the iPhone answer elsewhere');
});

test('once it is on the home screen the tap is answered as already saved', () => {
  const p = page({ standalone: true });
  assert.strictEqual(p.sandbox.rpStandalone(), true, 'the display mode is read, not guessed');
  p.tap();
  assert.strictEqual(p.notes.length, 1);
  assert.match(p.notes[0].title, /Already saved/);
  assert.strictEqual(p.prompted.length, 0, 'and nothing is prompted');
});

test('the offer is the page\'s own note, never a native popup or another site', () => {
  const src = installSource();
  assert.match(src, /rpNote\(/, "every answer goes through the page's own note");
  assert.doesNotMatch(src, /\balert\(/, 'never a native alert');
  assert.doesNotMatch(src, /https?:\/\//, 'and it never sends anyone to another site');
});
