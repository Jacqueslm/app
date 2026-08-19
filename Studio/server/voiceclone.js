// Free voice cloning that runs on this computer — no key, no per-word cost.
//
// Why this exists: narrating in your own voice was free only if you read every
// line yourself. Typing a script and hearing it back in your voice went through
// fal and was billed per 1,000 characters. This removes that bill.
//
// Why Chatterbox: it is MIT-licensed *including the weights*, so videos made
// with it can be sold. speak.js sets that bar deliberately (see its header on
// CC0 voices) and the popular alternatives fail it — XTTS-v2 is
// non-commercial, and F5-TTS's weights inherit a non-commercial dataset
// licence. Same rule, applied to cloning.
//
// The install is Python + torch + the model, which is big and slow to fetch,
// so it is a button the person presses once and never thinks about again —
// never something that happens silently mid-render.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, 'model-cache', 'voiceclone');
const VENV = path.join(ROOT, 'venv');
const HF_CACHE = path.join(ROOT, 'models');
const WORKER = path.join(__dirname, 'clone-worker.py');
const MARKER = path.join(ROOT, 'installed.json');

// Windows puts the interpreter in Scripts\, everything else in bin/.
function venvPython() {
  return process.platform === 'win32'
    ? path.join(VENV, 'Scripts', 'python.exe')
    : path.join(VENV, 'bin', 'python');
}

function isInstalled() {
  try {
    return fs.existsSync(MARKER) && fs.existsSync(venvPython());
  } catch (_) {
    return false;
  }
}

// One install at a time, and its progress is readable while it runs so the
// button can show something honest instead of a spinner for ten minutes.
let installState = null; // { running, pct, step, error, done }

function status() {
  return {
    installed: isInstalled(),
    installing: !!(installState && installState.running),
    pct: installState ? installState.pct : 0,
    step: installState ? installState.step : '',
    error: installState ? installState.error : null,
  };
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '';
    let err = '';
    proc.stdout.on('data', (c) => { out = (out + c).slice(-4000); if (opts.onLine) opts.onLine(String(c)); });
    proc.stderr.on('data', (c) => { err = (err + c).slice(-4000); if (opts.onLine) opts.onLine(String(c)); });
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err.trim() || out.trim() || `${cmd} exited ${code}`))));
  });
}

// torch publishes wheels for a fixed range of Python versions and lags behind
// python.org's front page by a year or so. Installing "the latest Python"
// therefore fails ten minutes into the download with "no matching distribution
// found for torch", which reads like a broken app rather than a wrong version.
// So: collect every Python on the machine and pick the best one, rather than
// taking the first that answers.
const PY_MIN = 9;
const PY_BEST_MAX = 13;

const PROBE = ['-c', 'import sys;print(sys.version_info[:2])'];

async function probe(cmd, pre = []) {
  try {
    const out = await run(cmd, [...pre, ...PROBE]);
    const m = out.match(/\((\d+),\s*(\d+)\)/);
    if (!m) return null;
    if (Number(m[1]) !== 3) return null;
    const minor = Number(m[2]);
    if (minor < PY_MIN) return null;
    return { cmd, args: pre, minor, version: `3.${minor}` };
  } catch (_) {
    // Also lands here for the Microsoft Store stub named python.exe, which
    // opens the Store and exits instead of running anything. Correct outcome.
    return null;
  }
}

// Where the python.org installer puts things when "Add Python to PATH" was
// left unticked — which is how it ships, so this is the common case, not the
// edge case. Without this the app tells someone to install Python they have.
function windowsGuesses() {
  const out = [];
  const roots = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Python'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Python'),
    'C:\\Python',
  ].filter(Boolean);
  for (const root of roots) {
    try {
      for (const entry of fs.readdirSync(root)) {
        const exe = path.join(root, entry, 'python.exe');
        if (fs.existsSync(exe)) out.push(exe);
      }
    } catch (_) { /* root not there */ }
  }
  // Bare C:\Python313\python.exe style, alongside a C:\Python folder.
  try {
    for (const entry of fs.readdirSync('C:\\')) {
      if (!/^Python3\d+$/i.test(entry)) continue;
      const exe = path.join('C:\\', entry, 'python.exe');
      if (fs.existsSync(exe) && !out.includes(exe)) out.push(exe);
    }
  } catch (_) { /* no C: */ }
  return out;
}

async function findPython() {
  const found = [];
  const seen = new Set();
  const consider = async (cmd, pre) => {
    const key = `${cmd} ${(pre || []).join(' ')}`;
    if (seen.has(key)) return;
    seen.add(key);
    const hit = await probe(cmd, pre);
    if (hit) found.push(hit);
  };

  if (process.platform === 'win32') {
    // The py launcher can enumerate every install at once, so ask it for each
    // version rather than only for its own default.
    for (let m = PY_MIN; m <= 20; m += 1) await consider('py', [`-3.${m}`]);
    await consider('py', ['-3']);
    await consider('python', []);
    await consider('python3', []);
    for (const exe of windowsGuesses()) await consider(exe, []);
  } else {
    for (let m = PY_MIN; m <= 20; m += 1) await consider(`python3.${m}`, []);
    await consider('python3', []);
    await consider('python', []);
  }

  return pickPython(found);
}

// Split out from the searching so the choice can be tested without needing
// four Pythons installed on the machine running the tests.
function pickPython(found) {
  if (!found || !found.length) return null;
  // Highest version torch still builds for; if everything is newer than that,
  // take the lowest of them so the odds of a wheel existing are best.
  const supported = found.filter((p) => p.minor <= PY_BEST_MAX);
  if (supported.length) return supported.slice().sort((a, b) => b.minor - a.minor)[0];
  return found.slice().sort((a, b) => a.minor - b.minor)[0];
}

async function install(onProgress) {
  if (isInstalled()) return { alreadyInstalled: true };
  if (installState && installState.running) throw new Error('The voice-cloning install is already running.');
  installState = { running: true, pct: 0, step: 'Looking for Python…', error: null, done: false };
  const step = (pctVal, text) => {
    installState.pct = pctVal;
    installState.step = text;
    if (onProgress) onProgress(pctVal, text);
  };

  try {
    const py = await findPython();
    if (!py) {
      throw new Error(
        'Free voice cloning needs Python and this computer does not have it yet. '
        + 'Get Python 3.13 from python.org/downloads — not the newest one on the front page, '
        + 'the speech engine has no build for that yet. During setup tick "Add Python to PATH". '
        + 'Then press this button again — nothing else to do.'
      );
    }

    fs.mkdirSync(ROOT, { recursive: true });
    // Start from nothing every time. `venv` happily reuses an existing folder,
    // so an install interrupted partway (closed laptop, dropped wifi, killed
    // app) leaves a half-written torch behind - and the next attempt dies on
    // "Cannot uninstall torch None ... no RECORD file was found", which reads
    // like a broken app and cannot be escaped by pressing the button again.
    // The one thing a retry must do is actually retry.
    step(4, 'Clearing anything left from a previous attempt…');
    try { fs.rmSync(VENV, { recursive: true, force: true }); } catch (_) {}
    step(6, `Found Python ${py.version} — making a private workspace…`);
    await run(py.cmd, [...py.args, '-m', 'venv', VENV]);

    const pip = venvPython();
    step(12, 'Updating the installer…');
    await run(pip, ['-m', 'pip', 'install', '--upgrade', 'pip', '--quiet']);

    // CPU-only torch: roughly a fifth of the size of the CUDA build, and this
    // runs on the processor anyway. If that index is unreachable (some
    // networks block it) fall back to the ordinary one rather than failing —
    // the CUDA build works on CPU, it is just a much bigger download.
    step(20, 'Downloading the speech engine (this is the big one — several minutes)…');
    // --ignore-installed is pip's own advice for the no-RECORD-file case: don't
    // try to uninstall what's there, just write over it. Harmless in a fresh
    // venv, and the difference between recovering and being stuck if a broken
    // torch is visible for any other reason (a system-wide one on PATH, say).
    const TORCH = ['-m', 'pip', 'install', '--quiet', '--ignore-installed', 'torch', 'torchaudio'];
    try {
      await run(pip, [...TORCH, '--index-url', 'https://download.pytorch.org/whl/cpu']);
    } catch (e) {
      step(24, 'Falling back to the standard download (bigger, still fine)…');
      await run(pip, TORCH);
    }

    step(70, 'Installing the voice cloner…');
    await run(pip, ['-m', 'pip', 'install', '--quiet', 'chatterbox-tts']);

    step(92, 'Checking it works…');
    await run(pip, ['-c', 'from chatterbox.tts import ChatterboxTTS']);

    fs.writeFileSync(MARKER, JSON.stringify({
      installedAt: new Date().toISOString(),
      python: py.version,
      platform: process.platform,
    }, null, 2));

    step(100, 'Done — voice cloning is free on this computer now.');
    installState.running = false;
    installState.done = true;
    return { installed: true, python: py.version };
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 600);
    installState.running = false;
    installState.error = msg;
    // A half-built venv would make isInstalled() lie on the next boot.
    try { if (!isInstalled()) fs.rmSync(VENV, { recursive: true, force: true }); } catch (_) {}
    throw new Error(msg);
  }
}

// ref clip + text -> a wav on disk. Mirrors speak()'s shape so the caller can
// treat local cloning and local narration the same way.
function clone({ refPath, text, outPath, exaggeration, cfg, onPct }) {
  return new Promise((resolve, reject) => {
    if (!isInstalled()) return reject(new Error('Free voice cloning is not installed on this computer yet.'));
    const proc = spawn(venvPython(), [WORKER], { cwd: __dirname, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    // First run downloads about a gigabyte of model, so this ceiling is
    // generous on purpose; later runs are minutes at most.
    const timer = setTimeout(() => {
      try { proc.kill(); } catch (_) {}
      reject(new Error('Voice cloning timed out. The first run downloads the model — try again once it has finished.'));
    }, 45 * 60 * 1000);

    proc.stdout.on('data', (c) => { out += c; });
    proc.stderr.on('data', (c) => {
      const s = String(c);
      // Progress lines are marked; everything else is a genuine error.
      for (const line of s.split('\n')) {
        const m = line.match(/^@PCT\s+(\d+)/);
        if (m) { if (onPct) onPct(Number(m[1])); continue; }
        if (line.trim()) err = (err + line + '\n').slice(-600);
      }
    });
    proc.on('error', (e) => { clearTimeout(timer); reject(e); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim() || `voice cloning exited ${code}`));
      try { resolve(JSON.parse(out)); } catch (_) { reject(new Error('the voice cloner gave no answer')); }
    });
    proc.stdin.end(JSON.stringify({
      ref: refPath, text, out: outPath, cacheDir: HF_CACHE,
      exaggeration, cfg,
    }));
  });
}

// Roughly what the install put on disk, for the Storage card.
function diskUsage() {
  const walk = (dir) => {
    let total = 0;
    let stack = [dir];
    while (stack.length) {
      const d = stack.pop();
      let entries = [];
      try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { continue; }
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) stack.push(p);
        else { try { total += fs.statSync(p).size; } catch (_) {} }
      }
    }
    return total;
  };
  if (!fs.existsSync(ROOT)) return 0;
  return walk(ROOT);
}

function uninstall() {
  try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch (_) {}
  installState = null;
  return true;
}

module.exports = { isInstalled, status, install, clone, diskUsage, uninstall, ROOT, pickPython, findPython, run };
