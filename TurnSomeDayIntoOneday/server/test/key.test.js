// The Key — the private Life's Zodiacs at /key.
//
// Four locks hold the page shut (private/INSTALL.md in the Zodiac repo), and
// every one of them is a single line that a later edit can quietly undo:
//
//   1. /key.html 404s, and that 404 must stay ABOVE express.static — whichever
//      is registered first wins, and static would hand the page to anybody who
//      typed the URL.
//   2. /key checks the session, then the allowlist, and sends anyone else to
//      /app without telling them the page exists.
//   3. /api/chat checks the allowlist again server-side.
//   4. noindex in the page, Disallow: /key in robots.txt.
//
// Added 11 Sep 2026, when the home-screen door was added. The door is the one
// piece of this that is visible, so the rule it has to keep is the opposite of
// the others: it must be invisible unless the server has said yes, and the
// page must never be left in the offline cache.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const APP = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SERVER = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const ROBOTS = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');

test('the home screen has a door to /key', () => {
  const row = APP.match(/<div class="setting-row[^"]*" data-friendly="1" id="home-key-row"[^>]*onclick="location\.href='\/key'"/);
  assert.ok(row, 'home-key-row must exist on the home screen and open /key');
  assert.match(row[0], /\bfriendly-door\b/,
    'and it must carry friendly-door, or it is visible before the server has said yes');
});

test('the door is hidden unless the server says this account is on the list', () => {
  // Hidden in CSS by default, so a failed or never-run access check leaves the
  // door shut rather than half-open.
  assert.match(APP, /\.friendly-door\{display:none!important\}/,
    'friendly-door must be hidden in CSS, not by a class the script adds');
  // The only thing that opens it, and the answer comes from the server.
  assert.match(APP, /document\.querySelectorAll\('\[data-friendly\]'\)\.forEach/,
    'applyFriendlyAccess must toggle the class on every data-friendly element');
  assert.match(APP, /fetch\('\/api\/friendly\/access'\)/,
    'and ask the server rather than deciding on the client');
  assert.match(SERVER, /app\.get\('\/api\/friendly\/access', requireAuth, \(req, res\) => \{\s*res\.json\(\{ allowed: isFriendlyAllowed\(/,
    '/api/friendly/access must require auth and answer from the allowlist');
});

test('the /key.html 404 is registered above express.static', () => {
  const block = SERVER.indexOf("app.get('/key.html'");
  const stat = SERVER.indexOf("app.use(express.static(path.join(__dirname, '..')))");
  assert.ok(block > -1, 'the /key.html 404 must exist');
  assert.ok(stat > -1, 'and express.static must exist');
  assert.ok(block < stat,
    'the 404 must come first — express.static would serve the page to anyone who typed the URL');
});

test('/key checks the session, then the allowlist, and redirects both failures', () => {
  const route = SERVER.slice(SERVER.indexOf("app.get('/key',"), SERVER.indexOf("app.get('/key',") + 400);
  assert.match(route, /if \(!isValidSession\(req\)\) return res\.redirect\('\/app'\)/,
    'signed out goes to /app, not a 401 and not an explanation');
  assert.match(route, /if \(!isFriendlyRequest\(req\)\) return res\.redirect\('\/app'\)/,
    'signed in but off the list goes to /app too');
  assert.match(route, /res\.sendFile\(/, 'and only then is the page sent');
});

test('the AI refuses anyone off the list, server-side', () => {
  const chat = SERVER.slice(SERVER.indexOf("app.post('/api/chat'"));
  assert.match(chat.slice(0, 4000), /isFriendlyAllowed\(/,
    '/api/chat must re-check the allowlist itself, not trust the page');
});

test('robots.txt keeps crawlers out', () => {
  assert.match(ROBOTS, /^Disallow:\s*\/key\s*$/m, 'robots.txt must carry Disallow: /key');
});

test('the private page is present, noindex, and carries no key of its own', () => {
  const page = fs.readFileSync(path.join(ROOT, 'key.html'), 'utf8');
  assert.match(page, /noindex/, 'the page carries its own noindex, which a crawler cannot ignore');
  assert.ok(!/sk-ant/.test(page), 'the AI key must never be in the page');
  assert.ok(!/apiKey|API_KEY/.test(page), 'nor named in it');
  assert.match(page, /\/api\/chat/, 'the AI lives on the server, reached by calling /api/chat');
});

test('the service worker never caches the private page', () => {
  // A cached 200 for /key sits in the shell cache, and the offline fallback
  // would then serve it with no session and no allowlist check at all.
  const fetch = SW.indexOf("self.addEventListener('fetch'");
  const skip = SW.indexOf("if (url.pathname === '/key'");
  const firstCache = SW.indexOf('event.respondWith', fetch);
  assert.ok(skip > -1, 'sw.js must skip /key');
  assert.ok(skip > fetch && skip < firstCache,
    'and skip it before any handler can cache or answer it');
});

test('no .bak files from the installer are shipped', () => {
  // private/install.js keeps server.js.bak and robots.txt.bak beside the
  // originals. robots.txt.bak would be readable at the site root.
  const strays = ['robots.txt.bak', path.join('server', 'server.js.bak')]
    .filter(f => fs.existsSync(path.join(ROOT, f)));
  assert.deepEqual(strays, [], `left in the app: ${strays.join(', ')}`);
});
