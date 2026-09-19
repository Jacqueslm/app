#!/usr/bin/env node
/* Put the timing-study tests into server/test/desk.test.js.
 *
 * Same reason as tools/apply-desk-study.js: desk.test.js is nearly 70KB and the
 * file tools match against a truncated read of it, so an edit near the end of
 * the file silently fails to find its anchor. Safe to run more than once — the
 * appended block replaces itself, and each edit below checks first.
 *
 *   node tools/apply-desk-study-tests.js
 */
const fs = require('fs');
const path = require('path');

const TESTS = path.join(__dirname, '..', 'server', 'test', 'desk.test.js');
const BLOCK = path.join(__dirname, 'desk-study-tests.js');
const MARKER = '// ── the timing study';

let file = fs.readFileSync(TESTS, 'utf8');
const done = [];

function edit(name, marker, oldText, newText) {
  if (file.includes(marker)) { done.push(`${name}: already there`); return; }
  if (!file.includes(oldText)) throw new Error(`${name}: could not find what to change`);
  file = file.replace(oldText, newText);
  done.push(`${name}: applied`);
}

// The page now asks its own server three times: the read, the study, and the
// assistant. What the test defends is unchanged — every one of them is this
// app's own route and no vendor is ever addressed.
edit('the list of calls',
  "'/api/candles?bars=', '/api/candles?bars=120&symbol=', '/api/chat'",
  "  assert.deepEqual(calls.sort(), ['/api/candles?bars=120&symbol=', '/api/chat'],\n    'the page calls its own server twice and nowhere else');",
  "  assert.deepEqual(calls.sort(), ['/api/candles?bars=', '/api/candles?bars=120&symbol=', '/api/chat'],\n    'the page calls its own server and nowhere else: the read, the study that counts the bars, and the assistant');");

// The log chip still answers under the review rules; the handler now picks
// between the review rules and the study rules instead of one flag.
edit('the log chip rule',
  'and it is read under them and nothing else',
  "  assert.match(html, /withTrades \\? askSystem\\(TRADE_SYS\\) : undefined/);",
  "  assert.match(html, /sys==='trade' \\? askSystem\\(TRADE_SYS\\)/, 'and it is read under them and nothing else');");

// The block below is the last thing in the file, so an older copy of it is
// dropped before the current one goes on. That keeps this script the one place
// the study's tests are written.
const at = file.indexOf(MARKER);
if (at >= 0) file = file.slice(0, at).replace(/\s*$/, '\n');
file = file.replace(/\s*$/, '\n') + fs.readFileSync(BLOCK, 'utf8');

fs.writeFileSync(TESTS, file);
console.log(at >= 0 ? 'desk.test.js updated (the study tests were rewritten):' : 'desk.test.js updated:');
for (const line of done) console.log('  ' + line);
