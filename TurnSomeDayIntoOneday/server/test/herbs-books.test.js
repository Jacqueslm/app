// The herb library's From the books tab, and the entries that came with it.
//
// On 24 Sep 2026 two Llaila O. Afrika books — African Holistic Health (the copy
// in the repo is Bookey's summary of it) and the Nutricide scan — were read and
// folded into /herbs. What was asked for, in his words: "put them in the herb
// part dont cre about medical claims organize the herb part more make it more
// sufficient and more detailed".
//
// What this checks is not the prose. It is the three places the change could
// quietly go wrong:
//
//   1. a herb pointed at a shelf that does not exist, which drops it off the
//      By need tab silently — the failure mode of a hand-typed list;
//   2. the book's own measurements losing the fact that they are the book's,
//      which is the one thing that makes printing them honest;
//   3. the tab not rendering at all, which is what a SyntaxError in a page like
//      this looks like from the outside.
//
// The page is run for real in a stub DOM, the same way ask-box.test.js runs it.
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

function loadPage(file) {
  const els = new Map();
  const mk = (id) => ({
    id, value: '', textContent: '', innerHTML: '', disabled: false,
    className: '', style: {}, dataset: {},
    classList: { _s: new Set(), add(c) { this._s.add(c) }, remove(c) { this._s.delete(c) }, toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c) } else if (f) { this._s.add(c) } else { this._s.delete(c) } }, contains(c) { return this._s.has(c) } },
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
  const sandbox = {
    document: doc, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set, Intl,
    localStorage: { getItem() { return null }, setItem() {}, removeItem() {} },
    fetch: async () => ({ status: 200, ok: true, json: async () => ({ content: [] }) }),
    scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: 'node' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(inlineScript(file), sandbox, { filename: file });
  return { sandbox, els };
}

// The 24 Sep run added eighteen herbs that were in the books and not in the
// library. By name, so a later edit cannot quietly drop one.
const ADDED = [
  'Allspice', 'Chervil', 'Dill', 'Marjoram', 'Paprika', 'Savory', 'Vanilla',
  'Wheatgrass', 'Grape seed', 'Pine bark', 'Chaparral', 'Buchu', 'Wild violet',
  'Spikenard root', 'Blue cohosh', 'Black haw', 'Centaury', 'Gymnema',
];

test('the herb library: the eighteen herbs the books named are in it, each with the book line', () => {
  const p = loadPage('herbs.html');
  const list = p.sandbox.allHerbs();
  assert.ok(list.length > 260, `the library grew: ${list.length}`);
  for (const name of ADDED) {
    const h = list.filter((x) => x.n === name)[0];
    assert.ok(h, `${name} is in the library`);
    assert.ok(h.u, `${name} says what people use it for`);
    assert.ok(h.c, `${name} carries its caution, not just its uses`);
    assert.ok(h.bk, `${name} carries the book's own line about it`);
  }
});

test('the herb library: no herb points at a shelf that does not exist', () => {
  // A hand-typed t:[...] is where a herb goes missing without a message. Every
  // key has to be one the By need tab knows, or the herb is on no shelf at all.
  const p = loadPage('herbs.html');
  const keys = new Set(p.sandbox.NEEDS.map((n) => n.k));
  const orphans = [];
  for (const h of p.sandbox.allHerbs()) {
    for (const t of h.t || []) if (!keys.has(t)) orphans.push(`${h.n} -> ${t}`);
  }
  assert.deepEqual(orphans, [], 'every shelf key on every herb is a real shelf');
  // And the three shelves the books brought with them.
  for (const k of ['blood', 'immune', 'seasoning']) assert.ok(keys.has(k), `the ${k} shelf exists`);
});

test('the herb library: every shelf has something on it', () => {
  const p = loadPage('herbs.html');
  const list = p.sandbox.allHerbs();
  for (const nd of p.sandbox.NEEDS) {
    const n = list.filter((h) => (h.t || []).indexOf(nd.k) > -1).length;
    assert.ok(n > 0, `the shelf "${nd.t}" is not empty`);
  }
});

test('the herb library: the From the books tab renders, and holds the book material', () => {
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'books';
  p.sandbox.render();
  const html = p.els.get('view').innerHTML;
  assert.ok(p.sandbox.BOOKS.length >= 14, `the tab has its sections: ${p.sandbox.BOOKS.length}`);
  // The parts of the two books that were asked for, each found by a line only
  // that part carries.
  const must = [
    [/one eighth to one quarter of a teaspoon/, 'the seasoning amounts (Nutricide p339)'],
    [/simmer the roots, barks and seeds at least 30 minutes/i, 'the multi-vitamin method'],
    [/Blood cleansers/, 'the blood cleansers shelf'],
    [/Immune system builders/, 'the immune builders shelf'],
    [/Alternatives/, 'the classifications'],
    [/Vulnerary/, 'the last of the twenty classes'],
    [/Doctrine of signatures/i, 'the doctrine of signatures'],
    [/homeopathy, not the plants on this page/, 'the line that says half the remedy table is homeopathy'],
    [/Gymnema sylvestre and bilberry/, 'the book on diabetes'],
    [/Where the copy stops/, 'where the copy of the book runs out'],
  ];
  for (const [re, what] of must) {
    assert.match(html, re, `the tab carries ${what}`);
    assert.match(JSON.stringify(p.sandbox.BOOKS), re, `and it is in the data, not only the render`);
  }
  assert.match(html, /data-h="bk0"/, 'a section opens and shuts like a herb does');
});

test('the herb library: the book figures stay labelled as the book\u2019s, and the poisons still say so', () => {
  const p = loadPage('herbs.html');
  const html = fs.readFileSync(path.join(ROOT, 'herbs.html'), 'utf8');
  // The immune list prints the book's 25,000 to 60,000 mg of vitamin C, and the
  // seasoning amounts are the book's too. Claims were asked for on 24 Sep 2026
  // and they are made — but a figure has to keep saying whose figure it is, or
  // the page is putting the book's numbers in its own mouth.
  assert.match(html, /Every measurement in this tab is the book's own/, 'the tab says whose figures these are');
  assert.match(html, /printed as the book gives them as claims/, 'and takes them as the claims they are');
  // The dangerous ones still carry it. Dropping the refusals must not drop the
  // reason the refusals were there.
  const list = p.sandbox.allHerbs();
  for (const [name, re] of [
    ['Blue cohosh', /harmed babies/],
    ['Lobelia', /has killed people/],
    ['Pennyroyal', /liver poison and has killed people/],
    ['Chaparral', /tied to real liver damage/],
    ['Comfrey', /Never take comfrey internally/],
  ]) {
    const h = list.filter((x) => x.n === name)[0];
    assert.ok(h, `${name} is in the library`);
    assert.match(h.c, re, `${name} keeps the fact that has to travel with it`);
  }
});

test('the herb library: the page makes its claims, and no longer refuses to', async () => {
  // 24 Sep 2026, after the first pass: "put medical claims in and whatever you
  // left off". These are the sentences that used to stand in front of a claim,
  // each of them in the page's own voice. If one comes back, so has the hedge.
  const html = fs.readFileSync(path.join(ROOT, 'herbs.html'), 'utf8');
  const REFUSALS = [
    /this page will not hand you/i,
    /page will not hand over/i,
    /Its place here is history, not a recommendation/,
    /this page will not send you to a root/i,
    /It is not recommended/,
    /Do not make this at home/,
    /Do not make tea from it/,
    /not as advice/,
    /not a plan written for anybody here/,
    /does not say a plant is safe/,
    /this page is not repeating them/,
    /not as anything to go and take/,
  ];
  for (const re of REFUSALS) assert.doesNotMatch(html, re, `the page no longer says ${re}`);
  // And the claims are in the page's own voice, on the page's own furniture.
  assert.match(html, /<div class="lbl">What it does<\/div>/, 'the herb card asks what it does, not what it was ever used for');
  assert.match(html, /The claims are made here/, 'and the safety tab says so plainly');
  assert.match(html, /these are the books' claims and they are made here/, 'and the ask box is told to make them too');
});

test('the herb library: what was left off is in — the chart, the remedies, the food, the history', () => {
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'books';
  p.sandbox.render();
  const html = p.els.get('view').innerHTML;
  const titles = p.sandbox.BOOKS.map((b) => b.h);
  for (const want of [
    'What the book treats, and with what it treats it',
    "Easy remedies, the book's own",
    'Food: what the book says about eating',
    'Food as medicine',
    'Reading the body before treating it',
    'Colours, organs and the clock',
    'The history the book tells',
    "The book's own lines",
  ]) {
    assert.ok(titles.indexOf(want) > -1, `the tab has a section: ${want}`);
    assert.match(html, new RegExp(want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'and it renders');
  }
  // The beef row was the one line of the book's seasoning list that was left
  // out on the first pass. It is back.
  assert.match(JSON.stringify(p.sandbox.BOOKS), /\["Beef","Bay leaf/, 'the beef row is back in the seasoning list');
  // And the four herbs the easy-remedies chapter named.
  const list = p.sandbox.allHerbs();
  for (const n of ['Castor', 'Henna', 'Tormentil', 'Stone seed']) {
    assert.ok(list.filter((h) => h.n === n).length, `${n} is in the library`);
  }
  // Stone seed is the one entry where a claim has to be argued with, because
  // the book's own use of it is contraception. The old practice is printed and
  // it is not left standing as a method.
  const stone = list.filter((h) => h.n === 'Stone seed')[0];
  assert.match(stone.c, /not a reliable contraceptive/, 'the old practice is not sold as a method');
});

test('the herb library: searching finds a herb by the book words too', () => {
  const p = loadPage('herbs.html');
  // A word that appears only in a book line has to hit, or the material that
  // was just added is not reachable from the search box.
  p.sandbox.q = 'gurmar';
  p.sandbox.tab = 'az';
  p.sandbox.render();
  assert.match(p.els.get('view').innerHTML, /Gymnema/, 'a herb is found by its other name in the book line');
});

test('the app no longer prints a herb count it cannot keep true', () => {
  // It said 244. The library now holds more than that, and the count is the one
  // thing on that row that goes stale by itself.
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.doesNotMatch(index, /\b\d+ herbs\b/, 'no number of herbs is printed anywhere in index.html');
  assert.match(index, /location\.href='\/herbs'/, 'and the library is still a door in the app');
  assert.match(index, /Herbs, seasonings and cleansers/, 'the row says what is behind it instead');
});
