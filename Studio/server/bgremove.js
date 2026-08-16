// Free background removal that runs on this computer — no key, no per-image
// cost, nothing uploaded anywhere.
//
// Same shape as voiceclone.js on purpose: a one-time "install" button builds a
// private Python venv (rembg + onnxruntime, CPU), and after that every removal
// is local and free. It reuses voiceclone's findPython, so the same Python that
// powers voice cloning powers this — install either one and the other's
// install gets faster.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const { findPython, run } = require('./voiceclone');

const ROOT = path.join(__dirname, 'model-cache', 'bgremove');
const VENV = path.join(ROOT, 'venv');
const WORKER = path.join(__dirname, 'bgremove-worker.py');
const MARKER = path.join(ROOT, 'installed.json');
// rembg downloads its model (u2net, ~170MB) on first use; pin it here so it
// lives beside the venv and survives nothing-to-do-with-us cache cleaners.
const MODEL_HOME = path.join(ROOT, 'models');

function venvPython() {
  return process.platform === 'win32'
    ? path.join(VENV, 'Scripts', 'python.exe')
    : path.join(VENV, 'bin', 'python');
}

function isInstalled() {
  try { return fs.existsSync(MARKER) && fs.existsSync(venvPython()); } catch (_) { return false; }
}

let installState = null;

function status() {
  return {
    installed: isInstalled(),
    installing: !!(installState && installState.running),
    pct: installState ? installState.pct : 0,
    step: installState ? installState.step : '',
    error: installState ? installState.error : null,
  };
}

async function install(onProgress) {
  if (isInstalled()) return { alreadyInstalled: true };
  if (installState && installState.running) throw new Error('The background-remover install is already running.');
  installState = { running: true, pct: 0, step: 'Looking for Python…', error: null };
  const step = (pct, text) => {
    installState.pct = pct;
    installState.step = text;
    if (onProgress) onProgress(pct, text);
  };
  try {
    const py = await findPython();
    if (!py) {
      throw new Error(
        'The free background remover needs Python and this computer does not have it yet. '
        + 'Get Python 3.13 from python.org/downloads (not the newest one on the front page), '
        + 'tick "Add python.exe to PATH" during setup, then press this button again.'
      );
    }
    fs.mkdirSync(ROOT, { recursive: true });
    step(10, `Found Python ${py.version} — making a private workspace…`);
    await run(py.cmd, [...py.args, '-m', 'venv', VENV]);
    const pip = venvPython();
    step(20, 'Updating the installer…');
    await run(pip, ['-m', 'pip', 'install', '--upgrade', 'pip', '--quiet']);
    step(35, 'Downloading the background remover (a few minutes)…');
    await run(pip, ['-m', 'pip', 'install', '--quiet', 'rembg', 'onnxruntime']);
    step(90, 'Checking it works…');
    await run(pip, ['-c', 'from rembg import remove']);
    fs.writeFileSync(MARKER, JSON.stringify({ installedAt: new Date().toISOString(), python: py.version }, null, 2));
    step(100, 'Done — background removal is free on this computer now.');
    installState.running = false;
    return { installed: true };
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 600);
    installState.running = false;
    installState.error = msg;
    try { if (!isInstalled()) fs.rmSync(VENV, { recursive: true, force: true }); } catch (_) {}
    throw new Error(msg);
  }
}

// input image path -> transparent PNG at outPath. First run also downloads the
// model, hence the generous timeout; after that it's seconds.
function removeBackground({ inPath, outPath }) {
  return new Promise((resolve, reject) => {
    if (!isInstalled()) return reject(new Error('The free background remover is not installed yet — press its install button first.'));
    const proc = spawn(venvPython(), [WORKER], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, U2NET_HOME: MODEL_HOME },
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try { proc.kill(); } catch (_) {}
      reject(new Error('Background removal timed out. The first run downloads the model — try again once it has finished.'));
    }, 15 * 60 * 1000);
    proc.stdout.on('data', (c) => { out += c; });
    proc.stderr.on('data', (c) => { err = (err + c).slice(-600); });
    proc.on('error', (e) => { clearTimeout(timer); reject(e); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim() || `background remover exited ${code}`));
      try { resolve(JSON.parse(out)); } catch (_) { reject(new Error('the background remover gave no answer')); }
    });
    proc.stdin.end(JSON.stringify({ in: inPath, out: outPath }));
  });
}

function uninstall() {
  try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch (_) {}
  installState = null;
  return true;
}

module.exports = { isInstalled, status, install, removeBackground, uninstall, ROOT };
