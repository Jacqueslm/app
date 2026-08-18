# STUDIO REVIEW & WORKFLOW AUDIT — 18 Aug 2026

**Scope:** review what Studio has, answer the tool-stack questions (Suno,
Manus, fal, CapCut, Gemini), and list what else could automate Jacques's
workflow. **Suggestions only — nothing fixed, per his instruction.**

**Verification method:** features below were checked against the actual UI —
the button elements and their click handlers in `Studio/web/index.html` — not
just the server routes. This is the corrected version after that pass.

---

## 1. What Studio already does

Grouped by job, not menu order:

- **Record:** webcam recorder, teleprompter scripts, free voice recording.
- **Generate (paid, fal — wired):** AI scene images (Flux / GPT-Image / Nano
  Banana), animate (Kling 2.5 Turbo Pro behind fal's "Standard"), lip-sync,
  dance, live-portrait, LoRA face-lock training, upscale.
- **Free fill:** Pexels stock search / import / auto-fill of empty shots.
- **Voice & audio:** local TTS (Piper, 5 CC0 voices), voice clone (fal paid +
  local Chatterbox free), transcribe, audio cleanup, import-song, resound.
- **Edit (free, ffmpeg):** cut, crop, chroma, watermark cleanup, transform,
  Ken Burns, loop, slow-mo, flip, panels, reframe 9:16.
- **Assemble:** beat-matched Sequencer, captions, audio remaster, thumbnail,
  render.
- **Post:** Buffer (FB/TikTok/YT) queue, content schedule, auto-shorts.
- **Organize:** assets, characters, locations, relationships, scripts, queue,
  storage/backup, diagnostics, self-update.

---

## 2. His tools, one by one

| Tool | Status in Studio | Verdict |
|---|---|---|
| **fal** | Wired (scene, animate, lipsync, dance, liveportrait, LoRA, upscale) | Keep. Already the engine. |
| **CapCut** | Replaced (captions, reframe, remaster, assemble, auto-shorts) | Stop paying/using it for daily work. |
| **Suno** | NOT integrated. No official API (verified 18 Aug 2026). `import-song` already takes Suno downloads. | See suggestion #1. |
| **Manus** | Not integrated. Trial ends **25 Aug**. Image work already covered by fal. | Batch before 25 Aug, then don't renew. |
| **Gemini** | Dropped for images (watermark). The "free option" = recovery-app Friendly (already handed off to the other AI). | No Studio role. |

---

## 3. Suggestions — CORRECTED after clicking through the UI

**Three features I earlier flagged as missing already exist (false gaps):**

- **Talking-head captions — EXISTS.** Two buttons: "🪄 Auto-captions (AI
  listens, ~35¢)" and "🎙️ Captions from my own voice (free)". Captions burn in
  at the bottom and are included in renders and shorts automatically. Talking
  head: paste the lines you actually said, then auto-spread (instant) or
  tap-to-sync (exact).
- **Batch AI scenes from a script — EXISTS.** The Storyboard has "Generate all
  remaining scenes" + "🌙 Queue overnight". (The one-press episode button is
  deliberately the *stock* path: own pictures → free stock → assemble. AI
  scenes go through the Storyboard / Director flow.)
- **Auto-schedule posts — EXISTS.** "Send to my Buffer queue" drops into
  Buffer's next open slot (8am / 12pm / 7pm), and the send flow takes a
  scheduled time. True hands-free auto-post is limited by TikTok/IG/YT's
  platform review, not by Studio.

**The one real automation gap left:**

1. **Suno auto-import.** Suno has **no official API** (verified — Suno is only
   "exploring" a developer API, Music Business Worldwide Jul 2026). Studio's
   `import-song` already takes his Suno downloads, but he has to find and drop
   the file each time. Suggested: a **"watch my downloads folder"** button so a
   freshly downloaded Suno song auto-appears in the library. Zero API, zero
   ToS risk, keeps his paid Suno plan working as-is. (An unofficial Suno API
   wrapper exists but is reverse-engineered and ToS-risky — not recommended.)

**Advice, not a feature:**

2. **Manus sunset plan (deadline 25 Aug).** Use the remaining free days to
   batch-generate episode images 3, 7, 8, 10 — then don't renew; fal + Kling
   already cover image and animate inside Studio.

---

## 4. What I did NOT do

- No code touched in `Studio/` or `TurnSomeDayIntoOneday/`.
- Nothing fixed, nothing pushed.
