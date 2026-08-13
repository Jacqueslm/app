// LeadCatch data layer. One SQLite file, three tables: accounts (the business
// that signed up), forms (each capture form they made), leads (what came in).
//
// The rule this whole file is built around: every read and write that touches
// forms or leads takes an account_id and puts it in the WHERE clause. There is
// no "get lead by id" without the owner - that's how one customer's leads stay
// invisible to another, even if someone guesses a row id.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'leadcatch.sqlite');

// Hosting platforms attach the storage volume a moment after the container
// starts, so the folder can briefly be missing. Same retry the recovery app
// uses - the alternative is a crash-loop on every redeploy.
function openDatabase() {
  const dir = path.dirname(DB_PATH);
  const ensureDir = () => { try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {} };
  const RETRIES = 12, WAIT_MS = 500;
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    ensureDir();
    try {
      return new DatabaseSync(DB_PATH);
    } catch (err) {
      lastErr = err;
      console.warn(`Database not ready at ${DB_PATH} (attempt ${attempt}/${RETRIES}): ${err.message}`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, WAIT_MS);
    }
  }
  throw lastErr;
}
const db = openDatabase();

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    business_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    session_version INTEGER NOT NULL DEFAULT 1
  );

  -- public_key is what goes in the embed snippet and the hosted form URL. It is
  -- random, not the row id: the id would let anyone enumerate every form on the
  -- server just by counting upwards.
  CREATE TABLE IF NOT EXISTS forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    public_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    headline TEXT,
    intro TEXT,
    button_text TEXT,
    success_message TEXT,
    accent_color TEXT,
    fields_json TEXT NOT NULL,
    notify_email TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    form_id INTEGER NOT NULL REFERENCES forms(id),
    name TEXT,
    email TEXT,
    phone TEXT,
    message TEXT,
    extra_json TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT,
    value_cents INTEGER,
    source_url TEXT,
    referrer TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_forms_account ON forms(account_id);
  CREATE INDEX IF NOT EXISTS idx_leads_account_created ON leads(account_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_leads_account_status ON leads(account_id, status);
  CREATE INDEX IF NOT EXISTS idx_leads_form ON leads(form_id);
`);

const now = () => new Date().toISOString();

/* ---------------------------------------------------------------- accounts */

function createAccount(email, passwordHash, businessName) {
  const res = db
    .prepare('INSERT INTO accounts (email, password_hash, business_name, created_at) VALUES (?, ?, ?, ?)')
    .run(email, passwordHash, businessName, now());
  return Number(res.lastInsertRowid);
}

function getAccountByEmail(email) {
  return db.prepare('SELECT * FROM accounts WHERE email = ?').get(email);
}

function getAccountById(id) {
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
}

function updateAccount(accountId, businessName) {
  db.prepare('UPDATE accounts SET business_name = ? WHERE id = ?').run(businessName, accountId);
}

function setPassword(accountId, passwordHash) {
  // Bumping session_version invalidates every token minted before the change,
  // so a password change really does kick out whoever else was signed in.
  db.prepare('UPDATE accounts SET password_hash = ?, session_version = session_version + 1 WHERE id = ?')
    .run(passwordHash, accountId);
}

/* ------------------------------------------------------------------- forms */

function createForm(accountId, publicKey, form) {
  const res = db
    .prepare(
      `INSERT INTO forms
         (account_id, public_key, name, headline, intro, button_text, success_message,
          accent_color, fields_json, notify_email, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .run(
      accountId,
      publicKey,
      form.name,
      form.headline,
      form.intro,
      form.button_text,
      form.success_message,
      form.accent_color,
      JSON.stringify(form.fields),
      form.notify_email,
      now()
    );
  return Number(res.lastInsertRowid);
}

function listForms(accountId) {
  return db
    .prepare(
      `SELECT f.*,
              (SELECT COUNT(*) FROM leads l WHERE l.form_id = f.id) AS lead_count
         FROM forms f
        WHERE f.account_id = ?
        ORDER BY f.created_at DESC`
    )
    .all(accountId);
}

function getForm(accountId, formId) {
  return db.prepare('SELECT * FROM forms WHERE id = ? AND account_id = ?').get(formId, accountId);
}

// The only form lookup with no account_id - it is how a public visitor's
// browser resolves the embed snippet, and the key itself is the credential.
function getFormByPublicKey(publicKey) {
  return db.prepare('SELECT * FROM forms WHERE public_key = ?').get(publicKey);
}

function updateForm(accountId, formId, form) {
  db.prepare(
    `UPDATE forms
        SET name = ?, headline = ?, intro = ?, button_text = ?, success_message = ?,
            accent_color = ?, fields_json = ?, notify_email = ?, active = ?
      WHERE id = ? AND account_id = ?`
  ).run(
    form.name,
    form.headline,
    form.intro,
    form.button_text,
    form.success_message,
    form.accent_color,
    JSON.stringify(form.fields),
    form.notify_email,
    form.active ? 1 : 0,
    formId,
    accountId
  );
}

function deleteForm(accountId, formId) {
  // Leads outlive the form they came from only if the owner exports them first;
  // deleting a form deletes its leads, which is what "delete" has to mean for a
  // privacy request to be honest.
  db.prepare('DELETE FROM leads WHERE form_id = ? AND account_id = ?').run(formId, accountId);
  db.prepare('DELETE FROM forms WHERE id = ? AND account_id = ?').run(formId, accountId);
}

/* ------------------------------------------------------------------- leads */

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];

function createLead(lead) {
  const stamp = now();
  const res = db
    .prepare(
      `INSERT INTO leads
         (account_id, form_id, name, email, phone, message, extra_json,
          status, source_url, referrer, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)`
    )
    .run(
      lead.account_id,
      lead.form_id,
      lead.name,
      lead.email,
      lead.phone,
      lead.message,
      lead.extra ? JSON.stringify(lead.extra) : null,
      lead.source_url,
      lead.referrer,
      stamp,
      stamp
    );
  return Number(res.lastInsertRowid);
}

// Guards against the double-click / double-submit that would otherwise show up
// as two identical leads a second apart.
function findRecentDuplicate(formId, email, phone, withinMs) {
  if (!email && !phone) return null;
  const cutoff = new Date(Date.now() - withinMs).toISOString();
  return db
    .prepare(
      `SELECT * FROM leads
        WHERE form_id = ?
          AND created_at > ?
          AND ((? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?))
        ORDER BY id DESC LIMIT 1`
    )
    .get(formId, cutoff, email, email, phone, phone);
}

// Shared by listLeads and countLeads so the two can never drift apart and
// report a count that doesn't match the rows on screen. `prefix` qualifies the
// columns: the list query joins forms, which also has account_id and name, so
// unqualified names there are ambiguous to SQLite.
function leadFilters(accountId, opts, prefix) {
  const p = prefix ? `${prefix}.` : '';
  const filters = [`${p}account_id = ?`];
  const params = [accountId];
  if (opts.status && LEAD_STATUSES.includes(opts.status)) {
    filters.push(`${p}status = ?`);
    params.push(opts.status);
  }
  if (opts.formId) {
    filters.push(`${p}form_id = ?`);
    params.push(opts.formId);
  }
  if (opts.q) {
    filters.push(
      `(${p}name LIKE ? OR ${p}email LIKE ? OR ${p}phone LIKE ? OR ${p}message LIKE ? OR ${p}notes LIKE ?)`
    );
    const like = `%${opts.q}%`;
    params.push(like, like, like, like, like);
  }
  return { where: filters.join(' AND '), params };
}

function listLeads(accountId, opts) {
  const { where, params } = leadFilters(accountId, opts, 'l');
  const limit = Math.min(Math.max(Number(opts.limit) || 100, 1), 500);
  const offset = Math.max(Number(opts.offset) || 0, 0);
  return db
    .prepare(
      `SELECT l.*, f.name AS form_name
         FROM leads l JOIN forms f ON f.id = l.form_id
        WHERE ${where}
        ORDER BY l.created_at DESC
        LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);
}

function countLeads(accountId, opts) {
  const { where, params } = leadFilters(accountId, opts, null);
  const row = db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE ${where}`).get(...params);
  return row ? row.n : 0;
}

function getLead(accountId, leadId) {
  return db
    .prepare(
      `SELECT l.*, f.name AS form_name
         FROM leads l JOIN forms f ON f.id = l.form_id
        WHERE l.id = ? AND l.account_id = ?`
    )
    .get(leadId, accountId);
}

function updateLead(accountId, leadId, patch) {
  const sets = [];
  const params = [];
  if (patch.status !== undefined) {
    sets.push('status = ?');
    params.push(patch.status);
  }
  if (patch.notes !== undefined) {
    sets.push('notes = ?');
    params.push(patch.notes);
  }
  if (patch.value_cents !== undefined) {
    sets.push('value_cents = ?');
    params.push(patch.value_cents);
  }
  if (!sets.length) return false;
  sets.push('updated_at = ?');
  params.push(now(), leadId, accountId);
  const res = db.prepare(`UPDATE leads SET ${sets.join(', ')} WHERE id = ? AND account_id = ?`).run(...params);
  return res.changes > 0;
}

function deleteLead(accountId, leadId) {
  const res = db.prepare('DELETE FROM leads WHERE id = ? AND account_id = ?').run(leadId, accountId);
  return res.changes > 0;
}

/* ------------------------------------------------------------------- stats */

function stats(accountId) {
  const byStatus = db
    .prepare('SELECT status, COUNT(*) AS n FROM leads WHERE account_id = ? GROUP BY status')
    .all(accountId);
  const counts = { new: 0, contacted: 0, qualified: 0, won: 0, lost: 0 };
  for (const row of byStatus) {
    if (row.status in counts) counts[row.status] = row.n;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const daily = db
    .prepare(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n
         FROM leads
        WHERE account_id = ? AND substr(created_at, 1, 10) >= ?
        GROUP BY day ORDER BY day`
    )
    .all(accountId, since);

  const wonValue = db
    .prepare("SELECT COALESCE(SUM(value_cents), 0) AS cents FROM leads WHERE account_id = ? AND status = 'won'")
    .get(accountId);

  const last7 = db
    .prepare("SELECT COUNT(*) AS n FROM leads WHERE account_id = ? AND created_at > ?")
    .get(accountId, new Date(Date.now() - 7 * 86400000).toISOString());
  const prev7 = db
    .prepare('SELECT COUNT(*) AS n FROM leads WHERE account_id = ? AND created_at > ? AND created_at <= ?')
    .get(
      accountId,
      new Date(Date.now() - 14 * 86400000).toISOString(),
      new Date(Date.now() - 7 * 86400000).toISOString()
    );

  return {
    counts,
    total,
    daily,
    won_value_cents: wonValue ? wonValue.cents : 0,
    last_7_days: last7 ? last7.n : 0,
    previous_7_days: prev7 ? prev7.n : 0,
  };
}

// Everything the account owns, for the CSV export and for "delete my account".
function allLeadsForExport(accountId) {
  return db
    .prepare(
      `SELECT l.*, f.name AS form_name
         FROM leads l JOIN forms f ON f.id = l.form_id
        WHERE l.account_id = ?
        ORDER BY l.created_at DESC`
    )
    .all(accountId);
}

function deleteAccount(accountId) {
  db.prepare('DELETE FROM leads WHERE account_id = ?').run(accountId);
  db.prepare('DELETE FROM forms WHERE account_id = ?').run(accountId);
  db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
}

module.exports = {
  LEAD_STATUSES,
  createAccount,
  getAccountByEmail,
  getAccountById,
  updateAccount,
  setPassword,
  createForm,
  listForms,
  getForm,
  getFormByPublicKey,
  updateForm,
  deleteForm,
  createLead,
  findRecentDuplicate,
  listLeads,
  countLeads,
  getLead,
  updateLead,
  deleteLead,
  stats,
  allLeadsForExport,
  deleteAccount,
};
