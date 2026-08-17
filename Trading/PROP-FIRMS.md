# Prop firm evaluations — the trap, the math, and how this system passes them

You asked the system to handle the negative side of prop firms: the drawdown trap, and the way
those firms seduce you into overtrading to pass as fast as possible. Here's the honest picture
first, then what's now built in.

---

## 1. Understand the business you're actually in

A prop firm evaluation is not a job interview. For most of these firms, **the evaluation fee is
the product.** The business model works like this:

- You pay a fee (say $150) for a $50k evaluation.
- The rules are tuned so that a large majority of traders fail — not by rigging, but by
  combining a profit target, a tight trailing drawdown, and a time pressure (real or implied)
  that pushes people into exactly the behaviour that fails.
- Failed traders **reset and pay again.** Repeatedly. The recycling of reset fees from the same
  hopeful traders is a major revenue stream.

None of this means evaluations are unpassable or that funded accounts aren't real — some traders
pass and get paid. It means the *default* behaviour the structure invites is the losing
behaviour, and the firm profits from your urgency. **Their edge is your impatience.** Take the
urgency away and the rules become genuinely beatable.

## 2. The trailing drawdown — read this twice

The single rule that kills most evaluations, and the one you must understand exactly:

A trailing drawdown (say $2,500 on a $50k account) **follows your equity high upward**. Start at
$50k, the floor is $47.5k. Make $1,000, and the floor moves up to $48.5k. Your cushion never
grows — early profits *raise the floor* instead of padding you.

Two versions exist, and the difference is enormous:

- **End-of-day trailing** — the floor moves up based on your closed, end-of-day balance. Bad,
  but manageable.
- **Intraday/unrealised trailing** — the floor moves up with your *open profit peak*. If a trade
  runs +$800 in your favour and comes back to break-even, your floor **rose $800 anyway**. You
  got stopped closer to failure by a trade that made you nothing.

**Check which type your firm uses before anything else.** If you can choose, choose end-of-day
trailing every time. If your firm trails on unrealised highs, the 1R-partial exit model matters
even more — banking the partial *keeps* the equity the trailing floor already consumed.

## 3. The seduction, spelled out

The pitch whispers: *pass in a week — you only need $3,000.* So the trader risks $500–800 a
trade to get there in four or five wins. Here's what that math actually is, with a $2,500
trailing drawdown:

| Risk per trade | Losses to fail | Chance of 4+ straight losses somewhere in a 30-trade eval* |
|---|---|---|
| $800 | **4** | very likely |
| $500 | 5 | likely |
| $300 | 8 | possible, survivable |
| $250 | **10** | you will almost certainly live through it |

*With a ~50% win rate, streaks of 4–5 losses are not bad luck — they are a statistical
certainty over enough trades. A plan that dies to a 4-loss streak isn't a plan; it's a coin-flip
sequence with a fee attached.

**The rule that beats the trap: size to the drawdown, not to the target.**
Risk per trade = trailing drawdown ÷ 8, minimum. $2,500 DD → **$300 max risk per trade.** The
target then takes as long as it takes — typically 4–8 weeks of one-bullet days, not one hot
week. That timeline *is* the price of passing. The firms are counting on you refusing to pay it.

And the quiet corollary: at $300 risk and a +0.3R expectancy, you make roughly $90 per trade on
average. A $3,000 target is ~35 trades — about 7 weeks of one-a-day. **There is no fast pass.
There is only a slow pass or a reset fee.**

## 4. Why this system is already shaped like an eval-passer

Almost everything the evaluation punishes, the system already forbids — not by coincidence, but
because eval rules punish the same behaviours that drain live accounts:

| Eval killer | Already in the system |
|---|---|
| Overtrading to reach the target | **One bullet a day**, enforced |
| Oversizing | Risk % sizing + now the **prop cap** |
| Revenge after a loss | The bullet is spent; the platform closes |
| Marginal setups under time pressure | Hard gates + A+ threshold |
| Holding through news | News rule |
| Overnight positions (banned by most firms) | NY session lock, flat by close |
| One giant win breaching consistency rules | The 1R-partial model produces *even* days by design |

That last row matters more than it looks: many firms have a **consistency rule** (no single day
may exceed 30–50% of your total profit). A slow, even equity curve of +0.5R and +2R days passes
it automatically. One hero trade can literally disqualify an otherwise-passed eval.

## 5. What's now built in — Prop mode

Both the 1H system and the Scout have a **Prop firm guard** group in settings:

- **Prop evaluation mode** (off by default) — flip it on when you're in an eval.
- **Distance to drawdown limit ($)** — your current cushion. **Update it daily**; the script
  cannot see your account, so this number is your morning ritual. Thirty seconds, pre-market,
  same time you confirm bias.
- **Must survive N straight losses** (default 8).

When it's on:

1. **Risk is capped at cushion ÷ N.** The alert tells you the maximum contracts at your stop
   distance: *"PROP: cap 3 contracts ($312 max risk, survives 8 straight losses)."* If even one
   contract exceeds the cap, the alert is suppressed entirely — the trade doesn't exist at your
   account's current size.
2. **A+ only, no override.** B-grades stop alerting in prop mode regardless of your alert
   setting. One bullet + eval pressure + a B-grade is precisely the trade that fails
   evaluations.
3. The dashboard shows the guard live: `$2,500 → cap $312/trade`.

The grader has the same guard: turn on Prop mode there, enter your cushion and remaining
target, and it will cap the position size, warn you when your cushion is inside the trap zone
(fewer than 4 trades of survivable risk left), and tell you honestly how many trades the target
is likely to take at your logged expectancy — so the "pass this week" voice has to argue with
arithmetic instead of with you.

## 6. The rules that pass evals, in one list

1. **Size to the drawdown, not the target.** Cushion ÷ 8, always.
2. **One trade a day. The target takes as long as it takes.** ~35 average trades for a typical
   target is the honest number. Firms profit from people who won't accept it.
3. **Update the cushion number every morning.** Wrong inputs make the cap a lie.
4. **After a partial at 1R, you're playing with house money against the floor** — on
   unrealised-trailing firms this is doubly true: bank the partial, always.
5. **Down 2R-equivalent in cushion during a week? Stop for the week.** A drawdown near the
   floor with an eval deadline is where accounts go to die — a paused eval costs time; a blown
   one costs a fee and your composure.
6. **Never trade the last hour before the firm's daily cutoff** to "get one more in." That's
   the seduction wearing a clock.
7. **When you pass: change nothing.** The funded account has the same trap geometry. Traders
   who pass and then triple size give the account back in a week — that's the *second* fee
   cycle the model counts on.

## 7. The honest limits

- **The scripts can't see your account.** The cushion number is manually entered; stale input =
  wrong cap. Make updating it part of the pre-market sheet.
- **The backtester doesn't simulate trailing drawdown.** Approximate it: your backtest's max
  drawdown (in $ at your prop size) must be comfortably *under* the firm's trailing DD, with
  room to spare. If backtest DD ≥ eval DD, you would have failed historically — pick smaller
  size or don't take that eval.
- **Firms differ.** Trailing type, consistency rules, news rules, scaling plans, payout gates —
  read your specific firm's rulebook line by line before flipping prop mode on, and set the
  inputs to *their* numbers, not the defaults.
