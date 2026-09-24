// ── the wick is not a break ─────────────────────────────────────────────────
//
// Jacques, 23 Sep 2026, after the practice game got it first: "it counts wicks
// as breaks when i see wicks as close a wick break close back in the leg or zone
// it thats ok". The desk was still counting them - structure() labelled a swing
// high 'HH' on the wicked high alone, and worse, frameRead() turned the frame
// down on a low that closed back above the low before it, which is the read he
// says costs him money. Six words now, not four, and the same rule the game and
// the TradingView script run, so three reads of the same bars cannot disagree.
//
// These fixtures set a bar's OHLC by hand, because the difference between the
// wick and the close is the whole point of them and the mid-based fixtures above
// cannot express it - there the close is always one point off the low.
function ohlcFeed(bars) {
  const base = Date.parse('2026-09-18T00:00:00Z');
  const mk = (vals, step) => vals.map((b, i) => ({ t: base + i * step, o: b[0], h: b[1], l: b[2], c: b[3], v: 100 + i }));
  const fromMid = FRAME_NONE.map((v) => [v, v + 1, v - 1, v]);
  return {
    ok: true, symbol: 'NQ=F', name: 'Nasdaq 100', partial: null, error: null,
    timeframes: {
      '5m': { ok: true, candles: mk(fromMid, 5 * 60000) },
      '15m': { ok: true, candles: mk(fromMid, 15 * 60000) },
      '1h': { ok: true, candles: mk(bars, 60 * 60000) },
      '4h': { ok: true, candles: mk(bars, 4 * 60 * 60000) },
    },
  };
}

// Bar 8 wicks to 124, over the 121 high before it, and closes back at 112: the
// high was taken and handed back. Bar 14 is the same kind of turn with the bar
// CLOSED through the high before it. Bar 11's low equals the low before it,
// which the game reads as a higher low and not as a raid - the two pages have to
// say the same thing about the same bar.
const WICK_HIGH = [
  [100, 101, 99, 100], [110, 111, 109, 110], [120, 121, 119, 120], [110, 111, 109, 110],
  [100, 101, 99, 100], [90, 91, 89, 90], [95, 96, 94, 95], [105, 106, 104, 105],
  [112, 124, 111, 112], [105, 106, 104, 105], [95, 96, 94, 95], [90, 91, 89, 90],
  [95, 96, 94, 95], [105, 106, 104, 105], [131, 132, 130, 131], [105, 106, 104, 105],
  [100, 101, 99, 100],
];

test('a wick through a high is a raid in the read, not a higher high', async () => {
  const p = await loadPage({ feed: ohlcFeed(WICK_HIGH) });
  const r = p.sandbox.readOf('1h', p.sandbox.FEED.timeframes['1h'].candles);
  assert.ok(r, 'a read comes off the bars');
  // The read hands out the last six labels that are words, so the first swing on
  // the chart is left off on purpose: it has nothing before it to be labelled
  // against, and it keeps its bare letter rather than a word it did not earn.
  assert.deepEqual(r.labels, ['SH', 'HL', 'HH'],
    'the wick is SH, the equal low is HL, and only the turn that closed through is HH');
  assert.strictEqual(r.sweep, 'SH', 'and the raid is handed on with the read, not folded into it');
  assert.strictEqual(r.trend, 'up', 'a raid moves nothing, so the run stands on the turns that closed');

  const line = p.sandbox.structureLine(r);
  assert.match(line, /SH HL HH/, 'he is given the words as they came');
  assert.match(line, /most recent raid in these bars was a SH/, 'and the raid is said out loud');
  assert.match(line, /never a break/, 'with the rule attached, because that is the mistake');
  assert.match(p.sandbox.structureText(), /SH a new high whose bar closed back under it/,
    'the assistant is taught the six words too');
});

// The same shape at a low: bar 11 goes under the 89 low by a wick and closes
// back at 92. That is the raid the frame must ignore.
const WICK_LOW = [
  [100, 101, 99, 100], [110, 111, 109, 110], [120, 121, 119, 120], [110, 111, 109, 110],
  [100, 101, 99, 100], [90, 91, 89, 90], [95, 96, 94, 95], [105, 106, 104, 105],
  [115, 116, 114, 115], [105, 106, 104, 105], [95, 96, 94, 95], [92, 95, 84, 92],
  [90, 91, 89, 90], [95, 96, 94, 95], [98, 99, 97, 98], [95, 96, 94, 95],
  [90, 91, 89, 90],
];
// And the control, where that same bar CLOSES under the low: a real lower low.
const CLOSED_LOW = WICK_LOW.map((b, i) => (i === 11 ? [90, 91, 84, 85] : b));

test('a frame does not turn on a wick, and does turn on a close', async () => {
  const raid = await loadPage({ feed: ohlcFeed(WICK_LOW) });
  const r = raid.sandbox.frameRead();
  assert.strictEqual(r.ok, true, 'the bars came back and were read');
  assert.strictEqual(r.lowerLow, false, 'a low taken and given back is not a lower low');
  assert.strictEqual(r.level, null, 'so no level is set, and none is shown');
  assert.strictEqual(r.low, null);
  assert.strictEqual(r.verdict, 'wait');
  assert.match(r.why, /no lower low on 1h/, 'and the page says which of the two it is');
  assert.strictEqual(raid.sandbox.readOf('1h', raid.sandbox.FEED.timeframes['1h'].candles).sweep, 'SL',
    'the wick is marked as the raid it is');
  raid.sandbox.paintFrame();
  assert.doesNotMatch(raid.els.get('frOut').innerHTML, /116\.00/, 'no level is drawn off a wick');

  const closed = await loadPage({ feed: ohlcFeed(CLOSED_LOW) });
  const r2 = closed.sandbox.frameRead();
  assert.strictEqual(r2.lowerLow, true, 'the close under the low is what turns the frame down');
  assert.strictEqual(r2.level, 116, 'the level is the swing high the drop came from');
  assert.strictEqual(r2.low, 84, 'and the frame low is the lower low');
  assert.strictEqual(r2.state, 'retracing');
});
