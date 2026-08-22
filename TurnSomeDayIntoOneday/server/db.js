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
  -- Web push: one row per browser/device a user allowed notifications on.
  -- endpoint is the unique address the push service gave that install, so the
  -- same account on a phone and a laptop is two rows and both get reminded.
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_sent_date TEXT,
    fail_count INTEGER NOT NULL DEFAULT 0
  );
  -- Live community rooms. Every post passes through the AI moderator BEFORE it
  -- can be seen (status starts 'held' and only the moderator or the owner can
  -- make it 'live'), because in a recovery space one predatory or triggering
  -- post reaching the feed is worse than every honest post arriving a few
  -- seconds late. ai_reason keeps the moderator's stated reason so the owner
  -- can audit every call it made.
  CREATE TABLE IF NOT EXISTS room_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    room TEXT NOT NULL,
    display_name TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'held',
    ai_reason TEXT,
    crisis INTEGER NOT NULL DEFAULT 0,
    report_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS room_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(post_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS room_bans (
    user_id INTEGER PRIMARY KEY,
    reason TEXT,
    created_at TEXT NOT NULL
  );
  -- Reviews written by members. The /reviews page used to read a JSON file that
  -- only Jacques could edit by hand, so in practice nobody could leave one and
  -- the page said "no reviews yet" forever. These arrive from inside the app,
  -- sit as 'pending' until the owner approves them, and only approved rows are
  -- ever served publicly. One review per person: re-submitting edits theirs.
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    when_label TEXT,
    body TEXT NOT NULL,
    stars INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  );
  -- Small key/value store. Holds the VAPID keypair so push works with no
  -- manual environment setup: generated once on first boot, reused forever.
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS couple_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_a INTEGER NOT NULL REFERENCES users(id),
    user_b INTEGER REFERENCES users(id),
    name_a TEXT NOT NULL DEFAULT '',
    name_b TEXT NOT NULL DEFAULT '',
    code TEXT UNIQUE NOT NULL,
    together_done INTEGER NOT NULL DEFAULT 0,
    nudge_from INTEGER,
    nudge_at TEXT,
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

// Diagnostics had a Refresh button and no way to empty the list, so once an
// error was fixed it sat there forever and the panel stopped being readable.
function clearErrors() {
  const n = db.prepare('SELECT COUNT(*) AS c FROM error_log').get().c;
  db.prepare('DELETE FROM error_log').run();
  return n;
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
addColumnIfMissing('utm_medium', 'utm_medium TEXT');
// Where a subscription was bought. Deliberately not a play-specific flag: the
// same three columns serve Apple when that ships, so adding a second store is a
// new verifier rather than a schema change. Entitlement never reads this - Pro
// is Pro wherever it was paid for - it exists so refunds, cancellations and
// support can be traced back to the right billing system.
addColumnIfMissing('billing_source', "billing_source TEXT NOT NULL DEFAULT 'stripe'");
addColumnIfMissing('store_product_id', 'store_product_id TEXT');
addColumnIfMissing('store_purchase_token', 'store_purchase_token TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id)');

// leads predates the utm_medium/utm_campaign columns, so it needs the same
// additive migration users already has - existing rows keep NULL.
const leadColumns = db.prepare('PRAGMA table_info(leads)').all().map((c) => c.name);
function addLeadColumnIfMissing(name, ddl) {
  if (!leadColumns.includes(name)) {
    db.exec(`ALTER TABLE leads ADD COLUMN ${ddl}`);
  }
}
addLeadColumnIfMissing('utm_medium', 'utm_medium TEXT');
addLeadColumnIfMissing('utm_campaign', 'utm_campaign TEXT');

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

// ─── WEB PUSH ────────────────────────────────────────────────────────────────
function getSetting(key) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  return row ? row.value : null;
}
function setSetting(key, value) {
  db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, value);
}
// Re-subscribing with the same endpoint moves it to the current account rather
// than erroring - a shared device that switches accounts must not keep pushing
// the previous user's reminders.
function savePushSubscription(userId, sub) {
  db.prepare(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id,
       p256dh = excluded.p256dh, auth = excluded.auth, fail_count = 0`)
    .run(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, new Date().toISOString());
}
function deletePushSubscription(endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}
function getPushSubscriptions(userId) {
  return db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
}
function getAllPushSubscriptions() {
  return db.prepare('SELECT * FROM push_subscriptions').all();
}
function markPushSent(id, dateStr) {
  db.prepare('UPDATE push_subscriptions SET last_sent_date = ?, fail_count = 0 WHERE id = ?').run(dateStr, id);
}
// A push service returning 404/410 means that install is gone for good; other
// failures are transient, so they only count toward a threshold before the row
// is dropped rather than deleting on the first blip.
function bumpPushFailure(id) {
  db.prepare('UPDATE push_subscriptions SET fail_count = fail_count + 1 WHERE id = ?').run(id);
  db.prepare('DELETE FROM push_subscriptions WHERE id = ? AND fail_count >= 8').run(id);
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

function createLead(email, quizResult, source, utm) {
  // utm may be a bare source string (older callers) or the {source,medium,campaign}
  // object the pages send now.
  const u = typeof utm === 'string' ? { source: utm } : (utm || {});
  const info = db
    .prepare('INSERT INTO leads (email, quiz_result, source, utm_source, utm_medium, utm_campaign, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(email, quizResult || null, source || null, u.source || null, u.medium || null, u.campaign || null, new Date().toISOString());
  return Number(info.lastInsertRowid);
}

// Written once, at signup, and only when the columns are still empty - a later
// visit carrying different tags must not overwrite first-touch attribution.
function setUserUtm(userId, utm) {
  const u = utm || {};
  if (!u.source && !u.medium && !u.campaign) return;
  db.prepare(
    'UPDATE users SET utm_source = COALESCE(utm_source, ?), utm_medium = COALESCE(utm_medium, ?), utm_campaign = COALESCE(utm_campaign, ?) WHERE id = ?'
  ).run(u.source || null, u.medium || null, u.campaign || null, userId);
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
// The authoritative seat count for the Founding Lifetime cap. Cheap enough to
// run on every checkout attempt, which is what makes the cached copy elsewhere
// safe: the cache can go stale without ever overselling.
// Counts lifetime seats from every billing source. The Founding 50 is a promise
// about how many people get it, not about how they paid.
function countLifetimeSold() {
  return db.prepare("SELECT COUNT(*) n FROM users WHERE plan = 'lifetime'").get().n;
}

// A store purchase is recorded through the same fields Stripe writes, so
// entitlement, the trial sequence and the admin stats keep working untouched.
function recordStorePurchase(userId, fields) {
  const { source, plan, productId, purchaseToken, subscriptionStatus, currentPeriodEnd } = fields;
  db.prepare(
    `UPDATE users SET
       plan = ?, subscription_status = ?, current_period_end = ?,
       cancel_at_period_end = 0,
       billing_source = ?, store_product_id = ?, store_purchase_token = ?
     WHERE id = ?`
  ).run(plan, subscriptionStatus || 'active', currentPeriodEnd || null,
        source, productId || null, purchaseToken || null, userId);
}

// A purchase token may only ever belong to one account - this is what stops the
// same receipt being replayed to upgrade a second account for free.
function getUserByPurchaseToken(token) {
  return db.prepare('SELECT * FROM users WHERE store_purchase_token = ?').get(token);
}

function getUsersInTrialWindow() {
  const cutoff = new Date(Date.now() - 9 * 86400000).toISOString();
  return db.prepare('SELECT * FROM users WHERE trial_started_at IS NOT NULL AND trial_started_at > ?').all(cutoff);
}

// Accounts whose synced state exists and who have an email we can write to.
// The win-back runner reads each one's state to decide if they've gone quiet;
// doing the filtering in JS keeps the JSON blob out of SQL, which is where it
// belongs given state_json has no schema guarantees.
function getUsersWithState() {
  return db.prepare(`
    SELECT u.id, u.email, s.state_json
    FROM users u JOIN user_state s ON s.user_id = u.id
    WHERE u.email IS NOT NULL AND u.email != ''
  `).all();
}

// ─── OWNER STATS ──────────────────────────────────────────────────────────────
// Untagged traffic buckets as "(direct)" rather than being dropped, so the
// per-source rows always sum back to the totals - a breakdown that quietly
// omits rows reads as precise while being wrong.
const DIRECT = '(direct)';
// A paid account is one Stripe says is 'active'. 'trialing' is counted and
// reported separately: a 7-day trial that hasn't converted is not revenue.
const PAID_SQL = "plan != 'free' AND subscription_status = 'active'";
const TRIALING_SQL = "plan != 'free' AND subscription_status = 'trialing'";
// SQLite has no ISO week, so derive it: %W is Monday-based but numbers the first
// partial week 00, and strftime('%Y') can disagree with the ISO year at a year
// boundary. Grouping by the Monday date sidesteps both and still sorts correctly.
const WEEK_SQL = "date(created_at, 'weekday 0', '-6 days')";

function getAdminStats(opts) {
  const freeChatLimit = (opts && opts.freeChatLimit) || 3;
  const windowDays = (opts && opts.windowDays) || 30;
  const since = new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);

  const totals = {
    signups: db.prepare('SELECT COUNT(*) n FROM users').get().n,
    trial_starts: db.prepare('SELECT COUNT(*) n FROM users WHERE trial_started_at IS NOT NULL').get().n,
    paid: db.prepare(`SELECT COUNT(*) n FROM users WHERE ${PAID_SQL}`).get().n,
    trialing: db.prepare(`SELECT COUNT(*) n FROM users WHERE ${TRIALING_SQL}`).get().n,
    leads: db.prepare('SELECT COUNT(*) n FROM leads').get().n,
    // Which page each lead came in through. utm_source answers "which campaign";
    // this answers "which page", and with no campaigns running yet it is the only
    // one of the two that says anything.
    leads_by_page: db.prepare(`
      SELECT COALESCE(NULLIF(source,''), '(unknown)') AS page, COUNT(*) AS leads
      FROM leads GROUP BY 1 ORDER BY leads DESC
    `).all(),
  };

  // ── Funnel + retention (13 Aug 2026) ──────────────────────────────────────
  // The gap this closes: every number above stops at "a trial started". None
  // of them answer the two questions that decide whether to make more content
  // or fix the product - does a trial become money, and does anybody come back
  // after week one. Both are computed from data already stored; nothing new is
  // collected and no third-party analytics is involved, which keeps the
  // "privacy is the product" promise literally true.
  const trialStarts = totals.trial_starts;
  const funnel = {
    leads: totals.leads,
    signups: totals.signups,
    trial_starts: trialStarts,
    paid: totals.paid,
    // Percentages are only shown once a denominator is big enough to mean
    // something. Below that they read as precision the data cannot support -
    // one paying customer out of three is not "33% conversion".
    lead_to_signup: totals.leads >= 20 ? Math.round((totals.signups / totals.leads) * 100) : null,
    signup_to_trial: totals.signups >= 20 ? Math.round((trialStarts / totals.signups) * 100) : null,
    trial_to_paid: trialStarts >= 20 ? Math.round((totals.paid / trialStarts) * 100) : null,
    min_sample: 20,
  };

  // Retention: of the accounts that reached each age, how many were still
  // doing something in the app on/after that day. Anchored to each user's own
  // start date, so a cohort of one week ago cannot dilute D30.
  const retention = (() => {
    let rows = [];
    try { rows = getUsersWithState(); } catch (_) { return null; }
    const buckets = { d1: [0, 0], d7: [0, 0], d30: [0, 0] };
    for (const r of rows) {
      let st = null;
      try { st = JSON.parse(r.state_json); } catch (_) { continue; }
      if (!st || !st.startDate) continue;
      const start = new Date(st.startDate).getTime();
      if (!start) continue;
      const ageDays = Math.floor((Date.now() - start) / 86400000);
      const log = Array.isArray(st.activityLog) ? st.activityLog : [];
      const lastTs = log.reduce((m, a) => {
        const t = a && a.ts ? new Date(a.ts).getTime() : 0;
        return t > m ? t : m;
      }, 0);
      const aliveDays = lastTs ? Math.floor((lastTs - start) / 86400000) : -1;
      for (const [key, day] of [['d1', 1], ['d7', 7], ['d30', 30]]) {
        if (ageDays < day) continue;          // hasn't had the chance yet
        buckets[key][1] += 1;                 // eligible
        if (aliveDays >= day) buckets[key][0] += 1; // still active at that age
      }
    }
    const pct = ([kept, elig]) => (elig >= 10 ? Math.round((kept / elig) * 100) : null);
    return {
      d1: { kept: buckets.d1[0], eligible: buckets.d1[1], pct: pct(buckets.d1) },
      d7: { kept: buckets.d7[0], eligible: buckets.d7[1], pct: pct(buckets.d7) },
      d30: { kept: buckets.d30[0], eligible: buckets.d30[1], pct: pct(buckets.d30) },
      min_sample: 10,
    };
  })();

  const bySourceRows = db.prepare(`
    SELECT COALESCE(NULLIF(utm_source,''), ?) AS utm_source,
           COUNT(*) AS signups,
           SUM(CASE WHEN trial_started_at IS NOT NULL THEN 1 ELSE 0 END) AS trial_starts,
           SUM(CASE WHEN ${PAID_SQL} THEN 1 ELSE 0 END) AS paid
    FROM users GROUP BY 1
  `).all(DIRECT);
  const leadsBySource = db.prepare(`
    SELECT COALESCE(NULLIF(utm_source,''), ?) AS utm_source, COUNT(*) AS leads
    FROM leads GROUP BY 1
  `).all(DIRECT);
  const sourceMap = new Map();
  bySourceRows.forEach((r) => sourceMap.set(r.utm_source, { utm_source: r.utm_source, signups: r.signups, trial_starts: r.trial_starts, paid: r.paid, leads: 0 }));
  leadsBySource.forEach((r) => {
    const e = sourceMap.get(r.utm_source) || { utm_source: r.utm_source, signups: 0, trial_starts: 0, paid: 0, leads: 0 };
    e.leads = r.leads;
    sourceMap.set(r.utm_source, e);
  });
  const by_utm_source = [...sourceMap.values()].sort((a, b) => b.signups - a.signups || b.leads - a.leads);

  // Signups and leads bucket by their own created_at; trials bucket by
  // trial_started_at, so a trial shows in the week it actually began rather than
  // the week the account was created.
  const signupsByWeek = db.prepare(`SELECT ${WEEK_SQL} AS week, COUNT(*) n FROM users GROUP BY 1`).all();
  const trialsByWeek = db.prepare(`SELECT date(trial_started_at, 'weekday 0', '-6 days') AS week, COUNT(*) n FROM users WHERE trial_started_at IS NOT NULL GROUP BY 1`).all();
  const paidByWeek = db.prepare(`SELECT ${WEEK_SQL} AS week, COUNT(*) n FROM users WHERE ${PAID_SQL} GROUP BY 1`).all();
  const leadsByWeek = db.prepare(`SELECT ${WEEK_SQL} AS week, COUNT(*) n FROM leads GROUP BY 1`).all();
  const weekMap = new Map();
  const weekBucket = (w) => {
    if (!weekMap.has(w)) weekMap.set(w, { week: w, signups: 0, trial_starts: 0, paid: 0, leads: 0 });
    return weekMap.get(w);
  };
  signupsByWeek.forEach((r) => { weekBucket(r.week).signups = r.n; });
  trialsByWeek.forEach((r) => { weekBucket(r.week).trial_starts = r.n; });
  paidByWeek.forEach((r) => { weekBucket(r.week).paid = r.n; });
  leadsByWeek.forEach((r) => { weekBucket(r.week).leads = r.n; });
  const by_week = [...weekMap.values()].filter((w) => w.week).sort((a, b) => (a.week < b.week ? 1 : -1));

  // Average over user-days with activity, not calendar days: someone who chats
  // twice a week shouldn't be averaged down to near zero by their quiet days.
  const freeUsage = db.prepare(`
    SELECT SUM(c.count) AS chats, COUNT(*) AS user_days
    FROM chat_usage c JOIN users u ON u.id = c.user_id
    WHERE c.usage_date >= ? AND NOT (${PAID_SQL.replace(/plan/g, 'u.plan').replace(/subscription_status/g, 'u.subscription_status')})
  `).get(since);
  const capped = db.prepare(`
    SELECT COUNT(DISTINCT c.user_id) AS n
    FROM chat_usage c JOIN users u ON u.id = c.user_id
    WHERE c.usage_date >= ? AND c.count >= ?
      AND NOT (${PAID_SQL.replace(/plan/g, 'u.plan').replace(/subscription_status/g, 'u.subscription_status')})
  `).get(since, freeChatLimit).n;

  return {
    generated_at: new Date().toISOString(),
    totals,
    funnel,
    retention,
    by_utm_source,
    by_week,
    usage: {
      avg_chats_per_active_free_user_per_day:
        freeUsage.user_days ? Math.round((freeUsage.chats / freeUsage.user_days) * 100) / 100 : 0,
      active_free_user_days: freeUsage.user_days || 0,
      users_hitting_daily_cap: capped,
      cap_window_days: windowDays,
      free_chat_limit: freeChatLimit,
    },
  };
}

// ─── ROOMS ───────────────────────────────────────────────────────────────────
function createRoomPost(userId, room, displayName, body) {
  const r = db.prepare(
    'INSERT INTO room_posts (user_id, room, display_name, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, room, displayName, body, 'held', new Date().toISOString());
  return r.lastInsertRowid;
}
function setRoomPostVerdict(id, status, aiReason, crisis) {
  db.prepare('UPDATE room_posts SET status = ?, ai_reason = ?, crisis = ? WHERE id = ?')
    .run(status, aiReason || null, crisis ? 1 : 0, id);
}
function getRoomFeed(room, limit) {
  return db.prepare(
    "SELECT id, display_name, body, created_at FROM room_posts WHERE room = ? AND status = 'live' ORDER BY id DESC LIMIT ?"
  ).all(room, limit || 50);
}
function getRoomPost(id) {
  return db.prepare('SELECT * FROM room_posts WHERE id = ?').get(id);
}
function countRoomPostsToday(userId, dayIso) {
  return db.prepare("SELECT COUNT(*) AS n FROM room_posts WHERE user_id = ? AND created_at >= ?").get(userId, dayIso).n;
}
function addRoomReport(postId, userId, reason) {
  // One report per person per post; a second tap is not a second vote.
  db.prepare('INSERT OR IGNORE INTO room_reports (post_id, user_id, reason, created_at) VALUES (?, ?, ?, ?)')
    .run(postId, userId, reason || null, new Date().toISOString());
  const n = db.prepare('SELECT COUNT(*) AS n FROM room_reports WHERE post_id = ?').get(postId).n;
  db.prepare('UPDATE room_posts SET report_count = ? WHERE id = ?').run(n, postId);
  return n;
}
function hideRoomPost(id, why) {
  db.prepare("UPDATE room_posts SET status = 'held', ai_reason = COALESCE(ai_reason,'') || ' | ' || ? WHERE id = ?").run(why, id);
}
function getModQueue() {
  return db.prepare(
    "SELECT id, user_id, room, display_name, body, status, ai_reason, crisis, report_count, created_at FROM room_posts WHERE status != 'live' OR report_count > 0 ORDER BY id DESC LIMIT 100"
  ).all();
}
function setRoomPostStatus(id, status) {
  db.prepare('UPDATE room_posts SET status = ? WHERE id = ?').run(status, id);
}
function banRoomUser(userId, reason) {
  db.prepare('INSERT OR REPLACE INTO room_bans (user_id, reason, created_at) VALUES (?, ?, ?)')
    .run(userId, reason || null, new Date().toISOString());
}
function isRoomBanned(userId) {
  return !!db.prepare('SELECT 1 FROM room_bans WHERE user_id = ?').get(userId);
}


// ── Reviews ──────────────────────────────────────────────────────────────────
// A member gets exactly one review. Writing a second one replaces the first and
// sends it back to pending, so an edited review is never published unread.
function upsertReview(userId, name, whenLabel, body, stars) {
  db.prepare(
    `INSERT INTO reviews (user_id, name, when_label, body, stars, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)
     ON CONFLICT(user_id) DO UPDATE SET
       name = excluded.name, when_label = excluded.when_label, body = excluded.body,
       stars = excluded.stars, status = 'pending', created_at = excluded.created_at`
  ).run(userId, name, whenLabel || null, body, stars, new Date().toISOString());
}
function getMyReview(userId) {
  return db.prepare('SELECT * FROM reviews WHERE user_id = ?').get(userId) || null;
}
function getPublishedReviews(limit) {
  return db.prepare(
    "SELECT name, when_label, body, stars, created_at FROM reviews WHERE status = 'published' ORDER BY id DESC LIMIT ?"
  ).all(limit || 50);
}
function getReviewQueue() {
  return db.prepare("SELECT * FROM reviews WHERE status = 'pending' ORDER BY id DESC LIMIT 100").all();
}
function setReviewStatus(id, status) {
  db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, id);
}

// ─── Couple links (the Together program, two accounts, one table) ────────────
// Deliberately minimal: the link carries ONLY the shared Together progress and
// a nudge. No clocks, no journals, no slips - partners cannot see any of that.
function coupleRowFor(userId) {
  return db.prepare('SELECT * FROM couple_links WHERE user_a = ? OR user_b = ?').get(userId, userId) || null;
}
function createCoupleLink(userId, name) {
  const existing = coupleRowFor(userId);
  if (existing) return existing;
  // Unambiguous alphabet: no 0/O or 1/I to misread off a partner's screen.
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
  } while (db.prepare('SELECT 1 FROM couple_links WHERE code = ?').get(code));
  db.prepare('INSERT INTO couple_links (user_a, name_a, code, created_at) VALUES (?,?,?,?)')
    .run(userId, String(name || '').slice(0, 40), code, new Date().toISOString());
  return coupleRowFor(userId);
}
function joinCoupleLink(userId, code, name) {
  if (coupleRowFor(userId)) return { error: 'already-linked' };
  const row = db.prepare('SELECT * FROM couple_links WHERE code = ?').get(String(code || '').trim().toUpperCase());
  if (!row) return { error: 'bad-code' };
  if (row.user_b) return { error: 'code-used' };
  if (row.user_a === userId) return { error: 'own-code' };
  db.prepare('UPDATE couple_links SET user_b = ?, name_b = ? WHERE id = ?')
    .run(userId, String(name || '').slice(0, 40), row.id);
  return { row: coupleRowFor(userId) };
}
function unlinkCouple(userId) {
  const row = coupleRowFor(userId);
  if (row) db.prepare('DELETE FROM couple_links WHERE id = ?').run(row.id);
  return !!row;
}
function setCoupleTogetherDone(userId, day) {
  const row = coupleRowFor(userId);
  if (!row) return null;
  const d = Math.max(row.together_done, Math.min(Math.max(0, day | 0), 90));
  db.prepare('UPDATE couple_links SET together_done = ? WHERE id = ?').run(d, row.id);
  return d;
}
function setCoupleNudge(userId) {
  const row = coupleRowFor(userId);
  if (!row || !row.user_b) return null;
  db.prepare('UPDATE couple_links SET nudge_from = ?, nudge_at = ? WHERE id = ?')
    .run(userId, new Date().toISOString(), row.id);
  return coupleRowFor(userId);
}
function couplePartnerOf(userId) {
  const row = coupleRowFor(userId);
  if (!row || !row.user_b) return null;
  return row.user_a === userId
    ? { id: row.user_b, name: row.name_b }
    : { id: row.user_a, name: row.name_a };
}

module.exports = {
  upsertReview,
  getMyReview,
  getPublishedReviews,
  getReviewQueue,
  setReviewStatus,
  createUser,
  setUserUtm,
  getAdminStats,
  countLifetimeSold,
  recordStorePurchase,
  getUserByPurchaseToken,
  getUserByEmail,
  getUserById,
  getState,
  saveState,
  getSetting,
  setSetting,
  savePushSubscription,
  deletePushSubscription,
  getPushSubscriptions,
  getAllPushSubscriptions,
  markPushSent,
  bumpPushFailure,
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
  getUsersWithState,
  getUserByStripeCustomerId,
  setStripeCustomerId,
  updateSubscriptionFromStripe,
  logError,
  createRoomPost, setRoomPostVerdict, getRoomFeed, getRoomPost, countRoomPostsToday,
  addRoomReport, hideRoomPost, getModQueue, setRoomPostStatus, banRoomUser, isRoomBanned,
  getRecentErrors,
  clearErrors,
  coupleRowFor,
  createCoupleLink,
  joinCoupleLink,
  unlinkCouple,
  setCoupleTogetherDone,
  setCoupleNudge,
  couplePartnerOf,
};
