// The door on the app — 13 Sep 2026.
//
// Jacques: "just me and wife have access to it through friendly emails." The risk
// in a change like this is not that it fails loudly, it is that it fails quietly
// in one of two directions: somebody who should be let in is not, or the door
// that is supposed to be shut is left open because a variable went missing.
// Both are readable here.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  TURNED_AWAY, parseList, isPrivate, appAllows, doorMiddleware,
  PAGE_GONE, OPEN_PAGES, isPagePath, pageIsServed,
} = require('../private-app');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

// --- the rule ---------------------------------------------------------------

test('a build with no list is the ordinary public app, not a locked one', () => {
  assert.strictEqual(isPrivate([]), false);
  assert.strictEqual(isPrivate(null), false);
  assert.strictEqual(appAllows([], 'anyone@example.com', ''), true);
  assert.strictEqual(appAllows(null, 'anyone@example.com', ''), true);
});

test('two emails on the list close it to everybody else', () => {
  const list = parseList(' him@example.com, wife@example.com ');
  assert.deepStrictEqual(list, ['him@example.com', 'wife@example.com']);
  assert.strictEqual(isPrivate(list), true);
  assert.strictEqual(appAllows(list, 'him@example.com', ''), true);
  // Case and a stray space are the same person, not a locked-out one.
  assert.strictEqual(appAllows(list, ' WIFE@Example.com ', ''), true);
  assert.strictEqual(appAllows(list, 'stranger@example.com', ''), false);
  assert.strictEqual(appAllows(list, '', ''), false);
  assert.strictEqual(appAllows(list, undefined, ''), false);
});

test('the owner gets in even if the list has forgotten about him', () => {
  const list = parseList('wife@example.com');
  assert.strictEqual(appAllows(list, 'owner@example.com', 'owner@example.com'), true);
});

test('parseList drops blanks and duplicates', () => {
  assert.deepStrictEqual(parseList('a@b.com,, A@B.com ,  ,'), ['a@b.com']);
  assert.deepStrictEqual(parseList(''), []);
  assert.deepStrictEqual(parseList(undefined), []);
});

// --- how it is wired in -----------------------------------------------------

test('the door is the Friendly list — no second list to keep in step', () => {
  assert.match(SRC, /appAllows\(FRIENDLY_EMAILS, email, DIAG_OWNER_EMAIL\)/);
});

test('signup stops at the door, before an account exists', () => {
  const route = SRC.match(/app\.post\('\/api\/auth\/signup'[\s\S]*?\n\}\);/);
  assert.ok(route, 'the signup route must still be findable in server.js');
  assert.match(route[0], /mayComeIn\(normalizedEmail\)/);
  assert.match(route[0], /TURNED_AWAY/);
  assert.ok(
    route[0].indexOf('mayComeIn') < route[0].indexOf('db.createUser'),
    'the door has to be checked before the account is created',
  );
});

test('a letter link cannot make an account the list would turn away', () => {
  // A letter is the SECOND way in, and it stood open when the door first went in —
  // exactly the quiet failure this file exists to catch: the front entrance shut,
  // the side one still swinging. Mounted as middleware because it has to run
  // before the route does. The request-level proof is the last test in this file.
  assert.match(SRC, /app\.use\('\/api\/letter\/:token\/accept', doorMiddleware\(mayComeIn\)\);/);
  const at = (needle) => SRC.indexOf(needle);
  assert.ok(
    at("app.use('/api/letter/:token/accept'") < at("app.post('/api/letter/:token/accept'"),
    'middleware only guards the route if it is mounted before it',
  );
  assert.ok(
    at("app.use(express.json(") < at("app.use('/api/letter/:token/accept'"),
    'the guard reads req.body, so it has to run after the body parser',
  );
});

test('login stops at the door, before the password is looked at', () => {
  const route = SRC.match(/app\.post\('\/api\/auth\/login'[\s\S]*?\n\}\);/);
  assert.ok(route, 'the login route must still be findable in server.js');
  assert.match(route[0], /TURNED_AWAY/);
  assert.ok(
    route[0].indexOf('mayComeIn') < route[0].indexOf('verifyPassword'),
    'not-on-the-list has to read the same whether or not the account exists',
  );
});

test('every signed-in route goes through the wrapper, not the raw session check', () => {
  assert.match(SRC, /requireAuth: requireSession/);
  assert.match(SRC, /function requireAuth\(req, res, next\)/);
  const rawCalls = SRC.match(/requireSession\(/g) || [];
  assert.strictEqual(rawCalls.length, 1, 'the raw check is called in exactly one place: the wrapper');
});

// --- the door, for real ------------------------------------------------------
// The tests above read server.js as text. That catches a rule being deleted; it
// does not catch a path pattern that never matches, or middleware mounted after
// the route it is supposed to guard. So this one boots the real middleware in a
// throwaway express app and makes the real request.

test('the letter-link door, exercised over HTTP', async () => {
  const express = require('express');
  const list = parseList('him@example.com, wife@example.com');

  function build(gate) {
    const app = express();
    app.use(express.json());
    app.use('/api/letter/:token/accept', gate);
    app.post('/api/letter/:token/accept', (req, res) => res.status(201).json({ created: true }));
    return app;
  }

  const privateBuild = build(doorMiddleware((email) => appAllows(list, email, '')));
  const openBuild = build(doorMiddleware((email) => appAllows([], email, '')));

  async function post(app, email) {
    const server = app.listen(0);
    await new Promise((done) => server.once('listening', done));
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/letter/tok3n/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'eight-characters' }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    } finally {
      server.close();
    }
  }

  const stranger = await post(privateBuild, 'stranger@example.com');
  assert.strictEqual(stranger.status, 403);
  assert.strictEqual(stranger.body.error, TURNED_AWAY);

  // Off the list means no account is made — the route never runs at all.
  assert.strictEqual(stranger.body.created, undefined);

  // The two people on it get through, whatever case they type their email in.
  assert.strictEqual((await post(privateBuild, ' WIFE@Example.com ')).status, 201);
  assert.strictEqual((await post(privateBuild, 'him@example.com')).status, 201);

  // No list configured is the ordinary public app, exactly as it is for signup.
  assert.strictEqual((await post(openBuild, 'anyone@example.com')).status, 201);
});

// --- the pages, shut the same day -------------------------------------------
// Jacques: "shut down the pages too." Two ways this goes wrong and neither one
// makes a sound: a marketing page left open because it was not on anybody's list
// of things to delete, or the app's own plumbing shut by a rule written too
// widely. Both are asserted here, and the middleware is exercised over HTTP.

test('the marketing pages are gone', () => {
  for (const p of ['/quiz', '/for-her', '/when-he-drinks', '/best-recovery-apps',
    '/reframe-app-alternative', '/reviews', '/brainreset', '/codependency-test',
    '/landing.html', '/quiz.html']) {
    assert.strictEqual(pageIsServed(p), false, `${p} must be shut`);
  }
});

test('the app, the store pages and every link that lands from an email stay open', () => {
  for (const p of ['/', '/app', '/key', '/admin/stats',
    '/privacy', '/privacy.html', '/delete-account', '/delete-account.html',
    '/letter.html', '/game3d.html', '/l/abc123', '/unsubscribe', '/go/yt', '/play',
    '/api/state', '/api/auth/login']) {
    assert.strictEqual(pageIsServed(p), true, `${p} must stay open`);
  }
});

test('the herb library and the tax centre are behind the door too', () => {
  // Added 15 Sep 2026, on Jacques asking for both "apart of my recovery app but
  // made private". Same door as The Key.
  //
  // The part that matters is that EACH ONE IS A REAL FILE with a .html address,
  // so express.static would hand it out by name if the gated route were not
  // registered above it. Four routes, and every one of them has to be gated.
  for (const [url, file] of [
    ['/herbs', 'herbs.html'], ['/herbs.html', 'herbs.html'],
    ['/tax', 'tax.html'], ['/tax.html', 'tax.html'],
  ]) {
    assert.strictEqual(pageIsServed(url), true, `${url} must reach its own route`);
    assert.ok(OPEN_PAGES.includes(url), `${url} must be on the list of pages the gate lets through`);
    const at = SRC.indexOf("app.get('" + url + "'");
    assert.ok(at > -1, `the ${url} route must still be findable in server.js`);
    const block = SRC.slice(at, at + 320);
    assert.match(block, /isValidSession\(req\)/, `${url}: signed out gets nothing`);
    assert.match(block, /isFriendlyRequest\(req\)/, `${url}: off the list gets nothing`);
    assert.match(block, /res\.redirect\('\/app'\)/, `${url}: a page visit goes to the app, not JSON`);
    assert.ok(
      SRC.indexOf("app.get('" + url + "'") < SRC.indexOf('app.use(express.static('),
      `${url} must be registered above static, which would serve the file itself`,
    );
  }
  for (const p of ['/herbs', '/herbs.html', '/tax', '/tax.html']) {
    assert.strictEqual(pageIsServed(p), true, `${p} must be reachable`);
  }
});

test('the worker never caches the herb library or the tax centre', () => {
  const SW = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
  assert.match(SW, /\['\/herbs', '\/herbs\.html', '\/tax', '\/tax\.html'\]\.includes\(url\.pathname\)\) return;/,
    'both pages, and both addresses, must be skipped by the worker');
});

test('a signed-out request for a private reference page never gets the file', async () => {
  // The two tests above read the source. This one makes the request, because the
  // failure they cannot see is the one that matters here: if express.static ever
  // got to answer /herbs.html first, the page would be served cold to anybody who
  // typed the name, and every assertion above would still pass.
  //
  // So: the real express.static over the real app folder, with a gated route
  // registered in front of it exactly as server.js registers it, and an actual
  // fetch. Two things are asserted — the redirect, and that no part of the page
  // comes back with it.
  const express = require('express');
  const ROOT = path.join(__dirname, '..', '..');
  const app = express();
  const gate = (file) => (req, res) => {
    if (req.get('x-signed-in') !== 'yes') return res.redirect('/app');
    res.sendFile(path.join(ROOT, file));
  };
  for (const [url, file] of [
    ['/herbs', 'herbs.html'], ['/herbs.html', 'herbs.html'],
    ['/tax', 'tax.html'], ['/tax.html', 'tax.html'],
  ]) app.get(url, gate(file));
  app.use(express.static(ROOT));
  app.get('/app', (req, res) => res.type('text/plain').send('the app'));

  const server = app.listen(0);
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (p, signedIn) => fetch(base + p, {
    redirect: 'manual',
    headers: signedIn ? { 'x-signed-in': 'yes' } : {},
  }).then(async (r) => ({ status: r.status, location: r.headers.get('location'), body: await r.text() }));
  try {
    for (const [url, file] of [
      ['/herbs', 'herbs.html'], ['/herbs.html', 'herbs.html'],
      ['/tax', 'tax.html'], ['/tax.html', 'tax.html'],
    ]) {
      const cold = await get(url);
      assert.strictEqual(cold.status, 302, `${url}: signed out must be redirected, not served`);
      assert.strictEqual(cold.location, '/app', `${url}: and sent to the app`);
      assert.ok(!cold.body.includes('Herb Library') && !cold.body.includes('Tax Centre'),
        `${url}: no part of the page may come back with the redirect`);

      // And the file it points at is a real file, so the check above is not
      // passing because the page is missing.
      assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist, or this test proves nothing`);

      const warm = await get(url, true);
      assert.strictEqual(warm.status, 200, `${url}: signed in and on the list gets the page`);
      assert.ok(warm.body.length > 2000, `${url}: and it is the page, not a stub`);
    }
  } finally {
    server.close();
  }
});

test('assets are never judged — the app on the phone needs all of them', () => {
  for (const p of ['/sw.js', '/manifest.json', '/icons/icon-192.png',
    '/js/ring3d-three.js', '/audio/sos.mp3', '/robots.txt', '/sitemap.xml',
    '/.well-known/assetlinks.json', '/index.css']) {
    assert.strictEqual(isPagePath(p), false, `${p} is not a page`);
    assert.strictEqual(pageIsServed(p), true);
  }
});

test('a page added tomorrow is shut by default', () => {
  assert.strictEqual(pageIsServed('/a-page-nobody-has-written-yet'), false);
  assert.ok(!OPEN_PAGES.includes('/a-page-nobody-has-written-yet'));
});

test('the gate runs before every page route and before static', () => {
  const at = (needle) => SRC.indexOf(needle);
  const gate = at('if (pageIsServed(req.path)) return next();');
  assert.ok(gate > 0, 'the gate must be in server.js');
  assert.ok(gate < at("app.get('/app'"), 'the app route is below the gate');
  assert.ok(gate < at("app.get('/quiz'"), 'the marketing routes are below the gate');
  assert.ok(gate < at('app.use(express.static('), 'static must not get there first');
  assert.match(SRC, /res\.status\(410\)/, 'a retired page says 410 so a search engine drops it');
});

test('the root no longer sells anything — it sends people to the app', () => {
  const route = SRC.match(/app\.get\('\/', \(req, res\) => \{[\s\S]*?\n\}\);/);
  assert.ok(route, 'the root route must still be findable in server.js');
  assert.match(route[0], /res\.redirect\('\/app'\)/);
  assert.ok(!/landing\.html/.test(route[0]), 'the landing page is not served any more');
});

test('the pages, exercised over HTTP in a throwaway app', async () => {
  const express = require('express');
  const app = express();
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (!isPagePath(req.path)) return next();
    if (pageIsServed(req.path)) return next();
    res.status(410).type('text/plain').send(PAGE_GONE);
  });
  app.get('/app', (req, res) => res.type('text/plain').send('the app'));
  app.get('/privacy', (req, res) => res.type('text/plain').send('the policy'));
  app.get('/quiz', (req, res) => res.type('text/plain').send('the quiz'));
  app.get('/sw.js', (req, res) => res.type('text/plain').send('the worker'));

  const server = app.listen(0);
  await new Promise((done) => server.once('listening', done));
  const get = (p) => fetch(`http://127.0.0.1:${server.address().port}${p}`)
    .then(async (r) => ({ status: r.status, body: await r.text() }));
  try {
    assert.strictEqual((await get('/quiz')).status, 410);
    assert.strictEqual((await get('/quiz')).body, PAGE_GONE);
    assert.strictEqual((await get('/app')).status, 200);
    assert.strictEqual((await get('/privacy')).status, 200);
    assert.strictEqual((await get('/sw.js')).status, 200);
  } finally {
    server.close();
  }
});

test('the pages-closed sentence says nothing it cannot back up', () => {
  for (const banned of ['research', 'brain', 'chemical', 'study', 'proven', 'finished']) {
    assert.ok(!PAGE_GONE.toLowerCase().includes(banned),
      `the closed page must not say "${banned}"`);
  }
});

// --- the words on the door --------------------------------------------------

test('the message says why, and claims nothing', () => {
  assert.match(TURNED_AWAY, /private/);
  assert.match(TURNED_AWAY, /emails on its list/);
  for (const banned of ['research', 'brain', 'chemical', 'study', 'proven', 'finished']) {
    assert.ok(!TURNED_AWAY.toLowerCase().includes(banned),
      `the door must not say "${banned}"`);
  }
});
