// The candle feed (server/market-data.js + /api/candles) — 17 Sep 2026.
//
// Jacques: "Candles: Connect a market data feed." Before this, the desk held
// his setups and his own words and nothing else, and the assistant was told to
// say so rather than invent a level. The feed is what it reads now, so the
// things worth testing are not that a fetch happens — they are the joins:
//
//   1. Bars arrive whole. A bar with a missing price is dropped rather than
//      zero-filled, because a zero in a low is a level that does not exist.
//   2. The 4h bars are arithmetic on the 1h bars that really came back, not a
//      second guess at the market. Open first, close last, high highest, low
//      lowest, volume summed — checked against hand-written numbers.
//   3. A feed that cannot be reached, or does not know the symbol, produces a
//      SENTENCE and no bars. There is no branch anywhere that fills the gap.
//   4. The route is behind the door, and nothing about the feed is in the page.
//
// Nothing here touches the network: the transport is swapped for a stub, which
// is also what makes the failure paths testable at all. The live feed was
// verified by hand on 17 Sep 2026 (NQ=F at 5m/1h, BTC-USD at 15m) and that
// check is recorded in the module's header comment, not pretended here.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const md = require('../market-data');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const PAGE = fs.readFileSync(path.join(ROOT, 'desk.html'), 'utf8');

const HOUR = 60 * 60 * 1000;
const T0 = Date.parse('2026-09-17T00:00:00Z');

function hourlyBar(i, o, h, l, c, v) {
  return { t: T0 + i * HOUR, o, h, l, c, v };
}

// A Yahoo chart answer, in the shape the real endpoint returns.
function yahooAnswer(bars, meta) {
  return {
    chart: {
      result: [{
        meta: Object.assign({ symbol: 'NQ=F', shortName: 'Nasdaq 100', fullExchangeName: 'CME', currency: 'USD' }, meta || {}),
        timestamp: bars.map((b) => Math.floor(b.t / 1000)),
        indicators: {
          quote: [{
            open: bars.map((b) => b.o),
            high: bars.map((b) => b.h),
            low: bars.map((b) => b.l),
            close: bars.map((b) => b.c),
            volume: bars.map((b) => b.v),
          }],
        },
      }],
    },
  };
}

function stubFetch(answer, status) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    return {
      ok: (status || 200) === 200,
      status: status || 200,
      json: async () => answer,
    };
  };
  fn.calls = calls;
  return fn;
}

test.beforeEach(() => { md.clearCache(); md.setTransport(null); });
test.after(() => { md.clearCache(); md.setTransport(null); });

// ── reading what the feed sends ─────────────────────────────────────────────

test('a bar with a price missing is dropped, never zero-filled', () => {
  const bars = [hourlyBar(0, 1, 2, 0.5, 1.5, 10), hourlyBar(1, null, 5, 4, 4.5, 20), hourlyBar(2, 3, 4, 2, 3.5, 30)];
  const out = md.parseYahooChart(yahooAnswer(bars));
  assert.strictEqual(out.bars.length, 2, 'the bar with no open is gone');
  assert.deepEqual(out.bars.map((b) => b.c), [1.5, 3.5]);
  // A zero-filled gap would show as a low at 0 and read as a crash that never
  // happened. There is no path here that produces one.
  for (const b of out.bars) assert.ok(b.l > 0, 'no bar may carry a price the feed did not send');
  assert.strictEqual(out.name, 'Nasdaq 100', 'and what the feed calls it comes back with it');
  assert.strictEqual(out.exchange, 'CME');
});

test('an answer with nothing readable in it produces nothing, not an empty chart', () => {
  assert.strictEqual(md.parseYahooChart({ chart: { result: [] } }), null);
  assert.strictEqual(md.parseYahooChart({ chart: {} }), null);
  assert.strictEqual(md.parseYahooChart(null), null);
  assert.strictEqual(md.parseYahooChart(yahooAnswer([])), null, 'no bars is not a chart of no bars');
});

// ── the 4h bars ─────────────────────────────────────────────────────────────

test('the 4h bar is built from the 1h bars by arithmetic, and the numbers are exact', () => {
  const bars = [
    hourlyBar(0, 100, 110, 95, 105, 10),
    hourlyBar(1, 105, 120, 104, 118, 20),
    hourlyBar(2, 118, 119, 100, 101, 30),
    hourlyBar(3, 101, 103, 99, 102, 40),
    hourlyBar(4, 102, 130, 101, 129, 50),
  ];
  const four = md.aggregate(bars, 4 * HOUR);
  assert.strictEqual(four.length, 2, 'bar 4 falls in the next four hours, because the bucket starts at 00:00');
  assert.deepEqual(four[0], {
    t: T0,               // the bucket's own start, on the epoch, so no timezone can slide it
    o: 100,              // the first bar's open
    h: 120,              // the highest high of the four
    l: 95,               // the lowest low
    c: 102,              // the last bar's close
    v: 100,              // 10 + 20 + 30 + 40
  });
  assert.strictEqual(four[1].o, 102);
  assert.strictEqual(four[1].c, 129);
});

test('a gap in the 1h bars does not invent the hours that are missing', () => {
  // Two bars an hour apart with seven hours between them. The 4h view gets a
  // bar for each thing that happened and nothing for the silence.
  const bars = [hourlyBar(0, 10, 12, 9, 11, 1), hourlyBar(8, 20, 22, 19, 21, 2)];
  const four = md.aggregate(bars, 4 * HOUR);
  assert.strictEqual(four.length, 2);
  assert.deepEqual(four.map((b) => b.c), [11, 21]);
  assert.ok(!four.some((b) => b.o === b.c), 'no flat bar appears out of a gap');
});

// ── what he types ───────────────────────────────────────────────────────────

test('NQ means the Nasdaq future, and a made-up symbol is refused before it is sent', () => {
  assert.strictEqual(md.normalizeSymbol('nq'), 'NQ=F');
  assert.strictEqual(md.normalizeSymbol(' BTC '), 'BTC-USD');
  assert.strictEqual(md.normalizeSymbol('spy'), 'SPY', 'a plain ticker is left alone');
  assert.strictEqual(md.normalizeSymbol(''), null);
  assert.strictEqual(md.normalizeSymbol('NQ=F'), 'NQ=F');
  // Nothing that is not a ticker may reach the feed's URL, so no text from the
  // page can ever shape that request.
  for (const junk of ['../../etc/passwd', 'NQ?x=1', 'NQ&foo', 'nq;rm -rf', '<script>', 'x'.repeat(20), 'NQ/../ES']) {
    assert.strictEqual(md.normalizeSymbol(junk), null, `${junk} must not be sent to the feed`);
  }
  assert.strictEqual(md.normalizeSymbol('N Q'), 'NQ=F', 'a stray space he typed is not a reason to refuse him');
});

// ── the four timeframes ─────────────────────────────────────────────────────

test('only the four timeframes he reads can be asked for', async () => {
  assert.deepEqual(md.TIMEFRAMES, ['5m', '15m', '1h', '4h']);
  for (const tf of md.TIMEFRAMES) assert.ok(md.TF[tf], `${tf} must be configured`);
  const bad = await md.fetchCandles('NQ', '3m');
  assert.strictEqual(bad.ok, false);
  assert.match(bad.error, /5m, 15m, 1h, 4h/);
});

test('4h is not asked of the feed — it is built from 1h, and the request says so', async () => {
  const bars = [hourlyBar(0, 100, 110, 95, 105, 10), hourlyBar(1, 105, 120, 104, 118, 20)];
  const stub = stubFetch(yahooAnswer(bars));
  md.setTransport(stub);
  const r = await md.fetchCandles('NQ', '4h', { bars: 10 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(stub.calls.length, 1);
  assert.match(stub.calls[0], /interval=1h/, 'the feed was asked for 1h bars');
  assert.match(stub.calls[0], /NQ%3DF/, 'and the symbol is encoded into the path, so it cannot shape the request');
  assert.ok(!stub.calls[0].includes('interval=4h'), 'there is no 4h interval to ask for');
  assert.strictEqual(r.candles.length, 1, 'the two hours collapse into one four-hour bar');
  assert.match(r.built, /built from 1h bars/);
});

test('the newest bars are the ones kept, and the count is the one asked for', async () => {
  const bars = [];
  for (let i = 0; i < 40; i++) bars.push(hourlyBar(i, 100 + i, 105 + i, 95 + i, 100.5 + i, 10));
  md.setTransport(stubFetch(yahooAnswer(bars)));
  const r = await md.fetchCandles('NQ', '1h', { bars: 5 });
  assert.strictEqual(r.candles.length, 5);
  assert.deepEqual(r.candles.map((b) => b.o), [135, 136, 137, 138, 139], 'the last five, in order');
  assert.strictEqual(r.asOf, bars[bars.length - 1].t === undefined ? null : new Date(bars[39].t).toISOString(),
    'asOf is the last bar own time, so a stale bar cannot be read as a live price');
  assert.ok(r.candles.every((b, i, a) => i === 0 || b.t > a[i - 1].t), 'time runs forwards');
});

// ── what happens when it goes wrong ─────────────────────────────────────────

test('a feed that does not know the symbol says so, in its own words, with no bars', async () => {
  md.setTransport(async () => ({
    ok: false,
    status: 404,
    json: async () => ({ chart: { result: null, error: { code: 'Not Found', description: 'No data found, symbol may be delisted' } } }),
  }));
  const r = await md.fetchCandles('ZZZZ', '1h');
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /does not know ZZZZ/);
  assert.match(r.error, /No data found/, 'the reason is the feed\'s, not a guess of ours');
  assert.strictEqual(r.candles, undefined, 'and there is nothing that could be drawn');
});

test('a feed that cannot be reached says that, and never a made-up price', async () => {
  md.setTransport(async () => { throw new Error('ECONNREFUSED'); });
  const r = await md.fetchCandles('NQ', '5m');
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /NQ=F 5m: the feed could not be reached/);
  assert.strictEqual(r.candles, undefined);

  md.setTransport(async () => { const e = new Error('timed out'); e.name = 'TimeoutError'; throw e; });
  md.clearCache();
  const slow = await md.fetchCandles('NQ', '5m');
  assert.match(slow.error, /took too long to answer/);
});

test('an answer that is not readable is a failure, not an empty set of candles', async () => {
  md.setTransport(async () => ({ ok: true, status: 200, json: async () => { throw new Error('not json') } }));
  const broken = await md.fetchCandles('NQ', '1h');
  assert.strictEqual(broken.ok, false);
  assert.match(broken.error, /did not send readable data/);

  md.clearCache();
  md.setTransport(stubFetch({ chart: { result: [] } }));
  const empty = await md.fetchCandles('NQ', '1h');
  assert.strictEqual(empty.ok, false);
  assert.match(empty.error, /nothing usable/);
});

test('a keyed feed with no key set is refused rather than half-connected', async () => {
  const r = await md.fetchCandles('NQ', '1h', { provider: 'twelvedata', key: '' });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /No key for that feed is set on the server/);
  const unknown = await md.fetchCandles('NQ', '1h', { provider: 'nonsense' });
  assert.match(unknown.error, /No feed is set up under the name "nonsense"/);
});

// ── the cache ───────────────────────────────────────────────────────────────

test('the same candles are not asked for twice inside the minute', async () => {
  const bars = [hourlyBar(0, 1, 2, 0.5, 1.5, 10)];
  const stub = stubFetch(yahooAnswer(bars));
  md.setTransport(stub);
  const a = await md.fetchCandles('NQ', '5m', { bars: 10 });
  const b = await md.fetchCandles('NQ', '5m', { bars: 10 });
  assert.strictEqual(stub.calls.length, 1, 'the second answer came from the cache');
  assert.strictEqual(a.ok, true);
  assert.strictEqual(b.cached, true);
  assert.deepEqual(b.candles, a.candles);

  md.clearCache();
  await md.fetchCandles('NQ', '5m', { bars: 10 });
  assert.strictEqual(stub.calls.length, 2, 'and clearing it asks again');
});

// ── all four at once, the way the desk asks ─────────────────────────────────

test('the desk gets all four timeframes from one call, and a partial one says what is missing', async () => {
  const bars = [];
  for (let i = 0; i < 60; i++) bars.push(hourlyBar(i, 100 + i, 105 + i, 95 + i, 100.5 + i, 10));
  md.setTransport(stubFetch(yahooAnswer(bars)));
  const all = await md.fetchAll('NQ', { bars: 12 });
  assert.strictEqual(all.ok, true);
  assert.deepEqual(Object.keys(all.timeframes).sort(), ['15m', '1h', '4h', '5m']);
  assert.strictEqual(all.timeframes['5m'].candles.length, 12);
  assert.strictEqual(all.symbol, 'NQ=F', 'NQ is reported back as the contract it actually read');
  assert.strictEqual(all.name, 'Nasdaq 100');

  // One timeframe failing must not take the other three with it — and must not
  // quietly look like a chart either.
  md.clearCache();
  let n = 0;
  md.setTransport(async (url) => {
    n += 1;
    if (url.includes('interval=15m')) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => yahooAnswer(bars) };
  });
  const partial = await md.fetchAll('NQ', { bars: 12 });
  assert.strictEqual(partial.ok, true);
  assert.strictEqual(partial.timeframes['15m'], undefined);
  assert.ok(partial.partial && partial.partial.length === 1, 'and the missing one is named');
  assert.deepEqual(Object.keys(partial.timeframes).sort(), ['1h', '4h', '5m']);
});

// ── the route ───────────────────────────────────────────────────────────────

test('the candles route is behind the door, like every other signed-in route', () => {
  const at = SRC.indexOf("app.get('/api/candles'");
  assert.ok(at > -1, 'the route must exist');
  const block = SRC.slice(at, SRC.indexOf("app.post('/api/chat'", at));
  assert.match(block, /requireAuth/, 'signed out gets nothing');
  assert.match(block, /candleLimiter/, 'and one page cannot spin it');
  assert.match(block, /marketData\.fetchAll/, 'it reads the feed module');
  assert.match(block, /status\(set\.ok \? 200 : 502\)/, 'a feed that failed is a failure status, not a 200 with no bars');
  assert.match(block, /error: 'The feed could not be reached\.'/, 'and even the catch has words, not a number');
  assert.ok(at < SRC.indexOf('app.use((err, req, res, next)'), 'registered before the error handler');
});

test('the key never lives in the page, and the page never calls the feed', () => {
  // The whole reason the feed is fetched by the server. A key on the page is a
  // key anybody can read, and a page that calls a data vendor directly tells
  // that vendor who is reading and from where.
  const MODULE = fs.readFileSync(path.join(__dirname, '..', 'market-data.js'), 'utf8');
  assert.match(MODULE, /TWELVE_DATA_API_KEY/, 'the key is read from the environment, on the server');
  assert.ok(SRC.indexOf("require('./market-data')") > -1, 'and the server is what carries it');
  for (const leak of ['TWELVE_DATA_API_KEY', 'MARKET_DATA_PROVIDER', 'apikey=', 'query1.finance']) {
    assert.ok(!PAGE.includes(leak), `${leak} must not be in the desk page`);
  }
  assert.match(PAGE, /fetch\('\/api\/candles/, 'the page asks this app');
});
