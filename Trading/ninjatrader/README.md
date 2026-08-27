# The bot — MSBPure for NinjaTrader 8

This one places the orders. It runs inside NinjaTrader, sees your data, and
submits entry, stop and both targets by itself. TradingView is not involved.

Structure only: swing highs and swing lows. Nothing else is read.

---

## Install (once, ~3 minutes)

1. Download **MSBPure.cs** and put it in:

   `Documents\NinjaTrader 8\bin\Custom\Strategies\`

2. Open NinjaTrader → **New → NinjaScript Editor** → press **F5** (Compile).
3. Bottom of the editor shows either "compiled successfully" or a list of errors.
   If there are errors, send them to me — they're mine to fix, not yours.

---

## Backtest it (this is the easy part now)

1. **New → Strategy Analyzer**
2. Left panel: pick **MNQ 06-26** (or MES), set the date range to a couple of years
3. Strategy: **MSBPure**
4. Data series: **1 Minute → 60** (this is your execution timeframe; use 15 for scalp mode)
5. Click **Run**

You get trades, win rate, profit factor, drawdown and an equity curve in one
click. No Pine Editor, no menus, no pasting.

**Read the trade count first.** If it finds far fewer trades than you take by
hand, the sequence definition is still wrong and that is the thing to fix.
Everything else is noise until the frequency matches reality.

---

## Then sim, and only then live

1. **Control Center → Strategies tab → right-click → New Strategy**
2. Strategy: **MSBPure**, Instrument: MNQ, Data series 60 minute
3. **Account: Sim101**
4. Set Enabled = true

It now trades on live data with fake money. Leave it there for at least 30
trades and compare what it does against what you would have done.

**Going live is one dropdown** — changing Sim101 to your funded account. That
dropdown is the whole difference between a study and real money, and nothing in
the software will stop you or warn you. Only move it after the sim record says
the rules work and you've watched it behave for a few weeks.

---

## Settings that matter

| Setting | Default | What it does |
|---|---|---|
| Bars the reclaim must hold | 1 | The wait after the reclaim. Raise it to demand more patience and watch the trade count drop. |
| Require the fresh break | true | Step 5 of your sequence. Off = enter on the reclaim itself. |
| Daily bias must agree | true | Permission from the higher structure. |
| Bridge must agree | true | The 4H at the moment of the trigger. |
| Lower TF must agree | true | The 15m pointing with the 1H. This is the chop filter. |
| This chart must agree | true | The execution timeframe's own structure. |
| Scalp mode | false | Slides the stack down a rung: 4H+1H bias, run it on a 15-minute chart, 5m alignment. |
| Pullback entries | true | The short way in — pullback prints a swing, price closes back through it. Fires often. |
| Retest sequence entries | true | The long way in — break, back through, reclaim, hold, fresh break. Rare. |
| Reject if room below this (R) | 1.0 | No trade if the next opposing swing is closer than one stop. |
| Risk per trade (%) | 10 | Contracts are computed from this and the stop distance. Read §"What it does not do" before raising it. |
| Read the live account balance | true | Uses the real balance when there is one; falls back to Account size in the Strategy Analyzer. |
| Contract cap | 50 | A ceiling no arithmetic gets past. |
| Max trades per day | 1 | Your rule. Raise it temporarily to see what the rules alone produce. |
| Session start / end | 093000 / 150000 | Chart time. For MGC use 080000 / 130000. |

Change one at a time and re-run. Changing four and judging the result teaches
you nothing.

---

## What it does not do

- It does not read news, and it does not know when the Fed speaks. Disable it on
  FOMC days yourself. Nothing anywhere in this system watches the calendar.
- It does not know about your prop firm's drawdown. Size it yourself.
- **It has no weekly stop.** The −3R weekly limit in the playbook is not enforced
  anywhere in the software — you count it in the journal and switch the bot off.
  At a high risk percentage that rule is doing most of the work of keeping the
  account alive, and it is running on your honesty alone.
- It trades on **closed bars only**. It will never chase an intrabar spike, and
  it will sometimes enter later than you would by hand. That is deliberate.
