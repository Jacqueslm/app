// The cards — the reading on the Key page. Rebuilt 14 Oct 2026.
//
// Jacques: "why the cards don't read like a tarot reading it's short and it
// should be read like a professional tarot reader and they should only be
// chosen based on birthday relationships and destiny by asking a few key
// questions and what a person is going through or what they are seeking."
//
// Both faults were real, and they were the same fault. The old draw dealt
// three cards at random, for nobody in particular, and printed one line under
// each — shorter than the card's own entry in the birthday table, and
// answerable by pressing the button again. So this file holds the new shape
// of the thing rather than the old one, and what it guards is exactly what
// can rot quietly:
//
//   · a card added to TAROT with a reading missing, which prints an empty box
//   · a position reading that quietly becomes one line again
//   · arithmetic that is supposed to be somebody else's published method
//     (Greer's personality and soul card) drifting off it
//   · a deal that stops being reproducible, or that deals the same card twice,
//     or that forgets the card that stands for the querent
//   · a reading that looks complete on screen and is missing a whole part of
//     itself — the opening, the synthesis, the destiny layer, the close
//   · the stance: never a prediction, never a pronoun for somebody who is not
//     in the room, never a suggestion to stop a treatment
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'key.html'), 'utf8');

// key.html keeps its tables as object-literal syntax (unquoted keys), so they
// are read with eval in an empty scope rather than JSON.parse. Same brace walk
// the repetition test uses, so nested objects cannot end the slice early.
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
function arrayAt(src, marker) {
  const at = src.indexOf(marker);
  assert.ok(at >= 0, `${marker} not found`);
  const open = src.indexOf('[', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (!depth) return src.slice(open, i + 1); }
  }
  throw new Error(`unbalanced ${marker}`);
}

const TAROT = eval('(' + objectAt(PAGE, 'const TAROT = {') + ')');
const TAROT_DRAW = eval('(' + objectAt(PAGE, 'const TAROT_DRAW = {') + ')');
const DRAW_POS = eval(arrayAt(PAGE, 'const DRAW_POS = ['));
const ASK_AREA = eval(arrayAt(PAGE, 'const ASK_AREA = ['));
const ASK_THRU = eval(arrayAt(PAGE, 'const ASK_THRU = ['));
const ASK_SEEK = eval(arrayAt(PAGE, 'const ASK_SEEK = ['));
const DRAW_CLOSE = eval(arrayAt(PAGE, 'const DRAW_CLOSE = ['));

// Everything from the questions down to renderCards(), which is the whole
// engine: the four tables, the destiny arithmetic, the seeded deal and the
// composition. The listeners below it are not part of any of that.
const ENGINE = PAGE.slice(PAGE.indexOf('const ASK_AREA = ['),
  PAGE.indexOf("$('btn-cards').addEventListener"));
assert.ok(ENGINE.includes('function renderCards()'), 'the engine block must be found');

/* ----------------------------------------------------------- running it for real
   The reading is composed, not printed, so the only honest way to check it is
   to run the page's own renderCards() against a stand-in screen and read what
   comes back. Nothing here re-implements the engine: the text is the page's. */
const els = {};
const el = (id) => (els[id] = els[id] || { id, value: '', textContent: '', innerHTML: '' });
const oneLiner = (name) => {
  const m = PAGE.match(new RegExp(`const ${name} = [^\\n]*`));
  assert.ok(m, `const ${name} must stay a one-liner in the page`);
  return eval('(' + m[0].replace(new RegExp(`^const ${name} = `), '').replace(/;\s*$/, '') + ')');
};
const pageFn = (name) => {
  const m = PAGE.match(new RegExp(`function ${name}\\([^\\n]*`));
  assert.ok(m, `function ${name} must stay a one-liner in the page`);
  return eval('(' + m[0] + ')');
};

const engine = new Function('ctx',
  'const { TAROT, NUMBERS, MONTHS, DIM, esc, firstName, $, reduceNum, digitSum } = ctx;\n'
  + ENGINE
  + '\nreturn { renderCards, cdAsk, cdDestiny, cdSeed, dealCards, cdPattern, birthCards,'
  + ' personalYear, bondCard, seedFrom, rngFrom, cdWhoRow, prepareCards };')({
  TAROT,
  NUMBERS: eval('(' + objectAt(PAGE, 'const NUMBERS = {') + ')'),
  MONTHS: eval(arrayAt(PAGE, 'const MONTHS = [')),
  DIM: eval(arrayAt(PAGE, 'const DIM = [')),
  esc: oneLiner('esc'),
  firstName: oneLiner('firstName'),
  $: el,
  reduceNum: pageFn('reduceNum'),
  digitSum: pageFn('digitSum')
});

// Fill in the questions the way the screen would, draw, and hand back both the
// cards and the text of the reading.
function askAndRead(answers) {
  for (const key of Object.keys(els)) els[key].value = '';
  el('cards-result').innerHTML = '';
  el('cd-err').textContent = '';
  for (const [id, value] of Object.entries(answers)) el(id).value = value;
  const ask = engine.cdAsk();
  const cards = engine.renderCards();
  return { ask, cards, html: els['cards-result'].innerHTML, err: els['cd-err'].textContent };
}
const READING = {
  'cd-name': 'Jacques', 'cd-month': '4', 'cd-day': '7', 'cd-year': '1979',
  'cd-who': 'me', 'cd-area': 'love', 'cd-thru': 'stuck', 'cd-seek': 'clarity'
};
const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ the deck */

test('the reading deals from the page\'s own Major Arcana, all twenty-two', () => {
  assert.strictEqual(Object.keys(TAROT).length, 22, 'the birthday table holds the 22');
  const missing = Object.keys(TAROT).filter((k) => !TAROT_DRAW[k]);
  assert.deepStrictEqual(missing, [], 'every card the birthday draws must have a reading');
  const extra = Object.keys(TAROT_DRAW).filter((k) => !TAROT[k]);
  assert.deepStrictEqual(extra, [], 'and the reading must not invent cards of its own');
});

test('every card says something in all four places, and none of it is filler', () => {
  // Four, not three: the fourth is what the card means as the thing two
  // birthdays make between them, which is the whole of the pair layer.
  for (const [key, card] of Object.entries(TAROT_DRAW)) {
    for (const pos of ['facing', 'block', 'do', 'bond']) {
      const line = card[pos];
      assert.strictEqual(typeof line, 'string', `${TAROT[key].n} has no ${pos}`);
      // He asked for a reading rather than a line. Anything under this is the
      // one-line version creeping back, which is what this file exists for.
      const floor = pos === 'bond' ? 150 : 200;
      assert.ok(line.trim().length >= floor,
        `${TAROT[key].n}.${pos} is too thin to print at ${line.trim().length} characters: "${line}"`);
    }
  }
});

test('no position just repeats the card\'s own line', () => {
  // The card's line is already printed above the reading. If a position line is
  // the same sentence again, the box says the same thing twice.
  for (const [key, card] of Object.entries(TAROT_DRAW)) {
    for (const pos of ['facing', 'block', 'do', 'bond']) {
      assert.notStrictEqual(card[pos], TAROT[key].line,
        `${TAROT[key].n}.${pos} repeats the card line verbatim`);
    }
  }
});

test('the three positions are the spread the page promises', () => {
  assert.deepStrictEqual(DRAW_POS.map((p) => p.k), ['facing', 'block', 'do']);
  assert.deepStrictEqual(DRAW_POS.map((p) => p.t),
    ['What you are facing', 'What is in the way', 'What to do']);
  // Each one opens with the reader saying where that question sits, which is
  // what separates three cards out loud rather than running them together.
  for (const p of DRAW_POS) assert.ok(p.lead && p.lead.length > 30, `${p.t} has no lead`);
});

/* --------------------------------------------------------- the five questions */

test('the questions a reader asks before dealing are all on the page', () => {
  for (const [name, list] of [['area', ASK_AREA], ['going through', ASK_THRU], ['seeking', ASK_SEEK]]) {
    assert.ok(list.length >= 6, `only ${list.length} answers for ${name} — the reader needs range`);
    const seen = new Set();
    for (const a of list) {
      assert.ok(a.v && a.t && a.open, `${name} answer ${JSON.stringify(a)} is not complete`);
      assert.ok(!seen.has(a.v), `${name} has two answers called ${a.v}`);
      seen.add(a.v);
    }
  }
  // The birthday, and who the reading is about, are the other two questions.
  assert.match(PAGE, /<label for="cd-month">Birth month<\/label>/);
  assert.match(PAGE, /<label for="cd-day">Day<\/label>/);
  assert.match(PAGE, /<label for="cd-who">Who is it about\?<\/label>/);
  assert.match(PAGE, /<label for="cd-area">What is the reading about\?<\/label>/);
  assert.match(PAGE, /<label for="cd-thru">What are you going through\?<\/label>/);
  assert.match(PAGE, /<label for="cd-seek">What are you seeking\?<\/label>/);
});

test('every answer has all four jobs, or it is decoration', () => {
  // t is the label, open is said in the opening paragraph, bridge is said
  // against each of the three cards (which is what makes the same card prose
  // land differently for love than for money), and hold/close is handed back
  // at the end. An answer missing one of them is a dropdown that changes
  // nothing.
  for (const a of ASK_AREA) {
    assert.ok(a.hold && a.hold.length > 40, `area ${a.v} hands nothing back at the end`);
    for (const pos of ['facing', 'block', 'do'])
      assert.ok(a.bridge && a.bridge[pos] && a.bridge[pos].length > 60,
        `area ${a.v} has no bridge for ${pos}`);
    assert.equal(new Set(Object.keys(a.bridge)).size, 3, `area ${a.v} has a bridge for something else`);
  }
  for (const a of ASK_THRU) assert.ok(a.close && a.close.length > 40, `${a.v} has no closing line`);
  for (const a of ASK_SEEK) assert.ok(a.close && a.close.length > 40, `${a.v} hands back no step`);
  // The other person's birthday is only asked for when the reading is about two.
  assert.match(PAGE, /<div id="cd-two" hidden/, 'their birthday starts off the screen');
  assert.match(ENGINE, /two\.hidden = \$\('cd-who'\)\.value !== 'two'/,
    'and it shows when the reading is about the two of them');
});

/* ------------------------------------------------------- the destiny arithmetic */

test('the birth cards are Greer\'s method, on her own worked examples', () => {
  // April 7 1969: 7 + 4 + 1969 = 1980, 1+9+8+0 = 18 the Moon, 1+8 = 9 the
  // Hermit. This is the example Biddy Tarot publishes for the method.
  const moon = engine.birthCards(4, 7, 1969);
  assert.deepStrictEqual([moon.per, moon.soul], [18, 9], 'April 7 1969 is the Moon and the Hermit');
  assert.strictEqual(TAROT[moon.per].n, 'The Moon');
  assert.strictEqual(TAROT[moon.soul].n, 'The Hermit');
  // January 1 1979: 1 + 1 + 1979 = 1981, then 19, and 19 keeps its whole chain
  // 19 - 10 - 1: the Sun, the Wheel and the Magician.
  const chain = engine.birthCards(1, 1, 1979);
  assert.deepStrictEqual(chain.chain, [19, 10, 1], 'the three-card chain must survive');
  assert.strictEqual(chain.per, 19);
  assert.strictEqual(chain.soul, 1);
  assert.deepStrictEqual(chain.chain.map((n) => TAROT[n].n),
    ['The Sun', 'The Wheel of Fortune', 'The Magician']);
  // 22 is the Fool here as it is everywhere else on this page, and its digits
  // give the Emperor — the pairing Greer writes about.
  const fool = engine.birthCards(1, 5, 1969);
  assert.strictEqual(fool.per, 22, '5 + 1 + 1969 = 1975, and 1+9+7+5 = 22');
  assert.strictEqual(TAROT[fool.per].n, 'The Fool');
  assert.strictEqual(fool.soul, 4, 'the Fool and the Emperor');
  // No other method is mixed in: every date gives one of the twenty-two.
  for (let m = 1; m <= 12; m++) {
    for (const d of [1, 7, 14, 22, 29, 31]) {
      const b = engine.birthCards(m, d, 1969);
      assert.ok(TAROT[b.per] && TAROT[b.soul], `${m}/${d} gave no card`);
      assert.ok(b.per >= 1 && b.per <= 22, `${m}/${d} gave card ${b.per}`);
    }
  }
});

test('the year number is the birth month and day plus this year\'s digits', () => {
  const digits = (n) => String(n).split('').reduce((a, c) => a + (+c), 0);
  const reduce = (n) => { while (n > 9) n = digits(n); return n; };
  const year = new Date().getFullYear();
  for (const [m, d] of [[7, 14], [1, 1], [12, 31], [4, 7]]) {
    const expected = reduce(m + d + digits(year));
    assert.strictEqual(engine.personalYear(m, d), expected, `${m}/${d} in ${year}`);
    assert.ok(engine.personalYear(m, d) >= 1 && engine.personalYear(m, d) <= 9,
      'the year number is one of the nine');
  }
});

test('the card two birthdays make between them adds up and cuts back by 22', () => {
  assert.strictEqual(engine.bondCard(18, 9), 5, '27 comes back as the Hierophant');
  assert.strictEqual(engine.bondCard(12, 9), 21, 'the published example comes out the World');
  assert.strictEqual(engine.bondCard(11, 11), 22, 'and 22 is the Fool, not nothing');
  assert.strictEqual(engine.bondCard(22, 21), 21, '43 cuts back once');
  assert.strictEqual(engine.bondCard(22, 22), 22, '44 cuts back to the Fool');
  for (const a of Object.keys(TAROT).map(Number)) {
    for (const b of Object.keys(TAROT).map(Number)) {
      const n = engine.bondCard(a, b);
      assert.ok(TAROT[n], `${a} + ${b} gave ${n}, which is not a card`);
    }
  }
});

/* ------------------------------------------------------------- dealing them */

test('a deal is three different cards, and always includes the significator', () => {
  // A spread that shows the same card twice reads as a mistake rather than as a
  // message. And the card that stands for the querent is on the table every
  // time, which is where a reader puts the significator — otherwise the
  // birthday is decoration and the reading is the old random draw again.
  const seen = {};
  const places = [0, 0, 0];
  for (let sig = 1; sig <= 22; sig++) {
    for (let seed = 0; seed < 400; seed++) {
      const cards = engine.dealCards(sig, (seed * 2654435761) >>> 0);
      assert.strictEqual(cards.length, 3, 'three cards');
      assert.strictEqual(new Set(cards).size, 3, `a card came up twice: ${cards}`);
      assert.ok(cards.includes(sig), `the significator ${sig} was not dealt: ${cards}`);
      for (const c of cards) {
        assert.ok(TAROT[c], `${c} is not a card in the deck`);
        seen[c] = (seen[c] || 0) + 1;
      }
      places[cards.indexOf(sig)] += 1;
    }
  }
  assert.deepStrictEqual(seen && Object.keys(seen).length, 22,
    'over enough deals every one of the twenty-two has to be reachable');
  assert.ok(places.every((n) => n > 0),
    `the significator must be able to land in all three positions, saw ${places}`);
});

test('the same question deals the same spread, and a different one deals another', () => {
  const base = { month: 4, day: 7, year: 1979, who: 'me', area: 'love', thru: 'stuck', seek: 'clarity', two: null };
  const seed = engine.cdSeed(base);
  assert.strictEqual(seed, engine.cdSeed(base), 'the same answers must make the same seed');
  assert.deepStrictEqual(engine.dealCards(18, seed), engine.dealCards(18, seed),
    'the same seed must deal the same spread, or nothing else here means anything');
  // Change one answer and the cards have to change with it — that is the whole
  // promise on the page now, and it is the opposite of the old shuffle.
  const spreads = new Set();
  for (const area of ASK_AREA.map((a) => a.v)) {
    for (const thru of ASK_THRU.map((a) => a.v)) {
      for (const seek of ASK_SEEK.map((a) => a.v)) {
        const s = engine.cdSeed(Object.assign({}, base, { area, thru, seek }));
        spreads.add(engine.dealCards(18, s).join('-'));
      }
    }
  }
  assert.ok(spreads.size > 150,
    `216 different questions should not collapse to ${spreads.size} spreads`);
  assert.ok(engine.cdSeed(Object.assign({}, base, { who: 'two', two: { month: 10, day: 14, year: 1988 } })) !== seed,
    'the other person\'s birthday has to enter the deal as well');
});

/* -------------------------------------------------------------- the reading */

test('a reading has every part of itself, and it is a reading, not a line', () => {
  const { cards, html, err } = askAndRead(READING);
  assert.strictEqual(err, '', 'a birthday and four answers is a complete question');
  assert.strictEqual(cards.length, 3);
  const text = textOf(html);
  // The parts, in order: the opening that names the question, the three cards,
  // the synthesis, the destiny layer, the close, the pull.
  assert.match(text, /This reading is about the love in your life, and the person you are with/,
    'the opening has to name the question in the querent\'s words');
  assert.match(text, /taken a stretch where you cannot see the way through/,
    'and it has to name what they said they were going through');
  assert.match(text, /you are after a clear picture of what is actually going on/,
    'and what they said they were seeking');
  assert.match(html, /What you are facing/);
  assert.match(html, /What is in the way/);
  assert.match(html, /What to do/);
  assert.strictEqual((html.match(/class="dp"/g) || []).length, 3, 'exactly three cards');
  assert.match(html, /<h4>What the three say together<\/h4>/);
  assert.match(html, /<h4>Your card, and the year you are in<\/h4>/);
  assert.match(html, /<h4>Where this leaves you<\/h4>/);
  assert.match(html, /class="pull epigram"/, 'and the pull that says what this is not');
  assert.match(html, /class="note"/, 'and the note that says where the words came from');
  // Depth. The old draw was about 120 words in total; a reading that comes back
  // under this floor has gone back to being a line under each card.
  const words = text.split(/\s+/).filter(Boolean).length;
  assert.ok(words >= 550, `the reading is ${words} words — that is the short version coming back`);
  // And the person's own card is named in the destiny paragraph, with the year.
  const myCard = TAROT[engine.cdDestiny(engine.cdAsk()).mine.per].n;
  assert.ok(text.includes(myCard), `the reading has to name the birth card, ${myCard}`);
  assert.ok(/number-\d year for you/.test(text), 'and the year number it is running at');
});

test('every card in the reading is read in the position it landed in', () => {
  // Not just present: the paragraph under each position has to be the one
  // written for that card in that position, or the spread is decoration.
  const { cards, html } = askAndRead(READING);
  DRAW_POS.forEach((pos, i) => {
    const c = cards[i];
    assert.ok(html.includes(TAROT[c].n), `${TAROT[c].n} is not printed`);
    assert.ok(html.includes(TAROT_DRAW[c][pos.k]),
      `${TAROT[c].n} is not read as "${pos.t}" — the wrong position text is under it`);
  });
  assert.ok(!html.includes('<div class="db">undefined'), 'a missing reading prints undefined');
  assert.ok(!/undefined|NaN/.test(html), 'and nothing anywhere else comes out undefined');
});

test('a reading about two people reads the card they make between them', () => {
  const two = Object.assign({}, READING, {
    'cd-who': 'two', 'cd-name': 'Ada', 'cd2-name': 'Sam',
    'cd2-month': '10', 'cd2-day': '14', 'cd2-year': '1988'
  });
  const { cards, html } = askAndRead(two);
  const D = engine.cdDestiny(engine.cdAsk());
  assert.ok(cards.includes(D.bond), 'the relationship card is the significator for this kind of reading');
  assert.match(html, /<h4>What the two of you make between you<\/h4>/);
  assert.ok(html.includes(TAROT_DRAW[D.bond].bond), 'and its own reading is printed');
  assert.match(textOf(html), /Ada has The .+ and Sam has The /, 'both birthdays have to be named');
  // The one-person reading must not grow a pair layer it has no business in.
  const one = askAndRead(READING);
  assert.ok(!one.html.includes('What the two of you make between you'),
    'a reading about one person has no pair layer');
});

test('a reading with no birthday is refused rather than guessed', () => {
  // There is no fallback date and there must not be one: the deal is seeded by
  // the birthday, so a reading without one is not a reading.
  const none = askAndRead({ 'cd-month': '', 'cd-day': '', 'cd-area': 'love', 'cd-thru': 'stuck', 'cd-seek': 'clarity' });
  assert.strictEqual(none.cards, null, 'nothing is dealt without a birthday');
  assert.strictEqual(none.html, '', 'and nothing is drawn');
  assert.match(none.err, /birthday/i, 'and the screen says why');
  const half = askAndRead(Object.assign({}, READING, { 'cd-who': 'two', 'cd2-month': '', 'cd2-day': '' }));
  assert.strictEqual(half.cards, null, 'a reading about two needs both birthdays');
  assert.match(half.err, /their month and day/i);
});

test('the same question twice gives the same reading, word for word', () => {
  const first = askAndRead(READING);
  const second = askAndRead(READING);
  assert.strictEqual(second.html, first.html, 'the reading must be reproducible end to end');
  const changed = askAndRead(Object.assign({}, READING, { 'cd-seek': 'pattern' }));
  assert.notDeepStrictEqual(changed.cards, first.cards,
    'and changing one answer has to deal different cards');
});

test('the reading says it is not a prediction, in the words of a reader', () => {
  const { html } = askAndRead(READING);
  const text = textOf(html);
  assert.match(text, /not a prediction|not a forecast/, 'the stance has to be on the reading itself');
  // The close hands the question back rather than issuing a verdict.
  const close = ENGINE.slice(ENGINE.indexOf('const DRAW_CLOSE = ['), ENGINE.indexOf('function birthCards'));
  assert.ok(close.length > 200, 'the closing lines must be found');
  for (const banned of ['too late', 'give up', 'no hope', 'you are finished', 'nothing left']) {
    assert.ok(!close.toLowerCase().includes(banned), `a closing line must not say "${banned}"`);
  }
  assert.ok(DRAW_CLOSE.length >= 5, 'and there are several, so two readings do not end the same way');
});

/* ------------------------------------------------------------------ the wiring */

test('the reading is a tab on the page, and it is wired to read', () => {
  const nav = PAGE.slice(PAGE.indexOf('<nav class="tabs"'), PAGE.indexOf('</nav>'));
  assert.match(nav, /id="tab-cards"\s+aria-selected="false"\s+data-panel="panel-cards"/,
    'the nav must offer the cards');
  assert.match(PAGE, /<section class="panel" id="panel-cards" role="tabpanel" hidden>/,
    'and its panel must start hidden like the rest');
  assert.match(PAGE, /<div class="result" id="cards-result"><\/div>/,
    'with a box to draw into');
  assert.match(PAGE, /id="btn-cards"/, 'and a button to press');
  assert.match(PAGE, /if\(id === 'tab-cards'\) prepareCards\(\);/,
    'opening the tab must set the questions up');
  assert.match(PAGE, /\$\('btn-cards'\)\.addEventListener\('click'/,
    'and the button must read the cards');
  assert.match(ENGINE, /function prepareCards\(\)/, 'the setup has to exist');
  // The birthday has to start UNCHOSEN. A dropdown that defaults to the first
  // of January deals a reading for somebody who was never asked for a date,
  // and does it silently — which is exactly what this guards.
  assert.match(ENGINE, /<option value="">Choose month<\/option>/, 'the month must start unchosen');
  assert.match(ENGINE, /<option value="">Choose day<\/option>/, 'and so must the day');
  assert.match(ENGINE, /const cur = sel\.value \|\| '';/, 'and the fill must keep that');
  // The five questions are dropdowns, because the page never reads what is
  // typed: the birthday and a name are the only boxes on this tab.
  for (const id of ['cd-area', 'cd-thru', 'cd-seek', 'cd-who']) {
    assert.match(PAGE, new RegExp(`<select id="${id}"`), `${id} must be a dropdown`);
  }
});

test('the reading is read aloud like every other tab', () => {
  const voice = PAGE.slice(PAGE.indexOf('const BARS = '), PAGE.indexOf('const ROOT = {'));
  assert.match(voice, /'panel-cards'/, 'the voice block must mount its read bar on the reading');
  assert.match(PAGE, /'panel-cards':\s*'cards-result'/, 'and read the words out of the result box');
  // The questionnaire is not the reading, and reading it out would bury the
  // reading itself under a list of options.
  assert.match(PAGE, /const SKIP = '\.askform/, 'the questions must be held back from the read-aloud');
  assert.match(PAGE, /<div class="card askform">/, 'and they must be in the box that is held back');
  // The question text sits in a dropdown's option, and the reader walks the
  // screen — so the form has to be the only thing carrying .askform.
  assert.strictEqual((PAGE.match(/class="[^"]*askform/g) || []).length, 1,
    'exactly one box is the questionnaire');
});

test('what gets read aloud is not read twice', () => {
  // readableBlocks() takes .dt, .db AND every <p>. A paragraph nested inside
  // .db would be spoken once as part of the box and again on its own, so the
  // card's name sits outside the .db box on purpose.
  const one = ENGINE.slice(ENGINE.indexOf('const one ='), ENGINE.indexOf('const opening ='));
  assert.ok(one.includes('class="db"'), 'the card template must be found');
  assert.match(one, /<div class="db">\$\{pos\.lead\} \$\{c\.line\}/,
    'the reading goes straight into .db, with no paragraph nested inside it');
  assert.ok(!/<div class="db">[\s\S]{0,80}<p/.test(one),
    'a <p> inside .db would be read aloud twice');
  assert.strictEqual((one.match(/class="db"/g) || []).length, 1, 'one text box per card');
});

test('a card box renders its number, name, own line and reading', () => {
  // The real template, not a copy of it: the slice is turned back into an
  // expression so the arrow function can be called with the page's own tables
  // in scope.
  const src = ENGINE.slice(ENGINE.indexOf('const one ='), ENGINE.indexOf('const opening ='));
  // Just the arrow function: the slice runs on to the comment above the next
  // const, and a stray comment inside the parentheses is a syntax error.
  const fn = src.slice(0, src.lastIndexOf('};') + 1).replace(/^\s*const one = /, '');
  // Called the way renderCards calls it, with the page's own tables and the
  // chosen area in scope, so what is checked is the template that ships.
  const one = new Function('TAROT', 'TAROT_DRAW', 'DRAW_POS', 'area', 'return (' + fn + ')')
    (TAROT, TAROT_DRAW, DRAW_POS, ASK_AREA[0]);
  const html = one(13, 0);
  assert.match(html, /1 &middot; What you are facing/, 'the position comes first, numbered');
  assert.match(html, /XIII<\/span>Death/, 'then the card, by numeral and name');
  assert.ok(html.includes(TAROT[13].line), 'then the card\'s own line');
  assert.ok(html.includes(TAROT_DRAW[13].facing), 'then the reading written for that position');
  assert.ok(html.includes(ASK_AREA[0].bridge.facing), 'and the sentence that ties it to the question');
  assert.strictEqual((html.match(/class="db"/g) || []).length, 1, 'one text box per card');
  assert.ok(!/<div class="db">[\s\S]*?<p/.test(html), 'with no paragraph nested inside it');
});

/* ------------------------------------------------------------------- the stance */

test('the reading promises nothing it cannot keep', () => {
  for (const banned of ['research', 'brain', 'chemical', 'study', 'proven', 'cure', 'diagnos']) {
    assert.ok(!ENGINE.toLowerCase().includes(banned), `the engine must not say "${banned}"`);
  }
  assert.ok(!/https?:\/\//.test(ENGINE), 'and it never sends anybody anywhere');
  assert.ok(!/[^a-zA-Z]fetch\(/.test(ENGINE), 'and it calls nothing: a reading works with no signal');
  assert.ok(!/localStorage/.test(ENGINE), 'and it stores nothing — a reading is not written down');
  // The same rules have to hold on what the person actually reads, not only on
  // the source: a banned word could arrive from a table this file never saw.
  const { html } = askAndRead(READING);
  const text = textOf(html).toLowerCase();
  for (const banned of ['research', 'brain', 'chemical', 'study', 'proven', 'cure', 'diagnos']) {
    assert.ok(!text.includes(banned), `the printed reading must not say "${banned}"`);
  }
  // No card orders anybody out of a treatment, and the one that touches health
  // says whose call that is.
  assert.match(ASK_AREA.filter((a) => a.v === 'health')[0].bridge.do, /not a treatment/,
    'the health reading must say a card is not a treatment');
});

test('a reading never decides who somebody is', () => {
  // The deck has no gender in it and nobody in this app gets one.
  const { html } = askAndRead(READING);
  const text = textOf(html);
  assert.doesNotMatch(text, /\b(she|her|hers|herself)\b/i, 'the reading writes somebody as "she"');
  assert.doesNotMatch(text, /\b(he|him|his)\b/i, 'the reading writes somebody as "he"');
  // And no reading tells a person they are finished, on the hard cards or any
  // other. The app can end a floor, a day, a fight; it can never end a person.
  for (const card of Object.keys(TAROT_DRAW)) {
    const all = Object.values(TAROT_DRAW[card]).join(' ').toLowerCase();
    for (const banned of ['too late', 'give up', 'no hope', 'nothing left', 'you are finished', 'beyond saving']) {
      assert.ok(!all.includes(banned), `${TAROT[card].n} says "${banned}"`);
    }
  }
});
