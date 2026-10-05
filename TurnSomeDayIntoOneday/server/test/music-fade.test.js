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
