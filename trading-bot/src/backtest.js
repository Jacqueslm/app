'use strict';

const { precompute, signalFromPrecomputed, MIN } = require('./engine');
const { openPosition, stepPosition } = require('./paper');
const { round } = require('./util');

// Replay history: signals are evaluated at each *closed* 15m bar, positions are
// managed on the finer 5m bars. No lookahead — every decision only sees candles
// that have already closed.
function backtest(series, sym, cfg, opts = {}) {
  const m5 = series.m5;
  const m15 = series.m15;
  const warmup = opts.warmup5m != null ? opts.warmup5m : cfg.backtest.warmup5m;
  const pre = precompute(series, cfg);

  // Map each 15m close time to its 15m index (5m and 15m share the epoch grid).
  const m15CloseIndex = new Map();
  for (let i = 0; i < m15.length; i++) m15CloseIndex.set(m15[i].t + 15 * MIN, i);

  const trades = [];
  const openedIds = new Set();
  let open = null;
  const start = Math.min(warmup, Math.max(0, m5.length - 1));

  for (let j = start; j < m5.length; j++) {
    const bar = m5[j];
    const closeTime = bar.t + 5 * MIN;

    // New signal at each completed 15m bar (only when flat).
    if (!open && m15CloseIndex.has(closeTime)) {
      const m15Idx = m15CloseIndex.get(closeTime);
      const signal = signalFromPrecomputed(pre, series, m15Idx, sym, cfg);
      if (signal && !openedIds.has(signal.id)) {
        openedIds.add(signal.id);
        open = openPosition(signal, cfg, sym, closeTime);
      }
    }

    if (open) {
      const closed = stepPosition(open, bar);
      if (closed) {
        trades.push(closed);
        open = null;
      }
    }
  }

  return summarize(sym, trades);
}

function summarize(sym, trades) {
  const wins = trades.filter((t) => t.r > 0.05);
  const losses = trades.filter((t) => t.r < -0.05);
  const be = trades.filter((t) => t.r >= -0.05 && t.r <= 0.05);
  const sumR = round(trades.reduce((a, t) => a + t.r, 0), 2);
  const sumPnl = round(trades.reduce((a, t) => a + t.pnl, 0), 2);

  let grossWin = 0;
  let grossLoss = 0;
  let peakR = 0;
  let maxDrawdownR = 0;
  let cumR = 0;
  for (const t of trades) {
    if (t.pnl > 0) grossWin += t.pnl;
    else grossLoss += -t.pnl;
    cumR += t.r;
    peakR = Math.max(peakR, cumR);
    maxDrawdownR = Math.max(maxDrawdownR, peakR - cumR);
  }

  const decided = wins.length + losses.length;
  return {
    symbol: sym,
    total: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: be.length,
    winRate: decided ? round((wins.length / decided) * 100, 1) : 0,
    sumR,
    avgR: trades.length ? round(sumR / trades.length, 2) : 0,
    sumPnl,
    profitFactor: grossLoss > 0 ? round(grossWin / grossLoss, 2) : grossWin > 0 ? Infinity : 0,
    maxDrawdownR: round(maxDrawdownR, 2),
    trades,
  };
}

module.exports = { backtest, summarize };
