# Tester results — running record

Kept here so every session can read it. Edit freely.

Symbol: MGC1! unless marked. Window: Last 365 days unless marked.
Correction frame = the lower timeframe the bot drops to.

**Sections 0–4 came off his TradingView screenshots.** Section 5 is different:
it is `trading/backtest.js` run on prices pulled into the repo, and it is the
only section with prices attached to it. Read section 5d before trusting 5a.

## 0. Jacques TBR Zones — the candle play — reported 1 Oct 2026

Read off his TradingView screenshots. Account 25K USD, slippage and commission
as in the script. **The Entry setting (Fib or Sweep) and the Fib level (30 / 50
/ 70) used for each run are NOT visible in the screenshots** — the code default
is Fib + 50. Ask before treating any row as tied to a setting.

| Chart | Frame | Window | P/L | Max drawdown | Profitable | PF |
|---|---|---|---|---|---|---|
| MGCZ2026 | 1h | Feb 6 2025 – Oct 1 2026 (Deep) | +2,953.40 (+11.81%) | 2,670.39 (10.62%) | 95.00% 19/20 | 77.158 |
| MGCZ2026 | 15m | Feb 6 2025 – Oct 1 2026 (Deep) | +4,405.44 (+17.62%) | 5,446.39 (21.62%) | 88.46% 46/52 | 10.34 |
| MGCZ2026 | 5m | Feb 6 2025 – Oct 1 2026 (Deep) | +2,105.34 (+8.42%) | 941.39 (3.60%) | 87.23% 41/47 | 22.121 |
| MNQZ2026 | 1h | Oct 1 2025 – Oct 1 2026 | +1,214.69 (+4.86%) | 2,722.89 (10.27%) | 92.86% 13/14 | 8.8 |
| MNQZ2026 | 15m | Oct 1 2025 – Oct 1 2026 | +3,713.82 (+14.86%) | 4,131.39 (15.48%) | 100.00% 31/31 | not shown |
| MNQZ2026 | 5m | Jun 14 2026 – Oct 1 2026 | +2,749.28 (+11.00%) | 2,583.89 (10.27%) | 89.80% 44/49 | 33.965 |

Every row is positive. The two short windows (MNQ 1h and 5m) are the least
real — 13 and 49 trades. The MGC rows run Deep Backtesting, so trades show in
the Strategy report only, not on the chart.

The MNQ 1h chart also shows the on-chart labels `short` and `out of range`,
which is what the entry and exit comments are supposed to print.

### Current build — box edges solid — reported 1 Oct 2026, 10:34 AM

| Chart | Frame | Window | P/L | Max drawdown | Profitable | PF |
|---|---|---|---|---|---|---|
| MGC1! | 1h | Last 365 days (Deep) | +5,924.24 (+23.70%) | 4,338.39 (15.88%) | 100.00% 42/42 | not shown |
| MNQ1! | 1h | Last 365 days (Deep) | +6,217.51 (+24.87%) | 2,941.89 (10.13%) | 97.78% 44/45 | 19.476 |
| MNQ1! | 15m | Last 365 days (Deep) | +12,611.92 (+50.45%) | 4,057.39 (11.55%) | 100.00% 111/111 | not shown |
| MGC1! | 15m | Last 365 days (Deep) | +2,588.26 (+10.35%) | 16,441.39 (65.69%) | 100.00% 33/33 | not shown |

Two things to hold against these rows before trusting them:

1. **The win rate is built into the exit rule, not earned.** A long is only closed
   when price closes back above the candle's high, and it was entered inside the
   range — so every closed long wins. Shorts mirror that. A trade that goes against
   him is never closed, so it never shows up as a loss. That is why MGC reports
   42 of 42 and no profit factor at all. Drawdown is the honest number in this table.
   MGC 15m is the proof: 33 of 33 winners and the account still went 65.69% under
   water at the worst point. That is open losing trades, not closed ones.
2. Entry setting (Fib or Sweep) and fib level are still not visible in the screenshots.

### Stop added — 1 Oct 2026, 10:45 AM — NOT YET RUN

A trade now also ends when price closes past the far side of its candle: a long
closes if price closes below the candle's low, a short if price closes above the
high. Before this, only the winning exit existed, so losing trades stayed open and
the win rate read 100%.

What the next run should show if the stop is working:

- win rate below 100%
- profit factor no longer blank
- MGC 15m max drawdown down from 65.69%

Nothing has been run with the stop yet — no numbers here until he reports them.

### Stop in — first run, reported 1 Oct 2026, 10:42 AM

Long window, both charts 1h, 25K, Deep:

| Chart | Window | P/L | Max drawdown | Profitable | PF |
|---|---|---|---|---|---|
| MGC1! | Jan 2 2023 – Oct 1 2026 | +894.12 (+3.58%) | 1,373.09 (5.04%) | 66.33% 130/196 | 1.118 |
| MNQ1! | Jan 2 2023 – Oct 1 2026 | −882.02 (−3.53%) | 4,635.45 (16.19%) | 63.11% 195/309 | 0.962 |

All three checks came true: win rate is off 100%, profit factor is a real number, and
the drawdown is a fraction of what it was (MGC 15m was 65.69% on the open-loss bug).
The numbers also kill the earlier read: over almost four years MGC is barely positive
and MNQ is slightly negative, before spread and slippage. The 100% win rates were the
open-loss bug, not edge. The bot is not yet good enough to trade as it stands.

On the MGC charts three indicators were loaded at once — `LuxAlgo DTFX Algo
Zones`, `Jacques Zones` and `Jacques TBR Zones`. Only `Jacques TBR Zones` is
the bot; the other two should come off before the next run.

**NOT confirmed which run is the TBR (Wang zones) bot.** The rows below are
everything that has been reported so far; the labels are what each set was
described as at the time. Correct them if they are wrong.

## 1. Earlier zone bot — stop OFF — Last 365 days

| Frame | P/L | Win rate | PF | Drawdown |
|---|---|---|---|---|
| 5m | +1,474.45 | +5.90% | 1.171 | 268 of 472 |
| 15m | +178.19 | +0.71% | 1.133 | 146 of 239 |
| 1h | +867.17 | +3.47% | 1.228 | 62 of 98 |
| 4h | +7,382.27 | +29.53% | 2.046 | 42 of 53 |

Drawdowns ran 27–32%. The March 2026 vertical drop was one trade with no stop.

## 2. Earlier zone bot — stop ON — Last 365 days

| Frame | P/L | Win rate | PF | Trades | Drawdown |
|---|---|---|---|---|---|
| 5m | +312.22 | +1.25% | 1.012 | 338 of 701 | 19.49% |
| 15m | +2,004.48 | +8.02% | 1.102 | 177 of 334 | 13.21% |
| 1h | +3,162.72 | +12.65% | 1.261 | 67 of 126 | 12.34% |
| 4h | +4,172.98 | +16.69% | 1.424 | 39 of 59 | 10.42% |

4hr figures are the least real — one decision per 4hr bar.

## 3. MNQ (bar-number drawing version)

| Frame | P/L | Win rate | PF |
|---|---|---|---|
| 5m | +4,496.34 | +17.99% | 1.427 |
| 15m | +2,614.90 | +10.46% | 1.288 |
| 1h | +5,465.56 | +21.86% | 2.207 |
| 4h | +4,141.13 | +16.56% | 2.095 |

## 4. Unresolved

MGC 5m, Jun 14 – Sep 30 2026: −858.65 / −3.43% but PF 3.007 with 40 winners
vs 27 losers, all trades closed. Never explained. Do not trust this window;
the 365-day figure above is the one to use.

## 5. Backtester — added 6 Oct 2026 — FIRST RUN ON REAL PRICES, 6 Oct 2026

`trading/backtest.js` tests the method itself: Fib 30 / 50 / 70 and Sweep,
with the zone filter and the 4h + daily alignment filter, one row per setting
(trades, wins, losses, win %, net, profit factor, per trade, worst dip).

### Where the prices came from

`trading/fetch-prices.js` (added 6 Oct 2026) pulls real bars from Yahoo
Finance's public chart endpoint — no key, no account — and writes the CSV the
backtester reads. Everything below is from that pull, run the same day:

| File | Symbol | Bars | Window |
|---|---|---|---|
| `trading/data/mgc-1h-730d.csv` | MGC=F (Micro Gold) | 13,737 | 14 May 2024 – 6 Oct 2026 |
| `trading/data/mgc-15m-60d.csv` | MGC=F | 4,525 | 28 Jul 2026 – 6 Oct 2026 |
| `trading/data/mgc-5m-60d.csv` | MGC=F | 13,547 | 28 Jul 2026 – 6 Oct 2026 |
| `trading/data/gc-1h-730d.csv` | GC=F (full-size Gold) | 13,736 | 14 May 2024 – 6 Oct 2026 |

Money is $10 a point (Micro Gold) and $1.18 a trade. The last close in the pull,
4,186, is within a few dollars of the 4,179.7 on his chart that day.

**These are the front-month continuous series, not contract MGCZ2026.** That
matters, and see the warning at the bottom of this section.

### 5a. Micro Gold, hourly, 2.4 years — the main run

No filters:

| Setting | Trades | Win | Loss | Win % | Net | PF | Per trade | Worst dip |
|---|---|---|---|---|---|---|---|---|
| fib 30 | 298 | 210 | 88 | 70.5% | −$1,595.65 | 0.92 | −$5.35 | −$3,303.24 |
| fib 50 | 326 | 190 | 136 | 58.3% | −$5,898.71 | 0.77 | −$18.09 | −$6,870.50 |
| fib 70 | 313 | 161 | 152 | 51.4% | −$5,535.36 | 0.78 | −$17.68 | −$6,266.97 |
| sweep | 265 | 124 | 141 | 46.8% | **+$1,798.32** | 1.11 | +$6.79 | −$2,025.16 |

Zone filter on (`--zones`):

| Setting | Trades | Win | Loss | Win % | Net | PF | Per trade | Worst dip |
|---|---|---|---|---|---|---|---|---|
| fib 30 | 58 | 45 | 13 | 77.6% | +$706.57 | 1.26 | +$12.18 | −$886.08 |
| fib 50 | 67 | 40 | 27 | 59.7% | −$3,081.04 | 0.53 | −$45.99 | −$3,861.26 |
| fib 70 | 72 | 39 | 33 | 54.2% | −$1,100.94 | 0.83 | −$15.29 | −$2,336.43 |
| sweep | 48 | 27 | 21 | 56.3% | **+$1,723.38** | 1.73 | +$35.90 | −$570.36 |

4h + daily alignment on (`--align`):

| Setting | Trades | Win | Loss | Win % | Net | PF | Per trade | Worst dip |
|---|---|---|---|---|---|---|---|---|
| fib 30 | 131 | 92 | 39 | 70.2% | +$52.40 | 1.01 | +$0.40 | −$1,876.34 |
| fib 50 | 137 | 79 | 58 | 57.7% | −$3,207.66 | 0.73 | −$23.41 | −$4,286.41 |
| fib 70 | 124 | 64 | 60 | 51.6% | −$3,371.33 | 0.69 | −$27.19 | −$3,545.54 |
| sweep | 111 | 49 | 62 | 44.1% | −$562.97 | 0.93 | −$5.07 | −$1,450.48 |

Zones + alignment:

| Setting | Trades | Win | Loss | Win % | Net | PF | Per trade | Worst dip |
|---|---|---|---|---|---|---|---|---|
| fib 30 | 28 | 22 | 6 | 78.6% | +$364.96 | 1.25 | +$13.03 | −$557.18 |
| fib 50 | 25 | 14 | 11 | 56.0% | −$2,615.50 | 0.28 | −$104.62 | −$3,059.87 |
| fib 70 | 25 | 12 | 13 | 48.0% | −$2,312.50 | 0.37 | −$92.50 | −$2,741.52 |
| sweep | 18 | 10 | 8 | 55.6% | +$752.77 | 1.69 | +$41.82 | −$582.07 |

What these say:

- **Sweep is the only setting that made money on the long run, and only just**
  — $6.79 a trade over 265 trades. Everything else lost.
- **The zone filter is the single best lever.** It cuts the trades to about a
  fifth and pushes sweep from $6.79 to $35.90 a trade, with the worst dip down
  from $2,025 to $570. Fewer trades, better ones.
- **The alignment filter hurt.** On its own it turns sweep negative and leaves
  fib 30 at break-even ($0.40 a trade is nothing). The 4h + daily rule as
  written here is not earning its keep.
- **Fib 30 wins 70.5% and still loses money.** That is not a bug, and the next
  table is why.

### 5b. Why the Fibonacci levels lose — measured, not guessed

The report prints net and PF, so the average win and the average loss follow
from them: `loss = net ÷ (PF − 1)`, `win = net + loss`. Split by the win count:

| Setting (hourly, no filter) | Avg win | Avg loss | Win ÷ loss |
|---|---|---|---|
| fib 30 | 8.7 points | 22.7 points | 0.39 |
| fib 50 | 10.4 points | 18.9 points | 0.55 |
| fib 70 | 12.2 points | 16.6 points | 0.74 |
| sweep | 14.6 points | 11.6 points | 1.26 |

A 30 / 50 / 70 label reads as if a long at the 70 level risks 0.3 of the range
to make 0.7. It does not, and that is the whole story: the entry is taken at
the **close of the bar that touched the level**, and that close can sit anywhere
between the level and the top of the candle. When price wicks down to the level
and closes back near the top — which is exactly the bar the rule is looking for
— the trade is bought near the top, so the risk is nearly the whole candle and
the reward is nearly nothing. That is where 8.7 against 22.7 comes from, and why
70.5% winners is still a losing run.

Sweep does not have this problem because it enters at the close that comes back
**inside** the candle, low down, with the top as the target. Its average win is
bigger than its average loss, and it is the only one that pays.

This is a real finding about the rule as coded, and it is fixable — enter at the
level with a resting order instead of at the bar's close. Not changed here:
that is a decision for Jacques, not a session.

### 5c. Faster timeframes — too short a window to mean anything

Yahoo only serves 60 days of anything under an hour, so these are small.

15m, 4,525 bars (28 Jul – 6 Oct 2026):

| Setting | Trades | Win % | Net | PF | Worst dip |
|---|---|---|---|---|---|
| fib 30 | 51 | 64.7% | −$1,314.19 | 0.65 | −$2,264.05 |
| fib 50 | 45 | 46.7% | −$1,445.13 | 0.65 | −$1,734.06 |
| fib 70 | 50 | 44.0% | −$799.03 | 0.81 | −$2,231.52 |
| sweep | 45 | 31.1% | +$328.90 | 1.14 | −$1,494.85 |

5m, 13,547 bars (same window) — **every setting lost**, sweep worst of all at
16.3% winners and −$811.81. With `--zones` no 15m or 5m setting reached 20
trades.

### 5d. The warning: the same market, the other contract, opposite answer

GC=F is full-size Gold — the same metal, the same hours, $100 a point instead
of $10. Run through the same backtester over the same window it gives:

| Setting | Trades | Win % | Net | PF |
|---|---|---|---|---|
| fib 30 | 294 | 72.1% | **+$25,972.44** | 1.16 |
| fib 50 | 322 | 59.6% | −$34,290.43 | 0.85 |
| fib 70 | 313 | 54.3% | −$6,169.83 | 0.97 |
| sweep | 284 | 48.2% | +$36,224.62 | 1.22 |

**Fib 30 loses $1,595 on Micro Gold and makes $25,972 on full-size Gold.** Same
rule, same window, same code — only the contract series differs. Tiny contract,
huge difference, so nothing in 5a should be treated as settled. Two reasons, and
both are about the data, not the method:

1. **The two Yahoo series are not the same prices.** They match on the median
   bar but Micro sits up to $62 above full-size at times, so the two are
   rolling on different dates. A roll is a jump the backtester cannot tell from
   a real move.
2. **Stitched contracts have seams.** 85 hourly bars in the full-size window see
the close move more than $60 in one hour, ten of them at the 18:00 New York
session open — roll dates. Some are real (29 Jan 2026 really did fall $312
close to close in the 10:00 New York hour, a $395 range, and it is in both
series), but a roll seam can open or close a trade that could never have
happened inside one contract.

**The fix is not another free feed. It is his own export.** A TradingView export
of MGCZ2026 itself, one contract, has no seams at all, and `trading/backtest.js`
reads that file as-is. Drop it in and re-run.

### How to re-run any of this

```
node trading/fetch-prices.js                       # refresh all four CSVs
node trading/backtest.js trading/data/mgc-1h-730d.csv
node trading/backtest.js trading/data/mgc-1h-730d.csv --zones
node trading/backtest.js trading/data/mgc-1h-730d.csv --align
node trading/backtest.js trading/data/mgc-1h-730d.csv --zones --align
node trading/backtest.js --selftest                # engine check, made-up bars
```

## Not written here

Not run from this machine — Pine cannot be compiled or tested here. Everything
above came from his own TradingView screenshots.
