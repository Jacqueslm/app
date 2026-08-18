require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const crypto = require('crypto');
const db = require('./db');
const billing = require('./billing');
const storeBilling = require('./store-billing');
const update = require('./update');
const emailer = require('./email');
const push = require('./push');
const analytics = require('./analytics');
const {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  requireAuth,
  verifyUnsubToken,
  isValidSession,
} = require('./auth');

const app = express();
// Don't advertise the framework in every response header.
app.disable('x-powered-by');
// Hosted deployments sit behind the platform's HTTPS proxy - trust its
// forwarded headers so secure cookies and per-IP rate limits work correctly.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-sonnet-5';
const ANTHROPIC_MAX_TOKENS = 1000;
// Friendly can also run on Gemini - far cheaper at volume and with a free
// tier for light use. Whichever key is present wins; if both are set, Gemini
// wins only when GEMINI_FIRST is set, otherwise Anthropic stays the default
// because it is the better recovery companion.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FREE_CHAT_LIMIT = 3;
const PRO_CHAT_LIMIT = 30;

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

// HSTS: once a browser has seen this header it refuses to talk to the site over
// plain HTTP for a year, which closes the window where a first request on a
// hostile network could be downgraded. Railway terminates TLS in front of us
// and every canonical URL is already https, so nothing here is reachable over
// http anyway. Deliberately no includeSubDomains and no preload - both are
// effectively one-way doors, and neither is needed for the apex + www we run.
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});

// One canonical host. Every canonical tag, the sitemap and robots.txt all say
// www, so the bare domain must send people there rather than serve a second
// copy of the site for Google to choose between.
//
// This only matters once the apex points at Railway. Until then IONOS answers
// it with a 302 on http and nothing at all on https - which is what put four
// "page couldn't be crawled" errors in the site audit.
//
// 301, not 302: permanent is what transfers ranking to the www version.
// Anything that isn't exactly the bare domain falls through untouched, so
// localhost, Railway's own *.up.railway.app health checks and the www host
// itself are unaffected.
const CANONICAL_HOST = process.env.CANONICAL_HOST || 'www.turnsomedayintodayone.com';
const APEX_HOST = CANONICAL_HOST.replace(/^www\./, '');
app.use((req, res, next) => {
  const host = String(req.headers.host || '').toLowerCase().split(':')[0];
  if (host !== APEX_HOST) return next();
  res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
});

// ─── PLAUSIBLE PAGEVIEWS ─────────────────────────────────────────────────────
// Recorded server-side (no third-party script on the visitor's device, no
// cookies). The guard limits it to genuine page loads so assets, API calls and
// the unsubscribe token never leak into the dashboard.
function shouldTrackPageview(req) {
  if (req.method !== 'GET') return false;
  const p = req.path;
  if (p.startsWith('/api/')) return false;
  if (p.startsWith('/admin')) return false;
  if (p.startsWith('/go/')) return false;
  if (p === '/unsubscribe') return false; // URL carries a capability token
  if (/\.(js|css|png|jpe?g|webp|svg|gif|ico|json|woff2?|map|mp3|mp4|webmanifest|xml|txt|pdf)$/i.test(p)) return false;
  return true;
}
app.use((req, res, next) => {
  if (shouldTrackPageview(req)) analytics.pageview(req);
  next();
});

app.use('/preview', requireAuth);

// Cold marketing traffic lands here; the app itself lives at /app so a
// returning signed-in user is sent straight there and never sees marketing
// copy twice. Registered ahead of express.static below, since static would
// otherwise auto-serve index.html at '/' by its own default-index behavior.
app.get('/', (req, res) => {
  if (isValidSession(req)) return res.redirect('/app');
  res.sendFile(path.join(__dirname, '..', 'landing.html'));
});
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// The server/ folder must never be reachable over HTTP: it holds the source,
// .env, and - on home installs, where DB_PATH defaults to server/data.sqlite -
// the entire user database. express.static below serves the app root, which
// contains this folder, so it has to be blocked ahead of it.
app.use('/server', (req, res) => res.status(404).end());
// The admin page is served only through the owner-gated /admin/stats route below.
// It carries no data of its own, but static would hand out the shell to anyone.
app.get('/admin-stats.html', (req, res) => res.status(404).end());
app.use(express.static(path.join(__dirname, '..')));

// Clean marketing URL - turnsomedayintodayone.com/brainreset - for bios,
// flyers, and video end cards, instead of the .html extension.
app.get('/brainreset', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'brainreset.html'));
});

// Clean URL for the 2-Minute Check-In quiz - speakable in videos
// ("turnsomedayintodayone.com/quiz") without the .html extension.
app.get('/quiz', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'quiz.html'));
});

// The partner-facing landing page - the day-2 trial email and the "Send this
// page to her" button both link here.
app.get('/for-her', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'for-her.html'));
});

// Door-specific partner landing: the wife of the man who drinks. Same house,
// narrower front door - drinking-angle videos and ads point here so the page
// continues the exact sentence the post started.
app.get('/when-he-drinks', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'when-he-drinks.html'));
});

// Lowest-difficulty term in the keyword set, and the quiz already answers it -
// so this page is a short honest bridge: it refuses to diagnose him, reframes
// the question onto her own life, and routes to /quiz (primary) and /for-her.
app.get('/is-my-husband-an-alcoholic', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'is-my-husband-an-alcoholic.html'));
});

// The inclusive supporter pages (KEYWORDS.md lanes 1-2): one page per
// addiction naming husband, wife, boyfriend, girlfriend so the whole
// low-difficulty cluster ranks on a single URL. Both route to /quiz and
// /for-her; crisis resources sit above every signup link.
app.get('/partner-drinks', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'partner-drinks.html'));
});

app.get('/partner-watches-porn', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'partner-watches-porn.html'));
});

// The biggest winnable term in KEYWORDS.md (9,900/mo, KD 37): the food-track
// page. Self-directed (not supporter), so its CTA goes straight to /app;
// eating-disorder referral language is SAFETY class in the claims audit and
// sits above the signup links.
app.get('/how-to-stop-binge-eating', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'how-to-stop-binge-eating.html'));
});

// The quiz that page sends people to. This route was missing, and one missing
// route caused five separate findings in the 15 Aug site audit: the URL 404'd,
// the two internal links pointing at it were "broken internal links", it was an
// "incorrect page found in sitemap.xml", and it sat in the sitemap inviting
// Google to crawl a 404.
//
// The page file existed the whole time — express.static serves it, but only at
// the .html address. Every clean URL on this site needs its own route; there is
// no catch-all, on purpose (see ALT_PAGES below). A page whose canonical tag,
// sitemap entry and inbound links all point at an unrouted URL is invisible.
app.get('/do-i-have-a-binge-eating-problem-quiz', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'do-i-have-a-binge-eating-problem-quiz.html'));
});

// Final two pages of the KEYWORDS.md plan: the moat's companion page
// (betrayal trauma recovery, supporter side) and the one borderline
// long-form worth attempting (how to stop drinking, self side - carries
// the cold-turkey SAFETY warning twice, above the fold and above signup).
app.get('/betrayal-trauma-recovery', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'betrayal-trauma-recovery.html'));
});

app.get('/how-to-stop-drinking', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'how-to-stop-drinking.html'));
});

// The morning-after anxiety. 12,100 searches a month at difficulty 33 - the
// biggest winnable term on the site, and the doorway most people come through
// long before they'd call it a problem.
app.get('/hangxiety', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'hangxiety.html'));
});

// The partner audience's two biggest search terms, added 2026-08-12 after a
// live Semrush pull: `codependency` (33,100/mo) and `al anon` (33,100/mo)
// together outweigh anything else this side of the door, and the site had no
// page for either. Both head terms are hard (KD 72 and 68), so each page is
// written for the winnable half of its cluster: `how to stop being
// codependent` (1,600, KD 46) / `codependency test` (390, KD 15), and
// `what is al anon` (3,600, KD 33) / `al anon online meetings` (2,900, KD 26).
// The Al-Anon page links out to al-anon.org and states plainly that we are not
// affiliated - the search intent there is navigational, so intercepting it
// without sending people on to the real thing would be a bait page.
app.get('/codependency', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'codependency.html'));
});

app.get('/what-is-al-anon', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'what-is-al-anon.html'));
});

// Social proof / SEO target for "reviews" searches. Renders only real quotes
// from data/reviews.json - deliberately never fabricated testimonials.
app.get('/reviews', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'reviews.html'));
});

// "Dry drunk" - about 11,700 searches a month across six phrasings, all at
// difficulty 30-34, and one page answers the lot: what is a dry drunk / dry
// drunk meaning / definition / syndrome / alcoholic dry drunk / dry drunkenness.
// Sober and still the same person. Both audiences search it - the one who
// stopped and the one living with them - so the page carries a CTA for each.
app.get('/dry-drunk', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dry-drunk.html'));
});

// The three from the final Semrush sweep (12 Aug), in the order they pay:
//   /adult-children-of-alcoholics - 8,100/mo at KD 31, plus the "laundry list"
//     cluster at ~6,000/mo and KD 14-24. A THIRD audience: not the drinker and
//     not the partner, but the person who grew up in it. Links out to
//     adultchildren.org rather than reproducing ACA's list, which is theirs.
//   /alcoholic-personality - ~9,400/mo across six phrasings, all KD 33 or under.
//     Written as "here is what the behavior does, and why it is not who they
//     are" - the claims audit applies at full strength on this one.
//   /codependency-test - `codependency test` (390, KD 15) and `am i codependent
//     quiz` (390, KD 14). Same eight-question shape as the binge-eating quiz.
//     NOTE: deliberately NO email capture. /api/lead collapses any unrecognized
//     source into the 'quiz' nurture, which is written in Jacques's voice and
//     must never go to the partner - and this audience IS the partner. A
//     partner-side sequence would need writing before a capture box goes here.
app.get('/adult-children-of-alcoholics', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'adult-children-of-alcoholics.html'));
});

app.get('/alcoholic-personality', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'alcoholic-personality.html'));
});

app.get('/codependency-test', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'codependency-test.html'));
});

// Our own "best recovery apps" roundup - the standard competitor move done
// honestly (disclosure up top, real alternatives listed). Targets the
// "best recovery apps 2026" search and anchors the rehab outreach emails.
app.get('/best-recovery-apps', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'best-recovery-apps.html'));
});

// Per-competitor "<name> alternative" pages: same honest-comparison move,
// one clean extension-less URL per page, all listed in sitemap.xml. A
// whitelist, not a catch-all - unknown paths must keep 404ing normally.
const ALT_PAGES = [
  'i-am-sober-alternative', 'reframe-app-alternative', 'sunnyside-app-alternative',
  'loosid-app-alternative', 'sober-time-alternative', 'quittr-app-alternative',
  'covenant-eyes-alternative', 'brainbuddy-alternative', 'fortify-app-alternative',
  'betblocker-alternative', 'quitnow-app-alternative', 'ever-accountable-alternative',
  'blockerx-alternative', 'nomo-app-alternative',
];
ALT_PAGES.forEach((slug) => {
  app.get('/' + slug, (req, res) => {
    res.sendFile(path.join(__dirname, '..', slug + '.html'));
  });
});

// Short bio links with tracking baked in, so a platform bio only ever needs
// "/go/tiktok" - the redirect adds the UTM tags and stats attribution works
// without anyone hand-building tagged URLs. Unknown names still land safely.
const GO_SOURCES = new Set(['tiktok', 'youtube', 'facebook', 'instagram', 'buffer']);
app.get('/go/:src', (req, res) => {
  const src = String(req.params.src || '').toLowerCase();
  if (!GO_SOURCES.has(src)) return res.redirect('/when-he-drinks');
  res.redirect(`/when-he-drinks?utm_source=${src}&utm_medium=social&utm_campaign=her-drinking`);
});

// One-click unsubscribe from any inbox - no login. Idempotent by design:
// setting the flag to 1 again is the same write and the same page, so a
// double-click or a second device never sees an error.
app.get('/unsubscribe', (req, res) => {
  const hit = verifyUnsubToken(req.query.token);
  if (!hit) {
    return res.status(400).type('html').send("<!doctype html><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><body style=\"font-family:sans-serif;background:#0f0c29;color:#eef0ff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center\">This link isn't valid.</body>");
  }
  if (hit.type === 'lead') db.setLeadUnsubscribed(hit.id, 1);
  else db.setUnsubscribed(hit.id, 1);
  res.type('html').send("<!doctype html><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><body style=\"font-family:sans-serif;background:#0f0c29;color:#eef0ff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center\">You're unsubscribed. Password reset emails still work.</body>");
});

// Public lead capture: the quiz result screen and the /brainreset page.
// Additive and skippable everywhere - skipping changes nothing.
const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this network. Try again later.' },
});

// UTM values are attacker-supplied query strings, so every field is length-capped
// before it reaches the database.
function cleanUtmTag(v) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 60) : null;
}
function readUtm(body) {
  const b = body || {};
  const u = b.utm && typeof b.utm === 'object' ? b.utm : {};
  return {
    source: cleanUtmTag(u.source) || cleanUtmTag(b.utm_source),
    medium: cleanUtmTag(u.medium) || cleanUtmTag(b.utm_medium),
    campaign: cleanUtmTag(u.campaign) || cleanUtmTag(b.utm_campaign),
  };
}

app.post('/api/lead', leadLimiter, async (req, res) => {
  const { email: rawEmail, quiz_result, source } = req.body || {};
  const addr = (rawEmail || '').trim().toLowerCase();
  if (!EMAIL_RE.test(addr)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  // 'for-her' is the older partner-page capture: she gets the PDF she asked for
  // and nothing else. 'partner' (added 13 Aug) is the real partner sequence -
  // five emails written to the person who LOVES somebody with a habit. Both are
  // kept away from the quiz nurture, which is written in his voice to the person
  // struggling and would land badly on her.
  // Anything unrecognised still collapses to 'quiz', so a new page cannot start
  // sending her his emails by forgetting to declare itself.
  const src = source === 'brainreset' ? 'brainreset'
    : source === 'for-her' ? 'for-her'
    : source === 'partner' ? 'partner'
    : 'quiz';
  const cleanResult = typeof quiz_result === 'string' ? quiz_result.slice(0, 80) : null;
  const cleanUtm = readUtm(req.body);

  const existingUser = db.getUserByEmail(addr);
  const existingLead = db.getLeadByEmail(addr);

  // Dedup rule: an email already known (lead or user) never restarts the
  // nurture - but a brainreset request still gets its PDF.
  if (existingUser || existingLead) {
    if (src === 'brainreset' || src === 'for-her') {
      const pdf = emailer.brainresetPdfEmail();
      // They just asked for it by typing their address - deliver even if
      // previously unsubscribed from sequences.
      emailer.sendEmail({ to: addr, subject: pdf.subject, text: pdf.text, force: true }).catch(() => {});
    }
    return res.json({ ok: true, message: src === 'quiz' ? "You're all set." : src === 'partner' ? "You're all set." : 'Check your email — the PDF is on the way.' });
  }

  const leadId = db.createLead(addr, src === 'quiz' ? cleanResult : null, src, cleanUtm);
  const lead = db.getLeadById(leadId);
  if (src === 'quiz') {
    emailer.startQuizNurture(lead).catch(() => {});
  } else if (src === 'partner') {
    // Her day 1 goes immediately; the hourly runner picks up days 2-5.
    emailer.startPartnerNurture(lead).catch(() => {});
  } else {
    if (src === 'brainreset') {
      // Brainreset leads skip day 1 (it restates a quiz result they don't have):
      // pre-mark step 1 consumed so the scheduler starts them at day 2.
      // for-her leads are excluded from the nurture entirely (see runQuizNurture),
      // so no pre-marking is needed for them.
      db.logEmailSent(null, addr, 'quiz', 1);
    }
    const pdf = emailer.brainresetPdfEmail();
    emailer.sendEmail({ to: addr, subject: pdf.subject, text: pdf.text }).catch(() => {});
  }
  // New-lead funnel event, tagged with the door they came through (quiz,
  // partner, for-her or brainreset) - no email, no result, no PII.
  analytics.event(req, 'Lead', { source: src });
  res.json({ ok: true, message: (src === 'quiz' || src === 'partner') ? 'Day 1 is on its way to your inbox.' : 'Check your email — the PDF is on the way.' });
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

// Authenticated but still abusable: state sync writes a 2MB row, and the
// billing endpoints each fan out to Stripe/Google. Generous ceilings that
// normal use never touches, so a loop can't burn disk or an external API quota.
const stateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Syncing too often — give it a moment.' },
});
const billingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many billing checks — try again in a few minutes.' },
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
  // Attribution must never be able to fail a signup - a malformed tag is worth
  // losing, an account is not.
  try { db.setUserUtm(userId, readUtm(req.body)); } catch (_) {}
  setSessionCookie(res, userId);
  res.status(201).json({ email: normalizedEmail });
  // Funnel event - fire-and-forget, and it carries only the plan level, never
  // anything that could identify the person who just signed up.
  analytics.event(req, 'Signup', { plan: 'free' });
  // After the response - a slow or failed email must never slow down signup.
  const user = db.getUserById(userId);
  if (user) {
    const w = emailer.welcomeEmail();
    emailer.sendSequenceEmail(user, 'transactional', 1, w.subject, w.text).catch(() => {});
  }
});

// Same rate as login: this endpoint sends real mail on every valid hit.
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reset requests. Try again later.' },
});

app.post('/api/auth/forgot', forgotLimiter, async (req, res) => {
  const { email: rawEmail } = req.body || {};
  const normalizedEmail = (rawEmail || '').trim().toLowerCase();
  // Identical response whether or not the account exists - this endpoint must
  // never confirm who has an account with a recovery app.
  const reply = { ok: true, message: 'If that email has an account, a reset link is on its way.' };
  if (!EMAIL_RE.test(normalizedEmail)) return res.json(reply);
  const user = db.getUserByEmail(normalizedEmail);
  if (!user) return res.json(reply);
  const token = crypto.randomBytes(32).toString('hex');
  db.createPasswordReset(token, user.id, new Date(Date.now() + 60 * 60 * 1000).toISOString());
  const msg = emailer.passwordResetEmail(token);
  // No sequence guard (users may legitimately request several resets) and
  // force:true - account access must work even for unsubscribed users.
  emailer.sendEmail({ to: user.email, subject: msg.subject, text: msg.text, force: true }).catch(() => {});
  res.json(reply);
});

app.post('/api/auth/reset', (req, res) => {
  const { token, newPassword } = req.body || {};
  if (typeof token !== 'string' || !token) {
    return res.status(400).json({ error: 'Missing reset token.' });
  }
  if (!validCredential(newPassword)) {
    return res.status(400).json({ error: 'New password must be at least 8 characters (or a 4-6 digit PIN).' });
  }
  const row = db.consumePasswordReset(token);
  if (!row) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one from the login screen.' });
  }
  db.updatePassword(row.user_id, hashPassword(newPassword));
  // A password reset means the old credential may be compromised - kill every
  // existing session everywhere.
  db.bumpSessionVersion(row.user_id);
  res.json({ ok: true });
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
  // Someone changing their password often does it because another device or
  // person may have access - so invalidate every existing session, then
  // immediately re-cookie this device at the new version (same as logout-all).
  const newVersion = db.bumpSessionVersion(req.userId);
  setSessionCookie(res, req.userId, newVersion);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.getUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  // isOwner lets the client skip owner-only calls (update check, diagnostics)
  // for everyone else, instead of probing them and logging 403s in every
  // regular user's console.
  res.json({ email: user.email, isOwner: !!(DIAG_OWNER_EMAIL && user.email === DIAG_OWNER_EMAIL) });
});

app.get('/api/state', requireAuth, (req, res) => {
  const stateJson = db.getState(req.userId);
  res.json({ state: stateJson || null });
});

app.put('/api/state', stateLimiter, requireAuth, (req, res) => {
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

// Server error stacks are internals, not user data - owner-only, and it fails
// CLOSED: with APP_OWNER_EMAIL unset nobody reads the error log (the old
// behavior leaked stacks to any signed-in user when the env var was missing).
const DIAG_OWNER_EMAIL = (process.env.APP_OWNER_EMAIL || '').trim().toLowerCase();
app.get('/api/diagnostics', requireAuth, (req, res) => {
  if (!DIAG_OWNER_EMAIL) {
    return res.status(403).json({ error: 'Diagnostics are unavailable: APP_OWNER_EMAIL is not configured.' });
  }
  const user = db.getUserById(req.userId);
  if (!user || user.email !== DIAG_OWNER_EMAIL) {
    return res.status(403).json({ error: 'Only the app owner can view diagnostics.' });
  }
  res.json({ errors: db.getRecentErrors(50) });
});

// Funnel numbers are business data, so unlike diagnostics this gate has no
// open fallback: with APP_OWNER_EMAIL unset, nobody gets in.
function isOwnerRequest(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  const payload = token && verifySession(token);
  const userId = req.userId || (payload && payload.userId);
  if (!userId) return false;
  const user = db.getUserById(userId);
  return !!(user && user.email === DIAG_OWNER_EMAIL);
}
function requireOwner(req, res) {
  if (!DIAG_OWNER_EMAIL) {
    res.status(403).json({ error: 'Admin stats are unavailable: APP_OWNER_EMAIL is not configured.' });
    return false;
  }
  if (!isOwnerRequest(req)) {
    res.status(403).json({ error: 'Only the app owner can view stats.' });
    return false;
  }
  return true;
}
app.get('/api/admin/stats', requireAuth, (req, res) => {
  if (!requireOwner(req, res)) return;
  res.json(db.getAdminStats({ freeChatLimit: FREE_CHAT_LIMIT, windowDays: 30 }));
});
// A page route, not an API one: requireAuth would render its JSON error as the
// page body, so a logged-out visit is sent to the app to sign in instead, and a
// signed-in non-owner gets a sentence rather than a JSON blob.
app.get('/admin/stats', (req, res) => {
  if (!isValidSession(req)) return res.redirect('/app');
  if (!DIAG_OWNER_EMAIL || !isOwnerRequest(req)) {
    return res.status(403).type('text/plain').send('Only the app owner can view stats.');
  }
  res.sendFile(path.join(__dirname, '..', 'admin-stats.html'));
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
  // A Play install must buy through Google, never Stripe - that is the Play
  // policy line. The client routes there already; this refuses independently, so
  // no code path inside the Android wrapper can reach Stripe even if the client
  // is stale, tampered with, or wrong.
  if (req.get('X-TSID-Client') === 'play') {
    return res.status(403).json({
      error: 'Purchases in the Android app go through Google Play.',
      usePlayBilling: true,
    });
  }
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
    // A sold-out cap is a different kind of "no" from a broken checkout, and the
    // client shows a different screen for it.
    if (err && err.code === 'lifetime_sold_out') {
      return res.status(409).json({ error: err.message, soldOut: true });
    }
    res.status(400).json({ error: err.message || 'Could not start checkout.' });
  }
});

// An in-app purchase made through an app store. The client sends the receipt;
// this asks the store directly whether it is real, because a purchase token
// from a device is meaningless on its own. Store-agnostic by design - Apple
// will use this same route.
app.post('/api/billing/store/verify', billingLimiter, requireAuth, async (req, res) => {
  const { source, productId, purchaseToken } = req.body || {};
  const user = db.getUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  try {
    // The Founding 50 is a promise about how many people get lifetime, not about
    // how they paid, so a store lifetime purchase counts against the same cap.
    const mapping = storeBilling.planForProduct(productId);
    if (mapping && mapping.plan === 'lifetime' && user.plan !== 'lifetime'
        && db.countLifetimeSold() >= billing.LIFETIME_CAP) {
      return res.status(409).json({
        error: 'Founding Lifetime — sold out. Lifetime returns at $249.',
        soldOut: true,
      });
    }
    const result = await storeBilling.redeemPurchase({
      userId: req.userId, source, productId, purchaseToken,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    const status = err.code === 'token_already_used' ? 409 : 400;
    try { db.logError('store_billing', err.message, `${source}/${productId}`); } catch (_) {}
    res.status(status).json({ error: err.message || 'Could not confirm that purchase.' });
  }
});

// Public on purpose: the landing page asks this while logged out. It publishes
// only what the pricing surfaces are allowed to show, and showCount is decided
// server-side so the app and the landing page can never disagree about when the
// remaining number becomes visible.
// Google Play requires a privacy policy reachable without signing in. The text
// is the same words as the in-app overlay - one policy, three places.
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'privacy.html'));
});
// Play requires the account-deletion instructions to be reachable from the
// store listing, which means without signing in - a signed-out visitor is
// exactly the person who cannot find the in-app button.
app.get('/delete-account', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'delete-account.html'));
});

app.get('/api/lifetime-availability', (req, res) => {
  try {
    res.json(billing.getLifetimeAvailability());
  } catch (e) {
    res.status(503).json({ error: 'Unavailable.' });
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

app.get('/api/billing/status', billingLimiter, requireAuth, async (req, res) => {
  let user = db.getUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  // ?refresh=1 asks Stripe directly instead of waiting for a webhook - a home
  // install has no public URL Stripe can reach, so this is how Pro activates.
  if (req.query.refresh === '1' && billing.isConfigured()) {
    await billing.refreshFromStripe(user);
    user = db.getUserById(req.userId) || user;
  }
  // storeBillingReady tells the client whether a purchase can actually be
  // honored. Without it, a misconfigured server takes the customer's money in
  // the store and then fails verification - they have paid and got nothing.
  // Better to refuse before the payment sheet opens than to refund afterwards.
  // lifetimeSoldOut travels with this for the same reason storeBillingReady
  // does: on a store purchase the money is taken before the server is asked
  // anything, so every reason a purchase could be refused has to be knowable
  // before the payment sheet opens.
  res.json({
    ...billing.getBillingStatus(user),
    storeBillingReady: storeBilling.isPlayConfigured(),
    lifetimeSoldOut: user.plan !== 'lifetime' && billing.getLifetimeAvailability().soldOut,
  });
});

// ─── WEB PUSH ────────────────────────────────────────────────────────────────
// The public key is not a secret - the browser needs it to build a subscription
// - so this is readable without a session, same as any site's push key.
app.get('/api/push/key', (req, res) => {
  try {
    res.json({ key: push.publicKey() });
  } catch (err) {
    res.status(503).json({ error: 'Push is not available on this server.' });
  }
});

app.post('/api/push/subscribe', requireAuth, (req, res) => {
  const sub = req.body || {};
  if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return res.status(400).json({ error: 'A complete push subscription is required.' });
  }
  try {
    db.savePushSubscription(req.userId, sub);
    res.json({ ok: true });
  } catch (err) {
    try { db.logError('push-subscribe', err.message, err.stack); } catch (_) {}
    res.status(500).json({ error: 'Could not save the subscription.' });
  }
});

app.post('/api/push/unsubscribe', requireAuth, (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) db.deletePushSubscription(endpoint);
  res.json({ ok: true });
});

// Lets someone prove to themselves that reminders will actually arrive, which
// is the whole reason a person turns notifications on and then doubts them.
app.post('/api/push/test', requireAuth, async (req, res) => {
  try {
    const sent = await push.sendToUser(req.userId, {
      title: 'Reminders are on',
      body: "That's what your daily lesson reminder will look like — even with the app closed.",
      url: '/app',
      tag: 'push-test',
    });
    res.json({ ok: sent > 0, sent });
  } catch (err) {
    try { db.logError('push-test', err.message, err.stack); } catch (_) {}
    res.status(500).json({ error: 'Could not send a test notification.' });
  }
});

// Today's chat usage so the client can show a live "X of N left" meter for
// Pro (Free is counted on the client already). Cheap authed read; the count is
// the same server-side number the cap is enforced against, so it never drifts.
app.get('/api/chat/usage', requireAuth, (req, res) => {
  const user = db.getUserById(req.userId);
  const isPro = !!(user && billing.getBillingStatus(user).isPro);
  const limit = isPro ? PRO_CHAT_LIMIT : FREE_CHAT_LIMIT;
  const used = db.getChatCount(req.userId, todayUTC());
  res.json({ used, limit, remaining: Math.max(0, limit - used), isPro });
});

// Config health for the AI, with no secrets in it - booleans and a model name
// only. This exists because the two ways Friendly goes quiet (no key on the
// server, or APP_OWNER_EMAIL unset so the owner-only error never reaches
// anyone) are both INVISIBLE from the app: the chat just falls back to canned
// replies and the diagnostics panel 403s. Signed-in only; open it in a phone
// browser to see in one line which of the two it is.
app.get('/api/ai-status', requireAuth, (req, res) => {
  const provider = GEMINI_API_KEY ? 'gemini' : (ANTHROPIC_API_KEY ? 'anthropic' : 'none');
  const user = db.getUserById(req.userId);
  res.json({
    provider,
    keyConfigured: !!(GEMINI_API_KEY || ANTHROPIC_API_KEY),
    model: provider === 'gemini' ? GEMINI_MODEL : (provider === 'anthropic' ? ANTHROPIC_MODEL : null),
    ownerEmailConfigured: !!DIAG_OWNER_EMAIL,
    youAreOwner: !!(DIAG_OWNER_EMAIL && user && user.email === DIAG_OWNER_EMAIL),
  });
});

app.post('/api/chat', chatLimiter, requireAuth, async (req, res) => {
  if (!ANTHROPIC_API_KEY && !GEMINI_API_KEY) {
    // No key on the server. This used to return a bare 503 and nothing else,
    // which is the one AI failure the app could not show anybody: the client
    // silently drops to canned replies, the chat counter never moves, and
    // because nothing was logged, Profile > Diagnostics stayed empty too. Log
    // it, and tell the owner in the chat itself.
    const why = 'No AI key on the server (GEMINI_API_KEY / ANTHROPIC_API_KEY are both unset).';
    try { db.logError('ai-chat', why); } catch (_) {}
    const body = { error: 'AI chat is not available on this server right now.' };
    try {
      const u = db.getUserById(req.userId);
      if (DIAG_OWNER_EMAIL && u && u.email === DIAG_OWNER_EMAIL) body.ownerError = why;
    } catch (_) {}
    return res.status(503).json(body);
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
    return res.status(429).json({ error: `Daily Friendly chat limit reached. Upgrade to Pro for up to ${PRO_CHAT_LIMIT} chats a day.` });
  }
  if (isPro && used >= PRO_CHAT_LIMIT) {
    return res.status(429).json({ error: `You've reached today's ${PRO_CHAT_LIMIT}-chat Pro limit. It resets tomorrow.` });
  }

  try {
    let res2, data;
    if (GEMINI_API_KEY) {
      const sysText = Array.isArray(system)
        ? system.map((b) => (b && b.text) || '').join('\n\n')
        : String(system || '');
      const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
        method: 'POST',
        // The key goes in x-goog-api-key. Without it Google answers every call
        // with 403 "Method doesn't allow unregistered callers", the request
        // never reaches a model, and the app quietly falls back to its canned
        // replies - which is exactly how Friendly shipped sounding robotic with
        // a perfectly good key sitting in the environment. Header, not ?key=,
        // so the secret stays out of URLs, proxy logs and error messages.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: sysText ? { parts: [{ text: sysText }] } : undefined,
          contents: (messages || []).map((m) => {
            const c = Array.isArray(m.content)
              ? m.content.map((b) => (b && b.text) || '').join('')
              : String(m.content || '');
            return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: c }] };
          }),
          generationConfig: { maxOutputTokens: ANTHROPIC_MAX_TOKENS },
        }),
      });
      const gd = await gemRes.json();
      if (gemRes.ok) {
        const parts = (gd.candidates && gd.candidates[0] && gd.candidates[0].content && gd.candidates[0].content.parts) || [];
        const text = parts.map((p) => p.text || '').join('').trim();
        // Same shape the client already parses (data.content[0].text).
        data = { content: [{ type: 'text', text }] };
      } else {
        data = gd;
      }
      res2 = gemRes;
    } else {
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
      data = await anthropicRes.json();
      res2 = anthropicRes;
    }
    // Only spend the user's daily quota on a response that actually succeeded - a bad server
    // config or a transient provider outage shouldn't cost them one of their free chats.
    if (res2.ok) {
      db.incrementChatCount(req.userId, todayUTC());
    } else {
      // A failing key/model here degrades every chat into the client's canned
      // fallback with no visible symptom except repetitive replies - put the
      // real reason where Profile diagnostics can show it.
      const why = `HTTP ${res2.status}: ${(data && data.error && (data.error.message || data.error.status)) || 'unknown error'}`;
      try { db.logError('ai-chat', why); } catch (_) {}
      // Hand the reason straight back to the OWNER so a broken key shows up in
      // the chat itself instead of only in a diagnostics list nobody thinks to
      // open. Never to anyone else - provider errors can echo config details.
      try {
        const u = db.getUserById(req.userId);
        if (DIAG_OWNER_EMAIL && u && u.email === DIAG_OWNER_EMAIL) {
          data = Object.assign({}, data, { ownerError: why });
        }
      } catch (_) {}
    }
    res.status(res2.status).json(data);
  } catch (err) {
    try { db.logError('ai-chat', 'Failed to reach the AI provider', err && err.message); } catch (_) {}
    res.status(502).json({ error: 'Failed to reach the AI provider.' });
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

emailer.startScheduler();
push.startScheduler();

app.listen(PORT, () => {
  console.log(`Turn Someday Into Day One server running on http://localhost:${PORT}`);
});
