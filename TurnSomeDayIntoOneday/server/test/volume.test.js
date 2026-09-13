// Where the files go — 13 Sep 2026.
//
// Jacques attached a Railway volume and asked what else to do. The risk in the
// answer is quiet and expensive: if the app does not find the volume, everything
// still works, and everything is gone on the next deploy. So this checks both
// halves — that Railway's own mount-path variable is honoured, and that the
// app and Studio end up on the SAME volume rather than one of them beside the
// code.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { volumeDirFrom } = require('../volume');
const SERVER_DIR = path.join(__dirname, '..');

// The rule is read when a module loads, so each case gets its own node.
function runNode(code, env) {
  return execFileSync(process.execPath, ['-e', code], {
    cwd: SERVER_DIR,
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
  });
}

const VOLUME_DIR_IN = "process.stdout.write(require('./volume').VOLUME_DIR)";

// --- the rule ---------------------------------------------------------------

test('a home install has no volume, so files stay beside the code', () => {
  assert.strictEqual(volumeDirFrom({}), '');
  assert.strictEqual(volumeDirFrom(null), '');
  assert.strictEqual(runNode(VOLUME_DIR_IN, {}), '');
});

test('Railway saying where it mounted the volume is enough on its own', () => {
  assert.strictEqual(volumeDirFrom({ RAILWAY_VOLUME_MOUNT_PATH: '/data' }), '/data');
  assert.strictEqual(runNode(VOLUME_DIR_IN, { RAILWAY_VOLUME_MOUNT_PATH: '/data' }), '/data');
});

test('a pasted space or newline is not a different folder', () => {
  assert.strictEqual(volumeDirFrom({ RAILWAY_VOLUME_MOUNT_PATH: ' /data \n' }), '/data');
});

test('DB_PATH still wins, so nothing already configured changes', () => {
  assert.strictEqual(volumeDirFrom({ DB_PATH: '/data/data.sqlite' }), '/data');
  // Both set: the one he typed beats the one Railway reports.
  assert.strictEqual(
    volumeDirFrom({ DB_PATH: '/mine/data.sqlite', RAILWAY_VOLUME_MOUNT_PATH: '/data' }),
    '/mine',
  );
});

// --- the wiring -------------------------------------------------------------
// The rule above is only worth anything if the app and Studio actually ask it.

test('with only a volume attached, the app database lands on it', () => {
  const volume = fs.mkdtempSync(path.join(os.tmpdir(), 'tsido-volume-'));
  runNode("require('./db.js'); process.stdout.write('opened')", {
    RAILWAY_VOLUME_MOUNT_PATH: volume,
  });
  assert.ok(
    fs.existsSync(path.join(volume, 'data.sqlite')),
    'the app database should be created on the volume, not in the container',
  );
});

test('with only a volume attached, Studio keeps its clips on it too', () => {
  const volume = fs.mkdtempSync(path.join(os.tmpdir(), 'tsido-volume-'));
  const dataDir = runNode(
    "process.stdout.write(require('./studio/locations').DATA_DIR)",
    { RAILWAY_VOLUME_MOUNT_PATH: volume },
  );
  assert.strictEqual(dataDir, path.join(volume, 'studio'));
});
