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
const billing = require('./billing');
const { requireAuth } = require('./auth');

const FAL_KEY = process.env.FAL_KEY;
const FAL_QUEUE_BASE = 'https://queue.fal.run';

// Model ids move fast in this space - override any of these in .env without code changes.
const MODEL_TEXT_TO_IMAGE = process.env.FAL_MODEL_TEXT_TO_IMAGE || 'fal-ai/flux/dev';
const MODEL_CHARACTER_IMAGE = process.env.FAL_MODEL_CHARACTER_IMAGE || 'fal-ai/flux-pro/kontext';
const MODEL_LORA_IMAGE = process.env.FAL_MODEL_LORA_IMAGE || 'fal-ai/flux-lora';
const MODEL_IMAGE_TO_VIDEO = process.env.FAL_MODEL_IMAGE_TO_VIDEO || 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';

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
  };
}

/* ------------------------------------------------------------------ */
/* fal.ai queue helpers                                                */
/* ------------------------------------------------------------------ */
async function falSubmit(model, input) {
  const res = await fetch(`${FAL_QUEUE_BASE}/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${FAL_KEY}` },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
    throw new Error(`fal.ai rejected the job (${res.status}): ${detail}`);
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

// Poll a running fal job once. Called from the client's polling loop rather
// than a server timer, so an abandoned tab doesn't leave a hot loop running.
async function refreshFalJob(job) {
  if (job.status !== 'running') return;
  try {
    const status = await falGet(job.fal.statusUrl);
    if (status.status === 'IN_QUEUE') { job.progress = 5; return; }
    if (status.status === 'IN_PROGRESS') { job.progress = Math.min(90, (job.progress || 5) + 5); return; }
    if (status.status !== 'COMPLETED') return;

    const result = await falGet(job.fal.responseUrl);
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
      imageToVideo: MODEL_IMAGE_TO_VIDEO,
    },
  });
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

router.delete('/assets/:id', (req, res) => {
  const row = db.getAsset(req.userId, Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Asset not found.' });
  db.deleteAsset(req.userId, row.id);
  try { fs.unlinkSync(mediaPath(row.filename)); } catch (_) {}
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
    refs: db.getAssets(req.userId, 'image').filter((a) => a.character_id === c.id).map(assetJson),
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

/* ---------------- AI generation (fal.ai) ---------------- */
const IMAGE_SIZES = new Set(['square_hd', 'portrait_16_9', 'landscape_16_9']);

router.post('/scene', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'AI generation is not set up yet. Add FAL_KEY to server/.env (get one at fal.ai) and restart the server.' });
  }
  const { prompt, characterId, imageSize } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required.' });
  }
  if (imageSize && !IMAGE_SIZES.has(imageSize)) {
    return res.status(400).json({ error: 'imageSize must be square_hd, portrait_16_9, or landscape_16_9.' });
  }
  if (db.getImageCount(req.userId, todayUTC()) >= DAILY_AI_IMAGE_LIMIT) {
    return res.status(429).json({ error: `Daily AI image cap (${DAILY_AI_IMAGE_LIMIT}) reached. Raise STUDIO_DAILY_IMAGE_LIMIT in .env if this is really you.` });
  }

  const cleanPrompt = prompt.trim().slice(0, 2000);
  let model = MODEL_TEXT_TO_IMAGE;
  const input = { prompt: cleanPrompt, image_size: imageSize || 'landscape_16_9', num_images: 1 };
  let character = null;

  if (characterId) {
    character = db.getCharacter(req.userId, Number(characterId));
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    if (character.lora_url) {
      // Strongest consistency: the trained LoRA is baked into generation.
      model = MODEL_LORA_IMAGE;
      input.loras = [{ path: character.lora_url, scale: 1 }];
      if (character.trigger_word && !cleanPrompt.includes(character.trigger_word)) {
        input.prompt = `${character.trigger_word}, ${cleanPrompt}`;
      }
    } else {
      // No LoRA yet: reference-conditioned edit from the primary reference image.
      const refs = db.getAssets(req.userId, 'image').filter((a) => a.character_id === character.id);
      if (!refs.length) {
        return res.status(400).json({ error: `Upload at least one reference photo for ${character.name} first (Characters tab), or paste a LoRA URL.` });
      }
      model = MODEL_CHARACTER_IMAGE;
      input.image_url = fileToDataUri(refs[0].filename);
    }
  }

  try {
    const submitted = await falSubmit(model, input);
    const job = createJob(req.userId, 'ai-image', {
      fal: {
        statusUrl: submitted.status_url,
        responseUrl: submitted.response_url,
        expect: 'image',
        label: cleanPrompt.slice(0, 80),
        characterId: character ? character.id : null,
        meta: { source: 'fal', model, prompt: cleanPrompt },
      },
    });
    res.status(202).json({ job: jobJson(job) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/animate', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'AI generation is not set up yet. Add FAL_KEY to server/.env (get one at fal.ai) and restart the server.' });
  }
  const { assetId, prompt, duration } = req.body || {};
  const still = db.getAsset(req.userId, Number(assetId));
  if (!still || still.kind !== 'image') {
    return res.status(404).json({ error: 'Pick an image from your library to animate.' });
  }
  const seconds = [5, 10].includes(Number(duration)) ? Number(duration) : 5;
  if (db.getVideoCount(req.userId, todayUTC()) >= DAILY_AI_VIDEO_LIMIT) {
    return res.status(429).json({ error: `Daily AI video cap (${DAILY_AI_VIDEO_LIMIT}) reached. Raise STUDIO_DAILY_VIDEO_LIMIT in .env if this is really you.` });
  }

  const motionPrompt = (typeof prompt === 'string' && prompt.trim())
    ? prompt.trim().slice(0, 1000)
    : 'subtle cinematic motion, natural movement, keep the subject consistent';

  try {
    const submitted = await falSubmit(MODEL_IMAGE_TO_VIDEO, {
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
        meta: { source: 'fal', model: MODEL_IMAGE_TO_VIDEO, prompt: motionPrompt, fromAssetId: still.id, seconds },
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
  const { clips, transitions, music, overlays, size, fadeFromBlack, fadeToBlack, window: win, loop, name } = req.body || {};
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

  // --- overlays (full-frame transparent PNGs the client rendered)
  const ovs = [];
  for (const o of (Array.isArray(overlays) ? overlays : []).slice(0, 24)) {
    const row = db.getAsset(req.userId, Number(o.assetId));
    if (!row || row.kind !== 'image') return res.status(404).json({ error: 'Overlay image not found.' });
    const start = Math.max(0, Number(o.start) || 0);
    const end = Math.max(start + 0.2, Number(o.end) || start + 3);
    const fade = Math.min(2, Math.max(0, o.fade == null ? 0.4 : Number(o.fade)));
    if (start >= winEnd || end <= winStart) continue; // fully outside the window
    ovs.push({ file: mediaPath(row.filename), start, end, fade });
  }

  // --- inputs: clips, then music, then overlays
  const args = [];
  for (const c of resolved) {
    if (c.kind === 'image') args.push('-loop', '1', '-t', c.dur.toFixed(3), '-i', c.file);
    else args.push('-ss', String(c.start), '-to', String(c.end), '-i', c.file);
  }
  const musicIdx = resolved.length;
  if (musicIn) for (const t of musicIn.tracks) args.push('-i', t.file);
  const ovBase = musicIdx + (musicIn ? musicIn.tracks.length : 0);
  for (const o of ovs) args.push('-loop', '1', '-t', (o.end + 0.2).toFixed(3), '-i', o.file);

  // --- filter graph
  const filters = [];
  resolved.forEach((c, i) => {
    filters.push(
      `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},format=yuv420p${eqFilter(c.eq)},` +
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
  ovs.forEach((o, k) => {
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

/* ---------------- job polling ---------------- */
router.get('/jobs/:id', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.userId !== req.userId) return res.status(404).json({ error: 'Job not found.' });
  if (job.fal) await refreshFalJob(job);
  res.json({ job: jobJson(job) });
});

module.exports = { router, deleteUserAssets };
