// One-click self-update from GitHub, shared design with Studio's updater:
// download the branch zipball, overlay the new code onto the install folder,
// refresh dependencies. User data survives by construction - .env, data.sqlite
// and media/ are gitignored, so they are never inside the ZIP being copied.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const express = require('express');

const db = require('./db');

const APP_ROOT = path.join(__dirname, '..', '..'); // folder holding the launchers + both apps
const UPDATE_REPO = process.env.APP_UPDATE_REPO || 'Jacqueslm/app';
const UPDATE_BRANCH = process.env.APP_UPDATE_BRANCH || 'claude/vibe-code-uwxxlk';
// Private repos need a token (fine-grained PAT, Contents: read); public need none.
const UPDATE_TOKEN = (process.env.APP_UPDATE_TOKEN || '').trim();
const GH_HEADERS = {
  'User-Agent': 'tsid-app-updater',
  ...(UPDATE_TOKEN ? { Authorization: `Bearer ${UPDATE_TOKEN}` } : {}),
};
// The API zipball endpoint honors the Authorization header (codeload doesn't).
const UPDATE_ZIP_URL = process.env.APP_UPDATE_ZIP_URL // test override
  || `https://api.github.com/repos/${UPDATE_REPO}/zipball/${encodeURIComponent(UPDATE_BRANCH)}`;
const UPDATE_STATE_FILE = path.join(__dirname, 'update-state.json');
// Running launcher scripts are never overwritten mid-run (Windows corrupts
// a batch file that changes underneath it).
const UPDATE_SKIP = new Set([
  'Start My App.bat', 'Start My App.command', 'start-app.sh',
  'Start Studio.bat', 'Start Studio.command', 'start-studio.sh', '.git',
]);
// When the app goes public, only this account may trigger a server update.
const OWNER_EMAIL = (process.env.APP_OWNER_EMAIL || '').trim().toLowerCase();

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
    if (res.status === 404 && !UPDATE_TOKEN) throw new Error('GitHub says the app repo is not visible. If the repo is private, add APP_UPDATE_TOKEN to server/.env (or make the repo public).');
    throw new Error(data.message || 'GitHub did not answer.');
  }
  return { sha: data.sha, date: data.commit?.committer?.date || null };
}

const router = express.Router();

// Owner gate (only when configured): a public user must never update the server.
router.use((req, res, next) => {
  if (!OWNER_EMAIL) return next();
  const user = db.getUserById(req.userId);
  if (user && user.email === OWNER_EMAIL) return next();
  res.status(403).json({ error: 'Only the app owner can update this server.' });
});

router.get('/check', async (req, res) => {
  let current = null;
  try { current = JSON.parse(fs.readFileSync(UPDATE_STATE_FILE, 'utf8')); } catch (_) {}
  try {
    const latest = await fetchLatestCommit();
    res.json({ latest, current, upToDate: Boolean(current && current.sha === latest.sha) });
  } catch (err) {
    res.status(502).json({ error: `Could not check GitHub: ${err.message}`, current });
  }
});

router.post('/', async (req, res) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-update-'));
  try {
    // 1. download the latest code
    const zipRes = await fetch(UPDATE_ZIP_URL, { headers: GH_HEADERS });
    if (zipRes.status === 404 && !UPDATE_TOKEN) throw new Error('download blocked - GitHub says the app repo is not visible. If the repo is private, add APP_UPDATE_TOKEN to server/.env (or make the repo public)');
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

module.exports = { router };
