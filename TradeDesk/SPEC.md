# Structure engine — specification

The method, written down mechanically. Nothing here is a suggestion about how to trade;
it is an attempt to state *your* rules precisely enough that code can apply them the same
way twice. Where a rule has a choice buried in it, the choice is named and flagged rather
than quietly decided.

No indicators. No moving averages, no oscillators, no volume studies, no smoothing of any
kind. The only inputs are open, high, low, close, and time.

---

## 1. Timeframe roles

| Timeframe | Role | What it decides |
|---|---|---|
| Daily | External | Direction. Nothing is taken against it. |
| 4H | External | Confirms or contradicts the daily. Where the current leg sits. |
| 1H | Internal | State: trending or consolidating. Where manipulation is identified. |
| 15M | Execution | Entry, stop, target. |

**External structure** is the swing structure of the Daily and 4H.
**Internal structure** is the swing structure of the 1H and 15M.
**Alignment** is internal structure shifting into agreement with external bias.

---

## 2. Swing points

A swing high at bar `i` requires:

```
high[i] >  high[j]   for the N bars before i
high[i] >= high[j]   for the N bars after i
```

A swing low at bar `i` requires:

```
low[i]  <  low[j]    for the N bars before i
low[i]  <= low[j]    for the N bars after i
```

Strict on the left, non-strict on the right. That asymmetry is deliberate: it means a
double top resolves to the *first* of the two bars rather than printing two swings or
none.

**Default: N = 2** (a five-bar pattern).

**Confirmation lag is real and is not hidden.** A swing at bar `i` cannot be known until
bar `i + N` has closed. The engine will not use a swing before that bar, ever. Every level
it reports was knowable at the time it was used. This is the difference between a
structure tool and a backtest that lies to you.

### Alternation

Raw fractals produce clusters — three highs in a row inside one leg. Structure requires
strict alternation: high, low, high, low. When two consecutive swings of the same kind
appear, the more extreme one survives and the other is discarded (the higher of two highs,
the lower of two lows).

The result is a clean alternating chain, which is what HH/HL/LL/LH labelling needs to mean
anything.

---

## 3. Labels

Each confirmed swing is labelled by comparison with the previous swing **of the same
kind**:

- Swing high above the previous swing high → **HH**
- Swing high below the previous swing high → **LH**
- Swing low above the previous swing low → **HL**
- Swing low below the previous swing low → **LL**

The first high and the first low in a series have nothing to compare against and are
labelled `—`.

---

## 4. Break of structure and change of character

Structure is tracked at **two levels at once**. Collapsing them into one is what
makes a naive implementation flip its bias on every pullback, and separating them is
what makes "internal aligning with external" mechanically expressible.

| Level | Watches | Meaning |
|---|---|---|
| **minor** | the most recent confirmed swing | every shallow pullback that fails; the pullback-level detail you execute against |
| **major** | the **protected level** | the low that launched the current bullish leg, or the high that launched the bearish one |

The protected level **advances only on a BOS**, never on an ordinary swing. In a
bullish leg from 100, pullbacks print swing lows at 105, 108, 110 — a dip to 109 breaks
the most recent one, but the leg is untouched. Only a close below the low that launched
the breakout ends it.

Inside one timeframe that is swing structure versus internal structure. Read across
timeframes it is the same idea: major on the Daily and 4H is your external bias, minor
on the 1H and 15M is where entries live.

This was found empirically, not assumed. With one level only, real MES data gave
roughly one BOS per CHoCH on every timeframe — a trend that never persists, which is
not what price does. Raising the swing sensitivity did not fix it and made 4H worse,
which is what ruled out noise as the cause. With the protected level separated out,
the daily runs 2.09 BOS per CHoCH and 1H runs 2.33.

The engine carries a **bias**: `bull`, `bear`, or `null` before the first break.

On each bar, the close is compared with the most recent *confirmed and unbroken* swing
high and swing low.

| Bias | Close breaks above last swing high | Close breaks below last swing low |
|---|---|---|
| `bull` | **BOS bullish** — continuation | **CHoCH bearish** — bias flips to `bear` |
| `bear` | **CHoCH bullish** — bias flips to `bull` | **BOS bearish** — continuation |
| `null` | **BOS bullish**, bias becomes `bull` | **BOS bearish**, bias becomes `bear` |

At the major level the same table applies, but the level being tested is the protected
one, and each BOS drags the protected level up (or down) behind it.

A CHoCH is exactly the pattern you described: price making HH and HL, then breaking the
previous HL. That break is the first mechanical evidence the leg is finished.

Once a swing has been broken it is consumed and cannot produce a second event. The next
event requires a new swing to form and then be broken.

**Default: breaks are measured on the close, not the wick.** A wick through a level is a
sweep (§5), not a break. This single choice separates structure from liquidity, and it is
the most consequential default in this document — see the open questions.

### Same-bar double break

One large bar can close beyond both the last swing high and the last swing low. The engine
resolves this by the direction of the candle body and flags the event `ambiguous: true` so
it can be found and reviewed rather than silently absorbed.

---

## 5. Manipulation

A sweep is a raid on liquidity resting beyond a swing, followed by rejection. Mechanically,
a **bearish sweep** (buy-side liquidity taken above a swing high) at bar `i`:

```
high[i] >  swingHigh.price      the level was traded through
close[i] <= swingHigh.price     but not accepted — the close came back inside
```

A **bullish sweep** is the mirror below a swing low.

This is the precise complement of §4: same level, wick through versus close through. A
close beyond is a break; a wick beyond that closes back inside is a sweep. Nothing can be
both.

A sweep is tagged `isProtected` when the level taken is the protected one. That is the
signature worth hunting: liquidity raided at the level defending the entire leg. On real
MES data these are rare in exactly the right way — 0.44/wk on 4H, 0.59/wk on 1H, 3.17/wk
on 15M, against your stated 2–3 trades a week.

**Displacement** — the "exposing it" half — is the move that follows and confirms the
sweep was manipulation rather than a failed break. Left deliberately undefined until the
engine is verified; defining it needs your eye on real examples, not my guess.

---

## 6. Consolidation

Your rule: trade consolidation only when the 1H is making HH HL LL LH.

Read mechanically, a sequence containing *both* bullish labels (HH, HL) and bearish labels
(LL, LH) within the same recent window is not a trend — it is a range. That mixture is the
signature.

**Proposed test:** over the last 4 confirmed 1H swings, at least one bullish label and at
least one bearish label are present, and no BOS has fired in either direction across that
span.

Flagged as an open question — this is my reading of your sentence, not your words.

---

## 7. Trade frequency as a calibration target

Two to three trades per week. This is not a preference to be honoured politely; it is a
testable constraint on the rules. If the finished conditions fire fifteen times a week,
the rules are wrong — too loose somewhere — regardless of how good the individual setups
look. Frequency is the first thing checked once the full chain is assembled.

---

## 8. Open questions

Defaults are in place so work continues; these change the output materially and are yours
to settle.

1. **Swing sensitivity (N = 2).** Two bars either side is responsive and catches the small
   15M pivots. N = 3 is cleaner on the 1H and above but will miss shallow pullbacks. It may
   want to differ by timeframe.
2. **Break on close (default) or wick.** Close-based is assumed throughout, and §5 depends
   on it. If you count a wick through a swing as a genuine break, say so — the sweep
   definition has to be rebuilt around it.
3. **Consolidation test (§6).** Is "last 4 swings, both label families present, no BOS" what
   you mean by HH HL LL LH?
4. **Displacement (§5).** What makes a sweep credible to you — a full-body candle back
   through the swing, a fair value gap, speed, something else? Best answered against real
   charts once the engine is drawing them.
5. ~~**Data.**~~ Settled — TradingView MES exports, four timeframes, in `data/`.
   The 15M is only 4.4 days, which is enough to eyeball but not to conclude anything
   from. A deeper 15M and 1H export is the one thing that would most improve the next
   step.

---

## 9. Build order

1. **Swing detection and labelling** — done, tested. §2, §3.
2. **BOS and CHoCH, major and minor** — done, tested. §4.
3. **Sweep detection** — done, including protected-level tagging. §5.
4. **Real candles drawn with structure on them** — done: `chart.html`.
   ← *checking those labels against your own chart is the current step*
5. **Multi-timeframe alignment** — done, tested. No higher timeframe is read
   before its bar has closed, and that property is asserted rather than assumed.
6. **Frequency check** — done, and it says the encoding is too tight: 0.4
   trades/wk against a target of 2–3. See §10.
7. Consolidation as a second setup type — *not built*. This is the likely
   source of most of the missing frequency.
8. Displacement, then entry, stop, target.

Nothing at step *n* is built until step *n − 1* has been checked against a real chart.

---

## 10. What the first frequency check said

Scanned over 256 days of 2H with the daily and a 4H derived from it. The funnel,
at N=2:

| stage | count | |
|---|---|---|
| sweeps in the usable window | 187 | |
| …matching external bias | 53 | 72% removed |
| …confirmed by a minor shift within 6 bars | 14 | a further 74% removed |

That is **0.4 trades/wk against a target of 2–3**. The rules as encoded are far
too *tight*, which is the opposite of the failure mode expected.

Win rate 21% and expectancy −0.36R at a flat 2R exit. **Both numbers are
meaningless at 14 trades** and are recorded only so the next run can be compared
against them. The 2R exit is a placeholder invented for this test.

Three knobs in that scan are inventions, not the method:

1. **The 6-bar confirmation window.** Nothing said confirmation must arrive
   within six bars. This filter removes three quarters of what survives bias.
2. **Requiring the daily and 4H to agree exactly.** "Follow daily and 4hr" may
   mean the 4H leads and the daily is context, which is looser.
3. **The 2R exit.** Entirely a placeholder.

And one whole setup type is missing: the consolidation trade. "Trade
consolidation but only when the 1hr is making HH HL LL LH" is a second, separate
entry condition, and none of it is wired in. That is the most likely reason the
frequency is a fifth of what it should be — the scan is only looking for one of
the two things actually traded.

---

## 11. The pullback-to-origin setup

Your words: *in a 4hr or daily swing, if the 1hr makes HH, pullback then take
up or down to where it came from.*

Mechanically:

- external bias set by the 4H and/or daily
- a BOS on the execution timeframe in that direction — the HH
- price retraces toward the **origin** of the leg that made it, which is the
  protected level already tracked in §4
- entry as a resting limit at that retracement, stop beyond the origin
- invalidated by a close through the origin, or by a fresh BOS starting a new leg

The only invented number is **depth** — how far back into the leg counts as the
pullback — so it is scanned rather than assumed.

### Results, 256 days of 2H

| depth | trades | /wk | win% | expectancy | avg R:R |
|---|---|---|---|---|---|
| 0.33 | 56 | 1.5 | 79% | +0.17R | 0.49 |
| 0.50 | 43 | 1.2 | 63% | +0.25R | 0.99 |
| 0.62 | 38 | 1.0 | 53% | +0.37R | 1.60 |
| **0.75** | **33** | **0.9** | **42%** | **+0.68R** | **2.96** |

Target is the prior extreme, identical for every depth. That matters: comparing
depths by R-multiple is not a fair test, because a deeper entry has a tighter
stop and so its 2R target sits nearer in price and is easier to reach. Fixing
the target price isolates whether the entry is genuinely better rather than
merely closer.

Deeper is better, and for a coherent reason — reward-to-risk improves faster
than win rate decays. The pattern is monotone and holds in all four
configurations tested, which is stronger evidence than any single cell.

### Checks that could have killed it

- **Not a bull market.** External bias across the window was 35% bull, 33% bear,
  32% neither, and trades at depth 0.75 split 18 long / 15 short.
- **Costs are irrelevant here.** Median risk is 18 points, $91 on MES, so a $4
  round turn is 0.04R. Expectancy goes +0.68R → +0.63R.
- **Depth 1.00 is degenerate,** not a result. Entry converges on the origin and
  the stop sits a tick beyond it, so risk collapses to 0.25 points and every
  trade is stopped instantly. It is left in the table as a reminder that the
  model breaks down there.

### What this is not

33 trades, one instrument, one 256-day window. Depth 0.75 was chosen by scanning
five values, which is mild curve-fitting — the monotone trend is the defence, not
the winning cell. The exit at the prior extreme is a choice never stated. Fills
assume a resting limit is filled at the trigger price and never gapped through.

---

## 12. The HH does not have to break anything

Correction to §11. The leg is defined by a swing high **labelled HH** — higher
than the previous swing high — and nothing more. It need not break structure,
because that high may itself be a lower high on a larger timeframe: the 1H can
rally into a 4H LH and still be a leg worth trading. Which it is depends on the
market, not on a rule.

So the trigger is the swing label, not the break. Both readings are implemented
(`on: 'swing'` and `on: 'bos'`) because the difference turns out to matter.

### Both, over 256 days of 2H with the daily and 4H agreeing

Target is the prior extreme in every row.

| depth | swing trades | /wk | exp | break trades | /wk | exp |
|---|---|---|---|---|---|---|
| 0.33 | 77 | 2.1 | −0.18R | 56 | 1.5 | +0.17R |
| 0.50 | 58 | 1.6 | −0.23R | 43 | 1.2 | +0.25R |
| 0.62 | 54 | 1.5 | −0.04R | 38 | 1.0 | +0.37R |
| 0.75 | 44 | 1.2 | +0.17R | 33 | 0.9 | +0.68R |

The swing trigger fires roughly 40% more often and lands much closer to a target
of 2–3 a week. It is also worth substantially less per trade, and at shallow
depths it is negative where the break version is positive.

That is a genuine tension rather than a bug. Requiring the break is a filter;
it discards legs that never confirm, and those legs lose money. Both remain
positive at depth 0.75, so the question is not which is correct but whether the
extra frequency is worth roughly a third of the expectancy.

### A lookahead bug this refactor introduced

Rewriting the leg detection also moved the pullback scan to start **on** the bar
that revealed the leg rather than after it, letting a resting limit fill during
the same bar whose close first made the setup knowable. It inflated the break
version from +0.68R to +1.18R, which is how it was caught — a number improving
after a change that should not have touched it. Fixed, and four tests per
trigger mode now assert entries come strictly after their own signal.

---

## 13. 466 days changes the answer

A deeper 1H export — 7571 bars, 466 days — replaces the 24-day one. 2H and 4H are
now derived from it, matching the vendor exports exactly on every overlapping
full bucket while reaching three to five times further back.

With a real sample the §12 conclusion inverts.

**1H execution, daily and 4H agreeing, target the prior extreme:**

| depth | your reading (no break) | | break required | |
|---|---|---|---|---|
| | trades | exp | trades | exp |
| 0.33 | 210 | −0.25R | 137 | **+0.20R** |
| 0.50 | 175 | −0.16R | 118 | **+0.21R** |
| 0.62 | 153 | −0.05R | 107 | **+0.40R** |
| 0.75 | 129 | +0.03R | 91 | **+0.50R** |

Without the break the setup is breakeven at best and negative most places. The
+0.17R it showed over 256 days was small-sample noise, and it washed out. With
the break it is positive at every depth, 1.4–2.1 trades a week, on 91–137 trades.

Costs remain irrelevant: median risk 10–26 points, so a $4 round turn takes
0.03–0.09R off.

### The caveat that matters more than the result

This window is a bull market. Price ran 5949 → 7802, external bias was 47% bull
against 20% bear, and trades split roughly 74% long. Splitting by direction:

| depth | longs | | shorts | |
|---|---|---|---|---|
| | n | exp | n | exp |
| 0.33 | 102 | +0.24R | 35 | +0.11R |
| 0.50 | 87 | +0.28R | 31 | +0.03R |
| 0.62 | 80 | +0.52R | 27 | +0.07R |
| 0.75 | 65 | +0.55R | 26 | +0.37R |

**Longs carry nearly all of it.** Shorts are close to zero except at the deepest
pullback, on 26–35 trades. Nothing here separates "shorts do not work" from
"this window had no good shorts" — the balanced 256-day window is the only
counter-evidence and it is smaller. A bear or sideways year is what would settle
it, and until then the short side is unproven rather than disproven.

---

## 14. 3.6 years — the short side answered

21,369 bars of 1H, January 2023 to August 2026. 2H and 4H derive from it exactly.
The daily needs session-aware bucketing rather than a fixed offset, because the
CME session runs 18:00–17:00 ET and the clock shifts twice a year; bucketing by
the ET calendar date of bar time + 6h gets 397 of 399 sessions exact, the two
misses being the DST-change days themselves.

**1H execution, daily and 4H agreeing, target the prior extreme:**

| depth | all | | longs | | shorts | |
|---|---|---|---|---|---|---|
| | n | exp | n | exp | n | exp |
| 0.33 | 363 | +0.22R | 266 | +0.22R | 97 | +0.21R |
| 0.50 | 309 | +0.28R | 223 | +0.30R | 86 | +0.20R |
| 0.62 | 268 | +0.40R | 195 | +0.46R | 73 | +0.25R |
| 0.75 | 217 | +0.50R | 154 | +0.50R | 63 | **+0.50R** |

**The shorts work.** At 0.75 depth longs and shorts are identical to the cent.
The §13 result — shorts near zero — was the 466-day window being a bull market,
exactly as flagged. With 3.6 years the asymmetry disappears.

| year | n | exp | long | short | range |
|---|---|---|---|---|---|
| 2023 | 65 | +0.58R | +0.69R | +0.30R | 4574–5437 |
| 2024 | 74 | +0.15R | +0.17R | −0.02R | 5298–6520 |
| 2025 | 80 | +0.46R | +0.46R | +0.46R | 5114–7126 |
| 2026 | 49 | +0.43R | +0.73R | +0.07R | 6415–7839 |

Positive every year, weakest in 2024. 1.4 trades/wk at depth 0.62, 1.9 at 0.33.

The no-break trigger is negative almost everywhere across the same 3.6 years
(−0.21R to +0.07R). At 542 trades that is no longer a sample-size question. The
break requirement is where the edge lives.

Slippage does not threaten this. Median risk is 15 points, so a tick of adverse
fill on the stop costs 1.6% of one R.

### Still not settled

The exit is the largest untested assumption in the whole project — the prior
extreme was chosen because something had to be, and it does all the work in
every number above. Fills assume a resting limit takes the trigger price and is
never gapped through. One instrument. And the consolidation setup remains
entirely unbuilt.

---

## 15. The exit, and it beats the assumption

Your rule: exit at 50–80% of the previous high or low. Two readings were tested —
the fraction measured from the **origin** of the leg (origin 0%, prior extreme
100%) and from the **entry fill** (remaining distance to the extreme is 100%) —
plus scaling out in thirds across the band.

**MES 1H, 3.6 years, D+4H agree, BOS trigger, depth 0.75:**

| exit | win% | expectancy |
|---|---|---|
| 50% of leg from origin | 77% | +0.52R |
| **65% of leg from origin** | **64%** | **+0.62R** |
| 80% of leg from origin | 52% | +0.61R |
| scale out 50/65/80 | 64% | +0.58R |
| 50% measured from entry | 66% | +0.61R |
| *prior extreme (the old assumption)* | *39%* | *+0.50R* |

Your exit is better than mine on both counts: **+0.62R against +0.50R, at a 64%
win rate against 39%.** The old target asked price to make a full round trip; the
50–80% band takes the part of the move that actually pays and leaves the tail.
A 64% win rate is also a materially different thing to sit through than 39%.

Measuring from the origin edges measuring from the entry, and the difference is
small enough not to lean on. Scaling out is slightly worse than a single exit at
65% but tighter than either extreme, which is what scaling out is for.

Note the blank cell: at depth 0.50 a 50% target sits exactly at the entry, so it
is unreachable and the evaluator refuses it rather than scoring a free win.

### The best configuration found so far

Depth 0.75, exit at 65% of the leg from origin, 1H execution, daily and 4H agreeing.

| slice | n | win% | expectancy |
|---|---|---|---|
| all | 217 | 64% | +0.62R |
| long | 154 | 67% | +0.69R |
| short | 63 | 56% | +0.43R |
| 2023 | 49 | 69% | +0.75R |
| 2024 | 60 | 65% | +0.64R |
| 2025 | 64 | 64% | +0.63R |
| 2026 | 44 | 55% | +0.40R |

133.5R over 217 trades, worst drawdown 6.0R, 1.2 trades a week. Median risk 9.2
points, $46 a contract. Both directions work, every year works, 2026 weakest.

Still: one instrument, the fill assumes a resting limit takes the trigger price
and is never gapped through, and depth and exit were both chosen by scanning —
though every cell in the exit table is positive, so the choice is between good
options rather than between edge and no edge.

---

## 16. Consolidation — the scalp (not built)

Your rule: in consolidation, the 5M and 15M are the scalp.

So the consolidation trade is a different animal from the pullback — a lower
timeframe scalp inside a range, not a swing continuation. That is consistent with
2–3 swing trades a week from §15 plus scalps on top.

Data arrived: 20,555 bars of 5M (103 days) and 20,591 of 15M (318 days) — the
~20k-bar export cap at each timeframe.

Detection is a 1H job and works: a run of swings carrying both label families,
with no break of structure across the span, is a range. Over 3.6 years the 1H is
in one 24% of the time, 303 episodes, median 15 bars and 65 points tall, about
1.6 a week.

### The scalp itself does not work — as encoded

Execution was built from the machinery already proven on the swing trade: price
sweeps a range edge, a minor shift confirms, the trade goes back into the range,
target a fraction of the way across.

| edge band | within | 15M | | 5M | |
|---|---|---|---|---|---|
| | | n | exp | n | exp |
| 0.10 | 4 | 22 | −0.79R | 12 | −0.15R |
| 0.10 | 8 | 31 | −0.63R | 29 | −0.43R |
| 0.25 | 4 | 41 | +0.28R | 28 | −0.51R |
| 0.25 | 8 | 62 | +0.67R | 62 | −0.47R |
| 0.50 | 4 | 55 | +0.29R | 52 | −0.28R |
| 0.50 | 8 | 101 | +0.50R | 111 | −0.09R |

**The 5M is negative in every cell.** The 15M flips from −0.79R to +0.67R on the
edge-band parameter alone — an arbitrary number that decides how close to the
edge a sweep must be. A rule whose sign depends on a knob nobody chose is not an
edge; it is noise being read as one.

Compare the swing trade, which held its sign across every depth, both
directions, and four calendar years. That is what a real result looks like, and
this is not it.

The likely reason is simple: "the 5M and 15M are the scalp" names a timeframe,
not an entry. The sweep-and-confirm rule tested here was invented to fill the
gap, and the gap is where the answer has to come from.

### A bug in the first sensitivity run

The edge-band parameter was not wired into the function — it was hardcoded — so
the first sensitivity table reported identical numbers for 0.15 and 0.30 and
called it stability. It was caught because two rows of a sensitivity test came
out byte-identical, which they never should. Wired up, the parameter turns out
to decide the sign of the whole result.
