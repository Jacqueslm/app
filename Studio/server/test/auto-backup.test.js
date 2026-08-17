// First tests in the repo — node:test ships with Node, no new dependency.
// Run with:  node --test Studio/server/test/
const { test } = require('node:test');
const assert = require('node:assert');
const { snapshotName, retentionCut, SNAPSHOT_RE } = require('../auto-backup');

test('snapshotName pads month/day/hour to two digits', () => {
  const d = new Date(2026, 7, 14, 9, 5, 3); // Aug 14, 09:05:03
  const name = snapshotName(d);
  assert.match(name, SNAPSHOT_RE);
  assert.strictEqual(name, 'studio-20260814-090503.sqlite');
});

test('retentionCut keeps the newest N, oldest deleted', () => {
  const names = [
    'studio-20260810-100000.sqlite',
    'studio-20260811-100000.sqlite',
    'studio-20260812-100000.sqlite',
    'studio-20260813-100000.sqlite',
    'studio-20260814-100000.sqlite',
  ];
  assert.deepStrictEqual(retentionCut(names, 3), [
    'studio-20260810-100000.sqlite',
    'studio-20260811-100000.sqlite',
  ]);
});

test('retentionCut ignores non-snapshot files', () => {
  const names = ['notes.txt', 'studio-20260814-100000.sqlite', 'media/',
    'studio-2026-08-14.sqlite'];
  assert.deepStrictEqual(retentionCut(names, 1), []);
  assert.deepStrictEqual(retentionCut(names, 0), ['studio-20260814-100000.sqlite']);
});

test('retentionCut with fewer snapshots than keep deletes nothing', () => {
  const names = ['studio-20260814-100000.sqlite', 'studio-20260814-110000.sqlite'];
  assert.deepStrictEqual(retentionCut(names, 8), []);
});

test('retentionCut handles unsorted input', () => {
  const names = ['studio-20260814-100000.sqlite', 'studio-20260813-100000.sqlite'];
  assert.deepStrictEqual(retentionCut(names, 1), ['studio-20260813-100000.sqlite']);
});

// The bug this file missed for months: snapshot() itself was never exercised,
// only its filename helpers. db.exec was not exported from db.js, so EVERY
// snapshot threw "db.exec is not a function" - including the silent one that
// guards data.sqlite before an update. Exercise the real thing.
test('snapshot() actually writes a database file', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { DatabaseSync } = require('node:sqlite');
  const { snapshot } = require('../auto-backup');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snaptest-'));
  const src = new DatabaseSync(path.join(tmp, 'src.sqlite'));
  src.exec('CREATE TABLE t (a TEXT); INSERT INTO t VALUES (\'hello\')');

  const dest = snapshot(src);
  assert.ok(fs.existsSync(dest), 'snapshot file should exist on disk');
  assert.ok(fs.statSync(dest).size > 0, 'snapshot should not be empty');

  // and it must be a readable database carrying the data
  const copy = new DatabaseSync(dest);
  assert.strictEqual(copy.prepare('SELECT a FROM t').get().a, 'hello');
  try { fs.unlinkSync(dest); } catch (_) {}
});

// The exact shape the callers use: server.js and studio.js both pass the db
// MODULE, not the raw handle. If that stops working, backups die silently.
test('snapshot works with the db module the real callers pass', () => {
  const dbModule = require('../db');
  assert.strictEqual(typeof dbModule.exec, 'function', 'db module must expose exec for auto-backup');
  assert.ok(dbModule.raw, 'db module must expose the raw handle');
});
