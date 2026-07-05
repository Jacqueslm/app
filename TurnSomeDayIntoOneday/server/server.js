require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  signSession,
  requireAuth,
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-sonnet-5';
const ANTHROPIC_MAX_TOKENS = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FREE_CHAT_LIMIT = 3;

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/preview', requireAuth);
app.use(express.static(path.join(__dirname, '..')));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a few minutes.' },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many accounts created from this network. Try again later.' },
});

function setSessionCookie(res, userId) {
  res.cookie(COOKIE_NAME, signSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

app.post('/api/auth/signup', signupLimiter, (req, res) => {
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

app.get('/api/state', requireAuth, (req, res) => {
  const stateJson = db.getState(req.userId);
  res.json({ state: stateJson || null });
});

app.put('/api/state', requireAuth, (req, res) => {
  const { state } = req.body || {};
  if (typeof state !== 'string') {
    return res.status(400).json({ error: 'state must be a JSON string.' });
  }
  db.saveState(req.userId, state);
  res.json({ ok: true });
});

app.get('/api/account/export', requireAuth, (req, res) => {
  const user = db.getUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  const stateJson = db.getState(req.userId);
  res.json({
    email: user.email,
    created_at: user.created_at,
    state: stateJson ? JSON.parse(stateJson) : null,
  });
});

app.delete('/api/account', requireAuth, (req, res) => {
  const { password } = req.body || {};
  const user = db.getUserById(req.userId);
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  db.deleteUser(req.userId);
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.post('/api/chat', requireAuth, async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    // No key configured (e.g. running without the API wired up yet) - the client falls back to
    // its offline local-reply mode whenever this endpoint isn't a 2xx, so this is a normal state.
    return res.status(503).json({ error: 'AI chat is not available on this server right now.' });
  }

  const { system, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required.' });
  }

  // Server-side daily limit for signed-in users. "Pro" isn't a real paid subscription yet (no
  // billing is wired up), so every account is treated as free-tier here - a client-reported isPro
  // flag must never be trusted to bypass this, since the client fully controls its own state.
  const used = db.getChatCount(req.userId, todayUTC());
  if (used >= FREE_CHAT_LIMIT) {
    return res.status(429).json({ error: 'Daily Nova AI chat limit reached. Upgrade to Pro for unlimited chats.' });
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        system,
        messages,
      }),
    });

    const data = await anthropicRes.json();
    // Only spend the user's daily quota on a response that actually succeeded - a bad server
    // config or a transient Anthropic outage shouldn't cost them one of their free chats.
    if (anthropicRes.ok) {
      db.incrementChatCount(req.userId, todayUTC());
    }
    res.status(anthropicRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach Anthropic API.' });
  }
});

app.listen(PORT, () => {
  console.log(`Turn Someday Into Day One server running on http://localhost:${PORT}`);
});
