'use strict';
/*
 * The opening-candle sweep: the 08:00 and 14:00 candle, and the hour after it.
 *
 * The rule, in the words it was given:
 *
 *   "8am and 2pm Central candle. 9am and 3pm Central: price leaves either candle,
 *    comes back and tests the final 30, 50 or 70, or sweeps the candle — trade back
 *    on the sweep, target at the close of the candle, longs and shorts."
 *
 * Read as code, that means:
 *
 *   ANCHOR   the 08:00–09:00 Central candle, then the 14:00–15:00 one. Its high,
 *            its low, and — the part the whole trade is aimed at — its CLOSE.
 *   ACTION   the hour after it: 09:00–10:00 and 15:00–16:00 Central. Nothing is
 *            traded outside those two hours.
 *   TRIGGER  price has to LEAVE the candle first. A trade through its high or its
 *            low is the sweep, and which edge was taken decides the direction,
 *            because the trade is BACK toward the middle of the candle:
 *              high swept → SHORT, back down to the candle's close
 *              low  swept → LONG,  back up to the candle's close
 *   RECLAIM  then a bar has to CLOSE back inside the candle by at least the retest
 *            depth — 30, 50 or 70 per cent of the candle's range, measured from the
 *            edge that was swept. That close is the signal; the fill is the next
 *            bar's open. A wick back inside is not a reclaim.
 *   TARGET   the anchor candle's CLOSE. Not the far edge of the candle, not an
 *            extension: the price the candle actually finished at.
 *   STOP     the sweep's extreme — the highest high (short) or lowest low (long)
 *            made after the candle closed, before the reclaim. Beyond that price
 *            the sweep did not fail; it was never a sweep.
 *   CLOCK    flat at the end of the action hour: 10:00 and 16:00 Central. The rule
 *            is a two-hour play and it does not run into the rest of the day.
 *
 * THE TBR SCALP, AND THE RETRACE ENTRY
 *
 * The same two ranges, named on the New York clock — 09:00 and 15:00 Eastern, which
 * are 08:00 and 14:00 Central — traded as scalps: one candle, one hour to work in,
 * flat at the end of it. Every trade from this file carries `kind: 'scalp'`.
 *
 * `entry: 'fib'` replaces the close-based reclaim with a RESTING LIMIT at 30, 50 or
 * 70 per cent of the candle's range, measured in from the edge that was swept:
 *
 *   short  110 high, 99 low  →  a sell limit at 106.7 (30%), 104.5 (50%), 102.3 (70%)
 *   long   the same three  →  a buy  limit at 102.3, 104.5, 106.7, counted up from 99
 *
 * Price has to come BACK to the level to fill, so the bar that takes the edge cannot
 * be the fill bar — that one is on its way out. The stop is the wick behind the
 * sweep, the target is still the candle's close, and `entry: 'both'` tries the
 * retrace first and falls back to the sweep entry when price never comes back.
 *
 * One thing the retrace entry gives up: the fill happens inside a bar, so what the
 * rest of that bar did cannot be ordered. The walk to the exit starts on the next
 * bar, which means a stop hit on the fill bar itself is not counted against it.
 *
 * Three things are decided here because the rule does not name them, and they are
 * stated rather than buried:
 *
 *   1. A reclaim on the LAST bar of the hour has no next bar to fill at inside the
 *      hour, so it is dropped and counted. It is not filled at a price that never
 *      traded.
 *   2. If the candle's close is not on the profitable side of the fill — a short
 *      whose candle closed in its upper third, a long whose candle closed in its
 *      lower third — there is no trade. The target would be behind the entry, and
 *      the honest answer to that is "no", not a re-priced target.
 *   3. If the OTHER side of the candle breaks before price comes back, the range
 *      resolved the other way and there is no sweep to trade back from.
 *
 * Everything else follows the folder's rules: bars are only read once they have
 * closed, the signal is a close and the fill is the next open, and every price
 * returned is one the bars really printed.
 */

const { baseInterval, nameOf } = require('./structure');
const { clock, minutesOfDay } = require('./session');
const { spec, count, roundToTick, pnl } = require('./contracts');

const DEFAULTS = {
  anchors: ['08:00', '14:00'],
  /* How far back inside the candle a close has to land, as a percentage of the
     candle's range, measured from the edge that was swept. */
  retest: 50,
  /* Which rule fills the trade:
       'sweep' — a bar has to CLOSE back inside the candle by the retest depth, and
                 the fill is the next bar's open. The rule as originally written.
       'fib'   — price only has to TRADE back to the 30/50/70 level, and the fill is
                 that level itself: a resting limit order, not a market order after
                 a close. No close is required.
       'both'  — the retrace is tried first, and the sweep entry is the fallback when
                 price never comes back to a retrace level. */
  entry: 'sweep',
  /* The retrace depths, as percentages of the candle's range measured in from the
     edge that was swept. Passed as a list; the first one price reaches fills. */
  fibs: [30, 50, 70],
  /* null keeps the rule's own target: the anchor candle's close. A number replaces
     it with that multiple of the risk, measured against whatever stop was set. */
  targetR: null,
  stopOn: 'close',
  slippageTicks: 0,
  contracts: 4,
  commission: 0,
};

const pad = (n) => String(n).padStart(2, '0');
const dayOf = (ms) => {
  const c = clock(ms);
  return `${c.year}-${pad(c.month)}-${pad(c.day)}`;
};

/*
 * The hour a bar BELONGS to, named by the hour it starts in. The bar that closes
 * at 09:00 is the 08:00 bar — it is the last quarter of the 08:00 candle, not the
 * first of the 09:00 one. Reading the clock this way is what keeps the anchor and
 * the action hour from sharing a bar.
 */
function hourOf(closeMs) {
  const m = (minutesOfDay(closeMs) - 1 + 1440) % 1440;
  return Math.floor(m / 60) * 60;
}

function timeOfDay(name) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(name == null ? '' : name).trim());
  if (!m) throw new Error(`${JSON.stringify(name)} is not a time of day — write it as 08:00 or 14:00`);
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) throw new Error(`${JSON.stringify(name)} is not a time on a clock`);
  return hours * 60 + minutes;
}

/* The named candles, refused loudly rather than skipped on a typo. */
function parseAnchors(anchors) {
  const names = Array.isArray(anchors) ? anchors : String(anchors == null ? '' : anchors).split(',');
  const out = [];
  for (const raw of names) {
    const name = String(raw).trim();
    if (!name) continue;
    const minutes = timeOfDay(name);
    if (minutes % 60 !== 0) throw new Error(`an anchor candle starts on the hour, and ${name} does not`);
    out.push({ name: `${pad(Math.floor(minutes / 60))}:00`, minutes });
  }
  if (!out.length) throw new Error('no anchor candle was named');
  return out;
}

function exitStyle(value) {
  const v = String(value == null ? DEFAULTS.stopOn : value).trim().toLowerCase();
  if (v !== 'close' && v !== 'touch') {
    throw new Error(`the stop is measured on a close or on a touch, got ${JSON.stringify(value)}`);
  }
  return v;
}

/*
 * The bars cut into whole hours on the Chicago clock.
 *
 * A bucket only grows while the bars inside it are CONTIGUOUS, so a missing bar
 * leaves the hour short and it is reported as short instead of being silently
 * treated as a complete candle. The day is taken from the bar's OPEN, not its
 * close, so the bar that opens at 23:45 and closes at midnight stays on the day it
 * opened — otherwise one hour would be split across two calendar dates.
 */
function hourBuckets(bars, base) {
  const groups = [];
  let current = null;
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const key = `${dayOf(bar.time)} ${hourOf(bar.time + base)}`;
    if (current && current.key === key && bar.time === current.end) {
      current.bars.push(bar);
      current.last = i;
      current.end = bar.time + base;
    } else {
      current = {
        key,
        day: dayOf(bar.time),
        slot: hourOf(bar.time + base),
        start: bar.time,
        end: bar.time + base,
        first: i,
        last: i,
        bars: [bar],
      };
      groups.push(current);
    }
  }
  return groups;
}

/* One hour of bars as a single candle: the first open, the widest high and low,
   and the last close — which is the price the whole trade is aimed at. */
function candleOf(group) {
  let high = -Infinity;
  let low = Infinity;
  for (const bar of group.bars) {
    if (bar.high > high) high = bar.high;
    if (bar.low < low) low = bar.low;
  }
  return {
    time: group.start,
    end: group.end,
    open: group.bars[0].open,
    high,
    low,
    close: group.bars[group.bars.length - 1].close,
  };
}

/*
 * The setup, from the candle and the bars of the hour after it.
 *
 * Pure, so the rule can be checked against a case written out by hand. `signal` is
 * the index INTO `actionBars` of the bar whose close was the reclaim; the fill is
 * the bar after it.
 */
function sweepSetup({ candle, actionBars, retest = DEFAULTS.retest }) {
  const range = candle.high - candle.low;
  if (!(range > 0)) return { reason: 'the anchor candle had no range to retest' };
  const depth = range * (retest / 100);

  let side = null;      // which edge was swept: 'up' is the high, 'down' is the low
  let extreme = null;   // the sweep's own extreme: the level the stop goes behind
  let signal = null;

  for (let k = 0; k < actionBars.length; k++) {
    const bar = actionBars[k];
    const above = bar.high > candle.high;
    const below = bar.low < candle.low;

    if (side === null) {
      if (above && below) {
        /* One bar took both edges. Which one was the sweep is read off the close,
           because that is the only price on the bar that says what was accepted. */
        if (bar.close > candle.high) side = 'up';
        else if (bar.close < candle.low) side = 'down';
        else return { reason: 'one bar took both sides of the candle and closed inside it' };
      } else if (above) side = 'up';
      else if (below) side = 'down';
    } else if ((side === 'up' && below) || (side === 'down' && above)) {
      return { reason: 'the other side of the candle broke before price came back' };
    }

    if (side === 'up') {
      if (extreme === null || bar.high > extreme) extreme = bar.high;
      if (bar.close <= candle.high - depth) { signal = k; break; }
    } else if (side === 'down') {
      if (extreme === null || bar.low < extreme) extreme = bar.low;
      if (bar.close >= candle.low + depth) { signal = k; break; }
    }
  }

  if (side === null) return { reason: 'price never left the candle inside the hour' };
  if (signal === null) return { reason: 'price left the candle and never closed back inside it' };

  return {
    setup: {
      direction: side === 'up' ? 'short' : 'long',
      signal,
      swept: side === 'up' ? candle.high : candle.low,
      target: candle.close,
      stop: extreme,
    },
  };
}

/*
 * The retrace depths, refused loudly. 0 and 100 are the edges of the candle, which
 * are the sweep itself rather than a retrace, so they are not levels here.
 */
function parseFibs(fibs) {
  const list = Array.isArray(fibs) ? fibs : String(fibs == null ? '' : fibs).split(',');
  const out = [];
  for (const raw of list) {
    const text = String(raw).trim();
    if (!text) continue;
    const pct = Number(text);
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
      throw new Error(`a retrace depth is a percentage of the candle between 0 and 100, got ${JSON.stringify(raw)}`);
    }
    if (!out.includes(pct)) out.push(pct);
  }
  if (!out.length) throw new Error('no retrace depth was named');
  /* Shallow first: a limit at 30% is reached before one at 70%, so the order the
     levels are checked in is the order price gets to them. */
  return out.sort((a, b) => a - b);
}

function entryMode(value) {
  const v = String(value == null ? DEFAULTS.entry : value).trim().toLowerCase();
  if (v !== 'sweep' && v !== 'fib' && v !== 'both') {
    throw new Error(`the entry is sweep, fib or both, got ${JSON.stringify(value)}`);
  }
  return v;
}

/*
 * The retrace entry.
 *
 * Same candle, same direction, same stop and same target as the sweep rule. The one
 * difference is what counts as the entry: price has to come back into the candle
 * and TRADE at the depth, and the fill is that depth itself — a limit order resting
 * there — instead of a close followed by a market order.
 *
 *   sweep high → short, the depth measured DOWN from the high
 *   sweep low  → long,  the depth measured UP from the low
 *
 * The bar that takes the edge is not an entry bar. It is on its way out, and a limit
 * it passes through on the way is not a retrace — the trade is the COME BACK, so the
 * fill bar is a later one.
 */
function fibSetup({ candle, actionBars, fibs = DEFAULTS.fibs }) {
  const range = candle.high - candle.low;
  if (!(range > 0)) return { reason: 'the anchor candle had no range to retrace' };
  const depths = parseFibs(fibs);

  let side = null;      // which edge was swept: 'up' is the high, 'down' is the low
  let extreme = null;   // the wick the stop goes behind
  let sweepBar = null;

  for (let k = 0; k < actionBars.length; k++) {
    const bar = actionBars[k];
    const above = bar.high > candle.high;
    const below = bar.low < candle.low;

    if (side === null) {
      if (above && below) {
        if (bar.close > candle.high) side = 'up';
        else if (bar.close < candle.low) side = 'down';
        else return { reason: 'one bar took both sides of the candle and closed inside it' };
      } else if (above) side = 'up';
      else if (below) side = 'down';
      extreme = side === 'up' ? bar.high : side === 'down' ? bar.low : null;
      sweepBar = k;
      continue;          // the bar on its way out is not the come back
    }

    if ((side === 'up' && below) || (side === 'down' && above)) {
      return { reason: 'the other side of the candle broke before price came back' };
    }
    if (side === 'up') { if (bar.high > extreme) extreme = bar.high; }
    else if (bar.low < extreme) extreme = bar.low;

    const short = side === 'up';
    for (const pct of depths) {
      const level = short
        ? candle.high - range * (pct / 100)
        : candle.low + range * (pct / 100);
      /* Price is ABOVE the candle after a high sweep, so a sell limit under it fills
         when the bar trades back DOWN through the level — and the mirror for a long.
         Filling on the bar's own open would be a market order, which is the other
         rule's entry, not this one. */
      const reached = short ? bar.low <= level : bar.high >= level;
      if (!reached) continue;
      return {
        setup: {
          direction: short ? 'short' : 'long',
          signal: k,
          entry: level,
          fib: pct,
          swept: short ? candle.high : candle.low,
          target: candle.close,
          stop: extreme,
          sweep: sweepBar,
        },
      };
    }
  }

  if (side === null) return { reason: 'price never left the candle inside the hour' };
  const where = depths.map((p) => `${p}%`).join('/');
  return { reason: `price left the candle and never traded back to the ${where} level` };
}

/*
 * Walk one trade from its fill to its exit, and never past the last bar of the
 * action hour. Stops are checked before targets: a bar that closes through both is
 * scored as the loss.
 */
function runSweepTrade({ bars, start, last, stopAt, stopOn, slip }) {
  const long = stopAt.direction === 'long';
  const touch = stopOn === 'touch';
  let interaction = null;

  for (let j = start; j <= last; j++) {
    const bar = bars[j];

    const stopCrossed = touch
      ? (long ? bar.low <= stopAt.stop : bar.high >= stopAt.stop)
      : (long ? bar.close <= stopAt.stop : bar.close >= stopAt.stop);
    if (stopCrossed) {
      const price = touch
        ? (long ? stopAt.stop - slip : stopAt.stop + slip)
        : (long ? bar.close - slip : bar.close + slip);
      interaction = { index: j, time: bar.time, reason: 'stop', price };
      break;
    }

    const targetCrossed = long ? bar.close >= stopAt.target : bar.close <= stopAt.target;
    if (targetCrossed) {
      interaction = { index: j, time: bar.time, reason: 'target', price: bar.close };
      break;
    }

    if (j === last) {
      interaction = { index: j, time: bar.time, reason: 'hour', price: bar.close };
    }
  }

  if (!interaction) throw new Error('a sweep trade ran past the end of its hour without an exit — that cannot happen');
  return interaction;
}

/**
 * Run the sweep rule over a set of bars.
 *
 * @param {object} opts
 * @param {Array}  opts.bars             15m bars, or any size that divides an hour
 * @param {string[]} [opts.anchors]      ['08:00','14:00'] Central
 * @param {number} [opts.retest]         30, 50 or 70 — per cent of the candle
 * @param {string} [opts.stopOn]         close (default) or touch
 */
function findSweepTrades({
  bars, anchors = DEFAULTS.anchors, retest = DEFAULTS.retest, stopOn = DEFAULTS.stopOn,
  entry = DEFAULTS.entry, fibs = DEFAULTS.fibs,
  targetR = DEFAULTS.targetR, slippageTicks = DEFAULTS.slippageTicks, instrument = null,
  contracts = DEFAULTS.contracts, commission = DEFAULTS.commission,
  directions = ['long', 'short'],
} = {}) {
  if (!Array.isArray(bars) || bars.length < 3) throw new Error('the sweep rule needs at least three bars');
  const base = baseInterval(bars);
  if ((60 * 60000) % base !== 0) {
    throw new Error(`the sweep rule reads whole hours, and ${nameOf(base)} bars do not divide one`);
  }
  const depthPct = Number(retest);
  if (!Number.isFinite(depthPct) || depthPct <= 0 || depthPct >= 100) {
    throw new Error(`the retest depth is a percentage of the candle between 0 and 100, got ${JSON.stringify(retest)}`);
  }
  const ratio = targetR === null || targetR === undefined ? null : Number(targetR);
  if (ratio !== null && (!Number.isFinite(ratio) || ratio <= 0)) {
    throw new Error(`a target multiple has to be a positive number, got ${JSON.stringify(targetR)}`);
  }
  const perHour = (60 * 60000) / base;
  const wanted = parseAnchors(anchors);
  const groups = hourBuckets(bars, base);
  const wantedDirections = new Set(Array.isArray(directions) ? directions : ['long', 'short']);
  for (const d of wantedDirections) {
    if (d !== 'long' && d !== 'short') throw new Error(`a trade is a long or a short, got ${JSON.stringify(d)}`);
  }

  const style = exitStyle(stopOn);
  const mode = entryMode(entry);
  const fibDepths = parseFibs(fibs);
  const contract = instrument ? spec(instrument) : null;
  const rounds = count(contracts);
  const perContract = commission === undefined || commission === null ? 0 : Number(commission);
  if (!Number.isFinite(perContract) || perContract < 0) throw new Error('commission cannot be negative');
  const slipCount = slippageTicks === undefined || slippageTicks === null ? 0 : Number(slippageTicks);
  if (!Number.isFinite(slipCount) || slipCount < 0) throw new Error('slippage has to be zero or more ticks');
  const slip = contract ? slipCount * spec(instrument).tickSize : 0;

  const setups = [];
  const skipped = [];
  const trades = [];

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    const anchor = wanted.find((a) => a.minutes === group.slot);
    if (!anchor) continue;
    const where = { day: group.day, anchor: anchor.name, time: group.start };

    if (group.bars.length !== perHour) {
      skipped.push({ ...where, reason: `the ${anchor.name} candle has ${group.bars.length} of ${perHour} bars` });
      continue;
    }

    const next = groups[g + 1];
    if (!next || next.start !== group.end) {
      skipped.push({ ...where, reason: `no hour follows the ${anchor.name} candle` });
      continue;
    }
    if (next.bars.length !== perHour) {
      skipped.push({ ...where, reason: `the hour after the ${anchor.name} candle has ${next.bars.length} of ${perHour} bars` });
      continue;
    }

    /*
     * On 1h bars the action hour is a SINGLE bar, so a reclaim on it leaves no bar
     * inside the hour to fill at and the rule could never take a trade. When the
     * action hour holds one bar the trade is allowed to run to the end of the hour
     * after it: the fill is that hour's open and its close is the clock. The same
     * two hours of price — 09:00 and 10:00 — that a 15m run reads as eight bars.
     * Nothing else changes: the level, the direction, the target and the stop are
     * all read from the anchor candle and the action bar as before.
     */
    let hold = next;
    if (perHour === 1) {
      const after = groups[g + 2];
      if (!after || after.start !== next.end) {
        skipped.push({ ...where, reason: `the hour after the ${anchor.name} action hour is missing, and a 1h reclaim has nowhere to fill without it` });
        continue;
      }
      if (after.bars.length !== perHour) {
        skipped.push({ ...where, reason: `the hour after the ${anchor.name} action hour has ${after.bars.length} of ${perHour} bars` });
        continue;
      }
      hold = after;
      /* The retrace needs a bar to come back on. On 1h bars that bar is the 10:00
         hour, so the trade is given the hour after it to finish in — the same
         allowance the sweep entry already takes, one hour further out. */
      if (mode !== 'sweep') {
        const later = groups[g + 3];
        if (!later || later.start !== after.end) {
          skipped.push({ ...where, reason: `the hour after the ${anchor.name} retrace hour is missing, so a 1h retrace has nowhere to exit` });
          continue;
        }
        if (later.bars.length !== perHour) {
          skipped.push({ ...where, reason: `the hour after the ${anchor.name} retrace hour has ${later.bars.length} of ${perHour} bars` });
          continue;
        }
        hold = later;
      }
    }

    const candle = candleOf(group);
    let plan = null;
    let why = null;

    /* The retrace first when it is switched on: if price comes back to the level,
       the limit fills before any close-based entry could. */
    if (mode !== 'sweep') {
      /* The retrace is read over every bar between the candle and the last one the
         trade may still be in. On 15m and 5m bars that is the action hour itself; on
         1h bars it is the action hour AND the hour the fill is allowed to come back
         in, because a one-bar hour has no later bar to retrace on. */
      const found = fibSetup({ candle, actionBars: bars.slice(next.first, hold.last + 1), fibs: fibDepths });
      if (found.setup) {
        const touch = next.first + found.setup.signal;
        plan = {
          ...found.setup,
          entryRule: 'fib',
          fillIndex: touch,
          signalIndex: touch,
          entryPrice: found.setup.entry,
          /* The fill happens INSIDE the touch bar, so what the rest of that bar did
             cannot be ordered: the walk starts on the next one. */
          exitStart: touch + 1,
        };
      } else if (mode === 'fib') {
        why = found.reason;
      }
    }
    if (!plan && mode !== 'fib') {
      const found = sweepSetup({ candle, actionBars: next.bars, retest: depthPct });
      if (found.setup) {
        const signalIndex = next.first + found.setup.signal;
        plan = {
          ...found.setup,
          entryRule: 'sweep',
          fillIndex: signalIndex + 1,
          signalIndex,
          entryPrice: null,   // read off the fill bar's open, below
          exitStart: signalIndex + 1,
        };
      } else if (!why) {
        why = found.reason;
      }
    }
    if (!plan) {
      skipped.push({ ...where, reason: why || 'no setup' });
      continue;
    }
    if (!wantedDirections.has(plan.direction)) {
      skipped.push({ ...where, reason: `the ${plan.direction} side was switched off` });
      continue;
    }
    if (plan.exitStart > hold.last || plan.fillIndex > hold.last) {
      skipped.push({ ...where, reason: 'the setup came on the last bar of the hour, so there was no room to trade it' });
      continue;
    }

    const setup = plan;
    const signalIndex = plan.signalIndex;
    const fillIndex = plan.fillIndex;
    const entryPrice = plan.entryPrice === null ? bars[fillIndex].open : plan.entryPrice;
    const long = setup.direction === 'long';
    const stop = contract ? roundToTick(contract, setup.stop) : setup.stop;
    /* The risk is measured against the stop the rule set, so a 1:1 target moves
       with the sweep however wide or tight that happens to be. */
    const risk = Math.abs(entryPrice - stop);
    const aim = ratio === null
      ? setup.target
      : (long ? entryPrice + ratio * risk : entryPrice - ratio * risk);
    const target = contract ? roundToTick(contract, aim) : aim;

    if (long) {
      if (!(target > entryPrice)) {
        skipped.push({ ...where, reason: 'the candle closed below the fill, so a long has no room to its close' });
        continue;
      }
      if (!(stop < entryPrice)) {
        skipped.push({ ...where, reason: 'the sweep low is not under the fill' });
        continue;
      }
    } else {
      if (!(target < entryPrice)) {
        skipped.push({ ...where, reason: 'the candle closed above the fill, so a short has no room to its close' });
        continue;
      }
      if (!(stop > entryPrice)) {
        skipped.push({ ...where, reason: 'the sweep high is not over the fill' });
        continue;
      }
    }

    const signal = { ...setup, stop, target };
    const interaction = runSweepTrade({
      bars, start: plan.exitStart, last: hold.last, stopAt: signal, stopOn: style, slip,
    });

    const points = long ? interaction.price - entryPrice : entryPrice - interaction.price;
    const trade = {
      direction: setup.direction,
      /* Every trade the TBR rule takes is a scalp: one candle, one hour to work in,
         and flat at the end of it. The label travels with the trade so a run can be
         read as scalps and nothing else. */
      kind: 'scalp',
      scalp: true,
      entryRule: setup.entryRule,
      fib: setup.entryRule === 'fib' ? setup.fib : null,
      day: group.day,
      anchor: anchor.name,
      candle: { high: candle.high, low: candle.low, close: candle.close },
      level: setup.swept,
      target,
      stop,
      signal: { index: signalIndex, time: bars[signalIndex].time },
      entry: { index: fillIndex, time: bars[fillIndex].time, price: entryPrice },
      exit: interaction,
      points,
      risk,
      r: risk > 0 ? points / risk : null,
    };
    if (contract) {
      const gross = pnl(contract, trade.entry.price, trade.exit.price, rounds, trade.direction);
      trade.fees = perContract * rounds * 2;
      trade.dollars = gross - trade.fees;
      trade.grossDollars = gross;
      trade.contracts = rounds;
      trade.instrument = contract.symbol;
    }
    trades.push(trade);
    setups.push({ index: signalIndex, time: bars[signalIndex].time, day: group.day, ...setup });
  }

  return {
    trades,
    setups,
    skipped,
    config: {
      anchors: wanted.map((a) => a.name),
      retest: depthPct,
      entry: mode,
      fibs: fibDepths,
      scalp: true,
      targetR: ratio,
      stopOn: style,
      slippageTicks: slipCount,
      instrument: contract ? contract.symbol : null,
      contracts: rounds,
      commission: perContract,
      base,
      holdHours: perHour === 1 ? (mode === 'sweep' ? 2 : 3) : 1,
      bars: bars.length,
      firstTime: bars[0].time,
      lastTime: bars[bars.length - 1].time,
    },
  };
}

module.exports = {
  DEFAULTS, hourOf, parseAnchors, parseFibs, hourBuckets, candleOf, sweepSetup, fibSetup,
  runSweepTrade, findSweepTrades,
};
