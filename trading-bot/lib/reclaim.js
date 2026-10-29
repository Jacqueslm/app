'use strict';
/*
 * Strategy one: market structure on three timeframes, traded back to the high the
 * market last made.
 *
 * The rules are yours, written down here exactly as given. Each timeframe has one
 * job and only one, which is the whole point of splitting them:
 *
 *   CLOCK      New York session only, on Central time. Nothing opens outside
 *              08:30–15:00 Chicago, and nothing is carried overnight.
 *   BIAS       4-hour structure must be up for a long, down for a short.
 *   DIRECTION  1-hour structure must agree: higher high AND higher low for a long
 *              (HH, HL), lower high and lower low for a short (LH, LL). The 1-hour
 *              is also where the two levels come from — it is the structure that
 *              has the levels worth trading to.
 *   ENTRY      The trade is TAKEN on the 15-minute. When the 1-hour and the 4-hour
 *              agree, a 15-minute CLOSE back above the previous 15-minute swing
 *              high is the trigger. The short is the mirror: a 15-minute close back
 *              below the previous 15-minute swing low.
 *   TARGET     The 1-hour higher high that was ALREADY MADE — the previous one, not
 *              a new high still to come. A new high is a hope; the level that exists
 *              is measurable and is where the last sellers were. For a short, the
 *              1-hour lower low already made.
 *   STOP       Behind the 1-hour higher low (the 1-hour lower high for a short) —
 *              the level that makes the read wrong. Once that low goes there is no
 *              higher low, so there is nothing left to be long.
 *   ONE ENTRY  First entry of the session only. Once a trade is taken, that day is
 *              done, whichever direction it was.
 *
 * What that split does NOT mean: the 15-minute's own trend has to be up as well. It
 * usually is not — a pullback inside a 1-hour up trend reads as down structure on
 * the 15-minute, and that is precisely where the entry is taken. The 15-minute is
 * asked for one thing only, the swing high that has just been reclaimed.
 *
 * EXITS ARE MEASURED ON CLOSES, NOT WICKS. A wick through the target is a wick. The
 * exit happens when a 15-minute bar CLOSES at or through the level, and the exit
 * price is that close. The same rule applies to the stop by default: the level is
 * broken when a bar closes through it. `stopOn: 'touch'` measures the stop the other
 * way — the resting order filling where it sits — and is there because that is how
 * a real stop order behaves, not because it is the rule.
 *
 * The one thing the rules do not name:
 *
 *   SESSION END  If neither level is closed through by 15:00 Central, the trade is
 *                closed at that bar's close. "New York session only" means flat by
 *                the end of it, and a trade carried overnight is a different
 *                strategy from the one you described.
 *
 * The honesty rules this file is built to, same as the rest of the folder:
 *
 *   - A swing is only known when it is confirmed, so every level is the level as it
 *     stood at that bar's close. lib/structure.js refuses to read a swing early,
 *     and this file only ever asks it for the close of a bar.
 *   - A bigger timeframe is only read once its own bar has CLOSED. Standing on a
 *     15-minute bar at 09:45 you do not get the 1-hour bar that is still forming.
 *   - The signal is a close, so the fill is the NEXT bar's open — the price a market
 *     order placed after that close would actually have got. A signal on the
 *     session's last bar has no fill inside the session and is dropped and counted,
 *     not quietly filled at a price that never traded.
 *   - When a wick touches both levels in one bar, the stop is taken under
 *     `stopOn: 'touch'`. On closes only one of them can be crossed by one close, so
 *     the question does not arise.
 */

const { multiTimeframe, baseInterval, nameOf, parseInterval } = require('./structure');
const { sessionWindow, sessionKey, inSession, describeSession } = require('./session');
const { spec, count, roundToTick, pnl } = require('./contracts');

const DEFAULTS = {
  biasTimeframe: '4h',
  directionTimeframe: '1h',
  session: 'ny',
  left: 2,
  right: 2,
  onePerSession: true,
  /* 'close' — the level is broken by a close through it, and that close is the exit.
     'touch' — a resting stop order fills when the price trades through the level. */
  stopOn: 'close',
  /* 'structure' — the rule: the stop sits behind the 1h higher low. 'swing' is a
     measurement variant that sits it behind the 15m swing the trigger came from. */
  stopAt: 'structure',
  /* null — the rule: the target is the 1h high already made. A number puts it that
     many multiples of the risk away instead, for measuring the payoff. */
  targetR: null,
  /* null — every trigger is taken. A number only takes a trigger bar whose range is
     that many times the median range of the bars before it: the "drastic move" filter. */
  impulse: null,
  slippageTicks: 0,
  contracts: 4,
};

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

/* The stop's convention, refused loudly rather than defaulted on a typo. */
function exitStyle(value, fallback) {
  const v = String(value == null ? fallback : value).trim().toLowerCase();
  if (v !== 'close' && v !== 'touch') {
    throw new Error(`the stop is measured on a close or on a touch, got ${JSON.stringify(value)}`);
  }
  return v;
}

/*
 * The setup at one bar's close, or nothing.
 *
 * Pure on purpose: it takes the three structure reads and two closes and returns the
 * levels, so the rule can be checked by hand against a written-out case instead of
 * against a chart someone has to re-derive.
 *
 *   entry      the 15-minute read — its previous swing high is the level to reclaim
 *   direction  the 1-hour read — its trend is the permission, its high and low the
 *              two levels (the target above, the stop below, for a long)
 *   bias       the 4-hour read — its trend has to agree
 *
 * Long: 4h up, 1h up (HH + HL), the previous 15m close at or under the previous 15m
 * high and this close above it, with room up to the 1h high and a stop under the
 * entry. Short is every word of that mirrored.
 */
function setupAt({ entry, direction, bias, prevClose, close, directions = ['long', 'short'] }) {
  if (!entry || !direction || !bias) return null;
  if (!Number.isFinite(prevClose) || !Number.isFinite(close)) return null;
  const wanted = new Set(directions);

  if (bias.trend === 'up' && direction.trend === 'up' && wanted.has('long')) {
    const level = entry.prevHigh;     // the 15m high to reclaim — the trigger
    const target = direction.high;    // the 1h higher high already made — not a new one
    const stop = direction.low;       // the 1h higher low behind the trade
    if (!level || !target || !stop) return null;
    if (!(prevClose <= level.price && close > level.price)) return null; // getting back above it
    if (!(close < target.price)) return null;                            // no room up to the 1h high
    if (!(stop.price < close)) return null;                              // nothing under the entry to risk
    return {
      direction: 'long', level: level.price, target: target.price, stop: stop.price,
      /* The 15m swing the trigger came from. Not the rule's stop — the rule's stop is
         the 1h higher low — it is here so a closer stop can be measured against these
         same entries instead of guessed at. */
      swingStop: entry.prevLow ? entry.prevLow.price : null,
    };
  }

  if (bias.trend === 'down' && direction.trend === 'down' && wanted.has('short')) {
    const level = entry.prevLow;      // the 15m low to reclaim downward — the trigger
    const target = direction.low;     // the 1h lower low already made
    const stop = direction.high;      // the 1h lower high behind the trade
    if (!level || !target || !stop) return null;
    if (!(prevClose >= level.price && close < level.price)) return null;
    if (!(close > target.price)) return null;
    if (!(stop.price > close)) return null;
    return {
      direction: 'short', level: level.price, target: target.price, stop: stop.price,
      swingStop: entry.prevHigh ? entry.prevHigh.price : null,
    };
  }

  return null;
}

const closeOf = (bar, base) => bar.time + base;

/* How much ground the bars before this one usually cover. The median, not the
   average, because a single news bar drags an average up and makes every quiet bar
   after it look quiet. Only bars BEFORE `i` are read, so a trigger cannot inflate
   its own baseline. */
const IMPULSE_LOOKBACK = 50;
const IMPULSE_MINIMUM = 20;
function medianRange(bars, i, lookback = IMPULSE_LOOKBACK) {
  const from = Math.max(0, i - lookback);
  if (i - from < IMPULSE_MINIMUM) return null;
  const ranges = [];
  for (let j = from; j < i; j++) ranges.push(bars[j].high - bars[j].low);
  ranges.sort((a, b) => a - b);
  const mid = ranges.length >> 1;
  return ranges.length % 2 ? ranges[mid] : (ranges[mid - 1] + ranges[mid]) / 2;
}

/*
 * Walk one trade from its fill to its exit. Every exit is a close through a level,
 * except a stop on `stopOn: 'touch'`, which fills at the level it was sitting at.
 * Every price returned is a price the bar really printed.
 */
function runTrade({ bars, start, entry, signal, base, win, slip, stopOn = DEFAULTS.stopOn }) {
  const long = signal.direction === 'long';
  const touch = stopOn === 'touch';
  let interaction = null;

  for (let j = start; j < bars.length; j++) {
    const bar = bars[j];

    /* The stop. On a close, the level is only broken if the bar closes through it,
       and the exit is that close — a wick below and back above is not an exit. On a
       touch it is the resting order, filled at the level plus whatever slip you
       asked for. Checked first: when a wick holds both levels, the loss is assumed. */
    const stopCrossed = touch
      ? (long ? bar.low <= signal.stop : bar.high >= signal.stop)
      : (long ? bar.close <= signal.stop : bar.close >= signal.stop);
    if (stopCrossed) {
      const price = touch
        ? (long ? signal.stop - slip : signal.stop + slip)
        : (long ? bar.close - slip : bar.close + slip);
      interaction = { index: j, time: bar.time, reason: 'stop', price };
      break;
    }

    /* The target is a close at or through the level, never a wick — you see the
       close print and you are out, so the exit is that close. */
    const targetCrossed = long ? bar.close >= signal.target : bar.close <= signal.target;
    if (targetCrossed) {
      interaction = { index: j, time: bar.time, reason: 'target', price: bar.close };
      break;
    }

    /* The last bar whose close still lands inside the same session. If the next
       bar belongs to another day, or to nothing at all, this close is the exit. */
    const next = bars[j + 1];
    const hereClose = closeOf(bar, base);
    const ends = !next
      || sessionKey(closeOf(next, base), win) !== sessionKey(hereClose, win)
      || !inSession(closeOf(next, base), win);
    if (ends) {
      interaction = { index: j, time: bar.time, reason: 'session', price: bar.close };
      break;
    }
  }

  if (!interaction) throw new Error('a trade ran off the end of the bars without an exit — that cannot happen, the last bar always ends its session');

  const points = long ? interaction.price - entry.price : entry.price - interaction.price;
  const risk = Math.abs(entry.price - signal.stop);
  return {
    direction: signal.direction,
    session: sessionKey(closeOf(bars[start], base), win),
    level: signal.level,
    target: signal.target,
    stop: signal.stop,
    signal: { index: signal.index, time: bars[signal.index].time },
    entry: { index: start, time: bars[start].time, price: entry.price },
    exit: interaction,
    points,
    risk,
    r: risk > 0 ? points / risk : null,
  };
}

/*
 * Turn a list of setups into filled trades.
 *
 * A setup is { index, direction, level, target, stop } where index is the bar whose
 * CLOSE produced the signal. Fills are the next bar's open.
 */
function simulate({
  bars, setups, session = DEFAULTS.session, onePerSession = DEFAULTS.onePerSession,
  stopOn = DEFAULTS.stopOn, slippageTicks = DEFAULTS.slippageTicks,
  instrument = null, contracts = DEFAULTS.contracts, commission = 0,
  stopAt = DEFAULTS.stopAt, targetR = DEFAULTS.targetR,
}) {
  if (!Array.isArray(bars) || bars.length < 2) throw new Error('simulate needs at least two bars');
  if (!Array.isArray(setups)) throw new Error('simulate needs an array of setups');
  const base = baseInterval(bars);
  const win = sessionWindow(session);
  const rounds = count(contracts);
  const style = exitStyle(stopOn, DEFAULTS.stopOn);
  const tick = instrument ? spec(instrument).tickSize : 0;
  const slip = number(slippageTicks, DEFAULTS.slippageTicks, 'slippageTicks') * tick;
  const contract = instrument ? spec(instrument) : null;
  const perContract = number(commission, 0, 'commission');
  if (perContract < 0) throw new Error('commission cannot be negative');

  const byIndex = new Map();
  for (const setup of setups) {
    if (!Number.isInteger(setup.index)) throw new Error(`a setup needs a bar index, got ${JSON.stringify(setup.index)}`);
    if (setup.direction !== 'long' && setup.direction !== 'short') {
      throw new Error(`a setup is a long or a short, got ${JSON.stringify(setup.direction)}`);
    }
    for (const key of ['level', 'target', 'stop']) {
      if (!Number.isFinite(setup[key])) throw new Error(`setup at bar ${setup.index} has no ${key}`);
    }
    byIndex.set(setup.index, setup);
  }

  const trades = [];
  const skipped = [];
  const taken = new Set();
  let busyUntil = -1;

  for (let i = 1; i < bars.length; i++) {
    const signal = byIndex.get(i - 1);
    if (!signal) continue;
    const skip = (reason) => skipped.push({
      index: signal.index, time: bars[signal.index].time, direction: signal.direction, reason,
    });

    if (i - 1 < busyUntil) { skip('a trade was already on'); continue; }

    const signalClose = closeOf(bars[i - 1], base);
    if (!inSession(signalClose, win)) { skip('the signal closed outside the session'); continue; }
    const key = sessionKey(signalClose, win);
    if (onePerSession && taken.has(key)) { skip(`the first entry of ${key} was already taken`); continue; }

    const fillBar = bars[i];
    const fillClose = closeOf(fillBar, base);
    if (sessionKey(fillClose, win) !== key || !inSession(fillClose, win)) {
      skip('the next bar would have filled outside the same session');
      continue;
    }

    /* The structural levels onto the tick grid, because an order priced between
       ticks is rejected. If rounding moves a level past the entry, the trade is
       not tradable and is dropped rather than re-priced into something else. */
    const rawStop = stopAt === 'swing' ? signal.swingStop : signal.stop;
    if (!Number.isFinite(rawStop)) { skip('there was no swing behind the entry to put a stop at'); continue; }
    const stop = contract ? roundToTick(contract, rawStop) : rawStop;
    const long = signal.direction === 'long';
    const entryPrice = fillBar.open;

    /* Two ways to place the target, and the rule is the default one: the 1h high
       already made. targetR ignores that level and puts the target a multiple of the
       risk away instead, which is the honest way to ask whether the payoff is the
       broken part rather than the entry. */
    let target;
    if (targetR === null || targetR === undefined) {
      target = contract ? roundToTick(contract, signal.target) : signal.target;
    } else {
      const risk = long ? entryPrice - stop : stop - entryPrice;
      if (!(risk > 0)) { skip('the stop is on the wrong side of the entry'); continue; }
      target = long ? entryPrice + targetR * risk : entryPrice - targetR * risk;
      if (contract) target = roundToTick(contract, target);
    }

    if (long) {
      if (targetR === null || targetR === undefined) {
        if (entryPrice >= target) { skip('the price opened at or past the target'); continue; }
      }
      if (entryPrice <= stop) { skip('the price opened at or under the stop'); continue; }
    } else {
      if (targetR === null || targetR === undefined) {
        if (entryPrice <= target) { skip('the price opened at or past the target'); continue; }
      }
      if (entryPrice >= stop) { skip('the price opened at or over the stop'); continue; }
    }

    const trade = runTrade({
      bars, start: i, signal: { ...signal, stop, target }, base, win, slip, stopOn: style,
      entry: { price: entryPrice },
    });
    trade.entry = { index: i, time: fillBar.time, price: entryPrice };
    if (contract) {
      const gross = pnl(contract, trade.entry.price, trade.exit.price, rounds, trade.direction);
      /* Commission is charged both ways, because the trade pays to open and to
         close. It is per contract, so it scales with size exactly as it does at a
         broker. */
      trade.fees = perContract * rounds * 2;
      trade.dollars = gross - trade.fees;
      trade.grossDollars = gross;
      trade.contracts = rounds;
      trade.instrument = contract.symbol;
    }
    taken.add(key);
    trades.push(trade);
    busyUntil = trade.exit.index;
  }

  return {
    trades,
    skipped,
    config: {
      session: win.key, base, onePerSession, stopOn: style, stopAt,
      targetR: targetR === undefined ? null : targetR,
      slippageTicks: number(slippageTicks, 0, 'slippageTicks'),
      instrument: contract ? contract.symbol : null,
      contracts: rounds,
      commission: perContract,
    },
  };
}

/*
 * Win rate, profit and loss factor, and the rest.
 *
 * Everything is measured on one key at a time — points, or dollars when an
 * instrument was given — so a figure can never be a mix of the two. A "scratch" is
 * a trade that closed exactly flat; it is counted, and it is left out of the win
 * rate, because calling it a win would flatter the number and calling it a loss
 * would do the opposite.
 */
function stats(trades, key = 'points') {
  if (!Array.isArray(trades)) throw new Error('stats needs a list of trades');
  const values = trades.map((t) => t[key]).filter((v) => Number.isFinite(v));
  const wins = values.filter((v) => v > 0);
  const losses = values.filter((v) => v < 0);
  const scratches = values.filter((v) => v === 0);
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = -losses.reduce((a, b) => a + b, 0);
  const net = grossProfit - grossLoss;
  const decided = wins.length + losses.length;
  const average = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
  const avgWin = average(wins);
  const avgLoss = average(losses.map((v) => -v));

  let running = 0;
  let peak = 0;
  let worst = 0;
  let streak = 0;
  let worstStreak = 0;
  for (const value of values) {
    running += value;
    if (running > peak) peak = running;
    if (peak - running > worst) worst = peak - running;
    if (value < 0) { streak++; if (streak > worstStreak) worstStreak = streak; } else if (value > 0) streak = 0;
  }

  const rValues = trades.map((t) => t.r).filter((r) => Number.isFinite(r));

  return {
    unit: key,
    trades: values.length,
    longs: trades.filter((t) => t.direction === 'long').length,
    shorts: trades.filter((t) => t.direction === 'short').length,
    wins: wins.length,
    losses: losses.length,
    scratches: scratches.length,
    winRatePct: decided ? (wins.length / decided) * 100 : null,
    net,
    grossProfit,
    grossLoss,
    /* Profit factor: everything won divided by everything lost. With no losing
       trade it is not infinite, it is unknown, and it says so. */
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    averageWin: avgWin,
    averageLoss: avgLoss,
    payoffRatio: avgWin !== null && avgLoss ? avgWin / avgLoss : null,
    /* The win rate this exact mix of average win and average loss needs to break
       even. A rule can be right more often than not and still lose money. */
    breakevenWinRatePct: avgWin !== null && avgLoss ? (avgLoss / (avgWin + avgLoss)) * 100 : null,
    expectancy: values.length ? net / values.length : null,
    largestWin: wins.length ? Math.max(...wins) : null,
    largestLoss: losses.length ? Math.min(...losses) : null,
    maxLossesInARow: worstStreak,
    maxRunDown: worst,
    averageR: average(rValues),
    totalR: rValues.length ? rValues.reduce((a, b) => a + b, 0) : null,
  };
}

/**
 * Run strategy one over a set of bars.
 *
 * @param {object} opts
 * @param {Array}  opts.bars                the bars; their spacing is the ENTRY timeframe
 * @param {string} [opts.directionTimeframe] 1h — the trend and the two levels
 * @param {string} [opts.biasTimeframe]      4h
 * @param {string} [opts.entryTimeframe]     the bars' own size; checked, not assumed
 * @param {string} [opts.session]            ny, on Central time
 * @param {string} [opts.stopOn]             close (default) or touch
 * @param {number[]} [opts.directions]       ['long','short'], or one of them
 */
function findTrades({
  bars, biasTimeframe = DEFAULTS.biasTimeframe, directionTimeframe = DEFAULTS.directionTimeframe,
  entryTimeframe = null, session = DEFAULTS.session,
  left = DEFAULTS.left, right = DEFAULTS.right, directions = ['long', 'short'],
  onePerSession = DEFAULTS.onePerSession, stopOn = DEFAULTS.stopOn,
  slippageTicks = DEFAULTS.slippageTicks, instrument = null, contracts = DEFAULTS.contracts,
  commission = 0, anchorMs = 0, stopAt = DEFAULTS.stopAt, targetR = DEFAULTS.targetR,
  impulse = DEFAULTS.impulse,
} = {}) {
  if (!Array.isArray(bars) || bars.length < 3) throw new Error('strategy one needs at least three bars');
  const base = baseInterval(bars);
  const entryName = entryTimeframe ? String(entryTimeframe) : nameOf(base);
  const entryMs = parseInterval(entryName);
  if (entryMs !== base) {
    throw new Error(
      `the bars are ${nameOf(base)} apart and strategy one takes its entries on the ${entryName}; `
      + `give it ${entryName} bars, or say --entry ${nameOf(base)}`,
    );
  }
  for (const [label, name] of [['direction', directionTimeframe], ['bias', biasTimeframe]]) {
    const ms = parseInterval(name);
    if (ms < base) throw new Error(`the ${label} timeframe ${name} is smaller than the bars themselves (${nameOf(base)})`);
    if (ms % base !== 0) {
      throw new Error(`${name} is not a whole number of ${nameOf(base)} bars, so it cannot be built from them`);
    }
  }

  let impulseMultiple = impulse === undefined || impulse === null ? null : Number(impulse);
  if (impulseMultiple !== null && (!Number.isFinite(impulseMultiple) || impulseMultiple <= 0)) {
    throw new Error(`the impulse filter has to be a positive multiple of the usual range, got ${JSON.stringify(impulse)}`);
  }

  const mtf = multiTimeframe(bars, { timeframes: [entryName, directionTimeframe, biasTimeframe], left, right, anchorMs });
  const entryRead = mtf.reads[0];
  const directionRead = mtf.reads[1];
  const biasRead = mtf.reads[2];

  const setups = [];
  const filtered = [];
  for (let i = 1; i < bars.length; i++) {
    const setup = setupAt({
      entry: entryRead.stateAt[i],
      direction: directionRead.stateAt[i],
      bias: biasRead.stateAt[i],
      prevClose: bars[i - 1].close,
      close: bars[i].close,
      directions,
    });
    if (!setup) continue;
    if (impulseMultiple !== null) {
      const usual = medianRange(bars, i);
      const moved = bars[i].high - bars[i].low;
      if (usual === null || !(moved >= impulseMultiple * usual)) {
        filtered.push({
          index: i, time: bars[i].time, direction: setup.direction,
          reason: `the trigger bar was not a drastic move (${impulseMultiple}x the usual range)`,
        });
        continue;
      }
    }
    setups.push({ index: i, ...setup });
  }

  const styled = stopAt === 'swing' ? 'swing' : 'structure';
  let targetMultiple = targetR === undefined ? null : targetR;
  if (targetMultiple !== null) {
    const r = Number(targetMultiple);
    if (!Number.isFinite(r) || r <= 0) {
      throw new Error(`the target in R has to be a positive number, got ${JSON.stringify(targetR)}`);
    }
    targetMultiple = r;
  }
  const simulated = simulate({
    bars, setups, session, onePerSession, stopOn, slippageTicks, instrument, contracts, commission,
    stopAt: styled, targetR: targetMultiple,
  });

  return {
    ...simulated,
    skipped: [...simulated.skipped, ...filtered],
    filtered,
    setups,
    reads: { entry: entryRead.name, direction: directionRead.name, bias: biasRead.name },
    window: describeSession(session),
    config: {
      ...simulated.config,
      biasTimeframe: biasRead.name,
      directionTimeframe: directionRead.name,
      entryTimeframe: entryName,
      left: whole(left, DEFAULTS.left, 'swing left'),
      right: whole(right, DEFAULTS.right, 'swing right'),
      stopAt: styled,
      targetR: targetMultiple,
      impulse: impulseMultiple,
      directions: [...directions],
      bars: bars.length,
      firstTime: bars[0].time,
      lastTime: bars[bars.length - 1].time,
    },
  };
}

module.exports = { DEFAULTS, setupAt, simulate, runTrade, stats, findTrades, medianRange };
