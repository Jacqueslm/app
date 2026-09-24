#!/usr/bin/env node
/* Put the wick tests into server/test/desk.test.js — 23 Sep 2026.
 *
 * Same reason as tools/apply-desk-wick.js and tools/apply-desk-study-tests.js:
 * desk.test.js is 121KB and the file tools match against a truncated read of it,
 * so an edit near the end of the file silently fails to find its anchor.
 *
 *   node tools/apply-desk-wick-tests.js
 *
 * Safe to run more than once: the block below is the last thing in the file, so
 * an older copy of it is dropped before the current one goes on, and this script
 * stays the one place these tests are written.
 */
const fs = require('fs');
const path = require('path');

const TESTS = path.join(__dirname, '..', 'server', 'test', 'desk.test.js');
const BLOCK = path.join(__dirname, 'desk-wick-tests.js');
const MARKER = '// ── the wick is not a break';

let file = fs.readFileSync(TESTS, 'utf8');
const had = file.indexOf(MARKER) >= 0;
if (had) file = file.slice(0, file.indexOf(MARKER)).replace(/\s*$/, '\n');
file = file.replace(/\s*$/, '\n') + fs.readFileSync(BLOCK, 'utf8');

// The block leans on what the file already has, and the file has to still end
// where the runner expects it to. If either is not true this is a wrong edit,
// not an edit to make.
for (const must of [
  'const FRAME_NONE = [',
  'async function loadPage(opts)',
  "assert.deepEqual(r.labels, ['HH', 'HL', 'HH', 'HL'], 'the swings he says out loud');",
  "assert.deepEqual(r.labels, ['SH', 'HL', 'HH'],",
]) {
  if (!file.includes(must)) throw new Error('missing after applying: ' + must);
}
if (file.indexOf(MARKER) === -1) throw new Error('the block did not go in');
if (file.slice(file.indexOf(MARKER) + 1).includes(MARKER)) throw new Error('the block went in twice');

fs.writeFileSync(TESTS, file);
console.log('desk.test.js: ' + (had ? 'the wick tests were rewritten' : 'the wick tests were added'));
