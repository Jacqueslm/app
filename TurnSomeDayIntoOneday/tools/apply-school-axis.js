// The price scale for the school's charts — 19 Sep 2026.
//
//   node tools/apply-school-axis.js [file]
//
// He sent it back after the risk strand: "the number in the question answers and
// on the chart are incompatible doesn't makes sense I'm still guessing." He was
// right, and it was every drill on the page: drawChart drew candles and lines
// and not one number — no scale, and lines labelled "zone top", "entry", "stop"
// with no prices — while the questions asked him to choose between prices like
// 100.40 and 103.60. Nothing on the picture to check a number against.
//
// Idempotent: each insertion is skipped when its signature is already there.
// trading-school.html is 169KB, past what the editor can open, so the text lives
// in tools/school-axis-block.html and is spliced in here.
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'trading-school.html');
const BLOCK = path.join(__dirname, 'school-axis-block.html');

const src = fs.readFileSync(BLOCK, 'utf8');
function piece(name, next){
  const a = src.indexOf('<!--@@' + name + '@@-->');
  if(a === -1) throw new Error('no ' + name + ' marker in tools/school-axis-block.html');
  const b = next ? src.indexOf('<!--@@' + next + '@@-->') : src.length;
  if(b === -1) throw new Error('no ' + next + ' marker in tools/school-axis-block.html');
  return src.slice(a + ('<!--@@' + name + '@@-->').length, b).replace(/^\n/, '').replace(/\n$/, '');
}
const RANGE = piece('RANGE', 'GRID');
const GRID = piece('GRID', 'LABELS');
const LABELS = piece('LABELS', 'AXIS');
const AXIS = piece('AXIS');

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

/* The prices the question quotes but does not draw, so none of them can fall off
   the scale he is given. */
swap('drawChart: the quoted prices go into the range, without being drawn',
  '  for(i=0;i<lines.length;i++){ hi = Math.max(hi, lines[i].p); lo = Math.min(lo, lines[i].p) }\n',
  '  for(i=0;i<lines.length;i++){ hi = Math.max(hi, lines[i].p); lo = Math.min(lo, lines[i].p) }\n' + RANGE + '\n',
  'var range = opts.range || [];');

/* The gridlines, under the candles: a line drawn over a candle hides it, and the
   candles are the thing he is reading. */
swap('drawChart: gridlines under the candles',
  '  var body = Math.max(1, Math.min(bw*0.62, 14));\n',
  '  var body = Math.max(1, Math.min(bw*0.62, 14));\n\n' + GRID,
  'THE PRICE SCALE');

/* The line labels carry their prices, and the scale's numbers go on last. The
   anchor runs to the end of drawChart, so the function is closed exactly once. */
const LABEL_ANCHOR = '    if(L.label){\n' +
  '      c.fillStyle = L.colour || dim;\n' +
  '      c.font = Math.round(H*0.062) + "px -apple-system,Segoe UI,Roboto,sans-serif";\n' +
  '      var tw = c.measureText(L.label).width;\n' +
  '      c.fillText(L.label, W - tw - 6, y - 4 > 10 ? y - 4 : y + H*0.075);\n' +
  '    }\n' +
  '  }\n' +
  '}';
swap('drawChart: prices on the lines, and the numbers over the top',
  LABEL_ANCHOR,
  LABELS + '\n\n' + AXIS,
  "var lab = L.label + ' ' + money(L.p)");

fs.writeFileSync(FILE, page);
console.log('trading-school.html: price scale in place');
