// The Key's questionnaire — the questions themselves.
//
// Jacques asked (11 Sep 2026) for the personal questions the page was missing:
// who raised you, married or single or divorced, kids, talents and gifts, how
// you are with other people, what you put off. They are optional and he wants
// the AI pass to read them.
//
// Two things can go wrong quietly, and neither shows up as an error on the
// screen: a question can be added without the content the key screen needs for
// it (sliders only — sliders are the ones the key is built from), and an answer
// can be offered to a person and then dropped on the way to Gemini. This file
// checks both.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'key.html'), 'utf8');

// KEY_Q is plain data - strings, arrays, numbers, no functions - so it is read
// out and evaluated as data rather than grepped line by line.
const arrayText = (PAGE.match(/const KEY_Q = (\[[\s\S]*?\n\];)/) || [])[1];
assert.ok(arrayText, 'KEY_Q must still be in key.html');
const KEY_Q = new Function(`return ${arrayText.replace(/;\s*$/, '')}`)();

// The one nested object in the file: everything from `const KEY_AREAS = {` to
// its matching brace, found by counting rather than by guessing an end line.
function sliceObject(src, marker) {
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
const AREAS = new Function(`return ${sliceObject(PAGE, 'const KEY_AREAS = {')}`)();

const byId = new Map(KEY_Q.map((q) => [q.id, q]));
const PERSONAL = (PAGE.match(/const PERSONAL = \[([^\]]*)\]/) || [])[1];

test('every question is answerable and named only once', () => {
  const seen = new Set();
  for (const q of KEY_Q) {
    assert.ok(q.id && !seen.has(q.id), `duplicate or missing id: ${JSON.stringify(q)}`);
    seen.add(q.id);
    assert.ok(q.g && q.q, `${q.id} needs a group and a question`);
    assert.ok(['scale', 'choice', 'text'].includes(q.kind), `${q.id} has kind ${q.kind}`);
    if (q.kind === 'scale') {
      assert.ok(q.lo && q.hi, `${q.id} is a slider, so both ends must be labelled`);
    }
    if (q.kind === 'choice') {
      assert.ok(Array.isArray(q.opts) && q.opts.length > 1, `${q.id} needs options`);
      for (const o of q.opts) {
        assert.ok(Array.isArray(o) && o.length === 2 && o[0] && o[1],
          `${q.id} has a malformed option: ${JSON.stringify(o)}`);
      }
    }
  }
  assert.ok(KEY_Q.length >= 29, 'the questionnaire did not shrink');
});

test('the questions he asked for are on the page', () => {
  const want = {
    status: ['married', 'together', 'single', 'divorced', 'widowed'],
    raised_by: ['both', 'one', 'kin', 'adopted', 'care', 'alone'],
    kids: ['yes', 'want', 'chosen', 'none'],
    give: null, helped: null, later: null,
  };
  for (const [id, opts] of Object.entries(want)) {
    const q = byId.get(id);
    assert.ok(q, `${id} is missing from the questionnaire`);
    assert.strictEqual(q.kind, 'choice', `${id} should be a choice, not a slider`);
    if (opts) {
      assert.deepStrictEqual(q.opts.map((o) => o[0]), opts,
        `${id} changed its options - saved answers key off these`);
    }
  }
  const talents = byId.get('talents');
  assert.ok(talents, 'talents and gifts must be asked');
  assert.strictEqual(talents.kind, 'text', 'talents is something they write');
});

test('every slider still has the content the key screen draws', () => {
  const scales = KEY_Q.filter((q) => q.kind === 'scale').map((q) => q.id);
  for (const id of scales) {
    const a = AREAS[id];
    assert.ok(a, `slider ${id} has no entry in KEY_AREAS, so the key cannot answer it`);
    for (const field of ['n', 'lock', 'turn', 'open']) {
      assert.strictEqual(typeof a[field], 'string',
        `KEY_AREAS.${id} is missing ${field}`);
    }
  }
  // And nothing in there is stale: every area with content belongs to a slider.
  for (const id of Object.keys(AREAS)) {
    assert.ok(scales.includes(id), `KEY_AREAS has ${id}, which is not a question any more`);
  }
});

test('an answer a person gives is never dropped on the way to the AI', () => {
  const choices = KEY_Q.filter((q) => q.kind === 'choice').map((q) => q.id);
  const listed = PERSONAL.match(/'([a-z_]+)'/g).map((s) => s.replace(/'/g, ''));
  for (const id of choices) {
    if (id === 'struggle') continue; // sent on its own line, as the named fight
    assert.ok(listed.includes(id),
      `${id} can be answered but is not in PERSONAL, so it never reaches the reading`);
  }
  for (const id of listed) {
    const q = byId.get(id);
    assert.ok(q, `PERSONAL names ${id}, which is not a question`);
    assert.strictEqual(q.kind, 'choice', `PERSONAL names ${id}, which is not a choice`);
  }
  // The written boxes go on their own, straight off the question list.
  assert.match(PAGE, /const KEY_TEXTS\s*=\s*KEY_Q\.filter/,
    'the written answers must come from the question list, not a second list');
  // And the two places that count what is being sent use that one list.
  const body = PAGE.slice(PAGE.indexOf('function buildMessage'), PAGE.indexOf('function whatGoesOver'));
  assert.match(body, /PERSONAL\s*\n?\s*\.map/, 'buildMessage must send the answers from PERSONAL');
  assert.match(PAGE, /\[.struggle.\].concat\(PERSONAL\)/,
    'the sentence above the button must count the same answers it sends');
  assert.ok(!/\['horrific','kids','faith','world'\]/.test(body),
    'the old hand-written list is what this replaced - it must not come back to the AI path');
});

// The key screen writes a paragraph for each answer given, out of KEY_CHOICE.
// An answer with no wording is answered and then never mentioned on the page -
// which is what happened to "Who raised you?" until it was written in.
test('the personal answers are answered back on the key screen', () => {
  // Plain data again — nested objects of single-quoted strings, no code — so it
  // is read out and evaluated as data, the same way KEY_Q is above.
  const CHOICE = new Function(`return ${sliceObject(PAGE, 'const KEY_CHOICE = {')}`)();
  for (const id of ['status', 'raised_by', 'give', 'helped']) {
    const q = byId.get(id);
    assert.ok(q && q.kind === 'choice', `${id} must still be a choice question`);
    for (const [value] of q.opts) {
      const block = (CHOICE[id] || {})[value];
      assert.ok(block && block.t && block.b,
        `${id}=${value} can be answered but the page has nothing written back for it`);
    }
  }
  // And the key screen has to ask for them, or the wording above never shows.
  assert.match(PAGE, /\['horrific','kids','status','raised_by','faith','give','helped','world'\]/,
    'the key screen must draw a response for the new answers');
});

// Jacques, 13 Sep 2026: "answered the questions turned the key nothing
// happened." Three separate faults made the button come back with nothing, and
// the shape of all three is in the head patch at the top of key.html - the
// editor that wrote it could not reach past roughly the first 60KB of a 1.3MB
// file, and the code it changes sits at the very bottom of it. Nothing else in
// this suite can see that block by running the page, so it is held here, by the
// things it has to keep doing:
//
//   1. the key counts the answers that are NOT sliders, or a person who answers
//      the personal questions and no sliders gets the empty screen back;
//   2. it says so on the line under the gauge instead of counting buttons as
//      sliders;
//   3. the put-off question has wording of its own like every other choice;
//   4. a nameless sheet keeps what it has when a name is typed on to it, and the
//      nameless copy is not left in storage behind a delete;
//   5. the name error is written where the buttons are, not at the top of a card
//      the person has already scrolled past.
test('turning the key comes back with something even with no sliders answered', () => {
  const patch = PAGE.slice(PAGE.indexOf('THE KEY: TURN IT AND SOMETHING ALWAYS COMES BACK'),
                           PAGE.indexOf('</head>'));
  assert.ok(patch.length > 500, 'the head patch is missing from key.html');

  // (1) every answer counts, not just the twelve sliders.
  assert.match(patch, /K\.answered\s*=\s*K\.sliders\s*\+\s*nonSliders\(A\)/,
    'the key must count the buttons and the boxes as answers');
  assert.match(patch, /var choices = BACK\.filter/, 'and count the answered choices');
  assert.match(patch, /var typed = KEY_TEXTS\.filter/, 'and the boxes that were typed in');

  // (2) the line under the gauge says sliders and more, not one number for both.
  assert.match(patch, /of ' \+ K\.total \+ ' sliders'/, 'the count line must name the sliders');
  assert.match(patch, /No sliders answered/, 'and have something to say with none of them');

  // (3) the put-off question, answered back on the page like the others.
  const BACK = ((patch.match(/var BACK = \[([^\]]*)\]/) || [])[1] || '')
    .replace(/'/g, '').split(',').map((s) => s.trim()).filter(Boolean);
  const later = (PAGE.match(/KEY_CHOICE\.later = \{([\s\S]*?)\n    \};/) || [])[1];
  assert.ok(later, 'KEY_CHOICE.later is missing, so "what you put off" shows nothing');
  const q = byId.get('later');
  assert.ok(q && q.kind === 'choice', 'later must still be a choice question');
  for (const [value] of q.opts) {
    assert.ok(new RegExp(`\\b${value}:\\s*\\{t:`).test(later),
      `later=${value} can be answered and has nothing written back for it`);
  }
  assert.ok(BACK.includes('later'), 'and the key screen has to draw it');

  // (4) the nameless sheet, and the copy it left behind.
  assert.match(patch, /from\.indexOf\('me\|'\) === 0 && to\.indexOf\('me\|'\) !== 0/,
    'a nameless sheet must keep its answers when a name is typed on to it');
  assert.match(patch, /delete all\[from\]/,
    'and the nameless copy must not be left in storage behind Delete my answers');

  // (5) the error where the eye is.
  assert.match(patch, /insertBefore\(err, acts\)/, 'the name error must be written above the buttons');
});
