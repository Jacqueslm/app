require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const notify = require('./notify');
const {
  requireAuth,
  accountFromRequest,
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
} = require('./auth');

const app = express();
app.disable('x-powered-by');
// Behind a hosting platform's HTTPS proxy, so per-IP rate limits and secure
// cookies need the forwarded headers.
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3100;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

/* ------------------------------------------------------------- validation */

function str(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function validPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8;
}

const FIELD_KEYS = ['name', 'email', 'phone', 'message'];
const DEFAULT_LABELS = { name: 'Your name', email: 'Email', phone: 'Phone', message: 'How can we help?' };

// Whatever the dashboard posts, what lands in the database is exactly this
// shape - the public form renderer and the submit handler both trust it, so it
// is rebuilt from scratch here rather than merged with the caller's object.
function normalizeFields(input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const key of FIELD_KEYS) {
    const f = src[key] && typeof src[key] === 'object' ? src[key] : {};
    out[key] = {
      show: f.show !== false,
      required: Boolean(f.required),
      label: str(f.label, 60) || DEFAULT_LABELS[key],
    };
  }
  // A form with nothing to fill in is a bug, not a choice - and with no way to
  // reach the person, a "lead" is worthless. Force at least one contact field.
  if (!out.email.show && !out.phone.show) out.email.show = true;
  if (!out.email.required && !out.phone.required) {
    if (out.email.show) out.email.required = true;
    else out.phone.required = true;
  }

  const custom = Array.isArray(src.custom) ? src.custom.slice(0, 5) : [];
  out.custom = custom
    .map((c) => {
      const label = str(c && c.label, 60);
      if (!label) return null;
      const type = c.type === 'select' ? 'select' : 'text';
      const options =
        type === 'select'
          ? (Array.isArray(c.options) ? c.options : [])
              .map((o) => str(o, 60))
              .filter(Boolean)
              .slice(0, 12)
          : [];
      if (type === 'select' && !options.length) return null;
      return { label, type, required: Boolean(c && c.required), options };
    })
    .filter(Boolean);
  return out;
}

function parseFields(form) {
  try {
    return normalizeFields(JSON.parse(form.fields_json));
  } catch (_) {
    return normalizeFields({});
  }
}

function formFromBody(body, fallbackName) {
  const b = body && typeof body === 'object' ? body : {};
  const notifyEmail = str(b.notify_email, 200);
  return {
    name: str(b.name, 80) || fallbackName || 'Contact form',
    headline: str(b.headline, 120),
    intro: str(b.intro, 400),
    button_text: str(b.button_text, 40) || 'Send',
    success_message: str(b.success_message, 300) || 'Thanks! We’ll be in touch shortly.',
    accent_color: /^#[0-9a-fA-F]{6}$/.test(b.accent_color || '') ? b.accent_color : '#2563eb',
    fields: normalizeFields(b.fields),
    notify_email: notifyEmail && EMAIL_RE.test(notifyEmail) ? notifyEmail.toLowerCase() : null,
    active: b.active !== false,
  };
}

// What a visitor's browser is allowed to know about a form. Deliberately not
// the row: notify_email and account_id are the owner's business.
function publicFormView(form) {
  return {
    key: form.public_key,
    name: form.name,
    headline: form.headline || form.name,
    intro: form.intro || '',
    button_text: form.button_text || 'Send',
    success_message: form.success_message,
    accent_color: form.accent_color || '#2563eb',
    active: Boolean(form.active),
    fields: parseFields(form),
  };
}

function ownerFormView(form) {
  return {
    id: form.id,
    key: form.public_key,
    name: form.name,
    headline: form.headline,
    intro: form.intro,
    button_text: form.button_text,
    success_message: form.success_message,
    accent_color: form.accent_color,
    notify_email: form.notify_email,
    active: Boolean(form.active),
    fields: parseFields(form),
    lead_count: form.lead_count || 0,
    created_at: form.created_at,
  };
}

/* ---------------------------------------------------------- rate limiting */

const limiter = (windowMs, max, message) =>
  rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: message } });

const signupLimiter = limiter(60 * 60 * 1000, 5, 'Too many signups from this network. Try again later.');
const loginLimiter = limiter(15 * 60 * 1000, 10, 'Too many sign-in attempts. Try again in a few minutes.');
const submitLimiter = limiter(60 * 60 * 1000, 30, 'Too many submissions. Please try again later.');
const apiLimiter = limiter(60 * 1000, 240, 'Slow down a moment.');

/* ---------------------------------------------------- public capture API  */

// The embed script and the capture endpoint run on other people's websites, so
// they are the only routes that are cross-origin readable. No credentials are
// involved: the form key in the URL is the whole authorization story.
function publicCors(req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

// Registered with app.use, not per route: posting JSON from another domain
// makes the browser send an OPTIONS preflight first, and app.post() never
// matches OPTIONS - so a per-route version answers the preflight with no CORS
// headers at all and every real submission fails before it is sent.
app.use('/api/public', publicCors);
app.use('/embed.js', publicCors);

app.get('/embed.js', (req, res) => {
  res.type('application/javascript');
  res.set('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(PUBLIC_DIR, 'embed.js'));
});

app.get('/api/public/form/:key', (req, res) => {
  const form = db.getFormByPublicKey(String(req.params.key || ''));
  if (!form) return res.status(404).json({ error: 'Form not found.' });
  if (!form.active) return res.status(410).json({ error: 'This form is no longer accepting submissions.' });
  res.json(publicFormView(form));
});

app.post('/api/public/form/:key/lead', submitLimiter, (req, res) => {
  const form = db.getFormByPublicKey(String(req.params.key || ''));
  if (!form) return res.status(404).json({ error: 'Form not found.' });
  if (!form.active) return res.status(410).json({ error: 'This form is no longer accepting submissions.' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  // Two silent spam filters. The honeypot is a field hidden from humans that
  // bots fill in anyway; the timing check catches scripted posts that "fill" a
  // form faster than a person could read it. Both answer 200 - telling a bot
  // it was caught just teaches whoever wrote it to fix that part.
  const trapped = Boolean(str(body._hp, 100));
  const elapsed = Number(body._t);
  const tooFast = Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 900;
  if (trapped || tooFast) return res.status(200).json({ ok: true });

  const fields = parseFields(form);
  const lead = {
    account_id: form.account_id,
    form_id: form.id,
    name: fields.name.show ? str(body.name, 120) : null,
    email: fields.email.show ? str(body.email, 200) : null,
    phone: fields.phone.show ? str(body.phone, 40) : null,
    message: fields.message.show ? str(body.message, 4000) : null,
    source_url: str(body.source_url, 500),
    referrer: str(body.referrer, 500),
  };
  if (lead.email) lead.email = lead.email.toLowerCase();

  const missing = [];
  for (const key of FIELD_KEYS) {
    if (fields[key].show && fields[key].required && !lead[key]) missing.push(fields[key].label);
  }
  if (lead.email && !EMAIL_RE.test(lead.email)) {
    return res.status(400).json({ error: 'That email address doesn’t look right.' });
  }

  const extra = {};
  const answers = body.custom && typeof body.custom === 'object' ? body.custom : {};
  for (const field of fields.custom) {
    let value = str(answers[field.label], 500);
    // A dropdown answer that isn't one of the offered options was not typed by
    // someone using the form, so it is dropped rather than stored.
    if (value && field.type === 'select' && !field.options.includes(value)) value = null;
    if (field.required && !value) missing.push(field.label);
    if (value) extra[field.label] = value;
  }
  if (missing.length) {
    return res.status(400).json({ error: `Please fill in: ${missing.join(', ')}` });
  }
  // Every visible field optional and every one left blank is not a lead.
  if (!lead.name && !lead.email && !lead.phone && !lead.message && !Object.keys(extra).length) {
    return res.status(400).json({ error: 'Please fill in the form before sending.' });
  }
  if (Object.keys(extra).length) lead.extra = extra;

  // A double-click, a flaky connection retried by the browser, or an impatient
  // second submit shouldn't read as two customers.
  const duplicate = db.findRecentDuplicate(form.id, lead.email, lead.phone, 10 * 60 * 1000);
  if (duplicate) return res.json({ ok: true, duplicate: true, message: form.success_message });

  const leadId = db.createLead(lead);
  res.json({ ok: true, message: form.success_message });

  // After the response: the visitor's "thanks!" must not wait on a mail API,
  // and a mail failure must not turn a captured lead into an error page.
  notify.notifyNewLead(form, { ...lead, id: leadId, extra }).catch(() => {});
});

// Hosted form page - for businesses with no website, or a link in a bio.
app.get('/f/:key', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'form.html'));
});

/* ---------------------------------------------------------------- account */

app.post('/api/auth/signup', signupLimiter, (req, res) => {
  const { email, password, business_name: businessName } = req.body || {};
  const normalizedEmail = (str(email, 200) || '').toLowerCase();
  if (!EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ error: 'Use a password of at least 8 characters.' });
  }
  const name = str(businessName, 80);
  if (!name) return res.status(400).json({ error: 'Enter your business name.' });
  if (db.getAccountByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const accountId = db.createAccount(normalizedEmail, hashPassword(password), name);
  // A brand-new account with an empty forms list has nothing to show and
  // nothing to embed, so it starts with a working form pointed at the signup
  // address - copy the snippet and you are collecting leads.
  db.createForm(accountId, crypto.randomBytes(9).toString('base64url'), {
    ...formFromBody({ notify_email: normalizedEmail }, `${name} contact form`),
    headline: 'Get in touch',
    intro: 'Leave your details and we’ll get straight back to you.',
  });
  setSessionCookie(res, db.getAccountById(accountId));
  res.status(201).json({ email: normalizedEmail, business_name: name });
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = (str(email, 200) || '').toLowerCase();
  const account = normalizedEmail && db.getAccountByEmail(normalizedEmail);
  // One message for "no such account" and "wrong password" - a different
  // answer for each would turn this into a list of who has an account.
  if (!account || !verifyPassword(String(password || ''), account.password_hash)) {
    return res.status(401).json({ error: 'Wrong email or password.' });
  }
  setSessionCookie(res, account);
  res.json({ email: account.email, business_name: account.business_name });
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    email: req.account.email,
    business_name: req.account.business_name,
    created_at: req.account.created_at,
    email_configured: notify.isConfigured(),
  });
});

app.patch('/api/account', requireAuth, (req, res) => {
  const name = str((req.body || {}).business_name, 80);
  if (!name) return res.status(400).json({ error: 'Enter your business name.' });
  db.updateAccount(req.accountId, name);
  res.json({ ok: true, business_name: name });
});

app.post('/api/account/password', requireAuth, (req, res) => {
  const { current_password: current, new_password: next } = req.body || {};
  if (!verifyPassword(String(current || ''), req.account.password_hash)) {
    return res.status(403).json({ error: 'That current password is wrong.' });
  }
  if (!validPassword(next)) {
    return res.status(400).json({ error: 'Use a password of at least 8 characters.' });
  }
  db.setPassword(req.accountId, hashPassword(next));
  // setPassword bumped the session version, so this session's own cookie is now
  // stale too - reissue it rather than signing the person out of the tab they
  // are looking at.
  setSessionCookie(res, db.getAccountById(req.accountId));
  res.json({ ok: true });
});

app.delete('/api/account', requireAuth, (req, res) => {
  const { password } = req.body || {};
  if (!verifyPassword(String(password || ''), req.account.password_hash)) {
    return res.status(403).json({ error: 'Enter your password to delete the account.' });
  }
  db.deleteAccount(req.accountId);
  clearSessionCookie(res);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ forms */

app.get('/api/forms', requireAuth, apiLimiter, (req, res) => {
  res.json({ forms: db.listForms(req.accountId).map(ownerFormView) });
});

app.post('/api/forms', requireAuth, apiLimiter, (req, res) => {
  const forms = db.listForms(req.accountId);
  if (forms.length >= 25) {
    return res.status(400).json({ error: 'You have reached the limit of 25 forms.' });
  }
  const form = formFromBody(req.body, 'Contact form');
  const id = db.createForm(req.accountId, crypto.randomBytes(9).toString('base64url'), form);
  res.status(201).json(ownerFormView(db.getForm(req.accountId, id)));
});

app.get('/api/forms/:id', requireAuth, apiLimiter, (req, res) => {
  const form = db.getForm(req.accountId, Number(req.params.id));
  if (!form) return res.status(404).json({ error: 'Form not found.' });
  res.json(ownerFormView(form));
});

app.put('/api/forms/:id', requireAuth, apiLimiter, (req, res) => {
  const formId = Number(req.params.id);
  const existing = db.getForm(req.accountId, formId);
  if (!existing) return res.status(404).json({ error: 'Form not found.' });
  db.updateForm(req.accountId, formId, formFromBody(req.body, existing.name));
  res.json(ownerFormView(db.getForm(req.accountId, formId)));
});

app.delete('/api/forms/:id', requireAuth, apiLimiter, (req, res) => {
  const formId = Number(req.params.id);
  if (!db.getForm(req.accountId, formId)) return res.status(404).json({ error: 'Form not found.' });
  db.deleteForm(req.accountId, formId);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ leads */

app.get('/api/leads', requireAuth, apiLimiter, (req, res) => {
  const opts = {
    status: str(req.query.status, 20),
    formId: req.query.form_id ? Number(req.query.form_id) : null,
    q: str(req.query.q, 100),
    limit: req.query.limit,
    offset: req.query.offset,
  };
  const leads = db.listLeads(req.accountId, opts).map(leadView);
  res.json({ leads, total: db.countLeads(req.accountId, opts) });
});

function leadView(row) {
  let extra = null;
  if (row.extra_json) {
    try {
      extra = JSON.parse(row.extra_json);
    } catch (_) {
      extra = null;
    }
  }
  return {
    id: row.id,
    form_id: row.form_id,
    form_name: row.form_name,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    extra,
    status: row.status,
    notes: row.notes,
    value_cents: row.value_cents,
    source_url: row.source_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

app.patch('/api/leads/:id', requireAuth, apiLimiter, (req, res) => {
  const leadId = Number(req.params.id);
  const body = req.body || {};
  const patch = {};
  if (body.status !== undefined) {
    if (!db.LEAD_STATUSES.includes(body.status)) {
      return res.status(400).json({ error: 'Unknown status.' });
    }
    patch.status = body.status;
  }
  if (body.notes !== undefined) {
    patch.notes = typeof body.notes === 'string' ? body.notes.slice(0, 4000) : null;
  }
  if (body.value_cents !== undefined) {
    const cents = Number(body.value_cents);
    if (body.value_cents === null || body.value_cents === '') patch.value_cents = null;
    else if (!Number.isFinite(cents) || cents < 0) return res.status(400).json({ error: 'Enter a valid amount.' });
    else patch.value_cents = Math.round(cents);
  }
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update.' });
  if (!db.updateLead(req.accountId, leadId, patch)) {
    return res.status(404).json({ error: 'Lead not found.' });
  }
  res.json(leadView(db.getLead(req.accountId, leadId)));
});

app.delete('/api/leads/:id', requireAuth, apiLimiter, (req, res) => {
  if (!db.deleteLead(req.accountId, Number(req.params.id))) {
    return res.status(404).json({ error: 'Lead not found.' });
  }
  res.json({ ok: true });
});

app.get('/api/stats', requireAuth, apiLimiter, (req, res) => {
  res.json(db.stats(req.accountId));
});

// Spreadsheets treat a leading =, +, - or @ as the start of a formula, so a
// lead whose "name" is `=HYPERLINK(...)` would execute when the owner opens
// their export. Quoting the cell keeps it text.
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

app.get('/api/leads/export.csv', requireAuth, (req, res) => {
  const rows = db.allLeadsForExport(req.accountId);
  const header = ['Date', 'Form', 'Name', 'Email', 'Phone', 'Message', 'Status', 'Value', 'Notes', 'Source', 'Extra'];
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.created_at,
        row.form_name,
        row.name,
        row.email,
        row.phone,
        row.message,
        row.status,
        row.value_cents === null || row.value_cents === undefined ? '' : (row.value_cents / 100).toFixed(2),
        row.notes,
        row.source_url,
        row.extra_json,
      ]
        .map(csvCell)
        .join(',')
    );
  }
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`);
  // Excel opens UTF-8 as the local codepage unless the file starts with a BOM,
  // which is how accented names turn into mojibake in a customer's spreadsheet.
  res.send('﻿' + lines.join('\n'));
});

/* ----------------------------------------------------------------- pages  */

app.get('/', (req, res) => {
  // A signed-in owner opening the marketing page wants their leads, not the pitch.
  if (accountFromRequest(req)) return res.redirect('/app');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/app', (req, res) => {
  if (!accountFromRequest(req)) return res.redirect('/#signin');
  res.sendFile(path.join(PUBLIC_DIR, 'app.html'));
});

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Express needs all four parameters here to recognise this as the error
// handler; without `next` in the signature it is treated as ordinary middleware.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err && err.message);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Something went wrong.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`LeadCatch running on http://localhost:${PORT}`);
    if (!notify.isConfigured()) {
      console.log('Email notifications are off (set RESEND_API_KEY to turn them on).');
    }
  });
}

module.exports = app;
