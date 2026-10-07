// The cards — the three-card draw on the Key page, 5 Oct 2026.
//
// The draw is one spread off the page's OWN Major Arcana table: the same
// twenty-two cards a birthday already draws from, so there is no second deck
// to keep in step and no set of meanings that can drift from the first. The
// failure worth guarding against is the quiet kind — a period or a card added
// to TAROT later, with no reading written for it, so the draw silently prints
// an undefined box.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'key.html'), 'utf8');

// key.html keeps TAROT as object-literal syntax (unquoted keys), so it is read
// with eval in an empty scope rather than JSON.parse. Same brace walk the
// repetition test uses, so nested objects cannot end the slice early.
function objectAt(src, marker) {
  const at = src.indexOf(marker);
  assert.ok(at >= 0, `${marker} not found`);
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) return src.slice(open, i + 1); }
  }
  throw new Error(`unbalanced ${marker}`);
}
const TAROT = eval('(' + objectAt(PAGE, 'const TAROT = {') + ')');
const TAROT_DRAW = eval('(' + objectAt(PAGE, 'const TAROT_DRAW = {') + ')');

// Everything from the positions table down to renderCards(), which is the
// draw's whole engine: the positions, the shuffled pick, and the closing lines.
const BLOCK = PAGE.slice(PAGE.indexOf('const DRAW_POS = ['), PAGE.indexOf('function renderCards()'));
assert.ok(BLOCK.includes('function drawThree'), 'the draw block must be found');

// A seeded generator, so the draw can be re-run exactly. Math.random is never
// used in the test, which is the point of drawThree taking its rand as an
// argument.
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}
// The function declaration on its own, wrapped so eval hands the function back
// rather than running it and returning undefined.
const fnText = BLOCK.slice(BLOCK.indexOf('function drawThree')).trim();
assert.ok(fnText.endsWith('}'), 'the draw block should end with the pick function');
const drawThree = eval('(' + fnText + ')');

const DRAW_POS = eval(BLOCK.slice(BLOCK.indexOf('['), BLOCK.indexOf('];') + 1));

/* ------------------------------------------------------------------ the deck */

test('the draw deals from the page\'s own Major Arcana, all twenty-two', () => {
  assert.strictEqual(Object.keys(TAROT).length, 22, 'the birthday table holds the 22');
  const missing = Object.keys(TAROT).filter((k) => !TAROT_DRAW[k]);
  assert.deepStrictEqual(missing, [], 'every card the birthday draws must have a reading');
  const extra = Object.keys(TAROT_DRAW).filter((k) => !TAROT[k]);
  assert.deepStrictEqual(extra, [], 'and the draw must not invent cards of its own');
});

test('every card says something in all three positions, and none of it is filler', () => {
  for (const [key, card] of Object.entries(TAROT_DRAW)) {
    for (const pos of ['facing', 'block', 'do']) {
      const line = card[pos];
      assert.strictEqual(typeof line, 'string', `${TAROT[key].n} has no ${pos}`);
      assert.ok(line.trim().length >= 40,
        `${TAROT[key].n}.${pos} is too thin to print: "${line}"`);
    }
  }
});

test('the draw never just repeats the card\'s own line', () => {
  // The card's line is already printed above the reading. If a position line is
  // the same sentence again, the box says the same thing twice.
  for (const [key, card] of Object.entries(TAROT_DRAW)) {
    for (const pos of ['facing', 'block', 'do']) {
      assert.notStrictEqual(card[pos], TAROT[key].line,
        `${TAROT[key].n}.${pos} repeats the card line verbatim`);
    }
  }
});

test('the three positions are the spread the page promises', () => {
  assert.deepStrictEqual(DRAW_POS.map((p) => p.k), ['facing', 'block', 'do']);
  assert.deepStrictEqual(DRAW_POS.map((p) => p.t),
    ['What you are facing', 'What is in the way', 'What to do']);
});

/* ------------------------------------------------------------- dealing them */

test('a draw is three different cards, every time', () => {
  // A spread that shows the same card twice reads as a mistake rather than as a
  // message, so the pick must be without replacement.
  const rand = seeded(7);
  const seen = {};
  for (let i = 0; i < 20000; i++) {
    const cards = drawThree(rand);
    assert.strictEqual(cards.length, 3, 'three cards');
    assert.strictEqual(new Set(cards).size, 3, `a card came up twice: ${cards}`);
    for (const c of cards) {
      assert.ok(TAROT[c], `${c} is not a card in the deck`);
      seen[c] = (seen[c] || 0) + 1;
    }
  }
  assert.strictEqual(Object.keys(seen).length, 22,
    'over enough draws every one of the twenty-two has to be reachable');
});

test('the same shuffle twice, and a different one on a different draw', () => {
  assert.deepStrictEqual(drawThree(seeded(1)), drawThree(seeded(1)),
    'a fixed shuffle has to deal the same spread, or the test above means nothing');
  const a = new Set(Array.from({ length: 40 }, (_, i) => drawThree(seeded(i + 1)).join('-')));
  assert.ok(a.size > 30, 'forty different shuffles should not collapse to a handful of spreads');
});

/* --------------------------------------------------------------- the wiring */

test('the draw is a tab on the page, and it is wired to draw', () => {
  const nav = PAGE.slice(PAGE.indexOf('<nav class="tabs"'), PAGE.indexOf('</nav>'));
  assert.match(nav, /id="tab-cards"\s+aria-selected="false"\s+data-panel="panel-cards"/,
    'the nav must offer the draw');
  assert.match(PAGE, /<section class="panel" id="panel-cards" role="tabpanel" hidden>/,
    'and its panel must start hidden like the rest');
  assert.match(PAGE, /<div class="result" id="cards-result"><\/div>/,
    'with a box to draw into');
  assert.match(PAGE, /id="btn-cards"/, 'and a button to press');
  assert.match(PAGE, /if\(id === 'tab-cards'\) renderCards\(\);/,
    'opening the tab must deal a spread');
  assert.match(PAGE, /\$\('btn-cards'\)\.addEventListener\('click'/,
    'and the button must deal a new one');
});

test('the draw is read aloud like every other tab', () => {
  const voice = PAGE.slice(PAGE.indexOf('const BARS = '), PAGE.indexOf('const ROOT = {'));
  assert.match(voice, /'panel-cards'/, 'the voice block must mount its read bar on the draw');
  assert.match(PAGE, /'panel-cards':\s*'cards-result'/, 'and read the words out of the result box');
});

test('what gets read aloud is not read twice', () => {
  // readableBlocks() takes .dt, .db AND every <p>. A paragraph nested inside
  // .db would be spoken once as part of the box and again on its own, so the
  // card's name sits outside the .db box on purpose.
  // renderCards() lives just past BLOCK's end, so the template is read from the
  // whole page rather than the engine slice.
  const one = PAGE.slice(PAGE.indexOf('const one ='), PAGE.indexOf('const names ='));
  assert.ok(one.includes('class="db"'), 'the card template must be found');
  assert.match(one, /<div class="db">\$\{c\.line\}/,
    'the reading goes straight into .db, with no paragraph nested inside it');
  assert.ok(!/<div class="db">[\s\S]{0,80}<p/.test(one),
    'a <p> inside .db would be read aloud twice');
});

test('a card box renders its number, name, own line and reading', () => {
  // The real template, not a copy of it: the slice is turned back into an
  // expression so the arrow function can be called with the page's own tables
  // in scope.
  const src = PAGE.slice(PAGE.indexOf('const one ='), PAGE.indexOf('const names ='));
  const one = eval('(' + src.replace(/^\s*const one = /, '').replace(/;\s*$/, '') + ')');
  const html = one(13, 0);
  assert.match(html, /1 &middot; What you are facing/, 'the position comes first, numbered');
  assert.match(html, /XIII<\/span>Death/, 'then the card, by numeral and name');
  assert.ok(html.includes(TAROT[13].line), 'then the card\'s own line');
  assert.ok(html.includes(TAROT_DRAW[13].facing), 'then the reading written for that position');
  assert.strictEqual((html.match(/class="db"/g) || []).length, 1, 'one text box per card');
  assert.ok(!/<div class="db">[\s\S]*?<p/.test(html), 'with no paragraph nested inside it');
});

/* -------------------------------------------------------------- the stance */

test('the draw promises nothing it cannot keep', () => {
  for (const banned of ['research', 'brain', 'chemical', 'study', 'proven', 'cure', 'diagnos']) {
    assert.ok(!BLOCK.toLowerCase().includes(banned), `the draw must not say "${banned}"`);
  }
  assert.ok(!/https?:\/\//.test(BLOCK), 'and it never sends anybody anywhere');
  assert.ok(!/[^a-zA-Z]fetch\(/.test(BLOCK), 'and it calls nothing: a draw works with no signal');
  assert.ok(!/localStorage/.test(BLOCK), 'and it stores nothing — a draw is not written down');
});

test('the draw never tells anybody they are finished', () => {
  // The app can end a floor, a day, a fight. It can never tell somebody they are
  // done — so the closing lines have to keep the door open even on the hard cards.
  const close = PAGE.slice(PAGE.indexOf('const DRAW_CLOSE = ['), PAGE.indexOf('let DRAWS = 0;'));
  for (const banned of ['too late', 'give up', 'no hope', 'you are finished', 'nothing left']) {
    assert.ok(!close.toLowerCase().includes(banned), `a closing line must not say "${banned}"`);
  }
  assert.match(close, /not a prediction|never in the cards|not a forecast/,
    'and at least one closing line has to say plainly that this is not a forecast');
});
