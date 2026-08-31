// The guide bot's "go" buttons.
//
// Every FAQ answer can carry a `go:` label, and guideGoName looks that label
// up in HELP_INDEX by name or baseName. When the label matches nothing the
// lookup returns -1 and the button silently does nothing - no error, no
// navigation, just a dead button on the one screen built for people who are
// already lost. Eight of them were dead (Reminder sound, Focus areas x5,
// Update the app, Lesson Library) because the destinations had been renamed
// and the answers were never repointed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

const faqGoLabels = () => {
  const block = APP.slice(APP.indexOf('const GUIDE_FAQ=['));
  const end = block.indexOf('\n];');
  return [...block.slice(0, end).matchAll(/go:'((?:[^'\\]|\\.)*)'/g)].map(m => m[1].replace(/\\'/g, "'"));
};
const helpNames = () => {
  const block = APP.slice(APP.indexOf('const HELP_INDEX=['));
  const end = block.indexOf('\n];');
  return new Set([...block.slice(0, end).matchAll(/(?:name|baseName):'((?:[^'\\]|\\.)*)'/g)]
    .map(m => m[1].replace(/\\'/g, "'")));
};

test('every guide answer button goes somewhere that exists', () => {
  const names = helpNames();
  const dead = faqGoLabels().filter(g => !names.has(g));
  assert.deepEqual(dead, [], `dead guide buttons: ${dead.join(', ')}`);
});

test('the guide bot knows about the Game tab', () => {
  // The Game tab shipped without ever being added to the guide, so "what is
  // the game tab" had no answer and no destination.
  assert.match(APP, /\{q:'What is the Game tab\?'/);
  assert.ok(helpNames().has('2AM (the Game tab)'), 'and it is a destination you can be sent to');
  assert.ok(helpNames().has('The Climb'), 'so is The Climb, which lives on the same screen');
});

test('the guide bot does not point at anything that was removed', () => {
  const block = APP.slice(APP.indexOf('const GUIDE_FAQ=['), APP.indexOf('const HELP_INDEX=['));
  assert.doesNotMatch(block, /The Count|boxing|the fight card/i,
    'the boxing game was removed - the guide must not still describe it');
});
