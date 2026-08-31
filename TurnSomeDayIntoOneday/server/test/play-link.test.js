// The counted route to the Play listing.
//
// Zero downloads since launch on 26 Aug, and Play reports installs but never
// how many people reached the listing. Without a count on our side there is no
// way to tell "nobody clicked" from "a hundred clicked and none installed" -
// one is a traffic problem, the other is a listing problem, and they are fixed
// in opposite directions.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SERVER = fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');
const DB = fs.readFileSync(path.join(ROOT, 'server', 'db.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

// The sanitiser as shipped, in both files - they must agree.
const clean = (raw) =>
  String(raw || 'direct').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'direct';

test('a source is sanitised to a safe slug, never rejected', () => {
  assert.equal(clean('when-he-drinks'), 'when-he-drinks');
  assert.equal(clean('HOME!!'), 'home');
  assert.equal(clean(''), 'direct');
  assert.equal(clean(undefined), 'direct');
  assert.equal(clean('../../etc/passwd DROP'), 'etcpasswddrop');
  assert.equal(clean('x'.repeat(200)).length, 40);
  assert.equal(clean('!!!'), 'direct', 'a source that sanitises to nothing still redirects');
});

test('the server and the database clean a source the same way', () => {
  const a = SERVER.match(/replace\(\/\[\^a-z0-9-\]\/g, ''\)\.slice\(0, 40\)/g) || [];
  const b = DB.match(/replace\(\/\[\^a-z0-9-\]\/g, ''\)\.slice\(0, 40\)/g) || [];
  assert.ok(a.length && b.length, 'both must sanitise, or a bad slug splits into two rows');
});

test('the redirect carries the referrer Play reads back', () => {
  const fn = SERVER.match(/function playRedirect\([\s\S]*?\n\}/)[0];
  assert.match(fn, /encodeURIComponent\(`utm_source=website&utm_medium=button&utm_campaign=\$\{src\}`\)/,
    'the page that sent them has to survive as far as the install report');
  assert.match(fn, /res\.redirect\(302,/, '302 not 301');
  assert.match(fn, /Cache-Control', 'no-store'/,
    'a cached redirect means the second click is never counted');
});

test('counting can never block the click', () => {
  const fn = SERVER.match(/function playRedirect\([\s\S]*?\n\}/)[0];
  assert.match(fn, /try \{ db\.recordStoreClick\(src\); \} catch/,
    'a broken counter must not stop somebody reaching the store');
});

test('both shapes of the link exist', () => {
  assert.match(SERVER, /app\.get\('\/play', \(req, res\) => playRedirect\(req, res, req\.query\.from\)\)/);
  assert.match(SERVER, /app\.get\('\/play\/:src', \(req, res\) => playRedirect\(req, res, req\.params\.src\)\)/);
});

test('the store URL now lives in one place, not in every page', () => {
  assert.match(SERVER, /const PLAY_URL = 'https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.turnsomedayintodayone\.app'/);
  const stray = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && f !== 'index.html')
    .filter((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('play.google.com/store/apps/details'));
  assert.deepEqual(stray, [], 'these pages still link straight to Google, so their clicks are invisible');
});

test('the service worker never touches /play', () => {
  // Answering a navigation with a redirected response from inside a worker
  // breaks for installed users only - the hardest kind of bug to notice.
  assert.match(SW, /if \(url\.pathname === '\/play' \|\| url\.pathname\.startsWith\('\/play\/'\)\) return;/);
  const i = SW.indexOf("url.pathname === '/play'");
  const j = SW.indexOf('const isPage =');
  assert.ok(i > 0 && i < j, 'the bypass has to come before the page handler, or it never runs');
});

test('the click counter holds no personal data', () => {
  const schema = DB.match(/CREATE TABLE IF NOT EXISTS store_clicks \([\s\S]*?\);/)[0];
  for (const col of ['ip', 'user_agent', 'user_id', 'session', 'email']) {
    assert.doesNotMatch(schema, new RegExp('\\b' + col + '\\b', 'i'), `store_clicks must not hold ${col}`);
  }
  assert.match(schema, /PRIMARY KEY \(day, source\)/, 'one counted row per day per page, nothing per person');
});

test('the owner can actually see the number', () => {
  assert.match(DB, /store_clicks: getStoreClicks\(windowDays\)/, 'it has to reach the admin payload');
  const page = fs.readFileSync(path.join(ROOT, 'admin-stats.html'), 'utf8');
  assert.match(page, /Play listing/, 'and be rendered, or it is a number nobody reads');
});
