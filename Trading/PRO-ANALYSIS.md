# Reading the day like a desk — the top-down layer

There is a specific difference between how a retail trader and a professional approach the same
chart, and it isn't secret indicators or better feeds.

**A retail trader starts with the setup and asks "is this entry good?"**
**A professional starts with the day and asks "what kind of day is this, and is my strategy
even allowed to run today?"**

Your setup is a *continuation* setup — it profits when a directional move pauses, holds, and
resumes. That kind of trade works beautifully on one type of day and gets chopped to pieces on
another, **and the setup itself looks identical on both.** The only way to tell them apart is to
read the day before you read the trade. That's what this layer does.

The order of operations, top down:

```
 1. REGIME     What's volatility doing?           (sets expectations, size, targets)
 2. DAY TYPE   Trend day or balance day?          (decides if the strategy may run)
 3. LOCATION   Where are we vs yesterday's value? (decides which trades make sense)
 4. RANGE      How much of today's move is spent? (decides if there's anything left)
 5. SETUP      Only now — your sequence           (everything already built)
 6. EXECUTION  Bracket, size, plan                (already built)
```

Amateurs live at step 5. Steps 1–4 are the upgrade.

---

## 1. Yesterday's value — the map everything else is drawn on

Auction market theory again, one level deeper than INSTITUTIONAL.md took it.

Each day, the market auctions until it finds the prices where most business gets done. The zone
where roughly 70% of yesterday's volume traded is the **value area** — its top is **VAH** (value
area high), its bottom **VAL** (value area low), and the single busiest price is the **POC**
(point of control). This is Market Profile vocabulary, and it's the shared map on every
professional desk: yesterday's value area is where the market last agreed on what the thing
is worth.

> The system approximates the value area as the prior day's VWAP ± 1 standard deviation, which
> captures about the same 70% of activity. It's an approximation — a real volume profile is
> better, and NinjaTrader has one when you're ready — but it's a sound one, and it updates itself.

Everything about today is read **relative to that map**:

- **Trading inside yesterday's value** = the market still agrees with yesterday's prices.
  Nothing has changed. Expect rotation, responsive trading, chop. **Continuation setups are
  fighting the tape here.**
- **Trading beyond yesterday's value — and staying there** = the market has repriced. Someone
  with size disagreed with yesterday's auction strongly enough to move it and hold it. **This is
  the environment your entire strategy is designed for.**

The middle of yesterday's value area is the single worst place on the chart to initiate a trade.
It's the market's definition of "fair" — and fair means no edge, by construction.

## 2. The open — the most information-dense moment of the day

Where today **opens relative to yesterday's value** is the first professional tell, available at
9:30 sharp:

| Open location | What it says | What to expect |
|---|---|---|
| **Inside yesterday's value** | Nothing changed overnight | Balance day likely. Rotation. Your setup should demand more proof (or stay flat). |
| **Outside value, and holding** | Overnight repricing that's being accepted | Trend day candidate. Your best days come from here. |
| **Outside value, falling back in** | The repricing failed | The "80% rule" environment — price tends to rotate across the whole value area. Fade territory, not continuation territory. |

The desk phrase is **"open out of balance."** Days that open beyond yesterday's value and hold
are a minority of days — and they produce the majority of clean trends. Days that open inside
value mostly rotate. Knowing which one you're in by 10:00 is worth more than any indicator on
the chart.

## 3. Day type — the classification that decides everything

Roughly, sessions come in two families:

**Balance days** (most days, ~70-80%): price rotates through an accepted range, both sides
trade it, moves reverse. The right trades are *responsive* — fade the edges — which is **not
your strategy**. On these days your continuation setup produces exactly the losing pattern you
know: break, entry, snap back, stop.

**Trend days** (the minority): one-way conviction, opens near one extreme and closes near the
other, pullbacks stay shallow, value migrates all day. These pay for the month. Your entire
sequence — break, pullback, hold, go — is a *description of trend-day behaviour*.

The professional discipline is brutal and simple: **run trend-following tactics only when the
day shows trend evidence, and stand down when it doesn't.** Not "trade smaller." Stand down.

The system now classifies the day live:

- **TREND ↑** — price has spent 2+ closes above yesterday's VAH (acceptance above value)
- **TREND ↓** — 2+ closes below yesterday's VAL
- **BALANCE** — still trading inside yesterday's value, or poking out without acceptance

A trigger that fires while the day is classified BALANCE loses a quality point. A trigger in the
direction of an accepted trend gains one. On the dashboard you can see the classification tick
over in real time — watching it flip from BALANCE to TREND ↑ as acceptance builds above VAH *is*
the professional read, happening in front of you.

## 4. The range budget — why late entries fail even when they're "right"

Every instrument has a typical daily range — its daily ATR. MNQ might travel ~250 points on an
average day. That number is effectively the day's **budget**, and professionals treat it that
way: how much of the expected move has already been spent?

If MNQ has already rallied 230 points off the session low and your long triggers now, you're
buying after ~90% of a normal day's fuel is burned. The setup can be textbook — structure,
volume, VWAP, all of it — and the trade still dies, because you're asking the day to become a
2-standard-deviation outlier just to pay your 2R.

**New hard gate: range exhaustion.** At the trigger, the system measures how far price has
already travelled *in your direction* from today's extreme (off the low for longs, off the high
for shorts) against the daily ATR. Past 85% of budget, the trade is rejected — whatever it looks
like. It's a toggle like everything else; backtest it on and off.

This is the filter that kills the most seductive bad trade there is: the perfect-looking
continuation signal at 1:30pm, 240 points into a 250-point day. Nothing on a price chart makes
that trade look wrong. Only the budget does.

## 5. Volatility regime — the weather report

Same setup, different regime, different trade. The system now compares the current ATR to its
own long-run average and displays the regime:

- **HIGH** (ATR well above average) — moves travel and so do stops. Structure works, but size
  down: your 1% should buy fewer contracts, and the system's sizing already does this
  automatically because the stop is wider. Trust it — don't "keep my usual size" in high vol.
- **NORMAL** — everything as designed.
- **LOW** (ATR well below average) — ranges compress, breaks fail, the chop filter will be
  rejecting most things anyway. Expect scalps, not holds; expect nothing, often.

This is display-and-awareness, not a gate — the chop filter and ATR-based sizing already act on
it mechanically. What the label buys you is *calibrated expectations*: a 40-point MNQ day in a
low-vol regime is normal, not "dead," and a HOLD plan in low vol deserves skepticism even when
the room calculation technically clears.

## 6. Scenario planning — the pro habit that costs nothing

The single most transferable professional practice isn't analytical at all. Before the open,
a desk trader writes down **what they expect and what would prove them wrong** — before money is
involved, while they're still smart.

Yours takes three minutes, pre-market, in this shape:

```
DATE ____  SYMBOL ____
Yesterday's value:  VAH ____  POC ____  VAL ____     Overnight: high ____ low ____
Open location:      inside value / above / below
Daily bias (structure):  bull / bear / none          4H: agrees / against
Vol regime:  high / normal / low                     News today: ____ at ____

SCENARIO A (primary):  If day type confirms ______ and price holds ______,
                       I want the ______ at ______.  Invalidated below/above ______.
SCENARIO B (alternate): If instead ______, then ______.
NO-TRADE CONDITIONS:   Balance day inside value · news window · range budget spent · already traded
```

Two scenarios, written as *if/then*. Not predictions — prepared reactions. When one fires you
execute a plan you made while calm; when neither fires you have written yourself permission to
do nothing, which for an impulsive trader is the most valuable line on the page.

The blank template lives at the bottom of this file. Print a stack of them.

---

## What changed in the code

**New hard gate (toggleable):**
- **Range budget** — reject when ≥85% of the daily ATR has already been spent in the trade's
  direction. The "perfect setup at 1:30pm" killer.

**New quality points (taking the total to 12 — A+ is now 9+, B is 7–8):**
- **Day type agrees** — the session has printed acceptance beyond yesterday's value in your
  direction (2+ closes). A BALANCE-day trigger doesn't score this.
- **Beyond value** — the trigger bar itself is trading beyond yesterday's VAH (long) / VAL
  (short): initiative territory, not the fair-price middle.

**New dashboard rows:** day type (BALANCE / TREND ↑ / TREND ↓), position vs yesterday's value,
range budget used, volatility regime. The alert message carries day type and budget too.

**Not added, on purpose:** market internals ($TICK, advance/decline). They're a genuine
professional tool for index futures, but they need a data subscription that varies by plan and
they'd make the script fail for you if the symbol isn't available. When you're ready, the manual
version is one glance: for an MNQ/MES long, is NYSE $TICK making mostly positive extremes?
NinjaTrader can chart it. Treat it as a tiebreaker, not a gate.

## The honest limits of this layer

- **The value area is approximated** (prior-day VWAP ± 1σ), not computed from a true volume
  profile. It lands within a few ticks of the real thing most days and drifts on strongly skewed
  days. NinjaTrader's Volume Profile is the upgrade when you want the real one.
- **Day type is only knowable in hindsight; the classifier reads acceptance early, which means
  it's late by design** — the same trade-off as your swing pivots. It will miss the first hour of
  some trend days. That's the cost of not being fooled on the far more numerous balance days,
  and it's a good trade.
- **The 85% budget threshold is a default, not a law.** Trend days deliberately exceed their
  budget — that's what makes them trend days. If the backtest shows the gate costing more than
  it saves on your data, loosen it to 1.0× or turn it off. One change, dated, like every rule.

---

## Pre-market prep sheet (print me)

```
DATE ________   SYMBOL ________   ACCOUNT $ ________   1% = $ ________

YESTERDAY:   VAH ________   POC ________   VAL ________   H ________   L ________
OVERNIGHT:   high ________   low ________      OPEN LOCATION:  in value / above / below
STRUCTURE:   Daily bias ________   4H ________   levels in play ________________________
REGIME:      vol high / normal / low        NEWS: ____________ at ________ (no-trade ±10m)

SCENARIO A:  if ________________________________ then ________________________________
             invalidated at ________
SCENARIO B:  if ________________________________ then ________________________________
             invalidated at ________

TODAY I AM LOOKING FOR: ________________________________________________________________
(one sentence — if you can't write it, you don't have a plan, you have a hope)

AFTER THE CLOSE:  traded? Y / N   followed plan? Y / N   planned R ______  actual R ______
                  one thing I did that the playbook doesn't say to do: ____________________
```
