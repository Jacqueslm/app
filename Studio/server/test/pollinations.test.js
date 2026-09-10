// The keyless free (Pollinations) image tier: one POST returns the whole image,
// then the house watermark is baked in the same way as the Google free tier.
// Runs with a stubbed fetch and a real local ffmpeg (ffmpeg-static) — no
// network, no key. Run with:  node --test Studio/server/test/
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const MEDIA = path.join(__dirname, '..', 'media');
fs.mkdirSync(MEDIA, { recursive: true });

// A real 1280x720 PNG made by the bundled ffmpeg, so the watermark overlay has
// a sane canvas (a 1x1 test pixel would clip the mark to nothing).
const TMP_SRC = path.join(os.tmpdir(), `poli-src-${Date.now()}.png`);
execFileSync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=darkgreen:s=1280x720', '-frames:v', '1', TMP_SRC]);
const BIG_PNG_B64 = fs.readFileSync(TMP_SRC).toString('base64');

let mode = 'ok';
global.fetch = async (url, opts) => {
  const u = String(url);
  if (!u.endsWith('/prompt')) throw new Error('unexpected fetch URL: ' + u);
  assert.strictEqual(opts.method, 'POST');
  const body = JSON.parse(opts.body || '{}');
  assert.ok(body.prompt, 'prompt sent');
  assert.strictEqual(body.nologo, true, 'nologo always set so only our watermark shows');
  if (mode === 'ok') {
    return {
      ok: true, status: 200,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => Buffer.from(BIG_PNG_B64, 'base64'),
      text: async () => '',
    };
  }
  if (mode === 'busy') {
    return { ok: false, status: 429, headers: { get: () => 'text/plain' }, arrayBuffer: async () => Buffer.alloc(0), text: async () => 'too many requests' };
  }
  // mode === 'http'
  return { ok: false, status: 500, headers: { get: () => 'text/plain' }, arrayBuffer: async () => Buffer.alloc(0), text: async () => 'internal boom' };
};

// The library ties every asset to a real user (FK constraint), so the fake
// jobs need a real row to hang off — create one and clean nothing up (a test
// user is never logged in and harmless).
const db = require('../db');
const testUserId = db.createUser(`test-poli-${Date.now()}@local.test`, 'x');

const { refreshPollinationsJob } = require('../studio.js');

function fakeJob() {
  return {
    id: 'job-poli', userId: testUserId, type: 'ai-image', status: 'running', progress: 0,
    error: null, assetId: null, startedAt: Date.now(), _refreshing: false,
    poli: {
      prompt: 'a moody warehouse scene, one continuous frame',
      width: 1280, height: 720, imageSize: 'landscape_16_9', seed: 42,
      label: 'a moody warehouse scene',
      meta: { source: 'pollinations-free', model: 'flux', quality: 'free', watermark: true },
    },
  };
}

function mediaFilesBefore() {
  try { return new Set(fs.readdirSync(MEDIA)); } catch (_) { return new Set(); }
}
function newMediaFiles(before) {
  try { return fs.readdirSync(MEDIA).filter((f) => !before.has(f)); } catch (_) { return []; }
}

test('pollinations free: happy path lands a watermarked PNG in the library', async () => {
  mode = 'ok';
  const before = mediaFilesBefore();
  const job = fakeJob();
  await refreshPollinationsJob(job);
  assert.strictEqual(job.status, 'done', `job error: ${job.error}`);
  assert.ok(job.assetId, 'asset created');
  const files = newMediaFiles(before);
  assert.strictEqual(files.length, 1, `expected exactly one new file, got ${files}`);
  const name = files[0];
  assert.ok(name.endsWith('-wm.png'), `watermarked name: ${name}`);
  const buf = fs.readFileSync(path.join(MEDIA, name));
  assert.strictEqual(buf[0], 0x89, 'PNG signature');
  assert.ok(buf.length > 5000, 'real image bytes saved');
});

test('pollinations free: busy (429) gets a plain-language error and no asset', async () => {
  mode = 'busy';
  const before = mediaFilesBefore();
  const job = fakeJob();
  await refreshPollinationsJob(job);
  assert.strictEqual(job.status, 'error');
  assert.match(job.error, /Pollinations is busy/);
  assert.strictEqual(job.assetId, null);
  assert.deepStrictEqual(newMediaFiles(before), []);
});

test('pollinations free: server error is surfaced, nothing saved', async () => {
  mode = 'http';
  const before = mediaFilesBefore();
  const job = fakeJob();
  await refreshPollinationsJob(job);
  assert.strictEqual(job.status, 'error');
  assert.match(job.error, /Free image failed/);
  assert.deepStrictEqual(newMediaFiles(before), []);
});

test('cleanup', () => {
  try { fs.unlinkSync(TMP_SRC); } catch (_) {}
});