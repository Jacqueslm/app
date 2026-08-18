'use strict';

// Build a candle list from parallel arrays (Yahoo chart shape).
// `ts` is in epoch seconds; candles use epoch milliseconds internally.
function buildCandles(ts, o, h, l, c, v) {
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    if (o[i] == null || h[i] == null || l[i] == null || c[i] == null) continue;
    out.push({
      t: ts[i] * 1000,
      o: o[i],
      h: h[i],
      l: l[i],
      c: c[i],
      v: v && v[i] != null ? v[i] : 0,
    });
  }
  return out;
}

// Aggregate finer candles into coarser ones aligned to `intervalMs` buckets.
// Buckets start at the epoch-aligned floor of each candle's timestamp.
function aggregate(candles, intervalMs) {
  const out = [];
  let bucket = null;
  let bucketStart = null;
  for (const c of candles) {
    const start = Math.floor(c.t / intervalMs) * intervalMs;
    if (bucketStart !== null && start !== bucketStart) {
      out.push(bucket);
      bucket = null;
    }
    bucketStart = start;
    if (!bucket) bucket = { t: start, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v || 0 };
    else {
      bucket.h = Math.max(bucket.h, c.h);
      bucket.l = Math.min(bucket.l, c.l);
      bucket.c = c.c;
      bucket.v += c.v || 0;
    }
  }
  if (bucket) out.push(bucket);
  return out;
}

// Fractal swing highs/lows. A swing high at i is a bar whose high is strictly
// greater than the highs of `lookback` bars on either side (same for lows).
// Note: the pivot at index i is only *confirmed* lookback bars later — callers
// that need no-lookahead behavior must gate on `index + lookback`.
function findSwings(candles, lookback = 2) {
  const highs = [];
  const lows = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].h >= c.h) isHigh = false;
      if (candles[j].l <= c.l) isLow = false;
    }
    if (isHigh) highs.push({ index: i, time: c.t, price: c.h });
    if (isLow) lows.push({ index: i, time: c.t, price: c.l });
  }
  return { highs, lows };
}

// Equal highs / equal lows: liquidity pools where two or more bars within a
// window print (near-)identical highs or lows. Price is drawn back to these
// levels to take out resting stops.
function equalLevels(candles, tolPct, window) {
  const eqh = [];
  const eql = [];
  const seenH = new Set();
  const seenL = new Set();
  const tol = tolPct / 100;
  for (let i = 0; i < candles.length; i++) {
    for (let j = i + 1; j < Math.min(i + window, candles.length); j++) {
      const refH = candles[i].h;
      if (Math.abs(candles[j].h - refH) / refH <= tol) {
        const key = refH.toFixed(4);
        if (!seenH.has(key)) {
          seenH.add(key);
          eqh.push({ index: j, time: candles[j].t, price: refH, kind: 'eqh' });
        }
      }
      const refL = candles[i].l;
      if (Math.abs(candles[j].l - refL) / refL <= tol) {
        const key = refL.toFixed(4);
        if (!seenL.has(key)) {
          seenL.add(key);
          eql.push({ index: j, time: candles[j].t, price: refL, kind: 'eql' });
        }
      }
    }
  }
  return { eqh, eql };
}

module.exports = { buildCandles, aggregate, findSwings, equalLevels };
