# The Trading Bot — a separate job

This folder has nothing to do with the app in `TurnSomeDayIntoOneday/`. It is its
own thing, kept in this workspace because that is the workspace we have. It is not
wired into the app's server, its pages or its service worker, and nothing in here
is committed or pushed until you ask for it.

## The rules I work to

1. **No real money.** Nothing here touches a live account until you say so in plain
   words, for a named strategy, after that strategy has traded on paper.
2. **Backtest, then paper, then live.** In that order. A strategy that fails a step
   does not skip to the next one.
3. **Always measured against buy and hold.** The benchmark sits next to every
   result, from the same engine and the same costs. A strategy that beats nothing is
   reported as beating nothing.
4. **Synthetic data proves nothing about profit.** It tests plumbing. Every sample
   file this folder generates says *synthetic* on it.
5. **One strategy at a time.** Your two strategies get built and measured one at a
   time, and only compared once both stand on their own.
6. **No secrets in the repo.** Broker keys live in the environment, never in a file
   that goes into git.
7. **Fees and slippage are never zero by accident.** The defaults are 0 only so the
   arithmetic can be checked by hand; a real run sets them.

## Roadmap

1. **Ground rules and the measuring instrument.** ← this step, done.
2. **Strategy one — futures, market structure on every timeframe.** Built and
   measured. The read, the session clock, the entry, the target and the stop are
   in; it has run on synthetic bars only, which is not evidence of anything.
3. **Strategy two** — the same treatment.
4. **Paper trading** against a real broker's sandbox. Alpaca is the pick for a
   personal bot: it is a real broker, its paper account is free, and the paper and
   live sides take the same code, so nothing gets rewritten to go live. Not built
   until the strategies exist and have earned it.
5. **Live guard rails** — kill switch, maximum daily loss, position and order caps,
   and a log of every order placed.
6. **Running it** — where it lives, how it stays up, and how it tells you it died.

## Paper trading — the alert receiver (built)

`paper/` is a small server that takes the TradingView alert and keeps a paper
account: a resting limit fills only when a price comes to it, the stop and the
target are the ones the alert carried, and every fill is written down in dollars at
four contracts. It holds one position at a time and can never reach a broker.

```
PAPER_TOKEN=make-up-a-long-word node paper/server.js
```

Read `paper/README.md` for the webhook address, the delayed price feed and the
reasons those fills are a rehearsal rather than a quote.

## What a strategy is here

A strategy is a module in `strategies/`. It exports a `name`, a `describe()`, and
one function:

```js
module.exports = {
  name: 'example-sma',
  describe: () => 'in when the fast average is above the slow one',
  // ctx: { history, i, units, cash, equity }
  // returns the target exposure as a fraction of equity:
  //   0 = all cash, 1 = all in, -1 = fully short
  // undefined or null = leave the exposure where it is
  signal(ctx) { /* ... */ },
};
```

The engine does everything else: sizing, fills, fees, slippage, the equity curve,
the metrics and the benchmark.

### The one rule a strategy must obey

**It only ever sees the bars up to and including the one it is deciding on.** The
bars it is handed are wrapped, and reaching for a later one throws instead of
quietly looking into the future. That single mistake is what makes most homemade
backtests look wonderful and lose money in the market, so it is an error here, not
a matter of discipline.

Fills follow from it: a decision made on bar *i* is filled at bar *i+1*'s open. The
last bar of a run has no next open, so its signal is dropped and the report counts
the dropped signals rather than pretending it was filled.

### Exposure, not lot sizes

A strategy says how exposed it wants to be, and the engine turns that into units at
the fill price. Because a fixed fraction of equity drifts as price moves, the engine
only rebalances when the drift exceeds `--rebalance-pct` (default 1% of equity);
otherwise "always fully invested" would churn a fee every single bar. Set it to 0 to
see that churn happen.

## Using it

```bash
# make some bars to run against (synthetic — real data goes in data/ the same shape)
node make-sample.js --bars 2000 --interval 1h --seed 7

# measure the example strategy
node run.js --data data/sample-synthetic-1h.csv --strategy example-sma \
  --fee-bps 5 --slippage-bps 10

# the raw result, for a script or a spreadsheet
node run.js --data data/sample-synthetic-1h.csv --strategy example-sma --json

# the tests
node --test test/*.test.js
```

`node run.js --help` lists every knob.

### The candle file

CSV, one bar per line, `time,open,high,low,close,volume`. `time` is ISO 8601 or
epoch **milliseconds**. Blank lines and `#` comments are skipped; the header row is
optional. A malformed line, a high below the close, or a time that does not move
forward is refused with the line number instead of being read as data.

## Strategy one — futures, market structure on every timeframe

What you gave me: *"I trade futures. Add market structure for every timeframe, that's
it, step by step."* The read came first, on its own; your rules went on top of it
afterwards. Strategy one is that read with an entry, a target, a stop and the New
York clock attached, and it is measured below.

### What "market structure" means here

Not a vibe — these, exactly (all of it in `lib/structure.js` at the top):

- **A swing high** is a bar whose high is above the highs of *N* bars before it and
  *N* bars after it. A swing low is the same said of lows. Default *N* is 2, set
  with `--swing-left` and `--swing-right`.
- **The part that matters: a swing is only KNOWN `N` bars later.** The high at bar
  1 is not a high until bar 3 exists. A read that knows a swing the moment it
  prints is reading the future, and that is the most common way a
  market-structure system looks brilliant on paper and loses money. The tests
  check this by running the read over a prefix of the bars and demanding the same
  answer at every bar.
- **The trend** comes from the last two confirmed swings each way: higher high and
  higher low is *up*, lower high and lower low is *down*, disagreement is *range*,
  and not enough swings yet is *forming* — which is reported as forming rather
  than guessed at.
- **A break is a CLOSE beyond the last confirmed swing**, never a wick. In an up
  trend a close above the last swing high is a **BOS** (continuing) and a close
  below the last swing low is a **CHoCH** (changing character). With no trend to
  compare to, it is called a break and nothing more. Each level can fire once.
- **Every timeframe** means the same read at several bar sizes at once, from one
  set of bars: 15m, 1h, 4h, 1d all out of the same file. A bigger timeframe is only
  read once **its own bar has closed** — standing inside a 4-hour bar you cannot
  know it, and a backtest that reads the forming one is reading the future. What
  that costs is honest lag, and it is stated rather than hidden.

### Reading it

```bash
node structure.js --data data/sample-synthetic-1h.csv
node structure.js --data bars.csv --timeframes 15m,1h,4h,1d --swing-left 2 --swing-right 2
node structure.js --data bars.csv --at 2026-03-01T14:00:00Z   # as it stood then, not now
node structure.js --data bars.csv --json
```

It prints the trend, the last swing high and low with how long ago they formed, the
last break, and the **alignment** across the timeframes: all up, all down, still
forming, or mixed. Mixed is a description of disagreement, not a signal.

For futures the clock matters: `--session-anchor` cuts the bigger bars where the
exchange's session opens, because a market that trades round the clock does not have
a UTC-midnight day. Left alone it cuts on UTC midnight, which for futures is
usually the wrong place.### What you have told me

- **Instruments: MGC, MNQ and MES** — the micro gold, micro Nasdaq-100 and micro
  S&P 500 futures. **4 contracts per instrument**, so 12 contracts on at once if all
  three are in a trade.

That is the raw material for the futures maths below: MGC is 10 troy ounces a
contract, MNQ is $2 a point and MES is $5 a point, and the three have different
sessions (gold nearly round the clock, the equity index futures with a daily
maintenance halt). None of that is built yet.

### The rules, as you gave them — three timeframes, each with one job

The hour has the levels worth trading to. The quarter hour has the trigger.

| | the rule |
|---|---|
| **clock** | New York session only, on **Central time**: nothing opens outside 08:30–15:00, nothing is carried overnight. |
| **bias — 4h** | The **4-hour** structure has to be up for a long, down for a short. |
| **direction — 1h** | The **1-hour** has to agree: a higher high **and** a higher low for a long (HH, HL); a lower high and a lower low for a short (LH, LL). |
| **entry — 15m** | The trade is **taken on the 15-minute**: a 15-minute close back above the **previous 15-minute swing high**, once the hour and the 4-hour agree. The short is the mirror, on the previous 15-minute swing low. |
| **target** | The **1-hour higher high that was already made** — the previous one, not a new high still to come. For a short, the 1-hour low already made. |
| **stop** | **Behind the 1-hour higher low** (the 1-hour lower high for a short) — the level that makes the read wrong. |
| **exits** | Measured on **closes, not wicks**. A wick through the target is a wick; the exit is the 15-minute **close** at or through the level, at that close's price. |
| **one entry** | **First entry of the session only.** Once a trade is taken, that day is done. |

What the 15-minute is *not* asked for is its own trend. A pullback inside a 1-hour up
trend reads as down structure on the 15-minute, and that is exactly where the entry
is taken. The quarter hour is asked for one thing only: the swing high that has just
been reclaimed.

One thing the rules do not name, so it is decided in the open rather than guessed at
silently (`lib/reclaim.js`, top):

- **Session end — out at the 15:00 close** if neither level is closed through. "New
  York session only" means flat by the end of it.

The rest is the honesty the folder already runs on: a swing is only known once it is
confirmed, a bigger timeframe is only read once **its own bar has closed**, a signal
is a close so the fill is the **next bar's open**, and a signal on the session's last
bar is dropped and counted rather than filled at a price that never traded. The stop
is a close through the level by default; `--stop-on-touch` fills it where the resting
order sits instead, which is what a real stop does. Both are measured below.

### Running it

```bash
node strategy-one.js --data data/sample-synthetic-15m.csv --instrument MES --contracts 4
node strategy-one.js --data bars15m.csv --stop-on-touch   # the other stop convention
node strategy-one.js --data bars15m.csv --long-only       # one side only
node strategy-one.js --data bars.csv --commission 1.10 --slippage-ticks 1
node strategy-one.js --data bars.csv --json               # every trade, for a spreadsheet
```

A separate runner from `run.js` on purpose: that engine sizes in fractions of
equity and has no stop or target, which is exactly what this strategy is made of.

### Real bars — the free delayed feed

```bash
node fetch-bars.js --symbols MES,MNQ,MGC                     # writes data/real/MES-15m.csv, etc.
node strategy-one.js --data data/real/MES-15m.csv --instrument MES --contracts 4
```

No key, no account: futures quotes from the free feed, about **ten minutes behind**.
Sixty days is the most it will hand out at 15 minutes, so one pull is roughly 5,700
bars and 40 sessions per instrument.

A delayed feed is not a clean file, so the fetcher (`lib/yahoo.js`, tested by
`test/yahoo.test.js`) does these things rather than trusting it:

- **The forming bar is dropped.** So is any bar that has not cleared the ten-minute
  lag (`--delay-minutes`). A half-built bar that closes above a level is a trade that
  never happened, and it is the one way a lagging feed quietly invents signals.
- **Null rows are dropped and counted**, never filled with the previous close. Gaps
  are honest; a stitched price is not.
- **The file says what it is** on its first two lines — source, interval, fetch time.
- **The file is read back** through the same loader `strategy-one.js` uses before the
  run is called done, so a mis-written file fails at the fetch instead of inside a
  report.

One step has to run on your connection: `fetch-bars.js` from this workspace gets
**HTTP 429** — the free feed limits by IP and refuses a shared cloud address almost
at once. On your own machine the same command works. `--from-json saved-chart.json
--symbol MES` converts a response saved from a browser with no network at all.

### What it says on synthetic bars — read the last line first

Random numbers from `make-sample.js` — `--bars 60000 --interval 15m --seed 21` — so
this measures the rules and nothing about the market:

| | all | long | short |
|---|---|---|---|
| trades (of 305 setups) | 60 | 33 | 27 |
| win rate | 53.33% | 57.58% | 48.15% |
| profit factor | 0.90 | 1.44 | 0.53 |
| average win / average loss | $26.46 / $33.54 | $29.11 / $27.43 | $22.58 / $39.64 |
| net, 4 × MES, no commission | **−$92.40** | +$169.00 | −$261.40 |
| exits | 26 target, 11 stop, 23 session close | | |

With `--stop-on-touch`: the same 60 trades and the same 53.33% win rate, profit
factor **0.94**, net **−$52.60** at 4 × MES. Which way a stop fills is worth about
$40 over 60 trades. Real, and smaller than the thing below.

**The figure that matters:** this mix needs **55.90% wins to break even** and got
53.33%. The 15-minute trigger gets in earlier than a close on the hour would, so the
entry sits closer to the stop and further from the 1-hour high — payoff 0.79, against
0.37 for the hourly version of these same rules. A better shape, and still not a
profitable one.

That is not a verdict. 60 trades on fake data is not evidence, and the two sides
disagree so hard (1.44 against 0.53) that the gap is far more likely to be noise than
an edge. It is the shape to watch when real bars go in.

### What it says on real bars — ten years, three instruments

Built from the public 15-minute bar files (`import-bars.js`), read back through the
same loader, ~200,000 bars each:

| bars | what it is | range |
|---|---|---|
| S&P 500 | `USA500IDXUSD_M15` — cash index | 2013-08 → 2023-09 |
| Nasdaq 100 | `USATECHIDXUSD_M15` — cash index | 2013-09 → 2023-09 |
| gold | `XAUUSD_M15` — spot gold | 2015-03 → 2023-09 |

**These are the underlying index and spot gold, not the CME contracts.** The micros
trade a basis over the index and roll quarterly; these series do neither. So this is
free of rollover, and the prices are the index — not MNQ, MES or MGC themselves. Point
size maps closely enough that dollars at four contracts are a fair approximation.

Everything below is the close-stop rule as written, no commission:

| | trades | win rate | needs to break even | profit factor | payoff | net, 4 contracts |
|---|---|---|---|---|---|---|
| **S&P 500** | 217 | 62.04% | 63.25% | 0.95 | 0.58 | **−$927.92** |
| **Nasdaq 100** | 200 | 62.00% | 63.19% | 0.95 | 0.58 | **−$1,256.85** |
| **gold** | 164 | 51.22% | 54.45% | 0.88 | 0.84 | **−$1,244.28** |

| | stop on close | stop on touch | with $1.10/contract/side and 1 tick of slip |
|---|---|---|---|
| S&P 500 | −$927.92 | −$685.38 | **−$3,057.52** |
| Nasdaq 100 | −$1,256.85 | −$1,655.66 | **−$3,094.85** |
| gold | −$1,244.28 | −$895.28 | **−$2,767.48** |

What these say, in order of how much they matter:

- **The rule is right about six times in ten and still loses**, because the target
  sits close and the stop sits far: break-even is 63.25% and 63.19% on the two
  indices, and it delivered 62%. On 200 trades that one point is the whole result.
- **It is the same shape on every instrument** — profit factor 0.88 to 0.96, never
  above 1, over ten years each. This is not one unlucky sample or one bad instrument;
  it is what the exit geometry does.
- **Where the trades end:** on the S&P, 108 hit the target, 44 the stop, and 65 ran
  out at the 15:00 bell. On gold it is 47 / 20 / **97** — gold mostly never reaches
  the previous 1h high inside a session, so two thirds of gold trades are the clock
  closing them, not the thesis.
- **Long and short are inconsistent between instruments** (S&P long 0.73 against
  gold long 1.69). A side that flips like that is noise, and there is no side to
  lean on.
- **Commission is the largest single term.** $1.10 a side × 4 contracts × 2 = $8.80 a
  trade, about $1,900 over 217 trades. It does not turn a losing rule into a winning
  one; the payoff has to move, not the broker.

Read the same way as everything else here: this is what these rules did on these bars,
with that stop and that session exit. It is not a prediction. Two limits worth saying
out loud — the files stop in September 2023, so none of this is recent, and the volume
column in them is a broker's tick count (unused by these rules).

### The exits, tested — none of them fixes it

Same entries, still one entry per session, four ways to place the exit, on the S&P
bars above:

| exit | trades | win rate | needs to break even | profit factor | net, 4 MES |
|---|---|---|---|---|---|
| **the rule** — 1h high, stop at the 1h higher low | 217 | 62.04% | 63.25% | 0.95 | **−$927.92** |
| target 2R | 219 | 49.54% | 51.70% | 0.92 | −$2,032.94 |
| target 3R | 219 | 49.54% | 50.68% | 0.96 | −$1,094.12 |
| stop at the 15m swing | 215 | 58.41% | 62.35% | 0.85 | −$2,992.38 |
| 15m swing stop + 2R target | 217 | 46.30% | 52.59% | 0.78 | −$5,958.84 |

`--target-r <n>` and `--stop-swing` exist to measure this, not as recommendations. The
rule's own defaults are unchanged by them.

None of them fixes it. And the part that settles it: a 2R target makes the **Nasdaq
+$694.61** (factor 1.02) and **gold +$765.20** (factor 1.07) — while making the S&P
worse. A change that helps two instruments and hurts the third is not an improvement,
it is the sample talking. With ~200 trades and factors sitting on 1.0, that spread is
what noise looks like.

### Sessions, the 15m stop, and the drastic-move filter — what survived

One entry per session, the rule's own 1h stop, no costs, on the same bars. Three
windows on the Chicago clock: Asia 18:00–02:00 (crossing midnight, so its session key
rolls back a day), London 02:00–08:30, New York 08:30–15:00.

| session | S&P win rate | S&P | Nasdaq | gold |
|---|---|---|---|---|
| **London** | 59.42% | **+$1,725.84** | **+$3,100.06** | **+$1,432.44** |
| Asia | 47.64% | +$1,044.88 | +$37.74 | +$1,131.80 |
| New York | 62.04% | −$927.92 | — | — |

London is the only window positive on all three, and it is the one that buys the
highest win rate per unit of payoff. New York — the one the rules were written for —
is the worst of the three on the S&P.

**The 15m higher-low stop is worse, in every session.** S&P, gross: Asia +$659.64,
London +$77.72, New York −$2,992.38. Each is worse than the 1h higher-low stop in the
same session — by $385, $1,648 and $2,064. A closer stop risks less per trade and pays
for it in winners that get scratched before the target.

**The drastic-move filter is worse too.** Trigger bar at least 1.5x the median range
of the 50 bars before it: Asia collapses to 20 trades and −$149.66; London falls to
−$372.26 from +$1,725.84; New York −$2,464.62. The big trigger bars are the ones that
have already run — the filter keeps the chase and discards the quiet reclaims that
paid.

**Costs decide whether any of it is real.** London, same trades, two commission levels:

| | gross | $1.10/side, 1 tick slip | $0.35/side, 1 tick slip |
|---|---|---|---|
| S&P | +$1,725.84 | −$942.96 (factor 0.93) | +$713.04 (1.05) |
| Nasdaq | +$3,100.06 | +$548.86 (1.03) | +$2,222.86 (1.11) |
| gold | +$1,432.44 | −$532.36 (0.96) | +$703.64 (1.05) |

Asia at $1.10/side is negative on all three (−$925, −$1,996, −$1,299), so it does not
survive at all. Contract size does not rescue this: fees scale with contracts exactly
as the gross does, so four micros and one micro lose the same share to commission. The
only levers are the commission per side and the number of trades.

One warning, and it is the important one: London is the survivor of about twenty
combinations tried here. It agreeing in sign across three instruments is the only
reason it is not dismissed as the best of many tries — that, and nothing else. And the
S&P "London" window is a cash-index CFD that quotes around the clock; CME futures are
much thinner there, which these files cannot show.

### The 08:00 and 14:00 candle, swept and traded back

```bash
node strategy-one.js --rule sweep --data data/real/XAU-15m.csv --instrument MGC --retest 30 --commission 0.35
```

`lib/sweep.js`, tested by `test/sweep.test.js`. The rule in the words it was given:
the 08:00 and 14:00 **Central** candle, then the hour after it. Price leaves the
candle, then closes back inside by the retest depth — **30, 50 or 70 per cent of the
candle's range**, measured from the edge that was swept. That close is the signal, the
next open is the fill, the target is the **candle's close**, and the stop is behind the
sweep's extreme. The high swept is a short, the low a long. Flat at the end of the
action hour either way.

| retest 30% | trades | win rate | profit factor | net, 4 × | long | short | exits target/stop/hour |
|---|---|---|---|---|---|---|---|
| **S&P 500** | 135 | 52.6% | 0.78 | **−$1,256** | −$1,204 | −$52 | 54/23/58 |
| **Nasdaq 100** | 134 | 50.7% | 0.85 | **−$1,597** | −$2,155 | +$558 | 56/22/56 |
| **gold** | 168 | 61.3% | 1.46 | **+$1,810** | +$1,258 | +$552 | 73/15/80 |

| retest | S&P net | Nasdaq net | gold net |
|---|---|---|---|
| 30% | −$1,256 (135) | −$1,597 (134) | **+$1,810** (168) |
| 50% | −$277 (36) | +$627 (33) | +$504 (41) |
| 70% | +$217 (3) | −$46 (3) | −$101 (2) |

**The 50% and 70% settings barely trade.** 33–41 trades in eight to ten years, and
2–3 at 70%. Those are not results, they are anecdotes. Only the 30% setting has a
sample, and on it the two indices lose while gold wins.

**The 2pm candle is untested on the indices, and the reason is the data.** US cash
indexes close at 15:00 Central — 16:00 New York — so the hour that follows the 14:00
candle has no bars. On the S&P that is **2,183 days skipped for exactly that reason**,
and only 3 trades ever come from the 14:00 candle; on the Nasdaq, 1. Gold quotes past
it, and 49 of its 168 trades are 14:00. Futures trade through 16:00 New York, so the
afternoon half of the rule exists on MES/MNQ/MGC and these files cannot show it. That
half is genuinely unmeasured, not rejected.

**Costs.** Same trades, three commission levels, per contract per side:

| retest 30% | gross | $0.35/side | $1.10/side |
|---|---|---|---|
| S&P 500 | −$1,256 | −$1,634 | −$2,444 |
| Nasdaq 100 | −$1,597 | −$1,972 | −$2,776 |
| gold | **+$1,810** | +$1,340 | +$332 |

Gold is the only one that stays positive at a dollar ten, and it is the only one with a
shape worth looking at: 61.3% wins against the 52.0% it needs, profit factor 1.46,
0.92 payoff, worst drawdown $593 on four contracts. Its edge is thin all the same —
**0.09 R per trade**, because most of the time the candle's close is not reached inside
the hour: 80 of its 168 trades are closed by the clock, not by the target.

**One number that undercuts all of it.** The stop convention, nothing else, moves the
indices by more than the result: with the stop filled where it sits instead of on a
close through it, the S&P goes −$1,256 to −$1,170 and the Nasdaq −$1,597 to **+$348**.
That is a $1,945 swing from how a resting order fills, on 134 trades. A rule whose
answer depends on that is not telling you anything yet.

### The same rule on 1h and 5m bars

The candle is a clock, not a bar size, so the rule should mean the same thing on any
chart that divides an hour. Two things had to be said out loud to test it:

- **On 1h bars the anchor is one bar and so is the hour after it**, which leaves a
  reclaim nowhere to fill. A single-bar action hour therefore earns the hour after it:
  the 09:00 reclaim fills at the 10:00 open and runs to the end of the 10:00 hour. 15m
  and 5m charts need no such allowance — they have four and twelve bars to fill in.
- **1h bars are built from the 15m files** with `--resample 1h`, so it is the same
  candle read coarser, not a different market.

```bash
node strategy-one.js --rule sweep --data data/real/NDX-15m.csv --resample 1h \
  --instrument MNQ --retest 30 --commission 0.35
```

Net dollars at four contracts, $0.35 per side, retest 30%, same bars throughout —
trades in brackets:

| instrument | 15m | 1h |
|---|---|---|
| **S&P 500** (MES) | −$1,634 (135) | −$928 (94) |
| **Nasdaq 100** (MNQ) | −$1,972 (134) | **+$4,143** (67) |
| **gold** (MGC) | **+$1,340** (168) | −$313 (81) |

| retest | MES 1h | MNQ 1h | MGC 1h |
|---|---|---|---|
| 30% | −$928 (94) | **+$4,143** (67) | −$313 (81) |
| 50% | −$745 (23) | −$414 (20) | +$391 (14) |
| 70% | −$70 (2) | −$94 (2) | +$20 (3) |

**The timeframe flips the answer, and that is the finding.** Gold is the only winner on
15m and a loser on 1h; the Nasdaq is the mirror image of that. A rule whose sign depends
on how finely the same two hours are cut is not showing an edge in either cut.

The 1h Nasdaq number is the best in the folder and the one to trust least: 67 trades in
ten years, profit factor 2.28, 25 exits on the target, 3 on the stop and 39 by the
clock. It is one instrument at one depth out of eighteen combinations measured across
the two charts, which is exactly how a good-looking accident arrives. Its longs
(+$1,878) and shorts (+$2,265) both make money, which is better than a one-sided fluke,
and it is still 67 trades.

The 1h run also loses the whole afternoon: the hour after the 14:00 action hour is
missing on the cash index files **2,025 days**, so every 1h trade comes from the 08:00
candle.

### 5-minute bars — pulled, and they change the answer

The Yahoo feed refuses this machine (HTTP 429, limited per IP) and caps 5m history at 60
days anyway. **HistData** needs no key and no account: one zip per calendar year of
1-minute bars, posted from a token on the page. Eight years were pulled per instrument
(2016–2023), the 1-minute bars folded into 5m candles, and the result read through the
folder's own loader.

Two things about that source are load-bearing: the stamps are **Eastern Standard Time
all year, no daylight saving** (add five hours for true UTC, in January and July alike),
and twelve 1-minute bars make one 5m bar. The files are
`data/real/US500-5m.csv`, `NDX-5m.csv`, `XAU-5m.csv` — 533,886 / 542,640 / 557,475 bars.
They are the same family of CFD feed as the 15m files (SPXUSD, NSXUSD, XAUUSD), not CME
futures.

**5m, 2016–2023, four contracts, $0.35 a side:**

| retest | S&P (MES) | Nasdaq (MNQ) | gold (MGC) |
|---|---|---|---|
| 30% | +$30 (330) | **+$5,270** (314) | −$1,589 (327) |
| 50% | +$107 (99) | +$1,903 (90) | −$945 (80) |
| 70% | +$135 (17) | +$414 (8) | −$344 (16) |

**The control that matters: same feed, three chart sizes.** Folding the 5m file up to
15m and 1h holds the prices identical and changes only the chart, which separates "the
timeframe" from "the feed" — something the vendor-mixed table above cannot do:

| retest 30% | 5m | 15m | 1h |
|---|---|---|---|
| S&P (MES) | +$30 (330) | −$12 (161) | −$1,824 (72) |
| **Nasdaq (MNQ)** | **+$5,270** (314) | **+$6,440** (148) | **+$4,881** (77) |
| gold (MGC) | −$1,589 (327) | +$997 (198) | −$415 (109) |

**On one feed the Nasdaq holds its sign at every chart size** — the first result in this
folder that does. 314 trades at 5m, 148 at 15m, 77 at 1h, all positive, both sides
(long +$2,666 and short +$2,604 on 5m), 61.5% wins against the 53.9% it needs on 5m,
profit factor 1.33, worst drawdown $3,049. It also survives a dollar ten a side:
**+$3,386**. At 50% it stays positive on all three sizes too (+$1,903 / +$1,014 / +$158).

Gold flips sign between 5m and 15m on identical prices. The S&P is flat at 5m and loses
$1,824 at 1h. Whatever the Nasdaq has, the other two do not have it.

**And here is what undercuts all of it.** The 15m file from the *other* vendor — same
instrument, same years, same rule, 30% — loses **−$1,949** on 99 trades. Two feeds for
the same index disagree by $7,400 over eight years. Either the Nasdaq result is real, or
it is a property of this vendor's prices and session coverage, and nothing in this
folder can tell those apart. The 5m Nasdaq is **0.06 R a trade** — thin enough that a
different feed's fills could erase it. That is the test to run next, not another
setting.

### A third vendor — and the Nasdaq does not survive it

The Yahoo endpoint refuses this machine (HTTP 429), so it was read through `r.jina.ai`,
which fetches from its own address. That is **real CME futures** — `ES=F`, `NQ=F`, `GC=F`
— not a CFD, and a different vendor from both other files. Two windows: 5-minute for 60
days, and 1-hour for two years (June 2024 → October 2026). Files are
`data/real/{ES,NQ,GC}-{5m,1h}-yahoo.csv`.

One data note, because it produced a wrong answer first: the hourly series carries a
handful of half-hour bars, which makes the folder read it as a 30-minute file and demand
two bars per candle — every candle was then refused and the run took **zero trades over
two years**. Folding the series back onto clean hours fixed it. That was the feed's shape,
not the rule's verdict.

| 30% retest, four contracts, $0.35 a side | 5m, 60 days | 1h, 2 years |
|---|---|---|
| S&P (MES) | −$397 (6) | +$1,142 (19) |
| Nasdaq (MNQ) | −$777 (6) | −$25 (9) |
| gold (MGC) | −$722 (8) | +$5,829 (21) |

| 30% retest | HistData 5m 2016–23 | HistData 1h 2016–23 | Yahoo 1h 2024–26 |
|---|---|---|---|
| S&P | +$30 (330) | −$1,824 (72) | +$1,142 (19) |
| Nasdaq | **+$5,270** (314) | **+$4,881** (77) | **−$25** (9) |
| gold | −$1,589 (327) | −$415 (109) | +$5,829 (21) |

**Nothing holds its sign across all three.** The Nasdaq — the one result that looked real —
is flat on the third vendor: −$25 over two years on nine trades, profit factor 0.99. Gold's
+$5,829 is 21 trades carried by a few big winners (42.9% win rate, profit factor 3.98), and
the S&P's +$1,142 is 19 trades. Those are not confirmations; they are the same kind of
small sample that made the Nasdaq look good to begin with.

Six to twenty-one trades cannot prove anything, and the third window is a different period
as well as a different feed, so this is not a clean replication test. What it does show is
that the best-looking result in the folder does not survive a change of vendor *and*
period together — which is the definition of not yet tradeable.

**Verdict: no edge here worth funding.** Three vendors, three chart sizes, three retest
depths and three instruments, and no combination keeps its sign once the data changes.

### A fixed 1:1 target — more trades, thinner edge

`--target-r 1` takes the stop the rule sets and puts the target the same distance the
other way instead of at the anchor candle's close. Same entries, same stops, different
exit — and a sample four to eight times bigger.

Eight years, four contracts, 30% retest, $0.35 a side, trades in brackets:

| | 5m | 15m | 1h |
|---|---|---|---|
| S&P (MES) | +$1,247 (1,343) | +$3,972 (832) | −$809 (412) |
| Nasdaq (MNQ) | +$6,428 (1,297) | **+$19,333** (772) | +$820 (373) |
| gold (MGC) | −$4,593 (1,225) | −$1,040 (814) | −$218 (481) |

Win rates land at **48–50% on almost every row**, which is exactly what a 1:1 target does:
it turns the rule into a coin flip with a large fee bill. Profit factor is 0.88 to 1.09 on
every cell except the Nasdaq's 15m 1.33 — a hair either side of break-even, which is the
signature of no edge rather than a small one.

**Fees decide it, and the trade count makes them bite harder.** At $1.10 a side the same
5m rows read S&P −$6,811, Nasdaq −$1,354, gold −$11,943. The S&P's 1,343 trades pay $3,760
in commission against a net of $1,247: the gross was around $5,000 and three quarters of it
went to the broker.

**Third vendor (Yahoo futures), 1h, two years:** S&P +$6,627 (85 trades), Nasdaq +$13,592
(90), gold +$6,928 (87), profit factors 1.56–1.91. That is the exact mirror of the
candle-close test on the same vendor, where this feed was the one that killed the Nasdaq.
Same rule, two periods, opposite verdicts — which is what noise looks like when the exit
changes.

So: **30% retest, gold only, and only as something to paper trade.** The indices reject
it, the deeper retests have no sample, and the 2pm half has never been tested at all.

### Longs against shorts

The same 1:1 run, split by side. Eight years, four contracts, 30% retest, $0.35 a side,
trades in brackets:

| | 5m long | 5m short | 15m long | 15m short | 1h long | 1h short |
|---|---|---|---|---|---|---|
| S&P (MES) | −$817 (651) | **+$2,064** (692) | **+$2,549** (404) | −$1,146 (322) | **+$3,520** (203) | −$4,329 (209) |
| Nasdaq (MNQ) | −$842 (635) | **+$7,270** (662) | +$1,287 (374) | **+$3,631** (307) | **+$1,745** (171) | −$926 (202) |
| gold (MGC) | −$2,949 (626) | −$1,644 (599) | −$2,896 (410) | **+$2,251** (351) | −$1,561 (262) | **+$1,343** (219) |

Summed across those nine rows, **longs made $36 and shorts made $8,514** — but adding
rows that share the same days is not a result, only a direction. The direction is: on the
fast charts the **short** side carries it (shorts positive on four of six intraday rows,
longs on one), and on the 1h it inverts — longs positive on both indices, shorts negative
on two of three. Win rates follow the same split: MES 1h long wins **56.7%** at 1:1 while
MES 1h short wins 43.5%, which is a lot of asymmetry for one rule.

**Checked against the third vendor.** The Yahoo hourly files still carried their half-hour
bars, so they were folded onto clean hours again before the run — two years, CME futures,
1h, same 1:1 target:

| 1h, 2024–26 | long | short |
|---|---|---|
| S&P (MES) | **+$3,777** (44), 65.9% | +$2,850 (41), 48.8% |
| Nasdaq (MNQ) | **+$11,784** (50), 62.0% | +$1,808 (40), 47.5% |
| gold (MGC) | +$1,630 (58), 46.6% | **+$5,299** (29), 58.6% |

Longs +$17,190, shorts +$9,957 — both sides positive on the recent window, which flatly
contradicts the eight-year intraday rows where longs were the losing half.

**The one thing that agrees across both feeds and both periods** is the 1h index long:
MES and MNQ, long side only, positive on 2016–23 CFD prices and on 2024–26 futures prices.
Gold short at 1h also agrees (+$1,343 and +$5,299). That is two cells, and it is more
than anything else in this folder has managed — but the recent window is 44, 50 and 29
trades, and the earlier lesson was that a single good cell dies on the next feed.

**Why the dollar column and the R column disagree, and which to believe.** The Nasdaq's
5m short made **+$7,270 on 3.5 R over 662 trades** — a third of a stop unit per trade is
no edge, so that money came from a couple of wide-stop winners, not from the rule. The
same mismatch sits on S&P 15m long (**+$2,549 on 0.1 R**). Where the two columns agree the
row means something; where they do not, the dollars are position-size luck. The 1h index
longs agree on both columns and both feeds — MES +$3,520 / +14.2 R and +$3,777 / +7.6 R,
MNQ +$1,745 / +11.6 R and +$11,784 / +9.1 R — which is the only reason to look at them at
all.

Split a run yourself with `--long-only` or `--short-only`, or read the two columns the
report already prints.

### Which hour to anchor on — every hour tested

The rule picks 08:00 and 14:00 Central. There is no reason those two are special, so the
anchor was moved to **every hour from 06:00 to 16:00**, on all three timeframes and all
three instruments — 99 cells per target, eight years of bars. Best hours against the
rule's own two, candle-close target, $0.35 a side, four contracts:

| | best hour | 08:00 | 14:00 |
|---|---|---|---|
| S&P 5m | **07:00 +$3,765** (186, 61.1%) | −$588 (201) | +$618 (129) |
| S&P 15m | **06:00 +$3,050** (152) | −$1,637 (132) | 3 trades |
| S&P 1h | **12:00 +$4,025** (55, PF 2.24) | −$1,423 (41) | −$400 (31) |
| Nasdaq 5m | **07:00 +$5,633** (198, 61.8%) | +$4,669 (192) | +$600 (122) |
| Nasdaq 15m | **07:00 +$6,281** (123, PF 2.22) | −$1,965 (133) | 1 trade |
| Nasdaq 1h | **12:00 +$5,982** (58, PF 2.33) | +$4,984 (43) | −$104 (34) |
| gold 5m | **09:00 +$1,538** (153) | −$1,124 (188) | −$465 (139) |
| gold 15m | 08:00 +$1,067 (119) | +$1,067 (119) | +$273 (49) |
| gold 1h | **07:00 +$1,077** (40) | −$395 (78) | −$21 (31) |

**The one thing that survives both targets is that 14:00 is the weakest hour of the
eleven.** At the candle-close target it is negative or bottom-two on both 1h indices; at
1:1 it is **net negative on seven of nine rows** (S&P 5m −$978, Nasdaq 1h −$1,490, gold
5m −$2,512, gold 15m −$966, gold 1h −$707), while being positive on only two. The morning
candle is the better one of his pair, and the afternoon one has been losing money in this
rule all along.

At 1:1 the morning hours move around again: **12:00 is the best hour at 1h on both
indices** (S&P +$6,154 on 282 trades, PF 1.37; Nasdaq +$5,858 on 284, PF 1.23), 08:00 is
strongest on the 5m indices, 06:00 and 10:00 on the 15m ones. Eleven anchors on nine
combinations is a wide net, and the expected best of 99 coin-flip cells is a large number,
so any single winner here is a curve fit until a second feed agrees.

**No second feed agrees.** Same eleven hours on the futures data, 1:1:

| hour | S&P | Nasdaq | gold |
|---|---|---|---|
| **08:00** | **+$6,630** | **+$13,592** | **+$6,719** |
| 07:00 | +$901 | −$4,828 | −$1,673 |
| 06:00 | +$2,994 | +$13,716 | −$5,731 |
| 12:00 | −$3,052 | −$7,108 | −$27 |
| 13:00 | +$753 | +$2,594 | −$919 |

**12:00 is the best hour on the eight-year file and worse than nothing on every instrument
in the recent one. 07:00 leads the eight-year close-target table and loses on Nasdaq and
gold.** The hour that wins everywhere in 2024–26 is the 08:00 the rule already uses, which
was mid-pack to poor on the older file. The ranking does not carry across a change of feed
and period, so it is not measuring the market — it is measuring which slice of noise each
file happens to contain.

Two limits worth stating: the futures series **has no bars past 13:00 Central**, so 14:00
and later could not be tested there at all — that is missing data, not a verdict. And the
1h rows rest on 40–78 trades, which is the same sample size that has misled this folder
before.

### The retrace entry — a limit at 30, 50 or 70

The two candles, named on the New York clock: **09:00 and 15:00 Eastern**, which are
08:00 and 14:00 Central. Same anchors as the sweep rule, and every trade from it is now
labelled `kind: 'scalp'` — one candle, one hour to work in, flat at the end of it.

The change is the fill. `--fill sweep` is the rule as written: price closes back inside
the candle and the fill is the next bar's open. `--fill fib` puts a **resting limit at
30, 50 or 70 per cent of the candle's range**, counted in from the edge that was swept,
and fills when price comes back to it — no close required. `--fill both` tries the
retrace and falls back to the sweep entry when price never comes back.

```
node strategy-one.js --data data/real/US500-15m.csv --instrument MES --commission 0.35 \
  --fill fib --fib 30
```

Stop is still the wick behind the sweep, target is still the candle's close. The bar that
takes the edge is never the fill bar — the trade is the come back — and because the fill
happens inside a bar, the walk to the exit starts on the next one.

**Eight years, four contracts, $0.35 a side, trades in brackets — 15-minute:**

| | 30% | 50% | 70% |
|---|---|---|---|
| S&P (MES) | −$3,565 (329) | −$4,880 (102) | −$990 (19) |
| Nasdaq (MNQ) | −$750 (308) | −$2,802 (93) | −$251 (11) |
| gold (MGC) | **+$3,433** (385, PF 1.35) | +$782 (90) | −$543 (20) |

**The same on 5-minute:**

| | 30% | 50% | 70% |
|---|---|---|---|
| S&P (MES) | −$43 (674, 60.2%) | −$1,609 (247) | −$292 (46) |
| Nasdaq (MNQ) | −$718 (679) | **+$3,154** (237, PF 1.25) | −$359 (50) |
| gold (MGC) | +$1,073 (623, 59.6%) | −$1,817 (171) | −$476 (36) |

**Win rates jump and the money does not.** A limit fill beats the next open, so the 5m
30% rows win 57–60% of the time — and two of the three still lose money, because the win
is the distance from the retrace level to the candle close and the loss is the whole wick
behind the sweep. Winning more often than you lose is not the same as making money.

**70% is not a level, it is a leftover.** It takes 6–50 trades everywhere and is negative
at 15 minutes on all three instruments. A depth that deep is reached only when the candle
already gave most of its range back, which is the case where the trade back to the close
has almost nothing left to travel.

**And the two columns disagree again.** MNQ 5m 50% made **+$3,154 on +0.5 R across 237
trades**, and MES 5m 30% made −$43 on **+56.3 R**. When the dollars and the R column point
different ways, the dollars are position size, not the rule.

**Fees decide the 30% rows.** 674 trades at four contracts is $1,887 in commission at
$0.35 a side. The MES 5m 30% row's −$43 net is a +$1,844 gross; at $1.10 a side the same
row is **−$4,087**, the Nasdaq's −$4,792, gold's −$2,665. The retrace entry trades about as
often as the sweep entry at the same depth, so it inherits the same fee problem.

**2024–26 futures, 1-hour** (the clean hourly files):

| | 30% | 50% | 70% |
|---|---|---|---|
| S&P (MES) | −$244 (70) | +$3,946 (31, 71.0%) | +$1,203 (16) |
| Nasdaq (MNQ) | −$3,164 (72) | +$428 (29) | +$3,621 (6) |
| gold (MGC) | −$2,866 (76) | +$1,825 (26) | +$125 (9) |

**It inverts.** On the eight-year file 30% is the best depth and 50% is the worst of the
three; on the recent file 30% is negative on all three instruments and 50% is positive on
all three. Both cannot be the rule. The recent 70% Nasdaq row is **six trades** — that is
not a result, it is an anecdote with a dollar sign on it.

**Side split, eight years, 30% retrace:** gold is the only instrument positive on both
sides (15m long +$2,235 / short +$1,199; 5m long +$1,533 / short −$460). The S&P is
negative on both sides at 15m, and the Nasdaq's 15m short (+$1,696) is its only positive
half.

**The recent 5-minute feed has 10–16 trades per cell** (seven weeks of data), so it can
only be read as a warning: every 30% row there is negative, gold included. A ~$400–$2,600
loss over 16 trades is noise, but it is not the +$3,433 the old file promised either.

**Verdict: the retrace entry is not better than the sweep entry, it is the same rule with
a different fill.** It wins more often, loses the same amount when it loses, and does not
hold its best depth from one period to the next. 30% on gold at 15m is the only cell that
looks like something, and it is one cell out of eighteen on the old file and negative on
the new one.

### What a tick is worth — built

`lib/contracts.js`, tested by `test/contracts.test.js`. Three instruments, and the
dollars are worked out from multiplier x tick size rather than typed twice:

| | instrument | a point is | a tick is | 4 contracts, 1 tick | 4 contracts, 1 point |
|---|---|---|---|---|---|
| **MGC** | Micro Gold, 10 oz | $10 | 0.10 → **$1.00** | **$4.00** | **$40.00** |
| **MNQ** | Micro Nasdaq-100 | $2 | 0.25 → **$0.50** | **$2.00** | **$8.00** |
| **MES** | Micro S&P 500 | $5 | 0.25 → **$1.25** | **$5.00** | **$20.00** |

So one tick against all twelve contracts at once is $11: four on gold, two on the
Nasdaq, five on the S&P. That is the number a stop has to be measured against,
because it is what each tick of adverse movement actually costs.

Also in there: the nearest tradable price (`roundToTick`), how many ticks a move is
(`ticksBetween`), notional exposure (`notional`, reported as exposure and never as
cash paid), and signed profit and loss for a round trip (`pnl`).

```js
const { spec, pnl, tickValue } = require('./lib/contracts');
const mes = spec('MES');
tickValue(mes);              // 1.25
pnl(mes, 5000, 4999, 4);     // -20, four contracts, a point against you
```

**Deliberately not in there:** margin and commission. Both are the broker's numbers
and both change; a constant in a file is wrong within a quarter and nobody
re-checks it. They get passed in when paper trading starts.

### Futures specifics still not built

- **Sessions and halts** in the data. `lib/session.js` now holds the New York
  window on Central time, daylights saving included, and strategy one trades inside
  it only — but the bar loader still does not skip the daily halt or tag a stale bar,
  so a run over a halt sees a fake bar.
- **Rollover.** MGC, MNQ and MES expire quarterly. A continuous series is stapled
  together from contracts that stop existing, so a backtest that runs across a roll
  trades a price that never existed. Until that is handled, a run has to stay inside
  one contract's life, and the report does not currently warn you when it does not.
- **Margin, from the broker.** Needed before a size can be called affordable.
