const { test } = require('node:test');
const assert = require('node:assert');
const { pickPython } = require('../voiceclone');

const py = (minor, cmd = `python3.${minor}`) => ({ cmd, args: [], minor, version: `3.${minor}` });

test('nothing found stays nothing found', () => {
  assert.strictEqual(pickPython([]), null);
  assert.strictEqual(pickPython(null), null);
});

test('prefers the newest version the speech engine still builds for', () => {
  // The failure this prevents: picking 3.14 because it answered first, then
  // dying ten minutes into the download with "no matching distribution found
  // for torch" — which reads as a broken app, not a wrong Python.
  assert.strictEqual(pickPython([py(14), py(12), py(13), py(9)]).minor, 13);
});

test('a too-new Python is only used when it is all there is', () => {
  // Refusing outright would be worse: torch may well have caught up by then.
  // Try, and let the real error speak if it has not.
  assert.strictEqual(pickPython([py(16), py(14), py(15)]).minor, 14);
});

test('one supported Python is chosen even beside newer ones', () => {
  assert.strictEqual(pickPython([py(17), py(11)]).minor, 11);
});

test('the winner keeps the command that found it', () => {
  // Windows finds these as `py -3.13` or a full path; losing that means the
  // install runs against a different Python than the one we probed.
  const chosen = pickPython([
    { cmd: 'py', args: ['-3.14'], minor: 14, version: '3.14' },
    { cmd: 'C:\\Python313\\python.exe', args: [], minor: 13, version: '3.13' },
  ]);
  assert.strictEqual(chosen.cmd, 'C:\\Python313\\python.exe');
  assert.deepStrictEqual(chosen.args, []);
});
