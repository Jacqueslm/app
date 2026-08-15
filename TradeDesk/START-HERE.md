# How to use this

Four files. Two you open in a browser, one you paste into TradingView, one you read.

| file | what it is |
|---|---|
| `scanner.html` | Drop a CSV in, get the four numbers. **This is the one you use daily.** |
| `index.html` | Trade journal, position sizer, daily guardrails. |
| `pine/structure.pine` | Draws the structure on your TradingView chart. |
| `SPEC.md` | What the rules are, what was proven, what was withdrawn. |

`scanner.html` and `index.html` open by double-clicking. No install, no server,
no account. Everything stays in your browser.

---

## Once, to set up

**1. Open `index.html`** → Setup tab. Put in your account size, your risk per
trade, your daily loss limit, and your broker's round-turn commission. That's it.

**2. Paste `pine/structure.pine` into TradingView.** Pine Editor at the bottom
of the chart → new indicator → delete the template → paste the whole file →
Save → Add to chart.

**3. Put the chart on MES, 1 hour.** Not 4H. Everything was measured on the 1H,
and the indicator's external timeframes (4H and daily) have to sit *above* the
chart. On a 4H chart it compares that timeframe with itself and reads "disagree"
forever. It will now warn you in red if you get this wrong.

---

## Each time you sit down

**1. Export the data.** MES 1H chart → scroll left until it stops loading more
bars → the `⋯` menu top-right of the chart → *Export chart data* → CSV.

Scrolling matters. TradingView exports what the chart has loaded, not what it
has. A fresh chart gives you 400 bars; a scrolled one gives 20,000.

**2. Drop the CSV into `scanner.html`.** One file — it builds the 4H and daily
itself. You get back:

- **Where we are** — daily, 4H and 1H bias, whether they agree, whether the 1H
  is ranging
- **Setup** — if a leg is live: direction, and how far price is from the entry
- **Mark these before the moment** — entry, stop, target, invalidation
- **Sizing** — contracts for your account, and a warning if fees are eating the
  edge
- **Unfilled gaps** — context only, never a reason to enter
- **Paper record** — what has closed since you started, against the baseline

**3. Draw the four lines on your chart.** Entry, stop, target, invalidation.

This is the part that matters. The decision gets made now, while nothing is
happening. When price arrives at the entry there is nothing left to work out —
you place the limit or you do not. Hesitating and chasing are what cost money in
the moment, and both come from deciding late.

**4. If the scanner says no setup, there is no setup.** "External: disagree"
means the daily and 4H point different ways. That filter is worth about 0.5R a
trade — it is the single most valuable thing the testing found. Sitting out is
the trade.

---

## When you take one

**Before:** the scanner already gave you the contract count. Use it.

**After:** log it in `index.html` → Journal. Entry, stop, exit, size, setup name,
and whether you followed the plan. The note field is the one that pays.

**Weekly:** `index.html` → Review. It shows expectancy, profit factor, your
worst hour of the day, what your off-plan trades cost, and whether you trade
worse after a loss. That last one is usually the biggest leak in a discretionary
account.

---

## Which to believe when they disagree

**The scanner.** It runs the full structural bias on the 4H and daily. Pine
cannot do that cheaply, so the indicator uses the direction of the last closed
higher-timeframe candle as a proxy. Coarser, and it will sometimes differ.

Use the indicator to *see*. Use the scanner to *decide*.

---

## What the numbers actually are

About **+0.20R to +0.46R a trade, roughly one a week**, on MES. Positive in every
calendar year tested and in both directions.

That rests on **55 trades** whose intrabar path could be verified against 15M
data — not the 217 the backtest produced. An earlier figure of +0.62R was
withdrawn: it assumed a price path the data does not contain. `SPEC.md` §21 has
the whole correction.

So: a real edge, on a thin sample, on one instrument. Paper trade it first. The
record in the scanner exists to grow that 55 forward, and it will tell you if
live results drift below the baseline by more than noise.
