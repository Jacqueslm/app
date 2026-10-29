'use strict';
/*
 * The TBR scalp.
 *
 * The rule, in the words it was given:
 *
 *   "9am 3pm eastern time, 8am 2pm central time, time based ranges for scalp.
 *    Program it to know it's a scalp trade: below, come back, short the fib 30 50
 *    70; or sweep trade up, come back fib 30 50 70, sweep long. Stop behind the
 *    wick, target candle close."
 *
 * Read as code — and the reading is written here rather than left to be guessed:
 *
 *   SESSION   the range is the session itself, 09:00–15:00 America/New_York. The
 *             Chicago number beside it (08:00–14:00) is derived from the New York
 *             one at the instant being asked about, in lib/session.js, so the two
 *             cannot drift and no fixed UTC offset is anywhere in the arithmetic.
 *   RANGE     while the session is open, the range is the highest high and the
 *             lowest low the session has printed so far.
 *   BREAK     a bar that CLOSES beyond that range starts a leg. A close below the
 *             low is a SHORT setup; a close above the high is a LONG one. The
 *             break bar is the qualifying candle for the trade.
 *   RETURN    the leg runs from the edge that broke to its extreme wick. The fib
 *             zone is 0.30, 0.50 and 0.70 OF THAT LEG, counted back from the
 *             extreme toward the edge — those three numbers exactly, not the
 *             golden ratio. A bar that trades into the zone is the signal, and
 *             the fill is the level itself, not the bar's close.
 *   STOP      behind the wick of the break candle: above its high for a short,
 *             below its low for a long, plus a buffer, so a wick through the level
 *             does not take the trade.
 *   TARGET    the close of the qualifying candle — the break bar's close.
 *   SCALP     every signal carries isScalp: true. A candidate that is refused
 *             carries isScalp: false and the reason, so "outside the session" is
 *             a reported rejection rather than a silent drop.
 *
 * Two consequences of the literal text, kept rather than smoothed over:
 *
 *   - the target is the break candle's close, so a retrace level that does not
 *     leave the target on the profitable side of the entry is not tradable. The
 *     first level the price reaches is the one that fills; if it has no room, the
 *     setup is refused with that reason instead of being re-priced to a different
 *     level.
 *   - a leg that is fully retraced (a close back through the edge) has failed, and
 *     the setup is dropped rather than carried to a deeper level.
 */

const { baseInterval } = require('./structure');
const { inTbrSession, tbrWindow, describeTbr } = require('./session');

const DEFAULTS = {
  /* Exactly as stated: 30, 50 and 70 per cent of the break leg. */
  fibs: [0.30, 0.50, 0.70],
  /* Points beyond the break candle's wick. A quarter point is a single tick on
     the micro Nasdaq and the micro S&P, and two and a half ticks on gold. */
  stopBuffer: 0.25,
  directions: ['long', 'short'],
};

const pct = (f) => Math.round(f * 100);

function checkFibs(fibs) {
  const list = Array.isArray(fibs) ? fibs : String(fibs).split(',');
  const out = [];
  for (const raw of list) {
    const f = Number(raw);
    if (!Number.isFinite(f) || f <= 0 || f >= 1) {
      throw new Error(`a fib level is a fraction of the leg between 0 and 1 — 0.30, 0.50, 0.70 — got ${JSON.stringify(raw)}`);
    }
    if (!out.includes(f)) out.push(f);
  }
  if (!out.length) throw new Error('no fib level was named');
  return out.sort((a, b) => a - b);
}

/**
 * Find the scalp signals in a run of bars.
 *
 * @param {object} opts
 * @param {Array}  opts.bars          bars; their spacing is the bar size
 * @param {number[]} [opts.fibs]     fractions of the break leg, default 0.30/0.50/0.70
 * @param {number} [opts.stopBuffer] points beyond the break candle's wick
 * @param {string[]} [opts.directions] which sides to take
 * @returns {{signals: Array, rejections: Array, window: object, config: object}}
 */
function findScalpSignals({
  bars, fibs = DEFAULTS.fibs, stopBuffer = DEFAULTS.stopBuffer,
  directions = DEFAULTS.directions,
} = {}) {
  if (!Array.isArray(bars) || bars.length < 3) throw new Error('the scalp rule needs at least three bars');
  const base = baseInterval(bars);
  const levelsOfLeg = checkFibs(fibs);
  const buffer = Number(stopBuffer);
  if (!Number.isFinite(buffer) || buffer < 0) throw new Error(`the stop buffer is points beyond the wick and cannot be negative, got ${JSON.stringify(stopBuffer)}`);
  const wanted = new Set(Array.isArray(directions) ? directions : [directions]);
  for (const d of wanted) {
    if (d !== 'long' && d !== 'short') throw new Error(`a trade is a long or a short, got ${JSON.stringify(d)}`);
  }

  const win = tbrWindow(bars[0].time);
  const signals = [];
  const rejections = [];

  let dayKey = null;
  let range = null;     // { high, low } of the session so far
  let state = null;     // the break being watched
  let index = 0;

  const reject = (reason, side, at, where) => rejections.push({
    isScalp: false,
    rejected: true,
    side,
    reason,
    index: at,
    time: bars[at] ? bars[at].time : null,
    session: where || win,
  });

  for (let i = 0; i < bars.length; i++) {
    index = i;
    const bar = bars[i];
    /* The session is judged at the bar's CLOSE: a 15-minute bar stamped 14:45
       Eastern closes at 15:00 and is the last bar the window holds. */
    const closeTime = bar.time + base;
    const key = new Date(closeTime).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    if (key !== dayKey) {
      dayKey = key;
      range = null;
      state = null;
    }
    const open = inTbrSession(closeTime);
    const where = tbrWindow(closeTime);

    /* An open break: it lives or dies inside the session. */
    if (state) {
      if (!open) {
        reject('outside the TBR session — the session ended before the return', state.side, i, where);
        state = null;
        continue;
      }
      if (state.side === 'short') {
        if (bar.close > state.edge) {
          reject('the break was reclaimed before the return', 'short', i, where);
          state = null;
          continue;
        }
        state.extreme = Math.min(state.extreme, bar.low);
        const leg = state.edge - state.extreme;
        if (leg > 0) {
          for (const fib of levelsOfLeg) {
            const level = state.extreme + leg * fib;
            if (bar.high < level) continue;
            const entry = level;
            const stop = state.breakBar.high + buffer;
            const target = state.breakBar.close;
            if (!(stop > entry)) {
              reject('the stop behind the break wick is not over the entry', 'short', i, where);
            } else if (!(target < entry)) {
              reject(`a ${pct(fib)}% retrace leaves no room to the candle close`, 'short', i, where);
            } else {
              signals.push({
                isScalp: true,
                side: 'short',
                fib,
                fibPct: pct(fib),
                level,
                entry,
                stop,
                target,
                stopBuffer: buffer,
                zone: levelsOfLeg.map((f) => state.extreme + leg * f),
                range: { high: state.rangeHigh, low: state.rangeLow },
                extreme: state.extreme,
                breakCandle: { ...state.breakBar },
                index: i,
                time: bar.time,
                session: where,
              });
            }
            state = null;
            break;
          }
          if (state) state = null;
        }
        continue;
      }

      /* the long side, mirrored */
      if (bar.close < state.edge) {
        reject('the break was reclaimed before the return', 'long', i, where);
        state = null;
        continue;
      }
      state.extreme = Math.max(state.extreme, bar.high);
      const leg = state.extreme - state.edge;
      if (leg > 0) {
        for (const fib of levelsOfLeg) {
          const level = state.extreme - leg * fib;
          if (bar.low > level) continue;
          const entry = level;
          const stop = state.breakBar.low - buffer;
          const target = state.breakBar.close;
          if (!(stop < entry)) {
            reject('the stop behind the break wick is not under the entry', 'long', i, where);
          } else if (!(target > entry)) {
            reject(`a ${pct(fib)}% retrace leaves no room to the candle close`, 'long', i, where);
          } else {
            signals.push({
              isScalp: true,
              side: 'long',
              fib,
              fibPct: pct(fib),
              level,
              entry,
              stop,
              target,
              stopBuffer: buffer,
              zone: levelsOfLeg.map((f) => state.extreme - leg * f),
              range: { high: state.rangeHigh, low: state.rangeLow },
              extreme: state.extreme,
              breakCandle: { ...state.breakBar },
              index: i,
              time: bar.time,
              session: where,
            });
          }
          state = null;
          break;
        }
        if (state) state = null;
      }
      continue;
    }

    if (!range) {
      if (open) range = { high: bar.high, low: bar.low, first: i };
      continue;
    }

    const prior = { high: range.high, low: range.low };
    const below = bar.close < prior.low;
    const above = bar.close > prior.high;

    if (below || above) {
      const side = below ? 'short' : 'long';
      if (!open) {
        reject('outside the TBR session', side, i, where);
        /* The bar joins the range so the same break is not reported again on the
           next bar: one break, one rejection. */
        range.high = Math.max(range.high, bar.high);
        range.low = Math.min(range.low, bar.low);
        continue;
      }
      if (!wanted.has(side)) {
        reject(`the ${side} side was switched off`, side, i, where);
        range.high = Math.max(range.high, bar.high);
        range.low = Math.min(range.low, bar.low);
        continue;
      }
      state = {
        side,
        edge: below ? prior.low : prior.high,
        extreme: below ? bar.low : bar.high,
        rangeHigh: prior.high,
        rangeLow: prior.low,
        breakBar: { index: i, time: bar.time, high: bar.high, low: bar.low, close: bar.close },
      };
      continue;
    }

    if (open) {
      range.high = Math.max(range.high, bar.high);
      range.low = Math.min(range.low, bar.low);
    }
  }

  return {
    signals,
    rejections,
    window: { ...win, label: describeTbr(bars[0].time) },
    config: { fibs: levelsOfLeg, stopBuffer: buffer, directions: [...wanted], base, bars: bars.length },
  };
}

module.exports = { DEFAULTS, findScalpSignals, checkFibs };
