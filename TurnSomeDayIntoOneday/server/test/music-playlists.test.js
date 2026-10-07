// Playlists — 7 Oct 2026.
//
// Jacques: "add the option to make playlist and the option to add a song again
// like a filter so i want add the same songs". Two halves: a named list that
// comes back next time, and the same song sitting in it as many times as he
// likes — that repeat IS the feature, so "already in the list" must never be
// an answer here.
//
// The ways this goes wrong are storage, not layout: a list written out before
// the songs are back would replace its kept keys with nothing and lose it for
// good; a song removed from the phone would leave rows pointing at nothing;
// saving under a key that collides with the fade setting would mix the two. So
// the block is RUN here against a fake phone rather than read as text.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'music.html'), 'utf8');

// The playlist block: from its first line to the tabs section that follows it.
function blockSource() {
  const a = PAGE.indexOf('var lists = [];');
  const b = PAGE.indexOf('// ── tabs ─');
  assert.ok(a > -1, 'the playlist block must be in music.html');
  assert.ok(b > a, 'and it must sit before the tabs');
  return PAGE.slice(a, b);
}

/* A fake phone: whatever songs are kept, a localStorage that answers, and the
   few page functions the block calls to redraw. */
function harness(stored, songs) {
  stored = stored || {};
  const said = [];
  const counts = { chips: 0, list: 0 };
  const ctx = {
    Math, Number, Array, String, Object, JSON, console,
    songs: songs || [],
    roomIndex: -1,
    current: -1,
    say(el, text) { said.push(String(text || '')); },
    $() { return {}; },
    renderListChips() { counts.chips += 1; },
    renderPlaylist() { counts.list += 1; },
    window: {
      localStorage: {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null),
        setItem: (k, v) => { stored[k] = String(v); },
      },
    },
    counts,
    said,
  };
  vm.createContext(ctx);
  vm.runInContext(blockSource(), ctx, { filename: 'music-playlists.js' });
  return {
    ctx, stored, said, counts,
    run: (expr) => vm.runInContext(expr, ctx),
  };
}

/* ------------------------------------------------------------------ making */

test('a playlist is made, and kept under its own key away from the songs', () => {
  const h = harness();
  h.run('listsResolved = true');   // the songs are back, so saving is allowed
  assert.strictEqual(h.run('makeList("Night mix")'), null, 'a good name is accepted');
  assert.strictEqual(h.run('lists.length'), 1);
  assert.strictEqual(h.run('lists[0].name'), 'Night mix');
  const saved = JSON.parse(h.stored['tsid-music-lists']);
  assert.deepStrictEqual(saved, [{ name: 'Night mix', keys: [] }], 'kept as name plus keys');
  assert.strictEqual(h.stored['tsid-music-fade'], undefined, 'and nowhere near the fade setting');
});

test('a nameless list is refused, and a second list cannot take a name already used', () => {
  const h = harness();
  assert.match(String(h.run('makeList("")')), /name/, 'nothing to name, nothing made');
  assert.match(String(h.run('makeList("   ")')), /name/, 'spaces are not a name either');
  assert.strictEqual(h.run('makeList("Calm")'), null);
  assert.match(String(h.run('makeList("calm")')), /already have/, 'the same name in another case is refused');
  assert.strictEqual(h.run('lists.length'), 1, 'and only the one list exists');
});

/* ---------------------------------------------------- the repeat is the point */

test('the same song goes into a list again and again, and every copy is kept', () => {
  const song = { key: 'a.mp3|9|17', name: 'A' };
  const h = harness({}, [song]);
  h.run('listsResolved = true');
  h.run('makeList("Repeat")');
  h.run('setView(0)');
  assert.strictEqual(h.run('addToList(songs[0])'), null);
  assert.strictEqual(h.run('addToList(songs[0])'), null);
  assert.strictEqual(h.run('addToList(songs[0])'), null, 'three times, with no complaint');
  assert.strictEqual(h.run('lists[0].items.length'), 3);
  assert.strictEqual(h.run('lists[0].items[0] === lists[0].items[2]'), true, 'all three are the one song');
  const saved = JSON.parse(h.stored['tsid-music-lists']);
  assert.deepStrictEqual(saved[0].keys, ['a.mp3|9|17', 'a.mp3|9|17', 'a.mp3|9|17'],
    'and the repeats are written out, not collapsed');
});

test('adding with no list picked says so instead of quietly doing nothing', () => {
  const h = harness({}, [{ key: 'k', name: 'S' }]);
  const err = String(h.run('addToList(songs[0])'));
  assert.match(err, /Tap a playlist below first/, 'he is told what to do');
  assert.strictEqual(h.run('lists.length'), 0, 'and nothing was made behind his back');
});

/* ------------------------------------------------------------------ keeping */

test('a list comes back in order, with the same song repeated and the gone ones dropped', () => {
  const stored = {
    'tsid-music-lists': JSON.stringify([{ name: 'Road', keys: ['one', 'two', 'one', 'gone'] }]),
  };
  const one = { key: 'one' };
  const two = { key: 'two' };
  const h = harness(stored, [two, one]);   // storage order differs from list order, on purpose
  h.run('loadListDefs()');
  h.run('resolveLists()');
  assert.strictEqual(h.run('lists[0].name'), 'Road');
  // Round-tripped through JSON because a vm array is a different realm's array:
  // deepStrictEqual compares prototypes, and this one is not the host's.
  const order = JSON.parse(JSON.stringify(h.run('lists[0].items.map(function(s){ return s.key; })')));
  assert.deepStrictEqual(order, ['one', 'two', 'one'],
    'order kept, the repeat kept, and the song that is gone dropped');
  h.run('listsResolved = true');
  h.run('saveLists()');
  assert.deepStrictEqual(JSON.parse(stored['tsid-music-lists'])[0].keys, ['one', 'two', 'one'],
    'writing it back changes nothing');
});

test('nothing is written out before the songs are back — a kept list must survive', () => {
  const stored = {
    'tsid-music-lists': JSON.stringify([{ name: 'Keep', keys: ['one'] }]),
  };
  const h = harness(stored, []);           // the songs have not been restored yet
  h.run('loadListDefs()');
  h.run('resolveLists()');
  h.run('makeList("New")');
  assert.deepStrictEqual(JSON.parse(stored['tsid-music-lists']), [{ name: 'Keep', keys: ['one'] }],
    'the kept keys are untouched by an unresolved save');
  assert.strictEqual(h.run('lists.length'), 2, 'but the new list is still on screen');
  h.run('listsResolved = true');
  h.run('saveLists()');
  const after = JSON.parse(stored['tsid-music-lists']);
  assert.strictEqual(after.length, 2, 'once the songs are known, both lists persist');
  assert.deepStrictEqual(after[0], { name: 'Keep', keys: [] },
    'the first one honestly has no songs left — they were not there to point at');
});

/* --------------------------------------------------------------- taking out */

test('a song taken off the phone leaves every list with it', () => {
  const a = { key: 'a' };
  const b = { key: 'b' };
  const h = harness({}, [a, b]);
  h.run('makeList("Two")');
  h.run('setView(0)');
  h.run('addToList(songs[0])');
  h.run('addToList(songs[1])');
  h.run('addToList(songs[0])');
  h.run('listsResolved = true');
  h.run('dropSongFromLists(songs[0])');
  assert.strictEqual(h.run('lists[0].items.length'), 1, 'only the song that still exists is left');
  assert.strictEqual(h.run('lists[0].items[0] === songs[1]'), true);
  h.run('setView(-1)');
  assert.strictEqual(h.run('songs.length'), 2, 'the library itself was not touched by that');
});

test('one row out of a list takes the row out, not the song', () => {
  const a = { key: 'a' };
  const b = { key: 'b' };
  const h = harness({}, [a, b]);
  h.run('makeList("Pair")');
  h.run('setView(0)');
  h.run('addToList(songs[0])');
  h.run('addToList(songs[1])');
  h.run('listsResolved = true');
  h.run('current = 1');
  h.run('takeOutOfList(0)');
  assert.strictEqual(h.run('lists[0].items.length'), 1);
  assert.strictEqual(h.run('songs.length'), 2, 'the song is still on the phone');
  assert.strictEqual(h.run('current'), 0, 'and the row that was playing is still the one marked');
});

test('deleting a list leaves the songs on the phone and goes back to All songs', () => {
  const h = harness({}, [{ key: 'k' }]);
  h.run('makeList("Temp")');
  h.run('setView(0)');
  h.run('listsResolved = true');
  h.run('deleteList(0)');
  assert.strictEqual(h.run('lists.length'), 0);
  assert.strictEqual(h.run('viewList'), -1, 'the screen is back on All songs');
  assert.strictEqual(h.run('songs.length'), 1, 'the song is still here');
  assert.deepStrictEqual(JSON.parse(h.stored['tsid-music-lists']), [], 'and the deletion is kept');
});

/* ------------------------------------------------------------ what plays from */

test('the list on screen is what the player plays from', () => {
  const a = { key: 'a', name: 'A' };
  const b = { key: 'b', name: 'B' };
  const h = harness({}, [a, b]);
  h.run('makeList("Only B")');
  h.run('setView(0)');
  h.run('addToList(songs[1])');
  assert.strictEqual(h.run('viewList'), 0);
  assert.strictEqual(h.run('view()[0] === songs[1]'), true, 'only what was put in it');
  assert.strictEqual(h.run('view().length'), 1);
  h.run('setView(-1)');
  assert.strictEqual(h.run('view().length'), 2, 'All songs is everything again');
});

test('switching lists keeps playing what was playing, when it is in both', () => {
  const a = { key: 'a', name: 'A' };
  const b = { key: 'b', name: 'B' };
  const h = harness({}, [a, b]);
  h.run('makeList("Has B")');
  h.run('lists[0].items.push(songs[1])');
  h.run('listsResolved = true');
  h.run('current = 1');                 // playing the second of All songs
  h.run('setView(0)');
  assert.strictEqual(h.run('current'), 0, 'the same song is now first of the list');
  h.run('setView(-1)');
  assert.strictEqual(h.run('current'), 1, 'and back on All songs it is where it was');
});

/* -------------------------------------------------------------- the page itself */

test('the playlists card is on the player, with the buttons the tests assume', () => {
  for (const id of ['listChips', 'listName', 'makeList', 'listRow', 'delList', 'listStatus']) {
    assert.match(PAGE, new RegExp(`id="${id}"`), `the ${id} element must be in the markup`);
  }
  assert.match(PAGE, /plus\.className = 'x plus';/, 'every song row carries the + that fills a list');
  assert.match(PAGE, /function renderListChips\(\)/, 'the row of lists is drawn by the page');
});
