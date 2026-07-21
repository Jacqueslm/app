require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const billing = require('./billing');
const update = require('./update');
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
const PRO_CHAT_LIMIT = 50;

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

const signupLimiter = rateLimit({
  // Recovery signups often share a network (a household, a rehab center, a
  // campus or coffee-shop Wi-Fi, or several people who saw the same launch
  // post from one office). Keep abuse protection but don't block real users.
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many accounts created from this network. Try again in a little while.' },
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

// A credential is either a real password (8+ chars) or a 4-6 digit PIN.
function validCredential(cred) {
  return typeof cred === 'string' && (cred.length >= 8 || /^\d{4,6}$/.test(cred));
}

app.post('/api/auth/signup', signupLimiter, (req, res) => {
  const { email, password, phone } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!validCredential(password)) {
    return res.status(400).json({ error: 'Use a password of at least 8 characters, or a 4-6 digit PIN.' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (db.getUserByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }
  const cleanPhone = typeof phone === 'string' ? phone.trim().slice(0, 30) : '';
  const userId = db.createUser(normalizedEmail, hashPassword(password), cleanPhone || null);
  setSessionCookie(res, userId);
  res.status(201).json({ email: normalizedEmail });
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = (email || '').trim().toLowerCase();
  const user = db.getUserByEmail(normalizedEmail);
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email, or wrong password/PIN.' });
  }
  setSessionCookie(res, user.id);
  res.json({ email: user.email });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.post('/api/auth/change-password', loginLimiter, requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = db.getUserById(req.userId);
  if (!user || !verifyPassword(currentPassword || '', user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  if (!validCredential(newPassword)) {
    return res.status(400).json({ error: 'New password must be at least 8 characters (or a 4-6 digit PIN).' });
  }
  db.updatePassword(req.userId, hashPassword(newPassword));
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

app.use('/api/update', requireAuth, update.router);

app.get('/api/diagnostics', requireAuth, (req, res) => {
  res.json({ errors: db.getRecentErrors(50) });
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

app.delete('/api/account', requireAuth, async (req, res) => {
  const { password } = req.body || {};
  const user = db.getUserById(req.userId);
  if (!user || !verifyPassword(password || '', user.password_hash)) {
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
  const used = db.getChatCount(req.userId, todayUTC());
  if (!isPro && used >= FREE_CHAT_LIMIT) {
    return res.status(429).json({ error: `Daily Nova AI chat limit reached. Upgrade to Pro for up to ${PRO_CHAT_LIMIT} chats a day.` });
  }
  if (isPro && used >= PRO_CHAT_LIMIT) {
    return res.status(429).json({ error: `You've reached today's ${PRO_CHAT_LIMIT}-chat Pro limit. It resets tomorrow.` });
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

// Anything that reaches here escaped every route's own try/catch - log it so
// it shows up in Profile diagnostics instead of vanishing silently.
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
  console.log(`Turn Someday Into Day One server running on http://localhost:${PORT}`);
});
