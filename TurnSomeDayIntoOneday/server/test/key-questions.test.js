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
