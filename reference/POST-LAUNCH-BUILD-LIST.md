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

**✅ Also shipped — the SOS "Talk me through it" talk is now a real MP3:** its
script is fixed text, so it was pre-recorded once as `audio/sos-talk.mp3`
(generated locally with the free open-source Piper TTS — no API, no cost) and
plays through an `<audio>` element with MediaSession. It survives screen lock
and app switching, shows lock-screen play/pause, is precached by the service
worker for offline, and falls back to `speechSynthesis` automatically if the
MP3 can't load. Regeneration script + voice-download instructions:
`TurnSomeDayIntoOneday/tools/generate-sos-talk.py`.

**Still open (lessons only, if wanted):** true *background* audio for lessons
needs the same MP3 + MediaSession conversion (browser TTS can't background).
Scope: batch-generate one MP3 per lesson day across all 13 tracks — either via
a TTS service (fal.ai F5-TTS, or Friendly's voice backend when wired up) or the
same free local Piper route the SOS talk used, if the voice quality is judged
good enough for lessons; host the files; swap the lesson player to `<audio>`
with MediaSession metadata (title = lesson name, artwork = app icon) for
lock-screen "Now Playing"; keep the speed control (playbackRate works on
`<audio>`). Free feature. Revisit only if users ask for it.

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

## 4. Start time / end time — user-set — ✅ BUILT (v12.5.0)

Requested 31 Jul 2026, scope confirmed as the recovery app the same day, and
shipped: **the daily lesson reminder now has user-set hours.** Profile settings
gained an "Only remind me between" row with start and end pickers (default
9am–9pm). Outside the window the app stays silent *without* marking the day as
reminded, so the nudge still lands once the user is back inside their hours
rather than being skipped altogether. A window that crosses midnight (e.g.
10pm–6am) works. Setting both ends to the same hour means no restriction.

**Still open, if wanted later:** the other readings of the same request that
were never picked — a user-set Day One date / goal date in the recovery app, or
typed in/out seconds for clips and captions in Studio (note Studio's Cut tool
already keeps a chosen section, so that one is a friendlier front end rather
than new capability).

---

## Guardrail reminder
None of these get built until through the 12-tester/14-day window and live.
Items 1 and 3 also need the Data safety form checked before they go live.
