# Turn Someday Into Day One

A recovery companion app: daily lessons, journaling, streak tracking, an AI chat companion (Nova), and Pro tools for deeper support.

## Setup

**Easiest way:** clone the repo, then just double-click the launcher — `Start My App.command` (Mac), `Start My App.bat` (Windows), or `start-app.sh` (Linux). It installs what's needed on first run, creates `server/.env` with a session secret automatically, starts the server, and opens Studio in your browser. (Only requirement: [Node.js](https://nodejs.org) installed.)

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
OPENAI_API_KEY=<your key>                 # without this, the Studio's "AI Photo" mode stays hidden (local art styles still work)
FAL_KEY=<your key>                        # from fal.ai — powers the Studio's AI Scenes: character-consistent images + image-to-video
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
- The free tier (Days 1–15, basic Nova, journal, streaks, SOS tools) works fully with no optional keys configured. Pro screens show an upgrade preview until Stripe is configured and a real subscription/purchase completes.
- **Studio** (`/studio/`, also linked from Profile → Creative studio): an image & video production suite with four tabs.
  - **Art** — local generative art: prompt-seeded styles (Aurora, Nebula, Waves, Flow, Mosaic), PNG wallpapers and looping WebM videos, all rendered in the browser with no keys. With `OPENAI_API_KEY` set, adds an "AI Photo" mode (3/day free, 20/day Pro).
  - **AI Scenes** (needs a fal.ai key + sign-in — paste it once into the "Turn on AI" box in the app, no `.env` editing or restart needed; the key is stored in `server/.env` and removable from Storage & Backup) — the music-video pipeline: generate scene stills with Flux, keep characters consistent via reference photos (Flux Kontext) or a pasted LoRA URL, then animate any still into a 5s/10s clip with Kling image-to-video. A **Sing** button on any image or video lip-syncs the face to a chosen slice of your song (stills via SadTalker, videos via sync-lipsync; segment cut locally with ffmpeg, max 30s per clip). **Dance Transfer** maps your own recorded dance onto a character image (motion-transfer model, default `fal-ai/wan-animate`, override with `FAL_MODEL_MOTION`): film yourself full-body, pick the character image + your clip + which seconds of moves, and the character performs them — the driving video is trimmed and downscaled locally before upload. Results land in your library. Daily caps default to 300 images / 60 videos (`STUDIO_DAILY_IMAGE_LIMIT` / `STUDIO_DAILY_VIDEO_LIMIT`); fal model ids can be overridden via `FAL_MODEL_*` env vars if fal renames them.
  - **Characters** — create a character, upload 1–6 reference photos (or train a LoRA on fal.ai with 10–20 photos and paste its URL + trigger word) so every scene locks onto the same face.
  - **Sequencer** — a full on-device video production suite (no keys, $0 per use, everything renders locally with ffmpeg):
    - *Quick Video (one-click assemble)*: add pictures → each gets a camera move, duration, and optional on-screen words (per-cut transition override, crossfade by default) → add your song → press Assemble. The app motion-izes every still, sequences them, syncs the music with auto fade-out, and renders a finished 9:16/16:9/1:1 MP4 with a progress bar. "Cut on the beat" snaps every picture's time to whole musical bars of your song. Shot lists save as reusable templates, and the assembled timeline lands in the editor below for tweaking.
    - *Simple mode*: the Sequencer opens showing only Quick Video and the Shorts Generator; one tap on "Show studio tools" reveals the full editor (timeline, transitions, color, text, output, projects).
    - *Stills → Motion*: Ken Burns camera moves turn any still into a moving clip — push-in, pull-back, pan in 4 directions, push toward a tap-chosen focal point, zoom+pan combo, slow drift, handheld shake; adjustable intensity and duration.
    - *Timeline*: drag-and-drop reorder, per-clip trims, still images with hold times (slideshow), per-clip brightness/contrast/saturation, and per-cut transitions (hard cut, crossfade, fade-to-black).
    - *Music*: a playlist of your own tracks that play in order (multi-song videos), each with start-offset and optional length, blended with a crossfade or hard-joined; global volume and fade in/out; a WebAudio beat analyzer estimates BPM and snaps your cuts to the beat.
    - *Text & titles*: overlay cards ("OUT NOW", lyrics, artist name) with font/size/color/bold, 9-position grid, timing, and fade — rendered with your browser's fonts, composited by ffmpeg.
    - *Export*: MP4 (H.264 + AAC) in YouTube 16:9 / Reels 9:16 / Square, 1080p or 720p, optional fade from/to black — plus one-click 15/30/60s cutdown exports so a music video yields shorts for free.
    - *Shorts Generator*: mark highlights (hook/drop/chorus) or auto-detect them from the music's loudest sections, then batch-build 15/30/60s 9:16 1080p shorts — each opens right on its highlight, gets its own A/B hook caption, optional seamless loop (last frame = first frame), music stays synced to that part of the song, and files export clearly named (`short_hook_15s.mp4`, `short_drop_30s.mp4`, …) with a download-all button.
    - *Campaign Export*: one finished video becomes a posting campaign — pick the main video and shorts, auto-grab 3 thumbnail candidates, fill in song/artist/link/hashtags and let it write per-platform captions (editable), set a start date, and export a ZIP: `videos/`, `thumbnails/`, `posts.csv` (platform, file, suggested time, caption per row), `campaign.json` (machine-readable, reserved for a future Buffer API integration), and a README with the Buffer posting steps.
    - *Projects*: save/load timelines to your account; the browser also keeps an auto-draft.
    - *Storage & Backup* (studio tools): disk usage with the biggest files first and one-tap delete, plus a full-library backup ZIP (every media file + a manifest of characters/projects) — your media lives only on this machine, so keep a copy somewhere safe.
    - `npm install` fetches an ffmpeg binary automatically (`ffmpeg-static`); if that download is blocked, install ffmpeg yourself (`brew`/`apt`/`winget install ffmpeg`) or set `FFMPEG_PATH`.
  - Generated media is stored in `server/media/` and tied to your signed-in account.
