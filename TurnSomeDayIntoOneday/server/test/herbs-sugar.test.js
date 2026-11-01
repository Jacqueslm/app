// Dr. Llaila O. Afrika's "Diabetes - Sugar Demon" (Gaia's Raw Ascension,
// youtube.com/watch?v=HWY7vp5lIZE), added to the herb library on 1 Nov 2026.
// Jacques: "Anaylze and correlate into the app dont leave anything out".
//
// The recording carries no captions this machine could read, so the shelf is
// organized from the ground the lecture stands on - the two Afrika books the
// library is built from and the course days that already teach sugar - and the
// page says so in its own warnbox. What this test holds is what could go wrong
// quietly:
//
//   1. the notes existing but never rendering, or rendering without the
//      attribution that keeps them a summary rather than a quotation;
//   2. the notes losing the page's own line, which is the part that keeps a
//      lecture about a demon from becoming a reason to stop insulin;
//   3. the correlation going stale - the notes name specific days, tabs and
//      cards, and those names have to still be on the page;
//   4. the shelf being wired to the wrong id prefix, which would open a card
//      from another lecture.
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

function loadPage(file, seeded) {
  const mem = seeded || {};
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
    localStorage: {
      getItem(k) { return k in mem ? mem[k] : null },
      setItem(k, v) { mem[k] = String(v) },
      removeItem(k) { delete mem[k] },
    },
    fetch: async () => ({ status: 200, ok: true, json: async () => ({ content: [] }) }),
    scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: 'node' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(inlineScript(file), sandbox, { filename: file });
  return { sandbox, els, store: mem };
}

test('the sugar shelf: eight notes, every one with a title and its paragraphs', () => {
  const p = loadPage('herbs.html');
  const notes = p.sandbox.DIABETES_NOTES;
  assert.ok(Array.isArray(notes), 'DIABETES_NOTES is on the page');
  assert.strictEqual(notes.length, 8, 'eight notes');
  for (const [i, n] of notes.entries()) {
    assert.ok(n.t && n.t.length > 10, `note ${i + 1} has a title`);
    assert.ok(Array.isArray(n.notes) && n.notes.length >= 3, `note ${i + 1} carries its paragraphs`);
    for (const para of n.notes) assert.ok(para.length > 80, `note ${i + 1} paragraph is a paragraph`);
  }
});

test('the sugar shelf: it renders on the ninety days tab, with its attribution', () => {
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'course';
  p.sandbox.render();
  const html = p.els.get('view').innerHTML;
  assert.match(html, /Lecture summary · Diabetes: Sugar Demon/);
  assert.match(html, /Your lecture summary/);
  assert.match(html, /no captions this page could read/, 'the page says it is not a transcript');
  assert.match(html, /not from a transcript/);
  assert.match(html, /data-h="sugar-note-1"/);
  assert.match(html, /data-h="sugar-note-8"/);
  assert.ok(!/data-h="sugar-note-9"/.test(html), 'no ninth card');
  assert.match(p.sandbox.SAY_TEXT['sugar-note-1'], /Lecture summary lesson 1/);
  assert.match(p.sandbox.SAY_TEXT['sugar-note-8'], /Where it lands in this app/);
});

test('the sugar shelf: the page\'s own line sits over it, and it is the line that matters', () => {
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'course';
  p.sandbox.render();
  const html = p.els.get('view').innerHTML;
  assert.match(html, /no herb here replaces insulin/);
  assert.match(html, /a low blood sugar is an emergency/);
  assert.match(html, /sugar in the urine is a doctor today/);

  const data = JSON.stringify(p.sandbox.DIABETES_NOTES);
  assert.match(data, /Type one diabetes is not a food question/);
  assert.match(data, /Insulin is not optional/);
  assert.match(data, /nothing here is ever a reason to stop or reduce it/);
  assert.match(data, /nobody on diabetes medicine fasts without whoever manages that medicine/);
  assert.match(data, /raised with a doctor before use/);
  // The promise is printed as his, and the shelf never claims the cure itself.
  assert.match(data, /printed here as the promise it is/);
  assert.ok(!/this page cures diabetes/i.test(data), 'the page never claims the cure in its own voice');
});

test('the sugar shelf: the lecture\'s own arguments are all present', () => {
  const p = loadPage('herbs.html');
  const data = JSON.stringify(p.sandbox.DIABETES_NOTES);
  assert.match(data, /named as a demon/);
  assert.match(data, /it is called a drug/);
  assert.match(data, /contractive/);
  assert.match(data, /destructive depressive immune retardants/);
  assert.match(data, /overstimulates the liver and the pancreas/);
  assert.match(data, /oversecretion of insulin/);
  assert.match(data, /sugar diabetes/);
  assert.match(data, /hypoglycemia, with fatigue/);
  assert.match(data, /yeast causes desires for sugar/);
  assert.match(data, /gymnema sylvestre, starred as the most effective/);
  assert.match(data, /vanadium as vanadyl sulfate/);
  assert.match(data, /chromium/);
  assert.match(data, /pau d'arco/);
  assert.match(data, /berberine/);
  assert.match(data, /tacrolimus, cyclosporine and the sulfonylureas/);
  assert.match(data, /aspartame/);
  assert.match(data, /[Nn]o white sugar, no white flour, no white salt/);
  assert.match(data, /food combining/);
  assert.match(data, /the morning is the cleansing phase/);
});

test('the sugar shelf: its correlation lines still name things that exist', () => {
  const p = loadPage('herbs.html');
  const notes = p.sandbox.DIABETES_NOTES;
  const map = notes.filter((n) => /Where it lands in this app/.test(n.t))[0];
  const text = map.notes.join(' ');
  for (const day of ['day 30', 'day 32', 'day 33', 'day 34', 'day 36', 'day 38', 'day 44']) {
    assert.ok(text.includes(day), `the map names ${day}`);
    assert.ok(p.sandbox.COURSE.some((d) => d.d === Number(day.split(' ')[1])), `${day} is on the course`);
  }
  assert.match(text, /Mucus scale/);
  assert.match(text, /21 days/);
  assert.match(text, /Dr\. Sebi/);
  assert.match(text, /Certification/);

  const html = fs.readFileSync(path.join(ROOT, 'herbs.html'), 'utf8');
  assert.match(html, /Sugar, and the lecture that names it/, 'the Dr. Sebi tab points at it');
  assert.match(html, /data-t="m21">21 days/, 'the 21 days tab is still there');
});

test('the sugar shelf: the Certification points back at it from its own sugar days', () => {
  const certify = fs.readFileSync(path.join(ROOT, 'certify.html'), 'utf8');
  assert.match(certify, /lecture summary of Dr\. Afrika's <i>Diabetes: Sugar Demon<\/i>/);
  assert.match(certify, /The library's lecture shelf for <i>Diabetes: Sugar Demon<\/i>/);
});
