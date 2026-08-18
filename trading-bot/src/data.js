'use strict';

const fs = require('fs');
const path = require('path');

const { buildCandles, aggregate } = require('./candles');
const { saveJson, loadJson } = require('./util');
const { syntheticSeries } = require('./synthetic');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'cache');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cachePath(key) {
  return path.join(CACHE_DIR, key.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
}

function readCache(key, ttlMs) {
  const file = cachePath(key);
  const data = loadJson(file, null);
  if (!data || !data.candles || !data.cachedAt) return null;
  if (Date.now() - data.cachedAt > ttlMs) return null;
  return data.candles;
}

function writeCache(key, candles) {
  saveJson(cachePath(key), { cachedAt: Date.now(), candles });
}

async function fetchYahooChart(symbol, interval, range) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${interval}&range=${range}&includePrePost=false&events=div%2Csplit`;
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  };

  let res;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, { headers });
    lastStatus = res.status;
    if (res.status === 200) break;
    if (res.status === 429) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    break;
  }
  if (!res || !res.ok) {
    throw new Error(`Yahoo HTTP ${lastStatus} for ${symbol} (${interval}/${range}) — likely rate-limited; retry shortly or use --source synthetic`);
  }

  const data = await res.json();
  const r = data && data.chart && data.chart.result && data.chart.result[0];
  if (!r || !r.timestamp) throw new Error(`No chart data returned for ${symbol}`);

  const q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
  return {
    candles: buildCandles(r.timestamp, q.open, q.high, q.low, q.close, q.volume),
    meta: r.meta || {},
  };
}

async function cachedSeries(key, ttlMs, loader) {
  const cached = readCache(key, ttlMs);
  if (cached && cached.length) return cached;
  const { candles } = await loader();
  if (candles && candles.length) writeCache(key, candles);
  return candles;
}

// Fetch the full multi-timeframe series for one symbol.
async function fetchSeries(sym, cfg, source = 'yahoo') {
  if (source === 'synthetic') return syntheticSeries(sym, cfg);

  const s = cfg.symbols[sym];
  if (!s) throw new Error(`Unknown symbol ${sym}`);

  const daily = await cachedSeries(`${sym}-1d-2y`, 6 * HOUR, () => fetchYahooChart(s.yahoo, '1d', '2y'));
  const h1 = await cachedSeries(`${sym}-1h-6mo`, 30 * MIN, () => fetchYahooChart(s.yahoo, '1h', '6mo'));
  const m15 = await cachedSeries(`${sym}-15m-60d`, 10 * MIN, () => fetchYahooChart(s.yahoo, '15m', '60d'));
  const m5 = await cachedSeries(`${sym}-5m-30d`, 5 * MIN, () => fetchYahooChart(s.yahoo, '5m', '30d'));

  // 4H is not a native Yahoo interval — aggregate it from 1H candles.
  const h4 = aggregate(h1, 4 * HOUR);

  return { daily, h4, h1, m15, m5, meta: { source: 'yahoo', symbol: sym } };
}

module.exports = { fetchSeries, CACHE_DIR };
