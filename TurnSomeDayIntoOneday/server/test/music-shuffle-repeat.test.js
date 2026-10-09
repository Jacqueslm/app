// Shuffle and repeat, and playing with the screen off — 8 Oct 2026.
//
// Jacques: "add shuffle and repeat and make sure it plays when screen is off".
// Three things have to be true at once, and each is arithmetic rather than
// layout: shuffle must never hand back the song already playing, repeat-one must
// come round again instead of moving on, and repeat-off must actually finish the
// list instead of looping for ever the way the player did before. The fourth is
// the lock screen: the phone is told what is playing (the Media Session) and
// that is what keeps the sound alive with the screen off, so the wiring is run
// here rather than read as text.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'music.html'), 'utf8');

// The shuffle and repeat block: from its first line to the fade section that
// follows it (which has its own tests, and must not start swallowing this one).
function blockSource() {
  const a = PAGE.indexOf('var SHUFFLE_KEY');
  const b = PAGE.indexOf('// ── fade between songs ─');
  assert.ok(a > -1, 'the shuffle and repeat block must be in music.html');
  assert.ok(b > a, 'and it must sit in the player, before the fade block');
  return PAGE.slice(a, b);
}

// nextTrack and advanceIndex sit in the player block below the fade (which has
// its own tests). They are lifted in here so the hand-over between two songs can
// be run for real rather than only read as text.
function fnSource(name) {
  const a = PAGE.indexOf(`function ${name}(){`);
  assert.ok(a > -1, `${name} must be in music.html`);
  const end = PAGE.indexOf('\n  }\n', a);
  assert.ok(end > a, `${name} must be a plain function closing on its own line`);
  return PAGE.slice(a, end + '\n  }'.length);
}

function chip(value, attr) {
  return {
    _a: { [attr]: String(value), 'aria-pressed': 'false' }, _l: {},
    getAttribute(k) { return this._a[k]; },
    setAttribute(k, v) { this._a[k] = String(v); },
    addEventListener(t, fn) { this._l[t] = fn; },
  };
}

/* A fake player: the songs, the two rows of chips, a lock screen and storage. */
function harness(stored, opts) {
  stored = stored || {};
  opts = opts || {};
  const shuffleChips = [0, 1].map((n) => chip(n, 'data-shuffle'));
  const repeatChips = ['off', 'all', 'one'].map((m) => chip(m, 'data-repeat'));
  const said = [];
  const picked = [];
  const rooms = [];
  const stepped = [];
  const media = {
    metadata: null, playbackState: '', handlers: {},
    setActionHandler(k, fn) { this.handlers[k] = fn; },
  };
  const audio = {
    paused: true, plays: 0, pauses: 0, currentTime: 0,
    play() { this.paused = false; this.plays += 1; return { catch() {} }; },
    pause() { this.paused = true; this.pauses += 1; },
  };
  const ctx = {
    Math, Number, Array, String, Object, JSON, console, isFinite,
    songs: opts.songs || [],
    ROOM: opts.room || [],
    lists: opts.lists || [],
    viewList: opts.viewList === undefined ? -1 : opts.viewList,
    current: opts.current === undefined ? -1 : opts.current,
    roomIndex: opts.roomIndex === undefined ? -1 : opts.roomIndex,
    audio,
    say(el, text) { said.push(String(text || '')); },
    $: (id) => (id === 'shuffleChips' ? { querySelectorAll: () => shuffleChips }
      : id === 'repeatChips' ? { querySelectorAll: () => repeatChips }
      : { textContent: '' }),
    selectSong: (i) => picked.push(i),
    playRoom: (i) => rooms.push(i),
    step: (d) => stepped.push(d),
    navigator: { mediaSession: media },
    window: {
      localStorage: {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null),
        setItem: (k, v) => { stored[k] = String(v); },
      },
      MediaMetadata: class { constructor(o) { Object.assign(this, o); } },
    },
  };
  vm.createContext(ctx);
  // view() lives in the playlist block on the real page; here it is the same one
  // line, defined inside the context so a bare call finds the context's globals.
  vm.runInContext('function view(){ return viewList >= 0 && lists[viewList] ? lists[viewList].items : songs; }', ctx);
  vm.runInContext(blockSource(), ctx, { filename: 'music-shuffle.js' });
  vm.runInContext(`${fnSource('nextTrack')}\n${fnSource('advanceIndex')}`, ctx, { filename: 'music-handover.js' });

  const find = (chips, attr, v) => chips.find((c) => c.getAttribute(attr) === String(v));
  return {
    ctx, stored, said, media, audio, picked, rooms, stepped,
    run: (expr) => vm.runInContext(expr, ctx),
    pressShuffle: (v) => find(shuffleChips, 'data-shuffle', v)._l.click(),
    pressRepeat: (m) => find(repeatChips, 'data-repeat', m)._l.click(),
    pressedShuffle: () => shuffleChips.filter((c) => c.getAttribute('aria-pressed') === 'true')
      .map((c) => c.getAttribute('data-shuffle')),
    pressedRepeat: () => repeatChips.filter((c) => c.getAttribute('aria-pressed') === 'true')
      .map((c) => c.getAttribute('data-repeat')),
  };
}

const SONGS = [{ key: 'a', name: 'A' }, { key: 'b', name: 'B' }, { key: 'c', name: 'C' }];

/* ---------------------------------------------------------------- the controls */

test('the player carries a shuffle row and a repeat row, off and all to start with', () => {
  assert.match(PAGE, /<div class="chips" id="shuffleChips">/, 'the shuffle row must be on the player');
  assert.match(PAGE, /<div class="chips" id="repeatChips">/, 'and the repeat row beside it');
  assert.match(PAGE, /<p class="status" id="modeStatus"/, 'with a line that says what it did');
  for (const v of ['0', '1']) assert.match(PAGE, new RegExp(`data-shuffle="${v}"`), `${v}: a shuffle chip`);
  for (const m of ['off', 'all', 'one']) assert.match(PAGE, new RegExp(`data-repeat="${m}"`), `${m}: a repeat chip`);
  const h = harness();
  assert.deepStrictEqual(h.pressedShuffle(), ['0'], 'shuffle is off until somebody says otherwise');
  assert.deepStrictEqual(h.pressedRepeat(), ['all'],
    'repeat all — which is how the player already carried on, so nothing about the old behaviour moved');
});

test('choosing shuffle and a repeat marks that one, and keeps it on the phone', () => {
  const h = harness();
  h.pressShuffle(1);
  h.pressRepeat('one');
  assert.deepStrictEqual(h.pressedShuffle(), ['1'], 'one shuffle chip lit, the other not');
  assert.deepStrictEqual(h.pressedRepeat(), ['one'], 'and one repeat chip');
  assert.strictEqual(h.stored['tsid-music-shuffle'], '1');
  assert.strictEqual(h.stored['tsid-music-repeat'], 'one');
  assert.strictEqual(h.stored['tsid-music-fade'], undefined, 'nowhere near the fade setting');
});

test('both choices are back the next time the page opens', () => {
  const h = harness({ 'tsid-music-shuffle': '1', 'tsid-music-repeat': 'off' });
  assert.deepStrictEqual(h.pressedShuffle(), ['1'], 'a kept shuffle is read on the way in');
  assert.deepStrictEqual(h.pressedRepeat(), ['off']);
  assert.strictEqual(h.run('shuffleOn'), true);
  assert.strictEqual(h.run('repeatMode'), 'off');
});

/* -------------------------------------------------------------------- repeat */

test('repeat one hands back the song that is playing, not the next one', () => {
  const h = harness({}, { songs: SONGS, current: 1 });
  h.pressRepeat('one');
  assert.strictEqual(h.run('autoNextIndex()'), 1, 'the same song comes round again');
});

test('repeat all starts the list again and repeat off stops at the end of it', () => {
  const atEnd = { songs: SONGS, current: 2 };
  assert.strictEqual(harness({}, atEnd).run('autoNextIndex()'), 0, 'all: the list starts again');
  assert.strictEqual(harness({ 'tsid-music-repeat': 'off' }, atEnd).run('autoNextIndex()'), -1,
    'off: nothing comes after the last song');
  assert.strictEqual(harness({ 'tsid-music-repeat': 'off' }, { songs: SONGS, current: 0 }).run('autoNextIndex()'), 1,
    'off still moves on in the middle of the list');
  assert.strictEqual(harness({ 'tsid-music-repeat': 'off' }, { songs: SONGS, current: 1 }).run('autoNextIndex()'), 2,
    'and up to the last one');
});

test('a one-song list repeats under "all" and ends under "off"', () => {
  const one = { songs: [{ key: 'a' }], current: 0 };
  assert.strictEqual(harness({}, one).run('autoNextIndex()'), 0, 'all: the one song plays again');
  assert.strictEqual(harness({ 'tsid-music-repeat': 'off' }, one).run('autoNextIndex()'), -1, 'off: it ends');
});

test('with nothing playing there is nothing to come next', () => {
  assert.strictEqual(harness({}, { songs: SONGS, current: -1 }).run('autoNextIndex()'), -1);
  assert.strictEqual(harness({}, { songs: [], current: -1 }).run('autoNextIndex()'), -1);
});

/* ------------------------------------------------------------------- shuffle */

test('shuffle never hands back the song that is already playing', () => {
  const h = harness({ 'tsid-music-shuffle': '1' }, { songs: SONGS, current: 0 });
  let from = 0;
  for (let i = 0; i < 60; i++) {
    const n = h.run(`stepIndex(1, ${from})`);
    assert.ok(n >= 0 && n < SONGS.length, 'always a song that is on the list');
    assert.notStrictEqual(n, from, 'never the one already playing');
    from = n;
  }
  assert.ok(h.run('history.length') > 1, 'and the path it took is kept');
});

test('Prev walks back down the path the shuffle took', () => {
  const h = harness({ 'tsid-music-shuffle': '1' }, { songs: SONGS, current: 0 });
  const a = h.run('stepIndex(1, 0)');
  const b = h.run(`stepIndex(1, ${a})`);
  assert.strictEqual(h.run(`stepIndex(-1, ${b})`), a, 'back to the song before this one');
  assert.strictEqual(h.run(`stepIndex(-1, ${a})`), 0, 'and back again to where it started');
});

test('shuffle with repeat off stops once every song has had its turn', () => {
  const h = harness({ 'tsid-music-shuffle': '1', 'tsid-music-repeat': 'off' }, { songs: SONGS, current: 0 });
  let moves = 0;
  let at = 0;
  for (;;) {
    h.run(`current = ${at}`);
    const n = h.run('autoNextIndex()');
    if (n < 0) break;
    assert.ok(moves < 5, 'and it does stop rather than going round for ever');
    at = n;
    moves += 1;
  }
  assert.strictEqual(moves, 2, 'three songs: two moves, and then the list has run out');
  assert.strictEqual(h.run('Object.keys(played).length'), 3, 'all three had their turn');
});

test('shuffle with repeat all keeps going — that list is never finished', () => {
  const h = harness({ 'tsid-music-shuffle': '1' }, { songs: SONGS, current: 0 });
  for (let i = 0; i < 20; i++) assert.notStrictEqual(h.run('autoNextIndex()'), -1);
});

test('turning shuffle on throws away the old path instead of walking it', () => {
  const h = harness({}, { songs: SONGS, current: 0 });
  h.run('history.push(2); played[2] = true');
  h.pressShuffle(1);
  assert.strictEqual(h.run('history.length'), 0);
  assert.strictEqual(h.run('Object.keys(played).length'), 0);
});

/* ------------------------------------------------------ the cross-fade hand-over */

test('the cross-fade is told one song, and the hand-over lands on that same one', () => {
  const songs = [
    { key: 'a', name: 'A', url: 'a.mp3' }, { key: 'b', name: 'B', url: 'b.mp3' },
    { key: 'c', name: 'C', url: 'c.mp3' }, { key: 'd', name: 'D', url: 'd.mp3' },
  ];
  const h = harness({ 'tsid-music-shuffle': '1' }, { songs, current: 0 });
  const first = h.run('nextTrack()');
  assert.ok(first && first.url, 'a song was chosen and there is something to play');
  assert.strictEqual(h.run('nextTrack()'), first,
    'asked again it is still that song — the one already loaded must not be swapped for another');
  const at = h.run('pendingIndex');
  assert.strictEqual(h.run(`view()[${at}]`), first, 'and the index kept points at it');
  h.run('advanceIndex()');
  assert.strictEqual(h.run('current'), at, 'the hand-over moves the player onto that song');
  assert.strictEqual(h.run('pendingIndex'), -1, 'and the pick is used once');
});

test('a cancelled cross-fade never hands a stale song to a later one', () => {
  assert.match(PAGE, /function crossStop\(\)\{[\s\S]{0,240}pendingIndex = -1;/,
    'crossStop must drop the song that was lined up');
});

/* ------------------------------------------------------------- the player wiring */

test('the end of a song asks what should follow rather than always stepping', () => {
  const at = PAGE.indexOf("audio.addEventListener('ended'");
  const ended = PAGE.slice(at, at + 260);
  assert.match(ended, /autoNextIndex\(\)/, 'the repeat setting decides what comes next');
  assert.match(ended, /goTo\(n\)/, 'and that song is what plays');
  assert.match(ended, /else \{ stopFade\(\); audio\.volume = 1; \}/,
    'with nothing to step to, the fade is undone rather than left silent');
});

test('Next steps where the shuffle says, and the room steps through its own tracks', () => {
  assert.match(PAGE, /function step\(dir\)\{[\s\S]{0,420}stepIndex\(dir, current\)/,
    'the person\'s list is stepped by stepIndex');
  assert.match(PAGE, /function step\(dir\)\{[\s\S]{0,220}stepIndex\(dir, roomIndex\)/,
    'and so is the meditation room');
  const h = harness({ 'tsid-music-shuffle': '1' }, { songs: SONGS, current: 0 });
  assert.notStrictEqual(h.run('stepIndex(1, 0)'), 0, 'and with shuffle on that is somewhere else');
});

/* ------------------------------------------------------- with the screen off */

test('the lock screen is told what is playing, with the controls on it', () => {
  const song = { key: 'a', name: 'Rain on the roof', meta: 'rain.mp3' };
  const h = harness({}, { songs: [song], current: 0 });
  h.run('mediaSessionSetup()');
  assert.ok(h.media.metadata, 'the song is handed to the phone');
  assert.strictEqual(h.media.metadata.title, 'Rain on the roof');
  assert.strictEqual(h.media.metadata.artist, 'rain.mp3');
  assert.strictEqual(h.media.metadata.album, 'All songs');
  assert.ok(Array.isArray(h.media.metadata.artwork) && h.media.metadata.artwork.length > 0,
    'with a picture, so the lock screen is not a blank box');
  for (const k of ['play', 'pause', 'nexttrack', 'previoustrack', 'seekto']) {
    assert.strictEqual(typeof h.media.handlers[k], 'function', `${k} must be on the lock screen`);
  }
  h.media.handlers.play();
  assert.strictEqual(h.audio.plays, 1, 'play on the lock screen starts the song');
  h.media.handlers.pause();
  assert.strictEqual(h.audio.pauses, 1, 'and pause stops it');
  h.media.handlers.nexttrack();
  h.media.handlers.previoustrack();
  assert.deepStrictEqual(h.stepped, [1, -1], 'back and next go through the player, not around it');
  h.run('mediaPlaying(true)');
  assert.strictEqual(h.media.playbackState, 'playing');
  h.run('mediaPlaying(false)');
  assert.strictEqual(h.media.playbackState, 'paused');
});

test('the lock screen names the list or the room it is playing from', () => {
  const room = harness({}, { room: [{ name: 'Rain', url: '/audio/meditation/rain.mp3' }], roomIndex: 0 });
  room.run('mediaSessionSetup()');
  assert.strictEqual(room.media.metadata.title, 'Rain');
  assert.strictEqual(room.media.metadata.artist, 'The meditation room');
  assert.strictEqual(room.media.metadata.album, 'The meditation room');

  const song = { key: 'a', name: 'One' };
  const list = harness({}, { songs: [song], lists: [{ name: 'Night mix', items: [song] }], viewList: 0, current: 0 });
  list.run('mediaSessionSetup()');
  assert.strictEqual(list.media.metadata.title, 'One');
  assert.strictEqual(list.media.metadata.album, 'Night mix', 'the list it came from');
});

test('every place the song changes tells the lock screen too', () => {
  assert.match(PAGE, /function selectSong\([\s\S]{0,700}mediaSessionSetup\(\);/,
    'a song picked from the list');
  assert.match(PAGE, /function playRoom\([\s\S]{0,700}mediaSessionSetup\(\);/,
    'a track picked from the room');
  assert.match(PAGE, /function advanceIndex\([\s\S]{0,900}mediaSessionSetup\(\);/,
    'and the song the cross-fade handed over to');
  assert.match(PAGE, /audio\.addEventListener\('play', onPlay = function\(\)\{[\s\S]{0,200}mediaSessionSetup\(\);/,
    'as the song starts, so the phone knows before the screen goes off');
});

test('nothing on the page stops the sound when the page is put away', () => {
  assert.ok(!/visibilitychange/.test(PAGE), 'there is no hidden-page handler to pause the player');
  assert.ok(!/document\.hidden/.test(PAGE), 'and nothing asks whether the page is being looked at');
  assert.match(PAGE, /document\.addEventListener\('click', function\(\)\{ if \(fadeSec > 0\) ensureAudio\(\); \}, true\);/,
    'the sound goes through Web Audio only once a fade has actually been chosen — which is what silences it on an iPhone with the screen off');
  assert.match(PAGE, /Array\.prototype\.forEach\.call\(fadeChips, function\(c\)\{[\s\S]{0,400}ensureAudio\(\);/,
    'and choosing the fade is the real tap that gets it');
});
