// The way back in by email — the accounts build (server.js).
//
// 13 Oct 2026: Jacques asked for a real forgotten-password flow - let a user set
// a new password - rather than the option simply being absent from the sign-in
// screen. The accounts build had the whole thing already: a one-time token, a
// link by email, a page to type the new word into, and every other device
// signed out the moment it changes. But nothing on the sign-in screen reached
// it any more, so from a phone it did not exist.
//
// This is the one test here that drives the real server instead of reading its
// source. It is booted as a child process against a throwaway database on a
// spare port, and the flow is walked the way a phone walks it. The token is
// read out of that throwaway database - which is where the email would have
// carried it from. Asserting that the handler mentions the right helper would
// pass just as happily with the helper wired up backwards; this would not.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const SERVER = path.join(__dirname, '..', 'server.js');
const PORT = 4631;
const BASE = 'http://127.0.0.1:' + PORT;
const EMAIL = 'reset-flow@test.com';
const FIRST = 'the-first-word';
const SECOND = 'the-second-word';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-reset-'));
const DB = path.join(DIR, 'test.sqlite');

let child;

// The server reads its configuration once, at load, so everything it needs is
// handed to it here rather than set in this process.
function childEnv(extra) {
  return Object.assign({}, process.env, {
    PORT: String(PORT),
    DB_PATH: DB,
    SESSION_SECRET: 'a-test-secret-long-enough-to-sign-with',
    APP_URL: 'https://example.test',
    // An empty list leaves the door open, so these tests are about the way back
    // and not about who is allowed in.
    FRIENDLY_EMAILS: '',
    NODE_ENV: 'test',
  }, extra || {});
}

async function up(port, deadlineMs) {
  const deadline = Date.now() + (deadlineMs || 30000);
  for (;;) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/api/auth/me');
      if (res.status) return;
    } catch (_) { /* not listening yet */ }
    if (Date.now() > deadline) throw new Error('the server never came up on port ' + port);
    await new Promise((done) => setTimeout(done, 120));
  }
}

function post(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
}

// The token the email would have carried, read back out of the database the
// server just wrote it to. Retried, because two processes touch one file.
function tokenFor(email) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const db = new DatabaseSync(DB);
    try {
      const row = db.prepare(
        'SELECT p.token FROM password_resets p JOIN users u ON u.id = p.user_id '
        + 'WHERE u.email = ? ORDER BY p.rowid DESC LIMIT 1',
      ).get(email);
      if (row && row.token) return row.token;
    } catch (_) { /* busy; ask again */ } finally {
      db.close();
    }
  }
  return null;
}

before(async () => {
  child = spawn(process.execPath, [SERVER], {
    // DRY_RUN is "a send succeeded without calling Resend" - the mail half is
    // not what is under test here, and no test should post real mail.
    env: childEnv({ EMAIL_DRY_RUN: '1', RESEND_API_KEY: '' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await up(PORT);
  const res = await post(BASE + '/api/auth/signup', { email: EMAIL, password: FIRST });
  assert.equal(res.status, 201, 'the account the reset is for');
});

after(() => {
  if (child) child.kill();
  fs.rmSync(DIR, { recursive: true, force: true });
});

test('the whole way back, walked the way a phone walks it', async () => {
  const asked = await post(BASE + '/api/auth/forgot', { email: EMAIL });
  assert.equal(asked.status, 200);
  const reply = await asked.json();
  assert.match(reply.message, /reset link is on its way/, 'the server says a link was sent');

  const token = tokenFor(EMAIL);
  assert.ok(token, 'and the one-time token really was written down');

  const done = await post(BASE + '/api/auth/reset', { token, newPassword: SECOND });
  assert.equal(done.status, 200, 'the link sets the new word');

  const old = await post(BASE + '/api/auth/login', { email: EMAIL, password: FIRST });
  assert.equal(old.status, 401, 'the old word stops working');
  const fresh = await post(BASE + '/api/auth/login', { email: EMAIL, password: SECOND });
  assert.equal(fresh.status, 200, 'and the new one opens the door');
});

test('a link works once, then never again', async () => {
  await post(BASE + '/api/auth/forgot', { email: EMAIL });
  const token = tokenFor(EMAIL);
  assert.ok(token, 'a fresh token for this test');

  const first = await post(BASE + '/api/auth/reset', { token, newPassword: 'a-third-word' });
  assert.equal(first.status, 200);

  const again = await post(BASE + '/api/auth/reset', { token, newPassword: 'a-fourth-word' });
  assert.equal(again.status, 400, 'the same link cannot set a password twice');
  const leaked = await post(BASE + '/api/auth/login', { email: EMAIL, password: 'a-fourth-word' });
  assert.equal(leaked.status, 401, 'and the second attempt never landed');
});

test('an address with no account gets the identical answer, and no token', async () => {
  const stranger = 'nobody-here@test.com';
  const res = await post(BASE + '/api/auth/forgot', { email: stranger });
  assert.equal(res.status, 200, 'the same status as a real account');
  const reply = await res.json();
  assert.match(reply.message, /reset link is on its way/,
    'and the same words - this endpoint must never confirm who has an account');
  assert.equal(tokenFor(stranger), null, 'and nothing was written down for them');
});

test('with no way to send mail the answer says so, instead of promising a link', async () => {
  // No key AND no dry-run: every send on this boot is skipped in silence, so
  // "check your inbox" would be a flat lie to everybody who asks.
  const port = PORT + 1;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-reset-bare-'));
  const bare = spawn(process.execPath, [SERVER], {
    env: childEnv({ PORT: String(port), DB_PATH: path.join(dir, 'bare.sqlite'), EMAIL_DRY_RUN: '', RESEND_API_KEY: '' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await up(port);
    const res = await post('http://127.0.0.1:' + port + '/api/auth/forgot', { email: EMAIL });
    assert.equal(res.status, 503, 'not a 200 with a link that was never sent');
    const body = await res.json();
    assert.match(body.error, /not set up on this server/i, 'it names the real situation');
    assert.match(body.error, /RESEND_API_KEY/, 'and the setting that fixes it');
    assert.doesNotMatch(body.error, /on its way/, 'and never claims a link was sent');
  } finally {
    bare.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the link in the email is the page that sets the password', () => {
  // Source-level on purpose: dry-run mail never exposes its own body, and this
  // is the one string that has to agree across three files at once - the
  // address the email points at, the route the page posts to, and the file
  // express.static serves.
  const emailjs = fs.readFileSync(path.join(__dirname, '..', 'email.js'), 'utf8');
  assert.match(emailjs, /\/reset\.html\?token=\$\{token\}/,
    'the email points at the reset page with the token in it');

  const page = fs.readFileSync(path.join(__dirname, '..', '..', 'reset.html'), 'utf8');
  assert.match(page, /fetch\('\/api\/auth\/reset'/, 'the page posts to the reset route');
  assert.match(page, /newPassword/, 'with the shape that route reads');
  assert.match(page, /Forgot your password\?/,
    'and it sends somebody whose link expired back to the option that exists');
});
