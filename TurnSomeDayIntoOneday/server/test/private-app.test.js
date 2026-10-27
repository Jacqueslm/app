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

test('the app, the policy pages and the letter links stay open', () => {
  for (const p of ['/', '/app', '/key', '/admin/stats',
    '/privacy', '/privacy.html', '/delete-account', '/delete-account.html',
    '/letter.html', '/l/abc123',
    '/api/state', '/api/auth/login']) {
    assert.strictEqual(pageIsServed(p), true, `${p} must stay open`);
  }
});

// 5 Oct 2026. The social-bio redirect and the one-click unsubscribe were the
// last two public addresses on the site. Both routes are gone, so both prefixes
// must fall through to the gate rather than being waved past it.
test('the public redirect prefixes are no longer open', () => {
  for (const p of ['/go/yt', '/go/tiktok', '/unsubscribe']) {
    assert.strictEqual(pageIsServed(p), false, `${p} must be shut`);
  }
});

test('the trading pages are gone, all of them', () => {
  // 24 Sep 2026. Jacques: "remove the trading game the desk everything about
  // trading im done." Not gated, not hidden - deleted: the pages, the routes,
  // the candle feed, the TradingView scripts, the charting library, the desk's
  // assistant and the builder scripts that made them. This is the test that
  // notices if any of it comes back.
  const ROOT = path.join(__dirname, '..', '..');
  for (const f of [
    'desk.html', 'desk-assistant.js', 'market-maker.html', 'trading-school.html',
    'server/market-data.js',
    'tradingview', 'vendor/lightweight-charts',
  ]) {
    assert.strictEqual(fs.existsSync(path.join(ROOT, f)), false, `${f} must be deleted, not just unlinked`);
  }
  for (const p of ['/desk', '/desk.html', '/school', '/school.html', '/market-maker.html']) {
    assert.strictEqual(SRC.includes(`app.get('${p}'`), false, `${p} must have no route at all`);
    assert.strictEqual(OPEN_PAGES.includes(p), false, `${p} must not be on the open list either`);
    assert.strictEqual(pageIsServed(p), false, `${p} must not be served`);
  }
  assert.strictEqual(SRC.includes("app.get('/api/candles'"), false, 'the candle feed went with the desk');
  assert.doesNotMatch(SRC, /market-data|marketData/, 'and so did the module it read the feed with');
  assert.doesNotMatch(SRC, /someday-(strategy|frames)\.pine/, 'the TradingView scripts went too');
});

test('the worker has no line left for a trading page', () => {
  // The service worker's offline fallback answers a failed navigation from the
  // shell cache, with no check of any kind. The trading pages each had a line
  // here saying never to cache them; the pages are gone, so the lines are too.
  const SW = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
  assert.doesNotMatch(SW, /market-maker|'\/desk'|'\/school'/, 'nothing trading is named in the worker any more');
});

test('the herb library and the tax centre are behind the door too', () => {
  // Added 15 Sep 2026, on Jacques asking for both "apart of my recovery app but
  // made private". Same door as The Key and the trading game.
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

// The Fight had three tests here: its three addresses behind the door, the same
// three exercised over HTTP so express.static could not answer first, and the
// worker's line for them. All three went on 10 Oct 2026 with the fight itself -
// "delete the fight from everywhere". The pages, their routes, their folder of
// pictures and their line in the worker all came out on the same day, so there
// is nothing left for them to guard; the herbs and the Music below are the same
// shape and are still checked the same way.

test('The Music is behind the door too, at both of its addresses', () => {
  // Added 5 Oct 2026: the phone-file player, the ringtone maker and the cover
  // maker, built into the app. Same door as the rest, and the same reason each
  // page needs BOTH addresses: music.html is a real file, so express.static
  // would hand it out by name if only the clean URL were gated.
  for (const [url, file] of [
    ['/music', 'music.html'], ['/music.html', 'music.html'],
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
    assert.ok(fs.existsSync(path.join(__dirname, '..', '..', file)), `${file} must exist`);
  }
  // And the worker leaves both alone, for the reason it leaves /key alone: a
  // cached copy outlives the check that let it in.
  const SW = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
  assert.match(SW, /\['\/music', '\/music\.html'\]\.includes\(url\.pathname\)\) return;/,
    'both addresses must be skipped by the worker');
});

// The Trainer's two tests came back here on 11 Oct 2026, the day after the page
// that had them was deleted. Jacques: "then create the trainer we will be slowly
// so start off with just basic input information that's it" - so the page behind
// them is smaller than the one that went, but the door, the two routes and the
// worker's line are the same shape they had from 9 Oct 2026.
test('The Trainer is behind the door too, at both of its addresses', () => {
  // Same door as The Music above, and the same reason each page needs BOTH
  // addresses: trainer.html is a real file, so express.static would hand it out
  // by name to anybody who typed it if only the clean URL were gated.
  for (const [url, file] of [
    ['/trainer', 'trainer.html'], ['/trainer.html', 'trainer.html'],
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
    assert.ok(fs.existsSync(path.join(__dirname, '..', '..', file)), `${file} must exist`);
  }
  // And the worker leaves both alone, for the reason it leaves /key alone: a
  // cached copy outlives the check that let it in.
  const SW = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
  assert.match(SW, /\['\/trainer', '\/trainer\.html'\]\.includes\(url\.pathname\)\) return;/,
    'both addresses must be skipped by the worker');
});

test('a signed-out request for the trainer never gets the file', async () => {
  // The test above reads the source. This one makes the request, because the
  // failure it cannot see is the one that matters here: if express.static ever
  // got to answer /trainer.html first, the page would be served cold to anybody
  // who typed the name, and every assertion above would still pass.
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
    ['/trainer', 'trainer.html'], ['/trainer.html', 'trainer.html'],
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
      ['/trainer', 'trainer.html'], ['/trainer.html', 'trainer.html'],
    ]) {
      const cold = await get(url);
      assert.strictEqual(cold.status, 302, `${url}: signed out must be redirected, not served`);
      assert.strictEqual(cold.location, '/app', `${url}: and sent to the app`);
      assert.ok(!cold.body.includes('The Trainer'),
        `${url}: no part of the page may come back with the redirect`);

      // And the file it points at is a real file, so the check above is not
      // passing because the page is missing.
      assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist, or this test proves nothing`);

      const warm = await get(url, true);
      assert.strictEqual(warm.status, 200, `${url}: signed in and on the list gets the page`);
      assert.match(warm.body, /<h1>The Trainer<\/h1>/, `${url}: and it is the page itself`);
    }
  } finally {
    server.close();
  }
});

// The home screen is the only way in, so a door removed without the shell's own
// count changing is an app that tells the person something untrue about itself.
// This test proved the trainer's door was there from 9 Oct 2026, did the
// opposite job from 10 Oct (keeping the door from creeping back onto a shell of
// three), and does the first job again from 11 Oct 2026 - the day the trainer
// came back as a smaller page.
test('the trainer has its door on the home screen, and the shell counts it', () => {
  const HUB = fs.readFileSync(path.join(__dirname, '..', '..', 'hub.html'), 'utf8');
  assert.match(HUB, /href="\/trainer"/, 'the trainer must have a door on the home screen');
  assert.match(HUB, /The Trainer/, 'and the shell must name it');
  // 12 Oct 2026: The Certification became the fifth door, so the shell's count
  // moved with it. This assertion did the opposite job while the fight's door was
  // coming off the app; a door added on purpose has to change the number here,
  // which is exactly why the line is worth pinning rather than leaving to drift.
  //
  // 21 Oct 2026: The Body and The Book of Spells made it seven, so the number
  // moved again. 27 Oct 2026: The Book of Spells came off the app at "Remove the
  // book of spells", so it is six. The old counts are asserted absent, so a shell
  // that says five while holding six fails here rather than quietly lying on the
  // home screen.
  assert.match(HUB, /Six doors\. That is the whole app\./, 'the shell must count the six it holds');
  assert.doesNotMatch(HUB, /Seven doors/, 'nothing may still say seven');
  assert.doesNotMatch(HUB, /Five doors/, 'nothing may still say five');
  assert.doesNotMatch(HUB, /Four doors/, 'nothing may still say four');
  assert.doesNotMatch(HUB, /Three doors/, 'nothing may still say three');
  // The Fight was one of those doors until 10 Oct 2026, when the whole thing
  // came off the app - "delete the fight from everywhere". Its card, its colour
  // and its page went that day, and this is the line that keeps its door from
  // creeping back onto a shell that no longer holds it.
  assert.doesNotMatch(HUB, /href="\/fight"/, 'the fight must have no door on the home screen');
  // A door is only honest if there is something behind it, and a page that is
  // gone takes its file with it: the fight's is still gone.
  assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'trainer.html')),
    'trainer.html must be in the repository, or the door leads nowhere');
  assert.ok(!fs.existsSync(path.join(__dirname, '..', '..', 'fight.html')),
    'fight.html must still be gone from the repository');
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
    '/icons/icon-512.png', '/audio/sos.mp3', '/robots.txt',
    '/index.css']) {
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
  // The marketing routes the gate used to be checked against are gone entirely
  // as of 5 Oct 2026, so the check is now that none of them came back.
  assert.strictEqual(at("app.get('/quiz'"), -1, 'no marketing route may be registered');
  assert.strictEqual(at("app.get('/for-her'"), -1, 'no marketing route may be registered');
  assert.strictEqual(at("app.get('/play'"), -1, 'the store route may not come back');
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

// The Certification came onto the app on 12 Oct 2026, behind the same door as
// the rest. Same shape as The Trainer's tests above, and for the same two
// reasons: certify.html is a real file (so express.static would hand it out by
// name if only the clean URL were gated), and the worker's offline fallback will
// serve a cached page with no check at all (so it has to be left alone).
test('The Certification is behind the door, at both of its addresses', () => {
  for (const [url, file] of [
    ['/certify', 'certify.html'], ['/certify.html', 'certify.html'],
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
    assert.ok(fs.existsSync(path.join(__dirname, '..', '..', file)), `${file} must exist`);
  }
  const SW = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
  assert.match(SW, /\['\/certify', '\/certify\.html'\]\.includes\(url\.pathname\)\) return;/,
    'both addresses must be skipped by the worker');
});

test('a signed-out request for the certification never gets the file', async () => {
  // The test above reads the source. This one makes the request, because the
  // failure it cannot see is the one that matters: if express.static ever got to
  // answer first, the page would be served cold to anybody who typed the name.
  const express = require('express');
  const ROOT = path.join(__dirname, '..', '..');
  const app = express();
  const gate = (file) => (req, res) => {
    if (req.get('x-signed-in') !== 'yes') return res.redirect('/app');
    res.sendFile(path.join(ROOT, file));
  };
  for (const [url, file] of [
    ['/certify', 'certify.html'], ['/certify.html', 'certify.html'],
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
      ['/certify', 'certify.html'], ['/certify.html', 'certify.html'],
    ]) {
      const cold = await get(url);
      assert.strictEqual(cold.status, 302, `${url}: signed out must be redirected, not served`);
      assert.strictEqual(cold.location, '/app', `${url}: and sent to the app`);
      assert.ok(!cold.body.includes('The Certification'),
        `${url}: no part of the page may come back with the redirect`);

      assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist, or this test proves nothing`);

      const warm = await get(url, true);
      assert.strictEqual(warm.status, 200, `${url}: signed in and on the list gets the page`);
      assert.match(warm.body, /<h1 id="title">The Certification<\/h1>/, `${url}: and it is the page itself`);
    }
  } finally {
    server.close();
  }
});

test('the certification has its door on the home screen', () => {
  const HUB = fs.readFileSync(path.join(__dirname, '..', '..', 'hub.html'), 'utf8');
  assert.match(HUB, /href="\/certify"/, 'the certification must have a door on the home screen');
  assert.match(HUB, /The Certification/, 'and the shell must name it');
  assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'certify.html')),
    'certify.html must be in the repository, or the door leads nowhere');
});

// --- The Body, 21 Oct 2026 --------------------------------------------------
// Added at "add a part on my app about the organs ... then when you finish that
// research spells and write me a book of spells in the app both using its on
// page". The Body is a real FILE as well as a clean URL, so it needs both
// addresses gated above express.static and left out of the worker's cache -
// exactly the reasons every page above it is checked. The Book of Spells, which
// arrived with it, came off the app on 27 Oct 2026 - "Remove the book of
// spells" - so the last assertion here now holds the worker to the opposite.
test('The Body is behind the door, at both addresses', () => {
  for (const [url, file] of [
    ['/body', 'body.html'], ['/body.html', 'body.html'],
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
    assert.ok(fs.existsSync(path.join(__dirname, '..', '..', file)), `${file} must exist`);
  }
  const SW = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
  assert.match(SW,
    /\['\/body', '\/body\.html'\]\.includes\(url\.pathname\)\) return;/,
    'both body addresses must be skipped by the worker');
  assert.doesNotMatch(SW, /'\/spells'/,
    'the Book of Spells came off the app, so the worker holds up no page for it');
});

test('a signed-out request for the body never gets the file', async () => {
  // The test above reads the source. This one makes the request, because the
  // failure it cannot see is the one that matters: if express.static ever got to
  // answer first, the page would be served cold to anybody who typed the name.
  const express = require('express');
  const ROOT = path.join(__dirname, '..', '..');
  const app = express();
  const gate = (file) => (req, res) => {
    if (req.get('x-signed-in') !== 'yes') return res.redirect('/app');
    res.sendFile(path.join(ROOT, file));
  };
  const PAIRS = [
    ['/body', 'body.html', '<h1>The Body</h1>'],
    ['/body.html', 'body.html', '<h1>The Body</h1>'],
  ];
  for (const [url, file] of PAIRS) app.get(url, gate(file));
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
    for (const [url, file, title] of PAIRS) {
      const cold = await get(url);
      assert.strictEqual(cold.status, 302, `${url}: signed out must be redirected, not served`);
      assert.strictEqual(cold.location, '/app', `${url}: and sent to the app`);
      assert.ok(!cold.body.includes(title),
        `${url}: no part of the page may come back with the redirect`);

      assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist, or this test proves nothing`);

      const warm = await get(url, true);
      assert.strictEqual(warm.status, 200, `${url}: signed in and on the list gets the page`);
      assert.ok(warm.body.includes(title), `${url}: and it is the page itself`);
    }
  } finally {
    server.close();
  }
});

test('the message says why, and claims nothing', () => {
  assert.match(TURNED_AWAY, /private/);
  assert.match(TURNED_AWAY, /emails on its list/);
  for (const banned of ['research', 'brain', 'chemical', 'study', 'proven', 'finished']) {
    assert.ok(!TURNED_AWAY.toLowerCase().includes(banned),
      `the door must not say "${banned}"`);
  }
});
