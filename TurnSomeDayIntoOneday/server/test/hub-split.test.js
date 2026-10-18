// Two parts open at once — the shell's own panes (18 Oct 2026).
//
// Jacques: "two parts open at once". Every door on the shell replaces the shell
// with the part it opens, and inside the installed app there is no tab bar to
// open a second part in — so the shell carries both parts itself, in two frames,
// and this file guards the things that rot quietly:
//
//   · the table the panes are filled from drifting away from the doors, so a
//     sixth door never reaches the two panes (or a renamed one is offered under
//     its old name)
//   · something loading before it is asked to — two of the heaviest pages in
//     this repo, fetched just by opening the app
//   · the second part replacing the first, which is the whole point of the
//     feature and is exactly what a single-frame version does
//   · the same part loaded into both panes, which is a phone's memory spent on
//     nothing when a swap says the same thing
//   · the choice of parts not surviving a close, or the panes being emptied by
//     anything other than signing out — closing them is meant to put him back
//     where he was, not to start again
//   · a part's own "back to the app" drawing the shell inside its own pane
//   · the panes being reachable signed out (they sit inside the doors' own
//     section, which is hidden until the server says who he is)
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const HUB = fs.readFileSync(path.join(ROOT, 'hub.html'), 'utf8');

// The page's own table, read out of the page. It is object-literal syntax
// (unquoted keys), so it is eval'd rather than parsed.
function arrayAt(src, marker) {
  const at = src.indexOf(marker);
  assert.ok(at >= 0, `${marker} not found`);
  const open = src.indexOf('[', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (!depth) return src.slice(open, i + 1); }
  }
  throw new Error(`unbalanced ${marker}`);
}
const PARTS = eval('(' + arrayAt(HUB, 'var PARTS = [') + ')');

const DOORS = [...HUB.matchAll(/<a class="card [a-z]" href="([^"]+)"/g)].map((m) => m[1]);
const DOOR_NAMES = [...HUB.matchAll(/<h2 class="name">([^<]+)<\/h2>/g)].map((m) => m[1]);

/* ------------------------------------------------------------- the two panes
   The shell's own block, run in a stand-in the way a browser runs it. The
   selects are driven the way a thumb drives them (a change event with a value)
   and the frames are read back through their own attributes, so what is checked
   is what the page does rather than what its markup says. */
const SPLIT_BLOCK = (() => {
  const block = [...HUB.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .map((m) => m[2]).filter((b) => b.includes('var PARTS = ['));
  assert.equal(block.length, 1, 'the shell must carry exactly one two-at-once block');
  return block[0];
})();

const IDS = [
  'split', 'panes', 'splitOpen', 'splitWho', 'splitDoors',
  'pick0', 'pick1', 'frame0', 'frame1', 'tall0', 'tall1', 'note0', 'note1',
];

// Does the page ship this element with the hidden attribute? The stand-in has to
// start where the browser starts, or "the panes begin closed" is checked against
// the stand-in's own defaults instead of the page's markup - which is how a
// screen shipped wide open would pass this file.
function shippedHidden(id) {
  const at = HUB.indexOf(`id="${id}"`);
  if (at < 0) return false;
  const tagEnd = HUB.indexOf('>', at);
  return /\shidden(\s|\/|>)/.test(HUB.slice(at, tagEnd + 1));
}

function el(id) {
  const e = {
    id, hidden: shippedHidden(id), textContent: '', innerHTML: '', value: '', title: '',
    attrs: {}, listeners: {},
    addEventListener(t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
    fire(t, ev) { (e.listeners[t] || []).forEach((fn) => fn(ev || {})); },
    setAttribute(k, v) { e.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(e.attrs, k) ? e.attrs[k] : null; },
    removeAttribute(k) { delete e.attrs[k]; },
  };
  return e;
}

function spot() {
  const m = new Map();
  return {
    map: m,
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(k, String(v)); },
  };
}

// One run of the page's block: fresh elements, a phone's storage, and the
// shell's own voice stubbed so that "the shell stops talking" can be seen.
function load(storage) {
  const els = {};
  IDS.forEach((id) => { els[id] = el(id); });
  ['frame0', 'frame1'].forEach((id) => {
    els[id].contentWindow = { location: { pathname: '/' + id } };
  });
  const said = [];
  const sandbox = {
    document: { getElementById: (id) => els[id] || null },
    console, JSON, String, Object, Error, Array, Boolean, Number,
    localStorage: storage || spot(),
    navigator: { onLine: true },
    addEventListener() {},
  };
  sandbox.SAY = { stop() { said.push('stop'); } };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SPLIT_BLOCK, sandbox, { filename: 'hub.html' });
  return { sandbox, els, said, storage: sandbox.localStorage };
}

const src = (els, i) => els['frame' + i].getAttribute('src');
// The block runs in its own realm, so an array it hands back has that realm's
// Array behind it; Array.from here makes it one this file can compare.
const chosen = (p) => Array.from(p.sandbox.SPLIT.chosen());

test('the panes are filled from a table that matches the doors, exactly', () => {
  assert.equal(DOORS.length, 5, 'the shell has five doors');
  assert.deepStrictEqual(PARTS.map((p) => p.href), DOORS,
    'every door must be offered in the panes, in the order the doors are in');
  assert.deepStrictEqual(PARTS.map((p) => p.name), DOOR_NAMES,
    'and under the name the door gives it');
  // Two panes need two parts; a shell with one door would have nothing to put
  // in the second.
  assert.ok(PARTS.length >= 2, 'two panes need at least two parts');
  assert.equal(new Set(PARTS.map((p) => p.key)).size, PARTS.length, 'the keys are distinct');
});

test('the panes sit inside the doors, and the doors still open one part on their own', () => {
  const openAt = HUB.indexOf('<section id="open"');
  const splitAt = HUB.indexOf('<section id="split"');
  const footAt = HUB.indexOf('<footer id="foot"');
  assert.ok(openAt > -1 && splitAt > openAt, 'the panes are inside the doors\' own section');
  assert.ok(splitAt < footAt, 'and inside the page');
  // The section holding the doors is the one the shell only shows once the
  // server has said who he is, so the panes cannot be reached signed out.
  assert.equal((HUB.match(/id="open"/g) || []).length, 1);

  const doors = HUB.slice(openAt, HUB.indexOf('id="split"'));
  assert.ok(!/target=/.test(doors), 'a door still opens its part in this window');
  for (const id of IDS) {
    assert.ok(HUB.includes(`id="${id}"`), `the page must carry ${id} - the block reaches for it`);
  }
  assert.equal((HUB.match(/id="frame\d"/g) || []).length, 2, 'two frames, two parts');
});

test('nothing loads until he asks for it, and asking loads both parts at once', () => {
  const p = load();
  assert.equal(p.els.split.hidden, true, 'the panes start closed');
  for (const pick of ['pick0', 'pick1']) {
    assert.match(p.els[pick].innerHTML, /<option value="certify">The Certification<\/option>/,
      'each pane is offered every part');
  }
  assert.equal(src(p.els, 0), null, 'opening the app loads no part at all');
  assert.equal(src(p.els, 1), null);

  p.sandbox.SPLIT.open();
  assert.equal(p.els.split.hidden, false, 'the panes come up');
  assert.deepStrictEqual([src(p.els, 0), src(p.els, 1)], ['/key', '/herbs'],
    'two parts, one above the other, on a phone that has never used this');
  assert.deepStrictEqual(p.said, ['stop'],
    'the shell stops reading itself out - the part carries its own voice');

  // The one that is loaded first is not replaced by the second.
  p.els.pick1.value = 'music';
  p.els.pick1.fire('change');
  assert.equal(src(p.els, 1), '/music', 'the second pane changes part');
  assert.equal(src(p.els, 0), '/key', 'and the first one is still there');
  assert.deepStrictEqual(chosen(p), ['key', 'music']);
});

test('picking the part that is already in the other pane swaps them', () => {
  const p = load();
  p.sandbox.SPLIT.open();
  p.els.pick1.value = 'key';
  p.els.pick1.fire('change');

  assert.deepStrictEqual(chosen(p), ['herbs', 'key'], 'the two swap');
  assert.deepStrictEqual([src(p.els, 0), src(p.els, 1)], ['/herbs', '/key'],
    'and no page is loaded twice');
  assert.notEqual(src(p.els, 0), src(p.els, 1));
});

test('tall gives one pane the screen and leaves the other one where it was', () => {
  const p = load();
  p.sandbox.SPLIT.open();
  p.els.pick1.value = 'trainer';
  p.els.pick1.fire('change');

  p.els.tall1.fire('click');
  assert.equal(p.els.panes.getAttribute('data-tall'), '1');
  assert.equal(p.els.tall1.textContent, 'Both the same', 'the tall pane offers the way back');
  assert.equal(p.els.tall0.textContent, 'Tall');
  // Both frames are still loaded: a pane behind its bar keeps its place rather
  // than being reloaded when it comes back.
  assert.equal(src(p.els, 0), '/key');
  assert.equal(src(p.els, 1), '/trainer');

  p.els.tall1.fire('click');
  assert.equal(p.els.panes.getAttribute('data-tall'), null, 'and back to an even split');
  assert.equal(p.els.tall1.textContent, 'Tall');
});

test('the choice is kept, so the app opens on the two parts he was using', () => {
  const storage = spot();
  const first = load(storage);
  first.sandbox.SPLIT.open();
  first.els.pick1.value = 'certify';
  first.els.pick1.fire('change');

  // Closing the panes does not empty them: asking for them again puts him back
  // where he was rather than making the phone fetch the pages a second time.
  first.sandbox.SPLIT.close();
  assert.deepStrictEqual([src(first.els, 0), src(first.els, 1)], ['/key', '/certify'],
    'both parts are still loaded behind the doors');
  first.sandbox.SPLIT.open();
  assert.deepStrictEqual([src(first.els, 0), src(first.els, 1)], ['/key', '/certify'],
    'and are not loaded twice');

  const kept = JSON.parse(storage.getItem('tsid-split'));
  assert.deepStrictEqual(kept, { on: true, parts: ['key', 'certify'] },
    'what is kept is the two parts, and whether the panes were up');

  // The app, opened again on the same phone, lands on both of them.
  const second = load(storage);
  assert.equal(second.els.split.hidden, false, 'it opens on the panes, where he left it');
  assert.deepStrictEqual([src(second.els, 0), src(second.els, 1)], ['/key', '/certify'],
    'on the same two parts');

  // Left on the doors instead, the same two are still the choice, and nothing at
  // all loads until he asks for them.
  second.sandbox.SPLIT.close();
  const third = load(storage);
  assert.equal(third.els.split.hidden, true, 'closed, because that is how it was left');
  assert.match(third.els.splitWho.textContent, /Last time: The Zodiacs and The Certification\./,
    'the doors say what the button will bring back');
  assert.equal(src(third.els, 0), null, 'and nothing loads behind his back');
  assert.equal(src(third.els, 1), null);
});

test('signing out is the one thing that empties the panes', () => {
  const p = load();
  p.sandbox.SPLIT.open();
  p.sandbox.SPLIT.unload();
  assert.equal(p.els.split.hidden, true);
  assert.equal(src(p.els, 0), 'about:blank', 'nothing private is left loaded');
  assert.equal(src(p.els, 1), 'about:blank');
  assert.equal(p.els.frame0.getAttribute('data-src'), null, 'and nothing is remembered as loaded');

  p.sandbox.SPLIT.open();
  assert.deepStrictEqual([src(p.els, 0), src(p.els, 1)], ['/key', '/herbs'],
    'opening them again loads them again');
  assert.deepStrictEqual(JSON.parse(p.storage.getItem('tsid-split')).parts, ['key', 'herbs'],
    'and the choice survives signing out');
  assert.equal(p.els.note0.hidden, true, 'and a phone with signal is left unworried');
});

test("a part's own back link is read as the doors, not as a shell inside a pane", () => {
  const p = load();
  p.sandbox.SPLIT.open();

  assert.equal(p.sandbox.SPLIT.isShell('/app'), true);
  assert.equal(p.sandbox.SPLIT.isShell('/'), true, 'the server sends / to the app');
  assert.equal(p.sandbox.SPLIT.isShell('/herbs'), false);

  p.els.frame0.contentWindow.location.pathname = '/herbs';
  p.els.frame0.fire('load');
  assert.equal(p.els.split.hidden, false, 'a part moving about inside its pane is left alone');

  p.els.frame1.contentWindow.location.pathname = '/app';
  p.els.frame1.fire('load');
  assert.equal(p.els.split.hidden, true, 'the way back leads to the doors');
  assert.equal(src(p.els, 0), '/key', 'and the other part is not reloaded on the way out');
  assert.equal(src(p.els, 1), 'about:blank',
    'the pane that is holding the shell lets it go rather than keeping it');

  p.sandbox.SPLIT.open();
  assert.deepStrictEqual([src(p.els, 0), src(p.els, 1)], ['/key', '/herbs'],
    'so opening the panes again shows the two parts, never the shell inside one');
});

test('with no signal a pane says so instead of a browser error page', () => {
  const p = load();
  p.sandbox.SPLIT.open();
  assert.equal(p.els.note0.hidden, true, 'a phone with signal is not worried');

  p.sandbox.navigator.onLine = false;
  p.sandbox.SPLIT.open();
  assert.equal(p.els.note0.hidden, false, 'and one without is told why it is blank');
  assert.equal(p.els.note1.hidden, false);
  // The words themselves are the page's, so they are read off the page rather
  // than out of the stand-in.
  assert.match(HUB.slice(HUB.indexOf('id="note0"')), /needs a signal/);
});
