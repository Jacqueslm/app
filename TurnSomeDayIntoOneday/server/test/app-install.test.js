// "Save to my phone" in the app's Profile — 18 Sep 2026.
//
// Jacques, 18 Sep: "Put the same Save to my phone button in the main Day One
// app." The Zodiacs page (key.html) has had one since the player was rebuilt;
// this puts the same offer in Profile, where the rest of the settings live.
//
// The wiring is small but it is not nothing: it is the difference between a row
// that hands the job to the browser's own installer and a row that tells an
// iPhone owner to go looking for a button Safari does not have. So the block is
// taken out of index.html and RUN here, in a fake page, rather than inspected as
// text. A regex can prove a function exists; it cannot prove which of the two
// answers the phone gets.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..', '..', 'index.html');
const KEY = path.join(__dirname, '..', '..', 'key.html');
const html = fs.readFileSync(APP, 'utf8');

// The block index.html carries, from its banner comment to the last line of it.
// Both markers are asserted, so a rename fails loudly instead of quietly
// testing three lines of something else.
const MARK = '// ─── SAVE TO MY PHONE';
function blockSource() {
  const start = html.indexOf(MARK);
  assert.ok(start > -1, 'the install block must be in index.html');
  const endMark = html.indexOf('\ndayOneInstallRow();\n', start);
  assert.ok(endMark > -1, 'the install block must end by refreshing the row');
  const src = html.slice(start, endMark + '\ndayOneInstallRow();\n'.length);
  assert.ok(!/renderIcons|boot\(\)/.test(src), 'the block is on its own, not the boot section');
  return src;
}

function fakePage(opts) {
  opts = opts || {};
  const appInfoCalls = [];
  const row = { id: 'd1-install-row', style: { display: '' } };
  const listeners = {};
  const prompted = [];
  const sandbox = {
    console, Object, Array, String, Number, Boolean, RegExp, Error, JSON, Math,
    document: { getElementById: (id) => (id === 'd1-install-row' ? row : null) },
    navigator: { userAgent: opts.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    matchMedia: () => ({ matches: !!opts.standalone }),
    appInfo: (title, message) => appInfoCalls.push([title, message]),
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(blockSource(), sandbox, { filename: 'day-one-install.js' });
  return {
    sandbox, appInfoCalls, row,
    rowShown() { return !opts.standalone; },
    install() { sandbox.dayOneInstall(); },
    offerInstall() {
      (listeners.beforeinstallprompt || []).forEach((fn) => fn({
        preventDefault() {},
        prompt() { prompted.push(1); },
      }));
    },
    prompted,
  };
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/* ------------------------------------------------------------------ the offer */

test('Profile carries the offer, at the top of the same block the settings sit in', () => {
  const at = html.indexOf('id="d1-install-row"');
  assert.ok(at > -1, 'the row must be in the app');
  const row = html.slice(at, at + 600);
  assert.match(row, /onclick="dayOneInstall\(\)"/, 'and it must do something when tapped');
  assert.match(row, /Save to my phone</, 'with the same words the Zodiacs page uses');
  // The row belongs with the app-about rows, not buried in the account ones.
  assert.ok(at > html.indexOf('Privacy Policy'), 'after the legal rows');
  assert.ok(at < html.indexOf('id="app-version-txt"'), 'and above the version line');
});

test('it is the same offer as the Zodiacs page, not a second, conflicting one', () => {
  const key = fs.readFileSync(KEY, 'utf8');
  assert.match(key, />Save to my phone</, 'key.html still offers it too');
  assert.match(html, /function dayOneInstall\(\)/, 'and the app has its own copy of the logic');
  // One row, one handler — a leftover id from an earlier pass would be two.
  assert.strictEqual(html.split('id="d1-install-row"').length - 1, 1);
  assert.strictEqual(html.split('function dayOneInstall()').length - 1, 1);
});

/* ----------------------------------------------------------------- the wiring */

test('where the browser offers a real install, that is what gets used', () => {
  const p = fakePage({});
  p.offerInstall();
  p.install();
  assert.strictEqual(p.prompted.length, 1, 'the browser\'s own prompt is what runs');
  assert.strictEqual(p.appInfoCalls.length, 0, 'so no explanation is needed');
});

test('on an iPhone it gives the two taps, because Safari has no install button', () => {
  const p = fakePage({ ua: IPHONE });
  p.install();
  assert.strictEqual(p.appInfoCalls.length, 1);
  const [title, msg] = p.appInfoCalls[0];
  assert.match(title, /home screen/i);
  assert.match(msg, /Share/, 'the button that exists');
  assert.match(msg, /Add to Home Screen/, 'and where to go in it');
  assert.doesNotMatch(msg, /browser menu/, 'never the Android answer on an iPhone');
  assert.match(msg, /Nothing is downloaded and nothing is charged/,
    'it never claims to be something it is not');
});

test('everywhere else it points at the browser menu, not at Safari', () => {
  const p = fakePage({});
  p.install();
  const [, msg] = p.appInfoCalls[0];
  assert.match(msg, /browser menu/);
  assert.match(msg, /Add to Home screen/i);
  assert.doesNotMatch(msg, /Share button in Safari/, 'never the iPhone answer elsewhere');
});

test('once it is on the home screen the offer is withdrawn, and says so if asked', () => {
  const done = fakePage({ standalone: true });
  assert.strictEqual(done.row.style.display, 'none',
    'already saved: the row is retired rather than left there doing nothing');
  done.install();
  assert.strictEqual(done.appInfoCalls.length, 1);
  assert.match(done.appInfoCalls[0][0], /Already saved/);
  assert.strictEqual(done.prompted.length, 0, 'and nothing is prompted');

  const fresh = fakePage({});
  assert.notStrictEqual(fresh.row.style.display, 'none',
    'not saved yet: the row is there to be tapped');
});

test('the install is said in the app\'s own voice, not with a browser popup', () => {
  const src = blockSource();
  assert.match(src, /appInfo\(/, 'every answer goes through the app\'s own modal');
  assert.doesNotMatch(src, /\balert\(/, 'never a native alert');
  assert.doesNotMatch(src, /https?:\/\//, 'and it never sends anyone to another site');
});
