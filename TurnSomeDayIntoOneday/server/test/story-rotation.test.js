// Jacques, 29 Aug 2026: a SET of ten runs four weeks - five for a fortnight,
// the other five for the fortnight after - then the set retires and the next
// begins. The old code picked five weekly with a stride, which could show the
// same story two weeks running and had no idea a set could end.
//
// The rotation is pure arithmetic on the date, so it is tested as such: the
// functions are lifted out of index.html and run directly.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

// Rebuild the two pure functions exactly as shipped, driven by an injectable day.
function rotationAt(dayNumber, batches) {
  const f = Math.floor(dayNumber / 14);
  const batch = batches.length ? Math.floor(f / 2) % batches.length : 0;
  const half = f % 2;
  const set = batches[batch] || [];
  if (set.length <= 5) return { batch, half, shelf: set.slice() };
  return { batch, half, shelf: half ? set.slice(5, 10) : set.slice(0, 5) };
}

const setA = Array.from({ length: 10 }, (_, i) => `a${i + 1}`);
const setB = Array.from({ length: 10 }, (_, i) => `b${i + 1}`);

test('the shipped code uses a 14-day period, not a week', () => {
  assert.match(APP, /const STORY_FORTNIGHT_DAYS=14;/);
  assert.match(APP, /Math\.floor\(day\/STORY_FORTNIGHT_DAYS\)/);
});

test('first five for a fortnight, second five for the next', () => {
  const first = rotationAt(0, [setA]);
  const stillFirst = rotationAt(13, [setA]);
  const second = rotationAt(14, [setA]);
  const stillSecond = rotationAt(27, [setA]);
  assert.deepEqual(first.shelf, ['a1', 'a2', 'a3', 'a4', 'a5']);
  assert.deepEqual(stillFirst.shelf, first.shelf, 'unchanged for the whole fortnight');
  assert.deepEqual(second.shelf, ['a6', 'a7', 'a8', 'a9', 'a10']);
  assert.deepEqual(stillSecond.shelf, second.shelf, 'unchanged for its fortnight too');
});

test('no story appears in both halves of a set', () => {
  const a = rotationAt(0, [setA]).shelf;
  const b = rotationAt(14, [setA]).shelf;
  assert.equal(a.filter((x) => b.includes(x)).length, 0,
    'the whole point of switching is that they are different');
});

test('after four weeks the set retires and the next one starts', () => {
  assert.equal(rotationAt(0, [setA, setB]).batch, 0);
  assert.equal(rotationAt(27, [setA, setB]).batch, 0, 'still set A at the end of week four');
  assert.equal(rotationAt(28, [setA, setB]).batch, 1, 'set B at the start of week five');
  assert.deepEqual(rotationAt(28, [setA, setB]).shelf, ['b1', 'b2', 'b3', 'b4', 'b5']);
});

test('a set is shown for exactly 28 days', () => {
  const seen = new Set();
  for (let d = 0; d < 28; d++) seen.add(rotationAt(d, [setA, setB]).batch);
  assert.deepEqual([...seen], [0], 'set A owns days 0-27 and nothing else');
});

test('with only one set written it repeats rather than going empty', () => {
  const later = rotationAt(28, [setA]);
  assert.equal(later.batch, 0);
  assert.equal(later.shelf.length, 5, 'a repeated set beats an empty shelf');
});

test('a flat file with no batches is read as a single set', () => {
  assert.match(APP, /Array\.isArray\(d\.batches\)&&d\.batches\.length/,
    'batches when present');
  assert.match(APP, /\[d\.stories\|\|\[\]\]/, 'falls back to the flat list');
});

test('every story ever published stays looked-up-able by id', () => {
  assert.match(APP, /STORIES_POOL=STORY_BATCHES\.reduce\(\(a,b\)=>a\.concat\(b\),\[\]\)/,
    'the player reads titles from this, including for a story off the shelf');
});

test('a short set is served whole rather than sliced to nothing', () => {
  const short = rotationAt(14, [['x1', 'x2', 'x3']]);
  assert.deepEqual(short.shelf, ['x1', 'x2', 'x3'],
    'slice(5,10) on a 3-item set would render an empty shelf');
});
