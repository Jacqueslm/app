const { test } = require('node:test');
const assert = require('node:assert');
const { stockQueriesFrom, stockQueryFrom, stockWordsFromName } = require('../stock-query');

test('a panel name loses its number and separators', () => {
  assert.strictEqual(stockWordsFromName('01_sofa'), 'sofa');
  assert.strictEqual(stockWordsFromName('07_toywheel'), 'toywheel');
  assert.strictEqual(stockWordsFromName('10-set-down.png'), 'set down');
  assert.strictEqual(stockWordsFromName('04_kitchenTable'), 'kitchen table');
});

test('the panel name leads, because it names a subject', () => {
  // "I wasn't doing anything bad" is a feeling and finds nothing; "sofa" finds
  // footage. The name has to come first in the query.
  const q = stockQueryFrom('01_sofa', "I wasn't doing anything bad.");
  assert.ok(q.startsWith('sofa'), `expected to lead with the subject, got "${q}"`);
});

test('character names never reach the search', () => {
  // No stock library has your HECTOR in it. Caps is how a plan writes a person.
  const q = stockQueryFrom('05_driveway', 'HECTOR alone in a parked car, engine off');
  assert.ok(!/hector/i.test(q), `character name leaked into "${q}"`);
  assert.ok(q.includes('driveway'));
});

test('a row with no name falls back to the narration', () => {
  const q = stockQueryFrom('03', 'A wall clock in a dark room reading 1:40');
  assert.ok(q.includes('wall') || q.includes('clock'), `lost the subject: "${q}"`);
});

test('the name and the narration are never merged into one query', () => {
  // "drive nobody calls addiction" was the old behaviour and found nothing.
  // They have to stay separate attempts, best guess first.
  const tries = stockQueriesFrom('01_drive', 'Nobody calls this an addiction.');
  assert.strictEqual(tries[0], 'drive');
  assert.ok(!tries.some((q) => q.split(' ').length > 3), `a query got too long: ${JSON.stringify(tries)}`);
  assert.ok(!tries.includes(''), 'empty attempt');
});

test('a glued name gets a second chance from the narration', () => {
  // "toywheel" is not a word any library indexes, so there has to be a fallback.
  const tries = stockQueriesFrom('07_toywheel', 'Then I saw him hold a wheel like that.');
  assert.strictEqual(tries[0], 'toywheel');
  assert.ok(tries.length > 1, 'no fallback for a name that will not match');
  assert.ok(tries.some((q) => q.includes('wheel')), `lost the subject: ${JSON.stringify(tries)}`);
});

test('words true of every shot are dropped', () => {
  const q = stockQueryFrom('', 'Close on the wide shot of a calendar');
  assert.ok(!/\b(close|wide|shot)\b/.test(q), `filler survived in "${q}"`);
  assert.ok(q.includes('calendar'));
});

test('a row with nothing in it returns nothing, rather than a bad search', () => {
  assert.deepStrictEqual(stockQueriesFrom('', ''), []);
  assert.deepStrictEqual(stockQueriesFrom('09', 'It is.'), []);
  assert.strictEqual(stockQueryFrom('', ''), '');
});

test('narration verbs never become the search', () => {
  // "That's what makes it hard" describes no picture. Every word in it is out,
  // so the row falls back to its name rather than searching for a feeling.
  const tries = stockQueriesFrom('09_setdown', "That's what makes it hard.");
  assert.deepStrictEqual(tries, ['setdown']);
});
