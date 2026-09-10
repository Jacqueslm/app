// The free (Google) image tier: Gemini call, watermark bake, and the error
// paths that actually matter (quota out, silent empty reply, bad key).
// Runs with a stubbed fetch and a real local ffmpeg (ffmpeg-static) — no
// Google key, no network. Run with:  node --test Studio/server/test/
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');

// Must be set before studio.js loads — the module reads it once at require time.
process.env.GEMINI_API_KEY = 'test-key';

const MEDIA = path.join(__dirname, '..', 'media');
fs.mkdirSync(MEDIA, { recursive: true });

// A real 1280x720 PNG made by the bundled ffmpeg, so the watermark overlay has
// a sane canvas (a 1x1 test pixel would clip the mark to nothing and prove
// nothing).
const TMP_SRC = path.join(os.tmpdir(), `free-src-${Date.now()}.png`);
execFileSync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=darkblue:s=1280x720', '-frames:v', '1', TMP_SRC]);
const BIG_PNG_B64 = fs.readFileSync(TMP_SRC).toString('base64');

let mode = 'ok';
global.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/models?')) {
    return mode === 'badkey'
      ? { ok: false, status: 400, json: async () => ({ error: { message: 'API key not valid' } }) }
      : { ok: true, status: 200, json: async () => ({ models: [] }) };
  }
  if (u.includes(':generateContent')) {
    if (mode === 'ok') {
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: BIG_PNG_B64 } }] } }] }) };
    }
    if (mode === 'quota') {
      return { ok: false, status: 429, json: async () => ({ error: { message: 'RATE_LIMIT: quota exceeded' } }) };
    }
    if (mode === 'empty') {
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'no image here' }] }, finishReason: 'MAX_TOKENS' }] }) };
    }
    if (mode === 'http') {
      return { ok: false, status: 500, json: async () => ({ error: { message: 'internal boom' } }) };
    }
  }
  throw new Error('unexpected fetch URL: ' + u);
};

// The library ties every asset to a real user (FK constraint), so the fake
// jobs need a real row to hang off — create one and clean nothing up (a test
// user is never logged in and harmless).
const db = require('../db');
const testUserId = db.createUser(`test-free-${Date.now()}@local.test`, 'x');

const { refreshFreeImageJob, geminiKeyCheck } = require('../studio.js');

function fakeJob() {
  return {
    id: 'job-test', userId: testUserId, type: 'ai-image', status: 'running', progress: 0,
    error: null, assetId: null, startedAt: Date.now(), _refreshing: false,
    free: {
      prompt: 'a moody warehouse scene, one continuous frame',
      aspectRatio: '16:9', imageSize: 'landscape_16_9',
      label: 'a moody warehouse scene',
      characterId: null,
      meta: { source: 'gemini-free', model: 'gemini-2.5-flash-image', quality: 'free', watermark: true },
    },
  };
}

function mediaFilesBefore() {
  try { return new Set(fs.readdirSync(MEDIA)); } catch (_) { return new Set(); }
}
function newMediaFiles(before) {
  try {
    return fs.readdirSync(MEDIA).filter((f) => !before.has(f));
  } catch (_) { return []; }
}

test('free image: happy path lands a watermarked PNG in the library', async () => {
  mode = 'ok';
  const before = mediaFilesBefore();
  const job = fakeJob();
  await refreshFreeImageJob(job);
  assert.strictEqual(job.status, 'done', `job error: ${job.error}`);
  assert.ok(job.assetId, 'asset created');
  const files = newMediaFiles(before);
  assert.strictEqual(files.length, 1, `expected exactly one new file, got ${files}`);
  const name = files[0];
  assert.ok(name.endsWith('-wm.png'), `watermarked name: ${name}`);
  const buf = fs.readFileSync(path.join(MEDIA, name));
  assert.strictEqual(buf[0], 0x89, 'PNG signature');
  assert.ok(buf.length > 5000, 'real image bytes saved');
  // The raw unwatermarked file must not exist — the whole point of the path.
  assert.strictEqual(newMediaFiles(before).filter((f) => f === name).length, 1);
});

test('free image: Google quota out gets a plain-language error and no asset', async () => {
  mode = 'quota';
  const before = mediaFilesBefore();
  const job = fakeJob();
  await refreshFreeImageJob(job);
  assert.strictEqual(job.status, 'error');
  assert.match(job.error, /free allowance is out/);
  assert.strictEqual(job.assetId, null);
  assert.deepStrictEqual(newMediaFiles(before), []);
});

test('free image: silent empty reply is surfaced, not saved', async () => {
  mode = 'empty';
  const before = mediaFilesBefore();
  const job = fakeJob();
  await refreshFreeImageJob(job);
  assert.strictEqual(job.status, 'error');
  assert.match(job.error, /no picture/);
  assert.deepStrictEqual(newMediaFiles(before), []);
});

test('geminiKeyCheck: accepts a valid key, rejects a bad one', async () => {
  mode = 'ok';
  const good = await geminiKeyCheck('abc');
  assert.strictEqual(good.ok, true);
  mode = 'badkey';
  const bad = await geminiKeyCheck('nope');
  assert.strictEqual(bad.ok, false);
  assert.match(bad.why, /Google said/);
});

// leave the media dir as we found it (data.sqlite is gitignored and expected)
test('cleanup', () => {
  try { fs.unlinkSync(TMP_SRC); } catch (_) {}
});