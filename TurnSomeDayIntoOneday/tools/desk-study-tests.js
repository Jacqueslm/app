// ── the timing study ────────────────────────────────────────────────────────
// Jacques, 19 Sep 2026: "the trading desk needs a part in there where it helps
// me ... research for me to get better timing".
//
// So the desk counts what his own bars did, on his own rules: how often a 4h
// level was only poked and never closed above, how far the down legs came back
// to the high that started them, how many 15m bars a higher low lasted, and how
// much of a day's range was made inside his session window. What these check is
// that the counting is the bars' arithmetic and not the page's opinion, that a
// figure is always printed with the count it came from, and that with no bars
// loaded there is no count at all — the failure that would matter most, because
// a study that invents a number is worse than no study.
//
// The bars below are placed by hand: a particular bar is the swing, a
// particular bar pokes the level, and a particular bar closes above it, so the
// expected count can be worked out on paper before it is asserted here.
const STEP_MS = { '5m': 5 * 60000, '15m': 15 * 60000, '1h': 60 * 60000, '4h': 4 * 60 * 60000 };

// [open, high, low, close] per bar in, a bar with a time on it out.
function mkBars(tf, rows, base) {
  const step = STEP_MS[tf];
  const from = base == null ? Date.parse('2026-09-14T13:30:00Z') : base;
  return rows.map((r, i) => ({ t: from + i * step, o: r[0], h: r[1], l: r[2], c: r[3], v: 100 + i }));
}
function feedOf(b4, b15) {
  return { ok: true, symbol: 'NQ=F', name: 'Nasdaq 100', partial: null, error: null,
    timeframes: { '4h': { ok: true, tf: '4h', candles: b4 }, '15m': { ok: true, tf: '15m', candles: b15 } } };
}

// A swing high at 110 on the third bar, poked by the sixth: 112 trades through
// it and the close stays under the level. WING is 2, so the pivot needs two bars
// either side of it and the fixture has to carry one.
const POKE_FAIL = [
  [96, 100, 95, 98],
  [98, 102, 97, 99],
  [99, 110, 98, 105],
  [105, 104, 96, 99],
  [99, 101, 94, 97],
  [97, 112, 96, 104],
  [104, 105, 98, 100],
  [100, 103, 95, 97],
];
// The same bars with the poke bar closing above the level instead: 111 over 110.
const POKE_CLOSE = [
  [96, 100, 95, 98],
  [98, 102, 97, 99],
  [99, 110, 98, 105],
  [105, 104, 96, 99],
  [99, 101, 94, 97],
  [97, 112, 96, 111],
  [111, 112, 108, 110],
  [110, 111, 105, 107],
];
// One down leg: swing high 110, swing low 90, then price works all the way back
// to 112 — past the high that started the leg — before a close under 90 ends it.
// The leg is 20 points and the retrace is 22, so it came back 110% of itself.
const LEG_BACK = [
  [96, 100, 95, 98],
  [98, 102, 97, 99],
  [99, 110, 98, 105],
  [105, 104, 96, 99],
  [99, 101, 94, 97],
  [97, 100, 90, 92],
  [92, 97, 91, 96],
  [96, 108, 95, 105],
  [105, 112, 104, 110],
  [110, 111, 100, 99],
  [99, 98, 88, 89],
];
// The same leg with the low given up at once: the first bar after it closes
// under 90, so nothing retraced — 15% of the leg, and it never came close.
const LEG_AWAY = [
  [96, 100, 95, 98],
  [98, 102, 97, 99],
  [99, 110, 98, 105],
  [105, 104, 96, 99],
  [99, 101, 94, 97],
  [97, 100, 90, 92],
  [92, 93, 91, 92],
  [92, 93, 91, 92],
  [92, 93, 89, 88],
];
// A higher low at 93 on the eighth bar, and the first close under it three bars
// later — so the hold lasted three bars of 15 minutes.
const HOLD_3 = [
  [96, 100, 95, 98],
  [98, 102, 97, 99],
  [99, 101, 90, 92],
  [92, 99, 93, 95],
  [95, 103, 94, 100],
  [100, 104, 97, 101],
  [101, 102, 96, 99],
  [99, 100, 93, 95],
  [95, 97, 94, 96],
  [96, 98, 95, 97],
  [97, 96, 92, 91],
];

// A bar at a time of day on THIS machine's clock, which is the clock the page
// reads too: the wall clock of the device it is open on.
function atLocal(day, hour, min) {
  return new Date(2026, 8, day, hour, min, 0, 0).getTime();
}
function barAt(ms, o, h, l, c) {
  return { t: ms, o, h, l, c, v: null };
}

test('a desk with no study loaded says so, and quotes no count at all', async () => {
  const p = await loadPage();
  assert.strictEqual(p.sandbox.STUDY, null, 'a fresh desk has loaded no study bars');
  const text = p.sandbox.studyText();
  assert.ok(text.includes('NOT LOADED.'), 'the assistant is told there is nothing to quote');
  assert.ok(text.includes('Do not describe a study, do not invent a count'));
  assert.strictEqual(p.els.get('studyOut').innerHTML, '', 'and the card draws nothing');
  assert.ok(p.sandbox.askSystem().includes('NOT LOADED.'),
    'it is on every question, so a question about it cannot turn into a made-up one');
});

test('the study card is on the page, with its own button and its own limits', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.ok(html.includes('<div class="sec-hd">Study the timing</div>'));
  assert.ok(html.includes('id="studyGo">Load bars to study'));
  assert.ok(html.includes('id="studyOut"></div>'));
  assert.ok(html.includes('Nothing here is a backtest and nothing here is a forecast'),
    'the card says on its face what it is not');
});

test('the study pulls its own stretch of bars, and a failed pull leaves nothing behind', async () => {
  const p = await loadPage({ feed: feedOf(mkBars('4h', POKE_FAIL), mkBars('15m', HOLD_3)) });
  await p.sandbox.loadStudy();
  const asked = p.calls.filter((c) => String(c.url).indexOf('/api/candles') === 0).map((c) => c.url);
  assert.ok(asked.some((u) => /bars=500/.test(u)),
    'the study asks for 500 bars: the read above only holds the last few of each');
  assert.ok(p.sandbox.STUDY, 'what came back is kept');
  assert.ok(p.els.get('studyOut').innerHTML.length > 0, 'and it is painted on the page');

  // Now a feed that answers with nothing. The old study must not survive it.
  p.setCandles({ status: 502, body: { ok: false, error: 'NQ: the feed could not be reached.' } });
  await p.sandbox.loadStudy();
  assert.strictEqual(p.sandbox.STUDY, null, 'the previous study does not survive a failed pull');
  assert.strictEqual(p.els.get('studyOut').innerHTML, '', 'and the card is emptied with it');
  assert.ok(p.els.get('studyMsg').textContent.includes('could not be reached'));
  assert.ok(p.sandbox.studyText().includes('NOT LOADED.'), 'so the assistant has no count to quote');
});

test('a level traded through is a poke only when no bar closed above it', async () => {
  const p = await loadPage();
  const fail = p.sandbox.pokeStudy(mkBars('4h', POKE_FAIL));
  assert.strictEqual(fail.pokes, 1, 'one swing high was traded above');
  assert.strictEqual(fail.closed, 0, 'and no bar closed above it');
  assert.strictEqual(fail.failed, 1, 'so it is a poke and nothing else');
  assert.strictEqual(fail.deep, 2, 'two points past the level, which is what a stop has to sit outside of');
  assert.strictEqual(fail.level, 110, 'and the level is the swing high itself');

  const closed = p.sandbox.pokeStudy(mkBars('4h', POKE_CLOSE));
  assert.strictEqual(closed.pokes, 1);
  assert.strictEqual(closed.closed, 1, 'a close above the level is the frame changing');
  assert.strictEqual(closed.failed, 0);
  assert.strictEqual(closed.deep, null, 'so there is no failed poke to measure');
});

test('the study prints every figure with the count it came from', async () => {
  const p = await loadPage();
  p.sandbox.STUDY = feedOf(mkBars('4h', POKE_FAIL), mkBars('15m', HOLD_3));
  p.sandbox.paintStudy();
  const shown = p.els.get('studyOut').innerHTML;
  assert.ok(shown.includes('<b>1</b> of 1 never closed above — the grab'), 'the poke, with its count');
  assert.ok(shown.includes('went <b>2.00</b> past the level and came back'), 'and how far it went');
  assert.ok(shown.includes('<b>3</b> bars &middot; 45m on the 15m'), 'a hold is a number of bars');
  assert.ok(/bars, \d+ [A-Z][a-z]{2} to \d+ [A-Z][a-z]{2}/.test(shown),
    'and the card says which window of bars it counted');
});

test('the retrace is measured against the high that started the leg', async () => {
  const p = await loadPage();
  const back = p.sandbox.retraceStudy(mkBars('4h', LEG_BACK));
  assert.strictEqual(back.n, 1, 'one finished down leg in these bars');
  assert.strictEqual(back.live, 0, 'and its low has gone, so it is not still running');
  assert.strictEqual(back.whole, 1, 'it came all the way back to the swing high');
  assert.strictEqual(Math.round(back.mid * 100), 110, 'and past it, which is what 110% says');

  const away = p.sandbox.retraceStudy(mkBars('4h', LEG_AWAY));
  assert.strictEqual(away.n, 1);
  assert.strictEqual(away.whole, 0, 'a leg with no retrace is not one that came back');
  assert.strictEqual(away.under, 1, 'it never got past a third of itself');
});

test('a leg still running is counted as live, never as one that failed to retrace', async () => {
  // The low of this leg has not been taken, so the bars have not finished
  // saying what it did. Counting it would print "never got past a third" about
  // a leg that is still in front of him.
  const p = await loadPage();
  const r = p.sandbox.retraceStudy(mkBars('4h', LEG_BACK.slice(0, 10)));
  assert.strictEqual(r.n, 0, 'nothing finished in these bars');
  assert.strictEqual(r.live, 1, 'one leg is still live');
  assert.strictEqual(r.under, 0, 'and it is not counted among the ones that went nowhere');
});

test('a higher low is held until a bar CLOSES below it, and counted in bars', async () => {
  const p = await loadPage();
  const h = p.sandbox.holdStudy(mkBars('15m', HOLD_3));
  // Length and value, not deepStrictEqual: the array was built inside the
  // page's own context, so its prototype is the page's Array and never this
  // file's.
  assert.strictEqual(h.holds.length, 1, 'one higher low failed in these bars');
  assert.strictEqual(h.holds[0], 3, 'and the hold lasted three bars of 15 minutes');
  assert.strictEqual(h.mid, 3);
  assert.strictEqual(h.holding, 0, 'and it did fail, so it is not still standing');

  // The same bars with the close under 93 taken out: nothing closed below it,
  // so it is still holding and has no length yet.
  const still = p.sandbox.holdStudy(mkBars('15m', HOLD_3.slice(0, 10)));
  assert.strictEqual(still.n, 0, 'a hold with no close below it has no length');
  assert.strictEqual(still.holding, 1, 'it is counted as still holding instead');
});

test('the window counts a day on his own clock, and a day outside it honestly', async () => {
  const p = await loadPage();
  p.sandbox.SESS = { a: '08:30', b: '15:00' };
  // Day one, both bars inside the window: 105 high, 90 low, range 15, all of it
  // inside. Day two, one bar inside (110/100) and the high of the day made after
  // the window closed at 130 — so ten of that day's thirty points were his.
  const bars = [
    barAt(atLocal(14, 9, 0), 91, 100, 90, 95),
    barAt(atLocal(14, 10, 0), 95, 105, 95, 104),
    barAt(atLocal(15, 9, 0), 101, 110, 100, 105),
    barAt(atLocal(15, 16, 0), 105, 130, 120, 129),
  ];
  const w = p.sandbox.windowStudy(bars);
  assert.strictEqual(w.ok, true);
  assert.strictEqual(w.days, 2, 'two days on this clock');
  assert.strictEqual(Math.round(w.share * 100), 56, '25 of the 45 points those days made were inside it');
  assert.strictEqual(w.hi, 1, 'the high of the day was made in his window on one of the two days');
  assert.strictEqual(w.lo, 2, 'the low of the day was made in there on both');

  // With no usable window there is nothing to count inside, and the page says
  // that rather than dividing by a window it does not have.
  p.sandbox.SESS = { a: '09:00', b: '09:00' };
  assert.strictEqual(p.sandbox.windowStudy(bars).ok, false, 'a window with no length is not a window');
});

test('the assistant is handed the counts, and told what they can never be', async () => {
  const p = await loadPage();
  p.sandbox.STUDY = feedOf(mkBars('4h', POKE_FAIL), mkBars('15m', HOLD_3));
  const text = p.sandbox.studyText();
  assert.ok(text.includes('NOT a backtest'), 'the study says on its face what it is not');
  assert.ok(text.includes('THE POKE (4h, 8 bars'), 'the count comes with the timeframe it came from');
  assert.ok(text.includes('CLOSED above the level within the next 6 bars on 0 of those 1'),
    'and with what it was a count of');
  assert.ok(text.includes('THE HOLD (15m): 1 higher low failed in these bars, the middle one lasting 3 bars'));
  assert.ok(text.includes('WHAT THIS CANNOT SAY: it is one loaded window of bars and a small sample'));
  assert.ok(text.includes('THE BARS IT COUNTED ARE ITS OWN'),
    'the study counts a longer window than the candles block, and says so');
  assert.ok(p.sandbox.askSystem().includes('THE POKE (4h, 8 bars'), 'and every question carries it');

  const sys = String(p.sandbox.STUDY_SYS);
  assert.ok(sys.includes('keep the figure and its count welded together'));
  assert.ok(sys.includes('WHEN A COUNT IS SMALL, SAY SO IN THE SAME SENTENCE'));
  assert.ok(sys.includes('NEVER: call the study a backtest'));
  assert.ok(sys.includes('END WITH ONE CHANGE'));
});

test('the house rules name the study, and it is still not a backtest', async () => {
  const p = await loadPage();
  const desk = String(p.sandbox.DESK_SYS);
  assert.ok(desk.includes('the counts in the STUDY block, which this page worked out itself from bars that loaded'));
  assert.ok(desk.includes('no backtest result, and no study of your own'),
    'so the assistant may not run one of its own either');
  assert.ok(desk.includes('There is still no backtest on this page — never imply you ran one and never quote a result'));
  assert.ok(desk.includes('the session block and the STUDY block are the only basis you have for structure and for timing'));
});

test('the study chip answers under the study rules, not the desk ones', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.ok(html.includes('data-sys="study">Study my timing'));
  assert.ok(html.includes("sys==='study' ? askSystem(STUDY_SYS)"),
    'the one chip that reads the study is read under the study rules');
  assert.ok(html.includes("getElementById('studyGo').onclick=function(){ loadStudy() }"));
});
