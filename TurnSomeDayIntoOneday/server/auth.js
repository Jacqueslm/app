const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const COOKIE_NAME = 'tsid_session';

let JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error(
    'FATAL: SESSION_SECRET is not set. In production this would silently log ' +
      'every user out on each restart, so refusing to start. Set SESSION_SECRET ' +
      'in the environment (Railway -> Variables) and redeploy.'
  );
  process.exit(1);
}
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn(
    'SESSION_SECRET is not set - using a random secret for this run. ' +
      'Existing sessions will be invalidated every restart. Set SESSION_SECRET in .env for stable sessions.'
  );
}

// Stateless unsubscribe tokens: "{userId}.{HMAC(userId:email)}". Forging one
// for another user requires the server secret; no table, no expiry - an
// unsubscribe link in an old email should work forever.
function signUnsubToken(userId, email) {
  const mac = crypto.createHmac('sha256', JWT_SECRET).update(`unsub:${userId}:${email}`).digest('hex');
  return `${userId}.${mac}`;
}

// Leads (quiz/brainreset emails, not yet accounts) get their own token form:
// "L{leadId}.{HMAC(unsub-lead:leadId:email)}".
function signLeadUnsubToken(leadId, email) {
  const mac = crypto.createHmac('sha256', JWT_SECRET).update(`unsub-lead:${leadId}:${email}`).digest('hex');
  return `L${leadId}.${mac}`;
}

// Returns { type: 'user'|'lead', id } or null. User tokens keep the original
// pure-digit form so links in already-sent emails stay valid.
function verifyUnsubToken(token) {
  const m = /^(L?)(\d+)\.([a-f0-9]{64})$/.exec(String(token || ''));
  if (!m) return null;
  const isLead = m[1] === 'L';
  const id = Number(m[2]);
  let expected;
  if (isLead) {
    const lead = db.getLeadById(id);
    if (!lead) return null;
    expected = crypto.createHmac('sha256', JWT_SECRET).update(`unsub-lead:${id}:${lead.email}`).digest('hex');
  } else {
    const user = db.getUserById(id);
    if (!user) return null;
    expected = crypto.createHmac('sha256', JWT_SECRET).update(`unsub:${id}:${user.email}`).digest('hex');
  }
  const a = Buffer.from(m[3]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { type: isLead ? 'lead' : 'user', id };
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function signSession(userId, sessionVersion) {
  return jwt.sign({ userId, sv: sessionVersion || 1 }, JWT_SECRET, { expiresIn: '30d' });
}

function verifySession(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  const payload = token && verifySession(token);
  if (!payload) return res.status(401).json({ error: 'Not signed in.' });
  // A JWT stays cryptographically valid for its full 30-day lifetime regardless of logout or
  // account deletion on another device, since sessions aren't tracked server-side - checking the
  // user still exists closes that gap instead of letting deleted accounts keep writing state/chat data.
  const user = db.getUserById(payload.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  // "Log out on all devices" bumps the account's session version; any token minted
  // before the bump carries the old number and stops working right here.
  if ((payload.sv || 1) !== (user.session_version || 1)) {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  req.userId = payload.userId;
  // "Have they been in?" is answered here and nowhere else. The win-back email
  // used to answer it from the activity log, which only records 33 specific
  // actions, so somebody who opened the app and read got told she had not been
  // in for a fortnight. Any authenticated request means she was in.
  try { db.touchLastSeen(payload.userId); } catch (_) {}
  next();
}

// Same validity rules as requireAuth, but a boolean instead of a response -
// used to decide whether '/' redirects a returning user straight to '/app'.
function isValidSession(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  const payload = token && verifySession(token);
  if (!payload) return false;
  const user = db.getUserById(payload.userId);
  if (!user) return false;
  if ((payload.sv || 1) !== (user.session_version || 1)) return false;
  return true;
}

module.exports = {
  COOKIE_NAME,
  signUnsubToken,
  signLeadUnsubToken,
  verifyUnsubToken,
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  requireAuth,
  isValidSession,
};
