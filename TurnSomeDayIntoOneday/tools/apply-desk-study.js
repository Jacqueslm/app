#!/usr/bin/env node
/* Put the timing study into desk.html.
 *
 * WHY A SCRIPT AND NOT A DIRECT EDIT: desk.html is over 110KB and the file
 * tools read a truncated copy of it, so a find-and-replace anywhere past the
 * first part of the page silently fails to match. The same thing happened with
 * index.html (986KB) and the Zodiacs player, and both went in this way. Safe to
 * run more than once: every step below checks whether its change is already
 * there and skips it.
 *
 *   node tools/apply-desk-study.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'desk.html');
const BLOCK = path.join(__dirname, 'desk-study-block.js');
const B = String.fromCharCode(92); // a backslash, spelled this way so nothing below has to be escaped twice

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

// 1. The study itself: the code, the page painter, the loader, and the block
//    the assistant reads. Inserted ahead of the session-window code so the
//    whole study sits together in the script, after the structure code it uses.
once('the study code', 'function studyFacts()', (p) => {
  const anchor = '/* The session window, kept on this device.';
  const at = p.indexOf(anchor);
  if (at < 0) return p;
  const block = fs.readFileSync(BLOCK, 'utf8');
  return p.slice(0, at) + block + '\n' + p.slice(at);
});

// 2. The chip, next to the other question chips.
once('the study chip', 'data-sys="study"', (p) => {
  const anchor = '<span class="chip" data-q="Read me the candles you have: what are the four timeframes doing, and what do they agree on?">What does the feed say?</span>';
  const at = p.indexOf(anchor);
  if (at < 0) return p;
  const chip = '\n      <span class="chip" data-q="Read me the timing study: what my own bars did at my levels, how far the retraces came back, how long the holds lasted, and how much of the day is made inside my window. Then the one thing to change." data-sys="study">Study my timing</span>';
  return p.slice(0, at + anchor.length) + chip + p.slice(at + anchor.length);
});

// 3. That chip answers under its own rules, the way the journal chip does.
once('the chip rules', "sys==='study'", (p) => {
  const old = [
    '    /* The log chip answers under the review rules: they are the only place',
    '       the trade record is allowed to be read from. */',
    "    var withTrades = ch.getAttribute('data-sys')==='trade';",
    "    ask(ch.getAttribute('data-q'), withTrades ? askSystem(TRADE_SYS) : undefined);",
  ].join('\n');
  const fresh = [
    '    /* Two chips answer under their own rules: the trade record is read under',
    '       the review rules, and the study under the study rules. Every other chip',
    "       answers under the desk's own rules. */",
    "    var sys=ch.getAttribute('data-sys');",
    "    ask(ch.getAttribute('data-q'), sys==='trade' ? askSystem(TRADE_SYS) : (sys==='study' ? askSystem(STUDY_SYS) : undefined));",
  ].join('\n');
  return p.includes(old) ? p.replace(old, fresh) : p;
});

// 4. Every question gets the study, the same way it gets the structure read.
once('the study in every question', "studyText()+'", (p) => {
  const old = "+sessionText()+'" + B + "n" + B + "n'+tradesText()";
  const fresh = "+sessionText()+'" + B + "n'+studyText()+'" + B + "n'+tradesText()";
  return p.includes(old) ? p.replace(old, fresh) : p;
});

// 5. The house rules name the study, so a count from it can be quoted — and it
//    is still not a backtest and never becomes one.
once('rule 1 names the study', 'no backtest result, and no study of your own', (p) => {
  const old = 'no statistic, no win rate, no study, no backtest result. The ONLY numbers you may quote are the ones in the CANDLES block below, which came from the feed, the ones he typed himself, the counts and sums the JOURNAL block below already worked out,';
  const fresh = 'no statistic, no win rate, no backtest result, and no study of your own. The ONLY numbers you may quote are the ones in the CANDLES block below, which came from the feed, the ones he typed himself, the counts and sums the JOURNAL block below already worked out, the counts in the STUDY block, which this page worked out itself from bars that loaded,';
  return p.includes(old) ? p.replace(old, fresh) : p;
});

once('rule 9 names the study', 'the session block and the STUDY block are the only basis', (p) => {
  const old = "'9. The structure block and the session block are the only basis you have for structure and for timing. If either says it was not computed, say you cannot read structure or the session rather than describing one from nowhere.',";
  const fresh = "'9. The structure block, the session block and the STUDY block are the only basis you have for structure and for timing. If any of them says it was not computed or not loaded, say you cannot read structure or timing rather than describing them from nowhere.',";
  return p.includes(old) ? p.replace(old, fresh) : p;
});

// 6. A leg whose low has not gone yet has not finished retracing. Counting it
//    would read as a leg that never came back rather than one still running, so
//    it is counted as live and left out of the depth counts. Found while
//    writing the tests: bar by bar, the bar right after a swing low always sits
//    above it, so the only way to get a depth of zero was this case — and a
//    zero there would have printed "never got past a third" about a leg that
//    is still in front of him.
once('live legs are not counted as failed retraces', 'if(!broke){ live++; continue }', (p) => {
  const old = [
    '    if(!broke) live++;',
    '    var pct=(top===null)?0:((top-low.p)/leg);',
  ].join('\n');
  const fresh = [
    '    /* A leg whose low has not gone yet has not finished: it is counted as live',
    '       and left out of the counts below, because counting it would read as a leg',
    '       that never came back rather than one that is still running. */',
    '    if(!broke){ live++; continue }',
    '    var pct=(top===null)?0:((top-low.p)/leg);',
  ].join('\n');
  return p.includes(old) ? p.replace(old, fresh) : p;
});

// 7. The two places that describe those counts say which of the two they are.
once('the retrace wording', 'finished down legs', (p) => {
  const a = [
    "    head.push('THE RETRACE (4h): '+f.retrace.n+' down legs in these bars'",
    "      +(f.retrace.live?(', '+f.retrace.live+' of them still live because the low has not gone yet'):'')+'. '",
  ].join('\n');
  const b = [
    "    head.push('THE RETRACE (4h): '+f.retrace.n+' finished down legs in these bars'",
    "      +(f.retrace.live?(', with '+f.retrace.live+' still live because the low has not gone yet'):'')+'. '",
  ].join('\n');
  const c = "h+=stRow('Down legs','<b>'+r.n+'</b>'+(r.live?(' &middot; '+r.live+' still live, the low not taken yet'):''));";
  const d = "h+=stRow('Down legs','<b>'+r.n+'</b> finished'+(r.live?(' &middot; '+r.live+' still live, the low not taken yet'):''));";
  let out = p.includes(a) ? p.replace(a, b) : p;
  out = out.includes(c) ? out.replace(c, d) : out;
  return out;
});

// 8. One higher low is one higher low: "1 higher lows failed" is the kind of
//    line that makes him distrust the number beside it.
once('the hold reads right when there is one of them', 'f.hold.n===1', (p) => {
  const old = "      ? (f.hold.n+' higher lows failed in these bars, the middle one lasting '";
  const fresh = "      ? (f.hold.n+(f.hold.n===1?' higher low failed in these bars, ':' higher lows failed in these bars, ')+'the middle one lasting '";
  return p.includes(old) ? p.replace(old, fresh) : p;
});

// 9. The study counts a longer window than the read above holds, so the
//    assistant is told which of the two a count belongs to. Without it, a count
//    off three months of 4h bars could be repeated as though it were about the
//    few bars in the CANDLES block.
once('the study names its own window', 'THE BARS IT COUNTED ARE ITS OWN', (p) => {
  const anchor = "  head.push('Every figure below is printed with the count it came from. Keep the two welded together, and say plainly when a count is small — a handful of legs or holds is a handful.');";
  const fresh = anchor + [
    "  head.push('');",
    "  head.push('THE BARS IT COUNTED ARE ITS OWN. The study pulled more bars than the CANDLES block above, so a count here is about that longer window and the dates in it, not about the bars in the CANDLES block. Say which window a count came from when you repeat it, and never mix the two together.');",
  ].join('\n');
  return p.includes(anchor) ? p.replace(anchor, fresh) : p;
});

// 10. The study card is emptied on open rather than left as whatever the markup
//    says, so the page is never showing a count it did not work out.
once('the study card is painted on open', 'paintStudy();\nrender();', (p) => {
  const old = '\nrender();\nrenderTrades();';
  const fresh = '\npaintStudy();\nrender();\nrenderTrades();';
  return p.includes(old) ? p.replace(old, fresh) : p;
});

// 11. The button.
once('the study button', "getElementById('studyGo').onclick", (p) => {
  const old = "document.getElementById('fGo').onclick=function(){ loadFeed() };";
  const fresh = "document.getElementById('studyGo').onclick=function(){ loadStudy() };\ndocument.getElementById('fGo').onclick=function(){ loadFeed() };";
  return p.includes(old) ? p.replace(old, fresh) : p;
});

if (page === before) {
  console.log('Nothing to do — the study is already in desk.html.');
} else {
  fs.writeFileSync(PAGE, page);
  console.log('desk.html updated:');
}
for (const line of done) console.log('  ' + line);
