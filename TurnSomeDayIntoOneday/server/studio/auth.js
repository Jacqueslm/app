// Studio's door is the app's door.
//
// 13 Sep 2026 — Studio was a separate app with its own accounts, its own cookie
// and its own password. It now runs inside Turn Someday Into Day One and is
// opened at /studio, so the app's session is the ONLY session: one sign-in, one
// private list of emails, no second password to remember, reset, or explain.
//
// Studio's own tables still key everything (assets, characters, projects,
// schedules, spend) by a user id, so the first request from a signed-in app
// account creates its Studio row once — keyed on the email — and every request
// after that reuses it. That is the whole bridge. Nothing here can create an
// account for anybody who is not already signed in to the app.
//
// The password hash on that row is 32 random bytes nobody ever sees: Studio's
// own login form is gone, so there is no password to guess or reset.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const appAuth = require('../auth');
const appDb = require('../db');
const db = require('./db');

// Still exported because studio.js and Studio's own tests read it.
const COOKIE_NAME = appAuth.COOKIE_NAME;

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// The Studio row for a signed-in app account, created on first use.
function studioUserIdFor(email) {
  const who = String(email || '').trim().toLowerCase();
  if (!who) return null;
  const existing = db.getUserByEmail(who);
  if (existing) return existing.id;
  try {
    return db.createUser(who, hashPassword(crypto.randomBytes(32).toString('hex')));
  } catch (_) {
    // Two requests arriving together on a brand-new account: the other one won
    // the insert. Its row is the right one, so read it back instead of failing.
    const again = db.getUserByEmail(who);
    return again ? again.id : null;
  }
}

// What studio.js puts in front of every one of its routes. It asks the app who
// is signed in, hands Studio that person's own id, and stops. A signed-out
// visitor gets the same 401 the app's own API gives, which is what makes the
// client show the sign-in screen rather than a half-open Studio.
function requireAuth(req, res, next) {
  appAuth.requireAuth(req, res, () => {
    const user = appDb.getUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Not signed in.' });
    const id = studioUserIdFor(user.email);
    if (!id) return res.status(401).json({ error: 'Not signed in.' });
    req.userId = id; // every Studio table keys off this
    req.studioEmail = user.email;
    next();
  });
}

module.exports = { COOKIE_NAME, hashPassword, verifyPassword, requireAuth, studioUserIdFor };
