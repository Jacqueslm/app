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

- **Where is it trying to go?** — the bigger context. Daily and 4H structure: the bias pair.
  This is the market's *intent*, already visible in what it has done. Higher
  highs on the Daily aren't a prediction that price rises — they're the record that buyers have
  been in control and haven't stopped. You don't guess intent; you read it.
- **What is it saying right now?** — the evidence. The 1H and 15m: acceptance or rejection at
  the level, the sweep, the resumption close. A touch of your level is a question; the market's answer arrives in
  the bars that follow. You don't assume the answer; you wait for it.

**The trigger is nothing more than the moment those two agree** — what the market is saying
right now lines up with where the bigger context says it's trying to go. That's the whole
system. No step in the sequence ever claims to know the future; every step is the market having
*already said* something, on record, in a closed candle.

This is also why the entries are "late" by design — the swing that confirms 3 bars after the
fact, the 2-close acceptance wait, the pullback that has to finish before it counts.
A predictor gets the better price and pays for it at the stop when the guess is wrong. A
listener pays a worse price for the certainty of evidence — and gets to be wrong far less
often. You are always paying one of those two prices. This system chooses the second one,
every time, on purpose.

When you're unsure about a trade, the question is never *"where do I think it's going?"* —
that's the prediction habit sneaking back in. The question is: **"what has it actually said,
and does that agree with the bigger picture?"** If you can't answer with things that already
happened — a close, a hold, a sweep, a reclaim — you have a guess, not a trade.

---

## 1¾. How the system adapts — and how it deliberately doesn't

Every day the market is different. The system handles that in a specific way: **the principles
never change, but the measurements are taken fresh every single day.** Almost nothing in this
system is a fixed number.

| What changes daily | How the system re-measures it |
|---|---|
| Volatility | Nothing is a fixed number of points. Stops come from the swing that actually formed, so a 40-point day and a 400-point day get proportionally identical rules without anything being scaled. |
| Position size | Recomputed every trade from that stop distance, so the dollars at risk stay flat while the point distance does whatever the day requires. |
| The map | The swing highs and lows are re-read every bar. Levels that break stop being levels. |
| The day's character | Read off the four timeframes directly: if they align, there is a trend to trade; if they don't, there isn't. That IS the environment check, and it needs no classifier. |
| The bridge's character | A ranging 4H cannot make higher highs and higher lows, so it fails alignment on its own. |
| Each trade's plan | Scalp / standard / hold decided per trade from measured room — not one exit rule for all conditions. |
| What actually works for YOU | The grader's win-rate-per-grade is computed from your own journal and sharpens every week. |

So the system doesn't "think" the market is trending — it compares the last two swing highs and
the last two swing lows on four timeframes and reports what it found. It doesn't "think" a target
is reachable — it measures the distance to the next opposing swing and divides by the stop.
**Knowing what is actually going on, instead of what it thinks, is precisely what "measured, not
assumed" means — and every gate in this playbook is a measurement of price itself, never a
reading derived from it.**

### The one way it refuses to adapt — on purpose

The system will not rewrite its own rules on the fly, and this is a feature, not a gap.
Systems that continuously re-fit themselves to the last few weeks of data die a specific death:
they finish adapting to a regime at the exact moment the regime ends, forever one lesson behind.
"Adaptive" systems are the best-dressed way ever invented to curve-fit in real time.

What actually changes slowly enough to be worth adapting to — whether a filter earns its place,
whether B-grades make money, whether an instrument suits you — is handled by the only adaptation
loop with a real track record: **journal → 30-trade review → change ONE rule, with a date
written next to it.** That's the deep study. It's slow because the truth arrives slowly, and a
rule changed faster than the evidence isn't adaptation, it's mood.

### Why it stays simple

Underneath everything, this is **one idea**: *trade only where what the market just said agrees
with where the bigger picture says it's trying to go — and measure both instead of assuming
either.* Every gate is that idea pointed at a different lie the market can tell. And every gate
is a toggle, so the backtest can fire any layer that doesn't earn its keep. The system is
allowed to get simpler; it earns its way to complexity, never the reverse. Simplicity wins —
but only *measured* simplicity. Simple and unmeasured is just a hunch with confidence.

---

## 2. Timeframe roles — four timeframes, two pairs

The four split into a **bias pair** (where is it trying to go) and an
**execution pair** (is it going there right now). Both pairs have to agree with
the trade, and with each other.

| | Bias pair | Execution pair | Runs on |
|---|---|---|---|
| **Standard** | Daily + 4H | 1H + 15m | the 1H chart |
| **Scalp** | 4H + 1H | 15m + 5m | the 15m chart |

Scalp mode is the same rule slid down one rung. It is not a different system and
it does not get looser filters — it gets a faster clock.

| TF (standard) | Role | Question it answers | It does NOT |
|---|---|---|---|
| **Daily** | Bias | Which direction am I allowed to trade today? | give entries |
| **4H** | The bridge | Has the pullback finished, or is it still going? | give entries |
| **1H** | Execution | Where exactly do I get in, and where's my stop? | set direction |
| **15m** | Alignment | Is the fast money pointing the same way? | give entries |

"Aligned" means one specific, countable thing: **all four are making higher
highs and higher lows** (long), or lower highs and lower lows (short). Not "look
bullish" — making them, on closed bars, on the record.

The single most common way this system loses money is letting a lower timeframe
answer a higher timeframe's question. A beautiful 1H setup against a bearish
Daily is not a setup. It's a donation.

And the 15m earns its place by being the thing that catches chop without any
chop indicator: **if the 15m won't line up with the 1H, that disagreement IS the
consolidation.** You don't need an ADX reading to tell you the two timeframes
disagree — you can just check whether they disagree.

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
You are waiting for data.

Watch for one thing during step ③: if the pullback **dips below the recent low and snaps back
above it**, that's a liquidity sweep — stops were triggered and something absorbed all of them.
Supply is cleared. That version of the pullback is worth far more than a quiet drift down to the
level, and the system scores it accordingly.

### What the trigger at ⑦ must look like

Both, no exceptions:
1. A 1H **close** above the swing high formed during the pullback (a fresh mini-BOS).
2. The protected low is still intact — no 1H close below it at any point since ②.

### 4½. The pullback entry — the shorter way in

The sequence above is the patient version. There is a second entry, and it is
the one that actually fires most days:

```
   ① all four timeframes aligned                    ← permission
   ② price pulls back far enough to print a
      confirmed swing against the trend             ← the pullback happened AND finished
   ③ price closes back through the swing it
      came from                                      ← the resumption. ENTER.
```

The stop is the pullback swing. If that goes, it wasn't a pullback, it was a
reversal, and you find that out for one R.

**Why both exist.** The retest sequence waits for a level to be broken, given
back, reclaimed and held — four events. The pullback waits for two. The retest
is the higher-quality entry and it is rare; the pullback is the ordinary one and
it is what makes the system tradeable at one trade a day. Both are switchable
independently, and the backtest counts them separately, so you can find out
which one is actually carrying the account instead of assuming.

The thing they have in common is the thing that matters: **neither one predicts.**
Both wait for a close that already happened.

## 5. Chop — caught by structure, not by an oscillator

You don't trade consolidation. The old version of this playbook enforced that
with three computed measures — Kaufman efficiency ratio, range ÷ ATR, ADX. They
are gone, along with every other indicator, because they are readings *about*
price rather than price, and because the gate diagnostic showed the filter stack
rejecting roughly 99% of otherwise valid sequences.

What replaces them is already in the rules and costs nothing:

- **Four-timeframe alignment.** A market in a range cannot produce higher highs
  and higher lows on the Daily, 4H, 1H and 15m at the same time. Chop fails this
  test by construction — that is what chop *is*.
- **Room to the next opposing swing.** Inside a range, the opposing swing is
  close, so room comes out under 1R and the trade is rejected for having nothing
  in it. The range's own edges do the filtering.
- **The protected swing.** Range trades die on it quickly and cheaply.

Two more chop rules that are yours to hold, not the software's:
- **No trades at a level you've already been chopped in today.** One loss at a
  level means that level is now a magnet, not an edge.
- **If the 15m and 1H disagree about direction, stand down.** That disagreement
  *is* the consolidation, and it is now a hard gate rather than an instruction.

## 6. Grading — how a setup becomes A+, B, or a pass

Structure decides **where**. The grade decides **whether this one is worth the
day's only bullet**. The software does neither — it reads swing highs and swing
lows and hands you numbers. **Every box below is ticked by you**, in the grader,
before you click. Nothing auto-ticks, because the judgement is the part that
can't be automated without inventing it.

### Hard filters (any failure = REJECT, no score, no discussion)

- [ ] **All four timeframes aligned.** Daily · 4H · 1H · 15m — or 4H · 1H · 15m ·
      5m in scalp mode. This is the whole permission system. No score overrides it.
- [ ] **Lower TF agrees with the execution TF** — the 15m pointing with the 1H.
      Their disagreement is the chop filter.
- [ ] Protected low/high intact
- [ ] Trigger is a **closed** candle, not a live one
- [ ] Stop distance leaves at least 1 contract at your risk % — if the answer is
      zero contracts, the stop is too wide for the account. Skip it; never shrink it.
- [ ] **Clear of news.** CPI, NFP, FOMC. **Nothing in the software watches the
      calendar** — this one is entirely yours, every single day.
- [ ] Room to run: at least the minimum R of clear air to the next opposing swing

### Score points (one each, 6 available)

1. **First retest** of the level — not the third
2. **Acceptance** — price held above/below the level for 2+ closes after the reclaim
3. **Liquidity sweep** on the pullback — took out the recent low and reclaimed it
4. **Prior-day high/low or one of your drawn zones** sits on the level
5. **In the prime hours** (see §8)
6. **3R+** to the next opposing swing, not just the minimum

| Score | Grade | Action |
|---|---|---|
| 5–6 | **A+** | Full size |
| 4 | **B** | Half size — and with one bullet a day, strongly consider passing |
| 0–3 | **C** | **No trade.** Log it, screenshot it, move on. |

**A grade is not a win probability, and this system will never print one.** The
score counts how many things line up; it says nothing about what happens next.
The only honest probability is your own record — the grader computes your actual
win rate per grade from your journal and shows it beside the verdict once you
have 10+ trades logged at that grade. Until then it shows nothing, because until
then nothing is known. Any tool that displays a win rate before you have traded
it is showing you a number somebody made up.

The C-grade log is not busywork. After 100 of them you'll know whether your C's
actually lose — and that's the only honest way to ever loosen a rule.

## 7. Risk and position sizing

- **Risk per trade: a fixed percentage of the account** — set in one place and
  applied to every trade, good ones included. The software computes the contract
  count from it; you never choose a size under pressure.
- **One trade per day.** Win or lose. When it's done, close the platform. Zero-trade
  days are correct outcomes — "if an entry shows itself" means sometimes it doesn't.
- **Weekly stop: −3R.** Done for the week. This is the rule that keeps you in the
  game through the bad stretch that is coming whether you plan for it or not, and
  the higher the risk percentage, the more load-bearing it is. **Nothing in the
  software enforces this yet** — it is counted by you, in the journal.
- **Never MNQ + MES together** — they are the same trade wearing different hats.
  You'd be taking double risk on one idea while believing you took single.

### What the risk percentage actually costs

Sizing is `floor( (account × risk%) ÷ (stop points × $ per point) )`, so the
dollars risked stay flat whatever the stop distance. That part is solved. What
the percentage decides is how a losing streak feels:

| Consecutive losses | At 1% | At 5% | At 10% |
|---|---|---|---|
| 3 | −3% | −14% | −27% |
| 5 | −5% | −23% | −41% |
| 7 | −7% | −30% | −52% |
| 10 | −10% | −40% | −65% |

Streaks are not the bad case, they're the base case: even at a 60% win rate,
over 100 trades you will very likely see five in a row somewhere. Pick the
percentage you can watch a five-streak happen at without overriding a rule —
because overriding one is what actually ends accounts, and the size that makes
you override is too big regardless of what the arithmetic says.

**Everything ships at 1%.** That is not a guess: the paper record from 7-20 Aug
2026 averaged $1,214 of planned risk on a ~$140,000 account, which is 0.87% a
trade. The software now matches what the trader already does, rather than a
number nobody has ever actually traded.

### Contract specs

| | MNQ | MES | MGC |
|---|---|---|---|
| Name | Micro Nasdaq-100 | Micro S&P 500 | Micro Gold |
| Tick size | 0.25 | 0.25 | 0.10 |
| **Tick value** | **$0.50** | **$1.25** | **$1.00** |
| **Per 1.00 point** | **$2.00** | **$5.00** | **$10.00** |
| Typical 1H stop | 25–60 pts | 5–12 pts | 3–8 pts |

**Contracts = floor( (account × 1%) ÷ (stop in points × $ per point) )**

Example: $25,000 account at 1% = $250 risk. MNQ setup with a 40-point stop.
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
