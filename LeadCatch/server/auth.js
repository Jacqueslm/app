const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const COOKIE_NAME = 'leadcatch_session';

let JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error(
    'FATAL: SESSION_SECRET is not set. In production that would sign every ' +
      'customer out on each restart, so refusing to start. Set SESSION_SECRET ' +
      'in the environment and redeploy.'
  );
  process.exit(1);
}
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('SESSION_SECRET not set - using a random secret for this run. Sessions reset on restart.');
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function signSession(accountId, sessionVersion) {
  return jwt.sign({ accountId, sv: sessionVersion || 1 }, JWT_SECRET, { expiresIn: '30d' });
}

function verifySession(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_) {
    return null;
  }
}

// Resolves the cookie to a live account, or null. A JWT stays valid for its
// full 30 days no matter what happens to the account, so the row is re-checked
// on every request: a deleted account, or one whose password changed, stops
// working here rather than 30 days from now.
function accountFromRequest(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  const payload = token && verifySession(token);
  if (!payload) return null;
  const account = db.getAccountById(payload.accountId);
  if (!account) return null;
  if ((payload.sv || 1) !== (account.session_version || 1)) return null;
  return account;
}

function requireAuth(req, res, next) {
  const account = accountFromRequest(req);
  if (!account) return res.status(401).json({ error: 'Not signed in.' });
  req.accountId = account.id;
  req.account = account;
  next();
}

function setSessionCookie(res, account) {
  res.cookie(COOKIE_NAME, signSession(account.id, account.session_version), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  accountFromRequest,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
};
