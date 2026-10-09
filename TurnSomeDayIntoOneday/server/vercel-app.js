// The Vercel build of The Truth — one password, no accounts, no database.
//
// WHY THIS FILE EXISTS SEPARATELY FROM server.js
//
// server.js is the Railway app: accounts, a SQLite file on a volume, email,
// push, Stripe, the marketing pages. None of that can work on Vercel. A
// serverless function gets no disk it can keep (a file written now is gone at
// the next cold start), so an accounts table there would forget who he is
// between visits and hand him "wrong password" on a phone that never changed
// anything. And the marketing routes are 410 on the Railway server anyway.
//
// What the three pages actually need from a server is small and is all of this:
//
//   1. a door — the three pages are private, so something has to check a
//      password before handing one over;
//   2. the AI — the Gemini key must stay on the server, never in a page, so
//      /api/chat (the tax page's ask box) and /api/key-reading (The Key) proxy;
//   3. the pages themselves, which are read off disk and sent only after the
//      door is open.
//
// The door is one shared password (APP_PASSWORD) instead of an account each,
// because there is nowhere here to keep accounts. The email box on the sign-in
// screen still works and still matters: it is checked against FRIENDLY_EMAILS,
// so the password alone is not enough — the person has to be on the list too.
// Jacques, 4 Oct 2026, on the move off Railway: "i want off railway so this runs
// in the browser".
//
// The cookie is signed with APP_SECRET (falling back to the password), so it
// cannot be forged by editing it in the browser.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const aiChatBody = require('./ai-chat-body');
const keyReading = require('./key-reading');

const ROOT = path.join(__dirname, '..');

const PASSWORD = String(process.env.APP_PASSWORD || '');
// The spare word, added 5 Oct 2026 after Jacques could not get in and there was
// nothing to get in with. One password and no way back means a forgotten word
// locks him out of his own app, and the only cure was a settings screen on a
// host he had to find on a phone. This is a second word that opens the same
// door, for the owner only, so the way back is something he can keep written
// down somewhere away from the phone.
//
// Deliberately NOT a reset by email: this host has no accounts and no database,
// so there is nowhere to keep a token and nothing to send a link to. A word
// kept in two places is the honest version of the same safety.
const RECOVERY = String(process.env.APP_RECOVERY_PASSWORD || '');
const OWNER_EMAIL = String(process.env.APP_OWNER_EMAIL || '').trim().toLowerCase();
const SECRET = String(process.env.APP_SECRET || PASSWORD);
const COOKIE = 'tsid_pass_v1';
const SESSION_DAYS = 180;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_MAX_TOKENS = Number(process.env.GEMINI_MAX_TOKENS || 4096);
const GEMINI_THINKING_LEVEL = process.env.GEMINI_THINKING_LEVEL || 'LOW';
const KEY_READING_MAX_TOKENS = Number(process.env.KEY_READING_MAX_TOKENS || 6000);
const KEY_READING_THINKING_LEVEL = process.env.KEY_READING_THINKING_LEVEL || 'MEDIUM';
const CHAT_LIMIT = Number(process.env.CHAT_LIMIT || 60);

const FRIENDLY_EMAILS = String(process.env.FRIENDLY_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

// The pages, and the file each one is. Every address is named: the clean URL
// and the file name both have to be here, because both reach the same file and
// a gate on one of them is a gate with a window open beside it. (This is the
// mistake the Railway server's own notes describe twice.)
const PAGES = {
  '/app': 'hub.html',
  '/key': 'key.html',
  '/herbs': 'herbs.html',
  '/herbs.html': 'herbs.html',
  '/tax': 'tax.html',
  '/tax.html': 'tax.html',
  '/fight': 'fight.html',
  '/fight.html': 'fight.html',
  '/game3d.html': 'game3d.html',
  '/music': 'music.html',
  '/music.html': 'music.html',
  // The Trainer, 9 Oct 2026: the gym page, behind the same door as the rest.
  // Both addresses, for the reason the comment above gives twice over.
  '/trainer': 'trainer.html',
  '/trainer.html': 'trainer.html',
};

// ----------------------------------------------------------------- the door --
function sign(value) {
  return crypto.createHmac('sha256', SECRET).update(value).digest('hex');
}

function issue(email) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + SESSION_DAYS * 864e5 }))
    .toString('base64url');
  return payload + '.' + sign(payload);
}

function readSession(req) {
  const raw = req.cookies && req.cookies[COOKIE];
  if (!raw) return null;
  const [payload, sig] = String(raw).split('.');
  if (!payload || !sig) return null;
  const want = sign(payload);
  // Length first: timingSafeEqual throws on a length mismatch, and a malformed
  // cookie is a normal thing to receive, not a crash.
  if (sig.length !== want.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const o = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!o || !o.email || !o.exp || o.exp < Date.now()) return null;
    return o;
  } catch (_) { return null; }
}

// The allowlist first, when there is one: the password gets somebody through the
// door, the list decides whether they belong in the room. An empty list means
// the password is the whole door, which is the same rule private-app.js uses on
// Railway ("an empty list leaves the door open").
function allowed(email) {
  if (!FRIENDLY_EMAILS.length) return true;
  return FRIENDLY_EMAILS.includes(String(email || '').toLowerCase());
}

// Which words open the door for this email. The everyday password opens it for
// everybody on the list. The spare opens it for the owner alone - it is the way
// back in when the everyday one is forgotten, and a way back in for one person
// is not the same thing as a second password for the household.
//
// With no APP_OWNER_EMAIL set there is no owner to spare, so the list is just
// the everyday password. That is the safe reading: a spare word that opens the
// door for anyone on the list is a second password for everyone, which is not
// what it is for.
function spareWords(email) {
  const who = String(email || '').trim().toLowerCase();
  const words = PASSWORD ? [PASSWORD] : [];
  if (RECOVERY && OWNER_EMAIL && who === OWNER_EMAIL) words.push(RECOVERY);
  return words;
}

// Is there any word at all that can open the door? Without APP_PASSWORD there
// is one only when a spare exists AND there is an owner for it to open for.
// Otherwise the door is shut to everybody, and answering "that password is not
// right" would be a lie about why - the plain "no password is set" is the
// truth, and it names the setting to fix.
function doorConfigured() {
  return !!PASSWORD || !!(RECOVERY && OWNER_EMAIL);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,           // Vercel is HTTPS-only; there is no plain-http case here
    maxAge: SESSION_DAYS * 864e5,
    path: '/',
  };
}

// ----------------------------------------------------------------- the pages --
// Read once per process and kept. key.html is 1.3MB and the function is short
// lived, so this is a small win, not a cache with a staleness question.
const pageCache = new Map();
function page(name) {
  if (!pageCache.has(name)) pageCache.set(name, fs.readFileSync(path.join(ROOT, name)));
  return pageCache.get(name);
}

// ------------------------------------------------------------------- Gemini --
// One place that talks to Google, so both routes fail the same way and nothing
// can print the key. Header, not ?key=, so the secret stays out of URLs and
// proxy logs.
async function gemini({ key, model, body }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': key };
  let r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  // A 3.x model rejects the other generation's thinking field with a bare 400
  // that names nothing - the trap that had Friendly canned in August. Ask again
  // without it rather than reporting an error nobody can act on.
  if (r.status === 400) {
    const retry = JSON.parse(JSON.stringify(body));
    if (retry.generationConfig) delete retry.generationConfig.thinkingConfig;
    r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(retry) });
  }
  const data = await r.json().catch(() => null);
  const cand = (data && data.candidates && data.candidates[0]) || null;
  const text = ((cand && cand.content && cand.content.parts) || [])
    .map((p) => p.text || '').join('').trim();
  return { ok: r.ok, status: r.status, text, data, candidate: cand };
}

// The daily ceiling, per person. In memory, so it is per instance and it resets
// when the instance goes — that is a brake on a runaway loop, which is what it
// is for, not a ledger anybody should trust.
const spentToday = new Map();
function dayKey(email) { return email + '|' + new Date().toISOString().slice(0, 10); }
function spent(email) { return spentToday.get(dayKey(email)) || 0; }
function spend(email) { spentToday.set(dayKey(email), spent(email) + 1); }

function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  const chatLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Slow down a moment — that is a lot of questions at once.' },
  });
  const keyLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Slow down a moment — give it a minute between readings.' },
  });
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many tries. Wait a few minutes.' },
  });

  // --- signing in. The page (hub.html) posts the same shape it always has, so
  // it did not have to change when the accounts went: an email and a password.
  app.post('/api/auth/login', loginLimiter, (req, res) => {
    if (!doorConfigured()) {
      return res.status(503).json({ error: 'No password is set on the server yet.' });
    }
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const password = String((req.body && req.body.password) || '');
    if (!email || !password) return res.status(400).json({ error: 'Both fields, please.' });
    // Constant time on every word, so a wrong guess says nothing about how close
    // it was, and the same work is done whichever one is tried. The spare is
    // only ever in this list for the owner, so for anybody else it is exactly
    // the one word it always was.
    const given = crypto.createHash('sha256').update(password).digest();
    let right = false;
    for (const word of spareWords(email)) {
      const want = crypto.createHash('sha256').update(word).digest();
      if (crypto.timingSafeEqual(given, want)) right = true;
    }
    if (!right) {
      return res.status(401).json({ error: 'That password is not right.' });
    }
    if (!allowed(email)) {
      return res.status(403).json({ error: 'That email is not one of the two this app is for.' });
    }
    res.cookie(COOKIE, issue(email), cookieOptions());
    res.json({ email });
  });

  app.get('/api/auth/me', (req, res) => {
    const who = readSession(req);
    if (!who) return res.status(401).json({ error: 'Not signed in.' });
    if (!allowed(who.email)) {
      res.clearCookie(COOKIE);
      return res.status(401).json({ error: 'Not signed in.' });
    }
    res.json({ email: who.email });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie(COOKIE);
    res.json({ ok: true });
  });

  // --- the pages. Signed in and on the list, or /app - which is where the
  // sign-in screen lives, and it holds no secrets of its own (three links).
  function gated(file) {
    return (req, res) => {
      const who = readSession(req);
      if (!who || !allowed(who.email)) return res.redirect('/app');
      res.set('Cache-Control', 'no-store');
      res.type('html').send(page(file));
    };
  }
  // The shell is the door, so it opens for everybody: it is a heading and three
  // links, and the sign-in form. Everything it links to is behind the gate. If
  // this were gated too, a signed-out visitor would be redirected to the page
  // that redirected them.
  const shell = (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.type('html').send(page('hub.html'));
  };
  app.get('/app', shell);
  app.get('/', shell);
  for (const [route, file] of Object.entries(PAGES)) {
    if (route === '/app') continue;
    app.get(route, gated(file));
  }

  // --- the AI. The tax page's ask box. Same request and same reply shape as
  // Railway, so the pages did not change: {system, messages} in,
  // {content:[{type:'text',text}]} out.
  app.post('/api/chat', chatLimiter, async (req, res) => {
    const who = readSession(req);
    if (!who || !allowed(who.email)) return res.status(401).json({ error: 'Not signed in.' });
    if (!GEMINI_API_KEY) return res.status(503).json({ error: 'The answer cannot be written right now.' });
    if (CHAT_LIMIT && spent(who.email) >= CHAT_LIMIT) {
      return res.status(429).json({ error: "That is today's lot of answers here. It comes back tomorrow." });
    }
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return res.status(400).json({ error: 'Nothing was asked.' });
    try {
      const payload = JSON.parse(aiChatBody.buildBody({
        model: GEMINI_MODEL,
        system: body.system,
        messages,
        maxTokens: GEMINI_MAX_TOKENS,
        thinkingOff: true,
        thinkingLevel: GEMINI_THINKING_LEVEL,
      }));
      const out = await gemini({ key: GEMINI_API_KEY, model: GEMINI_MODEL, body: payload });
      if (!out.ok) return res.status(502).json({ error: 'The answer could not be written just now.' });
      if (!out.text) return res.status(502).json({ error: 'The answer came back empty. Try again in a moment.' });
      spend(who.email);
      res.json({ content: [{ type: 'text', text: out.text }] });
    } catch (_) {
      res.status(502).json({ error: 'The answer could not be written just now.' });
    }
  });

  // --- The Key read by Gemini. Same contract as Railway: {text, model}, or an
  // error the page can show.
  app.post('/api/key-reading', keyLimiter, async (req, res) => {
    const who = readSession(req);
    if (!who || !allowed(who.email)) return res.status(401).json({ error: 'Not signed in.' });
    if (!GEMINI_API_KEY) return res.status(503).json({ error: 'The reading cannot be written right now.' });
    const input = keyReading.clipInput(req.body);
    if (!input.message) return res.status(400).json({ error: 'Nothing has been answered yet.' });
    try {
      const out = await gemini({
        key: GEMINI_API_KEY,
        model: GEMINI_MODEL,
        body: {
          systemInstruction: { parts: [{ text: keyReading.systemPrompt() }] },
          contents: [{ role: 'user', parts: [{ text: keyReading.userPrompt(input) }] }],
          generationConfig: Object.assign(
            { maxOutputTokens: KEY_READING_MAX_TOKENS },
            /^gemini-2\./.test(GEMINI_MODEL)
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : { thinkingConfig: { thinkingLevel: KEY_READING_THINKING_LEVEL } },
          ),
        },
      });
      if (!out.ok) return res.status(502).json({ error: 'The reading could not be written just now.' });
      if (!out.text) return res.status(502).json({ error: 'The reading came back empty. Try again in a moment.' });
      res.json({ text: out.text, model: GEMINI_MODEL });
    } catch (_) {
      res.status(502).json({ error: 'The reading could not be written just now.' });
    }
  });

  // Anything else is not this app. A 404 in words, never a page handed out by
  // accident and never a FileNotFound page that names the host's insides.
  app.use((req, res) => res.status(404).type('text').send('Not here.'));

  return app;
}

module.exports = buildApp();
module.exports.buildApp = buildApp;
module.exports.spareWords = spareWords;
module.exports.doorConfigured = doorConfigured;
module.exports.readSession = readSession;
module.exports.issue = issue;
module.exports.PAGES = PAGES;
module.exports.COOKIE = COOKIE;
