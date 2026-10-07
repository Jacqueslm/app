// The daily, as plain text, without a browser — 19 Sep 2026.
//
//   node tools/today-text.js                    # today's date, no birthday
//   node tools/today-text.js 2026-09-19 11-29   # a date and a birthday
//
// There is no browser here and the page is behind a sign-in, so this is how the
// words on Today can actually be read while they are being worked on. It loads
// key.html, takes the page's own tables and its own helpers out of it, runs the
// daily engine on them and prints what the page would show — the same way
// server/test/key-daily.test.js does, for the same reason: a copy of the tables
// live in here would agree with whatever mistake the engine had made.
//
// It is a reading tool, not a test. Nothing here asserts anything.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'key.html'), 'utf8');

const at = PAGE.indexOf('TODAY — THE DAILY');
if(at === -1) throw new Error('the daily is not in key.html — run tools/apply-today.js first');
const BLOCK = PAGE.slice(at, PAGE.indexOf('</script>', PAGE.indexOf('TODAY ENGINE', at)));
const ENGINE = BLOCK.slice(BLOCK.indexOf('/* ─── TODAY ENGINE'), BLOCK.indexOf('/* ─── END TODAY ENGINE ─── */'));

/* The page's consts, as written: the literal after the =, ending at the first
   ]; or };. Same reader as the test file, and for the same reason. */
function grabConst(name){
  const head = 'const ' + name + ' = ';
  const start = PAGE.indexOf('\n' + head);
  if(start === -1) throw new Error('const ' + name + ' is not in key.html');
  const tail = PAGE.slice(start + 1 + head.length);
  const arr = tail.indexOf('];'), obj = tail.indexOf('};');
  return tail.slice(0, (arr > -1 && (obj === -1 || arr < obj)) ? arr + 1 : obj + 1).trim();
}
function grabFn(re){
  const m = PAGE.match(re);
  if(!m) throw new Error('not found in key.html: ' + re);
  return m[0];
}

const ctx = { Math, JSON, String, Number, Array, Object, console, Date };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext('var LORE={},PORTRAIT={},WELLBEING={},DESTINY={},PLANET_LORE={};', ctx);
['PERIODS', 'SIGNS', 'NUMBERS', 'TAROT', 'EL_REL', 'Q_REL', 'MONTHS',
 'SEASONS', 'SEASON_PLACE', 'SIGN_BODY', 'BIRTHSTONE', 'DAYS']
  .forEach((n) => vm.runInContext(`var ${n} = ${grabConst(n)};`, ctx, { filename: n + '.js' }));
[
  /const SIGN_SEASON = \{\};\nObject\.entries\(SEASONS\)\.forEach[^\n]*/,
  /function seasonOf\([^\n]*/,
  /const relKey = [^\n]*/,
  /const signsOf = [^\n]*/,
  /const esc = [^\n]*/,
  /const firstName = [^\n]*/,
  /const DIM = [^\n]*/,
  /function reduceNum\([^\n]*/,
  /function digitSum\([^\n]*/,
  /function tarotIndex\([^\n]*/,
  /function tarotFor\([^\n]*/,
  /function findPeriod\(month, day\)\{[\s\S]*?\n\}/,
  /function profileOf\(person\)\{[\s\S]*?\n\}/,
].forEach((re) => vm.runInContext(grabFn(re), ctx, { filename: 'page-helper.js' }));
vm.runInContext(ENGINE, ctx, { filename: 'today-engine.js' });

/* The arguments: a date, and optionally a birthday as MM-DD, MM-DD-YYYY. */
const [dateArg, birthArg] = process.argv.slice(2);
const now = dateArg
  ? new Date(+dateArg.slice(0, 4), +dateArg.slice(5, 7) - 1, +dateArg.slice(8, 10))
  : new Date();
let person = 'null';
if(birthArg){
  const [m, d, y] = birthArg.split('-').map(Number);
  person = `{ name: 'You', month: ${m}, day: ${d}, year: ${y || null} }`;
}

const html = vm.runInContext(`todayHtml(todayReading(new Date(${now.getFullYear()}, ${now.getMonth()}, ${now.getDate()}), ${person}))`, ctx);

/* The page's own markup, read as lines of text. Entities are turned back into
   the characters they stand for, because this is being read, not rendered. */
const text = html
  .replace(/<\/(h3|h4|p|div)>/g, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&mdash;/g, '—').replace(/&middot;/g, '·').replace(/&rsquo;/g, '\u2019')
  .replace(/&ldquo;|&rdquo;/g, '"').replace(/&amp;/g, '&').replace(/&hellip;/g, '…')
  .split('\n')
  .map((line) => line.replace(/\s+/g, ' ').trim())
  .filter(Boolean)
  .join('\n\n');
console.log(text);
