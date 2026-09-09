// ─── DATABASE BACKUPS ────────────────────────────────────────────────────────
// Written 29 Aug 2026. Until today this app had none. Every account, password
// hash, Stripe link, couple link and saved state lives in one SQLite file on one
// volume, and if that volume had been wiped there was no way back - not for a
// mistake, and not for a hosting failure. /api/account/export is one person's
// own data on request; it is not a backup and was never meant to be.
//
// Two layers, because they protect against different things:
//
//   1. ON-VOLUME SNAPSHOTS. A daily consistent copy kept beside the database,
//      last SNAPSHOT_KEEP retained. These cover the likely disaster - a bad
//      migration, a wrong DELETE, a deploy that corrupted something. They do
//      NOT survive the volume itself dying, and pretending otherwise would be
//      the exact false comfort this file exists to remove.
//
//   2. AN OFF-SERVER COPY. The snapshot is emailed to the owner, so a copy
//      lands somewhere the hosting provider does not control. That is the layer
//      that survives losing the machine. Email attachments have limits, so it
//      is skipped (loudly, into the error log) above EMAIL_MAX_BYTES rather
//      than failing silently - a backup you think you have is worse than none.
//
// Snapshots use VACUUM INTO, which takes a consistent copy of a live database
// without stopping the app. Copying the file with fs.copyFile would risk a
// torn read mid-write, and a torn backup restores as a corrupt database.
const fs = require('fs');
const path = require('path');
const db = require('./db');

const SNAPSHOT_KEEP = 7;
// Resend accepts up to 40MB per message and base64 inflates by about a third,
// so 15MB of database is the honest ceiling for the emailed copy.
const EMAIL_MAX_BYTES = 15 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

function dbPath() {
  return process.env.DB_PATH || path.join(__dirname, 'data.sqlite');
}
function backupDir() {
  return path.join(path.dirname(dbPath()), 'backups');
}
function stamp(d) {
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// Newest first, so [0] is always the freshest snapshot.
function listSnapshots() {
  const dir = backupDir();
  let names = [];
  try { names = fs.readdirSync(dir); } catch (_) { return []; }
  return names
    .filter((n) => n.startsWith('tsid-') && n.endsWith('.sqlite'))
    .map((n) => {
      const full = path.join(dir, n);
      let size = 0, mtime = 0;
      try { const st = fs.statSync(full); size = st.size; mtime = st.mtimeMs; } catch (_) {}
      return { name: n, path: full, bytes: size, at: new Date(mtime).toISOString() };
    })
    // Sorted by the timestamp in the NAME, not the file's mtime. A volume
    // migration, a restore or a plain copy all reset mtimes, and a prune that
    // trusted them would happily delete the newest snapshots and keep the
    // stale ones - which a test caught it doing on 29 Aug.
    .sort((a, b) => b.name.localeCompare(a.name));
}

function pruneSnapshots() {
  const extra = listSnapshots().slice(SNAPSHOT_KEEP);
  for (const s of extra) {
    try { fs.unlinkSync(s.path); } catch (_) {}
  }
  return extra.length;
}

function createSnapshot() {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  // VACUUM INTO refuses to write over an existing file, so two snapshots in the
  // same second (the boot one landing on a manual one, or a double tap of
  // "Back up now") would throw instead of backing up. Take the next free name.
  const base = `tsid-${stamp(new Date())}`;
  let out = path.join(dir, `${base}.sqlite`);
  for (let n = 2; fs.existsSync(out) && n < 100; n++) {
    out = path.join(dir, `${base}-${n}.sqlite`);
  }
  db.snapshotTo(out);
  const bytes = fs.statSync(out).size;
  if (!bytes) {
    try { fs.unlinkSync(out); } catch (_) {}
    throw new Error('snapshot came out empty');
  }
  pruneSnapshots();
  return { path: out, name: path.basename(out), bytes };
}

// The off-server layer. Returns why it did not send rather than throwing, so a
// failed email never costs us the snapshot that was just taken successfully.
async function emailSnapshot(emailer, snap, ownerEmail) {
  if (!ownerEmail) return { ok: false, skipped: 'no-owner-email' };
  if (snap.bytes > EMAIL_MAX_BYTES) return { ok: false, skipped: 'too-large' };
  const content = fs.readFileSync(snap.path).toString('base64');
  const mb = (snap.bytes / 1048576).toFixed(2);
  return emailer.sendEmail({
    to: ownerEmail,
    force: true, // an unsubscribe must never switch the backups off
    subject: `Day One backup — ${snap.name} (${mb} MB)`,
    text: `Attached is a full copy of the app database, taken automatically.

Keep it. If the server is ever lost, this file is the accounts, the
subscriptions and everybody's progress.

Snapshot: ${snap.name}
Size: ${mb} MB
Taken: ${new Date().toISOString()}

You do not need to do anything with it. Just do not delete the email.`,
    attachments: [{ filename: snap.name, content }],
  });
}

async function runBackup(emailer, ownerEmail) {
  const snap = createSnapshot();
  let mail = { ok: false, skipped: 'no-emailer' };
  if (emailer) {
    try { mail = await emailSnapshot(emailer, snap, ownerEmail); } catch (err) {
      mail = { ok: false, error: err.message };
    }
  }
  return { snapshot: snap, mail };
}

// Daily, plus one a minute after boot so a fresh deploy is covered immediately
// rather than up to a day later.
function startBackupScheduler(emailer, ownerEmail, logError) {
  const once = async () => {
    try {
      const r = await runBackup(emailer, ownerEmail);
      if (!r.mail.ok) {
        const why = r.mail.skipped || r.mail.error || `status ${r.mail.status}`;
        try { logError('backup', `snapshot saved but not emailed off-server: ${why}`, r.snapshot.name); } catch (_) {}
      }
    } catch (err) {
      try { logError('backup', `backup FAILED: ${err.message}`, err.stack); } catch (_) {}
    }
  };
  setTimeout(once, 60 * 1000);
  setInterval(once, DAY_MS);
}

// ── Putting one back ─────────────────────────────────────────────────────────
// A backup nobody can restore is a comfort, not a safeguard. This half was
// missing until 9 Sep 2026, the day the host was deleted and the only surviving
// copies were the ones that had been emailed out. Everything below exists
// because a restore replaces every account in the app in a single move.
const SQLITE_MAGIC = Buffer.from('SQLite format 3\u0000', 'binary');

function restoreFromBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 512) {
    throw new Error('That file is empty or cut short.');
  }
  if (!buf.subarray(0, 16).equals(SQLITE_MAGIC)) {
    throw new Error('That is not a database file.');
  }
  const dest = dbPath();
  const dir = path.dirname(dest);
  fs.mkdirSync(dir, { recursive: true });

  // Prove the file before trusting it. It is written to a temp path in the same
  // directory, opened, and has to carry this app's own tables. A database from
  // somewhere else, or one that only half downloaded, stops here - and the live
  // database has not been touched at that point.
  const tmp = path.join(dir, `restore-${Date.now()}.sqlite.tmp`);
  fs.writeFileSync(tmp, buf);
  let users = 0;
  try {
    const { DatabaseSync } = require('node:sqlite');
    const probe = new DatabaseSync(tmp);
    try {
      const t = probe
        .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('users','user_state')")
        .get();
      if (!t || t.n < 2) {
        throw new Error('That database does not have this app\u2019s tables in it.');
      }
      users = probe.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    } finally {
      probe.close();
    }
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw err;
  }

  // Keep whatever is being replaced. If the wrong file is ever restored, the one
  // it overwrote is still sitting in the backups folder beside it.
  let replaced = null;
  if (fs.existsSync(dest)) {
    try {
      fs.mkdirSync(backupDir(), { recursive: true });
      const keep = path.join(backupDir(), `before-restore-${stamp(new Date())}.sqlite`);
      fs.copyFileSync(dest, keep);
      replaced = path.basename(keep);
    } catch (_) { replaced = null; }
  }
  // Rename inside one directory is atomic: the database is either the old file
  // or the new one, never a half-written mixture of the two.
  fs.renameSync(tmp, dest);
  // The -wal and -shm files belong to the database that just went. Left beside a
  // different file they are how a restore comes back corrupt.
  for (const suffix of ['-wal', '-shm']) {
    try { fs.unlinkSync(dest + suffix); } catch (_) {}
  }
  return { users, replaced, bytes: buf.length };
}

module.exports = {
  listSnapshots,
  restoreFromBuffer,
  emailSnapshot,
  createSnapshot,
  runBackup,
  startBackupScheduler,
  backupDir,
  SNAPSHOT_KEEP,
  EMAIL_MAX_BYTES,
};
