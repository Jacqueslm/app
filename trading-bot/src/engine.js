'use strict';

const { analyzeStructure, liquidityLevels, computeBias } = require('./structure');
const { scanSignal, buildPlan, sweeps } = require('./signal');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Only candles that have *closed* by `time` (open + interval <= time) so the
// in-progress bar can never leak into a decision.
function closedUpTo(candles, intervalMs, time) {
  const out = [];
  for (const c of candles) {
    if (c.t + intervalMs <= time) out.push(c);
    else break;
  }
  return out;
}

function analyzeTf(candles, cfg) {
  return {
    candles,
    structure: analyzeStructure(candles, cfg.swingLookback),
    levels: liquidityLevels(candles, cfg),
  };
}

// Assemble the decision context at the close of 15m bar `m15Idx`.
function buildCtx(series, m15Idx, sym, cfg) {
  const m15 = series.m15.slice(0, m15Idx + 1);
  const last = m15[m15.length - 1];
  const now = last.t + 15 * MIN;

  const m5 = closedUpTo(series.m5, 5 * MIN, now);
  const h1 = closedUpTo(series.h1, HOUR, now);
  const h4 = closedUpTo(series.h4, 4 * HOUR, now);
  const daily = closedUpTo(series.daily, DAY, now);

  const dailyT = analyzeStructure(daily, cfg.swingLookback);
  const h4T = analyzeStructure(h4, cfg.swingLookback);
  const h1T = analyzeStructure(h1, cfg.swingLookback);
  const bias = computeBias({ daily: dailyT.trend, h4: h4T.trend, h1: h1T.trend });

  return {
    symbol: sym,
    now,
    bias,
    trends: { daily: dailyT.trend, h4: h4T.trend, h1: h1T.trend },
    tf15: analyzeTf(m15, cfg),
    tf5: analyzeTf(m5, cfg),
  };
}

function evalSignal(series, m15Idx, sym, cfg) {
  const ctx = buildCtx(series, m15Idx, sym, cfg);
  const signal = scanSignal(ctx, cfg);
  return { ctx, signal };
}

// ── Backtest fast path ──────────────────────────────────────────────────────
// Structure events are causal (a pivot is only used `lookback` bars after it
// prints), so 15m/5m structure and sweeps can be computed ONCE over the full
// series and filtered per decision bar — identical to re-analyzing each prefix,
// but O(n) instead of O(n²).

function precompute(series, cfg) {
  const m15 = analyzeTf(series.m15, cfg);
  const m5 = analyzeTf(series.m5, cfg);
  return {
    m15,
    m5,
    sweeps15: {
      down: sweeps(series.m15, m15.levels, 'down'),
      up: sweeps(series.m15, m15.levels, 'up'),
    },
  };
}

function signalFromPrecomputed(pre, series, m15Idx, sym, cfg) {
  const m15c = pre.m15.candles;
  if (m15Idx >= m15c.length) return null;
  const now = m15c[m15Idx].t + 15 * MIN;

  const daily = closedUpTo(series.daily, DAY, now);
  const h4 = closedUpTo(series.h4, 4 * HOUR, now);
  const h1 = closedUpTo(series.h1, HOUR, now);
  const bias = computeBias({
    daily: analyzeStructure(daily, cfg.swingLookback).trend,
    h4: analyzeStructure(h4, cfg.swingLookback).trend,
    h1: analyzeStructure(h1, cfg.swingLookback).trend,
  });

  const dir = bias === 'bull' ? 'long' : bias === 'bear' ? 'short' : null;
  if (!dir) return null;

  const sweepDir = dir === 'long' ? 'down' : 'up';
  const bosDir = dir === 'long' ? 'up' : 'down';

  const sweepList = pre.sweeps15[sweepDir].filter(
    (s) => s.index <= m15Idx && m15Idx - s.index <= cfg.sweepLookbackBars
  );
  if (!sweepList.length) return null;
  const sweep = sweepList[sweepList.length - 1];

  const m15Events = pre.m15.structure.events.filter((e) => e.index <= m15Idx);
  const scalpBos = m15Events.find((e) => e.type === 'bos' && e.dir === bosDir && e.index > sweep.index);
  if (!scalpBos) return null;

  const m5Events = pre.m5.structure.events.filter((e) => e.time + 5 * MIN <= now);
  const entryBoses = m5Events.filter((e) => e.type === 'bos' && e.dir === bosDir && e.time >= sweep.time);
  if (!entryBoses.length) return null;
  const entryBos = entryBoses[entryBoses.length - 1];

  const invalid = m5Events.some((e) => e.type === 'choch' && e.dir !== bosDir && e.index > entryBos.index);
  if (invalid) return null;

  return buildPlan(sym, dir, bias, sweep, scalpBos, entryBos, cfg);
}

module.exports = { MIN, HOUR, DAY, closedUpTo, buildCtx, evalSignal, precompute, signalFromPrecomputed };
