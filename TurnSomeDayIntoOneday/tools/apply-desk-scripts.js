#!/usr/bin/env node
/* Put the two TradingView scripts on the desk, so they can be reached from the
 * app he actually carries — 23 Sep 2026.
 *
 * WHY A SCRIPT AND NOT A DIRECT EDIT: desk.html is 176KB and the file tools read
 * a truncated copy of it, so a find-and-replace anywhere past the first part of
 * the page silently fails to match. Every change to this page has gone in this
 * way.
 *
 *   node tools/apply-desk-scripts.js            # apply
 *   node tools/apply-desk-scripts.js --check    # report only
 *
 * WHY THE ROW EXISTS. He asked for an indicator and, asked where it should live,
 * said BOTH. The app's half is the desk and the practice game; the other half is
 * a script that has to get onto his TradingView chart, and until now the only way
 * to it was an address nobody had told him. Two plain links, served as text by
 * this app's own server, so a phone can select the lot and paste it into Pine
 * editor. No file to download, no other program, and nothing here posts anywhere.
 *
 * Safe to run more than once: it is skipped when the row is already on the page,
 * and the anchor is checked for uniqueness first.
 */
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'desk.html');
const CHECK = process.argv.includes('--check');

let page = fs.readFileSync(PAGE, 'utf8');
const was = page;
const before = page.length;

const ROW = `  <!-- YOUR TWO SCRIPTS.
       He asked for an indicator and said BOTH for where it lives, so the app has
       to be able to hand it over. Both addresses are served by this app as plain
       text - /someday-frames.pine is the read, /someday-strategy.pine is the same
       rules over years of bars in TradingView's own tester. Plain text on
       purpose: a .pine landing in his Downloads is a file Windows has no program
       for, and a page he can select beats a file he has to open.

       The line under them is the only instruction needed, and it is the whole of
       it: copy, paste into Pine editor, add to chart. -->
  <div class="sec">
    <div class="sec-hd">Your scripts, on your own chart</div>
    <div class="f">
      <label>Open one, select all of it, paste it into Pine editor</label>
      <div id="pinerow">
        <a class="tf" style="text-decoration:none;display:inline-block;margin:0 6px 6px 0" href="/someday-frames.pine" target="_blank" rel="noopener">The frames &mdash; the read</a>
        <a class="tf" style="text-decoration:none;display:inline-block" href="/someday-strategy.pine" target="_blank" rel="noopener">The backtest &mdash; the same rules</a>
      </div>
      <div class="feedwhy">The frames draws on the chart you are on: the word each turn earns, a wick through that closed back drawn and named as a raid, the level, the stop and the target of the frame that is live, and a panel carrying the frames above it. The backtest is the same rules in TradingView's own tester, priced at what you pay a side. Both come from this app, and neither one places a trade.</div>
    </div>
  </div>

`;

const START = '  <!-- YOUR TWO SCRIPTS.';
const ANCHOR = '  <!-- WHICH SESSION.';

// Take out any copy already on the page first, so running this again after the
// wording changes rewrites the row instead of leaving the old one standing.
const had = page.indexOf(START) >= 0;
if (had) {
  const end = page.indexOf(ANCHOR, page.indexOf(START));
  if (end === -1) throw new Error('the row has no end - refusing to guess');
  page = page.slice(0, page.indexOf(START)) + page.slice(end);
}

const at = page.indexOf(ANCHOR);
if (at === -1) throw new Error('anchor not found - refusing to guess: the session card');
if (page.indexOf(ANCHOR, at + 1) !== -1) throw new Error('anchor is not unique - refusing to guess: the session card');
page = page.slice(0, at) + ROW + page.slice(at);

// The row has to be there, whole, and both addresses have to be the ones the
// server actually serves.
for (const must of [
  'id="pinerow"',
  'href="/someday-frames.pine"',
  'href="/someday-strategy.pine"',
]) {
  if (!page.includes(must)) throw new Error('missing from the page after applying: ' + must);
}
const hrefs = page.match(/href="\/someday-[a-z]+\.pine"/g) || [];
if (hrefs.length !== 2) throw new Error('expected two script links, found ' + hrefs.length);

if (page === was) {
  console.log('desk.html: already applied, nothing written');
} else if (CHECK) {
  console.log('desk.html: would ' + (had ? 'rewrite' : 'add') + ' the two script links');
} else {
  const opens = (page.match(/\{/g) || []).length;
  const closes = (page.match(/\}/g) || []).length;
  if (opens !== closes) throw new Error('braces do not balance: ' + opens + ' open, ' + closes + ' close');
  fs.writeFileSync(PAGE, page);
  console.log('desk.html: the two script links  (' + (page.length - before) + ' bytes)');
}
