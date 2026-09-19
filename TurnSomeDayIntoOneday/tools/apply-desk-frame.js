#!/usr/bin/env node
/* Put the frame read into desk.html.
 *
 * WHY A SCRIPT AND NOT A DIRECT EDIT: desk.html is over 130KB and the file
 * tools read a truncated copy of it, so a find-and-replace anywhere past the
 * first part of the page silently fails to match - the same reason the study
 * (tools/apply-desk-study.js) and the Zodiacs player went in this way. Safe to
 * run more than once: every step checks whether its change is already there.
 *
 *   node tools/apply-desk-frame.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'desk.html');
const BLOCK = path.join(__dirname, 'desk-frame-block.js');

const eol = String.fromCharCode(10);
const nl = (lines) => lines.join(eol);

let page = fs.readFileSync(PAGE, 'utf8');
const before = page;
const done = [];

function once(name, marker, apply) {
  if (page.includes(marker)) { done.push(`${name}: already there`); return; }
  const next = apply(page);
  if (next === page) throw new Error(`${name}: could not find what to change`);
  page = next;
  done.push(`${name}: applied`);
}

// 1. The card. The desk reads its own chart, and the read sits with the chart it
//    came from so the two can be looked at together.
once('the frame card', 'id="frOut"', (p) => {
  const anchor = '  <!-- WHICH SESSION.';
  const at = p.indexOf(anchor);
  if (at < 0) return p;
  const card = nl([
    '  <!-- THE FRAME.',
    '       The desk reads its own chart the way the script on his TradingView chart',
    '       reads it, so the assistant knows the frame instead of being told it, and',
    '       so the two can be held against each other on the same bars.',
    '',
    '       His rules, as numbers: a new LOWER LOW on the frame turns the frame down',
    '       and sets two things - the level, which is the swing high the drop came',
    '       from, and the frame low, which is that lower low. Only a CLOSE above the',
    '       level cancels it; a poke above it changes nothing. On the step below, the',
    '       small chart is read for higher highs with the last higher low still',
    '       holding, and a close under that low ends the hold.',
    '',
    '       A cancelled frame shows no price at all. A level from hours ago sitting',
    '       beside a live price reads as nonsense - that was his own complaint on the',
    '       chart - so the frame is dropped and the page says so instead. -->',
    '  <div class="sec">',
    '    <div class="sec-hd">The frame, off the same candles</div>',
    '    <div class="f">',
    '      <label>Frame (sets the level)</label>',
    '      <div class="tfpick" id="frTf">',
    '        <span class="tf" id="ftf-15m" data-ftf="15m">15m</span>',
    '        <span class="tf" id="ftf-1h" data-ftf="1h">1h</span>',
    '        <span class="tf" id="ftf-4h" data-ftf="4h">4h</span>',
    '      </div>',
    '      <div id="frOut"></div>',
    '      <div class="feedwhen" id="frWhen">No candles loaded, so there is no frame to read.</div>',
    '      <div class="feedwhy">A frame is down when the bars of the frame make a lower low. The level is the swing high that drop came from - the lower high you would short back to - and the frame low is that lower low. Only a close above the level cancels it; a wick does not. The small chart is the step below the frame, read on its own bars. This says wait most of the time, and wait is a complete answer.</div>',
    '    </div>',
    '  </div>',
    '',
    '',
  ]);
  return p.slice(0, at) + card + p.slice(at);
});

// 2. The code: the frame, the small chart, the page painter and the block the
//    assistant reads. Inserted ahead of the study so it sits with the structure
//    code it is built on.
once('the frame code', 'function frameRead()', (p) => {
  const anchor = '/* ---------- study the timing';
  const at = p.indexOf(anchor);
  if (at < 0) return p;
  const block = fs.readFileSync(BLOCK, 'utf8');
  return p.slice(0, at) + block + eol + p.slice(at);
});

// 3. The frame is painted whenever the candles are, so it can never be showing a
//    read off bars that have been dropped.
once('the frame is painted with the feed', nl(['  drawChart();', '  paintFrame();']), (p) => {
  const old = nl(['function paintFeed(){', '  paintStructure();', '  paintChartTf();', '  drawChart();']);
  const fresh = nl(['function paintFeed(){', '  paintStructure();', '  paintChartTf();', '  drawChart();', '  paintFrame();']);
  return p.includes(old) ? p.replace(old, fresh) : p;
});

// 4. Every question carries the frame, the same way it carries the structure.
once('the frame in every question', 'feedText()+structureText()+frameText()', (p) => {
  const old = '+feedText()+structureText()+';
  const fresh = '+feedText()+structureText()+frameText()+';
  return p.includes(old) ? p.replace(old, fresh) : p;
});

// 5. The house rules name the frame block, so the verdict may be repeated - and
//    never become a promise.
once('the house rules name the frame', 'THE FRAME BLOCK', (p) => {
  const anchor = "'WHAT YOU NEVER DO',";
  const at = p.indexOf(anchor);
  if (at < 0) return p;
  // Double-quoted in the page, because the sentences carry apostrophes and the
  // rest of that array is single-quoted - a bare apostrophe there is a broken
  // string and a page that will not load at all.
  const words = nl([
    '"THE FRAME BLOCK is the script on his chart run on this page\'s own candles: the level, the frame low, whether the frame has been cancelled, whether the small chart has turned up, and a verdict that is only ever wait, short or long scalp. Quote it as his own rules worked out on these bars, and name the timeframe it read.",',
    '"- Never turn that verdict into a promise, a probability or a target, never supply a level when the block shows none, and do not apologise for wait - it is the answer most of the time and it is a complete answer.",',
    '"",',
  ]);
  return p.slice(0, at) + words + eol + p.slice(at);
});

once('rule 9 names the frame', 'the frame block and the STUDY block are the only basis', (p) => {
  const old = "'9. The structure block, the session block and the STUDY block are the only basis you have for structure and for timing.";
  const fresh = "'9. The structure block, the session block, the frame block and the STUDY block are the only basis you have for structure and for timing.";
  return p.includes(old) ? p.replace(old, fresh) : p;
});

// 6. The frame's timeframe, picked the same way the chart's is.
once('the frame timeframe picker', "closest('#frTf .tf')", (p) => {
  const old = nl([
    "  var ctf=t.closest?t.closest('#chTf .tf'):null;",
    "  if(ctf){ setChartTf(ctf.getAttribute('data-ctf')); return }",
  ]);
  const fresh = old + eol + nl([
    "  var frtf=t.closest?t.closest('#frTf .tf'):null;",
    "  if(frtf){ setFrameTf(frtf.getAttribute('data-ftf')); return }",
  ]);
  return p.includes(old) ? p.replace(old, fresh) : p;
});

// 7. And it opens painted, on the timeframe he last read.
once('the frame is painted on open', nl(['paintChartTf();', 'paintFrameTf();']), (p) => {
  const old = nl(['paintChartTf();', '', '/* The chart block remembers itself']);
  const fresh = nl(['paintChartTf();', 'paintFrameTf();', '', '/* The chart block remembers itself']);
  return p.includes(old) ? p.replace(old, fresh) : p;
});

// 8. The frame's own sentence when there is nothing to read. A frame with no
//    lower low in it is a real read of a market that has not made the pattern,
//    while ok=false is the bars not coming back - the page says which of the two
//    it is instead of leaving the general sentence up, which read as though a
//    frame were sitting there.
once('the no-frame sentence', 'No frame read: ', (p) => {
  const old = nl([
    '  if(!r.ok){',
    "    when.textContent='No frame on the '+r.tf+' bars that came back: '+r.why+'.';",
    '    return;',
    '  }',
  ]);
  const fresh = nl([
    '  /* Nothing to read and nothing to do are two different things: a frame with no',
    '     lower low in it is a real read of a market that has not made the pattern,',
    '     while !ok is the bars not coming back at all. Both say which one it is',
    '     rather than leaving a blank where an answer goes. */',
    '  if(!r.lowerLow){',
    "    when.textContent='No frame read: '+r.why+'.';",
    '    return;',
    '  }',
  ]);
  return p.includes(old) ? p.replace(old, fresh) : p;
});

// 9. And the lines of the desk's own tests that the file tools can no longer
//    reach: that assertion message carried an apostrophe inside a single-quoted
//    string, which does not compile, and the test file is now past the size they
//    read whole. Same fix, same reason, kept here so it is reproducible.
const TESTS = path.join(ROOT, 'server', 'test', 'desk.test.js');
const APOSTROPHE = String.fromCharCode(39);
let tests = fs.readFileSync(TESTS, 'utf8');
const broken = 'and the frame' + APOSTROPHE + 's timeframe is picked on the page';
const mended = 'and its timeframe is picked on the page';
//    ...and the assertion that names the blocks the assistant may read structure
//    and timing from, which now includes the frame block.
const oldRule = 'the session block and the STUDY block are the only basis you have for structure and for timing';
const newRule = 'the session block, the frame block and the STUDY block are the only basis you have for structure and for timing';
let mendedTests = tests;
if (mendedTests.includes(broken)) mendedTests = mendedTests.split(broken).join(mended);
if (mendedTests.includes(oldRule)) mendedTests = mendedTests.split(oldRule).join(newRule);
if (mendedTests !== tests) {
  fs.writeFileSync(TESTS, mendedTests);
  done.push('the test lines: applied');
} else {
  done.push('the test lines: already there');
}

if (page === before) {
  console.log('Nothing to do - the frame read is already in desk.html.');
} else {
  fs.writeFileSync(PAGE, page);
  console.log('desk.html updated:');
}
for (const line of done) console.log('  ' + line);
