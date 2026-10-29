# The paper account

A fake broker for the TradingView script. It takes the alert, keeps a position, and
writes down every fill in dollars at four contracts — and it can never reach a real
exchange, because there is no order routing in it at all.

```
paper/
  server.js        the receiver: POST /alert, POST /price, GET / and /state.json
  lib/engine.js    the account itself — pure, no clock, no network
  page.html        the page it serves
  test/            the arithmetic, checked
  state.json       the ledger it writes (gitignored)
```

## Run it

```bash
cd trading-bot
PAPER_TOKEN=make-up-a-long-word node paper/server.js
```

Then open `http://localhost:8787/`. That page is the account: equity, the open
position, the resting order, every closed trade with its dollars, and a log of what
the account did.

| environment variable | default | what it does |
|---|---|---|
| `PAPER_PORT` | `8787` | the port |
| `PAPER_TOKEN` | none | required on `/alert`, `/price` and `/state.json` — set it |
| `PAPER_CAPITAL` | `10000` | the starting equity |
| `PAPER_COMMISSION` | `0.35` | dollars per contract per side |
| `PAPER_POLL_MS` | `15000` | how often to ask the feed while something is live |
| `PAPER_FEED` | on | set to `off` to place fills by hand with `POST /price` |

Without a token, anyone who finds the URL can post an alert. Set one.

## Point TradingView at it

TradingView needs a public `https://` URL; `localhost` is not reachable from their
servers. For a test on your own machine, a tunnel is enough:

```bash
cloudflared tunnel --url http://localhost:8787     # or: ngrok http 8787
```

It prints a URL like `https://something.trycloudflare.com`. The alert URL is that
plus `/alert?token=YOUR-TOKEN`.

Then, in TradingView: **Create Alert** → condition = the `TBR scalp` strategy →
**Any alert() function call** → expiration open → tick **Webhook URL** → paste the
address → Create.

The script fires on three events only: the bar where the limit is placed, the bar
where a resting limit is cancelled at the end of the window, and the bar where an
open position is flattened at the end of the window.

## The payload it expects

```json
{"type":"entry","symbol":"MES1!","side":"sell","order":"limit","entry":5312.25,"stop":5319.50,"target":5301.75,"qty":4,"id":"MES1!-1793099400000-sell"}
```

`type` is `entry`, `cancel` or `flatten`. A cancel is
`{"type":"cancel","symbol":"MES1!","order":"limit","id":"..."}` and a flatten is
`{"type":"flatten","symbol":"MES1!","side":"flat","qty":4,"id":"..."}`.

Test it without TradingView:

```bash
curl -s -X POST "http://localhost:8787/alert?token=YOUR-TOKEN" \
  -H 'content-type: application/json' \
  -d '{"type":"entry","symbol":"MES1!","side":"sell","order":"limit","entry":5312.25,"stop":5319.5,"target":5301.75,"qty":4,"id":"test-1"}'

curl -s -X POST "http://localhost:8787/price?token=YOUR-TOKEN" \
  -H 'content-type: application/json' \
  -d '{"symbol":"MES1!","price":5312.25}'
```

The second call is the fill: **nothing fills on the alert alone.** The alert says
where the order rests; a price says when it traded.

## How a fill is decided

- **Limit** — fills when a price arrives at or through the level, at the level
  itself. That is what resting at a price means.
- **Stop** — a market order: if the price has gone past it, the fill is the price
  that was seen, not the stop. A gap is a gap.
- **Target** — fills at the target, like a limit.
- **Flatten** — closes at the last price; if there is none yet, it waits for one.

The stop and the target are taken from the entry alert, because Pine's `alert()`
never fires on an exit. One position at a time, and a repeated alert `id` is
ignored rather than doubled.

## The honest limits

1. **The feed is delayed.** Yahoo's free chart endpoint is about ten minutes behind
   for futures. A fill here is what the rule would have got ten minutes ago — fine
   for a rehearsal, useless for scalping the actual tick.
2. **Ten minutes matters for this rule.** The window is one hour long, so a delayed
   fill can land in a bar that has already closed. Treat the log as "roughly what
   the rule did", not as a tick-accurate paper P&L.
3. **A poll is not a tick.** Between two polls the price can cross the stop and come
   back; the account will only ever see the price it was handed.
4. **No margin, no rollover.** The dollars are price move × multiplier × contracts,
   less commission. That is the right arithmetic for a comparison and not a broker
   statement.

For a real paper account with real fills, this folder is not the answer — a broker's
sandbox is, and that is a different build with credentials and a choice of broker.
