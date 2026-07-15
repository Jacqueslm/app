const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'data.sqlite');
const db = new DatabaseSync(DB_PATH);

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
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS chat_usage (
    user_id INTEGER NOT NULL REFERENCES users(id),
    usage_date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, usage_date)
  );
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
function addColumnIfMissing(name, ddl) {
  if (!userColumns.includes(name)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${ddl}`);
  }
}
// user_state.version was added after launch; backfill it on existing databases.
const stateColumns = db.prepare('PRAGMA table_info(user_state)').all().map((c) => c.name);
if (!stateColumns.includes('version')) {
  db.exec('ALTER TABLE user_state ADD COLUMN version INTEGER NOT NULL DEFAULT 1');
}
addColumnIfMissing('stripe_customer_id', 'stripe_customer_id TEXT');
addColumnIfMissing('stripe_subscription_id', 'stripe_subscription_id TEXT');
addColumnIfMissing('plan', "plan TEXT NOT NULL DEFAULT 'free'");
addColumnIfMissing('subscription_status', 'subscription_status TEXT');
addColumnIfMissing('current_period_end', 'current_period_end TEXT');
addColumnIfMissing('cancel_at_period_end', 'cancel_at_period_end INTEGER NOT NULL DEFAULT 0');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id)');

function createUser(email, passwordHash) {
  const info = db
    .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
    .run(email, passwordHash, new Date().toISOString());
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

// Returns { state, version } (state null if the user has never saved).
function getStateWithVersion(userId) {
  const row = db
    .prepare('SELECT state_json, version FROM user_state WHERE user_id = ?')
    .get(userId);
  return row ? { state: row.state_json, version: row.version } : { state: null, version: 0 };
}

// Optimistic-concurrency save. The client sends the version it last loaded; if the server
// has moved on since (another device saved), this returns a conflict WITHOUT overwriting, so
// the client can merge and retry instead of silently clobbering the other device's data.
// baseVersion === null forces an unconditional overwrite (used by trusted server paths).
// Read-then-write runs synchronously with no await between, so it is atomic per request.
function saveStateVersioned(userId, stateJson, baseVersion) {
  const now = new Date().toISOString();
  const cur = db.prepare('SELECT version FROM user_state WHERE user_id = ?').get(userId);
  if (!cur) {
    db.prepare(
      'INSERT INTO user_state (user_id, state_json, updated_at, version) VALUES (?, ?, ?, 1)'
    ).run(userId, stateJson, now);
    return { ok: true, version: 1 };
  }
  if (baseVersion !== null && baseVersion !== undefined && baseVersion !== cur.version) {
    const row = db
      .prepare('SELECT state_json, version FROM user_state WHERE user_id = ?')
      .get(userId);
    return { ok: false, conflict: true, version: row.version, state: row.state_json };
  }
  const nextVersion = cur.version + 1;
  db.prepare(
    'UPDATE user_state SET state_json = ?, updated_at = ?, version = ? WHERE user_id = ?'
  ).run(stateJson, now, nextVersion, userId);
  return { ok: true, version: nextVersion };
}

// Unconditional save (kept for internal callers that don't do concurrency control).
function saveState(userId, stateJson) {
  saveStateVersioned(userId, stateJson, null);
}

function deleteUser(userId) {
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

// Atomically reserve a chat slot and return the new count. Doing the read and the
// increment as one statement closes the check-then-increment race where several
// concurrent requests could all read the same pre-increment count and slip past the
// daily limit. Callers reject when the returned count exceeds the limit and refund
// with decrementChatCount() if the downstream call never actually happened.
function reserveChatSlot(userId, usageDate) {
  const row = db
    .prepare(
      `INSERT INTO chat_usage (user_id, usage_date, count) VALUES (?, ?, 1)
       ON CONFLICT(user_id, usage_date) DO UPDATE SET count = count + 1
       RETURNING count`
    )
    .get(userId, usageDate);
  return row ? row.count : 1;
}

function decrementChatCount(userId, usageDate) {
  db.prepare(
    'UPDATE chat_usage SET count = MAX(0, count - 1) WHERE user_id = ? AND usage_date = ?'
  ).run(userId, usageDate);
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
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  getState,
  getStateWithVersion,
  saveState,
  saveStateVersioned,
  deleteUser,
  getChatCount,
  incrementChatCount,
  reserveChatSlot,
  decrementChatCount,
  updatePassword,
  getUserByStripeCustomerId,
  setStripeCustomerId,
  updateSubscriptionFromStripe,
};
