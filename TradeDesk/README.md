# TradeDesk

A sizing, journalling and review assistant for discretionary futures trading.

Open `index.html` in any browser, or double-click **Start TradeDesk** in the folder above.
No install, no server, no account.

## What it does

**Size** — you give it entry, stop and target; it gives you the contract count that keeps
the loss inside your risk budget. Uses real CME tick values, so a 5-point ES stop and a
5-point MES stop correctly come out ten times apart. Rounds *down*, always, and tells you
when it did.

**Journal** — one row per trade: entry, stop, exit, size, setup tag, whether you followed
your plan, and a note. R-multiples and dollar P&L are computed, net of commissions.

**Review** — expectancy in R, profit factor, win rate, equity curve, max drawdown, and
breakdowns by setup, by hour of day, and by contract. Plus two things a spreadsheet
won't tell you unprompted:

- *After a loss* — your expectancy on the trade immediately following a loser, versus
  following a winner. A gap here is revenge trading, and it is usually the largest
  single leak in a discretionary account.
- *Off-plan* — what your own rule-breaks actually cost you, in dollars.

**Guardrails** — today's P&L against your max daily loss, and today's trade count against
your max. Set them below your prop firm's hard limits, not equal to them.

## What it does not do

It does not connect to a broker, place orders, read live market data, or predict anything.
Nothing here can trip an automation rule at Topstep, Apex or TPT, because nothing here
touches your platform.

## Your data

Everything is stored in your browser's localStorage, on your machine only. Nothing is
uploaded. Clearing site data erases it — use **Export JSON** in Setup periodically, and
**Export CSV** if you want to slice it in a spreadsheet.

## Contract specs

ES, MES, NQ, MNQ, RTY, M2K, YM, MYM, CL, MCL, NG, GC, MGC, SI, ZB, ZN, ZF, 6E, 6J, MBT, MET.
Tick sizes and tick values are listed in Setup so you can check them against your broker.
Add more by editing the `CONTRACTS` object at the top of the script in `index.html`.

## Notes on the numbers

- **R** is measured against your *planned* stop, not where you actually got out. That's
  deliberate: it keeps the denominator honest when you cut early or let one run.
- **Expectancy** is net of commissions. Set your real round-turn rate in Setup — at a few
  dollars a turn it changes the picture materially on small stops.
- Under about 20 trades none of the statistics mean much, and the breakdowns need closer
  to 50 before a per-setup or per-hour edge is worth acting on.
