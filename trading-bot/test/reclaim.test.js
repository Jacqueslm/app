'use strict';
/*
 * Strategy one, checked against cases small enough to work out on paper.
 *
 * The parts are tested apart because they fail apart: setupAt is the rule, simulate
 * is the fill and the exit, stats is the arithmetic on the trades. A wrong rule and
 * a wrong fill look the same in a report but are not the same mistake.
 *
 * The beliefs this file exists to defend:
 *   - the entry is filled at the NEXT bar's open, never at the close that signalled it;
 *   - the trigger is the entry timeframe's swing, and the LEVELS are the direction
 *     timeframe's — the target is a 1-hour high that already exists, not a new one;
 *   - an exit is a CLOSE through a level, never a wick;
 *   - on a touch stop, a bar holding both levels is scored as the stop.
 */

const test = require('node:test');
const assert = require('node:assert');
const { setupAt, simulate, stats, findTrades } = require('../lib/reclaim');

const STEP_1H = 3600e3;
const STEP_15M = 900e3;
/* Monday 2026-01-05, 08:00 Central. Bar i closes at 14:00Z + (i+1) hours, so hourly
   bars 0 to 6 close at 09:00 through 15:00 Central — the whole of one session — and
   bar 7 closes at 16:00 Central, outside it. */
const START = Date.parse('2026-01-05T14:00:00Z');

function bars(rows, startIso = START, step = STEP_1H) {
  return rows.map(([open, high, low, close], i) => ({
    time: startIso + i * step, open, high, low, close, volume: 100,
  }));
}

/* A quiet series where nothing is touched, so an exit only happens when a test
   asks for one. */
const quiet = (n = 10) => bars(Array.from({ length: n }, () => [100, 100.2, 99.8, 100]));

const LONG = { direction: 'long', level: 105, target: 110, stop: 95 };

/* The three reads a setup is built from: the 15m trigger, the 1h levels, the 4h bias. */
const entryUp = { prevHigh: { price: 105 }, prevLow: { price: 98 } };
const directionUp = { trend: 'up', high: { price: 110 }, low: { price: 102 } };
const biasUp = { trend: 'up' };

/* ------------------------------------------------------------------ the rule */

test('a long is the 15m close getting back above the previous 15m high', () => {
  const setup = setupAt({ entry: entryUp, direction: directionUp, bias: biasUp, prevClose: 104, close: 106 });
  assert.deepEqual(setup, { direction: 'long', level: 105, target: 110, stop: 102, swingStop: 98 });
  assert.equal(setup.target, directionUp.high.price, 'the target is the 1h high');
  assert.equal(setup.stop, directionUp.low.price, 'the stop is the 1h higher low');
});

test('the target is the 1h high already made, never the 15m swing or a new high', () => {
  /* The 15m read has a much higher swing of its own. It is not the target: the
     target is the level the direction timeframe has already printed, because a new
     high is a hope and the existing one is where the sellers were. */
  const entryWithBigSwing = { high: { price: 130 }, prevHigh: { price: 105 }, prevLow: { price: 98 } };
  const setup = setupAt({ entry: entryWithBigSwing, direction: directionUp, bias: biasUp, prevClose: 104, close: 106 });
  assert.equal(setup.target, 110, 'the 1h high, not the 130 the 15m chart shows above it');
});

test('a close that was already above the level is not "getting back above it"', () => {
  const args = { entry: entryUp, direction: directionUp, bias: biasUp };
  assert.equal(setupAt({ ...args, prevClose: 106, close: 107 }), null);
  assert.equal(setupAt({ ...args, prevClose: 104, close: 104.9 }), null, 'not above the level yet');
  assert.equal(setupAt({ ...args, prevClose: 104, close: 105 }), null, 'equal to the level is not through it');
});

test('with no room up to the 1h high there is no trade', () => {
  const args = { entry: entryUp, direction: directionUp, bias: biasUp };
  assert.equal(setupAt({ ...args, prevClose: 104, close: 110 }), null, 'the 1h high is where the price already is');
  assert.equal(setupAt({ ...args, prevClose: 109, close: 111 }), null, 'and through it is worse');
});

test('with no room under the entry to risk, there is no trade', () => {
  /* The 1h higher low is above the reclaimed 15m high: the stop would sit above the
     entry, so there is nothing to trade. */
  const shallow = { trend: 'up', high: { price: 112 }, low: { price: 106.5 } };
  assert.equal(setupAt({ entry: entryUp, direction: shallow, bias: biasUp, prevClose: 104, close: 106 }), null);
});

test('all three timeframes have to agree, and a disagreement is not a setup', () => {
  const args = { entry: entryUp, direction: directionUp, prevClose: 104, close: 106 };
  assert.equal(setupAt({ ...args, bias: { trend: 'down' } }), null);
  assert.equal(setupAt({ ...args, bias: { trend: 'range' } }), null);
  assert.equal(setupAt({ ...args, bias: { trend: 'forming' } }), null);
  assert.equal(setupAt({ ...args, bias: biasUp, direction: { ...directionUp, trend: 'range' } }), null);
  assert.equal(setupAt({ ...args, bias: biasUp, direction: { ...directionUp, trend: 'down' } }), null);
  assert.equal(setupAt({ ...args, entry: null, bias: biasUp }), null);
});

test('the short is the mirror, to the level and to the low', () => {
  const entryDown = { prevHigh: { price: 102 }, prevLow: { price: 95 } };
  const directionDown = { trend: 'down', high: { price: 98 }, low: { price: 90 } };
  assert.deepEqual(
    setupAt({ entry: entryDown, direction: directionDown, bias: { trend: 'down' }, prevClose: 96, close: 94 }),
    { direction: 'short', level: 95, target: 90, stop: 98, swingStop: 102 },
  );
});

test('a direction that was not asked for is not returned', () => {
  const args = { entry: entryUp, direction: directionUp, bias: biasUp, prevClose: 104, close: 106 };
  assert.equal(setupAt({ ...args, directions: ['short'] }), null);
  assert.ok(setupAt({ ...args, directions: ['long'] }));
});

/* ------------------------------------------------------- the fill and the exit */

test('the signal is a close, so the fill is the next bar open', () => {
  const candles = bars([[100, 100.5, 99.5, 100], [100, 101, 99, 100], [101, 102, 100, 101], [102, 103, 101, 102], [102, 104, 101, 103]]);
  const result = simulate({ bars: candles, setups: [{ index: 2, ...LONG }] });
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].entry.index, 3);
  assert.equal(result.trades[0].entry.price, 102, "that bar's open, not the 101 close that signalled it");
});

test('the target is worth what the levels say, in points and in R', () => {
  const candles = bars([
    [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100],
    [101, 104, 99, 103],   // filled at 101, nothing closed through
    [103, 111, 102, 110],  // closes at the 110 target
  ]);
  const trade = simulate({ bars: candles, setups: [{ index: 2, ...LONG }] }).trades[0];
  assert.equal(trade.exit.reason, 'target');
  assert.equal(trade.exit.price, 110);
  assert.equal(trade.points, 9, '110 out at 101 in');
  assert.ok(Math.abs(trade.r - 1.5) < 1e-9, 'risking 6 to make 9 is 1.5R');
});

test('a wick through the target is not the exit; the close after it is', () => {
  const candles = bars([
    [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100],
    [101, 104, 99, 103],
    [103, 111, 102, 108],  // traded through 110 and closed back under it: a wick
    [108, 109, 107, 112],  // this one closed through it
  ]);
  const trade = simulate({ bars: candles, setups: [{ index: 2, ...LONG }] }).trades[0];
  assert.equal(trade.exit.reason, 'target');
  assert.equal(trade.exit.index, 5, 'the wick at bar 4 was not an exit');
  assert.equal(trade.exit.price, 112, 'the close that went through the level');
});

test('a wick under the stop is not the exit either', () => {
  const candles = bars([
    [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100],
    [101, 102, 100, 101],
    [101, 101, 94, 96],  // through the 95 stop and closed back above it
  ]);
  const trade = simulate({ bars: candles, setups: [{ index: 2, ...LONG }] }).trades[0];
  assert.notEqual(trade.exit.reason, 'stop');
  assert.equal(trade.exit.reason, 'session');
  assert.equal(trade.points, -5, 'out at the 96 close, not at a 95 the bar never closed at');
});

test('a close through the stop is the stop, at that close', () => {
  const candles = bars([
    [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100],
    [101, 102, 100, 101],
    [101, 101, 94, 93],  // closed through the 95 stop
  ]);
  const trade = simulate({ bars: candles, setups: [{ index: 2, ...LONG }] }).trades[0];
  assert.equal(trade.exit.reason, 'stop');
  assert.equal(trade.exit.price, 93);
  assert.equal(trade.points, -8);
  assert.ok(trade.r < -1, 'a close past the level costs more than the level: the risk is where the stop was, not where the close is');
});

test('on touch, the stop fills where it sits and the wick is the exit', () => {
  const candles = bars([
    [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100],
    [101, 102, 100, 101],
    [101, 101, 94, 96],
  ]);
  const trade = simulate({ bars: candles, setups: [{ index: 2, ...LONG }], stopOn: 'touch' }).trades[0];
  assert.equal(trade.exit.reason, 'stop');
  assert.equal(trade.exit.price, 95, 'the level the order was sitting at');
  assert.ok(Math.abs(trade.r + 1) < 1e-9, 'on touch a stop is minus one R by definition');
});

test('one bar holding both levels: on closes it is the close, on touch it is the stop', () => {
  const candles = bars([
    [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100],
    [101, 102, 100, 101],
    [101, 111, 94, 112],  // 110 and 95 both inside one hour, closing through the target
  ]);
  const onClose = simulate({ bars: candles, setups: [{ index: 2, ...LONG }] }).trades[0];
  assert.equal(onClose.exit.reason, 'target', 'only one close can cross one level');

  const onTouch = simulate({ bars: candles, setups: [{ index: 2, ...LONG }], stopOn: 'touch' }).trades[0];
  assert.equal(onTouch.exit.reason, 'stop', 'a bar holding both cannot say which came first, so the loss is assumed');
  assert.equal(onTouch.exit.price, 95);
});

test('neither level closed through: out at the session close, flat by 15:00 Central', () => {
  const candles = quiet(10);
  const trade = simulate({ bars: candles, setups: [{ index: 2, ...LONG }] }).trades[0];
  assert.equal(trade.exit.reason, 'session');
  assert.equal(trade.exit.index, 6, 'the last bar whose close is inside the session');
  assert.equal(trade.exit.price, 100);
  assert.equal(trade.points, 0, 'in at 100 and out at 100 is flat, not a loss');
});

test('a signal on the session\'s last bar has no fill inside the session, and is dropped', () => {
  const candles = quiet(10);
  const result = simulate({ bars: candles, setups: [{ index: 6, ...LONG }] });
  assert.equal(result.trades.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.match(result.skipped[0].reason, /outside the same session/);
});

test('a signal that closes outside the session never trades', () => {
  const candles = quiet(14); // bar 8 closes at 17:00 Central
  const result = simulate({ bars: candles, setups: [{ index: 8, ...LONG }] });
  assert.equal(result.trades.length, 0);
  assert.match(result.skipped[0].reason, /outside the session/);
});

test('one entry a session: the second setup of the day is left alone', () => {
  const candles = bars([
    [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100],
    [101, 111, 100, 111],  // first trade: in at 101, closes through the 110 target
    [110, 111, 109, 110], [110, 110, 110, 110], [110, 110, 110, 110],
  ]);
  const result = simulate({ bars: candles, setups: [{ index: 2, ...LONG }, { index: 4, ...LONG }] });
  assert.equal(result.trades.length, 1);
  assert.equal(result.skipped.length, 1);
  assert.match(result.skipped[0].reason, /first entry of 2026-01-05 was already taken/);
});

test('with --all-entries both are taken', () => {
  const candles = bars([
    [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100],
    [101, 111, 100, 111], [110, 111, 109, 110], [109, 112, 108, 111], [110, 110, 110, 110],
  ]);
  const result = simulate({ bars: candles, setups: [{ index: 2, ...LONG }, { index: 4, ...LONG }], onePerSession: false });
  assert.equal(result.trades.length, 2);
});

test('a price that gaps past the target or the stop is not filled at a made-up price', () => {
  const pastTarget = bars([[100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100], [112, 112, 111, 112]]);
  const one = simulate({ bars: pastTarget, setups: [{ index: 2, ...LONG }] });
  assert.equal(one.trades.length, 0);
  assert.match(one.skipped[0].reason, /at or past the target/);

  const pastStop = bars([[100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100], [94, 94, 93, 94]]);
  const two = simulate({ bars: pastStop, setups: [{ index: 2, ...LONG }] });
  assert.equal(two.trades.length, 0);
  assert.match(two.skipped[0].reason, /at or under the stop/);
});

test('the stop convention is refused if it is neither close nor touch', () => {
  assert.throws(() => simulate({ bars: quiet(10), setups: [], stopOn: 'wick' }), /close or on a touch/);
});

test('a short gains when the price falls, and its R is signed the same way', () => {
  const short = { direction: 'short', level: 95, target: 90, stop: 98, swingStop: 102 };
  const candles = bars([
    [100, 100, 100, 100], [100, 100, 100, 100], [100, 100, 100, 100],
    [94, 96, 89, 89],   // filled at 94, closes at 89 through the 90 target
  ]);
  const trade = simulate({ bars: candles, setups: [{ index: 2, ...short }] }).trades[0];
  assert.equal(trade.direction, 'short');
  assert.equal(trade.exit.reason, 'target');
  assert.equal(trade.exit.price, 89, 'the close that went through the level');
  assert.equal(trade.points, 5);
  assert.ok(trade.r > 0);
});

/* -------------------------------------------------------------- the arithmetic */

test('win rate leaves the flat trades out, and profit factor divides gross by gross', () => {
  const trades = [
    { direction: 'long', points: 10, r: 1 },
    { direction: 'short', points: -5, r: -1 },
    { direction: 'long', points: -5, r: -1 },
    { direction: 'short', points: 0, r: 0 },
  ];
  const s = stats(trades);
  assert.equal(s.trades, 4);
  assert.equal(s.wins, 1);
  assert.equal(s.losses, 2);
  assert.equal(s.scratches, 1);
  assert.ok(Math.abs(s.winRatePct - 100 / 3) < 1e-9, 'one win of three decided, not of four');
  assert.equal(s.grossProfit, 10);
  assert.equal(s.grossLoss, 10);
  assert.equal(s.net, 0);
  assert.equal(s.profitFactor, 1);
  assert.equal(s.averageWin, 10);
  assert.equal(s.averageLoss, 5);
  assert.equal(s.payoffRatio, 2);
  assert.ok(Math.abs(s.breakevenWinRatePct - 100 / 3) < 1e-9, 'with 2:1 payoff, a third of trades is break-even');
  assert.equal(s.maxLossesInARow, 2);
  assert.equal(s.maxRunDown, 10, 'from plus 10 down to flat');
  assert.equal(s.totalR, -1);
});

test('with no losing trade the profit factor is unknown, not infinite', () => {
  const s = stats([{ direction: 'long', points: 5, r: 1 }, { direction: 'long', points: 5, r: 1 }]);
  assert.equal(s.grossLoss, 0);
  assert.equal(s.profitFactor, null);
  assert.equal(s.winRatePct, 100);
  assert.equal(s.breakevenWinRatePct, null);
});

test('nothing to measure reports nothing rather than a zero', () => {
  const s = stats([]);
  assert.equal(s.trades, 0);
  assert.equal(s.winRatePct, null);
  assert.equal(s.profitFactor, null);
  assert.equal(s.net, 0);
});

/* ------------------------------------------------------------- the whole thing */

/* A rising staircase with real pullbacks: HH and HL on the hour, and an up bias on
   the 4-hour, which is the only shape strategy one is supposed to trade. */
function staircase(count = 300, { up = 6, down = 3, rise = 2, fall = 2 } = {}) {
  const rows = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const open = price;
    const phase = i % (up + down);
    price += phase < up ? rise : -fall;
    const close = price;
    /* The turning bar gets a real wick. Without one, every bar opens exactly where
       the last one closed, so the top of a leg is the same price on two bars in a
       row — and a flat top is not a swing high, by definition, correctly. */
    const topWick = phase === up - 1 ? 1.5 : 0.2;
    const bottomWick = phase === up + down - 1 ? 1.5 : 0.2;
    rows.push([open, Math.max(open, close) + topWick, Math.min(open, close) - bottomWick, close]);
  }
  return bars(rows);
}

/*
 * The same series cut into four bars an hour, so the hourly read is the staircase
 * and the 15-minute read is finer than it — the shape strategy one now trades: the
 * levels from the hour, the trigger from the quarter hour.
 */
function quartered(candles, split = 4) {
  const out = [];
  for (const bar of candles) {
    const body = bar.close - bar.open;
    const upWick = bar.high - Math.max(bar.open, bar.close);
    const downWick = Math.min(bar.open, bar.close) - bar.low;
    for (let k = 0; k < split; k++) {
      const open = bar.open + (body * k) / split;
      const close = bar.open + (body * (k + 1)) / split;
      out.push({
        time: bar.time + k * STEP_15M,
        open,
        high: Math.max(open, close) + upWick * 0.5,
        low: Math.min(open, close) - downWick * 0.5,
        close,
        volume: bar.volume / split,
      });
    }
  }
  return out;
}

test('on a rising staircase it really does take longs, and they behave like trades', () => {
  const candles = staircase();
  const result = findTrades({ bars: candles, left: 1, right: 1 });
  assert.ok(result.trades.length > 0, 'no trade at all: the rule never fired on the shape it is built for');
  for (const trade of result.trades) {
    assert.equal(trade.direction, 'long', 'there is no down structure in a rising staircase to sell');
    assert.equal(trade.entry.price, candles[trade.entry.index].open, 'filled at an open the bar really had');
    assert.ok(trade.entry.index > trade.signal.index, 'filled after the signal, never on it');
    assert.ok(trade.exit.index >= trade.entry.index);
    assert.ok(['target', 'stop', 'session'].includes(trade.exit.reason));
    if (trade.exit.reason === 'target') assert.ok(trade.points > 0, 'a target exit is a win');
    if (trade.exit.reason === 'stop') assert.ok(trade.points < 0, 'a stop exit is a loss');
  }
  assert.equal(result.trades.filter((t) => t.direction === 'long').length, result.trades.length);
});

test('the 15m is the trigger and the 1h is where the levels come from', () => {
  const bars15m = quartered(staircase(600));
  const result = findTrades({ bars: bars15m, left: 1, right: 1 });
  assert.equal(result.reads.entry, '15m');
  assert.equal(result.reads.direction, '1h');
  assert.equal(result.reads.bias, '4h');
  assert.ok(result.trades.length > 0, 'no trade on 15m bars at all: the trigger never fired');
  for (const trade of result.trades) {
    assert.ok(trade.entry.index > trade.signal.index, 'filled after the signal');
    assert.ok(trade.target > trade.entry.price, 'a long targets a price above');
    assert.ok(trade.stop < trade.entry.price, 'and is stopped below');
  }
});

test('upside down, the same series only sells', () => {
  const candleSeries = staircase();
  const flipped = candleSeries.map((bar) => {
    const MIRROR = 300;
    return {
      time: bar.time,
      open: MIRROR - bar.open,
      high: MIRROR - bar.low,
      low: MIRROR - bar.high,
      close: MIRROR - bar.close,
      volume: bar.volume,
    };
  });
  const result = findTrades({ bars: flipped, left: 1, right: 1 });
  assert.ok(result.trades.length > 0);
  assert.equal(result.trades.filter((t) => t.direction === 'long').length, 0);
  for (const trade of result.trades) {
    assert.ok(trade.stop > trade.entry.price, 'a short is stopped above');
    assert.ok(trade.target < trade.entry.price, 'and targets a price below');
  }
});

test('the trades it took before a cut are the same trades it takes with more bars after it', () => {
  /* Standing at bar N, the engine must not have used anything after bar N. Any
     trade that had already closed by then has to come out identical. */
  const all = staircase();
  const full = findTrades({ bars: all, left: 1, right: 1 });
  const cut = 120;
  const shorter = findTrades({ bars: all.slice(0, cut), left: 1, right: 1 });
  /* Two bars of margin: a trade still open at the cut is closed at the cut instead,
     and that difference is the honest lag of not having the later bars, not a leak. */
  const settled = (t) => t.exit.index < cut - 2;
  const shape = (t) => [t.direction, t.entry.index, t.entry.price, t.exit.index, t.exit.price, t.exit.reason];
  const closed = full.trades.filter(settled);
  assert.ok(closed.length > 0, 'no trade settled before the cut, so this proves nothing');
  assert.deepEqual(
    shorter.trades.filter(settled).map(shape),
    closed.map(shape),
    'a trade taken before the cut changed once the later bars arrived',
  );
});

test('the bars have to be the timeframe the entries are taken on', () => {
  const candles = staircase(50);
  assert.throws(
    () => findTrades({ bars: candles, entryTimeframe: '15m', left: 1, right: 1 }),
    /the bars are 1h apart and strategy one takes its entries on the 15m/,
  );
});

test('a direction timeframe smaller than the bars is refused, not silently resampled', () => {
  const bars15m = quartered(staircase(60));
  assert.throws(
    () => findTrades({ bars: bars15m, directionTimeframe: '5m', left: 1, right: 1 }),
    /smaller than the bars themselves/,
  );
});

test('dollars only appear when an instrument is named', () => {
  const candles = staircase(300);
  const inPoints = findTrades({ bars: candles, left: 1, right: 1 });
  assert.equal(inPoints.trades[0].dollars, undefined);

  const inDollars = findTrades({ bars: candles, left: 1, right: 1, instrument: 'MES', contracts: 4, commission: 1 });
  const trade = inDollars.trades[0];
  assert.equal(trade.instrument, 'MES');
  assert.ok(Number.isFinite(trade.dollars));
  assert.equal(trade.fees, 8, 'a dollar a contract, both ways, four contracts');
  const gross = trade.points * 5 * 4;
  assert.ok(Math.abs(trade.grossDollars - gross) < 1e-6, 'MES is $5 a point, times four contracts');
  assert.ok(Math.abs(trade.dollars - (gross - 8)) < 1e-6, 'and the commission comes off');
});
