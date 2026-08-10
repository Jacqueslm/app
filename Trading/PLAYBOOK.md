# Market Structure Bridge — Trading Playbook

Your system, written down. MNQ / MES / MGC. Daily bias → 4H bridge → 1H execution → 15m management.

This is the rulebook. The indicator and the grader both enforce what's written here. If the
playbook and the software ever disagree, the playbook wins and the software is the bug.

---

## 1. The one-sentence version

**Trade the retest of a broken daily-aligned structure level, entered on a 1H confirmation,
only when the 4H agrees and nothing in the 1H-or-lower is in a range.**

---

## 1½. The stance — listen, don't predict

Neither this system nor the Scout predicts the market. Nothing here forecasts a price. Both do
something different: **they listen to what the market is saying, and read where it is trying to
go, from the bigger context down.**

The two are separate questions, and every rule in this playbook belongs to one of them:

- **Where is it trying to go?** — the bigger context. Daily and 4H structure, yesterday's value,
  the day type. This is the market's *intent*, already visible in what it has done. Higher
  highs on the Daily aren't a prediction that price rises — they're the record that buyers have
  been in control and haven't stopped. You don't guess intent; you read it.
- **What is it saying right now?** — the evidence. Acceptance or rejection at the level, RVOL,
  the sweep, displacement. A touch of your level is a question; the market's answer arrives in
  the bars that follow. You don't assume the answer; you wait for it.

**The trigger is nothing more than the moment those two agree** — what the market is saying
right now lines up with where the bigger context says it's trying to go. That's the whole
system. No step in the sequence ever claims to know the future; every step is the market having
*already said* something, on record, in a closed candle.

This is also why the entries are "late" by design — the swing that confirms 3 bars after the
fact, the 2-close acceptance wait, the day type that misses the first hour of some trends.
A predictor gets the better price and pays for it at the stop when the guess is wrong. A
listener pays a worse price for the certainty of evidence — and gets to be wrong far less
often. You are always paying one of those two prices. This system chooses the second one,
every time, on purpose.

When you're unsure about a trade, the question is never *"where do I think it's going?"* —
that's the prediction habit sneaking back in. The question is: **"what has it actually said,
and does that agree with the bigger picture?"** If you can't answer with things that already
happened — a close, a hold, a sweep, a reclaim — you have a guess, not a trade.

---

## 2. Timeframe roles — each one has exactly one job

| TF | Role | Question it answers | It does NOT |
|---|---|---|---|
| **Daily** | Bias | Which direction am I allowed to trade today? | give entries |
| **4H** | The bridge | Has the pullback finished, or is it still going? | give entries |
| **1H** | Execution | Where exactly do I get in, and where's my stop? | set direction |
| **15m** | Management | Is the trade behaving? Where do I trail / take partials? | give entries |

The single most common way this system loses money is letting a lower timeframe
answer a higher timeframe's question. A beautiful 1H setup against a bearish Daily is
not a setup. It's a donation.

---

## 3. Market structure — the definitions the software uses

A **swing high** is a candle high with `N` lower highs on each side (default N = 3).
A **swing low** is the mirror. Nothing counts as a swing until it has `N` bars to its right —
that means structure confirms *late*, on purpose. Late and objective beats early and imaginary.

- **Bullish structure** = higher highs and higher lows.
- **Bearish structure** = lower lows and lower highs.
- **BOS (break of structure)** = a candle **closes** beyond the most recent confirmed swing.
  Wicks through do not count. Ever.
- **The broken level** = the swing high (or low) that the BOS closed through. This is the level
  you will trade the retest of. Call it the **HH break level**.
- **Protected low** (bullish) = the last swing low made *before* the up-BOS. If price closes
  below it, the setup is dead — not "pulling back deeper," dead.

---

## 4. The sequence — your setup, step by step

Bullish version. Bearish is the exact mirror.

```
   ①  Daily is bullish (HH + HL)                      ← permission
   ②  1H closes ABOVE a swing high        ── BOS ──►  ← the HH break. Mark the level.
   ③  Price trades back BELOW that level              ← the "break back below"
   ④  Price returns UP to the level and closes above  ← the reclaim
   ⑤  WAIT — it must HOLD for 2+ closes             ← acceptance. This step is the edge.
   ⑥  Check the 4H: still bullish, pullback done?     ← the bridge
   ⑦  1H prints a fresh bullish BOS off the level     ← the trigger. ENTER.
   ⑧  Manage on the 15m                               ← trail, partials, exit
```

**Step ⑤ is the whole system.** Everybody can see step ②. Most people enter at ④ and get
stopped by the second dip. You are paid for waiting from ④ to ⑦ — that's the difference
between "price touched my level" and "price *reacted* to my level."

And there's a concrete reason the wait works, not just a disciplinary one. A touch of a level is
a **question**; the market answering it takes time. Price holding above the level for two closes
is **acceptance** — the market agreeing the level is support. Price closing back through it is
**rejection**. At step ④ that information does not exist yet. You are not waiting to be patient.
You are waiting for data. (See [INSTITUTIONAL.md §3](INSTITUTIONAL.md).)

Watch for one thing during step ③: if the pullback **dips below the recent low and snaps back
above it**, that's a liquidity sweep — stops were triggered and something absorbed all of them.
Supply is cleared. That version of the pullback is worth far more than a quiet drift down to the
level, and the system scores it accordingly.

### What the trigger at ⑦ must look like

All three, no exceptions:
1. A 1H **close** above the swing high formed during the pullback (a fresh mini-BOS).
2. The protected low is still intact — no 1H close below it at any point since ②.
3. The trigger candle has **displacement**: body ≥ 1.2× the average body of the last 20 bars.
   A doji reclaim is not a trigger, it's a coin flip.

---

## 5. The consolidation filter — your "I don't trade chop" rule, made objective

You said you don't trade consolidation, especially inside the 1H range. "It looks choppy"
is not a rule you can follow at 9:47am with money on the line, so here it is as numbers.

Three measures, computed on the 1H (and cross-checked on the 15m):

| Measure | What it catches | Chop when |
|---|---|---|
| **Efficiency Ratio** (Kaufman, 20 bars)<br>`\|close − close[20]\| ÷ Σ\|close − close[1]\|` | Price travelling a lot but going nowhere | **< 0.30** |
| **Range ÷ ATR** — 20-bar high-low range divided by ATR(14) | A tight box | **< 3.0** |
| **ADX(14)** | Absence of trend | **< 18** |

**If two or more fire, the setup is rejected.** No override, no "but it looks like it's about
to break." The market is inside somebody's range and you are the liquidity.

Two more chop rules that are yours to hold, not the software's:
- **No trades inside a level you've already been chopped in today.** One loss at a level
  means that level is now a magnet, not an edge.
- **If the 15m and 1H disagree about direction for more than 3 bars, stand down.** That
  disagreement *is* the consolidation.

---

## 6. Grading — how a setup becomes A+, B, or a pass

Structure decides **where**. Context decides **whether anyone is there**. Both must pass.
The reasoning behind every context item is in **[INSTITUTIONAL.md](INSTITUTIONAL.md)** — read it
once and these stop feeling like arbitrary boxes.

### Hard filters (any failure = REJECT, no score, no discussion)

- [ ] **All four timeframes aligned — Daily · 4H · 1H · 15m.** The thing that makes this
      strategy a go. If the four don't agree, executing is off the table; no score overrides it.
- [ ] Daily bias agrees with the trade direction
- [ ] 4H bridge agrees — 4H structure not broken against you
- [ ] Consolidation filter clear (fewer than 2 chop measures firing)
- [ ] Protected low/high intact
- [ ] Trigger is a **closed** 1H candle, not a live one
- [ ] **On the correct side of VWAP** — long above, short below
- [ ] **Not stretched beyond the 2σ VWAP band** — that's where benchmark algos become sellers
- [ ] **The day's range budget isn't spent** — price hasn't already travelled ≥85% of the daily
      ATR in your direction ([PRO-ANALYSIS.md §4](PRO-ANALYSIS.md))
- [ ] **Not buying a breakout of a ranging 4H** — if the 4H is in balance and price is beyond
      its range edge without 3+ closes of acceptance, that break is the trap, not the move
      ([INSTITUTIONAL.md — the range trap](INSTITUTIONAL.md))
- [ ] Stop distance ≤ your max ($ risk still within 1% at 1 contract)
- [ ] Not inside the last 10 minutes before a red-folder news release
- [ ] Room to run: ≥ 2R of clear air before the next opposing HTF level

### Score points (one each, 13 available)

**Structure**
1. **First retest** of the level — not the third
2. **Acceptance** — price held above/below the level for 2+ closes after the reclaim
3. **Displacement** on the trigger candle (body ≥ 1.2× avg)
4. **≥ 3R** to the next opposing level, not just 2R

**Context**
5. **RVOL ≥ 1.2** for this hour of day — is anyone actually there
6. **Liquidity sweep** on the pullback — took out the recent low and reclaimed it
7. **Reference-level confluence** — prior day H/L, settlement, overnight H/L, initial balance, **or one of your Daily/4H supply-demand zones** (drawn on the chart: green demand, red supply)
8. **Correlated instrument agrees** — MNQ ↔ MES
9. **In the prime hours** (see §8)
10. **Zero chop measures firing** — not merely under the limit

**The day** ([PRO-ANALYSIS.md](PRO-ANALYSIS.md))
11. **Day type agrees** — 2+ closes accepted beyond yesterday's value in your direction.
    A continuation setup on a balance day is the losing pattern in the winning one's clothes.
12. **Beyond yesterday's value** — initiative territory, not the fair-price middle.
13. **Liquidity fuel** — the far edge of the 4H range was raided and failed. Those stops are
    collected; the tank is fuller in your direction.

| Score | Grade | Quality | Action |
|---|---|---|---|
| 10–13 | **A+** | 77–100% | Full size |
| 8–9 | **B** | 62–69% | Half size — and with one bullet a day, strongly consider passing |
| 0–7 | **C** | ≤ 54% | **No trade.** Log it, screenshot it, move on. |

**On percentages, so it's written down:** the quality % is confluence — how many boxes the setup
ticks — and it is **not** a win probability. No indicator can print a real win probability; any
tool that claims "90% win rate" on a signal is inventing the number. The only honest probability
is your own record: the grader computes your **actual win rate per grade** from the journal and
shows it next to the verdict once you have 10+ logged trades at that grade. That number is real,
it's yours, and it sharpens every week you log. Trust it over any percentage a chart gives you —
including this system's.

**Every context filter is a switch in the indicator.** That's deliberate — nobody, including me,
gets to assert that a filter helps. Backtest with the context layer off, then on, and keep what
your own data supports.

The C-grade log is not busywork. After 100 of them you'll know whether your C's actually
lose — and that's the only honest way to ever loosen a rule.

---

## 7. Risk and position sizing

- **Risk per trade: 1% of account.** Not 1% "unless it's a really good one."
- **In a prop evaluation: cushion ÷ 8 caps every trade**, and A+ only. The eval trap and the
  full math are in [PROP-FIRMS.md](PROP-FIRMS.md) — read it before paying any firm a fee.
- **One trade per day.** Win or lose. When it's done, close the platform. Zero-trade days are
  correct outcomes — "if an entry shows itself" means sometimes it doesn't.
- **Weekly stop: −3R.** Done for the week. This is the rule that keeps you in the game through
  the bad stretch that is coming whether you plan for it or not.
- **Never MNQ + MES together** — they are the same trade wearing different hats. You'd be taking
  2% risk on one idea while believing you took 1%.

### Contract specs

| | MNQ | MES | MGC |
|---|---|---|---|
| Name | Micro Nasdaq-100 | Micro S&P 500 | Micro Gold |
| Tick size | 0.25 | 0.25 | 0.10 |
| **Tick value** | **$0.50** | **$1.25** | **$1.00** |
| **Per 1.00 point** | **$2.00** | **$5.00** | **$10.00** |
| Typical 1H stop | 25–60 pts | 5–12 pts | 3–8 pts |

**Contracts = floor( (account × 1%) ÷ (stop in points × $ per point) )**

Example: $25,000 account, 1% = $250 risk. MNQ setup with a 40-point stop.
40 × $2 = $80 per contract. $250 ÷ $80 = 3.1 → **3 contracts**, $240 actual risk.

If the answer is 0 contracts, the stop is too wide for the account. **Skip the trade.**
Do not shrink the stop to fit the size — that's how a good setup becomes a bad loss.

### Targets — the 1R partial model

Full reasoning in **[YOUR-RULES.md](YOUR-RULES.md)**. The short version: risking 3 to make 1
needs a 75% win rate to break even, which is why two years of good chart reading produced a flat
account. This structure fixes the ratio without asking you to stop wanting to be right.

- **T1 at 1R — take half off, move the stop to break-even.**
  You were right, the money is real, and the trade can no longer lose. That is the whole point:
  it feeds the need that has been costing you money instead of pretending you shouldn't have it.
- **T2 = the next opposing HTF level** — not a fixed multiple. The system measures it for you.
- **Runner** on a HOLD: trail under 15m swing lows.

**The stop and both targets go in at entry, as one bracket.** Then you don't touch them. Every
loss bigger than −1R in your journal is a stop you moved, and that single habit is what turns a
winning chart read into a break-even account.

### Which plan — scalp or hold?

Measured at the trigger as **room** = distance to the next opposing HTF level ÷ your risk.

| Room | Plan | What you do |
|---|---|---|
| **< 1R** | **NO TRADE** | Entering into a wall. Looks identical to a good setup; there's no money in it. |
| **1–2R** | **SCALP** | Single target at 1R, full exit, done for the day. |
| **2–3.5R** | **STANDARD** | Half at 1R, stop to BE, rest at the HTF level. |
| **> 3.5R** | **HOLD** | Half at 1R, stop to BE, trail the rest on the 15m to the HTF high/low. |

---

## 8. Session windows

Times are US Eastern.

**MNQ / MES**
- **09:30 – 11:30** — the money window. Most A+ setups live here.
- 11:30 – 14:00 — lunch chop. The consolidation filter will usually reject these anyway.
  Trust it.
- 14:00 – 15:30 — second window, smaller size, only A+.
- After 15:30 — no new entries. Manage what you have.

**MGC**
- **08:00 – 12:00** — London/NY overlap, the cleanest structure of the day.
- Watch the London 03:00 open for the 4H bridge to set up; execute in the NY window.

**Never enter:** 10 minutes either side of CPI, NFP, FOMC, or the FOMC presser. Check the
calendar Sunday night and write the week's red folders on a sticky note.

---

## 9. Daily routine

**Sunday, 30 minutes**
- Mark Daily structure on MNQ, MES, MGC. Write the bias for each: bullish / bearish / no-trade.
- Note the week's red-folder news.
- Review last week's journal: grade distribution, expectancy by grade, and every rule break.

**Pre-market, 15 minutes**
- Confirm or update the Daily bias (has yesterday's close changed anything?)
- Mark 4H structure and the levels in play.
- Set TradingView alerts on the HH break levels for each symbol.
- Write down, before the open: *"Today I am looking for a long on MNQ at 20,4xx."*
  If you can't write the sentence, you don't have a plan, you have a hope.

**During**
- Only look at charts when an alert fires. The screen-watching is what makes you take C's.
- Every setup — taken or not — goes in the grader.

**After close, 10 minutes**
- Log outcomes. Screenshot every trade at entry and exit.
- One line: what did I do that the playbook doesn't say to do?

---

## 10. The rules that are actually hard to keep

Read these out loud on a losing day.

1. **A missed trade costs zero.** A forced trade costs 1%.
2. **The setup is not the level — it's the reaction to the level.** No reaction, no trade.
3. **Two losses and you're done for the day.** The third trade after two losses is revenge
   wearing a chart pattern.
4. **You do not trade the news, you trade the structure after the news.**
5. **If you have to zoom in to see the setup, it isn't there.**
6. **Never move a stop away from price.** Not once. This is the rule that ends accounts.
7. **Consolidation is not "pre-breakout."** It's consolidation until a BOS says otherwise.

---

## 11. Review cadence

- **Weekly** — expectancy by grade. If your B's have negative expectancy, stop taking B's.
- **Monthly** — expectancy by symbol and by session hour. Cut whatever loses. Most traders
  are profitable in one instrument and one window and give it all back everywhere else.
- **Quarterly** — and only quarterly — consider a rule change. One change at a time, with a
  written reason and a date. Never change a rule during a drawdown.

**Minimum sample before you judge anything: 30 trades.** Twenty trades tells you nothing
except how you feel.
