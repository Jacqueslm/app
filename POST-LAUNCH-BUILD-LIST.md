# Post-launch build list

Things deliberately deferred until Turn Someday Into Day One is through Play
Store testing and live. Not started — captured here so they're ready to build.

---

## 1. Lesson/SOS audio cutting off — ✅ SUBSTANTIALLY FIXED (another session)

Shipped (commit bf291bd, merged to main): a shared **wake-lock manager** that
keeps the screen awake during lesson audio AND the SOS tools (voice guide,
breathing, urge surfing, panic mode), re-acquiring the lock whenever the system
revokes it, plus a nudge to restart a paused speech engine when returning from a
manual lock. This fixes the common case — the screen no longer times out and
kills the narration mid-lesson.

**Still open (only if wanted):** true *background* audio with the screen manually
locked or the app switched away needs the MP3 + MediaSession conversion (browser
TTS can't background). The wake-lock fix covers "keep listening while the lesson
is on screen"; the MP3 route is the "listen with screen off / in another app /
lock-screen controls" upgrade. Free feature. Revisit only if users ask for it.

---

## 2. Wire up the real AI for Friendly

**Now:** no `ANTHROPIC_API_KEY` on the server, so Friendly runs entirely on the
built-in guided replies (the fixed library). The "AI mode" badge and the Pro
"X of 30 left" counter are built and correct, but the counter won't tick down
and the badge won't light up until real AI is active (guided replies are free
and don't consume the quota).

**Fix:** add `ANTHROPIC_API_KEY` to the server `.env`. That's the whole change —
the chat endpoint, quota enforcement, and counter are already built around it.
Then Friendly becomes a real back-and-forth and the Pro counter goes live.

**Note:** do this AFTER Play testing, and confirm the Data safety form still
matches (chat content transits to the AI provider — already disclosed, but
re-verify before flipping it on).

---

## 3. Accountability partner link — the /together door

**Idea (validated as a strong angle, tabled for build):** one revocable link a
user shares with someone in their corner (partner, sponsor, friend). The partner
sees only what the user chooses — a "checked in today" dot and/or the day count.
Never journal entries, never slip details. Either side can unlink instantly.

**Why deferred:** it's a real feature (new table, share/redeem routes, a partner
progress page) AND it changes what data is shared between users — which means the
Play Console **Data safety form must be updated before it ships.** Not a
mid-testing change.

**When built, it powers all three marketing doors** (for-her, for-him, together)
off one primitive.

---

## Guardrail reminder
None of these get built until through the 12-tester/14-day window and live.
Items 1 and 3 also need the Data safety form checked before they go live.
