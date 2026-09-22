// The risk strand, put into trading-school.html — 19 Sep 2026.
//
//   node tools/apply-school-risk.js [file]
//
// Safe to run twice, and safe to run over an older copy of itself: the block is
// replaced when it is already there, and every insertion below is skipped when
// its signature line is already present.
//
// Why surgery rather than an edit: the page is 140KB of one inline script, and
// the risk strand has to reach into six places in it — the tab bar, the lesson
// list, the saved-progress shape, the XP sum, the paint function and the click
// handler. The strand itself lives in tools/school-risk-block.html, split by its
// own markers, so none of it has to be escaped in here.
//
// Jacques, 19 Sep 2026: "the biggest problem I have with trading is managing
// risk — make that a big part of my training. I prefer to take 1:1: price enters
// a zone or a swing, I trade it right out the leg or zone." So the method is its
// own tab with six lessons and a drill, and the drill is the half that matters.
//
// Every anchor is checked for being present AND unique. A page that has been
// rebuilt elsewhere stops this script instead of being quietly half-patched.
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'trading-school.html');
const BLOCK = path.join(__dirname, 'school-risk-block.html');

const src = fs.readFileSync(BLOCK, 'utf8');
function piece(name, next){
  const a = src.indexOf('<!--@@' + name + '@@-->');
  if(a === -1) throw new Error('no ' + name + ' marker in tools/school-risk-block.html');
  const b = next ? src.indexOf('<!--@@' + next + '@@-->') : src.length;
  if(b === -1) throw new Error('no ' + next + ' marker in tools/school-risk-block.html');
  return src.slice(a + ('<!--@@' + name + '@@-->').length, b).replace(/^\n/, '').replace(/\n$/, '');
}
const TAB = piece('TAB', 'CARD');
const CARD = piece('CARD', 'DATA');
const DATA = piece('DATA', 'VIEWLESSONS');
const VIEWLESSONS = piece('VIEWLESSONS', 'LESSONS_FN');
const LESSONS_FN = piece('LESSONS_FN', 'BLANK');
const BLANK = piece('BLANK', 'XP');
const XP = piece('XP', 'PAINTTAB');
const PAINTTAB = piece('PAINTTAB', 'PAINTCV');
const PAINTCV = piece('PAINTCV', 'ACTIONS');
const ACTIONS = piece('ACTIONS', 'DRILLBUTTON');
const DRILLBUTTON = piece('DRILLBUTTON', 'END');
const ASKSYS = piece('ASKSYS', 'END');

let page = fs.readFileSync(FILE, 'utf8');
const before = page.length;

const MARK = 'THE RISK STRAND';
const already = page.includes(MARK);

/* The block itself: everything from the strand's banner to the end of the
   function that draws its way in from the reading drills. Replaced whole when it
   is already there, so an edit to the strand lands instead of stacking. */
const BLOCK_ANCHOR = '/* ══ PAINT ══';
function swap(what, find, replace, signature){
  if(signature && page.includes(signature)){
    console.log('  ' + what.replace(/^[^:]*: /, '') + ' — already in place');
    return;
  }
  const at = page.indexOf(find);
  if(at === -1) throw new Error(what + ': anchor not found — refusing to guess');
  if(page.indexOf(find, at + 1) !== -1) throw new Error(what + ': anchor is not unique — refusing to guess');
  if(page.indexOf(find) !== at) throw new Error(what + ': anchor is not unique — refusing to guess');
  page = page.slice(0, at) + replace + page.slice(at + find.length);
  console.log('  ' + what);
}

/* The shared lesson card first: it sits outside the block below, so a rerun does
   not insert a second copy of it. */
swap('lessonCardHtml: the lesson card, written once and used by both tabs',
  BLOCK_ANCHOR, CARD + '\n' + BLOCK_ANCHOR,
  'function lessonCardHtml(');

/* The block itself: the strand's banner through the end of the way in from the
   reading drills. Replaced whole when it is already there, so editing the strand
   and running this again lands the edit instead of stacking a second copy. */
if(already){
  const start = page.lastIndexOf('\n', page.indexOf('/* ══ THE RISK STRAND')) + 1;
  const btn = page.indexOf('function riskButton(){', start);
  const end = btn === -1 ? -1 : page.indexOf('\n}', btn);
  if(start < 0 || btn === -1 || end === -1){
    throw new Error('the strand is in ' + FILE + ' but its block could not be bounded — refusing to guess');
  }
  page = page.slice(0, start) + DATA + page.slice(end + 2);
  console.log('  block: the risk strand replaced (it was already there)');
}else{
  swap('block: the strand, its drill and its six lessons, before the paint function',
    BLOCK_ANCHOR, DATA + '\n' + BLOCK_ANCHOR);
}

/* Both tabs show a lesson through the one card. */
swap('viewLessons: the inline lesson markup replaced by the shared card',
  "      + '<div class=\"sec-hd\">Lesson ' + esc(l.id) + '</div>'\n" +
  "      + '<div class=\"card open\"><div class=\"body\" style=\"display:block;border-top:none;padding-top:0\">'\n" +
  "      + '<p style=\"font-size:1rem;font-weight:600;color:var(--tp);margin-bottom:10px\">' + esc(l.t) + '</p>';\n" +
  "    for(var p=0;p<l.b.length;p++) h += '<p>' + esc(l.b[p]) + '</p>';\n" +
  "    h += '<div class=\"lbl\">Keep these</div><ul class=\"k\">';\n" +
  "    for(var kk2=0; kk2<l.k.length; kk2++) h += '<li>' + esc(l.k[kk2]) + '</li>';\n" +
  "    h += '</ul>';\n" +
  "    h += lessonQuizHtml(l);\n" +
  "    h += '</div></div>';",
  VIEWLESSONS,
  '      + lessonCardHtml(l);');

/* The risk lessons count as lessons: progress, the checks and the chain the
   "next" button walks. */
swap('allLessons: the risk strand added to the lesson list',
  "function allLessons(){\n" +
  "  var out = [];\n" +
  "  for(var i=0;i<SCHOOL.length;i++)\n" +
  "    for(var j=0;j<SCHOOL[i].lessons.length;j++) out.push(SCHOOL[i].lessons[j]);\n" +
  "  return out;\n" +
  "}",
  LESSONS_FN,
  'for(var k=0;k<SW_RISK.length;k++)');

/* The saved shape on the device, merged like every other key, so an older save
   keeps working and the record starts at nothing. */
swap('blank: the risk record added to what is kept on the device',
  "  return {v:1, lessons:{}, q:{}, t:{}, d:{}, dn:0, seen:0,\n" +
  "          bt:{runs:0, trades:0, wins:0, r:0, best:0, worst:0, dd:0}};",
  BLANK,
  'rr:{done:0');

/* And it earns XP like the reading drills do. */
swap('schoolStats: the risk drills counted',
  "  var xp = done*10 + quiz*5 + testCorrect*10 + drillCorrect*5 + (s.dn||0)*15;",
  XP,
  '((s.rr && s.rr.done)||0)*15');

/* Two hooks into paint(): which view the risk tab shows, and the chart. */
swap('paint: the risk tab draws itself',
  '  else if(UI.tab === "drills") html = viewDrills();',
  '  else if(UI.tab === "drills") html = viewDrills();\n' + PAINTTAB,
  'UI.tab === "risk") html = viewRisk();');

swap('paint: the risk chart, with the zone and then the plan',
  '    } else if(UI.tab === "backtest" && UI.bt){',
  PAINTCV + '\n    } else if(UI.tab === "backtest" && UI.bt){',
  'UI.tab === "risk"){\n      drawRisk(cv);');

/* The tab, second in the bar — before Tests, because it is the part he is here
   for. */
swap('tabs: Risk, ahead of Tests',
  '    <div class="tab" data-t="tests">Tests</div>',
  TAB + '\n    <div class="tab" data-t="tests">Tests</div>',
  'data-t="risk">Risk</div>');

/* The risk drill's own actions, kept apart from the reading drills' so neither
   can half-overwrite the other. */
swap('events: the risk drill answers, a new plan, and the way in from the drills',
  '    else if(a === "newtiming"){ newTimingDrill(((UI.drill && UI.drill.seed) || 0) + 3); paint() }',
  '    else if(a === "newtiming"){ newTimingDrill(((UI.drill && UI.drill.seed) || 0) + 3); paint() }\n' + ACTIONS,
  'a === "riskans"');

/* One button in the reading drills, so the strand can be found without knowing
   the tab is there. */
swap('viewDrills: a button through to the risk drill',
  '  h += timingButton();',
  '  h += timingButton();\n' + DRILLBUTTON,
  'h += riskButton();');

/* And the teacher inside the school answers risk questions in his own method
   rather than in generalities. It goes in after the numbered list, so the rules
   keep their numbers. */
const ASK_RULE_6 = '"6. Never mention money, pricing, subscriptions or the business behind anything.",';
swap('ASK_SYS: the one-for-one rule, and what to do when the leg is short',
  ASK_RULE_6,
  ASK_RULE_6 + '\n' + ASKSYS,
  'HIS METHOD, AND IT IS THE PART THAT COSTS HIM');

fs.writeFileSync(FILE, page);
console.log(FILE.split(path.sep).pop() + ': ' + (page.length - before) + ' bytes (' + before + ' -> ' + page.length + ')');
