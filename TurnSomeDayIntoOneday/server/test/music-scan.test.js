// The Music page's scanner — 7 Oct 2026.
//
// Jacques: "a scanner i can scan for new music". Two halves: the app's own
// room (the page cannot list a web address, so it asks for a list the build
// writes and a live server reads), and a folder on the phone (the page walks
// what it has been allowed to see). What is checked here is the half that can
// go wrong quietly: a list that never changes, a list that includes something
// it should not, and a merge that would add the same track on every scan.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const vm = require('vm');
const path = require('path');

const { listFor } = require('../music-list');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'music.html'), 'utf8');

/* ------------------------------------------------------------------- listFor */

test('the list is audio only, sorted, and a missing folder is not a crash', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-list-'));
  try {
    fs.writeFileSync(path.join(dir, 'zebra.mp3'), 'x');
    fs.writeFileSync(path.join(dir, 'alpha.MP3'), 'x');
    fs.writeFileSync(path.join(dir, 'quiet.m4a'), 'x');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
    fs.writeFileSync(path.join(dir, 'list.json'), '[]');
    assert.deepStrictEqual(listFor(dir), ['alpha.MP3', 'quiet.m4a', 'zebra.mp3'],
      'only what can be played, in one order the page can rely on');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.strictEqual(listFor(path.join(os.tmpdir(), `tsid-no-such-${Date.now()}`)), null,
    'a folder that is not there reads as null rather than throwing');
});

test('the build writes the scanner its list, beside the tracks it describes', () => {
  const build = require('../../vercel-build');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-scan-'));
  try {
    build.build({ out, dirs: ['audio/meditation'], files: [], quiet: true });
    const listPath = path.join(out, 'audio', 'meditation', 'list.json');
    assert.ok(fs.existsSync(listPath), 'list.json must land beside the tracks, at the address the page fetches');
    const tracks = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    assert.deepStrictEqual(tracks, listFor(path.join(ROOT, 'audio', 'meditation')),
      'and say exactly what is in the folder — no more, no less');
    assert.ok(tracks.includes('rain.mp3'), 'the room\\u2019s own tracks are in it');
    assert.ok(!tracks.includes('list.json'), 'the list does not list itself as a track');
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('a live server answers the scan from the folder itself, above express.static', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');
  const at = src.indexOf("app.get('/audio/meditation/list.json'");
  assert.ok(at > -1, 'the route must exist');
  const staticAt = src.indexOf('app.use(express.static');
  assert.ok(at < staticAt, 'and it must sit above express.static, or the static layer answers first');
  assert.ok(src.includes("require('./music-list')"), 'reading the folder through the same helper the build uses');
});

/* ------------------------------------------------------ the page's own merge */

// The scanner block: from its first line to the folder-walk that follows it.
function blockSource() {
  const a = PAGE.indexOf('var AUDIO_FILE =');
  const b = PAGE.indexOf('function readDirFiles(');
  assert.ok(a > -1, 'the scanner must be in music.html');
  assert.ok(b > a, 'and it must sit before the folder walk');
  return PAGE.slice(a, b);
}

function scanHarness(files) {
  const said = [];
  const urls = [];
  const optsSeen = [];
  const counts = { room: 0 };
  const ctx = {
    Math, Number, Array, String, Object, JSON, console, Date, Promise, Error,
    ROOM: [
      { name: 'Rain', url: '/audio/meditation/rain.mp3', file: 'rain.mp3' },
      { name: 'Ocean', url: '/audio/meditation/ocean.mp3', file: 'ocean.mp3' },
    ],
    say(el, text) { said.push(String(text || '')); },
    $() { return { textContent: '' }; },
    renderRoom() { counts.room += 1; },
    fetch(url, opts) {
      urls.push(String(url));
      optsSeen.push(opts || {});
      return Promise.resolve({ ok: true, json() { return Promise.resolve(files); } });
    },
    counts, urls, optsSeen, said,
  };
  vm.createContext(ctx);
  vm.runInContext(blockSource(), ctx, { filename: 'music-scan.js' });
  return { ctx, counts, urls, optsSeen, said, run: (expr) => vm.runInContext(expr, ctx) };
}

test('the scan finds the track the room does not have, and only that one', async () => {
  const h = scanHarness([
    'rain.mp3',            // already there
    'ocean.mp3',           // already there
    'brand-new.mp3',       // new
    'list.json',           // not music
    'notes.txt',           // not music either
  ]);
  const added = await h.run('scanRoomMusic()');
  assert.strictEqual(added, 1, 'one new track, counted once');
  assert.strictEqual(h.run('ROOM.length'), 3, 'the room is one longer');
  assert.strictEqual(h.run('ROOM[2].name'), 'Brand New', 'and it is named from its file');
  assert.strictEqual(h.run('ROOM[2].url'), '/audio/meditation/brand-new.mp3', 'at the address it plays from');
  assert.ok(h.counts.room >= 1, 'the list on screen was redrawn');
  assert.match(h.urls[0], /^\/audio\/meditation\/list\.json\?t=\d+$/,
    'asked with a fresh timestamp, so a cached answer can never hide a new track');
  assert.strictEqual(h.optsSeen[0].cache, 'no-store', 'and never from cache');

  const again = await h.run('scanRoomMusic()');
  assert.strictEqual(again, 0, 'scanning again adds nothing — no duplicates, ever');
  assert.strictEqual(h.run('ROOM.length'), 3, 'the room is not one longer again');
});

test('a scan that cannot be answered fails loudly rather than pretending', async () => {
  const h = scanHarness([]);
  h.ctx.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  await assert.rejects(() => h.run('scanRoomMusic()'), 'a missing list is an error, not an empty answer');
  assert.strictEqual(h.run('ROOM.length'), 2, 'and the room is left exactly as it was');
});

test('the scanner is on the player, wired to a button he can press', () => {
  assert.match(PAGE, /id="scanBtn"/, 'the button must be in the markup');
  assert.match(PAGE, /\$\('scanBtn'\)\.addEventListener\('click'/, 'and it must be wired up');
  assert.match(PAGE, /function scanPhoneFolder\(\)/, 'the phone side of the scan exists');
  assert.match(PAGE, /id="roomTitle"/, 'the room heading the scan keeps honest exists');
});
