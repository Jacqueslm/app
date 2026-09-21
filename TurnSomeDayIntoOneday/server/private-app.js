// The app is private — Jacques, 13 Sep 2026.
//
// His words: "just me and wife have access to it through friendly emails." So the
// door is the list Friendly already uses. Adding somebody stays the one edit in
// Railway it has always been, and there is nothing new to set up anywhere.
//
// AN EMPTY LIST MEANS THE DOOR IS OPEN. That is the safety net, not an oversight.
// A build with no list configured is the ordinary public app — so a missing or
// misspelled variable can never lock Jacques out of his own deployment. Note the
// deliberate difference from Friendly, which is the other way round: Friendly is
// shut to everybody but the owner unless the list says otherwise, because every
// Friendly message costs money. This list only opens a door.
//
// The rules live in this file rather than inline in server.js so they can be
// tested without booting the server, the same reason key-reading.js does.

const TURNED_AWAY =
  'This app is private right now — only the emails on its list can sign in. '
  + 'If you expected to be on it, ask for your email to be added.';

// " a@b.com, C@D.com ,, " -> ['a@b.com', 'c@d.com']
// Case and stray spaces are handled here, once, so no caller has to remember to.
// Duplicates are dropped: the same address listed twice is one person.
function parseList(raw) {
  const seen = new Set();
  for (const part of String(raw == null ? '' : raw).split(',')) {
    const email = part.trim().toLowerCase();
    if (email) seen.add(email);
  }
  return [...seen];
}

function isPrivate(list) {
  return Array.isArray(list) && list.length > 0;
}

// May this email get in?
//
// Open when no list is configured (see the note at the top), otherwise it has to
// be on the list. The owner is always let in, exactly as isFriendlyAllowed has
// always done — the account that runs the app must not be able to lock itself out
// by editing the list.
function appAllows(list, email, ownerEmail) {
  if (!isPrivate(list)) return true;
  const who = String(email || '').trim().toLowerCase();
  if (!who) return false;
  const owner = String(ownerEmail || '').trim().toLowerCase();
  return (!!owner && who === owner) || list.includes(who);
}

// The door as express middleware, for the one way into this app that does not go
// through /api/auth/signup: POST /api/letter/:token/accept makes an account from a
// letter link. It has to be turned away BEFORE it writes anything, which is why it
// is mounted ahead of the route in server.js.
//
// `allows` is handed in rather than decided here — server.js passes the same test
// signup and login use — so the app keeps exactly one rule and one emoji-free
// sentence for everybody who is turned away. It reads req.body, so it must be
// mounted after the body parser.
function doorMiddleware(allows) {
  return function (req, res, next) {
    if (req.method !== 'POST') return next();
    if (allows((req.body || {}).email)) return next();
    return res.status(403).json({ error: TURNED_AWAY });
  };
}

// ----------------------------------------------------------------- the pages --
// Jacques, 13 Sep 2026: "shut down the pages too." The app itself shut first (the
// sign-in above); this shuts everything that was never the app — the quiz, the
// partner pages, the comparison pages, the whole set built to bring strangers in
// from a search engine. There are no strangers any more.
//
// It is a CLOSED LIST rather than forty deletions from server.js, and that is the
// point: a page added tomorrow is shut unless somebody opens it on purpose. Every
// route in server.js is still there and still correct — this is simply asked
// first, so reopening the site is deleting this block.
//
// 13 Sep 2026, the one the closed list caught out: /game3d.html. The app loads
// the 3D roof fight in an iframe from that address, and it is served only at
// its .html address (express.static; no clean-URL route exists for it) — so the
// "files with extensions are never judged" rule never got the chance to apply.
// The gate answered 410 and the Fight tab died with "This page is not here any
// more" at the exact moment the bell rang. It belongs to the app, so it sits
// on the list beside /app.
//
// The pages that have to stay open, and why. Each one is either the app, or
// something Google Play already points at, or a link that lands in somebody's
// phone from an email.
const OPEN_PAGES = [
  '/',                  // redirects to /app, so an old bookmark still works
  '/app',               // the app
  '/key',               // The Key — owner and list only, gated at its own route
  '/admin/stats',       // owner only, gated at its own route
  '/privacy',           // Play requires the policy without signing in
  '/privacy.html',
  '/delete-account',    // Play requires the deletion page the same way
  '/delete-account.html',
  '/letter.html',       // the page a letter link opens
  '/game3d.html',       // the 3D fight inside The Fight tab (added 13 Sep 2026)
  // The herb library and the tax centre (15 Sep 2026): private, listed here
  // only so the request can reach the route that judges it. Both addresses
  // each, because each is a real FILE as well as a clean URL, and static would
  // otherwise serve the file name unguarded.
  '/herbs', '/herbs.html',
  '/tax', '/tax.html',
];
// Addresses that carry a token or land somewhere else entirely, matched by
// prefix: the API the app is nothing without, a letter link (/l/<token>), the
// redirect behind an old post (/go/<src>), the store listing (/play) and the
// one-click unsubscribe in every email.
const OPEN_PREFIXES = ['/api/', '/l/', '/go/', '/play', '/unsubscribe'];

const PAGE_GONE = 'This page is not here any more. The app it belongs to is private.';

// Is this request for a page at all? Anything carrying a file extension — the
// scripts, the styles, the images, the manifest, the service worker,
// assetlinks.json, robots.txt — is not judged here, because the app installed on
// a phone needs every one of them and none of them says anything to a stranger.
//
// A .html address IS a page, though — every page on this site has one, and
// express.static would serve it if it were not judged, which is exactly the hole
// a clean-URL-only rule would leave open. A clean URL is a page too.
function isPagePath(pathname) {
  const p = String(pathname == null ? '' : pathname);
  if (/\.html?$/i.test(p)) return true;
  return !/\.[a-z0-9]{2,5}$/i.test(p);
}

// May this page be served? True means carry on to the routes in server.js.
function pageIsServed(pathname) {
  const p = String(pathname == null ? '' : pathname);
  if (!isPagePath(p)) return true;
  if (OPEN_PAGES.includes(p)) return true;
  return OPEN_PREFIXES.some((pre) => p === pre || p.startsWith(pre));
}

module.exports = {
  TURNED_AWAY, parseList, isPrivate, appAllows, doorMiddleware,
  PAGE_GONE, OPEN_PAGES, OPEN_PREFIXES, isPagePath, pageIsServed,
};
