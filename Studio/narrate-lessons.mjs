#!/usr/bin/env node
/**
 * narrate-lessons.mjs — record every recovery-app lesson in YOUR cloned voice.
 *
 * Studio already does this one lesson at a time through the Voice panel. There
 * are 518 lessons, so doing it by hand is not a real option. This drives the
 * same local API in a loop, unattended, and writes each take to disk with the
 * filename the app's audio manifest expects.
 *
 * WHAT YOU DO FIRST (once):
 *   1. Studio > Settings > install the free voice-cloning add-on. Wait for
 *      "Voice cloning is free on this computer."
 *   2. Upload a 20-30 second clip of the voice you want, cleanly - one speaker,
 *      no music underneath. Run "Clean audio" on it in the Library.
 *   3. Note the reference clip's asset id (this script can list them for you).
 *
 * THEN RUN:
 *   node narrate-lessons.mjs --list-voices          # find your clip's id
 *   node narrate-lessons.mjs --ref 42 --limit 1     # one lesson, listen to it
 *   node narrate-lessons.mjs --ref 42               # all 518, go to bed
 *
 * It is safe to stop and re-run: anything already written is skipped, so a
 * crash, a reboot or a closed laptop costs you one take, not the night.
 *
 * Nothing is charged. The local cloner runs on your machine; Studio only falls
 * back to the paid service if the add-on is missing (this script refuses to run
 * in that case) or if a mood is set (it never sets one).
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? true) : dflt;
};
const STUDIO = String(arg('studio', 'http://127.0.0.1:4400')).replace(/\/$/, '');
const OUT_DIR = String(arg('out', path.join(process.cwd(), 'lesson-audio-out')));
const LESSONS = String(arg('lessons', path.join(process.cwd(), 'all-lessons.json')));
const REF = arg('ref', null);
const LIMIT = Number(arg('limit', 0)) || 0;
const EMAIL = arg('email', null);
const PASSWORD = arg('password', null);

// Studio's own per-take ceiling. Longer lessons are split on sentence
// boundaries and the pieces are joined, the same way the Voice panel does it.
const MAX_CHARS = 1900;

let cookie = '';
const api = async (p, opts = {}) => {
  const res = await fetch(STUDIO + p, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...(opts.headers || {}) },
  });
  const setC = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  const fresh = setC.filter(Boolean).map((c) => c.split(';')[0]);
  if (fresh.length) cookie = fresh.join('; ');
  return res;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function die(msg) {
  console.error('\n' + msg + '\n');
  process.exit(1);
}

async function signIn() {
  // Studio on your own machine is usually already signed in via the browser,
  // but this script has no browser, so it needs its own session.
  if (!EMAIL || !PASSWORD) {
    die('Sign-in needed. Add --email you@example.com --password yourpassword\n'
      + '(the same login you use in Studio in the browser).');
  }
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    die(`Could not sign in to Studio: ${d.error || res.status}`);
  }
}

async function listVoices() {
  const res = await api('/api/studio/assets?kind=audio');
  const { assets = [] } = await res.json();
  if (!assets.length) return console.log('\nNo audio assets in Studio yet. Upload your voice clip first.\n');
  console.log('\nAudio in your Studio library — use the id of your voice clip as --ref:\n');
  for (const a of assets) console.log(`  ${String(a.id).padStart(5)}  ${a.label || a.filename}`);
  console.log('');
}

// Split on sentence ends so a join never lands mid-word.
function chunk(text) {
  const out = [];
  let cur = '';
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    if (cur && (cur.length + s.length + 1) > MAX_CHARS) { out.push(cur.trim()); cur = s; }
    else cur += (cur ? ' ' : '') + s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function speak(refId, text) {
  const res = await api('/api/studio/voice-clone', {
    method: 'POST',
    body: JSON.stringify({ refAssetId: Number(refId), text, mood: 'neutral' }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `voice-clone failed (${res.status})`);
  if (body.priceUsd || body.cost) {
    throw new Error('Studio quoted a PRICE for this take, which means the free local cloner is not installed. '
      + 'Install it in Settings first — this script will not spend money.');
  }
  let job = body.job;
  if (!job) throw new Error('Studio did not start a job.');
  for (let i = 0; i < 1200; i++) {           // up to ~20 minutes per take
    await wait(1000);
    const jr = await api(`/api/studio/jobs/${job.id}`);
    const jd = await jr.json().catch(() => ({}));
    job = jd.job || job;
    if (job.status === 'done') break;
    if (job.status === 'error' || job.error) throw new Error(job.error || 'the take failed');
  }
  if (job.status !== 'done') throw new Error('timed out waiting for the take');
  const fr = await api(`/api/studio/assets/${job.assetId}/file`);
  if (!fr.ok) throw new Error(`could not download the finished audio (${fr.status})`);
  return Buffer.from(await fr.arrayBuffer());
}

async function main() {
  if (!fs.existsSync(LESSONS)) {
    die(`Cannot find the lesson list at:\n  ${LESSONS}\n\n`
      + 'Pass it with --lessons /path/to/all-lessons.json');
  }
  await signIn();
  if (arg('list-voices', false)) return listVoices();
  if (!REF) die('Which voice? Run with --list-voices to see the ids, then pass --ref <id>.');

  const lessons = JSON.parse(fs.readFileSync(LESSONS, 'utf8'));
  const todo = LIMIT ? lessons.slice(0, LIMIT) : lessons;
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\n${todo.length} lessons -> ${OUT_DIR}`);
  console.log('Already-finished files are skipped, so stopping and re-running is safe.\n');

  let done = 0, skipped = 0, failed = 0;
  const started = Date.now();
  for (const [i, l] of todo.entries()) {
    const outPath = path.join(OUT_DIR, `${l.file}.wav`);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) { skipped++; continue; }
    const label = `${l.track} day ${l.day}`;
    process.stdout.write(`[${i + 1}/${todo.length}] ${label} … `);
    try {
      const parts = chunk(l.text);
      const bufs = [];
      for (const p of parts) bufs.push(await speak(REF, p));
      // One take per lesson writes straight out; a split lesson writes its
      // pieces beside each other so nothing is silently lost to a bad join.
      if (bufs.length === 1) fs.writeFileSync(outPath, bufs[0]);
      else bufs.forEach((b, n) => fs.writeFileSync(path.join(OUT_DIR, `${l.file}.part${n + 1}.wav`), b));
      done++;
      const per = (Date.now() - started) / 1000 / Math.max(1, done);
      const left = Math.round((per * (todo.length - i - 1)) / 60);
      console.log(`ok${parts.length > 1 ? ` (${parts.length} parts)` : ''} — about ${left} min left`);
    } catch (e) {
      failed++;
      console.log(`FAILED: ${e.message}`);
      // Keep going. One bad lesson must not cost the whole night; re-run later
      // and only the missing ones are attempted again.
    }
  }
  console.log(`\nDone. ${done} recorded, ${skipped} already there, ${failed} failed.`);
  if (failed) console.log('Re-run the same command to retry just the failures.');
  console.log(`Files are in: ${OUT_DIR}\n`);
}

main().catch((e) => die(e.stack || e.message));
