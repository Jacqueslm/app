# Daily Use — computer and phone

The system in one line: the MSB indicator watches MNQ and MES all day, and when a
real setup completes it fires an alert carrying the whole trade plan — direction,
entry, stop, T1, T2, room, and its grade. Your job is not to find trades. Your job
is to review the one it hands you and say yes or no.

---

## Every morning (computer, ~1 minute)

1. Double-click **Start Trade Grader.bat** — opens the relay window and the grader.
2. Double-click **Start Phone Link.bat** — opens the ngrok window (this is what
   lets TradingView and your phone reach the grader).
3. Open TradingView desktop with NinjaTrader connected (live data).

Leave all three running. That's the whole setup. If either black window is closed,
alerts still hit your phone through the TradingView app — but the grader won't
self-fill until you start them again.

**No signal all day = the system did its job.** Zero-trade days are correct outcomes.

---

## When an alert fires — at the computer

1. The grader tab flashes **⚡ ALERT** and fills itself: symbol, direction, entry,
   stop, targets, and *Machine-verified A+ or B* with every box ticked except one.
2. **Tick the NEWS box yourself** — the machine runs your Thu/Fri 7:30am blackout
   on the clock, but only you can see today's calendar. FOMC day? Don't tick it.
3. Read the verdict. **TAKE IT** → look at the chart for 30 seconds. Does the story
   on the screen match the plan? Then place the bracket in NinjaTrader as ONE
   action: entry + stop + targets together, sized by the grader's contract count.
4. The alert message tells you the exit plan:
   - **SCALP** — one target at T1, full exit, done for the day.
   - **STANDARD** — half off at T1, stop to break-even, rest at T2.
   - **HOLD** — half off at T1, stop to break-even, trail the rest on the 15m to T2.
5. **REJECT** means no trade. Not "no trade unless it looks really good." No trade.
6. One bullet per day. After the trade — win or lose — log it in the journal and
   close the laptop lid on trading.

---

## When an alert fires — on your phone

The TradingView app pushes the alert to your phone automatically (nothing new to
set up — same alerts you already get). The message IS the trade plan: direction,
entry, stop, risk, T1, T2, room.

To run it through the grader from your phone:

1. Open your phone's browser and go to:

   **https://explicit-sprung-produce.ngrok-free.dev**

   (Bookmark it / add to home screen. First visit shows an ngrok warning page —
   tap **Visit Site**.)
2. That is your grader — same page, live, as long as your computer at home is on
   with both windows running.
3. If the page was already open when the alert fired, it filled itself. If you
   opened it after, copy the alert text from the TradingView notification and
   paste it into the paste box — it fills and machine-verifies the same way.
4. Tick NEWS, read the verdict, look at the chart in the TradingView app, decide.
5. Place the bracket from the NinjaTrader mobile app — entry, stop, and target
   together, never entry alone.

**If your computer is off:** you still get the push with the full plan in it, and
the checklist discipline still applies — you just tick it in your head against the
chart. The grader is the second opinion, not the permission slip. When in doubt
with no grader: that IS your answer. Pass.

---

## Phone rules (protect-me-from-myself edition)

- The phone is for **reviewing a signal that fired**, not for scrolling charts
  looking for one. If no alert fired, there is no trade to find.
- Never market-in from the phone because "it's moving." The system waited hours
  for this setup; price running without you is not an emergency.
- Small screen = bigger mistakes. If you can't check the 15m chart AND place a
  full bracket comfortably, skip the trade. There is another one tomorrow.

---

## Weekly (2 minutes, Sunday)

- Open the grader → Journal → look at the per-grade win rates. The A+ number is
  the whole system's report card.
- Export CSV if you want a backup.
- Check both alerts still say **Active** in TradingView's alert panel (they
  survive restarts, but a re-login can pause them).

## If something breaks

| Symptom | Fix |
|---|---|
| Grader doesn't self-fill | Are both black windows running? Restart both .bat files. |
| Phone page won't load | Computer asleep/off, or ngrok window closed. |
| Alert fired but grader says "Could not read that" | Paste the full message including the entry/stop line. |
| No alerts for many days | Normal in chop — check the dashboard: Setup row will say IDLE and Align will show mixed arrows. The market is the reason, not the system. |
