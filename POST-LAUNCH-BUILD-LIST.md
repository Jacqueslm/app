# Post-launch build list

Things deliberately deferred until Turn Someday Into Day One is through Play
Store testing and live. Not started — captured here so they're ready to build.

---

## 1. Real background lesson audio (podcast-style) — HIGH VALUE

**Problem:** lessons are read by the browser's built-in text-to-speech
(`speechSynthesis`). Every mobile browser suspends that engine when the screen
locks or the app is backgrounded, so the voice dies. A wake-lock currently keeps
the screen awake during playback, but locked/multitasking playback is impossible
with TTS — it's a browser limitation, not a bug.

**Fix:** convert lessons to real audio files and play them through an `<audio>`
element with the MediaSession API.

**Scope:**
1. Pick a text-to-speech *service* (not the browser engine). Options: the same
   voice backend used for Friendly's AI when it's wired up, or fal.ai's TTS
   (F5-TTS) already used in Studio, or a dedicated TTS API.
2. Batch-generate one MP3 per lesson day across all 13 tracks (script it; store
   the files; regenerate only when lesson text changes).
3. Host the audio (served from the app's own server or a static bucket).
4. Swap the lesson player from `speechSynthesis` over to an `<audio>` element
   pointed at the MP3.
5. Add MediaSession metadata (title = lesson name, artwork = app icon) so the
   lock screen shows "Now Playing" with play/pause/scrubbing — real background
   and locked playback, like any podcast app.
6. Keep the current speed control (browser can vary playbackRate on `<audio>`).

**Why it's worth it:** "listen to your lessons anywhere, screen off, while you
drive" is a genuine feature, not a patch — turns the lessons into a podcast.

**Blocked on:** a TTS service being available/approved (ties to item 2).

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
