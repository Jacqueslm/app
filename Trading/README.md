# Market Structure Bridge — your trading system

Daily bias → 4H bridge → 1H execution → 15m management. MNQ, MES, MGC.

Four pieces. Read them in this order.

**New here? → [GETTING-STARTED.md](GETTING-STARTED.md) is the click-by-click walkthrough.**

| File | What it is |
|---|---|
| **[GETTING-STARTED.md](GETTING-STARTED.md)** | Every click, in order — setup, alerts, and your first backtest |
| **[PLAYBOOK.md](PLAYBOOK.md)** | The rules. Everything else just enforces this. Read it first. |
| **[pine/MSB-Indicator.pine](pine/MSB-Indicator.pine)** | TradingView indicator — watches the charts, grades setups, alerts you |
| **[pine/MSB-Strategy.pine](pine/MSB-Strategy.pine)** | Backtester — check the rules against history before trusting them |
| **[trade-grader.html](trade-grader.html)** | Double-click it. Sizes the trade, refuses the bad ones, keeps your journal |

Plus a **`trade-checker` agent** — in this project, ask Claude *"grade this MNQ long, entry 20,450,
stop 20,410, daily's bullish"* and it reads the playbook and gives you a verdict. It will not
approve anything that fails a hard filter, and it will tell you what you forgot to check.

---

## Setting up TradingView (once, ~10 minutes)

1. Open a **1-hour chart** of `MNQ1!` (or MES1! / MGC1!).
2. **Pine Editor** at the bottom → **Open** → **New indicator** → delete the sample code.
3. Open `pine/MSB-Indicator.pine` in Notepad/TextEdit, copy **all** of it, paste it in.
4. **Save** (name it "Market Structure Bridge") → **Add to chart**.
5. Do the same for `MSB-Strategy.pine` as a **New strategy** if you want the backtest.

You'll see a dashboard top-right: Daily bias, 4H bridge, 1H structure, the chop reading, and
which step of the sequence price is currently on.

### Settings per instrument

Everything is adjustable in the indicator's settings gear. The only thing you must change
between instruments is the session:

| | Session window | Notes |
|---|---|---|
| MNQ / MES | `0930-1130` | Second window `1400-1530`, A+ only |
| MGC | `0800-1200` | London/NY overlap |

Leave the rest at defaults until you've got 30 logged trades. Changing four settings at once
and then judging the result teaches you nothing.

### Alerts

Right-click the chart → **Add alert** → Condition: **Market Structure Bridge** → **Any alert()
function call** → set it to **Once per bar close** → Notify on your phone/email.

You get two kinds:
- *"Level reclaimed — waiting on the trigger"* — go look at the chart, get ready.
- The full setup alert with grade, entry, stop, T1, and risk in points — this is the one you act on.

**The alert is not permission to click buy.** It's permission to open the grader.

---

## Your actual workflow

```
  alert fires on your phone
        ↓
  open the 1H chart — does it match what the playbook describes?
        ↓
  open trade-grader.html — tick the checklist honestly
        ↓
  REJECT → log it, close the laptop.  TAKE/HALF → it tells you your size
        ↓
  place the bracket from the TradingView chart (routed to NinjaTrader)
        ↓
  manage on the 15m — T1 at 2R, stop to break-even, trail under 15m swings
        ↓
  log the outcome in the grader
```

### About NinjaTrader

Your NinjaTrader account connects directly to TradingView, so analysis and execution live on the
same screen: connect the broker in the **Trading Panel** at the bottom of the chart, and place the
order from the chart itself. No second platform, no retyping levels under time pressure.

**Place the whole bracket in one action — entry, stop and target together.** Never enter first and
"add the stop in a second." That second is exactly when price moves against you and a 1% loss
becomes whatever you can stomach. The grader gives you all three numbers before you click.

**The connection still doesn't place trades for you, and that's deliberate.** The indicator alerts,
the grader approves, you click. Keep it that way until the journal says the system works.

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

Load `MSB-Strategy.pine` on MNQ 1H, two years of data. Then MES, then MGC with the `0800-1200`
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

## The honest limitations

- **The pivots confirm late.** A swing needs 3 bars to its right before it counts. That's the
  price of an objective rule instead of a hindsight one, and it means you will sometimes see a
  setup before the indicator does. Your eye is not more accurate than the rule; it's just faster
  and it also fires on the ones that fail.
- **The grade is a filter, not a prediction.** An A+ still loses plenty of the time. The grade
  is about whether the trade was *worth taking*, which is a different question from whether it won.
- **The chop numbers are a starting point.** ER 0.30, range/ATR 3.0, ADX 18 are reasonable
  defaults, not laws of nature. After 30+ trades, look at whether your losers cluster near the
  thresholds and adjust *one* of them, once, with the date written down.
- **Nothing here knows about news, halts, or a Fed governor talking at 2pm.** That's your job.

None of this is financial advice — it's your own strategy written down as rules a computer can
check. Futures are leveraged and you can lose more than you put in.
