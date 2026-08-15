const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const COOKIE_NAME = 'tsid_session';
const ENV_PATH = path.join(__dirname, '.env');

// Sessions are signed with SESSION_SECRET. If there isn't one, a random secret
// gets made — and a random secret means **every server restart signs you out**,
// because the cookie in your browser was signed with the previous run's key.
//
// That used to be a console warning nobody reads, and it surfaced as a lie:
// the app still showed "Sign out" in the header while every request came back
// "Not signed in." Updating Studio restarts the server, so the app logged you
// out every time you updated it.
//
// So: generate one, and WRITE IT DOWN. One line in .env, once, and restarts
// stop costing a sign-in. Same file and format the fal/Pexels/Buffer keys use.
let JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  try {
    let lines = [];
    try { lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/); } catch (_) {}
    lines = lines.filter((l) => !l.startsWith('SESSION_SECRET=') && l.trim() !== '');
    lines.push(`SESSION_SECRET=${JWT_SECRET}`);
    fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', { mode: 0o600 });
    process.env.SESSION_SECRET = JWT_SECRET;
    console.log('SESSION_SECRET was missing - generated one and saved it to server/.env. You stay signed in across restarts now.');
  } catch (err) {
    // Read-only disk, or no permission. Carry on with the in-memory secret and
    // say plainly what it costs, rather than failing to boot over a warning.
    console.warn(
      `SESSION_SECRET is not set and could not be saved to .env (${err.message}). ` +
      'Using a random secret for this run, so every restart will sign you out.'
    );
  }
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
  // A JWT stays cryptographically valid for its full 30-day lifetime regardless of logout or
  // account deletion on another device, since sessions aren't tracked server-side - checking the
  // user still exists closes that gap instead of letting deleted accounts keep writing state/chat data.
  if (!db.getUserById(payload.userId)) return res.status(401).json({ error: 'Not signed in.' });
  req.userId = payload.userId;
  next();
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  requireAuth,
};
