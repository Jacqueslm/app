'use strict';
/*
 * Market structure, read the same way on every timeframe.
 *
 * "Market structure" is not one thing, so it is pinned down here rather than
 * assumed, and the definitions are these:
 *
 *   A SWING HIGH is a bar whose high is above the highs of `left` bars before it
 *   and `right` bars after it. A swing low is the same said of lows.
 *
 *   It follows — and this is the part that matters — that a swing at bar i is
 *   only KNOWN at bar i + right, because the bars after it have to exist before
 *   anything can say it was a high. A read that "knows" a swing the moment it
 *   prints is looking into the future, and that is the most common way a
 *   market-structure backtest flatters itself.
 *
 *   The TREND is read from the last two confirmed swings on each side:
 *     up      — the last high is above the previous high AND the last low is
 *               above the previous low (higher high, higher low)
 *     down    — the last high is below the previous high and the last low is
 *               below the previous low
 *     range   — the two sides disagree
 *     forming — not enough confirmed swings yet to say anything at all
 *
 *   A BREAK is a CLOSE beyond the last confirmed swing level, never a wick: the
 *   price has to have accepted the level, not just touched it. Closing above the
 *   last swing high in an up trend is a BOS, the trend continuing. Closing below
 *   the last swing low in an up trend is a CHoCH, the trend changing character.
 *   With no trend to compare against, a break is reported as a plain break rather
 *   than dressed up as one or the other. A level can only fire once.
 *
 * "Every timeframe" means the same read at several bar sizes at once, which is how
 * this gets used: one set of bars gives the 5m, the 15m, the hour, the 4-hour and
 * the daily read. A higher timeframe is only reported once its own bar has closed
 * — standing at the close of a base bar you cannot know a 4-hour bar that is still
 * forming, and a backtest that reads the forming one is reading the future.
 */

const INTERVALS = {
  '1m': 60e3, '3m': 180e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3,
  '1h': 3600e3, '2h': 7200e3, '4h': 4 * 3600e3, '6h': 6 * 3600e3,
  '8h': 8 * 3600e3, '12h': 12 * 3600e3, '1d': 86400e3, '1w': 7 * 86400e3,
};

const DEFAULTS = { left: 2, right: 2 };

function number(value, fallback, name) {
  if (value === undefined || value === null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number, got ${JSON.stringify(value)}`);
  return n;
}

function whole(value, fallback, name) {
  const n = number(value, fallback, name);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${name} has to be a whole number of bars, 1 or more; got ${JSON.stringify(value)}`);
  }
  return n;
}

/* A timeframe name to milliseconds. Anything not read exactly is refused. */
function parseInterval(name) {
  const key = String(name == null ? '' : name).trim().toLowerCase();
  if (!key) throw new Error('a timeframe cannot be empty');
  if (INTERVALS[key]) return INTERVALS[key];
  const m = /^(\d+)(m|h|d|w)$/.exec(key);
  if (m) {
    const unit = { m: 60e3, h: 3600e3, d: 86400e3, w: 7 * 86400e3 }[m[2]];
    const count = Number(m[1]);
    if (count > 0) return count * unit;
  }
  throw new Error(`${JSON.stringify(name)} is not a timeframe — minutes, hours, days or weeks, e.g. 15m, 1h, 4h, 1d`);
}

function nameOf(ms) {
  for (const [name, value] of Object.entries(INTERVALS)) if (value === ms) return name;
  if (ms % 86400e3 === 0) return `${ms / 86400e3}d`;
  if (ms % 3600e3 === 0) return `${ms / 3600e3}h`;
  return `${ms / 60e3}m`;
}

/* A level, small enough to sit in a state object without noise. */
const level = (swing) => ({ index: swing.index, time: swing.time, price: swing.price });

/*
 * Every swing in the bars, in index order, each stamped with the bar at which it
 * becomes knowable. Ties are not swings: a high equal to the bar beside it is not
 * a high above it, so a flat top is reported as nothing rather than as a choice
 * between two identical candidates.
 */
function findSwings(bars, opts = {}) {
  const left = whole(opts.left, DEFAULTS.left, 'swing left');
  const right = whole(opts.right, DEFAULTS.right, 'swing right');
  if (!Array.isArray(bars)) throw new Error('findSwings needs an array of bars');
  const swings = [];

  for (let i = left; i < bars.length - right; i++) {
    const bar = bars[i];
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= left && (isHigh || isLow); k++) {
      if (!(bar.high > bars[i - k].high)) isHigh = false;
      if (!(bar.low < bars[i - k].low)) isLow = false;
    }
    for (let k = 1; k <= right && (isHigh || isLow); k++) {
      if (!(bar.high > bars[i + k].high)) isHigh = false;
      if (!(bar.low < bars[i + k].low)) isLow = false;
    }
    if (isHigh) swings.push({ index: i, time: bar.time, price: bar.high, kind: 'high', confirmedAt: i + right });
    if (isLow) swings.push({ index: i, time: bar.time, price: bar.low, kind: 'low', confirmedAt: i + right });
  }
  return swings;
}

/*
 * Walk the bars once and write down what the structure said at the close of each
 * one, using only swings that were confirmed by then. `states[i]` is therefore
 * knowable at the close of bar i and at no earlier moment.
 *
 * This is also the whole reason the series can be precomputed before a run
 * without cheating: the value stored at bar i does not depend on a single bar
 * after i. The tests check that directly, by running this on a prefix of the bars
 * and getting the same answer.
 */
function track(bars, opts = {}) {
  const left = whole(opts.left, DEFAULTS.left, 'swing left');
  const right = whole(opts.right, DEFAULTS.right, 'swing right');
  if (!Array.isArray(bars)) throw new Error('track needs an array of bars');
  if (bars.length === 0) return { left, right, swings: [], states: [], events: [] };

  const swings = findSwings(bars, { left, right });
  const confirming = new Map();
  for (const swing of swings) {
    if (!confirming.has(swing.confirmedAt)) confirming.set(swing.confirmedAt, []);
    confirming.get(swing.confirmedAt).push(swing);
  }

  const states = new Array(bars.length);
  const events = [];
  const highs = [];
  const lows = [];
  let firedHigh = null;   // the level index that already produced a break
  let firedLow = null;

  for (let j = 0; j < bars.length; j++) {
    /* 1. Swings that become knowable at this bar. A swing confirmed now was made
          `right` bars back, and needed this bar to exist. */
    for (const swing of confirming.get(j) || []) {
      (swing.kind === 'high' ? highs : lows).push(swing);
    }

    /* 2. The trend, from the last two confirmed swings on each side. */
    const lastHigh = highs.length ? highs[highs.length - 1] : null;
    const prevHigh = highs.length > 1 ? highs[highs.length - 2] : null;
    const lastLow = lows.length ? lows[lows.length - 1] : null;
    const prevLow = lows.length > 1 ? lows[lows.length - 2] : null;

    let trend = 'forming';
    if (prevHigh && prevLow && lastHigh && lastLow) {
      const highsUp = lastHigh.price > prevHigh.price;
      const lowsUp = lastLow.price > prevLow.price;
      if (highsUp && lowsUp) trend = 'up';
      else if (!highsUp && !lowsUp) trend = 'down';
      else trend = 'range';
    }

    /* 3. Breaks, on the close, crossing a level that was there before this bar. */
    const prevClose = j > 0 ? bars[j - 1].close : null;
    const close = bars[j].close;
    let event = null;
    if (prevClose !== null && lastHigh && lastHigh.index !== firedHigh && prevClose <= lastHigh.price && close > lastHigh.price) {
      firedHigh = lastHigh.index;
      const withTrend = trend === 'up';
      event = {
        index: j, time: bars[j].time, direction: 'up',
        kind: trend === 'forming' || trend === 'range' ? 'break' : (withTrend ? 'BOS' : 'CHoCH'),
        level: lastHigh.price, levelIndex: lastHigh.index,
      };
    } else if (prevClose !== null && lastLow && lastLow.index !== firedLow && prevClose >= lastLow.price && close < lastLow.price) {
      firedLow = lastLow.index;
      const withTrend = trend === 'down';
      event = {
        index: j, time: bars[j].time, direction: 'down',
        kind: trend === 'forming' || trend === 'range' ? 'break' : (withTrend ? 'BOS' : 'CHoCH'),
        level: lastLow.price, levelIndex: lastLow.index,
      };
    }
    if (event) events.push(event);

    states[j] = {
      index: j,
      time: bars[j].time,
      trend,
      ready: trend !== 'forming',
      high: lastHigh ? level(lastHigh) : null,
      low: lastLow ? level(lastLow) : null,
      highBroken: firedHigh !== null && lastHigh !== null && firedHigh === lastHigh.index,
      lowBroken: firedLow !== null && lastLow !== null && firedLow === lastLow.index,
      event,
    };
  }

  return { left, right, swings, states, events };
}

/* How far apart the bars are, taken as the smallest gap between neighbours: a
   weekend or a halt makes a bigger gap, never a smaller one. */
function baseInterval(bars) {
  if (!Array.isArray(bars) || bars.length < 2) throw new Error('cannot tell the bar spacing from fewer than two bars');
  let smallest = Infinity;
  for (let i = 1; i < bars.length; i++) {
    const gap = bars[i].time - bars[i - 1].time;
    if (gap > 0 && gap < smallest) smallest = gap;
  }
  if (!Number.isFinite(smallest)) throw new Error('the bars all share one timestamp, so there is no spacing to read');
  return smallest;
}

/*
 * Combine bars into bigger ones. Buckets are cut on the clock, from the anchor, so
 * a gap in the data — a halt, a weekend, a session break — leaves a bucket short
 * or missing rather than silently sliding every later bar out of place. For
 * futures, the anchor is where the exchange's session opens; the daily bar of a
 * market that trades round the clock is not a UTC midnight bar unless you say so.
 */
function resample(bars, intervalMs, anchorMs = 0) {
  if (!Array.isArray(bars) || bars.length === 0) throw new Error('resample needs bars');
  if (!Number.isInteger(intervalMs) || intervalMs <= 0) throw new Error('resample needs a positive whole number of milliseconds');
  const byBucket = new Map();
  const out = [];
  for (const bar of bars) {
    const key = Math.floor((bar.time - anchorMs) / intervalMs);
    const held = byBucket.get(key);
    if (!held) {
      const fresh = {
        time: anchorMs + key * intervalMs,
        open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume,
      };
      byBucket.set(key, fresh);
      out.push(fresh);
    } else {
      held.high = Math.max(held.high, bar.high);
      held.low = Math.min(held.low, bar.low);
      held.close = bar.close;
      held.volume += bar.volume;
    }
  }
  return out;
}

/*
 * The same structure read at every timeframe asked for, aligned onto the base
 * bars. `stateAt[i]` is what each timeframe said while standing at the close of
 * base bar i — the moment a decision gets made.
 *
 * For the base timeframe that is its own state at bar i. For a bigger one it is
 * the state of the last bar of that size that had already CLOSED, which is
 * usually not the one the base bar is inside: that one is still forming and cannot
 * be known. Everything it costs is honest lag.
 */
function multiTimeframe(bars, { timeframes, left, right, anchorMs = 0 } = {}) {
  if (!Array.isArray(bars) || bars.length === 0) throw new Error('multiTimeframe needs bars');
  const base = baseInterval(bars);
  const names = Array.isArray(timeframes) && timeframes.length ? timeframes : [nameOf(base)];
  const reads = [];

  for (const name of names) {
    const ms = parseInterval(name);
    if (ms < base) throw new Error(`${name} is smaller than the bars themselves (${nameOf(base)})`);
    if (ms % base !== 0) {
      throw new Error(`${name} is ${ms}ms and the bars are ${base}ms apart; a higher timeframe has to be a whole number of them`);
    }
    const own = ms === base ? bars : resample(bars, ms, anchorMs);
    /* When this bar's reading becomes knowable: at its close, which for the base
       bars is the bar itself — the engine asks after the bar's close — and for a
       bigger bar is the end of its bucket. */
    const knowableAt = own.map((bar) => bar.time + (ms === base ? 0 : ms));
    const tracked = track(own, { left, right });

    const stateAt = new Array(bars.length).fill(null);
    let k = -1;
    for (let i = 0; i < bars.length; i++) {
      while (k + 1 < own.length && knowableAt[k + 1] <= bars[i].time) k++;
      stateAt[i] = k >= 0 ? tracked.states[k] : null;
    }
    reads.push({ name, ms, bars: own, tracked, stateAt });
  }

  /* Standing on the last bar of a run. Everything the reads know, and whether they
     agree: nothing at all, all one way, all still forming, or a mixture. A mixed
     read is not a signal, it is a description of disagreement. */
  function at(index) {
    const i = index === undefined ? bars.length - 1 : index;
    if (!Number.isInteger(i) || i < 0 || i >= bars.length) throw new Error(`bar ${index} is outside the run`);
    const perTimeframe = reads.map((read) => ({ name: read.name, ms: read.ms, state: read.stateAt[i] }));
    const counts = { up: 0, down: 0, range: 0, forming: 0, unknown: 0, none: 0 };
    for (const entry of perTimeframe) {
      if (!entry.state) counts.unknown++;
      else if (entry.state.trend === 'up') counts.up++;
      else if (entry.state.trend === 'down') counts.down++;
      else if (entry.state.trend === 'range') counts.range++;
      else counts.forming++;
    }
    const known = counts.up + counts.down + counts.range + counts.forming;
    let alignment;
    if (known === 0) alignment = 'unknown';
    else if (counts.up === known) alignment = 'up';
    else if (counts.down === known) alignment = 'down';
    else if (counts.forming === known) alignment = 'forming';
    else alignment = 'mixed';
    return { index: i, time: bars[i].time, perTimeframe, counts, alignment };
  }

  return { baseIntervalMs: base, reads, at };
}

module.exports = {
  INTERVALS, DEFAULTS, parseInterval, nameOf, findSwings, track,
  baseInterval, resample, multiTimeframe,
};
