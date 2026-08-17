# Your rules — the system built around how you actually behave

Most trading systems are built for a trader who doesn't exist: unlimited patience, no emotions,
happy to be wrong nine times for one big win. You are not that person, and pretending otherwise is
why two years of correct chart reading produced a break-even account.

So this part is built around what you told me about yourself.

| What you said | What the system does about it |
|---|---|
| "I'm impulsive" | **One trade per day.** Hard-coded. The alert goes quiet after it fires. |
| "Like to trade once a day if an entry shows itself" | Exactly that — and zero if nothing shows |
| "New York intraday only" | Session-locked. Nothing fires outside it. |
| "I like to be right" | **First target at 1R**, hit often. You get to be right, early, in cash. |
| "Emotionally tied to money" | After 1R the stop goes to break-even. **The trade can no longer lose.** |
| "Risking 3 to make 1" | The bracket is placed at entry. All three prices. You never choose again. |
| "Break-even for 2 years" | The runner — the half you used to cut early — is what changes the number |

---

## 1. The actual problem — and it isn't your chart reading

You said it yourself: *"my risk to reward is often risking more than I gain, e.g. a 3 risk and
1 reward."*

Here's what that costs. Risking 3 to make 1 means you need a **75% win rate just to break even**.

| Your R:R | Win rate needed to break even |
|---|---|
| Risk 3 to make 1 | **75%** |
| Risk 1 to make 1 | **50%** |
| Risk 1 to make 2 | **33%** |

You've been trading at 75%-required and landing at break-even, which means you're winning roughly
three out of four. **Your chart reading is fine.** Read that again, because it's the important
part. You are not losing because you can't find setups. You're losing because of what happens
after you're in.

### Why it happens — the mechanism, not the moralising

Two years of "liking to be right" produces two specific habits, and they're the same habit
pointing in opposite directions:

- **In profit**, being right *now* is available. You take it. +1R becomes +0.4R.
- **In loss**, being wrong is only confirmed when the stop fills. So the stop gets moved, or
  mentally ignored. −1R becomes −3R.

Both feel like discipline in the moment. Together they invert your risk-to-reward. The market
isn't doing this to you — the two decisions you make *after* entry are.

**Which is good news**, because a decision made under pressure can be replaced by a decision made
in advance. That's the whole fix.

---

## 2. Your answer on 1:1 — yes, with a condition

You said you believe in 1:1. **You're right, and it fits you better than the 2R/3R targets I put
in the first version.** But 1:1 alone can't be the whole plan, so here's the structure:

```
   ENTRY  ──────────────────────────────────────────────►
     │
     │  stop and BOTH targets go in at entry, in one bracket
     │
     ├─ 1R   →  SELL HALF.  Move stop to break-even.
     │          ↳ You were right. Money is in the account.
     │          ↳ The trade can now never lose. Anxiety over.
     │
     └─ runner → the next HTF high/low, or trailed on the 15m
                ↳ This half is what pays for every loser
```

**Why this is built for you specifically:** the 1R partial gives you the "I was right" hit early
and often — that's the need that has been costing you money, so the system feeds it deliberately
instead of pretending you shouldn't have it. And once the stop is at break-even, the fear that
makes you widen stops has nothing left to act on.

### The math, so you can see it's not a slogan

Say 40% of trades stop out, 35% reach 1R then come back, 25% run to 3R:

| Outcome | Frequency | Result |
|---|---|---|
| Stopped out | 40% | −1.0R |
| Hit 1R, half booked, rest stopped at BE | 35% | **+0.5R** |
| Hit 1R, runner reaches 3R | 25% | **+2.0R** |

**Expectancy = (0.40 × −1.0) + (0.35 × +0.5) + (0.25 × +2.0) = +0.275R per trade**

Note what that feels like: **60% of your trades end positive or flat.** You get to be right most
days. And the account grows, because the 25% pays for the 40%.

Compare it to now: same setups, same win rate, but cutting the winner at 0.4R and letting the
loser reach −3R. That's a losing business with a winning chart read.

**The single change that fixes two years:** place the stop and both targets *at entry*, as one
bracket, and then do not touch them. Not once. Every time you've overridden that, you were making
the decision in exactly the emotional state you're trying to protect yourself from.

---

## 3. Scalp or hold? The system tells you which

You asked to be told when an entry is good for a quick one and when it's worth holding for the
next higher-timeframe high or low. That's now computed at the trigger.

It measures the distance from your entry to the **nearest opposing higher-timeframe level** — the
4H swing, the Daily swing, prior day high/low, overnight high/low — and divides by your risk. That
number is your **room**, in R.

| Room to the next HTF level | Verdict | The plan |
|---|---|---|
| **Under 1R** | **NO TRADE** | You'd be entering into a wall. There's nothing to win. |
| **1R – 2R** | **SCALP** | Single target at 1R. Full exit. Take it and be done. |
| **2R – 3.5R** | **STANDARD** | Half at 1R, stop to BE, rest at the HTF level |
| **Over 3.5R** | **HOLD** | Half at 1R, stop to BE, **trail the rest on the 15m** toward the HTF high/low |

The alert tells you which one you've got, before you click. **This is not a suggestion to
interpret** — it's the plan, decided while you're calm, for a moment when you won't be.

The most valuable line in that table is the first one. "Under 1R" trades look identical to good
ones on the chart. The only difference is that there's no money in them, and that difference is
invisible without measuring it.

---

## 4. One trade a day

You said you like to trade once a day if an entry shows itself. That's now enforced, not
suggested — after the first alert fires, the system goes quiet until tomorrow.

**Why this suits you better than a rule about "being selective":**

You have one bullet. That fact alone does the work that willpower can't — you cannot take a
mediocre setup at 10:15 and *also* take the good one at 14:00, so the cost of impulsiveness
becomes immediate and visible instead of showing up on a monthly statement.

Two things follow from it:

- **Zero-trade days are correct outcomes, not failures.** "If an entry shows itself" means
  sometimes it doesn't. A day with no trade is the system working exactly as designed.
- **Set the minimum grade to A+ while you're establishing this.** With one bullet, spend it well.
  Drop to B only once your journal shows your B-grades actually make money.

---

## 5. New York only

Session-locked, and the system will not fire outside it.

| | Tradeable window | Prime hours (scores a quality point) |
|---|---|---|
| MNQ / MES | 09:30 – 15:00 ET | **09:30 – 11:30** |
| MGC | 08:00 – 13:00 ET | **08:00 – 12:00** |

No overnight. No London-only setups. No 15:50 revenge trade before the close. If you didn't get a
setup in the window, the day is over — and you keep the money you would have donated to the lunch
chop.

---

## 6. The rules that exist purely to protect you from you

These are not negotiable, and each one maps to something you told me.

1. **One trade per day.** Win or lose. When it's done, close the platform.
2. **The bracket goes in at entry** — entry, stop, both targets, one action. Never enter first
   and add the stop after.
3. **Never move a stop away from price.** Not once, not "just this time," not to "give it room."
   This is the rule that ends accounts, and it's the one your instincts will argue hardest against.
4. **Never take profit before 1R.** If you're tempted, that's the exact habit that made you
   break-even. The 1R partial exists so you don't have to.
5. **After the 1R partial, the runner is not your money yet.** Let it hit the target or the
   break-even stop. Both outcomes are fine. Watching it is optional and mostly harmful.
6. **No trade means no trade.** Not a smaller size, not a "starter position."
7. **If you break a rule, log it in the journal that day.** Not to punish yourself — because
   after 30 trades the pattern in your rule breaks will tell you more about your P&L than any
   indicator setting.

---

## 7. What to actually measure

Your journal now logs **planned R** alongside **realised R**. That gap is the single most
important number in your trading, and until now you've had no way to see it.

- **Realised consistently below planned** → you're cutting winners. The most likely finding, and
  the most fixable — it's one behaviour, not a strategy problem.
- **Losses bigger than −1R** → you're moving stops. Serious. Stop trading live and go back to sim
  until it's zero, because this one doesn't stay small.
- **Both clean, still break-even** → *now* it's worth looking at the strategy. Not before.

**Do not judge any of this before 30 trades.** And when you review, review the behaviour first and
the indicator settings second. Two years of evidence says that's where your money is.

---

## 8. One honest thing

Everything above is a structure for making decisions in advance so that fewer of them get made
under pressure. It genuinely helps, and it's the right thing to build.

But being emotionally tied to money is not something a Pine script fixes. If you find yourself
overriding these rules repeatedly — especially rule 3 — the useful response is to reduce size
until the money stops mattering enough to override anything, not to look for a better indicator.
A system you follow at one micro beats a better system you abandon at five.

The other thing that helps more than people expect: trade a size where a full −1R day is genuinely
boring. If a loss ruins your evening, the position is too big, regardless of what the percentage
says.
