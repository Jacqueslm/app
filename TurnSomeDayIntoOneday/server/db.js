const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// On a hosting platform the database must live on the persistent volume
// (DB_PATH env var); on a home install it sits next to the code as before.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.sqlite');

// A hosted redeploy starts the new container while the platform is still moving
// the storage volume over from the old one, so for a second or two the database
// folder can be missing or unreadable. Opening it in one shot meant the process
// died on boot with "unable to open database file" and the whole deployment was
// marked failed - even though a retry moments later succeeds. So: make sure the
// folder exists, and give the volume a few seconds to show up before giving up.
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
      // Synchronous wait - nothing else has started yet, and the alternative is
      // an immediate crash-loop.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, WAIT_MS);
    }
  }
  throw lastErr;
}
const db = openDatabase();

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_state (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_usage (
    user_id INTEGER NOT NULL REFERENCES users(id),
    usage_date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, usage_date)
  );
  CREATE TABLE IF NOT EXISTS image_usage (
    user_id INTEGER NOT NULL REFERENCES users(id),
    usage_date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, usage_date)
  );
  CREATE TABLE IF NOT EXISTS video_usage (
    user_id INTEGER NOT NULL REFERENCES users(id),
    usage_date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, usage_date)
  );
  CREATE TABLE IF NOT EXISTS studio_characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    lora_url TEXT,
    trigger_word TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS studio_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    filename TEXT NOT NULL,
    character_id INTEGER REFERENCES studio_characters(id),
    meta TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_studio_assets_user ON studio_assets(user_id, kind);
  CREATE TABLE IF NOT EXISTS password_resets (
    token TEXT PRIMARY KEY,
    user_id INTEGER,
    expires_at TEXT,
    used INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS email_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    email TEXT,
    sequence TEXT,
    step INTEGER,
    sent_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_email_log_guard ON email_log(user_id, sequence, step);
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE,
    quiz_result TEXT,
    source TEXT,
    utm_source TEXT,
    created_at TEXT,
    unsubscribed INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS error_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope TEXT NOT NULL,
    message TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL
  );
`);

// Nova conversations are never persisted - the client stopped syncing them,
// and this scrubs any that older builds already stored inside the state blob.
// Runs at every boot; a row is only rewritten while it still carries the key,
// so after the first pass this is a no-op.
try {
  const rows = db.prepare('SELECT user_id, state_json FROM user_state').all();
  for (const row of rows) {
    try {
      const state = JSON.parse(row.state_json);
      if (state && typeof state === 'object' && 'chatHistory' in state) {
        delete state.chatHistory;
        db.prepare('UPDATE user_state SET state_json = ? WHERE user_id = ?')
          .run(JSON.stringify(state), row.user_id);
      }
    } catch (_) { /* unparseable row - leave it untouched */ }
  }
} catch (_) { /* table missing on very first boot - nothing to scrub */ }

function logError(scope, message, detail) {
  db.prepare('INSERT INTO error_log (scope, message, detail, created_at) VALUES (?, ?, ?, ?)')
    .run(scope, String(message).slice(0, 500), detail ? String(detail).slice(0, 2000) : null, new Date().toISOString());
  db.prepare('DELETE FROM error_log WHERE id NOT IN (SELECT id FROM error_log ORDER BY id DESC LIMIT 200)').run();
}

function getRecentErrors(limit) {
  return db.prepare('SELECT * FROM error_log ORDER BY id DESC LIMIT ?').all(limit || 50);
}

const userColumns = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
function addColumnIfMissing(name, ddl) {
  if (!userColumns.includes(name)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${ddl}`);
  }
}
addColumnIfMissing('phone', 'phone TEXT');
addColumnIfMissing('stripe_customer_id', 'stripe_customer_id TEXT');
addColumnIfMissing('stripe_subscription_id', 'stripe_subscription_id TEXT');
addColumnIfMissing('plan', "plan TEXT NOT NULL DEFAULT 'free'");
addColumnIfMissing('subscription_status', 'subscription_status TEXT');
addColumnIfMissing('current_period_end', 'current_period_end TEXT');
addColumnIfMissing('cancel_at_period_end', 'cancel_at_period_end INTEGER NOT NULL DEFAULT 0');
// Bumping this number invalidates every session token issued before the bump -
// that's how "log out on all devices" works without tracking sessions server-side.
addColumnIfMissing('session_version', 'session_version INTEGER NOT NULL DEFAULT 1');
addColumnIfMissing('unsubscribed', 'unsubscribed INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('trial_started_at', 'trial_started_at TEXT');
// Columns land now (Task 7 schema); the capture logic ships in Task 9.
addColumnIfMissing('utm_source', 'utm_source TEXT');
addColumnIfMissing('utm_campaign', 'utm_campaign TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id)');

function createUser(email, passwordHash, phone) {
  const info = db
    .prepare('INSERT INTO users (email, password_hash, phone, created_at) VALUES (?, ?, ?, ?)')
    .run(email, passwordHash, phone || null, new Date().toISOString());
  return Number(info.lastInsertRowid);
}

function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getState(userId) {
  const row = db.prepare('SELECT state_json FROM user_state WHERE user_id = ?').get(userId);
  return row ? row.state_json : null;
}

function saveState(userId, stateJson) {
  db.prepare(
    `INSERT INTO user_state (user_id, state_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`
  ).run(userId, stateJson, new Date().toISOString());
}

function deleteUser(userId) {
  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM email_log WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM studio_assets WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM studio_characters WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM video_usage WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM image_usage WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM chat_usage WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_state WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

function getChatCount(userId, usageDate) {
  const row = db
    .prepare('SELECT count FROM chat_usage WHERE user_id = ? AND usage_date = ?')
    .get(userId, usageDate);
  return row ? row.count : 0;
}

function incrementChatCount(userId, usageDate) {
  db.prepare(
    `INSERT INTO chat_usage (user_id, usage_date, count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, usage_date) DO UPDATE SET count = count + 1`
  ).run(userId, usageDate);
}

function getImageCount(userId, usageDate) {
  const row = db
    .prepare('SELECT count FROM image_usage WHERE user_id = ? AND usage_date = ?')
    .get(userId, usageDate);
  return row ? row.count : 0;
}

function incrementImageCount(userId, usageDate) {
  db.prepare(
    `INSERT INTO image_usage (user_id, usage_date, count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, usage_date) DO UPDATE SET count = count + 1`
  ).run(userId, usageDate);
}

function getVideoCount(userId, usageDate) {
  const row = db
    .prepare('SELECT count FROM video_usage WHERE user_id = ? AND usage_date = ?')
    .get(userId, usageDate);
  return row ? row.count : 0;
}

function incrementVideoCount(userId, usageDate) {
  db.prepare(
    `INSERT INTO video_usage (user_id, usage_date, count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, usage_date) DO UPDATE SET count = count + 1`
  ).run(userId, usageDate);
}

function createCharacter(userId, name, loraUrl, triggerWord) {
  const info = db
    .prepare('INSERT INTO studio_characters (user_id, name, lora_url, trigger_word, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(userId, name, loraUrl || null, triggerWord || null, new Date().toISOString());
  return Number(info.lastInsertRowid);
}

function getCharacters(userId) {
  return db.prepare('SELECT * FROM studio_characters WHERE user_id = ? ORDER BY id DESC').all(userId);
}

function getCharacter(userId, id) {
  return db.prepare('SELECT * FROM studio_characters WHERE user_id = ? AND id = ?').get(userId, id);
}

function updateCharacter(userId, id, fields) {
  db.prepare('UPDATE studio_characters SET name = ?, lora_url = ?, trigger_word = ? WHERE user_id = ? AND id = ?')
    .run(fields.name, fields.loraUrl || null, fields.triggerWord || null, userId, id);
}

function deleteCharacter(userId, id) {
  db.prepare('UPDATE studio_assets SET character_id = NULL WHERE user_id = ? AND character_id = ?').run(userId, id);
  db.prepare('DELETE FROM studio_characters WHERE user_id = ? AND id = ?').run(userId, id);
}

function createAsset(userId, kind, label, filename, characterId, meta) {
  const info = db
    .prepare('INSERT INTO studio_assets (user_id, kind, label, filename, character_id, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(userId, kind, label, filename, characterId || null, meta ? JSON.stringify(meta) : null, new Date().toISOString());
  return Number(info.lastInsertRowid);
}

function getAssets(userId, kind) {
  return kind
    ? db.prepare('SELECT * FROM studio_assets WHERE user_id = ? AND kind = ? ORDER BY id DESC').all(userId, kind)
    : db.prepare('SELECT * FROM studio_assets WHERE user_id = ? ORDER BY id DESC').all(userId);
}

function getAsset(userId, id) {
  return db.prepare('SELECT * FROM studio_assets WHERE user_id = ? AND id = ?').get(userId, id);
}

function deleteAsset(userId, id) {
  db.prepare('DELETE FROM studio_assets WHERE user_id = ? AND id = ?').run(userId, id);
}

function createPasswordReset(token, userId, expiresAt) {
  db.prepare('INSERT INTO password_resets (token, user_id, expires_at, used) VALUES (?, ?, ?, 0)')
    .run(token, userId, expiresAt);
}

// Valid = exists, unused, unexpired. Consuming marks it used atomically so a
// token can never reset a password twice.
function consumePasswordReset(token) {
  const row = db.prepare('SELECT * FROM password_resets WHERE token = ?').get(token);
  if (!row || row.used || new Date(row.expires_at).getTime() < Date.now()) return null;
  db.prepare('UPDATE password_resets SET used = 1 WHERE token = ?').run(token);
  return row;
}

function hasEmailBeenSent(userId, sequence, step) {
  return Boolean(
    db.prepare('SELECT 1 FROM email_log WHERE user_id = ? AND sequence = ? AND step = ?')
      .get(userId, sequence, step)
  );
}

function logEmailSent(userId, email, sequence, step) {
  db.prepare('INSERT INTO email_log (user_id, email, sequence, step, sent_at) VALUES (?, ?, ?, ?, ?)')
    .run(userId, email, sequence, step, new Date().toISOString());
}

function setUnsubscribed(userId, value) {
  db.prepare('UPDATE users SET unsubscribed = ? WHERE id = ?').run(value ? 1 : 0, userId);
}

function createLead(email, quizResult, source, utmSource) {
  const info = db
    .prepare('INSERT INTO leads (email, quiz_result, source, utm_source, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(email, quizResult || null, source || null, utmSource || null, new Date().toISOString());
  return Number(info.lastInsertRowid);
}

function getLeadByEmail(email) {
  return db.prepare('SELECT * FROM leads WHERE email = ?').get(email);
}

function getLeadById(id) {
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

function setLeadUnsubscribed(leadId, value) {
  db.prepare('UPDATE leads SET unsubscribed = ? WHERE id = ?').run(value ? 1 : 0, leadId);
}

// Leads have no user id, so their double-send guard keys on the address.
function hasEmailBeenSentToAddress(email, sequence, step) {
  return Boolean(
    db.prepare('SELECT 1 FROM email_log WHERE email = ? AND sequence = ? AND step = ?')
      .get(email, sequence, step)
  );
}

// Everyone whose nurture could still owe an email. 7-day lookback: the
// sequence is 5 days, and anything older is settled.
function getLeadsInNurtureWindow() {
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  return db.prepare('SELECT * FROM leads WHERE unsubscribed = 0 AND created_at > ?').all(cutoff);
}

function bumpSessionVersion(userId) {
  db.prepare('UPDATE users SET session_version = session_version + 1 WHERE id = ?').run(userId);
  const row = db.prepare('SELECT session_version FROM users WHERE id = ?').get(userId);
  return row ? row.session_version : 1;
}

function updatePassword(userId, passwordHash) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

function getUserByStripeCustomerId(stripeCustomerId) {
  return db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?').get(stripeCustomerId);
}

function setStripeCustomerId(userId, stripeCustomerId) {
  db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(stripeCustomerId, userId);
}

function updateSubscriptionFromStripe(userId, fields) {
  const {
    plan,
    subscriptionStatus,
    stripeSubscriptionId,
    currentPeriodEnd,
    cancelAtPeriodEnd,
  } = fields;
  // Trial-start detection lives at this choke point because trials activate by
  // two paths - the Stripe webhook AND the ?refresh=1 reconciliation - and
  // both funnel through here. The flag flips exactly once per user, ever.
  let trialJustStarted = false;
  if (subscriptionStatus === 'trialing') {
    const row = db.prepare('SELECT trial_started_at FROM users WHERE id = ?').get(userId);
    if (row && !row.trial_started_at) {
      db.prepare('UPDATE users SET trial_started_at = ? WHERE id = ?')
        .run(new Date().toISOString(), userId);
      trialJustStarted = true;
    }
  }
  db.prepare(
    `UPDATE users SET
       plan = ?,
       subscription_status = ?,
       stripe_subscription_id = ?,
       current_period_end = ?,
       cancel_at_period_end = ?
     WHERE id = ?`
  ).run(
    plan,
    subscriptionStatus || null,
    stripeSubscriptionId || null,
    currentPeriodEnd || null,
    cancelAtPeriodEnd ? 1 : 0,
    userId
  );
  return { trialJustStarted };
}

// Everyone whose trial sequence could still owe an email. 9-day lookback: the
// day-7 branch may send late, and anything older than that is settled.
function getUsersInTrialWindow() {
  const cutoff = new Date(Date.now() - 9 * 86400000).toISOString();
  return db.prepare('SELECT * FROM users WHERE trial_started_at IS NOT NULL AND trial_started_at > ?').all(cutoff);
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  getState,
  saveState,
  deleteUser,
  getChatCount,
  incrementChatCount,
  getImageCount,
  incrementImageCount,
  getVideoCount,
  incrementVideoCount,
  createCharacter,
  getCharacters,
  getCharacter,
  updateCharacter,
  deleteCharacter,
  createAsset,
  getAssets,
  getAsset,
  deleteAsset,
  bumpSessionVersion,
  updatePassword,
  createPasswordReset,
  consumePasswordReset,
  hasEmailBeenSent,
  logEmailSent,
  setUnsubscribed,
  createLead,
  getLeadByEmail,
  getLeadById,
  setLeadUnsubscribed,
  hasEmailBeenSentToAddress,
  getLeadsInNurtureWindow,
  getUsersInTrialWindow,
  getUserByStripeCustomerId,
  setStripeCustomerId,
  updateSubscriptionFromStripe,
  logError,
  getRecentErrors,
};
