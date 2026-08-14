// Studio: asset library, character consistency pipeline (fal.ai), and the
// ffmpeg Sequencer that stitches clips + a music track into finished videos.
//
// Everything AI-related is gated on FAL_KEY the same way Nova chat gates on
// ANTHROPIC_API_KEY: without a key the endpoints return 503 and the client
// simply hides those features. Uploads and the Sequencer work with no keys.
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const express = require('express');

const db = require('./db');
const { requireAuth } = require('./auth');

let FAL_KEY = process.env.FAL_KEY; // mutable: can be set from the app's Settings without a restart
let PEXELS_KEY = process.env.PEXELS_KEY; // free stock b-roll key, also settable from the app
let BUFFER_KEY = process.env.BUFFER_KEY; // Buffer personal API key, settable from the Post tab
const FAL_QUEUE_BASE = process.env.FAL_QUEUE_BASE || 'https://queue.fal.run'; // overridable for tests
const PEXELS_BASE = process.env.PEXELS_BASE || 'https://api.pexels.com'; // overridable for tests
const ENV_PATH = path.join(__dirname, '.env');

// Optional: the same Anthropic key that powers Nova chat (server.js) sharpens
// storyboard prompts. Neither this feature nor Nova requires the other.
let ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // mutable: settable from the app
const ANTHROPIC_MODEL = 'claude-sonnet-5';
const ANTHROPIC_BASE = process.env.ANTHROPIC_BASE || 'https://api.anthropic.com'; // overridable for tests

// Persist (or remove) a key in server/.env so it survives restarts, keeping
// every other line (PORT, SESSION_SECRET, ...) untouched.
function persistEnvKey(name, value) {
  let lines = [];
  try { lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/); } catch (_) {}
  lines = lines.filter((l) => !l.startsWith(`${name}=`) && l.trim() !== '');
  if (value) lines.push(`${name}=${value}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n');
}
function persistFalKey(key) { persistEnvKey('FAL_KEY', key); }

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
// OpenAI's image model, served through fal - so it uses the same fal key, the
// same job queue, the same receipts and the same spend cap as everything else.
// No second provider, no second bill. GPT-Image is the strongest model here for
// text inside an image (posters, signs, titles) and for literal prompt-following.
// Note the openai/ prefix: GPT-Image 2 lives there on fal, not under fal-ai/
// like the 1.5 endpoints. Override to 'fal-ai/gpt-image-1.5' to drop back.
const MODEL_IMAGE_GPT = process.env.FAL_MODEL_IMAGE_GPT || 'openai/gpt-image-2';
const MODEL_IMAGE_GPT_EDIT = process.env.FAL_MODEL_IMAGE_GPT_EDIT || 'openai/gpt-image-2/edit';
const MODEL_LORA_IMAGE = process.env.FAL_MODEL_LORA_IMAGE || 'fal-ai/flux-lora';
// Image-to-video quality tiers with price estimates (USD/second, audio off).
// Rates are a snapshot - fal has no public pricing API - so they're shown in
// the app as estimates with an as-of date, and every id/rate is env-overridable.
const PRICES_AS_OF = 'July 2026';
const VIDEO_TIERS = {
  // Rates updated to match real fal billing (Jul 2026 invoice): Seedance and
  // Kling both cost far more than the old placeholder rates, which under-quoted
  // by 2-3x and led to surprise overspend. These are conservative (round-up)
  // per-second estimates; always confirm against your live fal balance.
  // Tiers re-pointed to the genuinely cost-effective models (confirmed fal
  // pricing, Jul 2026): Wan 2.5 is the cheapest good model, Kling 2.5 Turbo is
  // the value pick, Seedance is premium and reserved for hero shots. The old
  // setup had Seedance (the priciest) mislabeled as "Draft", which is what
  // caused the surprise overspend. All overridable via FAL_MODEL_*/STUDIO_RATE_*.
  // Wan 2.5 is priced by resolution - $0.05/s at 480p, $0.10/s at 720p,
  // $0.15/s at 1080p - and fal DEFAULTS TO 1080p when no resolution is sent.
  // Studio sent none, so every "Draft" clip was billed at 1080p: a 5s clip cost
  // $0.75 against a $0.25 button. The resolution is now always stated, and the
  // rate is looked up from it, so the button and the bill cannot drift apart.
  draft: {
    label: 'Draft', desc: 'Wan 2.5 480p - cheapest way to test a shot',
    model: process.env.FAL_MODEL_I2V_DRAFT || 'fal-ai/wan-25-preview/image-to-video',
    resolution: process.env.STUDIO_WAN_RESOLUTION || '480p',
    rate: Number(process.env.STUDIO_RATE_DRAFT || 0)
      || ({ '480p': 0.05, '720p': 0.10, '1080p': 0.15 }[process.env.STUDIO_WAN_RESOLUTION || '480p'] || 0.15),
  },
  standard: {
    label: 'Standard', desc: 'Kling 2.5 Turbo - great quality',
    model: process.env.FAL_MODEL_IMAGE_TO_VIDEO || 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    rate: Number(process.env.STUDIO_RATE_STANDARD || 0.07),
  },
  best: {
    label: 'Best', desc: 'Seedance - premium hero shots',
    model: process.env.FAL_MODEL_I2V_BEST || 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
    rate: Number(process.env.STUDIO_RATE_BEST || 0.24),
  },
};
// Reference-to-video: when you attach character reference photos to an Animate,
// we switch to a model that keeps the character consistent using those refs
// (Vidu Q1 supports up to 7 reference images via reference_image_urls). Priced
// per clip (round-up estimate); shown on the button and guarded by the cap.
const MODEL_I2V_REF = process.env.FAL_MODEL_I2V_REF || 'fal-ai/vidu/q1/reference-to-video';
const ANIM_REF_RATE = Number(process.env.STUDIO_RATE_ANIM_REF || 0.40); // per clip, conservative
const IMAGE_RATE = Number(process.env.STUDIO_RATE_IMAGE || 0.035); // Flux ballpark per image
// FLUX.2 pro edit bills $0.03 for the first output MP + $0.015 per extra MP of
// input and output; ~2MP output + 3-4 downscaled reference photos lands here.
const CHARACTER_IMAGE_RATE = Number(process.env.STUDIO_RATE_CHARACTER_IMAGE || 0.09);
const IMAGE_BEST_RATE = Number(process.env.STUDIO_RATE_IMAGE_BEST || 0.15); // Nano Banana Pro flat per image
// GPT-Image 2 on fal bills per output image by quality tier, PLUS token charges
// layered on every request. Medium lands at $0.034 (1:1) to $0.051 (portrait),
// landscape $0.050 - and Studio defaults to landscape. Quoted at $0.07 to cover
// the top size plus tokens, round-up so the real bill is never a surprise.
const IMAGE_GPT_RATE = Number(process.env.STUDIO_RATE_IMAGE_GPT || 0.07);
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
// Dance Transfer tiers (Viggle isn't on fal - the draft tier is Wan).
// Kling motion-control takes image_url + video_url + character_orientation.
const MODEL_MOTION_STD = process.env.FAL_MODEL_MOTION_STD || 'fal-ai/kling-video/v2.6/standard/motion-control';
const MODEL_MOTION_HERO = process.env.FAL_MODEL_MOTION_HERO || 'fal-ai/kling-video/v3/pro/motion-control';
// Dance rates verified against fal Jul 2026, quoted per OUTPUT second and rounded
// UP so the real bill is never a surprise (this is what caused the overspend before):
//  - Draft = wan-animate. fal bills it per 16-frame "video second," so a 720p clip
//    from ~30fps source lands near $0.15/output-sec, not the naive $0.05.
//  - Standard = kling v2.6 standard motion-control (~$0.13/sec by credit math).
//  - Hero = kling v3 pro motion-control, listed at $0.168/sec.
const DANCE_DRAFT_RATE = Number(process.env.STUDIO_RATE_DANCE_DRAFT || 0.15);
const DANCE_STD_RATE = Number(process.env.STUDIO_RATE_DANCE_STD || 0.13);
const DANCE_HERO_RATE = Number(process.env.STUDIO_RATE_DANCE_HERO || 0.17);

// Server-side daily caps so a runaway loop (or, later, a public user) can't
// silently drain the fal.ai balance. Generous for personal use; tune in .env.
const DAILY_AI_IMAGE_LIMIT = Number(process.env.STUDIO_DAILY_IMAGE_LIMIT || 300);
const DAILY_AI_VIDEO_LIMIT = Number(process.env.STUDIO_DAILY_VIDEO_LIMIT || 60);
// Hard DOLLAR cap: once today's estimated AI spend hits this, Studio refuses to
// start any new paid generation until tomorrow (UTC). 0 = off. Set from the app;
// this is the "runaway spend is impossible" guarantee.
let DAILY_USD_CAP = Number(process.env.STUDIO_DAILY_USD_CAP || 0);

// Estimated cost of a single paid action, from the same verified rates shown on
// the buttons. Used by both the spend ledger and the dollar cap. Round-up bias.
function estActionCost(kind, opts = {}) {
  const s = Number(opts.seconds) || 5;
  switch (kind) {
    case 'video':
      if (opts.tier === 'reference') return ANIM_REF_RATE; // flat per-clip for character-lock
      return (VIDEO_TIERS[opts.tier] || VIDEO_TIERS.standard).rate * s;
    case 'image': return (opts.characterId ? CHARACTER_IMAGE_RATE : IMAGE_RATE) * (Number(opts.count) || 1);
    case 'imageBest': return IMAGE_BEST_RATE * (Number(opts.count) || 1);
    case 'imageGpt': return IMAGE_GPT_RATE * (Number(opts.count) || 1);
    case 'lora': return LORA_TRAIN_STEPS * LORA_STEP_RATE;
    case 'dance': return ({ draft: DANCE_DRAFT_RATE, standard: DANCE_STD_RATE, hero: DANCE_HERO_RATE }[opts.tier] || DANCE_STD_RATE) * s;
    case 'sing': return opts.tier === 'hero' ? SING_HERO_RATE : SING_DRAFT_RATE;
    case 'liveportrait': return LIVEPORTRAIT_RATE;
    case 'voice': return (opts.emotion ? VOICE_EMO_RATE : VOICE_RATE) * Math.max(1, (Number(opts.chars) || 0) / 1000);
    case 'transcript': return TRANSCRIBE_RATE;
    case 'qc': return QC_RATE;
    default: return 0;
  }
}

// Sum of today's (UTC) estimated spend from the durable receipts. Failed
// generations aren't billed, so they don't count.
function todaySpendUSD(userId) {
  const day = todayUTC();
  let total = 0;
  for (const r of db.getFalReceipts(userId, 500)) {
    if (r.status === 'error') continue;
    if (String(r.created_at || '').slice(0, 10) !== day) continue;
    let meta = {}; try { meta = JSON.parse(r.meta || 'null') || {}; } catch (_) {}
    total += estActionCost(r.expect, { tier: r.tier, seconds: meta.seconds, characterId: r.character_id });
  }
  return total;
}

// Returns an error string if starting an action costing `addUSD` would push
// today's spend over the cap, else null. No cap set → always allowed.
function overDailyCap(userId, addUSD) {
  if (!(DAILY_USD_CAP > 0)) return null;
  const spent = todaySpendUSD(userId);
  if (spent + addUSD > DAILY_USD_CAP + 1e-9) {
    return `Daily spend cap reached — you set $${DAILY_USD_CAP.toFixed(2)}/day and today is at ~$${spent.toFixed(2)}. This action (~$${addUSD.toFixed(2)}) would go over. Raise or clear the cap in Recover paid clips → Daily spend cap, or try again tomorrow.`;
  }
  return null;
}

const MEDIA_DIR = path.join(__dirname, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const EXT_BY_KIND = {
  image: new Set(['.png', '.jpg', '.jpeg', '.webp']),
  video: new Set(['.mp4', '.webm', '.mov', '.m4v']),
  // .webm is here for browser voice recordings: MediaRecorder gives opus in a
  // webm container and nothing else, so refusing it would mean "record your
  // own voice" could never file what it just recorded.
  audio: new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.webm']),
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
    // The library row exists in the database but the file itself can go
    // missing underneath us - OneDrive evicting it, a folder moved, a
    // half-finished copy. Saying so here lets the page gray the item out
    // instead of firing a request that can only fail.
    missing: !fs.existsSync(mediaPath(row.filename)) || undefined,
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

// Read pixel dimensions the same stderr-parsing way (no ffprobe dependency).
// Returns {w,h} or null. Grabs the first "<W>x<H>" that appears on a Video line.
function probeDimensions(file) {
  return new Promise((resolve) => {
    let out = '';
    const proc = spawn(ffmpegBin(), ['-i', file]);
    proc.stderr.on('data', (c) => { out += c.toString(); });
    proc.on('close', () => {
      const line = (out.match(/Stream #\d+:\d+.*Video:.*/) || [null])[0];
      const m = line && line.match(/(\d{2,5})x(\d{2,5})/);
      resolve(m ? { w: Number(m[1]), h: Number(m[2]) } : null);
    });
    proc.on('error', () => resolve(null));
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
  const job = { id, userId, type, status: 'running', progress: 0, error: null, assetId: null, startedAt: Date.now(), ...extra };
  jobs.set(id, job);
  // Durable receipt for every fal (paid) submission, so a clip we're billed for
  // can always be recovered later — even after a restart wipes this in-memory job.
  if (job.fal && job.fal.statusUrl && job.fal.responseUrl) {
    try {
      const requestId = (String(job.fal.responseUrl).match(/requests\/([^/?]+)/) || [])[1] || null;
      job._receiptId = db.logFalReceipt(userId, {
        requestId,
        statusUrl: job.fal.statusUrl,
        responseUrl: job.fal.responseUrl,
        expect: job.fal.expect,
        label: job.fal.label,
        characterId: job.fal.characterId,
        model: job.fal.meta && job.fal.meta.model,
        tier: job.fal.meta && job.fal.meta.tier,
        meta: job.fal.meta,
      });
    } catch (_) { /* logging must never block a generation */ }
  }
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
// opts.permanent asks fal never to expire the object. Everything else here
// uploads a throwaway input for one job, but a file handed to Buffer has to
// still be there when the post publishes days later - an expired link would
// mean a post that silently goes out broken.
async function falUploadFile(buf, filename, contentType, opts) {
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
      ...(opts?.permanent
        ? { 'X-Fal-Object-Lifecycle-Preference': JSON.stringify({ expiration_duration_seconds: null }) }
        : {}),
    },
    body: buf,
  });
  const up = await upRes.json().catch(() => ({}));
  const url = up.access_url || up.url;
  if (!upRes.ok || !url) throw new Error(`fal storage upload failed (${upRes.status})`);
  return url;
}

// How long a fal job may run before we stop waiting and surface an error, so a
// stuck request never spins forever. Training is legitimately slow (~10 min).
const FAL_MAX_MS = { lora: 25 * 60e3, video: 12 * 60e3 };
function falMaxMs(expect) { return FAL_MAX_MS[expect] || 6 * 60e3; }

// fal video/image models don't all return the output in the same place. Dig
// through every shape they're known to use so a COMPLETED (already-billed)
// job never gets thrown away as "no output" — that would mean paying for a
// clip we failed to save. Returns the first URL found, or null.
function extractMediaUrl(result, expect) {
  if (!result || typeof result !== 'object') return null;
  const asUrl = (v) => {
    if (!v) return null;
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
    if (typeof v === 'object' && typeof v.url === 'string') return v.url;
    return null;
  };
  const first = (v) => (Array.isArray(v) ? v[0] : v);
  const candidates = expect === 'video'
    ? [result.video, first(result.videos), result.output, first(result.outputs),
       result.video_url, result.url, result.data && result.data.video]
    : [first(result.images), result.image, result.output, first(result.outputs),
       result.image_url, result.url, result.data && first(result.data.images)];
  for (const c of candidates) { const u = asUrl(c); if (u) return u; }
  return null;
}

async function refreshFalJob(job) {
  if (job.status !== 'running') return;
  // Guard against the background sweeper and a browser poll advancing the same
  // job at once — that could download twice / create two assets for one charge.
  if (job._refreshing) return;
  job._refreshing = true;
  try {
    const status = await falGet(job.fal.statusUrl);
    if (status.status === 'IN_QUEUE' || status.status === 'IN_PROGRESS') {
      // Give up on a job that's been running far too long rather than spin
      // forever. Nothing new was produced, so it never counts against your cap.
      if (Date.now() - (job.startedAt || 0) > falMaxMs(job.fal.expect)) {
        throw new Error('This one took far too long and was given up on — nothing was produced, and it doesn\'t count against your daily limit. Try again.');
      }
      job.progress = status.status === 'IN_QUEUE' ? 5 : Math.min(90, (job.progress || 5) + 5);
      return;
    }
    // Any terminal state that isn't a clean completion is a failure — surface it
    // instead of silently returning (which left the job spinning forever).
    if (status.status !== 'COMPLETED') {
      if (/FAIL|ERROR|CANCEL/i.test(String(status.status || ''))) {
        throw new Error('The model reported an error and produced nothing — it doesn\'t count against your daily limit. Try again, or tweak the prompt a little.');
      }
      return; // unknown non-terminal status: keep polling (timeout above still applies)
    }

    const result = await falGet(job.fal.responseUrl);

    if (job.fal.expect === 'qc') {
      // Moondream answers as text; verdict lands on the asset so the library
      // can badge it (and a flagged shot can be regenerated before it costs
      // you a bad video).
      const answer = String(result.output || result.answer || result.text || '').trim();
      const verdict = /^\s*flag/i.test(answer) || (!/^\s*pass/i.test(answer) && /flag/i.test(answer)) ? 'flag' : 'pass';
      const row = db.getAsset(job.userId, job.fal.assetId);
      if (row) {
        let meta = {};
        try { meta = JSON.parse(row.meta || 'null') || {}; } catch (_) {}
        meta.qc = { verdict, note: answer.replace(/^\s*(pass|flag)\s*[-–—:]?\s*/i, '').slice(0, 200) };
        db.updateAssetMeta(job.userId, row.id, meta);
      }
      job.transcript = { qc: verdict }; // rides jobJson so the client can react without refetching
      job.progress = 100;
      job.status = 'done';
      return;
    }

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

    if (job.fal.expect === 'audio') {
      // Voice clone (F5-TTS) returns a generated speech clip. File it as audio;
      // it's cheap and not gated by the image/video caps.
      const outAudio = result.audio_url || result.audio || result.output;
      const url = typeof outAudio === 'string' ? outAudio : (outAudio && outAudio.url);
      if (!url) throw new Error('The voice model finished but returned no audio.');
      const filename = await downloadToMedia(job.userId, url, '.wav');
      const meta = { ...(job.fal.meta || {}), source: 'voice', duration: await probeMediaDuration(mediaPath(filename)) };
      job.assetId = db.createAsset(job.userId, 'audio', job.fal.label, filename, null, meta);
      job.progress = 100;
      job.status = 'done';
      return;
    }

    const media = extractMediaUrl(result, job.fal.expect);
    if (!media) {
      // Completed (so fal billed it) but we can't find the file. Log the raw
      // payload so the URL is recoverable instead of silently lost.
      try { console.error('[fal] COMPLETED but no media URL found. Raw result:', JSON.stringify(result).slice(0, 2000)); } catch (_) {}
      throw new Error('The model finished but returned no output file. (Logged for recovery — tell support if this repeats.)');
    }

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
  } finally {
    job._refreshing = false;
    // Close out the durable receipt once the job reaches a terminal state, so
    // the recovery view knows this one is collected (and won't re-offer it).
    if (job._receiptId && (job.status === 'done' || job.status === 'error')) {
      try { db.setFalReceiptStatus(job._receiptId, { status: job.status, assetId: job.assetId || null, error: job.error || null }); } catch (_) {}
    }
  }
}

// Background sweeper. fal jobs otherwise ONLY advance when the browser polls
// GET /jobs/:id — so if the tab closes, refreshes, sleeps, or a render outlives
// the page, the job stalls while fal still finishes AND BILLS it, and the clip
// you paid for never downloads. This finishes every running fal job server-side
// on a timer, so completed work always lands in the library regardless of the
// browser. Reading fal results never re-charges, so this can't cost extra.
let falSweeperTimer = null;
function startFalSweeper() {
  if (falSweeperTimer) return;
  falSweeperTimer = setInterval(async () => {
    for (const job of jobs.values()) {
      if (job.status === 'running' && job.fal && !job._refreshing) {
        try { await refreshFalJob(job); } catch (_) {}
      }
    }
  }, 6000);
  if (falSweeperTimer.unref) falSweeperTimer.unref(); // don't hold the process open
}
startFalSweeper();

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
    stockAvailable: Boolean(PEXELS_KEY),
    bufferAvailable: Boolean(BUFFER_KEY),
    // Narrators run on this computer - free, offline, nothing per word. The
    // list is empty when local speech didn't install, and the Voice card says
    // so instead of silently offering voices that can't speak.
    voices: localTts.available() ? localTts.list() : [],
    localVoice: localTts.available(),
    // Free cloning: when installed, "my own voice" costs nothing.
    voiceCloneLocal: localClone.status(),
    chatAvailable: Boolean(ANTHROPIC_API_KEY),
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
      imageGptRate: IMAGE_GPT_RATE,
      loraTrain: { steps: LORA_TRAIN_STEPS, estCost: LORA_TRAIN_STEPS * LORA_STEP_RATE },
      sing: { draft: SING_DRAFT_RATE, hero: SING_HERO_RATE },
      livePortrait: LIVEPORTRAIT_RATE,
      transcribe: TRANSCRIBE_RATE,
      captionFix: CAPTION_FIX_RATE,
      dance: { draft: DANCE_DRAFT_RATE, standard: DANCE_STD_RATE, hero: DANCE_HERO_RATE },
      qc: QC_RATE,
      voicePer1k: VOICE_RATE,
      voiceEmoPer1k: VOICE_EMO_RATE,
      animRef: ANIM_REF_RATE,
      tiers: Object.fromEntries(Object.entries(VIDEO_TIERS).map(([k, t]) =>
        [k, { label: t.label, desc: t.desc, rate: t.rate }])),
    },
  });
});

/* ---------------- diagnostics (recent server errors) ---------------- */
router.get('/diagnostics', (req, res) => {
  res.json({ errors: db.getRecentErrors(50) });
});
router.post('/diagnostics/clear', (req, res) => {
  res.json({ cleared: db.clearErrors() });
});

/* ---------------- settings: AI key from the app ---------------- */
// Ask fal whether a key is actually good. Storage auth is the cheapest thing
// that requires a valid key - it generates nothing and bills nothing - so it's
// what a "does this work" check should use. Returns plain English, never
// throws: a key that can't be checked is not the same as a key that's wrong.
async function falKeyCheck(key) {
  if (!key) return { ok: false, why: 'No key saved.' };
  let r;
  try {
    r = await fetch(FAL_STORAGE_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Key ${key}` },
      body: '{}',
    });
  } catch (err) {
    return { ok: null, why: `Couldn't reach fal.ai to check (${err.message}). Your key may still be fine.` };
  }
  if (r.ok) return { ok: true, why: 'Key works.' };
  if (r.status === 401 || r.status === 403) {
    // fal answers 403 for an EMPTY BALANCE as well as for a bad key — same
    // status, no distinguishing message. That cost a needless key rotation
    // once, so balance is named first here: it's the likelier of the two,
    // because a key you just created and pasted is rarely the broken thing.
    return { ok: false, why: `fal.ai refused this (${r.status}). Two things cause that, and balance is the common one: 1) your fal.ai credit is empty — check the balance on your fal dashboard and top it up; 2) the key is wrong — make a fresh one at fal.ai → Keys and paste it. Making pictures uses a different fal service, so it can still work while this doesn't.` };
  }
  return { ok: null, why: `fal.ai answered ${r.status}. That's not a key problem — probably a hiccup on their side. Try again in a minute.` };
}

router.post('/settings/falkey', async (req, res) => {
  const { key } = req.body || {};
  const clean = typeof key === 'string' ? key.trim() : '';
  if (clean && (clean.length < 10 || /\s/.test(clean))) {
    return res.status(400).json({ error: "That doesn't look like a fal.ai key. Copy it from fal.ai → Keys." });
  }
  try {
    persistFalKey(clean || null);
    FAL_KEY = clean || undefined;
    // Save first, then check. A key is saved even if fal is unreachable -
    // refusing to save because their API blinked would be worse than useless.
    const check = clean ? await falKeyCheck(clean) : { ok: false, why: 'Key removed.' };
    res.json({ falAvailable: Boolean(FAL_KEY), verified: check.ok, note: check.why });
  } catch (err) {
    res.status(500).json({ error: `Could not save the key: ${err.message}` });
  }
});

// "Is my key still good?" - same check, without re-pasting anything.
router.post('/settings/falkey/test', async (req, res) => {
  const check = await falKeyCheck(FAL_KEY);
  res.json({ verified: check.ok, note: check.why });
});

/* ---------------- settings: daily spend cap ---------------- */
// The hard dollar ceiling. Persisted to .env so it survives restarts. Send 0
// (or blank) to turn it off. Once today's estimated spend + a new action would
// exceed it, that action is refused until tomorrow (UTC).
router.post('/settings/spendcap', (req, res) => {
  let cap = Number(req.body?.cap);
  if (!Number.isFinite(cap) || cap < 0) cap = 0;
  cap = Math.min(1000, Math.round(cap * 100) / 100); // sane ceiling + cents precision
  try {
    persistEnvKey('STUDIO_DAILY_USD_CAP', cap > 0 ? String(cap) : null);
    DAILY_USD_CAP = cap;
    res.json({ cap: DAILY_USD_CAP, spentToday: Number(todaySpendUSD(req.userId).toFixed(2)) });
  } catch (err) {
    res.status(500).json({ error: `Could not save the cap: ${err.message}` });
  }
});

/* ---------------- Buffer (scheduling) ---------------- */
// A personal API key from publish.buffer.com/settings/api. Buffer's API cannot
// accept a file upload - a post's media has to be a public URL that stays
// reachable until the post publishes - so the posting step (not built yet)
// will push the render to fal storage first and hand Buffer that link.
const BUFFER_API_URL = process.env.BUFFER_API_URL || 'https://api.buffer.com';

router.post('/settings/bufferkey', (req, res) => {
  const { key } = req.body || {};
  const clean = typeof key === 'string' ? key.trim() : '';
  if (clean && (clean.length < 10 || /\s/.test(clean))) {
    return res.status(400).json({ error: "That doesn't look like a Buffer key. Copy it from publish.buffer.com/settings/api." });
  }
  try {
    persistEnvKey('BUFFER_KEY', clean || null);
    BUFFER_KEY = clean || undefined;
    res.json({ bufferAvailable: Boolean(BUFFER_KEY) });
  } catch (err) {
    res.status(500).json({ error: `Could not save the key: ${err.message}` });
  }
});

async function bufferGraphQL(query, variables) {
  const r = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BUFFER_KEY}` },
    body: JSON.stringify({ query, variables: variables || {} }),
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch (_) { body = null; }
  if (!r.ok) {
    const msg = body?.errors?.[0]?.message || text.slice(0, 300) || `HTTP ${r.status}`;
    const err = new Error(msg); err.status = r.status; throw err;
  }
  if (body?.errors?.length) {
    // Surfaced verbatim on purpose: if a field name in this file is wrong,
    // Buffer's own message names it, which is the fastest way to fix it.
    const err = new Error(body.errors.map((e) => e.message).join(' | ')); err.status = 400; throw err;
  }
  return body?.data;
}

// Renders a GraphQL type ref (which nests through NON_NULL/LIST wrappers) as
// something readable, e.g. "String!" or "[ChannelFilter!]".
function gqlTypeName(t) {
  if (!t) return '?';
  if (t.kind === 'NON_NULL') return gqlTypeName(t.ofType) + '!';
  if (t.kind === 'LIST') return '[' + gqlTypeName(t.ofType) + ']';
  return t.name || t.kind;
}

// `channels` needs the organization the key belongs to. Buffer doesn't hand
// that over in the key itself, so it has to be looked up first. The shape of
// that lookup isn't something to guess at: try the plausible spellings, and if
// none of them exist, ask the schema what the root query actually offers and
// report that instead of failing blind.
const ORG_QUERIES = [
  `query { account { currentOrganization { id name } } }`,
  `query { account { organizations { id name } } }`,
  `query { organizations { id name } }`,
];
function firstOrgId(data) {
  const seen = [];
  (function walk(v, depth) {
    if (!v || typeof v !== 'object' || depth > 4) return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    if (typeof v.id === 'string') seen.push({ id: v.id, name: v.name });
    Object.values(v).forEach((x) => walk(x, depth + 1));
  })(data, 0);
  return seen[0] || null;
}
async function bufferOrganization() {
  let last = null;
  for (const q of ORG_QUERIES) {
    try {
      const org = firstOrgId(await bufferGraphQL(q));
      if (org) return org;
    } catch (err) { last = err; }
  }
  if (last) last.orgLookupFailed = true;
  throw last || Object.assign(new Error('Could not find your Buffer organization.'), { orgLookupFailed: true });
}

// Proves the key, the endpoint and the schema all work before anything is
// built on top. Returns the channels this account can post to.
const BUFFER_CHANNELS_Q = `query($input: ChannelsInput!) { channels(input: $input) { id name service } }`;
router.get('/buffer/channels', async (req, res) => {
  if (!BUFFER_KEY) return res.status(400).json({ error: 'No Buffer key saved yet.' });
  try {
    const org = await bufferOrganization();
    const data = await bufferGraphQL(BUFFER_CHANNELS_Q, { input: { organizationId: org.id } });
    const channels = (data?.channels || []).map((c) => ({ id: c.id, name: c.name, service: c.service }));
    res.json({ channels, organization: org });
  } catch (err) {
    let needs = null;
    if (err.status !== 401 && err.status !== 403) {
      try {
        if (err.orgLookupFailed) {
          // Which root fields exist at all? That names the way in.
          const s = await bufferGraphQL(`query { __schema { queryType { fields { name } } } }`);
          const names = (s?.__schema?.queryType?.fields || []).map((f) => f.name);
          if (names.length) needs = ['root query fields: ' + names.join(', ')];
        } else {
          const t = await bufferGraphQL(
            `query { __type(name: "ChannelsInput") { inputFields { name type { kind name ofType { kind name ofType { kind name } } } } } }`);
          const fields = t?.__type?.inputFields;
          if (fields?.length) needs = fields.map((f) => `${f.name}: ${gqlTypeName(f.type)}`);
        }
      } catch (_) { /* introspection may be disabled; the raw error still goes back */ }
    }
    // Record it. Without this, a Buffer failure vanished the moment the card
    // re-rendered and there was nothing to show anyone afterwards.
    try {
      db.logError('buffer', `connection test failed (HTTP ${err.status || '?'}): ${err.message}`,
        needs ? `Buffer schema said: ${needs.join(' | ')}` : null);
    } catch (_) {}
    res.status(err.status === 401 || err.status === 403 ? 401 : 502)
      .json({ error: err.message, needs, hint: 'Buffer answered this verbatim. A 401 means the key is wrong or expired.' });
  }
});

// Ask Buffer to describe an input type. Used when a mutation is rejected, so
// the fix comes from the schema instead of another guess.
async function bufferDescribe(name) {
  try {
    const t = await bufferGraphQL(
      `query { __type(name: "${name}") { inputFields { name type { kind name ofType { kind name ofType { kind name } } } } } }`);
    const f = t?.__type?.inputFields;
    return f?.length ? f.map((x) => `${x.name}: ${gqlTypeName(x.type)}`) : null;
  } catch (_) { return null; }
}

// Nothing about createPost is hardcoded any more. Every previous failure of
// this feature was a guessed name: channels needed `input`, then
// `organizationId`, then the mutation variable turned out not to be
// `PostCreateInput` at all ("Unknown type" — Buffer's own reply listed the
// alternatives). So the whole mutation is now read off Buffer's schema: the
// argument's name, its input type, and what the result union actually calls
// its success and error members. Discovered once, cached for the process.
const nameOf = (t) => { let cur = t; while (cur && !cur.name) cur = cur.ofType; return cur?.name || null; };

// Enum values, asked of Buffer and cached. Sending a string an enum doesn't
// declare is a validation error, and every value below started life as our
// guess at their spelling.
const bufferEnumCache = new Map();
async function bufferEnumValues(typeName) {
  if (bufferEnumCache.has(typeName)) return bufferEnumCache.get(typeName);
  let vals = null;
  try {
    const d = await bufferGraphQL(`query { __type(name: "${typeName}") { enumValues { name } } }`);
    const list = d?.__type?.enumValues;
    if (list?.length) vals = list.map((v) => v.name);
  } catch (_) { /* introspection closed - send ours and let Buffer object */ }
  bufferEnumCache.set(typeName, vals);
  return vals;
}

let bufferCreateCache = null;
async function bufferCreateShape() {
  if (bufferCreateCache) return bufferCreateCache;
  const d = await bufferGraphQL(`query { __schema { mutationType { fields { name
      args { name type { kind name ofType { kind name ofType { kind name } } } }
      type { kind name ofType { kind name } } } } } }`);
  const f = (d?.__schema?.mutationType?.fields || []).find((x) => x.name === 'createPost');
  if (!f || !f.args?.length) throw new Error('Buffer has no createPost mutation on this key.');

  // The post payload is whichever argument takes an input object.
  const arg = f.args.find((a) => nameOf(a.type) && /input/i.test(nameOf(a.type))) || f.args[0];
  const inputType = nameOf(arg.type);
  if (!inputType) throw new Error('Could not read what createPost accepts.');
  const bang = arg.type?.kind === 'NON_NULL' ? '!' : '';

  // Which fields that input actually has, so we send those and no others.
  let inputFields = [];
  try {
    const t = await bufferGraphQL(`query { __type(name: "${inputType}") { inputFields { name type { kind name ofType { kind name } } } } }`);
    inputFields = (t?.__type?.inputFields || []).map((x) => ({
      name: x.name,
      required: x.type?.kind === 'NON_NULL',
      // Enum-typed fields matter: sending a string an enum doesn't declare is
      // a validation error, and "addToQueue" is our guess at their spelling.
      enumType: (x.type?.kind === 'ENUM' && x.type.name) || (x.type?.ofType?.kind === 'ENUM' && x.type.ofType.name) || null,
      // Needed to introspect `metadata`, whose type name varies by schema version.
      typeName: nameOf(x.type),
    }));
  } catch (_) { /* introspection closed: send our best guess and let Buffer object */ }

  // And what to ask for back. A union needs inline fragments naming real
  // members; an object is selected directly.
  let selection = '{ __typename }';
  const retName = nameOf(f.type);
  if (retName) {
    try {
      const t = await bufferGraphQL(`query { __type(name: "${retName}") { kind fields { name } possibleTypes { name fields { name } } } }`);
      const ty = t?.__type;
      const pick = (fields, on) => {
        const has = (n) => (fields || []).some((x) => x.name === n);
        if (has('post')) return on ? `... on ${on} { post { id } }` : 'post { id }';
        if (has('message')) return on ? `... on ${on} { message }` : 'message';
        return null;
      };
      if (ty?.kind === 'UNION' || ty?.kind === 'INTERFACE') {
        const parts = ['__typename'];
        for (const pt of ty.possibleTypes || []) {
          const p = pick(pt.fields, pt.name);
          if (p) parts.push(p);
        }
        if (parts.length > 1) selection = `{ ${parts.join(' ')} }`;
      } else if (ty?.kind === 'OBJECT') {
        const parts = ['__typename'];
        const p = pick(ty.fields, null);
        if (p) parts.push(p);
        if ((ty.fields || []).some((x) => x.name === 'message') && !parts.includes('message')) parts.push('message');
        if (parts.length > 1) selection = `{ ${parts.join(' ')} }`;
      }
    } catch (_) { /* keep __typename only */ }
  }

  bufferCreateCache = {
    query: `mutation($input: ${inputType}${bang}) { createPost(${arg.name}: $input) ${selection} }`,
    inputType,
    inputFields,
  };
  return bufferCreateCache;
}

// What Buffer's video/image asset inputs actually look like, asked of Buffer
// itself and cached for the server's lifetime. Guessing at this API's shapes
// is how every previous round of this feature failed (channels needed input,
// then organizationId), so the shape now comes from the source before we send.
let bufferAssetShapeCache = null;
async function bufferAssetShapes() {
  if (bufferAssetShapeCache) return bufferAssetShapeCache;
  const shapes = {};
  for (const t of ['VideoAssetInput', 'ImageAssetInput']) {
    try {
      const d = await bufferGraphQL(
        `query { __type(name: "${t}") { inputFields { name type { kind name ofType { kind name } } } } }`);
      const fields = d?.__type?.inputFields;
      if (fields?.length) shapes[t] = fields.map((f) => ({ name: f.name, required: f.type?.kind === 'NON_NULL' }));
    } catch (_) { /* introspection off? fall back to the documented shape */ }
  }
  if (Object.keys(shapes).length) bufferAssetShapeCache = shapes;
  return shapes;
}

/* ---- channel-specific requirements (metadata) ----
   Buffer refuses a post that is missing what a given network demands, and the
   demands differ per network: YouTube wants a title and a category, Facebook
   wants a post type. Those live in CreatePostInput.metadata, keyed by service.
   Every name below is read off Buffer's own schema rather than assumed - the
   thumbnailUrl episode above is exactly what assuming costs. */
let bufferChannelServiceCache = null;
async function bufferChannelServices() {
  if (bufferChannelServiceCache) return bufferChannelServiceCache;
  const map = new Map();
  try {
    const org = await bufferOrganization();
    const data = await bufferGraphQL(BUFFER_CHANNELS_Q, { input: { organizationId: org.id } });
    for (const c of data?.channels || []) map.set(c.id, String(c.service || '').toLowerCase());
  } catch (_) { /* leave empty: metadata is then skipped, not guessed */ }
  if (map.size) bufferChannelServiceCache = map;
  return map;
}

// metadata's own shape: which networks it accepts, and what each one takes.
let bufferMetaShapeCache = null;
async function bufferMetaShape() {
  if (bufferMetaShapeCache) return bufferMetaShapeCache;
  const out = { key: null, networks: {} };
  try {
    const create = await bufferCreateShape();
    const metaField = (create.inputFields || []).find((f) => f.name === 'metadata');
    if (!metaField?.typeName) return out;
    out.key = metaField.name;
    const d = await bufferGraphQL(
      `query { __type(name: "${metaField.typeName}") { inputFields { name type { kind name ofType { kind name } } } } }`);
    for (const f of d?.__type?.inputFields || []) {
      const tn = nameOf(f.type);
      if (!tn) continue;
      const sub = await bufferGraphQL(
        `query { __type(name: "${tn}") { inputFields { name type { kind name ofType { kind name } } } } }`);
      const fields = sub?.__type?.inputFields;
      if (!fields?.length) continue;
      out.networks[f.name.toLowerCase()] = fields.map((x) => ({
        name: x.name,
        required: x.type?.kind === 'NON_NULL',
        scalar: nameOf(x.type),
        enumType: (x.type?.kind === 'ENUM' && x.type.name) || (x.type?.ofType?.kind === 'ENUM' && x.type.ofType.name) || null,
      }));
    }
  } catch (_) { /* introspection closed: send nothing and let Buffer say so */ }
  bufferMetaShapeCache = out;
  return out;
}

// YouTube titles are capped at 100 characters and cannot contain < or >.
function youtubeTitleFrom(caption) {
  const first = String(caption).split('\n').map((l) => l.trim()).find(Boolean) || 'Turn Someday Into Day One';
  return first.replace(/[<>]/g, '').slice(0, 100);
}

// Build the metadata object for ONE channel. Only fields the network's input
// actually declares are included, and an enum value is checked against what
// Buffer lists before it is sent.
async function bufferMetadataFor(service, { caption, youtubeCategoryId, facebookType, aiLabel }) {
  const shape = await bufferMetaShape();
  if (!shape.key) return null;
  const fields = shape.networks[service];
  if (!fields) return null;
  const has = (n) => fields.find((f) => f.name === n);
  const meta = {};

  if (service === 'youtube') {
    if (has('title')) meta.title = youtubeTitleFrom(caption);
    // Buffer names it categoryId; older shapes said category. 22 = People & Blogs.
    const cat = has('categoryId') || has('category');
    if (cat) {
      const val = String(youtubeCategoryId || '22');
      meta[cat.name] = /^Int$/i.test(cat.scalar || '') ? Number(val) : val;
    }
    // YouTube now requires AI disclosure for realistic AI content; pass the
    // flag through when the caption is labeled as AI-made.
    if (has('isAiGenerated') && aiLabel) meta.isAiGenerated = true;
  } else if (service === 'tiktok') {
    if (has('isAiGenerated') && aiLabel) meta.isAiGenerated = true;
  } else if (service === 'facebook') {
    const t = has('type');
    if (t) {
      let val = String(facebookType || 'post');
      if (t.enumType) {
        const allowed = await bufferEnumValues(t.enumType);
        if (allowed?.length) {
          const hit = allowed.find((a) => a.toLowerCase() === val.toLowerCase()) || allowed.find((a) => /post/i.test(a));
          if (hit) val = hit;
        }
      }
      meta[t.name] = val;
    }
  }

  if (!Object.keys(meta).length) return null;
  return { key: shape.key, value: { [service]: meta } };
}

// NOTE: there was a makeVideoThumbUrl() here that rendered a first frame and
// uploaded it as the video's thumbnailUrl. It is gone on purpose. Buffer
// rejects thumbnailUrl on every network ("social networks do not accept custom
// video thumbnail images"), so sending one failed the whole post. Do not
// reintroduce it.

// Queue one finished render onto one channel. Buffer has no file upload, so
// the file goes to fal storage (permanently, see falUploadFile) and Buffer is
// handed that link. mode addToQueue means Buffer uses the posting schedule
// already set on the channel - 8am/12pm/7pm - rather than us inventing a time.
router.post('/buffer/post', async (req, res) => {
  if (!BUFFER_KEY) return res.status(400).json({ error: 'Connect Buffer first (Post tab).' });
  if (!FAL_KEY) return res.status(400).json({ error: 'Turn on AI first - the fal key is what gives Buffer a link to fetch the video from.' });

  const { assetId, channelIds, aiLabel } = req.body || {};
  let caption = typeof req.body?.caption === 'string' ? req.body.caption.trim() : '';
  if (!assetId) return res.status(400).json({ error: 'Pick a video first.' });
  if (!Array.isArray(channelIds) || !channelIds.length) return res.status(400).json({ error: 'Pick at least one channel.' });
  if (!caption) return res.status(400).json({ error: 'Write a caption first.' });

  // The AI disclosure is added here, not only in the browser, so it cannot be
  // lost by an edit on the way out.
  if (aiLabel && !/made with ai/i.test(caption)) caption = `${caption}\n\nMade with AI`;

  const asset = db.getAsset(req.userId, assetId);
  if (!asset) return res.status(404).json({ error: 'That video is not in your library any more.' });

  let mediaUrl;
  try {
    const buf = fs.readFileSync(mediaPath(asset.filename));
    const ext = path.extname(asset.filename).toLowerCase();
    const ctype = ext === '.mp4' ? 'video/mp4' : ext === '.webm' ? 'video/webm'
      : ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
    mediaUrl = await falUploadFile(buf, path.basename(asset.filename), ctype, { permanent: true });
  } catch (err) {
    try { db.logError('buffer', `media upload failed before posting: ${err.message}`); } catch (_) {}
    return res.status(502).json({ error: `Could not publish the video to a link Buffer can reach: ${err.message}` });
  }

  const isVideo = /^video\//.test(mediaUrl) || /\.(mp4|webm|mov)$/i.test(mediaUrl) || asset.kind === 'video';

  // Build the asset object to match Buffer's OWN description of it, not our
  // memory of the docs. Unknown shape (introspection off) falls back to the
  // documented { url } and lets Buffer's error say the rest.
  let assetObj;
  if (!isVideo) {
    assetObj = { image: { url: mediaUrl } };
  } else {
    const shape = (await bufferAssetShapes()).VideoAssetInput || null;
    const v = {};
    const urlField = shape?.find((f) => f.name === 'url')
      || shape?.find((f) => /url/i.test(f.name) && !/thumb/i.test(f.name));
    v[urlField ? urlField.name : 'url'] = mediaUrl;
    // NO THUMBNAIL. Buffer's VideoAssetInput declares a thumbnailUrl field, so
    // the "trust the schema" rule above filled it in - and Buffer then refused
    // every post with: "Video thumbnailUrl is not supported: social networks do
    // not accept custom video thumbnail images... Remove thumbnailUrl from the
    // video asset." Declared in the schema is not the same as accepted by the
    // validator. Their suggested alternative (metadata.thumbnailOffset) is
    // Instagram/TikTok/Pinterest only and optional, so nothing replaces it.
    // A required field we have nothing for: name it now, once, instead of
    // failing identically on every channel.
    const missing = (shape || []).filter((f) => f.required && v[f.name] === undefined).map((f) => f.name);
    if (missing.length) {
      return res.status(502).json({ error: `Buffer's video input also needs: ${missing.join(', ')}. Tell Claude — that's one line to add.` });
    }
    assetObj = { video: v };
  }

  let shape;
  try {
    shape = await bufferCreateShape();
  } catch (err) {
    try { db.logError('buffer', `could not read Buffer's posting schema: ${err.message}`); } catch (_) {}
    return res.status(502).json({ error: `Could not read Buffer's posting format: ${err.message}` });
  }

  // Which network each chosen channel is, so the right requirements go with it.
  const services = await bufferChannelServices();

  const results = [];
  let needs = null;
  let dropped = [];
  for (const channelId of channelIds) {
    const service = services.get(channelId) || null;
    const wanted = {
      text: caption,
      channelId,
      schedulingType: 'automatic',
      mode: 'addToQueue',
      // Required by Buffer's CreatePostInput. False means it goes straight to
      // the queue instead of parking in an approval list nobody will look at -
      // this is a one-person account, he IS the approver.
      needsApproval: false,
      // Buffer's own AI-disclosure flag. The caption still carries the visible
      // "Made with AI" line, because that is what a viewer actually reads;
      // this tells Buffer so it can do whatever each platform now requires.
      aiAssisted: !!aiLabel,
      assets: [assetObj],
    };
    // What this particular network insists on: YouTube refuses a post with no
    // title and no category; Facebook refuses one with no type. Skipped
    // silently when the service is unknown or the schema is closed, so a
    // network that needs nothing extra is unaffected.
    if (service) {
      try {
        const extra = await bufferMetadataFor(service, {
          caption,
          youtubeCategoryId: req.body?.youtubeCategoryId,
          facebookType: req.body?.facebookType,
          aiLabel,
        });
        if (extra) wanted[extra.key] = extra.value;
      } catch (_) { /* Buffer's own refusal is more useful than ours */ }
    }
    // Send only what this input actually declares. A field Buffer doesn't
    // know is a hard validation error that kills the whole post, and their
    // schema has already been renamed under us once.
    let input = wanted;
    if (shape.inputFields.length) {
      const allowed = new Set(shape.inputFields.map((f) => f.name));
      input = Object.fromEntries(Object.entries(wanted).filter(([k]) => allowed.has(k)));
      dropped = Object.keys(wanted).filter((k) => !allowed.has(k));
      // Check our enum guesses against what Buffer declares, and say what it
      // allows rather than sending a word it has never heard of.
      for (const f of shape.inputFields) {
        if (!f.enumType || input[f.name] === undefined) continue;
        const allowedVals = await bufferEnumValues(f.enumType);
        if (!allowedVals || allowedVals.includes(input[f.name])) continue;
        // Our spelling isn't declared. Try the same word in the other casings
        // an API might use and take whichever one the enum actually lists —
        // that's a verified match, not another guess. ADD_TO_QUEUE and
        // addToQueue are the same instruction.
        const word = String(input[f.name]);
        const snake = word.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
        const variants = [snake.toUpperCase(), snake.toLowerCase(), word.toUpperCase(), word.toLowerCase()];
        const hit = variants.find((v) => allowedVals.includes(v));
        if (hit) { input[f.name] = hit; continue; }
        return res.status(502).json({
          error: `Buffer's ${f.name} does not accept "${word}". It allows: ${allowedVals.join(', ')}. Tell Claude — that's one word to change.`,
        });
      }
      const missing = shape.inputFields.filter((f) => f.required && input[f.name] === undefined).map((f) => f.name);
      if (missing.length) {
        return res.status(502).json({
          error: `Buffer's ${shape.inputType} also requires: ${missing.join(', ')}. Tell Claude — that's one line to add.`,
          needs: [`${shape.inputType}: ${shape.inputFields.map((f) => f.name + (f.required ? '!' : '')).join(', ')}`],
        });
      }
    }
    try {
      const d = await bufferGraphQL(shape.query, { input });
      const r = d?.createPost;
      // No result object at all is a failure, not a success. Reporting
      // "queued" for an empty response is the one wrong answer here: it would
      // have Jacques believe a video is scheduled when nothing was created.
      if (!r) results.push({ channelId, ok: false, error: 'Buffer accepted the request but returned nothing — the post was not created.' });
      else if (r.message) results.push({ channelId, ok: false, error: r.message });
      else if (r.post?.id) results.push({ channelId, ok: true, postId: r.post.id });
      else results.push({ channelId, ok: false, error: `Buffer returned ${r.__typename || 'an unrecognized result'} with no post id.` });
    } catch (err) {
      results.push({ channelId, ok: false, error: err.message });
      if (!needs) {
        needs = [`${shape.inputType}: ${shape.inputFields.map((f) => f.name + (f.required ? '!' : '')).join(', ') || '(introspection closed)'}`];
        for (const t of ['AssetInput', 'VideoAssetInput', 'ImageAssetInput']) {
          const f = await bufferDescribe(t);
          if (f) needs.push(`${t}: ${f.join(', ')}`);
        }
      }
    }
  }
  if (dropped.length) { try { db.logError('buffer', `dropped unknown post fields: ${dropped.join(', ')}`); } catch (_) {} }
  // Every per-channel refusal goes to Diagnostics too. A post can fail on one
  // channel and succeed on another, and the failing half used to leave no
  // trace once the page moved on.
  for (const r of results) {
    if (r.ok) continue;
    try { db.logError('buffer', `post refused on channel ${r.channelId}: ${r.error}`, needs ? needs.join(' | ') : null); } catch (_) {}
  }
  const anyOk = results.some((r) => r.ok);
  // Lead with Buffer's own words. The first version of this response had no
  // `error` field at all, so the browser showed "Request failed (502)" and
  // threw away the one string that said what was actually wrong.
  const said = [...new Set(results.filter((r) => !r.ok && r.error).map((r) => r.error))];
  res.status(anyOk ? 200 : 502).json({
    ...(anyOk ? {} : { error: said.length ? `Buffer said: ${said.join(' · ')}` : 'Buffer refused the post without an explanation.' }),
    results, mediaUrl, caption, needs,
  });
});

/* ---------------- free stock b-roll (Pexels) ---------------- */
// A free Pexels key (pexels.com/api) unlocks free, no-attribution-required
// stock photos and video for establishing shots, textures, and transitions -
// so you don't spend on AI to generate filler.
router.post('/settings/pexelskey', (req, res) => {
  const { key } = req.body || {};
  const clean = typeof key === 'string' ? key.trim() : '';
  if (clean && (clean.length < 10 || /\s/.test(clean))) {
    return res.status(400).json({ error: "That doesn't look like a Pexels key. Copy it from pexels.com/api." });
  }
  try {
    persistEnvKey('PEXELS_KEY', clean || null);
    PEXELS_KEY = clean || undefined;
    res.json({ stockAvailable: Boolean(PEXELS_KEY) });
  } catch (err) {
    res.status(500).json({ error: `Could not save the key: ${err.message}` });
  }
});

router.post('/settings/anthropickey', (req, res) => {
  const { key } = req.body || {};
  const clean = typeof key === 'string' ? key.trim() : '';
  if (clean && (clean.length < 15 || /\s/.test(clean))) {
    return res.status(400).json({ error: "That doesn't look like an Anthropic key. It starts with sk-ant-." });
  }
  try {
    persistEnvKey('ANTHROPIC_API_KEY', clean || null);
    ANTHROPIC_API_KEY = clean || undefined;
    res.json({ chatAvailable: Boolean(ANTHROPIC_API_KEY) });
  } catch (err) {
    res.status(500).json({ error: `Could not save the key: ${err.message}` });
  }
});

/* ---------------- talk to your crew (per-role AI advisors) ---------------- */
// Each crew member is a focused persona. They give short, concrete, encouraging
// advice grounded in Studio's actual tools and the artist's own characters.
const CREW = {
  creative: { name: 'Creative Director', emoji: '🎨', role:
    'the CREATIVE DIRECTOR. You own the big vision: the concept, mood, emotional arc, and what makes a video unforgettable and unmistakably THIS artist. You think in story and feeling, not shot lists. You protect the artist\'s brand and their recurring characters\' identity across every video. You push for one strong idea over ten scattered ones.' },
  director: { name: 'Director', emoji: '🎬', role:
    'the DIRECTOR. You turn the vision into shots: camera moves, framing, pacing, coverage, how scenes cut to the beat. You give specific, practical shot direction and keep the video flowing.' },
  casting: { name: 'Casting Director', emoji: '🎭', role:
    'the CASTING DIRECTOR. You decide which character appears in which scene, protect their likeness and face-lock consistency, and think about wardrobe and who carries each moment.' },
  designer: { name: 'Production Designer', emoji: '🖌', role:
    'the PRODUCTION DESIGNER. You own the look: color grade, lighting mood, locations, and keeping one consistent world across the whole video.' },
  qc: { name: 'QC Supervisor', emoji: '🔍', role:
    'the QC SUPERVISOR. You catch problems before they cost a render: off-model faces, wrong hands/fingers, wrong tattoos, continuity slips, and technical issues. You are picky but constructive.' },
  producer: { name: 'Producer', emoji: '💼', role:
    'the PRODUCER. You watch the money and the clock: what is worth spending AI credits on vs doing free, how to hit a deadline, and how to get the most video for the least spend. You always suggest the free/cheap path first.' },
};

router.post('/crew-chat', async (req, res) => {
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Add an Anthropic key in Settings to chat with your crew.' });
  const { member, message, history, context } = req.body || {};
  const who = CREW[member];
  if (!who) return res.status(400).json({ error: 'Pick a crew member to talk to.' });
  const msg = typeof message === 'string' ? message.trim().slice(0, 2000) : '';
  if (!msg) return res.status(400).json({ error: 'Type a message first.' });

  const ctx = context && typeof context === 'object' ? context : {};
  const projectBits = [
    ctx.characters ? `The artist's recurring characters: ${String(ctx.characters).slice(0, 300)}.` : null,
    ctx.song ? `Current song: ${String(ctx.song).slice(0, 120)}.` : null,
    ctx.brief ? `Current creative brief: ${String(ctx.brief).slice(0, 300)}.` : null,
  ].filter(Boolean).join(' ');

  const system = `You are ${who.role}
You work inside "Studio", a personal music-video app the artist runs on their own computer. It can: generate AI scene images, animate stills, lip-sync (Sing), dance/motion transfer, train face-locks (LoRA) for recurring characters, reframe to 9:16/1:1, master audio, add captions, and assemble beat-matched videos — most editing is free, only AI generation costs money (shown before each action).
${projectBits ? 'Project context: ' + projectBits : ''}
Style: talk like a real, warm creative collaborator on this artist's team. Be specific and practical, reference Studio's tools when relevant, and keep replies short — 2 to 5 sentences or a tight list. No preamble, no restating the question. Never invent prices; if asked about cost, say the button shows it. Stay in your role.`;

  const msgs = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-8)) {
      if (h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
        msgs.push({ role: h.role, content: h.content.slice(0, 2000) });
      }
    }
  }
  msgs.push({ role: 'user', content: msg });

  try {
    const r = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 700, system, messages: msgs }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error((data && data.error && data.error.message) || 'Chat request failed.');
    const reply = (data.content || []).map((b) => b.text || '').join('').trim();
    res.json({ reply: reply || '(no reply)', member });
  } catch (err) {
    res.status(502).json({ error: `Could not reach your ${who.name}: ${err.message}` });
  }
});

router.get('/stock/search', async (req, res) => {
  if (!PEXELS_KEY) return res.status(503).json({ error: 'Add a free Pexels key in Settings to search stock b-roll.' });
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'What should I search for? Try "city night", "rain window", "smoke".' });
  const type = req.query.type === 'photos' ? 'photos' : 'videos';
  const url = type === 'videos'
    ? `${PEXELS_BASE}/videos/search?query=${encodeURIComponent(q)}&per_page=16&size=medium`
    : `${PEXELS_BASE}/v1/search?query=${encodeURIComponent(q)}&per_page=16`;
  try {
    const r = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
    if (!r.ok) return res.status(502).json({ error: `Pexels error ${r.status}. Check your key in Settings.` });
    const data = await r.json();
    let results;
    if (type === 'videos') {
      results = (data.videos || []).map((v) => {
        // pick a reasonably sized mp4 (<=1280 wide), else the smallest
        const files = (v.video_files || []).filter((f) => f.file_type === 'video/mp4');
        const pick = files.filter((f) => (f.width || 0) <= 1280).sort((a, b) => (b.width || 0) - (a.width || 0))[0] || files.sort((a, b) => (a.width || 0) - (b.width || 0))[0];
        return pick ? { id: v.id, kind: 'video', thumb: v.image, url: pick.link, label: (v.user && v.user.name) ? `stock · ${q}` : `stock · ${q}`, credit: v.user && v.user.name } : null;
      }).filter(Boolean);
    } else {
      results = (data.photos || []).map((p) => ({ id: p.id, kind: 'image', thumb: p.src.medium, url: p.src.large2x || p.src.large || p.src.original, label: `stock · ${q}`, credit: p.photographer }));
    }
    res.json({ results });
  } catch (err) {
    res.status(502).json({ error: `Could not reach Pexels: ${err.message}` });
  }
});

router.post('/stock/import', async (req, res) => {
  if (!PEXELS_KEY) return res.status(503).json({ error: 'Add a free Pexels key in Settings first.' });
  const { url, kind, label } = req.body || {};
  const trustedBase = (PEXELS_BASE || '').replace(/\/$/, '');
  const okUrl = typeof url === 'string' && !/\s/.test(url) && (
    /^https:\/\/([^/\s]*\.)?(pexels\.com|pexels\.io|pexelsusercontent\.com)\//.test(url) ||
    (trustedBase && url.startsWith(trustedBase + '/'))
  );
  if (!okUrl) return res.status(400).json({ error: 'That is not a valid Pexels media link.' });
  const isVideo = kind === 'video';
  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: `Download failed (${r.status}).` });
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) return res.status(502).json({ error: 'Downloaded an empty file.' });
    const ext = isVideo ? '.mp4' : '.jpg';
    const filename = newFilename(req.userId, ext);
    fs.writeFileSync(mediaPath(filename), buf);
    const meta = { source: 'stock', stock: 'pexels' };
    if (isVideo) meta.duration = await probeMediaDuration(mediaPath(filename));
    const cleanLabel = String(label || 'stock clip').slice(0, 80);
    const id = db.createAsset(req.userId, isVideo ? 'video' : 'image', cleanLabel, filename, null, meta);
    res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
  } catch (err) {
    res.status(502).json({ error: `Could not import: ${err.message}` });
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
    // Everything the database holds that is NOT a file on disk. Projects are
    // safe without this — they are saved as assets, so the loop above already
    // copied them — but teleprompter scripts, locations and relationships live
    // in their own tables and were silently missing from every backup taken so
    // far. A backup that quietly leaves things out is worse than no backup,
    // because you only find out on the day the machine dies.
    const safe = (fn) => { try { return fn() || []; } catch (_) { return []; } };
    const manifest = {
      exportedAt: new Date().toISOString(),
      assets: assets.map((a) => ({ id: a.id, kind: a.kind, label: a.label, meta: a.meta ? JSON.parse(a.meta) : null, createdAt: a.created_at })),
      // loraUrl is the face lock. It is a trained model that cost money and ten
      // minutes, and it lives on fal, not here — so this URL is the only thing
      // standing between you and paying to train it twice.
      characters: safe(() => db.getCharacters(req.userId)).map((c) => ({ id: c.id, name: c.name, loraUrl: c.lora_url, triggerWord: c.trigger_word })),
      locations: safe(() => db.getLocations(req.userId)),
      relationships: safe(() => db.getRelationships(req.userId)),
      scripts: safe(() => db.getScripts(req.userId)),
    };
    // Scripts are the teleprompter ones — the words, not a file. Written out
    // separately as well as in the manifest so they can be read without
    // digging through JSON.
    for (const sc of manifest.scripts) {
      const nm = String(sc.title || sc.name || `script-${sc.id}`).replace(/[^a-zA-Z0-9_ -]/g, '_').slice(0, 50);
      archive.append(String(sc.body || sc.text || ''), { name: `backup/scripts/${sc.id}-${nm}.txt` });
    }
    archive.append(JSON.stringify(manifest, null, 2), { name: 'backup/manifest.json' });
    archive.finalize();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: `Backup failed: ${err.message}` });
  }
});

// Reveal the folder where every uploaded/generated picture, video and song is
// stored, in the OS file manager. Studio runs on your own machine, so this
// opens Explorer/Finder right on your media. Always returns the path too.
router.post('/reveal-media', (req, res) => {
  let opened = false;
  try {
    const plat = process.platform;
    const cmd = plat === 'win32' ? 'explorer' : plat === 'darwin' ? 'open' : 'xdg-open';
    const child = spawn(cmd, [MEDIA_DIR], { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
    opened = true;
  } catch (_) { opened = false; }
  res.json({ opened, path: MEDIA_DIR });
});

// Start fresh: wipe ALL of this user's content and the media files on disk, so
// the app is empty. The account/login stays. Requires an explicit confirm flag.
router.post('/reset-everything', (req, res) => {
  if (!req.body || req.body.confirm !== 'DELETE') {
    return res.status(400).json({ error: 'Reset not confirmed.' });
  }
  try {
    const files = db.resetUserContent(req.userId);
    let removed = 0;
    for (const f of files) {
      try { fs.unlinkSync(mediaPath(f)); removed++; } catch (_) {}
    }
    res.json({ ok: true, removed, message: `Cleared everything — ${removed} file(s) deleted. The app is empty and ready for a fresh start.` });
  } catch (err) {
    res.status(500).json({ error: `Reset failed: ${err.message}` });
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
  // .webm is both a video and an audio container, and the extension alone
  // can't tell you which. A voice recording sent as video/webm makes an
  // <audio> element refuse to play it, so the asset's own kind decides.
  const type = (ext === '.webm' && row.kind === 'audio')
    ? 'audio/webm'
    : (CONTENT_TYPES[ext] || 'application/octet-stream');
  const p = mediaPath(row.filename);
  // Handing a missing path to sendFile throws a raw ENOENT with the full
  // Windows path, once per request, and the diagnostics log fills with
  // hundreds of identical lines that say nothing about which video broke.
  // Answer plainly instead, and let /assets/missing do the explaining.
  if (!fs.existsSync(p)) {
    return res.status(410).json({
      error: `The file for "${row.label}" is no longer on this computer.`,
      filename: row.filename,
      missing: true,
    });
  }
  res.sendFile(p, { headers: { 'Content-Type': type } });
});

// One honest answer instead of a wall of ENOENT: what is gone, and the most
// likely reason. Cloud sync is the usual culprit - a folder inside OneDrive
// gets its contents turned into placeholders or moved, and Studio's media
// folder is deliberately not in git, so nothing restores it.
router.get('/assets/missing', (req, res) => {
  const gone = db.getAssets(req.userId, null)
    .filter((row) => !fs.existsSync(mediaPath(row.filename)))
    .map((row) => ({ id: row.id, kind: row.kind, label: row.label, filename: row.filename }));
  const inCloudFolder = /[\\/](OneDrive|Dropbox|Google Drive|iCloudDrive)[\\/]/i.test(MEDIA_DIR);
  res.json({
    missing: gone,
    count: gone.length,
    mediaDir: MEDIA_DIR,
    inCloudFolder,
    advice: !gone.length
      ? 'Every file in your library is present.'
      : inCloudFolder
        ? 'Studio is installed inside a cloud-synced folder. Cloud sync can turn files into online-only placeholders or move them, and Studio\'s media folder is not in git, so nothing puts them back. Right-click the media folder, choose "Always keep on this device", and keep a backup with the Backup button.'
        : 'These files were removed or moved outside Studio. Restore them from a backup, or press Clear to drop the dead entries.',
  });
});

// Drop the library rows whose files are gone. Without this the only way to
// stop a dead entry re-requesting itself forever was to hunt it down and
// delete it by hand, one at a time, which is why the same three filenames
// filled the diagnostics log all day.
router.post('/assets/clear-missing', (req, res) => {
  let removed = 0;
  for (const row of db.getAssets(req.userId, null)) {
    if (fs.existsSync(mediaPath(row.filename))) continue;
    db.deleteAsset(req.userId, row.id);
    removed++;
  }
  res.json({ ok: true, removed });
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
// file bytes directly with metadata in the query string. The body streams to
// disk as it arrives - the old express.raw() approach buffered the whole file
// in RAM with a 400MB ceiling, which rejected any long phone-camera video.
const UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024 * 1024; // 4GB - covers a 15+ min 4K filming
router.put('/upload', async (req, res) => {
  const { kind } = req.query;
  const name = String(req.query.name || 'upload');
  const characterId = req.query.characterId ? Number(req.query.characterId) : null;
  const locationId = req.query.locationId ? Number(req.query.locationId) : null;
  if (!EXT_BY_KIND[kind]) return res.status(400).json({ error: 'kind must be image, video, or audio.' });
  const ext = path.extname(name).toLowerCase();
  if (!EXT_BY_KIND[kind].has(ext)) {
    return res.status(400).json({ error: `Unsupported ${kind} file type: ${ext || '(none)'}` });
  }
  if (characterId && !db.getCharacter(req.userId, characterId)) {
    return res.status(404).json({ error: 'Character not found.' });
  }
  if (locationId && !db.getLocation(req.userId, locationId)) {
    return res.status(404).json({ error: 'Location not found.' });
  }
  const filename = newFilename(req.userId, ext);
  const dest = mediaPath(filename);
  try {
    if (Buffer.isBuffer(req.body) || (req.body && typeof req.body === 'object' && Object.keys(req.body).length)) {
      // A JSON-typed body already consumed by express.json() upstream - re-serialize it.
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
      if (!body.length) return res.status(400).json({ error: 'Empty upload.' });
      fs.writeFileSync(dest, body);
    } else {
      let bytes = 0;
      await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(dest);
        req.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > UPLOAD_LIMIT_BYTES) {
            reject(Object.assign(new Error('File is too large (4GB max).'), { status: 413 }));
            req.destroy();
            out.destroy();
          }
        });
        req.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
        req.on('error', reject);
      });
      if (!bytes) {
        try { fs.unlinkSync(dest); } catch (_) {}
        return res.status(400).json({ error: 'Empty upload.' });
      }
    }
  } catch (err) {
    try { fs.unlinkSync(dest); } catch (_) {}
    return res.status(err.status || 500).json({ error: err.message || 'Upload failed.' });
  }
  const label = path.basename(name, ext).slice(0, 80) || 'Upload';
  const meta = { source: 'upload' };
  if (req.query.overlay === '1') meta.overlay = true; // text-card PNGs stay out of the pickers
  if (locationId) meta.locationRef = locationId;
  if (kind === 'video' || kind === 'audio') meta.duration = await probeMediaDuration(dest);
  const id = db.createAsset(req.userId, kind, label, filename, characterId, meta);
  res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
});

/* ---------------- characters ---------------- */
router.get('/characters', (req, res) => {
  const characters = db.getCharacters(req.userId).map((c) => ({
    id: c.id, name: c.name, loraUrl: c.lora_url, triggerWord: c.trigger_word, description: c.description || '', createdAt: c.created_at,
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
    description: typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 300) : undefined,
  });
  res.json({ ok: true });
});

router.delete('/characters/:id', (req, res) => {
  const character = db.getCharacter(req.userId, Number(req.params.id));
  if (!character) return res.status(404).json({ error: 'Character not found.' });
  db.deleteCharacter(req.userId, character.id); // reference images stay in the library
  res.json({ ok: true });
});

/* ---------------- locations (scene memory) ---------------- */
function locationJson(userId, l) {
  return {
    id: l.id, name: l.name, description: l.description, createdAt: l.created_at,
    refs: db.getAssets(userId, 'image')
      .filter((a) => { try { return JSON.parse(a.meta || 'null')?.locationRef === l.id; } catch (_) { return false; } })
      .map(assetJson),
  };
}

router.get('/locations', (req, res) => {
  res.json({ locations: db.getLocations(req.userId).map((l) => locationJson(req.userId, l)) });
});

router.post('/locations', (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 80);
  if (!name) return res.status(400).json({ error: 'Give the location a name (e.g. Club Krown).' });
  const id = db.createLocation(req.userId, name, String(req.body?.description || '').trim().slice(0, 500));
  res.status(201).json({ location: locationJson(req.userId, db.getLocation(req.userId, id)) });
});

router.put('/locations/:id', (req, res) => {
  const loc = db.getLocation(req.userId, Number(req.params.id));
  if (!loc) return res.status(404).json({ error: 'Location not found.' });
  const name = String(req.body?.name ?? loc.name).trim().slice(0, 80) || loc.name;
  db.updateLocation(req.userId, loc.id, { name, description: String(req.body?.description || '').trim().slice(0, 500) });
  res.json({ location: locationJson(req.userId, db.getLocation(req.userId, loc.id)) });
});

router.delete('/locations/:id', (req, res) => {
  const loc = db.getLocation(req.userId, Number(req.params.id));
  if (!loc) return res.status(404).json({ error: 'Location not found.' });
  db.deleteLocation(req.userId, loc.id); // its photos stay in the library
  res.json({ ok: true });
});

/* ---------------- relationships (chemistry memory) ---------------- */
router.get('/relationships', (req, res) => {
  res.json({ relationships: db.getRelationships(req.userId).map((r) => ({ charA: r.char_a, charB: r.char_b, descriptor: r.descriptor })) });
});

router.put('/relationships', (req, res) => {
  const a = Number(req.body?.charA), b = Number(req.body?.charB);
  if (!a || !b || a === b) return res.status(400).json({ error: 'Pick two different characters.' });
  if (!db.getCharacter(req.userId, a) || !db.getCharacter(req.userId, b)) {
    return res.status(404).json({ error: 'Character not found.' });
  }
  db.setRelationship(req.userId, a, b, String(req.body?.descriptor || '').slice(0, 300));
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
  {
    const capMsg = overDailyCap(req.userId, estActionCost('lora'));
    if (capMsg) return res.status(429).json({ error: capMsg });
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
async function buildSceneModelInput(userId, { prompt, characterId, characterIds, imageSize, quality, locationId }) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw Object.assign(new Error('prompt is required.'), { status: 400 });
  }
  if (imageSize && !IMAGE_SIZES.has(imageSize)) {
    throw Object.assign(new Error('imageSize must be square_hd, portrait_16_9, or landscape_16_9.'), { status: 400 });
  }
  const best = quality === 'best'; // Nano Banana Pro instead of Flux
  const gpt = quality === 'gpt';   // OpenAI GPT-Image, served through fal
  // Both premium tiers share the reference-photo path below (LoRAs are Flux-only).
  const premium = best || gpt;
  const cleanPrompt = prompt.trim().slice(0, 2000);
  let model = gpt ? MODEL_IMAGE_GPT : best ? MODEL_IMAGE_BEST : MODEL_TEXT_TO_IMAGE;
  // No num_images here: every model defaults to 1 and the FLUX.2 edit schema
  // doesn't take it. Multiple takes are separate submits (one job each).
  // Banana speaks aspect_ratio; Flux and GPT-Image speak image_size.
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

  if (cast.length === 1 && cast[0].lora_url && !premium) {
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
    model = gpt ? MODEL_IMAGE_GPT_EDIT : best ? MODEL_IMAGE_BEST_EDIT : MODEL_CHARACTER_IMAGE;
    // Banana Pro edit accepts up to 14 reference images (Flux bills per input
    // megapixel, so it stays leaner) - more angles = a stronger likeness lock.
    const perChar = premium ? (cast.length > 1 ? 5 : 6) : (cast.length > 1 ? 3 : 4);
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
    // Cast-sheet notes: signature details (chains, braids, style) the photos
    // alone might not lock in.
    for (const c of cast) {
      if (c.description) input.prompt += ` ${c.name}'s appearance notes: ${c.description}.`;
    }
    // Saved chemistry: a stored relationship descriptor rides along on every
    // duo scene so their dynamic stays consistent without retyping it.
    if (cast.length === 2) {
      const rel = db.getRelationship(userId, cast[0].id, cast[1].id);
      if (rel) input.prompt += ` Their dynamic together: ${rel.descriptor}`;
    }
    if (/kontext/.test(model)) input.image_url = allUris[0]; // legacy override: single-image editor
    else input.image_urls = allUris;
  }

  // Saved location: its reference photos pin the setting the same way
  // character photos pin a face. On the LoRA path (text-only model) the
  // location contributes its description as words instead.
  if (locationId) {
    const loc = db.getLocation(userId, Number(locationId));
    if (!loc) throw Object.assign(new Error('Location not found.'), { status: 404 });
    const locRefs = db.getAssets(userId, 'image')
      .filter((a) => { try { return JSON.parse(a.meta || 'null')?.locationRef === loc.id; } catch (_) { return false; } })
      .slice(0, 2);
    const locUris = (await Promise.all(locRefs.map((r) => scaledRefDataUri(r.filename)))).filter(Boolean);
    const canTakeImages = locUris.length && model !== MODEL_LORA_IMAGE;
    if (canTakeImages) {
      if (!input.image_urls) {
        // no characters in this scene: switch to the photo-conditioned editor
        model = gpt ? MODEL_IMAGE_GPT_EDIT : best ? MODEL_IMAGE_BEST_EDIT : MODEL_CHARACTER_IMAGE;
        input.image_urls = [];
        input.prompt = cleanPrompt;
      }
      const from = input.image_urls.length + 1;
      input.image_urls.push(...locUris);
      const to = input.image_urls.length;
      input.prompt = `${from === to ? `Reference photo ${from} shows` : `Reference photos ${from}-${to} show`} the location: ${loc.name}. `
        + 'Set the scene in EXACTLY this place - same architecture, furnishings, colors and atmosphere as those photos. '
        + input.prompt;
    }
    if (loc.description) input.prompt += ` Location details: ${loc.description}`;
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
  const { prompt, characterId, characterIds, imageSize, count, quality, locationId } = req.body || {};
  const howMany = Math.max(1, Math.min(4, Number(count) || 1));
  if (db.getImageCount(req.userId, todayUTC()) + howMany > DAILY_AI_IMAGE_LIMIT) {
    return res.status(429).json({ error: `Daily AI image cap (${DAILY_AI_IMAGE_LIMIT}) reached. Raise STUDIO_DAILY_IMAGE_LIMIT in .env if this is really you.` });
  }
  {
    const hasChar = !!characterId || (Array.isArray(characterIds) && characterIds.length > 0);
    const imgCost = quality === 'best' ? estActionCost('imageBest', { count: howMany })
      : quality === 'gpt' ? estActionCost('imageGpt', { count: howMany })
      : estActionCost('image', { characterId: hasChar, count: howMany });
    const capMsg = overDailyCap(req.userId, imgCost);
    if (capMsg) return res.status(429).json({ error: capMsg });
  }

  let built;
  try {
    built = await buildSceneModelInput(req.userId, { prompt, characterId, characterIds, imageSize, quality, locationId });
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
          meta: {
            source: 'fal', model, prompt: cleanPrompt,
            ...(cast.length > 1 ? { castIds: cast.map((c) => c.id) } : {}),
            ...(locationId ? { locationId: Number(locationId) } : {}),
            ...(imageSize ? { imageSize } : {}),
            ...(quality === 'best' || quality === 'gpt' ? { quality } : {}),
          },
        },
      }));
    }
    res.status(202).json({ job: jobJson(jobs[0]), jobs: jobs.map(jobJson) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* ---------------- QC: AI defect inspection on generated images ---------------- */
const MODEL_QC = process.env.FAL_MODEL_QC || 'fal-ai/moondream3-preview/query';
const QC_RATE = Number(process.env.STUDIO_RATE_QC || 0.005); // displayed estimate
const QC_PROMPT = 'You are a strict photo QC inspector for AI-generated images. Examine faces (eyes, teeth, symmetry), '
  + 'hands and fingers (count them), limbs and body proportions, and object/structure coherence. '
  + 'Reply with exactly one line starting with PASS or FLAG, followed by a dash and a short reason. '
  + 'FLAG anything with extra/missing fingers or limbs, warped faces, merged bodies, or impossible structure.';

router.post('/qc', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'AI generation is not set up yet. Paste your fal.ai key in the Turn on AI box first.' });
  }
  const img = db.getAsset(req.userId, Number(req.body?.assetId));
  if (!img || img.kind !== 'image') return res.status(404).json({ error: 'Pick an image to inspect.' });
  try {
    const uri = await scaledRefDataUri(img.filename);
    if (!uri) throw new Error('could not read that image');
    const submitted = await falSubmit(MODEL_QC, { image_url: uri, prompt: QC_PROMPT });
    const job = createJob(req.userId, 'qc', {
      fal: {
        statusUrl: submitted.status_url,
        responseUrl: submitted.response_url,
        expect: 'qc',
        label: `QC: ${img.label.slice(0, 60)}`,
        assetId: img.id,
      },
    });
    res.status(202).json({ job: jobJson(job) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* ---------------- camera coverage: one approved scene -> a shot list ---------------- */
// Real music videos shoot coverage: the same moment from several framings.
// Given an approved generated scene, re-render it as other shot types with
// the characters/location/quality it was made with.
const COVERAGE_SHOTS = {
  wide: 'A wide establishing shot',
  medium: 'A medium shot',
  closeup: 'A close-up shot',
  ots: 'An over-the-shoulder shot',
  detail: 'An extreme close-up detail shot of the most striking object or gesture',
};

router.post('/coverage', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'AI generation is not set up yet. Paste your fal.ai key in the Turn on AI box first.' });
  }
  const scene = db.getAsset(req.userId, Number(req.body?.assetId));
  if (!scene || scene.kind !== 'image') return res.status(404).json({ error: 'Pick a generated scene from your library.' });
  let meta = {};
  try { meta = JSON.parse(scene.meta || 'null') || {}; } catch (_) {}
  if (!meta.prompt) return res.status(400).json({ error: 'Coverage works on generated scenes (it reuses the scene\'s prompt). This image has none.' });
  const shots = [...new Set((Array.isArray(req.body?.shots) ? req.body.shots : Object.keys(COVERAGE_SHOTS)).filter((s) => COVERAGE_SHOTS[s]))];
  if (!shots.length) return res.status(400).json({ error: 'Pick at least one shot type.' });
  if (db.getImageCount(req.userId, todayUTC()) + shots.length > DAILY_AI_IMAGE_LIMIT) {
    return res.status(429).json({ error: `Daily AI image cap (${DAILY_AI_IMAGE_LIMIT}) reached.` });
  }
  {
    const hasChar = !!(meta.castIds?.length || scene.character_id);
    const capMsg = overDailyCap(req.userId, estActionCost('image', { characterId: hasChar, count: shots.length }));
    if (capMsg) return res.status(429).json({ error: capMsg });
  }

  // drop any leading shot-type phrase so framings don't fight each other
  const base = meta.prompt.replace(/^an?\s+[\w -]*shot\s+(?:of\s+)?/i, '').trim();
  const characterIds = meta.castIds || (scene.character_id ? [scene.character_id] : []);
  try {
    const jobs = [];
    for (const shot of shots) {
      const prompt = `${COVERAGE_SHOTS[shot]} of this scene: ${base} Same setting, same people, same wardrobe, same lighting, the same moment in time - ONLY the camera framing changes.`;
      const built = await buildSceneModelInput(req.userId, {
        prompt, characterIds,
        imageSize: meta.imageSize, quality: meta.quality, locationId: meta.locationId,
      });
      const submitted = await falSubmit(built.model, built.input);
      jobs.push(createJob(req.userId, 'ai-image', {
        fal: {
          statusUrl: submitted.status_url,
          responseUrl: submitted.response_url,
          expect: 'image',
          label: `${scene.label.slice(0, 60)} · ${shot}`,
          characterId: built.character ? built.character.id : null,
          meta: { ...meta, source: 'fal', prompt: built.cleanPrompt, coverageOf: scene.id, shot },
        },
      }));
    }
    res.status(202).json({ jobs: jobs.map(jobJson) });
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
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

// ─── TELEPROMPTER SCRIPTS ──────────────────────────────────────────────────
// Scripts live on the server so the same ones are available on the computer
// that films and the phone that posts.
function scriptJson(row) {
  return { id: row.id, title: row.title, body: row.body, updatedAt: row.updated_at };
}
router.get('/scripts', (req, res) => {
  res.json({ scripts: db.getScripts(req.userId).map(scriptJson) });
});
router.post('/scripts', (req, res) => {
  const { title, body } = req.body || {};
  if (typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ error: 'Write the script first.' });
  }
  const id = db.createScript(
    req.userId,
    (typeof title === 'string' && title.trim() ? title.trim() : 'Untitled script').slice(0, 80),
    body.slice(0, 20000)
  );
  res.status(201).json({ id });
});
router.put('/scripts/:id', (req, res) => {
  const row = db.getScript(req.userId, Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Script not found.' });
  const { title, body } = req.body || {};
  if (typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ error: 'Write the script first.' });
  }
  db.updateScript(
    req.userId, row.id,
    (typeof title === 'string' && title.trim() ? title.trim() : row.title).slice(0, 80),
    body.slice(0, 20000)
  );
  res.json({ ok: true });
});
router.delete('/scripts/:id', (req, res) => {
  db.deleteScript(req.userId, Number(req.params.id));
  res.json({ ok: true });
});

// ─── SOCIAL SCHEDULER ──────────────────────────────────────────────────────
// TikTok/Meta/YouTube all require a weeks-long developer app review before
// they'll let a new app publish for real (TikTok posts land as private
// drafts, Meta needs App Review, YouTube uploads stay locked) - and even once
// approved, API-posted video is quietly ranked below native uploads on every
// one of these platforms. So this queue automates everything up to the tap
// that actually has to happen on the phone: it holds the caption + platform
// list + time, surfaces a loud "time to post" banner the moment it's due
// (even if the browser was closed when the time hit), and hands over the
// video file and a one-tap copy of the caption. A real per-platform
// publish() dispatcher can slot in later, once each platform's app review
// clears, without changing this schema or the UI around it.
const SOCIAL_PLATFORMS = new Set(['tiktok', 'youtube', 'instagram', 'facebook']);
function socialPostJson(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    platforms: JSON.parse(row.platforms || '[]'),
    caption: row.caption,
    scheduledAt: row.scheduled_at,
    status: row.status,
    postedPlatforms: JSON.parse(row.posted_platforms || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
router.post('/schedule', (req, res) => {
  const { assetId, platforms, caption, scheduledAt } = req.body || {};
  if (!Array.isArray(platforms) || !platforms.length || !platforms.every((p) => SOCIAL_PLATFORMS.has(p))) {
    return res.status(400).json({ error: 'platforms must include at least one of tiktok, youtube, instagram, facebook.' });
  }
  if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) {
    return res.status(400).json({ error: 'scheduledAt must be a valid date/time.' });
  }
  let cleanAssetId = null;
  if (assetId) {
    const asset = db.getAsset(req.userId, Number(assetId));
    if (!asset) return res.status(400).json({ error: 'That asset was not found in your library.' });
    cleanAssetId = asset.id;
  }
  const id = db.createSocialPost(req.userId, {
    assetId: cleanAssetId,
    platforms,
    caption: typeof caption === 'string' ? caption.slice(0, 2200) : '',
    scheduledAt: new Date(scheduledAt).toISOString(),
  });
  res.status(201).json({ id });
});
router.get('/schedule', (req, res) => {
  db.promoteDueSocialPosts();
  res.json({ posts: db.getSocialPosts(req.userId).map(socialPostJson) });
});
router.get('/schedule/due', (req, res) => {
  db.promoteDueSocialPosts();
  res.json({ posts: db.getDueSocialPosts(req.userId).map(socialPostJson) });
});
router.put('/schedule/:id', (req, res) => {
  const row = db.getSocialPost(req.userId, Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Post not found.' });
  const { platforms, caption, scheduledAt } = req.body || {};
  const fields = {};
  if (platforms !== undefined) {
    if (!Array.isArray(platforms) || !platforms.length || !platforms.every((p) => SOCIAL_PLATFORMS.has(p))) {
      return res.status(400).json({ error: 'platforms must include at least one valid platform.' });
    }
    fields.platforms = platforms;
  }
  if (caption !== undefined) fields.caption = String(caption).slice(0, 2200);
  if (scheduledAt !== undefined) {
    if (Number.isNaN(new Date(scheduledAt).getTime())) return res.status(400).json({ error: 'scheduledAt must be a valid date/time.' });
    fields.scheduledAt = new Date(scheduledAt).toISOString();
    // Editing the time on an already-due/posted item puts it back in the queue.
    if (row.status !== 'pending') fields.status = 'pending';
  }
  db.updateSocialPost(req.userId, row.id, fields);
  res.json({ ok: true });
});
router.delete('/schedule/:id', (req, res) => {
  db.deleteSocialPost(req.userId, Number(req.params.id));
  res.json({ ok: true });
});
// Marked posted after the founder does the native tap - platforms is which
// ones got done (lets a partial post - e.g. TikTok now, YouTube later - stay
// visible until every platform is checked off).
router.post('/schedule/:id/complete', (req, res) => {
  const row = db.getSocialPost(req.userId, Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Post not found.' });
  const { platforms } = req.body || {};
  const already = JSON.parse(row.posted_platforms || '[]');
  const target = JSON.parse(row.platforms || '[]');
  const newlyDone = Array.isArray(platforms) && platforms.length ? platforms.filter((p) => target.includes(p)) : target;
  const postedPlatforms = [...new Set([...already, ...newlyDone])];
  const allDone = target.every((p) => postedPlatforms.includes(p));
  db.updateSocialPost(req.userId, row.id, { postedPlatforms, status: allDone ? 'posted' : 'due' });
  res.json({ ok: true, done: allDone });
});
router.post('/schedule/:id/skip', (req, res) => {
  const row = db.getSocialPost(req.userId, Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Post not found.' });
  db.updateSocialPost(req.userId, row.id, { status: 'skipped' });
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

// Flips scheduled posts to 'due' the moment their time hits, independent of
// any browser being open - the web client just polls /schedule/due to raise
// the banner once it's back.
setInterval(() => { try { db.promoteDueSocialPosts(); } catch (_) {} }, 30000);

router.post('/animate', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'AI generation is not set up yet. Add FAL_KEY to server/.env (get one at fal.ai) and restart the server.' });
  }
  const { assetId, prompt, duration, tier, refAssetIds } = req.body || {};
  const still = db.getAsset(req.userId, Number(assetId));
  if (!still || still.kind !== 'image') {
    return res.status(404).json({ error: 'Pick an image from your library to animate.' });
  }
  // Reference photos attached → character-lock mode (reference-to-video model).
  const refIds = Array.isArray(refAssetIds) ? refAssetIds.map(Number).filter(Boolean).slice(0, 6) : [];
  const useRefs = refIds.length > 0;
  const chosenTier = useRefs ? 'reference' : (VIDEO_TIERS[tier] ? tier : 'standard');
  const model = useRefs ? MODEL_I2V_REF : VIDEO_TIERS[chosenTier].model;
  const seconds = [5, 10].includes(Number(duration)) ? Number(duration) : 5;
  if (db.getVideoCount(req.userId, todayUTC()) >= DAILY_AI_VIDEO_LIMIT) {
    return res.status(429).json({ error: `Daily AI video cap (${DAILY_AI_VIDEO_LIMIT}) reached. Raise STUDIO_DAILY_VIDEO_LIMIT in .env if this is really you.` });
  }
  const capMsg = overDailyCap(req.userId, estActionCost('video', { tier: chosenTier, seconds }));
  if (capMsg) return res.status(429).json({ error: capMsg });

  const motionPrompt = (typeof prompt === 'string' && prompt.trim())
    ? prompt.trim().slice(0, 1000)
    : 'subtle cinematic motion, natural movement, keep the subject consistent';

  try {
    let input;
    if (useRefs) {
      // Feed the still plus the character reference photos (scaled down to keep
      // the payload light) so the model locks the character's look.
      const refUris = [];
      for (const id of refIds) {
        const r = db.getAsset(req.userId, id);
        if (r && r.kind === 'image') refUris.push(await scaledRefDataUri(r.filename));
      }
      const reference_image_urls = [fileToDataUri(still.filename), ...refUris.filter(Boolean)].slice(0, 7);
      input = { prompt: motionPrompt, reference_image_urls };
    } else {
      input = { prompt: motionPrompt, image_url: fileToDataUri(still.filename), duration: String(seconds) };
      // State the resolution rather than inheriting the model's default. Wan's
      // default is its most expensive one (1080p), which is how a $0.25 button
      // ran up a $0.75 charge; a tier that names a resolution now gets it.
      const tierCfg = VIDEO_TIERS[chosenTier];
      if (tierCfg && tierCfg.resolution) input.resolution = tierCfg.resolution;
    }
    const submitted = await falSubmit(model, input);
    const job = createJob(req.userId, 'ai-video', {
      fal: {
        statusUrl: submitted.status_url,
        responseUrl: submitted.response_url,
        expect: 'video',
        label: useRefs ? `${still.label} · locked` : still.label,
        characterId: still.character_id,
        meta: { source: 'fal', model, tier: chosenTier, prompt: motionPrompt, fromAssetId: still.id, seconds, resolution: input.resolution, refCount: refIds.length || undefined },
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
// opts.job lets a caller that had async work to do first (parallax has to
// build a depth map) create the job up front, answer the request, and then
// hand the same job here rather than opening a second one the client
// isn't watching.
function spawnFfmpegJob(userId, args, outFile, expectedDur, label, meta, kind = 'video', opts) {
  const job = (opts && opts.job) || createJob(userId, 'render', {});
  const outPath = mediaPath(outFile);
  const cleanup = () => {
    for (const f of (opts && opts.cleanupFiles) || []) { try { fs.unlinkSync(f); } catch (_) {} }
  };
  // opts.cwd lets a filter reference a side file (e.g. a generated .ass subtitle
  // file) by bare relative name - no cross-platform path escaping in the graph.
  const proc = spawn(ffmpegBin(), args.concat(['-y', outPath]), opts && opts.cwd ? { cwd: opts.cwd } : undefined);
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
    cleanup();
    job.status = 'error';
    job.error = `Could not start ffmpeg: ${err.message}. Run npm install in server/ (or install ffmpeg / set FFMPEG_PATH).`;
  });
  proc.on('close', (code) => {
    cleanup();
    if (job.status === 'error') return;
    if (code === 0) {
      job.assetId = db.createAsset(userId, kind, label, outFile, null, { ...meta, duration: expectedDur });
      job.progress = 100;
      job.status = 'done';
    } else {
      try { fs.unlinkSync(outPath); } catch (_) {}
      job.status = 'error';
      // The last 500 characters are usually the encoder giving up, not the
      // reason. Lead with the first real error line in the tail — that's the
      // one that says what ffmpeg actually objected to.
      const firstErr = (stderrTail.match(/^.*(?:Error|Invalid|No such|Failed|Cannot|Unable).*$/mi) || [])[0];
      job.error = `ffmpeg exited with code ${code}: ${firstErr ? firstErr.trim() + ' … ' : ''}${stderrTail.slice(-700)}`;
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
  const { assetId, aspect, keep, zoom, corner } = req.body || {};
  const src = db.getAsset(req.userId, Number(assetId));
  if (!src || src.kind !== 'image') return res.status(404).json({ error: 'Pick a photo from your library to crop.' });

  // Two modes:
  //  (a) aspect crop  — cut to a target shape (9:16, 1:1, ...), keeping start/center/end.
  //  (b) zoom crop    — keep the SAME shape, zoom in by a % and push toward a corner so
  //                     whatever sits in the opposite corner (e.g. a corner watermark /
  //                     sparkle) falls outside the frame. This is what removes a corner
  //                     mark from an already-9:16 still without changing its shape.
  const isZoom = zoom !== undefined && zoom !== null && zoom !== '';
  let filter, tag, cropMeta;
  if (isZoom) {
    let z = Number(zoom);
    if (!Number.isFinite(z)) return res.status(400).json({ error: 'zoom must be a number' });
    z = Math.min(0.4, Math.max(0.04, z)); // clamp 4%–40%
    const keepFrac = 1 - z;
    // Which corner do we KEEP? To erase a mark in the bottom-right, keep the top-left,
    // so the crop window hugs the opposite corner. corner = where the MARK is.
    const c = ['tl', 'tr', 'bl', 'br'].includes(corner) ? corner : 'br';
    const keepLeft = c === 'tr' || c === 'br';   // mark on the right → keep the left
    const keepTop = c === 'bl' || c === 'br';    // mark on the bottom → keep the top
    const fx = keepLeft ? 0 : 1;
    const fy = keepTop ? 0 : 1;
    filter = `crop=iw*${keepFrac}:ih*${keepFrac}:(iw-ow)*${fx}:(ih-oh)*${fy}`;
    tag = `${src.label} · mark-free`;
    cropMeta = { cornerCrop: c, zoom: z };
  } else {
    const R = CROP_ASPECTS[aspect];
    if (!R) return res.status(400).json({ error: `aspect must be one of ${Object.keys(CROP_ASPECTS).join(', ')}` });
    const f = keep === 'start' ? 0 : keep === 'end' ? 1 : 0.5;
    filter = `crop=min(iw\\,ih*${R}):min(ih\\,iw/${R}):(iw-ow)*${f}:(ih-oh)*${f}`;
    tag = `${src.label} · ${aspect} crop`;
    cropMeta = { crop: aspect };
  }

  const ext = path.extname(src.filename).toLowerCase() || '.png';
  const outFile = newFilename(req.userId, ext);
  const proc = spawn(ffmpegBin(), ['-y', '-i', mediaPath(src.filename), '-vf', filter, '-frames:v', '1', mediaPath(outFile)]);
  proc.on('error', (err) => res.status(500).json({ error: `Could not start ffmpeg: ${err.message}` }));
  proc.on('close', (code) => {
    if (code !== 0 || !fs.existsSync(mediaPath(outFile))) {
      return res.status(500).json({ error: 'Cropping failed — is that file really an image?' });
    }
    let srcMeta = {};
    try { srcMeta = JSON.parse(src.meta || 'null') || {}; } catch (_) {}
    const id = db.createAsset(req.userId, 'image', tag, outFile, src.character_id || null, {
      ...(srcMeta.source ? { source: srcMeta.source } : {}),
      ...(srcMeta.prompt ? { prompt: srcMeta.prompt } : {}),
      ...cropMeta,
      fromAssetId: src.id,
    });
    res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
  });
});

/* ---------------- free local watermark remover (patch it out) ---------------- */
// Removes a small corner mark (e.g. the Gemini sparkle) from the artist's OWN
// image by interpolating the surrounding pixels over it — ffmpeg's `delogo`.
// Pure ffmpeg, free, instant, keeps the FULL frame (nothing cropped). Intended
// for cleaning a provider's decorative sparkle off your own generated art; it
// cannot touch invisible watermarks (SynthID) and isn't for other people's work.
const MARK_BOXES = {
  // fractional x, y, w, h of the patch box, per corner. Tightened to hug a small
  // corner sparkle (a big box makes delogo smear a big smooth blob). Insets from
  // the edge so delogo always has a border of real pixels to sample from.
  br: { x: 0.76, y: 0.83, w: 0.20, h: 0.14 },
  bl: { x: 0.04, y: 0.83, w: 0.20, h: 0.14 },
  tr: { x: 0.76, y: 0.03, w: 0.20, h: 0.14 },
  tl: { x: 0.04, y: 0.03, w: 0.20, h: 0.14 },
};
const MARK_SIZES = { small: 0.65, medium: 1.0, large: 1.5 };
router.post('/cleanmark', async (req, res) => {
  const { assetId, corner, size, blend } = req.body || {};
  const src = db.getAsset(req.userId, Number(assetId));
  if (!src || src.kind !== 'image') return res.status(404).json({ error: 'Pick a photo from your library to clean.' });
  const c = MARK_BOXES[corner] ? corner : 'br';
  const box = MARK_BOXES[c];
  const k = MARK_SIZES[size] || 1.0;
  // Scale the box around its own center by k, then re-clamp inside a safe border.
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  let bw = box.w * k, bh = box.h * k;
  let bx = cx - bw / 2, by = cy - bh / 2;
  bx = Math.max(0.006, bx); by = Math.max(0.006, by);
  bw = Math.min(bw, 0.988 - bx); bh = Math.min(bh, 0.988 - by);

  // delogo needs constant integer pixels (it does NOT accept iw/ih expressions),
  // so read the real dimensions first and compute an even, in-bounds box that
  // always leaves a >=1px border of real pixels for delogo to interpolate from.
  const dim = await probeDimensions(mediaPath(src.filename));
  if (!dim) return res.status(500).json({ error: "Couldn't read that image's size — try a PNG or JPG." });
  const { w: iw, h: ih } = dim;
  let X = Math.max(1, Math.floor(iw * bx));
  let Y = Math.max(1, Math.floor(ih * by));
  let W = Math.min(iw - 2 - X, Math.floor(iw * bw));
  let H = Math.min(ih - 2 - Y, Math.floor(ih * bh));
  W = Math.max(8, W); H = Math.max(8, H);

  // Two-stage clean-up so it doesn't leave a tell-tale smooth blob:
  //   1) delogo interpolates the sparkle away (leaves a smooth patch).
  //   2) unless disabled, sprinkle fine grain back over JUST that patch so it
  //      matches the surrounding photo texture instead of reading as a blur.
  const useBlend = blend === undefined ? true : !!blend;
  const ext = path.extname(src.filename).toLowerCase() || '.png';
  const outFile = newFilename(req.userId, ext);
  const args = ['-y', '-i', mediaPath(src.filename)];
  if (useBlend) {
    const fc =
      `[0:v]delogo=x=${X}:y=${Y}:w=${W}:h=${H},split=2[base][src];` +
      `[src]crop=${W}:${H}:${X}:${Y},noise=alls=7:allf=u[gp];` +
      `[base][gp]overlay=${X}:${Y}`;
    args.push('-filter_complex', fc);
  } else {
    args.push('-vf', `delogo=x=${X}:y=${Y}:w=${W}:h=${H}`);
  }
  args.push('-frames:v', '1', mediaPath(outFile));
  const proc = spawn(ffmpegBin(), args);
  proc.on('error', (err) => res.status(500).json({ error: `Could not start ffmpeg: ${err.message}` }));
  proc.on('close', (code) => {
    if (code !== 0 || !fs.existsSync(mediaPath(outFile))) {
      return res.status(500).json({ error: 'Clean-up failed — is that file really an image?' });
    }
    let srcMeta = {};
    try { srcMeta = JSON.parse(src.meta || 'null') || {}; } catch (_) {}
    const id = db.createAsset(req.userId, 'image', `${src.label} · mark-free`, outFile, src.character_id || null, {
      ...(srcMeta.source ? { source: srcMeta.source } : {}),
      ...(srcMeta.prompt ? { prompt: srcMeta.prompt } : {}),
      cleanMark: c,
      fromAssetId: src.id,
    });
    res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
  });
});

/* ---------------- free local transforms: mirror / slow-mo / freeze ---------------- */
// All pure ffmpeg, zero AI cost. Reuse-focused: flip a shot for variety, slow it
// for drama (also DOUBLES its length to help fill a song), or grab a still from a
// clip. Originals are never touched — each makes a new library asset.
router.post('/transform', async (req, res) => {
  const { assetId, op } = req.body || {};
  const src = db.getAsset(req.userId, Number(assetId));
  if (!src) return res.status(404).json({ error: 'Pick an item from your library first.' });
  const srcPath = mediaPath(src.filename);
  let srcMeta = {}; try { srcMeta = JSON.parse(src.meta || 'null') || {}; } catch (_) {}
  const carry = {
    ...(srcMeta.source ? { source: srcMeta.source } : {}),
    ...(srcMeta.prompt ? { prompt: srcMeta.prompt } : {}),
    fromAssetId: src.id,
  };
  const enc = ['-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

  try {
    // COLOUR PRESET (b0848) — one-tap grade for a picture or clip. Pictures
    // stay pictures (the whole point is a graded still you can then move),
    // clips stay clips and keep their sound. Free: it is a filter, nothing
    // is generated. Mirrors the mirror/slowmo ops exactly - images finish
    // inline, video goes through the job queue so long clips report progress.
    if (op === 'grade') {
      const key = COLOR_PRESETS[req.body.preset] ? req.body.preset : 'teal_orange';
      const preset = COLOR_PRESETS[key];
      if (!preset.vf) return res.status(400).json({ error: 'That preset leaves the picture unchanged.' });
      const label = `${src.label} · ${preset.label}`;
      const meta = { ...carry, transform: 'grade', preset: key };
      if (src.kind === 'image') {
        const ext = path.extname(src.filename).toLowerCase() || '.png';
        const outFile = newFilename(req.userId, ext);
        const proc = spawn(ffmpegBin(), ['-y', '-i', srcPath, '-vf', preset.vf, '-frames:v', '1', mediaPath(outFile)]);
        proc.on('error', (e) => res.status(500).json({ error: `ffmpeg: ${e.message}` }));
        proc.on('close', (code) => {
          if (code !== 0 || !fs.existsSync(mediaPath(outFile))) return res.status(500).json({ error: 'Could not apply that colour preset.' });
          const id = db.createAsset(req.userId, 'image', label, outFile, src.character_id || null, meta);
          res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
        });
        return;
      }
      if (src.kind === 'video') {
        const dur = srcMeta.duration || await probeMediaDuration(srcPath);
        const hasAudio = await probeHasAudio(srcPath);
        const outFile = newFilename(req.userId, '.mp4');
        const args = ['-i', srcPath, '-vf', preset.vf, ...(hasAudio ? ['-c:a', 'copy'] : ['-an']), ...enc];
        const job = spawnFfmpegJob(req.userId, args, outFile, dur, label, meta);
        return res.status(202).json({ job: jobJson(job) });
      }
      return res.status(400).json({ error: 'Colour presets work on pictures and clips.' });
    }

    // MIRROR — image or video, horizontal flip
    if (op === 'mirror') {
      if (src.kind === 'image') {
        const ext = path.extname(src.filename).toLowerCase() || '.png';
        const outFile = newFilename(req.userId, ext);
        const proc = spawn(ffmpegBin(), ['-y', '-i', srcPath, '-vf', 'hflip', '-frames:v', '1', mediaPath(outFile)]);
        proc.on('error', (e) => res.status(500).json({ error: `ffmpeg: ${e.message}` }));
        proc.on('close', (code) => {
          if (code !== 0 || !fs.existsSync(mediaPath(outFile))) return res.status(500).json({ error: 'Mirror failed.' });
          const id = db.createAsset(req.userId, 'image', `${src.label} · mirrored`, outFile, src.character_id || null, { ...carry, transform: 'mirror' });
          res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
        });
        return;
      }
      if (src.kind === 'video') {
        const dur = srcMeta.duration || await probeMediaDuration(srcPath);
        const hasAudio = await probeHasAudio(srcPath);
        const outFile = newFilename(req.userId, '.mp4');
        const args = ['-i', srcPath, '-vf', 'hflip', ...(hasAudio ? ['-c:a', 'copy'] : ['-an']), ...enc];
        const job = spawnFfmpegJob(req.userId, args, outFile, dur, `${src.label} · mirrored`, { ...carry, transform: 'mirror' });
        return res.status(202).json({ job: jobJson(job) });
      }
      return res.status(400).json({ error: 'Mirror works on pictures and clips.' });
    }

    // SLOW MOTION — video only, 0.5x (audio dropped; your song carries the sound)
    if (op === 'slowmo') {
      if (src.kind !== 'video') return res.status(400).json({ error: 'Slow motion is for video clips.' });
      const dur = srcMeta.duration || await probeMediaDuration(srcPath);
      const outFile = newFilename(req.userId, '.mp4');
      const args = ['-i', srcPath, '-vf', 'setpts=2.0*PTS', '-an', ...enc];
      const job = spawnFfmpegJob(req.userId, args, outFile, dur ? dur * 2 : null, `${src.label} · slow-mo`, { ...carry, transform: 'slowmo' });
      return res.status(202).json({ job: jobJson(job) });
    }

    // FREEZE FRAME — grab a still from a clip (reuse a video moment as a picture)
    if (op === 'freeze') {
      if (src.kind !== 'video') return res.status(400).json({ error: 'Freeze-frame grabs a still from a video clip.' });
      const outFile = newFilename(req.userId, '.png');
      const proc = spawn(ffmpegBin(), ['-y', '-sseof', '-0.2', '-i', srcPath, '-frames:v', '1', mediaPath(outFile)]);
      proc.on('error', (e) => res.status(500).json({ error: `ffmpeg: ${e.message}` }));
      proc.on('close', (code) => {
        if (code !== 0 || !fs.existsSync(mediaPath(outFile))) return res.status(500).json({ error: 'Freeze-frame failed.' });
        const id = db.createAsset(req.userId, 'image', `${src.label} · freeze`, outFile, src.character_id || null, { ...carry, transform: 'freeze' });
        res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
      });
      return;
    }

    // CLEAN UP AUDIO — free narration/voice cleanup: de-rumble, denoise, normalize
    // loudness. Great for phone-recorded narration (DBC) before it goes in a video.
    if (op === 'cleanaudio') {
      const AUDIO_CHAIN = 'highpass=f=90,afftdn=nf=-25,loudnorm=I=-16:TP=-1.5:LRA=11';
      if (src.kind === 'audio') {
        const dur = srcMeta.duration || await probeMediaDuration(srcPath);
        const outFile = newFilename(req.userId, '.m4a');
        const args = ['-i', srcPath, '-af', AUDIO_CHAIN, '-c:a', 'aac', '-b:a', '192k'];
        const job = spawnFfmpegJob(req.userId, args, outFile, dur, `${src.label} · cleaned`, { ...carry, transform: 'cleanaudio' }, 'audio');
        return res.status(202).json({ job: jobJson(job) });
      }
      if (src.kind === 'video') {
        if (!(await probeHasAudio(srcPath))) return res.status(400).json({ error: 'That clip has no sound to clean up.' });
        const dur = srcMeta.duration || await probeMediaDuration(srcPath);
        const outFile = newFilename(req.userId, '.mp4');
        const args = ['-i', srcPath, '-c:v', 'copy', '-af', AUDIO_CHAIN, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'];
        const job = spawnFfmpegJob(req.userId, args, outFile, dur, `${src.label} · cleaned`, { ...carry, transform: 'cleanaudio' });
        return res.status(202).json({ job: jobJson(job) });
      }
      return res.status(400).json({ error: 'Clean-up audio works on songs, narration, or video clips with sound.' });
    }

    // REMASTER — full "make it sound professional" pass, then export a
    // streaming-standard 48 kHz / 24-bit WAV that uploads anywhere. The chain,
    // in order: repair clicks/pops (adeclick) and clipping distortion (adeclip),
    // cut sub-rumble (highpass), reduce background hiss/noise (afftdn), tame
    // harsh 's' sounds (deesser), glue the dynamics (acompressor), then match
    // loudness to -14 LUFS with a -1 dBTP true-peak ceiling (loudnorm). Free.
    if (op === 'remaster') {
      const MASTER_CHAIN = 'adeclick,adeclip,highpass=f=35,afftdn=nf=-25,deesser,acompressor=threshold=-16dB:ratio=2.5:attack=20:release=250,loudnorm=I=-14:TP=-1.0:LRA=11';
      if (src.kind === 'audio' || src.kind === 'video') {
        if (src.kind === 'video' && !(await probeHasAudio(srcPath))) return res.status(400).json({ error: 'That clip has no sound to remaster.' });
        const dur = srcMeta.duration || await probeMediaDuration(srcPath);
        const outFile = newFilename(req.userId, '.wav');
        // -vn drops any video; 24-bit PCM at 48 kHz
        const args = ['-i', srcPath, '-vn', '-af', MASTER_CHAIN, '-ar', '48000', '-c:a', 'pcm_s24le'];
        const job = spawnFfmpegJob(req.userId, args, outFile, dur, `${src.label} · mastered 48k`, { ...carry, transform: 'remaster' }, 'audio');
        return res.status(202).json({ job: jobJson(job) });
      }
      return res.status(400).json({ error: 'Remaster works on songs or clips with sound.' });
    }

    // POLISH — one-tap "make it look finished" pass for a rendered video: a
    // gentle cinematic color grade (lift contrast + saturation a touch, tiny
    // brightness lift), a light sharpen for crispness, and — if it has sound —
    // a loudness master so it plays as loud and balanced as commercial music
    // video. Free, no AI. Makes a new copy; the original stays.
    if (op === 'polish') {
      if (src.kind !== 'video') return res.status(400).json({ error: 'Polish is for a finished video (render your timeline first, then polish the result).' });
      const dur = srcMeta.duration || await probeMediaDuration(srcPath);
      const hasAudio = await probeHasAudio(srcPath);
      const grade = 'eq=contrast=1.06:saturation=1.12:brightness=0.02,unsharp=5:5:0.5:5:5:0.0';
      const outFile = newFilename(req.userId, '.mp4');
      const args = ['-i', srcPath, '-vf', grade,
        ...(hasAudio ? ['-af', 'loudnorm=I=-14:TP=-1.0:LRA=11', '-c:a', 'aac', '-b:a', '192k'] : ['-an']),
        ...enc];
      const job = spawnFfmpegJob(req.userId, args, outFile, dur, `${src.label} · polished`, { ...carry, transform: 'polish' });
      return res.status(202).json({ job: jobJson(job) });
    }

    // LOOK THEMES — one-tap whole-video color grades (like CapCut filters).
    // Each is a themed grade + sharpen; audio is preserved. Free, no AI.
    if (op === 'grade') {
      if (src.kind !== 'video') return res.status(400).json({ error: 'Look themes apply to a video (render first, then pick a look).' });
      const GRADE_THEMES = {
        luxury: 'eq=contrast=1.12:saturation=0.9:brightness=-0.02,colorbalance=rh=0.04:bh=-0.03,unsharp=5:5:0.4:5:5:0',
        neon: 'eq=contrast=1.12:saturation=1.35,colorbalance=bs=0.12:rm=-0.04:bh=0.06,unsharp=5:5:0.5:5:5:0',
        cinematic: 'eq=contrast=1.12:saturation=1.02,colorbalance=rm=0.06:bs=0.06:rh=0.03:bh=-0.03,unsharp=5:5:0.4:5:5:0',
        warm: 'eq=contrast=1.05:saturation=1.1:brightness=0.02,colorbalance=rm=0.08:bm=-0.05',
        bw: 'hue=s=0,eq=contrast=1.14:brightness=0.01,unsharp=5:5:0.5:5:5:0',
        vibrant: 'eq=contrast=1.08:saturation=1.32,unsharp=5:5:0.5:5:5:0',
      };
      const theme = GRADE_THEMES[req.body.theme] ? req.body.theme : 'cinematic';
      const dur = srcMeta.duration || await probeMediaDuration(srcPath);
      const hasAudio = await probeHasAudio(srcPath);
      const outFile = newFilename(req.userId, '.mp4');
      const args = ['-i', srcPath, '-vf', GRADE_THEMES[theme], ...(hasAudio ? ['-c:a', 'copy'] : ['-an']), ...enc];
      const job = spawnFfmpegJob(req.userId, args, outFile, dur, `${src.label} · ${theme} look`, { ...carry, transform: 'grade', theme });
      return res.status(202).json({ job: jobJson(job) });
    }

    // MOTION BLUR — averages neighboring frames (tmix) so fast motion smears
    // into a silky cinematic blur, and hard cuts/jumps read softer. Same length,
    // audio preserved. Free, no AI.
    if (op === 'motionblur') {
      if (src.kind !== 'video') return res.status(400).json({ error: 'Motion blur is for video clips.' });
      const dur = srcMeta.duration || await probeMediaDuration(srcPath);
      const hasAudio = await probeHasAudio(srcPath);
      const strength = [2, 3, 4, 5].includes(Number(req.body.strength)) ? Number(req.body.strength) : 3;
      const outFile = newFilename(req.userId, '.mp4');
      const args = ['-i', srcPath, '-vf', `tmix=frames=${strength}`, ...(hasAudio ? ['-c:a', 'copy'] : ['-an']), ...enc];
      const job = spawnFfmpegJob(req.userId, args, outFile, dur, `${src.label} · motion blur`, { ...carry, transform: 'motionblur' });
      return res.status(202).json({ job: jobJson(job) });
    }

    // REFRAME — turn any clip/photo into a vertical Short (9:16), Square (1:1),
    // or Wide (16:9). 'fill' crops to fill the frame (subject-centered); 'blur'
    // fits the whole shot with a blurred zoom behind it (nothing cropped). Free.
    if (op === 'reframe') {
      const DIMS = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080] };
      const target = DIMS[req.body.target] ? req.body.target : '9:16';
      const [W, H] = DIMS[target];
      const mode = req.body.mode === 'blur' ? 'blur' : 'fill';
      const fill = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
      const blur = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=20,setsar=1[bg];[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1`;
      const vArgs = mode === 'blur' ? ['-filter_complex', blur] : ['-vf', fill];
      const tag = `${src.label} · ${target}`;
      if (src.kind === 'image') {
        const outFile = newFilename(req.userId, '.jpg');
        const proc = spawn(ffmpegBin(), ['-y', '-i', srcPath, ...vArgs, '-frames:v', '1', '-q:v', '3', mediaPath(outFile)]);
        proc.on('error', (e) => res.status(500).json({ error: `ffmpeg: ${e.message}` }));
        proc.on('close', (code) => {
          if (code !== 0 || !fs.existsSync(mediaPath(outFile))) return res.status(500).json({ error: 'Reframe failed.' });
          const id = db.createAsset(req.userId, 'image', tag, outFile, src.character_id || null, { ...carry, transform: 'reframe', reframe: target });
          res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
        });
        return;
      }
      if (src.kind === 'video') {
        const dur = srcMeta.duration || await probeMediaDuration(srcPath);
        const hasAudio = await probeHasAudio(srcPath);
        const outFile = newFilename(req.userId, '.mp4');
        const args = ['-i', srcPath, ...vArgs, ...(hasAudio ? ['-c:a', 'copy'] : ['-an']), ...enc];
        const job = spawnFfmpegJob(req.userId, args, outFile, dur, tag, { ...carry, transform: 'reframe', reframe: target });
        return res.status(202).json({ job: jobJson(job) });
      }
      return res.status(400).json({ error: 'Reframe works on photos and clips.' });
    }

    // DYNAMICS — CapCut-style one-tap effect templates for a whole clip:
    // beat-timed hits (B/W strobe, thermal flips, glow pulses, white flashes)
    // built from ffmpeg timeline filters. Length and sound stay untouched, so
    // a clip that's already cut to a song keeps its sync. The "beat" option
    // sets how often the hits land. Free, no AI.
    if (op === 'dynamics') {
      if (src.kind !== 'video' && src.kind !== 'image') return res.status(400).json({ error: 'Dynamics templates work on video clips and pictures.' });
      // A picture becomes a short clip first (looped still, capped at 1920px),
      // then goes through the exact same effect chains as a video.
      const isImg = src.kind === 'image';
      const secs = isImg ? ([4, 6, 8, 10, 15].includes(Number(req.body.secs)) ? Number(req.body.secs) : 8) : null;
      const b = [1, 2, 4].includes(Number(req.body.beat)) ? Number(req.body.beat) : 2;
      const c = b * 4; // Beat Mix rotates through a 4-slot cycle
      const seg = (from, to) => `enable='between(mod(t,${c}),${from * b},${to * b})'`;
      // A short white pop at the top of every beat - the "hit" that sells the cut.
      const flash = `eq=brightness='if(lt(mod(t,${b}),0.09),0.38,0)'`;
      // Length is needed by the templates that ramp across the whole clip,
      // so it is resolved before the table rather than after it.
      const dur = isImg ? secs : (srcMeta.duration || await probeMediaDuration(srcPath));
      const DYNAMICS = {
        beatmix: { label: 'Beat Mix', vf: [
          `hue=s=0:${seg(1, 2)}`, `eq=contrast=1.25:${seg(1, 2)}`,
          `hue=s=0:${seg(2, 3)}`, `pseudocolor=preset=inferno:${seg(2, 3)}`,
          `gblur=sigma=8:${seg(3, 4)}`, `eq=brightness=0.05:saturation=1.3:${seg(3, 4)}`,
          flash,
        ].join(',') },
        strobe: { label: 'B/W Strobe', vf: [`hue=s=0:enable='lt(mod(t,${b * 2}),${b})'`, 'eq=contrast=1.2', flash].join(',') },
        colorflip: { label: 'Color Flip', vf: [`hue=h=270:s=2.5:enable='gte(mod(t,${b * 2}),${b})'`, `eq=contrast=1.15:enable='gte(mod(t,${b * 2}),${b})'`, flash].join(',') },
        thermal: { label: 'Thermal', vf: 'hue=s=0,pseudocolor=preset=inferno' },
        // gbrp round-trip: blend in YUV screens the chroma planes too and the
        // whole clip goes magenta - blend must happen in RGB.
        glow: { label: 'Glow Up', fc: '[0:v]format=gbrp,split[a][b];[b]gblur=sigma=18[g];[a][g]blend=all_mode=screen:all_opacity=0.5,format=yuv420p[v]' },
        // planes=1 keeps the trail on luma only; trailing chroma burns colors out.
        trails: { label: 'Echo Trails', vf: 'lagfun=decay=0.95:planes=1,eq=contrast=1.05' },
        shake: { label: 'Hype Shake', vf: [`crop=w='floor(iw*0.94/2)*2':h='floor(ih*0.94/2)*2':x='(iw-ow)/2+(iw*0.02)*sin(t*19)':y='(ih-oh)/2+(ih*0.015)*cos(t*23)'`, flash].join(',') },
        mirror: { label: 'Mirror World', fc: "[0:v]crop=w='floor(iw/2)':h=ih:x=0:y=0,split[l1][l2];[l2]hflip[r];[l1][r]hstack[v]" },
        countdown: { label: '3-2-1 Opener' },

        // ── b0848. `capcut templates` is 22,200 searches a month at difficulty
        // 27 - bigger than every individual effect term put together - so the
        // next ten are templates rather than more filters. Named for the
        // occasion you'd reach for them, not for what they do technically.
        // MOMENT — a held breath: desaturates and darkens toward the middle,
        // then blooms back. For the line you want people to sit with.
        moment: { label: 'The Moment', fc:
          `[0:v]format=gbrp,split[ma][mb];[mb]gblur=sigma=14[mg];[ma][mg]blend=all_mode=screen:all_opacity=0.30,`
          + `eq=saturation='0.55+0.45*abs(2*t/${dur}-1)':eval=frame:contrast=1.12,vignette=PI/4.5,format=yuv420p[v]` },
        // CONFESSION — quiet, close, slightly cold. The look for a talking head
        // saying something hard.
        confession: { label: 'Confession', vf: "eq=saturation=0.72:contrast=1.14:brightness=-0.02,colortemperature=temperature=7200,vignette=PI/4" },
        // MEMORY — a warm faded past. Sits under a voiceover about before.
        memory: { label: 'Memory', vf: "curves=all='0/0.10 0.5/0.52 1/0.92',eq=saturation=0.68,colortemperature=temperature=5200,noise=alls=9:allf=t,vignette=PI/5" },
        // MORNING AFTER — flat, grey, over-bright. The hangxiety look.
        morningafter: { label: 'Morning After', vf: "eq=saturation=0.6:contrast=0.92:brightness=0.07,colortemperature=temperature=7800,gblur=sigma=1.4" },
        // NIGHT DRIVE — deep blue, high contrast, lights blooming.
        nightdrive: { label: 'Night Drive', fc:
          "[0:v]format=gbrp,split[na][nb];[nb]curves=all='0/0 0.62/0.85 1/1',gblur=sigma=20[ng];[na][ng]blend=all_mode=screen:all_opacity=0.38,"
          + "colorbalance=bs=0.20:bh=0.12:rs=-0.06,eq=contrast=1.28:saturation=1.15,format=yuv420p[v]" },
        // COUNTDOWN PULSE — a slow throb on the beat. Under a list or a build.
        throb: { label: 'Slow Throb', vf: [`eq=brightness='0.05*sin(t*${(6.28318 / (b * 2)).toFixed(4)})':contrast=1.08`, `vignette='PI/4+0.12*sin(t*${(6.28318 / (b * 2)).toFixed(4)})':eval=frame`].join(',') },
        // RECEIPT — hard, clinical, blue-white. For numbers and evidence shots.
        receipt: { label: 'The Receipt', vf: "eq=saturation=0.35:contrast=1.35:brightness=0.04,colortemperature=temperature=8600,unsharp=5:5:0.9:5:5:0" },
        // FIRST LIGHT — cold open warming through to gold. An ending shot.
        firstlight: { label: 'First Light', vf: `colortemperature=temperature=6100,eq=saturation='0.72+0.42*min(1,t/${dur})':eval=frame:contrast='1.02+0.08*min(1,t/${dur})'` },
        // DOORWAY — vignette closing slowly inward. Endings, or a title card.
        doorway: { label: 'Doorway', vf: `vignette=a='PI/5+0.55*min(1,t/${dur})':eval=frame,eq=contrast=1.1` },
        // HANDHELD — a documentary wobble with a touch of grain. Makes a still
        // picture feel filmed rather than posed.
        handheld: { label: 'Handheld', vf: [
          `crop=w='floor(iw*0.96/2)*2':h='floor(ih*0.96/2)*2':x='(iw-ow)/2+(iw*0.012)*sin(t*2.7)+(iw*0.006)*sin(t*5.1)':y='(ih-oh)/2+(ih*0.010)*cos(t*2.1)+(ih*0.005)*cos(t*4.3)'`,
          'noise=alls=6:allf=t', 'eq=contrast=1.04',
        ].join(',') },
      };
      // TIME MACHINE - first half plays as a worn old photo/film (sepia, grain,
      // vignette, faded), a white flash hits at the middle, and the second half
      // comes back sharper and more vibrant than the original. The switch point
      // follows the real length, so it works on any clip or picture duration.
      const H2 = Math.max(1, Math.round(((dur || 8) / 2) * 100) / 100);
      DYNAMICS.timemachine = { label: 'Time Machine', vf: [
        `colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:0:enable='lt(t,${H2})'`,
        `noise=alls=16:allf=t+u:enable='lt(t,${H2})'`,
        `vignette=enable='lt(t,${H2})'`,
        `eq=contrast=0.92:brightness=-0.04:enable='lt(t,${H2})'`,
        `eq=contrast=1.14:saturation=1.4:enable='gte(t,${H2})'`,
        `unsharp=5:5:0.6:5:5:0:enable='gte(t,${H2})'`,
        `eq=brightness='if(between(t,${H2 - 0.05},${H2 + 0.12}),0.55,0)'`,
      ].join(',') };
      const key = DYNAMICS[req.body.template] ? req.body.template : 'beatmix';
      const tpl = DYNAMICS[key];
      const hasAudio = isImg ? false : await probeHasAudio(srcPath);
      const meta = { ...carry, transform: 'dynamics', template: key, beat: b, ...(isImg ? { secs } : {}) };
      const label = `${src.label} · ${tpl.label}`;
      const outFile = newFilename(req.userId, '.mp4');
      // Image path: loop the still into a clip, cap the long side at 1920px,
      // force even dims and a real frame rate so every chain behaves like video.
      const inArgs = isImg ? ['-loop', '1', '-t', String(secs), '-i', srcPath] : ['-i', srcPath];
      const pre = isImg ? "scale=w='trunc(iw*min(1,1920/max(iw,ih))/2)*2':h='trunc(ih*min(1,1920/max(iw,ih))/2)*2',fps=30,format=yuv420p," : '';

      if (key === 'countdown') {
        // Big 3-2-1 numbers over the first three seconds, via the same ASS
        // subtitle path the caption renderer uses (PlayRes matches the real
        // pixel size so the number scales with the clip).
        const dims = (await probeDimensions(srcPath)) || { w: 1080, h: 1920 };
        const fontSize = Math.round(Math.min(dims.w, dims.h) * 0.6);
        const outlineW = Math.max(6, Math.round(fontSize / 26));
        const num = (n, from) => `Dialogue: 0,0:00:0${from}.00,0:00:0${from + 1}.00,Num,,0,0,0,,{\\fad(50,150)\\t(0,200,\\fscx115\\fscy115)}${n}`;
        const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${dims.w}\nPlayResY: ${dims.h}\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Num,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,${outlineW},4,5,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${num(3, 0)}\n${num(2, 1)}\n${num(1, 2)}\n`;
        const assFile = `dyn-${req.userId}-${Date.now()}.ass`;
        fs.writeFileSync(path.join(os.tmpdir(), assFile), ass);
        const args = [...inArgs, '-vf', `${pre}subtitles=${assFile}`, ...(hasAudio ? ['-c:a', 'copy'] : ['-an']), ...enc];
        const job = spawnFfmpegJob(req.userId, args, outFile, dur, label, meta, 'video',
          { cwd: os.tmpdir(), cleanupFiles: [path.join(os.tmpdir(), assFile)] });
        return res.status(202).json({ job: jobJson(job) });
      }

      const args = tpl.fc
        ? [...inArgs, '-filter_complex', tpl.fc.replace('[0:v]', '[0:v]' + pre), '-map', '[v]', ...(hasAudio ? ['-map', '0:a', '-c:a', 'copy'] : ['-an']), ...enc]
        : [...inArgs, '-vf', pre + tpl.vf, ...(hasAudio ? ['-c:a', 'copy'] : ['-an']), ...enc];
      const job = spawnFfmpegJob(req.userId, args, outFile, dur, label, meta);
      return res.status(202).json({ job: jobJson(job) });
    }

    return res.status(400).json({ error: 'Unknown transform.' });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: `Transform failed: ${err.message}` });
  }
});

/* ---------------- green screen / chroma key (free, local) ---------------- */
// Drop a subject shot/generated on a solid color onto any picture or clip.
// scale2ref sizes the background to the foreground, chromakey removes the color,
// overlay composites. Foreground audio (if any) is kept; original never touched.
router.post('/chroma', async (req, res) => {
  const { fgAssetId, bgAssetId, color } = req.body || {};
  const fg = db.getAsset(req.userId, Number(fgAssetId));
  const bg = db.getAsset(req.userId, Number(bgAssetId));
  if (!fg || fg.kind !== 'video') return res.status(404).json({ error: 'Pick the green-screen video clip first (the subject on a solid color).' });
  if (!bg || (bg.kind !== 'image' && bg.kind !== 'video')) return res.status(404).json({ error: 'Pick a picture or clip from your library as the new background.' });
  const key = /^0x[0-9a-fA-F]{6}$/.test(color) ? color : '0x00d600';
  const fgPath = mediaPath(fg.filename);
  const bgPath = mediaPath(bg.filename);
  let fgMeta = {}; try { fgMeta = JSON.parse(fg.meta || 'null') || {}; } catch (_) {}
  const dur = fgMeta.duration || await probeMediaDuration(fgPath);
  const hasAudio = await probeHasAudio(fgPath);
  const outFile = newFilename(req.userId, '.mp4');
  // background loops to cover the whole clip; image is held with -loop 1
  const bgInput = bg.kind === 'image' ? ['-loop', '1', '-i', bgPath] : ['-stream_loop', '-1', '-i', bgPath];
  const filter = `[0:v][1:v]scale2ref[bg][fg];[fg]chromakey=${key}:0.14:0.08[cf];[bg][cf]overlay=shortest=1,format=yuv420p[out]`;
  const args = [
    ...bgInput, '-i', fgPath,
    '-filter_complex', filter,
    '-map', '[out]', ...(hasAudio ? ['-map', '1:a?'] : []),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '192k'] : ['-an']),
    ...(dur ? ['-t', String(dur)] : []), '-movflags', '+faststart',
  ];
  const job = spawnFfmpegJob(req.userId, args, outFile, dur, `${fg.label} on ${bg.label}`, { source: 'chroma', fromAssetId: fg.id, bgAssetId: bg.id });
  res.status(202).json({ job: jobJson(job) });
});

/* ---------------- panels: the CapCut collage and duet layouts ------------- */
// Two layouts, both free and local, both of them things CapCut charges nothing
// for and every template on the For You page is built out of:
//
//   grid  - 2x2, four things at once. The "collage" template.
//   stack - two stacked top and bottom. The "follow the move" duet: reference
//           clip on top, you underneath doing it.
//
// Every cell is filled by scaling UP and cropping rather than letterboxing.
// Black bars inside a panel read as a mistake, and this is the same reason the
// split episode images were rebuilt with fills instead of bars.
//
// Shorter inputs loop rather than freezing on a last frame. A frozen panel is
// the single thing that makes a homemade collage look homemade - the templates
// all loop, which is why they never look dead.
router.post('/panels', async (req, res) => {
  const { assetIds, layout, size, secs, audioFrom } = req.body || {};
  const mode = layout === 'stack' ? 'stack' : 'grid';
  const wanted = mode === 'stack' ? 2 : 4;

  const ids = Array.isArray(assetIds) ? assetIds.map(Number).filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ error: 'Pick at least one picture or clip.' });
  // Fewer than the layout needs: repeat what was given rather than refusing.
  // The same clip four times is a real look, not a mistake.
  const filled = Array.from({ length: wanted }, (_, i) => ids[i % ids.length]);
  const assets = filled.map((id) => db.getAsset(req.userId, id));
  if (assets.some((a) => !a || (a.kind !== 'image' && a.kind !== 'video'))) {
    return res.status(404).json({ error: 'Panels take pictures and clips only.' });
  }

  const { W, H } = parseSize(size, '1080x1920');
  // Even numbers throughout: an odd dimension anywhere kills yuv420p output.
  const even = (n) => Math.floor(n / 2) * 2;
  const cw = even(mode === 'stack' ? W : W / 2);
  const ch = even(H / 2);

  // Longest video wins, so nothing is cut off mid-move. All stills falls back
  // to the requested length.
  let dur = 0;
  for (const a of assets) {
    if (a.kind !== 'video') continue;
    let m = {}; try { m = JSON.parse(a.meta || 'null') || {}; } catch (_) {}
    const d = m.duration || await probeMediaDuration(mediaPath(a.filename));
    if (d && d > dur) dur = d;
  }
  if (!dur) dur = Math.max(2, Math.min(30, Number(secs) || 5));

  const inputs = [];
  for (const a of assets) {
    const p = mediaPath(a.filename);
    if (a.kind === 'image') inputs.push('-loop', '1', '-i', p);
    else inputs.push('-stream_loop', '-1', '-i', p);
  }

  const cells = assets.map((_, i) =>
    `[${i}:v]scale=${cw}:${ch}:force_original_aspect_ratio=increase,` +
    `crop=${cw}:${ch},setsar=1,fps=${FPS}[p${i}]`);
  const tags = assets.map((_, i) => `[p${i}]`).join('');
  const join = mode === 'stack'
    ? `${tags}vstack=inputs=2[v]`
    // xstack lays the four out clockwise from the top left. w0/h0 reference the
    // first cell's size, which is why every cell is normalized above first.
    : `${tags}xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[v]`;
  const filter = `${cells.join(';')};${join}`;

  // One panel's sound, not four playing over each other. Defaults to the first,
  // which for a duet is the reference clip carrying the music.
  let aIdx = Number.isInteger(Number(audioFrom)) ? Number(audioFrom) : 0;
  if (aIdx < 0 || aIdx >= wanted) aIdx = 0;
  const aAsset = assets[aIdx];
  const hasAudio = aAsset.kind === 'video' && await probeHasAudio(mediaPath(aAsset.filename));

  const outFile = newFilename(req.userId, '.mp4');
  const args = [
    ...inputs,
    '-filter_complex', filter,
    '-map', '[v]', ...(hasAudio ? ['-map', `${aIdx}:a?`] : []),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '19', '-pix_fmt', 'yuv420p',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '192k'] : ['-an']),
    '-t', String(dur), '-movflags', '+faststart',
  ];
  const label = mode === 'stack' ? `${assets[0].label} + ${assets[1].label}` : `${assets[0].label} 4-up`;
  const job = spawnFfmpegJob(req.userId, args, outFile, dur, label, { source: 'panels', layout: mode, fromAssetId: assets[0].id });
  res.status(202).json({ job: jobJson(job) });
});

/* ---------------- output sizes ---------------- */
const RENDER_SIZES = new Set([
  // 16:9 / 9:16 / 1:1
  '3840x2160', '2560x1440', '1920x1080', '1280x720',
  '2160x3840', '1440x2560', '1080x1920', '720x1280',
  '2160x2160', '1440x1440', '1080x1080', '720x720',
  // 4:5 / 4:3 / 21:9
  '2160x2700', '1440x1800', '1080x1350', '720x900',
  '2880x2160', '1920x1440', '1440x1080', '960x720',
  '5120x2160', '3440x1440', '2560x1080', '1680x720',
]);
const FPS = 30;

function parseSize(size, fallback) {
  const target = RENDER_SIZES.has(size) ? size : fallback;
  const [W, H] = target.split('x').map(Number);
  return { W, H, target };
}

/* ---------------- Ken Burns: stills to motion clips ---------------- */
// Velocity curves. A real camera move never runs at one speed - it takes a
// moment to get going and settles rather than stopping dead. Straight-line
// progress is the single biggest reason a zoompan looks cheap, so 'smooth' is
// the default and 'steady' is there for when you genuinely want machine-even
// motion (a scrolling background, a locked-off pan behind text).
//
// Each one rewrites progress p (0..1) into eased progress. They only ever get
// applied to travel; the oscillating moves keep raw p inside their sines, or
// easing would bend the wobble out of shape.
const EASINGS = {
  steady: (p) => p,
  smooth: (p) => `(${p}*${p}*(3-2*${p}))`,              // slow out of the gate, slow into the stop
  in: (p) => `(${p}*${p})`,                             // creeps, then goes
  out: (p) => `(1-(1-${p})*(1-${p}))`,                  // leaves fast, coasts to a halt
  settle: (p) => `(1-pow(1-${p},3))`,                   // snaps away and takes its time landing
};
const DEFAULT_EASING = 'smooth';

// Every move is a zoompan expression over p = on/(d-1) (progress 0..1).
// Intensity 1..3 scales how far the camera travels. Some moves also return a
// `rot` expression in radians over t (seconds) - the route adds a rotate stage
// for those, since zoompan cannot turn the frame itself.
function kenBurnsExprs(move, intensity, fx, fy, easing) {
  const i = Math.min(3, Math.max(1, Math.round(intensity || 2)));
  const zoomAmt = [0.12, 0.25, 0.45][i - 1];   // how far push/pull travels
  const panZoom = [1.12, 1.22, 1.4][i - 1];    // fixed zoom that gives pans room to move
  const shakeAmp = [0.0025, 0.005, 0.009][i - 1];
  const driftAmt = [0.18, 0.3, 0.42][i - 1];
  const hoverBob = [0.03, 0.05, 0.08][i - 1];  // how much a held-above shot breathes
  const droneRise = [0.22, 0.34, 0.45][i - 1]; // how far a drone climbs while it widens (0.5 would hit the top edge)
  const droneSide = [0.08, 0.14, 0.22][i - 1]; // a little sideways flight, so it isn't just a lift
  const tiltDeg = [1.4, 2.4, 3.6][i - 1];      // how far a dutch angle leans
  const orbitDeg = [1.6, 2.8, 4.2][i - 1];     // counter-roll that sells an arc
  const craneAmt = [0.3, 0.45, 0.62][i - 1];   // vertical travel on a crane
  const raw = 'on/(duration-1)';               // zoompan calls the total frame count "duration"
  const ease = EASINGS[easing] || EASINGS[DEFAULT_EASING];
  const p = ease(raw);                         // eased progress - use this for travel
  const cx = '(iw-iw/zoom)/2', cy = '(ih-ih/zoom)/2';
  const rad = (deg) => (deg * Math.PI / 180).toFixed(5);
  switch (move) {
    // Dead still. Any movement at all resamples the frame every frame, which
    // softens flat type — so a title or end card wants this and nothing else.
    case 'still':     return { z: '1', x: cx, y: cy };
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
    // The oscillating moves keep RAW progress inside their sines. Easing a
    // wobble doesn't make it smoother, it makes it lopsided.
    case 'drift':     return {
      z: `${panZoom - 0.04}+0.02*sin(3.14159*${raw})`,
      x: `(iw-iw/zoom)*(0.5+${driftAmt / 2}*sin(3.14159*${raw}))`,
      y: `(ih-ih/zoom)*(0.5-${driftAmt / 3}*sin(3.14159*${raw}))`,
    };
    case 'push_pan':  return { z: `1+${zoomAmt}*${p}`, x: `(iw-iw/zoom)*${p}`, y: cy };
    // Hover: the camera is parked above the subject and holding. It sits high
    // in the frame and breathes - one slow cycle over the clip, never a
    // journey. This is the shot you use under a line you want people to sit
    // with; anything that travels pulls the eye off the words.
    case 'hover':     return {
      z: `${(panZoom - 0.02).toFixed(3)}+${(hoverBob / 4).toFixed(4)}*sin(6.28318*${raw})`,
      x: `${cx}+iw*${(hoverBob / 12).toFixed(4)}*sin(6.28318*${raw})`,
      y: `(ih-ih/zoom)*(0.20+${(hoverBob).toFixed(3)}*sin(6.28318*${raw}+1.2))`,
    };
    // Drone: rises and widens at the same time, drifting slightly sideways so
    // it reads as flight rather than a lift. A still can't change its angle,
    // so the reveal - more of the picture, from higher up - is what sells it.
    case 'drone':     return {
      z: `${(1 + zoomAmt).toFixed(3)}-${zoomAmt}*${p}`,
      x: `(iw-iw/zoom)*(0.5+${droneSide}*(${p}-0.5))`,
      y: `(ih-ih/zoom)*(0.5-${droneRise}*${p})`,
    };
    // ---- angles. A still can't be re-shot from somewhere else, so an angle
    // here means framing and movement that read as one: where in the picture
    // the camera sits, which way it travels, and whether the horizon is level.
    //
    // Low angle: sits near the bottom of the frame and pushes upward. Looking
    // up at something is what makes it feel bigger than you.
    case 'low_angle':  return {
      z: `${(1 + zoomAmt * 0.7).toFixed(3)}+${(zoomAmt * 0.5).toFixed(3)}*${p}`,
      x: cx,
      y: `(ih-ih/zoom)*(0.82-0.34*${p})`,
    };
    // High angle: sits near the top and presses down. Looking down at
    // something makes it smaller, and the viewer steadier than it.
    case 'high_angle': return {
      z: `${(1 + zoomAmt * 0.7).toFixed(3)}+${(zoomAmt * 0.5).toFixed(3)}*${p}`,
      x: cx,
      y: `(ih-ih/zoom)*(0.18+0.34*${p})`,
    };
    // Crane up: rises through the frame while easing wider, the way a jib
    // lifts off a subject at the end of a scene. Drone flies; a crane is
    // anchored, so there's no sideways drift in this one.
    case 'crane_up':   return {
      z: `${(panZoom + 0.08).toFixed(3)}-${(0.13).toFixed(3)}*${p}`,
      x: cx,
      y: `(ih-ih/zoom)*(${(0.5 + craneAmt / 2).toFixed(3)}-${craneAmt}*${p})`,
    };
    // Crane down: descends into the shot and tightens - the opening move.
    case 'crane_down': return {
      z: `${(panZoom - 0.05).toFixed(3)}+${(0.13).toFixed(3)}*${p}`,
      x: cx,
      y: `(ih-ih/zoom)*(${(0.5 - craneAmt / 2).toFixed(3)}+${craneAmt}*${p})`,
    };
    // Dutch: the horizon deliberately off level, leaning a little further as
    // the shot runs. Use it where something is wrong and you don't want to say
    // so out loud. Rotation can't come from zoompan, so `rot` is handled by
    // the caller as a separate stage.
    case 'dutch':      return {
      z: `${(panZoom - 0.02).toFixed(3)}+${(zoomAmt * 0.35).toFixed(3)}*${p}`,
      x: cx,
      y: cy,
      rot: `${rad(tiltDeg * 0.55)}+${rad(tiltDeg * 0.45)}*t/max(0.001,DUR)`,
    };
    // Orbit: travels sideways while the frame counter-rolls, which is what
    // arcing around a subject actually looks like. On a flat picture the roll
    // is doing most of the work, so it stays small.
    case 'orbit_right': return {
      z: `${(panZoom + 0.06).toFixed(3)}-${(0.05).toFixed(3)}*sin(3.14159*${raw})`,
      x: `(iw-iw/zoom)*(0.5+${(0.34).toFixed(2)}*(${p}-0.5))`,
      y: cy,
      rot: `${rad(orbitDeg / 2)}-${rad(orbitDeg)}*t/max(0.001,DUR)`,
    };
    case 'orbit_left':  return {
      z: `${(panZoom + 0.06).toFixed(3)}-${(0.05).toFixed(3)}*sin(3.14159*${raw})`,
      x: `(iw-iw/zoom)*(0.5-${(0.34).toFixed(2)}*(${p}-0.5))`,
      y: cy,
      rot: `${rad(-orbitDeg / 2)}+${rad(orbitDeg)}*t/max(0.001,DUR)`,
    };
    default: return null;
  }
}

/* ---------------- parallax: a flat photo pulled into depth layers ---------------- */
const parallax = require('./parallax');

// move is 'parallax_right' | 'parallax_left' | 'parallax_up' | 'parallax_down'
function startParallax(req, res, { still, dur, intensity, size, move }) {
  const dir = (String(move).split('_')[1] || 'right');
  const { W, H } = parseSize(size, '1920x1080');
  const job = createJob(req.userId, 'render', {});
  res.status(202).json({ job: jobJson(job) });

  (async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-plx-'));
    const depthFile = path.join(tmpDir, 'depth.png');
    const src = mediaPath(still.filename);
    try {
      // 0-45% is the one-off model download; after that depth takes a second.
      let depth = await parallax.depthMap(src, depthFile, (pct) => {
        job.progress = Math.min(45, Math.round(pct * 0.45));
      });
      let guessed = false;
      if (!depth) {
        // No depth model on this machine. Assume the ground is nearer than the
        // sky - true of most shots taken standing up - rather than refusing.
        guessed = true;
        depth = await parallax.gradientDepth(ffmpegBin(), W, H, depthFile);
      }
      if (!depth) throw new Error('Could not work out the depth of that picture.');
      job.progress = 50;

      const chain = parallax.buildChain({ W, H, dur, fps: FPS, dir, strength: intensity });
      const args = [
        '-loop', '1', '-t', String(dur), '-i', src,
        '-loop', '1', '-t', String(dur), '-i', depthFile,
        '-filter_complex', chain, '-map', '[v]', '-t', String(dur),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-movflags', '+faststart',
      ];
      spawnFfmpegJob(req.userId, args, newFilename(req.userId, '.mp4'), dur,
        `${still.label} · parallax ${dir}`,
        { source: 'parallax', move, dir, fromAssetId: still.id, depthGuessed: guessed },
        'video',
        { job, cleanupFiles: [depthFile] });
    } catch (err) {
      job.status = 'error';
      job.error = err.message || 'Parallax failed.';
    }
  })();
}

router.post('/kenburns', (req, res) => {
  const { assetId, move, duration, intensity, focalX, focalY, size, easing } = req.body || {};
  const still = db.getAsset(req.userId, Number(assetId));
  if (!still || still.kind !== 'image') {
    return res.status(404).json({ error: 'Pick an image from your library first.' });
  }
  const dur = Math.min(30, Math.max(1, Number(duration) || 5));
  const fx = Math.min(1, Math.max(0, Number(focalX) || 0.5));
  const fy = Math.min(1, Math.max(0, Number(focalY) || 0.5));

  // Parallax is a different animal: it needs a depth map and composites three
  // layers, so it gets its own renderer rather than a zoompan expression.
  if (String(move).startsWith('parallax')) {
    return startParallax(req, res, { still, dur, intensity, size, move });
  }

  const ease = EASINGS[easing] ? easing : DEFAULT_EASING;
  const exprs = kenBurnsExprs(move, intensity, fx.toFixed(3), fy.toFixed(3), ease);
  if (!exprs) return res.status(400).json({ error: `Unknown camera move: ${move}` });
  const { W, H } = parseSize(size, '1920x1080');
  const frames = Math.round(dur * FPS);

  // Upscale + crop to the target aspect first so zoompan never distorts, and
  // has 2x headroom for smooth sub-pixel motion.
  //
  // A rotating move (dutch, orbit) has to turn AFTER zoompan, not before: the
  // input is one still frame, so at that point t is always 0 and a
  // time-varying angle would come out frozen. zoompan therefore renders
  // oversized, rotate turns those frames, and the crop takes the middle back -
  // which is also what keeps the corners from going black. 12% spare covers
  // every angle these moves reach.
  const even = (n) => 2 * Math.round(n / 2);
  const ow = even(W * 1.12), oh = even(H * 1.12);
  const chain = exprs.rot
    ? `[0:v]scale=${2 * W}:${2 * H}:force_original_aspect_ratio=increase,crop=${2 * W}:${2 * H},` +
      `zoompan=z='${exprs.z}':x='${exprs.x}':y='${exprs.y}':d=${frames}:s=${ow}x${oh}:fps=${FPS},` +
      `rotate='${exprs.rot.replace(/DUR/g, String(dur))}':c=none:ow=iw:oh=ih,` +
      `crop=${W}:${H},format=yuv420p[v]`
    : `[0:v]scale=${2 * W}:${2 * H}:force_original_aspect_ratio=increase,crop=${2 * W}:${2 * H},` +
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
  {
    const capMsg = overDailyCap(req.userId, estActionCost('sing', { tier }));
    if (capMsg) return res.status(429).json({ error: capMsg });
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
  const { imageAssetId, videoAssetId, start, len, tier } = req.body || {};
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
  {
    const capMsg = overDailyCap(req.userId, estActionCost('dance', { tier, seconds: segLen }));
    if (capMsg) return res.status(429).json({ error: capMsg });
  }

  try {
    const drivingUri = await extractVideoSegment(mediaPath(dance.filename), segStart, segLen);
    const model = tier === 'hero' ? MODEL_MOTION_HERO : tier === 'standard' ? MODEL_MOTION_STD : MODEL_MOTION;
    const submitted = await falSubmit(model, {
      image_url: fileToDataUri(character.filename),
      video_url: drivingUri,
      ...(/motion-control/.test(model) ? { character_orientation: 'video' } : {}),
    });
    const job = createJob(req.userId, 'ai-video', {
      fal: {
        statusUrl: submitted.status_url,
        responseUrl: submitted.response_url,
        expect: 'video',
        label: `${character.label} · dance`,
        characterId: character.character_id,
        meta: { source: 'motion', model, fromAssetId: character.id, drivingAssetId: dance.id, segStart, segLen },
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
  {
    const capMsg = overDailyCap(req.userId, estActionCost('liveportrait'));
    if (capMsg) return res.status(429).json({ error: capMsg });
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

// One-tap looks, the CapCut effects tab equivalent. Every one is pure ffmpeg -
// free, offline, no AI, no per-use cost. Each entry is a filter chain appended
// to a clip after it has been scaled to WxH.
//
// Every string here was run through ffmpeg before it shipped. Three notes that
// cost an hour:
//  - a comma inside an expression ends the filter, so no max(a,b) anywhere;
//    use `enable=` to switch an effect on and off over time instead.
//  - rgbashift/gblur take numbers, not expressions - only `enable` is dynamic.
//  - a time-varying crop feeding a fixed scale dies, because scale cannot
//    reconfigure mid-stream. Zooms therefore go through zoompan.
const CLIP_EFFECTS = {
  none:      () => '',
  // --- color, instant
  bw:        () => 'hue=s=0,eq=contrast=1.14:brightness=0.01',
  noir:      () => 'hue=s=0,eq=contrast=1.35:brightness=-0.03,vignette=PI/4.5',
  warm:      () => 'eq=contrast=1.05:saturation=1.12,colortemperature=temperature=4600',
  cool:      () => 'eq=contrast=1.07:saturation=1.05,colortemperature=temperature=8200',
  cinematic: () => "curves=r='0/0.03 0.5/0.5 1/0.97':b='0/0.05 0.5/0.5 1/0.95',eq=contrast=1.1:saturation=1.04",
  faded:     () => "curves=all='0/0.09 0.5/0.52 1/0.93',eq=saturation=0.82:contrast=0.96",
  vibrant:   () => 'eq=contrast=1.14:saturation=1.45,unsharp=5:5:0.6:5:5:0',
  // --- texture
  grain:     () => 'noise=alls=11:allf=t+u,eq=contrast=1.04',
  vhs:       () => 'rgbashift=rh=3:bh=-3,noise=alls=16:allf=t,eq=saturation=1.2:contrast=1.05',
  vignette:  () => 'vignette=PI/4',
  dream:     () => 'split[fxa][fxb];[fxb]gblur=sigma=18[fxg];[fxa][fxg]blend=all_mode=screen:all_opacity=0.35',
  bloom:     () => "split[fxa][fxb];[fxb]curves=all='0/0 0.6/0.75 1/1',gblur=sigma=22[fxg];[fxa][fxg]blend=all_mode=screen:all_opacity=0.28",
  // --- energy
  rgb:       () => 'rgbashift=rh=4:bh=-4',
  glitch:    () => "rgbashift=rh=6:bh=-6:enable='lt(mod(t\\,0.6)\\,0.1)'",
  flash:     () => "eq=brightness='if(lt(t\\,0.07)\\,0.55\\,0)'",
  strobe:    () => "eq=brightness='0.13*sin(t*22)'",
  whip:      () => "boxblur=luma_radius=12:luma_power=1:enable='lt(t\\,0.25)'",
  // --- motion. zoompan, because a moving crop into a fixed scale won't run.
  punch:     (W, H, fps) => `zoompan=z='1+0.16*exp(-4*(on/${fps}))':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${fps}`,
  pulse:     (W, H, fps) => `zoompan=z='1.05+0.045*sin((on/${fps})*3.1)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${fps}`,
  shake:     (W, H) => `crop=w='2*trunc((iw-20)/2)':h='2*trunc((ih-20)/2)':x='10+6*sin(t*13)':y='10+6*cos(t*11)',scale=${W}:${H}`,

  // ── Added b0847, from Jacques's list. Everything here is pure ffmpeg, so it
  // stays on the free side: no model, no upload, no per-clip cost.
  // --- looks
  comic:     () => "eq=saturation=1.9:contrast=1.5,edgedetect=low=0.1:high=0.35:mode=colormix,unsharp=5:5:1.1:5:5:0",
  nightclub: () => "eq=contrast=1.3:saturation=1.6,colorbalance=rs=0.15:bh=0.25:gm=-0.05,vignette=PI/4,noise=alls=8:allf=t",
  nature:    () => "eq=saturation=1.28:contrast=1.06,colorbalance=gm=0.10:bs=0.05:rh=-0.04,unsharp=5:5:0.5:5:5:0",
  neon:      () => "split[na][nb];[nb]curves=all='0/0 0.55/0.8 1/1',gblur=sigma=26[ng];[na][ng]blend=all_mode=screen:all_opacity=0.45,eq=saturation=1.7:contrast=1.2",
  sepia:     () => 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
  infrared:  () => 'colorchannelmixer=.2:.6:.2:0:.6:.2:.2:0:.2:.2:.6,eq=saturation=1.5:contrast=1.2',
  // Smoke: soft moving haze that drifts across the frame. A real particle pass
  // would need an overlay asset; this reads as atmosphere and costs nothing.
  smoke:     () => 'split[sa][sb];[sb]gblur=sigma=40,eq=brightness=0.06:contrast=0.85[sg];[sa][sg]blend=all_mode=screen:all_opacity=0.34,vignette=PI/5',
  fog:       () => "split[fa][fb];[fb]boxblur=luma_radius=30:luma_power=2,eq=brightness=0.12:saturation=0.5[fg];[fa][fg]blend=all_mode=screen:all_opacity=0.4",
  // --- speed. setpts rewrites timestamps, so the clip genuinely runs slower or
  // faster rather than just looking like it. Audio is handled by the render
  // path separately; these are picture effects on Ken Burns clips.
  slowmo:    () => 'setpts=2.0*PTS',
  slowmo_x4: () => 'setpts=4.0*PTS',
  fastmo:    () => 'setpts=0.5*PTS',
  fastmo_x4: () => 'setpts=0.25*PTS',
  // Velocity: slow, then snaps to fast at the midpoint - the ramp people mean
  // when they say "velocity edit".
  velocity:  () => "setpts='if(lt(T,1.2),2.0*PTS,0.55*PTS)'",
  // --- appear / disappear
  vanish:    () => "fade=t=out:st=1.2:d=0.5,fade=t=in:st=2.0:d=0.4",
  blink:     () => "eq=brightness='if(lt(mod(t\\,1.4)\\,0.12)\\,-1\\,0)'",
  materialize: () => "gblur=sigma=10:enable='lt(t\\,0.7)',fade=t=in:d=0.9",
  // --- transformation. A morph between two different images needs optical flow
  // or a model; what IS free is a transformation OF one image, so that's what
  // this is: the frame stretches and settles, like it's re-forming.
  morph:     (W, H, fps) => `zoompan=z='1.25-0.25*min(1,on/${fps})':d=1:x='iw/2-(iw/zoom/2)+18*sin(on/6)':y='ih/2-(ih/zoom/2)+14*cos(on/7)':s=${W}x${H}:fps=${fps},gblur=sigma=5:enable='lt(t\\,0.5)'`,
  ripple:    () => "geq=lum='p(X+4*sin(Y/22+T*2.2),Y)':cb='p(X+4*sin(Y/22+T*2.2),Y)':cr='p(X+4*sin(Y/22+T*2.2),Y)'",
  mirror_x:  () => 'split[ma][mb];[mb]hflip[mf];[ma][mf]blend=all_mode=average:all_opacity=1',
  kaleido:   (W, H) => `split[ka][kb];[kb]hflip[kf];[ka][kf]hstack=inputs=2,scale=${W}:${H}`,
};

// ── Colour presets (b0848) ───────────────────────────────────────────────────
// `free luts` is 2,900 searches a month and `color grading presets` sits at
// difficulty 19 - the lowest number in the whole research pull. Studio already
// had these grades scattered through CLIP_EFFECTS; presenting them as a named
// preset library is the feature, not new code. Each one is a still-image or
// clip grade applied in one tap, with a plain-English name.
const COLOR_PRESETS = {
  none:        { label: 'Original', vf: '' },
  teal_orange: { label: 'Teal & Orange', vf: "curves=r='0/0.02 0.5/0.55 1/1':b='0/0.06 0.5/0.46 1/0.94',eq=contrast=1.14:saturation=1.18" },
  bleach:      { label: 'Bleach Bypass', vf: "eq=saturation=0.45:contrast=1.4,curves=all='0/0.06 0.5/0.5 1/0.96',unsharp=5:5:0.7:5:5:0" },
  moody_blue:  { label: 'Moody Blue', vf: 'colorbalance=bs=0.18:bh=0.08:rs=-0.05,eq=contrast=1.22:saturation=0.85:brightness=-0.03' },
  golden_hour: { label: 'Golden Hour', vf: 'colortemperature=temperature=4200,eq=saturation=1.2:contrast=1.06,curves=all=\'0/0.04 0.5/0.54 1/1\'' },
  soft_pastel: { label: 'Soft Pastel', vf: "curves=all='0/0.12 0.5/0.55 1/0.95',eq=saturation=0.9:contrast=0.94" },
  crushed:     { label: 'Crushed Blacks', vf: "curves=all='0/0 0.25/0.12 0.5/0.5 1/1',eq=contrast=1.25" },
  kodak:       { label: 'Kodak Warm', vf: "colortemperature=temperature=4800,curves=r='0/0.04 0.5/0.54 1/1':b='0/0.02 0.5/0.47 1/0.96',eq=saturation=1.1" },
  fuji:        { label: 'Fuji Green', vf: 'colorbalance=gm=0.12:gs=0.06:rh=-0.04,eq=saturation=1.12:contrast=1.08' },
  silver:      { label: 'Silver', vf: 'hue=s=0,curves=all=\'0/0.05 0.5/0.52 1/0.98\',eq=contrast=1.22' },
  high_key:    { label: 'High Key', vf: "curves=all='0/0.18 0.5/0.62 1/1',eq=saturation=0.95:contrast=0.9" },
  low_key:     { label: 'Low Key', vf: "curves=all='0/0 0.5/0.38 1/0.9',eq=contrast=1.3:saturation=0.9,vignette=PI/4" },
};

function effectFilter(name, W, H, fps) {
  const fn = CLIP_EFFECTS[String(name || 'none')];
  if (!fn) return '';
  const s = fn(W, H, fps);
  return s ? `,${s}` : '';
}

function eqFilter(eq) {
  if (!eq) return '';
  const b = Math.min(0.3, Math.max(-0.3, Number(eq.brightness) || 0));
  const c = Math.min(1.6, Math.max(0.6, Number(eq.contrast) || 1));
  const s = Math.min(2.5, Math.max(0, eq.saturation == null ? 1 : Number(eq.saturation)));
  if (!b && c === 1 && s === 1) return '';
  return `,eq=brightness=${b}:contrast=${c}:saturation=${s}`;
}

// Text captions burn in via a generated .ass subtitle file (libass). Unlike the
// caption-PNG path there is no line cap and no per-line upload, so a 10-minute
// talking video captions cleanly. Styled to match the old canvas look: bold
// white, soft shadow, bottom-center.
// styleKey mirrors the client's CAPTION_STYLES picker (outline/boxed/pop/classic).
// ASS colors are &HAABBGGRR (alpha 00 = opaque); BorderStyle 3 = opaque box.
const ASS_STYLES = {
  outline: { color: '&H00FFFFFF', border: 1, outlineMul: 1.0, back: '&H7F000000' },
  boxed: { color: '&H00FFFFFF', border: 3, outlineMul: 0.6, back: '&H66000000' },
  pop: { color: '&H0000DDFF', border: 1, outlineMul: 1.1, back: '&H7F000000' },
  classic: { color: '&H00FFFFFF', border: 1, outlineMul: 0.5, back: '&H7F000000' },
};
// Caption size as a share of video height. Talking-head footage puts the
// speaker's face low in frame, so oversized captions cover it - these let the
// text be shrunk (or raised) instead of forcing a re-record.
const ASS_SIZES = {
  small: { font: 0.034, margin: 0.06 },
  medium: { font: 0.042, margin: 0.07 },
  large: { font: 0.048, margin: 0.08 }, // the original size
};
function buildAssFile(lines, W, H, styleKey, sizeKey, widthPct) {
  const st = ASS_STYLES[styleKey] || ASS_STYLES.outline;
  const sz = ASS_SIZES[sizeKey] || ASS_SIZES.medium;
  const esc = (t) => String(t).replace(/\r?\n/g, '\\N').replace(/[{}]/g, '');
  const ts = (s) => {
    const cs = Math.max(0, Math.round(s * 100));
    const h = Math.floor(cs / 360000);
    const m = String(Math.floor((cs % 360000) / 6000)).padStart(2, '0');
    const sec = String(Math.floor((cs % 6000) / 100)).padStart(2, '0');
    return `${h}:${m}:${sec}.${String(cs % 100).padStart(2, '0')}`;
  };
  const fontSize = Math.round(H * sz.font);
  const outline = Math.max(1, Math.round((fontSize / 16) * st.outlineMul));
  const marginV = Math.round(H * sz.margin);
  // How much of the frame width a caption line may use before it wraps. The
  // old fixed 40px margin let long lines run to the very edge on a phone.
  const wf = Math.min(0.98, Math.max(0.5, Number(widthPct) || 0.86));
  const marginH = Math.max(10, Math.round(W * (1 - wf) / 2));
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Arial,${fontSize},${st.color},${st.color},&H00000000,${st.back},-1,0,0,0,100,100,0,0,${st.border},${outline},1,2,${marginH},${marginH},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
` + lines.map((l) => `Dialogue: 0,${ts(l.start)},${ts(l.end)},Cap,,0,0,0,,${esc(l.text)}`).join('\n') + '\n';
}

router.post('/render', async (req, res) => {
  const { clips, transitions, music, overlays, captions, captionLines, captionStyle, captionSize, size, fadeFromBlack, fadeToBlack, window: win, loop, name, enhance, fit, focusX } = req.body || {};
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
      resolved.push({ kind: 'image', file, dur, eq: c.eq, fx: c.fx, label: row.label });
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
      // keepAudio: preserve this clip's own sound (e.g. dialogue) in the mix.
      // Only honor it if the clip actually has an audio stream.
      const keepAudio = !!c.keepAudio && await probeHasAudio(file);
      resolved.push({ kind: 'video', file, start, end, dur: end - start, eq: c.eq, fx: c.fx, label: row.label, keepAudio });
    }
  }

  // --- transitions between consecutive clips
  const trans = [];
  for (let i = 0; i < resolved.length - 1; i++) {
    const t = (Array.isArray(transitions) && transitions[i]) || {};
    const type = TRANSITIONS[t.type] !== undefined ? t.type : 'cut';
    let td = Math.min(2, Math.max(0.2, Number(t.duration) || 0.5));
    // A transition can't be longer than either neighbor.
    td = Math.min(td, resolved[i].dur * 0.9, resolved[i + 1].dur * 0.9);
    trans.push({ type, td: type === 'cut' ? 0 : td });
  }
  const totalDur = resolved.reduce((s, c) => s + c.dur, 0) - trans.reduce((s, t) => s + t.td, 0);
  // each clip's start position on the assembled timeline (accounts for xfade overlap)
  const clipStart = resolved.length ? [0] : [];
  { let end = resolved.length ? resolved[0].dur : 0;
    for (let i = 0; i < trans.length; i++) { clipStart[i + 1] = end - trans[i].td; end = clipStart[i + 1] + resolved[i + 1].dur; } }

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
      // Loop the song to fill a video that runs longer than the music, so the
      // tail is never silent. On by default; harmless when the song is already
      // long enough (nothing repeats). Send music.loop === false to disable.
      loop: music.loop !== false,
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
  // Brand watermark: a small logo pinned top-left for the whole video. The
  // image lives at server/watermark.png - replace that file to change the logo.
  const WATERMARK_FILE = path.join(__dirname, 'watermark.png');
  const useWatermark = !!req.body.watermark && fs.existsSync(WATERMARK_FILE);
  const wmIdx = ovBase + allOverlays.length;
  if (useWatermark) args.push('-i', WATERMARK_FILE);

  // --- filter graph
  const filters = [];
  // "Auto enhance": gentle color pop + sharpen per clip, plus a cinematic
  // vignette and a whisper of film grain on the finished picture.
  const enhanceClip = enhance ? ',eq=contrast=1.06:saturation=1.14,unsharp=5:5:0.5:5:5:0.0' : '';
  // fit:'crop' fills the frame by scaling up and cropping the overflow (with an
  // optional 0..1 focusX picking which horizontal slice survives) instead of
  // letterboxing - the difference between a real vertical Short and a 16:9
  // video floating between black bars.
  const fx = Math.min(1, Math.max(0, focusX == null ? 0.5 : Number(focusX)));
  const fitFilter = fit === 'crop'
    ? `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-${W})*${fx.toFixed(3)}:(ih-${H})/2`
    : `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2`;
  // Ken Burns: a slow push on stills so a photo slideshow reads as a film
  // instead of a stack of frozen pictures. Pure ffmpeg - no AI, no cost.
  // Notes that cost an hour to learn, so they stay written down:
  //  - fps must come BEFORE zoompan (zoompan counts input frames) and be set
  //    again INSIDE it (zoompan re-tags output at 25 by default), or the clip
  //    comes out the wrong length.
  //  - d=1 because the input is already a looped frame sequence; anything
  //    higher multiplies the frame count.
  //  - scaling to 2x before the zoom is what stops the pixel-jitter that makes
  //    a naive zoompan look cheap.
  const kenBurns = !!req.body.kenBurns;
  // How far the camera travels, and which way - both the user's choice, not a
  // hardcoded house style. amount is a fraction (0.10 = a 10% push).
  const kbAmount = Math.min(0.8, Math.max(0.02, Number(req.body.kenBurnsAmount) || 0.20));
  const kbMove = ['auto', 'in', 'out'].includes(req.body.kenBurnsMove) ? req.body.kenBurnsMove : 'auto';
  function stillMotion(c, i) {
    const frames = Math.max(1, Math.round(c.dur * FPS));
    // Respect the fit setting, exactly like a still with no motion would:
    // 'pad' letterboxes the whole picture first, 'crop' fills the frame. The
    // strength is the user's chosen amount in BOTH modes - no silent cap. A
    // strong zoom in pad mode will push a card's outer edges off-screen at the
    // peak; that trade-off belongs to the person picking "Dramatic", not here.
    const amt = kbAmount;
    const a = amt.toFixed(3);
    const top = (1 + amt).toFixed(3);
    // 'auto' alternates so a long slideshow doesn't feel like one repeating move.
    const zoomIn = kbMove === 'in' || (kbMove === 'auto' && i % 2 === 0);
    const z = zoomIn
      ? `min(1+${a}*on/${frames},${top})`
      : `max(${top}-${a}*on/${frames},1)`;
    const pre = fit === 'crop'
      ? `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2}`
      : `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=decrease,pad=${W * 2}:${H * 2}:(ow-iw)/2:(oh-ih)/2`;
    return `fps=${FPS},${pre},zoompan=z='${z}':d=1:` +
      `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`;
  }
  resolved.forEach((c, i) => {
    const useKB = kenBurns && c.kind === 'image';
    const geom = useKB ? stillMotion(c, i) : `${fitFilter},setsar=1,fps=${FPS}`;
    // fps goes LAST, after settb/setpts. Those two rewrite the timebase and
    // timestamps, which leaves the stream's frame rate reported as 1/0 —
    // undefined — and xfade refuses any input that isn't a constant frame
    // rate. An all-stills edit never hit it because zoompan re-tags fps on
    // its way out; the moment a filmed clip joined the timeline, every
    // dissolve in the render died with "current rate of 1/0 is invalid".
    filters.push(
      `[${i}:v]${geom},setsar=1,format=yuv420p${eqFilter(c.eq)}${effectFilter(c.fx, W, H, FPS)}${enhanceClip},` +
      `settb=AVTB,setpts=PTS-STARTPTS,fps=${FPS}[v${i}]`
    );
  });

  // Join clips left to right: plain concat on cuts, xfade on dissolves.
  let current = '[v0]';
  let joined = resolved[0].dur;
  trans.forEach((t, i) => {
    const next = `[v${i + 1}]`, raw = `[jr${i}]`, out = `[j${i}]`;
    if (t.type === 'cut') {
      filters.push(`${current}${next}concat=n=2:v=1:a=0${raw}`);
      joined += resolved[i + 1].dur;
    } else {
      filters.push(`${current}${next}xfade=transition=${TRANSITIONS[t.type]}:duration=${t.td.toFixed(3)}:offset=${(joined - t.td).toFixed(3)}${raw}`);
      joined += resolved[i + 1].dur - t.td;
    }
    // Re-stamp the timebase after EVERY join. concat and xfade each hand on a
    // timebase of their own choosing — concat emits 1/fps where a fresh clip
    // carries AVTB — and xfade refuses two inputs whose timebases disagree.
    // A timeline of all blends never hit it, and neither did all cuts. A cut
    // followed by a blend died with "First input link main timebase (1/1000000)
    // do not match the corresponding second input link xfade timebase (1/30)"
    // and nothing was written at all.
    filters.push(`${raw}settb=AVTB,fps=${FPS}${out}`);
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

  // Burned-in text captions ride the assembled timeline (before windowing, in
  // timeline coordinates - same convention as the overlay captions above).
  let assFile = null;
  const capLines = (Array.isArray(captionLines) ? captionLines : [])
    .map((l) => ({ text: String(l.text || '').trim(), start: Math.max(0, Number(l.start) || 0), end: Math.max(0, Number(l.end) || 0) }))
    .filter((l) => l.text && l.end > l.start && l.start < winEnd && l.end > winStart)
    .slice(0, 5000)
    .sort((a, b) => a.start - b.start);
  if (capLines.length) {
    assFile = `captions-${crypto.randomBytes(5).toString('hex')}.ass`;
    fs.writeFileSync(path.join(os.tmpdir(), assFile), buildAssFile(capLines, W, H, captionStyle, captionSize, req.body.captionWidth));
    filters.push(`${current}subtitles=filename=${assFile}[vcap]`);
    current = '[vcap]';
  }

  // Watermark rides above everything, for the full duration (eof_action=repeat
  // holds the single PNG frame). ~13% of the width, top-left, slightly sheer.
  if (useWatermark) {
    const wmW = Math.round(W * 0.13);
    const wmM = Math.round(W * 0.035);
    filters.push(`[${wmIdx}:v]scale=${wmW}:-1,format=rgba,colorchannelmixer=aa=0.85[wmk]`);
    filters.push(`${current}[wmk]overlay=${wmM}:${wmM}:eof_action=repeat[vwm]`);
    current = '[vwm]';
  }

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

  // --- kept clip audio (dialogue): trim to the clip, level up, delay to its
  // spot on the output timeline. The song ducks under these windows.
  const voiceLabels = [];
  const voiceWindows = [];
  resolved.forEach((c, i) => {
    if (!(c.kind === 'video' && c.keepAudio)) return;
    const s = clipStart[i] - winStart; // clip start in output coordinates
    if (s + c.dur <= 0 || s >= outDur) return; // outside the window
    const skip = s < 0 ? -s : 0;
    const audible = Math.min(c.dur - skip, outDur - Math.max(0, s));
    if (audible <= 0.05) return;
    const delayMs = Math.max(0, Math.round(s * 1000));
    // The 1.5 exists to push dialogue up over a song. With no song there is
    // nothing to push over, and a finished video dropped in whole already
    // carries its own mix — raising it 3.5dB just makes it louder than its
    // maker chose. (Measured: it does not clip or pump, the limiter absorbs
    // it. This is a correctness fix, not a rescue.)
    const lift = musicIn ? 1.5 : 1.0;
    filters.push(`[${i}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,` +
      `atrim=${skip.toFixed(3)}:${(skip + audible).toFixed(3)},asetpts=PTS-STARTPTS,volume=${lift.toFixed(2)}` +
      `${delayMs > 0 ? `,adelay=${delayMs}|${delayMs}` : ''}[cv${i}]`);
    voiceLabels.push(`[cv${i}]`);
    voiceWindows.push({ s: Math.max(0, s), e: Math.min(outDur, s + c.dur) });
  });

  let hasAudioOut = false;
  const master = (fadeIn, fadeOut) => {
    let m = `,acompressor=threshold=-18dB:ratio=3:attack=20:release=250,alimiter=limit=0.95`;
    if (fadeIn) m += `,afade=t=in:st=0:d=1`;
    if (fadeOut) m += `,afade=t=out:st=${Math.max(0, outDur - 2).toFixed(3)}:d=2`;
    return m;
  };
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
    // If the song is shorter than the video, repeat it to fill the whole
    // window (bounded to the window length so memory stays tied to the video,
    // not the source). When the song is already long enough this loops nothing
    // audible — atrim reads the straight-through portion before any repeat.
    const loopFilter = musicIn.loop
      ? `aloop=loop=-1:size=${Math.ceil((winEnd + 2) * 44100)},`
      : '';
    let mchain = `${mcur}${loopFilter}atrim=${winStart.toFixed(3)}:${winEnd.toFixed(3)},asetpts=PTS-STARTPTS` +
      `,volume=${musicIn.volume.toFixed(2)}`;
    // duck lightly under titles so text reads
    const duckWindows = ovs
      .map((o) => ({ s: Math.max(0, o.start - winStart), e: Math.min(outDur, o.end - winStart) }))
      .filter((w) => w.e > 0 && w.s < outDur);
    if (duckWindows.length) {
      const terms = duckWindows.map((w) => `between(t\\,${w.s.toFixed(2)}\\,${w.e.toFixed(2)})`).join('+');
      mchain += `,volume='1-0.3*min(1\\,${terms})':eval=frame`;
    }
    // duck harder under kept dialogue so the voice is clear
    if (voiceWindows.length) {
      const terms = voiceWindows.map((w) => `between(t\\,${w.s.toFixed(2)}\\,${w.e.toFixed(2)})`).join('+');
      mchain += `,volume='1-0.65*min(1\\,${terms})':eval=frame`;
    }
    if (voiceLabels.length) {
      filters.push(`${mchain}[musd]`);
      filters.push(`[musd]${voiceLabels.join('')}amix=inputs=${1 + voiceLabels.length}:normalize=0:dropout_transition=0` +
        `${master(musicIn.fadeIn, musicIn.fadeOut)}[aout]`);
    } else {
      filters.push(`${mchain}${master(musicIn.fadeIn, musicIn.fadeOut)}[aout]`);
    }
    hasAudioOut = true;
  } else if (voiceLabels.length) {
    // no song, but kept dialogue — that becomes the audio
    const mixed = voiceLabels.length > 1
      ? (filters.push(`${voiceLabels.join('')}amix=inputs=${voiceLabels.length}:normalize=0:dropout_transition=0[vmix]`), '[vmix]')
      : voiceLabels[0];
    filters.push(`${mixed}anull${master(false, false)}[aout]`);
    hasAudioOut = true;
  }

  args.push('-filter_complex', filters.join(';'), '-map', '[vout]');
  if (hasAudioOut) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
  // -pix_fmt yuv420p is REQUIRED for the file to play outside a browser
  // (Windows Media Player, QuickTime, phones reject other pixel formats).
  // Without it a downloaded short/video shows a black screen or won't open.
  args.push('-t', outDur.toFixed(3), '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');

  const isCutdown = outDur < totalDur - 0.01;
  const label = (typeof name === 'string' && name.trim())
    ? name.trim().slice(0, 80)
    : `${isCutdown ? 'Cutdown' : 'Sequence'} ${target} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  const job = spawnFfmpegJob(req.userId, args, newFilename(req.userId, '.mp4'), outDur, label,
    { source: 'render', clips: resolved.length, cutdown: isCutdown, loop: !!loop }, 'video',
    assFile ? { cwd: os.tmpdir(), cleanupFiles: [path.join(os.tmpdir(), assFile)] } : undefined);
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
    // Suno pages are app-rendered (no audio URL in the HTML), but the song id
    // in the link maps straight to their CDN - try that first.
    const sunoId = /suno\.(com|ai)/i.test(target.hostname)
      && target.pathname.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (sunoId) {
      for (const cdn of [`https://cdn1.suno.ai/${sunoId[1]}.mp3`, `https://cdn2.suno.ai/${sunoId[1]}.mp3`]) {
        const head = await fetch(cdn, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null);
        if (head && head.ok) { audioUrl = cdn; label = 'Suno song'; break; }
      }
    }
    if (audioUrl) {
      // direct CDN hit - skip the page scrape entirely
    } else if (AUDIO_EXT_RE.test(target.pathname)) {
      audioUrl = target.href;
      label = decodeURIComponent(path.basename(target.pathname)).replace(/\.[^.]+$/, '') || label;
    } else {
      const pageRes = await fetch(target.href, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' }, redirect: 'follow' });
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
// Voice clone: F5-TTS is zero-shot (no training) — pass a reference clip + text.
// fal charges ~$0.05 / 1,000 characters (~1 minute of speech).
const MODEL_VOICE = process.env.FAL_MODEL_VOICE || 'fal-ai/f5-tts';
const VOICE_RATE = Number(process.env.STUDIO_RATE_VOICE || 0.05); // per 1,000 characters
const VOICE_MAX_CHARS = 2000;
// Emotional delivery: index-tts-2 clones from the same reference clip AND takes
// an emotion prompt, all in one call. Billed per second (~$0.002/s); ~1,000
// chars ≈ 1 min of speech, so the per-1k estimate is ~$0.12.
const MODEL_VOICE_EMO = process.env.FAL_MODEL_VOICE_EMO || 'fal-ai/index-tts-2/text-to-speech';
const VOICE_EMO_RATE = Number(process.env.STUDIO_RATE_VOICE_EMO || 0.12); // per ~1,000 characters (estimate)
// Built-in narrators speak on this computer, for free - see speak.js. The
// previous build shipped 13-second reference clips and paid fal to clone them
// on every take; the same Piper voices running locally cost nothing and come
// back in under a second, so the clips are gone and fal is only used now for
// cloning YOUR voice, or for emotional delivery.
const localTts = require('./speak');
// Free voice cloning on this computer (Chatterbox, MIT incl. weights). Optional
// and installed on demand — everything below degrades to the paid fal path
// when it isn't there.
const localClone = require('./voiceclone');
const VOICE_REF_DIR = path.join(__dirname, 'model-cache', 'voices', 'refs');
// Emotion needs fal (index-tts-2), and fal needs a reference clip to clone.
// Rather than ship one, we have the local narrator read a fixed passage once
// and keep that as the reference - same voice, no bundled audio, no license to
// worry about.
const VOICE_REF_TEXT =
  'This is how I sound when I read something out loud. I keep an even pace, ' +
  'and I let the important words land instead of rushing past them. ' +
  'Nothing fancy, just clear and steady.';
async function localVoiceReference(key) {
  const k = localTts.resolveKey(key);
  if (!k) throw new Error('Pick a narrator first.');
  fs.mkdirSync(VOICE_REF_DIR, { recursive: true });
  const out = path.join(VOICE_REF_DIR, `${k}.wav`);
  if (!fs.existsSync(out)) await localTts.speak({ voice: k, text: VOICE_REF_TEXT, outPath: out });
  return out;
}

const VOICE_MOODS = {
  neutral: '',
  happy: 'happy, warm and upbeat',
  hyped: 'excited, energetic and hyped up',
  sad: 'sad, soft and reflective',
  angry: 'angry, intense and forceful',
  calm: 'calm, smooth and reassuring',
};
// Whisper (wizper) bills ~$0.10 per minute of audio, so a full 3-4 min song is
// ~$0.30-0.40, NOT 2c. Flat estimate raised to a realistic per-song figure so
// the confirm dialog stops under-quoting. Override via STUDIO_RATE_TRANSCRIBE.
const TRANSCRIBE_RATE = Number(process.env.STUDIO_RATE_TRANSCRIBE || 0.35);

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

/* ---------------- voice clone: narrate in a character's voice (F5-TTS) ---------------- */
router.post('/voice-clone', async (req, res) => {
  // Either a built-in narrator, or your own uploaded clip. Narrators win if
  // both are sent, so switching to one doesn't silently keep using an old
  // reference that happens to still be selected in the dropdown.
  const presetKey = localTts.resolveKey(req.body?.voice);
  const preset = presetKey ? localTts.VOICES[presetKey] : null;
  let ref = null;
  if (!preset) {
    ref = db.getAsset(req.userId, Number(req.body?.refAssetId));
    if (!ref || ref.kind !== 'audio') {
      return res.status(404).json({
        error: localTts.available()
          ? 'Pick a narrator, or a reference voice clip of your own (an audio file — e.g. a vocal stem).'
          : 'Narrators need the free speech add-on, which is not installed on this computer. Run "Update my app" in Settings, or upload your own reference clip instead.',
      });
    }
  }
  if (preset && !localTts.available()) {
    return res.status(503).json({ error: 'The free narrators need the speech add-on, which is not installed on this computer. Run "Update my app" in Settings — it installs it — or upload your own reference clip instead.' });
  }
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'Type the words you want spoken.' });
  if (text.length > VOICE_MAX_CHARS) return res.status(400).json({ error: `Keep it under ${VOICE_MAX_CHARS} characters per take (about ${Math.round(VOICE_MAX_CHARS / 1000)} minutes). Split longer narration into a few takes.` });
  const wantsMood = typeof req.body?.mood === 'string' && req.body.mood !== 'neutral' && Boolean(VOICE_MOODS[req.body.mood]);

  /* ---- free path: a built-in narrator, plainly read, on this computer ---- */
  if (preset && !wantsMood) {
    const job = createJob(req.userId, 'voice', {});
    res.status(202).json({ job: jobJson(job) });
    (async () => {
      try {
        const filename = newFilename(req.userId, '.wav');
        // 0-70% is the one-off voice download; after that a take is so fast
        // there is nothing left to report.
        await localTts.speak({
          voice: presetKey,
          text,
          outPath: mediaPath(filename),
          onPct: (p) => { job.progress = Math.min(70, Math.round(p * 0.7)); },
        });
        job.progress = 92;
        const label = `${preset.label} says: ${text.slice(0, 36)}${text.length > 36 ? '…' : ''}`;
        job.assetId = db.createAsset(req.userId, 'audio', label, filename, null, {
          source: 'voice', voice: presetKey, free: true,
          duration: await probeMediaDuration(mediaPath(filename)),
        });
        job.progress = 100;
        job.status = 'done';
      } catch (err) {
        job.error = `${err.message || 'Narration failed.'} You can still use your own voice clip.`;
        job.status = 'error';
      }
    })();
    return;
  }

  /* ---- free path: your own voice, cloned on this computer ----
     Installed locally, a clone costs nothing, so it goes ahead of the paid
     path and never asks. Moods still need fal (Chatterbox reads plainly),
     so a mood request falls through. If the local run fails, the job reports
     it rather than silently spending money on the paid path instead. */
  if (!preset && !wantsMood && localClone.isInstalled()) {
    const job = createJob(req.userId, 'voice', {});
    res.status(202).json({ job: jobJson(job) });
    (async () => {
      try {
        const filename = newFilename(req.userId, '.wav');
        await localClone.clone({
          refPath: mediaPath(ref.filename),
          text,
          outPath: mediaPath(filename),
          onPct: (p) => { job.progress = Math.min(95, p); },
        });
        job.progress = 96;
        const label = `${ref.label} says: ${text.slice(0, 36)}${text.length > 36 ? '…' : ''}`;
        job.assetId = db.createAsset(req.userId, 'audio', label, filename, null, {
          source: 'voice', clonedFrom: ref.id, free: true, local: true,
          duration: await probeMediaDuration(mediaPath(filename)),
        });
        job.progress = 100;
        job.status = 'done';
      } catch (err) {
        job.error = `${err.message || 'Voice cloning failed.'}`;
        job.status = 'error';
      }
    })();
    return;
  }

  /* ---- paid path: your own voice, or a narrator with a mood on it ---- */
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'AI generation is not set up yet. Paste your fal.ai key in the Turn on AI box first.' });
  }
  {
    const capMsg = overDailyCap(req.userId, estActionCost('voice', { emotion: wantsMood, chars: text.length }));
    if (capMsg) return res.status(429).json({ error: capMsg });
  }
  try {
    // A mood on a built-in narrator: have that narrator read a fixed passage
    // once, locally and for free, and clone the mood from it.
    const srcPath = preset ? await localVoiceReference(presetKey) : mediaPath(ref.filename);
    const buf = fs.readFileSync(srcPath);
    // Locally-read references come back as .wav; an uploaded clip is usually
    // .mp3. Send the right type either way or fal rejects the upload.
    const refMime = /\.wav$/i.test(srcPath) ? 'audio/wav' : 'audio/mpeg';
    let refUrl;
    try {
      refUrl = await falUploadFile(buf, path.basename(srcPath), refMime);
    } catch (_) {
      if (buf.length > 9_000_000) throw new Error('could not upload the reference clip to fal and it is too large to send inline — trim it to ~20 seconds first');
      refUrl = `data:${refMime};base64,${buf.toString('base64')}`;
    }
    const mood = typeof req.body?.mood === 'string' && VOICE_MOODS[req.body.mood] !== undefined ? req.body.mood : 'neutral';
    const emoPrompt = VOICE_MOODS[mood];
    let model, input;
    if (mood !== 'neutral' && emoPrompt) {
      // index-tts-2: zero-shot clone + emotion prompt, one call
      model = MODEL_VOICE_EMO;
      input = { audio_url: refUrl, prompt: text, should_use_prompt_for_emotion: true, emotion_prompt: emoPrompt };
    } else {
      model = MODEL_VOICE;
      input = { gen_text: text, ref_audio_url: refUrl, model_type: 'F5-TTS', remove_silence: true };
    }
    const submitted = await falSubmit(model, input);
    const job = createJob(req.userId, 'voice', {
      fal: {
        statusUrl: submitted.status_url,
        responseUrl: submitted.response_url,
        expect: 'audio',
        label: `${preset ? preset.label : ref.label}${mood !== 'neutral' ? ` (${mood})` : ''} says: ${text.slice(0, 36)}${text.length > 36 ? '…' : ''}`,
      },
    });
    res.status(202).json({ job: jobJson(job) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* ---------------- free voice cloning: install / status / remove ---------------- */
// The install is big (Python + engine + model), so it is always a deliberate
// button press, reports real progress, and can be undone.
router.get('/voice-clone-local', (req, res) => {
  res.json({ ...localClone.status(), bytes: localClone.diskUsage() });
});

router.post('/voice-clone-local/install', async (req, res) => {
  if (localClone.isInstalled()) return res.json({ installed: true, alreadyInstalled: true });
  const st = localClone.status();
  if (st.installing) return res.status(409).json({ error: 'The install is already running.' });
  // Answer immediately; the browser polls the status route for progress. A
  // ten-minute request would time out somewhere between here and the tab.
  res.status(202).json({ started: true });
  localClone.install().catch(() => { /* the error is kept in status() */ });
});

router.post('/voice-clone-local/remove', (req, res) => {
  if (localClone.status().installing) return res.status(409).json({ error: 'Wait for the install to finish first.' });
  localClone.uninstall();
  res.json({ removed: true });
});

// Hear a narrator before committing a script to it. Free and local, so this
// can be pressed as many times as you like - but the FIRST press on a voice
// downloads it (~60MB), which is why the button says so while it works.
const VOICE_SAMPLE_TEXT = 'Day one is not a date. It is a decision. And you already made it.';
router.post('/voice-preview', async (req, res) => {
  if (!localTts.available()) {
    return res.status(503).json({ error: 'The free narrators need the speech add-on, which is not installed on this computer. Run "Update my app" in Settings.' });
  }
  const key = localTts.resolveKey(req.body?.voice);
  if (!key) return res.status(404).json({ error: 'Unknown narrator.' });
  const out = path.join(os.tmpdir(), `tsid-preview-${crypto.randomBytes(5).toString('hex')}.wav`);
  try {
    const text = typeof req.body?.text === 'string' && req.body.text.trim()
      ? req.body.text.trim().slice(0, 300)
      : VOICE_SAMPLE_TEXT;
    await localTts.speak({ voice: key, text, outPath: out });
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.send(fs.readFileSync(out));
  } catch (err) {
    res.status(500).json({ error: err.message || 'Could not play that narrator.' });
  } finally {
    try { fs.unlinkSync(out); } catch (_) {}
  }
});

/* ---------------- local speech-to-text (free, runs on this computer) ---------------- */
const localStt = require('./transcribe');

// Automatic caption cleanup: the raw local transcript goes through a large
// language model (via the already-configured fal key - no extra setup) that
// fixes mishears, garbled fragments, and chunk-overlap duplicates while
// preserving the speaker's exact voice. Fails soft: any problem returns null
// and the raw transcript is used unchanged.
// fal's any-llm routes through OpenRouter, whose catalog changes constantly -
// hardcoded ids rot. Primary source of truth: OpenRouter's public model list,
// fetched live (free, no key) to pick the newest Claude Sonnet automatically.
// The static list below is only the last-resort fallback (ids confirmed
// against openrouter.ai, Jul 2026).
const CAPTION_FIX_MODELS = (process.env.STUDIO_CAPTION_FIX_MODEL
  ? [process.env.STUDIO_CAPTION_FIX_MODEL]
  : ['anthropic/claude-sonnet-4.6', 'anthropic/claude-sonnet-4.5', 'google/gemini-2.5-flash']);
let liveModelCandidates = null; // cached for the server's lifetime
async function fetchLiveModelCandidates() {
  if (liveModelCandidates) return liveModelCandidates;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15_000);
    const res = await fetch('https://openrouter.ai/api/v1/models', { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ids = (((await res.json()).data) || [])
      .map((m) => m && m.id)
      .filter((s) => typeof s === 'string' && !s.includes(':'));
    // Lexicographic descending sorts 5 above 4.6 above 4.5 - good enough here.
    const sonnets = ids.filter((s) => s.startsWith('anthropic/claude-sonnet')).sort().reverse();
    const haikus = ids.filter((s) => s.startsWith('anthropic/claude-haiku')).sort().reverse();
    const flash = ids.filter((s) => /^google\/gemini-[\d.]+-flash$/.test(s)).sort().reverse();
    const picked = [...sonnets.slice(0, 2), ...haikus.slice(0, 1), ...flash.slice(0, 1)];
    if (picked.length) {
      liveModelCandidates = picked;
      try { db.logError('caption-fix', `Using live model catalog: ${picked.join(', ')}`); } catch (_) {}
    }
    return liveModelCandidates;
  } catch (_) { return null; }
}
const CAPTION_FIX_RATE = Number(process.env.STUDIO_RATE_CAPTION_FIX || 0.03); // ~per 5-min video, displayed estimate
const CAPTION_FIX_SYSTEM = 'You clean up speech-to-text transcripts of personal spoken-word videos. The speaker is telling their own true recovery story; keep their exact voice, slang, grammar, and every sensitive word faithfully - never censor, soften, summarize, or rewrite. Fix ONLY: clearly misheard words (use context to infer what was actually said), garbled fragments, and passages duplicated by transcription-chunk overlap.';

// fal's model catalog changes over time; a retired id gets HTTP 400 whose
// error text lists the ids fal currently accepts. Harvest those and retry -
// the polish self-heals instead of dying on a stale name.
function harvestModelIds(body) {
  // fal's validation error quotes its allowed ids ('x', 'y', ...) - prefer
  // those complete quoted names; fall back to any id-shaped token. Any text
  // model is acceptable as a last resort (deepseek etc.) - a working cheap
  // model beats a dead perfect one.
  const quoted = [...String(body).matchAll(/'([a-z0-9]+\/[a-z0-9][a-z0-9._-]{2,})'/gi)].map((m) => m[1].toLowerCase());
  const pool = quoted.length ? quoted : (String(body).match(/[a-z0-9]+\/[a-z0-9][a-z0-9._-]{2,}/gi) || []).map((s) => s.toLowerCase());
  const ids = pool.filter((s) => !/vision|audio|image|embed|whisper/i.test(s));
  const rank = (s) => (/claude/i.test(s) ? 0 : /gemini/i.test(s) ? 1 : /gpt/i.test(s) ? 2 : 3);
  return [...new Set(ids)].sort((a, b) => rank(a) - rank(b));
}
let discoveredModel = null; // a model that worked this run - goes first next batch

// One batch of lines through the models. Returns a Map(index -> fixed text, ''
// meaning delete) or null. Every failure reason is logged to Diagnostics with
// fal's own words, so a silent no-op polish can't hide.
async function aiFixBatch(chunk, offset) {
  const numbered = chunk.map((l, j) => `${offset + j}|${l.text}`).join('\n');
  const prompt = `Each line is "index|text". Return ONLY a JSON array covering EVERY index, like [{"i":${offset},"text":"..."}]. For a line that is pure duplication or a transcription glitch, return "" as its text so it gets removed. Change nothing that already reads as natural speech.\n\n${numbered}`;
  const live = (await fetchLiveModelCandidates()) || [];
  const queue = [...new Set([...(discoveredModel ? [discoveredModel] : []), ...live, ...CAPTION_FIX_MODELS])];
  const tried = new Set();
  let attempts = 0;
  while (queue.length && attempts < 6) {
    const model = queue.shift();
    if (tried.has(model)) continue;
    tried.add(model);
    attempts++;
    // Hard 60s cap per attempt - a slow provider must never hang the job.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 60_000);
    try {
      const res = await fetch('https://fal.run/fal-ai/any-llm', {
        method: 'POST',
        headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, system_prompt: CAPTION_FIX_SYSTEM, prompt }),
        signal: ctl.signal,
      });
      if (!res.ok) {
        // Read the WHOLE error - fal's 422 lists its complete allowed-model
        // enum, and truncating it once cost us the answer mid-name.
        const body = await res.text().catch(() => '');
        try { db.logError('caption-fix', `${model} → HTTP ${res.status}: ${body.slice(0, 160)}`, body.slice(0, 2000)); } catch (_) {}
        for (const id of harvestModelIds(body)) if (!tried.has(id)) queue.push(id);
        continue;
      }
      const data = await res.json();
      const text = String(data.output || data.response || '');
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) {
        try { db.logError('caption-fix', `${model} returned no JSON`, text.slice(0, 200)); } catch (_) {}
        continue;
      }
      const arr = JSON.parse(m[0]);
      if (!Array.isArray(arr) || arr.length < chunk.length * 0.8) {
        try { db.logError('caption-fix', `${model} covered ${Array.isArray(arr) ? arr.length : 0}/${chunk.length} lines`); } catch (_) {}
        continue;
      }
      if (discoveredModel !== model) {
        try { db.logError('caption-fix', `✓ Words polished by ${model}`); } catch (_) {}
      }
      discoveredModel = model;
      return new Map(arr.map((e) => [Number(e.i), String(e.text ?? '').trim()]));
    } catch (err) {
      const msg = err && err.name === 'AbortError' ? 'timed out after 60s' : (err && err.message);
      try { db.logError('caption-fix', `${model} failed: ${msg}`); } catch (_) {}
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// Batched (25 lines per request) so long videos can't overflow the model's
// output and lose the whole cleanup. A failed batch keeps its raw lines.
async function aiCleanTranscriptLines(lines) {
  if (!FAL_KEY || !lines.length) return null;
  const out = [...lines];
  const deletions = new Set();
  let anyFixed = false;
  for (let base = 0; base < lines.length; base += 25) {
    const chunk = lines.slice(base, base + 25);
    const fixes = await aiFixBatch(chunk, base);
    if (!fixes) continue;
    anyFixed = true;
    chunk.forEach((l, j) => {
      const i = base + j;
      if (!fixes.has(i)) return;
      const t = fixes.get(i);
      if (t === '') deletions.add(i);
      else out[i] = { ...out[i], text: t };
    });
  }
  if (!anyFixed) return null;
  return out.filter((_, i) => !deletions.has(i));
}

router.post('/transcribe-local', (req, res) => {
  const asset = db.getAsset(req.userId, Number(req.body?.assetId));
  if (!asset || (asset.kind !== 'video' && asset.kind !== 'audio')) {
    return res.status(404).json({ error: 'Pick a video or audio file from your library first.' });
  }
  const job = createJob(req.userId, 'transcribe', {});
  res.status(202).json({ job: jobJson(job) });
  (async () => {
    try {
      const result = await localStt.transcribeLocal(
        ffmpegBin(),
        mediaPath(asset.filename),
        (phase, pct) => {
          if (phase === 'extract') job.progress = 3;
          else if (phase === 'model') job.progress = 5 + Math.round(pct * 0.35); // 5-40%: first-run model download
          else job.progress = 40 + Math.round((pct || 0) * 0.5); // 40-90%: listening, moves per audio piece
        },
        (note) => { try { db.logError('transcribe', note); } catch (_) {} }
      );
      // AI cleanup of mishears/garbles - ONLY when the user said yes to the
      // priced confirm (falls back to the raw transcript if it fails).
      job.progress = 92;
      const cleaned = req.body?.polish ? await aiCleanTranscriptLines(result.lines) : null;
      const lines = cleaned || result.lines;
      const text = lines.map((l) => l.text).join(' ').trim();
      // Keep the transcript on the asset - the clip picker and future features
      // read it from here instead of transcribing again.
      const meta = asset.meta ? JSON.parse(asset.meta) : {};
      meta.transcript = { lines, text };
      db.updateAssetMeta(req.userId, asset.id, meta);
      job.transcript = { lines, text, srt: localStt.toSrt(lines), aiCleaned: !!cleaned };
      job.progress = 100;
      job.status = 'done';
    } catch (err) {
      job.error = err.message || 'Transcription failed.';
      job.status = 'error';
    }
  })();
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
    const shot = spec.shots[(nth - 1) % spec.shots.length];
    const mood = SHOT_MOODS[i % SHOT_MOODS.length];
    // Anchor on the most evocative lyric line so the image is ABOUT the song,
    // not a bag of disconnected keywords ("rain and pain and window"). The
    // pinned character becomes the person in the frame via reference photos.
    const firstLine = lines.split('\n').map((l) => l.trim()).filter(Boolean)
      .sort((a, b) => b.length - a.length)[0] || title || 'a quiet moment';
    const prompt = `${shot}, a cinematic music-video moment that captures the feeling of the lyric "${firstLine}", `
      + `the main character in a real environment that fits those words, ${mood}, ${spec.energy}${style ? `, ${style}` : ''}, `
      + `photorealistic film still`;
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

  const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
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

/* ---------------- one-click app update ---------------- */
// The app updates itself from GitHub: download the branch ZIP, overlay the new
// code onto the install folder, refresh dependencies. Your data survives by
// construction - .env, data.sqlite and media/ are gitignored so they are never
// inside the ZIP being copied over.
const APP_ROOT = path.join(__dirname, '..', '..'); // the folder holding the Start Studio launcher and the Studio app
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
// NOTE: do NOT encodeURIComponent the branch - GitHub's ref endpoints want
// raw slashes ("claude/vibe-code-uwxxlk"), and %2F makes them 404, which
// silently broke every in-app update. Encode only individual path segments.
const UPDATE_REF = UPDATE_BRANCH.split('/').map(encodeURIComponent).join('/');
// Tarball, not zipball: GNU tar on Linux reads .tar.gz via `tar -xzf` with no
// external tool, whereas a .zip needs the `unzip` binary most servers lack
// (the in-app update failed with "spawn unzip ENOENT"). bsdtar on Windows
// 10+/macOS reads .tar.gz too, so the tarball works everywhere.
const UPDATE_ZIP_URL = process.env.APP_UPDATE_ZIP_URL // test override
  || `https://api.github.com/repos/${UPDATE_REPO}/tarball/${UPDATE_REF}`;
const UPDATE_STATE_FILE = path.join(__dirname, 'update-state.json');
// Strict whitelist: an update only ever copies Studio's own files. The repo also
// contains the Turn Someday Into Day One app, and the two must stay fully
// separate on disk - updating one never adds or touches the other's files.
// (Launchers are excluded too: overwriting a batch file mid-run corrupts its
// execution on Windows, and they almost never change.)
const UPDATE_ONLY = new Set(['Studio', 'HOW-TO-USE.md']);

function runCmd(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    // No shell: cmd.exe re-splits arguments on spaces, which breaks temp paths
    // like C:\Users\First Last\AppData\... . Windows-only .cmd shims (npm) are
    // wrapped in `cmd /c` by the caller instead.
    const { timeoutMs, ...spawnOpts } = opts || {};
    const proc = spawn(cmd, args, spawnOpts);
    let err = '';
    let timer = null;
    if (timeoutMs) timer = setTimeout(() => { try { proc.kill(); } catch (_) {} reject(new Error(`${cmd} timed out`)); }, timeoutMs);
    proc.stderr?.on('data', (c) => { err = (err + c.toString()).slice(-800); });
    proc.on('error', (e) => { if (timer) clearTimeout(timer); reject(e); });
    proc.on('close', (code) => { if (timer) clearTimeout(timer); code === 0 ? resolve() : reject(new Error(err || `${cmd} exited ${code}`)); });
  });
}

async function fetchLatestCommit() {
  const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/commits/${UPDATE_REF}`, {
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
  // remember the current dependencies so we only run the slow npm install when
  // they actually changed (a code-only update should never touch npm)
  let pkgBefore = '';
  try { pkgBefore = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'); } catch (_) {}
  try {
    // 1. download the latest code
    const zipRes = await fetch(UPDATE_ZIP_URL, { headers: GH_HEADERS });
    if (zipRes.status === 404 && !UPDATE_TOKEN) throw new Error('download blocked - GitHub says the app repo is not visible. If the repo is private, add APP_UPDATE_TOKEN to Studio/server/.env (or make the repo public)');
    if (!zipRes.ok) throw new Error(`Download failed (${zipRes.status}).`);
    const tarPath = path.join(tmp, 'update.tar.gz');
    fs.writeFileSync(tarPath, Buffer.from(await zipRes.arrayBuffer()));

    // 2. extract. `tar -xzf` reads .tar.gz on Linux, Windows 10+ and macOS with
    // no external unzip; plain `tar -xf` is a fallback for tar builds that
    // auto-detect gzip but reject an explicit -z.
    try { await runCmd('tar', ['-xzf', tarPath, '-C', tmp]); }
    catch (_) { await runCmd('tar', ['-xf', tarPath, '-C', tmp]); }
    const rootName = fs.readdirSync(tmp).find((n) => n !== 'update.tar.gz' && fs.statSync(path.join(tmp, n)).isDirectory());
    if (!rootName) throw new Error('The downloaded archive looked empty.');
    const src = path.join(tmp, rootName);

    // 3. overlay the new code onto the install (data files aren't in the ZIP)
    for (const entry of fs.readdirSync(src)) {
      if (!UPDATE_ONLY.has(entry)) continue;
      fs.cpSync(path.join(src, entry), path.join(APP_ROOT, entry), { recursive: true, force: true });
    }

    // 4. refresh dependencies ONLY when package.json actually changed. npm
    // install is the slow, hang-prone step; skipping it for the usual
    // code-only update is what makes the updater finish instead of appearing
    // stuck forever. The new files are already in place from step 3.
    let depsNote = '';
    let pkgAfter = '';
    try { pkgAfter = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'); } catch (_) {}
    if (pkgAfter && pkgAfter !== pkgBefore) {
      try {
        await (process.platform === 'win32'
          ? runCmd('cmd', ['/c', 'npm', 'install', '--no-audit', '--no-fund'], { cwd: __dirname, timeoutMs: 240000 })
          : runCmd('npm', ['install', '--no-audit', '--no-fund'], { cwd: __dirname, timeoutMs: 240000 }));
        depsNote = ' New add-ons were installed too.';
      } catch (e) {
        depsNote = ' (Heads up: a dependency refresh timed out — the app still updated. If anything misbehaves, run "npm install" in Studio/server once.)';
      }
    }

    // 5. remember what we're on now
    let state = { sha: 'unknown', date: new Date().toISOString() };
    try { state = await fetchLatestCommit(); } catch (_) {}
    fs.writeFileSync(UPDATE_STATE_FILE, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));

    res.json({ ok: true, message: `Update installed! Close the black window, double-click Start Studio again, then press Ctrl+Shift+R in your browser.${depsNote}` });
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

/* ---------------- built-in documents (guide + price list PDFs) ---------------- */
// Served straight from the Studio folder so they're always one tap from Settings.
function sendStudioDoc(res, filename, downloadName) {
  const p = path.join(__dirname, '..', filename);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'That document is not installed in this copy of Studio.' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${downloadName || filename}"`);
  fs.createReadStream(p).pipe(res);
}
router.get('/docs/guide.pdf', (req, res) => sendStudioDoc(res, 'Studio-Guide.pdf', 'Studio-Guide.pdf'));
router.get('/docs/pricelist.pdf', (req, res) => sendStudioDoc(res, 'Studio-Price-List.pdf', 'Studio-Price-List.pdf'));

/* ---------------- paid-generation recovery + spend ledger ---------------- */
// Best-effort estimate of what a single generation cost, from its type/tier and
// stored details. Marked as an estimate everywhere — your real fal balance is
// the final word — but it's built from the same verified rates shown on the
// buttons, so the running total is honest about where money actually went.
function estReceiptCost(r) {
  if (r.expect === 'audio') return null; // voice length isn't stored — don't guess
  let meta = {}; try { meta = JSON.parse(r.meta || 'null') || {}; } catch (_) {}
  const c = estActionCost(r.expect, { tier: r.tier, seconds: meta.seconds, characterId: r.character_id });
  return c || (r.expect === 'video' || r.expect === 'image' ? c : null);
}

// List recent fal receipts + a running spend estimate so the artist can see
// exactly what they've paid for and which ones did / didn't land.
router.get('/fal/receipts', (req, res) => {
  const rows = db.getFalReceipts(req.userId, 200);
  let total = 0, counted = 0;
  const receipts = rows.map((r) => {
    // Failed generations that never completed weren't billed — don't count them.
    const cost = r.status === 'error' ? null : estReceiptCost(r);
    if (cost != null) { total += cost; counted += 1; }
    // The numbers that decide the price (seconds, resolution) and the id that
    // identifies the run on fal's own dashboard, so this list can be checked
    // against the real bill line by line instead of taken on trust.
    let m = {}; try { m = JSON.parse(r.meta || 'null') || {}; } catch (_) {}
    return {
      id: r.id, requestId: r.request_id, expect: r.expect, label: r.label,
      tier: r.tier, status: r.status, assetId: r.asset_id, createdAt: r.created_at,
      seconds: m.seconds || null, resolution: m.resolution || null, model: m.model || null,
      cost: cost == null ? null : Number(cost.toFixed(3)),
    };
  });
  const open = receipts.filter((r) => r.status === 'running').length;
  res.json({
    receipts: receipts.slice(0, 60), open, totalSpent: Number(total.toFixed(2)), counted,
    cap: DAILY_USD_CAP, spentToday: Number(todaySpendUSD(req.userId).toFixed(2)),
  });
});

// One button: re-check every still-open receipt against fal. Any that finished
// while the browser was gone get downloaded into the library now. Never charges
// — reading a fal result is free — so it's safe to run any time.
router.post('/fal/recover', async (req, res) => {
  if (!FAL_KEY) return res.status(503).json({ error: 'AI generation is not set up yet.' });
  const open = db.getOpenFalReceipts(req.userId);
  let recovered = 0, stillWorking = 0, failed = 0;
  for (const r of open) {
    let meta = {}; try { meta = JSON.parse(r.meta || 'null') || {}; } catch (_) {}
    const job = {
      id: `recover-${r.id}`, userId: req.userId, status: 'running', progress: 0, assetId: null,
      startedAt: Date.parse(r.created_at) || Date.now(), _receiptId: r.id,
      fal: { statusUrl: r.status_url, responseUrl: r.response_url, expect: r.expect, label: r.label || 'Recovered', characterId: r.character_id, meta },
    };
    try { await refreshFalJob(job); } catch (_) {}
    if (job.status === 'done') recovered++;
    else if (job.status === 'error') failed++;
    else stillWorking++;
  }
  res.json({ recovered, stillWorking, failed, checked: open.length });
});

// Manual rescue for clips paid for BEFORE receipts existed: paste the output
// file URL straight from your fal.ai dashboard (open the request → copy the
// video/image URL) and Studio downloads it into your library. Free.
router.post('/fal/import', async (req, res) => {
  const { url, kind } = req.body || {};
  const clean = typeof url === 'string' ? url.trim() : '';
  if (!/^https?:\/\//i.test(clean)) return res.status(400).json({ error: 'Paste a direct file link (starts with http) from your fal.ai dashboard.' });
  const isVideo = kind === 'video' || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(clean) || (kind !== 'image' && kind !== 'audio' && /video/i.test(clean));
  const isAudio = kind === 'audio' || /\.(wav|mp3|m4a|aac)(\?|$)/i.test(clean);
  const assetKind = isVideo ? 'video' : isAudio ? 'audio' : 'image';
  const ext = isVideo ? '.mp4' : isAudio ? '.wav' : /\.(jpe?g)(\?|$)/i.test(clean) ? '.jpg' : '.png';
  try {
    const filename = await downloadToMedia(req.userId, clean, ext);
    const meta = { source: 'fal-import' };
    if (assetKind !== 'image') meta.duration = await probeMediaDuration(mediaPath(filename));
    const id = db.createAsset(req.userId, assetKind, 'Recovered from fal', filename, null, meta);
    res.status(201).json({ asset: assetJson(db.getAsset(req.userId, id)) });
  } catch (err) {
    res.status(502).json({ error: `Couldn't import that link: ${err.message}` });
  }
});

module.exports = { router, deleteUserAssets };
