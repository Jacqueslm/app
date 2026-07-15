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
};
const CONTENT_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.ogg': 'audio/ogg', '.flac': 'audio/flac',
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
  const kind = ['image', 'video', 'audio'].includes(req.query.kind) ? req.query.kind : null;
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
  if (!req.body || !req.body.length) return res.status(400).json({ error: 'Empty upload.' });
  if (characterId && !db.getCharacter(req.userId, characterId)) {
    return res.status(404).json({ error: 'Character not found.' });
  }
  const filename = newFilename(req.userId, ext);
  fs.writeFileSync(mediaPath(filename), req.body);
  const label = path.basename(name, ext).slice(0, 80) || 'Upload';
  const meta = { source: 'upload' };
  if (kind !== 'image') meta.duration = await probeMediaDuration(mediaPath(filename));
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

/* ---------------- Sequencer (ffmpeg) ---------------- */
const RENDER_SIZES = new Set(['1920x1080', '1080x1920', '1080x1080']);

router.post('/render', async (req, res) => {
  const { clips, musicAssetId, size, fadeAudio } = req.body || {};
  if (!Array.isArray(clips) || !clips.length) {
    return res.status(400).json({ error: 'Add at least one clip to the timeline.' });
  }
  if (clips.length > 120) return res.status(400).json({ error: 'Timeline is limited to 120 clips.' });
  const target = RENDER_SIZES.has(size) ? size : '1920x1080';
  const [W, H] = target.split('x').map(Number);

  const resolved = [];
  for (const c of clips) {
    const row = db.getAsset(req.userId, Number(c.assetId));
    if (!row || row.kind !== 'video') return res.status(404).json({ error: `Clip ${c.assetId} not found.` });
    const file = mediaPath(row.filename);
    const start = Math.max(0, Number(c.start) || 0);
    let end = Number(c.end);
    if (!Number.isFinite(end) || end <= 0) {
      // No trim end from the client - fall back to the clip's real length.
      const meta = row.meta ? JSON.parse(row.meta) : {};
      end = meta.duration || (await probeMediaDuration(file));
    }
    if (!end || end <= start) {
      return res.status(400).json({ error: `Clip "${row.label}" has an invalid trim range.` });
    }
    resolved.push({ file, start, end, dur: end - start });
  }

  let music = null;
  if (musicAssetId) {
    const row = db.getAsset(req.userId, Number(musicAssetId));
    if (!row || row.kind !== 'audio') return res.status(404).json({ error: 'Music track not found.' });
    music = mediaPath(row.filename);
  }

  const totalDur = resolved.reduce((s, c) => s + c.dur, 0);
  const outFile = newFilename(req.userId, '.mp4');
  const outPath = mediaPath(outFile);

  const args = [];
  for (const c of resolved) args.push('-ss', String(c.start), '-to', String(c.end), '-i', c.file);
  if (music) args.push('-i', music);

  // Normalize every clip to the target frame, then hard-cut concat. Music (if
  // any) replaces all audio and fades out over the last 2 seconds.
  const filters = resolved.map((_, i) =>
    `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${i}]`
  );
  const concatIn = resolved.map((_, i) => `[v${i}]`).join('');
  filters.push(`${concatIn}concat=n=${resolved.length}:v=1:a=0[vout]`);
  if (music) {
    const fade = fadeAudio === false ? '' : `,afade=t=out:st=${Math.max(0, totalDur - 2).toFixed(2)}:d=2`;
    filters.push(`[${resolved.length}:a]atrim=0:${totalDur.toFixed(2)}${fade}[aout]`);
  }

  args.push('-filter_complex', filters.join(';'), '-map', '[vout]');
  if (music) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-movflags', '+faststart', '-y', outPath);

  const job = createJob(req.userId, 'render', {});
  const proc = spawn(ffmpegBin(), args);
  let stderrTail = '';
  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderrTail = (stderrTail + text).slice(-4000);
    const m = text.match(/time=(\d+):(\d+):(\d+\.?\d*)/);
    if (m) {
      const secs = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      job.progress = Math.min(99, Math.round((secs / totalDur) * 100));
    }
  });
  proc.on('error', (err) => {
    job.status = 'error';
    job.error = `Could not start ffmpeg: ${err.message}. Run npm install in server/ to fetch it.`;
  });
  proc.on('close', (code) => {
    if (job.status === 'error') return;
    if (code === 0) {
      job.assetId = db.createAsset(req.userId, 'video', `Sequence ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, outFile, null,
        { source: 'render', clips: resolved.length, seconds: Math.round(totalDur) });
      job.progress = 100;
      job.status = 'done';
    } else {
      try { fs.unlinkSync(outPath); } catch (_) {}
      job.status = 'error';
      job.error = `ffmpeg exited with code ${code}: …${stderrTail.slice(-500)}`;
    }
  });

  res.status(202).json({ job: jobJson(job) });
});

/* ---------------- job polling ---------------- */
router.get('/jobs/:id', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.userId !== req.userId) return res.status(404).json({ error: 'Job not found.' });
  if (job.fal) await refreshFalJob(job);
  res.json({ job: jobJson(job) });
});

module.exports = { router, deleteUserAssets };
