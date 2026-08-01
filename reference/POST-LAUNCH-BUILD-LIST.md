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

## 4. Start time / end time — user-set (REQUESTED 31 Jul 2026, scope not yet pinned)

**Jacques asked for this and asked that it be written down rather than built on
the spot.** He didn't say which app, and the readings lead to genuinely different
work, so pin the scope before building. Ask him which of these he meant:

- **Recovery app — reminder window.** Today the daily lesson reminder is only
  On/Off; the user can't choose *when* it fires. Letting them set a start and end
  time (or quiet hours) is a real gap and the most likely reading of "on the app".
- **Recovery app — dates.** Set their own Day One date, and/or a goal/end date
  for a streak or challenge.
- **Studio — clip in/out.** Type exact start and end seconds on a clip instead of
  using the Cut tool or dragging. Note Cut already keeps a chosen section, so
  this would be a friendlier front end on something that exists, not new capability.
- **Studio — timeline/caption timings.** Type exact in/out seconds for a caption
  or a picture's hold, instead of Tap-to-sync or Auto-spread.

**Context when it was raised:** he was working in Studio on watermarks, pricing
and clip audio, so the Studio readings are plausible — but "on the app" is how he
usually refers to the recovery app, and the reminder-window gap is real.

---

## Guardrail reminder
None of these get built until through the 12-tester/14-day window and live.
Items 1 and 3 also need the Data safety form checked before they go live.
