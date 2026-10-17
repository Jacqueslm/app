# The process — one trade a day, written down

**Draft v0.1 — 17 Oct 2026.** This is the routine around `METHOD.md`: what is
allowed, what is skipped, and what gets recorded. Every rule has a number or a
yes/no test, so a week can be audited afterwards without memory. Change it only
through section 9.

## 1. The one thing being tested

The setting this process trades is **Sweep inside a zone**, hourly Micro Gold —
the one picked before the corrected session run, and the one whose entry does
not depend on a fib level. Measured over 14 May 2024 – 6 Oct 2026 with
`--zones --ny-close` (see results.md 5e):

| Measure | Value |
|---|---|
| Trades | 19 |
| Win rate | 57.9% |
| Net (1 MGC) | +$644.59 |
| Profit factor | 1.70 |
| Per trade | +$33.93 |
| Worst dip | −$450.54 |

That is **a hypothesis with 19 trades**, not a proven edge. The job of this
process is to trade it the same way every time and collect evidence — not to
improve it after every loss.

Out of the process, with reasons:

- **Fib 30 / 50 / 70** — 27–29 trades under the chart gate, all positive, but
  too few to pick a level. The high-win-rate levels win small and lose big
  (fib 30 averages +$86 a win against −$201 a loss). Paper-trade only; fib 70 is
  the one worth papering.
- **4h + daily alignment** — cuts the zone sample to 6–16 trades. Not enough to
  read, and it did not help on the larger run.
- **15m and 5m** — only 60 days of data, and every setting lost at 5m.
- **The 15:00 range** — under the indicator's 09:30–16:00 NY gate it is only
  complete at 16:00, so the chart cannot take it. Not traded until the session is
  deliberately extended and tested (decision D3).
- **MNQ** — different instrument, different tick value; not tested under this
  gate.

## 2. Instrument and chart

- **MGC** (Micro Gold), one contract. `$10` a point, tick `$0.10 = $1`.
- Signals on the **1-hour** chart, New York time.
- Decisions are made at the **close of a completed 1h bar**. No intrabar entries.
- 15m or 5m may be open for placing orders only. They never create a signal.

## 3. Setup — all five must be true

1. The **09:00 NY hour has completed**; its high and low are fixed (10:00).
2. Price has **closed outside** that range on a completed 1h bar — the sweep.
3. A **later 1h bar closes back inside**:
   - long: `low < range_low` and `close > range_low`, or
   - short: `high > range_high` and `close < range_high`.
   The bar must also close inside the range on the other side
   (`close <= range_high` for a long, `close >= range_low` for a short).
4. That close is **inside the newest zone** — bull zone for a long, bear zone for
   a short — as drawn by `jacques-zones.pine`. Hand-drawn zones do not count.
5. **No position is open**, and no trade has already been taken from this range.

If any is false: no trade. Record `setup_valid=N` and the reason.

## 4. Entry

- Market order in the first minute after the signal bar closes.
- Record both the signal close and the actual fill; the difference is slippage.
- No limit-order entry at a fib level (untested), no averaging, no second entry,
  no re-entry after a stop.

## 5. Stop, target, exit

- **Target / exit (the method):** a completed 1h close beyond the far edge —
  long: close above the range high; short: close below the range low. Exit at
  that close.
- **Stop (the method):** a completed 1h close beyond the near edge — long: close
  below the range low; short: close above the range high. This is a
  **close-through stop, not a working order**. The chart and the backtest both
  decide on closes; intrabar price through the level is not the exit.
- **Disaster stop:** a resting order at **2× the range height beyond entry**, to
  cap an overnight gap. It is not part of the edge. If it fires, record
  `exit_reason=disaster` and still count the P&L.
- **No time stop.** A position may be held overnight. The next 09:00 range does
  not cancel it, and no second position is opened while it is on.
- No manual exit for feelings, news, or one red candle. The only manual exit is a
  kill switch in section 8.

## 6. Size and limits

- Risk unit **R** = |entry − near edge| in points × `$10` (one MGC).
- Risk budget **1% of equity**. `contracts = floor(0.01 × equity ÷ (R_points × 10))`,
  capped at **1** until the forward test is complete.
- If one contract would risk more than 1%, **skip** (`reason=skip_risk`). Never
  round up to make a trade happen, and a skipped setup is not replaced by a later
  one — one attempt per range.
- The disaster stop can turn a normal 1R loss into about **2R** in a gap (≈2% of
  equity). That is the true worst case, and it is why the contract count is
  capped at one.
- **One trade per day.** The range fixes one direction, so this is a cap, not a
  target.
- **Weekly stop:** −3R → stop for the week. The account switches are in section 8.
- Costs: enter the actual all-in commission and slippage. The backtest's `$1.18`
  a trade is optimistic for retail and is not a target.

## 7. The day (all times New York)

- **08:45 — calendar.** Note high-impact releases and the contract/roll. If a
  release falls between 09:00 and 10:00, or the contract rolls today, no trade
  (`reason=skip_news`).
- **09:00–10:00 — the range forms.** No orders.
- **10:00 — write the row.** Range high, low, height, active zone top/bottom.
  Set alerts at both edges and at the zone bounds.
- **11:00–16:00 — check every completed 1h bar** against the five tests: the
  10:00 bar's close through the 15:00 bar's close. The first valid setup is the
  trade. After it closes, the day is done.
- **16:00 — the 15:00 bar's close is the last signal.** No entries after it;
  manage anything open, finish the journal row, screenshot the chart.
- **After 16:00 — nothing.** No "one more" in the evening.

## 8. Journal, scorecard, kill switches

One row per trading day, in `trading/journal.csv` (copy
`trading/journal-template.csv` to start it; the filled file is gitignored and
stays on your machine), filled at 10:00 and closed out when the day ends. No-setup days are rows too — they are how adherence is measured.

Field meanings that are easy to get wrong:

- `setup_valid` — the five tests in section 3, nothing else. `decision` is
  `enter` or `skip`; `reason` is `valid`, `skip_no_setup`, `skip_risk`,
  `skip_news`, `skip_rule` or `skip_platform`.
- `zone_side` — `bull`, `bear` or `none`.
- `signal_close` vs `entry_price` — the bar close that triggered, and the fill.
  The gap is slippage; it is measured, never estimated away.
- `reward_risk` — (target − entry) ÷ (entry − stop), both in points. Below 1.0 is
  allowed; record it, do not talk yourself out of the rule.
- `R_multiple` — net dollars ÷ `risk_usd`. This is the number every review uses.
- `mae_pts` — worst adverse excursion in points while the trade was open (from
  1m bars after the fact). It measures whether the close-only stop is survivable.
- `rules_followed` — `Y` only if every rule in sections 3–6 was followed; any
  break gets `N` and a sentence in `deviation`.
- `exit_reason` — `target`, `stop`, `disaster`, `manual` or `platform`.

**Weekly scorecard** (Sunday, from the journal, not from memory):

| Metric | Target |
|---|---|
| Journal completeness | 100% of trading days |
| Adherence | ≥ 95% of valid setups taken; 0 unplanned entries |
| Rule breaks | 0 |
| Average slippage | ≤ 0.1R |
| Sample | `n` reported with every number |
| Performance | net R, expectancy R, win %, PF, max drawdown |

**Benchmark:** the chart-gate backtest is **+0.30R a trade over 19 trades**
(+$33.93 ÷ about $112 of risk). Anything within ±0.3R over fewer than 30 trades
is noise.

**Kill switches:**

- 3 rule breaks in a week → stop for the week; review the journal.
- −6% from the equity peak → **half size** until 10 new trades.
- −10% from the equity peak → **stop**; no live trade until a written review and
  20 paper trades.
- 5 losses in a row → check adherence and the journal; **do not change the
  rules**. At a 58% win rate, five losses happen about once every 70 trades.
- Platform or data failure → no trade.

## 9. Change control

- Rules are versioned; this is **v0.1**. A change is a new version, dated.
- **One change at a time.** Written hypothesis: what, why, and what result would
  prove it wrong.
- Backtest on his own single-contract export before live.
- **20 paper trades → 20 live at half size → full size.**
- Never change a rule mid-trade or in the hour after a loss.
- **30 trades before judging** the process; **50 before changing** it.

## 10. Known gaps to close before trusting the numbers

- 19 zone+sweep trades under the chart gate. The 48-trade figure in results.md
  includes evening entries the chart cannot take (5e).
- The Yahoo series are continuous contracts with roll seams. A TradingView
  export of **MGCZ2026** is the honest file; `backtest.js` reads it as-is.
- The backtester fills at the bar close and does not model slippage, gaps, or a
  disaster stop.
- No out-of-sample test and no walk-forward.

## 11. Decisions needed from Jacques

- **D1 — risk:** 1% of equity ($250 on 25K, one contract) or 0.5% ($125, which
  will skip more trades)? Draft assumes 1%.
- **D2 — setting:** sweep only, or paper-trade fib 70 beside it?
- **D3 — 15:00 range:** drop it, or define an evening session and test it?
- **D4 — overnight:** hold with the 2× range disaster stop, or close by 16:00
  (untested)?
- **D5 — news:** stand aside for high-impact releases, or trade through them?

Answer these and this becomes v1.0 — the version the journal runs on.
