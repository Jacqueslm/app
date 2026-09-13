// Studio is part of this app now (13 Sep 2026).
//
// It used to be a separate program on a separate computer, with its own
// sign-in, its own cookie and its own accounts. It is served at /studio from
// this server and its API is mounted at /api/studio, so there must be exactly
// ONE sign-in — and Studio must never be reachable without it.
//
// Two failures are worth a test because neither makes a sound: Studio answering
// somebody who is not signed in (the whole point of the private app, undone by
// one missing middleware), and a second account being created for a person who
// already has one, every time they open a screen.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Both databases have to exist before anything requires them, and both must be
// throwaway: the real files hold Jacques's data and his wife's.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-studio-'));
process.env.DB_PATH = path.join(TMP, 'app.sqlite');
process.env.STUDIO_DATA_DIR = path.join(TMP, 'studio');

const express = require('express');
const cookieParser = require('cookie-parser');
const appDb = require('../db');
const auth = require('../auth');
const studio = require('../studio/studio');
const studioDb = require('../studio/db');
const { studioUserIdFor } = require('../studio/auth');
const { pageIsServed } = require('../private-app');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('the /studio page is not shut with the marketing pages', () => {
  assert.strictEqual(pageIsServed('/studio'), true, '/studio must be reachable');
  assert.strictEqual(pageIsServed('/studio.html'), false, 'the file itself stays shut');
});

test('the app serves the Studio screen and mounts its API behind the app session', () => {
  assert.match(SRC, /app\.get\('\/studio', \(req, res\) => \{/);
  assert.match(SRC, /app\.use\('\/api\/studio', requireAuth, studio\.router\)/,
    'the mount must carry the app\'s own requireAuth, not just the router\'s');
  assert.match(SRC, /require\('\.\/studio\/studio'\)/);
});

test('Studio answers nobody who is not signed in to the app', async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/studio', auth.requireAuth, studio.router);
  const server = app.listen(0);
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const anon = await fetch(`${base}/api/studio/config`);
    assert.strictEqual(anon.status, 401, 'signed out must mean no Studio');

    const id = appDb.createUser('owner@example.com', auth.hashPassword('password123'));
    const cookie = `${auth.COOKIE_NAME}=${auth.signSession(id)}`;
    const first = await fetch(`${base}/api/studio/config`, { headers: { cookie } });
    assert.strictEqual(first.status, 200, 'the app session must be the whole sign-in');
    await first.json();

    const second = await fetch(`${base}/api/studio/config`, { headers: { cookie } });
    assert.strictEqual(second.status, 200);
  } finally {
    server.close();
  }
});

test('one person gets one Studio row, however many times they ask', () => {
  const email = 'owner@example.com';
  const first = studioUserIdFor(email);
  assert.ok(first, 'a signed-in app account must resolve to a Studio row');
  assert.strictEqual(studioUserIdFor(email), first, 'the same person reuses their row');
  assert.strictEqual(studioUserIdFor(' OWNER@example.com '), first,
    'the email decides, not the spacing or the capitals');
  assert.ok(studioDb.getUserByEmail(email));

  const other = studioUserIdFor('wife@example.com');
  assert.ok(other && other !== first, 'a second person gets their own row');
});

test('Studio never invents an account from nothing', () => {
  assert.strictEqual(studioUserIdFor(''), null);
  assert.strictEqual(studioUserIdFor(null), null);
});
