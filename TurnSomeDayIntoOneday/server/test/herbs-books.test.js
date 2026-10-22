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

// 19 Oct 2026. Jacques: "research more herbs that are not in the app and
// correlate new findings where they need to be lessons certificate". Fourteen
// herbs the library did not carry were researched and added. Unlike the
// eighteen above, these are not in the three books: they are the page's own
// voice, so each one must carry a use, a how-it-is-taken line, a caution and a
// description, and must NOT carry a From the books line - a book line on one of
// these would be the page claiming the books said something they never said.
// By name, so a later edit cannot quietly drop one.
const RESEARCHED = [
  'Dulse', 'Bitter leaf', 'Baobab', 'Rooibos', 'Cleavers', 'Self-heal', 'Usnea',
  'Oak bark', 'Arjuna', 'Guduchi', 'Danshen', 'Notoginseng', 'Maitake', 'Sutherlandia',
];

test('the herb library: the fourteen researched herbs are in it, in the page\u2019s own voice', () => {
  const p = loadPage('herbs.html');
  const list = p.sandbox.allHerbs();
  const keys = new Set(p.sandbox.NEEDS.map((n) => n.k));
  for (const name of RESEARCHED) {
    const h = list.filter((x) => x.n === name)[0];
    assert.ok(h, `${name} is in the library`);
    assert.ok(h.a, `${name} carries the other names it goes by`);
    assert.ok(h.u, `${name} says what people use it for`);
    assert.ok(h.d, `${name} says what it does`);
    assert.ok(h.h, `${name} says how it is taken`);
    assert.ok(h.c, `${name} carries its caution, not just its uses`);
    assert.ok(!h.bk, `${name} carries no From the books line - it is not in the books`);
    for (const t of h.t || []) assert.ok(keys.has(t), `${name} is on a shelf that exists (${t})`);
  }
  // And the count follows them, so the shelf is read as grown rather than swapped.
  assert.ok(list.length >= 280, `the library grew again: ${list.length}`);
});

test('the herb library: the researched herbs keep the facts that have to travel with them', () => {
  const p = loadPage('herbs.html');
  const list = p.sandbox.allHerbs();
  const card = (n) => list.filter((x) => x.n === n)[0];
  // The four that are on the shelf for their caution as much as for their use.
  assert.match(card('Usnea').c, /do not take it inside the body/, 'usnea is not swallowed');
  assert.match(card('Usnea').c, /serious liver injury/, 'and says why');
  assert.match(card('Oak bark').c, /three or four days/, 'oak bark is a short course inside');
  assert.match(card('Oak bark').c, /leave an hour between/, 'and is spaced from other medicines');
  assert.match(card('Danshen').c, /increase the effect of warfarin badly/, 'danshen names the warfarin reports');
  assert.match(card('Danshen').c, /pregnancy and breastfeeding are a contraindication/i, 'and its pregnancy line');
  assert.match(card('Sutherlandia').c, /never replace antiretroviral therapy/, 'sutherlandia is not a treatment for HIV');
  assert.match(card('Sutherlandia').c, /improved neither the viral load nor the CD4 count/,
    'and keeps the trial result that is on its card');
  // The iodine one, which is the food on the thyroid ground.
  assert.match(card('Dulse').c, /1,500 to 7,500 micrograms/, 'dulse carries the reported iodine range');
  assert.match(card('Dulse').c, /low-iodine diet/, 'and the scan-list caution');
  // And the two that are food first.
  assert.match(card('Baobab').c, /food/i, 'baobab is a food card');
  assert.match(card('Rooibos').c, /tacrolimus/, 'rooibos names the transplant case report');

  // And the card is read on the shelf, not only in the data: open usnea the way
  // the page opens one and the caution has to be on the screen.
  const p2 = loadPage('herbs.html');
  p2.sandbox.tab = 'az';
  p2.sandbox.openId = p2.sandbox.allHerbs().filter((x) => x.n === 'Usnea')[0].id;
  p2.sandbox.render();
  const shown = p2.els.get('view').innerHTML;
  assert.match(shown, /id="p-usnea"/, 'the card has its own address');
  assert.match(shown, /do not take it inside the body/, 'and shows its caution when it is opened');
});

// 19 Oct 2026, same day, next ask: "Next step: Research more herbs". Twelve more
// herbs the library did not carry were researched and added, in the same voice
// and under the same rule: the page's own card, no From the books line, because
// none of them is in the three books. This batch was chosen where the evidence
// has an edge worth teaching, so the facts below are the ones a later edit must
// not sand off.
const RESEARCHED_2 = [
  'Ivy leaf', 'Primula root', 'Sweet wormwood', 'Nutmeg', 'Miswak', 'Bergamot',
  'Griffonia', 'Rye pollen', 'Tart cherry', 'Soy', 'White peony', 'Chrysanthemum',
];

test('the herb library: the twelve herbs of the second research batch are in it, in the page\u2019s own voice', () => {
  const p = loadPage('herbs.html');
  const list = p.sandbox.allHerbs();
  const keys = new Set(p.sandbox.NEEDS.map((n) => n.k));
  for (const name of RESEARCHED_2) {
    const h = list.filter((x) => x.n === name)[0];
    assert.ok(h, `${name} is in the library`);
    assert.ok(h.a, `${name} carries the other names it goes by`);
    assert.ok(h.u, `${name} says what people use it for`);
    assert.ok(h.d, `${name} says what it does`);
    assert.ok(h.h, `${name} says how it is taken`);
    assert.ok(h.c, `${name} carries its caution, not just its uses`);
    assert.ok(!h.bk, `${name} carries no From the books line - it is not in the books`);
    for (const t of h.t || []) assert.ok(keys.has(t), `${name} is on a shelf that exists (${t})`);
  }
  assert.ok(list.length >= 292, `the library grew again: ${list.length}`);
});

test('the herb library: the second research batch keeps the facts that have to travel with them', () => {
  const p = loadPage('herbs.html');
  const list = p.sandbox.allHerbs();
  const card = (n) => list.filter((x) => x.n === n)[0];
  // The regulator's age limit, and the combination that was tested instead of
  // the single herb.
  assert.match(card('Ivy leaf').c, /Not for a child under two/, 'ivy leaf keeps the age limit');
  assert.match(card('Ivy leaf').c, /aralia/, 'and the family allergy line');
  assert.match(card('Primula root').c, /no clinical studies of primula root on its own/,
    'primula says the root alone was not tested');
  assert.match(card('Primula root').c, /361 adults with acute bronchitis/, 'and keeps the combination trial');
  // The plant that must not stand in for a medicine.
  assert.match(card('Sweet wormwood').c, /World Health Organization/, 'sweet wormwood names WHO');
  assert.match(card('Sweet wormwood').c, /should not be used to prevent or treat malaria/,
    'and the position on Artemisia plant material');
  assert.match(card('Sweet wormwood').c, /combination therapy/, 'and what the treatment actually is');
  // The amounts that have poisoned people.
  assert.match(card('Nutmeg').c, /five grams/, 'nutmeg carries the reported illness amount');
  assert.match(card('Nutmeg').c, /fifteen to twenty grams/, 'and the psychogenic range');
  assert.match(card('Nutmeg').c, /no medicinal dose at all/, 'and gives no medicinal dose');
  // The mouth, where the stick is not a toothpaste.
  assert.match(card('Miswak').c, /fluoride/, 'miswak says it does not deliver fluoride');
  assert.match(card('Miswak').c, /nine small trials/, 'and keeps the trial count');
  // The citrus interaction and the serotonin line.
  assert.match(card('Bergamot').c, /grapefruit/, 'bergamot names the grapefruit-type interaction');
  assert.match(card('Bergamot').c, /statin/, 'and the statins it matters for');
  assert.match(card('Griffonia').c, /serotonin syndrome/, 'griffonia names serotonin syndrome');
  assert.match(card('Griffonia').c, /two trials of 64 people/, 'and the thin Cochrane evidence');
  // The trials that found no effect on the thing being sold.
  assert.match(card('Rye pollen').c, /444 men/, 'rye pollen keeps the review size');
  assert.match(card('Rye pollen').c, /no change in urine flow/, 'and what it did not change');
  assert.match(card('Tart cherry').c, /no significant effect on blood urate/, 'tart cherry keeps its gout result');
  // The women's shelf, food before supplement.
  assert.match(card('Soy').c, /62 studies and 6,653 women/, 'soy keeps the review size');
  assert.match(card('Soy').c, /tamoxifen/, 'and the tamoxifen question');
  assert.match(card('White peony').c, /has not adopted a monograph/, 'white peony says there is no monograph');
  // The eye flower, with its family and its red flag.
  assert.match(card('Chrysanthemum').c, /ragweed/, 'chrysanthemum names the daisy family');
  assert.match(card('Chrysanthemum').c, /change in sight/, 'and the red-eye red flag');

  // Read on the shelf, not only in the data: open nutmeg and its amount has to
  // be on the screen.
  const p2 = loadPage('herbs.html');
  p2.sandbox.tab = 'az';
  p2.sandbox.openId = p2.sandbox.allHerbs().filter((x) => x.n === 'Nutmeg')[0].id;
  p2.sandbox.render();
  const shown = p2.els.get('view').innerHTML;
  assert.match(shown, /id="p-nutmeg"/, 'the card has its own address');
  assert.match(shown, /fifteen to twenty grams/, 'and shows its amount when it is opened');
});

// 19 Oct 2026, third batch: "Next step: Research a third batch". Twelve more, in
// the same voice and under the same rule. This batch is the shelf's hard edge,
// so the facts pinned below are the regulator dates, the case numbers and the
// null results - the things a later edit might soften.
const RESEARCHED_3 = [
  'Ephedra', 'Aristolochia', 'Germander', 'Frangula bark', 'Chanca piedra',
  'Mastic', 'Birch leaf', 'Hoodia', 'Pippali', 'Haritaki', 'Vasaka',
  'African potato',
];

test('the herb library: the twelve herbs of the third research batch are in it, in the page\u2019s own voice', () => {
  const p = loadPage('herbs.html');
  const list = p.sandbox.allHerbs();
  const keys = new Set(p.sandbox.NEEDS.map((n) => n.k));
  for (const name of RESEARCHED_3) {
    const h = list.filter((x) => x.n === name)[0];
    assert.ok(h, `${name} is in the library`);
    assert.ok(h.a, `${name} carries the other names it goes by`);
    assert.ok(h.u, `${name} says what people use it for`);
    assert.ok(h.d, `${name} says what it does`);
    assert.ok(h.h, `${name} says how it is taken`);
    assert.ok(h.c, `${name} carries its caution, not just its uses`);
    assert.ok(!h.bk, `${name} carries no From the books line - it is not in the books`);
    for (const t of h.t || []) assert.ok(keys.has(t), `${name} is on a shelf that exists (${t})`);
  }
  assert.ok(list.length >= 304, `the library grew again: ${list.length}`);
});

test('the herb library: the third research batch keeps the facts that have to travel with them', () => {
  const p = loadPage('herbs.html');
  const list = p.sandbox.allHerbs();
  const card = (n) => list.filter((x) => x.n === n)[0];
  // The four on the shelf for what they did to people.
  assert.match(card('Ephedra').c, /11 February 2004/, 'ephedra keeps the FDA rule date');
  assert.match(card('Ephedra').c, /unreasonable risk/, 'and what the rule says');
  assert.match(card('Ephedra').c, /deaths have been reported/, 'and the deaths');
  assert.match(card('Aristolochia').c, /Group 1, carcinogenic to humans/, 'aristolochia keeps the IARC class');
  assert.match(card('Aristolochia').c, /Stephania tetrandra/, 'and the substitution');
  assert.match(card('Aristolochia').h, /no safe amount/, 'and that there is no safe amount');
  assert.match(card('Germander').c, /acute hepatitis/, 'germander names the liver injury');
  assert.match(card('Germander').c, /26 cases/, 'and the series');
  assert.match(card('Germander').c, /no agreed dose/, 'and that it has no dose');
  assert.match(card('Frangula bark').c, /over twelve/, 'frangula keeps the age limit');
  assert.match(card('Frangula bark').c, /no more than a week/, 'and the one-week limit');
  assert.match(card('Frangula bark').c, /10 to 30 milligrams/, 'and the monograph dose');
  // The regional herbs, with the trials that were actually done.
  assert.match(card('Chanca piedra').c, /two controlled human studies/, 'chanca piedra keeps the review size');
  assert.match(card('Chanca piedra').c, /emergency care/, 'and the stone red flags');
  assert.match(card('Mastic').c, /148 people/, 'mastic keeps the dyspepsia trial size');
  assert.match(card('Mastic').c, /77 per cent on mastic against 40 per cent/, 'and its result');
  assert.match(card('Mastic').c, /pistachio/, 'and the family allergy');
  assert.match(card('Birch leaf').c, /clinical evidence is insufficient/, 'birch leaf says the evidence is traditional');
  assert.match(card('Birch leaf').c, /15 people/, 'and keeps the small study it rests on');
  assert.match(card('Birch leaf').c, /birch pollen/, 'and the pollen allergy');
  assert.match(card('Hoodia').c, /49 overweight women/, 'hoodia keeps the trial size');
  assert.match(card('Hoodia').c, /no adequate trial/, 'and says there is no adequate trial');
  assert.match(card('Hoodia').c, /CITES Appendix II/, 'and the trade listing');
  // The four whose lesson is an interaction or a red flag.
  assert.match(card('Pippali').c, /carbamazepine/, 'pippali names the drug it changed');
  assert.match(card('Pippali').c, /69 per cent/, 'and the size of the change');
  assert.match(card('Pippali').c, /CYP3A4/, 'and the mechanism');
  assert.match(card('Haritaki').c, /1983 trial/, 'haritaki names the old trial');
  assert.match(card('Haritaki').c, /hold iron back/, 'and the tannin line');
  assert.match(card('Vasaka').c, /syrup's job/, 'vasaka says an attack is not a syrup\u2019s job');
  assert.match(card('Vasaka').c, /uterine/, 'and keeps the pregnancy concern');
  assert.match(card('African potato').c, /never replace antiretroviral therapy/, 'African potato is not HIV treatment');
  assert.match(card('African potato').c, /efavirenz/, 'and keeps the interaction study it has');

  // Read on the shelf, not only in the data: open ephedra and the rule has to
  // be on the screen.
  const p2 = loadPage('herbs.html');
  p2.sandbox.tab = 'az';
  p2.sandbox.openId = p2.sandbox.allHerbs().filter((x) => x.n === 'Ephedra')[0].id;
  p2.sandbox.render();
  const shown = p2.els.get('view').innerHTML;
  assert.match(shown, /id="p-ephedra"/, 'the card has its own address');
  assert.match(shown, /unreasonable risk/, 'and shows the FDA rule when it is opened');
});

// 19 Oct 2026, fourth batch: "Next step: Research a fourth batch". Twelve more,
// the counter shelf - what people actually buy. The facts pinned below are the
// trial comparisons, the doses the regulators state, and the null results.
const RESEARCHED_4 = [
  'Berberine', 'Glucomannan', 'Guar gum', 'Diosmin', 'Goji', 'Jamun',
  'Black currant seed oil', 'Artemisia afra', 'Lovage root', 'Avens',
  'Agaricus blazei', 'Kanna',
];

test('the herb library: the twelve herbs of the fourth research batch are in it, in the page\u2019s own voice', () => {
  const p = loadPage('herbs.html');
  const list = p.sandbox.allHerbs();
  const keys = new Set(p.sandbox.NEEDS.map((n) => n.k));
  for (const name of RESEARCHED_4) {
    const h = list.filter((x) => x.n === name)[0];
    assert.ok(h, `${name} is in the library`);
    assert.ok(h.a, `${name} carries the other names it goes by`);
    assert.ok(h.u, `${name} says what people use it for`);
    assert.ok(h.d, `${name} says what it does`);
    assert.ok(h.h, `${name} says how it is taken`);
    assert.ok(h.c, `${name} carries its caution, not just its uses`);
    assert.ok(!h.bk, `${name} carries no From the books line - it is not in the books`);
    for (const t of h.t || []) assert.ok(keys.has(t), `${name} is on a shelf that exists (${t})`);
  }
  assert.ok(list.length >= 316, `the library grew again: ${list.length}`);
});

test('the herb library: the fourth research batch keeps the facts that have to travel with them', () => {
  const p = loadPage('herbs.html');
  const list = p.sandbox.allHerbs();
  const card = (n) => list.filter((x) => x.n === n)[0];
  // The metabolic two: the comparison that is not equivalence, and the enzyme line.
  assert.match(card('Berberine').c, /28 studies and 2,313 people/, 'berberine keeps the review size');
  assert.match(card('Berberine').c, /36 adults/, 'and the small head-to-head trial');
  assert.match(card('Berberine').c, /kernicterus/, 'and the newborn caution');
  assert.match(card('Berberine').c, /CYP2D6, CYP2C9 and CYP3A4/, 'and the enzymes it inhibits');
  // The three fibres, with the water and the registers.
  assert.match(card('Glucomannan').h, /3 grams a day in three 1-gram doses/, 'glucomannan keeps the authorised regimen');
  assert.match(card('Glucomannan').c, /blocked the throat and the oesophagus/, 'and the obstruction reports');
  assert.match(card('Glucomannan').c, /no significant weight loss/, 'and the trial that found none');
  assert.match(card('Guar gum').c, /19 randomised trials/, 'guar gum keeps the review size');
  assert.match(card('Guar gum').c, /19 milligrams per decilitre/, 'and the cholesterol result');
  assert.match(card('Guar gum').c, /10 grams a day/, 'and the claim condition');
  assert.match(card('Diosmin').c, /2,344 people/, 'diosmin keeps the Cochrane size');
  assert.match(card('Diosmin').c, /19 reports of bleeding/, 'and the bleeding review');
  assert.match(card('Diosmin').c, /possible clot/, 'and the clot red flag');
  // The food and the regional pair.
  assert.match(card('Goji').c, /raised INR/, 'goji keeps the warfarin reports');
  assert.match(card('Goji').c, /heavy metals/, 'and the contamination survey');
  assert.match(card('Goji').c, /macular pigment/, 'and that its eye trial was a biomarker');
  assert.match(card('Jamun').c, /Ninety-nine people/, 'jamun keeps the trial size');
  assert.match(card('Jamun').c, /wording is ambiguous/, 'and says the dose wording is ambiguous');
  assert.match(card('Jamun').c, /glucose meter/, 'and the monitoring line');
  assert.match(card('Black currant seed oil').c, /10.5 grams a day/, 'black currant keeps the trial dose');
  assert.match(card('Black currant seed oil').c, /no better than placebo overall/, 'and the null result');
  assert.match(card('Black currant seed oil').c, /evening primrose/, 'and the GLA caution it does not inherit');
  assert.match(card('Artemisia afra').c, /retracted in 2020/, 'Artemisia afra keeps the retraction');
  assert.match(card('Artemisia afra').c, /not Artemisia annua/, 'and the species line');
  assert.match(card('Artemisia afra').c, /alpha-thujone/, 'and the oil caution');
  // The monograph pair and the two mushrooms-and-mood cards.
  assert.match(card('Lovage root').c, /traditional use/, 'lovage says its use is traditional');
  assert.match(card('Lovage root').c, /fluid is restricted/, 'and the fluid-restriction line');
  assert.match(card('Lovage root').c, /emmenagogue/, 'and the pregnancy precaution');
  assert.match(card('Avens').c, /no clinical trial could be found/, 'avens admits there is no trial');
  assert.match(card('Avens').c, /tannins hold iron and other things back/, 'and keeps the tannin line');
  assert.match(card('Avens').h, /no dose is printed/, 'and prints no dose');
  assert.match(card('Agaricus blazei').c, /no survival benefit/, 'Agaricus keeps the survival result');
  assert.match(card('Agaricus blazei').c, /inorganic arsenic/, 'and the arsenic finding');
  assert.match(card('Agaricus blazei').c, /not a cancer treatment/, 'and says it is not a cancer treatment');
  assert.match(card('Kanna').c, /37 healthy adults/, 'kanna keeps the trial size');
  assert.match(card('Kanna').c, /serotonin toxicity/, 'and the serotonin caution');
  assert.match(card('Kanna').c, /clinical depression/, 'and what its trials do not show');

  // Read on the shelf, not only in the data: open kanna and the caution has to
  // be on the screen.
  const p2 = loadPage('herbs.html');
  p2.sandbox.tab = 'az';
  p2.sandbox.openId = p2.sandbox.allHerbs().filter((x) => x.n === 'Kanna')[0].id;
  p2.sandbox.render();
  const shown = p2.els.get('view').innerHTML;
  assert.match(shown, /id="p-kanna"/, 'the card has its own address');
  assert.match(shown, /serotonin toxicity/, 'and shows its caution when it is opened');
});

// 19 Oct 2026, fifth batch: "Next step: Research a fifth batch". Twelve more, at
// the edge of the pharmacopoeia - the monograph herbs with no trial, the plants
// with a file against them, and the sold extracts whose one trial was small or
// null. The facts pinned here are the regulator's findings and the case counts.
const RESEARCHED_5 = [
  'Iceland moss', 'Sundew', 'Orthosiphon', 'Restharrow', 'Greater celandine',
  'Thuja', 'Calamus', 'Camphor', 'He Shou Wu', 'White mulberry leaf',
  'Coleus', 'Bromelain',
];

test('the herb library: the twelve herbs of the fifth research batch are in it, in the page\u2019s own voice', () => {
  const p = loadPage('herbs.html');
  const list = p.sandbox.allHerbs();
  const keys = new Set(p.sandbox.NEEDS.map((n) => n.k));
  for (const name of RESEARCHED_5) {
    const matches = list.filter((x) => x.n === name);
    assert.equal(matches.length, 1, `${name} is in the library once`);
    const h = matches[0];
    assert.ok(h.a, `${name} carries the other names it goes by`);
    assert.ok(h.u, `${name} says what people use it for`);
    assert.ok(h.d, `${name} says what it does`);
    assert.ok(h.h, `${name} says how it is taken`);
    assert.ok(h.c, `${name} carries its caution, not just its uses`);
    assert.ok(!h.bk, `${name} carries no From the books line - it is not in the books`);
    for (const t of h.t || []) assert.ok(keys.has(t), `${name} is on a shelf that exists (${t})`);
  }
  assert.ok(list.length >= 328, `the library grew again: ${list.length}`);
  assert.equal(new Set(list.map((x) => x.n)).size, list.length, 'and no name is in it twice');
});

test('the herb library: the fifth research batch keeps the facts that have to travel with them', () => {
  const p = loadPage('herbs.html');
  const list = p.sandbox.allHerbs();
  const card = (n) => list.filter((x) => x.n === n)[0];
  // The four monograph herbs: what the regulator found, and what it did not.
  assert.match(card('Iceland moss').c, /traditional use and not a trial result/, 'Iceland moss says its use is traditional');
  assert.match(card('Iceland moss').c, /over six/, 'and keeps the age line');
  assert.match(card('Iceland moss').h, /prints none/, 'and prints no amount it could not read');
  assert.match(card('Sundew').c, /No controlled human trial of sundew could be verified/, 'sundew admits there is no trial');
  assert.match(card('Sundew').c, /no agreed dose, no agreed age and no agreed length of use/, 'and says what that leaves');
  assert.match(card('Orthosiphon').c, /adopted monograph|traditional use/, 'orthosiphon names its monograph');
  assert.match(card('Orthosiphon').c, /A flush is not an infection/, 'and the line a flush cannot cross');
  assert.match(card('Restharrow').c, /no studies in patients had been carried out/, 'restharrow keeps the agency finding');
  assert.match(card('Restharrow').c, /over twelve/, 'and its age limit');
  // The four with a file against them.
  assert.match(card('Greater celandine').c, /62-year-old woman/, 'celandine keeps the published case');
  assert.match(card('Greater celandine').c, /22 spontaneous reports/, 'and the German report count');
  assert.match(card('Greater celandine').c, /highly probable/, 'and the causality rating');
  assert.match(card('Greater celandine').c, /get liver tests/, 'and what to do about it');
  assert.match(card('Thuja').c, /eight generalised seizures/, 'thuja keeps the seizure report');
  assert.match(card('Thuja').h, /external use only/, 'and the external-only rule');
  assert.match(card('Thuja').h, /one drop at a time/, 'and the monograph directions');
  assert.match(card('Thuja').c, /never on a child/, 'and the child line');
  assert.match(card('Calamus').c, /small-intestinal leiomyosarcomas/, 'calamus keeps the animal finding');
  assert.match(card('Calamus').c, /no acceptable daily intake/, 'and the missing ADI');
  assert.match(card('Calamus').c, /21 CFR 189\.110/, 'and the food rule');
  assert.match(card('Camphor').c, /nineteen-month-old/, 'camphor keeps the fatal case');
  assert.match(card('Camphor').c, /half a gram to one gram/, 'and the lethal estimate');
  assert.match(card('Camphor').c, /five to ninety minutes/, 'and the onset');
  assert.match(card('Camphor').c, /21 CFR 310\.502/, 'and the camphorated-oil rule');
  // The four sold extracts, and their small or null studies.
  assert.match(card('He Shou Wu').c, /25 people/, 'He Shou Wu keeps the case series size');
  assert.match(card('He Shou Wu').c, /one needed a transplant and one died/, 'and what happened');
  assert.match(card('He Shou Wu').c, /nine liver-damage reports/, 'and the Australian count');
  assert.match(card('White mulberry leaf').c, /crossover in 20 people/, 'mulberry keeps the trial size');
  assert.match(card('White mulberry leaf').c, /high risk of bias/, 'and the committee rating');
  assert.match(card('White mulberry leaf').c, /notifier's request/, 'and the food-safety notice');
  assert.match(card('White mulberry leaf').c, /metformin/, 'and that it does not replace one');
  assert.match(card('Coleus').c, /30 overweight or obese men/, 'coleus keeps the men\u2019s trial size');
  assert.match(card('Coleus').c, /0\.7 kilograms/, 'and the women\u2019s null result');
  assert.match(card('Coleus').c, /1 per cent forskolin eye drops/, 'and the different glaucoma product');
  assert.match(card('Bromelain').c, /47 people/, 'bromelain keeps the trial size');
  assert.match(card('Bromelain').c, /31 finished/, 'and the completion');
  assert.match(card('Bromelain').c, /no significant difference/, 'and the null result');
  assert.match(card('Bromelain').c, /no case report tying bromelain to bleeding/, 'and refuses a case it could not verify');

  // Read on the shelf, not only in the data: open camphor and the route rule
  // has to be on the screen.
  const p2 = loadPage('herbs.html');
  p2.sandbox.tab = 'az';
  p2.sandbox.openId = p2.sandbox.allHerbs().filter((x) => x.n === 'Camphor')[0].id;
  p2.sandbox.render();
  const shown = p2.els.get('view').innerHTML;
  assert.match(shown, /id="p-camphor"/, 'the card has its own address');
  assert.match(shown, /Never by mouth/, 'and shows the route rule when it is opened');
});

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
  assert.match(html, /The claims are made here/, 'and the From the books tab says so plainly');
  assert.match(html, /The claims are made here plainly/, 'in the page\u2019s own voice, not in a prompt\u2019s');
  // The ask box that used to be told to make them too came off the page with
  // Friendly on 4 Oct 2026. The claims are the page's own and they stay.
  assert.doesNotMatch(html, /Friendly/, 'no helper is left on the page');
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

/* ------------------------------------------------ the claim, on every shelf
   22 Oct 2026. Jacques: "Put the book claim where its missing throughout the app."
   The tab was already built on the rule that a line says whose it is, but ten
   shelves carried the book's rows with no box at the foot saying so - and some of
   them under a heading that did not name the book either ("Blood cleansers",
   "Immune system builders", "The doctrine of signatures"). Opened, each was a wall
   of the book's lines with nothing on the screen to say whose they were. This
   holds the rule to every shelf on the tab, so the next one cannot arrive unlabelled. */
test('the herb library: every shelf on the From the books tab says whose claims it carries', () => {
  const p = loadPage('herbs.html');
  // The one shelf that is not the book's material: it is the index of where each
  // part of the tab came from. That is provenance rather than a claim, and its own
  // rows name the book and the page for every section, so it needs no box of its own.
  const PROVENANCE = 'What came from where';
  for (const b of p.sandbox.BOOKS) {
    if (b.h === PROVENANCE) {
      assert.ok(!b.note, 'the provenance shelf is not given a claim box it does not need');
      continue;
    }
    assert.ok(b.note, `${b.h} carries a box saying whose claims these are`);
    assert.match(b.note, /book|page|lecture|claim/i, `${b.h}'s box names the voice`);
    // A box, not a last paragraph that can be scrolled past: warnbox where the
    // line is a caution, okbox where the book's shelf is printed as it stands.
    assert.match(b.noteCls || '', /^(warn|ok)box$/, `${b.h}'s box is drawn as a box, not as prose`);
  }

  // And the box reaches the screen, inside the shelf it belongs to.
  p.sandbox.tab = 'books';
  p.sandbox.render();
  const html = p.els.get('view').innerHTML;
  assert.match(html, /The book's shelf, printed as its claim/,
    'the blood-cleanser shelf says so where it is read');
  assert.match(html, /The doctrine is the book's, printed as its claim/,
    'and so does the doctrine of signatures');
  assert.match(html, /The book's own sentences, printed as the book's/,
    "and so does the shelf of the book's own lines");
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

/* ---------------------------------------------------------- the third book
   18 Oct 2026. Jacques: "put this in the herbs", with the text of Melanin: What
   Makes Black People Black! by Llaila Afrika pasted in — the same author as the
   first two. It went in as its own shelves on this tab, for the reason the tab
   exists: most of a book about melanin is not about one plant.

   What is held here is the shelf's shape and the one rule that makes printing
   another person's claims honest on this page. */
const MELANIN_TITLES = [
  'Melanin — the third book',
  'The pineal gland, and what melanin is',
  'What melanin takes in',
  'Where melanin is in the body',
  'The two melanin hormones',
  'How the book says to measure melanin',
  'The races, by melanin',
  'The two races compared, as the book puts it',
  'Two ways of thinking',
  'What melanin is built from',
  'The two principles, and the twelve clusters',
];

function melaninShelf(p) {
  return p.sandbox.BOOKS.filter((b) => MELANIN_TITLES.indexOf(b.h) > -1);
}

test('the herb library: the third book is a shelf on the tab, and it renders', () => {
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'books';
  p.sandbox.render();
  const html = p.els.get('view').innerHTML;

  const shelf = melaninShelf(p);
  assert.equal(shelf.length, MELANIN_TITLES.length,
    `every shelf of the book is in the tab: ${shelf.map((b) => b.h).join(' / ')}`);
  for (const b of shelf) {
    assert.match(html, new RegExp(b.h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${b.h} renders`);
    assert.ok(b.rows.length >= 2, `${b.h} holds rows and not a title alone`);
    for (const r of b.rows) {
      assert.ok(r[0] && r[1] && r[1].length > 20, `${b.h} — ${r[0]} carries the book's line`);
    }
  }
  // The first card is still the first card: everything that reads "bk0" on
  // this page, including its own read-aloud test, points at it.
  assert.equal(p.sandbox.BOOKS[0].h, 'What this tab is, and where each line came from');
  assert.match(html, /data-h="bk0"/);
});

test('the herb library: the third book is named, and its claims are labelled as its own', () => {
  const p = loadPage('herbs.html');
  const shelf = melaninShelf(p);
  const first = shelf[0];
  assert.match(first.s, /Llaila Afrika/, 'the shelf names the author');
  assert.match(first.s, /Seaburn, 2009/, 'and the publisher and the year');
  assert.match(first.rows[0][1], /Melanin: What Makes Black People Black!/, 'and the title of the book');

  // The rule the rest of this tab keeps: a figure or a claim says whose it is,
  // and this page's own line sits in the box at the foot of the section.
  for (const b of shelf) {
    assert.ok(b.s, `${b.h} says where it came from`);
    assert.ok(b.note, `${b.h} carries the box that says whose claims these are`);
    assert.match(b.note, /^(<b>The book|<b>This page|<b>Read the race)/, `${b.h}'s box says which voice it is`);
    assert.equal(b.noteCls, 'warnbox', `${b.h}'s box is drawn as a warning, not as prose`);
  }
  // And the page's own line is where the book's claim is a self-test.
  const measuring = shelf.filter((b) => b.h === 'How the book says to measure melanin')[0];
  assert.match(measuring.note, /not a test this page asks/,
    'the pH and blood-pressure shelf says the test is the book\u2019s, not this page\u2019s');

  // The tab's own card now counts three books, and the copy that named two went.
  const intro = p.sandbox.BOOKS[0];
  const nine = JSON.stringify(intro);
  assert.match(nine, /The three books/, 'the tab says three books');
  assert.match(nine, /Melanin: What Makes Black People Black!/, 'and names the third');
});

test('the herb library: the herbs the third book names are on this page, with their cautions', () => {
  const p = loadPage('herbs.html');
  const list = p.sandbox.allHerbs();
  const nutrition = melaninShelf(p).filter((b) => b.h === 'What melanin is built from')[0];
  const herbsRow = nutrition.rows.filter((r) => /Herbs the book names/.test(r[0]))[0];
  assert.ok(herbsRow, 'the nutrition shelf names the herbs');

  // Every herb that shelf names has to be a real entry on the A–Z shelf, with
  // its caution on it — the page's own promise, and the reason the row can
  // point at it at all.
  for (const name of ['Ginkgo', 'Gotu kola', 'Echinacea']) {
    assert.match(herbsRow[1], new RegExp(name, 'i'), `the shelf names ${name}`);
    const h = list.filter((x) => x.n === name)[0];
    assert.ok(h, `${name} is in the library`);
    assert.ok(h.u, `${name} says what people use it for`);
    assert.ok(h.c, `${name} carries its caution`);
  }
});

test('the app no longer prints a herb count it cannot keep true', () => {
  // It said 244. The library now holds more than that, and the count is the one
  // thing that goes stale by itself. The row that carried it went with the
  // recovery app on 4 Oct 2026, so the check reads the shell that replaced it.
  const shell = fs.readFileSync(path.join(ROOT, 'hub.html'), 'utf8');
  assert.doesNotMatch(shell, /\b\d+ herbs\b/, 'no number of herbs is printed anywhere in the shell');
  assert.match(shell, /href="\/herbs"/, 'and the library is still a door in the app');
});
