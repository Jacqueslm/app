'use strict';
/*
 * The clock the rules run on.
 *
 * "New York session, Central time" is a window on a wall clock that moves twice a
 * year: 08:30 to 15:00 in Chicago is 14:30–21:00 UTC in winter and 13:30–20:00 UTC
 * in summer. So a session is never stored as a UTC hour — it is read off the
 * Chicago clock bar by bar, which is what makes the same rule hold in January and
 * July. A fixed UTC window would silently start an hour late in November and an
 * hour early in March, and nothing in a backtest would complain.
 *
 * Three windows, back to back and each on the Chicago clock:
 *
 *   asia    18:00 → 02:00   (crosses midnight, so its day rolls back with it)
 *   london  02:00 → 08:30
 *   ny      08:30 → 15:00
 *
 * Central time here means America/Chicago, which is what the exchange clock and
 * your clock both follow — daylights saving included, read from the platform's own
 * time zone database rather than typed in.
 */

const TIME_ZONE = 'America/Chicago';

/* Minutes from midnight, Central. 08:30 is 510, 15:00 is 900. */
const SESSIONS = {
  asia: { key: 'asia', name: 'Asia', open: 18 * 60, close: 2 * 60, wrap: true },
  london: { key: 'london', name: 'London', open: 2 * 60, close: 8 * 60 + 30, wrap: false },
  ny: { key: 'ny', name: 'New York', open: 8 * 60 + 30, close: 15 * 60, wrap: false },
};

const FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const pad = (n) => String(n).padStart(2, '0');

/*
 * The Central-time reading of an instant: what a clock on your wall said.
 * Everything else in this file is built from it, so there is one place where the
 * time zone is understood and every other place just asks.
 */
function clock(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value)) throw new Error(`cannot read the clock at ${JSON.stringify(ms)}`);
  const parts = {};
  for (const part of FORMATTER.formatToParts(new Date(value))) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  /* Some engines print midnight as 24 with h23; anything at 24 is the start of a day. */
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/* Minutes since midnight, Central. */
function minutesOfDay(ms) {
  const c = clock(ms);
  return c.hour * 60 + c.minute;
}

/* A session by name, refused loudly rather than defaulted. */
function sessionWindow(name = 'ny') {
  if (name && typeof name === 'object' && Number.isFinite(name.open) && Number.isFinite(name.close)) return name;
  const key = String(name == null ? '' : name).trim().toLowerCase();
  const found = SESSIONS[key];
  if (!found) {
    throw new Error(`${JSON.stringify(name)} is not a session this bot knows — it knows ${Object.keys(SESSIONS).join(', ')}`);
  }
  return found;
}

/*
 * The session's own calendar day, as YYYY-MM-DD. Two bars share a session only if
 * this is equal, which is what "the first entry of the session" is counted against.
 *
 * For a window that crosses midnight, the small hours belong to the evening before:
 * 01:00 Central on the 6th is still the Asia session that opened at 18:00 on the
 * 5th. Without that, one overnight session would be counted as two, and "one entry"
 * would quietly allow two.
 */
function sessionKey(ms, session = 'ny') {
  const win = sessionWindow(session);
  const c = clock(ms);
  let year = c.year;
  let month = c.month;
  let day = c.day;
  if (win.wrap && c.hour * 60 + c.minute <= win.close) {
    const previous = new Date(Date.UTC(year, month - 1, day) - 86400e3);
    year = previous.getUTCFullYear();
    month = previous.getUTCMonth() + 1;
    day = previous.getUTCDate();
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

/* Is this instant inside the session, on the Central clock? Both edges are
   inclusive: a bar closing at 15:00 exactly is the New York session's last bar. */
function inSession(ms, session = 'ny') {
  const win = sessionWindow(session);
  const m = minutesOfDay(ms);
  return win.wrap ? m >= win.open || m <= win.close : m >= win.open && m <= win.close;
}

const hhmm = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/* ---- the time-based range (TBR) ---------------------------------------------
   The scalp window is stated once, on the New York clock: 09:00 to 15:00. The
   Chicago window is DERIVED from it at the instant asked about, using the shift
   between the two zones that the platform's own time zone database reports for
   that moment — winter and summer give the same 08:00–14:00, and a fixed offset
   never enters the arithmetic.
------------------------------------------------------------------------------ */
const ET_ZONE = 'America/New_York';
const TBR_OPEN = 9 * 60;    // 09:00 New York
const TBR_CLOSE = 15 * 60;  // 15:00 New York

const ZONE_FORMATTERS = new Map();
function zoneFormatter(timeZone) {
  if (!ZONE_FORMATTERS.has(timeZone)) {
    ZONE_FORMATTERS.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }));
  }
  return ZONE_FORMATTERS.get(timeZone);
}

function zoneParts(ms, timeZone) {
  const value = Number(ms);
  if (!Number.isFinite(value)) throw new Error(`cannot read ${timeZone} at ${JSON.stringify(ms)}`);
  const parts = {};
  for (const part of zoneFormatter(timeZone).formatToParts(new Date(value))) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour) % 24, minute: Number(parts.minute),
  };
}

/* Minutes since midnight, on that zone's own wall clock. */
function zoneMinutesOfDay(ms, timeZone) {
  const p = zoneParts(ms, timeZone);
  return p.hour * 60 + p.minute;
}

/* How far that zone's wall clock is from UTC at this instant, in minutes:
   Chicago is -360 in January and -300 in July, read from the database. */
function zoneOffsetMinutes(ms, timeZone) {
  const p = zoneParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
  return Math.round((asUtc - Math.floor(Number(ms) / 60000) * 60000) / 60000);
}

/* The window on both clocks, for the day this instant falls on. The Chicago
   numbers are the New York ones shifted by the difference between the two zones
   AT THAT INSTANT, so they are 08:00–14:00 in both halves of the year. */
function tbrWindow(ms = Date.now()) {
  const shift = zoneOffsetMinutes(ms, ET_ZONE) - zoneOffsetMinutes(ms, TIME_ZONE);
  return {
    et: { zone: ET_ZONE, open: TBR_OPEN, close: TBR_CLOSE },
    ct: { zone: TIME_ZONE, open: TBR_OPEN - shift, close: TBR_CLOSE - shift },
    shiftMinutes: shift,
  };
}

/* Is this instant inside the scalp window? Read on the New York clock, both
   edges included, which is the statement the window was given in. */
function inTbrSession(ms) {
  const m = zoneMinutesOfDay(ms, ET_ZONE);
  return m >= TBR_OPEN && m <= TBR_CLOSE;
}

function describeTbr(ms = Date.now()) {
  const w = tbrWindow(ms);
  return `${hhmm(w.et.open)}–${hhmm(w.et.close)} ${ET_ZONE} (${hhmm(w.ct.open)}–${hhmm(w.ct.close)} ${TIME_ZONE})`;
}

function describeSession(session = 'ny') {
  const win = sessionWindow(session);
  const where = win.wrap ? `${TIME_ZONE}, running past midnight` : TIME_ZONE;
  return `${hhmm(win.open)}–${hhmm(win.close)} Central (${where})`;
}

module.exports = {
  TIME_ZONE, ET_ZONE, SESSIONS, clock, minutesOfDay, sessionKey, sessionWindow, inSession, describeSession, hhmm,
  TBR_OPEN, TBR_CLOSE, zoneMinutesOfDay, zoneOffsetMinutes, tbrWindow, inTbrSession, describeTbr,
};
