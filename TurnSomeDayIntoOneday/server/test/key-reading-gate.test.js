// /api/key-reading, exercised for real rather than grepped.
//
// key-reading.test.js reads the route as text, which catches a rule being
// deleted but not a route that is wired up wrong — the mount order, a missing
// cookie parser, a gate that is checked after the call to Google. So this file
// boots the route in a throwaway express app, on a throwaway database, and
// makes the actual requests. No network: the call to Google is intercepted and
// handed a canned answer, so what is asserted is what the route does, not what
// Google does.
//
// The one thing worth having here rather than in a comment: the gate is checked
// BEFORE anything is sent, both locks, in that order.
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('node:http');

// Before anything in server/ is required: a throwaway database, so a test run
// can never touch the real one, and a fixed session secret.
const DB_FILE = path.join(os.tmpdir(), `key-gate-${process.pid}.sqlite`);
process.env.DB_PATH = DB_FILE;
process.env.SESSION_SECRET = 'test-secret-not-a-real-one';

const express = require('express');
const db = require('../db');
const auth = require('../auth');
const route = require('../key-reading-route');
const prompt = require('../key-reading');

const OWNER = 'owner@example.com';
const OTHER = 'somebody@example.com';
const ownerId = db.createUser(OWNER, 'x', null);
const otherId = db.createUser(OTHER, 'x', null);

// The canned Gemini answer: two parts, to prove they are joined rather than
// truncated to the first.
const CANNED = {
  candidates: [{ content: { parts: [{ text: 'WHAT YOU WROTE THAT THE SLIDERS COULD NOT SHOW\n' },
                               { text: 'You said it plainly.' }] } }],
};
let sent = [];
const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  if (String(url).includes('generativelanguage')) {
    sent.push({ url: String(url), opts: opts || {} });
    return new Response(JSON.stringify(CANNED), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, opts);
};

// Two mounts of the same route, because the only difference between them is
// whether the server has a Gemini key: one has none, one has a fake.
const servers = [];
function start(geminiKey, allowed) {
  const app = express();
  route.mount(app, {
    isFriendlyRequest: (req) => allowed(req),
    gemini: { key: geminiKey, model: 'gemini-3.6-flash' },
    ownerEmail: () => OWNER,
  });
  return new Promise((resolve) => {
    const s = http.createServer(app).listen(0, '127.0.0.1', () => {
      servers.push(s);
      resolve(`http://127.0.0.1:${s.address().port}`);
    });
  });
}

const cookieFor = (id) => {
  const u = db.getUserById(id);
  return `${auth.COOKIE_NAME}=${auth.signSession(id, u.session_version || 1)}`;
};

const post = (base, cookie, body) => fetch(`${base}/api/key-reading`, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    cookie ? { Cookie: cookie } : {}),
  body: JSON.stringify(body || {}),
});

after(() => {
  for (const s of servers) s.close();
  try { fs.unlinkSync(DB_FILE); } catch (_) {}
});

test('nobody signed in gets nothing, key or no key', async () => {
  const withKey = await start('fake-key', () => true);
  const noKey = await start('', () => true);
  const before = sent.length;
  for (const base of [withKey, noKey]) {
    const r = await post(base, null, { who: 'x', message: 'THEIR READING' });
    assert.strictEqual(r.status, 401, 'signed out must be a 401, not a reading');
  }
  assert.strictEqual(sent.length, before, 'and nothing may reach Google on the way');
});

test('signed in but off the list gets a 403, and Google is never called', async () => {
  const base = await start('fake-key', (req) => req.userId === ownerId);
  const before = sent.length;
  const r = await post(base, cookieFor(otherId), { who: 'Somebody', message: 'THEIR READING' });
  assert.strictEqual(r.status, 403);
  const body = await r.json();
  assert.ok(!body.text, 'a refusal must not carry a reading');
  assert.strictEqual(sent.length, before,
    'the allowlist is checked BEFORE the call to Gemini, not after it');
});

test('on the list with no key on the server is a 503 that names the reason to the owner only', async () => {
  const base = await start('', () => true);
  const mine = await post(base, cookieFor(ownerId), { who: 'Owner', message: 'THEIR READING' });
  assert.strictEqual(mine.status, 503);
  const body = await mine.json();
  assert.match(body.ownerError || '', /GEMINI_API_KEY/,
    'the owner is told which variable is missing, so it is fixable');
  assert.ok(!/GEMINI_API_KEY/.test(body.error || ''),
    'everybody else gets the plain sentence and no server detail');
});

test('an empty body is a 400 without spending a call', async () => {
  const base = await start('fake-key', () => true);
  const before = sent.length;
  const r = await post(base, cookieFor(ownerId), {});
  assert.strictEqual(r.status, 400);
  const r2 = await post(base, cookieFor(ownerId), { message: '   ' });
  assert.strictEqual(r2.status, 400, 'whitespace is not an answer either');
  assert.strictEqual(sent.length, before);
});

test('a real reading goes out with the key in a header, the whole 48 weeks, and comes back as text', async () => {
  const base = await start('fake-key', () => true);
  const r = await post(base, cookieFor(ownerId), {
    who: 'Jacques', message: 'THEIR READING\nBorn July 3.\n\nWHAT THEY WROTE, IN THEIR OWN WORDS\nA hard year:\nI stopped lying about it.',
  });
  assert.strictEqual(r.status, 200);
  const out = await r.json();
  assert.strictEqual(out.text, 'WHAT YOU WROTE THAT THE SLIDERS COULD NOT SHOW\nYou said it plainly.',
    'every part of the answer is used, and they are joined in order');
  assert.strictEqual(out.model, 'gemini-3.6-flash');

  assert.strictEqual(sent.length, 1);
  const { url, opts } = sent[0];
  assert.ok(!url.includes('fake-key'), 'the key is never in the URL');
  assert.strictEqual(opts.headers['x-goog-api-key'], 'fake-key', 'it travels in the header');
  const payload = JSON.parse(opts.body);
  const sys = payload.systemInstruction.parts[0].text;
  for (const p of prompt.periods()) {
    assert.ok(sys.includes(p.n), `the model is handed ${p.n}`);
  }
  assert.match(payload.contents[0].parts[0].text, /I stopped lying about it\./,
    'their own words reach the model, unaltered');
  assert.match(payload.contents[0].parts[0].text, /Jacques/);
  assert.ok(!JSON.stringify(out).includes('fake-key'),
    'and the key comes back out in no response body');
});
