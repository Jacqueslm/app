// Put step one of the practice game right — 19 Sep 2026.
//
//   node tools/apply-market-questions.js [page.html]           # apply
//   node tools/apply-market-questions.js [page.html] --check    # report only
//
// market-maker.html is 755KB (the real tape is packed inside it as JSON), past
// what the editor can open, so this page is patched by script, like desk.html
// and trading-school.html. The code it splices lives in tools/market-q-block.js
// and the reasons are at the top of that file.
//
// Two properties this script is built to have, both checked:
//
//   · Re-runnable. Every patch replaces what lies between two anchors, whole,
//     and skips itself if the page already carries the change. Run it twice and
//     the second run writes nothing. Each anchor is checked for uniqueness
//     first — if the page has moved under it, this stops rather than guessing.
//
//   · Complete. It carries every change step one needed, from the page as it
//     was before any of them. Verified by applying it to the committed page and
//     diffing: the result is the working page, byte for byte. That is how the
//     earlier half-applied state (a rebuild in the page that no script
//     reproduced) was found and closed.
const fs = require('fs');
const path = require('path');

const PAGE = process.argv[2] && !process.argv[2].startsWith('--')
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'market-maker.html');
const CHECK = process.argv.includes('--check');
const BLOCK = fs.readFileSync(path.join(__dirname, 'market-q-block.js'), 'utf8');

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

// swap everything between two anchors, keeping the end anchor. `already` is a
// piece of the replacement: if the page has it, this patch is in.
function region(what, startAnchor, endAnchor, text, already) {
  if (already && page.includes(already)) return;
  const at = only(startAnchor, what + ' (start)');
  const end = page.indexOf(endAnchor, at);
  if (end === -1) throw new Error('end anchor not found — refusing to guess: ' + what);
  page = page.slice(0, at) + text + page.slice(end);
  did.push(what);
}

// replace an exact piece of text. Used where the old and the new version do
// not share a clean anchor — the return object of structure(), for one.
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

// ── 1. anything the question asks about stays inside the frame ──────────────
// A level the question is about, sitting outside the last seventy bars, is a
// number with nowhere on the screen to look. The frame is built from the bars
// and the marks it is asked to judge.
region('the marked prices stay inside the frame',
  '  if(Gm.pos){ hi=Math.max(hi,Gm.pos.tp,Gm.pos.sl); lo=Math.min(lo,Gm.pos.tp,Gm.pos.sl) }',
  '  if(pv) ["long","short"]',
  '  if(Gm.pos){ hi=Math.max(hi,Gm.pos.tp,Gm.pos.sl); lo=Math.min(lo,Gm.pos.tp,Gm.pos.sl) }\n'
+ block('frame'),
  'if(Gm.gate && Gm.gate.q && Gm.gate.q.prices)');

// ── 2. the inside, split into its two sides, and level means level ─────────
region('the inside is read side by side',
  '  var innerDown=innerHighs.length>1',
  '  // and the manipulation:',
  '  var innerDown=innerHighs.length>1&&innerHighs[innerHighs.length-1].p<innerHighs[innerHighs.length-2].p;\n'
+ block('steps'),
  'var stepOf=function(arr){');

// ── 3. and it is handed out with the structure ─────────────────────────────
swap('the inside state is handed out with the structure',
  '  return {seq:seq,lastH:lastH,lastL:lastL,trend:trend,legFrom:legFrom,legDir:legDir,\n'
+ '          inner:inner,innerUp:innerUp,innerDown:innerDown,last:ev[ev.length-1]||null,events:ev};\n',
  block('returnfields'),
  'innerDir:innerDir,innerCoil:innerCoil,innerExpand:innerExpand');

// ── 4. the reads themselves, the rotation, and the read that is always there
region('the reads, rebuilt',
  'function buildQ(){',
  'function gateAsk(){',
  block('qengine') + '\n',
  'function qOutside(st){');

// ── 5. the tape numbers its lines, and says what they were afterwards ──────
region('the three marks are drawn and named',
  '  // STEP ONE asks about prices, so the prices in the question are on the tape.',
  '  // step one hides the structure, not the prices',
  block('markers') + '\n',
  'RESTING — price has not been here');

// ── 6. the inside status line, once you have answered ──────────────────────
region('the inside status line names the real state',
  '  var inside = st.inner.length<3 ? "nothing said yet"',
  '  var legTxt=',
  block('dstruct') + '\n',
  'opening out — no read yet');

// ── 7. the buttons carry the number the tape drew on their line ────────────
insert('the label helper',
  'function paintGate(){',
  block('optlabel'),
  'function optLabel(q,k){');

region('the answer buttons carry their number',
  '  var box=$("gOpts"); box.innerHTML="";',
  '  if(g.state==="observe"){',
  block('optloop') + '\n',
  'b.textContent=optLabel(g.q,k)');

region('the verdict names the line the tape numbered',
  '      "The answer is <b>"+g.q.o[g.q.a]+"</b>. "+g.q.w;',
  '    $("gGo")',
  block('verdict') + '\n',
  'optLabel(g.q,g.q.a)');

// ── the page has to come out whole ─────────────────────────────────────────
for (const must of [
  'Gm.gate.q.prices.forEach(function(p){ if(p>hi)hi=p; if(p<lo)lo=p })',
  'var stepOf=function(arr){',
  'innerDir:innerDir,innerCoil:innerCoil,innerExpand:innerExpand',
  'function qOutside(st){',
  'return qOutside(st);',
  'var kinds=["level","inner","event","agree"];',
  'numbered 1, 2 and 3',
  'RESTING — price has not been here',
  'opening out — no read yet',
  'function optLabel(q,k){',
  'b.textContent=optLabel(g.q,k)',
  'optLabel(g.q,g.q.a)',
]) {
  if (!page.includes(must)) throw new Error('missing from the page after applying: ' + must);
}
if (page.includes('"agree","outside"]')) throw new Error('the outside read is back in the rotation');

// the four functions that have to stay whole, and the gate with it
for (const fn of ['buildQ', 'qLevel', 'qInner', 'qEvent', 'qAgree', 'qOutside', 'paintGate', 'drawChart']) {
  const at = page.indexOf('function ' + fn + '(');
  if (at === -1) throw new Error(fn + ' is not in the page');
  if (page.indexOf('function ' + fn + '(', at + 1) !== -1) throw new Error(fn + ' came out twice');
}
const bq = page.slice(page.indexOf('function buildQ(){'), page.indexOf('function qLevel(st){'));
if (!/return qOutside\(st\);\n\}/.test(bq)) throw new Error('buildQ lost its fallback');
if (bq.includes('return null;\n}')) throw new Error('buildQ can still come back empty with no question');
const gate = page.slice(page.indexOf('function paintGate(){'), page.indexOf('function drawStruct('));
for (const must of ['box.appendChild(b);', 'gWhy', 'gGo', 'gOpts']) {
  if (!gate.includes(must)) throw new Error('paintGate lost its ' + must);
}

const after = fs.readFileSync(PAGE, 'utf8');
if (CHECK) {
  console.log(path.basename(PAGE) + ': ' + (page === after ? 'already applied — nothing to do' : 'would change: ' + did.join(', ')));
} else if (page === after) {
  console.log(path.basename(PAGE) + ': already applied, nothing written');
} else {
  fs.writeFileSync(PAGE, page);
  console.log(path.basename(PAGE) + ': ' + did.join(', ') + '  (' + (page.length - before) + ' bytes)');
}
