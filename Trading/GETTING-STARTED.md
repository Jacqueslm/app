# Getting started — step by step

**First, what this is:** an indicator plus a decision system — **not a bot.** It never places a
trade. The indicator watches the charts and alerts you when your full sequence appears; the
grader sizes the trade and gives the verdict; **you** click the button in the trading panel.
That's deliberate. The discipline layer — one trade a day, the bracket placed at entry — is the
part that fixes a break-even account, and an auto-bot would bypass exactly that part. Automation
is a later conversation, after a few hundred logged trades prove the edge.

Every click, in order. Set aside about 90 minutes for Part 1 and Part 2. Do them once and
you're set up for good.

If something doesn't match what you see on screen, TradingView has probably moved a button —
the names are usually still close. Jump to [Troubleshooting](#troubleshooting) at the bottom.

---

## Part 1 — Get the indicator onto your chart (20 min)

### Step 1. Open the chart

1. Go to **tradingview.com** and sign in.
2. Open a chart and type **`MNQ1!`** in the symbol box (top left), press Enter.
   - `MNQ1!` means "whatever the front-month Micro Nasdaq contract is right now." Use this
     rather than a specific contract like `MNQZ2025` so you never have to change it at rollover.
3. Set the timeframe to **1 hour** — the dropdown next to the symbol, choose `1h`.

**Check:** you're looking at an hourly MNQ chart.

### Step 2. Copy the indicator code

1. Open this link: **[MSB-Indicator.pine](pine/MSB-Indicator.pine)**
   (on GitHub: `Trading/pine/MSB-Indicator.pine` on the `claude/day-trading-market-structure-8kzz7w` branch)
2. Click the **Raw** button (top right of the file).
3. Click anywhere in the text, then **Ctrl+A** (Cmd+A on Mac) to select all, **Ctrl+C** to copy.

### Step 3. Paste it into TradingView

1. At the bottom of the TradingView chart, click the **Pine Editor** tab.
   - Don't see it? Bottom-right of the screen there's a row of tab names — it's one of them.
2. In the Pine Editor, click **Open** → **New indicator**.
3. Sample code appears. Click in it, **Ctrl+A**, **Delete** — clear it completely.
4. **Ctrl+V** to paste the MSB code.
5. Click **Save** (or Ctrl+S). Name it **Market Structure Bridge**. Press Save.
6. Click **Add to chart**.

**Check:** you should now see a table in the top-right of the chart showing `Bias D`,
`Bridge 240`, `Exec 60`, `Chop`, `VWAP`, `RVOL`, `Day type`, `Range budget`, `Vol regime`,
`Setup`, `Session`, and `Bullets left`. Little `H` and `L` labels appear on the swings, triangles
mark breaks of structure, the orange line is VWAP, and the dotted aqua lines are yesterday's
value area. If the table shows `—` in places, scroll left to load more history.

If you got a red error instead, see [Troubleshooting](#troubleshooting).

### Step 4. Set the per-symbol settings

1. Hover the indicator name at the top-left of the chart → click the **gear** (Settings).
2. In **Session — New York only**: MNQ and MES are already right (tradeable `0930-1500`,
   prime `0930-1130`). For MGC change them to tradeable **`0800-1300`**, prime **`0800-1200`**.
3. In **Institutional context → Correlated symbol**: trading MNQ, leave it (`CME_MINI:MES1!`).
   Trading MES, change it to `CME_MINI:MNQ1!`. Trading MGC, either set `COMEX:SI1!` or untick
   **Correlated instrument must agree**.
4. Click **OK**. Leave everything else at defaults — they encode the playbook.

### Step 5. Repeat for your other two symbols

Change the symbol box to **`MES1!`**, then **`MGC1!`**. The indicator stays on the chart when you
switch symbols — just set the MGC session as above.

Save each as a chart layout so you can flip between them: top-right **☁ / Save** icon →
name it `MNQ 1H`, `MES 1H`, `MGC 1H`.

---

## Part 2 — Alerts, so you stop watching charts (10 min)

Do this on each of the three charts.

1. With the chart open, press **Alt+A** (Option+A on Mac). The alert dialog opens.
2. **Condition** — first dropdown: choose **Market Structure Bridge**.
3. Second dropdown: choose **Any alert() function call**.
4. **Trigger**: set to **Once Per Bar Close**.
   - This matters. It's the difference between an alert on a finished 1H candle and an alert on a
     candle that still has 40 minutes to change its mind.
5. **Alert name**: `MSB MNQ` (or MES / MGC).
6. **Notifications** tab: tick **Notify on app** (phone) and/or **Send email**. Turn on
   **Show popup** if you want it on screen.
7. Click **Create**.

**Check:** the alert appears in the Alerts panel on the right-hand toolbar (bell icon).

### What the alerts mean

- **"Level reclaimed — waiting on the trigger"** → the setup is at step ④. Go look, get ready.
  Do **not** enter on this one.
- **The full alert** — grade, **SCALP / STANDARD / HOLD**, day type, budget used, entry, stop,
  T1, T2 → this is the actionable one. It still isn't permission to buy. It's permission to open
  the grader. And it's your one bullet: after it fires, the system goes quiet until tomorrow.

> On the free TradingView plan you may be limited in how many alerts you can have active at once.
> If you hit that, keep MNQ and drop the others until you upgrade.

---

## Part 3 — The grader on your desktop (5 min)

1. On GitHub open `Trading/trade-grader.html`.
2. Click the **Download raw file** button (the ⤓ icon, top right of the file view).
3. It lands in your Downloads. **Drag it to your Desktop.**
4. **Double-click it.** It opens in your browser. That's it — no install, works offline.

**Check:** you see "Trade Grader" with a big red **REJECT** at the top and two checklists. Red is
correct — an empty form should always be a reject.

Try it: pick MNQ, type entry `20450`, stop `20410`, next HTF level `20650`, and it should show
**3 contracts, $240 risk** and a **HOLD · 5.0R room** plan banner. Tick all ten hard filters and
seven quality points — amber, **HALF SIZE · B**. Two more and it goes green, **TAKE IT · A+**.

> Your journal is saved inside that browser on that computer only. Don't clear your browser data
> without hitting **Export CSV** first. Do the export weekly regardless.

---

## Part 4 — Connect NinjaTrader (10 min)

1. At the bottom of the TradingView chart, click the **Trading Panel** tab.
2. Find **NinjaTrader** in the broker list and click **Connect**.
3. Log in with your NinjaTrader credentials and authorise the connection.
4. **Switch to your simulation account first.** There's an account dropdown in the panel — make
   sure it says Sim, not your live account. You're going to be clicking around while learning
   the interface, and you do not want to discover the buy button with real money.

**Check:** the panel shows your account and a balance, and you can see Buy/Sell buttons.

### Placing a bracket

When you do start taking trades, place **entry, stop and target together in one action** — never
enter first and add the stop after. That gap is exactly when price runs against you.

In the Trading Panel order ticket, fill in the stop-loss and take-profit fields *before* you
submit, using the numbers the grader gave you. Practise this ten times on sim until it's muscle
memory.

---

## Part 5 — Stage 1: the backtest (about 2 hours)

This is your actual next task. You are trying to find out whether these rules have an edge
*before* you fund them with attention or money.

### Load the strategy

1. Open your **MNQ 1H** chart.
2. **Pine Editor** → **Open** → **New strategy** → clear the sample code.
3. Paste the contents of `Trading/pine/MSB-Strategy.pine` (same Raw → Ctrl+A → Ctrl+C routine).
4. **Save** as `MSB Backtester` → **Add to chart**.
5. Click the **Strategy Tester** tab at the bottom.

### Load enough history

Scroll the chart left, or press the **←** key repeatedly, to load two years of 1H bars. The
Strategy Tester only measures what's loaded on the chart.

> Free and lower-tier TradingView plans cap how far back intraday history goes. If you can only
> get 6–12 months, that's workable — just note the shorter sample and hold your conclusions more
> loosely. Fewer than ~40 trades tells you almost nothing.

### First: does the context layer actually help?

Before anything else, settle this — it's the most valuable two minutes of the whole backtest.

1. Open the strategy's **settings gear**.
2. Run it three ways, writing the numbers down each time:
   - **Structure only** — untick **Apply context layer** (this also disables the day read)
   - **+ Context** — tick it back on, but untick the three toggles in **Professional read**
   - **+ Day read** — everything on (the default)

| | Trades | Win rate | Profit factor | Max drawdown |
|---|---|---|---|---|
| Structure only | | | | |
| + Context (VWAP, RVOL, sweeps…) | | | | |
| + Day read (day type, value, budget) | | | | |

Expect the context layer to take **fewer trades** — that's the point of a filter. What you want to
see is better *expectancy per trade* and a smaller drawdown. If it takes half the trades and
produces a materially better profit factor, it earns its place. If it barely changes anything,
turn it off and keep the system simpler.

I've told you this layer helps. Don't take my word for it — this is the test that settles it on
your data, and the answer might be no.

### Set the correlated symbol per instrument

In the same settings group, **Correlated symbol** defaults to `CME_MINI:MES1!`.

- Trading **MNQ** → leave it (MES is the right partner).
- Trading **MES** → change it to `CME_MINI:MNQ1!`.
- Trading **MGC** → either point it at `COMEX:SI1!` (silver) or untick **Correlated instrument
  agrees**. Comparing gold to the S&P is meaningless and will just cost you a point at random.

### Record the numbers

In the **Performance Summary** tab, write these down for each symbol:

| Symbol | Total trades | Win rate | Profit factor | Max drawdown | Net P&L |
|---|---|---|---|---|---|
| MNQ | | | | | |
| MES | | | | | |
| MGC *(sessions `0800-1300` / `0800-1200`)* | | | | | |

**How to read it:**

- **Total trades** — under 40, you don't have a verdict yet, you have an anecdote.
- **Profit factor** — gross profit ÷ gross loss. Above 1.3 over a decent sample is a real system.
  Above 3.0 on a small sample usually means too few trades, not genius.
- **Max drawdown** — the number that matters most. Ask yourself honestly: *would I have kept
  following the rules through that?* If the answer is no, the size is wrong, not the system.
- **Net P&L** — the number that matters least. Ignore it until the other three look sane.

### Then test whether it's fragile

Change **one** setting, re-read the summary, change it back:

- Swing strength 3 → 4
- Minimum grade score 7 → 9 (A+ only)
- Chop: max chop measures 1 → 0 (strictest)

A system that stays roughly profitable across all of those is robust. A system that only works at
exactly one combination is curve-fitted, and it will fall apart live. **You want boringly stable,
not maximally profitable.**

### What to do with the result

- **Solid on all three symbols** → go to Stage 2 (bar replay) in the [README](README.md).
- **Solid on one or two** → trade only those. Drop the others without sentiment.
- **Bad everywhere** → tell me the numbers. Either a rule needs adjusting to match how you
  actually trade it, or the edge lives somewhere the current rules don't capture. Better to find
  that out here than with money.

---

## Part 6 — Your daily routine, once you're live

**Sunday, 30 min** — mark Daily structure on all three, write the bias for each, note the week's
red-folder news (CPI, NFP, FOMC), review last week's journal.

**Pre-market, 15 min** — confirm the bias, mark the 4H levels, check your alerts are active.
Write one sentence: *"Today I'm looking for a long on MNQ at 20,4xx."* If you can't write it, you
don't have a plan, you have a hope.

**During the session** — do something else. When an alert fires: check the chart, open the grader,
tick honestly, obey the verdict. Two losses and you're done for the day.

**After the close, 10 min** — log outcomes, screenshot entry and exit, and answer one question:
*what did I do today that the playbook doesn't say to do?*

---

## Troubleshooting

**Red error when adding the indicator**
Copy the exact error text and send it to me. Most likely you missed a line when copying — make
sure you used **Raw** and that the first line is `//@version=6`.

**Dashboard shows `—` for Bias or Bridge**
Normal on a fresh chart. It needs enough history to confirm swings on the Daily and 4H. Scroll
left to load more bars.

**"Setup" always says IDLE**
That's usually correct — a full valid sequence appears a few times a week per symbol, not hourly.
Confirm it works by opening bar replay and running through a strong trending week.

**No alerts ever fire**
Check: alert set to *Any alert() function call* (not a specific plot), trigger is *Once Per Bar
Close*, and the current time is inside your session window. Outside the window the indicator
deliberately stays quiet.

**Strategy Tester shows very few trades**
Expected — this system is designed to reject far more than it takes. If it's under ~20 over two
years, loosen in this order: minimum grade score to 6, then the range-budget gate off, then max chop measures to 2. Change one at
a time and re-read the numbers.

**Grader shows 0 contracts**
Your stop is too wide for the account at that risk %. That's the tool doing its job. Skip the
trade — never shrink the stop to make the size work.
