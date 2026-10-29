// Self Diagnosis in the herb library — 29 Oct 2026.
//
// The thesis supplied was Dr. Llaila O. Afrika's: modern medicine takes the
// power of observation away from the person, so the tongue, the whites of the
// eyes and the nails are read by the person themselves rather than by a
// stranger. The job here was to correlate it into the herb education and to
// carry the two things it names, quassia and glutamine, onto the shelf.
//
// The failures this file guards are the quiet ones:
//   1. a card that is added to one list and not the other, so search finds a
//      plant the shelf cannot show;
//   2. glutamine arriving as a herb with a tradition behind it, which it is not;
//   3. the correlation being written as a diagnosis, which is the one thing the
//      page's own voice must never do;
//   4. the lecture summary losing its attribution and reading as this page
//      teaching that the clinic can be replaced.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(ROOT, "herbs.html"), "utf8");

function inlineScript(file) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  let out = "";
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(m[1])) continue;
    out += m[2] + "\n;\n";
  }
  return out;
}

function loadPage(file) {
  const els = new Map();
  const mk = (id) => ({
    id, value: "", textContent: "", innerHTML: "", disabled: false,
    className: "", style: {}, dataset: {},
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
    createElement() { return mk("_new") },
    body: mk("body"),
    documentElement: mk("html"),
    readyState: "complete",
  };
  const said = [];
  const sandbox = {
    document: doc, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set, Intl,
    localStorage: { getItem() { return null }, setItem() {}, removeItem() {} },
    fetch: async () => { throw new Error("this page must not call the network") },
    scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: "node" },
    speechSynthesis: {
      speak(u) { said.push(u) }, cancel() {}, getVoices() { return [{ name: "Phone voice", lang: "en-GB", default: true }] },
      speaking: false, addEventListener() {},
    },
  };
  sandbox.SpeechSynthesisUtterance = function (text) { this.text = text };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(inlineScript(file), sandbox, { filename: file });
  return { sandbox, els, said };
}

const herb = (p, name) => p.sandbox.allHerbs().filter((h) => h.n === name)[0];

test("the library: quassia and glutamine are both on the shelf, with every field", () => {
  const p = loadPage("herbs.html");
  for (const name of ["Quassia", "Glutamine"]) {
    const h = herb(p, name);
    assert.ok(h, `${name} is in the library`);
    for (const field of ["n", "a", "u", "d", "h", "c"]) {
      const least = field === "n" || field === "a" ? 2 : 10;
      assert.ok(typeof h[field] === "string" && h[field].length > least, `${name} has a ${field}`);
    }
    assert.ok(Array.isArray(h.t) && h.t.length > 0, `${name} sits on a need shelf`);
  }
});

test("the library: quassia now carries the tongue observation, and keeps its caution", () => {
  const p = loadPage("herbs.html");
  const q = herb(p, "Quassia");
  assert.match(q.d, /tongue is what points here/, "the card says which self-check sign points at it");
  assert.match(q.d, /thick coat at the back/, "and what that sign looks like");
  assert.match(q.d, /not a reason to skip looking/, "and refuses to be a reason to stop looking at the food");
  assert.match(q.c, /not a diagnosis/, "and the caution refuses to make it one");
  assert.match(q.c, /Not for a child, not in pregnancy/, "the caution that has to travel with it is still there");
  assert.match(q.c, /clinician's question before it is a bitter's/, "and the red flag is on the card");
});

test("the library: glutamine is a nutrient and says so, not a herb with a tradition", () => {
  const p = loadPage("herbs.html");
  const g = herb(p, "Glutamine");
  assert.match(g.u, /a nutrient, not a herb/, "the one line that matters most is in the subtitle");
  assert.match(g.d, /amino acid/, "it says what it is");
  assert.match(g.d, /no herbal tradition behind it/, "and that it has no tradition behind it");
  assert.match(g.h, /Food first/, "food is the first route");
  assert.match(g.h, /study regimen rather than a dose this page sets/, "and the number is a study number, not a dose");
  assert.match(g.c, /fed by a drip in a hospital/, "the strong evidence is named as the hospital one");
  assert.match(g.c, /leaky gut/, "and the weak claim is named as the weak one");
  assert.match(g.c, /not a treatment for coeliac disease/, "the line that stops it being a cure is there");
  assert.match(g.c, /kidney/, "the kidney caution is there");
  assert.match(g.c, /Blood in the stool/, "and the red flags that make it a clinician's question");
});

test("the library: the Self Diagnosis summary is its own set of notes, with its attribution", () => {
  const p = loadPage("herbs.html");
  p.sandbox.tab = "course";
  p.sandbox.render();
  const html = p.els.get("view").innerHTML;
  assert.match(html, /Lecture summary · Self Diagnosis/, "the section is on the tab");
  assert.match(html, /not a verbatim transcript/, "the summary keeps its attribution");
  assert.match(html, /This page’s own line/, "and the page keeps its own line beside it");
  assert.match(html, /data-h="self-note-1"/, "the first note renders");
  assert.match(html, /data-h="self-note-6"/, "and the last one");
  assert.strictEqual(p.sandbox.SELF_NOTES.length, 6, "six organized notes");
  for (const n of p.sandbox.SELF_NOTES) {
    assert.ok(typeof n.t === "string" && n.t.length > 5, `a note is titled "${n.t}"`);
    assert.ok(Array.isArray(n.notes) && n.notes.length >= 3, `"${n.t}" carries its claims`);
  }
});

test("the library: the correlation names quassia and glutamine, and refuses to be a diagnosis", () => {
  const p = loadPage("herbs.html");
  const data = JSON.stringify(p.sandbox.SELF_NOTES);
  assert.match(data, /quassia/, "the summary names the bitter the tongue points at");
  assert.match(data, /glutamine/, "and the nutrient the gut lining is built from");
  assert.match(data, /Nothing on the shelf is named by a sign/, "the sign is a direction, not a prescription");
  assert.match(data, /and it never says stop what you are taking/, "and never a reason to stop anything");
  const politics = p.sandbox.SELF_NOTES.filter((n) => /cultural sovereignty/.test(n.t))[0];
  assert.ok(politics, "the thesis's politics gets its own note");
  assert.match(politics.notes.join(" "), /self-governance/, "it keeps the thesis's own goal in its own words");
  assert.match(politics.notes.join(" "), /never a diagnosis/, "and refuses the conclusion that follows it");
  const own = p.sandbox.SELF_NOTES.filter((n) => /The line this page keeps/.test(n.t))[0];
  assert.ok(own, "the page's own line is still in the set");
  assert.match(own.notes.join(" "), /not a diagnosis/, "the page's own line is in the set");
  assert.match(own.notes.join(" "), /clinic can be replaced is not/, "and the thesis keeps its own position");
});

test("the library: the self-check reads out loud like the rest of the page", () => {
  const p = loadPage("herbs.html");
  p.sandbox.tab = "course";
  p.sandbox.openId = "self-note-1";
  p.sandbox.render();
  assert.match(p.els.get("view").innerHTML, /data-say="self-note-1"/, "an open note carries its own read button");
  assert.equal(p.said.length, 0, "drawing it does not start reading");
  p.sandbox.say("self-note-1");
  assert.equal(p.said.length, 1, "one press, one reading");
  assert.match(p.said[0].text, /Lecture summary lesson 1/, "it announces itself as a lecture summary");
  assert.doesNotMatch(p.said[0].text, /<[^>]*>/, "and no HTML tag is read out loud");
});

test("the library: both cards are found by search and sit on the stomach shelf", () => {
  const p = loadPage("herbs.html");
  p.sandbox.q = "quassia";
  p.sandbox.tab = "az";
  p.sandbox.render();
  assert.match(p.els.get("view").innerHTML, /Quassia/, "search finds quassia");
  p.sandbox.q = "glutamine";
  p.sandbox.render();
  assert.match(p.els.get("view").innerHTML, /Glutamine/, "search finds glutamine");
  p.sandbox.q = "";
  p.sandbox.tab = "need";
  p.sandbox.render();
  const html = p.els.get("view").innerHTML;
  assert.match(html, /Quassia/, "quassia is on the By need shelves");
  assert.match(html, /Glutamine/, "and so is glutamine");
});
