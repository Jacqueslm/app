// The player's fade between songs — 5 Oct 2026.
//
// Jacques: "add auto fade to the player so it goes to next song make it option
// 3sec 5sec 10sec". There is one <audio> element on the page, so this is not a
// cross-fade with two songs at once: the tail of the song playing comes down
// and the head of the next one comes up, so the join is a fade and not a jump.
//
// The ways this goes wrong are arithmetic, not layout — a fade that never
// reaches zero, one that starts the next song already silent and leaves it
// there, or a setting that reads as a string and makes every comparison false.
// So the block is RUN here with a fake audio element rather than read as text,
// and the volume is checked at points through the song.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'music.html'), 'utf8');

// The fade block: from its first line to the ringtone section that follows it.
function blockSource() {
  const a = PAGE.indexOf('var FADE_KEY');
  const b = PAGE.indexOf('// ── ringtone ─');
  assert.ok(a > -1, 'the fade block must be in music.html');
  assert.ok(b > a, 'and it must sit in the player, before the ringtone section');
  return PAGE.slice(a, b);
}

/* A fake player: one audio element, four chips, and storage that answers. */
function harness(stored) {
  stored = stored || {};
  const chips = [0, 3, 5, 10].map((n) => {
    const chip = {
      _a: { 'data-fade': String(n), 'aria-pressed': 'false' }, _l: {},
      getAttribute(k) { return this._a[k]; },
      setAttribute(k, v) { this._a[k] = String(v); },
      addEventListener(t, fn) { this._l[t] = fn; },
    };
    return chip;
  });
  const audio = { duration: 100, currentTime: 0, volume: 1, paused: false };
  const said = [];
  let timer = null;
  const ctx = {
    audio, Math, Number, Array, String, console, JSON,
    say(el, text) { said.push(String(text || '')); },
    $() { return { querySelectorAll() { return chips; } }; },
    window: {
      localStorage: {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null),
        setItem: (k, v) => { stored[k] = String(v); },
      },
    },
    setInterval(fn) { timer = fn; return 7; },
    clearInterval() { timer = null; },
  };
  ctx.window.setInterval = ctx.setInterval;
  ctx.window.clearInterval = ctx.clearInterval;
  ctx.chips = chips;
  ctx.said = said;
  ctx.hasTimer = () => timer !== null;
  ctx.tick = () => { if (timer) timer(); };
  vm.createContext(ctx);
  vm.runInContext(blockSource(), ctx, { filename: 'music-fade.js' });

  return {
    ctx, chips, audio, said, stored,
    run: (expr) => vm.runInContext(expr, ctx),
    fade: () => vm.runInContext('fadeSec', ctx),
    press: (sec) => {
      const chip = chips.find((c) => Number(c.getAttribute('data-fade')) === sec);
      assert.ok(chip, `there must be a ${sec}-second chip`);
      chip._l.click();
    },
    pressed: () => chips.filter((c) => c.getAttribute('aria-pressed') === 'true')
      .map((c) => Number(c.getAttribute('data-fade'))),
    /* Put the player at a point in a song and ask what the volume should be. */
    at(sec, time) {
      this.press(sec);
      this.audio.currentTime = time;
      this.run('fadeTick()');
      return this.audio.volume;
    },
  };
}

/* ---------------------------------------------------------------- the controls */

test('the four choices are on the player, and Off is what it starts on', () => {
  for (const sec of [0, 3, 5, 10]) {
    assert.match(PAGE, new RegExp(`data-fade="${sec}"`), `the ${sec}-second chip must be in the markup`);
  }
  assert.match(PAGE, /<div class="chips" id="fadeChips">/, 'and they live in one row');
  const h = harness();
  assert.strictEqual(h.fade(), 0, 'off until somebody chooses otherwise');
  assert.deepStrictEqual(h.pressed(), [0], 'and Off is the one shown as chosen');
});

test('choosing a length marks that one and only that one', () => {
  const h = harness();
  h.press(5);
  assert.strictEqual(h.fade(), 5);
  assert.deepStrictEqual(h.pressed(), [5], 'one chip lit, the other three not');
  assert.strictEqual(h.stored['tsid-music-fade'], '5', 'and it is kept on the phone');
});

test('the choice is back the next time the page opens', () => {
  const h = harness({ 'tsid-music-fade': '10' });
  assert.strictEqual(h.fade(), 10, 'a kept setting is read on the way in');
  assert.deepStrictEqual(h.pressed(), [10]);
});

/* ------------------------------------------------------------------ the fade */

test('a chosen fade comes up at the start, holds, and comes down at the end', () => {
  const h = harness();
  assert.strictEqual(h.at(10, 0), 0, 'the next song starts from silence');
  assert.strictEqual(h.at(10, 5), 0.5, 'and rises through it');
  assert.strictEqual(h.at(10, 50), 1, 'full in the middle');
  assert.strictEqual(h.at(10, 95), 0.5, 'and comes down over the last ten seconds');
  assert.strictEqual(h.at(10, 100), 0, 'reaching silence exactly at the end');
});

test('the three lengths are three different fades', () => {
  for (const sec of [3, 5, 10]) {
    const h = harness();
    assert.strictEqual(h.at(sec, 0), 0, `${sec}s: silent at the start`);
    assert.strictEqual(h.at(sec, 100), 0, `${sec}s: silent at the end`);
    assert.strictEqual(h.at(sec, 100 - sec / 2), 0.5, `${sec}s: half way through its own fade`);
    assert.strictEqual(h.at(sec, 100 - sec - 1), 1, `${sec}s: still full before the fade begins`);
  }
});

test('off means no fade at all, even in the last seconds of a song', () => {
  const h = harness();
  assert.strictEqual(h.at(0, 0), 1);
  assert.strictEqual(h.at(0, 99), 1, 'nothing is turned down when the fade is off');
});

test('a song shorter than the fade still ends at silence, not at a half volume', () => {
  // Ten seconds of fade on a six-second song: the whole song is fade-out, which
  // is the honest reading of the setting rather than a crush of the volume.
  const h = harness();
  h.press(10);
  h.audio.duration = 6;
  h.audio.currentTime = 0;
  h.run('fadeTick()');
  assert.strictEqual(h.audio.volume, 0.6, 'six seconds left of a ten second fade');
  h.audio.currentTime = 6;
  h.run('fadeTick()');
  assert.strictEqual(h.audio.volume, 0, 'and it reaches zero at the end');
});

test('a song that never reported its length is left alone rather than made silent', () => {
  const h = harness();
  h.press(5);
  h.audio.duration = Infinity;                 // a streamed m4a, as phones report it
  h.audio.currentTime = 2;
  h.run('fadeTick()');
  assert.strictEqual(h.audio.volume, 1, 'nothing is faded on a length nobody knows');
});

/* ------------------------------------------------------------------- the wiring */

test('the fade runs while a song plays and stops when it is paused', () => {
  const at = PAGE.indexOf("audio.addEventListener('play'");
  const play = PAGE.slice(at, at + 120);
  const pause = PAGE.slice(PAGE.indexOf("audio.addEventListener('pause'"), PAGE.indexOf("audio.addEventListener('pause'") + 160);
  assert.match(play, /startFade\(\)/, 'play must start the ticker');
  assert.match(pause, /stopFade\(\)/, 'pause must stop it');
  assert.match(PAGE, /if \(!fadeSec\) audio\.volume = 1;/, 'and an off fade must leave the volume alone');
});

test('the last song in a list is not left silent by its own fade', () => {
  // There is no next song to fade into, so the volume has to be put back or the
  // player would be mute until the page was reloaded.
  const at = PAGE.indexOf("audio.addEventListener('ended'");
  const ended = PAGE.slice(at, at + 260);
  assert.match(ended, /else \{ stopFade\(\); audio\.volume = 1; \}/,
    'with nothing to step to, the fade is undone');
});

test('the setting is written once, under its own key, and never sent anywhere', () => {
  const block = blockSource();
  const writes = block.match(/localStorage\.setItem\(/g) || [];
  assert.strictEqual(writes.length, 1, 'one place writes the setting');
  assert.match(block, /FADE_KEY = 'tsid-music-fade'/, 'and it has its own key, away from the songs');
  assert.ok(!/https?:\/\//.test(block), 'nothing here talks to a server');
  assert.ok(!/[^a-zA-Z]fetch\(/.test(block), 'and nothing is fetched');
});

/* ==================================================== the cross-fade, 7 Oct */
// Rebuilt the day after it shipped: one element has to go all the way to
// silence and start the next song from nothing, which heard as a dead patch in
// the middle of the music. There are two elements now — the next song comes up
// on the second one exactly as the first comes down, and when the first ends
// the second takes over without its song being restarted.

function fakeEl(id) {
  return {
    id, src: '', duration: 100, currentTime: 0, volume: 1, paused: false, ended: false,
    plays: 0,
    play() { this.paused = false; this.plays += 1; return { catch() {} }; },
    pause() { this.paused = true; },
    removeAttribute(k) { if (k === 'src') this.src = ''; },
    load() {},
  };
}

function xharness() {
  const chips = [0, 3, 5, 10].map((n) => {
    const chip = {
      _a: { 'data-fade': String(n), 'aria-pressed': 'false' }, _l: {},
      getAttribute(k) { return this._a[k]; },
      setAttribute(k, v) { this._a[k] = String(v); },
      addEventListener(t, fn) { this._l[t] = fn; },
    };
    return chip;
  });
  const els = { audio: fakeEl('audio'), xfade: fakeEl('xfade') };
  const said = [];
  let timer = null;
  let nextValue = null;
  let advances = 0;
  const counts = { render: 0, room: 0, stepped: 0 };
  const ctx = {
    Math, Number, Array, String, Object, JSON, console, isFinite,
    audio: els.audio,
    say(el, text) { said.push(String(text || '')); },
    $() { return { querySelectorAll() { return chips; }, textContent: '' }; },
    document: {
      getElementById(id) { return id === 'audio' ? els.audio : id === 'xfade' ? els.xfade : null; },
    },
    window: {
      localStorage: {
        getItem: (k) => (Object.prototype.hasOwnProperty.call({}, k) ? '' : null),
        setItem() {},
      },
    },
    setInterval(fn) { timer = fn; return 7; },
    clearInterval() { timer = null; },
    nextTrack() { return nextValue; },
    advanceIndex() { advances += 1; },
    renderPlaylist() { counts.render += 1; },
    renderRoom() { counts.room += 1; },
    step() { counts.stepped += 1; },
    fmt(n) { return String(n); },
    Promise,
  };
  vm.createContext(ctx);
  vm.runInContext(blockSource(), ctx, { filename: 'music-crossfade.js' });
  return {
    ctx, els, said, chips,
    run: (expr) => vm.runInContext(expr, ctx),
    el: (id) => els[id],
    press: (sec) => chips.find((c) => Number(c.getAttribute('data-fade')) === sec)._l.click(),
    tick: () => { if (timer) timer(); },
    hasTimer: () => timer !== null,
    next: (track) => { nextValue = track; },
    advances: () => advances,
    counts,
    installGain() {
      const made = [];
      ctx.window.AudioContext = class {
        constructor() { this.state = 'running'; this.destination = {}; }
        resume() { this.state = 'running'; return Promise.resolve(); }
        createMediaElementSource() { return { connect() {} }; }
        createGain() { const g = { gain: { value: 1 }, connect() {} }; made.push(g); return g; }
      };
      ctx.madeGains = made;
    },
  };
}

test('the next song comes up while this one comes down — no silence in the middle', () => {
  const h = xharness();
  h.press(10);
  h.next({ name: 'B', url: '/audio/meditation/b.mp3' });
  h.el('audio').duration = 100;
  h.el('audio').currentTime = 95;
  h.run('fadeTick()');
  assert.strictEqual(h.run('crossOn'), true, 'the second element joins in before the end');
  assert.strictEqual(h.el('xfade').src, '/audio/meditation/b.mp3', 'with the next song loaded');
  assert.ok(h.el('xfade').plays >= 1, 'and playing');
  assert.strictEqual(h.el('audio').volume, 0.5, 'the song playing comes down over its last ten seconds');
  assert.strictEqual(h.run('crossVol'), 0.5, 'the next song comes up by exactly as much');
  assert.strictEqual(h.el('audio').volume + h.run('crossVol'), 1,
    'so between them the level never dips below what was asked for');
});

test('when the song ends, the second element takes over instead of restarting', () => {
  const h = xharness();
  h.press(10);
  h.next({ name: 'B', url: '/audio/meditation/b.mp3' });
  h.el('audio').currentTime = 96;
  h.run('fadeTick()');
  assert.strictEqual(h.run('crossOn'), true, 'the cross-fade is under way');
  const reached = h.el('xfade').currentTime;
  assert.strictEqual(h.run('crossSwap()'), true);
  assert.strictEqual(h.run('audio'), h.el('xfade'), 'the element holding the next song is now the player');
  assert.strictEqual(h.el('xfade').paused, false, 'and that song carries on from where it had reached');
  assert.strictEqual(h.el('xfade').currentTime, reached, 'not thrown back to the start');
  assert.strictEqual(h.el('audio').paused, true, 'the finished element is stopped');
  assert.strictEqual(h.el('audio').src, '', 'and emptied, ready to carry the song after next');
  assert.strictEqual(h.run('crossOn'), false);
  assert.strictEqual(h.advances(), 1, 'the player was told which track is now on');
  assert.strictEqual(h.hasTimer(), true, 'and the fade keeps running on the new player');
});

test('seeking back out of the last seconds cancels the other song', () => {
  const h = xharness();
  h.press(10);
  h.next({ name: 'B', url: '/audio/meditation/b.mp3' });
  h.el('audio').currentTime = 95;
  h.run('fadeTick()');
  assert.strictEqual(h.run('crossOn'), true);
  h.el('audio').currentTime = 50;
  h.run('fadeTick()');
  assert.strictEqual(h.run('crossOn'), false, 'the fade is no longer under way');
  assert.strictEqual(h.el('xfade').paused, true, 'the other element is stopped');
  assert.strictEqual(h.el('xfade').src, '', 'and emptied');
});

test('with the fade off, one song at a time — the second element never joins in', () => {
  const h = xharness();
  h.press(0);
  h.next({ name: 'B', url: '/audio/meditation/b.mp3' });
  h.el('audio').currentTime = 99;
  h.run('fadeTick()');
  assert.strictEqual(h.run('crossOn'), false);
  assert.strictEqual(h.el('xfade').plays, 0, 'nothing was started on the other element');
  assert.strictEqual(h.el('audio').volume, 1, 'and nothing is turned down');
});

test('a single song has nothing to fade into, and is left alone', () => {
  const h = xharness();
  h.press(10);
  h.next(null);                     // the last song in the list
  h.el('audio').duration = 100;
  h.el('audio').currentTime = 99;
  h.run('fadeTick()');
  assert.strictEqual(h.run('crossOn'), false, 'no cross-fade begins');
  assert.strictEqual(h.el('xfade').plays, 0);
  assert.ok(h.el('audio').volume < 1, 'but the song itself still comes down to its end');
});

test('a phone that takes a gain gets the same numbers, with the element pinned at 1', () => {
  // The iPhone ignores audio.volume entirely, which is why the fade read as
  // "not working" there. The same numbers go into a Web Audio gain instead —
  // and the element is pinned at 1, so the two can never multiply and dip
  // twice as fast as asked.
  const h = xharness();
  h.installGain();
  h.run('ensureAudio()');
  assert.ok(h.run('gains["audio"]') && h.run('gains["xfade"]'), 'both elements are through the gain');
  h.press(10);
  h.next({ name: 'B', url: '/audio/meditation/b.mp3' });
  h.el('audio').duration = 100;
  h.el('audio').currentTime = 95;
  h.run('fadeTick()');
  assert.strictEqual(h.run('gains["audio"].gain.value'), 0.5, 'the gain carries the fade-out');
  assert.strictEqual(h.el('audio').volume, 1, 'the element itself is pinned at 1');
  assert.strictEqual(h.run('gains["xfade"].gain.value'), 0.5, 'and the fade-in goes into its gain too');
  assert.strictEqual(h.el('xfade').volume, 1, 'pinned at 1 as well');
});
