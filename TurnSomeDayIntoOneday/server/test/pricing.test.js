// What is free and what is Pro, as of 1 Sep 2026.
//
// Jacques: "all lessons free ... leave friendly and rooms as they are not
// free ... nothing for friendly cost me money."
//
// FREE: every lesson day 1-90 on every track, the Spiritual Path, Together,
//       all ninety floors of 2AM, and every tool.
// PRO:  Friendly and the live rooms. Exactly two things.
//
// This file exists because the promise is made in eighteen different places -
// the plans screen, the guide bot, the AI's own pricing block - and a paywall
// that has been removed in code but is still advertised in copy is worse than
// one that was never removed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const APP = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SRV = fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');
const ROOMS = fs.readFileSync(path.join(ROOT, 'server', 'rooms.js'), 'utf8');

test('no lesson day is behind a paywall', () => {
  assert.match(APP, /const FREE_LESSON_CAP=90;/,
    'the cap must reach the end of the programme');
  // the gate is `day > FREE_LESSON_CAP`, so a 90-day track can never trip it
  assert.match(APP, /return !S\.isPro&&day>FREE_LESSON_CAP;/);
});

test('nothing in the app still advertises lessons as Pro', () => {
  // Sixteen places said "Days 16-90" on 1 Sep. A paywall removed in code but
  // still promised in copy reads as a bait and switch.
  assert.doesNotMatch(APP, /16[–-]90/,
    'copy still sells lesson days 16-90 as Pro');
  assert.doesNotMatch(APP, /the first 15 days of every pack are free/i);
  assert.doesNotMatch(APP, /unlock the rest of the 90-Day Bootcamp/i);
});

test('the AI is told the truth about pricing', () => {
  // It answers "what do I get with Pro" out loud, so a stale line here is a
  // false statement to a paying customer.
  assert.match(APP, /PRO is exactly two things - Friendly[\s\S]{0,80}live community rooms/);
  assert.match(APP, /never tell anyone a lesson day is behind Pro/);
  assert.match(APP, /never withhold a lesson, never call a lesson day a paid extra/);
});

test('the guide bot answers Pro with two things, not three', () => {
  const faq = APP.match(/\{q:'What do I get with Pro\?'[\s\S]*?\},/)[0];
  assert.match(faq, /Two things, and that's it/);
  assert.match(faq, /every lesson day 1 to 90 on every track/i);
  assert.doesNotMatch(faq, /16[–-]90/);
});

test('Friendly stays Pro, and free means zero chats', () => {
  // Jacques: "no 3 free nothing for friendly cost me money." It is the one
  // feature with a real per-message bill, so there is no free allowance at all.
  assert.match(APP, /const FREE_CHAT_DAILY_LIMIT=0;/);
  assert.match(SRV, /const FREE_CHAT_LIMIT = 0;/);
  assert.match(SRV, /const PRO_CHAT_LIMIT = 30;/);
});

test('the live rooms stay Pro, and the server is what enforces it', () => {
  assert.match(ROOMS, /function requirePro\(req, res\) \{[\s\S]*?billing\.getBillingStatus\(user\)\.isPro/,
    'the rooms gate must check billing server-side');
  assert.match(ROOMS, /proRequired: true/);
  assert.match(APP, /The live rooms are Pro\./);
});

test('the crisis door is never priced', () => {
  // The one rule that outranks all of the above.
  assert.match(APP, /the SOS set, breathing, Talk me through it and 988 are always free and never behind a paywall/);
});
