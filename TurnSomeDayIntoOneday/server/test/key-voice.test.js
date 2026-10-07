// The voice, on every screen of the Key — 13 Sep 2026.
//
// Jacques: "add voice all the way through the horoscope app — it only reads for
// birthday nothing else." It was true. Read it to me read the birthday reading
// and The Key, and the other five tabs had no button at all.
//
// The failure this file guards against is the quiet kind: a tab added later with
// no read bar, so the voice covers six screens out of seven and nobody notices
// until somebody presses the wrong button. The voice block lives in the HEAD of
// key.html (it has to run after the page's own script, which is at the bottom of
// a 1.3MB file), so these read it as text and check it still answers for every
// tab the nav offers.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'key.html'), 'utf8');

// The block added on 13 Sep 2026, from its comment to the end of its script.
const MARK = 'THE VOICE, ON EVERY SCREEN';
const at = PAGE.indexOf(MARK);
const BLOCK = at === -1 ? '' : PAGE.slice(at, PAGE.indexOf('</script>', at));

// Every tab the nav offers.
const PANELS = [...PAGE.matchAll(/data-panel="(panel-[a-z]+)"/g)].map((m) => m[1]);
// The two screens that already carried their own bar in the markup.
const OWN_BAR = ['panel-read', 'panel-key'];

test('the voice block is there, in the head, and waits for the page script', () => {
  assert.ok(at > -1, 'the voice block must be in key.html');
  assert.match(BLOCK, /DOMContentLoaded/,
    'it runs from the head, so it has to wait for the body script to finish');
  // The page's own script is the last one in the file; the block has to sit
  // before it and wait, never after it and hope.
  assert.ok(at < PAGE.lastIndexOf('<script>'), 'and it has to come before the page script');
});

test('every tab has a way to be read aloud', () => {
  assert.ok(PANELS.length >= 7, `found only ${PANELS.length} tabs — the nav has more`);
  const bars = BLOCK.match(/const BARS = \[([^\]]*)\]/);
  assert.ok(bars, 'the block must list the tabs it mounts a bar on');
  const mounted = [...bars[1].matchAll(/'(panel-[a-z]+)'/g)].map((m) => m[1]);
  for (const panel of PANELS) {
    assert.ok(OWN_BAR.includes(panel) || mounted.includes(panel),
      `${panel} has no read bar — the voice would cover every tab but that one`);
  }
});

test('the voice reads whichever tab is open, and its own words', () => {
  // The root has to be chosen from the OPEN panel. Reading a hidden one aloud
  // is worse than reading nothing, and it is what a fixed container would do.
  assert.match(BLOCK, /querySelector\('\.panel:not\(\[hidden\]\)'\)/,
    'the block must find the open panel rather than a fixed container');
  // Every mounted tab needs a line in the map, or its bar reads an empty screen.
  const root = BLOCK.match(/const ROOT = \{([\s\S]*?)\};/);
  assert.ok(root, 'the block must say which box on each tab holds the words');
  for (const panel of ['panel-people', 'panel-pair', 'panel-matrix', 'panel-game', 'panel-wheel']) {
    assert.ok(root[1].includes(`'${panel}'`), `${panel} is missing from the read map`);
  }
  // The birthday reading is the one screen with two versions of itself.
  assert.match(BLOCK, /simple-box/, 'the short version has to be readable too');
});

test('the bar it mounts is the same bar, not a second design', () => {
  assert.match(BLOCK, /data-act="speak"/, "it must carry the page's own speak button");
  assert.match(BLOCK, /data-act="stop"/, 'and a stop button');
  assert.match(BLOCK, /class="voice-pick"/, 'and the voice picker, so the choice is one choice');
  assert.match(BLOCK, /speak-btn/, 'labelled by the page, so Pause lands on every bar at once');
});

test('an empty screen says so instead of doing nothing', () => {
  assert.match(BLOCK, /Nothing here to read yet/,
    'an empty People list must not answer a button press with silence');
  assert.match(BLOCK, /speakLabel\('Read it to me'\)/, 'and the label has to go back afterwards');
  assert.match(BLOCK, /const pageSpeech = speakReading;/, 'the new one wraps the page original rather than replacing the engine');
});

test('no medical claim, and the copy is the app\'s own', () => {
  for (const banned of ['research', 'brain', 'chemical', 'study', 'proven', 'cure']) {
    assert.ok(!BLOCK.toLowerCase().includes(banned), `the voice block must not say "${banned}"`);
  }
});
