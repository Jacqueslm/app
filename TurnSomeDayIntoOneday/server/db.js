const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

// Where the database lives: DB_PATH if somebody set it, otherwise the volume a
// hosting platform reports it mounted (see volume.js), otherwise beside the code
// as on a home install.
const { VOLUME_DIR } = require('./volume');
const DB_PATH = process.env.DB_PATH
  || (VOLUME_DIR ? path.join(VOLUME_DIR, 'data.sqlite') : path.join(__dirname, 'data.sqlite'));

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
  -- Small key/value store. Holds the VAPID keypair so push works with no
  -- manual environment setup: generated once on first boot, reused forever.
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  -- The letter IS the invite. Someone writes the hardest thing they have to say,
  -- and the link that carries it is the same link that makes the other person an
  -- account. Nothing about the recipient is known until they choose to be known:
  -- the row holds the letter and a token, never an address or a phone number.
  -- Tokens expire so a link forwarded on months later cannot open a private
  -- letter to somebody it was never written for.
  CREATE TABLE IF NOT EXISTS letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    sender_type TEXT NOT NULL,
    sender_name TEXT NOT NULL DEFAULT '',
    recipient_name TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    opened_at TEXT,
    open_count INTEGER NOT NULL DEFAULT 0,
    accepted_at TEXT,
    accepted_user_id INTEGER REFERENCES users(id)
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
function setReminderWindow(userId, startHour, endHour) {
  db.prepare('UPDATE users SET reminder_start_hour = ?, reminder_end_hour = ? WHERE id = ?')
    .run(startHour, endHour, userId);
}
function getReminderWindow(userId) {
  const r = db.prepare('SELECT reminder_start_hour AS s, reminder_end_hour AS e FROM users WHERE id = ?').get(userId);
  return r && Number.isInteger(r.s) && Number.isInteger(r.e) ? { start: r.s, end: r.e } : null;
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
// ─── THE BILLING COLUMNS WENT, 5 OCT 2026 ────────────────────────────────────
// This list used to carry the whole of a subscription: the two Stripe ids, the
// plan and its status, the period end, the cancel-at-period-end flag, where a
// purchase came from and the receipt that proved it - plus the three UTM
// columns that recorded which advert brought somebody in. Two hosts and two
// stores were supported; none of it is. There is one account, nobody is charged
// for anything, and nothing is advertised. What is left below is the account
// itself.
addColumnIfMissing('phone', 'phone TEXT');
// Bumping this number invalidates every session token issued before the bump -
// that's how "log out on all devices" works without tracking sessions server-side.
addColumnIfMissing('session_version', 'session_version INTEGER NOT NULL DEFAULT 1');
// The reminder window is a real setting, not derived data - kept in its own
// columns written only by an explicit change, so a second device syncing a
// stale state blob can never quietly reset it (Jacques hit exactly that).
addColumnIfMissing('reminder_start_hour', 'reminder_start_hour INTEGER');
addColumnIfMissing('reminder_end_hour', 'reminder_end_hour INTEGER');
// The win-back email told an active member she had not been in for a couple of
// weeks (28 Aug 2026). It measured "quiet" from the activity log alone, and the
// activity log only records 33 specific actions - somebody who opens the app and
// reads is invisible to it. This column records the last time an authenticated
// request arrived at all, which is what "been in" actually means.
addColumnIfMissing('last_seen_at', 'last_seen_at TEXT');

// Written from requireAuth on every authenticated request, so it is throttled to
// one write an hour per person: the precision that matters here is days.
const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000;
function touchLastSeen(userId) {
  const row = db.prepare('SELECT last_seen_at FROM users WHERE id = ?').get(userId);
  if (!row) return;
  const prev = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  if (Date.now() - prev < LAST_SEEN_THROTTLE_MS) return;
  db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), userId);
}

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

// A consistent copy of the live database, for backup.js. VACUUM INTO rather
// than a file copy: copying bytes out from under an open database can catch it
// mid-write, and a torn backup restores as a corrupt one. The path is built by
// the caller from an env var, never from a request; quotes escaped regardless.
function snapshotTo(outPath) {
  db.exec(`VACUUM INTO '${String(outPath).split("'").join("''")}'`);
}

function deleteUser(userId) {
  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM email_log WHERE user_id = ?').run(userId);
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

function bumpSessionVersion(userId) {
  db.prepare('UPDATE users SET session_version = session_version + 1 WHERE id = ?').run(userId);
  const row = db.prepare('SELECT session_version FROM users WHERE id = ?').get(userId);
  return row ? row.session_version : 1;
}

function updatePassword(userId, passwordHash) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

// Accounts whose synced state exists and who have an email we can write to.
// The win-back runner reads each one's state to decide if they've gone quiet;
// doing the filtering in JS keeps the JSON blob out of SQL, which is where it
// belongs given state_json has no schema guarantees.
function getUsersWithState() {
  return db.prepare(`
    SELECT u.id, u.email, u.last_seen_at, s.state_json, s.updated_at AS state_updated_at
    FROM users u JOIN user_state s ON s.user_id = u.id
    WHERE u.email IS NOT NULL AND u.email != ''
  `).all();
}

// ─── OWNER STATS ──────────────────────────────────────────────────────────────
// ─── THE SELLING NUMBERS WENT, 5 OCT 2026 ────────────────────────────────────
// This block used to count trials, paid accounts, conversion percentages, leads
// per page and per campaign, and revenue per week - the dashboard of a business
// being run. There is no business here: one account, no store, no list of
// addresses, nothing for sale. What is left below answers the two questions
// that are about the app and not about money - is it being used, and does
// somebody come back.
//
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
  };

  // ── Retention ──────────────────────────────────────
  // The signup-to-trial-to-paid funnel that used to be computed here went with
  // the billing columns - there is no trial and no paid step left to measure.
  // What survives is the half of it that was never about money.

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

  // The per-campaign breakdown that used to sit here (signups, trials and paid
  // accounts grouped by utm_source, with the leads table merged in) went with
  // the UTM columns and the leads table. Nothing tags a visit any more.

  // Signups, one row per week they arrived in.
  const signupsByWeek = db.prepare(`SELECT ${WEEK_SQL} AS week, COUNT(*) n FROM users GROUP BY 1`).all();
  const weekMap = new Map();
  const weekBucket = (w) => {
    if (!weekMap.has(w)) weekMap.set(w, { week: w, signups: 0 });
    return weekMap.get(w);
  };
  signupsByWeek.forEach((r) => { weekBucket(r.week).signups = r.n; });
  const by_week = [...weekMap.values()].filter((w) => w.week).sort((a, b) => (a.week < b.week ? 1 : -1));

  // Average over user-days with activity, not calendar days: someone who chats
  // twice a week shouldn't be averaged down to near zero by their quiet days.
  // Every chat is free now, so there is no paid set to exclude - the old query
  // subtracted paying accounts with NOT (plan != 'free' AND status = 'active').
  const freeUsage = db.prepare(`
    SELECT SUM(c.count) AS chats, COUNT(*) AS user_days
    FROM chat_usage c JOIN users u ON u.id = c.user_id
    WHERE c.usage_date >= ?
  `).get(since);
  const capped = db.prepare(`
    SELECT COUNT(DISTINCT c.user_id) AS n
    FROM chat_usage c JOIN users u ON u.id = c.user_id
    WHERE c.usage_date >= ? AND c.count >= ?
  `).get(since, freeChatLimit).n;

  return {
    generated_at: new Date().toISOString(),
    totals,
    retention,
    by_week,
    // The letter funnel. Its own block because it answers a different question
    // from the signup count: not "did somebody find us", but "did somebody
    // hand this to a person they love, and did that person take it".
    letters: getLetterStats(),
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
  // crypto.randomInt, not Math.random: a code is the only thing standing between
  // a stranger and somebody's Together table, and Math.random's generator can be
  // predicted from a handful of observed outputs.
  let code;
  do {
    code = Array.from({ length: 6 }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join('');
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

// ─── Letters as invitations ──────────────────────────────────────────────────
// The old flow asked somebody to invite their partner to an app, which is a
// request to install software. This one asks them to send a letter they already
// wrote, and the account is what happens after the letter is read. The letter
// does the persuading; nothing else has to.
const LETTER_TTL_DAYS = 30;

// Opposite side, always. A person in recovery sends to somebody supporting them;
// a supporter sends to the person they are carrying this with. The "both" path
// carries both, and the safe default for a stranger opening that link is the
// supporter side - it asks less of them.
const LETTER_OPPOSITE = { recovering: 'partner', partner: 'recovering', both: 'partner' };

function createLetter(userId, token, senderType, senderName, recipientName, body) {
  const now = new Date();
  const expires = new Date(now.getTime() + LETTER_TTL_DAYS * 86400000);
  // One live letter per person per side. Re-sending replaces the old link
  // rather than leaving a trail of readable copies behind.
  db.prepare('UPDATE letters SET revoked = 1 WHERE user_id = ? AND sender_type = ? AND revoked = 0 AND accepted_at IS NULL')
    .run(userId, senderType);
  db.prepare(`INSERT INTO letters
      (token, user_id, sender_type, sender_name, recipient_name, body, created_at, expires_at)
      VALUES (?,?,?,?,?,?,?,?)`)
    .run(token, userId, senderType,
      String(senderName || '').slice(0, 40),
      String(recipientName || '').slice(0, 40),
      String(body || '').slice(0, 20000),
      now.toISOString(), expires.toISOString());
  return db.prepare('SELECT * FROM letters WHERE token = ?').get(token);
}

// Returns null for anything the recipient should not see: unknown, revoked, or
// past its date. The caller cannot tell those three apart, on purpose.
function getLetterByToken(token) {
  const row = db.prepare('SELECT * FROM letters WHERE token = ?').get(String(token || ''));
  if (!row || row.revoked) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

// First open is the one that means something - that is the moment the letter
// was actually read by somebody. Later opens still count, separately.
function markLetterOpened(token) {
  const row = getLetterByToken(token);
  if (!row) return null;
  const now = new Date().toISOString();
  db.prepare('UPDATE letters SET open_count = open_count + 1, opened_at = COALESCE(opened_at, ?) WHERE id = ?')
    .run(now, row.id);
  return { first: !row.opened_at };
}

function markLetterAccepted(token, newUserId) {
  const row = getLetterByToken(token);
  if (!row || row.accepted_at) return null;
  db.prepare('UPDATE letters SET accepted_at = ?, accepted_user_id = ? WHERE id = ?')
    .run(new Date().toISOString(), newUserId, row.id);
  return row;
}

function revokeLetters(userId) {
  return db.prepare('UPDATE letters SET revoked = 1 WHERE user_id = ? AND accepted_at IS NULL').run(userId).changes;
}

function getMyLetter(userId, senderType) {
  return db.prepare('SELECT * FROM letters WHERE user_id = ? AND sender_type = ? AND revoked = 0 ORDER BY id DESC')
    .get(userId, senderType) || null;
}

// The whole funnel in one row: sent, opened, joined. Kept separate from
// getAdminStats' own queries so the letters block can be read on its own.
function getLetterStats() {
  const t = db.prepare(`SELECT
      COUNT(*) AS letter_sent,
      SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) AS letter_opened,
      SUM(CASE WHEN accepted_at IS NOT NULL THEN 1 ELSE 0 END) AS account_created_from_letter
    FROM letters`).get();
  const by_side = db.prepare(`SELECT sender_type AS side,
      COUNT(*) AS letter_sent,
      SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) AS letter_opened,
      SUM(CASE WHEN accepted_at IS NOT NULL THEN 1 ELSE 0 END) AS account_created_from_letter
    FROM letters GROUP BY 1 ORDER BY letter_sent DESC`).all();
  const by_week = db.prepare(`SELECT date(created_at, 'weekday 0', '-6 days') AS week,
      COUNT(*) AS letter_sent,
      SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) AS letter_opened,
      SUM(CASE WHEN accepted_at IS NOT NULL THEN 1 ELSE 0 END) AS account_created_from_letter
    FROM letters GROUP BY 1 ORDER BY week DESC LIMIT 12`).all();
  return {
    letter_sent: t.letter_sent || 0,
    letter_opened: t.letter_opened || 0,
    account_created_from_letter: t.account_created_from_letter || 0,
    by_side,
    by_week,
  };
}

module.exports = {
  setReminderWindow,
  getReminderWindow,
  createLetter,
  getLetterByToken,
  markLetterOpened,
  markLetterAccepted,
  revokeLetters,
  getMyLetter,
  getLetterStats,
  LETTER_OPPOSITE,
  LETTER_TTL_DAYS,
  createUser,
  getAdminStats,
  getUserByEmail,
  getUserById,
  getState,
  saveState,
  touchLastSeen,
  snapshotTo,
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
  bumpSessionVersion,
  updatePassword,
  createPasswordReset,
  consumePasswordReset,
  hasEmailBeenSent,
  logEmailSent,
  getUsersWithState,
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
