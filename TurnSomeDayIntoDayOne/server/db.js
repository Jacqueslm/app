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
    updated_at TEXT NOT NULL
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

function saveState(userId, stateJson) {
  db.prepare(
    `INSERT INTO user_state (user_id, state_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`
  ).run(userId, stateJson, new Date().toISOString());
}

function deleteUser(userId) {
  db.prepare('DELETE FROM chat_usage WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_state WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

// Atomically checks-and-increments in one statement, so concurrent requests for the same
// user/day can't all read the count before any of them writes it back (the classic
// read-then-write race). The WHERE clause only gates the ON CONFLICT branch - a brand-new
// row for this user/day always inserts count=1 regardless of `limit`, which is correct since
// limit is never less than 1. Returns the new count if the request was allowed, or null if
// the user was already at/over `limit`.
function tryConsumeChatQuota(userId, usageDate, limit) {
  const row = db
    .prepare(
      `INSERT INTO chat_usage (user_id, usage_date, count) VALUES (?, ?, 1)
       ON CONFLICT(user_id, usage_date) DO UPDATE SET count = count + 1 WHERE count < ?
       RETURNING count`
    )
    .get(userId, usageDate, limit);
  return row ? row.count : null;
}

// Un-does a tryConsumeChatQuota() call for a request that turned out not to actually use a
// chat (e.g. the upstream Anthropic call failed) - so a bad server config or a transient
// outage doesn't cost the user one of their free chats.
function refundChatQuota(userId, usageDate) {
  db.prepare(
    'UPDATE chat_usage SET count = count - 1 WHERE user_id = ? AND usage_date = ? AND count > 0'
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
  saveState,
  deleteUser,
  tryConsumeChatQuota,
  refundChatQuota,
  updatePassword,
  getUserByStripeCustomerId,
  setStripeCustomerId,
  updateSubscriptionFromStripe,
};
