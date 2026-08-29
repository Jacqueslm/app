#!/usr/bin/env node
// Rotate the story shelf.
//
//   node tools/rotate-stories.js set-2
//
// Jacques, 29 Aug 2026: "when the stories get rotated always delete the old
// ones, log to repo, all 3 branches."
//
// So rotating is not just pointing `live` at the next set. The set coming down
// is DELETED from data/audio-stories.json, its ten mp3s are deleted from the
// lesson-audio branch, and what it was is written into data/story-rotations.txt
// so there is a permanent record of ten stories that no longer exist anywhere
// in the app. (The full text of a retired story is still in git history - it is
// removed from the working file, not erased from the world.)
//
// Doing this by hand is four separate edits that must all agree, and forgetting
// the version bump leaves every installed phone on the old shelf because the
// service worker precaches the data file. Hence one command.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'audio-stories.json');
const LOG = path.join(ROOT, 'data', 'story-rotations.txt');
const APP = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const AUDIO_BRANCH = 'lesson-audio';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('-'));
const skipAudioCheck = args.includes('--skip-audio-check');
const dryRun = args.includes('--dry-run');

function die(msg) { console.error('\n  ' + msg + '\n'); process.exit(1); }

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const ids = data.batches.map((b) => b.id);

if (!target) {
  console.log('\n  Usage: node tools/rotate-stories.js <set-id> [--dry-run] [--skip-audio-check]');
  console.log('\n  live now: ' + data.live);
  console.log('  sets in the file: ' + ids.join(', '));
  const waiting = ids.slice(ids.indexOf(data.live) + 1);
  console.log('  waiting to go live: ' + (waiting.length ? waiting.join(', ') : '(none written yet)') + '\n');
  process.exit(0);
}

const toIndex = ids.indexOf(target);
if (toIndex < 0) die(`No set called "${target}". The file has: ${ids.join(', ')}`);
if (target === data.live) die(`"${target}" is already live. Nothing to rotate.`);
if (toIndex < ids.indexOf(data.live)) die(`"${target}" comes BEFORE the live set - it has already been retired.`);

const going = data.batches[toIndex];
if (going.stories.length !== 10) die(`"${target}" has ${going.stories.length} stories, expected 10.`);

// Never take a shelf down before the one replacing it can actually play.
if (!skipAudioCheck) {
  let onBranch;
  try {
    execFileSync('git', ['fetch', 'origin', AUDIO_BRANCH], { cwd: ROOT, stdio: 'ignore' });
    // --full-tree, or git resolves 'stories/' against this subdirectory and
    // reports every recording missing.
    onBranch = execFileSync('git', ['ls-tree', '--full-tree', '--name-only', `origin/${AUDIO_BRANCH}`, 'stories/'],
      { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch (e) {
    die(`Could not read the ${AUDIO_BRANCH} branch to check the recordings exist.\n` +
        `  Fix the git problem, or re-run with --skip-audio-check if you are sure.`);
  }
  const missing = going.stories.map((s) => `stories/${s.id}.mp3`).filter((f) => !onBranch.includes(f));
  if (missing.length) {
    die(`${missing.length} recording(s) for "${target}" are not on the ${AUDIO_BRANCH} branch:\n    ` +
        missing.join('\n    ') + `\n\n  Run tools/generate-story-audio.py and push them first.`);
  }
}

// Everything before the new live set comes down. Usually one set; more if a
// rotation was ever skipped.
const retiring = data.batches.slice(0, toIndex);
const kept = data.batches.slice(toIndex);

const today = new Date().toISOString().slice(0, 10);
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, Math.max(n, s.length));

let entry = '';
for (const b of retiring) {
  entry += `\n${today}  ${b.id} retired (added ${b.added || 'unknown'}), ${target} went live\n`;
  for (const s of b.stories) {
    entry += `  ${pad(s.id, 32)}${pad(s.title, 52)}${s.narrator}, ${s.perspective}, ${s.topic}, ~${s.minutes} min\n`;
  }
}

const LOG_HEADER = `Story rotations - what has been taken down, and when.
Newest at the bottom.

Every set listed here is gone: its ten stories were removed from
data/audio-stories.json and its ten mp3s deleted from the ${AUDIO_BRANCH}
branch, so nothing in the app can reach them. This file is the record that
they existed. The full text of each one is still in git history.

Written by tools/rotate-stories.js. Do not edit by hand.
`;

// Bump both, or installed phones keep serving the old shelf from the precache.
let app = fs.readFileSync(APP, 'utf8');
const vm = app.match(/const APP_VERSION='(\d+)\.(\d+)';/);
if (!vm) die('Could not find APP_VERSION in index.html.');
const newApp = `${vm[1]}.${Number(vm[2]) + 1}`;
let sw = fs.readFileSync(SW, 'utf8');
const cm = sw.match(/'tsid-shell-v(\d+)\.(\d+)'/);
if (!cm) die('Could not find CACHE_NAME in sw.js.');
const newCache = `${cm[1]}.${Number(cm[2]) + 1}`;

console.log(`\n  ${data.live} -> ${target}`);
console.log(`  retiring: ${retiring.map((b) => b.id).join(', ')} (${retiring.reduce((n, b) => n + b.stories.length, 0)} stories deleted)`);
console.log(`  shelf after: ${going.stories.length} stories`);
console.log(`  still waiting: ${kept.slice(1).map((b) => b.id).join(', ') || '(none)'}`);
console.log(`  app ${vm[1]}.${vm[2]} -> ${newApp}, cache v${cm[1]}.${cm[2]} -> v${newCache}`);

if (dryRun) { console.log('\n  --dry-run: nothing written.\n'); process.exit(0); }

fs.writeFileSync(LOG, (fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').replace(/\s+$/, '') : LOG_HEADER.replace(/\s+$/, '')) + '\n' + entry);
data.live = target;
data.batches = kept;
fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');
fs.writeFileSync(APP, app.replace(vm[0], `const APP_VERSION='${newApp}';`));
fs.writeFileSync(SW, sw.replace(cm[0], `'tsid-shell-v${newCache}'`));

console.log('\n  Written. Now delete the recordings that came down:\n');
for (const b of retiring) {
  console.log(`    git worktree add /tmp/audio ${AUDIO_BRANCH} && cd /tmp/audio \\`);
  console.log(`      && git rm -q ${b.stories.map((s) => `stories/${s.id}.mp3`).join(' ')} \\`);
  console.log(`      && git commit -qm "Retire ${b.id} recordings" && git push origin ${AUDIO_BRANCH}`);
}
console.log('\n  Then run the tests, commit, and push to all three branches.\n');
