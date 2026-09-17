// The candle feed for the Trading Desk — 17 Sep 2026.
//
// Jacques, after the desk was built: "Candles: Connect a market data feed."
// The desk page held his setups and his own words and nothing else, and the
// assistant was told to say so rather than invent a level. This is the part
// that gives it real bars to read.
//
// WHY THIS LIVES ON THE SERVER AND NOT ON THE PAGE
// A feed needs a key, a key on a page is a key anybody can read, and the page
// is loaded on a phone over a mobile network. So the page asks this server, and
// this server asks the feed. Nothing about the source is in the HTML, which is
// also why the desk page still contains no third-party address at all.
//
// THE PROVIDER
// 'yahoo' (the default) is the public chart endpoint behind Yahoo Finance's own
// pages. It is plain HTTP, it takes no key, and it answers for index futures
// (NQ=F, ES=F), commodities (CL=F, GC=F), crypto (BTC-USD) and US equities —
// verified on 17 Sep 2026 by fetching NQ=F at 5m and 1h and BTC-USD at 15m from
// this machine and reading real bars back.
//
// It is UNOFFICIAL. Nobody supports it, the shape can change without notice,
// and it carries no licence to redistribute — which is exactly why it is only
// ever read by this one private page for one person, and never shown to anybody
// else or stored anywhere. If it ever changes shape, this file returns a plain
// sentence instead of a number and the desk says it has no candles. It must
// never fall back to something it made up.
//
// A keyed provider is one env var away when he wants one: set
// TWELVE_DATA_API_KEY and MARKET_DATA_PROVIDER=twelvedata. Twelve Data's free
// plan is 8 requests a minute / 800 a day and its terms allow internal testing
// only — it may not be displayed — so its paid plan is the one that would cover
// this page. Nothing here assumes it: the provider is chosen per request and an
// unknown one is refused rather than guessed at.
//
// WHAT IS NOT HERE
// No indicator, no signal, no opinion. This file returns bars and says what it
// could not get. Everything that reads them (the desk's assistant, the
// multi-timeframe view, the backtest) is above it.

const TIMEFRAMES = ['5m', '15m', '1h', '4h'];

// Per timeframe: how to ask for it, how many bars that is worth, and how long a
// fetched answer may be reused.
//
//   4h is not an interval this feed offers, so it is BUILT from 1h bars by
//   aggregation below. That is arithmetic on bars that really arrived — not a
//   number invented in their place — and it is the same four-hour bucket a chart
//   marks, taken from the epoch so it cannot drift by timezone.
const TF = {
  '5m':  { interval: '5m',  range: '5d',  bucketMs: 5 * 60 * 1000,        ttl: 60 * 1000 },
  '15m': { interval: '15m', range: '1mo', bucketMs: 15 * 60 * 1000,       ttl: 60 * 1000 },
  '1h':  { interval: '1h',  range: '3mo', bucketMs: 60 * 60 * 1000,       ttl: 2 * 60 * 1000 },
  '4h':  { buildFrom: '1h', bucketMs: 4 * 60 * 60 * 1000,                 ttl: 5 * 60 * 1000 },
};

// What he actually types, and what the feed calls it. NQ is the Nasdaq future
// because that is what he trades it as; the plain ticker is left alone so SPY is
// the ETF and not something else entirely.
const SYMBOLS = {
  NQ: 'NQ=F', ES: 'ES=F', YM: 'YM=F', RTY: 'RTY=F', NKD: 'NKD=F',
  CL: 'CL=F', GC: 'GC=F', SI: 'SI=F', NG: 'NG=F',
  BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD',
  EURUSD: 'EURUSD=X', GBPUSD: 'GBPUSD=X', USDJPY: 'JPY=X', DXY: 'DX-Y.NYB',
};

const PROVIDERS = { yahoo: true, twelvedata: true };

// A symbol reaches the feed's URL. Anything that is not plainly a ticker is
// refused here rather than sent, so no text from the page can shape that URL.
const SYMBOL_OK = /^[A-Z0-9^.=\-/]{1,15}$/;

function normalizeSymbol(input) {
  const raw = String(input == null ? '' : input).trim().toUpperCase().replace(/\s+/g, '');
  if (!raw) return null;
  const mapped = SYMBOLS[raw] || raw;
  if (!SYMBOL_OK.test(mapped)) return null;
  if (mapped.includes('..') || mapped.includes('//')) return null;
  return mapped;
}

// Yahoo's chart answer -> bars, or null when the answer is not one we can read.
// A bar with a missing open or close is dropped: it is a halt or a gap, and a
// bar with no price in it is worse than one bar fewer.
function parseYahooChart(json) {
  const result = json && json.chart && Array.isArray(json.chart.result) ? json.chart.result[0] : null;
  if (!result) return null;
  const stamps = result.timestamp;
  const quote = result.indicators && result.indicators.quote && result.indicators.quote[0];
  if (!Array.isArray(stamps) || !quote) return null;
  const meta = result.meta || {};
  const bars = [];
  for (let i = 0; i < stamps.length; i++) {
    const o = quote.open && quote.open[i];
    const h = quote.high && quote.high[i];
    const l = quote.low && quote.low[i];
    const c = quote.close && quote.close[i];
    if (![o, h, l, c].every((n) => typeof n === 'number' && isFinite(n))) continue;
    const v = quote.volume && typeof quote.volume[i] === 'number' ? quote.volume[i] : null;
    bars.push({ t: stamps[i] * 1000, o, h, l, c, v });
  }
  if (!bars.length) return null;
  bars.sort((a, b) => a.t - b.t);
  return {
    bars,
    name: meta.shortName || meta.symbol || '',
    exchange: meta.fullExchangeName || meta.exchangeName || '',
    currency: meta.currency || '',
  };
}

// Many bars in, one bar per bucket out. Open is the first open in the bucket,
// close the last, high the highest, low the lowest, volume the sum — the same
// bar a chart would draw for that four hours. Bars are grouped on the epoch, so
// the buckets are the same in every timezone and cannot slide with one.
function aggregate(bars, bucketMs) {
  const out = [];
  let cur = null;
  for (const b of bars) {
    const start = Math.floor(b.t / bucketMs) * bucketMs;
    if (!cur || cur.t !== start) {
      if (cur) out.push(cur);
      cur = { t: start, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v == null ? 0 : b.v };
      continue;
    }
    cur.h = Math.max(cur.h, b.h);
    cur.l = Math.min(cur.l, b.l);
    cur.c = b.c;
    if (b.v != null) cur.v += b.v;
  }
  if (cur) out.push(cur);
  return out;
}

/* ---------------------------------------------------------------- transport --
   The one place that touches the network, swappable so the tests can drive the
   parsing, the aggregation and the failure paths without a live feed. */
async function defaultTransport(url, opts) {
  return fetch(url, opts);
}
let httpGet = defaultTransport;
function setTransport(fn) { httpGet = fn || defaultTransport; }

const cache = new Map();
function clearCache() { cache.clear(); }

// Upstream has to answer in reasonable time or the page waits on a spinner. A
// slow feed is a failure to report, not a reason to hang the desk.
const TIMEOUT_MS = 9000;

async function fetchYahoo(symbol, tf) {
  const spec = TF[tf];
  const want = spec.buildFrom || tf;
  const source = TF[want];
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/'
    + encodeURIComponent(symbol)
    + '?interval=' + encodeURIComponent(source.interval)
    + '&range=' + encodeURIComponent(source.range)
    + '&includePrePost=false';
  const res = await httpGet(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TSID desk)', Accept: 'application/json' },
    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout
      ? AbortSignal.timeout(TIMEOUT_MS) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (e) { json = null; }
  if (!res || !res.ok) {
    // A wrong symbol comes back as HTTP 404 with the reason in the body, not as
    // a 200 with an error in it — checked on 17 Sep 2026 by asking for a symbol
    // that does not exist. Read the body first, then fall back to the status.
    const why = json && json.chart && json.chart.error && json.chart.error.description;
    if (why) return { error: `The feed does not know ${symbol}: ${why}.` };
    return { error: `The feed answered ${res ? res.status : 'nothing'} for ${symbol}.` };
  }
  if (!json) return { error: 'The feed did not send readable data.' };
  const err = json && json.chart && json.chart.error;
  if (err) {
    // Its own words, not ours. A bad symbol is the common one and saying so is
    // more use than "something went wrong".
    return { error: `The feed does not know ${symbol}: ${err.description || err.code || 'no reason given'}.` };
  }
  const parsed = parseYahooChart(json);
  if (!parsed) return { error: `The feed sent nothing usable for ${symbol}.` };
  let bars = parsed.bars;
  if (spec.buildFrom) bars = aggregate(bars, spec.bucketMs);
  return {
    bars, source: 'yahoo', symbol, name: parsed.name,
    exchange: parsed.exchange, currency: parsed.currency,
    built: spec.buildFrom ? `built from ${spec.buildFrom} bars` : '',
  };
}

async function fetchTwelveData(symbol, tf, key) {
  const spec = TF[tf];
  const want = spec.buildFrom || tf;
  const interval = want === '1h' ? '1h' : want;         // Twelve Data uses 1h/5min/15min
  const sizeMap = { '5m': '5min', '15m': '15min', '1h': '1h' };
  const url = 'https://api.twelvedata.com/time_series?symbol=' + encodeURIComponent(symbol)
    + '&interval=' + encodeURIComponent(sizeMap[interval] || interval)
    + '&outputsize=2000&order=ASC&apikey=' + encodeURIComponent(key);
  const res = await httpGet(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res || !res.ok) return { error: `The feed answered ${res ? res.status : 'nothing'}.` };
  let json = null;
  try { json = await res.json(); } catch (e) { return { error: 'The feed did not send readable data.' }; }
  if (json && json.status === 'error') return { error: `The feed said: ${json.message || 'refused'}.` };
  const values = json && json.values;
  if (!Array.isArray(values) || !values.length) return { error: `The feed sent nothing usable for ${symbol}.` };
  let bars = [];
  for (const v of values) {
    const t = Date.parse(String(v.datetime).replace(' ', 'T') + 'Z');
    const o = Number(v.open), h = Number(v.high), l = Number(v.low), c = Number(v.close);
    if (![t, o, h, l, c].every((n) => isFinite(n))) continue;
    bars.push({ t, o, h, l, c, v: isFinite(Number(v.volume)) ? Number(v.volume) : null });
  }
  if (!bars.length) return { error: `The feed sent nothing usable for ${symbol}.` };
  bars.sort((a, b) => a.t - b.t);
  if (spec.buildFrom) bars = aggregate(bars, spec.bucketMs);
  const meta = json.meta || {};
  return { bars, source: 'twelvedata', symbol, name: meta.symbol || symbol, exchange: meta.exchange || '',
    currency: meta.currency || '', built: spec.buildFrom ? `built from ${spec.buildFrom} bars` : '' };
}

/* ------------------------------------------------------------------ public --
   fetchCandles() is the whole contract:

     { ok: true,  symbol, tf, source, asOf, candles: [...] }
     { ok: false, error: 'a sentence a person can read' }

   `ok: false` is a real answer and the page shows it as one. There is no branch
   here that returns zero-filled or sample bars, because a chart of nothing shown
   as if it were something is the one failure worse than no chart.

   `asOf` is the last bar's own open time, not the time of this call — the desk
   shows it so an old bar can never be read as a live price. */
async function fetchCandles(input, tf, opts) {
  const o = opts || {};
  const timeframe = String(tf == null ? '' : tf);
  if (TIMEFRAMES.indexOf(timeframe) < 0) {
    return { ok: false, error: `I only read ${TIMEFRAMES.join(', ')}.` };
  }
  const symbol = normalizeSymbol(input);
  if (!symbol) return { ok: false, error: 'That is not a symbol I can ask the feed for.' };

  const provider = String(o.provider || process.env.MARKET_DATA_PROVIDER || 'yahoo').toLowerCase();
  if (!PROVIDERS[provider]) {
    return { ok: false, error: `No feed is set up under the name "${provider}".` };
  }
  const key = (o.key || process.env.TWELVE_DATA_API_KEY || '').trim();
  if (provider === 'twelvedata' && !key) {
    return { ok: false, error: 'No key for that feed is set on the server.' };
  }

  const want = Number(o.bars) > 0 ? Math.min(Number(o.bars), 1000) : 200;
  const cacheKey = `${provider}|${symbol}|${timeframe}|${want}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && now - hit.at < TF[timeframe].ttl) return Object.assign({}, hit.value, { cached: true });

  let got;
  try {
    got = provider === 'twelvedata'
      ? await fetchTwelveData(symbol, timeframe, key)
      : await fetchYahoo(symbol, timeframe);
  } catch (e) {
    // Offline, DNS, TLS, timeout. Say which it was in one plain sentence.
    const why = e && e.name === 'TimeoutError' ? 'the feed took too long to answer'
      : 'the feed could not be reached';
    return { ok: false, error: `${symbol} ${timeframe}: ${why}.` };
  }
  if (got.error) return { ok: false, error: got.error };

  const candles = got.bars.slice(-want);
  const value = {
    ok: true, symbol, tf: timeframe, source: got.source, name: got.name || '',
    exchange: got.exchange || '', currency: got.currency || '', built: got.built || '',
    asOf: candles.length ? new Date(candles[candles.length - 1].t).toISOString() : null,
    bars: candles.length, candles,
  };
  cache.set(cacheKey, { at: now, value });
  return value;
}

// All four at once, for the desk: what the page asks for in one call, so it is
// one round trip and one gate check rather than four.
async function fetchAll(input, opts) {
  const o = opts || {};
  const out = {};
  const errors = [];
  for (const tf of TIMEFRAMES) {
    const r = await fetchCandles(input, tf, o);
    if (r.ok) out[tf] = r; else errors.push(r.error);
  }
  const any = Object.keys(out).length > 0;
  return {
    ok: any,
    symbol: any ? out[Object.keys(out)[0]].symbol : normalizeSymbol(input),
    name: any ? out[Object.keys(out)[0]].name : '',
    timeframes: out,
    error: any ? null : (errors[0] || 'The feed sent nothing.'),
    partial: any && errors.length ? errors : null,
  };
}

module.exports = {
  TIMEFRAMES, TF, SYMBOLS, PROVIDERS, TIMEOUT_MS,
  normalizeSymbol, parseYahooChart, aggregate, fetchCandles, fetchAll,
  setTransport, clearCache,
};
