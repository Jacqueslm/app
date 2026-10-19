// The Mucus scale tab and the seven-day plan it asks Gemini for.
//
// Jacques, 19 Oct 2026: "food categorize by how much mucus it can make scale
// 1-5 5 is dangerous 1 is safe 3 is risky and everything in between falls in
// those ranges then I want it to have questionnaire that ask questions based
// on a person goal ... then Ai gemini would summarize everything and based on
// the questionnaire put a meal plan together but it would only correlate with
// the Dr afika book".
//
// What this checks is not the prose. It is the places a feature like this goes
// quietly wrong:
//
//   1. A food with a score outside 1-5, a duplicate, or a band whose range
//      leaves a number between the anchors belonging nowhere.
//   2. A questionnaire that is missing one of the five goals or one of the
//      three health states, so the plan answers a question nobody was asked.
//   3. The prompt drifting off the two Afrika books, or losing the scale, the
//      plate, the exclusions or the safety lines.
//   4. A parser that blanks the page when the model wraps its JSON in a fence
//      or adds one sentence before it.
//   5. A route that is one curl away for anybody with an account, or that puts
//      the Gemini key somewhere a page or a log can read it.
//   6. The page saying nothing leaves the phone while shipping the answers to
//      Google — the one quiet lie this library must never tell.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'herbs.html'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');
const VERCEL = fs.readFileSync(path.join(ROOT, 'server', 'vercel-app.js'), 'utf8');
const ROUTE = fs.readFileSync(path.join(ROOT, 'server', 'mucus-plan-route.js'), 'utf8');
const plan = require('../mucus-plan');

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

const GOALS = [
  'Gain weight and muscle',
  'Lose weight and get sculpted',
  'Live a healthier life with lifestyle changes',
  'Be pain free',
  'Live longer',
];

test('the page: the scale tab is a door, and it opens onto the scale and the plan', () => {
  assert.match(PAGE, /data-t="mucus">Mucus scale/);
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'mucus';
  p.sandbox.mucusSub = 'scale';
  p.sandbox.render();
  const scale = p.els.get('view').innerHTML;
  assert.match(scale, /data-msub="scale"/);
  assert.match(scale, /data-msub="plan"/);
  assert.match(scale, /The foods, by band/);
  assert.match(scale, /Watermelon/);
  assert.match(scale, /Fried food/);
  assert.match(scale, /1\.0 &#8211; 1\.9|1\.0 – 1\.9/);

  p.sandbox.mucusSub = 'plan';
  p.sandbox.render();
  const form = p.els.get('view').innerHTML;
  for (const g of GOALS) assert.ok(form.includes(g), `the goal is on the form: ${g}`);
  assert.ok(form.includes('Healthy') && form.includes('In between') && form.includes('Unhealthy'),
    'the three health states are on the form');
  assert.match(form, /id="plan-age"/);
  assert.match(form, /data-plan="gender\|Woman"/);
  assert.match(form, /data-plan="race\|African \/ Black"/);
  assert.match(form, /id="mpbuild"/);
  assert.match(form, /Gemini, Google/);
  assert.match(form, /African Holistic Health/);
  assert.match(form, /Nutricide/);
  assert.match(form, /No plan yet/);
});

test('the scale: every food has a number from 1 to 5, and every number has a band', () => {
  const p = loadPage('herbs.html');
  const foods = p.sandbox.MUCUS_FOODS;
  assert.ok(Array.isArray(foods) && foods.length >= 100, `the list is built out: ${foods && foods.length}`);
  const names = new Set();
  for (const f of foods) {
    assert.ok(f.n && f.n.length > 1, 'a food has a name');
    assert.ok(!names.has(f.n), `the food appears twice: ${f.n}`);
    names.add(f.n);
    assert.strictEqual(typeof f.s, 'number', `${f.n} has a numeric score`);
    assert.ok(f.s >= 1 && f.s <= 5, `${f.n} is inside 1-5: ${f.s}`);
    assert.ok(Number.isInteger(f.s * 2), `${f.n} uses a half step: ${f.s}`);
    assert.ok(f.c && f.c.length > 2, `${f.n} has a category`);
    assert.ok(f.w && f.w.length > 12, `${f.n} says why it has that number`);
  }
  const bands = p.sandbox.MUCUS_BANDS;
  assert.strictEqual(bands.map((b) => b.t).join('|'), 'Safe|Low|Risky|High|Dangerous');
  assert.strictEqual(bands.map((b) => b.n).join('|'), '1|2|3|4|5');
  const cases = [
    [1, 'safe'], [1.9, 'safe'], [2, 'low'], [2.5, 'low'], [2.9, 'low'],
    [3, 'risky'], [3.5, 'risky'], [3.9, 'risky'], [4, 'high'], [4.9, 'high'],
    [5, 'danger'],
  ];
  for (const [score, key] of cases) {
    assert.strictEqual(p.sandbox.muBand(score).k, key, `${score} belongs to ${key}`);
  }
  for (const b of bands) {
    assert.ok(foods.some((f) => p.sandbox.muBand(f.s).k === b.k), `${b.t} has food in it`);
  }
});

test('the page: a saved plan is drawn with its summary, seven days and caution', () => {
  const days = Array.from({ length: 7 }, (_, i) => ({
    d: i + 1,
    title: 'Day title ' + (i + 1),
    morning: 'Water, then half a melon.',
    midday: 'A raw plate of leaves and cucumber.',
    evening: 'Steamed greens with brown rice.',
    snack: 'An apple.',
    drink: 'Water.',
  }));
  const saved = {
    answers: {
      goal: 'Be pain free', age: 52, gender: 'Woman',
      race: 'African / Black', health: 'In between', notes: 'knees in the morning',
    },
    plan: {
      summary: 'A gentle week built from the books plate, with more raw food and water.',
      mucusLoad: 2.4,
      focus: ['Raw midday plate', 'Water before food'],
      days,
      shopping: ['Kale', 'Brown rice', 'Ginger'],
      avoid: ['Milk', 'Fried food'],
      caution: 'Take this plan to whoever manages your knees before you start.',
    },
    model: 'gemini-test',
    at: '2026-10-19T00:00:00.000Z',
  };
  const p = loadPage('herbs.html', { tsid_herb_notes_v1: JSON.stringify({ plan: saved }) });
  p.sandbox.tab = 'mucus';
  p.sandbox.mucusSub = 'plan';
  p.sandbox.render();
  const html = p.els.get('view').innerHTML;
  assert.match(html, /Mucus load 2\.4/);
  assert.match(html, /Low/);
  assert.match(html, /A gentle week built from the books plate/);
  assert.match(html, /data-h="pl0"/);
  assert.match(html, /data-h="pl6"/);
  assert.match(html, /Kale/);
  assert.match(html, /Milk/);
  assert.match(html, /Take this plan to whoever manages your knees/);
  assert.match(html, /Be pain free/);
  assert.match(html, /knees in the morning/);
  assert.ok(!/undefined/.test(html), 'nothing on the plan renders as undefined');
  assert.match(html, /id="mclear"/);
});

test('the page: building a plan posts the answers and keeps the result', async () => {
  const days = Array.from({ length: 7 }, (_, i) => ({
    d: i + 1, title: 'Day ' + (i + 1), morning: 'Water, then melon.',
    midday: 'A raw plate.', evening: 'Steamed greens and rice.', snack: 'An apple.', drink: 'Water.',
  }));
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'mucus';
  p.sandbox.mucusSub = 'plan';
  p.sandbox.planSet('goal', 'Gain weight and muscle');
  p.sandbox.planSet('age', 33);
  p.sandbox.planSet('gender', 'Man');
  p.sandbox.planSet('race', 'African Caribbean');
  p.sandbox.planSet('health', 'Healthy');
  p.sandbox.planSet('notes', 'no peanuts');
  let sent = null;
  p.sandbox.fetch = async (url, opt) => {
    sent = { url, body: JSON.parse(opt.body) };
    return {
      ok: true, status: 200,
      json: async () => ({
        plan: {
          summary: 'A week built to add food without adding dairy.',
          mucusLoad: 2.2, focus: ['Beans at night'], days,
          shopping: ['Kale'], avoid: ['Milk'], caution: 'Food, not medicine.',
        },
        model: 'gemini-test',
      }),
    };
  };
  await p.sandbox.buildMucusPlan();
  assert.strictEqual(sent.url, '/api/mucus-plan');
  assert.strictEqual(JSON.stringify(sent.body), JSON.stringify({
    goal: 'Gain weight and muscle', age: 33, gender: 'Man',
    race: 'African Caribbean', health: 'Healthy', notes: 'no peanuts',
  }));
  assert.ok(p.store['tsid_herb_notes_v1'].includes('A week built to add food'), 'the plan is kept on the phone');
  const html = p.els.get('view').innerHTML;
  assert.match(html, /A week built to add food/);
  assert.match(html, /data-h="pl6"/);
  assert.match(html, /Mucus load 2\.2/);
});

test('the page: a failed plan says what failed and does not pretend to have one', async () => {
  const p = loadPage('herbs.html');
  p.sandbox.tab = 'mucus';
  p.sandbox.mucusSub = 'plan';
  p.sandbox.planSet('goal', 'Live longer');
  p.sandbox.planSet('age', 60);
  p.sandbox.planSet('gender', 'Prefer not to say');
  p.sandbox.planSet('race', 'Prefer not to say');
  p.sandbox.planSet('health', 'In between');
  p.sandbox.fetch = async () => ({
    ok: false, status: 502,
    json: async () => ({ error: 'The plan came back unreadable. Try again.' }),
  });
  await p.sandbox.buildMucusPlan();
  const html = p.els.get('view').innerHTML;
  assert.match(html, /The plan came back unreadable/);
  assert.match(html, /No plan yet/);
  assert.ok(!p.store['tsid_herb_notes_v1'] || !p.store['tsid_herb_notes_v1'].includes('"plan"'),
    'a failure never writes a plan');
});

test('the prompt: the page and the server hold one food list, not two', () => {
  const p = loadPage('herbs.html');
  // Cross-realm arrays from the vm do not compare by prototype, so compare the
  // data itself and say plainly what the two sides are.
  assert.strictEqual(JSON.stringify(plan.foods()), JSON.stringify(p.sandbox.MUCUS_FOODS),
    'server/mucus-plan.js must read MUCUS_FOODS out of herbs.html');
});

test('the prompt: the only source is Afrika, and the whole plate travels with it', () => {
  const sys = plan.systemPrompt();
  const must = [
    /African Holistic Health/,
    /Nutricide/,
    /only sources for this plan/i,
    /keto, paleo/i,
    /Melanin: What Makes Black People Black!.*not a diet book/i,
    /Morning: fruit and water before it/i,
    /raw half/i,
    /lightly steamed vegetables/i,
    /no dairy and no fried food/i,
    /white sugar, white flour and white salt/i,
    /plate is plant-built/i,
    /Fish, shellfish, chicken, turkey, eggs, meat and dairy do not go in the plan/i,
    /Drinks are water and herbal tea/i,
    /1\.0-1\.9 Safe/,
    /2\.0-2\.9 Low/,
    /3\.0-3\.9 Risky/,
    /4\.0-4\.9 High/,
    /5\.0 Dangerous/,
    /Never put a 4\.0 or 5\.0 food in the plan/,
    /at or below 2\.5/,
    /at most one of these in a day/i,
    /no diagnosis, no treatment, no cure/i,
    /Never tell somebody to push through a symptom/i,
    /seven-day (?:meal )?plan/i,
    /Return ONLY one JSON object/i,
    /"mucusLoad"/,
    /"days"/,
    /"shopping"/,
    /"avoid"/,
    /"caution"/,
  ];
  for (const re of must) assert.match(sys, re, `the prompt no longer carries ${re}`);
  for (const g of GOALS) assert.ok(sys.includes(g), `the prompt is missing the goal: ${g}`);
  for (const h of ['Healthy', 'In between', 'Unhealthy']) assert.ok(sys.includes(h), `the prompt is missing ${h}`);
  for (const food of ['Watermelon', 'Kale', 'Milk', 'Fried food', 'White sugar']) {
    assert.ok(sys.includes(food), `the prompt does not carry ${food}`);
  }
});

test('the answers: unknown fields are dropped, the age is bounded, the note is clipped', () => {
  const good = plan.answersFrom({
    goal: '  Be pain free ', age: '52', gender: 'Woman', race: 'African / Black',
    health: 'In between', notes: 'x'.repeat(3000), extra: 'not forwarded',
  });
  assert.deepStrictEqual(Object.keys(good).sort(), ['age', 'gender', 'goal', 'health', 'notes', 'race']);
  assert.strictEqual(good.goal, 'Be pain free');
  assert.strictEqual(good.age, 52);
  assert.strictEqual(good.notes.length, 1200);
  assert.ok(plan.complete(good));

  const bad = plan.answersFrom({ goal: 'Keto', age: 7, gender: 'Nobody', race: 'Martian', health: 'Cured' });
  assert.deepStrictEqual(bad, { goal: '', age: 0, gender: '', race: '', health: '', notes: '' });
  assert.ok(!plan.complete(bad));

  assert.ok(!plan.complete(plan.answersFrom(null)));
  assert.strictEqual(plan.answersFrom({ age: 101 }).age, 0);
  assert.strictEqual(plan.answersFrom({ age: 13 }).age, 13);
});

test('the request: the answers are in the user turn, and JSON mode is a generation setting', () => {
  const answers = plan.answersFrom({
    goal: 'Lose weight and get sculpted', age: 41, gender: 'Man',
    race: 'Mixed', health: 'Healthy', notes: 'no peanuts',
  });
  const user = plan.userPrompt(answers);
  for (const s of ['Lose weight and get sculpted', '41', 'Man', 'Mixed', 'Healthy', 'no peanuts']) {
    assert.ok(user.includes(s), `the user turn is missing ${s}`);
  }
  assert.match(user, /African Holistic Health and Nutricide only/);

  const withJson = JSON.parse(plan.requestBody({
    answers, model: 'gemini-3.6-flash', maxTokens: 5000, thinkingLevel: 'LOW', jsonMode: true,
  }));
  assert.strictEqual(withJson.systemInstruction.parts[0].text, plan.systemPrompt());
  assert.match(withJson.contents[0].parts[0].text, /no peanuts/);
  assert.strictEqual(withJson.generationConfig.responseMimeType, 'application/json');
  assert.ok(withJson.generationConfig.thinkingConfig, 'the first ask uses the thinking knob');

  const plain = JSON.parse(plan.requestBody({ answers, model: 'gemini-3.6-flash', maxTokens: 5000, jsonMode: false, thinking: false }));
  assert.strictEqual(plain.generationConfig.responseMimeType, undefined);
  assert.strictEqual(plain.generationConfig.thinkingConfig, undefined, 'the last retry sends no optional field at all');
});

test('the parser: fenced JSON and one sentence before it still make a plan', () => {
  const raw = {
    summary: 'A week from the books plate.',
    mucusLoad: 2.2,
    focus: ['Fruit mornings'],
    days: [
      { d: 1, title: 'One', morning: 'Melon', midday: 'Leaves', evening: 'Steamed greens', snack: 'Apple', drink: 'Water' },
      { d: 2, title: 'Two', morning: 'Berries', midday: 'Cucumber', evening: 'Beans and rice', snack: 'Pear', drink: 'Water' },
    ],
    shopping: ['Kale'],
    avoid: ['Milk'],
    caution: 'Food, not medicine.',
  };
  const good = plan.parsePlan('Here is the plan:\n```json\n' + JSON.stringify(raw) + '\n```');
  assert.ok(good);
  assert.strictEqual(good.days.length, 2);
  assert.strictEqual(good.mucusLoad, 2.2);
  assert.strictEqual(good.avoid[0], 'Milk');

  const clamped = plan.parsePlan(JSON.stringify(Object.assign({}, raw, { mucusLoad: 9 })));
  assert.strictEqual(clamped.mucusLoad, 5);
  assert.strictEqual(plan.parsePlan(JSON.stringify(Object.assign({}, raw, { mucusLoad: 0 }))).mucusLoad, 1);

  assert.strictEqual(plan.parsePlan('not json at all'), null);
  assert.strictEqual(plan.parsePlan('{"summary":"x","days":[]}'), null);
  assert.strictEqual(plan.parsePlan(JSON.stringify({ summary: 'x', days: [{ d: 1 }] })), null,
    'a day with no food in it is not a plan');
});

test('the route: signed in and on the allowlist, with the key only in a header', () => {
  assert.match(ROUTE, /app\.post\('\/api\/mucus-plan'/);
  assert.match(ROUTE, /cookieParser\(\), express\.json\(/,
    'it mounts above the global parsers, so it attaches its own');
  assert.match(ROUTE, /requireAuth/);
  assert.match(ROUTE, /if \(!isFriendlyRequest\(req\)\) \{\s*return res\.status\(403\)/,
    'the allowlist is checked server-side');
  assert.match(ROUTE, /'x-goog-api-key': key/);
  const urlLine = ROUTE.split('\n').find((l) => l.includes('generativelanguage'));
  assert.ok(urlLine && !urlLine.includes('key='), 'the request URL never carries the key');
  assert.ok(!/res\.json\([^)]*\bkey\b/.test(ROUTE), 'the key is never in a response');

  assert.match(SERVER, /require\('\.\/mucus-plan-route'\)\.mount\(app, \{\s*isFriendlyRequest,/,
    'server.js mounts it with its own allowlist function');
  assert.match(VERCEL, /app\.post\('\/api\/mucus-plan'/,
    'the Vercel build has the same route');
  assert.match(VERCEL, /mucusPlan\.parsePlan\(out\.text\)/);
  assert.match(VERCEL, /delete retry\.generationConfig\.responseMimeType/,
    'the Vercel retry drops the JSON hint as well as the thinking knob');
});

test('the page: it says the answers go to Gemini, and it never holds the server key', () => {
  assert.match(PAGE, /fetch\('\/api\/mucus-plan'/);
  assert.match(PAGE, /answers go to Gemini, Google/);
  assert.ok(!/GEMINI_API_KEY|ANTHROPIC_API_KEY/.test(PAGE), 'the page never names a server key');
  assert.ok(!/x-goog-api-key/.test(PAGE), 'the page never builds the Google call itself');
  const mucusSection = PAGE.slice(PAGE.indexOf('var mucusSub='), PAGE.indexOf('function mucusView'));
  assert.ok(mucusSection.length > 1000, 'sanity: the mucus section is there');
  assert.ok(!/nothing is sent anywhere/i.test(mucusSection),
    'the plan section must not claim the answers stay on the phone');
});
