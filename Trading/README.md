# Market Structure Bridge — your trading system

Daily bias → 4H bridge → 1H execution → 15m management. MNQ, MES, MGC.

Four pieces. Read them in this order.

| File | What it is |
|---|---|
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
  place the order in NinjaTrader by hand
        ↓
  manage on the 15m — T1 at 2R, stop to break-even, trail under 15m swings
        ↓
  log the outcome in the grader
```

### About NinjaTrader

**This system does not place trades for you, and that's deliberate at this stage.** TradingView
alerts can't route orders to a NinjaTrader account — the analysis lives on TradingView and the
execution lives in NinjaTrader, with you in between. Chart on one screen, DOM on the other.

Two things worth knowing:
- NinjaTrader owns Tradovate, and Tradovate *is* one of TradingView's integrated futures brokers.
  If you want to click trades directly from the TradingView chart, that's the route to look into —
  check current terms with them, don't take my word for it.
- If you later want genuine automation, the honest path is NinjaScript (C#) running inside
  NinjaTrader itself, ported from these same rules. **Don't do that yet.** Automate a system
  after you have a few hundred manual trades proving it works, not before. An automated bad
  system just loses money faster and with less to learn from.

---

## Before you risk a dollar

1. **Backtest.** Load `MSB-Strategy.pine` on MNQ 1H, 2 years. Look at expectancy and max
   drawdown, not net profit. Then set commission and slippage to your real fills and look again.
2. **Replay.** TradingView bar-replay, 50 setups, grader open, no money. You're training your
   eye to see step ⑤ — the wait — as the entry, not step ②.
3. **Sim.** 30 trades in NinjaTrader sim at your real size.
4. **Live, one contract**, whatever the grader says, for 30 trades.

If steps 1–3 look bad, that's the system doing its job. A rule set that gets rejected on paper
saved you the money it would have cost live.

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
