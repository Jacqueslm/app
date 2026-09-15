// The daily AI answer ceiling, and the day it counts on.
//
// On 15 Sep 2026 CHAT_LIMIT went from 0 (no ceiling at all) to 60, and the day
// the count is kept against moved from UTC midnight to midnight Pacific. Both
// are the kind of thing that quietly reverts: 0 looks harmless in a diff, and
// todayUTC() is the obvious helper to reach for when adding a route. Neither
// failing would show up as an error anywhere - the AI would simply answer more
// times than the key allows, and the first symptom would be the app going quiet
// for strangers.
//
// The reason for Pacific is not decoration. Google's requests-per-day quota
// resets at midnight Pacific and is counted per project; a day that started at
// UTC midnight would fit two app days inside one of Google's, so the ceiling
// would hand out the allowance twice as fast as it refills.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('there is a daily AI ceiling, and it is a sane number', () => {
  const m = SRC.match(/const CHAT_LIMIT = Number\(process\.env\.CHAT_LIMIT \|\| (\d+)\)/);
  assert.ok(m, 'CHAT_LIMIT must still default to a number, not to nothing');
  const limit = Number(m[1]);
  assert.ok(limit > 0, 'a ceiling of 0 means no ceiling - the runaway this exists to stop');
  assert.ok(limit >= 20 && limit <= 500,
    `60 is the chosen number: invisible to a person in crisis, fatal to a retry loop. Found ${limit}.`);
});

test('the reference pages have their own ceiling, not a share of the conversation', () => {
  const m = SRC.match(/const REF_CHAT_LIMIT = Number\(process\.env\.REF_CHAT_LIMIT \|\| (\d+)\)/);
  assert.ok(m, 'the herb library and tax centre must draw on their own budget');
  const ref = Number(m[1]);
  const chat = Number(SRC.match(/const CHAT_LIMIT = Number\(process\.env\.CHAT_LIMIT \|\| (\d+)\)/)[1]);
  assert.ok(ref > 0 && ref < chat, `the reference budget (${ref}) must exist and be smaller than the conversation's (${chat})`);

  // Run the real function rather than trusting the shape of the source: the
  // default has to be the conversation, because that is the budget that must
  // never be quietly spent by another page.
  const body = SRC.match(/function chatBudget\(surface\) \{[\s\S]*?\n\}/)[0];
  const make = new Function('REF_CHAT_LIMIT', 'CHAT_LIMIT', 'chatDay',
    body + '\nreturn chatBudget;');
  const budget = make(ref, chat, () => '2026-09-15');

  assert.deepEqual(budget(undefined), { reference: false, limit: chat, key: '2026-09-15' });
  assert.deepEqual(budget('friendly'), { reference: false, limit: chat, key: '2026-09-15' });
  assert.deepEqual(budget('reference'), { reference: true, limit: ref, key: '2026-09-15:ref' });
  // Same day, two rows: neither surface can spend the other's allowance.
  assert.notEqual(budget('friendly').key, budget('reference').key);
});

test('every chat count is kept on Google quota day, not UTC day', () => {
  assert.doesNotMatch(SRC, /todayUTC/, 'the UTC day helper is gone - do not bring it back for chat counts');
  // The day is only ever turned into a storage key inside chatBudget, and every
  // count is read and written through that key - so no route can count a chat
  // against the wrong budget, or against a day of its own invention.
  assert.doesNotMatch(SRC, /getChatCount\(req\.userId, chatDay\(\)\)/, 'reads go through the budget');
  assert.doesNotMatch(SRC, /incrementChatCount\(req\.userId, chatDay\(\)\)/, 'writes go through the budget');
  assert.match(SRC, /getChatCount\(req\.userId, budget\.key\)/);
  assert.match(SRC, /incrementChatCount\(req\.userId, budget\.key\)/);
  const calls = SRC.match(/chatDay\(\)/g) || [];
  assert.equal(calls.length, 3, 'the definition plus the two keys chatBudget builds from it');
});

test('chatDay rolls over at midnight Pacific, both sides of daylight saving', () => {
  const fmt = SRC.match(/new Intl\.DateTimeFormat\('en-CA', \{ timeZone: '([^']+)' \}\)/);
  assert.ok(fmt, 'chatDay must be an explicit time zone, never the server\'s own clock');
  assert.equal(fmt[1], 'America/Los_Angeles', 'Google counts the day on Pacific time - so must this');
  // Evaluate the same expression the server runs, rather than trusting the name.
  const day = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date(iso));
  assert.equal(day('2026-09-15T05:00:00Z'), '2026-09-14', '5am UTC is still 10pm the previous day in California (PDT)');
  assert.equal(day('2026-01-15T05:00:00Z'), '2026-01-14', 'and 5am UTC is 9pm the previous day in PST');
  assert.equal(day('2026-09-15T07:00:00Z'), '2026-09-15', 'the count starts again at midnight Pacific');
});
