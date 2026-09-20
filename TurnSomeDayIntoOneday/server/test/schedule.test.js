// My Schedule — the times he sets for himself, with a calendar and an alarm.
// 19 Sep 2026.
//
// Jacques: "can you put a scheduler with time calendar and alarm in the recovery
// app its own section".
//
// The parts of this that can go wrong quietly are not the drawing, they are the
// rules, and every one of them is a rule about somebody's day:
//
//   1. RINGING TWICE. A time marked as rung after the card is drawn could ring
//      again on the next tick, or after a reload, and an app that buzzes you
//      twice for one thing gets switched off.
//   2. RINGING LATE TO MAKE A POINT. A 7am time ringing at noon because the app
//      was closed is not a reminder, it is a reprimand. Anything older than a
//      few minutes passes quietly and is only ever shown as behind you.
//   3. RINGING ANYWAY. A time switched off has to be off, snooze has to mean ten
//      minutes and not for ever, and a day it does not belong to has to be
//      silent — a weekly Tuesday entry that also fires on Thursday is worse than
//      no alarm at all.
//   4. SAYING THE WORDS. Discretion mode exists because a phone gets handed to
//      somebody. The card, the notification and the row all have to fall back to
//      "A time you set" rather than say what he is doing at seven.
//
// So this runs the shipped block out of index.html in a stub DOM, with the clock
// pinned, and drives the app's own tick. Not a browser: it proves the rules, the
// wording and what gets written down, not the pixels.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const APP = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const START = '// ─── MY SCHEDULE';
const END = '// ─── END OF MY SCHEDULE';

function blockSource() {
  const at = APP.indexOf(START);
  assert.ok(at > -1, 'the schedule block must be in index.html');
  const end = APP.indexOf(END, at);
  assert.ok(end > at, 'the block must end with its own end marker');
  return APP.slice(at, end);
}

// The stub page: only what this block touches, made on demand. `now` pins the
// clock, so the app's own tick can be run at a chosen minute instead of waiting
// for one to come round.
function loadPage(opts) {
  opts = opts || {};
  const els = new Map();
  const mk = (id) => ({
    id, value: '', textContent: '', innerHTML: '', style: {}, checked: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false } },
    addEventListener() {}, setAttribute() {}, getAttribute() { return null },
    focus() {}, blur() {}, onclick: null, disabled: false,
  });
  const handlers = {};
  const doc = {
    hidden: !!opts.hidden,
    getElementById(id) { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); },
    querySelectorAll() { return [] },
    querySelector() { return null },
    addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    createElement() { return mk('_new') },
    body: mk('body'), documentElement: mk('html'), readyState: 'complete',
  };
  const S = Object.assign({ schedule: [], scheduleSnooze: [], discretionMode: false }, opts.state);
  const calls = { save: 0, info: [], notifications: [], intervals: [], confirmAnswer: true };
  const ctx = {
    S, document: doc, navigator: {},
    save() { calls.save++ },
    appInfo(title, body) { calls.info.push([title, body]) },
    sendPhoneNotification(title, body) { calls.notifications.push([title, body]) },
    switchTo() {}, actBn() {},
    confirm() { return calls.confirmAnswer },
    setInterval(fn, ms) { calls.intervals.push([ms, fn]); return calls.intervals.length },
    clearInterval() {},
    console,
  };
  ctx.window = ctx;      // the block reaches for window.AudioContext
  if (opts.notification) ctx.Notification = { permission: opts.notification };
  if (opts.now) {
    const base = opts.now;
    ctx.Date = class extends Date {
      constructor(...args) { if (!args.length) super(base); else super(...args); }
      static now() { return base; }
    };
  }
  vm.createContext(ctx);
  vm.runInContext(blockSource(), ctx, { filename: 'schedule-block.js' });
  return {
    ctx, S, els, doc, handlers, calls,
    run: (src) => vm.runInContext(src, ctx),
    el: (id) => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); },
  };
}

const at = (h, m, d) => new Date(2026, 8, d === undefined ? 15 : d, h, m || 0, 0).getTime();
const daily = (time, extra) => Object.assign({ id: 'e1', what: 'A meeting', time, repeat: 'daily', on: true }, extra);
const entryOf = (p) => p.S.schedule[0];

/* --------------------------------------------------------------- 1. the rules */

test('a time rings on its minute, and inside the few minutes after it', () => {
  const p = loadPage({ state: { schedule: [daily('07:00')] } });
  const due = (ms) => p.run(`scheduleDueAt(S.schedule[0], new Date(${ms}))`);
  assert.equal(due(at(6, 59)), false, 'not a minute early');
  assert.equal(due(at(7, 0)), true, 'on the minute');
  assert.equal(due(at(7, 3)), true, 'and for the three minutes after it');
  assert.equal(due(at(7, 4)), false, 'past the window it passes quietly instead of ringing late');
});

test('the app\'s own tick rings it, once, at the right minute', () => {
  const p = loadPage({ state: { schedule: [daily('07:00', { what: 'A meeting' })] }, now: at(6, 59) });
  p.run('startScheduleTimer()');
  assert.deepEqual(p.calls.intervals.map((i) => i[0]), [20000], 'checked every twenty seconds');
  p.run('scheduleAlarmCheck()');
  assert.equal(p.calls.notifications.length + (p.el('sch-alarm').style.display === 'block' ? 1 : 0), 0,
    'silent at 6:59');
  // The same page, the clock moved on to the minute: the tick fires.
  const q = loadPage({ state: { schedule: [daily('07:00', { what: 'A meeting' })] }, now: at(7, 0) });
  q.run('scheduleAlarmCheck()');
  assert.equal(q.el('sch-alarm').style.display, 'block', 'up at 7:00');
  assert.equal(q.el('sch-alarm-time').textContent, '7:00 am');
  q.run('scheduleAlarmCheck()');
  assert.equal(entryOf(q).lastFired, '2026-09-15', 'and marked rung');
  // A second tick a moment later cannot ring it again.
  const before = q.el('sch-alarm-what').textContent;
  q.run(`S.schedule[0].lastFired='2026-09-15'; scheduleAlarmCheck();`);
  assert.equal(q.el('sch-alarm-what').textContent, before);
});

test('the tick rings one time, and takes the sooner of two', () => {
  const p = loadPage({ state: { schedule: [
    { id: 'later', what: 'Later', time: '07:03', repeat: 'daily', on: true },
    { id: 'sooner', what: 'Sooner', time: '07:00', repeat: 'daily', on: true },
  ] }, now: at(7, 3) });
  p.run('scheduleAlarmCheck()');
  assert.equal(p.el('sch-alarm-what').textContent, 'Sooner', 'the one whose minute came first');
  assert.equal(p.S.schedule.find((e) => e.lastFired).id, 'sooner');
  assert.equal(p.S.schedule.find((e) => e.id === 'later').lastFired, undefined,
    'and the other one is left for the next tick, not rung with it');
});

test('a time that passed while the app was closed does not ring when it opens', () => {
  // 7am went by with the app shut. Opening at 12:30 must not fire a reminder at
  // him for a morning that is over — that is a reprimand, not an alarm.
  const p = loadPage({ state: { schedule: [daily('07:00')] } });
  assert.equal(p.run(`scheduleDue(new Date(${at(12, 30)})).length`), 0);
  assert.equal(p.run(`scheduleDue(new Date(${at(23, 59)})).length`), 0);
  // ...but it is still today's list, said plainly and without comment.
  p.run(`renderScheduleToday(new Date(${at(12, 30)}))`);
  const html = p.el('sch-today').innerHTML;
  assert.match(html, /7:00 am/, 'the time is still shown');
  assert.doesNotMatch(html, /miss|late|overdue|skip|fail/i, 'and nothing is said about it');
});

test('it rings once a day, and again the next day', () => {
  const p = loadPage({ state: { schedule: [daily('07:00')] } });
  p.run(`scheduleRing(S.schedule[0], new Date(${at(7, 0)}))`);
  assert.equal(entryOf(p).lastFired, '2026-09-15', 'marked rung before anything was drawn');
  assert.equal(p.run(`scheduleDueAt(S.schedule[0], new Date(${at(7, 1)}))`), false,
    'the same time cannot ring twice in one day');
  assert.equal(p.run(`scheduleDueAt(S.schedule[0], new Date(${at(7, 0, 16)}))`), true,
    'tomorrow it rings again');
});

test('the words on the row describe exactly the days the rule fires on', () => {
  const p = loadPage({ state: { schedule: [
    { id: 'a', what: 'x', time: '07:00', repeat: 'weekdays', on: true },
    { id: 'b', what: 'x', time: '07:00', repeat: 'weekly', day: 2, on: true },
    { id: 'c', what: 'x', time: '07:00', repeat: 'once', date: '2026-09-17', on: true },
    { id: 'd', what: 'x', time: '07:00', repeat: 'daily', on: true },
  ] } });
  const fires = (i, ms) => p.run(`scheduleMatchesDay(S.schedule[${i}], new Date(${ms}))`);
  assert.deepEqual([fires(0, at(12, 0, 19)), fires(0, at(12, 0, 20)), fires(0, at(12, 0, 21))],
    [false, false, true], 'weekdays: Saturday and Sunday silent, Monday not');
  assert.deepEqual([fires(1, at(12, 0, 15)), fires(1, at(12, 0, 16))], [true, false], 'weekly: Tuesday only');
  assert.deepEqual([fires(2, at(12, 0, 17)), fires(2, at(12, 0, 18))], [true, false], 'one date only');
  assert.equal(fires(3, at(12, 0, 19)), true, 'daily: every day');
  // The label has to name the same day the rule fires on, or the row lies.
  assert.equal(p.run('scheduleRepeatText(S.schedule[1])'), 'Every Tuesday');
  assert.equal(p.run('scheduleRepeatText(S.schedule[0])'), 'Weekdays, Monday to Friday');
  assert.match(p.run('scheduleRepeatText(S.schedule[2])'), /Sep 17/, 'the one-day entry names its date');
  assert.equal(p.run('scheduleRepeatText(S.schedule[3])'), 'Every day');
});

test('an entry that is switched off is off — no ring and no snooze', () => {
  const p = loadPage({ state: {
    schedule: [{ id: 'e1', what: 'x', time: '07:00', repeat: 'daily', on: false }],
    scheduleSnooze: [{ id: 'e1', until: 0 }],
  } });
  assert.equal(p.run(`scheduleDueAt(S.schedule[0], new Date(${at(7, 0)}))`), false);
  assert.equal(p.run(`scheduleSnoozedAt(S.schedule[0], new Date(${at(7, 0)}))`), false,
    'a snooze does not outlive the time being switched off');
  assert.equal(p.run(`scheduleNext(new Date(${at(7, 0)}))`), null, 'and it is not next up either');
});

test('nothing rings without a real time on it', () => {
  const p = loadPage({ state: { schedule: [
    { id: 'a', what: 'x', time: '', repeat: 'daily', on: true },
    { id: 'b', what: 'x', time: '25:00', repeat: 'daily', on: true },
    { id: 'c', what: 'x', repeat: 'daily', on: true },
  ] } });
  for (let i = 0; i < 3; i++) {
    assert.equal(p.run(`scheduleDueAt(S.schedule[${i}], new Date(${at(7, 0)}))`), false);
    assert.equal(typeof p.run(`scheduleTimeLabel(S.schedule[${i}].time)`), 'string', 'and it still prints without throwing');
  }
  assert.equal(p.run('scheduleTimeLabel("")'), '', 'an entry with no time prints nothing rather than "NaN:NaN"');
  assert.equal(p.run('scheduleMinuteOfDay("07:60")'), null);
  assert.equal(p.run('scheduleMinuteOfDay("7:05")'), 425, 'a time typed without the leading zero still counts');
  assert.equal(p.run('scheduleMinuteOfDay("07:05")'), 425);
});

test('snooze is ten minutes, then it rings once more and stops', () => {
  const p = loadPage({ state: { schedule: [daily('07:00')], scheduleSnooze: [] }, now: at(7, 0) });
  p.run(`scheduleRing(S.schedule[0], new Date(${at(7, 0)}))`);
  p.run('scheduleRingSnooze()');
  const snooze = p.S.scheduleSnooze[0];
  assert.equal(snooze.id, 'e1');
  assert.equal(snooze.until - at(7, 0), 10 * 60000, 'ten minutes, not fifteen');
  const due = (ms) => p.run(`scheduleDue(new Date(${ms})).length`);
  assert.equal(due(at(7, 9)), 0, 'quiet before the ten minutes are up');
  assert.equal(due(at(7, 10)), 1, 'and it comes back ten minutes later');
  // Ringing it a second time has to spend the snooze, or it would keep coming
  // back every ten minutes for the rest of the day.
  p.run(`scheduleRing(S.schedule[0], new Date(${at(7, 10)}))`);
  assert.equal(p.S.scheduleSnooze.length, 0, 'the snooze is spent, not kept');
  assert.equal(due(at(7, 20)), 0, 'and it stops');
});

test('the notification goes out only when the app is not being looked at', () => {
  const hidden = loadPage({ state: { schedule: [daily('19:00', { what: 'A meeting' })] }, hidden: true });
  hidden.run(`scheduleRing(S.schedule[0], new Date(${at(19, 0)}))`);
  assert.equal(hidden.el('sch-alarm-time').textContent, '7:00 pm');
  assert.equal(hidden.el('sch-alarm-what').textContent, 'A meeting');
  assert.equal(hidden.calls.notifications.length, 1, 'the phone carries it while the app is in the background');
  assert.match(hidden.calls.notifications[0][0], /7:00 pm — A meeting/);
  assert.equal(hidden.calls.save, 1, 'and it is written down before the card is drawn');

  const open = loadPage({ state: { schedule: [daily('19:00')] }, hidden: false });
  open.run(`scheduleRing(S.schedule[0], new Date(${at(19, 0)}))`);
  assert.equal(open.calls.notifications.length, 0, 'with the app open, a card and a chime is enough');
  assert.equal(open.el('sch-alarm').style.display, 'block');
});

test('discretion mode hides what the time is for, everywhere it is written', () => {
  const p = loadPage({
    state: { schedule: [daily('07:00', { what: 'Call my sponsor' })], discretionMode: true },
    hidden: true,
  });
  assert.equal(p.run('scheduleLabelFor(S.schedule[0])'), 'A time you set');
  p.run(`scheduleRing(S.schedule[0], new Date(${at(7, 0)}))`);
  assert.equal(p.el('sch-alarm-what').textContent, 'A time you set');
  assert.doesNotMatch(p.calls.notifications[0][1], /sponsor/, 'the notification says nothing either');
  assert.match(p.calls.notifications[0][0], /A time you set/);
  p.run(`renderScheduleToday(new Date(${at(8, 0)}))`);
  assert.doesNotMatch(p.el('sch-today').innerHTML, /sponsor/);
});

test('an empty name is a time you set, not a blank row', () => {
  const p = loadPage({ state: { schedule: [daily('07:00', { what: '   ' })] } });
  assert.equal(p.run('scheduleLabelFor(S.schedule[0])'), 'A time you set');
  const q = loadPage({ });
  assert.equal(q.run('scheduleLabelFor({id:"x"})'), 'A time you set', 'and never the word undefined');
});

test('nothing on this screen keeps score', () => {
  const blame = /missed|failed|skipped|overdue|streak|you were late|kept it|broke it/i;
  const p = loadPage({ state: { schedule: [
    daily('07:00', { lastFired: '2026-09-15' }),
    { id: 'e2', what: 'A meeting', time: '21:00', repeat: 'daily', on: false },
  ] } });
  p.run('renderSchedule()');
  for (const id of ['sch-today', 'sch-list', 'sch-next-title', 'sch-next-sub', 'sch-day']) {
    const el = p.el(id);
    assert.doesNotMatch(String(el.innerHTML || el.textContent || ''), blame, id + ' blames nobody');
  }
  const screen = screenSource();
  assert.doesNotMatch(screen, blame);
  assert.match(screen, /Nothing here keeps score/, 'it says so out loud');
});

test('the screen says plainly that a closed app cannot be woken', () => {
  const screen = screenSource();
  assert.match(screen, /completely closed cannot be woken/, 'no pretending otherwise');
  assert.match(screen, /other tab/, 'and it says what it does cover');
});

function screenSource() {
  const from = APP.indexOf('<div id="s-schedule"');
  assert.ok(from > -1, 'the screen is in the app');
  return APP.slice(from, APP.indexOf('</div>', APP.indexOf('Back to Tools', from)));
}

/* ---------------------------------------------------- 2. the calendar and next */

test('the calendar is a real month, six weeks long, weeks starting Sunday', () => {
  const p = loadPage({});
  const cells = p.run('scheduleMonthGrid(2026,8)');
  assert.equal(cells.length, 42, 'six rows always, so the grid cannot jump about');
  const inMonth = cells.filter((c) => c.inMonth);
  assert.equal(inMonth.length, 30, 'September has thirty days');
  assert.equal(inMonth[0].day, 1);
  assert.equal(inMonth[29].day, 30);
  cells.forEach((c, i) => assert.equal(c.weekday, i % 7, 'every cell sits in its own day column'));
  assert.equal(cells.findIndex((c) => c.inMonth), new Date(2026, 8, 1).getDay(),
    'the 1st lands on the weekday it really is');
  assert.equal(p.run('scheduleMonthGrid(2028,1)').filter((c) => c.inMonth).length, 29, 'February 2028 has 29 days');
  assert.equal(p.run('scheduleMonthGrid(2027,1)').filter((c) => c.inMonth).length, 28);
  assert.equal(p.run('scheduleMonthGrid(2026,11)').filter((c) => c.inMonth).length, 31);
});

test('a day on the calendar carries the times that really fall on it', () => {
  const p = loadPage({ state: { schedule: [
    { id: 'a', what: 'A', time: '07:00', repeat: 'weekdays', on: true },
    { id: 'b', what: 'B', time: '21:00', repeat: 'daily', on: true },
    { id: 'c', what: 'C', time: '12:00', repeat: 'weekly', day: 2, on: true },
    { id: 'd', what: 'D', time: '18:00', repeat: 'daily', on: false },
  ] } });
  const names = (key) => p.run(`scheduleDayEntries('${key}').map(e=>e.id).join(',')`);
  assert.equal(names('2026-09-15'), 'a,c,d,b',
    'Tuesday: the weekday one, the weekly one, the switched-off one (shown, marked off) and the daily one, in time order');
  assert.equal(names('2026-09-19'), 'd,b',
    'Saturday: the weekdays one and the weekly Tuesday one are not there, the two daily ones are');
  const dots = p.run(`scheduleDayEntries('2026-09-19').filter(scheduleOn).length`);
  assert.equal(dots, 1, 'and the dot on the calendar counts only what is switched on');
});

test('next up is the soonest one, and never one that has already rung', () => {
  const p = loadPage({ state: { schedule: [
    { id: 'evening', what: 'Wind down', time: '21:00', repeat: 'daily', on: true },
    { id: 'morning', what: 'A meeting', time: '07:00', repeat: 'daily', on: true },
  ] } });
  const next = (ms) => p.run(`(function(){var n=scheduleNext(new Date(${ms}));return n?n.entry.id+'@'+n.at.getTime():'none'})()`);
  assert.match(next(at(6, 0)), /^morning@/, 'in the morning the next one is the morning one');
  assert.match(next(at(12, 0)), /^evening@/, 'by midday it is the evening one');
  // 21:30: today is done, so it rolls to tomorrow's 7am rather than showing a
  // time that has been and gone.
  const rolled = next(at(21, 30));
  assert.match(rolled, /^morning@/);
  assert.equal(new Date(Number(rolled.split('@')[1])).getDate(), 16, 'tomorrow');
  // A weekly Tuesday entry on a Tuesday afternoon is seven days out, and a
  // weekday entry at the same time is tomorrow — the sooner one wins.
  const q = loadPage({ state: { schedule: [
    { id: 'mon', what: 'x', time: '07:00', repeat: 'weekdays', on: true },
    { id: 'tue', what: 'x', time: '07:00', repeat: 'weekly', day: 2, on: true },
  ] } });
  assert.match(q.run(`(function(){var n=scheduleNext(new Date(${at(12, 0)}));return n.entry.id+'@'+n.at.getDate()})()`),
    /mon@16/, 'Wednesday morning is sooner than next Tuesday');
  const only = loadPage({ state: { schedule: [
    { id: 'tue', what: 'x', time: '07:00', repeat: 'weekly', day: 2, on: true },
  ] } });
  assert.match(only.run(`(function(){var n=scheduleNext(new Date(${at(12, 0)}));return n.entry.id+'@'+n.at.getDate()})()`),
    /tue@22/, 'and on its own it is next Tuesday, seven days out');
  const none = loadPage({ state: { schedule: [{ id: 'x', what: 'x', time: '07:00', repeat: 'once', date: '2026-01-01', on: true }] } });
  assert.equal(none.run(`scheduleNext(new Date(${at(12, 0)}))`), null, 'a spent one-day entry is not next up');
});

test('the countdown reads the way a person would say it', () => {
  const p = loadPage({});
  const inText = (mins) => p.run(`scheduleInText(${mins * 60000})`);
  assert.equal(inText(0), 'any minute now');
  assert.equal(inText(12), 'in 12 min');
  assert.equal(inText(59), 'in 59 min');
  assert.equal(inText(60), 'in 1h');
  assert.equal(inText(125), 'in 2h 5m');
  assert.equal(inText(60 * 24), 'in a day');
  assert.equal(inText(60 * 24 * 3), 'in 3 days');
});

test('the next-up line names the time, the entry and how far off it is', () => {
  const p = loadPage({ state: { schedule: [daily('21:00', { what: 'Wind down' })] } });
  p.run(`renderScheduleNext(new Date(${at(19, 30)}))`);
  assert.equal(p.el('sch-next-time').textContent, '9:00 pm');
  assert.equal(p.el('sch-next-title').textContent, 'Wind down');
  assert.match(p.el('sch-next-sub').textContent, /in 1h 30m/);
  assert.match(p.el('sch-next-sub').textContent, /Today/);
  assert.match(p.el('sch-next-sub').textContent, /Every day/);
  // With nothing set, the line says so rather than showing a dash and no words.
  const q = loadPage({});
  q.run(`renderScheduleNext(new Date(${at(19, 30)}))`);
  assert.equal(q.el('sch-next-title').textContent, 'Nothing set yet');
});

/* ------------------------------------------------------------- 3. setting one */

test('setting a time writes it down and clears the form', () => {
  const p = loadPage({ now: at(12, 0) });
  p.el('sch-form-what').value = 'A meeting';
  p.el('sch-form-time').value = '07:30';
  p.el('sch-form-repeat').value = 'weekdays';
  p.run('scheduleSave()');
  assert.equal(p.S.schedule.length, 1);
  const e = p.S.schedule[0];
  assert.equal(e.what, 'A meeting');
  assert.equal(e.time, '07:30');
  assert.equal(e.repeat, 'weekdays');
  assert.equal(e.on, true);
  assert.ok(e.id, 'every entry has an id to ring by');
  assert.equal(p.el('sch-form-what').value, '', 'the form is ready for the next one');
  assert.equal(p.el('sch-form-time').value, '13:00', 'and offers the next hour rather than the one just used');
  assert.equal(p.calls.save, 1, 'written to the saved state');
});

test('a time with no time on it is refused rather than saved', () => {
  const p = loadPage({ now: at(12, 0) });
  p.el('sch-form-what').value = 'A meeting';
  p.el('sch-form-time').value = '';
  p.run('scheduleSave()');
  assert.equal(p.S.schedule.length, 0);
  assert.equal(p.calls.info.length, 1, 'and it says why, in the app\'s own popup');
  assert.match(p.calls.info[0][0], /time/i);
  assert.equal(p.calls.save, 0);
});

test('a name he does not type is filled in with the app\'s own words', () => {
  const p = loadPage({ now: at(12, 0) });
  p.el('sch-form-time').value = '20:00';
  p.run('scheduleSave()');
  assert.equal(p.S.schedule[0].what, 'A time you set');
  assert.equal(p.run('scheduleLabelFor(S.schedule[0])'), 'A time you set');
});

test('one day a week keeps its day, and one day only keeps its date', () => {
  const p = loadPage({ now: at(12, 0) });
  p.el('sch-form-time').value = '12:00';
  p.el('sch-form-repeat').value = 'weekly';
  p.el('sch-form-day').value = '4';
  p.run('scheduleSave()');
  assert.equal(p.S.schedule[0].day, 4);
  assert.equal(p.S.schedule[0].date, undefined, 'a weekly entry does not carry a date as well');
  p.el('sch-form-time').value = '08:00';
  p.el('sch-form-repeat').value = 'once';
  p.el('sch-form-date').value = '2026-10-02';
  p.run('scheduleSave()');
  assert.equal(p.S.schedule[1].date, '2026-10-02');
  assert.equal(p.S.schedule[1].repeat, 'once');
});

test('changing a time keeps it switched on and keeps what it had already done', () => {
  const p = loadPage({ state: { schedule: [daily('07:00', { lastFired: '2026-09-15', doneOn: '2026-09-14' })] }, now: at(12, 0) });
  p.run('scheduleEdit("e1")');
  assert.equal(p.el('sch-form-what').value, 'A meeting', 'the form is filled with what is there');
  assert.equal(p.el('sch-form-time').value, '07:00');
  assert.match(p.el('sch-editing').textContent, /7:00 am/);
  p.el('sch-form-time').value = '08:15';
  p.run('scheduleSave()');
  assert.equal(p.S.schedule.length, 1, 'changed, not added');
  assert.equal(p.S.schedule[0].time, '08:15');
  assert.equal(p.S.schedule[0].lastFired, '2026-09-15', 'and it does not become due again by being edited');
  assert.equal(p.S.schedule[0].doneOn, '2026-09-14');
  assert.equal(p.el('sch-editing').style.display, 'none', 'the changing note goes away');
});

test('switching one off holds, and takes its snooze with it', () => {
  const p = loadPage({ state: { schedule: [daily('07:00')], scheduleSnooze: [{ id: 'e1', until: 0 }] } });
  p.run('scheduleToggle("e1")');
  assert.equal(p.S.schedule[0].on, false);
  assert.equal(p.S.scheduleSnooze.length, 0, 'a time switched off cannot ring from a snooze it was given');
  assert.equal(p.calls.save, 1);
  p.run('scheduleToggle("e1")');
  assert.equal(p.S.schedule[0].on, true, 'and it comes back on');
});

test('deleting asks first, and does nothing if he says no', () => {
  const p = loadPage({ state: { schedule: [daily('07:00')] }, now: at(12, 0) });
  p.calls.confirmAnswer = false;
  p.run('scheduleDelete("e1")');
  assert.equal(p.S.schedule.length, 1, 'a no means nothing happened');
  assert.equal(p.calls.save, 0);
  p.calls.confirmAnswer = true;
  p.run('scheduleDelete("e1")');
  assert.equal(p.S.schedule.length, 0);
  assert.equal(p.calls.save, 1);
});

test('Done on the card marks it done for the day, and only for today', () => {
  const p = loadPage({ state: { schedule: [daily('07:00')] }, now: at(7, 0) });
  p.run('scheduleAlarmCheck()');
  assert.equal(p.el('sch-alarm').style.display, 'block');
  p.run('scheduleRingDone()');
  assert.equal(p.S.schedule[0].doneOn, '2026-09-15');
  assert.equal(p.el('sch-alarm').style.display, 'none', 'the card is put away');
  assert.match(p.el('sch-today').innerHTML, /Done for today/);
  // Tomorrow it is not done any more, and it was never a tick that carries over.
  p.run(`renderScheduleToday(new Date(${at(7, 0, 16)}))`);
  assert.doesNotMatch(p.el('sch-today').innerHTML, /Done for today/);
});

test('Not now puts the card away and says nothing else about it', () => {
  const p = loadPage({ state: { schedule: [daily('07:00')] }, now: at(7, 0) });
  p.run('scheduleAlarmCheck()');
  p.run('scheduleRingLater()');
  assert.equal(p.el('sch-alarm').style.display, 'none');
  assert.equal(p.S.schedule[0].doneOn, undefined, 'nothing is ticked off on his behalf');
  assert.equal(p.S.schedule[0].lastFired, '2026-09-15', 'but it is not going to ring again today either');
  assert.equal(p.calls.info.length, 0, 'and nothing is said about it');
});

test('the notification row says which of the three states it is in', () => {
  const granted = loadPage({ notification: 'granted' });
  granted.run('updateScheduleNotifRow()');
  assert.match(granted.el('sch-notif-sub').textContent, /On — the phone/);
  const denied = loadPage({ notification: 'denied' });
  denied.run('updateScheduleNotifRow()');
  assert.match(denied.el('sch-notif-sub').textContent, /Blocked/);
  const none = loadPage({});
  none.run('updateScheduleNotifRow()');
  assert.match(none.el('sch-notif-sub').textContent, /Not supported/);
  const ask = loadPage({ notification: 'default' });
  ask.run('updateScheduleNotifRow()');
  assert.match(ask.el('sch-notif-sub').textContent, /Tap to allow/);
});

/* ------------------------------------------------------------- 4. the wiring */

test('the screen is registered like every other screen, with a way in', () => {
  assert.match(APP, /const SCREEN_MAP=\{[\s\S]{0,900}schedule:'s-schedule'/, 'or switchTo would blank the page;');
  assert.match(APP, /const TITLES=\{\n  schedule:'My schedule',/, 'and the header would say "schedule"');
  assert.match(APP, /const SCREEN_TO_BN=\{schedule:'bn-tools'/, 'the Tools tab lights while it is open');
  assert.match(APP, /  schedule:'bn-tools'\};/, 'and back knows which tab to light');
  assert.match(APP, /if\(id==='schedule'\)\{renderSchedule\(\)/, 'opening it draws it');
  assert.match(APP, /startLessonReminderTimer\(\);\n  startScheduleTimer\(\);/, 'the alarm timer starts with the app');
  assert.match(APP, /document\.addEventListener\('visibilitychange',\(\)=>\{ if\(!document\.hidden\)scheduleAlarmCheck\(\); \}\);/,
    'and again the moment the app comes back to the front');
  assert.match(APP, /schedule:\[\],scheduleSnooze:\[\],/, 'the times are in the saved state');
  // Two ways in — Tools (its own section) and Reminder Settings — plus the
  // function itself. Three mentions, or a door has gone missing.
  assert.equal(APP.split('openSchedule()').length - 1, 3);
  assert.match(APP, /<p>My schedule<\/p>/);
});

test('the alarm card sits outside every screen, and the icons it uses can draw', () => {
  const card = APP.indexOf('id="sch-alarm"');
  assert.ok(card > -1, 'the card is in the page');
  assert.ok(card > APP.indexOf('<!-- /screens -->'), 'outside the screens, so it can ring over any of them');
  // Every class this section draws with has to be in ICON_PATHS, or it renders
  // as an invisible box — the fault that hid the header back arrow.
  const from = APP.indexOf(START);
  const used = new Set();
  for (const m of APP.slice(from).matchAll(/class="ti (ti-[a-z0-9-]+)"/g)) used.add(m[1]);
  const mapAt = APP.indexOf('const ICON_PATHS=');
  const icons = new Set([...APP.slice(mapAt, APP.indexOf('</script>', mapAt)).matchAll(/'((?:ti-)?[a-z0-9-]+)'\s*:/g)].map((m) => m[1]));
  for (const name of used) assert.ok(icons.has(name), name + ' has no drawing and would be invisible');
  assert.ok(used.size >= 4, 'the section draws a few icons: ' + [...used].join(', '));
});

test('every row drawn after boot has its icon drawn too, or it is a blank box', () => {
  // The header back arrow shipped invisible because an <i class="ti"> built
  // after renderIcons() has run draws nothing. Every screen here is built that
  // way, so each painter has to hand its containers back to the icon pass.
  const block = blockSource();
  assert.match(block, /function scheduleIcons\(\)/);
  assert.match(block, /renderIcons\(el\)/, 'through the app\'s own icon pass, not a second copy of it');
  for (const fn of ['renderSchedule', 'renderScheduleToday', 'renderScheduleList', 'renderScheduleDay']) {
    const from = block.indexOf('function ' + fn + '(');
    assert.ok(from > -1, fn + ' is in the block');
    const body = block.slice(from);
    assert.match(body.slice(0, body.indexOf('\n}')), /scheduleIcons\(\)/, fn + ' draws its own icons');
  }
});

// The number itself is Jacques's to pick, and on 20 Sep 2026 he took it back to
// 5.0 — so this no longer records a version that only ever goes up. What it
// still holds is that the schedule work and the version it shipped under went
// together, and that index.html and the service worker carry the same one.
test('the app and the service worker carry the same version', () => {
  const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const ver = APP.match(/const APP_VERSION='([\d.]+)';/);
  assert.ok(ver, 'index.html must declare APP_VERSION');
  assert.match(SW, new RegExp("CACHE_NAME = 'tsid-shell-v" + ver[1].replace(/\./g, '\\.') + "';"));
});
