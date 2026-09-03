# Market Structure Bridge — your trading system

Daily bias → 4H bridge → 1H execution → 15m management. MNQ, MES, MGC.

Read them in this order.

**New here? → [GETTING-STARTED.md](GETTING-STARTED.md) is the click-by-click walkthrough.**

| File | What it is |
|---|---|
| **[GETTING-STARTED.md](GETTING-STARTED.md)** | Every click, in order — setup, alerts, and your first backtest |
| **[DAILY-USE.md](DAILY-USE.md)** | Already set up? The morning routine, what to do when an alert fires, and the phone workflow |
| **[PLAYBOOK.md](PLAYBOOK.md)** | The rules. Everything else just enforces this. Read it first. |
| **[YOUR-RULES.md](YOUR-RULES.md)** | The system built around how you actually behave. **The R:R fix lives here.** |
| **[PROP-FIRMS.md](PROP-FIRMS.md)** | The evaluation trap — trailing drawdown, the overtrading seduction, and the prop mode that beats both. |
| **[ninjatrader/MSBPure.cs](ninjatrader/MSBPure.cs)** | **The bot.** Runs inside NinjaTrader and places the orders itself. Backtests in one click, and it is the only path that can move a stop to break-even. |
| **[pine/MSB-Pure-Alerts.pine](pine/MSB-Pure-Alerts.pine)** | **The watcher.** Dashboard, chart labels, and the alert that carries the trade plan. |
| **[pine/MSB-Pure.pine](pine/MSB-Pure.pine)** | **The backtester.** Same rules as the watcher, run against history. |
| **[TURN ON AUTO.bat](TURN%20ON%20AUTO.bat)** + `relay/` | One button: starts the relay and the tunnel, opens the Bot switch page. Arm it and the bot places its own trades in NinjaTrader (Sim101 first). |
| **Trade Ledger** (link in DAILY-USE.md) | Dollars in, R out. Two bullets a day, three branches, moved-stop flags. |
| **Bot Decoder** (link in DAILY-USE.md) | Every word the two panels can print, in the order you read them. |

Plus a **`trade-checker` agent** — in this project, ask Claude *"grade this MNQ long, entry 20,450,
stop 20,410, daily's bullish"* and it reads the playbook and gives you a verdict. It will not
approve anything that fails a hard filter, and it will tell you what you forgot to check.

---

## Setting up TradingView (once, ~10 minutes)

1. Open a **1-hour chart** of `MNQ1!` (or MES1! / MGC1!). For scalp mode, use the **15-minute**.
2. **Pine Editor** at the bottom → **Open** → **New indicator** → delete the sample code.
3. Open `pine/MSB-Pure-Alerts.pine` in Notepad/TextEdit, copy **all** of it, paste it in.
4. **Save** (name it "MSB Pure") → **Add to chart**.
5. Do the same for `MSB-Pure.pine` as a **New strategy** if you want the backtest.

You'll see a dashboard top-right: the four timeframes with an arrow each, whether all four are
ALIGNED, which step of the retest sequence price is on, the session, and your bullets left. If
the Exec row shows a ⚠, the script is on the wrong chart timeframe for the mode it's in.

### Settings per instrument

Everything is adjustable in the indicator's settings gear. The only thing you must change
between instruments is the session:

| | Tradeable window | Prime hours (scores a point) |
|---|---|---|
| MNQ / MES | `0930-1500` | `0930-1130` |
| MGC | `0800-1300` | `0800-1200` |

Leave the rest at defaults until you've got 30 logged trades. Changing four settings at once
and then judging the result teaches you nothing.

### Alerts

Right-click the chart → **Add alert** → Condition: **Market Structure Bridge** → **Any alert()
function call** → set it to **Once per bar close** → Notify on your phone/email.

You get two kinds:
- *"Level reclaimed — waiting on the trigger"* — go look at the chart, get ready.
- The full setup alert — grade, SCALP/STANDARD/HOLD, entry, stop, T1, T2, room. This is the one you act on.

**The alert is not permission to click buy.** It's the trade, at its numbers, or a pass.

---

## Your actual workflow

```
  alert fires on your phone
        ↓
  open the 1H chart — does it match what the playbook describes?
        ↓
  autotrade ARMED → the bot has placed it, leave it alone
  autotrade OFF   → place the whole bracket at the alert's numbers
        ↓
  manage on the 15m — half at 1R, stop to break-even, runner to the HTF level
        ↓
  log the outcome in the ledger
```

### About NinjaTrader

Your NinjaTrader account connects directly to TradingView, so analysis and execution live on the
same screen: connect the broker in the **Trading Panel** at the bottom of the chart, and place the
order from the chart itself. No second platform, no retyping levels under time pressure.

**Place the whole bracket in one action — entry, stop and target together.** Never enter first and
"add the stop in a second." That second is exactly when price moves against you and a planned
loss becomes whatever you can stomach. The alert gives you all three numbers before you click.

**Autotrade is a switch, and it starts on Sim101.** Flip it on the Bot switch page and the relay
places the bracket itself; leave it off and you click. Either way the ledger is the judge.

If you eventually want real automation, the honest path is NinjaScript (C#) inside NinjaTrader,
ported from these same rules. **Don't do that yet** — automate after a few hundred manual trades
prove the edge, not before. An automated bad system just loses money faster and teaches you less.

### Your costs, and why they matter here

At **$0.39 per contract per side** you're paying about **$0.78 round turn**, so the backtester is
set to $0.39 in `commission_type = cash_per_contract` (Pine charges it on entry *and* exit).

One thing to check on your next statement: whether that $0.39 is the broker commission only, with
CME exchange and NFA fees billed separately. If so, raise the backtest number to the true all-in
figure. It sounds like pennies, but on MGC with a 3-point stop you're risking $30 a contract —
$0.78 of friction is 2.6% of your risk on every single trade, and that comes straight out of
expectancy. Cheap commissions are also how people talk themselves into overtrading; your daily
stop, not your commission rate, is what protects the account.

---

## What to do next — the ramp

Four stages. Do not skip one because the previous one looked good. You've traded two years
discretionarily; the thing being tested here isn't whether you can read structure, it's whether
you can follow a rule that says no when you want it to say yes.

### Stage 1 — Backtest (this week, ~2 hours)

Load `MSB-Pure.pine` as a strategy on MNQ 1H, two years of data. Then MES, then MGC with the `0800-1200`
session. For each one write down: **expectancy in R, max drawdown, number of trades, win rate.**

Look at expectancy and drawdown, never net profit. A system with 60 trades and +0.3R expectancy
is real; one with 6 trades and a big number is noise. If a symbol shows negative expectancy across
a decent sample, that symbol is off your list — that result just saved you a year of tuition.

### Stage 2 — Bar replay (1–2 weeks, 50 setups)

TradingView bar-replay, indicator on, grader open, no money. Log all 50 in the grader —
**including every one you reject.**

This stage exists for one reason: to retrain your eye so that step ⑤, the wait, feels like the
entry instead of step ②, the break. Two years of discretionary trading has built a reflex to act
on the break. Fifty repetitions is roughly what it takes to overwrite it.

### Stage 3 — Sim (30 trades, at your real size)

NinjaTrader sim, connected through TradingView exactly as you'll trade live. Real size, real
brackets, real session hours. You are testing your execution now, not the rules.

**The pass mark isn't profit — it's zero rule breaks across 30 trades.** If you took a trade the
grader rejected, you are not ready for stage 4 regardless of what the P&L says, because that's the
habit that will express itself at the worst possible moment.

### Stage 4 — Live, one contract, 30 trades

One contract. Not "one until I'm confident." Whatever the grader says, for thirty trades. Then
review expectancy by grade and by symbol before you touch the size.

**If your B-grades have negative expectancy over that sample, stop taking B-grades.** That single
finding is worth more than any amount of tweaking the indicator.

### Along the way

- Set the alerts once and then leave the charts alone. Screen-watching is what produces C-grades.
- Log the rejects. After 100 of them you'll know whether your C's genuinely lose, and that's the
  only honest basis for ever loosening a rule.
- Change nothing until stage 4 is done. One variable at a time, with a date written next to it.

If stages 1–3 look bad, that's the system working. A rule set rejected on paper saved you exactly
what it would have cost live.

### What the backtest will not tell you

Futures data on TradingView is a stitched continuous contract, so rollover gaps appear that were
never tradeable. Fills, partial fills, and fast-market slippage aren't modelled. Structure
confirms a few bars late by design, which is realistic — but treat backtest numbers as a way to
*reject* bad rules, never as a forecast of income.

---

## Why there is no context layer any more

There used to be one: VWAP and its 2σ bands, relative volume by hour, an ADX/efficiency-ratio
chop filter, yesterday's value area, a day-type classifier, a range budget, a correlation check.
Twelve filters on top of the sequence.

They are gone. Two reasons, and the second is the one that matters.

**The gate diagnostic.** With the stack switched on, roughly 800 completed sequences a year came
out the other side as about two trades. A filter set that rejects 99% of setups isn't selective,
it's broken — and the thing being rejected was your actual read of the market.

**They are readings about price, not price.** VWAP is an average, RVOL is a ratio of averages,
ADX is a smoothed average of smoothed averages. Every one of them is a number derived from the
chart and then treated as though it were evidence from the market. A swing high is not like that.
A swing high is a place where price actually turned — it happened, it is on the record, and it
needs no parameters to exist.

What replaces the twelve filters is the four-timeframe alignment rule, which does the same job
with things that are real: a market in a range cannot make higher highs and higher lows on four
timeframes at once, so chop fails the test by construction rather than by threshold.

**What was genuinely lost, and you should know it:** the news blackout lived in the old
indicator, and there is no replacement. Nothing in this system watches the calendar now. That box
in the grader is yours, every day — and on FOMC days it is the only thing standing between you
and a structurally perfect trade into a Fed statement.

## Built around you, not a hypothetical trader

| What you said | What the system does |
|---|---|
| "I'm impulsive" | **One trade per day**, enforced — the alert goes quiet after it fires |
| "New York intraday only" | Session-locked; nothing fires outside 09:30–15:00 ET |
| "I like to be right" | **First target at 1R**, hit often — you get to be right, early, in cash |
| "Emotionally tied to money" | Stop to break-even after 1R. The trade can no longer lose. |
| "Risking 3 to make 1" | Bracket placed at entry — stop and both targets, one action, never touched |
| "Scalp or hold?" | Measured at the trigger: room to the next HTF level decides, and the alert says which |

Risking 3 to make 1 needs a **75% win rate** just to break even. That — not your chart reading —
is what two years of flat performance is made of. [YOUR-RULES.md](YOUR-RULES.md) has the full
arithmetic and the fix.

## The honest limitations

- **The pivots confirm late.** A swing needs 3 bars to its right before it counts. That's the
  price of an objective rule instead of a hindsight one, and it means you will sometimes see a
  setup before the indicator does. Your eye is not more accurate than the rule; it's just faster
  and it also fires on the ones that fail.
- **The grade is a filter, not a prediction.** An A+ still loses plenty of the time. The grade
  is about whether the trade was *worth taking*, which is a different question from whether it won.
- **Two entries, very different frequencies.** The pullback fires far more often than the retest
  sequence. The dashboard counts them separately for exactly that reason — after 30+ trades, check
  whether both are actually paying, and switch one off if it isn't.
- **Nothing here knows about news, halts, or a Fed governor talking at 2pm.** That's your job.

None of this is financial advice — it's your own strategy written down as rules a computer can
check. Futures are leveraged and you can lose more than you put in.
