// Local speech-to-text: Whisper running on this computer via transformers.js.
// First use downloads the model (~80MB) into server/model-cache, and after that
// it works fully offline - no keys, no per-use cost, nothing leaves the machine.
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

// small.en hears far more accurately than base.en on real-world speech at the
// cost of a bigger one-time download (~250MB) and a slower pass - the right
// trade for captions someone will publish. Override via STUDIO_WHISPER_MODEL.
const MODEL_ID = process.env.STUDIO_WHISPER_MODEL || 'Xenova/whisper-small.en';
const CACHE_DIR = path.join(__dirname, 'model-cache');

let asrPromise = null;
async function getAsr(onDownloadPct) {
  if (!asrPromise) {
    asrPromise = (async () => {
      // transformers.js is ESM-only; dynamic import keeps this file CommonJS.
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = CACHE_DIR;
      return pipeline('automatic-speech-recognition', MODEL_ID, {
        progress_callback: (p) => {
          if (p.status === 'progress' && p.total) {
            onDownloadPct && onDownloadPct(Math.round((p.loaded / p.total) * 100));
          }
        },
      });
    })();
    // A failed model download (offline first run) must not poison later retries.
    asrPromise.catch(() => { asrPromise = null; });
  }
  return asrPromise;
}

// 16kHz mono float32 raw PCM - exactly what Whisper expects, no WAV header to parse.
function extractPcm(ffmpeg, inputPath) {
  return new Promise((resolve, reject) => {
    const out = path.join(os.tmpdir(), `stt-${crypto.randomBytes(6).toString('hex')}.pcm`);
    const proc = spawn(
      ffmpeg,
      ['-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-acodec', 'pcm_f32le', out],
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

// onPhase(phase, pct): 'extract' -> 'model' (pct = download %) -> 'listen'
async function transcribeLocal(ffmpeg, inputPath, onPhase) {
  onPhase && onPhase('extract', 0);
  const audio = await extractPcm(ffmpeg, inputPath);
  if (!audio.length) throw new Error('No audio track found in that file.');
  onPhase && onPhase('model', 0);
  let asr;
  try {
    asr = await getAsr((pct) => onPhase && onPhase('model', pct));
  } catch (e) {
    throw new Error('Could not download the speech model (first run needs internet). Check your connection and try again - after the first download it works offline.');
  }
  onPhase && onPhase('listen', 0);
  const result = await asr(audio, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
  const chunks = Array.isArray(result && result.chunks) ? result.chunks : [];
  const totalDur = audio.length / 16000;
  const lines = chunks
    .map((c) => ({
      start: Math.max(0, Number(c.timestamp && c.timestamp[0]) || 0),
      end: Number(c.timestamp && c.timestamp[1]) || 0,
      text: collapseRepeats(String(c.text || '').trim()),
    }))
    .filter((l) => l.text);
  // Whisper sometimes leaves the final chunk's end open - close every bad end
  // against the next line's start (or the end of the audio).
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

module.exports = { transcribeLocal, toSrt, MODEL_ID };
