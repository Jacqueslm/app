// The stop question, made answerable — 19 Sep 2026.
//
//   node tools/apply-school-turnoff.js [file]
//
// Found by the price scale, not by looking for it. Once the chart carried the
// numbers, the stop question could be read back, and on some seeds it had no
// answer to read: the pullback ended exactly ON the level, so the entry and the
// place the idea dies were the same price and two of the three options came out
// two cents apart — "just beyond the level (104.62)" against "close in at
// 104.60". The third, a flat distance out, landed within half an average bar of
// the right answer on other seeds. Two prices that cannot be told apart, on a
// question about choosing between prices, is the "I'm still guessing" he named.
//
// Three things fix it: the geometry turns off the level (what every lesson here
// already says the trade is), the flat option sits six bars out so it can never
// coincide with where the idea dies, and every option carries its price so the
// chart's scale can be told to cover all of them. Idempotent.
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'trading-school.html');
const BLOCK = path.join(__dirname, 'school-turnoff-block.js');
const TURNOFF = fs.readFileSync(BLOCK, 'utf8');

let page = fs.readFileSync(FILE, 'utf8');

function swap(what, find, replace, signature){
  if(signature && page.includes(signature)){
    console.log('  ' + what + ' — already in place');
    return;
  }
  const at = page.indexOf(find);
  if(at === -1) throw new Error(what + ': anchor not found — refusing to guess');
  if(page.indexOf(find, at + 1) !== -1) throw new Error(what + ': anchor is not unique — refusing to guess');
  page = page.slice(0, at) + replace + page.slice(at + find.length);
  console.log('  ' + what);
}

/* The same, but it takes any of several anchors — used where a piece has already
   been written once in this session and is being corrected, so the script works
   both on a copy that has never seen it and on this one. */
function swapAny(what, finds, replace, signature){
  if(signature && page.includes(signature)){
    console.log('  ' + what + ' — already in place');
    return;
  }
  for(const find of finds){
    const at = page.indexOf(find);
    if(at === -1) continue;
    if(page.indexOf(find, at + 1) !== -1) throw new Error(what + ': anchor is not unique — refusing to guess');
    page = page.slice(0, at) + replace + page.slice(at + find.length);
    console.log('  ' + what);
    return;
  }
  throw new Error(what + ': none of the anchors matched — refusing to guess');
}

/* The helper, inside makeScenario where push() and base live — it walks the bars
   off the level, so it has to be able to add them. */
swap('makeScenario: the turn off the level',
  '  function highs(a,b){ var m=-1e9; for(var x=a;x<b;x++) m=Math.max(m,bars[x].h); return m }\n',
  '  function highs(a,b){ var m=-1e9; for(var x=a;x<b;x++) m=Math.max(m,bars[x].h); return m }\n\n' + TURNOFF,
  'function turnOff(level, dir)');

/* And it is called in all five shapes, before the decision is taken, so the entry
   is always a real distance off the level the stop belongs beyond. Anchored on
   the mark line each shape sets, which is unique per shape. */
const MARKS = [
  '    mark = {sup:sup, res:highs(0, impEnd)};',
  '    mark = {res:res, sup:lows(0, dnEnd)};',
  '    mark = {sup:bandLo, res:bandHi};',
  '    mark = {sup:sweepLow, res:highs(0, 12)};',
  '    mark = {sup:rHi, res:highs(0, broke)};',
];
for (const mark of MARKS) {
  const level = mark.includes('bandLo') ? 'bandLo'
    : mark.includes('sweepLow') ? 'sweepLow'
      : mark.includes('rHi') ? 'rHi' : 'stopPrice';
  // The signature is the mark line WITH its turn, not the call on its own: two
  // shapes both call turnOff(stopPrice), and a signature on the call alone left
  // the short-side shape without one.
  swap('makeScenario: the turn, ' + level,
    mark + '\n',
    mark + '\n    turnOff(' + level + ', exp === "short" ? -1 : 1);\n',
    mark + '\n    turnOff(');
}

/* The three stops, spaced so none of them can be mistaken for another, and each
   carrying its own price for the chart's scale. */
const SEARCH_OPTS = (flatLine, flatTxt, withP) =>
  '  ' + flatLine + '\n' +
  '  return [\n' +
  '    {txt:"Just beyond the level that would prove the idea wrong (" + money(structural) + ")", ' + (withP ? 'p:structural, ' : '') + 'ok:true},\n' +
  '    {txt:"Close in at " + money(tight) + ", to lose less when it wobbles", ' + (withP ? 'p:tight, ' : '') + 'ok:false},\n' +
  '    {txt:' + flatTxt + ', ' + (withP ? 'p:' + flatLine.split(' ')[1].replace(/;$/, '') + ', ' : '') + 'ok:false}\n' +
  '  ];';

const STOPS_FINAL = [
  '  /* THE THIRD ONE IS TOO WIDE, NOT ARBITRARY, and the two distances are what',
  '     make this question answerable. Every version of it as a fixed number of',
  '     bars out collided with the right answer on some seed — the distance from',
  '     the entry to the level runs from about one average bar to five and a half',
  '     on this page, so no fixed number is ever clear of it. Two bars beyond where',
  '     the idea dies is clear of it by construction, and it is the mistake the',
  '     risk drill sets with its doubled stop: risking more than the setup asks.',
  '     Each option carries p, its price, so the chart can show a scale covering',
  '     all three. */',
  '  var wide = exp === "short" ? structural + atr*2 : structural - atr*2;',
  '  return [',
  '    {txt:"Just beyond the level that would prove the idea wrong (" + money(structural) + ")", p:structural, ok:true},',
  '    {txt:"Close in at " + money(tight) + ", to lose less when it wobbles", p:tight, ok:false},',
  '    {txt:"Further out at " + money(wide) + ", so ordinary noise cannot reach it", p:wide, ok:false}',
  '  ];',
].join('\n');

swapAny('stopOptionsFor: three stops that can be told apart, each with its price',
  [
    SEARCH_OPTS('var flat = exp === "short" ? entry + atr*3 : entry - atr*3;', '"A flat " + money(flat) + ", whatever the chart is doing"', false),
    SEARCH_OPTS('var flat = exp === "short" ? entry + atr*6 : entry - atr*6;', '"A flat " + money(flat) + ", whatever the chart is doing"', true),
  ],
  STOPS_FINAL,
  'var wide = exp === "short" ? structural + atr*2 : structural - atr*2;');

/* The first attempt at this — a flat distance of six average bars — left its own
   reasoning in the file when the option was corrected to the wider stop, and a
   comment that describes code which is no longer there is worse than none. */
const STALE = [
  '  /* Six average bars out, not three: at three the flat stop came out within',
  '     half a bar of the level on some seeds, which is two prices he cannot tell',
  '     apart. Each option carries p, its price, so the chart can show a scale',
  '     that covers all three. */',
  '',
].join('\n');
if (page.includes(STALE)) {
  page = page.replace(STALE, '');
  console.log('  stopOptionsFor: the first attempt at the third option removed');
}

/* And the reading drill's chart shows a scale that covers all three of them. */
swap('paint: the reading drill\'s scale covers the stops it offers',
  '        drawChart(cv, vis, {lines:lines});',
  '        drawChart(cv, vis, {lines:lines,\n' +
  '          range:(d.stopOptions||[]).map(function(o){ return o.p }).filter(function(x){ return typeof x === \'number\' && isFinite(x) })});',
  'range:(d.stopOptions||[])');

/* The two-chart drill's third question quotes the wick's low and a flat distance
   below it, so the 4h chart carries both on its scale as well. */
swap('makeTimingScenario: the stop question\'s own two prices',
  '      {txt:"Beyond the 4h wick\'s low (" + money(wickLow) + ") — where the rejection is disproved", ok:true},\n' +
  '      {txt:"A few ticks under your own 5m entry, to lose less when it wobbles", ok:false},\n' +
  '      {txt:"A flat " + money(wickLow - atr*3) + ", the same on every trade", ok:false}',
  [
    '      {txt:"Beyond the 4h wick\'s low (" + money(wickLow) + ") — where the rejection is disproved", p:wickLow, ok:true},',
    '      {txt:"A few ticks under your own 5m entry, to lose less when it wobbles", ok:false},',
    '      {txt:"A flat " + money(wickLow - atr*3) + ", the same on every trade", p:wickLow - atr*3, ok:false}',
  ].join('\n'),
  'p:wickLow - atr*3');

swap('paint: the 4h chart carries the stop question\'s prices',
  '        drawChart(cv, d.htf.slice(0, UI.revealed ? d.htf.length : d.htfDecision + 1), {lines:hl});',
  '        drawChart(cv, d.htf.slice(0, UI.revealed ? d.htf.length : d.htfDecision + 1), {lines:hl,\n' +
  '          range:d.questions[2].opts.map(function(o){ return o.p }).filter(function(x){ return typeof x === \'number\' && isFinite(x) })});',
  'range:d.questions[2].opts');

fs.writeFileSync(FILE, page);
console.log('trading-school.html: the stop question has three prices he can tell apart');
