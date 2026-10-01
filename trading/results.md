# Tester results — running record

Kept here so every session can read it. Edit freely.

Symbol: MGC1! unless marked. Window: Last 365 days unless marked.
Correction frame = the lower timeframe the bot drops to.

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

## Not written here

Not run from this machine — Pine cannot be compiled or tested here. Everything
above came from his own TradingView screenshots.
