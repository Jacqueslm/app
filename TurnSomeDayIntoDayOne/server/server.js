require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const billing = require('./billing');
const {
  COOKIE_NAME,
  isValidPassword,
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
const PRO_CHAT_LIMIT = 100;

// Stripe webhook signature verification needs the raw request body, so this route is
// registered with express.raw() before the global express.json() middleware below.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    await billing.handleWebhookEvent(req.body, req.headers['stripe-signature']);
    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: `Webhook error: ${err.message}` });
  }
});

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

// Separate from loginLimiter - they used to share one bucket, so a few failed login attempts
// could lock a user out of changing their password too (and vice versa).
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

const signupLimiter = rateLimit({
  // IP-based, so shared connections (office/campus wifi, carrier-grade NAT on mobile) can
  // legitimately produce several signups an hour from unrelated people - keep this generous
  // enough to absorb that, while still capping scripted bulk account creation.
  windowMs: 60 * 60 * 1000,
  max: 20,
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

app.post('/api/auth/signup', signupLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'Password must be between 8 and 72 characters.' });
  }
  if (db.getUserByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }
  const userId = db.createUser(normalizedEmail, await hashPassword(password));
  setSessionCookie(res, userId);
  res.status(201).json({ email: normalizedEmail });
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = (email || '').trim().toLowerCase();
  const user = db.getUserByEmail(normalizedEmail);
  if (!user || !(await verifyPassword(password || '', user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  setSessionCookie(res, user.id);
  res.json({ email: user.email });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.post('/api/auth/change-password', changePasswordLimiter, requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = db.getUserById(req.userId);
  if (!user || !(await verifyPassword(currentPassword || '', user.password_hash))) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ error: 'New password must be between 8 and 72 characters.' });
  }
  db.updatePassword(req.userId, await hashPassword(newPassword));
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
  try {
    JSON.parse(state);
  } catch (e) {
    return res.status(400).json({ error: 'state must be valid JSON.' });
  }
  db.saveState(req.userId, state);
  res.json({ ok: true });
});

app.get('/api/account/export', requireAuth, (req, res) => {
  const user = db.getUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  const stateJson = db.getState(req.userId);
  // Defense in depth: PUT /api/state already rejects non-JSON strings, but degrade to null
  // instead of a 500 for any state saved before that guard existed.
  let state = null;
  if (stateJson) {
    try { state = JSON.parse(stateJson); } catch (e) { state = null; }
  }
  res.json({ email: user.email, created_at: user.created_at, state });
});

app.delete('/api/account', requireAuth, async (req, res) => {
  const { password } = req.body || {};
  const user = db.getUserById(req.userId);
  if (!user || !(await verifyPassword(password || '', user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  if (billing.isConfigured()) {
    await billing.cancelStripeSubscriptionForUser(user);
  }
  db.deleteUser(req.userId);
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

function getOrigin(req) {
  return req.headers.origin || `${req.protocol}://${req.get('host')}`;
}

app.post('/api/billing/create-checkout-session', requireAuth, async (req, res) => {
  if (!billing.isConfigured()) {
    return res.status(503).json({ error: 'Billing is not available on this server right now.' });
  }
  const { plan } = req.body || {};
  const user = db.getUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  try {
    const url = await billing.createCheckoutSession(user, plan, getOrigin(req));
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not start checkout.' });
  }
});

app.post('/api/billing/create-portal-session', requireAuth, async (req, res) => {
  if (!billing.isConfigured()) {
    return res.status(503).json({ error: 'Billing is not available on this server right now.' });
  }
  const user = db.getUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  try {
    const url = await billing.createPortalSession(user, getOrigin(req));
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not open billing management.' });
  }
});

app.get('/api/billing/status', requireAuth, (req, res) => {
  const user = db.getUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  res.json(billing.getBillingStatus(user));
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

  // Server-side daily limit for signed-in users. Only a server-confirmed paid plan (never a
  // client-reported isPro flag, which the client fully controls) can bypass this.
  const user = db.getUserById(req.userId);
  const isPro = user && billing.getBillingStatus(user).isPro;
  const limit = isPro ? PRO_CHAT_LIMIT : FREE_CHAT_LIMIT;

  // Reserve the slot atomically *before* calling Anthropic (not read-count-then-later-increment)
  // so concurrent requests (double-tapped send, multiple tabs) can't all read the same "count
  // so far" and all slip through - only one wins the atomic increment past `limit`. If the
  // upstream call then fails, the reservation is refunded below.
  const today = todayUTC();
  const newCount = db.tryConsumeChatQuota(req.userId, today, limit);
  if (newCount === null) {
    const message = isPro
      ? `You've reached today's ${PRO_CHAT_LIMIT}-chat Pro limit. It resets tomorrow.`
      : `Daily Nova AI chat limit reached. Upgrade to Pro for up to ${PRO_CHAT_LIMIT} chats a day.`;
    return res.status(429).json({ error: message });
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
    if (!anthropicRes.ok) {
      db.refundChatQuota(req.userId, today);
    }
    res.status(anthropicRes.status).json(data);
  } catch (err) {
    db.refundChatQuota(req.userId, today);
    res.status(502).json({ error: 'Failed to reach Anthropic API.' });
  }
});

app.listen(PORT, () => {
  console.log(`Turn Someday Into Day One server running on http://localhost:${PORT}`);
});
