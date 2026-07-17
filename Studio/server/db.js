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
  CREATE TABLE IF NOT EXISTS studio_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    character_id INTEGER REFERENCES studio_characters(id),
    prompt TEXT NOT NULL,
    image_size TEXT NOT NULL,
    label TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    fal_job_id TEXT,
    asset_id INTEGER,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_studio_queue_user_status ON studio_queue(user_id, status, id);
  CREATE TABLE IF NOT EXISTS fan_signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    source TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS error_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope TEXT NOT NULL,
    message TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS studio_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS studio_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    char_a INTEGER NOT NULL,
    char_b INTEGER NOT NULL,
    descriptor TEXT NOT NULL,
    UNIQUE(user_id, char_a, char_b)
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

// cast-sheet description arrived later than the table
const charColumns = db.prepare('PRAGMA table_info(studio_characters)').all().map((c) => c.name);
if (!charColumns.includes('description')) db.exec('ALTER TABLE studio_characters ADD COLUMN description TEXT');

function updateCharacter(userId, id, fields) {
  db.prepare('UPDATE studio_characters SET name = ?, lora_url = ?, trigger_word = ?, description = COALESCE(?, description) WHERE user_id = ? AND id = ?')
    .run(fields.name, fields.loraUrl || null, fields.triggerWord || null, fields.description !== undefined ? (fields.description || '') : null, userId, id);
}

function updateAssetMeta(userId, id, meta) {
  db.prepare('UPDATE studio_assets SET meta = ? WHERE user_id = ? AND id = ?').run(JSON.stringify(meta), userId, id);
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

// Wipe ALL of a user's content (pictures, videos, songs, characters, locations,
// relationships, queue and the saved project) but KEEP their account/login.
// Returns the media filenames so the caller can delete the files on disk.
function resetUserContent(userId) {
  const files = db.prepare('SELECT filename FROM studio_assets WHERE user_id = ?').all(userId).map((r) => r.filename);
  for (const t of ['studio_assets', 'studio_characters', 'studio_locations', 'studio_relationships', 'studio_queue', 'user_state']) {
    try { db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId); } catch (_) {}
  }
  return files;
}

function unlinkAssetFromCharacter(userId, id) {
  db.prepare('UPDATE studio_assets SET character_id = NULL WHERE user_id = ? AND id = ?').run(userId, id);
}

/* ---- locations (saved places, reused across scenes) ---- */
function createLocation(userId, name, description) {
  const info = db
    .prepare('INSERT INTO studio_locations (user_id, name, description, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, name, description || null, new Date().toISOString());
  return Number(info.lastInsertRowid);
}

function getLocations(userId) {
  return db.prepare('SELECT * FROM studio_locations WHERE user_id = ? ORDER BY id DESC').all(userId);
}

function getLocation(userId, id) {
  return db.prepare('SELECT * FROM studio_locations WHERE user_id = ? AND id = ?').get(userId, id);
}

function updateLocation(userId, id, { name, description }) {
  db.prepare('UPDATE studio_locations SET name = ?, description = ? WHERE user_id = ? AND id = ?')
    .run(name, description || null, userId, id);
}

function deleteLocation(userId, id) {
  db.prepare('DELETE FROM studio_locations WHERE user_id = ? AND id = ?').run(userId, id);
}

/* ---- relationships (saved chemistry between two characters) ---- */
function setRelationship(userId, charA, charB, descriptor) {
  const [a, b] = [Math.min(charA, charB), Math.max(charA, charB)];
  if (descriptor && descriptor.trim()) {
    db.prepare(`INSERT INTO studio_relationships (user_id, char_a, char_b, descriptor) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, char_a, char_b) DO UPDATE SET descriptor = excluded.descriptor`)
      .run(userId, a, b, descriptor.trim());
  } else {
    db.prepare('DELETE FROM studio_relationships WHERE user_id = ? AND char_a = ? AND char_b = ?').run(userId, a, b);
  }
}

function getRelationship(userId, charA, charB) {
  const [a, b] = [Math.min(charA, charB), Math.max(charA, charB)];
  return db.prepare('SELECT * FROM studio_relationships WHERE user_id = ? AND char_a = ? AND char_b = ?').get(userId, a, b);
}

function getRelationships(userId) {
  return db.prepare('SELECT * FROM studio_relationships WHERE user_id = ?').all(userId);
}

/* ---------------- overnight batch queue ---------------- */
// A persisted queue so a whole storyboard can be submitted once and keep
// generating on the server even if the browser tab closes - the worker in
// studio.js drives these rows forward independent of any HTTP request.
function enqueueScenes(userId, items) {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO studio_queue (user_id, character_id, prompt, image_size, label, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
  );
  return items.map((it) => Number(stmt.run(userId, it.characterId || null, it.prompt, it.imageSize, it.label || null, now, now).lastInsertRowid));
}

function getQueue(userId) {
  return db.prepare('SELECT * FROM studio_queue WHERE user_id = ? ORDER BY id ASC').all(userId);
}

function getQueueItem(id) {
  return db.prepare('SELECT * FROM studio_queue WHERE id = ?').get(id);
}

// One in-flight item per user at a time (keeps behavior identical to the
// interactive /scene endpoint, which also submits one fal job at a time).
function getRunningQueueItem(userId) {
  return db.prepare("SELECT * FROM studio_queue WHERE user_id = ? AND status = 'running' LIMIT 1").get(userId);
}

function getNextPendingQueueItem(userId) {
  return db.prepare("SELECT * FROM studio_queue WHERE user_id = ? AND status = 'pending' ORDER BY id ASC LIMIT 1").get(userId);
}

function getUsersWithPendingQueue() {
  return db.prepare("SELECT DISTINCT user_id FROM studio_queue WHERE status IN ('pending','running')").all().map((r) => r.user_id);
}

function updateQueueItem(id, fields) {
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    const col = { status: 'status', falJobId: 'fal_job_id', assetId: 'asset_id', error: 'error' }[k];
    if (!col) continue;
    sets.push(`${col} = ?`);
    vals.push(v);
  }
  sets.push('updated_at = ?');
  vals.push(new Date().toISOString(), id);
  db.prepare(`UPDATE studio_queue SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

function deleteQueueItem(userId, id) {
  db.prepare("DELETE FROM studio_queue WHERE user_id = ? AND id = ? AND status = 'pending'").run(userId, id);
}

function clearFinishedQueue(userId) {
  db.prepare("DELETE FROM studio_queue WHERE user_id = ? AND status IN ('done','error')").run(userId);
}

/* ---------------- owned-audience email list ---------------- */
// Returns true if this was a new signup, false if the email was already on
// the list (so the public endpoint can still say "you're on the list!"
// either way without leaking whether someone already signed up).
function addFanSignup(email, source) {
  try {
    db.prepare('INSERT INTO fan_signups (email, source, created_at) VALUES (?, ?, ?)')
      .run(email, source || null, new Date().toISOString());
    return true;
  } catch (err) {
    if (/UNIQUE/.test(err.message)) return false;
    throw err;
  }
}

function getFanSignups() {
  return db.prepare('SELECT * FROM fan_signups ORDER BY id DESC').all();
}

function getFanSignupCount() {
  return db.prepare('SELECT COUNT(*) AS n FROM fan_signups').get().n;
}

/* ---------------- error log (for in-app diagnostics) ---------------- */
function logError(scope, message, detail) {
  db.prepare('INSERT INTO error_log (scope, message, detail, created_at) VALUES (?, ?, ?, ?)')
    .run(scope, String(message).slice(0, 500), detail ? String(detail).slice(0, 2000) : null, new Date().toISOString());
  // Keep the table small - this is a rolling diagnostics view, not an audit log.
  db.prepare('DELETE FROM error_log WHERE id NOT IN (SELECT id FROM error_log ORDER BY id DESC LIMIT 200)').run();
}

function getRecentErrors(limit) {
  return db.prepare('SELECT * FROM error_log ORDER BY id DESC LIMIT ?').all(limit || 50);
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
  updateAssetMeta,
  deleteCharacter,
  createAsset,
  getAssets,
  getAsset,
  deleteAsset,
  resetUserContent,
  unlinkAssetFromCharacter,
  createLocation,
  getLocations,
  getLocation,
  updateLocation,
  deleteLocation,
  setRelationship,
  getRelationship,
  getRelationships,
  updatePassword,
  getUserByStripeCustomerId,
  setStripeCustomerId,
  updateSubscriptionFromStripe,
  enqueueScenes,
  getQueue,
  getQueueItem,
  getRunningQueueItem,
  getNextPendingQueueItem,
  getUsersWithPendingQueue,
  updateQueueItem,
  deleteQueueItem,
  clearFinishedQueue,
  logError,
  getRecentErrors,
  addFanSignup,
  getFanSignups,
  getFanSignupCount,
};
