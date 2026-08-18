# Market Structure Bot

A paper-trading bot for CME micro futures **MNQ · MES · MGC** that turns your
market-structure playbook into executable rules:

> **Daily / 4H / 1H set the bias → 15m finds the manipulation (liquidity sweep)
> → 5m confirms the break of structure → enter with the bias.**

Zero runtime dependencies (Node 18+, built-in `fetch`). Data comes from the free
Yahoo Finance chart API — no account, no API key.

## Run in TradingView (Pine Script)

There is also a native Pine Script v5 port in `tradingview/` so the same
playbook runs directly on a TradingView chart (which has MNQ1!, MES1!, MGC1!
natively — no data source needed):

- `market-structure-strategy.pine` — full logic + strategy orders, for the
  Strategy Tester backtest.
- `market-structure-indicator.pine` — signals + `alertcondition()` alerts, for
  manual/paper trading with push/webhook alerts.

**Setup:** open a chart for `MNQ1!` / `MES1!` / `MGC1!`, set the timeframe to
**5m**, paste the script into the Pine Editor, and "Add to chart". The script
pulls 15m / 1H / 4H / 1D via `request.security()`, plots the liquidity levels
and sweeps, and marks LONG/SHORT entries. It's the same rule set as the Node
engine, expressed with Pine's confirmed pivots (`ta.pivothigh/pivotlow`).

## Install & run

```bash
cd trading-bot
node src/cli.js scan        # current bias + manipulation + any live signal
node src/cli.js backtest    # replay history with the paper engine
node src/cli.js run         # live paper-trading loop (writes paper/account.json)
node src/cli.js test        # offline unit tests
```

No `npm install` is required — there are no dependencies. The `package.json`
scripts just map to the commands above (`npm run scan`, `npm run backtest`, …).

## The strategy, step by step

1. **Bias (1D / 4H / 1H).** The bot reads market structure on three higher
   timeframes. Daily is the anchor: a bias is only *bull* or *bear* when the
   daily trend agrees with at least one of the 4H/1H trends, otherwise it stands
   aside (`neutral`). "Flat" higher timeframes also count as no edge.
2. **Manipulation (15m).** With a bias set, it watches the 15m chart for a
   liquidity *sweep against the bias* — a candle that wicks through a swing
   low / equal lows (for longs) or swing high / equal highs (for shorts) and
   closes back through it. That is the stop hunt.
3. **Scalp confirmation (15m).** After the sweep, it requires a 15m Break of
   Structure in the bias direction.
4. **Entry trigger (5m).** Finally it requires a 5m Break of Structure in the
   bias direction, and no Change of Character against it since.
5. **Trade plan.** Entry at the 5m BOS close. Stop beyond the manipulation
   extreme (plus a small tick buffer). Targets at 1R and 2R. When price reaches
   1R the stop moves to breakeven, and the runner exits at 2R or breakeven.

Longs and shorts are exact mirrors. A signal id (`MNQ:long:<sweep time>`) keeps
the same setup from being entered twice.

## Commands

- **`scan`** — prints the full breakdown per symbol: per-timeframe trend and last
  BOS/CHoCH, the latest 15m manipulation sweeps, and the active signal (entry,
  stop, T1, T2) when all conditions align.
- **`backtest`** — replays the 5m timeline. Signals are evaluated only at closed
  15m bars and positions are managed on closed 5m bars, so there is no lookahead.
  Reports trades, win rate, R multiples, P&L, profit factor and max drawdown.
- **`run`** — live paper loop. Polls the market, opens paper positions on new
  signals, manages them bar-by-bar, and persists everything to
  `paper/account.json`. Ctrl-C stops and prints the account summary.

## Options

```
--symbols MNQ,MES      which symbols (default: all three)
--source yahoo         live data from Yahoo Finance (default)
--source synthetic     deterministic generated data — offline demos/tests
--poll 60              seconds between polls in run mode
```

## Data notes

- **Source:** Yahoo Finance chart API, symbols `MNQ=F`, `MES=F`, `MGC=F`.
  Intraday history is limited (~30 days of 5m, ~60 days of 15m, ~6 months of
  1h). The 4H chart is aggregated from 1H bars (Yahoo has no native 4H).
- **Rate limits:** Yahoo throttles aggressive polling. The bot caches responses
  in `cache/` and retries with backoff. If it returns `HTTP 429`, wait a few
  minutes or demo with `--source synthetic`. Yahoo data is **delayed** during
  market hours — fine for paper trading, not for live execution.
- **Point values** (P&L in the paper engine): MNQ **$2/point**, MES **$5/point**,
  MGC **$10/point**. Config lives in `config.json`.
- **Synthetic results are not an edge.** `--source synthetic` feeds the engine a
  smooth random walk with clean trends, so backtests look unrealistically good
  (high win rates). It exists only to prove the engine runs offline — evaluate
  the strategy only against real Yahoo data.

## Paper trading only

This bot simulates fills at signal/stop/target prices and never sends orders to
a broker. It is a strategy research tool, not financial advice. Futures involve
substantial risk. If you later want real execution, the signal layer is already
isolated in `src/signal.js` and the data layer in `src/data.js`, so a broker
adapter can be plugged in without touching the strategy.
