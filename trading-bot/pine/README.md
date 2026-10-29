# Putting the TBR scalp into TradingView

TradingView does not trade. It draws, it backtests, and it fires alerts. Something has
to receive the alert and place the order at your broker.

## 1. The chart

Open the continuous contract you trade — `MES1!`, `MNQ1!`, `MGC1!` — and set the chart
to **15 minutes**. Leave the chart's time zone on the exchange's (CME is Central), or
set it to Central on purpose: the script reads the clock itself from
`America/Chicago`, so it does not matter what the axis says, but you will be reading
the levels off the axis.

Real-time CME data needs a paid TradingView plan. A delayed feed will still draw the
candle, and an alert off it is worse than useless.

## 2. The script

Pine Editor → paste `tbr-scalp.pine` → **Save** → **Add to chart**.

Inputs worth checking before you believe anything:

| input | what it does |
|---|---|
| Morning candle hour | 8, Central. It is the 09:00 Eastern candle. |
| Afternoon candle hour | 14, Central — 15:00 Eastern. |
| Retrace depth | 30, 50 or 70. Run all three; they are different rules. |
| Sweep fallback | the close-based entry when price never comes back to the level. |
| Contracts | 4 by default, matching the backtests. |

Then open the **Strategy Tester** tab and read it against the numbers in
`../README.md`. It will not match to the dollar — different feed, different fills —
but if it is wildly different, something is wrong with the setup, not with the market.

## 3. The alert, and the honest limit

Create an alert: condition = this strategy, "Any alert() function call", expiration
open, webhook URL = your bridge.

A bridge is a third-party service or your own server that turns the JSON the script
sends into an order at Tradovate, Rithmic, AMP or whichever broker holds the account.
TradingView's own broker panel does not do this for futures, and its alerts cannot rest
an order: they can only tell the bridge what to do.

That matters here, because **this rule is a limit order**. If the bridge only places
market orders, it will fill at a worse price than the rule says, and the backtest you
are looking at stops describing what you are trading. Ask before you sign up whether
it can rest a limit and attach a bracket to it.

The alert payload looks like this, so any bridge that takes custom JSON can be wired
to it:

```json
{"side":"sell","symbol":"MES1!","entry":5312.25,"stop":5319.5,"target":5301.75,"kind":"tbr-scalp"}
```

Two things the script does not send, and the bridge has to handle:

- **the flatten at the end of the action hour.** The strategy cancels and closes on the
  next hour's first bar; an alert-driven account does not see that. Either the bridge
  has a time-based flatten, or you place one yourself.
- **the stop widening.** The stop is the wick at the moment the order is placed. If a
  higher wick prints before the fill, the bot's stop moves and this one does not.

## 4. What it is worth reading first

The retrace rule made money on gold at 30% on the 15-minute and lost or flipped
everywhere else. A TradingView strategy tester will happily show you a beautiful
equity curve on any of the losing cells too — that is what a chart of the same period
does. Read `../README.md` before funding anything.
