// Studio - standalone music-video production app.
// Runs entirely on your machine; AI features light up when a fal.ai key is
// pasted into the app. Completely independent from Turn Someday Into Day One.
require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const studio = require('./studio');
const {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  signSession,
  requireAuth,
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 4400;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'web')));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

function setSessionCookie(res, userId) {
  res.cookie(COOKIE_NAME, signSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

app.post('/api/auth/signup', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (db.getUserByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }
  const userId = db.createUser(normalizedEmail, hashPassword(password));
  setSessionCookie(res, userId);
  res.status(201).json({ email: normalizedEmail });
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = (email || '').trim().toLowerCase();
  const user = db.getUserByEmail(normalizedEmail);
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  setSessionCookie(res, user.id);
  res.json({ email: user.email });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.getUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ email: user.email });
});

app.use('/api/studio', studio.router);

// Anything that reaches here escaped every route's own try/catch - log it so
// it shows up in Storage & Backup diagnostics instead of vanishing silently.
app.use((err, req, res, next) => {
  try { db.logError('http', err.message, err.stack); } catch (_) {}
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});
process.on('uncaughtException', (err) => {
  try { db.logError('uncaughtException', err.message, err.stack); } catch (_) {}
  console.error('Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  try { db.logError('unhandledRejection', err?.message || String(err), err?.stack); } catch (_) {}
  console.error('Unhandled rejection:', err);
});

app.listen(PORT, () => {
  console.log(`Studio running on http://localhost:${PORT}`);
});
