// Local speech-to-text: Whisper running on this computer via transformers.js.
// First use downloads the model into server/model-cache, and after that it
// works fully offline - no keys, no per-use cost, nothing leaves the machine.
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

// small.en hears more accurately; base.en is the proven fallback that already
// worked on this install. If small.en can't load (download blocked, first run
// offline), transcription automatically drops back to base.en instead of
// failing - never worse than before. Override via STUDIO_WHISPER_MODEL.
const MODEL_ID = process.env.STUDIO_WHISPER_MODEL || 'Xenova/whisper-small.en';
const FALLBACK_MODEL_ID = 'Xenova/whisper-base.en';
const CACHE_DIR = path.join(__dirname, 'model-cache');
const SR = 16000;

// Which of the two possible causes of a native-load failure this actually is.
// Reports facts, not theories: what CPU this computer runs, which build the
// speech engine shipped, and whether that file is a whole one.
function onnxDiagnosis() {
  const arch = process.arch;
  const plat = process.platform;
  const base = path.join(__dirname, 'node_modules', 'onnxruntime-node', 'bin', 'napi-v6', plat);
  let builds = [];
  try { builds = fs.readdirSync(base); } catch (_) {}
  const bin = path.join(base, arch, 'onnxruntime_binding.node');
  let size = 0;
  let header = '';
  try {
    size = fs.statSync(bin).size;
    const fd = fs.openSync(bin, 'r');
    const h = Buffer.alloc(2);
    fs.readSync(fd, h, 0, 2, 0);
    fs.closeSync(fd);
    header = h.toString('ascii');
  } catch (_) {}

  const lines = [`This computer: ${plat} ${arch}. Speech engine builds installed: ${builds.join(', ') || 'none found'}.`];
  if (!builds.length) {
    lines.push('The speech engine was never installed. Run: npm install  (inside Studio\\server)');
  } else if (!builds.includes(arch)) {
    lines.push(`There is no ${arch} build here, so this computer cannot run any of them. Run: npm install  (inside Studio\\server) — it will fetch the right one.`);
  } else if (!size) {
    lines.push(`The ${arch} file is missing from ${base}. Delete the onnxruntime-node folder and run: npm install`);
  } else if (plat === 'win32' && header !== 'MZ') {
    lines.push(`The ${arch} file is damaged — it is ${size} bytes and does not start like a real program file, so the install did not finish. Delete Studio\\server\\node_modules\\onnxruntime-node and run: npm install`);
  } else if (size < 50000) {
    lines.push(`The ${arch} file is only ${size} bytes, far too small — the install did not finish. Delete Studio\\server\\node_modules\\onnxruntime-node and run: npm install`);
  } else {
    lines.push(`The ${arch} file looks intact (${size} bytes), so something outside Studio is blocking it — usually antivirus, or a folder the computer is not allowed to run programs from. Try moving Studio to a plain folder like C:\\Studio.`);
  }
  return lines.join('\n');
}

const asrCache = new Map(); // modelId -> Promise<pipeline>
async function getAsr(modelId, onDownloadPct) {
  if (!asrCache.has(modelId)) {
    const p = (async () => {
      // transformers.js is ESM-only; dynamic import keeps this file CommonJS.
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = CACHE_DIR;
      return pipeline('automatic-speech-recognition', modelId, {
        progress_callback: (pr) => {
          if (pr.status === 'progress' && pr.total) {
            onDownloadPct && onDownloadPct(Math.round((pr.loaded / pr.total) * 100));
          }
        },
      });
    })();
    // A failed model download must not poison later retries.
    p.catch(() => { asrCache.delete(modelId); });
    asrCache.set(modelId, p);
  }
  return asrCache.get(modelId);
}

// 16kHz mono float32 raw PCM - exactly what Whisper expects, no WAV header to parse.
function extractPcm(ffmpeg, inputPath) {
  return new Promise((resolve, reject) => {
    const out = path.join(os.tmpdir(), `stt-${crypto.randomBytes(6).toString('hex')}.pcm`);
    const proc = spawn(
      ffmpeg,
      ['-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-acodec', 'pcm_f32le', out],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    proc.on('error', (e) => reject(new Error(`Could not run ffmpeg: ${e.message}`)));
    proc.on('close', (code) => {
      try {
        if (code !== 0 || !fs.existsSync(out)) {
          return reject(new Error('Could not read the audio from that file.'));
        }
        const buf = fs.readFileSync(out);
        fs.unlinkSync(out);
        // slice() copies into a fresh, 4-byte-aligned ArrayBuffer.
        resolve(new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength - (buf.byteLength % 4))));
      } catch (e) { reject(e); }
    });
  });
}

// Whisper sometimes gets stuck in a loop and emits the same phrase dozens of
// times in a row ("I'm going to go. I'm going to go. ..."). Collapse any short
// phrase repeated 3+ times consecutively down to a single instance.
function collapseRepeats(text) {
  let out = String(text);
  for (let n = 8; n >= 1; n--) {
    const re = new RegExp('((?:\\S+\\s+){' + (n - 1) + '}\\S+)(?:\\s+\\1){2,}', 'gi');
    out = out.replace(re, '$1');
  }
  return out.replace(/\s+/g, ' ').trim();
}

// The audio is processed in ~60s pieces (with a 2s overlap so words at a seam
// aren't cut in half). This gives real progress on long videos - the old
// single-pass approach sat at one percentage for many minutes on a slower
// model, which looked frozen.
const PIECE_S = 60;
const OVERLAP_S = 2;
function planPieces(totalSamples) {
  const pieces = [];
  for (let s = 0; s < totalSamples; s += PIECE_S * SR) {
    pieces.push({
      from: Math.max(0, s === 0 ? 0 : s - OVERLAP_S * SR),
      to: Math.min(totalSamples, s + PIECE_S * SR),
      offsetSec: Math.max(0, s === 0 ? 0 : s / SR - OVERLAP_S),
    });
  }
  return pieces;
}

// onPhase(phase, pct): 'extract' -> 'model' (pct = download %) -> 'listen' (pct = % done)
// onNote(msg): human-readable notes (e.g. model fallback) for the diagnostics log.
async function transcribeLocal(ffmpeg, inputPath, onPhase, onNote) {
  onPhase && onPhase('extract', 0);
  const audio = await extractPcm(ffmpeg, inputPath);
  if (!audio.length) throw new Error('No audio track found in that file.');
  onPhase && onPhase('model', 0);
  let asr;
  try {
    asr = await getAsr(MODEL_ID, (pct) => onPhase && onPhase('model', pct));
  } catch (e) {
    onNote && onNote(`Could not load ${MODEL_ID} (${e.message ? String(e.message).slice(0, 120) : 'unknown'}) - falling back to ${FALLBACK_MODEL_ID}`);
    try {
      asr = await getAsr(FALLBACK_MODEL_ID, (pct) => onPhase && onPhase('model', pct));
    } catch (e2) {
      // "check your connection" was a guess, and it was wrong often enough to
      // waste an afternoon: a half-downloaded or cloud-evicted model-cache
      // fails exactly the same way with the internet working fine. Say what
      // actually happened and what to do about it.
      const why = String((e2 && e2.message) || e2 || '').slice(0, 200);

      // Windows error 193 ("The operating system cannot run %1") on the
      // onnxruntime .node binary is NOT a download failure - the model may be
      // fully present. It means Windows could not load a native library,
      // and the reason is nearly always that the install lives inside a
      // cloud-synced folder which turned that binary into an online-only
      // placeholder. Sending someone to delete the model cache here wastes
      // their afternoon on the wrong folder.
      const nativeLoadFailed = /cannot run %1|not a valid Win32|ERR_DLOPEN_FAILED|onnxruntime|\.node['"]?$|\.node[\s'"]/i.test(why);
      if (nativeLoadFailed) {
        // Error 193 means the file exists but the OS refused to load it. Only
        // two things do that: the wrong CPU architecture, or a truncated file.
        // Guessing between them wastes an afternoon, so measure both and say
        // which it is - a valid Windows binary starts with the bytes "MZ".
        throw new Error(
          'The speech engine could not start. This is NOT a download problem - the model may be fully present. ' +
          'The computer refused to load one of Studio\'s built-in program files.\n\n' +
          onnxDiagnosis() +
          `\n\nWhat the computer said: ${why}\n\n` +
          'You do not need this to caption a video you scripted yourself: paste your lines into Lyrics & Captions and press Tap to sync.'
        );
      }

      let cached = false;
      try { cached = fs.existsSync(CACHE_DIR) && fs.readdirSync(CACHE_DIR).length > 0; } catch (_) {}
      const hint = cached
        ? `There is already a part-downloaded model in ${CACHE_DIR}. If you are online, that folder is probably damaged or has been turned into an online-only placeholder by cloud sync - delete it and try again, and Studio will fetch a clean copy.`
        : 'Nothing has been downloaded yet, so this really is the first run - it needs internet once. After that it works offline.';
      throw new Error(`Could not load the speech model. ${hint}\n\nWhat went wrong: ${why}`);
    }
  }

  const totalDur = audio.length / SR;
  const pieces = planPieces(audio.length);
  const lines = [];
  let lastEnd = 0; // absolute seconds already covered - dedupes the overlap
  for (let i = 0; i < pieces.length; i++) {
    onPhase && onPhase('listen', Math.round((i / pieces.length) * 100));
    const { from, to, offsetSec } = pieces[i];
    const result = await asr(audio.subarray(from, to), { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
    const chunks = Array.isArray(result && result.chunks) ? result.chunks : [];
    for (const c of chunks) {
      const start = offsetSec + Math.max(0, Number(c.timestamp && c.timestamp[0]) || 0);
      const endRaw = Number(c.timestamp && c.timestamp[1]) || 0;
      const end = endRaw > 0 ? offsetSec + endRaw : 0;
      const text = collapseRepeats(String(c.text || '').trim());
      if (!text) continue;
      if (start < lastEnd - 0.75) continue; // overlap region already emitted
      lines.push({ start, end, text });
      if (end > lastEnd) lastEnd = end;
      else if (start > lastEnd) lastEnd = start;
    }
  }
  onPhase && onPhase('listen', 100);

  // Whisper sometimes leaves a chunk's end open - close every bad end against
  // the next line's start (or the end of the audio).
  lines.forEach((l, i) => {
    if (!l.end || l.end <= l.start) l.end = Math.min(totalDur, (lines[i + 1] && lines[i + 1].start) || totalDur);
  });
  return { lines, text: lines.map((l) => l.text).join(' ').trim(), duration: totalDur };
}

function toSrt(lines) {
  const ts = (s) => {
    const ms = Math.max(0, Math.round(s * 1000));
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
    const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    return `${h}:${m}:${sec},${String(ms % 1000).padStart(3, '0')}`;
  };
  return lines.map((l, i) => `${i + 1}\n${ts(l.start)} --> ${ts(l.end)}\n${l.text}\n`).join('\n');
}

module.exports = { transcribeLocal, toSrt, planPieces, MODEL_ID };
