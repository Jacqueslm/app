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
- **Studio** (`/studio/`, also linked from Profile → Creative studio): an image & video generator. Type a prompt, pick a style (Aurora, Nebula, Waves, Flow, Mosaic) and palette, and it renders downloadable PNG wallpapers or short looping WebM videos — all generated locally in the browser, no keys needed. If `OPENAI_API_KEY` is set, a signed-in user also gets an "AI Photo" mode (real text-to-image; 3/day free, 20/day Pro).
