'use strict';
/*
 * The measuring instrument.
 *
 * It takes candles and a strategy and reports what the strategy would have done
 * to an account, with every rule stated rather than assumed:
 *
 *   - A strategy says how exposed it wants to be, as a fraction of equity.
 *   - A decision made on bar i is filled at bar i+1's open. Never on the same
 *     bar it decided, never at a price it could not have got.
 *   - A strategy can only see bars up to the one it is deciding on. Reaching
 *     further throws (see historyView below).
 *   - Fees and slippage are charged on every fill; slippage moves the fill price
 *     against the trade.
 *   - Buy and hold is run through this same engine with the same costs, so the
 *     comparison is honest rather than flattering.
 *
 * Assumptions worth knowing: no borrow fee on shorts, no interest on idle cash,
 * no partial fills, no liquidity limit on size, and no margin call. All of those
 * make a backtest friendlier than a real account, which is why the report says so.
 */

const DEFAULTS = {
  cash: 10000,
  feeBps: 0,          // 0 only so the arithmetic can be checked by hand
  slippageBps: 0,
  allowShort: false,
  rebalancePct: 0.01, // ignore drift smaller than 1% of equity
  periodsPerYear: 8760, // 1h bars; set it to match the timeframe
};

function number(value, fallback, name) {
  if (value === undefined || value === null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number, got ${JSON.stringify(value)}`);
  return n;
}

/*
 * The bars a strategy is allowed to see: everything up to and including `last`.
 * A later bar throws. Mutating them throws too. Array methods are bound to the
 * view, so map/filter/reduce/slice read through it and stay inside the past.
 */
function historyView(bars, last) {
  const view = new Proxy(bars, {
    get(target, key) {
      if (key === 'length') return last + 1;
      if (typeof key === 'string' && /^\d+$/.test(key)) {
        const at = Number(key);
        if (at > last) {
          throw new Error(`lookahead: bar ${at} has not happened yet when deciding bar ${last}`);
        }
        return target[at];
      }
      const value = target[key];
      if (typeof value === 'function') return value.bind(view);
      return value;
    },
    set() { throw new Error('a strategy must not change the bars it is reading'); },
    deleteProperty() { throw new Error('a strategy must not change the bars it is reading'); },
  });
  return view;
}

/*
 * Move the account to `target` exposure at `price`. Returns null when the move is
 * below the rebalance threshold — the point of the threshold is that a fixed
 * fraction of equity drifts as price moves, and chasing every penny of that would
 * trade every bar and pay a fee every bar.
 *
 * The fee is taken out of the money being invested, so asking for full exposure
 * never quietly borrows the fee.
 */
function fillTo(state, target, price, cfg) {
  const positionValue = state.units * price;
  const equityNow = state.cash + positionValue;
  const wantedFirst = target * equityNow;
  const feeEstimate = Math.abs(wantedFirst - positionValue) * cfg.feeRate;
  const wanted = target * Math.max(0, equityNow - feeEstimate);
  const deltaValue = wanted - positionValue;

  if (Math.abs(deltaValue) <= Math.abs(equityNow) * cfg.rebalance) return null;

  const side = deltaValue > 0 ? 'buy' : 'sell';
  const execPrice = price * (1 + (side === 'buy' ? cfg.slipRate : -cfg.slipRate));
  const units = deltaValue / execPrice;
  const fee = Math.abs(deltaValue) * cfg.feeRate;
  const slipCost = Math.abs(units) * Math.abs(execPrice - price);

  return {
    cash: state.cash - deltaValue - fee,
    units: state.units + units,
    fee,
    slipCost,
    fill: { time: null, side, units, price: execPrice, value: Math.abs(deltaValue), fee },
  };
}

/* The peak-to-trough fall of the equity curve, as a fraction of the peak. */
function maxDrawdown(equity) {
  let peak = equity[0];
  let worst = 0;
  for (const point of equity) {
    if (point > peak) peak = point;
    const fall = peak === 0 ? 0 : (peak - point) / peak;
    if (fall > worst) worst = fall;
  }
  return worst;
}

/*
 * Sharpe from the per-bar returns, annualised by periodsPerYear. It is reported
 * with its assumptions because a Sharpe computed off a short run is close to
 * meaningless: this returns null rather than a number when there is too little
 * history or no variation at all.
 */
function sharpeOf(equity, periodsPerYear) {
  const returns = [];
  for (let i = 1; i < equity.length; i++) {
    const previous = equity[i - 1];
    if (previous !== 0) returns.push(equity[i] / previous - 1);
  }
  if (returns.length < 3) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
  const sd = Math.sqrt(variance);
  if (!(sd > 0)) return null;
  return (mean / sd) * Math.sqrt(periodsPerYear);
}

function runOnce(candles, strategy, cfg, { wantFills }) {
  const n = candles.length;
  let cash = cfg.cash;
  let units = 0;
  let target = 0;
  let fees = 0;
  let slipCost = 0;
  let exposureBars = 0;
  let droppedSignals = 0;
  const equity = [];
  const fills = [];

  for (let i = 0; i < n; i++) {
    const bar = candles[i];

    /* 1. Fill, at this bar's open, whatever the previous bar asked for. */
    if (i > 0) {
      const done = fillTo({ cash, units }, target, bar.open, cfg);
      if (done) {
        cash = done.cash;
        units = done.units;
        fees += done.fee;
        slipCost += done.slipCost;
        if (wantFills) fills.push({ ...done.fill, time: bar.time });
      }
    }

    /* 2. Mark the account at this bar's close. */
    if (units !== 0) exposureBars++;
    equity.push({ time: bar.time, equity: cash + units * bar.close });

    /* 3. Ask the strategy, showing it this bar and no further. */
    const out = strategy.signal({
      history: historyView(candles, i),
      i,
      units,
      cash,
      equity: cash + units * bar.close,
    });

    if (out === undefined || out === null) continue;
    if (typeof out !== 'number' || !Number.isFinite(out)) {
      throw new Error(`bar ${i} (${new Date(bar.time).toISOString()}): the strategy returned ${JSON.stringify(out)}; it has to return a number between -1 and 1, or nothing to leave the position alone`);
    }
    if (out < -1 || out > 1) {
      throw new Error(`bar ${i} (${new Date(bar.time).toISOString()}): the strategy asked for ${out}; exposure runs from -1 (fully short) to 1 (fully invested)`);
    }
    if (out < 0 && !cfg.allowShort) {
      throw new Error(`bar ${i} (${new Date(bar.time).toISOString()}): the strategy asked to go short (${out}) but shorts are off; run with allowShort to permit them`);
    }
    target = out;
    if (i === n - 1) droppedSignals++;
  }

  const curve = equity.map((p) => p.equity);
  const first = curve[0];
  const last = curve[curve.length - 1];

  return {
    equity,
    fills,
    fees,
    slipCost,
    exposureBars,
    metrics: {
      bars: n,
      firstTime: candles[0].time,
      lastTime: candles[n - 1].time,
      initialCash: cfg.cash,
      finalEquity: last,
      totalReturnPct: first === 0 ? null : (last / first - 1) * 100,
      maxDrawdownPct: maxDrawdown(curve) * 100,
      fills: wantFills ? fills.length : 0,
      exposurePct: (exposureBars / n) * 100,
      droppedSignals,
      feesPaid: fees,
      slippageCost: slipCost,
      sharpe: sharpeOf(curve, cfg.periodsPerYear),
    },
  };
}

/**
 * Run a backtest.
 *
 * @param {object} opts
 * @param {Array} opts.candles   bars from lib/candles
 * @param {object} opts.strategy an object with a signal(ctx) function
 * @returns {{metrics: object, equity: Array, fills: Array, config: object}}
 */
function runBacktest({ candles, strategy, cash, feeBps, slippageBps, allowShort, rebalancePct, periodsPerYear, _skipBenchmark } = {}) {
  if (!Array.isArray(candles) || candles.length === 0) {
    throw new Error('a backtest needs at least one bar');
  }
  if (!strategy || typeof strategy.signal !== 'function') {
    throw new Error('a backtest needs a strategy with a signal(ctx) function');
  }

  const cfg = {
    cash: number(cash, DEFAULTS.cash, 'cash'),
    feeRate: number(feeBps, DEFAULTS.feeBps, 'feeBps') / 10000,
    slipRate: number(slippageBps, DEFAULTS.slippageBps, 'slippageBps') / 10000,
    allowShort: allowShort === undefined ? DEFAULTS.allowShort : !!allowShort,
    rebalance: number(rebalancePct, DEFAULTS.rebalancePct, 'rebalancePct'),
    periodsPerYear: number(periodsPerYear, DEFAULTS.periodsPerYear, 'periodsPerYear'),
  };
  if (!(cfg.cash > 0)) throw new Error('cash has to be above zero');

  const own = runOnce(candles, strategy, cfg, { wantFills: true });

  let buyHoldPct;
  if (_skipBenchmark) {
    buyHoldPct = null;
  } else {
    const benchmark = runOnce(candles, { signal: () => 1 }, cfg, { wantFills: false });
    const first = benchmark.equity[0].equity;
    const last = benchmark.equity[benchmark.equity.length - 1].equity;
    buyHoldPct = first === 0 ? null : (last / first - 1) * 100;
    own.metrics.buyHoldFinalEquity = last;
  }
  own.metrics.buyHoldReturnPct = buyHoldPct;

  return { metrics: own.metrics, equity: own.equity, fills: own.fills, config: cfg };
}

module.exports = { runBacktest, historyView, maxDrawdown, DEFAULTS };
