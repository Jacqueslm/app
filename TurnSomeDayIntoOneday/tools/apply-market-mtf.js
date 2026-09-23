// Put the close-not-wick rule and the execution-frame switch into the practice
// game — 23 Sep 2026.
//
//   node tools/apply-market-mtf.js [page.html]           # apply
//   node tools/apply-market-mtf.js [page.html] --check   # report only
//
// market-maker.html is 756KB (the real tape is packed inside it as JSON), past
// what the file tools can open, so this page is patched by script, exactly like
// tools/apply-market-questions.js patches the same page. The code it splices
// lives in tools/market-mtf-block.js and the reasons are at the top of it.
//
// Two properties, both checked, same as the earlier script for this page:
//
//   · Re-runnable. Every patch replaces a whole piece between anchors and skips
//     itself if the page already carries the change. Run it twice and the
//     second run writes nothing. Each anchor is checked for uniqueness first —
//     if the page has moved under it, this stops rather than guessing.
//
//   · It changes the break rule and the frame, and nothing else. The block for
//     each patch carries the change complete from the page as it was, so there
//     is no half-applied state to find later.
const fs = require('fs');
const path = require('path');

const PAGE = process.argv[2] && !process.argv[2].startsWith('--')
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'market-maker.html');
const CHECK = process.argv.includes('--check');
const BLOCK = fs.readFileSync(path.join(__dirname, 'market-mtf-block.js'), 'utf8');

// one block of code, by name, trailing whitespace trimmed and one newline kept
function block(name) {
  const open = '//===BLOCK:' + name + '\n';
  const at = BLOCK.indexOf(open);
  if (at === -1) throw new Error('no block ' + name + ' in the block file');
  const rest = BLOCK.slice(at + open.length);
  const next = rest.indexOf('\n//===BLOCK:');
  return (next === -1 ? rest : rest.slice(0, next)).replace(/\s+$/, '') + '\n';
}

let page = fs.readFileSync(PAGE, 'utf8');
const before = page.length;
const did = [];

function only(needle, what) {
  const at = page.indexOf(needle);
  if (at === -1) throw new Error('anchor not found — refusing to guess: ' + what);
  if (page.indexOf(needle, at + 1) !== -1) throw new Error('anchor is not unique — refusing to guess: ' + what);
  return at;
}

// replace an exact piece of text
function swap(what, oldText, newText, already) {
  if (already && page.includes(already)) return;
  only(oldText, what);
  page = page.replace(oldText, newText);
  did.push(what);
}

// put text in front of an anchor, once
function insert(what, anchor, text, already) {
  if (already && page.includes(already)) return;
  const at = only(anchor, what);
  page = page.slice(0, at) + text + page.slice(at);
  did.push(what);
}

// ── 1. a break is a CLOSE through, and a wick that closes back is a raid ────
// This is the correction. Until now the four words were read off the wicks, so
// a poke above the last high and a close back under it was labelled a higher
// high and moved the trend. Now the turn's own bar has to close beyond the
// previous turn, and a wick that closes back is labelled SH or SL — a sweep. It
// stays a turn, stays drawn, and the stops are still sitting behind it; it just
// does not move the structure by itself.
swap('the break needs a close, and a wick that closes back is a sweep',
  '  for(var i=2;i<seq.length;i++){\n'
+ '    var prev=seq[i-2];\n'
+ "    seq[i].lab = seq[i].t==='H' ? (seq[i].p>prev.p?'HH':'LH') : (seq[i].p<prev.p?'LL':'HL');\n"
+ '  }\n',
  block('labels'),
  'var sweeps=seq.filter(');

// ── 2. and the sweeps come out of structure() with everything else ──────────
swap('the sweeps are handed out with the structure',
  '  return {seq:seq,lastH:lastH,lastL:lastL,trend:trend,legFrom:legFrom,legDir:legDir,\n'
+ '          inner:inner,innerUp:innerUp,innerDown:innerDown,\n'
+ '          lowStep:lowStep,highStep:highStep,innerDir:innerDir,innerCoil:innerCoil,innerExpand:innerExpand,\n'
+ '          last:ev[ev.length-1]||null,events:ev};\n',
  block('returnfields'),
  'sweeps:sweeps,lastSweep:');

// ── 3. two more reads: the raid, and the frame above the one you execute on ─
// They go in ahead of qOutside, and ahead of its own comment: the long note on
// the outside read describes the function underneath it, and leaving the two
// apart would put that note on the raid instead.
insert('the raid read and the bridge read',
  '/* The read that can always be made.',
  block('reads'),
  'function qRaid(st){');

// ── 4. both of them are asked, in the rotation ─────────────────────────────
swap('the rotation carries the raid and the bridge',
  '  var kinds=["level","inner","event","agree"];\n',
  block('rotation'),
  '"raid","agree","bridge"');

// ── 5. a swept turn is drawn as a sweep ────────────────────────────────────
swap('a swept turn is drawn as a sweep, not as a break',
  '    x.fillStyle = (pt.lab==="HH"||pt.lab==="HL") ? "rgba(46,230,160,.95)" : "rgba(255,92,108,.95)";\n'
+ '    x.fillText(pt.lab,cx,Y(pt.p)+(hi?-9:16));\n',
  block('dstructlabel'),
  'swept?"SWEPT":pt.lab');

// ── 6. and named on the tape, in his own words for it ──────────────────────
insert('the raid is named where it happened',
  '  // and the manipulation, marked where it happened',
  block('raidmark'),
  'WICK THROUGH, CLOSED BACK');

// ── 7. the bridge, its bias, and the frame you execute on ──────────────────
insert('the bridge, its bias and the execution switch',
  'function draw4h(){',
  block('bridge'),
  'function execTf(i){');

swap('the bridge paints its bias on every draw',
  'function draw4h(){\n',
  'function draw4h(){\n  paintBias(); paintTfSwitch();\n',
  'paintBias(); paintTfSwitch();');

// ── 8. the dial, above the bridge ──────────────────────────────────────────
insert('the execution dial sits above the bridge',
  '    <div id="bridge">',
  block('dial'),
  'id="tfswitch"');

// ── 9. and it is built once, at boot ───────────────────────────────────────
swap('the switch is built at boot',
  '\ndrawHome();\n})();\n',
  '\n' + block('boot') + 'drawHome();\n})();\n',
  'buildTfSwitch(); paintBias();');

// ── the page has to come out whole ─────────────────────────────────────────
for (const must of [
  'var sweeps=seq.filter(',
  'if(seq[i].t===\'H\') seq[i].lab = seq[i].p>prev.p ? (tb.c>prev.p?\'HH\':\'SH\') : \'LH\';',
  'sweeps:sweeps,lastSweep:sweeps[sweeps.length-1]||null,',
  'function qRaid(st){',
  'function qBridge(){',
  'var kinds=["level","inner","event","raid","agree","bridge"];',
  'swept?"SWEPT":pt.lab',
  'WICK THROUGH, CLOSED BACK',
  'function bridgeBars(){',
  'function bridgeTrend(){',
  'function execTf(i){',
  'function rollAny(hourly,hours){',
  'paintBias(); paintTfSwitch();',
  'id="tfswitch"',
  'buildTfSwitch(); paintBias();',
]) {
  if (!page.includes(must)) throw new Error('missing from the page after applying: ' + must);
}
// the old reading of the four words must be gone, or the wick is still a break
if (page.includes("(seq[i].p>prev.p?'HH':'LH')")) throw new Error('the wick is still breaking structure');
// and the reads that were there before are still there, whole and once each
for (const fn of ['structure', 'buildQ', 'qOutside', 'qLevel', 'qInner', 'qEvent', 'qAgree',
                  'qRaid', 'qBridge', 'bridgeTrend', 'execTf', 'paintBias', 'draw4h', 'paintGate']) {
  const at = page.indexOf('function ' + fn + '(');
  if (at === -1) throw new Error(fn + ' is not in the page');
  if (page.indexOf('function ' + fn + '(', at + 1) !== -1) throw new Error(fn + ' came out twice');
}
// the bridge is the higher frame of the SAME bars, not a second feed
const bridge = page.slice(page.indexOf('function bridgeBars(){'), page.indexOf('function draw4h(){'));
if (!/rollAny\(Gm\.bars/.test(bridge)) throw new Error('the bridge stopped being built from the bars in front of him');
if (!/structure\(g,g\.length-1\)/.test(bridge)) throw new Error('the bridge stopped reading its own structure');

const after = fs.readFileSync(PAGE, 'utf8');
if (CHECK) {
  console.log(path.basename(PAGE) + ': ' + (page === after ? 'already applied — nothing to do' : 'would change: ' + did.join(', ')));
} else if (page === after) {
  console.log(path.basename(PAGE) + ': already applied, nothing written');
} else {
  fs.writeFileSync(PAGE, page);
  console.log(path.basename(PAGE) + ': ' + did.join(', ') + '  (' + (page.length - before) + ' bytes)');
}
