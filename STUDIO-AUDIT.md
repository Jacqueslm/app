# STUDIO REVIEW & WORKFLOW AUDIT — 18 Aug 2026

**Scope:** review what Studio has, answer the tool-stack questions (Suno,
Manus, fal, CapCut, Gemini), and list what else could automate Jacques's
workflow. **Suggestions only — nothing fixed, per his instruction.**

---

## 1. What Studio already does (verified from the live route map this turn)

Grouped by the job it does, not by menu order:

- **Record:** webcam recorder (browser MediaRecorder), teleprompter scripts,
  voice recording (own voice is free, always).
- **Generate (paid, fal — already wired):** AI scene images (Flux / GPT-Image /
  Banana), image-to-video animate (Kling 2.5 Turbo Pro behind fal's "Standard"),
  lip-sync, dance/motion transfer, live-portrait, face-lock LoRA training for
  recurring characters, upscale.
- **Free fill:** Pexels stock search / import / auto-fill of empty shots (free
  is tried before paid generation, by design).
- **Voice & audio:** local text-to-speech (Piper, 5 CC0 voices, offline/free),
  voice clone (fal F5-TTS paid + local Chatterbox free), transcribe (cloud +
  local), audio cleanup (de-rumble / denoise / normalize), import-song, resound
  (replace a clip's audio with a stretch of a song).
- **Edit (free, ffmpeg):** cut, crop, chroma, watermark cleanup, transform,
  Ken Burns, loop, slow-motion, flip, multi-panel, reframe to 9:16.
- **Assemble:** beat-matched Sequencer, captions (Lyrics & Captions for songs +
  words-on-picture with face-avoid), audio remaster, thumbnail, final render.
- **Post:** Buffer publish (Facebook / TikTok / YouTube), content schedule,
  auto-shorts (highlight detection).
- **Organize:** assets, characters, locations, relationships, scripts,
  schedule, generation queue, storage & backup, diagnostics, self-update.

**Bottom line:** Studio already replaces most of CapCut's daily jobs — the
whole "record → caption → reframe → remaster → post" loop is in one place.

---

## 2. His tools, one by one

| Tool | Status in Studio | Verdict |
|---|---|---|
| **fal** | Wired (scene, animate, lipsync, dance, liveportrait, LoRA, upscale) | Keep. Already the engine. |
| **CapCut** | Replaced by Studio (captions, reframe, remaster, assemble, auto-shorts) | Stop paying/using it for daily work. |
| **Suno** | NOT integrated. No official API (verified 18 Aug 2026). `import-song` already works for files. | See suggestion #1. |
| **Manus** | Not integrated. Trial ends **25 Aug**. Image work already covered by fal. | Batch before 25 Aug, then don't renew (suggestion #3). |
| **Gemini** | Dropped for images (watermark). The "free option" = recovery-app Friendly (already handed off to the other AI). | No Studio role. |

---

## 3. Suggestions (NOT implemented — Jacques: fix nothing, suggest only)

1. **Suno bridge — his explicit ask.** Suno has **no official public API** as
   of 18 Aug 2026 (Suno is only "exploring" a developer API per Music Business
   Worldwide, Jul 2026). The clean, zero-risk path that already works today:
   Suno web → download the WAV/MP3 → Studio **import-song** → beat-matched
   assembly. The only real "automation" gap is that drop-in step. Options to
   close it, cheapest first:
   - (a) A **"watch my Suno downloads folder"** button — Studio auto-imports any
     new song file dropped there. Zero API, zero ToS risk, keeps his paid Suno
     plan working as-is.
   - (b) An **unofficial Suno API wrapper** (e.g. the `gcui-art/suno-api`
     project) behind his Suno account. It works today but is reverse-engineered,
     can break when Suno changes, and may violate Suno's terms — so only worth
     it if (a) feels like too many clicks. Not recommended first.

2. **Talking-head one-press captions.** Studio has `transcribe` (speech-to-text)
   and caption burning, but the highest-value automation to verify is whether a
   recorded talking-head gets **styled captions in one press** (transcribe →
   timed captions → burn). If it currently needs manual timing, that is the one
   CapCut job people actually miss — worth closing before anything else.

3. **Manus sunset plan (deadline 25 Aug).** Use the remaining free days to
   batch-generate the episode images still owed (episodes 3, 7, 8, 10) — then
   do **not** renew: fal + Kling already cover image and animate inside Studio.
   Don't buy a second image tool that duplicates the one already wired.

4. **Batch AI scenes from a pasted script.** The one-press episode button
   already does paste-fill → stock-fill → assemble for *stock*. If the same
   one-press doesn't yet do it for *AI scenes* (paste a full shot list → queue
   every image + animate), extending it would remove the last manual loop in
   the AI-video path (`queue/scenes` already exists to build on).

5. **Auto-schedule the posts.** `schedule` (content calendar) and
   `buffer/post` (publish) both exist. Suggest wiring them so a scheduled slot
   that has a finished video auto-posts to Buffer at the set time — that closes
   the gap between "I made it" and "it went out" without opening Buffer.

---

## 4. What I did NOT do

- No code touched in `Studio/` or `TurnSomeDayIntoOneday/`.
- Nothing fixed, nothing pushed.

**Confidence note:** the "what Studio has" section is verified against the
current route map (`Studio/server/studio.js`) and the build log. Suggestions
#2 and #4 are flagged to verify against the UI before building — they are
questions, not findings.
