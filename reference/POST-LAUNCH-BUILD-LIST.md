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

---

## Jacques's real-phone test list — 12 Aug 2026, late

He went through the whole app on his phone and dictated this. Every item below
is his, in triage order. **Two were fixed the same night (v5.1.6):**

### ✅ Fixed 12 Aug — voice journaling cut off after a few words
`startVoiceJournal()` ran SpeechRecognition in single-phrase mode, so the
browser stopped at the first pause and saved whatever it had — two to four
words. Now `continuous=true`, pieces accumulate across pauses, the browser's
own timeouts restart transparently, and the mic button becomes a red
**"Listening… tap to finish"** stop button. Entry saves when HE ends it.

### ✅ Fixed 12 Aug — phone back button exited the app from anywhere
One press of Android back from any screen or tool and you were out. Now the
same history-trap onboarding already used, applied app-wide
(`armAppBackTrap`/`handleAppPopstate`): back closes the topmost open modal
through its own close function (background-tap path, so timers and wake locks
clean up), then closes full-screen overlays, then steps to Home — and only
exits when you're already on Home with nothing open, where exiting is correct.

### 🔴 Needs diagnosis with his phone in hand — notifications still not arriving
Web push shipped in 5.1.0 and he still gets nothing. Can't be fixed blind.
Next session with him: check Settings → the reminder bell is actually
subscribed on THIS phone (the subscription is per-device); check Android
notification permission for the browser/TWA; check the phone's battery
optimization isn't killing delivery; send the test push from the app and watch
the server log. If all that passes, the bug is in `server/push.js` scheduling.

### Content builds (no code risk, big wins — good next-session jobs)
- **Couples/Together section is a dead end.** "It's like you open it up and say
  do this together, but it really goes nowhere." He wants ~**30 lessons done
  together**, structured like every other track. This turns the deferred
  `/together` feature into a real product surface. (Data safety review needed
  only if it starts collecting new data — lessons alone don't.)
- **Supporter section: 5 boundary lessons** — why set boundaries, how to
  protect yourself, and against whom. Fits the existing supporter track
  format; the partner-page voice already written this week is the tone.
- **"Ask me anything" as the first-open greeter.** New users should land in a
  guided welcome — ask me anything, full tour of how and where to start —
  instead of finding it later. It exists; it's the placement that's wrong.
- **Friendly's daily conversations** — day-of-week themed or fully async;
  right now the daily conversation loops back on itself. And make Friendly's
  check-in messages read like a person, not a template.

### Layout moves (small, safe, do as one batch)
- **Rooms → Tools.**
- **Share milestones → Tools.**
- **Custom packs → Tools.**
- Possibly **open Rooms up as a real community** — his call on scope; today
  it's stories, he's imagining people. That one is NOT small: moderation,
  privacy ("never expose one user's data to another"), and a Data safety
  update. Park it as a question for him, not a build.

### Voice
- **"Talk me through it" should keep talking** — the guided voice pauses out
  too early for him. Related to the step-sequencing note in START-HERE (the
  setTimeout chain freezes on a hidden page); real fix is driving steps off
  the audio's own timeupdate/ended events.
