// The Trainer's first page — 11 Oct 2026.
//
// Jacques: "then create the trainer we will be slowly so start off with just
// basic input information that's it". So there is one page and one job on it:
// ask for the basic information and keep it. Nothing is planned, nothing is
// prescribed, and nothing leaves the phone.
//
// 13 Oct 2026, who it is for. Jacques: "its for my clients ... rewrite it for my
// people I'll put they information in". The page had been written to the person
// being trained ("What to call you"); it is actually filled in by the coach, for
// one of the people he trains. The first test below is the one that holds that:
// the questions ask about "them" and never about the reader.
//
// 14 Oct 2026, and the programme. Jacques: "on the trainer add the by 10 program
// thats it I'll give you more details what it is later even though its based on
// p90x". The by-10 went on the page, and the tests below checked it against the
// Certification's trainer track so neither page could drift.
//
// 17 Oct 2026: "Remove the workout you made up in the trainer only p90x is
// relativity and the by 10 is weaven into those exercise as far as rest peiod".
// The by-10 was ours, not his, so it is off the Trainer and P90X is the only
// programme on it. The tests below now hold the opposite thing: that the by-10
// stays gone, that the ten-second rest it contributed is written into the
// rotation, and that their information still comes first with the safety lines
// still outranking it. certify.html is untouched - the Certification still has
// its own trainer track - so this file no longer reads one against the other.
//
// That last part is the claim the page makes in its own words ("Everything here
// stays on this phone and nothing is sent anywhere"), so it is checked here
// rather than left to a comment: no fetch, no XMLHttpRequest, no form action,
// and no address that is not this app.
//
// 19 OCT 2026, the audit against the Certification. certify.html says the
// Trainer's form is the readiness screen, sorts it three ways and keeps the
// training history. Two of those were not on the page, so they were added and
// are held here; the six Certification lines that described the page wrongly
// were corrected on that side instead.
//
// The rest of this file drives the page's own script the way a thumb does — it
// fills the fields, submits, clears, and re-opens the page with what was stored
// — because "the tests pass" is not the same as "the form works". The herb
// library's tests load a page the same way; this one needs a little more of a
// DOM, because a form that saves has fields that hold values and boxes that tick.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = path.join(ROOT, 'trainer.html');

const TEXT_IDS = ['name', 'age', 'build', 'days', 'when', 'history', 'hurts', 'rules', 'dayone'];
const KIT = ['Dumbbells', 'A pull-up bar', 'Push-up bars', 'A bench or a chair', 'A band', 'Floor space', 'Nothing yet'];
const WANT = ['Stronger', 'Breathing', 'Moving better', 'Sleep', 'Lose weight', 'All of it'];
const SCREEN = [
  'Chest pain, or a heart condition',
  'Dizziness or fainting',
  'Blood pressure, or a medicine that changes it',
  'A joint problem exercise would aggravate',
  'Pregnant, or recently after birth',
  'A recent operation',
];

const JS_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'module']);
function inlineScript(file) {
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(m[1])) continue;
    const type = (m[1].match(/\btype\s*=\s*["']([^"']*)["']/) || ['', ''])[1].toLowerCase().trim();
    if (!JS_TYPES.has(type)) continue;
    return m[2];
  }
  throw new Error(`${file} has no inline script to run`);
}

// A page as small as this one needs only four things from a DOM: an element by
// id, the tick boxes by their data attribute, somewhere to hang an event
// listener, and a localStorage that actually stores. Everything the page asks
// for beyond that is stubbed rather than provided, so a page that starts
// reaching for something new fails loudly here instead of quietly working.
function loadPage(storage) {
  const els = new Map();
  const listeners = new Map();
  const intervalCallbacks = new Map();
  let nextIntervalId = 1;

  function element(id, attrs) {
    const o = {
      id, value: '', textContent: '', innerHTML: '', checked: false,
      className: '', style: {}, dataset: {}, disabled: false, hidden:false, parentNode:null,
      childNodes: [], children: [], _html:'', tagName:'DIV', nodeType:1, scrollIntoView() {},
      attrs: attrs || {},
      getAttribute: (k) => (attrs && k in attrs ? attrs[k] : null),
      setAttribute(k, v) { (o.attrs || (o.attrs = {}))[k] = v; }, removeAttribute() {}, focus() {}, closest: () => null,
      querySelectorAll: () => [], appendChild(node) { node.parentNode = o; o.children.push(node); o.childNodes.push(node); }, remove() {},
      addEventListener(type, fn) {
        if (!listeners.has(id)) listeners.set(id, {});
        listeners.get(id)[type] = fn;
      },
    };
    return o;
  }

  function byId(id) {
    if (!els.has(id)) els.set(id, element(id));
    return els.get(id);
  }

  const header = element('trainerTop');
  header.id = 'trainerTop';
  header.className = 'hdr';
  els.set('trainerTop', header);
  const wrap = element('wrap');
  wrap.className = 'wrap';
  wrap.nodeType = 1;
  wrap.childNodes = [];
  wrap.children = [];
  header.nodeType = 1;
  header.children = [];
  header.childNodes = [];
  header.insertAdjacentHTML = function(){
    const row = element('sayRow'); row.id = 'sayRow'; row.className = 'row noprint';
    els.set('sayRow', row);
    const btn = element('sayBtn'); btn.textContent = 'Read it to me'; els.set('sayBtn', btn);
    const stop = element('sayStop'); stop.textContent = 'Stop'; stop.hidden = true; els.set('sayStop', stop);
  };

  const boxes = [];
  for (const k of KIT) { const b = element(`kit:${k}`, { 'data-kit': k }); boxes.push(b); els.set(`kit:${k}`, b); }
  for (const w of WANT) { const b = element(`want:${w}`, { 'data-want': w }); boxes.push(b); els.set(`want:${w}`, b); }
  for (const s of SCREEN) { const b = element(`screen:${s}`, { 'data-screen': s }); boxes.push(b); els.set(`screen:${s}`, b); }
  const clientSelect = element('clientSelect');
  const rotWeeks = element('rotWeeks');
  const rotDays = element('rotDays');
  const exerciseRows = element('exerciseRows');
  Object.defineProperty(exerciseRows, 'innerHTML', { get() { return this._html || ''; }, set(v) { this._html = v; this.children = []; this.childNodes = []; } });
  const exerciseForm = element('exerciseForm');
  const workoutIds = ['workoutTitle','workoutDate','workoutLog','workoutLogTitle','workoutLogSubtitle','workoutStatus','markWorkoutDoneBtn','restTimer',
    'exerciseName','exerciseSets','exerciseReps','exerciseWeight','exerciseUnit','exerciseNotes',
    'saveWorkoutBtn','closeWorkoutBtn','rotReset','rotWeek','rotPhase','rotCount','rotBar','newClientBtn','deleteClientBtn','savedLine','clearBtn',
    'exerciseSuggestions','exerciseSuggestionsTitle','exerciseSuggestionRows','exerciseName'];
  workoutIds.forEach((id) => els.set(id, element(id)));
  byId('restTimer').hidden = true;
  const intakeDetails = element('intakeDetails');
  intakeDetails.open = false;
  els.set('intakeDetails', intakeDetails);
  const form = element('intake');
  form.querySelectorAll = (sel) => /data-kit/.test(sel) ? boxes.filter((b) => 'data-kit' in b.attrs)
    : /data-want/.test(sel) ? boxes.filter((b) => 'data-want' in b.attrs)
      : /data-screen/.test(sel) ? boxes.filter((b) => 'data-screen' in b.attrs) : [];
  [clientSelect, rotWeeks, rotDays, exerciseRows, exerciseForm, form].forEach((node) => els.set(node.id, node));

  const doc = {
    getElementById: byId,
    querySelector(sel) { return sel === '.wrap' ? wrap : sel === '.hdr' ? header : null; },
    querySelectorAll(sel) {
      if (/data-kit/.test(sel)) return boxes.filter((b) => 'data-kit' in b.attrs);
      if (/data-want/.test(sel)) return boxes.filter((b) => 'data-want' in b.attrs);
      if (/data-screen/.test(sel)) return boxes.filter((b) => 'data-screen' in b.attrs);
      return [];
    },
    addEventListener() {},
    createElement: (tag) => element('_new-' + tag),
    body: element('body'),
    documentElement: element('html'),
    readyState: 'complete',
  };

  const store = storage || {};
  const sandbox = {
    document: doc, console,
    setTimeout, clearTimeout,
    setInterval(fn) { const id = nextIntervalId++; intervalCallbacks.set(id, fn); return id; },
    clearInterval(id) { intervalCallbacks.delete(id); },
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set, Intl,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    // Kept as a tripwire: the page promises nothing is sent anywhere, and the
    // tests below assert this was never reached.
    fetch: async () => { sandbox.sent += 1; return { ok: true, status: 200, json: async () => ({}) }; },
    sent: 0,
    scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: 'node' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(inlineScript(PAGE), sandbox, { filename: 'trainer.html' });
  return {
    sandbox, els, store, listeners, intervalCallbacks,
    fire(id, type, ev) {
      const fn = listeners.get(id) && listeners.get(id)[type];
      if (!fn) return false;
      fn(ev || { preventDefault() {} });
      return true;
    },
    box: (name) => els.get(name),
  };
}

test('the trainer page is the intake, and says what it is', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.match(html, /<h1>The Trainer<\/h1>/, 'the page names itself');
  assert.match(html, /Step one: their information/, 'and says which step it is');
  // Written for the coach holding the phone, not the person being trained —
  // 13 Oct 2026. The fields ask about "them"; there is no field addressed to the
  // reader about themselves.
  assert.match(html, /What to call them/, 'the fields ask about the person being trained');
  assert.doesNotMatch(html, /What to call you/, 'and none of them ask the reader about themselves');
  assert.match(html, /For the people you train/, 'the page says who it is for');
  // 14 Oct 2026: this used to assert the page said there was no plan on it,
  // which was true until the by-10 arrived. What matters now is the order it is
  // read in — their information, then the safety lines, then the programme.
  const atForm = html.indexOf('id="intake"');
  const atSafety = html.indexOf("A doctor's rule wins over this page, always");
  const atProgramme = html.indexOf('<h2>The P90X rotation</h2>');
  assert.ok(atForm > -1, 'the form is on the page');
  assert.ok(atSafety > -1, 'so are the safety lines');
  assert.ok(atProgramme > -1, 'so is the P90X rotation');
  assert.ok(atSafety > atForm && atProgramme > atSafety,
    'their information comes first, the safety lines outrank the programme, and the programme comes last');
  // Every field the step is for is on the page.
  for (const id of TEXT_IDS) assert.match(html, new RegExp(`id="${id}"`), `the ${id} field is on the page`);
  for (const k of [...KIT, ...WANT, ...SCREEN]) assert.ok(html.includes(k), `${k} is offered on the page`);
  // And it is reachable from the app's own door.
  assert.match(html, /href="\/app"/, 'the way back to the app is on the page');
});

test('nothing on the trainer page leaves the phone', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.doesNotMatch(html, /\bfetch\s*\(/, 'the page must not call fetch');
  assert.doesNotMatch(html, /XMLHttpRequest|sendBeacon|WebSocket/, 'nor any other way of sending');
  assert.doesNotMatch(html, /<form[^>]*\baction=/, 'and the form must have nowhere to post to');
  assert.doesNotMatch(html, /\bmethod="post"/i, 'nor a post method');
  // Addresses it may name: its own pages, its own files. Nothing off this app.
  // The SVG namespace is not an address and is not fetched — it is the word
  // browsers want above an inline <svg>.
  const urls = [...html.matchAll(/https?:\/\/[^"'\s)]+/g)]
    .map((m) => m[0])
    .filter((u) => u !== 'http://www.w3.org/2000/svg');
  assert.deepStrictEqual(urls, [], `the page must not call out to any other site: ${urls.join(', ')}`);
});

test('the page keeps what is typed, and hands it back on the next open', () => {
  const store = {};
  const p = loadPage(store);
  const T = p.sandbox.TRAINER;
  assert.ok(T, 'the page puts its own surface on window, so this check drives the real script');
  assert.equal(T.KEY, 'tsid_trainer_intake_v1');

  // A thumb, filling the form in.
  p.box('name').value = 'Jacques';
  p.box('age').value = '47';
  p.box('build').value = "5'11, 15 stone";
  p.box('days').value = '4';
  p.box('when').value = 'before work';
  p.box('hurts').value = 'a knee from the old days';
  p.box('rules').value = 'nothing overhead';
  p.box('dayone').value = '2026-10-11';
  p.box('kit:Dumbbells').checked = true;
  p.box('kit:Floor space').checked = true;
  p.box('want:Stronger').checked = true;

  // Typing saves by itself — there is no save button to forget on a phone.
  p.fire('intake', 'input');
  const kept = JSON.parse(store[T.KEY]);
  assert.equal(kept.name, 'Jacques');
  assert.equal(kept.age, '47');
  assert.equal(kept.days, '4');
  assert.equal(kept.dayone, '2026-10-11');
  assert.deepStrictEqual(kept.kit, ['Dumbbells', 'Floor space']);
  assert.deepStrictEqual(kept.want, ['Stronger']);

  // And the button saves the same thing — and stops the form from navigating,
  // which is the one thing a plain <form> does by itself and would throw every
  // answer away on the way out.
  let navigated = false;
  p.fire('intake', 'submit', { preventDefault() { navigated = true; } });
  assert.equal(navigated, true, 'submitting must not reload the page');
  assert.deepStrictEqual(JSON.parse(store[T.KEY]), kept);

  // Re-opening the page puts every answer back where it was.
  const again = loadPage(store);
  assert.equal(again.box('name').value, 'Jacques');
  assert.equal(again.box('hurts').value, 'a knee from the old days');
  assert.equal(again.box('dayone').value, '2026-10-11');
  assert.equal(again.box('kit:Dumbbells').checked, true);
  assert.equal(again.box('kit:Nothing yet').checked, false, 'a box that was not ticked stays unticked');
  assert.equal(again.box('want:Stronger').checked, true);
  assert.match(again.box('savedLine').textContent, /Saved on this phone/);

  // Nothing was sent anywhere, in either run.
  assert.equal(p.sandbox.sent, 0, 'the page must not have sent anything');
  assert.equal(again.sandbox.sent, 0, 'nor on the second open');
});

test('a first new client does not leave an empty placeholder profile', () => {
  const store = {};
  const p = loadPage(store);
  const T = p.sandbox.TRAINER;
  const firstId = T.newClient();
  p.box('name').value = 'Carol';
  p.fire('intake', 'input');
  const clients = JSON.parse(store[T.CLIENTS_KEY]).clients;
  assert.equal(clients.length, 1);
  assert.equal(clients[0].id, firstId);
  assert.equal(clients[0].name, 'Carol');
});

test('client profiles can be created, named, switched, and retained separately', () => {
  const store = {};
  const p = loadPage(store);
  const T = p.sandbox.TRAINER;
  p.box('name').value = 'Carol';
  p.fire('intake', 'input');
  const first = JSON.parse(store[T.CLIENTS_KEY]);
  assert.equal(first.clients.length, 1);
  assert.equal(first.clients[0].name, 'Carol');
  assert.equal(first.clients[0].data.name, 'Carol');

  const secondId = T.newClient();
  p.box('name').value = 'Andre';
  p.fire('intake', 'input');
  const two = JSON.parse(store[T.CLIENTS_KEY]);
  assert.equal(two.clients.length, 2);
  assert.equal(two.clients.find((c) => c.id === secondId).name, 'Andre');

  assert.equal(T.switchClient(first.clients[0].id), true);
  assert.equal(p.box('name').value, 'Carol');
  p.box('want:Lose weight').checked = true;
  p.fire('intake', 'change');
  const again = loadPage(store);
  assert.equal(again.box('name').value, 'Carol');
  assert.equal(again.box('want:Lose weight').checked, true);
  const reopened = JSON.parse(store[T.CLIENTS_KEY]);
  assert.equal(reopened.clients.length, 2);
  assert.equal(reopened.clients.find((c) => c.id === secondId).name, 'Andre');
});

test('the Trainer starts compact and offers a direct jump to the workout plan', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.match(html, /<details class="card lead guide-card">\s*<summary>How to use this Trainer<\/summary>/,
    'help stays available in a collapsed details panel');
  assert.match(html, /<details class="card intake-card" id="intakeDetails">\s*<summary class="section-toggle">Step one: their information/,
    'the long client form is optional and collapsed by default');
  assert.match(html, /<details class="card safety-card">\s*<summary class="section-toggle">Before anything gets planned/,
    'safety guidance remains available in a compact collapsed panel');
  assert.match(html, /<a class="btn workout-jump" href="#rotationCard">Go to workouts/,
    'the client area links directly to the workout plan');
  assert.doesNotMatch(html, /data-backtop|Back to Trainer/,
    'repeated buttons that only return to the top are gone');
  assert.match(html, /<div class="weeks" id="rotWeeks" role="group" aria-label="Week"><\/div>/,
    'direct week chips remain available');
  assert.doesNotMatch(html, /id="rotPrev"|id="rotNext"|Last week|Next week/,
    'duplicate previous/next week controls are removed');
  assert.doesNotMatch(html, /function rotGo\(/,
    'the unused previous/next navigation code is removed too');
});

test('creating a client opens the optional client information form', () => {
  const p = loadPage({});
  p.box('intakeDetails').open = false;
  p.sandbox.TRAINER.newClient();
  assert.equal(p.box('intakeDetails').open, true, 'the form opens when a new client is created');
});

test('selecting a P90X day exposes its exercise names and can prefill the log form', () => {
  const p = loadPage({});
  const T = p.sandbox.TRAINER;
  T.newClient();

  T.openWorkout(1, 1);
  const chestBackMenu = p.box('exerciseSuggestionRows').innerHTML;
  assert.match(p.box('exerciseSuggestionsTitle').textContent, /Chest & Back \+ Ab Ripper X/);
  assert.match(chestBackMenu, /<details class="muscle-dropdown"><summary><span>Chest<\/span>/,
    'chest exercises are inside a closed muscle dropdown');
  assert.match(chestBackMenu, /<details class="muscle-dropdown"><summary><span>Back<\/span>/,
    'back exercises have their own dropdown');
  assert.match(chestBackMenu, /<details class="muscle-dropdown"><summary><span>Core<\/span>/,
    'Ab Ripper X is grouped under core');
  assert.doesNotMatch(chestBackMenu, /<details class="muscle-dropdown" open/,
    'exercise groups start collapsed so the logger stays compact');
  assert.match(chestBackMenu, /<span>Standard Push-Ups<\/span><button type="button" data-suggested-index="0">Use<\/button>/,
    'the chest exercise stays within the dropdown and has a prefill action');
  assert.match(chestBackMenu, /<span>Mason \(Kayak\) Twist<\/span><button type="button" data-suggested-index="35">Use<\/button>/,
    'Ab Ripper X exercises remain available in the same grouped menu');
  assert.equal(T.p90x.exercises(1, 1).length, 36, 'Chest & Back and Ab Ripper X names are available');
  assert.equal(T.useSuggestedExercise(0), true);
  assert.equal(p.box('exerciseName').value, 'Standard Push-Ups');

  T.openWorkout(1, 2);
  assert.match(p.box('exerciseSuggestionsTitle').textContent, /Plyometrics/);
  assert.match(p.box('exerciseSuggestionRows').innerHTML, /Jump Knee Tuck/);
  assert.equal(T.p90x.exercises(1, 2).length, 23);

  T.openWorkout(4, 7);
  assert.match(p.box('exerciseSuggestionsTitle').textContent, /Rest or X Stretch/);
  assert.match(p.box('exerciseSuggestionRows').innerHTML, /Neck Stretch/);
  assert.equal(T.p90x.exercises(4, 7).length, 33, 'optional X Stretch names are listed on rest days');

  T.openWorkout(1, 3);
  assert.match(p.box('exerciseSuggestionRows').innerHTML, /<details class="muscle-dropdown"><summary><span>Shoulders<\/span>/,
    'shoulder exercises have a dedicated dropdown');
  assert.match(p.box('exerciseSuggestionRows').innerHTML, /<details class="muscle-dropdown"><summary><span>Biceps<\/span>/,
    'biceps exercises have a dedicated dropdown');
  assert.match(p.box('exerciseSuggestionRows').innerHTML, /<details class="muscle-dropdown"><summary><span>Triceps<\/span>/,
    'triceps exercises have a dedicated dropdown');
  assert.equal(T.p90x.exercises(1, 3).length, 27, 'shoulder/arm and Ab Ripper X names are available');
  T.openWorkout(1, 5);
  assert.match(p.box('exerciseSuggestionRows').innerHTML, /Balanced Lunges/);
  T.openWorkout(5, 1);
  assert.match(p.box('exerciseSuggestionRows').innerHTML, /<span>Chest<\/span>/,
    'Chest, Shoulders & Triceps exercises are organized by focus muscle');
  assert.match(p.box('exerciseSuggestionRows').innerHTML, /Plange Push-Ups/);
  T.openWorkout(5, 3);
  assert.match(p.box('exerciseSuggestionRows').innerHTML, /Twenty-Ones/);
  T.openWorkout(4, 2);
  assert.match(p.box('exerciseSuggestionRows').innerHTML, /Banana Rolls/);
  T.openWorkout(4, 4);
  assert.match(p.box('exerciseSuggestionRows').innerHTML, /Frog/);
});

test('the logger removes duration entry and offers two-set quick-add extras', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.doesNotMatch(html, /id="workoutDuration"|id="exerciseDuration"|Duration \(min\)/,
    'irrelevant duration inputs are removed');
  assert.match(html, /id="exerciseSets"[^>]*value="2"/,
    'the exercise form defaults to two sets');
  assert.match(html, /data-supplement-name="Jump rope"/, 'jump rope is one-tap addable');
  assert.match(html, /data-supplement-name="Step \/ sweat stepping"/, 'step is one-tap addable');
  assert.match(html, /data-supplement-name="Dancing"/, 'dancing is one-tap addable');
  assert.match(html, /data-supplement-name="Frog leaps"/, 'frog leaps are one-tap addable');
  assert.match(html, /data-supplement-name="Dip-machine dips"/, 'dip-machine dips are one-tap addable');
  assert.match(html, /data-supplement-name="Jumping jacks"/, 'jumping jacks are one-tap addable');
  assert.match(html, /ten-second rest changes the actual session length/i,
    'schedule notes avoid misleading DVD runtime estimates');
  assert.doesNotMatch(html, /about .* min|mv\.min/,
    'workout runtime estimates are no longer presented');
  assert.match(html, /class="workout-actions"/, 'workout actions use a dedicated responsive layout');
  assert.match(html, /\.workout-actions #saveWorkoutBtn\{grid-column:1\/-1\}/,
    'the primary save action gets a full row');
  assert.match(html, /@media\(max-width:420px\)/, 'exercise menu adapts to narrow phone screens');
});

test('workout entries capture sets, reps, weight, and stay per client', () => {
  const store = {};
  const p = loadPage(store);
  const T = p.sandbox.TRAINER;
  T.newClient();
  T.openWorkout(1, 1);
  p.box('workoutTitle').value = 'Strength session';
  p.box('workoutDate').value = '2026-10-18';
  T.saveWorkout();
  p.box('exerciseName').value = 'Dumbbell row';
  p.box('exerciseSets').value = '3';
  p.box('exerciseReps').value = '12';
  p.box('exerciseWeight').value = '20';
  p.box('exerciseUnit').value = 'kg';
  p.box('exerciseNotes').value = 'Controlled tempo';
  T.addExercise({ preventDefault() {} });

  const clientSet = JSON.parse(store[T.CLIENTS_KEY]);
  const active = clientSet.clients.find((c) => c.id === clientSet.active);
  const log = active.logs.w1d1;
  assert.equal(log.title, 'Strength session');
  assert.equal(log.duration, undefined, 'workout runtime is not stored');
  assert.deepStrictEqual(log.exercises[0], {
    name: 'Dumbbell row', sets: '3', reps: '12', weight: '20', unit: 'kg', notes: 'Controlled tempo'
  });
  assert.equal(p.box('workoutLog').hidden, false, 'the selected workout log is open');
  assert.equal(p.box('workoutTitle').value, 'Strength session');
  assert.equal(p.box('exerciseSets').value, '2', 'the quick-add field returns to the usual two-set default');
  assert.equal(p.box('restTimer').hidden, false, 'logging an exercise starts the rest countdown');
  assert.equal(p.box('restTimer').textContent, '10-second rest · 10');
  assert.equal(p.intervalCallbacks.size, 1, 'only one rest countdown runs at a time');
  for (let second = 0; second < 10; second++) p.intervalCallbacks.values().next().value();
  assert.equal(p.box('restTimer').textContent, 'Rest complete · ready for the next exercise');
  assert.equal(p.intervalCallbacks.size, 0, 'the countdown stops after ten seconds');
  assert.equal(T.openWorkout(1, 1), undefined);
  assert.equal(p.box('workoutTitle').value, 'Strength session', 'reopening shows the saved workout name');
  assert.equal(p.box('workoutDate').value, '2026-10-18', 'reopening shows the saved workout date');
  assert.equal(p.box('restTimer').hidden, true, 'reopening clears the previous rest countdown');
});

test('P90X and By-10 quick-adds fill the exercise name and default to two sets', () => {
  const p = loadPage({});
  const T = p.sandbox.TRAINER;
  T.newClient();
  T.openWorkout(1, 1);
  assert.equal(T.useSuggestedExercise(0), true);
  assert.equal(p.box('exerciseName').value, 'Standard Push-Ups');
  assert.equal(p.box('exerciseSets').value, '2');
  assert.equal(T.useSupplementExercise('Jump rope'), true);
  assert.equal(p.box('exerciseName').value, 'Jump rope');
  assert.equal(p.box('exerciseSets').value, '2');
  assert.equal(T.useSupplementExercise('Made-up exercise'), false, 'unknown extras cannot be injected');
});

test('an answer left blank is left out, not stored as empty', () => {
  // A half-filled form is a half-filled form, not an error, and it must not
  // write empty strings that later look like answers somebody gave.
  const store = {};
  const p = loadPage(store);
  p.box('name').value = '   ';
  p.box('days').value = '3';
  p.fire('intake', 'submit');
  const kept = JSON.parse(store[p.sandbox.TRAINER.KEY]);
  assert.deepStrictEqual(Object.keys(kept), ['days'], 'only what was answered is kept');
  assert.equal(kept.name, undefined, 'a space is not a name');
});

test('clearing clears all of it, on the page and on the phone', () => {
  const store = {};
  const p = loadPage(store);
  p.box('name').value = 'Jacques';
  p.box('kit:Dumbbells').checked = true;
  p.fire('intake', 'submit');
  assert.ok(store[p.sandbox.TRAINER.KEY], 'there is something kept to clear');

  assert.ok(p.fire('clearBtn', 'click'), 'the Clear button is wired up');
  assert.equal(store[p.sandbox.TRAINER.KEY], undefined, 'the phone is cleared');
  assert.equal(p.box('name').value, '', 'and so is the page');
  assert.equal(p.box('kit:Dumbbells').checked, false, 'boxes included');
  assert.match(p.box('savedLine').textContent, /Nothing filled in yet/,
    'and the page says so rather than claiming something was saved');

  // A cleared phone opens as a fresh form, not somebody else's answers.
  const fresh = loadPage(store);
  assert.equal(fresh.box('name').value, '');
  assert.equal(fresh.box('savedLine').textContent, 'Nothing filled in yet.');
});

test('a browser that has been cleared starts empty instead of breaking', () => {
  // Reading the kept answers is the first thing the page does, so a stored
  // value that is not JSON must not leave a dead form behind it.
  const store = { tsid_trainer_intake_v1: 'not json at all' };
  const p = loadPage(store);
  assert.ok(p.sandbox.TRAINER, 'the page still comes up');
  assert.equal(p.box('name').value, '');
  assert.match(p.box('savedLine').textContent, /Nothing filled in yet/);
});

test('the readiness screen is on the intake and sorts three ways', () => {
  // The Certification's day 23 says the Trainer's form is the readiness
  // questionnaire and sorts it three ways. It did not; it does now, and the
  // sort is the page's own so a coach sees the answer rather than working it out.
  const store = {};
  const p = loadPage(store);
  assert.match(p.box('screeningResult').textContent, /clear to start/i,
    'nothing ticked reads as clear to start');

  p.box('screen:A joint problem exercise would aggravate').checked = true;
  p.fire('intake', 'change');
  assert.match(p.box('screeningResult').textContent, /start gently, and check with a doctor first/i,
    'a joint problem is a doctor-first question, not a stop');

  p.box('screen:Dizziness or fainting').checked = true;
  p.fire('intake', 'change');
  assert.match(p.box('screeningResult').textContent, /do not start until a doctor has said so/i,
    'a red line holds the session');

  const kept = JSON.parse(store[p.sandbox.TRAINER.KEY]);
  assert.deepStrictEqual(kept.screen, ['Dizziness or fainting', 'A joint problem exercise would aggravate'],
    'the screening is kept with the rest of their information');

  const again = loadPage(store);
  assert.equal(again.box('screen:Dizziness or fainting').checked, true, 'and comes back ticked on the next open');
  assert.match(again.box('screeningResult').textContent, /do not start/i, 'with the same answer on the page');

  assert.ok(again.fire('clearBtn', 'click'), 'Clear is wired up');
  assert.match(again.box('screeningResult').textContent, /clear to start/i, 'and clearing clears the screen too');
});

test('a training history is part of their information', () => {
  // The Certification's day 23 lists it beside the goal and the kit.
  const store = {};
  const p = loadPage(store);
  p.box('history').value = 'Two years of gym, stopped after a shoulder injury';
  p.fire('intake', 'change');
  assert.equal(JSON.parse(store[p.sandbox.TRAINER.KEY]).history,
    'Two years of gym, stopped after a shoulder injury', 'the history is kept');
  const again = loadPage(store);
  assert.equal(again.box('history').value, 'Two years of gym, stopped after a shoulder injury',
    'and handed back on the next open');
});

test('the quick-add extras are not called the by-10 ones', () => {
  // The by-10 is a rule, not an exercise list; the Certification says so twice
  // and day 41 says the page carries no regressions either. The menu is P90X
  // extras, so it says that rather than claiming a method it is not.
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.doesNotMatch(html, /By-10 extras/, 'the extras are not labelled as the by-10\u2019s');
  assert.match(html, /Extras · not P90X/, 'they are labelled as extras that are not P90X');
});

test('the by-10 is off the Trainer, and P90X is the programme on it', () => {
  // 17 Oct 2026: "Remove the workout you made up in the trainer only p90x is
  // relativity and the by 10 is weaven into those exercise as far as rest
  // peiod". The by-10 was written from the Certification's description rather
  // than from him, so it is gone - and this holds it gone rather than letting it
  // creep back in beside P90X.
  const html = fs.readFileSync(PAGE, 'utf8');
  for (const gone of [
    'The by-10 programme',
    'The two levels',
    'The three lifting days',
    'Day A &mdash;',
    'Day B &mdash;',
    'Day C &mdash;',
    'The two cardio days',
    'The stretch day',
    'twelve movements held for thirty seconds',
  ]) {
    assert.ok(!html.includes(gone), `the made-up by-10 is gone from the Trainer: "${gone}" is back`);
  }
  assert.match(html, /<h2>The P90X rotation<\/h2>/, 'P90X is the programme on the page');
  // The one part of the by-10 he kept - its rest period - is woven into the
  // rotation rather than left behind in a programme of its own.
  assert.match(html, /ten seconds between exercises/i,
    'the ten-second rest is written into the P90X rotation');
  // 19 Oct 2026, and the rest of the rule, in his words: "By 10 is not based on
  // how much weight you can lift ... 2 to 5 sets no matter your level for a
  // beginners 1 weeknof stretching first ... by 10 can be done everyday as long
  // as workout or rotated and do 2 workouts a day resistance and cardio ...
  // week 4 8 12 rest I dont do". A page that kept only the ten seconds would be
  // a page that left out the method, so the rotation card carries all of it.
  for (const re of [
    /pump out reps/,
    /two to five sets/i,
    /twenty reps at most/i,
    /every day/i,
    /two sessions a day/i,
    /jump rope, a step session, walking, dancing/i,
    /a week of stretching/i,
    /the by-10 does not require them/i,
  ]) assert.match(html, re, `the by-10's rule is on the Trainer: ${re} is missing`);
  // And the lines that outrank it still do.
  assert.match(html, /The programme below is a workout, and two lines outrank it/,
    'the safety card says the programme answers to it, rather than the other way round');
  assert.match(html, /A doctor's rule wins over this page, always/,
    'a doctor comes first');
  assert.match(html, /stop, on the day, if there is chest pain/i,
    'and it names the day it should stop');
});

test('the P90X rotation is the classic thirteen weeks, in full', () => {
  // A programme named but not written out is a heading, not a programme. This
  // drives the page's own surface, the way the week chips drive it, so the weeks
  // checked here are the ones a coach would actually see on the phone.
  const p = loadPage({});
  const rot = p.sandbox.TRAINER.p90x;
  assert.ok(rot, 'the rotation is on the page and drivable');
  const plan = rot.plan();
  assert.equal(plan.length, 13, 'thirteen weeks, not twelve or fourteen');
  plan.forEach((week, i) => assert.equal(week.length, 7, `week ${i + 1} is seven days`));
  const at = (w, d) => plan[w - 1][d - 1];
  // Recovery weeks: 4, 8, and the last week, which closes the ninety days.
  for (const w of [4, 8, 13]) assert.equal(at(w, 1), 'yoga', `week ${w} is a recovery week`);
  assert.equal(at(1, 7), 'rest', 'every week ends on rest or X Stretch');
  assert.equal(at(1, 1), 'cb', 'week 1 opens on Chest & Back');
  assert.equal(at(5, 1), 'cst', 'phase 2 opens on Chest, Shoulders & Triceps');
  assert.equal(at(9, 1), 'cb', 'week 9 is the Chest & Back block');
  assert.equal(at(10, 1), 'cst', 'week 10 switches to Chest, Shoulders & Triceps');
  assert.equal(at(12, 1), 'cst', 'week 12 is still the second block');
});
