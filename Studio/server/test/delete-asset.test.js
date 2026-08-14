// Reproduces the bug behind "Something went wrong on the server" when deleting
// a clip that was sitting in the Post queue.
//
// This builds the same shape of tables in memory rather than importing db.js,
// because db.js opens the real database on load. What is being pinned here is
// the behaviour that caused it: node:sqlite enforces foreign keys by default,
// so a plain DELETE on a referenced row throws.
const { test } = require('node:test');
const assert = require('node:assert');
const { DatabaseSync } = require('node:sqlite');

function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE studio_assets (id INTEGER PRIMARY KEY, user_id INTEGER, label TEXT);
    CREATE TABLE social_posts (
      id INTEGER PRIMARY KEY, user_id INTEGER,
      asset_id INTEGER REFERENCES studio_assets(id),
      status TEXT NOT NULL DEFAULT 'pending');
    INSERT INTO studio_assets (id, user_id, label) VALUES (1, 7, 'webcam-recording');
  `);
  return db;
}

// The same three statements deleteAsset now runs, in the same order.
function deleteAsset(db, userId, id) {
  db.exec('BEGIN');
  try {
    const pending = db.prepare("SELECT COUNT(*) AS c FROM social_posts WHERE user_id = ? AND asset_id = ? AND status != 'posted'").get(userId, id).c;
    db.prepare("DELETE FROM social_posts WHERE user_id = ? AND asset_id = ? AND status != 'posted'").run(userId, id);
    db.prepare('UPDATE social_posts SET asset_id = NULL WHERE user_id = ? AND asset_id = ?').run(userId, id);
    db.prepare('DELETE FROM studio_assets WHERE user_id = ? AND id = ?').run(userId, id);
    db.exec('COMMIT');
    return { queuedPostsRemoved: pending };
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw err;
  }
}

test('node:sqlite really does enforce foreign keys by default', () => {
  // If this ever stops being true the fix is still correct, but the reason
  // written in db.js would be wrong — so pin it.
  const db = freshDb();
  assert.strictEqual(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
});

test('the old one-line delete threw when the clip was queued — this is the bug', () => {
  const db = freshDb();
  db.prepare("INSERT INTO social_posts (user_id, asset_id, status) VALUES (7, 1, 'pending')").run();
  assert.throws(
    () => db.prepare('DELETE FROM studio_assets WHERE user_id = ? AND id = ?').run(7, 1),
    /FOREIGN KEY/i,
  );
});

test('deleting a queued clip now works, and takes the queued post with it', () => {
  const db = freshDb();
  db.prepare("INSERT INTO social_posts (user_id, asset_id, status) VALUES (7, 1, 'pending')").run();
  const out = deleteAsset(db, 7, 1);
  assert.strictEqual(out.queuedPostsRemoved, 1);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS c FROM studio_assets').get().c, 0);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS c FROM social_posts').get().c, 0);
});

test('a post already sent keeps its row and just forgets the asset', () => {
  const db = freshDb();
  db.prepare("INSERT INTO social_posts (id, user_id, asset_id, status) VALUES (9, 7, 1, 'posted')").run();
  const out = deleteAsset(db, 7, 1);
  assert.strictEqual(out.queuedPostsRemoved, 0);
  const row = db.prepare('SELECT asset_id, status FROM social_posts WHERE id = 9').get();
  assert.strictEqual(row.status, 'posted', 'history must survive');
  assert.strictEqual(row.asset_id, null, 'but it should no longer point at a deleted row');
});

test('deleting a clip nothing references still just works', () => {
  const db = freshDb();
  const out = deleteAsset(db, 7, 1);
  assert.strictEqual(out.queuedPostsRemoved, 0);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS c FROM studio_assets').get().c, 0);
});

test('one user cannot delete another user\'s clip', () => {
  const db = freshDb();
  deleteAsset(db, 99, 1);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS c FROM studio_assets').get().c, 1);
});
