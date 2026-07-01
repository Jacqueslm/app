const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'tsid_session';

let JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn(
    'SESSION_SECRET is not set - using a random secret for this run. ' +
      'Existing sessions will be invalidated every restart. Set SESSION_SECRET in .env for stable sessions.'
  );
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function signSession(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
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
  req.userId = payload.userId;
  next();
}

function getOptionalUserId(req) {
  const token = req.cookies[COOKIE_NAME];
  const payload = token && verifySession(token);
  return payload ? payload.userId : null;
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  requireAuth,
  getOptionalUserId,
};
