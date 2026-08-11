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
