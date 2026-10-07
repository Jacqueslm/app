// Until 29 Aug 2026 this app had no database backup at all. These tests exist
// because a backup nobody has restored is only a belief. Two real bugs were
// caught here before shipping: the prune deleted the NEWEST snapshots (it
// sorted on mtime, which a restore or volume move resets), and two snapshots
// in the same second threw instead of backing up.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DIR = '/tmp/tsid-backup-test';
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
process.env.DB_PATH = path.join(DIR, 'live.sqlite');
process.env.EMAIL_DRY_RUN = '1';

const db = require('../db.js');
const backup = require('../backup.js');

test('a snapshot restores to a working database with the data still in it', () => {
  const id = db.createUser('restore@test.com', 'hash');
  db.saveState(id, JSON.stringify({ startDate: '2026-01-01', note: 'must survive' }));

  const snap = backup.createSnapshot();
  assert.ok(snap.bytes > 0, 'snapshot must not be empty');

  // The real test: throw the live database away and open the snapshot instead.
  const restored = path.join(DIR, 'restored.sqlite');
  fs.copyFileSync(snap.path, restored);
  const { DatabaseSync } = require('node:sqlite');
  const r = new DatabaseSync(restored);
  const user = r.prepare('SELECT * FROM users WHERE email = ?').get('restore@test.com');
  assert.equal(user.email, 'restore@test.com', 'the account came back');
  const state = r.prepare('SELECT state_json FROM user_state WHERE user_id = ?').get(user.id);
  assert.match(state.state_json, /must survive/, 'their data came back');
  r.close();
});

test('two snapshots in the same second both succeed', () => {
  const before = backup.listSnapshots().length;
  backup.createSnapshot();
  backup.createSnapshot();
  assert.equal(backup.listSnapshots().length, before + 2, 'neither collided');
});

test('pruning keeps the NEWEST snapshots, not the oldest', () => {
  // Written all at once, so every mtime is identical - which is exactly the
  // situation that made the first version delete the wrong ones.
  for (let i = 1; i <= 12; i++) {
    const d = String(i).padStart(2, '0');
    fs.writeFileSync(path.join(backup.backupDir(), `tsid-2026-01-${d}T00-00-00.sqlite`), 'x');
  }
  backup.createSnapshot();
  const kept = backup.listSnapshots();
  assert.equal(kept.length, backup.SNAPSHOT_KEEP, 'pruned down to the keep limit');
  // Every January stand-in is older than today's real snapshots, so the newest
  // kept entry must never be one of the January files.
  assert.ok(kept[0].name > 'tsid-2026-01-12', 'newest kept is genuinely the newest');
  const sorted = [...kept].sort((a, b) => b.name.localeCompare(a.name));
  assert.deepEqual(kept.map((s) => s.name), sorted.map((s) => s.name), 'listed newest first');
});

test('an oversized database is refused for email, loudly, not silently', async () => {
  const sent = [];
  const fakeEmailer = { sendEmail: async (m) => { sent.push(m); return { ok: true }; } };
  const real = backup.listSnapshots()[0];

  const tooBig = { name: real.name, path: real.path, bytes: backup.EMAIL_MAX_BYTES + 1 };
  const refused = await backup.emailSnapshot(fakeEmailer, tooBig, 'owner@test.com');
  assert.equal(refused.ok, false);
  assert.equal(refused.skipped, 'too-large', 'says why, so it lands in the error log');
  assert.equal(sent.length, 0, 'nothing was sent');

  const fine = { name: real.name, path: real.path, bytes: real.bytes };
  const okRes = await backup.emailSnapshot(fakeEmailer, fine, 'owner@test.com');
  assert.equal(okRes.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].attachments.length, 1, 'the database is actually attached');
  assert.equal(sent[0].force, true, 'an unsubscribe must never switch backups off');
});

test('no owner email means the off-server copy is reported missing, not assumed', async () => {
  const real = backup.listSnapshots()[0];
  const res = await backup.emailSnapshot({ sendEmail: async () => ({ ok: true }) }, real, '');
  assert.equal(res.ok, false);
  assert.equal(res.skipped, 'no-owner-email');
});
