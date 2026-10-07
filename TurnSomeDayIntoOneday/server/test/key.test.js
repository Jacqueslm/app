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
// 4 Oct 2026: the app became three things and its shell moved to hub.html. The
// door to /key is a card on that shell now rather than a settings row and a bar
// tab inside the recovery app, so the three tests below read the shell that is
// actually served.
const APP = fs.readFileSync(path.join(ROOT, 'hub.html'), 'utf8');
const SERVER = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const ROBOTS = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');

test('the shell carries a door to /key', () => {
  const card = APP.match(/<a class="card z" href="\/key">/);
  assert.ok(card, 'the Zodiacs card must exist on the shell and open /key');
  // The door answers "where do I go" from one place now. The old build had it
  // twice - a settings row and a bar tab - and two doors that can disagree is
  // how one of them ends up visible to somebody it should not be.
  assert.strictEqual(APP.split('href="/key"').length - 1, 1,
    'exactly one door to /key, not two that can drift apart');
});

test('the door is shut until the server says this account is on the list', () => {
  // The three cards are hidden in the markup and only revealed by the script,
  // so a failed or never-run check leaves them shut rather than half-open. This
  // is the recovery app's rule carried across: hide by default, open on an
  // answer from the server, never on a decision made in the browser.
  assert.match(APP, /<section id="open" class="cards" hidden>/,
    'the cards must start hidden in the markup');
  assert.match(APP, /fetch\('\/api\/auth\/me'/,
    'and the shell must ask the server who this is rather than deciding itself');
  assert.match(APP, /if \(me && me\.email\) showOpen\(me\.email\);\s*\n\s*else showLocked\(\);/,
    'me with an email opens the cards; anything else gets the lock');
  assert.match(SERVER, /app\.get\('\/api\/auth\/me', requireAuth, \(req, res\) => \{/,
    '/api/auth/me must require a session, or the shell opens for anybody');
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
  // The AI pass used to go through Friendly's /api/chat, which could not carry
  // this app's 48 weeks. It has its own private route now, gated the same way.
  assert.match(page, /\/api\/key-reading/,
    'the AI lives on the server, reached by calling /api/key-reading');
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
