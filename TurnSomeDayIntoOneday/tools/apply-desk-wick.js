#!/usr/bin/env node
/* Put his close-not-wick rule into desk.html — 23 Sep 2026.
 *
 * WHY A SCRIPT AND NOT A DIRECT EDIT: desk.html is 176KB and the file tools
 * read a truncated copy of it, so a find-and-replace anywhere past the first
 * part of the page silently fails to match. Every change to this page has gone
 * in this way - tools/apply-desk-frame.js, apply-desk-study.js, apply-desk-symbol.js.
 *
 *   node tools/apply-desk-wick.js            # apply
 *   node tools/apply-desk-wick.js --check    # report only
 *
 * WHAT IT CHANGES AND WHY. The practice game got his correction first, on 23 Sep:
 *
 *   "it counts wicks as breaks when i see wicks as close a wick break close
 *    back in the leg or zone it thats ok"
 *
 * The desk was still counting them. Its structure() labelled a swing high 'HH'
 * whenever the wick was higher than the high before it, and worse, frameRead()
 * called a lower low off the wick alone - so the desk's own frame could turn down
 * on a poke that closed back inside, which is the exact read he says costs him
 * money. The assistant reads that structure block, so a wrong label there is a
 * wrong answer here.
 *
 * Six words now, not four: HH and LL are the turns that CLOSED through the turn
 * before them, SH and SL are the same turns where the bar closed back inside -
 * raids, still drawn, still where the stops are sitting, and they move nothing.
 * The same rule, in the same order, as the game and the TradingView script, so
 * the three cannot disagree about the same bars.
 *
 * Safe to run more than once: every step is skipped when its change is already on
 * the page, and every anchor is checked for uniqueness first. If the page has
 * moved under an anchor this stops rather than guessing.
 */
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'desk.html');
const CHECK = process.argv.includes('--check');

let page = fs.readFileSync(PAGE, 'utf8');
const was = page;
const before = page.length;
const did = [];

function only(needle, what) {
  const at = page.indexOf(needle);
  if (at === -1) throw new Error('anchor not found - refusing to guess: ' + what);
  if (page.indexOf(needle, at + 1) !== -1) throw new Error('anchor is not unique - refusing to guess: ' + what);
  return at;
}

function swap(what, oldText, newText, already) {
  if (already && page.includes(already)) return;
  only(oldText, what);
  page = page.replace(oldText, newText);
  did.push(what);
}

// ── 1. a swing carries its own bar's CLOSE ─────────────────────────────────
// The close is what decides whether a turn through a level was a break or a raid.
// The swipe of wick above the old high cannot answer that on its own.
swap('the swing keeps its bar close',
  "    if(hi) piv.push({kind:'H',p:candles[i].h,t:candles[i].t});\n"
+ "    else if(lo) piv.push({kind:'L',p:candles[i].l,t:candles[i].t});\n",
  "    if(hi) piv.push({kind:'H',p:candles[i].h,t:candles[i].t,c:candles[i].c});\n"
+ "    else if(lo) piv.push({kind:'L',p:candles[i].l,t:candles[i].t,c:candles[i].c});\n",
  'p:candles[i].h,t:candles[i].t,c:candles[i].c');

// ── 2. the four words become six, and the raid is named ────────────────────
insertTurnWord();

function insertTurnWord() {
  if (page.includes('function turnWord(')) return;
  const anchor = "/* The labels, against the last swing of the same kind: HH higher high, HL";
  const at = only(anchor, 'the turnWord helper');
  const helper = [
    "/* The word a turn earns, and the rule he corrected the game with on 23 Sep:",
    "   the turn's OWN bar has to CLOSE through the turn before it.",
    "",
    "     HH  a new high with the close above the previous high  - a real break",
    "     SH  a new high with the close back under it            - a raid, no change",
    "",
    "   and the mirror for lows, where LL is the break and SL is the raid. SH and",
    "   SL are still turns, still drawn, still where the stops are sitting; they",
    "   just do not move the structure on their own. The turn's own bar decides,",
    "   so the same bars always give the same answer. */",
    "function turnWord(now, prev){",
    "  if(now.kind==='H'){",
    "    if(!(now.p>prev.p)) return 'LH';",
    "    return now.c>prev.p ? 'HH' : 'SH';",
    "  }",
    "  if(!(now.p<prev.p)) return 'HL';",
    "  return now.c<prev.p ? 'LL' : 'SL';",
    "}",
    ""
  ].join('\n');
  page = page.slice(0, at) + helper + page.slice(at);
  did.push('the turnWord helper');
}

// The first cut of this tool took a third argument and used it for both sides,
// which read an EQUAL low as a raid. The game reads an equal low as a higher low
// ("HL" - its own test says so), and two pages disagreeing about one bar is
// exactly what this change exists to stop. So the helper is rewritten to mirror
// the game line for line, and a page that already carries the first cut is
// upgraded rather than left on the old reading.
const OLD_TURN_WORD = [
  "function turnWord(now, prev, higher){",
  "  var through=(now.kind==='H') ? (now.c>prev.p) : (now.c<prev.p);",
  "  if(now.kind==='H') return higher ? (through?'HH':'SH') : 'LH';",
  "  return higher ? 'HL' : (through?'LL':'SL');",
  "}",
  ""
].join('\n');
const NEW_TURN_WORD = [
  "function turnWord(now, prev){",
  "  if(now.kind==='H'){",
  "    if(!(now.p>prev.p)) return 'LH';",
  "    return now.c>prev.p ? 'HH' : 'SH';",
  "  }",
  "  if(!(now.p<prev.p)) return 'HL';",
  "  return now.c<prev.p ? 'LL' : 'SL';",
  "}",
  ""
].join('\n');

if (page.includes(OLD_TURN_WORD)) {
  page = page.replace(OLD_TURN_WORD, NEW_TURN_WORD);
  did.push('the turnWord helper, off the equal-low reading');
}

swap('structure labels the close, not the wick',
  "    if(!prev){ labels.push(s[i].kind); continue }\n"
+ "    var higher=(s[i].p>prev.p);\n"
+ "    labels.push(s[i].kind==='H' ? (higher?'HH':'LH') : (higher?'HL':'LL'));\n"
+ "  }\n"
+ "  return {swings:s, labels:labels};\n"
+ "}\n",
  "    if(!prev){ labels.push(s[i].kind); continue }\n"
+ "    var higher=(s[i].p>prev.p);\n"
+ "    labels.push(turnWord(s[i], prev));\n"
+ "  }\n"
+ "  var sweeps=[];\n"
+ "  for(i=0;i<labels.length;i++){ if(labels[i]==='SH'||labels[i]==='SL') sweeps.push(s[i]) }\n"
+ "  return {swings:s, labels:labels, sweeps:sweeps,\n"
+ "          lastSweep:sweeps.length?sweeps[sweeps.length-1]:null};\n"
+ "}\n",
  'var sweeps=[];');

// The call site, on a page that already carries the three-argument first cut.
swap('the turn is named without the extra argument',
  'labels.push(turnWord(s[i], prev, higher));',
  'labels.push(turnWord(s[i], prev));',
  'labels.push(turnWord(s[i], prev));');

// ── 3. the run is read off the turns that CLOSED, and the raid is handed on ─
// A raid used to be impossible, so the run could be read off the last label of
// each kind. It cannot now: the newest turn may be a raid, and a raid leaves the
// run exactly as it was. So the settled turns are found first, and the raid rides
// along beside them - for the assistant to be told about, rather than folded into
// a trend word it did not earn.
swap('the run ignores the raids',
  "  for(i=sw.length-1;i>=0;i--){\n"
+ "    if(sw[i].kind==='H'&&!lastH){ lastH=sw[i]; hiLab=lab[i] }\n"
+ "    if(sw[i].kind==='L'&&!lastL){ lastL=sw[i]; loLab=lab[i] }\n"
+ "  }\n",
  "  for(i=sw.length-1;i>=0;i--){\n"
+ "    if(sw[i].kind==='H'&&!lastH){ lastH=sw[i]; hiLab=lab[i] }\n"
+ "    if(sw[i].kind==='L'&&!lastL){ lastL=sw[i]; loLab=lab[i] }\n"
+ "  }\n"
+ "  /* The run, off the last turn that actually CLOSED through the one before it.\n"
+ "     A raid is not one: the wick went through and the close came back inside, so\n"
+ "     the side before it stands until a close says otherwise. */\n"
+ "  var hiSettle=null, loSettle=null;\n"
+ "  for(i=lab.length-1;i>=0;i--){\n"
+ "    if(sw[i].kind==='H'&&!hiSettle&&(lab[i]==='HH'||lab[i]==='LH')) hiSettle=lab[i];\n"
+ "    if(sw[i].kind==='L'&&!loSettle&&(lab[i]==='HL'||lab[i]==='LL')) loSettle=lab[i];\n"
+ "  }\n",
  'var hiSettle=null, loSettle=null;');

swap('the trend word comes off the settled turns',
  "    tf:tf, labels:shown, trend:(hiLab==='HH'&&loLab==='HL')?'up':((hiLab==='LH'&&loLab==='LL')?'down':'mixed'),\n",
  "    tf:tf, labels:shown,\n"
+ "    trend:(hiSettle==='HH'&&loSettle==='HL')?'up':((hiSettle==='LH'&&loSettle==='LL')?'down':'mixed'),\n"
+ "    sweep:st.lastSweep?(st.lastSweep.kind==='H'?'SH':'SL'):null,\n",
  'sweep:st.lastSweep?(st.lastSweep.kind');

// ── 4. the frame turns on a CLOSE, or it does not turn ────────────────────
// The one that matters most. frameRead() called the most recent lower low off the
// wick alone, so a low taken and given back turned the desk's frame down, and the
// assistant was told the frame was down when nothing had broken.
swap('the frame turns on a close',
  "    if(prevLow>=0 && sw[i].p<sw[prevLow].p){ lowIdx=i; break }\n",
  "    if(prevLow>=0 && sw[i].p<sw[prevLow].p && sw[i].c<sw[prevLow].p){ lowIdx=i; break }\n",
  'sw[i].p<sw[prevLow].p && sw[i].c<sw[prevLow].p');

// ── 5. the small chart turns on a close too ───────────────────────────────
swap('the small chart turns on a close',
  "  var hi=null, prevHi=null, hold=null, prevLo=null;\n"
+ "  for(i=0;i<sw.length;i++){\n"
+ "    if(sw[i].kind==='H'){ prevHi=hi; hi=sw[i].p }\n",
  "  var hi=null, prevHi=null, hiClose=null, hold=null, prevLo=null;\n"
+ "  for(i=0;i<sw.length;i++){\n"
+ "    if(sw[i].kind==='H'){ prevHi=hi; hi=sw[i].p; hiClose=sw[i].c }\n",
  'hiClose=null, hold=null');

swap('the small chart needs the high to close above the last one',
  "  out.up=(prevHi!==null && hi!==null && hi>prevHi && hold!==null && out.close>hold);\n",
  "  out.up=(prevHi!==null && hi!==null && hiClose!==null && hi>prevHi && hiClose>prevHi\n"
+ "    && hold!==null && out.close>hold);\n",
  'hi>prevHi && hiClose>prevHi');

// ── 6. the assistant is told about the raid in words ──────────────────────
swap('the per-timeframe sentence names the raid',
  "  if(r.gapHigh!==null){\n",
  "  if(r.sweep) out.push(' The most recent raid in these bars was a '+r.sweep+': price went'\n"
+ "    +' through the level and the close came back inside, so nothing broke and by his'\n"
+ "    +' own rule that shape points the other way. It is a raid, never a break.');\n"
+ "  if(r.gapHigh!==null){\n",
  'It is a raid, never a break.');

// The first cut said "The last turn was a raid". The newest turn and the newest
// raid are two different bars - a raid is exactly the turn that does NOT settle
// the structure - so the sentence says which bar it is talking about: the most
// recent raid, not the last turn.
swap('the raid sentence says which bar it means',
  "  if(r.sweep) out.push(' The last turn was a '+r.sweep+': price went through the level'\n"
+ "    +' and the close came back inside, so nothing broke and by his own rule that'\n"
+ "    +' shape points the other way. It is a raid, never a break.');\n",
  "  if(r.sweep) out.push(' The most recent raid in these bars was a '+r.sweep+': price went'\n"
+ "    +' through the level and the close came back inside, so nothing broke and by his'\n"
+ "    +' own rule that shape points the other way. It is a raid, never a break.');\n",
  'The most recent raid in these bars was a');

// ── 7. the page says the six words, not the four ──────────────────────────
swap('the structure card says the six words',
  "HH higher high, HL higher low, LH lower high, LL lower low — each against the last swing of the same kind.",
  "HH a new high that closed above the high before it, SH the same high where the bar closed back under it — a raid, and it moves nothing — LH a lower high, HL a higher low, LL a new low that closed under the low before it, SL the same low where the bar closed back above it — a raid too. Each against the last swing of the same kind.",
  'SH the same high where the bar closed back under it');

swap('the assistant is told the same six words',
  "HH higher high, HL higher low, LH lower high, LL lower low, each against the last swing of the same kind;",
  "HH a new high that closed above the high before it, SH a new high whose bar closed back under it, LH lower high, HL higher low, LL a new low that closed under the low before it, SL a new low whose bar closed back above it, each against the last swing of the same kind; a raid is a wick through a level that closed back inside, it changes nothing, and it is never to be called a break;",
  'SH a new high whose bar closed back under it');

swap('the frame card says how it turns',
  "A frame is down when the frame's own bars make a lower low.",
  "A frame is down when a lower low CLOSES under the low before it — a low taken and given back is a raid, and it turns nothing.",
  'a low taken and given back is a raid');

swap('the frame notes name the close too',
  "       His rules, as numbers: a new LOWER LOW on the frame turns the frame down\n"
+ "       and sets two things — the level, which is the swing high the drop came\n"
+ "       from, and the frame low, which is that lower low. Only a CLOSE above the\n",
  "       His rules, as numbers: a lower low that CLOSED under the low before it\n"
+ "       turns the frame down and sets two things - the level, which is the swing\n"
+ "       high the drop came from, and the frame low, which is that lower low. A\n"
+ "       wick through that closed back inside is a raid and turns nothing. Only a\n"
+ "       CLOSE above the\n",
  'a lower low that CLOSED under the low before it');

swap('the swing card names the six',
  "       LH, LL), how far price sits from the last swing high and low, whether the\n",
  "       LH, LL) with the raids marked as raids (SH, SL - a wick through that\n"
+ "       closed back inside, which moves nothing), how far price sits from the\n"
+ "       last swing high and low, whether the\n",
  '(SH, SL - a wick through that');

// ── 8. and a raid is drawn in the raid colour ─────────────────────────────
swap('a raid is drawn as a raid, not as a break',
  "      color:(bare?cssVar('--tm','#888780'):((lab==='HH'||lab==='HL')?'#26a69a':'#ef5350')),\n",
  "      color:(bare?cssVar('--tm','#888780'):((lab==='SH'||lab==='SL')?'#ffc53d':((lab==='HH'||lab==='HL')?'#26a69a':'#ef5350'))),\n",
  "'SH'||lab==='SL')?'#ffc53d'");

// ── the page has to come out whole ────────────────────────────────────────
for (const must of [
  'function turnWord(now, prev){',
  "    return now.c>prev.p ? 'HH' : 'SH';",
  "  return now.c<prev.p ? 'LL' : 'SL';",
  'c:candles[i].c',
  'labels.push(turnWord(s[i], prev));',
  'sweeps:sweeps,',
  'var hiSettle=null, loSettle=null;',
  "sweep:st.lastSweep?(st.lastSweep.kind==='H'?'SH':'SL'):null,",
  'sw[i].p<sw[prevLow].p && sw[i].c<sw[prevLow].p',
  'hiClose=sw[i].c',
  'hi>prevHi && hiClose>prevHi',
  'It is a raid, never a break.',
  "'SH'||lab==='SL')?'#ffc53d'",
]) {
  if (!page.includes(must)) throw new Error('missing from the page after applying: ' + must);
}
// the old reading of the four words must be gone, or the wick is still a break
if (page.includes("labels.push(s[i].kind==='H' ? (higher?'HH':'LH') : (higher?'HL':'LL'));")) {
  throw new Error('the wick is still breaking structure');
}
if (page.includes('if(prevLow>=0 && sw[i].p<sw[prevLow].p){ lowIdx=i; break }')) {
  throw new Error('the frame can still turn on a wick');
}
// and every function the page leans on is there, once
for (const fn of ['turnWord', 'swings', 'structure', 'readOf', 'structureLine', 'frameRead', 'smallChart']) {
  const at = page.indexOf('function ' + fn + '(');
  if (at === -1) throw new Error(fn + ' is not in the page');
  if (page.indexOf('function ' + fn + '(', at + 1) !== -1) throw new Error(fn + ' came out twice');
}

if (page === was) {
  console.log('desk.html: already applied, nothing written');
} else if (CHECK) {
  console.log('desk.html: would change: ' + did.join(', '));
} else {
  // balanced braces by count, because a page that stops parsing loses the app
  const opens = (page.match(/\{/g) || []).length;
  const closes = (page.match(/\}/g) || []).length;
  if (opens !== closes) throw new Error('braces do not balance: ' + opens + ' open, ' + closes + ' close');
  fs.writeFileSync(PAGE, page);
  console.log('desk.html: ' + did.join(', ') + '  (' + (page.length - before) + ' bytes)');
}
