'use strict';

const { findSwings, equalLevels } = require('./candles');

// ── Market structure ────────────────────────────────────────────────────────
// Walks the candles bar by bar and tracks the most recent *unbroken* swing
// high/low. A close beyond the last swing high in an uptrend is a Break of
// Structure (BOS, continuation); a close beyond the last swing low against the
// trend is a Change of Character (CHoCH, reversal). Pivots only become usable
// `lookback` bars after they print, so no future data leaks in.
function analyzeStructure(candles, lookback = 2) {
  const { highs, lows } = findSwings(candles, lookback);
  const events = [];
  if (highs.length < 1 || lows.length < 1) {
    return { trend: 'flat', events, swings: { highs, lows }, highs, lows };
  }

  // Seed the running trend from the first two pivots so the machine has a
  // starting direction before the first BOS/CHoCH fires.
  let trend = 'flat';
  if (highs[0].index < lows[0].index) {
    trend = highs.length > 1 ? (highs[1].price > highs[0].price ? 'up' : 'down') : 'flat';
  } else {
    trend = lows.length > 1 ? (lows[1].price > lows[0].price ? 'up' : 'down') : 'flat';
  }

  let lastHigh = null;
  let lastLow = null;
  let hi = 0;
  let li = 0;

  for (let i = 0; i < candles.length; i++) {
    while (hi < highs.length && highs[hi].index + lookback <= i) { lastHigh = highs[hi]; hi++; }
    while (li < lows.length && lows[li].index + lookback <= i) { lastLow = lows[li]; li++; }
    if (!lastHigh || !lastLow) continue;

    const c = candles[i];
    if (trend === 'up') {
      if (c.c > lastHigh.price) {
        events.push({ type: 'bos', dir: 'up', index: i, time: c.t, price: c.c, level: lastHigh.price });
        lastHigh = null; // consumed — wait for the next swing high
      } else if (c.c < lastLow.price) {
        events.push({ type: 'choch', dir: 'down', index: i, time: c.t, price: c.c, level: lastLow.price });
        trend = 'down';
        lastLow = null;
      }
    } else if (trend === 'down') {
      if (c.c < lastLow.price) {
        events.push({ type: 'bos', dir: 'down', index: i, time: c.t, price: c.c, level: lastLow.price });
        lastLow = null;
      } else if (c.c > lastHigh.price) {
        events.push({ type: 'choch', dir: 'up', index: i, time: c.t, price: c.c, level: lastHigh.price });
        trend = 'up';
        lastHigh = null;
      }
    } else {
      // Flat: the first break of either pivot sets the direction.
      if (c.c > lastHigh.price) {
        events.push({ type: 'bos', dir: 'up', index: i, time: c.t, price: c.c, level: lastHigh.price });
        trend = 'up';
        lastHigh = null;
      } else if (c.c < lastLow.price) {
        events.push({ type: 'bos', dir: 'down', index: i, time: c.t, price: c.c, level: lastLow.price });
        trend = 'down';
        lastLow = null;
      }
    }
  }

  return { trend, events, swings: { highs, lows }, highs, lows };
}

// ── Liquidity ───────────────────────────────────────────────────────────────
// Buy-side liquidity (BSL): swing highs + equal highs above price — stops of
// shorts sit there and get swept by an upthrust before a reversal down.
// Sell-side liquidity (SSL): swing lows + equal lows below price — stops of
// longs sit there and get swept by a dip before a reversal up.
function liquidityLevels(candles, cfg) {
  const { highs, lows } = findSwings(candles, cfg.swingLookback);
  const { eqh, eql } = equalLevels(candles, cfg.equalLevelTolerancePct, cfg.equalLevelWindow);
  const bsl = [...highs.map((h) => ({ ...h, kind: 'swing-high' })), ...eqh]
    .sort((a, b) => b.index - a.index);
  const ssl = [...lows.map((l) => ({ ...l, kind: 'swing-low' })), ...eql]
    .sort((a, b) => b.index - a.index);
  return { bsl, ssl };
}

// A "sweep" (manipulation) is a candle whose wick pierces a liquidity level
// and then *closes back through it* — a stop hunt that leaves the level behind.
//   dir 'up'   → candle spikes ABOVE a BSL level and closes back below (bearish)
//   dir 'down' → candle dips BELOW an SSL level and closes back above (bullish)
function sweepAt(candle, level, dir) {
  if (dir === 'up') return candle.h > level.price && candle.c < level.price;
  return candle.l < level.price && candle.c > level.price;
}

// ── Higher-timeframe bias ───────────────────────────────────────────────────
// Daily is the anchor. A bias is only "bull"/"bear" when the daily trend agrees
// with at least one of the 4H/1H trends; otherwise the market is neutral and
// the bot stands aside.
function computeBias(trends) {
  const d = trends.daily;
  const h4 = trends.h4;
  const h1 = trends.h1;
  const up = (t) => t === 'up';
  const down = (t) => t === 'down';
  if (up(d)) return up(h4) || up(h1) ? 'bull' : 'neutral';
  if (down(d)) return down(h4) || down(h1) ? 'bear' : 'neutral';
  if (up(h4) && up(h1)) return 'bull';
  if (down(h4) && down(h1)) return 'bear';
  return 'neutral';
}

module.exports = { analyzeStructure, liquidityLevels, sweepAt, computeBias };
