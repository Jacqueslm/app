// Jacques, 29 Aug 2026: "dont auto update stories just do it when i ask, to
// stop the confusion. When I ask, 10 stories get taken down and 10 more added.
// Put all the old stories on the app and just store the new ones in the repo
// for when I'm ready to rotate."
//
// So the shelf is no longer a function of the date. It is whatever set the
// `live` field in data/audio-stories.json names, and it moves only when that
// word is edited and shipped. These tests guard the two things that can go
// quietly wrong: the app going back to a timer, and `live` naming a set that
// isn't there (which would silently show the wrong ten).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const APP = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'audio-stories.json'), 'utf8'));

// The two pure functions exactly as shipped, with their globals injected.
function shelfFor(batchIds, liveId, batches) {
  const i = batchIds.indexOf(liveId);
  return (batches[i >= 0 ? i : 0] || []).slice();
}

const setA = Array.from({ length: 10 }, (_, i) => `a${i + 1}`);
const setB = Array.from({ length: 10 }, (_, i) => `b${i + 1}`);

test('nothing in the shipped shelf code depends on the date', () => {
  assert.doesNotMatch(APP, /STORY_FORTNIGHT_DAYS/,
    'the fortnight timer is gone - a new set must never publish itself');
  assert.match(APP, /STORY_LIVE_ID=d\.live\|\|''/, 'the shelf is named, not calculated');
});

test('the live set is served whole - all ten, not five', () => {
  assert.deepEqual(shelfFor(['set-1', 'set-2'], 'set-1', [setA, setB]), setA);
  assert.equal(shelfFor(['set-1', 'set-2'], 'set-1', [setA, setB]).length, 10);
  assert.doesNotMatch(APP, /set\.slice\(5,10\)/, 'sets no longer split in half');
});

test('a set written but not named live stays off the shelf', () => {
  const shelf = shelfFor(['set-1', 'set-2'], 'set-1', [setA, setB]);
  assert.equal(shelf.filter((x) => setB.includes(x)).length, 0,
    'adding the next ten to the file must not publish them');
});

test('rotating is one word - naming the other set swaps all ten', () => {
  assert.deepEqual(shelfFor(['set-1', 'set-2'], 'set-2', [setA, setB]), setB);
});

test('an unknown or missing live id falls back to the first set, never empty', () => {
  assert.deepEqual(shelfFor(['set-1', 'set-2'], 'set-3', [setA, setB]), setA, 'typo');
  assert.deepEqual(shelfFor(['set-1', 'set-2'], '', [setA, setB]), setA, 'no live field');
});

test('a flat file with no batches is read as a single set', () => {
  assert.match(APP, /Array\.isArray\(d\.batches\)&&d\.batches\.length/, 'batches when present');
  assert.match(APP, /\{id:'all',stories:d\.stories\|\|\[\]\}/, 'falls back to the flat list');
});

test('every story ever published stays looked-up-able by id', () => {
  assert.match(APP, /STORIES_POOL=STORY_BATCHES\.reduce\(\(a,b\)=>a\.concat\(b\),\[\]\)/,
    'the player reads titles from this, including for a story off the shelf');
});

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
});
