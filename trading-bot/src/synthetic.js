'use strict';

const { aggregate } = require('./candles');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Deterministic PRNG so synthetic runs are reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Generate `days` of 5-minute candles ending on the latest 5m-aligned bucket.
// A regime-switching random walk with occasional "manipulation" wicks that
// spike through the recent extreme and snap back — enough to exercise the
// structure engine offline without hitting a live data source.
function synthetic5m(sym, basePrice, days = 90) {
  const rand = mulberry32(hashStr(sym));
  const end = Math.floor(Date.now() / (5 * MIN)) * (5 * MIN);
  const count = Math.floor((days * DAY) / (5 * MIN));
  const start = end - (count - 1) * 5 * MIN;

  const candles = [];
  let price = basePrice;
  let regime = rand() < 0.5 ? 1 : -1;
  let regimeLeft = 800 + Math.floor(rand() * 2000);

  for (let i = 0; i < count; i++) {
    if (regimeLeft-- <= 0) {
      // Switch between up-trend, down-trend and range.
      const r = rand();
      regime = r < 0.42 ? 1 : r < 0.84 ? -1 : 0;
      regimeLeft = 800 + Math.floor(rand() * 2000);
    }
    const t = start + i * 5 * MIN;
    const drift = regime * (0.004 + rand() * 0.012) / 100; // % per bar
    const noise = (rand() - 0.5) * 0.08 / 100;

    let o = price;
    let c = o * (1 + drift + noise);

    // Occasional manipulation wick: thrust past a nearby extreme, close back.
    let h = Math.max(o, c) * (1 + rand() * 0.03 / 100);
    let l = Math.min(o, c) * (1 - rand() * 0.03 / 100);
    if (rand() < 0.004) {
      const dir = rand() < 0.5 ? 1 : -1;
      const extent = 0.25 + rand() * 0.5; // %
      if (dir > 0) h = c * (1 + extent / 100);
      else l = c * (1 - extent / 100);
    }

    candles.push({ t, o, h, l, c, v: 100 + Math.floor(rand() * 500) });
    price = c;
  }
  return candles;
}

// Full multi-timeframe series for a symbol, aggregated off the 5m base.
function syntheticSeries(sym, cfg) {
  const s = cfg.symbols[sym];
  const m5 = synthetic5m(sym, s.basePrice);
  const m15 = aggregate(m5, 15 * MIN);
  const h1 = aggregate(m5, HOUR);
  const h4 = aggregate(m5, 4 * HOUR);
  const daily = aggregate(m5, DAY);
  return { daily, h4, h1, m15, m5, meta: { source: 'synthetic', symbol: sym } };
}

module.exports = { syntheticSeries, synthetic5m };
