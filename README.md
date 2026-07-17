# Turn Someday Into Day One

A recovery companion app: daily lessons, journaling, streak tracking, an AI chat companion (Nova), and Pro tools for deeper support.

## Setup

**This repo contains two separate apps:**

| App | Launcher | Address |
|---|---|---|
| **Turn Someday Into Day One** (recovery companion) | `Start My App` (.bat / .command / start-app.sh) | `localhost:4300` |
| **Studio** (music-video production suite) | `Start Studio` (.bat / .command / start-studio.sh) | `localhost:4400` |

They share nothing — separate servers, accounts, databases, and media. Double-click a launcher and it installs what's needed on first run, creates its `.env` with a session secret automatically, starts its server, and opens the right page. (Only requirement: [Node.js](https://nodejs.org) installed.) Studio's full manual: [HOW-TO-USE.md](HOW-TO-USE.md).

**Manual way:**

```bash
git clone https://github.com/Jacqueslm/app.git
cd app/TurnSomeDayIntoOneday/server
npm install
```

Create `server/.env`:

```
PORT=4300
SESSION_SECRET=<a long random string>
```

Optional, if you want these features working too:

```
ANTHROPIC_API_KEY=<your key>              # without this, Nova falls back to local canned replies
STRIPE_PUBLISHABLE_KEY=<pk_test_... or pk_live_...>
STRIPE_SECRET_KEY=<sk_test_... or sk_live_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>         # from `stripe listen` (local) or your webhook endpoint (production)
```

## Run

```bash
node server.js
```

Open `http://localhost:4300` in a browser and sign up.

## Test on your phone

1. Find your computer's local IP while the server is running:
   - Mac: `ipconfig getifaddr en0`
   - Windows: `ipconfig` (look for "IPv4 Address")
   - Linux: `hostname -I`
2. Connect your phone to the **same Wi-Fi network**.
3. On your phone's browser, go to `http://<that-IP>:4300`.
4. Optional — install it as a home-screen app: Safari → Share → "Add to Home Screen", or Chrome → ⋮ menu → "Add to Home Screen".

## Notes

- Data is stored locally in `server/data.sqlite` (SQLite).
- Signup accepts a password (8+ characters) **or a 4–6 digit PIN**, plus an optional phone number. Pro accounts get 50 Nova chats/day (free: 3).
- A Privacy Policy and Terms of Service live in Profile → About (and are linked from signup). They're a plain-language template describing how the app actually works — **have an attorney review both before opening signups to the public**, and fill in the placeholder contact email in `index.html`.
- Profile page extras: one-click **app updates** (`APP_UPDATE_REPO`/`APP_UPDATE_BRANCH`/`APP_UPDATE_TOKEN` env overrides; set `APP_OWNER_EMAIL` before going public so only you can trigger a server update), **Log out**, and **Erase everything & start over** (deletes the account and all data after password confirmation).
- The free tier (Days 1–15, basic Nova, journal, streaks, SOS tools) works fully with no optional keys configured. Pro screens show an upgrade preview until Stripe is configured and a real subscription/purchase completes.
- **Studio** is its own standalone app in `/Studio` (own server on port 4400, own accounts, own library — start it with `Start Studio`; paste a fal.ai key into its "Turn on AI" box for the AI features). Four tabs:
  - **Art** — local generative art: prompt-seeded styles (Aurora, Nebula, Waves, Flow, Mosaic), PNG wallpapers and looping WebM videos, all rendered in the browser with no keys. With `OPENAI_API_KEY` set, adds an "AI Photo" mode (3/day free, 20/day Pro).
  - **AI Scenes** (needs a fal.ai key + sign-in — paste it once into the "Turn on AI" box in the app, no `.env` editing or restart needed; the key is stored in `server/.env` and removable from Storage & Backup) — the music-video pipeline: generate scene stills with Flux (a 1/2/3/4-at-once picker gives multiple takes of the same prompt in parallel; a quality picker swaps in Google's Nano Banana Pro at ~$0.15/image — `FAL_MODEL_IMAGE_BEST(_EDIT)`, `STUDIO_RATE_IMAGE_BEST` — for best-in-class text-inside-the-image and multi-person shots), keep characters consistent via reference photos (FLUX.2 pro edit studies up to 4 of them at once, 6 on Banana Pro — refs are downscaled locally to keep payloads and per-megapixel billing down; ~$0.09/image, `STUDIO_RATE_CHARACTER_IMAGE`) or a trained LoRA, put **two characters in one scene** (a second dropdown sends 3–5 reference photos per person with a keep-both-faces instruction), then animate any still into a 5s/10s clip with Kling image-to-video. Guardrails: every generation carries a one-continuous-frame instruction (skipped when the prompt explicitly asks for a collage) so multi-moment prompts don't render as split-screen panels; a duplicate-shot check warns before regenerating a near-identical prompt; inlined reference payloads are capped (~6MB) with network-level submit retries; fal content-policy 422s surface as one plain sentence instead of the raw response. A **Sing** button on any image or video lip-syncs the face to a chosen slice of your song (stills via SadTalker; videos get a Draft/Hero tier picker — MuseTalk ~$0.04 vs LatentSync $0.20 flat under 40s, `FAL_MODEL_LIPSYNC_DRAFT`/`FAL_MODEL_LIPSYNC_HERO`, `STUDIO_RATE_SING_*`; segment cut locally with ffmpeg, max 30s per clip). **🎭 Live Portrait** (`fal-ai/live-portrait`, ~10¢, `STUDIO_RATE_LIVEPORTRAIT`) animates an approved still's face/eyes/head from a driving clip you film — canon-safe, the image is never regenerated. **Dance Transfer** maps your own recorded dance onto a character image with a Draft/Standard/Hero tier picker (Wan-Animate / Kling v2.6 standard / Kling v3 pro motion-control — `FAL_MODEL_MOTION(_STD/_HERO)`, `STUDIO_RATE_DANCE_*` per-second estimates on the chips; Kling paths add `character_orientation:'video'`. Viggle isn't on fal — the original spec's free tier doesn't exist): film yourself full-body, pick the character image + your clip + which seconds of moves, and the character performs them — the driving video is trimmed and downscaled locally before upload. Results land in your library. Animate has a Draft / Standard / Best quality picker (Seedance ~\$0.04/s, Kling 3.0 Standard ~\$0.08/s, Kling 3.0 Pro ~\$0.11/s) with the estimated cost shown right on the 5s/10s buttons before you generate — rates are a July 2026 snapshot, overridable via STUDIO_RATE_* and FAL_MODEL_I2V_* env vars. Daily caps default to 300 images / 60 videos (`STUDIO_DAILY_IMAGE_LIMIT` / `STUDIO_DAILY_VIDEO_LIMIT`); fal model ids can be overridden via `FAL_MODEL_*` env vars if fal renames them.
  - **Scene memory**: **Locations** (`studio_locations` + CRUD routes; photos attach via upload `?locationId=` → `meta.locationRef`) add a dropdown to AI Scenes — up to 2 location photos join the reference images with a set-the-scene-exactly-here instruction (plain-prompt scenes switch to the photo-conditioned editor; the LoRA path takes the description as text since it's text-only). **Relationships** (`studio_relationships`, unordered pair per user) store a chemistry descriptor that auto-appends to every duo scene's identity instruction. **Camera coverage** (`POST /coverage`) re-renders an approved generated scene as wide/medium/closeup/over-the-shoulder/detail variants — it reuses the scene's stored prompt (leading shot-phrase stripped), cast, location, size and quality, with a same-moment-only-the-framing-changes instruction; per-shot pricing on the button, results tagged `coverageOf`/`shot`.
  - **Library editing toolbox** (free, local ffmpeg/canvas, originals always kept): **Crop** photos to 9:16/1:1/4:5/16:9 with keep-side choice (crops of uploads inherit the character link and count as reference photos); **2×** sharp-resize upscale; **Cut** videos (keep-only a span, or remove a middle chunk with the sides rejoined, audio preserved and only mapped when the source has an audio stream); **Loop** videos 2×/4×/6× as a seamless forward-reverse ping-pong (inputs capped at 15s — reverse buffers frames in RAM); **Sound** on videos (mute, or swap in a library song from a chosen offset; `-c:v copy` so both are instant); **🎨 Simple screens** card makes black/white/gradient/custom-color 1920×1080 stills client-side.
  - **Characters** — create a character, upload 6–20 reference photos with different angles so every scene locks onto the same face (scene generation feeds up to 4 of them to the model at once; 6 on Best). Reference hygiene: only actual uploads count as references (a shared `isUploadedRef` filter keeps AI-generated scenes — which also carry the character's id for grouping — out of the gallery, out of scene conditioning, and out of training sets), and every gallery thumbnail is tap-to-remove (unlinks via `POST /assets/:id/unlink-character`, keeps the file in the library). With 6+ photos a **🔒 Train face lock** button runs fal's `flux-lora-portrait-trainer` in-app (zips the refs, uploads via fal storage with a data-URI fallback, ~$3.60 one-time via `STUDIO_LORA_STEPS`/`STUDIO_RATE_LORA_STEP`, `FAL_MODEL_LORA_TRAINER` override) and auto-fills the character's LoRA URL + trigger word on completion; locked characters get a **↻ Retrain** button that replaces the lock. Manual paste of an externally trained LoRA still works. Duo scenes always use photos (two LoRAs in one image blend), and Banana Pro paths use photos too (LoRAs are Flux-only).
  - **Sequencer** — a full on-device video production suite (no keys, $0 per use, everything renders locally with ffmpeg):
    - *Quick Video (one-click assemble)*: add pictures → each gets a camera move, duration, and optional on-screen words (per-cut transition override, crossfade by default) → add your song → press Assemble. The app motion-izes every still, sequences them, syncs the music with auto fade-out, and renders a finished 9:16/16:9/1:1 MP4 with a progress bar. "Cut on the beat" snaps every picture's time to whole musical bars of your song. Shot lists save as reusable templates, and the assembled timeline lands in the editor below for tweaking.
    - *Simple mode*: the Sequencer opens showing only Quick Video and the Shorts Generator; one tap on "Show studio tools" reveals the full editor (timeline, transitions, color, text, output, projects).
    - *Stills → Motion*: Ken Burns camera moves turn any still into a moving clip — push-in, pull-back, pan in 4 directions, push toward a tap-chosen focal point, zoom+pan combo, slow drift, handheld shake; adjustable intensity and duration.
    - *Timeline*: drag-and-drop reorder, per-clip trims, still images with hold times (slideshow), per-clip brightness/contrast/saturation, and per-cut transitions (hard cut, crossfade, fade-to-black).
    - *Music*: a playlist of your own tracks that play in order (multi-song videos), each with start-offset and optional length, blended with a crossfade or hard-joined; global volume and fade in/out; a WebAudio beat analyzer estimates BPM and snaps your cuts to the beat.
    - *Lyrics & Captions*: paste your lyrics (one line per caption), then Auto-spread them across the song instantly or Tap-to-sync for exact timing (the song plays, you tap once per line); captions burn in at the bottom with safe margins and ride along into shorts automatically, and they never duck the music. One-tap song-title intro card from your Campaign fields. Campaign thumbnails now composite your title / hook lyric in bold over the grabbed frames, YouTube-style.
    - *Storyboard*: paste your full lyric sheet and press one button — the app splits your song into scenes and writes a cinematic image prompt for each one automatically, free and on-device. **Structure-aware**: `detectSections` labels every stanza (intro/verse/chorus/bridge/outro — explicit `[Chorus]`-style tags win, repeated stanzas are recognized as the chorus, short first/last stanzas read as intro/outro, a unique late stanza after 2+ chorus hits is the bridge) and prompts are energy-matched per section (dynamic wide/crane/low-angle coverage on choruses, intimate medium/close-up on verses, moody/abstract on the bridge, calm bookends); scene cards show a section badge, and chorus stills land on the timeline with shorter holds (2s vs 4s vs 5s bookends). If `ANTHROPIC_API_KEY` is set, prompts are written by Claude instead (instructed to return the same section labels). Every prompt is editable; a pinned character keeps every scene consistent; Generate (or Generate all remaining) turns scenes into real images via AI Scenes.
    - *Import from link*: paste a Suno share link (or any page URL / direct .mp3/.wav/.m4a link) next to Quick Video's Add-your-song and `POST /import-song` fetches the page, finds the audio URL (Suno CDN pattern first, any audio link as fallback), downloads it (60MB cap), probes the duration, and drops it into the library + music list — page `<title>` becomes the label.
    - *AI auto-captions*: the 🪄 button on Lyrics & Captions transcribes the first music-list song with fal Whisper (`fal-ai/wizper` default, `FAL_MODEL_TRANSCRIBE`/`STUDIO_RATE_TRANSCRIBE` ~2¢) — audio uploaded via fal storage with data-URI fallback, segment-level timestamps land as synced caption lines (same shape tap-to-sync produces) and fill the lyrics textarea.
    - *Text & titles*: overlay cards ("OUT NOW", lyrics, artist name) with font/size/color/bold, 9-position grid, timing, and fade — rendered with your browser's fonts, composited by ffmpeg.
    - *Export*: MP4 (H.264 + AAC) in YouTube 16:9 / Reels 9:16 / Square, 1080p or 720p, optional fade from/to black — plus one-click 15/30/60s cutdown exports so a music video yields shorts for free.
    - *Shorts Generator*: mark highlights (hook/drop/chorus) or auto-detect them — semantic-first: when captions exist, repeated caption lines are recognized as the chorus and its block starts become 'hook'/'chorus2' highlights (block-start detection skips lines inside the same chorus), with the music's loudest sections filling remaining slots, then batch-build 15/30/60s 9:16 1080p shorts — each opens right on its highlight, gets its own A/B hook caption, optional seamless loop (last frame = first frame), music stays synced to that part of the song, and files export clearly named (`short_hook_15s.mp4`, `short_drop_30s.mp4`, …) with a download-all button.
    - *Campaign Export*: one finished video becomes a posting campaign — pick the main video and shorts, auto-grab 3 thumbnail candidates, fill in song/artist/link/hashtags and let it write per-platform captions (editable), set a start date, and export a ZIP: `videos/`, `thumbnails/`, `posts.csv` (platform, file, suggested time, caption per row), `campaign.json` (machine-readable, reserved for a future Buffer API integration), and a README with the Buffer posting steps.
    - *Projects*: save/load timelines to your account; the browser also keeps an auto-draft.
    - *Update my app* (Storage & Backup card): one button downloads the latest version from GitHub, installs it over the app, and refreshes dependencies — your key, account, and library are preserved by construction (they're never in the download). Check-for-updates compares against the branch's latest commit; restart the launcher after updating. Overridable via `APP_UPDATE_REPO` / `APP_UPDATE_BRANCH`.
    - *Storage & Backup* (studio tools): disk usage with the biggest files first and one-tap delete, plus a full-library backup ZIP (every media file + a manifest of characters/projects) — your media lives only on this machine, so keep a copy somewhere safe.
    - `npm install` fetches an ffmpeg binary automatically (`ffmpeg-static`); if that download is blocked, install ffmpeg yourself (`brew`/`apt`/`winget install ffmpeg`) or set `FFMPEG_PATH`.
  - Generated media is stored in `server/media/` and tied to your signed-in account.
  - **Going public?** Before opening signups to strangers, add `STUDIO_OWNER_EMAIL=<your account email>` to `server/.env`. Studio then locks to your account only — public users get the recovery app but can never touch your fal key, uploads, renders, or library. (Also review Stripe keys and consider rotating your fal key.)
  - **Your Audience** (Sequencer tools) — a public, no-login email signup page at `Studio/web/join.html` and a POST `/api/join` endpoint, both outside auth so fans can join without a Studio account (rate-limited, honeypot field against bots, same response whether an email is new or already on the list). The Sequencer's "Your Audience" card shows the signup count and downloads the list as CSV (`/api/studio/fans.csv`, requires your login). This only works from wherever this server is actually reachable — on `localhost` it proves the mechanism, but to catch real signups the server needs a public address (a small always-on host + a domain), then share `yourdomain.com/join.html`.

## Diagnostics &amp; overnight rendering

- **Diagnostics**: both apps log server-side errors (route exceptions, uncaught exceptions) to a rolling 200-row table, visible in-app — Studio: Storage & Backup → Diagnostics; recovery app: Profile → Diagnostics. Screenshot-and-send-to-Claude friendly.
- **Overnight batch queue** (Studio Storyboard): "🌙 Queue overnight" submits every unrendered scene to a server-side queue that keeps generating — one fal job at a time — even if the browser tab closes, so a full storyboard can be queued before bed and finish by morning. The Sequencer polls and reconciles automatically whenever the tab is open.
