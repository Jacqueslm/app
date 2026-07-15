# Turn Someday Into Day One

A recovery companion app: daily lessons, journaling, streak tracking, an AI chat companion (Nova), and Pro tools for deeper support.

## Setup

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
  - **AI Scenes** (needs `FAL_KEY` + sign-in) — the music-video pipeline: generate scene stills with Flux, keep characters consistent via reference photos (Flux Kontext) or a pasted LoRA URL, then animate any still into a 5s/10s clip with Kling image-to-video. Results land in your library. Daily caps default to 300 images / 60 videos (`STUDIO_DAILY_IMAGE_LIMIT` / `STUDIO_DAILY_VIDEO_LIMIT`); fal model ids can be overridden via `FAL_MODEL_*` env vars if fal renames them.
  - **Characters** — create a character, upload 1–6 reference photos (or train a LoRA on fal.ai with 10–20 photos and paste its URL + trigger word) so every scene locks onto the same face.
  - **Sequencer** — stitch library clips and uploads into a finished video: reorder, trim, add a music track with fade-out, pick 16:9 / 9:16 / square, and render to MP4 (H.264 + AAC) server-side with ffmpeg. `npm install` fetches an ffmpeg binary automatically (`ffmpeg-static`); if that download is blocked, install ffmpeg yourself (`brew`/`apt`/`winget install ffmpeg`) or set `FFMPEG_PATH`.
  - Generated media is stored in `server/media/` and tied to your signed-in account.
