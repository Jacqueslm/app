// The day readings repeated themselves.
//
// Jacques, 11 Sep 2026: "audit the app for repetition" — and it was real. The
// closing line "A star is far off and still enough to steer by." appeared on
// eleven different days, "Moonlight shows the shape, not the thing." on twelve,
// and a handful of others four to eight times. The table had been filled by
// day-number pattern, so every -17 day or -18 day said the same thing.
//
// 98 days were rewritten with a line about that day, and a second pass took the
// twenty lines that were still doing duty on three days each. This test holds
// the line the other way: no line in the day table may appear on more than two
// days, so the next pass that fills the table by pattern fails here instead of
// on somebody's birthday.
//
// tools/repeat-sweep.js prints the whole picture, across both pages.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'key.html'), 'utf8');

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
const DAYS = JSON.parse(objectAt(PAGE, 'const DAYS = {'));

// `m` is the period metadata — "Capricorn I — The Week of the Ruler · Earth ·
// Cardinal · 1 Sun · The Magician" — and days inside one week are supposed to
// share it. Everything else in a record is prose about that day.
const META = new Set(['t', 'm']);
const norm = (s) => s.toLowerCase()
  .replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9' ]+/g, ' ')
  .replace(/\s+/g, ' ').trim();

const seen = new Map();
for (const [day, record] of Object.entries(DAYS)) {
  for (const [field, value] of Object.entries(record)) {
    if (META.has(field) || typeof value !== 'string' || value.length < 40) continue;
    const key = norm(value);
    if (!seen.has(key)) seen.set(key, { days: [], field, value });
    seen.get(key).days.push(day);
  }
}

test('no line in the day readings is used on more than two days', () => {
  const over = [...seen.values()].filter((e) => e.days.length > 2)
    .sort((a, b) => b.days.length - a.days.length);
  assert.deepStrictEqual(over.map((e) => `${e.days.length}x [${e.field}] ${e.value.slice(0, 70)}`), [],
    'a line is doing duty for too many days — write one for each day, the way tools/repeat-sweep.js lists them');
  assert.ok(seen.size > 500, `sanity: the day table holds the prose (saw ${seen.size} lines)`);
});

test('the lines that were doing the most duty are gone', () => {
  // The twelve and eleven and ten times over, named so a revert is not silent.
  const retired = [
    // The twelve, eleven and ten times over.
    'Moonlight shows the shape, not the thing.',
    'A star is far off and still enough to steer by.',
    'The lightning finds what was already leaning.',
    'The right amount is a skill, not a compromise.',
    "The hand on the lion is gentle. That's why it works.",
    "The scale doesn't weigh the one holding it.",
    'Constant low tension. Daily release rather than occasional intensity.',
    'Hard solo effort suits you. Something with intensity and nobody in it.',
    'Your own program, held for years. Anything imposed dies within a fortnight.',
    // And the ones that were on three days apiece.
    'The lamp is for finding the way back too.',
    "Court's closed. You're still sitting there.",
    "Court's closed. You're the only one still sitting there.",
    'Elaborate plan, skipped daily version. The daily one is the only one that survives.',
    'Slow and steady. Force does nothing and never has.',
    "Your body registers it first and it's the more reliable witness.",
    'The critical voice is a habit rather than the truth. It got installed and it can be removed.',
    "You believe it balances out, and that belief is holding up more than you've noticed.",
    'You size it correctly. Trust it more, because your judgment runs ahead of your nerve.',
    'Truth and timing are two skills. Same words, better hour, different outcome.',
    'Careful and rarely wrong. Size up, because your caution exceeds what your judgment requires.',
    'Stress lands in your gut and sleep. Usually a situation rather than anything physical.',
    'Flat then a jump. Judge over years rather than concluding from the flat part.',
    "You'll talk yourself into it. One person whose explicit job is to say no.",
    "Show your working. What's obvious to you is invisible to everyone else.",
    'You talk them through, and it works well enough that you\'ve never needed another method.',
    'Your own program, held for years. Anything imposed dies within a fortnight.',
  ];
  for (const line of retired) {
    const hits = [...seen.values()].filter((e) => e.value === line).reduce((n, e) => n + e.days.length, 0);
    assert.strictEqual(hits, 0, `"${line.slice(0, 50)}…" is back, on ${hits} days`);
  }
});

test('every day still says something in every slot it said something in before', () => {
  // The rewrite replaced values, never removed them: a blank line in the table
  // would show up as a hole in the reading rather than as a repetition.
  const FIELDS = ['t', 'd', 'lo', 'mo', 'fa', 'em', 'fr', 'mi', 'bo', 'sp',
                  'wk', 'ri', 'ou', 'st', 'we', 'ad', 'cl', 'm'];
  for (const [day, record] of Object.entries(DAYS)) {
    for (const field of FIELDS) {
      assert.strictEqual(typeof record[field], 'string',
        `${day} has no ${field} any more`);
      assert.ok(record[field].trim().length > 0, `${day}.${field} is empty`);
    }
  }
});
