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
// Hosted deployments sit behind the platform's HTTPS proxy - trust its
// forwarded headers so secure cookies and per-IP rate limits work correctly.
app.set('trust proxy', 1);
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
// The server/ folder must never be reachable over HTTP: it holds the source,
// .env, and - on home installs, where DB_PATH defaults to server/data.sqlite -
// the entire user database. express.static below serves the app root, which
// contains this folder, so it has to be blocked ahead of it.
app.use('/server', (req, res) => res.status(404).end());
app.use(express.static(path.join(__dirname, '..')));

// Clean marketing URL - turnsomedayintodayone.com/brainreset - for bios,
// flyers, and video end cards, instead of the .html extension.
app.get('/brainreset', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'brainreset.html'));
});

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

// Separate bucket from login: sharing the 5-per-15-min login limiter meant a couple of
// mistyped logins plus a password change could lock a legitimate user out for 15 minutes.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password change attempts. Try again in a few minutes.' },
});

// Broad backstop across the whole auth namespace (logout, logout-all, me) -
// the credential routes above keep their own stricter buckets, which still apply.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in a few minutes.' },
});
app.use('/api/auth', authLimiter);

// The daily chat quota is per-account; this is the per-IP burst brake so the
// endpoint can't be hammered request-by-request inside a single day.
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down a moment — too many messages at once. Try again in a few minutes.' },
});

function setSessionCookie(res, userId, sessionVersion) {
  res.cookie(COOKIE_NAME, signSession(userId, sessionVersion), {
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
  setSessionCookie(res, user.id, user.session_version || 1);
  res.json({ email: user.email });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

// Signs the account out everywhere EXCEPT this device: the version bump kills every
// existing token, then this device immediately gets a fresh cookie at the new version.
app.post('/api/auth/logout-all', requireAuth, (req, res) => {
  const newVersion = db.bumpSessionVersion(req.userId);
  setSessionCookie(res, req.userId, newVersion);
  res.json({ ok: true });
});

app.post('/api/auth/change-password', changePasswordLimiter, requireAuth, (req, res) => {
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
  let { state } = req.body || {};
  if (typeof state !== 'string') {
    return res.status(400).json({ error: 'state must be a JSON string.' });
  }
  // Nova conversations are never persisted. Current clients don't send them,
  // but a stale cached client still might - enforce the promise server-side.
  try {
    const parsed = JSON.parse(state);
    if (parsed && typeof parsed === 'object' && 'chatHistory' in parsed) {
      delete parsed.chatHistory;
      state = JSON.stringify(parsed);
    }
  } catch (_) { /* not valid JSON - store as-is, same as before */ }
  db.saveState(req.userId, state);
  res.json({ ok: true });
});

app.use('/api/update', requireAuth, update.router);

// Server error stacks are internals, not user data - same owner gate the
// update endpoint uses. Unset APP_OWNER_EMAIL keeps the old open behavior.
const DIAG_OWNER_EMAIL = (process.env.APP_OWNER_EMAIL || '').trim().toLowerCase();
app.get('/api/diagnostics', requireAuth, (req, res) => {
  if (DIAG_OWNER_EMAIL) {
    const user = db.getUserById(req.userId);
    if (!user || user.email !== DIAG_OWNER_EMAIL) {
      return res.status(403).json({ error: 'Only the app owner can view diagnostics.' });
    }
  }
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

app.get('/api/billing/status', requireAuth, async (req, res) => {
  let user = db.getUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  // ?refresh=1 asks Stripe directly instead of waiting for a webhook - a home
  // install has no public URL Stripe can reach, so this is how Pro activates.
  if (req.query.refresh === '1' && billing.isConfigured()) {
    await billing.refreshFromStripe(user);
    user = db.getUserById(req.userId) || user;
  }
  res.json(billing.getBillingStatus(user));
});

app.post('/api/chat', chatLimiter, requireAuth, async (req, res) => {
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
  // Malformed JSON in a request body is a client mistake, not a server fault - answer 400
  // and keep it out of the user-visible diagnostics log so real server errors stand out.
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    if (res.headersSent) return next(err);
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }
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
