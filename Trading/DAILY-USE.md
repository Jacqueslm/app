# Daily Use — computer and phone

The system in one line: **MSB PRICE** watches MES, MNQ and MGC on the 1-hour chart.
When the structure completes it fires an alert with the numbers — direction, entry,
stop, T1, T2, room and the contract count. Your job is not to find trades. Your
job is to take the one it hands you, at its size, or pass.

Two boxes sit on every chart. **MSB PRICE** decides. **MSB EYES** describes.
Every word either one can print, and what to do about it, is on the decoder:
**https://claude.ai/code/artifact/3fc30878-134e-4724-845a-df31c7f1bdac**

---

## Every morning (computer, ~1 minute)

1. Open **NinjaTrader**. Leave it open.
2. Double-click **TURN ON AUTO.bat**. Two small windows start (the relay and
   the tunnel) and the **Bot switch** page opens.
3. On that page, check the big word at the top: **ARMED** means the bot places
   its own trades in NinjaTrader when a signal fires. **OFF** or **KILLED**
   means it only watches. Tap the button to change it.
4. Open TradingView.

Leave the two small windows running. If they are closed, alerts still reach
your phone through the TradingView app — the bot just won't place anything.

**No signal all day = the system did its job.** Zero-trade days are correct.

---

## When an alert fires

There are two alerts. They are not the same thing.

**"Shakeout — the reclaim is next"** — a heads-up. A level just got swept. Not a
trade. Get to a screen. Nothing to do yet.

**"TRADE SIGNAL"** — the trade. The message carries everything:

```
MES1! MSB PURE dir 1 | entry 6720.00 | stop 6700.00 | risk 20.00 pts | T1 6740.00 | T2 6790.00 | room 3.5R | qty 8
```

- `dir` 1 is long, −1 is short
- `entry` the close the bot fired on — where you get in
- `stop` where you get out if wrong — not negotiable
- `T1` one R away; `T2` the structural target
- `qty` contracts that fit your risk — the ceiling is 10

**If autotrade is ARMED:** the bot has already placed it — entry, stop, both
targets — in NinjaTrader. Your job is to leave it alone.

**If autotrade is OFF:** place the whole bracket yourself, in one action, at the
alert's numbers. Entry, stop and targets together. Never entry first and "the
stop in a second."

Then log it in the ledger — four taps and the dollar amount:
**https://claude.ai/code/artifact/4b968d1f-1e98-4b4b-ab9e-bfbe273a44f4**

---

## Two bullets a day

The chart says **Bullets 2 / 2**. The relay stops at two. The ledger shows
**Done for today** at two. Three tools, one rule. When it says done, it is done —
the third trade is the one that undoes the first two.

---

## On the phone

- The TradingView app pushes both alerts. The TRADE SIGNAL message *is* the plan.
- The Bot switch page works from the phone on the home network, or through the
  tunnel address printed in the relay window. The kill switch is there.
- The phone is for **reviewing a signal that fired**, not for scrolling charts
  looking for one. If no alert fired, there is no trade to find.
- Never market-in from the phone because "it's moving." The system waited
  hours for this setup; price running without you is not an emergency.

---

## Weekly (2 minutes, Sunday)

- Open the ledger. Look at the branches — **bot signal** against **my own**.
  After twenty trades, that comparison is the whole report card.
- Check both alerts still say **Active** on every chart in TradingView's alert
  panel (a re-login can pause them).
- If the Bot switch page shows **rollover month** next to a contract, tap **Roll**.

## If something breaks

| Symptom | Fix |
|---|---|
| Bot switch page won't open | The relay window is closed. Run TURN ON AUTO.bat again. |
| Signal fired, nothing placed | Is the page ARMED? Is NinjaTrader open with the AT interface on? Check "Decisions this session" at the bottom of the page — it says why. |
| Alert says qty 8, bot placed 10 or fewer | The ceiling. Max lots on the Bot switch page is the real size. |
| MSB-PRICE missing from the alert dropdown | Add the script to that chart first (Indicators → My scripts). Alerts are per chart. |
| No alerts for many days | Normal. The pattern fires about once every two months per market. |
| Panel eats the phone screen | EYES settings → Panel → size tiny, or move it to another corner. |
