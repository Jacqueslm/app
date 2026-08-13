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

### 🔔 Notifications diagnosis — RESOLVED to a cause, 13 Aug 2026 (live with his phone)
The test push "sends" but nothing arrives, and the app never appears in
Android's notification list. Root cause found in the repo: **the TWA was built
with `enableNotifications: false`** (`twa/twa-manifest.json` line 15), so the
Play app has no notification identity at all — web push can only surface
through **Chrome**, and on his phone Chrome's own notification/battery settings
were the wall. The "reminder" he saw on opening the app was the in-app banner,
not a push.

**Post-launch task (needs a new .aab — do NOT do before production approval):**
rebuild the shell with `enableNotifications: true` so notifications are
delegated to the app itself — they'd then say "Turn Someday Into Day One"
instead of "Chrome", the app appears in the phone's notification settings, and
Android 13+ can prompt for permission natively. Bump `appVersionCode`,
`bubblewrap build`, re-upload. Server and web code need no changes — the whole
push pipeline verified working this session (subscription valid, VAPID stable,
scheduler correct, test push accepted by the push service).

---

## Studio effects — what the market actually searches for (Semrush, 13 Aug 2026)

Pulled live before building, so the effect list follows demand instead of
guesses. **The lesson in the numbers: the demand is in LOOKS and TEMPLATES, not
in exotic transforms.**

| Term | Vol/mo | KD | Read |
|---|---|---|---|
| ai video generator | 165,000 | 96 | The category's centre of gravity — and unwinnable |
| capcut templates | 22,200 | 27 | **The one to study.** Huge, and difficulty 27 |
| royalty free music | 40,500 | 75 | Adjacent, already served by Suno import |
| video editing software free | 9,900 | 90 | What Studio IS — too hard as a term |
| caption generator | 6,600 | 74 | Studio already does this, free |
| free stock video | 5,400 | 91 | Pexels lane, already wired in |
| glitch effect | 4,400 | 39 | Studio has it |
| photo to video ai | 4,400 | 60 | Ken Burns + fal, already the core loop |
| free luts | 2,900 | 45 | **Colour presets are a real, gettable demand** |
| lower thirds | 2,900 | 41 | Not built — a genuine gap |
| subtitle generator | 2,400 | 60 | Built |
| vhs / film grain / light leaks | 1,600 each | 30-44 | All three built or trivially buildable |
| tiktok video editor | 1,900 | 51 | Positioning term |
| text animation | 1,300 | 46 | Not built — gap |
| motion graphics templates | 1,000 | 37 | Template demand again |
| particle effects | 590 | 43 | Overlay assets needed |
| velocity edit | 320 | 31 | Built b0847 |
| 3d text effect | 260 | 30 | Not built |
| color grading presets | 140 | **19** | Lowest difficulty here. Studio has 20+ looks already |

**What this says to build next, in order:**
1. **More templates, not more effects.** `capcut templates` at 22,200/mo and KD
   27 dwarfs every individual effect term. Studio's Dynamics templates are the
   right shape — there just need to be more of them, and named for occasions.
2. **Colour/LUT presets as a named feature.** `free luts` (2,900) + `color
   grading presets` (140, KD 19) + the individual look terms. Studio already
   HAS the grades; they're just not presented as a preset library.
3. **Lower thirds and text animation** (2,900 + 1,300) are the biggest genuine
   feature gaps — neither exists in Studio today.
4. Particle/overlay effects (smoke, light leaks, dust) want real overlay assets
   rather than filters. Free sources exist (Pexels has overlay clips); this is
   an asset-sourcing job, not a coding one.

### Built b0847 off Jacques's list (all pure ffmpeg, all free, all render-tested)
Looks: comic, nightclub, nature, neon, infrared, sepia, smoke, fog.
Transform: morph, ripple, mirror, kaleidoscope.
Speed: slow ×2, slow ×4, fast ×2, fast ×4, velocity ramp.
Appear: disappear+return, blink, materialize.
**Every one was rendered through real ffmpeg before shipping — four failed on
the first pass** (blend opacity and gblur sigma reject expressions; a fade-out
needs a real start time) and were rewritten or dropped rather than shipped.

### Still on his list, NOT built, and why
- **Multi-angle "whole film crew" / POV coverage** — needs either several real
  generations of the same moment (fal, costs money — Studio's `/coverage`
  route already does exactly this) or a video model. Not a filter. The honest
  answer is that `/coverage` IS this feature and it isn't free.
- **True morph between two different images** — needs optical flow or a model.
  What shipped is a transformation of one image, and is named "Transform" so it
  doesn't over-promise.
- **Layers** — Studio has overlays; a real layer stack is a much bigger job.

## TikTok-tool demand (Semrush, live 13 Aug 2026)

Second pull, on the TikTok side of the same market. **The finding is that
demand has moved off "effects" entirely.** Nobody is searching for more
filters; they're searching for *what to make, and when to post it*.

| Term | Vol/mo | KD | CPC | Studio's position |
|---|---|---|---|---|
| tiktok downloader | 450,000 | 35 | $1.24 | Skip — piracy-adjacent, wrong company to be |
| **best time to post on tiktok** | **90,500** | **37** | $0.70 | **Studio's 📅 Post tab already IS this** |
| tiktok watermark remover | 22,200 | 64 | $1.50 | Studio has "Remove corner mark" |
| tiktok trends | 9,900 | 64 | $3.31 | — |
| tiktok analytics | 9,900 | 47 | **$12.20** | — |
| **how to go viral on tiktok** | **8,100** | **22** | $1.31 | Content, not a feature. Very winnable |
| ai voice over | 6,600 | 71 | $1.94 | Studio has Piper TTS, free |
| tiktok algorithm | 4,400 | 75 | — | Too hard |
| tiktok hashtag generator | 2,900 | 44 | $0.45 | Not built — small job |
| tiktok filters | 2,400 | 34 | $2.86 | Studio has 41 |
| **tiktok voice generator** | **1,900** | **21** | $1.26 | **Studio does this free already** |
| tiktok bio ideas | 1,900 | 24 | — | Content |
| tiktok seo | 1,900 | 45 | $4.52 | — |
| tiktok video ideas | 1,000 | 25 | $1.71 | Content |
| hook generator | 1,000 | 40 | $2.62 | Not built |
| tiktok script generator | 720 | 24 | $1.18 | Teleprompter is adjacent |
| clip finder | 480 | **18** | $1.29 | Not built — long video → clips |
| text to speech tiktok | 390 | **16** | $1.57 | Built |
| tiktok automation | 390 | **16** | **$8.03** | Post tab is adjacent |
| tiktok caption ideas | 320 | **16** | — | Content |
| **tiktok hooks** | 260 | **21** | **$9.64** | Highest CPC per unit of difficulty here |
| faceless tiktok | 210 | 24 | $3.23 | Studio's whole storyboard flow |
| viral hook | 90 | 17 | $4.07 | — |
| b roll ideas | 90 | **2** | — | Pexels is wired in |

**Terms with effectively zero demand — stop building for these:** subtitles for
tiktok (20), burned in captions (30), caption styles (40), karaoke captions
(30), word by word captions (20), stock footage for tiktok (20), podcast to
clips (20), auto clip generator (20), tiktok video editor app (40).

### What this says

1. **"Best time to post" is the giant: 90,500/mo at difficulty 37.** Studio's
   Post tab schedules but doesn't *advise*. A best-time recommendation — even a
   simple one built from his own /admin/stats and posting history — is the
   single highest-value thing that could be added to Studio.
2. **The money is in hooks and ideas, not effects.** `tiktok hooks` carries a
   **$9.64 CPC** at difficulty 21, `tiktok automation` $8.03 at 16, `tiktok
   content calendar` $10.69 at 25. Advertisers pay that because those searchers
   convert. Studio has a Crew/Director that could generate hooks.
3. **Two features Studio already has are searched for by name** and never
   presented as such: the corner-mark remover (22,200) and the free voice
   generator (1,900 at KD 21, plus 390 at KD 16).
4. **`clip finder` (480, KD 18)** — long video → short clips — is the clearest
   unbuilt feature with real demand and low difficulty.

**Deliberately not recommended:** `tiktok downloader`, despite 450,000 searches
a month. Downloading other people's videos is the wrong business for a company
whose whole pitch is honesty, and it would put the Play Store listing at risk.
