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
  // The birthday reading is everything the page drew into #result — the crest
  // and the day layer live outside #reading-full, so the root cannot be that.
  assert.match(BLOCK, /panel-read'\)\{[\s\S]*?getElementById\('result'\)/,
    'the reading tab must be read from #result, crest and all');
});

// Jacques, 15 Oct 2026: "the read it to me doesn't work here ... the whole app
// not just specific sections." It was a whitelist of class names, and a
// whitelist can only ever hold the sections whoever wrote it remembered: the
// three-books block, both pull blocks, the strengths and weaknesses under the
// day's name and the crest's own chips were none of them in it, so a reading
// was read with holes in it and the button still looked like it had worked.
test('the reading is read whole, not in the sections somebody listed', () => {
  // It walks the screen. No list of classes to fall behind the page.
  assert.match(BLOCK, /querySelectorAll\(\'\*\'\)|harvest\(/, 'the reader must walk the screen');
  assert.ok(!/'h2, h3, h4,/.test(BLOCK),
    'the class whitelist is what skipped whole sections — it must not come back');
  // The sections it used to skip are not held back by name anywhere.
  const skip = BLOCK.match(/const SKIP = '([^']*)'/);
  assert.ok(skip, 'the reader must name what it leaves out, in one place');
  for (const cls of ['.pull', '.books', '.tags', '.chip', '.epigram', '.db', '.legend']) {
    assert.ok(!skip[1].includes(cls), `${cls} is a section of a reading, not a hedge — it must be read`);
  }
  // And the four things it does leave out are the four that are not reading.
  for (const cls of ['.disclaim', '.note', '.tools', '.voicebar', '[hidden]']) {
    assert.ok(skip[1].includes(cls), `${cls} must stay out of the read`);
  }
  // The short version and the long one are never both read.
  assert.match(BLOCK, /\[hidden\]/, 'a hidden layer has to be dropped, or both versions get read');
  // Inline children are part of their sentence, and the pieces are spaced, or a
  // label against its value comes out as one word to a voice.
  assert.match(BLOCK, /const BLOCKTAG/, 'the reader must know a block from a sentence');
  assert.match(BLOCK, /const words = function/, 'and join the pieces of a line with spaces');
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
