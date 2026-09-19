// The desk test for the wrong-instrument fault, put into server/test/desk.test.js
// — 19 Sep 2026.
//
//   node tools/apply-desk-symbol.js [file]
//
// desk.test.js is 93KB, past what the editor can open, so the test lives as text
// in tools/desk-symbol-block.js and is spliced in here. Safe to run twice: the
// insertion is skipped when its signature test is already present.
//
// Jacques, 19 Sep 2026, with a screenshot of the desk: "the trade desk feed
// doesn't pull macros only minis add them to correctly research price points and
// fix." What the screenshot showed was worse than a gap — MGC had been answered
// with a Vanguard ETF at 281.72 and priced as gold.
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'server', 'test', 'desk.test.js');
const BLOCK = path.join(__dirname, 'desk-symbol-block.js');

const block = fs.readFileSync(BLOCK, 'utf8');
const SIGN = 'an answer that is not the contract is never priced as one';
// The test it goes before: the money test, which is where the feed card's
// point-value line is already checked.
const ANCHOR = "test('points become money only from the point value he put on the trade'";

const START = "test('an answer that is not the contract is never priced as one'";

let page = fs.readFileSync(FILE, 'utf8');
const at = page.indexOf(ANCHOR);
if (at === -1) throw new Error('the anchor test is not in ' + FILE + ' — refusing to guess');
if (page.indexOf(ANCHOR, at + 1) !== -1) throw new Error('the anchor is not unique — refusing to guess');

/* Replaced whole when it is already there, so editing the block and running this
   again lands the edit instead of stacking a second copy of the test. */
const start = page.indexOf(START);
let what;
if (start !== -1) {
  if (start > at) throw new Error('the block is after its anchor — refusing to guess');
  page = page.slice(0, start) + block + page.slice(at);
  what = 'replaced';
} else {
  page = page.slice(0, at) + block + page.slice(at);
  what = 'added';
}
if (!page.includes(SIGN)) throw new Error('the block did not land');
fs.writeFileSync(FILE, page);
console.log('desk.test.js: wrong-instrument test ' + what);
