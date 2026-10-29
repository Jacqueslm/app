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

function describeSession(session = 'ny') {
  const win = sessionWindow(session);
  const where = win.wrap ? `${TIME_ZONE}, running past midnight` : TIME_ZONE;
  return `${hhmm(win.open)}–${hhmm(win.close)} Central (${where})`;
}

module.exports = {
  TIME_ZONE, SESSIONS, clock, minutesOfDay, sessionKey, sessionWindow, inSession, describeSession, hhmm,
};
