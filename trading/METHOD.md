# The method — Jacques, written down so no session asks again

## The range candle (TBR)

- The candle at the chosen hour **is** the range. Its own high and low. Nothing to
  do with structure.
- Price runs away from the candle, then comes back.
- Times: **9:00 and 15:00 New York** (= his 8am and 2pm Central). Chart must be **1 hour**.
- **Timeframes:** daily and 4h = the big picture, hourly = alignment, 15m and 5m =
  execution.
- **Daily and 4h are the big picture.** They say whether the market is trending or
  in consolidation. That is the context every lower timeframe is read in — if the
  daily and 4h disagree with the hourly, there is no alignment and no trade.
  Confirmed 5 Oct 2026.
- The range candle is rebuilt from the chart bars of the 9:00 and 15:00 NY hours,
  so the bot works on any timeframe that divides the hour (1h, 15m, 5m).
- **The zones are not tied to one timeframe.** They work on **all timeframes**, like
  the LuxAlgo zones indicator.

## Entries — the scalp play

- **Fib:** price returns to the chosen level and holds inside the candle.
- **Sweep:** enters when price takes the candle's high (short) / low (long) and comes back inside. Exit is the same out-of-range exit below.
- Levels: **30 / 50 / 70**.
- **Sweep does not use the level.** Sweep 30, Sweep 50 and Sweep 70 are the same
  trades. One Sweep run covers all three.

## Exit and stop

- **Out:** price trades back out of the candle. Long done when it closes back above
  the candle's high, short when it closes back below the low. Comment `out of range`.
- **Stop:** the far side of the candle. A long also closes below the low, a short
  also closes above the high. Cannot trip on the entry bar — both entries finish
  with price back inside the range.

## Scalps and bigger moves

- **The TBR (range candle) is for scalps.** The entries (Fib / Sweep) are the scalp
  play.
- **The zones are for bigger moves.**
- **The zones come from the zone indicator** — the LuxAlgo DTFX-style one already
  in this repo (`trading/lux-dtfx-algo-zones.pine`), the same one used for the bot.
  Not drawn by hand.
- **The zones work on all timeframes** — like the LuxAlgo one. Not hourly-only.
- The zone identification is now built into `trading/jacques-zones.pine` (swing
  structure, break of structure / change of character). That bot draws the zones
  and can trade only inside one, with the "Trade only inside a zone" tick box.
- Do not ask "which candle makes a zone" or "what timeframe are the zones on".
  Settled: the zone indicator, on all timeframes.

## Zones must stay until tested

- An untested zone stays in place until price comes back and tests it.
- Price can interact **anywhere** in the zone — 30, 50, 70, a sweep of the edge, or
  just a touch of the top. Not only 50.
- The earlier "tested at 50" rule was too narrow. Dropped.

## Testing it — `trading/backtest.js`

- Added 6 Oct 2026. Node, no packages: `node trading/backtest.js prices.csv`.
- It runs both entries (Fib and Sweep), all three Fib levels, and can add the two
  filters the method asks for — `--zones` (only inside a zone) and `--align` (only
  when 4h and daily agree).
- It prints one row per setting — trades, wins, losses, win %, net, profit factor,
  per trade and worst dip — so the level with the best record is measured, not
  guessed. `--pv` and `--cost` set money per point and cost per trade.
- Takes a TradingView CSV export as-is (any timeframe that divides the hour).
- The zone half is the same logic as `trading/jacques-zones.pine`, so the chart
  and the test agree about what a zone is. The 4h/daily alignment is the simple
  version: a frame counts up when it closes above its own average. Plain, so it
  can be argued with.
- `node trading/backtest.js --selftest` checks the engine on a made-up 4-bar
  fixture. It is not a result.
- **Not yet run on real prices** — no market data lives in this repo. Until it
  is, every number it prints is whatever is in the file it is handed.

## One bot

- `Jacques TBR Zones` is one script. The zones **are** the TBR. Any second row in
  the legend with an eye is a spare copy on the chart, not a second bot.

