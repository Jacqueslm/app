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
// `let` + a function, NOT a const object: a token saved through the Settings UI
// after boot must work on the very next request. The old const object captured
// the (empty) value at module load and silently ignored a later-saved token
// until a restart - which looked exactly like "GitHub rejected my token".
let UPDATE_TOKEN = (process.env.APP_UPDATE_TOKEN || '').trim();
function ghHeaders() {
  return {
    'User-Agent': 'tsid-app-updater',
    ...(UPDATE_TOKEN ? { Authorization: `Bearer ${UPDATE_TOKEN}` } : {}),
  };
}
// Where settings saved from the app UI live (same gitignored .env the other
// keys use - never checked in, never leaves the machine).
const ENV_PATH = path.join(__dirname, '.env');
function persistEnvKey(name, value) {
  let lines = [];
  try { lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/); } catch (_) {}
  lines = lines.filter((l) => !l.startsWith(`${name}=`) && l.trim() !== '');
  if (value) lines.push(`${name}=${value}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n');
}
// Railway (the hosted web app) redeploys from git - its filesystem is
// ephemeral, so in-place updates there are meaningless and get wiped. The
// update/update-token UI is for LOCAL installs only.
const IS_RAILWAY = !!(process.env.RAILWAY_SERVICE_ID || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_PUBLIC_DOMAIN);
// Tarball, not zipball: GNU tar (standard on every Linux host) reads .tar.gz
// natively via `tar -xzf`, but cannot read a .zip - so a zip forced a fallback
// to the `unzip` binary, which most servers don't have installed, and the whole
// in-app update failed with "spawn unzip ENOENT". The tarball needs no extra
// tool anywhere: Linux GNU tar, plus the bsdtar shipped on Windows 10+/macOS,
// all handle .tar.gz. The API endpoint honors the Authorization header
// (codeload doesn't), so private repos keep working.
// GitHub's ref endpoints want raw slashes in branch names ("claude/vibe-code-uwxxlk");
// encoding the whole branch turns "/" into %2F and makes the endpoint 404, which
// silently broke every in-app update. Encode only individual path segments.
const UPDATE_REF = UPDATE_BRANCH.split('/').map(encodeURIComponent).join('/');
const UPDATE_ZIP_URL = process.env.APP_UPDATE_ZIP_URL // test override
  || `https://api.github.com/repos/${UPDATE_REPO}/tarball/${UPDATE_REF}`;
const UPDATE_STATE_FILE = path.join(__dirname, 'update-state.json');
// Strict whitelist: an update only ever copies this app's own files. The repo
// also contains Studio, and the two apps must stay fully separate on disk -
// updating one never adds or touches the other's files. (Launchers are excluded
// too: Windows corrupts a batch file that changes underneath a running script.)
const UPDATE_ONLY = new Set(['TurnSomeDayIntoOneday']);
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
  const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/commits/${UPDATE_REF}`, {
    headers: { ...ghHeaders(), Accept: 'application/vnd.github+json' },
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 404 && !UPDATE_TOKEN) throw new Error('GitHub says the app repo is not visible. If the repo is private, add APP_UPDATE_TOKEN to server/.env (or make the repo public).');
    throw new Error(data.message || 'GitHub did not answer.');
  }
  return { sha: data.sha, date: data.commit?.committer?.date || null };
}

const router = express.Router();

// Owner gate - fails CLOSED. Updating the server overwrites code and runs
// npm install, so an unconfigured owner email must lock everyone out, not let
// everyone in. (Matches requireOwner for admin stats; the old open fallback
// let any signed-in user trigger an update when APP_OWNER_EMAIL was unset.)
router.use((req, res, next) => {
  if (!OWNER_EMAIL) {
    return res.status(403).json({ error: 'Updates are unavailable: APP_OWNER_EMAIL is not configured.' });
  }
  const user = db.getUserById(req.userId);
  if (user && user.email === OWNER_EMAIL) return next();
  res.status(403).json({ error: 'Only the app owner can update this server.' });
});

router.get('/check', async (req, res) => {
  let current = null;
  try { current = JSON.parse(fs.readFileSync(UPDATE_STATE_FILE, 'utf8')); } catch (_) {}
  try {
    const latest = await fetchLatestCommit();
    res.json({ latest, current, upToDate: Boolean(current && current.sha === latest.sha), hasToken: Boolean(UPDATE_TOKEN), railway: IS_RAILWAY });
  } catch (err) {
    res.status(502).json({
      error: `Could not check GitHub: ${err.message}`,
      current,
      hasToken: Boolean(UPDATE_TOKEN),
      railway: IS_RAILWAY,
      needsToken: /not visible|private|404|Not Found/i.test(err.message) && !UPDATE_TOKEN,
    });
  }
});

// Paste a GitHub token so a PRIVATE app repo can still update in place on a
// LOCAL install. Saved 0600 to the same gitignored .env as the other keys;
// never leaves the machine except as an Authorization header to api.github.com.
router.post('/settings/updatetoken', async (req, res) => {
  if (IS_RAILWAY) return res.status(400).json({ error: 'This is the hosted web app — updates arrive automatically from the repo. The token is only used on a local install.' });
  const { token } = req.body || {};
  const clean = typeof token === 'string' ? token.trim() : '';
  if (clean && (clean.length < 20 || /\s/.test(clean))) {
    return res.status(400).json({ error: "That doesn't look like a GitHub token. Fine-grained ones start with github_pat_ and classic ones with ghp_." });
  }
  const prev = UPDATE_TOKEN;
  UPDATE_TOKEN = clean;
  if (clean) {
    // Prove it works BEFORE saving it - a token with the wrong repo or a
    // missing Contents permission fails identically to no token at all.
    try {
      await fetchLatestCommit();
    } catch (err) {
      UPDATE_TOKEN = prev;
      return res.status(400).json({ error: `GitHub would not accept that token: ${err.message} — check it has Contents: read on ${UPDATE_REPO}.` });
    }
  }
  try {
    persistEnvKey('APP_UPDATE_TOKEN', clean || null);
    res.json({ hasToken: Boolean(clean), repo: UPDATE_REPO, branch: UPDATE_BRANCH });
  } catch (err) {
    UPDATE_TOKEN = prev;
    res.status(500).json({ error: `Could not save the token: ${err.message}` });
  }
});

router.post('/', async (req, res) => {
  // Local installs only - on Railway the filesystem is ephemeral and the next
  // redeploy wipes any overlay, so an in-place "update" there is a no-op at
  // best and a confusing partial state at worst. Hosted installs are always
  // current: Railway redeploys from git on every push.
  if (IS_RAILWAY) return res.status(400).json({ error: 'This is the hosted web app — it is always on the latest version. Updates arrive automatically from the repo.' });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-update-'));
  try {
    // 1. download the latest code
    const zipRes = await fetch(UPDATE_ZIP_URL, { headers: ghHeaders() });
    if (zipRes.status === 404 && !UPDATE_TOKEN) throw new Error('download blocked - GitHub says the app repo is not visible. If the repo is private, add APP_UPDATE_TOKEN to server/.env (or make the repo public)');
    if (!zipRes.ok) throw new Error(`Download failed (${zipRes.status}).`);
    const tarPath = path.join(tmp, 'update.tar.gz');
    fs.writeFileSync(tarPath, Buffer.from(await zipRes.arrayBuffer()));

    // 2. extract. `tar -xzf` reads .tar.gz on Linux (GNU tar), Windows 10+ and
    // macOS (bsdtar) alike - no external unzip needed. Plain `tar -xf` is kept
    // as a fallback for any tar that auto-detects gzip but rejects an explicit -z.
    try { await runCmd('tar', ['-xzf', tarPath, '-C', tmp]); }
    catch (_) { await runCmd('tar', ['-xf', tarPath, '-C', tmp]); }
    const rootName = fs.readdirSync(tmp).find((n) => n !== 'update.tar.gz' && fs.statSync(path.join(tmp, n)).isDirectory());
    if (!rootName) throw new Error('The downloaded ZIP looked empty.');
    const src = path.join(tmp, rootName);

    // 3. overlay the new code onto the install (data files aren't in the ZIP)
    for (const entry of fs.readdirSync(src)) {
      if (!UPDATE_ONLY.has(entry)) continue;
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
