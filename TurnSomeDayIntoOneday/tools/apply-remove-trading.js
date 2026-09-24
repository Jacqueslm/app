#!/usr/bin/env node
/* Take the trading out of the two files the file tools cannot reach.
 *
 *   node tools/apply-remove-trading.js
 *
 * 24 Sep 2026. Jacques: "remove the trading game the desk everything about
 * trading im done." The pages themselves were deleted with plain rm:
 *
 *   desk.html, desk-assistant.js, market-maker.html, trading-school.html,
 *   tradingview/, vendor/lightweight-charts/, server/market-data.js
 *
 * and their tests and builder scripts with them. What is left is text inside
 * files too big for a hand edit - index.html is 1MB and server.js runs past the
 * window the file tools match against - so the edits live here, the same way
 * every other index.html change in this repo does.
 *
 * Safe to run more than once: each edit reports "already done" and writes
 * nothing. Each one fails loudly if its marker is missing, because a silent
 * no-op here means trading wording left on a page nobody re-reads.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EM = '\u2014';

let changed = 0;
let skipped = 0;

function edit(file, label, apply) {
  const full = path.join(ROOT, file);
  const before = fs.readFileSync(full, 'utf8');
  const after = apply(before);
  if (after === null) {
    console.log(`  already done: ${label} (${file})`);
    skipped++;
    return;
  }
  if (after === before) throw new Error(`${label}: marker found but nothing changed in ${file}`);
  fs.writeFileSync(full, after);
  console.log(`  wrote: ${label} (${file})`);
  changed++;
}

// Replace text between two markers, keeping `end`. Returns null when the
// opening marker is already gone.
function cut(text, start, end, replacement) {
  const i = text.indexOf(start);
  if (i === -1) return null;
  const j = text.indexOf(end, i);
  if (j === -1) throw new Error(`end marker not found after: ${start.slice(0, 60)}`);
  return text.slice(0, i) + replacement + text.slice(j);
}

console.log('server.js');

// The candle feed and its route. It only ever answered the desk.
edit('server/server.js', 'drop the /api/candles feed', (t) => cut(
  t,
  '// The candle feed, for the Trading Desk (/desk)',
  "app.post('/api/chat'",
  ''
));

// The route no longer looks at a picture, because nothing sends one.
edit('server/server.js', 'drop the chart-picture check', (t) => {
  const start = '  // The chart picture, if the desk attached one.';
  if (t.indexOf(start) === -1) return null;
  // The end marker is kept by cut(), so the replacement is empty - passing the
  // marker again put a second "try {" on the line and took the server down.
  const out = cut(t, start, '  try {', '');
  // And the note beside the body builder, which promised a picture.
  return out.replace(
    'including the picture, so it is the one piece of this route that\n      // has to be testable',
    'so it is the one piece of this route that has to be\n      // testable'
  );
});

console.log('index.html');

// The privacy sentence, in the in-app policy. It named the desk and a picture.
edit('index.html', 'the in-app policy stops naming the desk', (t) => {
  const old = 'processes the messages you send to Friendly, and the trading questions and chart screenshots you send from the trading desk, using its Gemini model, in order to generate the replies. Only the message itself, and a picture you attached yourself, are sent when you ask ' + EM + ' nothing else is shared, and no picture ever leaves this app unless you attach one.';
  if (t.indexOf(old) === -1) return null;
  const now = 'processes the messages you send to Friendly, using its Gemini model, in order to generate the replies. Only the message itself is sent when you ask ' + EM + ' nothing else is shared, and no picture ever leaves this app.';
  return t.replace(old, now);
});

// The three Settings rows: Trading Game, Trading School, Trading Desk.
edit('index.html', 'remove the three trading rows', (t) => cut(
  t,
  '<div class="setting-row" onclick="location.href=\'/market-maker.html\'">',
  '\n    </div>\n\n    <!-- CUSTOM LESSON PACKS',
  '\n    </div>\n\n    <!-- CUSTOM LESSON PACKS'
));

console.log('privacy.html');

edit('privacy.html', 'the public policy stops naming the desk', (t) => {
  const old = 'processes the messages you send to Friendly, and the trading questions and chart screenshots you choose to send from the trading desk, in order to generate the replies, and also checks live room posts against the moderation rules before anyone sees them. Only the message, the post, or the picture you attached yourself is sent.';
  if (t.indexOf(old) === -1) return null;
  const now = 'processes the messages you send to Friendly, in order to generate the replies, and also checks live room posts against the moderation rules before anyone sees them. Only the message, or the post, is sent.';
  return t.replace(old, now);
});

console.log('HANDOFF.md');

edit('HANDOFF.md', 'the version note says 5.2', (t) => {
  const old = 'it is now 5.1 (';
  if (t.indexOf(old) === -1) return null;
  return t.replace(old, 'it is now 5.2 (');
});

const LOG_HEAD = '## 24 Sep 2026 \u2014 the trading goes, every last piece of it (5.2)';
const LOG = `${LOG_HEAD}

Jacques: "now remove the trading game the desk everything about trading im done."

**Deleted, not hidden:** \`desk.html\`, \`desk-assistant.js\`,
\`market-maker.html\`, \`trading-school.html\`, \`tradingview/\` (both .pine
scripts), \`vendor/lightweight-charts/\` (the charting library only the desk
loaded) and \`server/market-data.js\` (the candle feed). Their six test files
went with them: \`desk\`, \`market-maker\`, \`trading-school\`, \`market-data\`,
\`tradingview-pine\` and \`chart-picture\`. Twenty-two builder scripts under
\`tools/\` went too - the desk, market and school patchers and their block files
- because they could only ever build pages that no longer exist.

**Also deleted, at the repo root:** \`tools/market-maker/\` - the original Market
Maker Warfare: \`mmw.html\`, its manual PDF and its README. It was never part of
the shipped app, but it is trading, so it went with the rest. Git history still
has it, as it has everything else deleted here.

**Out of the server:** the routes \`/market-maker.html\`, \`/school\`,
\`/school.html\`, \`/desk\`, \`/desk.html\`, \`/someday-strategy.pine\`,
\`/someday-frames.pine\` and the candle feed \`/api/candles\`, all from
\`server.js\`; the market-maker, school and desk entries from \`OPEN_PAGES\` in
\`server/private-app.js\`; the three never-cache lines from \`sw.js\`; and the
chart-picture half of \`server/ai-chat-body.js\`.

That picture matters more than the rest of the deletion. It was the only image
on any route in this app and the desk was the only thing that could attach one,
so **no route accepts an image anywhere now**. The rule it was built to keep -
a picture is never silently dropped - has nothing left to apply to.
\`server/test/ai-body.test.js\` replaces \`chart-picture.test.js\` and asserts the
image path is gone as well as that the thinking knob still matches the model
generation.

**Out of the app:** the three Settings rows (Trading Game, Trading School,
Trading Desk) in \`index.html\`, and the sentence in the in-app policy and in
\`privacy.html\` that named the trading questions and chart screenshots. Both
policies now say only the message is sent. That is the half a policy must not get
wrong, and there is a test for it. The desk's assistant prompt (\`DESK_SYS\`) is
gone with the page - four AI prompts are left: Friendly, The Key, and the herb
and tax ask boxes.

**Kept, and why:** the **Tax Centre stays**. It is a tax reference - 2026
figures, mileage, set-aside, records - and the only "trading" in it is one
deduction line about a first year of business. Not a trading page, so it was left
alone and he was told so. **The herb library stays** untouched.

**Version 5.2.** The four files moved together. Unlike /herbs, the app shell is
what changed here - the Settings rows and the in-app policy live in
\`index.html\`, which is cached - so the bump was required, or phones would keep
the old shell with rows pointing at pages that are gone.

**Tests:** 285 pass / 0 fail across 33 files. It was 476 before: the trading
tests are the difference, not tests going quiet. The 476 written into the herb
entry above was the total before this removal.

**Not verified in a browser.** There is no browser in this environment. The
checks are the suite above and \`node --check\` on the server; nothing was opened
on a phone.
`;

edit('HANDOFF.md', 'append the removal to the log', (t) => {
  if (t.includes(LOG_HEAD)) return null;
  const trimmed = t.replace(/\s*$/, '');
  return `${trimmed}\n\n${LOG}`;
});

edit('HANDOFF.md', 'note the root market-maker folder', (t) => {
  const marker = '**Out of the server:** the routes';
  if (t.indexOf(marker) === -1) return null;
  const para = '**Also deleted, at the repo root:** `tools/market-maker/` - the original\nMarket Maker Warfare: `mmw.html`, its manual PDF and its README. It was never\npart of the shipped app, but it is trading, so it went with the rest. Git\nhistory still has it, as it has everything else deleted here.\n\n';
  return t.replace(marker, para + marker);
});

// Repair: the first run of this script duplicated a "try {". Re-running the
// script skips the edit above, so the repair has to be its own step.
edit('server/server.js', 'repair the doubled try', (t) => {
  if (t.indexOf('  try {  try {') === -1) return null;
  return t.replace(/  try \{\s*try \{/g, '  try {');
});

console.log(`\n${changed} edit(s) written, ${skipped} already done`);

// --- the checks -------------------------------------------------------------
// Nothing trading may be left pointing at a file that no longer exists.
const APP = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');
const POLICY = fs.readFileSync(path.join(ROOT, 'privacy.html'), 'utf8');

const checks = [
  ['the root market-maker folder is gone', !fs.existsSync(path.join(ROOT, '..', 'tools', 'market-maker'))],
  ['server.js has no doubled try', !SERVER.includes('  try {  try {')],
  ['index.html has no trading row', !/location\.href='\/(desk|school|market-maker\.html)'/.test(APP)],
  ['index.html has no trading wording', !/Trading (Game|School|Desk)/.test(APP) && !/market maker/i.test(APP)],
  ['index.html no longer promises a picture', !/chart screenshots/.test(APP)],
  ['server.js serves no trading route', !/\/(desk|school|market-maker|someday-strategy|someday-frames|api\/candles)/.test(SERVER)],
  ['server.js no longer reads market-data', !/market-data|marketData/.test(SERVER)],
  ['server.js no longer checks a picture', !/collectImages/.test(SERVER)],
  ['privacy.html no longer promises a picture', !/trading questions and chart screenshots/.test(POLICY)],
];

// The server has to still be JavaScript. A cut in the wrong place is a
// SyntaxError, and a SyntaxError here is an app that answers nothing.
const vm = require('vm');
for (const f of ['server/server.js', 'server/ai-chat-body.js', 'server/private-app.js', 'sw.js']) {
  try {
    new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
    checks.push([`${f} still parses`, true]);
  } catch (err) {
    checks.push([`${f} still parses (${err.message})`, false]);
  }
}

let bad = 0;
for (const [what, ok] of checks) {
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}
if (bad) {
  console.error(`\n${bad} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks pass');
