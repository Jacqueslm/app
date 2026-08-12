// Local text-to-speech: Piper voices running on this computer via sherpa-onnx.
// First use of a voice downloads it into server/model-cache/voices, and after
// that narration is free, instant and offline - no fal key, no per-word cost,
// nothing leaves the machine.
//
// Every voice here is public domain or CC0. That is deliberate: videos made
// with these are sold and monetised, and most of the good-sounding Piper
// voices (hfc_female, hfc_male, ryan, lessac) are non-commercial licenses that
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

// sherpa-onnx must NEVER be require()d in this process. It bundles its own
// copy of the ONNX runtime, the caption engine (onnxruntime-node) bundles a
// different version, and Windows only loads one library of a given name per
// process - whichever comes second dies with "The operating system cannot run
// %1". The boot config calls available(), so an in-process require here loaded
// sherpa at page-open and silently broke auto-captions for the whole session.
// Every sherpa call now happens inside a short-lived child (speak-worker.js);
// availability is probed the same way.
const { spawnSync } = require('child_process');
let availCache;
function available() {
  if (availCache === undefined) {
    const r = spawnSync(process.execPath, ['-e', "require('sherpa-onnx-node')"], {
      cwd: __dirname, timeout: 20000, stdio: 'ignore',
    });
    availCache = r.status === 0;
  }
  return availCache;
}

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

// Each take runs in a fresh worker process (see the note on available()).
// That re-loads the model every time, which costs about a second per take -
// the price of narration and captions coexisting on Windows, and well under
// what anyone notices next to the render itself.
function speakInWorker(job) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.join(__dirname, 'speak-worker.js')], {
      cwd: __dirname, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { try { proc.kill(); } catch (_) {} reject(new Error('narration timed out')); }, 120000);
    proc.stdout.on('data', (c) => { out += c; });
    proc.stderr.on('data', (c) => { err = (err + c).slice(-500); });
    proc.on('error', (e) => { clearTimeout(timer); reject(e); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err || `narration worker exited ${code}`));
      try { resolve(JSON.parse(out)); } catch (_) { reject(new Error('narration worker gave no answer')); }
    });
    proc.stdin.end(JSON.stringify(job));
  });
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
  const dir = path.join(MODELS_DIR, VOICES[k].dir);
  const { seconds } = await speakInWorker({
    model: path.join(dir, VOICES[k].onnx),
    tokens: path.join(dir, 'tokens.txt'),
    dataDir: ESPEAK_DIR,
    outPath,
    text: words,
    speed: Number(speed) > 0 ? Number(speed) : VOICES[k].speed,
    numThreads: Math.max(1, Math.min(4, os.cpus().length - 1)),
  });
  return { file: outPath, seconds };
}

module.exports = { VOICES, available, list, isInstalled, resolveKey, ensureModel, speak, speakable };
