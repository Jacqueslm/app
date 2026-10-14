// The Music page's scanner — 7 Oct 2026.
//
// Jacques: "a scanner i can scan for new music". Two halves: the app's own
// room (the page cannot list a web address, so it asks for a list the build
// writes and a live server reads), and a folder on the phone (the page walks
// what it has been allowed to see). What is checked here is the half that can
// go wrong quietly: a list that never changes, a list that includes something
// it should not, and a merge that would add the same track on every scan.
//
// 14 Oct 2026, the folder half. Jacques: "scan folder doesnt work scan set up
// only to scan only music folder or download and make sure it doesnt pick up the
// song twice". Three checks join the ones above: the scan reads the Music folder
// and the Download folder and refuses anything else, it reaches a phone's folder
// through the folder chooser a phone actually has, and a second copy of a song
// he already has is counted as already here rather than added as a second row.
// The manual went behind a drop-down the same day, and its one line about where
// the scan looks is checked with it.
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

/* ------------------------------------------- which folders the scan may read */

// The folder half of the scan: the walk, and the two-file rule on top of it.
// It sits after the room scan in the page, so the two halves are read out
// separately and run together — the constants and the helpers come from the
// first slice, the walk and the folder rule from the second.
function folderBlockSource() {
  const a = PAGE.indexOf('function readDirFiles(');
  const b = PAGE.indexOf('  // ── start ─');
  assert.ok(a > -1, 'the folder walk must be in music.html');
  assert.ok(b > a, 'and it must sit before the page\u2019s start section');
  return PAGE.slice(a, b);
}

// What the page hands back is made inside its own sandbox, so it is copied into
// this one before it is compared - a cross-realm object is the same shape and a
// different prototype, which deepStrictEqual is right to complain about.
const plain = (v) => JSON.parse(JSON.stringify(v));

// A folder as the page walks it: the async iterator a directory handle gives.
function fakeDir(name, entries) {
  const queue = entries.slice();
  const dir = { name, kind: 'directory', walked: 0, values() { dir.walked += 1; return {
    next() { return Promise.resolve(queue.length ? { done: false, value: queue.shift() } : { done: true }); },
  }; } };
  return dir;
}
function fakeFile(name) {
  return { kind: 'file', name, getFile: () => Promise.resolve({ name, size: 10, lastModified: 1 }) };
}

// Run against a fake phone: a folder chooser on a file input that answers when
// it is pressed, and a real walk over the fake folder it is pointed at.
function folderHarness(opts) {
  opts = opts || {};
  const handed = [];
  const calls = { put: [] };
  const input = {
    files: opts.files || [], value: '', clicked: false, listeners: {},
    addEventListener(t, fn) { this.listeners[t] = fn; },
    removeEventListener(t) { delete this.listeners[t]; },
    click() { this.clicked = true; if (this.listeners.change) this.listeners.change(); },
  };
  if (opts.webkitdirectory !== false) input.webkitdirectory = '';
  // The button, the status line and the note under the button: the scan writes
  // to all three, so all three are here to be read back.
  const status = { textContent: '' };
  const note = { textContent: '' };
  const button = {
    disabled: false, clicks: 0, listeners: {},
    addEventListener(t, fn) { this.listeners[t] = fn; },
    click() { this.clicks += 1; if (this.listeners.click) this.listeners.click(); },
  };
  const els = { folderInput: input, scanBtn: button, playerStatus: status, scanNote: note };
  const ctx = {
    Math, Number, Array, String, Object, JSON, console, Date, Promise, Error, setTimeout, clearTimeout,
    ROOM: [],
    songs: [], kept: {},
    addFiles(files) { handed.push(files); return { added: files.length, already: 0 }; },
    dbGet() { return Promise.resolve(null); },
    dbPut(store, rec) { calls.put.push(rec); return Promise.resolve(); },
    say(el, text) { const t = els.playerStatus; if (t) t.textContent = String(text || ''); },
    renderRoom() {},
    fetch() { return Promise.resolve({ ok: true, json: () => Promise.resolve([]) }); },
    $: (id) => els[id] || { textContent: '', disabled: false, addEventListener() {} },
    window: { addEventListener() {}, removeEventListener() {} },
    handed, calls, input, els, status, note, button,
  };
  if (opts.desktop) ctx.window.showDirectoryPicker = () => Promise.resolve(opts.desktop);
  vm.createContext(ctx);
  vm.runInContext(blockSource(), ctx, { filename: 'music-scan.js' });
  vm.runInContext(folderBlockSource(), ctx, { filename: 'music-folders.js' });
  // The button's own listener, so a test can press it the way a thumb does.
  return {
    ctx, handed, calls, input, els, status, note, button,
    run: (expr) => vm.runInContext(expr, ctx),
  };
}

test('the scan reads the Music folder and the Download folder, and refuses anything else', async () => {
  // A phone: the folder chooser, and the folder's name read off the paths it
  // hands over. Music and Download are the two, and Download is Downloads on
  // some handsets.
  const music = folderHarness({ files: [{ name: 'a.mp3', webkitRelativePath: 'Music/a.mp3' }] });
  const gotMusic = await music.run('scanPhoneFolder()');
  assert.deepStrictEqual(plain(gotMusic), { added: 1, already: 0, folder: 'Music', note: '', unnamed: false });
  assert.ok(music.input.clicked, 'the scan opens the folder chooser');

  const dl = folderHarness({ files: [{ name: 'b.mp3', webkitRelativePath: 'Downloads/b.mp3' }] });
  assert.strictEqual((await dl.run('scanPhoneFolder()')).folder, 'Downloads');

  const wrong = folderHarness({ files: [{ name: 'x.mp3', webkitRelativePath: 'DCIM/Camera/x.mp3' }] });
  const gotWrong = await wrong.run('scanPhoneFolder()');
  assert.strictEqual(gotWrong.added, 0, 'a folder that is neither is not read');
  assert.match(gotWrong.note, /Music folder and your Download folder/, 'and it says which two it is for');
  assert.strictEqual(wrong.handed.length, 0, 'nothing from a refused folder ever reaches the list');
});

test('a computer gets the directory picker, started in Music, and the same rule binds it', async () => {
  const pictures = fakeDir('Pictures', [fakeFile('x.mp3')]);
  const refused = folderHarness({ desktop: Object.assign(pictures, { queryPermission: () => Promise.resolve('granted') }) });
  const out = await refused.run('scanPhoneFolder()');
  assert.strictEqual(out.added, 0);
  assert.match(out.note, /nowhere else/);
  assert.strictEqual(pictures.walked, 0, 'a refused folder is never walked');
  assert.strictEqual(refused.handed.length, 0, 'and nothing from it is read');

  const music = fakeDir('Music', [fakeFile('c.mp3'), fakeFile('d.mp3'), fakeFile('notes.txt')]);
  const allowed = folderHarness({ desktop: Object.assign(music, { queryPermission: () => Promise.resolve('granted') }) });
  const ok = await allowed.run('scanPhoneFolder()');
  assert.strictEqual(ok.folder, 'Music');
  assert.strictEqual(ok.added, 2, 'the walk found the two tracks and not the text file');
  assert.strictEqual(music.walked, 1, 'the folder that is allowed is walked');
  assert.strictEqual(allowed.handed[0].length, 2, 'and only audio is handed to the list');
  assert.strictEqual(allowed.calls.put.length, 1, 'and the folder is kept, so next time is one tap');
  // The chooser is asked to start in Music rather than wherever it was left.
  assert.match(folderBlockSource(), /startIn: 'music'/);
});

test('a phone with no folder chooser says so rather than pretending it scanned', async () => {
  const h = folderHarness({ webkitdirectory: false });
  const out = await h.run('scanPhoneFolder()');
  assert.strictEqual(out.added, 0);
  assert.match(out.note, /cannot look through a folder/, 'the honest answer, not "nothing new"');
});

test('pressing the button does the whole scan and says what it found', async () => {
  const h = folderHarness({ files: [{ name: 'a.mp3', webkitRelativePath: 'Music/a.mp3' }] });
  assert.ok(h.button.listeners.click, 'the button is wired up');
  h.button.click();
  assert.strictEqual(h.button.disabled, true, 'and it cannot be pressed twice while it runs');
  await new Promise((r) => setTimeout(r, 20));
  assert.match(h.status.textContent, /Found 1 new song from your Music folder/, h.status.textContent);
  assert.strictEqual(h.button.disabled, false, 'and it comes back for the next press');
});

test('a browser that hands over files without naming the folder says so', async () => {
  // Chrome for Android offers no folder chooser: the same input gives back the
  // files he picked, with no path on them. They are added - they are the songs
  // he chose - and the line under the button says the folder could not be named,
  // rather than leaving him thinking the two-folder rule was checked.
  const h = folderHarness({ files: [{ name: 'a.mp3' }, { name: 'b.mp3' }] });
  const out = await h.run('scanPhoneFolder()');
  assert.strictEqual(out.added, 2);
  assert.strictEqual(out.unnamed, true);
  h.button.click();
  await new Promise((r) => setTimeout(r, 20));
  assert.match(h.note.textContent, /could not tell which folder/, h.note.textContent);
  assert.match(h.note.textContent, /Music and Download/, 'and the rule it could not check is still stated');
});

/* ------------------------------------------- the same song, twice, never again */

// The adding block: the page's own fileKey and addFiles, run against a fake
// phone so the merge is driven rather than read. The page's own sameSong comes
// with it, from the scanner block above.
function addBlockSource() {
  const a = PAGE.indexOf('function fileKey(');
  const b = PAGE.indexOf('function readDuration(');
  assert.ok(a > -1 && b > a, 'the adding block must be in music.html');
  return PAGE.slice(a, b);
}

function addHarness() {
  const said = [];
  const ctx = {
    Math, Number, Array, String, Object, JSON, console, Date, Promise, Error,
    songs: [], kept: {},
    readDuration() {}, keepSong() {}, sortRows() {}, renderPlaylist() {},
    renderRingtoneOptions() {}, selectSong() {},
    // The page's own name-stripper, which addFiles keeps a song's title with.
    baseName(name) { return String(name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Song'; },
    say(el, text) { said.push(String(text || '')); },
    $() { return {}; },
    URL: { createObjectURL: () => 'blob:fake' },
    current: -1, viewList: -1,
    said,
  };
  vm.createContext(ctx);
  vm.runInContext(blockSource(), ctx, { filename: 'music-scan.js' });
  vm.runInContext(addBlockSource(), ctx, { filename: 'music-add.js' });
  return { ctx, said, run: (expr) => vm.runInContext(expr, ctx) };
}

test('a song that is already here is not added a second time, however it arrives', () => {
  const h = addHarness();
  assert.deepStrictEqual(plain(h.run('addFiles([{name:"Track.mp3",size:100,lastModified:1,type:"audio/mpeg"}])')),
    { added: 1, already: 0 }, 'the first copy goes in');
  assert.strictEqual(h.run('songs.length'), 1);

  // The other copy of the same song: Music has one and Download has one, with
  // different dates on them and a slightly different size. One song.
  assert.deepStrictEqual(plain(h.run('addFiles([{name:"Track.mp3",size:104,lastModified:9,type:"audio/mpeg"}])')),
    { added: 0, already: 1 }, 'the second copy is counted as already here');
  assert.strictEqual(h.run('songs.length'), 1, 'and the list is still one song long');
  assert.match(h.said.join(' '), /already in the list/, 'and he is told why it did not go in');

  // The exact same file again — the scan run twice, which is the ordinary case.
  assert.deepStrictEqual(plain(h.run('addFiles([{name:"Track.mp3",size:100,lastModified:1,type:"audio/mpeg"}])')),
    { added: 0, already: 1 });

  // A song he does not have still goes in, once.
  assert.strictEqual(h.run('addFiles([{name:"Other.mp3",size:9,lastModified:3,type:"audio/mpeg"}]).added'), 1);
  assert.strictEqual(h.run('addFiles([{name:"Other.mp3",size:9,lastModified:3,type:"audio/mpeg"}]).added'), 0);
  assert.strictEqual(h.run('songs.length'), 2, 'two songs, and still not three');

  // A file that is not audio is not a song at all, and is not counted as one.
  assert.deepStrictEqual(plain(h.run('addFiles([{name:"notes.txt",size:1,lastModified:1,type:"text/plain"}])')),
    { added: 0, already: 0 });
});

/* ------------------------------------------------------- the manual, folded */

test('the manual is a drop-down on the player, and it still says where the scan looks', () => {
  const at = PAGE.indexOf('<details class="card fold" id="manual">');
  assert.ok(at > -1, 'the manual is a drop-down');
  const end = PAGE.indexOf('</details>', at);
  assert.ok(end > at, 'and it closes');
  const manual = PAGE.slice(at, end);
  assert.match(manual, /<summary>[\s\S]*How your music gets here[\s\S]*<\/summary>/, 'the summary names it');
  assert.match(manual, /<ol class="steps">[\s\S]*<\/ol>\s*$/, 'and the numbered manual is inside the drop-down');
  assert.match(manual, /your <b>Music<\/b> folder and your <b>Download<\/b> folder/,
    'and the words match what the scan does now');
  assert.ok(PAGE.indexOf('id="nowCard"') < at, 'the player is still the first thing on the page');
});
