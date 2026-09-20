#!/usr/bin/env node
/* Put "My schedule" into the recovery app.
 *
 * WHY A SCRIPT AND NOT A DIRECT EDIT: index.html is 988KB and the developer file
 * tools read a truncated copy of it, so any find-and-replace past the first part
 * of the page silently fails to match — that is what happened with the back-arrow
 * icon, the Zodiacs player and the Profile install row, all of which went in this
 * way. Safe to run more than once: every step checks whether its change is
 * already there and skips it.
 *
 *   node tools/apply-schedule.js
 *
 * Jacques, 19 Sep 2026: "can you put a scheduler with time calendar and alarm in
 * the recovery app its own section".
 *
 * What goes in:
 *   1. the styles for the screen, the calendar and the alarm card;
 *   2. the screen itself, its own section, nothing else on it;
 *   3. the alarm card, OUTSIDE every screen, so it can ring over whatever is open;
 *   4. a way in from Tools — its own section, "Your time" — and from Reminder
 *      Settings, where the bell in the header already leads;
 *   5. the code, ahead of the SAVE TO MY PHONE block so boot reads as one run of
 *      definitions and nothing is inserted between that block and the BOOT banner
 *      (tools/apply-install-row.js checks its own position against that banner and
 *      would move itself if this landed in between);
 *   6. the wiring: SCREEN_MAP, TITLES, the bottom-nav maps, the refresh on open,
 *      the timer started at boot, and the two arrays in the saved state;
 *   7. the version, to 7.10, in index.html and in the service worker cache name.
 *
 * Applied long ago, so step 7 no longer moves anything — see the note over the
 * version block at the bottom. The version is moved by
 * tools/apply-app-version.js now, which takes the number you give it instead of
 * one written in here.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const BLOCK = path.join(__dirname, 'schedule-block.js');

let page = fs.readFileSync(PAGE, 'utf8');
const done = [];

function once(name, marker, apply) {
  if (marker && page.includes(marker)) { done.push(name + ': already there'); return; }
  const next = apply(page);
  if (next === page) throw new Error(name + ': could not find what to change — refusing to guess');
  page = next;
  done.push(name + ': applied');
}
// Insert `text` immediately before the first occurrence of `anchor`, with the
// anchor required to be unique so a wrong guess throws instead of patching the
// wrong part of the page.
function before(name, anchor, text, alreadyMarker) {
  once(name, alreadyMarker, (p) => {
    const first = p.indexOf(anchor);
    if (first === -1) return p;
    if (p.indexOf(anchor, first + 1) !== -1) throw new Error(name + ': the anchor is not unique');
    return p.slice(0, first) + text + p.slice(first);
  });
}
function after(name, anchor, text, alreadyMarker) {
  once(name, alreadyMarker, (p) => {
    const first = p.indexOf(anchor);
    if (first === -1) return p;
    if (p.indexOf(anchor, first + 1) !== -1) throw new Error(name + ': the anchor is not unique');
    return p.slice(0, first + anchor.length) + text + p.slice(first + anchor.length);
  });
}
function replaceOnce(name, from, to, alreadyMarker) {
  once(name, alreadyMarker, (p) => {
    const first = p.indexOf(from);
    if (first === -1) return p;
    if (p.indexOf(from, first + 1) !== -1) throw new Error(name + ': the text is not unique');
    return p.slice(0, first) + to + p.slice(first + from.length);
  });
}

/* ------------------------------------------------------------ 1. the styles */
const CSS = [
  '',
  '/* MY SCHEDULE (19 Sep 2026) — his own times, a month calendar and an alarm that',
  '   rings. Its own section: reached from Tools, from the bell in the header, and',
  '   from Reminder Settings. .sch-* so nothing here can collide with the rest. */',
  '.sch-next{display:flex;align-items:center;gap:12px;background:var(--s2);border:1px solid var(--bdr);border-radius:14px;padding:12px}',
  '.sch-next .sch-time{font-size:1.0625rem}',
  '.sch-time{font-variant-numeric:tabular-nums;font-weight:650;color:var(--tp);font-size:.9375rem;min-width:76px}',
  '.sch-what{flex:1;min-width:0;font-size:.9375rem;color:var(--tp);line-height:1.35}',
  '.sch-what p{margin:0;font-weight:650;font-size:1rem;color:var(--tp)}',
  '.sch-what span{display:block;font-size:.75rem;color:var(--tm);margin-top:2px}',
  '.sch-meta{font-size:.75rem;color:var(--tm);margin-top:2px}',
  '.sch-row{display:flex;align-items:center;gap:10px;background:var(--s2);border:1px solid var(--bdr);border-radius:12px;padding:10px 12px;margin-bottom:8px}',
  '.sch-row.off{opacity:.55}',
  '.sch-row.done .sch-what{text-decoration:line-through}',
  '.sch-none{font-size:.8125rem;color:var(--tm);padding:6px 2px}',
  '.sch-btn{background:none;border:none;padding:6px;cursor:pointer;color:var(--tm);font-size:1rem;line-height:1;display:flex;align-items:center;justify-content:center;min-width:38px;min-height:38px}',
  '.sch-btn:hover{color:var(--tp)}',
  '.sch-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}',
  '.sch-wd{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:5px}',
  '.sch-wd span{text-align:center;font-size:.625rem;letter-spacing:.4px;text-transform:uppercase;color:var(--tm)}',
  '.sch-cd{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:10px;font-size:.8125rem;color:var(--tp);background:var(--s1);border:1px solid transparent;cursor:pointer}',
  '.sch-cd.out{opacity:.3}',
  '.sch-cd.today{border-color:var(--accent)}',
  '.sch-cd.sel{background:var(--accent);color:#fff}',
  '.sch-cd .sch-dot{width:4px;height:4px;border-radius:50%;background:var(--accent);margin-top:2px}',
  '.sch-cd.sel .sch-dot{background:#fff}',
  '.sch-dayhd{font-size:.8125rem;color:var(--tm);margin:10px 2px 6px}',
  '.sch-chips{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 10px}',
  '.sch-chip{font-size:.75rem;color:var(--tm);background:var(--s2);border:0.5px solid var(--bdr);border-radius:99px;padding:6px 11px;cursor:pointer}',
  '.sch-chip:hover{color:var(--tp);border-color:var(--accent)}',
  '.sch-note{font-size:.75rem;color:var(--ts);line-height:1.55;margin-top:8px}',
  '.sch-nav{display:flex;gap:2px}',
  '#sch-cal-hd{display:flex;align-items:center;justify-content:space-between}',
  '.sch-alarm{position:fixed;left:max(12px,calc(50% - 203px));right:max(12px,calc(50% - 203px));bottom:calc(env(safe-area-inset-bottom,0px) + 84px);z-index:640;background:var(--s1);border:1px solid var(--accent);border-radius:16px;padding:14px;box-shadow:0 10px 34px rgba(0,0,0,.5)}',
  '',
].join('\n');
before('styles', ' </style> <script>', CSS, '.sch-alarm{position:fixed;');

/* ------------------------------------------------------------- 2. the screen */
const SCREEN = [
  '    <!-- MY SCHEDULE (19 Sep 2026). Jacques: "can you put a scheduler with time',
  '         calendar and alarm in the recovery app its own section". His own times,',
  '         his own words, a month calendar, and an alarm that rings. Everything is',
  '         in S.schedule in the saved state, so it stays on the account. Nothing',
  '         here keeps score — see the note at the bottom of the screen. -->',
  '    <div id="s-schedule" class="scr">',
  '      <div class="sec">',
  '        <div class="sec-hd" style="margin-top:0">Next up</div>',
  '        <div class="sch-next">',
  '          <div class="sch-time" id="sch-next-time">—</div>',
  '          <div class="sch-what"><p id="sch-next-title">Nothing set yet</p><span id="sch-next-sub">Add a time below and this is where you will see it coming.</span></div>',
  '        </div>',
  '      </div>',
  '      <div class="sec" style="padding-top:0">',
  '        <div class="sec-hd">Today</div>',
  '        <div id="sch-today"></div>',
  '      </div>',
  '      <div class="sec" style="padding-top:0">',
  '        <div class="sec-hd" id="sch-cal-hd">This month</div>',
  '        <div class="sch-wd"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>',
  '        <div class="sch-cal" id="sch-cal"></div>',
  '        <div id="sch-day"></div>',
  '      </div>',
  '      <div class="sec" style="padding-top:0">',
  '        <div class="sec-hd">Set a time</div>',
  '        <div class="ob-label" style="text-align:left;color:var(--tm)">What is it?</div>',
  '        <input class="ob-input" id="sch-form-what" type="text" maxlength="60" placeholder="A meeting" style="color:var(--tp);background:var(--s1);border-color:var(--bdr)">',
  '        <div class="sch-chips">',
  ...['A meeting', 'Call someone', 'The lesson', 'Journal', 'Wind down', 'Walk']
    .map((w) => "          <span class=\"sch-chip\" onclick=\"schedulePreset('" + w + "')\">" + w + '</span>'),
  '        </div>',
  '        <div class="ob-label" style="text-align:left;color:var(--tm)">What time</div>',
  '        <input class="ob-input" id="sch-form-time" type="time" style="color:var(--tp);background:var(--s1);border-color:var(--bdr)">',
  '        <div class="ob-label" style="text-align:left;color:var(--tm)">How often</div>',
  '        <select class="ob-input" id="sch-form-repeat" onchange="scheduleFormRepeat()" style="color:var(--tp);background:var(--s1);border-color:var(--bdr)">',
  '          <option value="daily">Every day</option>',
  '          <option value="weekdays">Weekdays, Monday to Friday</option>',
  '          <option value="weekly">One day a week</option>',
  '          <option value="once">One day only</option>',
  '        </select>',
  '        <div id="sch-form-day-wrap" style="display:none">',
  '          <div class="ob-label" style="text-align:left;color:var(--tm)">Which day</div>',
  '          <select class="ob-input" id="sch-form-day" style="color:var(--tp);background:var(--s1);border-color:var(--bdr)">',
  '            <option value="0">Sunday</option>',
  '            <option value="1">Monday</option>',
  '            <option value="2">Tuesday</option>',
  '            <option value="3">Wednesday</option>',
  '            <option value="4">Thursday</option>',
  '            <option value="5">Friday</option>',
  '            <option value="6">Saturday</option>',
  '          </select>',
  '        </div>',
  '        <div id="sch-form-date-wrap" style="display:none">',
  '          <div class="ob-label" style="text-align:left;color:var(--tm)">Which date</div>',
  '          <input class="ob-input" id="sch-form-date" type="date" style="color:var(--tp);background:var(--s1);border-color:var(--bdr)">',
  '        </div>',
  '        <div class="sch-note" id="sch-editing" style="display:none"></div>',
  '        <button class="ob-btn" id="sch-save-btn" onclick="scheduleSave()">Set this time</button>',
  '        <button class="ob-btn outline" style="color:var(--ts);border-color:var(--bdr);margin-top:8px" onclick="scheduleCancelEdit()">Never mind</button>',
  '      </div>',
  '      <div class="sec" style="padding-top:0">',
  '        <div class="sec-hd">Everything you have set</div>',
  '        <div id="sch-list"></div>',
  '      </div>',
  '      <div class="sec" style="padding-top:0">',
  '        <div class="setting-row" onclick="requestNotificationPermission()">',
  '          <i class="ti ti-bell" style="color:var(--accent)"></i>',
  '          <div class="setting-row-txt"><p>Ringing while you are elsewhere</p><span id="sch-notif-sub">Tap to allow the phone\'s own notification sound</span></div>',
  '        </div>',
  '        <div class="sch-note">A phone with the app completely closed cannot be woken by a web page — no site is allowed to do that. While the app is open, or sitting in another tab, a time rings for real; the moment it is in the background the phone\'s own notification carries it instead.</div>',
  '        <div class="sch-note">Nothing here keeps score. A time that passes unmarked just passes.</div>',
  '      </div>',
  '      <div class="sec" style="padding-top:0">',
  '        <button class="ob-btn outline" style="color:var(--ts);border-color:var(--bdr)" onclick="switchTo(\'tools\');actBn(\'bn-tools\')">Back to Tools</button>',
  '      </div>',
  '    </div>',
  '',
].join('\n');
before('the screen', '  </div><!-- /screens -->', SCREEN, 'id="s-schedule"');

/* -------------------------------------------------------- 3. the alarm card */
const CARD = [
  '  <!-- The alarm, outside every screen so it can ring over whatever is open. The',
  '       words on it are his own; in discretion mode they are replaced. Nothing on',
  '       it can end anything — it only says a time he set has arrived. -->',
  '  <div id="sch-alarm" class="sch-alarm" style="display:none">',
  '    <div style="font-size:.6875rem;letter-spacing:1.2px;text-transform:uppercase;color:var(--accent);font-weight:700">A time you set</div>',
  '    <div id="sch-alarm-time" style="font-size:1.5rem;font-weight:700;color:var(--tp);margin-top:4px">7:00 pm</div>',
  '    <div id="sch-alarm-what" style="font-size:.9375rem;color:var(--tm);margin-top:2px">A time you set</div>',
  '    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">',
  '      <button class="ob-btn" style="margin:0;flex:1;padding:11px" onclick="scheduleRingDone()">Done</button>',
  '      <button class="ob-btn outline" style="margin:0;flex:1;padding:11px" onclick="scheduleRingSnooze()">10 more minutes</button>',
  '      <button class="ob-btn outline" style="margin:0;flex:1;padding:11px;color:var(--ts);border-color:var(--bdr)" onclick="scheduleRingLater()">Not now</button>',
  '    </div>',
  '  </div>',
  '',
].join('\n');
before('the alarm card', '  <div id="mini-player"', CARD, 'id="sch-alarm"');

/* ------------------------------------------- 4a. a way in from Tools */
const TOOLS_SECTION = [
  '      <div class="sec" style="padding-bottom:0"><div class="sec-hd" style="margin-top:0">Your time</div></div>',
  '      <div class="setting-row" onclick="openSchedule()">',
  '        <i class="ti ti-calendar-week"></i>',
  '        <div class="setting-row-txt"><p>My schedule</p><span>The times you set for yourself, with an alarm that rings at them</span></div>',
  '        <i class="ti ti-chevron-right" style="font-size:1.125rem;color:var(--tm)"></i>',
  '      </div>',
  '      <div style="height:8px;background:var(--s0)"></div>',
].join('\n');
after('the Tools row', '<div id="s-tools" class="scr">', '\n' + TOOLS_SECTION, 'onclick="openSchedule()"');

/* --------------------------------- 4b. and from Reminder Settings */
const REM_SECTION = [
  '      <div class="sec">',
  '        <div class="sec-hd" style="margin-top:0">Your own times</div>',
  '        <div class="setting-row" onclick="openSchedule()">',
  '          <i class="ti ti-calendar-week" style="color:var(--accent)"></i>',
  '          <div class="setting-row-txt"><p>My schedule</p><span>Set a time by clock and calendar, with an alarm at it — the reminders above are the app\'s own</span></div>',
  '          <i class="ti ti-chevron-right" style="font-size:1.125rem;color:var(--tm)"></i>',
  '        </div>',
  '      </div>',
].join('\n');
// Collapse a duplicate if an earlier run of this script inserted the section
// without a marker to check against — which is exactly what it did once.
function dedupe(text) {
  const first = page.indexOf(text);
  if (first === -1) return;
  let rest = page.indexOf(text, first + 1);
  if (rest === -1) return;
  while (rest !== -1) {
    page = page.slice(0, rest) + page.slice(rest + text.length + 1);
    rest = page.indexOf(text, first + 1);
  }
  done.push('the Reminder Settings row: removed a duplicate');
}
if (page.includes('Your own times')) dedupe(REM_SECTION);
after('the Reminder Settings row', '    <div id="s-reminder-settings" class="scr">', '\n' + REM_SECTION, 'Your own times');

/* --------------------------------------------------------------- 5. the code */
// tools/schedule-block.js is the source of truth for the code, so a run against a
// page that already has it REPLACES it rather than skipping it — otherwise an
// edit to the block would never reach the app and every rule the tests check
// would be checking something the page does not run.
const CODE = fs.readFileSync(BLOCK, 'utf8');
const CODE_TEXT = CODE.endsWith('\n') ? CODE.slice(0, -1) : CODE;
const START = '// ─── MY SCHEDULE';
const END_MARK = '// ─── END OF MY SCHEDULE';
function blockInPage(p) {
  const at = p.indexOf(START);
  if (at < 0) return null;
  const end = p.indexOf(END_MARK, at);
  if (end < 0) return null;
  const nl = p.indexOf('\n', end);
  return p.slice(at, nl < 0 ? p.length : nl);
}
const existing = blockInPage(page);
if (existing === null) {
  before('the code', '// ─── SAVE TO MY PHONE', CODE + '\n', 'const SCHEDULE_RING_WINDOW_MIN=');
} else if (existing === CODE_TEXT) {
  done.push('the code: already there');
} else {
  page = page.replace(existing, CODE_TEXT);
  done.push('the code: replaced with the current tools/schedule-block.js');
}

/* ------------------------------------------------------------- 6. the wiring */
replaceOnce('the screen map',
  "  'lesson-library':'s-lesson-library'\n};",
  "  'lesson-library':'s-lesson-library',\n  schedule:'s-schedule'\n};",
  "schedule:'s-schedule'");
after('the title', 'const TITLES={', "\n  schedule:'My schedule',", "schedule:'My schedule'");
after('the bottom-nav map', 'const SCREEN_TO_BN={', "schedule:'bn-tools',", "schedule:'bn-tools'");
replaceOnce('the back-button map',
  "  'habit-coach':'bn-tools',tools:'bn-tools',partner:'bn-tools',tower:'bn-game'};",
  "  'habit-coach':'bn-tools',tools:'bn-tools',partner:'bn-tools',tower:'bn-game',\n  schedule:'bn-tools'};",
  "  schedule:'bn-tools'};");
after('the refresh on open',
  "  if(id==='partner'){updateTogetherSection();}",
  "\n  if(id==='schedule'){renderSchedule();scheduleFormDefaults();}",
  "if(id==='schedule'){renderSchedule();");
after('the timer at boot', '  startLessonReminderTimer();', '\n  startScheduleTimer();', 'startScheduleTimer();');
after('the saved state',
  '  lastSmartReminderSent:{},',
  "\n  // The times he set for himself (My Schedule): one entry per time, and a short\n  // list of any snoozed ones. Both in the saved state, so they survive a reload.\n  schedule:[],scheduleSnooze:[],",
  'schedule:[],scheduleSnooze:[],');

/* --------------------------------------------------------- 7. the version
   This step used to write 7.10 into both places. It must not any more. The
   version is Jacques's to choose and he took it back to 5.0 on 20 Sep 2026, so
   a number written into an old script is a number that would silently undo him
   the next time the script ran. It only checks now, and says who moves it.
   ---------------------------------------------------------------------- */
let sw = fs.readFileSync(SW, 'utf8');
const cache = sw.match(/const CACHE_NAME = 'tsid-shell-v([\d.]+)'/);
const appVer = page.match(/const APP_VERSION='([\d.]+)';/);
if (!cache || !appVer) throw new Error('version: could not read one of the two version strings');
if (cache[1] !== appVer[1]) {
  throw new Error('version: index.html and sw.js disagree (' + appVer[1] + ' / ' + cache[1] +
    ') — tools/apply-app-version.js moves them together');
}
done.push('version: left at ' + appVer[1] + ' — moved by tools/apply-app-version.js, not here');

fs.writeFileSync(PAGE, page);
for (const line of done) console.log('  ' + line);
console.log('index.html written (' + page.length + ' chars)');
