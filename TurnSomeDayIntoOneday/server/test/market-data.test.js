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
  assert.strictEqual(md.normalizeSymbol('/MNQ'), 'MNQ=F', 'and a leading slash is how a terminal shows a future');
  assert.strictEqual(md.normalizeSymbol(' / mgc '), 'MGC=F');
});

test('the micros are asked for as their contracts, never as the bare code', () => {
  // 19 Sep 2026, his own screenshot: he typed MGC — Micro Gold — and the desk
  // answered "Vanguard Morningstar Mega Cap E" at 281.72, because the letters
  // MGC also belong to a US equity and the bare code went to the feed as typed.
  // MNQ, the same day, came back as "nothing usable". Both faults were one
  // missing row in the table below, so every code he trades is pinned here.
  const micros = {
    MNQ: 'MNQ=F', MES: 'MES=F', MYM: 'MYM=F', M2K: 'M2K=F', MGC: 'MGC=F',
    MCL: 'MCL=F', SIL: 'SIL=F', MHG: 'MHG=F', MNG: 'MNG=F', MBT: 'MBT=F',
    MET: 'MET=F', M6E: 'M6E=F', M6A: 'M6A=F', M6B: 'M6B=F',
  };
  for (const [code, symbol] of Object.entries(micros)) {
    assert.strictEqual(md.normalizeSymbol(code), symbol, `${code} must be asked for as the contract`);
    assert.strictEqual(md.normalizeSymbol('/' + code.toLowerCase()), symbol, `${code}, however he types it`);
  }

  // The macros: the full-size contracts the micros are a fraction of, and the
  // context a futures read is made against.
  for (const code of ['NQ', 'ES', 'YM', 'RTY', 'NKD', 'GC', 'SI', 'HG', 'CL', 'NG',
    '6E', '6A', '6B', '6C', 'ZB', 'ZN', 'ZT', 'ZF']) {
    assert.match(String(md.normalizeSymbol(code)), /=F$/, `${code} is asked for as a contract`);
  }
  // The macro context, read as what it is: the feed has these as indices, not
  // as contracts, and asking for the index is the point of them.
  const macro = {
    VIX: '^VIX', TNX: '^TNX', SPX: '^GSPC', NDX: '^NDX', COMP: '^IXIC', DJI: '^DJI', RUT: '^RUT',
  };
  for (const [code, symbol] of Object.entries(macro)) {
    assert.strictEqual(md.normalizeSymbol(code), symbol, code);
  }
  assert.strictEqual(md.normalizeSymbol('DXY'), 'DX-Y.NYB', 'the dollar, which the feed only has as an index too');
  assert.strictEqual(md.normalizeSymbol('M6C'), 'M6C', 'a micro the feed does not carry is left as typed, never guessed into a contract');
});

test('every code the desk prices is a code the feed asks for as that contract', () => {
  // Two lists, one on each side: the page holds what a point pays, the server
  // holds what to ask the feed for. They disagreed on MGC — the page had a
  // price, the server had nothing — and the page printed gold's size over a
  // Vanguard ETF. Held together here, so a code cannot be priced on one side
  // and unresolvable on the other.
  const block = PAGE.match(/var POINT_VALUE=\{([\s\S]*?)\};/);
  assert.ok(block, 'the point-value table is still on the desk page');
  const codes = [...block[1].matchAll(/(?:'([A-Z0-9]{2,4})'|([A-Z][A-Z0-9]{1,3}))\s*:/g)].map((m) => m[1] || m[2]);
  assert.ok(codes.length >= 20, `the table parsed and it is the whole table: found ${codes.length}`);
  for (const code of codes) {
    const asked = md.normalizeSymbol(code);
    assert.notStrictEqual(asked, code, `${code} has a size on the page but no contract on the server`);
    assert.match(String(asked), /=F$/, `${code} is priced as a contract, so it has to be asked for as one`);
  }
  // And the other way round: a contract the server knows is not left unpriced
  // by accident — the ones that are absent are absent on purpose (the yen, whose
  // contract is quoted to six decimals, and VIX, which is an index here).
  for (const code of Object.keys(md.SYMBOLS)) {
    if (/^[A-Z]/.test(code) && code.length <= 4) {
      const priced = new RegExp(`(?:^|[^A-Z0-9])'?${code}'?\s*:`).test(block[1]);
      if (priced) continue;
      // The yen is quoted to six decimals, so a per-point figure would read as
      // twelve and a half million dollars. Everything else here is an index or a
      // cash pair: there is no contract size to publish for it.
      assert.ok(['6J', 'VIX', 'TNX', 'SPX', 'NDX', 'COMP', 'DJI', 'RUT', 'BTC', 'ETH', 'SOL', 'DXY'].includes(code),
        `${code} resolves to something the desk prices, but has no published size on the page`);
    }
  }
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

test('a contract answered with another instrument is refused, and it says what came back', async () => {
  // The MGC answer, exactly as the live feed gave it on 19 Sep 2026: HTTP 200,
  // real bars, and meta.instrumentType an ETF. Refused rather than returned,
  // because a share price under a gold code is the one fault he cannot see.
  const etf = yahooAnswer([hourlyBar(0, 280, 282, 279, 281.72, 10)], {
    symbol: 'MGC', shortName: 'Vanguard Morningstar Mega Cap E',
    fullExchangeName: 'NYSEArca', currency: 'USD', instrumentType: 'ETF',
  });
  md.setTransport(stubFetch(etf));
  const r = await md.fetchCandles('MGC', '1h');
  assert.strictEqual(r.ok, false, 'the ETF is not handed over as gold');
  assert.strictEqual(r.candles, undefined, 'and there is nothing to draw');
  assert.match(r.error, /MGC=F: the feed answered with an ETF/);
  assert.match(r.error, /Vanguard Morningstar Mega Cap E/, 'named, so he can see what it actually is');
  assert.match(r.error, /not the contract/);

  // A plain ticker is never treated as a contract, whatever comes back for it:
  // he may type SPY or AAPL deliberately and get the instrument he asked for.
  const spy = await md.fetchCandles('SPY', '1h');
  assert.strictEqual(spy.ok, true, 'SPY is not a contract, so nothing here refuses it');
  assert.ok(!/not the contract/.test(spy.error || ''), 'and it is never accused of being the wrong instrument');
  assert.strictEqual(md.wrongInstrument('SPY', { type: 'ETF', name: 'SPDR S&P 500' }), null);
  assert.match(String(md.wrongInstrument('MGC=F', { type: 'ETF', name: 'Vanguard Morningstar Mega Cap E' })),
    /MGC=F: the feed answered with an ETF/);
});

test('a contract that comes back as a contract is returned, with its type and exchange', async () => {
  md.setTransport(stubFetch(yahooAnswer([hourlyBar(0, 4400, 4430, 4390, 4424.9, 10)], {
    symbol: 'MGC=F', shortName: 'Micro Gold Futures,Dec-2026',
    fullExchangeName: 'COMEX', currency: 'USD', instrumentType: 'FUTURE',
  })));
  const r = await md.fetchCandles('MGC', '1h', { bars: 5 });
  assert.strictEqual(r.ok, true, 'the contract itself is not refused');
  assert.strictEqual(r.symbol, 'MGC=F');
  assert.strictEqual(r.type, 'FUTURE', 'what the feed says it is travels with the bars');
  assert.strictEqual(r.exchange, 'COMEX');
  assert.strictEqual(r.candles.length, 1);
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
