'use strict';
/*
 * Reading price bars.
 *
 * One bar is:
 *   { time, open, high, low, close, volume }
 * with time in epoch milliseconds.
 *
 * The job here is to refuse bad data loudly. A backtest run on a misread file
 * reports a confident number that means nothing, and the misreading is usually
 * something dull — a swapped column, a duplicated timestamp, a high below the
 * close. So every row is checked, and a bad one is refused with its line number
 * rather than smoothed over.
 */

const fs = require('node:fs');

/* What make-sample.js writes on its first line, so a run can say where its bars
   came from instead of guessing from the file's name. */
const SYNTHETIC_MARK = /^#\s*synthetic\b/i;

const NUMBER = /^-?\d+(\.\d+)?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/;

/* ISO 8601, or epoch milliseconds. Anything else is an error, not a guess. */
function parseTime(raw, line) {
  const v = String(raw == null ? '' : raw).trim();
  if (v === '') throw new Error(`line ${line}: the time is empty`);
  if (NUMBER.test(v)) {
    const ms = Number(v);
    if (!(ms > 0)) throw new Error(`line ${line}: time ${v} is not a positive epoch in milliseconds`);
    return ms;
  }
  const iso = DATE_ONLY.test(v) ? v + 'T00:00:00Z'
    : v.replace(' ', 'T') + (HAS_ZONE.test(v) ? '' : 'Z');
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    throw new Error(`line ${line}: cannot read a time from ${JSON.stringify(raw)}`);
  }
  return ms;
}

function parseNumber(raw, field, line) {
  const v = String(raw == null ? '' : raw).trim();
  if (!NUMBER.test(v)) {
    throw new Error(`line ${line}: ${field} is ${JSON.stringify(raw)}, not a number`);
  }
  return Number(v);
}

/*
 * Read a whole CSV. Comments (#) and blank lines are skipped, and a header row is
 * recognised by its first cell being time or date.
 */
function parseCandles(text, source) {
  const where = source ? String(source) : 'input';
  if (typeof text !== 'string') throw new Error(`${where}: expected the file's text`);
  const candles = [];
  let headerSeen = false;
  let previous = null;

  const lines = text.split(/\r?\n/);
  for (let n = 0; n < lines.length; n++) {
    const line = n + 1;
    const row = lines[n].trim();
    if (row === '' || row.startsWith('#')) continue;

    const cells = row.split(',').map((c) => c.trim());
    const firstWord = cells[0].toLowerCase();
    if (!headerSeen && candles.length === 0 && (firstWord === 'time' || firstWord === 'date')) {
      headerSeen = true;
      continue;
    }
    if (cells.length < 6) {
      throw new Error(`${where} line ${line}: expected time,open,high,low,close,volume — got ${cells.length} field(s)`);
    }

    const time = parseTime(cells[0], line);
    const open = parseNumber(cells[1], 'open', line);
    const high = parseNumber(cells[2], 'high', line);
    const low = parseNumber(cells[3], 'low', line);
    const close = parseNumber(cells[4], 'close', line);
    const volume = parseNumber(cells[5], 'volume', line);

    for (const [name, price] of [['open', open], ['high', high], ['low', low], ['close', close]]) {
      if (!(price > 0)) throw new Error(`${where} line ${line}: ${name} is ${price}; a price has to be above zero`);
    }
    if (volume < 0) throw new Error(`${where} line ${line}: volume is ${volume}; it cannot be negative`);
    if (high < Math.max(open, close)) throw new Error(`${where} line ${line}: high ${high} is below the open or close`);
    if (low > Math.min(open, close)) throw new Error(`${where} line ${line}: low ${low} is above the open or close`);
    if (previous !== null && time <= previous) {
      throw new Error(`${where} line ${line}: time ${new Date(time).toISOString()} does not come after the previous bar; bars must move forward`);
    }
    previous = time;
    candles.push({ time, open, high, low, close, volume });
  }

  if (candles.length === 0) throw new Error(`${where}: no bars in it`);
  return candles;
}

function loadCandles(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`cannot read ${file}: ${err.message}`);
  }
  return parseCandles(text, file);
}

/*
 * Is this file the generator's output? Read off its own first line, which is
 * evidence, rather than off its name, which is a guess.
 */
function isSynthetic(file) {
  try {
    const head = fs.readFileSync(file, 'utf8').split(/\r?\n/, 1)[0] || '';
    return SYNTHETIC_MARK.test(head.trim());
  } catch (err) {
    return false;
  }
}

module.exports = { parseCandles, loadCandles, parseTime, isSynthetic };
