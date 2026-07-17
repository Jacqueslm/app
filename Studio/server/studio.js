// Studio: asset library, character consistency pipeline (fal.ai), and the
// ffmpeg Sequencer that stitches clips + a music track into finished videos.
//
// Everything AI-related is gated on FAL_KEY the same way Nova chat gates on
// ANTHROPIC_API_KEY: without a key the endpoints return 503 and the client
// simply hides those features. Uploads and the Sequencer work with no keys.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const express = require('express');

const db = require('./db');
const { requireAuth } = require('./auth');

let FAL_KEY = process.env.FAL_KEY; // mutable: can be set from the app's Settings without a restart
const FAL_QUEUE_BASE = process.env.FAL_QUEUE_BASE || 'https://queue.fal.run'; // overridable for tests
const ENV_PATH = path.join(__dirname, '.env');

// Optional: the same Anthropic key that powers Nova chat (server.js) sharpens
// storyboard prompts. Neither this feature nor Nova requires the other.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = 'claude-sonnet-5';

// Persist (or remove) FAL_KEY in server/.env so it survives restarts, keeping
// every other line (PORT, SESSION_SECRET, ...) untouched.
function persistFalKey(key) {
  let lines = [];
  try { lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/); } catch (_) {}
  lines = lines.filter((l) => !l.startsWith('FAL_KEY=') && l.trim() !== '');
  if (key) lines.push(`FAL_KEY=${key}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n');
}

// Model ids move fast in this space - override any of these in .env without code changes.
const MODEL_TEXT_TO_IMAGE = process.env.FAL_MODEL_TEXT_TO_IMAGE || 'fal-ai/flux/dev';
// Multi-reference editing model: sees up to 4 of the character's photos at
// once, which holds the face far better than the old single-photo Kontext.
// (If overridden to a kontext model, we fall back to single-image input.)
const MODEL_CHARACTER_IMAGE = process.env.FAL_MODEL_CHARACTER_IMAGE || 'fal-ai/flux-2-pro/edit';
// "Best" image quality: Google's Nano Banana Pro - stronger scene reasoning,
// best-in-class text-inside-the-image, and multi-person consistency. Costs
// ~4x Flux, so it's a per-generation choice, not the default.
const MODEL_IMAGE_BEST = process.env.FAL_MODEL_IMAGE_BEST || 'fal-ai/nano-banana-pro';
const MODEL_IMAGE_BEST_EDIT = process.env.FAL_MODEL_IMAGE_BEST_EDIT || 'fal-ai/nano-banana-pro/edit';
const MODEL_LORA_IMAGE = process.env.FAL_MODEL_LORA_IMAGE || 'fal-ai/flux-lora';
// Image-to-video quality tiers with price estimates (USD/second, audio off).
// Rates are a snapshot - fal has no public pricing API - so they're shown in
// the app as estimates with an as-of date, and every id/rate is env-overridable.
const PRICES_AS_OF = 'July 2026';
const VIDEO_TIERS = {
  draft: {
    label: 'Draft', desc: 'Seedance - cheap takes',
    model: process.env.FAL_MODEL_I2V_DRAFT || 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
    rate: Number(process.env.STUDIO_RATE_DRAFT || 0.042),
  },
  standard: {
    label: 'Standard', desc: 'Kling 3.0 Standard',
    model: process.env.FAL_MODEL_IMAGE_TO_VIDEO || 'fal-ai/kling-video/v3/standard/image-to-video',
    rate: Number(process.env.STUDIO_RATE_STANDARD || 0.084),
  },
  best: {
    label: 'Best', desc: 'Kling 3.0 Pro - hero shots',
    model: process.env.FAL_MODEL_I2V_BEST || 'fal-ai/kling-video/v3/pro/image-to-video',
    rate: Number(process.env.STUDIO_RATE_BEST || 0.112),
  },
};
const IMAGE_RATE = Number(process.env.STUDIO_RATE_IMAGE || 0.035); // Flux ballpark per image
// FLUX.2 pro edit bills $0.03 for the first output MP + $0.015 per extra MP of
// input and output; ~2MP output + 3-4 downscaled reference photos lands here.
const CHARACTER_IMAGE_RATE = Number(process.env.STUDIO_RATE_CHARACTER_IMAGE || 0.09);
const IMAGE_BEST_RATE = Number(process.env.STUDIO_RATE_IMAGE_BEST || 0.15); // Nano Banana Pro flat per image
// One-time LoRA face training, driven from the Characters tab. Billed per
// step by fal (~$0.0024/step); 1500 steps is a solid portrait lock (~$3.60).
const MODEL_LORA_TRAINER = process.env.FAL_MODEL_LORA_TRAINER || 'fal-ai/flux-lora-portrait-trainer';
const LORA_TRAIN_STEPS = Math.max(1000, Number(process.env.STUDIO_LORA_STEPS || 1500));
const LORA_STEP_RATE = Number(process.env.STUDIO_RATE_LORA_STEP || 0.0024);
const FAL_STORAGE_AUTH_URL = process.env.FAL_STORAGE_AUTH_URL || 'https://rest.alpha.fal.ai/storage/auth/token?storage_type=fal-cdn-v3';
const MODEL_LIPSYNC_IMAGE = process.env.FAL_MODEL_LIPSYNC_IMAGE || 'fal-ai/sadtalker';
const MODEL_LIPSYNC_VIDEO = process.env.FAL_MODEL_LIPSYNC_VIDEO || 'fal-ai/sync-lipsync';
// Sing quality tiers for video subjects: MuseTalk is the cheap fast draft,
// LatentSync the hero pass ($0.20 flat for clips under 40s - Sing caps at 30).
const MODEL_LIPSYNC_DRAFT = process.env.FAL_MODEL_LIPSYNC_DRAFT || 'fal-ai/musetalk';
const MODEL_LIPSYNC_HERO = process.env.FAL_MODEL_LIPSYNC_HERO || 'fal-ai/latentsync';
const SING_DRAFT_RATE = Number(process.env.STUDIO_RATE_SING_DRAFT || 0.04);
const SING_HERO_RATE = Number(process.env.STUDIO_RATE_SING_HERO || 0.20);
// LivePortrait: animates an approved still's face/eyes/head from a driving
// clip without regenerating the image - canon-safe motion. Compute-billed;
// the rate here is a displayed estimate, not a fal list price.
const MODEL_LIVEPORTRAIT = process.env.FAL_MODEL_LIVEPORTRAIT || 'fal-ai/live-portrait';
const LIVEPORTRAIT_RATE = Number(process.env.STUDIO_RATE_LIVEPORTRAIT || 0.10);
const MODEL_MOTION = process.env.FAL_MODEL_MOTION || 'fal-ai/wan-animate';

// Server-side daily caps so a runaway loop (or, later, a public user) can't
// silently drain the fal.ai balance. Generous for personal use; tune in .env.
const DAILY_AI_IMAGE_LIMIT = Number(process.env.STUDIO_DAILY_IMAGE_LIMIT || 300);
const DAILY_AI_VIDEO_LIMIT = Number(process.env.STUDIO_DAILY_VIDEO_LIMIT || 60);

const MEDIA_DIR = path.join(__dirname, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const UPLOAD_LIMIT = '400mb';
const EXT_BY_KIND = {
  image: new Set(['.png', '.jpg', '.jpeg', '.webp']),
  video: new Set(['.mp4', '.webm', '.mov', '.m4v']),
  audio: new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac']),
  project: new Set(['.json']),
  archive: new Set(['.zip']),
};
const CONTENT_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.json': 'application/json', '.zip': 'application/zip',
};

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function mediaPath(filename) {
  // Filenames are always server-generated, but stay paranoid about traversal anyway.
  const safe = path.basename(filename);
  return path.join(MEDIA_DIR, safe);
}

function newFilename(userId, ext) {
  return `u${userId}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
}

function assetJson(row) {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    characterId: row.character_id,
    meta: row.meta ? JSON.parse(row.meta) : null,
    createdAt: row.created_at,
    url: `/api/studio/assets/${row.id}/file`,
  };
}

// A character's REFERENCE photos are only the images the user uploaded for
// them. Generated scenes also carry the character's id (useful for grouping),
// but they must never feed back into references - AI output training/
// conditioning on AI output drifts the face, and duo scenes would pollute
// each member's set with the other person.
function isUploadedRef(row, characterId) {
  if (row.character_id !== characterId) return false;
  try {
    const m = JSON.parse(row.meta || 'null');
    if (!m) return true; // very old rows predate meta entirely
    if (m.overlay) return false;
    return !m.source || m.source === 'upload';
  } catch (_) { return true; }
}

function deleteUserAssets(userId) {
  for (const row of db.getAssets(userId)) {
    try { fs.unlinkSync(mediaPath(row.filename)); } catch (_) {}
  }
}

/* ------------------------------------------------------------------ */
/* ffmpeg                                                              */
/* ------------------------------------------------------------------ */
// Read a media file's duration by parsing ffmpeg's own banner output - works
// with ffmpeg-static too (which doesn't bundle ffprobe).
function probeMediaDuration(file) {
  return new Promise((resolve) => {
    let out = '';
    const proc = spawn(ffmpegBin(), ['-i', file]);
    proc.stderr.on('data', (c) => { out += c.toString(); });
    proc.on('close', () => {
      const m = out.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
      resolve(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null);
    });
    proc.on('error', () => resolve(null));
  });
}

// Same stderr-parsing trick as probeMediaDuration: uploaded videos may or
// may not carry sound, and concat filters hard-fail if you map a missing
// audio stream.
function probeHasAudio(file) {
  return new Promise((resolve) => {
    let out = '';
    const proc = spawn(ffmpegBin(), ['-i', file]);
    proc.stderr.on('data', (c) => { out += c.toString(); });
    proc.on('close', () => resolve(/Stream #\d+:\d+.*Audio:/.test(out)));
    proc.on('error', () => resolve(false));
  });
}

function ffmpegBin() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const bundled = require('ffmpeg-static');
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch (_) {}
  return 'ffmpeg'; // fall back to a system install (brew/apt/winget install ffmpeg)
}

/* ------------------------------------------------------------------ */
/* In-memory job tracking (single-machine server; jobs don't survive a */
/* restart, which is fine - the client just re-submits)                */
/* ------------------------------------------------------------------ */
const jobs = new Map(); // jobId -> {userId, type, status, progress, error, assetId, fal:{statusUrl,responseUrl,...}}
let jobCounter = 0;

function createJob(userId, type, extra) {
  const id = `job-${++jobCounter}-${crypto.randomBytes(4).toString('hex')}`;
  const job = { id, userId, type, status: 'running', progress: 0, error: null, assetId: null, ...extra };
  jobs.set(id, job);
  // Don't let the map grow forever on a long-lived server.
  if (jobs.size > 500) {
    for (const [key, j] of jobs) {
      if (j.status !== 'running') jobs.delete(key);
      if (jobs.size <= 400) break;
    }
  }
  return job;
}

function jobJson(job) {
  return {
    id: job.id, type: job.type, status: job.status, progress: job.progress,
    error: job.error, assetId: job.assetId,
    ...(job.transcript ? { transcript: job.transcript } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* fal.ai queue helpers                                                */
/* ------------------------------------------------------------------ */
async function falSubmit(model, input) {
  // Network-level failures ("fetch failed": a dropped socket, a blip mid-
  // upload) get two quiet retries before anything reaches the user.
  let res;
  const body = JSON.stringify(input);
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(`${FAL_QUEUE_BASE}/${model}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Key ${FAL_KEY}` },
        body,
      });
      break;
    } catch (err) {
      if (attempt >= 3) {
        throw new Error('The upload to fal.ai kept failing mid-send (network hiccup, or a very large request). Check your connection and try again — if it only happens with two characters on Best quality, remove a couple of reference photos.');
      }
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
    // fal's content checker false-alarms fairly often when editing photos of
    // real people. The raw 422 body echoes the whole request (including huge
    // base64 reference images) - never show that wall of JSON to a human.
    if (res.status === 422 && /content_policy/i.test(raw)) {
      throw new Error("fal's safety checker flagged this one - with photos of real people that's usually a false alarm. You weren't charged. Reword the prompt a little (drop words that could read the wrong way out of context) and try again.");
    }
    throw new Error(`fal.ai rejected the job (${res.status}): ${raw.slice(0, 300)}`);
  }
  return data; // { request_id, status_url, response_url, ... }
}

async function falGet(url) {
  const res = await fetch(url, { headers: { Authorization: `Key ${FAL_KEY}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
    throw new Error(`fal.ai request failed (${res.status}): ${detail}`);
  }
  return data;
}

async function downloadToMedia(userId, fileUrl, ext) {
  const res = await fetch(fileUrl, { headers: { Authorization: `Key ${FAL_KEY}` } });
  if (!res.ok) throw new Error(`Could not download the generated file (${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  const filename = newFilename(userId, ext);
  fs.writeFileSync(mediaPath(filename), buf);
  return filename;
}

function fileToDataUri(filename) {
  const ext = path.extname(filename).toLowerCase();
  const type = CONTENT_TYPES[ext] || 'application/octet-stream';
  const buf = fs.readFileSync(mediaPath(filename));
  return `data:${type};base64,${buf.toString('base64')}`;
}

// Reference photos straight off a phone are 10+ megapixels; FLUX.2 edit bills
// per input megapixel and big payloads slow every request. Cache a ≤1MP JPEG
// copy of each reference (kept out of the library/backup — it's re-creatable).
const REFCACHE_DIR = path.join(MEDIA_DIR, 'refcache');
function scaledRefDataUri(filename) {
  return new Promise((resolve) => {
    const src = mediaPath(filename);
    const asUri = (p) => {
      try {
        const ext = path.extname(p).toLowerCase();
        resolve(`data:${CONTENT_TYPES[ext] || 'image/jpeg'};base64,${fs.readFileSync(p).toString('base64')}`);
      } catch (_) { resolve(null); }
    };
    // _v2: tighter geometry/quality than the first cut - a duo on Best sends
    // up to 10 of these in one request body, and oversized refs were pushing
    // submissions past what the connection would carry ("fetch failed").
    const cached = path.join(REFCACHE_DIR, path.basename(filename).replace(/\.[^.]+$/, '') + '_v2.jpg');
    if (fs.existsSync(cached)) return asUri(cached);
    fs.mkdirSync(REFCACHE_DIR, { recursive: true });
    const proc = spawn(ffmpegBin(), ['-y', '-i', src, '-vf', "scale='min(1024,iw)':-2", '-frames:v', '1', '-q:v', '4', cached]);
    proc.on('error', () => asUri(src));
    proc.on('close', (code) => asUri(code === 0 && fs.existsSync(cached) ? cached : src));
  });
}

// Poll a running fal job once. Called from the client's polling loop rather
// than a server timer, so an abandoned tab doesn't leave a hot loop running.
// Upload a buffer to fal's file storage; returns a URL fal models can read.
// Two-step flow: short-lived token from the auth endpoint, then the bytes to
// the returned base_url. (Data-URI inlining is the fallback - training zips
// are too big for that to be the primary path.)
async function falUploadFile(buf, filename, contentType) {
  const tokRes = await fetch(FAL_STORAGE_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Key ${FAL_KEY}` },
    body: '{}',
  });
  const tok = await tokRes.json().catch(() => ({}));
  if (!tokRes.ok || !tok.token || !tok.base_url) {
    throw new Error(`fal storage auth failed (${tokRes.status})`);
  }
  const upRes = await fetch(`${tok.base_url}/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `${tok.token_type || 'Bearer'} ${tok.token}`,
      'Content-Type': contentType,
      'X-Fal-File-Name': filename,
    },
    body: buf,
  });
  const up = await upRes.json().catch(() => ({}));
  const url = up.access_url || up.url;
  if (!upRes.ok || !url) throw new Error(`fal storage upload failed (${upRes.status})`);
  return url;
}

async function refreshFalJob(job) {
  if (job.status !== 'running') return;
  try {
    const status = await falGet(job.fal.statusUrl);
    if (status.status === 'IN_QUEUE') { job.progress = 5; return; }
    if (status.status === 'IN_PROGRESS') { job.progress = Math.min(90, (job.progress || 5) + 5); return; }
    if (status.status !== 'COMPLETED') return;

    const result = await falGet(job.fal.responseUrl);

    if (job.fal.expect === 'transcript') {
      // Whisper returns segments with [start, end] timestamps - exactly the
      // shape the lyrics card needs for synced captions.
      const chunks = Array.isArray(result.chunks) ? result.chunks : [];
      job.transcript = {
        text: String(result.text || ''),
        lines: chunks
          .map((c) => ({
            text: String(c.text || '').trim(),
            start: Array.isArray(c.timestamp) ? Number(c.timestamp[0]) || 0 : 0,
          }))
          .filter((l) => l.text),
      };
      job.progress = 100;
      job.status = 'done';
      return;
    }

    if (job.fal.expect === 'lora') {
      // Training finished: wire the LoRA straight into the character so the
      // very next generation with them uses it - nothing to copy or paste.
      const loraUrl = result.diffusers_lora_file?.url || result.lora_file?.url;
      if (!loraUrl) throw new Error('Training finished but returned no LoRA file.');
      const ch = db.getCharacter(job.userId, job.fal.characterId);
      if (ch) db.updateCharacter(job.userId, ch.id, { name: ch.name, loraUrl, triggerWord: job.fal.meta?.trigger || null });
      job.progress = 100;
      job.status = 'done';
      return;
    }

    const media = job.fal.expect === 'video'
      ? (result.video && result.video.url)
      : (result.images && result.images[0] && result.images[0].url);
    if (!media) throw new Error('The model finished but returned no output file.');

    const ext = job.fal.expect === 'video' ? '.mp4' : '.png';
    const filename = await downloadToMedia(job.userId, media, ext);
    const meta = { ...(job.fal.meta || {}) };
    if (job.fal.expect === 'video') meta.duration = await probeMediaDuration(mediaPath(filename));
    job.assetId = db.createAsset(job.userId, job.fal.expect, job.fal.label, filename, job.fal.characterId || null, meta);
    if (job.fal.expect === 'video') db.incrementVideoCount(job.userId, todayUTC());
    else db.incrementImageCount(job.userId, todayUTC());
    job.progress = 100;
    job.status = 'done';
  } catch (err) {
    job.status = 'error';
    job.error = err.message;
  }
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */
const router = express.Router();
router.use(requireAuth);

// When the recovery app goes public, Studio must stay yours alone - it spends
// your fal balance and renders on your CPU. Set STUDIO_OWNER_EMAIL in .env and
// every Studio endpoint locks to that account; unset = open to any local user.
const STUDIO_OWNER_EMAIL = (process.env.STUDIO_OWNER_EMAIL || '').trim().toLowerCase();
router.use((req, res, next) => {
  if (!STUDIO_OWNER_EMAIL) return next();
  const user = db.getUserById(req.userId);
  if (user && user.email === STUDIO_OWNER_EMAIL) return next();
  res.status(403).json({ error: 'Studio is private on this server.' });
});

router.get('/config', (req, res) => {
  const user = db.getUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  res.json({
    falAvailable: Boolean(FAL_KEY),
    imagesUsed: db.getImageCount(req.userId, todayUTC()),
    imageLimit: DAILY_AI_IMAGE_LIMIT,
    videosUsed: db.getVideoCount(req.userId, todayUTC()),
    videoLimit: DAILY_AI_VIDEO_LIMIT,
    models: {
      textToImage: MODEL_TEXT_TO_IMAGE,
      characterImage: MODEL_CHARACTER_IMAGE,
      loraImage: MODEL_LORA_IMAGE,
      lipsyncImage: MODEL_LIPSYNC_IMAGE,
      lipsyncVideo: MODEL_LIPSYNC_VIDEO,
      motion: MODEL_MOTION,
    },
    pricing: {
      asOf: PRICES_AS_OF,
      imageRate: IMAGE_RATE,
      characterImageRate: CHARACTER_IMAGE_RATE,
      imageBestRate: IMAGE_BEST_RATE,
      loraTrain: { steps: LORA_TRAIN_STEPS, estCost: LORA_TRAIN_STEPS * LORA_STEP_RATE },
      sing: { draft: SING_DRAFT_RATE, hero: SING_HERO_RATE },
      livePortrait: LIVEPORTRAIT_RATE,
      transcribe: TRANSCRIBE_RATE,
      tiers: Object.fromEntries(Object.entries(VIDEO_TIERS).map(([k, t]) =>
        [k, { label: t.label, desc: t.desc, rate: t.rate }])),
    },
  });
});

/* ---------------- diagnostics (recent server errors) ---------------- */
router.get('/diagnostics', (req, res) => {
  res.json({ errors: db.getRecentErrors(50) });
});

/* ---------------- owned-audience email list ---------------- */
router.get('/fans', (req, res) => {
  res.json({ count: db.getFanSignupCount(), signups: db.getFanSignups() });
});
router.get('/fans.csv', (req, res) => {
  const rows = db.getFanSignups();
  const csv = ['email,source,signed_up_at']
    .concat(rows.map((r) => [r.email, r.source || '', r.created_at].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="fan-list-${todayUTC()}.csv"`);
  res.send(csv);
});

/* ---------------- settings: AI key from the app ---------------- */
router.post('/settings/falkey', (req, res) => {
  const { key } = req.body || {};
  const clean = typeof key === 'string' ? key.trim() : '';
  if (clean && (clean.length < 10 || /\s/.test(clean))) {
    return res.status(400).json({ error: "That doesn't look like a fal.ai key. Copy it from fal.ai → Keys." });
  }
  try {
    persistFalKey(clean || null);
    FAL_KEY = clean || undefined;
    res.json({ falAvailable: Boolean(FAL_KEY) });
  } catch (err) {
    res.status(500).json({ error: `Could not save the key: ${err.message}` });
  }
});

/* ---------------- storage manager ---------------- */
router.get('/storage', (req, res) => {
  let total = 0;
  const items = db.getAssets(req.userId).map((row) => {
    let size = 0;
    try { size = fs.statSync(mediaPath(row.filename)).size; } catch (_) {}
    total += size;
    return { id: row.id, kind: row.kind, label: row.label, size, createdAt: row.created_at };
  });
  items.sort((a, b) => b.size - a.size);
  res.json({ total, count: items.length, items: items.slice(0, 30) });
});

/* ---------------- full backup (streamed, nothing extra stored) ---------------- */
router.get('/backup', (req, res) => {
  try {
    const archiverMod = require('archiver');
    const archive = typeof archiverMod === 'function'
      ? archiverMod('zip', { zlib: { level: 0 } })
      : new archiverMod.ZipArchive({ zlib: { level: 0 } });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="studio-backup-${stamp}.zip"`);
    archive.on('error', () => { try { res.end(); } catch (_) {} });
    archive.pipe(res);

    const assets = db.getAssets(req.userId);
    for (const a of assets) {
      const file = mediaPath(a.filename);
      if (fs.existsSync(file)) {
        archive.file(file, { name: `backup/${a.kind}s/${a.id}-${a.label.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)}${path.extname(a.filename)}` });
      }
    }
    const manifest = {
      exportedAt: new Date().toISOString(),
      assets: assets.map((a) => ({ id: a.id, kind: a.kind, label: a.label, meta: a.meta ? JSON.parse(a.meta) : null, createdAt: a.created_at })),
      characters: db.getCharacters(req.userId).map((c) => ({ id: c.id, name: c.name, loraUrl: c.lora_url, triggerWord: c.trigger_word })),
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'backup/manifest.json' });
    archive.finalize();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: `Backup failed: ${err.message}` });
  }
});

/* ---------------- assets ---------------- */
router.get('/assets', (req, res) => {
  const kind = ['image', 'video', 'audio', 'project', 'archive'].includes(req.query.kind) ? req.query.kind : null;
  res.json({ assets: db.getAssets(req.userId, kind).map(assetJson) });
});

router.get('/assets/:id/file', (req, res) => {
  const row = db.getAsset(req.userId, Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Asset not found.' });
  const ext = path.extname(row.filename).toLowerCase();
  res.sendFile(mediaPath(row.filename), {
    headers: { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream' },
  });
});

// Remove an image from a character's reference set without deleting it from
// the library (clears the character link only).
router.post('/assets/:id/unlink-character', (req, res) => {
  const row = db.getAsset(req.userId, Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Asset not found.' });
  db.unlinkAssetFromCharacter(req.userId, row.id);
  res.json({ ok: true });
});

router.delete('/assets/:id', (req, res) => {
  const row = db.getAsset(req.userId, Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Asset not found.' });
  db.deleteAsset(req.userId, row.id);
  try { fs.unlinkSync(mediaPath(row.filename)); } catch (_) {}
  try { fs.unlinkSync(path.join(REFCACHE_DIR, path.basename(row.filename).replace(/\.[^.]+$/, '') + '.jpg')); } catch (_) {}
  res.json({ ok: true });
});

// Raw-body upload keeps us dependency-free (no multer). The client sends the
// file bytes directly with metadata in the query string.
router.put('/upload', express.raw({ type: () => true, limit: UPLOAD_LIMIT }), async (req, res) => {
  const { kind } = req.query;
  const name = String(req.query.name || 'upload');
  const characterId = req.query.characterId ? Number(req.query.characterId) : null;
  if (!EXT_BY_KIND[kind]) return res.status(400).json({ error: 'kind must be image, video, or audio.' });
  const ext = path.extname(name).toLowerCase();
  if (!EXT_BY_KIND[kind].has(ext)) {
    return res.status(400).json({ error: `Unsupported ${kind} file type: ${ext || '(none)'}` });
  }
  // If a JSON-typed body slipped through express.json() first, req.body is a
  // parsed object rather than a Buffer - re-serialize it.
  let body = req.body;
  if (body && !Buffer.isBuffer(body) && typeof body === 'object') body = Buffer.from(JSON.stringify(body));
  if (!body || !body.length) return res.status(400).json({ error: 'Empty upload.' });
  if (characterId && !db.getCharacter(req.userId, characterId)) {
    return res.status(404).json({ error: 'Character not found.' });
  }
  const filename = newFilename(req.userId, ext);
  fs.writeFileSync(mediaPath(filename), body);
  const label = path.basename(name, ext).slice(0, 80) || 'Upload';
  const meta = { source: 'upload' };
  if (req.query.overlay === '1') meta.overlay = true; // text-card PNGs stay out of the pickers
  if (kind === 'video' || kind === 'audio') meta.duration = await probeMediaDuration(mediaPath(filename));
  const id = db.createAsset(req.userId, kind, label, filename, characterId, meta);
  res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
});

/* ---------------- characters ---------------- */
router.get('/characters', (req, res) => {
  const characters = db.getCharacters(req.userId).map((c) => ({
    id: c.id, name: c.name, loraUrl: c.lora_url, triggerWord: c.trigger_word, createdAt: c.created_at,
    refs: db.getAssets(req.userId, 'image').filter((a) => isUploadedRef(a, c.id)).map(assetJson),
  }));
  res.json({ characters });
});

router.post('/characters', (req, res) => {
  const { name, loraUrl, triggerWord } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Character name is required.' });
  }
  const id = db.createCharacter(req.userId, name.trim().slice(0, 60), loraUrl, triggerWord);
  res.status(201).json({ id });
});

router.put('/characters/:id', (req, res) => {
  const character = db.getCharacter(req.userId, Number(req.params.id));
  if (!character) return res.status(404).json({ error: 'Character not found.' });
  const { name, loraUrl, triggerWord } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Character name is required.' });
  }
  db.updateCharacter(req.userId, character.id, {
    name: name.trim().slice(0, 60),
    loraUrl: typeof loraUrl === 'string' ? loraUrl.trim() : null,
    triggerWord: typeof triggerWord === 'string' ? triggerWord.trim() : null,
  });
  res.json({ ok: true });
});

router.delete('/characters/:id', (req, res) => {
  const character = db.getCharacter(req.userId, Number(req.params.id));
  if (!character) return res.status(404).json({ error: 'Character not found.' });
  db.deleteCharacter(req.userId, character.id); // reference images stay in the library
  res.json({ ok: true });
});

/* ---------------- one-time LoRA face training ---------------- */
// Scale a training photo to a bounded JPEG copy; resolves false on failure
// so one unreadable photo doesn't sink the whole training set.
function scaleForTraining(srcFile, outFile) {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegBin(), ['-y', '-i', srcFile, '-vf', "scale='min(1536,iw)':-2", '-frames:v', '1', '-q:v', '2', outFile]);
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0 && fs.existsSync(outFile)));
  });
}

router.post('/characters/:id/train-lora', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'AI generation is not set up yet. Paste your fal.ai key in the Turn on AI box first.' });
  }
  const character = db.getCharacter(req.userId, Number(req.params.id));
  if (!character) return res.status(404).json({ error: 'Character not found.' });
  const refs = db.getAssets(req.userId, 'image')
    .filter((a) => isUploadedRef(a, character.id))
    .slice(0, 20);
  if (refs.length < 6) {
    return res.status(400).json({ error: `Training needs at least 6 photos of ${character.name} (10-20 varied ones is ideal) - they have ${refs.length}. Add more on this tab first.` });
  }

  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-lora-'));
  try {
    // 1. bounded JPEG copies of every reference photo
    const files = [];
    for (let i = 0; i < refs.length; i++) {
      const out = path.join(tmp, `photo_${String(i + 1).padStart(2, '0')}.jpg`);
      if (await scaleForTraining(mediaPath(refs[i].filename), out)) files.push(out);
    }
    if (files.length < 6) throw new Error('Could not prepare enough of the photos for training - try re-uploading them.');

    // 2. zip them
    const zipPath = path.join(tmp, 'training.zip');
    await new Promise((resolve, reject) => {
      const archiverMod = require('archiver');
      const archive = typeof archiverMod === 'function'
        ? archiverMod('zip', { zlib: { level: 0 } })
        : new archiverMod.ZipArchive({ zlib: { level: 0 } });
      const outStream = fs.createWriteStream(zipPath);
      outStream.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(outStream);
      for (const f of files) archive.file(f, { name: path.basename(f) });
      archive.finalize();
    });
    const zipBuf = fs.readFileSync(zipPath);

    // 3. get the zip somewhere fal can read it - storage upload first, inline
    // data URI as a fallback for smaller sets
    let imagesUrl;
    try {
      imagesUrl = await falUploadFile(zipBuf, `${character.name.replace(/[^a-zA-Z0-9]/g, '_')}_training.zip`, 'application/zip');
    } catch (err) {
      if (zipBuf.length > 9_000_000) {
        throw new Error(`Could not upload the training photos to fal.ai (${err.message}) and the set is too large to send inline. Try again in a minute.`);
      }
      imagesUrl = `data:application/zip;base64,${zipBuf.toString('base64')}`;
    }

    // 4. train. Trigger word: keep the character's existing one if it's clean,
    // else derive one from their name (a made-up single token works best).
    const trigger = (character.trigger_word && /^[a-z0-9]{3,24}$/.test(character.trigger_word))
      ? character.trigger_word
      : (character.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || `char${character.id}`);
    const submitted = await falSubmit(MODEL_LORA_TRAINER, {
      images_data_url: imagesUrl,
      trigger_phrase: trigger,
      steps: LORA_TRAIN_STEPS,
      subject_crop: true,
    });
    const job = createJob(req.userId, 'lora-train', {
      fal: {
        statusUrl: submitted.status_url,
        responseUrl: submitted.response_url,
        expect: 'lora',
        label: `Face lock: ${character.name}`,
        characterId: character.id,
        meta: { trigger, photos: files.length },
      },
    });
    res.status(202).json({ job: jobJson(job), trigger, photos: files.length });
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
});

/* ---------------- AI generation (fal.ai) ---------------- */
const IMAGE_SIZES = new Set(['square_hd', 'portrait_16_9', 'landscape_16_9']);

// Shared by the interactive /scene endpoint and the overnight queue worker:
// resolves a prompt + character selection into a fal model/input pair.
// Throws an Error with `.status` set to the right HTTP code on any problem.
async function buildSceneModelInput(userId, { prompt, characterId, characterIds, imageSize, quality }) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw Object.assign(new Error('prompt is required.'), { status: 400 });
  }
  if (imageSize && !IMAGE_SIZES.has(imageSize)) {
    throw Object.assign(new Error('imageSize must be square_hd, portrait_16_9, or landscape_16_9.'), { status: 400 });
  }
  const best = quality === 'best'; // Nano Banana Pro instead of Flux
  const cleanPrompt = prompt.trim().slice(0, 2000);
  let model = best ? MODEL_IMAGE_BEST : MODEL_TEXT_TO_IMAGE;
  // No num_images here: every model defaults to 1 and the FLUX.2 edit schema
  // doesn't take it. Multiple takes are separate submits (one job each).
  // Banana speaks aspect_ratio; Flux speaks image_size.
  const size = imageSize || 'landscape_16_9';
  const input = best
    ? { prompt: cleanPrompt, aspect_ratio: { landscape_16_9: '16:9', portrait_16_9: '9:16', square_hd: '1:1' }[size] }
    : { prompt: cleanPrompt, image_size: size };

  // One character, or two sharing the scene. Ids arrive as characterIds
  // (new client) or characterId (storyboard + older clients).
  const requestedIds = [...new Set(
    (Array.isArray(characterIds) ? characterIds : [characterId]).filter(Boolean).map(Number)
  )].slice(0, 2);
  const cast = [];
  for (const id of requestedIds) {
    const c = db.getCharacter(userId, id);
    if (!c) throw Object.assign(new Error('Character not found.'), { status: 404 });
    cast.push(c);
  }
  const character = cast[0] || null;

  if (cast.length === 1 && cast[0].lora_url && !best) {
    // Strongest consistency: the trained LoRA is baked into generation.
    // (LoRAs are Flux-only - on Best quality a LoRA character falls through
    // to the photo path below, or errors if it has no photos.)
    model = MODEL_LORA_IMAGE;
    input.loras = [{ path: character.lora_url, scale: 1 }];
    if (character.trigger_word && !cleanPrompt.includes(character.trigger_word)) {
      input.prompt = `${character.trigger_word}, ${cleanPrompt}`;
    }
  } else if (cast.length) {
    // Photo-reference path (solo or duo). A duo always works from photos: two
    // identity LoRAs in one generation bleed into each other.
    model = best ? MODEL_IMAGE_BEST_EDIT : MODEL_CHARACTER_IMAGE;
    // Banana Pro edit accepts up to 14 reference images (Flux bills per input
    // megapixel, so it stays leaner) - more angles = a stronger likeness lock.
    const perChar = best ? (cast.length > 1 ? 5 : 6) : (cast.length > 1 ? 3 : 4);
    const allUris = [];
    const whose = []; // which reference photos belong to which character
    for (const c of cast) {
      const refs = db.getAssets(userId, 'image').filter((a) => isUploadedRef(a, c.id)).slice(0, perChar);
      if (!refs.length) {
        const hint = best ? ' — Best quality works from photos (LoRAs are Flux-only)'
          : cast.length > 1 ? ' — two-character scenes work from photos' : ', or paste a LoRA URL';
        throw Object.assign(new Error(`Upload at least one reference photo for ${c.name} first (Characters tab)${hint}.`), { status: 400 });
      }
      let uris = (await Promise.all(refs.map((r) => scaledRefDataUri(r.filename)))).filter(Boolean);
      if (!uris.length) throw Object.assign(new Error(`Could not read ${c.name}'s reference photos — try re-uploading them.`), { status: 500 });
      // Keep the whole submission under a payload budget: oversized bodies
      // die in transit as a bare "fetch failed". Every character always keeps
      // at least one photo; extras are dropped past ~6MB of total refs.
      const budget = 6_000_000;
      let used = allUris.reduce((n, u) => n + u.length, 0);
      uris = uris.filter((u, i) => { if (i === 0 || used + u.length <= budget) { used += u.length; return true; } return false; });
      const from = allUris.length + 1, to = allUris.length + uris.length;
      whose.push(`${from === to ? `Reference photo ${from}` : `Reference photos ${from}-${to}`} show${from === to ? 's' : ''} ${c.name}.`);
      allUris.push(...uris);
    }
    // The model only reproduces a face it can study — spell the identity
    // instruction out and hand it several angles, not just the first photo.
    input.prompt = cast.length === 1
      ? ('The person in the reference photo(s) is the main character. '
        + 'Keep their face, hairstyle, skin tone and build EXACTLY as shown — same person, instantly recognizable. '
        + `Now show them in this scene: ${cleanPrompt}`)
      : (whose.join(' ')
        + ' These are two different people appearing together. Keep each person\'s face, hairstyle, skin tone and build EXACTLY as in their own photos — both instantly recognizable. Never blend, swap or average their faces. '
        + `Now show ${cast[0].name} and ${cast[1].name} together in this scene: ${cleanPrompt}`);
    if (/kontext/.test(model)) input.image_url = allUris[0]; // legacy override: single-image editor
    else input.image_urls = allUris;
  }

  // Image models resolve prompts that mention several moments/places (or two
  // people who are apart) by drawing a literal split-screen collage with a
  // seam down the middle - almost never what a music-video still wants.
  // Pin every generation to one continuous frame unless the user explicitly
  // asks for a collage-style layout.
  if (!/collage|split.?screen|diptych|triptych|grid of|multi.?panel/i.test(cleanPrompt)) {
    input.prompt += ' IMPORTANT: render ONE single continuous photograph of one unified scene - never a split screen, collage, diptych, or side-by-side panel layout.';
  }

  return { model, input, cleanPrompt, character, cast };
}

router.post('/scene', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'AI generation is not set up yet. Add FAL_KEY to server/.env (get one at fal.ai) and restart the server.' });
  }
  const { prompt, characterId, characterIds, imageSize, count, quality } = req.body || {};
  const howMany = Math.max(1, Math.min(4, Number(count) || 1));
  if (db.getImageCount(req.userId, todayUTC()) + howMany > DAILY_AI_IMAGE_LIMIT) {
    return res.status(429).json({ error: `Daily AI image cap (${DAILY_AI_IMAGE_LIMIT}) reached. Raise STUDIO_DAILY_IMAGE_LIMIT in .env if this is really you.` });
  }

  let built;
  try {
    built = await buildSceneModelInput(req.userId, { prompt, characterId, characterIds, imageSize, quality });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
  const { model, input, cleanPrompt, character, cast } = built;

  try {
    const jobs = [];
    for (let i = 0; i < howMany; i++) {
      const submitted = await falSubmit(model, input);
      jobs.push(createJob(req.userId, 'ai-image', {
        fal: {
          statusUrl: submitted.status_url,
          responseUrl: submitted.response_url,
          expect: 'image',
          label: cleanPrompt.slice(0, 80) + (howMany > 1 ? ` (${i + 1}/${howMany})` : ''),
          characterId: character ? character.id : null,
          meta: { source: 'fal', model, prompt: cleanPrompt, ...(cast.length > 1 ? { castIds: cast.map((c) => c.id) } : {}) },
        },
      }));
    }
    res.status(202).json({ job: jobJson(jobs[0]), jobs: jobs.map(jobJson) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* ---------------- overnight batch queue ---------------- */
// Submit a whole storyboard's worth of scenes once; the server keeps
// generating them one at a time even if the browser tab closes, so a full
// batch can be queued before bed and finish generating overnight.
router.post('/queue/scenes', (req, res) => {
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'AI generation is not set up yet. Add FAL_KEY to server/.env (get one at fal.ai) and restart the server.' });
  }
  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'items must be a non-empty array of { prompt, characterId?, imageSize? }.' });
  }
  if (items.length > 60) {
    return res.status(400).json({ error: 'Queue up to 60 scenes at a time.' });
  }
  const clean = [];
  for (const it of items) {
    if (typeof it.prompt !== 'string' || !it.prompt.trim()) {
      return res.status(400).json({ error: 'Every queued scene needs a prompt.' });
    }
    if (it.imageSize && !IMAGE_SIZES.has(it.imageSize)) {
      return res.status(400).json({ error: 'imageSize must be square_hd, portrait_16_9, or landscape_16_9.' });
    }
    clean.push({
      prompt: it.prompt.trim().slice(0, 2000),
      characterId: it.characterId ? Number(it.characterId) : null,
      imageSize: it.imageSize || 'landscape_16_9',
      label: typeof it.label === 'string' ? it.label.slice(0, 80) : null,
    });
  }
  const remaining = DAILY_AI_IMAGE_LIMIT - db.getImageCount(req.userId, todayUTC());
  if (clean.length > Math.max(0, remaining)) {
    return res.status(429).json({ error: `Only ${Math.max(0, remaining)} images left in today's cap — that's fewer than the ${clean.length} scenes you're queuing. Queue fewer, or raise STUDIO_DAILY_IMAGE_LIMIT in .env.` });
  }
  const ids = db.enqueueScenes(req.userId, clean);
  res.status(202).json({ queued: ids.length, ids });
});

router.get('/queue', (req, res) => {
  res.json({ items: db.getQueue(req.userId).map(queueItemJson) });
});

router.delete('/queue/:id', (req, res) => {
  db.deleteQueueItem(req.userId, Number(req.params.id));
  res.json({ ok: true });
});

router.post('/queue/clear-finished', (req, res) => {
  db.clearFinishedQueue(req.userId);
  res.json({ ok: true });
});

function queueItemJson(row) {
  return {
    id: row.id, status: row.status, prompt: row.prompt, label: row.label,
    characterId: row.character_id, assetId: row.asset_id, error: row.error,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// Drives the queue forward on its own, independent of any browser being
// open: for every user with pending/running items, keep exactly one fal job
// in flight, poll it the same way the interactive job-polling endpoint does,
// and move to the next item once it resolves.
async function processQueueTick() {
  if (!FAL_KEY) return;
  let userIds;
  try { userIds = db.getUsersWithPendingQueue(); } catch (err) { return; }
  for (const userId of userIds) {
    try {
      const running = db.getRunningQueueItem(userId);
      if (running) {
        const job = jobs.get(running.fal_job_id);
        if (!job) {
          // Server restarted mid-job (in-memory jobs don't survive that) - the
          // fal job itself may still finish, but we've lost the handle to poll
          // it. Mark it failed rather than leaving it stuck forever.
          failQueueItem(running, 'Lost track of this job after a server restart. Re-queue it.');
          continue;
        }
        await refreshFalJob(job);
        if (job.status === 'done') {
          db.updateQueueItem(running.id, { status: 'done', assetId: job.assetId });
        } else if (job.status === 'error') {
          failQueueItem(running, job.error || 'Generation failed.');
        }
        continue; // one in flight per user - don't also start the next one this tick
      }

      const next = db.getNextPendingQueueItem(userId);
      if (!next) continue;
      if (db.getImageCount(userId, todayUTC()) >= DAILY_AI_IMAGE_LIMIT) continue; // resumes once the cap rolls over

      // Anything that goes wrong turning this item into a fal submission -
      // bad reference photos, a rejected key, a network blip - must mark the
      // item 'error' and move on. Left uncaught here, the same item would be
      // picked up as "next pending" again next tick and fail identically
      // forever, since it never leaves 'pending'.
      try {
        const built = await buildSceneModelInput(userId, {
          prompt: next.prompt, characterId: next.character_id, imageSize: next.image_size,
        });
        const submitted = await falSubmit(built.model, built.input);
        const job = createJob(userId, 'ai-image', {
          fal: {
            statusUrl: submitted.status_url,
            responseUrl: submitted.response_url,
            expect: 'image',
            label: next.label || built.cleanPrompt.slice(0, 80),
            characterId: built.character ? built.character.id : null,
            meta: { source: 'queue', model: built.model, prompt: built.cleanPrompt },
          },
        });
        db.updateQueueItem(next.id, { status: 'running', falJobId: job.id });
      } catch (err) {
        failQueueItem(next, err.message);
      }
    } catch (err) {
      try { db.logError('studio-queue', err.message, err.stack); } catch (_) {}
    }
  }
}

// A queued scene failing while nobody's watching is exactly what Diagnostics
// exists for - record it there as well as on the queue item itself.
function failQueueItem(item, message) {
  db.updateQueueItem(item.id, { status: 'error', error: message });
  try { db.logError('overnight-queue', `Queued scene "${(item.label || item.prompt || '').slice(0, 60)}" failed: ${message}`); } catch (_) {}
}
const QUEUE_TICK_MS = Number(process.env.STUDIO_QUEUE_TICK_MS || 4000);
setInterval(() => { processQueueTick().catch(() => {}); }, QUEUE_TICK_MS);

router.post('/animate', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'AI generation is not set up yet. Add FAL_KEY to server/.env (get one at fal.ai) and restart the server.' });
  }
  const { assetId, prompt, duration, tier } = req.body || {};
  const still = db.getAsset(req.userId, Number(assetId));
  if (!still || still.kind !== 'image') {
    return res.status(404).json({ error: 'Pick an image from your library to animate.' });
  }
  const chosenTier = VIDEO_TIERS[tier] ? tier : 'standard';
  const model = VIDEO_TIERS[chosenTier].model;
  const seconds = [5, 10].includes(Number(duration)) ? Number(duration) : 5;
  if (db.getVideoCount(req.userId, todayUTC()) >= DAILY_AI_VIDEO_LIMIT) {
    return res.status(429).json({ error: `Daily AI video cap (${DAILY_AI_VIDEO_LIMIT}) reached. Raise STUDIO_DAILY_VIDEO_LIMIT in .env if this is really you.` });
  }

  const motionPrompt = (typeof prompt === 'string' && prompt.trim())
    ? prompt.trim().slice(0, 1000)
    : 'subtle cinematic motion, natural movement, keep the subject consistent';

  try {
    const submitted = await falSubmit(model, {
      prompt: motionPrompt,
      image_url: fileToDataUri(still.filename),
      duration: String(seconds),
    });
    const job = createJob(req.userId, 'ai-video', {
      fal: {
        statusUrl: submitted.status_url,
        responseUrl: submitted.response_url,
        expect: 'video',
        label: still.label,
        characterId: still.character_id,
        meta: { source: 'fal', model, tier: chosenTier, prompt: motionPrompt, fromAssetId: still.id, seconds },
      },
    });
    res.status(202).json({ job: jobJson(job) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* ---------------- ffmpeg job runner ---------------- */
// Spawn ffmpeg with the given args, track progress against expectedDur, and
// register the output as a video asset when it succeeds.
function spawnFfmpegJob(userId, args, outFile, expectedDur, label, meta) {
  const job = createJob(userId, 'render', {});
  const outPath = mediaPath(outFile);
  const proc = spawn(ffmpegBin(), args.concat(['-y', outPath]));
  let stderrTail = '';
  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderrTail = (stderrTail + text).slice(-4000);
    const m = text.match(/time=(\d+):(\d+):(\d+\.?\d*)/);
    if (m && expectedDur > 0) {
      const secs = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      job.progress = Math.min(99, Math.round((secs / expectedDur) * 100));
    }
  });
  proc.on('error', (err) => {
    job.status = 'error';
    job.error = `Could not start ffmpeg: ${err.message}. Run npm install in server/ (or install ffmpeg / set FFMPEG_PATH).`;
  });
  proc.on('close', (code) => {
    if (job.status === 'error') return;
    if (code === 0) {
      job.assetId = db.createAsset(userId, 'video', label, outFile, null, { ...meta, duration: expectedDur });
      job.progress = 100;
      job.status = 'done';
    } else {
      try { fs.unlinkSync(outPath); } catch (_) {}
      job.status = 'error';
      job.error = `ffmpeg exited with code ${code}: …${stderrTail.slice(-500)}`;
    }
  });
  return job;
}

/* ---------------- free ping-pong loop ---------------- */
// Stretch a short clip with zero AI spend: forward, reversed, forward... -
// motion flows back on itself, so there's no jump cut at the seams.
router.post('/loop', async (req, res) => {
  const { assetId, times } = req.body || {};
  const clip = db.getAsset(req.userId, Number(assetId));
  if (!clip || clip.kind !== 'video') return res.status(404).json({ error: 'Pick a video from your library to loop.' });
  const reps = [2, 4, 6].includes(Number(times)) ? Number(times) : 2;
  let dur = null;
  try { dur = JSON.parse(clip.meta || 'null')?.duration || null; } catch (_) {}
  if (!dur) dur = await probeMediaDuration(mediaPath(clip.filename));
  if (!dur) return res.status(400).json({ error: 'Could not read that clip.' });
  if (dur > 16) return res.status(400).json({ error: 'Looping works best on short clips — pick one under 15 seconds (reversing long video eats memory).' });

  // split into `reps` copies, reverse every other one, join them end to end
  const splitLabels = Array.from({ length: reps }, (_, i) => `[s${i}]`);
  let filter = `[0:v]split=${reps}${splitLabels.join('')};`;
  const seq = [];
  for (let i = 0; i < reps; i++) {
    if (i % 2 === 1) { filter += `[s${i}]reverse[r${i}];`; seq.push(`[r${i}]`); }
    else seq.push(`[s${i}]`);
  }
  filter += `${seq.join('')}concat=n=${reps}:v=1:a=0[out]`;
  const outFile = newFilename(req.userId, '.mp4');
  const args = [
    '-i', mediaPath(clip.filename),
    '-filter_complex', filter, '-map', '[out]', '-an',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  ];
  const job = spawnFfmpegJob(req.userId, args, outFile, dur * reps, `${clip.label} · ${reps}× loop`, { source: 'loop', fromAssetId: clip.id });
  res.status(202).json({ job: jobJson(job) });
});

/* ---------------- free local cut ---------------- */
// Trim a video into a new clip: keep only a segment, or remove a middle
// chunk and join the sides. Pure ffmpeg, keeps the original untouched.
router.post('/cut', async (req, res) => {
  const { assetId, mode, from, to } = req.body || {};
  const clip = db.getAsset(req.userId, Number(assetId));
  if (!clip || clip.kind !== 'video') return res.status(404).json({ error: 'Pick a video from your library to cut.' });
  let dur = null;
  try { dur = JSON.parse(clip.meta || 'null')?.duration || null; } catch (_) {}
  if (!dur) dur = await probeMediaDuration(mediaPath(clip.filename));
  if (!dur) return res.status(400).json({ error: 'Could not read that video.' });
  const F = Math.max(0, Number(from) || 0);
  const T = Math.min(dur, Number(to) || 0);
  if (T <= F) return res.status(400).json({ error: '"to" must be after "from".' });
  if (mode === 'remove' && F === 0 && T >= dur) return res.status(400).json({ error: 'That would remove the whole video.' });

  const src = mediaPath(clip.filename);
  const hasAudio = await probeHasAudio(src);
  const outFile = newFilename(req.userId, '.mp4');
  const enc = ['-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
  let args, expectedDur;
  if (mode === 'remove') {
    expectedDur = dur - (T - F);
    let filter = `[0:v]trim=start=0:end=${F},setpts=PTS-STARTPTS[v0];[0:v]trim=start=${T},setpts=PTS-STARTPTS[v1];[v0][v1]concat=n=2:v=1:a=0[v]`;
    const maps = ['-map', '[v]'];
    if (hasAudio) {
      filter += `;[0:a]atrim=start=0:end=${F},asetpts=PTS-STARTPTS[a0];[0:a]atrim=start=${T},asetpts=PTS-STARTPTS[a1];[a0][a1]concat=n=2:v=0:a=1[a]`;
      maps.push('-map', '[a]');
    }
    args = ['-i', src, '-filter_complex', filter, ...maps, ...(hasAudio ? ['-c:a', 'aac'] : []), ...enc];
  } else {
    expectedDur = T - F;
    args = ['-ss', F.toFixed(2), '-t', (T - F).toFixed(2), '-i', src, ...(hasAudio ? ['-c:a', 'aac'] : ['-an']), ...enc];
  }
  const job = spawnFfmpegJob(req.userId, args, outFile, expectedDur, `${clip.label} · cut`, { source: 'cut', fromAssetId: clip.id });
  res.status(202).json({ job: jobJson(job) });
});

/* ---------------- free local sound swap ---------------- */
// Mute a clip, or replace its audio with a stretch of a song from the
// library. -c:v copy leaves the video frames untouched, so both are instant.
router.post('/resound', async (req, res) => {
  const { assetId, mode, audioAssetId, start } = req.body || {};
  const clip = db.getAsset(req.userId, Number(assetId));
  if (!clip || clip.kind !== 'video') return res.status(404).json({ error: 'Pick a video from your library first.' });
  const src = mediaPath(clip.filename);
  let dur = null;
  try { dur = JSON.parse(clip.meta || 'null')?.duration || null; } catch (_) {}
  if (!dur) dur = await probeMediaDuration(src);

  const outFile = newFilename(req.userId, '.mp4');
  let args, label;
  if (mode === 'replace') {
    const song = db.getAsset(req.userId, Number(audioAssetId));
    if (!song || song.kind !== 'audio') return res.status(404).json({ error: 'Pick a song for the new sound.' });
    const S = Math.max(0, Number(start) || 0);
    args = ['-i', src, '-ss', S.toFixed(2), '-i', mediaPath(song.filename),
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart'];
    label = `${clip.label} · new sound`;
  } else {
    args = ['-i', src, '-c:v', 'copy', '-an', '-movflags', '+faststart'];
    label = `${clip.label} · muted`;
  }
  const proc = spawn(ffmpegBin(), args.concat(['-y', mediaPath(outFile)]));
  proc.on('error', (err) => res.status(500).json({ error: `Could not start ffmpeg: ${err.message}` }));
  proc.on('close', (code) => {
    if (code !== 0 || !fs.existsSync(mediaPath(outFile))) {
      return res.status(500).json({ error: 'Could not change that video\'s sound.' });
    }
    const id = db.createAsset(req.userId, 'video', label, outFile, null, { source: 'resound', fromAssetId: clip.id, ...(dur ? { duration: dur } : {}) });
    res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
  });
});

/* ---------------- free local crop ---------------- */
// Crop an image to a target aspect, keeping the start/center/end of whichever
// axis gets trimmed. Pure ffmpeg - free, instant, no AI. The crop inherits
// the original's character link and source, so a face cropped out of an
// UPLOADED photo still counts as a reference photo (AI output stays excluded).
const CROP_ASPECTS = { '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5, '16:9': 16 / 9 };

router.post('/crop', (req, res) => {
  const { assetId, aspect, keep } = req.body || {};
  const src = db.getAsset(req.userId, Number(assetId));
  if (!src || src.kind !== 'image') return res.status(404).json({ error: 'Pick a photo from your library to crop.' });
  const R = CROP_ASPECTS[aspect];
  if (!R) return res.status(400).json({ error: `aspect must be one of ${Object.keys(CROP_ASPECTS).join(', ')}` });
  const f = keep === 'start' ? 0 : keep === 'end' ? 1 : 0.5;
  const ext = path.extname(src.filename).toLowerCase() || '.png';
  const outFile = newFilename(req.userId, ext);
  const filter = `crop=min(iw\\,ih*${R}):min(ih\\,iw/${R}):(iw-ow)*${f}:(ih-oh)*${f}`;
  const proc = spawn(ffmpegBin(), ['-y', '-i', mediaPath(src.filename), '-vf', filter, '-frames:v', '1', mediaPath(outFile)]);
  proc.on('error', (err) => res.status(500).json({ error: `Could not start ffmpeg: ${err.message}` }));
  proc.on('close', (code) => {
    if (code !== 0 || !fs.existsSync(mediaPath(outFile))) {
      return res.status(500).json({ error: 'Cropping failed — is that file really an image?' });
    }
    let srcMeta = {};
    try { srcMeta = JSON.parse(src.meta || 'null') || {}; } catch (_) {}
    const id = db.createAsset(req.userId, 'image', `${src.label} · ${aspect} crop`, outFile, src.character_id || null, {
      ...(srcMeta.source ? { source: srcMeta.source } : {}),
      ...(srcMeta.prompt ? { prompt: srcMeta.prompt } : {}),
      crop: aspect,
      fromAssetId: src.id,
    });
    res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
  });
});

/* ---------------- output sizes ---------------- */
const RENDER_SIZES = new Set(['1920x1080', '1080x1920', '1080x1080', '1280x720', '720x1280', '720x720']);
const FPS = 30;

function parseSize(size, fallback) {
  const target = RENDER_SIZES.has(size) ? size : fallback;
  const [W, H] = target.split('x').map(Number);
  return { W, H, target };
}

/* ---------------- Ken Burns: stills to motion clips ---------------- */
// Every move is a zoompan expression over p = on/(d-1) (progress 0..1).
// Intensity 1..3 scales how far the camera travels.
function kenBurnsExprs(move, intensity, fx, fy) {
  const i = Math.min(3, Math.max(1, Math.round(intensity || 2)));
  const zoomAmt = [0.12, 0.25, 0.45][i - 1];   // how far push/pull travels
  const panZoom = [1.12, 1.22, 1.4][i - 1];    // fixed zoom that gives pans room to move
  const shakeAmp = [0.0025, 0.005, 0.009][i - 1];
  const driftAmt = [0.18, 0.3, 0.42][i - 1];
  const p = 'on/(duration-1)'; // zoompan calls the total frame count "duration"
  const cx = '(iw-iw/zoom)/2', cy = '(ih-ih/zoom)/2';
  switch (move) {
    case 'push':      return { z: `1+${zoomAmt}*${p}`, x: cx, y: cy };
    case 'pull':      return { z: `${1 + zoomAmt}-${zoomAmt}*${p}`, x: cx, y: cy };
    case 'pan_right': return { z: `${panZoom}`, x: `(iw-iw/zoom)*${p}`, y: cy };
    case 'pan_left':  return { z: `${panZoom}`, x: `(iw-iw/zoom)*(1-${p})`, y: cy };
    case 'pan_down':  return { z: `${panZoom}`, x: cx, y: `(ih-ih/zoom)*${p}` };
    case 'pan_up':    return { z: `${panZoom}`, x: cx, y: `(ih-ih/zoom)*(1-${p})` };
    case 'focal':     return { z: `1+${zoomAmt}*${p}`, x: `${fx}*(iw-iw/zoom)`, y: `${fy}*(ih-ih/zoom)` };
    case 'shake':     return {
      z: `${panZoom - 0.06}+0.015*sin(on/2.9)`,
      x: `${cx}+iw*${shakeAmp}*(sin(on/2.1)+0.7*sin(on/0.9))`,
      y: `${cy}+ih*${shakeAmp}*(cos(on/1.7)+0.7*sin(on/1.3))`,
    };
    case 'drift':     return {
      z: `${panZoom - 0.04}+0.02*sin(3.14159*${p})`,
      x: `(iw-iw/zoom)*(0.5+${driftAmt / 2}*sin(3.14159*${p}))`,
      y: `(ih-ih/zoom)*(0.5-${driftAmt / 3}*sin(3.14159*${p}))`,
    };
    case 'push_pan':  return { z: `1+${zoomAmt}*${p}`, x: `(iw-iw/zoom)*${p}`, y: cy };
    default: return null;
  }
}

router.post('/kenburns', (req, res) => {
  const { assetId, move, duration, intensity, focalX, focalY, size } = req.body || {};
  const still = db.getAsset(req.userId, Number(assetId));
  if (!still || still.kind !== 'image') {
    return res.status(404).json({ error: 'Pick an image from your library first.' });
  }
  const dur = Math.min(30, Math.max(1, Number(duration) || 5));
  const fx = Math.min(1, Math.max(0, Number(focalX) || 0.5));
  const fy = Math.min(1, Math.max(0, Number(focalY) || 0.5));
  const exprs = kenBurnsExprs(move, intensity, fx.toFixed(3), fy.toFixed(3));
  if (!exprs) return res.status(400).json({ error: `Unknown camera move: ${move}` });
  const { W, H } = parseSize(size, '1920x1080');
  const frames = Math.round(dur * FPS);

  // Upscale + crop to the target aspect first so zoompan never distorts, and
  // has 2x headroom for smooth sub-pixel motion.
  const chain =
    `[0:v]scale=${2 * W}:${2 * H}:force_original_aspect_ratio=increase,crop=${2 * W}:${2 * H},` +
    `zoompan=z='${exprs.z}':x='${exprs.x}':y='${exprs.y}':d=${frames}:s=${W}x${H}:fps=${FPS},format=yuv420p[v]`;
  const args = [
    '-i', mediaPath(still.filename),
    '-filter_complex', chain, '-map', '[v]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-movflags', '+faststart',
  ];
  const job = spawnFfmpegJob(req.userId, args, newFilename(req.userId, '.mp4'), dur,
    `${still.label} · ${move}`, { source: 'kenburns', move, fromAssetId: still.id });
  res.status(202).json({ job: jobJson(job) });
});

// Cut a slice of a song into an mp3 data URI to send along with a lip-sync job.
function extractAudioSegment(file, start, len) {
  return new Promise((resolve, reject) => {
    const out = path.join(MEDIA_DIR, `tmp-${crypto.randomBytes(6).toString('hex')}.mp3`);
    const proc = spawn(ffmpegBin(), [
      '-ss', start.toFixed(2), '-t', len.toFixed(2), '-i', file,
      '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-y', out,
    ]);
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0 || !fs.existsSync(out)) return reject(new Error('Could not cut that part of the song.'));
      const buf = fs.readFileSync(out);
      try { fs.unlinkSync(out); } catch (_) {}
      resolve(`data:audio/mpeg;base64,${buf.toString('base64')}`);
    });
  });
}

router.post('/lipsync', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'AI generation is not set up yet. Add FAL_KEY to server/.env (get one at fal.ai) and restart the server.' });
  }
  const { assetId, audioAssetId, start, len, tier } = req.body || {};
  const subject = db.getAsset(req.userId, Number(assetId));
  if (!subject || (subject.kind !== 'image' && subject.kind !== 'video')) {
    return res.status(404).json({ error: 'Pick an image or video from your library first.' });
  }
  const song = db.getAsset(req.userId, Number(audioAssetId));
  if (!song || song.kind !== 'audio') return res.status(404).json({ error: 'Pick a song for the vocal.' });
  const segStart = Math.max(0, Number(start) || 0);
  const segLen = Math.min(30, Math.max(1, Number(len) || 10)); // short clips: cost + model limits
  if (db.getVideoCount(req.userId, todayUTC()) >= DAILY_AI_VIDEO_LIMIT) {
    return res.status(429).json({ error: `Daily AI video cap (${DAILY_AI_VIDEO_LIMIT}) reached. Raise STUDIO_DAILY_VIDEO_LIMIT in .env if this is really you.` });
  }

  try {
    const audioUri = await extractAudioSegment(mediaPath(song.filename), segStart, segLen);
    const isImage = subject.kind === 'image';
    // Video subjects choose a tier: draft (MuseTalk) or hero (LatentSync).
    // No tier sent = legacy default model. Images always use SadTalker.
    const model = isImage ? MODEL_LIPSYNC_IMAGE
      : tier === 'hero' ? MODEL_LIPSYNC_HERO
      : tier === 'draft' ? MODEL_LIPSYNC_DRAFT
      : MODEL_LIPSYNC_VIDEO;
    const input = isImage
      ? { source_image_url: fileToDataUri(subject.filename), driven_audio_url: audioUri }
      : /musetalk/.test(model)
        ? { source_video_url: fileToDataUri(subject.filename), audio_url: audioUri }
        : { video_url: fileToDataUri(subject.filename), audio_url: audioUri }; // latentsync + sync-lipsync
    const submitted = await falSubmit(model, input);
    const job = createJob(req.userId, 'ai-video', {
      fal: {
        statusUrl: submitted.status_url,
        responseUrl: submitted.response_url,
        expect: 'video',
        label: `${subject.label} · sings`,
        characterId: subject.character_id,
        meta: { source: 'lipsync', model, fromAssetId: subject.id, songAssetId: song.id, segStart, segLen },
      },
    });
    res.status(202).json({ job: jobJson(job) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Cut + shrink a slice of a driving video (your dance recording) so the
// upload to the motion model stays small: 720p, 24fps, no audio.
function extractVideoSegment(file, start, len) {
  return new Promise((resolve, reject) => {
    const out = path.join(MEDIA_DIR, `tmp-${crypto.randomBytes(6).toString('hex')}.mp4`);
    const proc = spawn(ffmpegBin(), [
      '-ss', start.toFixed(2), '-t', len.toFixed(2), '-i', file,
      '-vf', 'scale=-2:720,fps=24', '-c:v', 'libx264', '-preset', 'fast', '-crf', '26', '-an',
      '-movflags', '+faststart', '-y', out,
    ]);
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0 || !fs.existsSync(out)) return reject(new Error('Could not cut that part of the dance video.'));
      const buf = fs.readFileSync(out);
      try { fs.unlinkSync(out); } catch (_) {}
      resolve(`data:video/mp4;base64,${buf.toString('base64')}`);
    });
  });
}

router.post('/dance', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'AI generation is not set up yet. Add FAL_KEY to server/.env (get one at fal.ai) and restart the server.' });
  }
  const { imageAssetId, videoAssetId, start, len } = req.body || {};
  const character = db.getAsset(req.userId, Number(imageAssetId));
  if (!character || character.kind !== 'image') {
    return res.status(404).json({ error: 'Pick a character image from your library first.' });
  }
  const dance = db.getAsset(req.userId, Number(videoAssetId));
  if (!dance || dance.kind !== 'video') {
    return res.status(404).json({ error: 'Pick your recorded dance video from the library.' });
  }
  const segStart = Math.max(0, Number(start) || 0);
  const segLen = Math.min(30, Math.max(2, Number(len) || 10)); // motion transfer is priced per second - keep clips short
  if (db.getVideoCount(req.userId, todayUTC()) >= DAILY_AI_VIDEO_LIMIT) {
    return res.status(429).json({ error: `Daily AI video cap (${DAILY_AI_VIDEO_LIMIT}) reached. Raise STUDIO_DAILY_VIDEO_LIMIT in .env if this is really you.` });
  }

  try {
    const drivingUri = await extractVideoSegment(mediaPath(dance.filename), segStart, segLen);
    const submitted = await falSubmit(MODEL_MOTION, {
      image_url: fileToDataUri(character.filename),
      video_url: drivingUri,
    });
    const job = createJob(req.userId, 'ai-video', {
      fal: {
        statusUrl: submitted.status_url,
        responseUrl: submitted.response_url,
        expect: 'video',
        label: `${character.label} · dance`,
        characterId: character.character_id,
        meta: { source: 'motion', model: MODEL_MOTION, fromAssetId: character.id, drivingAssetId: dance.id, segStart, segLen },
      },
    });
    res.status(202).json({ job: jobJson(job) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// LivePortrait: an approved still performs the face/eye/head motion from a
// driving clip - the image itself is never regenerated, so the look you
// approved is exactly the look that moves (canon-safe).
router.post('/liveportrait', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'AI generation is not set up yet. Paste your fal.ai key in the Turn on AI box first.' });
  }
  const { imageAssetId, videoAssetId, start, len } = req.body || {};
  const still = db.getAsset(req.userId, Number(imageAssetId));
  if (!still || still.kind !== 'image') {
    return res.status(404).json({ error: 'Pick a still image from your library first.' });
  }
  const driver = db.getAsset(req.userId, Number(videoAssetId));
  if (!driver || driver.kind !== 'video') {
    return res.status(404).json({ error: 'Pick a driving video (film your own face doing the performance).' });
  }
  const segStart = Math.max(0, Number(start) || 0);
  const segLen = Math.min(30, Math.max(1, Number(len) || 8));
  if (db.getVideoCount(req.userId, todayUTC()) >= DAILY_AI_VIDEO_LIMIT) {
    return res.status(429).json({ error: `Daily AI video cap (${DAILY_AI_VIDEO_LIMIT}) reached. Raise STUDIO_DAILY_VIDEO_LIMIT in .env if this is really you.` });
  }
  try {
    const drivingUri = await extractVideoSegment(mediaPath(driver.filename), segStart, segLen);
    const submitted = await falSubmit(MODEL_LIVEPORTRAIT, {
      image_url: fileToDataUri(still.filename),
      video_url: drivingUri,
    });
    const job = createJob(req.userId, 'ai-video', {
      fal: {
        statusUrl: submitted.status_url,
        responseUrl: submitted.response_url,
        expect: 'video',
        label: `${still.label} · live portrait`,
        characterId: still.character_id,
        meta: { source: 'liveportrait', model: MODEL_LIVEPORTRAIT, fromAssetId: still.id, drivingAssetId: driver.id, segStart, segLen },
      },
    });
    res.status(202).json({ job: jobJson(job) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* ---------------- Sequencer render ---------------- */
const TRANSITIONS = { cut: null, fade: 'fade', fadeblack: 'fadeblack' };

function eqFilter(eq) {
  if (!eq) return '';
  const b = Math.min(0.3, Math.max(-0.3, Number(eq.brightness) || 0));
  const c = Math.min(1.6, Math.max(0.6, Number(eq.contrast) || 1));
  const s = Math.min(2.5, Math.max(0, eq.saturation == null ? 1 : Number(eq.saturation)));
  if (!b && c === 1 && s === 1) return '';
  return `,eq=brightness=${b}:contrast=${c}:saturation=${s}`;
}

router.post('/render', async (req, res) => {
  const { clips, transitions, music, overlays, captions, size, fadeFromBlack, fadeToBlack, window: win, loop, name, enhance } = req.body || {};
  if (!Array.isArray(clips) || !clips.length) {
    return res.status(400).json({ error: 'Add at least one clip to the timeline.' });
  }
  if (clips.length > 120) return res.status(400).json({ error: 'Timeline is limited to 120 clips.' });
  const { W, H, target } = parseSize(size, '1920x1080');

  // --- resolve timeline items (videos with trims, stills with hold durations)
  const resolved = [];
  for (const c of clips) {
    const row = db.getAsset(req.userId, Number(c.assetId));
    if (!row || (row.kind !== 'video' && row.kind !== 'image')) {
      return res.status(404).json({ error: `Timeline item ${c.assetId} not found.` });
    }
    const file = mediaPath(row.filename);
    if (row.kind === 'image') {
      const dur = Math.min(60, Math.max(0.4, Number(c.duration) || 4));
      resolved.push({ kind: 'image', file, dur, eq: c.eq, label: row.label });
    } else {
      const start = Math.max(0, Number(c.start) || 0);
      let end = Number(c.end);
      if (!Number.isFinite(end) || end <= 0) {
        const meta = row.meta ? JSON.parse(row.meta) : {};
        end = meta.duration || (await probeMediaDuration(file));
      }
      if (!end || end <= start) {
        return res.status(400).json({ error: `Clip "${row.label}" has an invalid trim range.` });
      }
      resolved.push({ kind: 'video', file, start, end, dur: end - start, eq: c.eq, label: row.label });
    }
  }

  // --- transitions between consecutive clips
  const trans = [];
  for (let i = 0; i < resolved.length - 1; i++) {
    const t = (Array.isArray(transitions) && transitions[i]) || {};
    const type = TRANSITIONS[t.type] !== undefined ? t.type : 'cut';
    let td = Math.min(2, Math.max(0.2, Number(t.duration) || 0.5));
    // A transition can't be longer than either neighbour.
    td = Math.min(td, resolved[i].dur * 0.9, resolved[i + 1].dur * 0.9);
    trans.push({ type, td: type === 'cut' ? 0 : td });
  }
  const totalDur = resolved.reduce((s, c) => s + c.dur, 0) - trans.reduce((s, t) => s + t.td, 0);

  // --- optional cutdown window (timeline seconds)
  let winStart = 0, winEnd = totalDur;
  if (win && (Number(win.start) || Number(win.end))) {
    winStart = Math.min(Math.max(0, Number(win.start) || 0), totalDur - 0.5);
    winEnd = Math.min(totalDur, Math.max(winStart + 0.5, Number(win.end) || totalDur));
  }
  const outDur = winEnd - winStart;

  // --- music: one track, or a playlist that plays back to back (multi-song
  // videos). Old single-track project files still work via the assetId shape.
  let musicIn = null;
  if (music && (music.assetId || (Array.isArray(music.tracks) && music.tracks.length))) {
    const rawTracks = Array.isArray(music.tracks) && music.tracks.length
      ? music.tracks.slice(0, 10)
      : [{ assetId: music.assetId, start: music.start }];
    const tracks = [];
    for (const t of rawTracks) {
      const row = db.getAsset(req.userId, Number(t.assetId));
      if (!row || row.kind !== 'audio') return res.status(404).json({ error: 'Music track not found.' });
      const start = Math.max(0, Number(t.start) || 0);
      const len = Number(t.len) > 0 ? Number(t.len) : null; // null = play the whole song
      tracks.push({ file: mediaPath(row.filename), start, len });
    }
    musicIn = {
      tracks,
      volume: Math.min(2, Math.max(0, music.volume == null ? 1 : Number(music.volume))),
      fadeIn: music.fadeIn !== false,
      fadeOut: music.fadeOut !== false,
      crossfade: music.crossfade !== false && tracks.length > 1,
    };
  }

  // --- overlays (full-frame transparent PNGs the client rendered) and lyric
  // captions (same mechanics, but they never duck the music - lyrics ARE the music)
  const resolveOverlayList = (list, cap) => {
    const out = [];
    for (const o of (Array.isArray(list) ? list : []).slice(0, cap)) {
      const row = db.getAsset(req.userId, Number(o.assetId));
      if (!row || row.kind !== 'image') return null;
      const start = Math.max(0, Number(o.start) || 0);
      const end = Math.max(start + 0.2, Number(o.end) || start + 3);
      const fade = Math.min(2, Math.max(0, o.fade == null ? 0.4 : Number(o.fade)));
      if (start >= winEnd || end <= winStart) continue; // fully outside the window
      out.push({ file: mediaPath(row.filename), start, end, fade });
    }
    return out;
  };
  const ovs = resolveOverlayList(overlays, 24);
  if (!ovs) return res.status(404).json({ error: 'Overlay image not found.' });
  const caps = resolveOverlayList(captions, 120);
  if (!caps) return res.status(404).json({ error: 'Caption image not found.' });
  const allOverlays = ovs.concat(caps);

  // --- inputs: clips, then music, then overlays
  const args = [];
  for (const c of resolved) {
    if (c.kind === 'image') args.push('-loop', '1', '-t', c.dur.toFixed(3), '-i', c.file);
    else args.push('-ss', String(c.start), '-to', String(c.end), '-i', c.file);
  }
  const musicIdx = resolved.length;
  if (musicIn) for (const t of musicIn.tracks) args.push('-i', t.file);
  const ovBase = musicIdx + (musicIn ? musicIn.tracks.length : 0);
  for (const o of allOverlays) args.push('-loop', '1', '-t', (o.end + 0.2).toFixed(3), '-i', o.file);

  // --- filter graph
  const filters = [];
  // "Auto enhance": gentle color pop + sharpen per clip, plus a cinematic
  // vignette and a whisper of film grain on the finished picture.
  const enhanceClip = enhance ? ',eq=contrast=1.06:saturation=1.14,unsharp=5:5:0.5:5:5:0.0' : '';
  resolved.forEach((c, i) => {
    filters.push(
      `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},format=yuv420p${eqFilter(c.eq)}${enhanceClip},` +
      `settb=AVTB,setpts=PTS-STARTPTS[v${i}]`
    );
  });

  // Join clips left to right: plain concat on cuts, xfade on dissolves.
  let current = '[v0]';
  let joined = resolved[0].dur;
  trans.forEach((t, i) => {
    const next = `[v${i + 1}]`, out = `[j${i}]`;
    if (t.type === 'cut') {
      filters.push(`${current}${next}concat=n=2:v=1:a=0${out}`);
      joined += resolved[i + 1].dur;
    } else {
      filters.push(`${current}${next}xfade=transition=${TRANSITIONS[t.type]}:duration=${t.td.toFixed(3)}:offset=${(joined - t.td).toFixed(3)}${out}`);
      joined += resolved[i + 1].dur - t.td;
    }
    current = out;
  });

  // Overlays ride on the assembled timeline (before windowing, so their times
  // stay in timeline coordinates).
  allOverlays.forEach((o, k) => {
    const fin = o.fade > 0 ? `,fade=t=in:st=${o.start.toFixed(3)}:d=${o.fade.toFixed(3)}:alpha=1` : '';
    const fout = o.fade > 0 ? `,fade=t=out:st=${(o.end - o.fade).toFixed(3)}:d=${o.fade.toFixed(3)}:alpha=1` : '';
    filters.push(`[${ovBase + k}:v]scale=${W}:${H},format=rgba,fps=${FPS}${fin}${fout}[ov${k}]`);
    filters.push(`${current}[ov${k}]overlay=0:0:eof_action=pass:enable='between(t\\,${o.start.toFixed(3)}\\,${o.end.toFixed(3)})'[vo${k}]`);
    current = `[vo${k}]`;
  });

  // Cutdown window, then loop treatment, then the final fades so they always
  // sit at the output's edges.
  filters.push(`${current}trim=${winStart.toFixed(3)}:${winEnd.toFixed(3)},setpts=PTS-STARTPTS,settb=AVTB[vwin]`);
  let vcur = '[vwin]';
  if (loop && outDur > 2) {
    // Seamless replay: freeze the very first frame and crossfade the ending
    // into it, so the last frame of the file IS the first frame.
    const LD = Math.min(0.6, outDur / 4);
    filters.push(`[vwin]split=2[vwa][vwb]`);
    filters.push(`[vwb]trim=end_frame=1,tpad=stop_mode=clone:stop_duration=${LD.toFixed(3)},fps=${FPS},setpts=PTS-STARTPTS,settb=AVTB[vfrz]`);
    filters.push(`[vwa][vfrz]xfade=transition=fade:duration=${LD.toFixed(3)}:offset=${(outDur - LD).toFixed(3)}[vloop]`);
    vcur = '[vloop]';
  }
  const postFades = [];
  if (enhance) postFades.push(`vignette=angle=PI/5`, `noise=alls=5:allf=t+u`);
  if (fadeFromBlack) postFades.push(`fade=t=in:st=0:d=0.8`);
  if (fadeToBlack) postFades.push(`fade=t=out:st=${Math.max(0, outDur - 0.8).toFixed(3)}:d=0.8`);
  filters.push(`${vcur}${postFades.length ? postFades.join(',') : 'null'}[vout]`);

  if (musicIn) {
    // Normalize every track so they can be joined regardless of source format.
    musicIn.tracks.forEach((t, i) => {
      const trim = `atrim=start=${t.start.toFixed(3)}${t.len ? `:end=${(t.start + t.len).toFixed(3)}` : ''}`;
      filters.push(`[${musicIdx + i}:a]${trim},asetpts=PTS-STARTPTS,` +
        `aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[mt${i}]`);
    });
    let mcur = '[mt0]';
    for (let i = 1; i < musicIn.tracks.length; i++) {
      const out = `[mj${i}]`;
      if (musicIn.crossfade) filters.push(`${mcur}[mt${i}]acrossfade=d=1:c1=tri:c2=tri${out}`);
      else filters.push(`${mcur}[mt${i}]concat=n=2:v=0:a=1${out}`);
      mcur = out;
    }
    let achain = `${mcur}atrim=${winStart.toFixed(3)}:${winEnd.toFixed(3)},asetpts=PTS-STARTPTS` +
      `,volume=${musicIn.volume.toFixed(2)}`;
    // duck the music a touch while text is on screen so titles read clearly
    const duckWindows = ovs
      .map((o) => ({ s: Math.max(0, o.start - winStart), e: Math.min(outDur, o.end - winStart) }))
      .filter((w) => w.e > 0 && w.s < outDur);
    if (duckWindows.length) {
      const terms = duckWindows.map((w) => `between(t\\,${w.s.toFixed(2)}\\,${w.e.toFixed(2)})`).join('+');
      achain += `,volume='1-0.3*min(1\\,${terms})':eval=frame`;
    }
    // gentle mastering: keep levels steady and never clip
    achain += `,acompressor=threshold=-18dB:ratio=3:attack=20:release=250,alimiter=limit=0.95`;
    if (musicIn.fadeIn) achain += `,afade=t=in:st=0:d=1`;
    if (musicIn.fadeOut) achain += `,afade=t=out:st=${Math.max(0, outDur - 2).toFixed(3)}:d=2`;
    filters.push(`${achain}[aout]`);
  }

  args.push('-filter_complex', filters.join(';'), '-map', '[vout]');
  if (musicIn) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
  args.push('-t', outDur.toFixed(3), '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-movflags', '+faststart');

  const isCutdown = outDur < totalDur - 0.01;
  const label = (typeof name === 'string' && name.trim())
    ? name.trim().slice(0, 80)
    : `${isCutdown ? 'Cutdown' : 'Sequence'} ${target} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  const job = spawnFfmpegJob(req.userId, args, newFilename(req.userId, '.mp4'), outDur, label,
    { source: 'render', clips: resolved.length, cutdown: isCutdown, loop: !!loop });
  res.status(202).json({ job: jobJson(job) });
});

/* ---------------- import a song from a link ---------------- */
// Paste a Suno share link (or any direct .mp3/.wav/.m4a link) and the song
// lands in the library - no manual download/re-upload. For page links we
// scan the HTML for the audio file URL (Suno pages embed a cdn .mp3).
const AUDIO_EXT_RE = /\.(mp3|wav|m4a|aac|ogg)(\?|$)/i;

router.post('/import-song', async (req, res) => {
  const { url } = req.body || {};
  let target;
  try { target = new URL(String(url || '').trim()); } catch (_) {
    return res.status(400).json({ error: 'Paste a full link (starting with https://).' });
  }
  if (!/^https?:$/.test(target.protocol)) return res.status(400).json({ error: 'Only http(s) links work here.' });

  try {
    let audioUrl = null;
    let label = 'Imported song';
    if (AUDIO_EXT_RE.test(target.pathname)) {
      audioUrl = target.href;
      label = decodeURIComponent(path.basename(target.pathname)).replace(/\.[^.]+$/, '') || label;
    } else {
      const pageRes = await fetch(target.href, { headers: { 'User-Agent': 'Mozilla/5.0 (Studio importer)' }, redirect: 'follow' });
      if (!pageRes.ok) throw new Error(`the page answered ${pageRes.status}`);
      const html = (await pageRes.text()).slice(0, 2_000_000);
      // Suno's CDN link first, then any audio-file URL on the page
      const suno = html.match(/https?:\/\/cdn[\w.-]*\.suno\.ai\/[\w.-]+\.mp3/i);
      const any = html.match(/https?:\/\/[^"'\s\\<>]+\.(?:mp3|wav|m4a)(?:\?[^"'\s\\<>]*)?/i);
      audioUrl = (suno && suno[0]) || (any && any[0]);
      const t = html.match(/<title[^>]*>([^<]{1,120})</i);
      if (t) label = t[1].replace(/\s*[|\-–]\s*Suno.*$/i, '').trim() || label;
      if (!audioUrl) throw new Error('no audio file found on that page');
    }

    const audioRes = await fetch(audioUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Studio importer)' }, redirect: 'follow' });
    if (!audioRes.ok) throw new Error(`the audio link answered ${audioRes.status}`);
    const buf = Buffer.from(await audioRes.arrayBuffer());
    if (!buf.length) throw new Error('the audio file was empty');
    if (buf.length > 60_000_000) throw new Error('that file is over 60MB');
    const ext = (audioUrl.match(AUDIO_EXT_RE) || [null, 'mp3'])[1].toLowerCase();
    const filename = newFilename(req.userId, `.${ext === 'aac' || ext === 'ogg' ? 'mp3' : ext}`);
    fs.writeFileSync(mediaPath(filename), buf);
    const duration = await probeMediaDuration(mediaPath(filename));
    if (!duration) { try { fs.unlinkSync(mediaPath(filename)); } catch (_) {} throw new Error('that file did not play as audio'); }
    const id = db.createAsset(req.userId, 'audio', label.slice(0, 80), filename, null, { source: 'import', importedFrom: target.hostname, duration });
    res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
  } catch (err) {
    res.status(502).json({ error: `Could not import from that link (${err.message}). If it keeps failing, download the song in your browser and use the normal upload button.` });
  }
});

/* ---------------- auto-captions: transcribe a song with word timings ---------------- */
const MODEL_TRANSCRIBE = process.env.FAL_MODEL_TRANSCRIBE || 'fal-ai/wizper';
const TRANSCRIBE_RATE = Number(process.env.STUDIO_RATE_TRANSCRIBE || 0.02); // ~per song, displayed estimate

router.post('/transcribe', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'AI generation is not set up yet. Paste your fal.ai key in the Turn on AI box first.' });
  }
  const song = db.getAsset(req.userId, Number(req.body?.audioAssetId));
  if (!song || song.kind !== 'audio') return res.status(404).json({ error: 'Pick a song from your library first.' });
  try {
    const buf = fs.readFileSync(mediaPath(song.filename));
    let audioUrl;
    try {
      audioUrl = await falUploadFile(buf, path.basename(song.filename), 'audio/mpeg');
    } catch (_) {
      if (buf.length > 9_000_000) throw new Error('could not upload the song to fal and it is too large to send inline');
      audioUrl = `data:audio/mpeg;base64,${buf.toString('base64')}`;
    }
    const submitted = await falSubmit(MODEL_TRANSCRIBE, {
      audio_url: audioUrl,
      task: 'transcribe',
      chunk_level: 'segment',
    });
    const job = createJob(req.userId, 'transcribe', {
      fal: {
        statusUrl: submitted.status_url,
        responseUrl: submitted.response_url,
        expect: 'transcript',
        label: `Transcribe: ${song.label}`,
      },
    });
    res.status(202).json({ job: jobJson(job) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* ---------------- storyboard: lyric sheet -> scene-by-scene prompts ---------------- */
const STOPWORDS = new Set(('the a an and or but so to of in on at for with from by is are was were ' +
  'be been being i you he she it we they my your his her its our their me him them this that these those ' +
  'do does did not no yes as if then than up down out off over under again just now here there when will ' +
  'would can could should shall may might must ooh oh yeah la na').split(' '));
const SHOT_TYPES = ['wide establishing shot', 'close-up shot', 'medium shot', 'over-the-shoulder shot',
  'silhouette shot', 'slow aerial shot', 'tracking shot', 'intimate detail shot'];
const SHOT_MOODS = ['golden hour light', 'moody blue night', 'soft misty morning', 'neon-lit dusk',
  'warm candlelight', 'stormy overcast sky', 'sunlit haze', 'cool moonlight'];
const MAX_SCENES = 24;

function splitStanzas(lyrics) {
  let stanzas = lyrics.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (stanzas.length < 2) {
    // no blank lines in the pasted sheet - fall back to fixed-size chunks
    const lines = lyrics.split('\n').map((l) => l.trim()).filter(Boolean);
    stanzas = [];
    for (let i = 0; i < lines.length; i += 4) stanzas.push(lines.slice(i, i + 4).join('\n'));
  }
  return stanzas.slice(0, MAX_SCENES);
}

function keywordsFrom(text) {
  const seen = new Set();
  const words = text.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (w.length > 3 && !STOPWORDS.has(w) && !seen.has(w)) seen.add(w);
    if (seen.size >= 6) break;
  }
  return [...seen];
}

// Structure detection: explicit [Chorus]/[Verse]/... tags win; otherwise a
// stanza that repeats (near-)verbatim is the chorus, short first/last stanzas
// read as intro/outro, and a unique late stanza after 2+ chorus hits is the
// bridge. Free, local, no AI.
function normalizeStanza(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function detectSections(stanzas) {
  const tagRe = /^\s*[\[(]?\s*(intro|verse|chorus|hook|bridge|outro|pre[- ]?chorus|refrain)\s*\d*\s*[\])]?\s*:?\s*$/i;
  const cleaned = [];
  const tagged = [];
  for (const s of stanzas) {
    const lines = s.split('\n');
    const m = lines[0].match(tagRe);
    if (m) {
      const tag = m[1].toLowerCase().replace(/[- ]/g, '');
      tagged.push(tag === 'hook' || tag === 'refrain' ? 'chorus' : tag === 'prechorus' ? 'verse' : tag);
      cleaned.push(lines.slice(1).join('\n').trim() || s);
    } else {
      tagged.push(null);
      cleaned.push(s);
    }
  }
  // repetition -> chorus
  const counts = {};
  for (const s of cleaned) { const n = normalizeStanza(s); counts[n] = (counts[n] || 0) + 1; }
  const sections = cleaned.map((s, i) => {
    if (tagged[i]) return tagged[i];
    if (counts[normalizeStanza(s)] >= 2) return 'chorus';
    return null;
  });
  let chorusSeen = 0;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i] === 'chorus') { chorusSeen++; continue; }
    if (sections[i]) continue;
    const lineCount = cleaned[i].split('\n').filter(Boolean).length;
    if (i === 0 && lineCount <= 2) sections[i] = 'intro';
    else if (i === sections.length - 1 && lineCount <= 2) sections[i] = 'outro';
    else if (chorusSeen >= 2 && i >= sections.length - 3 && sections.lastIndexOf('chorus') > -1 && i > sections.lastIndexOf('bridge')) sections[i] = 'bridge';
    else sections[i] = 'verse';
  }
  // only one stanza can be the bridge - later unresolved ones become verses
  let bridgeUsed = false;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i] === 'bridge') {
      if (bridgeUsed) sections[i] = 'verse';
      bridgeUsed = true;
    }
  }
  return { cleaned, sections };
}

// Per-section energy: choruses get big dynamic coverage, verses stay
// grounded and intimate, the bridge goes moody/abstract, intro/outro bookend.
const SECTION_STYLE = {
  intro: { shots: ['wide establishing shot'], energy: 'calm, atmospheric, scene-setting' },
  verse: { shots: ['medium shot', 'close-up shot', 'over-the-shoulder shot', 'intimate detail shot'], energy: 'grounded, personal, natural movement' },
  chorus: { shots: ['dynamic wide shot', 'sweeping crane shot', 'low-angle hero shot', 'fast tracking shot'], energy: 'high energy, dramatic motion, bold and cinematic' },
  bridge: { shots: ['silhouette shot', 'slow aerial shot', 'abstract reflection shot'], energy: 'moody, dreamlike, tension building' },
  outro: { shots: ['slow pull-back closing shot'], energy: 'quiet resolution, fading light' },
};

function storyboardHeuristic(lyrics, title, artist, style) {
  const stanzas = splitStanzas(lyrics);
  const { cleaned, sections } = detectSections(stanzas);
  const perSectionCount = {};
  return cleaned.map((lines, i) => {
    const section = sections[i];
    const spec = SECTION_STYLE[section] || SECTION_STYLE.verse;
    const nth = perSectionCount[section] = (perSectionCount[section] || 0) + 1;
    const kws = keywordsFrom(lines);
    const shot = spec.shots[(nth - 1) % spec.shots.length];
    const mood = SHOT_MOODS[i % SHOT_MOODS.length];
    const subject = kws.length ? kws.slice(0, 3).join(' and ') : (title || 'a quiet moment');
    const prompt = `A ${shot} of ${subject}, ${mood}, ${spec.energy}${style ? `, ${style}` : ''}, cinematic film still, consistent character and setting`;
    return { index: i, lines, prompt, section };
  });
}

async function storyboardWithClaude(lyrics, title, artist, style) {
  const system = `You are a music video director. Given song lyrics, split them into filmable scenes ` +
    `(usually one scene per verse/chorus/bridge stanza) and write one vivid, concrete, filmable image-generation ` +
    `prompt per scene (15-30 words, visual only - camera shot type, subject, setting, lighting, mood; no song ` +
    `metadata, no quotes around lyrics). Label each scene's song section and match the visual energy to it: ` +
    `choruses get big dynamic high-energy coverage (wide/crane/low-angle, motion), verses stay grounded and ` +
    `intimate (medium/close-up), the bridge goes moody or abstract, intro/outro are calm bookends. Keep a ` +
    `consistent visual world across scenes unless the lyrics clearly change setting. Reply with ONLY a JSON ` +
    `array, no other text, shaped exactly like: ` +
    `[{"lines":"<the lyric lines for this scene, verbatim>","section":"<intro|verse|chorus|bridge|outro>","prompt":"<image prompt>"}, ...]. Make at most ${MAX_SCENES} scenes.`;
  const userMsg = [
    title ? `Song title: ${title}` : null,
    artist ? `Artist: ${artist}` : null,
    style ? `Visual style to apply throughout: ${style}` : null,
    `Lyrics:\n${lyrics}`,
  ].filter(Boolean).join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL, max_tokens: 3000, system,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data && data.error && data.error.message) || 'Claude request failed.');
  const text = (data.content || []).map((b) => b.text || '').join('');
  const jsonStart = text.indexOf('[');
  const jsonEnd = text.lastIndexOf(']');
  if (jsonStart === -1 || jsonEnd === -1) throw new Error('Could not parse a scene list from the response.');
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('Empty scene list.');
  return parsed.slice(0, MAX_SCENES).map((s, i) => ({
    index: i,
    lines: String(s.lines || '').slice(0, 500),
    section: ['intro', 'verse', 'chorus', 'bridge', 'outro'].includes(String(s.section || '').toLowerCase())
      ? String(s.section).toLowerCase() : 'verse',
    prompt: String(s.prompt || '').slice(0, 400) || `cinematic film still${style ? `, ${style}` : ''}`,
  }));
}

router.post('/storyboard', async (req, res) => {
  const { lyrics, title, artist, style } = req.body || {};
  if (typeof lyrics !== 'string' || !lyrics.trim()) {
    return res.status(400).json({ error: 'Paste your lyric sheet first.' });
  }
  const cleanLyrics = lyrics.trim().slice(0, 8000);
  const cleanStyle = typeof style === 'string' ? style.trim().slice(0, 200) : '';
  const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 100) : '';
  const cleanArtist = typeof artist === 'string' ? artist.trim().slice(0, 100) : '';

  if (ANTHROPIC_API_KEY) {
    try {
      const scenes = await storyboardWithClaude(cleanLyrics, cleanTitle, cleanArtist, cleanStyle);
      return res.json({ scenes, method: 'ai' });
    } catch (err) {
      // Fall through to the free local splitter rather than failing the request.
    }
  }
  try {
    const scenes = storyboardHeuristic(cleanLyrics, cleanTitle, cleanArtist, cleanStyle);
    res.json({ scenes, method: 'local' });
  } catch (err) {
    res.status(500).json({ error: 'Could not build a storyboard from those lyrics.' });
  }
});

/* ---------------- thumbnails ---------------- */
router.post('/thumbnail', (req, res) => {
  const { assetId, time } = req.body || {};
  const video = db.getAsset(req.userId, Number(assetId));
  if (!video || video.kind !== 'video') return res.status(404).json({ error: 'Video not found.' });
  const t = Math.max(0, Number(time) || 0);
  const outFile = newFilename(req.userId, '.png');
  const proc = spawn(ffmpegBin(), [
    '-ss', t.toFixed(2), '-i', mediaPath(video.filename), '-frames:v', '1', '-y', mediaPath(outFile),
  ]);
  proc.on('error', () => res.status(500).json({ error: 'Could not start ffmpeg.' }));
  proc.on('close', (code) => {
    if (res.headersSent) return;
    if (code !== 0 || !fs.existsSync(mediaPath(outFile))) {
      return res.status(500).json({ error: 'Could not grab that frame.' });
    }
    const id = db.createAsset(req.userId, 'image', `${video.label} thumb @${t.toFixed(0)}s`, outFile, null,
      { source: 'thumbnail', overlay: true }); // overlay flag keeps thumbs out of the pickers
    res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
  });
});

/* ---------------- 2x upscale (sharp resize - honest, not ESRGAN) ---------------- */
router.post('/upscale', (req, res) => {
  const { assetId } = req.body || {};
  const img = db.getAsset(req.userId, Number(assetId));
  if (!img || img.kind !== 'image') return res.status(404).json({ error: 'Pick an image to upscale.' });
  const outFile = newFilename(req.userId, '.png');
  const proc = spawn(ffmpegBin(), [
    '-i', mediaPath(img.filename),
    '-vf', 'scale=iw*2:ih*2:flags=lanczos,unsharp=5:5:0.8:3:3:0.4',
    '-y', mediaPath(outFile),
  ]);
  proc.on('error', () => res.status(500).json({ error: 'Could not start ffmpeg.' }));
  proc.on('close', (code) => {
    if (res.headersSent) return;
    if (code !== 0 || !fs.existsSync(mediaPath(outFile))) {
      return res.status(500).json({ error: 'Upscale failed.' });
    }
    const id = db.createAsset(req.userId, 'image', `${img.label} 2x`, outFile, img.character_id,
      { source: 'upscale', fromAssetId: img.id });
    res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
  });
});

/* ---------------- campaign export ---------------- */
function csvCell(s) {
  return `"${String(s == null ? '' : s).replace(/"/g, '""')}"`;
}

router.post('/campaign', async (req, res) => {
  const { name, posts, thumbnails, info } = req.body || {};
  const cleanName = (typeof name === 'string' && name.trim() ? name.trim() : 'campaign')
    .replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 50) || 'campaign';
  if (!Array.isArray(posts) || !posts.length) {
    return res.status(400).json({ error: 'A campaign needs at least one post.' });
  }
  if (posts.length > 40) return res.status(400).json({ error: 'Campaigns are limited to 40 posts.' });

  const resolvedPosts = [];
  for (const p of posts) {
    const row = db.getAsset(req.userId, Number(p.assetId));
    if (!row || row.kind !== 'video') return res.status(404).json({ error: `Post video ${p.assetId} not found.` });
    resolvedPosts.push({
      file: mediaPath(row.filename),
      mediaName: `${row.label.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}.mp4`,
      platform: String(p.platform || 'any').slice(0, 30),
      caption: String(p.caption || '').slice(0, 5000),
      scheduledAt: typeof p.scheduledAt === 'string' ? p.scheduledAt.slice(0, 40) : '',
    });
  }
  const resolvedThumbs = [];
  for (const id of (Array.isArray(thumbnails) ? thumbnails : []).slice(0, 12)) {
    const row = db.getAsset(req.userId, Number(id));
    if (row && row.kind === 'image') resolvedThumbs.push({ file: mediaPath(row.filename), ext: path.extname(row.filename) });
  }

  try {
    const archiverMod = require('archiver');
    const zipFile = newFilename(req.userId, '.zip');
    const output = fs.createWriteStream(mediaPath(zipFile));
    // archiver v8 exports classes; older versions export a factory function.
    // Level 0 (store) because mp4/png don't compress - packing stays fast.
    const archive = typeof archiverMod === 'function'
      ? archiverMod('zip', { zlib: { level: 0 } })
      : new archiverMod.ZipArchive({ zlib: { level: 0 } });
    const done = new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });
    archive.pipe(output);

    const root = cleanName;
    const seenNames = new Set();
    resolvedPosts.forEach((p) => {
      // keep filenames unique inside the zip
      let n = p.mediaName, bump = 2;
      while (seenNames.has(n)) n = p.mediaName.replace(/\.mp4$/, `-${bump++}.mp4`);
      seenNames.add(n);
      p.mediaName = n;
      archive.file(p.file, { name: `${root}/videos/${n}` });
    });
    resolvedThumbs.forEach((t, i) => archive.file(t.file, { name: `${root}/thumbnails/thumbnail-${i + 1}${t.ext}` }));

    const csv = ['platform,media_file,scheduled_at,caption']
      .concat(resolvedPosts.map((p) =>
        [csvCell(p.platform), csvCell(`videos/${p.mediaName}`), csvCell(p.scheduledAt), csvCell(p.caption)].join(',')))
      .join('\r\n');
    archive.append(csv, { name: `${root}/posts.csv` });

    const campaignJson = {
      version: 1,
      name: cleanName,
      createdAt: new Date().toISOString(),
      info: info && typeof info === 'object' ? info : {},
      posts: resolvedPosts.map((p) => ({
        platform: p.platform, mediaFile: `videos/${p.mediaName}`,
        scheduledAt: p.scheduledAt || null, caption: p.caption,
      })),
      thumbnails: resolvedThumbs.map((_, i) => `thumbnails/thumbnail-${i + 1}${resolvedThumbs[i].ext}`),
      // Reserved for the future Buffer API integration - this file is the
      // machine-readable version of posts.csv.
      buffer: { uploaded: false, profileIds: [] },
    };
    archive.append(JSON.stringify(campaignJson, null, 2), { name: `${root}/campaign.json` });

    archive.append(
      `${cleanName} - campaign package\n` +
      `================================\n\n` +
      `videos/       every video in this campaign, named per post\n` +
      `thumbnails/   cover image candidates for YouTube/posts\n` +
      `posts.csv     one row per post: platform, file, suggested time, caption\n` +
      `campaign.json machine-readable version (used for Buffer API upload later)\n\n` +
      `To publish with Buffer today:\n` +
      `1. Open buffer.com -> Create Post\n` +
      `2. Drag in the video for the post, paste its caption from posts.csv\n` +
      `3. Set the suggested time (or your own) and add to queue\n` +
      `4. Repeat down the CSV - everything is pre-written, it takes minutes\n`,
      { name: `${root}/README.txt` });

    await archive.finalize();
    await done;
    const id = db.createAsset(req.userId, 'archive', `${cleanName} campaign`, zipFile, null,
      { source: 'campaign', posts: resolvedPosts.length, thumbnails: resolvedThumbs.length });
    res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
  } catch (err) {
    res.status(500).json({ error: `Could not build the campaign zip: ${err.message}` });
  }
});

/* ---------------- one-click app update ---------------- */
// The app updates itself from GitHub: download the branch ZIP, overlay the new
// code onto the install folder, refresh dependencies. Your data survives by
// construction - .env, data.sqlite and media/ are gitignored so they are never
// inside the ZIP being copied over.
const APP_ROOT = path.join(__dirname, '..', '..'); // the folder holding the launchers, Studio and TurnSomeDayIntoOneday
const UPDATE_REPO = process.env.APP_UPDATE_REPO || 'Jacqueslm/app';
const UPDATE_BRANCH = process.env.APP_UPDATE_BRANCH || 'claude/vibe-code-uwxxlk';
// A private repo needs a token (GitHub → Settings → Developer settings →
// fine-grained PAT with Contents: read on this repo). Public repos need none.
const UPDATE_TOKEN = (process.env.APP_UPDATE_TOKEN || '').trim();
const GH_HEADERS = {
  'User-Agent': 'tsid-studio-updater',
  ...(UPDATE_TOKEN ? { Authorization: `Bearer ${UPDATE_TOKEN}` } : {}),
};
// The API zipball endpoint (unlike codeload) honors the Authorization header,
// so the same URL serves both public and token-carrying private installs.
const UPDATE_ZIP_URL = process.env.APP_UPDATE_ZIP_URL // test override
  || `https://api.github.com/repos/${UPDATE_REPO}/zipball/${encodeURIComponent(UPDATE_BRANCH)}`;
const UPDATE_STATE_FILE = path.join(__dirname, 'update-state.json');
// The running launcher scripts are skipped during the overlay copy: overwriting
// a batch file mid-run corrupts its execution on Windows.
const UPDATE_SKIP = new Set([
  'Start My App.bat', 'Start My App.command', 'start-app.sh',
  'Start Studio.bat', 'Start Studio.command', 'start-studio.sh', '.git',
]);

function runCmd(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    // No shell: cmd.exe re-splits arguments on spaces, which breaks temp paths
    // like C:\Users\First Last\AppData\... . Windows-only .cmd shims (npm) are
    // wrapped in `cmd /c` by the caller instead.
    const proc = spawn(cmd, args, opts);
    let err = '';
    proc.stderr?.on('data', (c) => { err = (err + c.toString()).slice(-800); });
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err || `${cmd} exited ${code}`))));
  });
}

async function fetchLatestCommit() {
  const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/commits/${encodeURIComponent(UPDATE_BRANCH)}`, {
    headers: { ...GH_HEADERS, Accept: 'application/vnd.github+json' },
  });
  const data = await res.json();
  if (!res.ok) {
    // GitHub answers 404 for private repos when no (valid) token is sent.
    if (res.status === 404 && !UPDATE_TOKEN) throw new Error('GitHub says the app repo is not visible. If the repo is private, add APP_UPDATE_TOKEN to Studio/server/.env (or make the repo public).');
    throw new Error(data.message || 'GitHub did not answer.');
  }
  return { sha: data.sha, date: data.commit?.committer?.date || null };
}

router.get('/update/check', async (req, res) => {
  let current = null;
  try { current = JSON.parse(fs.readFileSync(UPDATE_STATE_FILE, 'utf8')); } catch (_) {}
  try {
    const latest = await fetchLatestCommit();
    res.json({ latest, current, upToDate: Boolean(current && current.sha === latest.sha) });
  } catch (err) {
    res.status(502).json({ error: `Could not check GitHub: ${err.message}`, current });
  }
});

router.post('/update', async (req, res) => {
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-update-'));
  try {
    // 1. download the latest code
    const zipRes = await fetch(UPDATE_ZIP_URL, { headers: GH_HEADERS });
    if (zipRes.status === 404 && !UPDATE_TOKEN) throw new Error('download blocked - GitHub says the app repo is not visible. If the repo is private, add APP_UPDATE_TOKEN to Studio/server/.env (or make the repo public)');
    if (!zipRes.ok) throw new Error(`Download failed (${zipRes.status}).`);
    const zipPath = path.join(tmp, 'update.zip');
    fs.writeFileSync(zipPath, Buffer.from(await zipRes.arrayBuffer()));

    // 2. extract (tar reads zips on Windows 10+/mac; unzip covers most Linux)
    try { await runCmd('tar', ['-xf', zipPath, '-C', tmp]); }
    catch (_) { await runCmd('unzip', ['-q', zipPath, '-d', tmp]); }
    const rootName = fs.readdirSync(tmp).find((n) => n !== 'update.zip' && fs.statSync(path.join(tmp, n)).isDirectory());
    if (!rootName) throw new Error('The downloaded ZIP looked empty.');
    const src = path.join(tmp, rootName);

    // 3. overlay the new code onto the install (data files aren't in the ZIP)
    for (const entry of fs.readdirSync(src)) {
      if (UPDATE_SKIP.has(entry)) continue;
      fs.cpSync(path.join(src, entry), path.join(APP_ROOT, entry), { recursive: true, force: true });
    }

    // 4. refresh dependencies (fast no-op when nothing changed)
    await (process.platform === 'win32'
      ? runCmd('cmd', ['/c', 'npm', 'install', '--no-audit', '--no-fund'], { cwd: __dirname })
      : runCmd('npm', ['install', '--no-audit', '--no-fund'], { cwd: __dirname }));

    // 5. remember what we're on now
    let state = { sha: 'unknown', date: new Date().toISOString() };
    try { state = await fetchLatestCommit(); } catch (_) {}
    fs.writeFileSync(UPDATE_STATE_FILE, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));

    res.json({ ok: true, message: 'Update installed! Close the black window, then double-click Start My App again.' });
  } catch (err) {
    res.status(500).json({ error: `Update failed: ${err.message}. Your app is untouched - you can also update by re-downloading the ZIP.` });
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
});

/* ---------------- job polling ---------------- */
router.get('/jobs/:id', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.userId !== req.userId) return res.status(404).json({ error: 'Job not found.' });
  if (job.fal) await refreshFalJob(job);
  res.json({ job: jobJson(job) });
});

module.exports = { router, deleteUserAssets };
