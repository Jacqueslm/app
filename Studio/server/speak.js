// Local text-to-speech: Piper voices running on this computer via sherpa-onnx.
// First use of a voice downloads it into server/model-cache/voices, and after
// that narration is free, instant and offline - no fal key, no per-word cost,
// nothing leaves the machine.
//
// Every voice here is public domain or CC0. That is deliberate: videos made
// with these are sold and monetised, and most of the good-sounding Piper
// voices (hfc_female, hfc_male, ryan, lessac) are non-commercial licences that
// we are not allowed to use for that.
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const MODELS_DIR = path.join(__dirname, 'model-cache', 'voices');
const ESPEAK_DIR = path.join(MODELS_DIR, 'espeak-ng-data');
const RELEASE = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models';

// key -> the Piper model that speaks it. `speed` is sherpa's speed multiplier:
// below 1 is slower, which suits recovery narration - these lines are meant to
// land, not to be raced through.
const VOICES = {
  warm:   { label: 'Warm',        dir: 'vits-piper-en_US-kristin-medium', onnx: 'en_US-kristin-medium.onnx',  speed: 0.92, note: 'female, easy and unhurried' },
  soft:   { label: 'Soft',        dir: 'vits-piper-en_US-kathleen-low',   onnx: 'en_US-kathleen-low.onnx',    speed: 0.90, note: 'female, quiet and close' },
  gentle: { label: 'Gentle',      dir: 'vits-piper-en_US-ljspeech-high',  onnx: 'en_US-ljspeech-high.onnx',   speed: 0.92, note: 'female, slow and kind' },
  male:   { label: 'Calm male',   dir: 'vits-piper-en_US-norman-medium',  onnx: 'en_US-norman-medium.onnx',   speed: 0.92, note: 'male, low and level' },
  steady: { label: 'Steady male', dir: 'vits-piper-en_US-john-medium',    onnx: 'en_US-john-medium.onnx',     speed: 0.94, note: 'male, plain and matter-of-fact' },
  bright: { label: 'Bright male', dir: 'vits-piper-en_US-bryce-medium',   onnx: 'en_US-bryce-medium.onnx',    speed: 0.96, note: 'male, lighter and quicker' },
};

// Retired keys still sitting in someone's saved settings shouldn't 404 them.
const ALIASES = { clear: 'gentle', own: '' };

function resolveKey(key) {
  const k = String(key || '');
  if (VOICES[k]) return k;
  if (ALIASES[k] && VOICES[ALIASES[k]]) return ALIASES[k];
  return '';
}

// sherpa-onnx ships a prebuilt native binary per platform as an optional
// dependency. If it didn't install (unsupported platform, blocked download),
// every caller falls back to the paid cloud path instead of breaking.
let sherpaCache;
function sherpa() {
  if (sherpaCache === undefined) {
    try { sherpaCache = require('sherpa-onnx-node'); }
    catch (_) { sherpaCache = null; }
  }
  return sherpaCache;
}

function available() { return Boolean(sherpa()); }

function isInstalled(key) {
  const v = VOICES[resolveKey(key)];
  if (!v) return false;
  return fs.existsSync(path.join(MODELS_DIR, v.dir, v.onnx)) && fs.existsSync(ESPEAK_DIR);
}

// What the Voice card shows: every voice, whether it's downloaded yet, and
// whether local speech works on this machine at all.
function list() {
  return Object.entries(VOICES).map(([key, v]) => ({
    key, label: v.label, note: v.note, free: true, installed: isInstalled(key),
  }));
}

function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'], ...opts });
    let err = '';
    proc.stderr.on('data', (c) => { err += c.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-400) || `exit ${code}`))));
  });
}

// Download + unpack one voice. ~60MB of model plus a 19MB pronunciation
// dictionary that every voice shares, so only the first download pays for it.
async function ensureModel(key, onPct) {
  const k = resolveKey(key);
  const v = VOICES[k];
  if (!v) throw new Error('Unknown narrator.');
  if (isInstalled(k)) return v;

  fs.mkdirSync(MODELS_DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-voice-'));
  try {
    const res = await fetch(`${RELEASE}/${v.dir}.tar.bz2`);
    if (!res.ok) throw new Error(`voice download failed (${res.status})`);
    const total = Number(res.headers.get('content-length') || 0);
    const tarPath = path.join(tmp, 'voice.tar.bz2');
    const out = fs.createWriteStream(tarPath);
    let got = 0;
    for await (const chunk of res.body) {
      got += chunk.length;
      if (total && onPct) onPct(Math.min(99, Math.round((got / total) * 100)));
      if (!out.write(Buffer.from(chunk))) await new Promise((r) => out.once('drain', r));
    }
    await new Promise((r) => out.end(r));

    // `tar -xjf` is bzip2-explicit; plain `-xf` covers the tar builds that
    // auto-detect but reject -j. Windows 10+ ships bsdtar, which does both.
    try { await runCmd('tar', ['-xjf', tarPath, '-C', tmp]); }
    catch (_) { await runCmd('tar', ['-xf', tarPath, '-C', tmp]); }

    const src = path.join(tmp, v.dir);
    if (!fs.existsSync(path.join(src, v.onnx))) throw new Error('the downloaded voice looked empty');

    // espeak-ng-data is identical in every voice package - keep one copy.
    if (!fs.existsSync(ESPEAK_DIR) && fs.existsSync(path.join(src, 'espeak-ng-data'))) {
      fs.cpSync(path.join(src, 'espeak-ng-data'), ESPEAK_DIR, { recursive: true });
    }
    const dest = path.join(MODELS_DIR, v.dir);
    fs.mkdirSync(dest, { recursive: true });
    for (const name of [v.onnx, `${v.onnx}.json`, 'tokens.txt', 'MODEL_CARD']) {
      const from = path.join(src, name);
      if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, name));
    }
    if (onPct) onPct(100);
    return v;
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

// One loaded model per voice. Loading takes ~1s; speaking after that is fast
// enough (a few hundred ms for a sentence) that nothing needs a spinner.
const engines = new Map();
function engineFor(k) {
  if (!engines.has(k)) {
    const v = VOICES[k];
    const dir = path.join(MODELS_DIR, v.dir);
    engines.set(k, new (sherpa().OfflineTts)({
      model: {
        vits: {
          model: path.join(dir, v.onnx),
          tokens: path.join(dir, 'tokens.txt'),
          dataDir: ESPEAK_DIR,
        },
        numThreads: Math.max(1, Math.min(4, os.cpus().length - 1)),
        debug: false,
      },
      maxNumSentences: 1,
    }));
  }
  return engines.get(k);
}

// Piper reads punctuation, not markup. Em dashes become commas (an em dash is
// read as a pause that's too long), and anything the caption layer added -
// stage directions in brackets, stray asterisks - is dropped rather than spoken.
function speakable(text) {
  return String(text)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[*_#`]/g, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// text -> a wav file on disk. Returns { file, seconds }.
async function speak({ voice, text, speed, outPath, onPct }) {
  if (!available()) throw new Error('Local narration is not installed on this computer.');
  const k = resolveKey(voice);
  if (!k) throw new Error('Pick a narrator first.');
  const words = speakable(text);
  if (!words) throw new Error('Type the words you want spoken.');

  await ensureModel(k, onPct);
  const audio = engineFor(k).generate({
    text: words,
    sid: 0,
    speed: Number(speed) > 0 ? Number(speed) : VOICES[k].speed,
  });
  sherpa().writeWave(outPath, { samples: audio.samples, sampleRate: audio.sampleRate });
  return { file: outPath, seconds: audio.samples.length / audio.sampleRate };
}

module.exports = { VOICES, available, list, isInstalled, resolveKey, ensureModel, speak, speakable };
