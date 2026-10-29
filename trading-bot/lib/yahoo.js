'use strict';
/*
 * Turning a delayed quote feed into bars this folder can read.
 *
 * The free feed is Yahoo's chart endpoint: no key, about ten minutes behind for
 * futures. Two things about it matter more than the parsing:
 *
 *   1. THE LAST BAR IS STILL FORMING. A delayed feed is still mid-bar when you ask
 *      for it, so the final row is a partial bar dressed up as a finished one. A
 *      partial bar can close above a level and trigger a trade that never happened,
 *      so the last bar is dropped unless it has provably finished.
 *   2. THE ROWS CAN BE NULL. Futures quotes arrive with gaps (halts, thin hours) as
 *      null open/high/low/close rather than as missing rows. Those are dropped and
 *      counted, never filled with the previous close — inventing a price is how a
 *      backtest gets a trade the market never offered.
 *
 * Everything here is pure: the network lives in fetch-bars.js, so this can be
 * checked against a saved response with no connection at all.
 */

const INTERVAL_MS = {
  '1m': 60e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3,
  '60m': 3600e3, '1h': 3600e3, '4h': 4 * 3600e3, '1d': 86400e3,
};

/* What the user calls an instrument, and what the feed calls it. */
const TICKERS = { MGC: 'MGC=F', MNQ: 'MNQ=F', MES: 'MES=F' };

function tickerFor(instrument) {
  const key = String(instrument || '').trim().toUpperCase();
  if (TICKERS[key]) return TICKERS[key];
  if (key.endsWith('=F')) return key;
  return `${key}=F`;
}

function intervalMs(name) {
  const key = String(name || '').trim();
  const ms = INTERVAL_MS[key];
  if (!ms) throw new Error(`interval has to be one of ${Object.keys(INTERVAL_MS).join(', ')}; got ${JSON.stringify(name)}`);
  return ms;
}

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/*
 * A Yahoo chart response into bars.
 *
 *   opts.intervalMs  how long one bar lasts — decides whether the last one is done
 *   opts.now         the clock to judge the last bar against (epoch ms)
 *   opts.delayMs     how far behind the feed runs (default ten minutes)
 *
 * Returns { bars, droppedIncomplete, droppedNull }. Bars that are not whole are
 * refused rather than repaired, and the counts are handed back so a run can say
 * what it threw away instead of quietly reporting on a shorter file than it thinks.
 */
function barsFromChart(json, { intervalMs: step, now = Date.now(), delayMs = 600e3 } = {}) {
  const ms = intervalMs(step);
  if (!json || typeof json !== 'object') throw new Error('the feed returned nothing that could be read');
  const chart = json.chart;
  if (!chart || typeof chart !== 'object') throw new Error('the response has no chart in it');
  if (chart.error) {
    const message = chart.error.description || chart.error.code || 'unknown error';
    throw new Error(`the feed refused: ${message}`);
  }
  const result = Array.isArray(chart.result) ? chart.result[0] : null;
  if (!result) throw new Error('the feed returned no result for that symbol');

  const times = Array.isArray(result.timestamp) ? result.timestamp : null;
  const quote = result.indicators && Array.isArray(result.indicators.quote) ? result.indicators.quote[0] : null;
  if (!times || !quote) throw new Error('the response has no timestamps or no quote rows');
  for (const field of ['open', 'high', 'low', 'close']) {
    if (!Array.isArray(quote[field])) throw new Error(`the response has no ${field} column`);
    if (quote[field].length !== times.length) {
      throw new Error(`the ${field} column is ${quote[field].length} long and there are ${times.length} times; the rows do not line up`);
    }
  }

  const candles = [];
  let droppedNull = 0;
  let droppedIncomplete = 0;

  for (let i = 0; i < times.length; i++) {
    const time = Number(times[i]) * 1000;
    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const close = quote.close[i];
    const volume = finite(quote.volume && quote.volume[i]) ? quote.volume[i] : 0;

    if (!finite(time) || ![open, high, low, close].every(finite)) { droppedNull++; continue; }

    /* A bar is finished only when its whole interval is behind the feed's own lag. */
    if (time + ms > now - delayMs) { droppedIncomplete++; continue; }

    for (const [name, price] of [['open', open], ['high', high], ['low', low], ['close', close]]) {
      if (!(price > 0)) throw new Error(`bar ${new Date(time).toISOString()}: ${name} is ${price}; a price has to be above zero`);
    }
    if (high < Math.max(open, close)) throw new Error(`bar ${new Date(time).toISOString()}: high ${high} is below the open or close`);
    if (low > Math.min(open, close)) throw new Error(`bar ${new Date(time).toISOString()}: low ${low} is above the open or close`);

    if (candles.length && time <= candles[candles.length - 1].time) {
      throw new Error(`bars must move forward: ${new Date(time).toISOString()} does not come after the one before it`);
    }
    candles.push({ time, open, high, low, close, volume });
  }

  if (candles.length === 0) throw new Error('no complete bar in the response');
  return { bars: candles, droppedNull, droppedIncomplete };
}

/* The file this folder already reads, with where it came from written on it. */
function toCsv(bars, { instrument, source, interval, fetchedAt = Date.now() } = {}) {
  if (!Array.isArray(bars) || bars.length === 0) throw new Error('toCsv needs bars');
  const lines = [
    `# delayed bars for ${instrument || 'unknown'} from ${source || 'an unnamed feed'}`
      + ` — about ten minutes behind, not tick data`,
    `# interval ${interval || 'unknown'}, fetched ${new Date(fetchedAt).toISOString()}`,
    'time,open,high,low,close,volume',
  ];
  for (const b of bars) {
    lines.push([
      new Date(b.time).toISOString(), b.open, b.high, b.low, b.close, b.volume,
    ].join(','));
  }
  return lines.join('\n') + '\n';
}

module.exports = { barsFromChart, toCsv, intervalMs, tickerFor, TICKERS, INTERVAL_MS };
