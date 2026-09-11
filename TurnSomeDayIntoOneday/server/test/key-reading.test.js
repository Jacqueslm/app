// The Key read by Gemini — /api/key-reading, and the prompt behind it.
//
// Three things here are load-bearing and none of them are visible in the page:
//
//   1. THE GATE. The page at /key is private to the allowlist. The endpoint it
//      calls has to check the same thing for itself, or the reading is one
//      curl away for anybody with an account.
//   2. THE 48. The prompt is given this app's whole 48-week year, read out of
//      key.html itself, so the model answers inside this system instead of
//      inventing a newspaper one — and so there is only ever one copy of the
//      framework to keep correct.
//   3. THE KEY STAYS ON THE SERVER. The Gemini key is sent to Google in a
//      header and appears in no response, no URL and no page.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'key.html'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');
const ROUTE = fs.readFileSync(path.join(ROOT, 'server', 'key-reading-route.js'), 'utf8');
const prompt = require('../key-reading');

test('the whole 48-week framework is read out of the page itself', () => {
  const periods = prompt.periods();
  assert.strictEqual(periods.length, 48,
    'key.html must yield 48 periods — the same list the wheel draws');
  for (const p of periods) {
    assert.ok(p.n && p.t && p.r && Array.isArray(p.signs) && p.signs.length,
      `a period is missing a name, title, range or sign: ${JSON.stringify(p)}`);
  }
  // The page and the prompt are the same list, not two lists that agree today.
  const inPage = [...PAGE.matchAll(/^  \{n:"([^"]+)"/gm)].map((m) => m[1]);
  assert.deepStrictEqual(periods.map((p) => p.n), inPage,
    'the prompt must read the framework from key.html, not keep its own copy');
});

test('every one of the 48 is named in the prompt, with its dates and signs', () => {
  const sys = prompt.systemPrompt();
  for (const p of prompt.periods()) {
    assert.ok(sys.includes(p.n), `the prompt is missing ${p.n}`);
    assert.ok(sys.includes(p.t), `the prompt is missing the title of ${p.n}`);
    assert.ok(sys.includes(p.r), `the prompt is missing the dates of ${p.n}`);
  }
  assert.match(sys, /48 weeks/, 'and it must say what the list is');
});

test('the hard rules travel with the prompt', () => {
  const sys = prompt.systemPrompt();
  const must = [
    /No medical claims/,
    /no brain chemistry/,
    /never tell somebody they are finished/i,
    /Never blame/,
    /"she" or "her"/,
    /do not ask what, do not guess what/,
    /skipped it stays skipped|stays skipped/i,
    /Never invent|do not invent|never invent/i,
    /never treat a hard start as the explanation/i,
    /could only have been written about this person/i,
  ];
  for (const re of must) assert.match(sys, re, `the prompt no longer carries ${re}`);
  // The four headings are parsed back out by the page, so they are a contract.
  for (const h of ['WHAT YOU WROTE THAT THE SLIDERS COULD NOT SHOW',
                   'WHERE YOUR LIFE AND YOUR READING AGREE',
                   'WHERE THEY DISAGREE', 'THE ONE THING']) {
    assert.ok(sys.includes(h), `the page renders ${h}, so the prompt must ask for it`);
  }
});

test('what the browser sends is capped and never reinterpreted', () => {
  const long = 'x'.repeat(50000);
  const out = prompt.clipInput({ who: '  Jacques  ', message: long, answers: [1, 2, 3] });
  assert.strictEqual(out.who, 'Jacques');
  assert.strictEqual(out.message.length, 20000);
  assert.deepStrictEqual(Object.keys(out).sort(), ['message', 'who'],
    'the route reads two fields and no others — an unknown key is dropped, not passed on');

  const empty = prompt.clipInput(undefined);
  assert.deepStrictEqual(empty, { who: '', message: '' });

  const user = prompt.userPrompt({ who: 'Jacques', message: 'THEIR READING\nBorn July 3' });
  assert.match(user, /Jacques/);
  assert.match(user, /THEIR READING/);
  assert.match(user, /four parts/);
});

test('the route checks the allowlist for itself, above the global parsers', () => {
  assert.match(ROUTE, /app\.post\('\/api\/key-reading'/,
    'the endpoint must exist at the path the page calls');
  assert.match(ROUTE, /cookieParser\(\), express\.json\(/,
    'it mounts above server.js\u2019s global parsers, so it must attach its own — without them req.cookies is undefined and every request fails the gate');
  assert.match(ROUTE, /requireAuth/,
    'signed in is the first lock');
  assert.match(ROUTE, /if \(!isFriendlyRequest\(req\)\) \{\s*return res\.status\(403\)/,
    'and the allowlist is the second, checked server-side');
  assert.match(SERVER, /require\('\.\/key-reading-route'\)\.mount\(app, \{\s*isFriendlyRequest,/,
    'server.js must mount it WITH its own allowlist function, not a second copy of that rule');
});

test('the Gemini key never reaches a page or a response', () => {
  // It goes to Google in a header and nowhere else.
  const uses = [...ROUTE.matchAll(/key/g)].length;
  assert.ok(uses > 0, 'sanity: the route talks about the key');
  assert.match(ROUTE, /'x-goog-api-key': key/,
    'the key is sent in the header, not in a URL or a body');
  // The request URL is built from the model name alone. A key in a query
  // string ends up in proxy logs and in error messages; a header does not.
  const urlLine = ROUTE.split('\n').find((l) => l.includes('generativelanguage'));
  assert.ok(urlLine && !urlLine.includes('key='),
    'the request URL must not carry the key');
  assert.ok(!/res\.json\([^)]*\bkey\b/.test(ROUTE) && !/json\(\{\s*key/.test(ROUTE),
    'and never in a response body');
  for (const page of ['key.html', 'index.html']) {
    const text = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.ok(!/GEMINI_API_KEY|ANTHROPIC_API_KEY/.test(text),
      `${page} must not name a server key`);
    assert.ok(!/x-goog-api-key/.test(text), `${page} must not build the Google call itself`);
  }
});

test('the page calls the reading route, and says who it is sending to', () => {
  assert.match(PAGE, /await fetch\('\/api\/key-reading'/,
    'the AI pass must call the private reading route');
  assert.match(PAGE, /to Gemini, Google's model/,
    'and the warning above the button must name where the words go');
  assert.ok(!/const SYSTEM = `/.test(PAGE),
    'the prompt lives on the server now — one voice, one place');
  assert.match(PAGE, /\.filter\(e=>!e\.closest\('\.ai-ask'\) \|\| e\.closest\('\.ai-out'\)\)/,
    'the reading aloud must skip the pitch and keep the answer');
});

test('no page still claims there is no AI in it', () => {
  // The old copy was written when The Key was local-only. It has an AI pass
  // now, and a page that says otherwise is the exact kind of quiet lie this
  // repo keeps a rule about.
  for (const line of PAGE.split('\n')) {
    assert.ok(!/there is no AI in (here|this file)/i.test(line),
      `stale copy survived: ${line.trim().slice(0, 90)}`);
  }
  assert.ok(!/never leaves your phone\b/.test(PAGE),
    'and nothing may promise the answers never leave the phone any more');
});
