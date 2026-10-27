// The read-aloud, on every page in the app.
//
// Jacques, 15 Oct 2026: "the read it to me doesn't work here audit every part of
// the app to make sure read it works the whole app where it is required which
// should be the whole app not just specific sections."
//
// He was right about "here": the voice was on four pages - The Key, the Herb
// Library, the Certification and the Trainer - and on the rest of them there was
// nothing to press at all, so half of the app could not be listened to. Every
// page is accounted for in this file now. A page that shows words carries a
// voice, or it is named below with the reason it does not, and a page that is
// neither fails here. That is the point: the gaps were silent, and silence is
// what a test can end.
//
// The four pages that had their own voice keep it - each reads a data object,
// not the screen, and each was written for what it reads. The seven added on
// 15 Oct 2026 share one reader: the words on the screen, in the order they are
// drawn, and never a control. That reader is run here against a small stand-in
// for a page, so what it says is checked rather than assumed - including the
// two shapes that caught it out when it was first written, a list of steps and
// a sentence with a link in the middle of it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

// The pages with no voice, and why. A screen that is only figures, on an address
// the world cannot reach, is not something anybody listens to; everything else
// is. A page added later with no voice fails this file until somebody decides
// which side of this line it belongs on.
const VOICELESS = {
  'admin-stats.html':
    'a table of figures on the owner-only screen at /admin/stats, where reading numbers out '
    + 'loud is noise and /admin-stats.html itself answers 404',
};

// The pages that had the voice from the start, and the control each one uses.
const OWN_VOICE = {
  'key.html': ['data-act="speak"', 'data-act="stop"'],
  'herbs.html': ['data-say', 'data-saystop'],
  'certify.html': ['sayBtn', 'screenSayStop'],
  'trainer.html': ['id="sayBtn"', 'id="sayStop"'],
};

// The pages that got the shared reader.
const SHARED = [
  'hub.html', 'letter.html', 'privacy.html', 'delete-account.html',
  'reset.html', 'tax.html', 'music.html',
  // The Body (21 Oct 2026) shares the same reader: it is a long page of words,
  // and it had no reason to grow a voice of its own when the whole app already
  // had one that reads the screen in order. The Book of Spells, which arrived
  // with it, came off the app on 27 Oct 2026.
  'body.html',
];

// The page long enough that the phone will not say it in one go. The Body is
// 45,000 characters; Android's own voice takes an utterance that long and says
// nothing at all, which is exactly what a dead button looks like. Its reader cuts
// the page at its punctuation and queues the pieces, so it is held to that here.
// The Book of Spells was here beside it until it came off the app on 27 Oct 2026.
const CHUNKED = ['body.html'];

// What the reader should say about the stand-in page below: the words on the
// screen, in the order they are drawn. The heading and its line, the card, the
// steps of a list, the sentence with links in it, and the paragraph written
// across a blank line. Not the buttons, not the closed tab row, not the box of
// controls, not the panel that is hidden, not the words behind .hide, and not
// its own button.
const EXPECTED = 'The Music. Play the songs on this phone. Add your songs. '
  + 'Pick audio files from the phone, and they stay here. Open the app and sign in. '
  + 'Tap Profile in the bottom bar. Write to the office, or email the desk. '
  + 'Dear you, I have been thinking about it.';

// Words that must never be read back: a button's label, the closed tab row, the
// box of controls, the hidden panel and the words behind .hide.
const NEVER = ['Read it to me', 'Previous', 'Next', 'What is due', 'Hidden panel words', 'Behind hide'];

/* A stand-in for a page: elements with a class and children, text nodes, and the
   hidden attribute. It carries the shapes the reader has to get right - a block
   whose text sits on its buttons, a list whose steps are read one by one, a
   sentence with a link in the middle of it, and a paragraph written across a
   blank line. */
function el(tag, cls, parts, hidden) {
  const node = {
    tagName: tag,
    nodeType: 1,
    className: cls || '',
    hidden: !!hidden,
    children: [],
    childNodes: [],
    listeners: {},
    textContent: '',
    addEventListener(type, fn) { (node.listeners[type] = node.listeners[type] || []).push(fn); },
    click() { (node.listeners.click || []).forEach((fn) => fn({})); },
  };
  (parts || []).forEach((part) => {
    if (typeof part === 'string') node.childNodes.push({ nodeType: 3, nodeValue: part });
    else { node.children.push(part); node.childNodes.push(part); }
  });
  node.textContent = node.childNodes
    .map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join('');
  return node;
}

function standIn() {
  const btn = el('BUTTON', 'saybtn', ['Read it to me']);
  const stop = el('BUTTON', 'saybtn stop', ['Stop'], true);
  const root = el('DIV', 'wrap', [
    el('HEADER', '', [el('H1', '', ['The Music']), el('P', 'sub', ['Play the songs on this phone.'])]),
    el('DIV', 'sayrow', [btn, stop]),
    el('DIV', 'tabs', [el('DIV', '', ['What is due'])]),
    el('DIV', 'controls', [el('BUTTON', 'round', ['Previous']), el('BUTTON', 'round', ['Next'])]),
    el('SECTION', 'card', [
      el('H2', '', ['Add your songs']),
      el('P', 'hint', ['Pick audio files from the phone, and they stay here.']),
    ]),
    el('OL', 'steps', [
      el('LI', '', ['Open the app and sign in.']),
      el('LI', '', ['Tap ', el('B', '', ['Profile']), ' in the bottom bar.']),
    ]),
    el('P', '', ['Write to ', el('A', '', ['the office']), ', or email ', el('A', '', ['the desk']), '.']),
    el('SECTION', 'panel', ['Hidden panel words'], true),
    el('DIV', 'hide', ['Behind hide']),
    el('P', '', ['Dear you,\n\nI have been thinking about it.']),
  ]);
  const doc = {
    querySelector: (sel) => (sel === '.wrap' || sel === 'main' ? root : null),
    getElementById: (id) => (id === 'sayBtn' ? btn : id === 'sayStop' ? stop : null),
    body: el('BODY'),
    hidden: false,
    addEventListener() {},
  };
  return { root, btn, stop, doc };
}

/* The one voice script a page carries, run in the stand-in. opts.noVoice leaves
   the phone without one, which is the case the button has to answer for. */
function loadVoice(page, opts) {
  const html = read(page);
  const blocks = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .map((m) => m[2]).filter((b) => b.includes('SpeechSynthesisUtterance'));
  assert.equal(blocks.length, 1, `${page}: exactly one voice script`);
  const said = [];
  const dom = standIn();
  let pending = null;
  const sandbox = { document: dom.doc, console, Math, JSON, String, Array, Object, RegExp, Error };
  if (!(opts && opts.noVoice)) {
    sandbox.speechSynthesis = {
      // A phone keeps the piece it was given until it has said it, then calls
      // onend - and the reader uses that to queue the next piece. The stand-in
      // holds it the same way, and finish() is the test saying "that one was
      // spoken", so the reading can be walked through piece by piece rather
      // than wished into existence.
      speak(u) { said.push(String(u.text)); pending = u; },
      cancel() { pending = null; },
    };
    sandbox.SpeechSynthesisUtterance = function (text) { this.text = text; };
  }
  // A phone that keeps its screen lit while it reads. opts.wake puts one under
  // the reader, so the lock it asks for, and the moment it lets go, can be
  // counted instead of taken on trust. Without it the page runs on a phone with
  // no wake-lock at all, which is the case it has to survive.
  const locks = { requests: 0, releases: 0 };
  if (opts && opts.wake) {
    sandbox.navigator = {
      wakeLock: {
        request() {
          locks.requests += 1;
          return Promise.resolve({ addEventListener() {}, release() { locks.releases += 1; } });
        },
      },
    };
    sandbox.setTimeout = setTimeout;
    sandbox.clearTimeout = clearTimeout;
    sandbox.Promise = Promise;
  }
  const finish = () => {
    const u = pending;
    pending = null;
    if (!u) return false;
    if (typeof u.onend === 'function') u.onend();
    return true;
  };
  // window.addEventListener, so the reader can unhook itself on the way out.
  sandbox.addEventListener = () => {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(blocks[0], sandbox, { filename: page });
  return { sandbox, said, finish, locks, ...dom };
}

test('every page in the app is accounted for: a voice, or a reason it has none', () => {
  for (const page of PAGES) {
    const voiced = read(page).includes('SpeechSynthesisUtterance');
    const named = Object.prototype.hasOwnProperty.call(VOICELESS, page);
    assert.ok(voiced || named,
      `${page} shows words and has no read-aloud, and no reason is given for that`);
    assert.ok(!(voiced && named),
      `${page} is named as voiceless but carries a voice - the list is out of date`);
  }
  for (const page of Object.keys(VOICELESS)) {
    assert.ok(PAGES.includes(page), `${page} is named here but is not a page any more`);
  }
  for (const page of [...Object.keys(OWN_VOICE), ...SHARED]) {
    assert.ok(PAGES.includes(page), `${page} is named here but is not a page any more`);
  }
  assert.deepStrictEqual(
    PAGES.filter((p) => !read(p).includes('SpeechSynthesisUtterance')), Object.keys(VOICELESS),
    'the pages without a voice are exactly the ones listed with a reason');
});

test('every page with a voice has a control that starts it and one that stops it', () => {
  for (const page of PAGES) {
    if (VOICELESS[page]) continue;
    const html = read(page);
    assert.match(html, /speechSynthesis/, `${page}: the voice is the phone's own`);
    assert.match(html, /SpeechSynthesisUtterance/, `${page}: and it is the browser that speaks`);
    assert.ok(/Read (it to me|this)/.test(html), `${page}: the control says what it does`);
    const [start, stop] = OWN_VOICE[page] || ['id="sayBtn"', 'id="sayStop"'];
    assert.ok(html.includes(start), `${page}: a control that starts the reading (${start})`);
    assert.ok(html.includes(stop), `${page}: and one that stops it (${stop})`);
  }
});

test('the shared reader reads the screen, in order, and never a control', () => {
  for (const page of SHARED) {
    const { sandbox, said, finish, btn, stop } = loadVoice(page);
    assert.ok(sandbox.SAY, `${page}: the reader is on the page`);
    assert.equal(sandbox.SAY.text(), EXPECTED, `${page}: the words on the screen, in order`);
    for (const never of NEVER) {
      assert.ok(!sandbox.SAY.text().includes(never), `${page}: "${never}" was read back`);
    }

    btn.click();
    // A tap speaks the first piece at once, and offers the way out while there is
    // still something being said.
    assert.equal(btn.textContent, 'Stop', `${page}: the button becomes Stop`);
    assert.equal(stop.hidden, false, `${page}: and a way out is offered`);
    assert.equal(said.length, 1, `${page}: one piece at a time, not the lot`);

    // Then the phone says each piece and the reader queues the next, until the
    // page is done and the reader puts itself away. The whole page is checked in
    // order, and on the long pages no piece is allowed to be so long that the
    // phone takes it and goes quiet - which is what a dead button looks like.
    let guard = 0;
    while (finish()) {
      assert.ok(++guard < 500, `${page}: the reading ends`);
    }
    assert.equal(said.join(' '), EXPECTED, `${page}: the whole page, in order`);
    if (CHUNKED.includes(page)) {
      assert.ok(said.length > 1, `${page}: in pieces the phone will say`);
      for (const piece of said) {
        assert.ok(piece.trim().length > 0, `${page}: no empty piece`);
        assert.ok(piece.length <= 200, `${page}: a piece short enough to be spoken (${piece.length})`);
      }
    } else {
      assert.deepStrictEqual(said, [EXPECTED], `${page}: the whole page, once`);
    }
    assert.equal(btn.textContent, 'Read it to me', `${page}: done, and ready again`);
    assert.equal(stop.hidden, true);

    // And stopping in the middle keeps the rest of the page unspoken.
    btn.click();
    assert.equal(btn.textContent, 'Stop');
    stop.click();
    const spoken = said.length;
    assert.ok(!finish(), `${page}: nothing left to say once stopped`);
    assert.equal(said.length, spoken, `${page}: and no piece follows it`);
    assert.equal(btn.textContent, 'Read it to me', `${page}: stopped, and ready again`);
    assert.equal(stop.hidden, true);
  }
});

test('a phone with no voice says so rather than leaving a dead button', () => {
  for (const page of SHARED) {
    const { btn } = loadVoice(page, { noVoice: true });
    btn.click();
    assert.match(btn.textContent, /no voice/, `${page}: it says so`);
  }
});

test('the reader is given a page it can really find, on every page it was added to', () => {
  // The reader starts at ROOT. If the selector is wrong it falls back to .wrap,
  // then to the body - and a reading of the body is a reading of the whole page,
  // including the parts it should not touch, so the selector is checked against
  // the markup rather than trusted.
  const FOUND = { '.wrap': /class="wrap"/, main: /<main[\s>]/ };
  for (const page of SHARED) {
    const html = read(page);
    const root = (html.match(/var ROOT = '([^']+)'/) || [])[1];
    assert.ok(root, `${page}: the reader says where the page begins`);
    assert.ok(FOUND[root], `${page}: "${root}" is not a root this file knows how to find`);
    assert.match(html, FOUND[root], `${page}: "${root}" is really in the page`);
    if (CHUNKED.includes(page)) {
      assert.match(html, /var list = chunks\(text\)/, `${page}: the page is cut up before it is spoken`);
    }
  }
});

test('the letter page has the button on the letter, not beside it', () => {
  // A letter arrives after the page does. The reading is offered inside the
  // block that holds it, so it is there when the letter is - and never on the
  // "opening..." line, which is not the letter.
  const html = read('letter.html');
  const content = html.indexOf('<div id="content"');
  const btn = html.indexOf('id="sayBtn"');
  assert.ok(content > -1 && btn > content, 'the button sits inside the letter block');
  assert.ok(/textContent = d\.body/.test(html), 'and the letter itself is what is spoken');
});

/* Jacques, 27 Oct 2026: "Fix all". The Certification's lessons were the first
   reading found cut off when the screen went black, and every other page that
   reads itself aloud had the same fault for the same reason: a phone that locks
   its screen suspends the voice. So every page with a voice has to ask for the
   screen to stay lit, hold it while it reads, and let go the moment it stops. */
test('a reading holds the screen awake, on every page that reads aloud', async () => {
  for (const page of PAGES) {
    if (VOICELESS[page]) continue;
    const html = read(page);
    assert.match(html, /navigator\.wakeLock/, `${page}: asks the phone to keep the screen lit`);
    assert.match(html, /wakeAcquire\(/, `${page}: when a reading starts`);
    assert.match(html, /wakeRelease\(/, `${page}: and lets go when it stops`);
  }

  // And on a page, not just in its text: the lock is asked for when the reading
  // starts, given back when it is stopped, and given back when the phone says
  // the last piece on its own.
  const { btn, stop, finish, locks } = loadVoice('hub.html', { wake: true });
  const settle = () => new Promise((r) => setTimeout(r, 5));
  btn.click();
  await settle();
  assert.equal(locks.requests, 1, 'a reading asks for the lock');
  assert.equal(locks.releases, 0, 'and holds it while it speaks');
  stop.click();
  assert.equal(locks.releases, 1, 'stopping gives it back');

  const released = locks.releases;
  btn.click();
  await settle();
  finish();
  await settle();
  assert.ok(locks.releases > released, 'a reading that ends on its own gives it back too');
});

test('a phone that cannot keep its screen lit still reads', () => {
  const { btn, sandbox } = loadVoice('hub.html');
  assert.equal(typeof sandbox.navigator, 'undefined', 'this phone has no wake-lock at all');
  btn.click();
  assert.equal(btn.textContent, 'Stop', 'the reading starts anyway');
  assert.doesNotThrow(() => btn.click(), 'and stopping it does not throw');
});

test('a page that is hidden is not read, on the two pages that hide a whole screen', () => {
  // reset.html shows one box and then the other, and hub.html shows the way in
  // or the doors. Both hide with the attribute, so the reading follows what is on
  // the screen instead of reading a screen that is not there.
  for (const page of ['reset.html', 'hub.html']) {
    const html = read(page);
    assert.ok(html.includes('hidden'), `${page}: the screens are hidden with the attribute`);
    assert.match(html, /\.hidden\s*=\s*(true|false)/, `${page}: and shown again by the script`);
    assert.ok(!/style\.display\s*=\s*'none'/.test(html),
      `${page}: nothing is hidden by a display rule the reading cannot see`);
  }
});
