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
2. **Strategy one — futures, market structure on every timeframe.** In progress.
   The read is built and tested; the entry, exit, stop and size are still waiting
   on you.
3. **Strategy two** — the same treatment.
4. **Paper trading** against a real broker's sandbox. Alpaca is the pick for a
   personal bot: it is a real broker, its paper account is free, and the paper and
   live sides take the same code, so nothing gets rewritten to go live. Not built
   until the strategies exist and have earned it.
5. **Live guard rails** — kill switch, maximum daily loss, position and order caps,
   and a log of every order placed.
6. **Running it** — where it lives, how it stays up, and how it tells you it died.

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
it, step by step."* So the first step is the read itself, on its own, with nothing
trading on it yet. There is no entry rule, no exit rule and no size, so there is
nothing to backtest and no number to show you.

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
usually the wrong place.

### Still open, and I will not invent it

- **Which timeframes you actually trade** — the read is on all of them, the rules
  will not be.
- **Entry rule** — what has to be true to get in, and in which timeframe's terms.
- **Exit rule** — what gets you out.
- **Stop** — a price level, the last swing, or a percentage.
- **Size** — per trade, and how many at once.
- **Long only, or shorts too.** A market-structure read is directional, so this one
  matters more here than it would elsewhere.
- **What "it works" means to you** — how much, over how long, and how big a fall you
  could sit through without turning it off.

Anything you leave out, I will say I assumed rather than decide it quietly.

### Futures specifics not built yet

Said plainly so the roadmap does not read as more finished than it is. The engine
sizes in fractions of equity, which is not how futures work: a contract is a fixed
thing with a tick size, a tick value and a margin requirement. So before anything
touches paper money, this still needs **tick size and tick value**, **contract
multiplier**, **margin**, **commission per contract and per side**, **sessions and
halts**, and **rollover** — a continuous futures series is stapled together from
contracts that expire, and a backtest that ignores the roll trades a price that
never existed.
