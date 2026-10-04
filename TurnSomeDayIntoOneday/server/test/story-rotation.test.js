// Jacques, 29 Aug 2026: "dont auto update stories just do it when i ask, to
// stop the confusion. When I ask, 10 stories get taken down and 10 more added.
// Put all the old stories on the app and just store the new ones in the repo
// for when I'm ready to rotate."
//
// So the shelf is no longer a function of the date. It is whatever set the
// `live` field in data/audio-stories.json names, and it moves only when that
// word is edited and shipped. These tests guard the data file and the tool that
// rotates it.
//
// 4 Oct 2026: the recovery app is deleted, along with the tests that read its
// page. The seven tests that read the story shelf out of that page went with it -
// they were guards on code that no longer exists anywhere. What is left is what
// is still on disk: the data file, its rotation log, and the tool. The shelf as
// rendered has no page to be checked on, so nothing here claims to check it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'audio-stories.json'), 'utf8'));

test('the data file names a set that actually exists', () => {
  const ids = DATA.batches.map((b) => b.id);
  assert.ok(DATA.live, 'live must be set');
  assert.ok(ids.includes(DATA.live), `live "${DATA.live}" is not one of ${ids.join(', ')}`);
});

test('every set is ten stories with unique ids across the whole file', () => {
  const seen = new Set();
  for (const b of DATA.batches) {
    assert.equal(b.stories.length, 10, `${b.id} should be ten stories`);
    for (const s of b.stories) {
      assert.ok(!seen.has(s.id), `duplicate story id ${s.id}`);
      seen.add(s.id);
    }
  }
});

test('every story on the live shelf has what the card renders', () => {
  const live = DATA.batches.find((b) => b.id === DATA.live);
  for (const s of live.stories) {
    for (const k of ['id', 'title', 'perspective', 'topic', 'narrator', 'minutes', 'text']) {
      assert.ok(s[k], `${s.id} is missing ${k}`);
    }
    assert.ok(['user', 'supporter'].includes(s.perspective), `${s.id} perspective`);
  }
});

// Jacques, 29 Aug 2026: "when the stories get rotated always delete the old
// ones, log to repo." So a retired set must be gone from the data file, not
// left sitting there, and data/story-rotations.txt must say what went.
const LOG_PATH = path.join(ROOT, 'data', 'story-rotations.txt');

test('the live set is the first one in the file - nothing retired is left behind', () => {
  assert.equal(DATA.batches[0].id, DATA.live,
    'sets before the live one should have been deleted when they came down');
});

test('the rotation log exists and is in the repo', () => {
  assert.ok(fs.existsSync(LOG_PATH), 'data/story-rotations.txt is the only record of a deleted set');
});

test('nothing recorded as retired is still on the shelf', () => {
  const log = fs.readFileSync(LOG_PATH, 'utf8');
  const retired = [...log.matchAll(/^\d{4}-\d{2}-\d{2}\s+(\S+) retired/gm)].map((m) => m[1]);
  for (const id of retired) {
    assert.ok(!DATA.batches.some((b) => b.id === id),
      `${id} is logged as retired but is still in audio-stories.json`);
  }
});

test('the rotation tool is the thing that does it, and it deletes', () => {
  const tool = fs.readFileSync(path.join(ROOT, 'tools', 'rotate-stories.js'), 'utf8');
  assert.match(tool, /data\.batches = kept/, 'the retired sets are dropped from the file');
  assert.match(tool, /git rm/, 'and their recordings are deleted from the audio branch');
  assert.match(tool, /APP_VERSION='\$\{newApp\}'/, 'and the version bumps, or phones keep the old shelf');
  // The version it bumps has to be the version the shipping page declares, or
  // the bump moves a number nothing reads and every installed phone keeps the
  // old shelf - the exact failure this tool exists to prevent.
  assert.match(tool, /const APP = path\.join\(ROOT, 'hub\.html'\)/,
    'the version bumped is the one the page /app hands out declares');
  assert.match(fs.readFileSync(path.join(ROOT, 'hub.html'), 'utf8'), /const APP_VERSION='/,
    'and that page does declare it');
  assert.doesNotMatch(tool, /index\.html/, 'and it no longer reaches for a page that is gone');
});
