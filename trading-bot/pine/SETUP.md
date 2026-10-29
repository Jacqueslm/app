# Loading the TBR scalp into TradingView

Two files: `tbr-scalp.pine` is the strategy, this is the click path. Nothing here places
an order by itself — TradingView alerts a bridge, and the bridge places the order.

**Pine cannot be compiled in this workspace.** There is no TradingView here, so the
script has only had a static audit. Step 6 is the part that proves it loads, and it
needs your screen.

## 1. Choose the chart

| what you trade | chart symbol | timeframe |
|---|---|---|
| Micro S&P 500 | `MES1!` | **15 minutes** |
| Micro Nasdaq-100 | `MNQ1!` | **15 minutes** |
| Micro Gold | `MGC1!` | **15 minutes** |

The 15 minutes is not a preference: the rule reads a one-hour candle out of the bars,
and it places a limit the bar after the sweep. On a 1h chart there is one bar per hour
and the retrace has nowhere to fill.

CME real-time data is a paid TradingView entitlement. On a delayed feed the candle
draws anyway and the alert is late — that is worse than no alert.

## 2. Paste it

1. Open the chart above.
2. Bottom panel → **Pine Editor**.
3. Select everything already in the editor and delete it.
4. Paste all of `tbr-scalp.pine`.
5. **Save** (give it the name `TBR scalp`), then **Add to chart**.

The script name appears in the top-left of the chart with a small eye icon. A red
`!` next to that name means a compile error — click it and read the message; the
script did not load.

## 3. Read the chart

Once loaded, during the 09:00 and 15:00 Eastern hours (08:00 and 14:00 Central) you
should see:

| line | colour | what it is |
|---|---|---|
| anchor high | grey | the completed candle's high — a trade above it is the sweep |
| anchor low | grey | the completed candle's low — a trade below it is the sweep |
| candle close (target) | blue | the price the trade is aimed at |
| short retrace | red | the limit price for a short, once the high has been swept |
| long retrace | green | the limit price for a long, once the low has been swept |

Outside those hours nothing is drawn, because nothing is armed.

## 4. Check the Strategy Tester

Open **Strategy Tester** at the bottom → **Overview**.

The script has loaded *and is producing signals* only if you see a bar count, a trade
list, and a non-zero number of trades over the history you have loaded. If it does
not:

| symptom | what it means |
|---|---|
| Red `!` by the script name | compile error. Paste the message; nothing runs until it is fixed. |
| Strategy Tester says "No data" | wrong symbol, or no CME real-time entitlement on this plan. |
| Bars listed, **0 trades**, no error | the chart is not 15m, or the Properties → Date Range excludes the data, or the retrace depth is too deep for the candles (try 30), or few bars are loaded — scroll back and load more history. |
| Trades happen but no lines drawn | not enough history on the chart; scroll back. |
| Trades happen outside 09:00/15:00 Eastern | the clock input is wrong — it must be 8 and 14 on `America/Chicago`. |

One expected difference from the bot's numbers: TradingView can only place the limit
**after** the bar that touched the level has closed, so a fill that happened inside
that bar is missed here and the strategy will take slightly fewer trades. If the trade
count is in the same ballpark and the win rate is not wildly different, the wiring is
right. It is not supposed to match to the dollar.

## 5. The alert

1. **Alt + A** (or the clock icon → **Create Alert**).
2. **Condition** → select `TBR scalp` → **Any alert() function call**.
3. **Expiration** → open (an expiring alert silently stops).
4. **Notifications** → tick **Webhook URL** and paste the URL your bridge gave you.
5. **Create**.

The script calls `alert()` on exactly three events, and only those:

- the bar where the limit entry is placed,
- the bar where a resting limit is cancelled at the end of the window,
- the bar where an open position is flattened at the end of the window.

It does not fire on every bar.

## 6. The payload, for testing the bridge

Paste this into your bridge's test field before you trust the alert:

```json
{"type":"entry","symbol":"MES1!","side":"sell","order":"limit","entry":5312.25,"stop":5319.50,"target":5301.75,"qty":4,"id":"MES1!-1793099400000-sell"}
```

The strategy sends the same shape, with live numbers:

| field | meaning |
|---|---|
| `type` | `entry`, `cancel` or `flatten` |
| `symbol` | `syminfo.ticker` — `MES1!`, `MNQ1!`, `MGC1!` |
| `side` | `buy`, `sell`, `flat` |
| `order` | `limit` for the retrace entry, `market` for the sweep fallback |
| `entry` | the limit price, or `"market"` on the fallback |
| `stop` | the wick behind the sweep |
| `target` | the anchor candle's close |
| `qty` | contracts |
| `id` | `symbol-time-side`, unique per bar |

A cancel looks like `{"type":"cancel","symbol":"MES1!","order":"limit","id":"..."}` and a
flatten like `{"type":"flatten","symbol":"MES1!","side":"flat","qty":4,"id":"..."}`.

## 7. What the bridge has to do — your decision, not mine

I am not picking a broker or a bridge for you. Two questions decide whether any of
this works:

1. **Which broker and which API** — Tradovate, Rithmic, AMP, another? The bridge has to
   be one that supports that account.
2. **Can it REST an order, or only send market orders?** This rule is a limit entry.
   A market-order-only bridge fills at a different price than the rule assumes on every
   single trade, and the Strategy Tester you just read stops describing your account.
   If the answer is market-only, the honest choice is to trade it by hand from the
   chart lines instead.

Whatever you pick, the bridge also has to cover two things the alert cannot:

- **the flatten at the end of the window** — the script sends one, but if it is missed
  the position is still open after the hour the rule says to leave.
- **the stop does not widen** — the stop is the wick at the moment the order was placed.
  If a higher wick prints before the fill, the bot's stop moves and this one does not.

## 8. What this is worth

The retrace rule made money in one place in the research: gold, 30%, 15-minute. Every
other cell lost or changed its answer when the period changed. A Strategy Tester curve
looks convincing on the losing cells too, because it is a chart of the same period.
Read `../README.md` before this goes anywhere near an account with money in it.
