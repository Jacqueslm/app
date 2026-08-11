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

3. **Flip the switch** — open `relay\autotrade.json` in Notepad. Change
   `"enabled": false` to `"enabled": true`. Check the contract months are
   current (MNQ 09-26 etc. — update them each quarter at rollover). Save.

4. **Restart the relay** — close the MSB Alert Relay window, double-click
   `Start Trade Grader.bat` again. Start the phone link too
   (`Start Phone Link.bat`).

5. **Create the alert** — on the MNQ chart: Alt+A → Condition **MSB Pure** →
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
| **Kill switch** | You, from your phone. Open the `/bot` page (URL is printed when the relay starts — same address as the grader, plus `/bot/<secret>`), hit **KILL**. No orders until you re-arm. Survives restarts. |
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
