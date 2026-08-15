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
5. Multi-timeframe alignment: external bias from D/4H gating internal 1H/15M.
6. Consolidation state.
7. Displacement, then entry, stop, target.
8. Frequency check against the 2–3 per week constraint.

Nothing at step *n* is built until step *n − 1* has been checked against a real chart.
