# The TradingView bot — switch it on when you're ready

The pieces are built and tested. TradingView fires the signal, the relay on
your PC receives it and hands NinjaTrader the order — market entry, half off
at T1, half at T2, everything protected by the stop. You do nothing.

It ships **OFF** and pointed at **Sim101** (fake money). Nothing trades until
you flip it.

## Turn it on (10 minutes, whenever you want)

1. **Update the relay** — double-click `Update System.bat` in the Trading folder.

2. **Tell NinjaTrader to accept orders** — in NinjaTrader:
   Tools → Options → Automated trading interface → tick **AT interface** → OK.

3. **Flip the switch** — open the **Bot switch** link the relay prints when it
   starts (`http://localhost:4410/bot/...`) and tap **TURN AUTOTRADE ON — Sim101**.
   The same page has the numbers: balance, risk %, trades per day, max lots.
   Turning it on from the page only works on Sim101 — a real account is a
   deliberate edit of `relay\autotrade.json`, on purpose.

   Size is computed, not fixed: `floor( (balance × riskPct%) ÷ (stop points ×
   dollars per point) )`, using the stop distance from the alert. So the dollars
   at risk are the same on a tight stop and a wide one — but **a stale `balance`
   makes every trade the wrong size in the same direction**, so keep it current.

4. **Restart the relay** — close the MSB Alert Relay window and double-click
   `TURN ON AUTO.bat` again. It starts the tunnel too.

5. **Create the alert** — on the MNQ chart: Alt+A → Condition **MSB Trap** (or MSB Pure if you run that one) →
   **TRADE SIGNAL — the full alert** → Trigger **Once per bar close** →
   don't touch the Message → Notifications → Webhook URL:
   `https://explicit-sprung-produce.ngrok-free.dev/hook/f033aaa171b113d6`
   → Create. Same again on MES.

That's the whole thing. When a signal fires you'll see `🤖 AUTOTRADE` in the
relay window and the position appears in NinjaTrader — on Sim101.

## Going live later

Open `relay\autotrade.json`, change `"Sim101"` to your funded account's name
(shown in NinjaTrader's account dropdown), save, restart the relay. That one
word is the difference between practice and real money.

## The one thing this path cannot do

The relay writes an order file into NinjaTrader's incoming folder and never hears
back. It doesn't know when T1 filled, so **it cannot move your stop to break-even
after 1R** — the runner keeps the original stop all the way to T2. A trade that
reaches +1R can still come back and lose the full R.

That is the exact pattern YOUR-RULES was written to stop, so:

- **2+ contracts** — half comes off at 1R, and that much is banked whatever happens.
- **1 contract** — it takes the full 1R and is done, rather than riding to T2
  against the original stop.

If you want break-even after 1R, run **`ninjatrader/MSBPure.cs`** instead. It lives
inside NinjaTrader, sees its own fills, and moves the stop itself. TradingView and
the relay drop out of the order path entirely — fewer things that have to be
running at 09:30.

---

## What has to be true for it to trade

Computer on · relay window open · ngrok window open · NinjaTrader running with
AT interface on. If any of those is missing, alerts still reach your phone —
they just don't become orders.

## The safety rails — what stands between an alert and an order

Every alert passes through six checks before it becomes an order. Each one can
only ever **block** a trade, never create one, and every decision — placed or
blocked — is printed in the relay window and written to `relay\alerts.log` so
you can always audit what the bot did and why.

| Rail | What it stops |
|---|---|
| **Kill switch** | You, from your phone. Open the Bot switch page (TURN ON AUTO opens it; the address is printed when the relay starts), hit **KILL**. No orders until you re-arm. Survives restarts. |
| **One a day** | A second signal after the bullet is spent. Counted in `relay\state.json`, so restarting the relay does not reload the gun. Change it with `maxPerDay` in `autotrade.json`. |
| **Duplicates** | TradingView retrying a webhook, or an alert double-firing. The identical alert inside 10 minutes places once, not twice. |
| **Session gate** | Stale alerts. An alert that lands outside that instrument's ET window (delayed webhook, relay started mid-day, weekends) is describing prices that no longer exist — it's logged, not traded. |
| **Sanity check** | Mangled alerts. Stop, T1 and T2 must sit on the correct side of entry, and the stop can't be wider than `maxRiskPts` for the instrument. A garbled message fails here instead of becoming a naked position. |
| **Rollover** | An expired contract month in `autotrade.json`. Expired blocks the order; the contract's own delivery month gets a loud warning at startup and on every fill. |

The **/bot page** is the one to bookmark on your phone: ARMED/KILLED status,
which account it's pointed at (red if it's not Sim101), bullets left today,
contract months with rollover warnings, and the last 20 decisions.

The kill switch stops **new** orders only. Anything already working in
NinjaTrader stays yours to manage — flatten it there if you need to be flat.
