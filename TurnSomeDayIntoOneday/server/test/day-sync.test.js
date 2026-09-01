// Every number on Home that claims to be "days" must mean the same thing.
//
// Jacques, 1 Sep 2026, running three tracks at once: Home read
//   "Days binge-free / 9 / Anger & Control · Since August 22, 2026"
// with a chip two lines below saying "Food / Binging · 0d". The number and the
// "Since" line came from masterTrack() - the longest-running track - while the
// label came from recoveryTerm(), which follows whichever track's lessons are
// open. One counter, two different habits.
//
// He also does two or three lessons a day, so lesson position runs ahead of the
// calendar on purpose. That is by design; what is NOT allowed is anything
// calling a lesson number a day count.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

test('the counter label follows the track the counter is counting', () => {
  assert.match(APP, /function counterTerm\(\)\{[\s\S]*?masterTrack\(\)[\s\S]*?m\.mixed/,
    'counterTerm must read masterTrack, the same source as the number');
  const fn = APP.match(/function updateRecoveryTermLabels\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(fn, /const term=counterTerm\(\);/,
    'the Home labels must use counterTerm, not recoveryTerm');
  assert.doesNotMatch(fn, /=recoveryTerm\(\)/,
    'recoveryTerm follows the lesson track and must not label the counter');
});

test('the number, the Since line and the label all come from masterTrack', () => {
  const render = APP.slice(APP.indexOf("document.getElementById('dayCount').textContent=days;"),
                           APP.indexOf("document.getElementById('h-hours')"));
  assert.match(render, /const mt=masterTrack\(\);/);
  assert.match(render, /mt\.name\+' \\u00b7 '\+sinceTxt/, 'the Since line names the counted track');
});

test('the bootcamp line stays lesson progress, and says so', () => {
  // Deliberately different from the day count - someone doing three lessons a
  // day is further through the programme than the calendar.
  assert.match(APP, /const bootcampDay=getLessonDayFor\(S\.currentAddiction\);/);
  assert.match(APP, /Position in the Bootcamp is LESSON progress, not the calendar/);
});

test('the AI is handed the day number, never left to work it out', () => {
  // It used to get only "Sober Since: <date>" and a list of lesson numbers,
  // then had to do the arithmetic itself - which is how it ended up saying a
  // different day to the one on screen.
  assert.match(APP, /DAY COUNT SHOWN ON THEIR SCREEN RIGHT NOW/);
  assert.match(APP, /Use THIS number if you mention how many days they have/);
  assert.match(APP, /Do NOT work it out from the date yourself/);
  assert.match(APP, /Days per track: /, 'and the per-track days, so it cannot mix them up');
});

test('the AI is told lesson numbers are not day numbers', () => {
  assert.match(APP, /never call a lesson number a day/);
  assert.match(APP, /\$\{a\} lesson \$\{getLessonDayFor\(a\)\}/,
    'the per-track line says "lesson N", not "day N"');
});

test('the AI profile names the counted track, not the lesson track', () => {
  assert.match(APP, /\$\{capitalize\(counterTerm\(\)\)\} Since:/);
});
