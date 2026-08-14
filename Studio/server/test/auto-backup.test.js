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
