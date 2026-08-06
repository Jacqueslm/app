# Handoff — Turn Someday Into Day One

State as of 3 August 2026. Written so someone picking this up cold does not have
to rediscover it. Current version: **7.0.3** (`APP_VERSION` in `index.html`,
`tsid-shell-v7.0.3` in `sw.js` — the line was deliberately renamed from 12.x
back to 7, the same kind of reset done once before launch; the in-app updater
compares commit SHAs, so the number only has to change, never increase).

---

## What this is

A recovery companion — day counter, 30-day lesson programmes, private journal,
SOS tools, and an AI companion called **Friendly**. Live, taking real payments.
One person built it and runs it.

Two audiences share the same app: people working on their own recovery, and
people supporting someone else. That split runs through the whole codebase.

## Shape of it

- `index.html` — the entire client, ~9,000 lines, no build step. Plain JS.
- `server/` — Node/Express, `node:sqlite`. `server.js` routes, `db.js` schema,
  `billing.js` Stripe, `store-billing.js` Play/Apple, `email.js`.
- `data/lessons/lesson1..13.json` → `node data/build-lessons.js` → `lessons.json`.
  **390 lessons, ~166k words. Never hand-edit `lessons.json`.**
- Lesson audio: real recordings (five Piper voices, same as the SOS talk) live
  on the repo's **`lesson-audio` branch** — never merged, served straight from
  `raw.githubusercontent.com`, so they add zero weight to Railway builds and
  home-install updates. The app ships only `data/lesson-audio-manifest.json`
  mapping `"Category|day|variant"` → per-voice file paths. **If lesson text
  changes**: `node data/build-lessons.js`, then
  `python3 tools/generate-lesson-audio.py <voices> <out>` (file names are
  content-hashed, unchanged lessons re-encode for free), commit the new files
  to `lesson-audio` and the regenerated manifest to main in the same change.
  No recording / no manifest entry = the app silently falls back to the
  phone's own voice, so audio can never hard-break the lesson screen.
- `twa/` — the Android wrapper config (see Android, below).
- Hosted on **Railway**, auto-deploys on push. Domain `www.turnsomedayintodayone.com`.
  The apex domain without `www` serves nothing.

### Two branches, always both
Every commit gets pushed to `claude/app-qc-competitive-analysis-lehsn9` **and**
`claude/vibe-code-uwxxlk`. The second is what Railway deploys.

### Versioning
Four files move together on every user-visible change: `sw.js` (`CACHE_NAME`),
`index.html` (`APP_VERSION`), `package.json`, `server/package.json`. The service
worker cache name must change or clients keep the old shell. The number was
deliberately reset from 35 to 7 before launch; it is now 7.0.3.

### Two gates that are easy to confuse
- `isSupporterUI()` — `S.userType === 'partner'`. About the **person**.
- `isSupporterTrack()` — `S.currentAddiction === 'Supporting Someone'`. About the
  **term** shown. Grammar belongs to the track, not the person.

## Android

The `.aab` is a **shell**. It contains no app content — it opens
`https://www.turnsomedayintodayone.com/app?src=play` full screen. Every Railway
deploy updates the Android app instantly, with no rebuild and no review.

Rebuild only for shell-level changes (package name, icon, splash colour, target
SDK): `cd twa && bubblewrap build`, after bumping `appVersionCode` in
`twa-manifest.json`.

- Package `com.turnsomedayintodayone.app` — permanent, matches `assetlinks.json`.
- Signing: `twa/android-upload.keystore`, alias `upload`. **This file is the only
  way to ever ship an update to this listing.** It is backed up off the machine.
- `?src=play` is how the client knows it is the Play build and must route
  purchases to Google rather than Stripe. Do not remove it from `startUrl`.
- The Play-mode latch is **Android-only** as of 12.0.1. Opening `?src=play` in
  a desktop browser used to latch Play mode into localStorage forever, which
  blocked Stripe checkout from that browser with "In-app purchases are not
  available on this device". `detectPlayBuild()` now refuses to latch on a
  non-Android UA and clears a stale latch on load, so affected browsers
  self-heal. Do not paste the start URL anywhere a person might click it, all
  the same.

## Money

Two payment paths behind one entitlement model. `getBillingStatus()` in
`billing.js` is the single choke point — everything else reads `isPro`.

| Where | Processor |
|---|---|
| Web | Stripe |
| Android | Google Play (Digital Goods + Payment Request) |

Prices must match on both sides: **$9.99/mo, $59.99/yr, $149.99 lifetime**,
7-day trial on both subscriptions. Play product IDs are mapped literally in
`PRODUCT_PLANS` (`store-billing.js`) — an unknown ID is refused, never guessed.

`store-billing.js` is deliberately store-agnostic. Adding Apple means writing
`verifyAppleReceipt` and one line in `VERIFIERS` — no route, schema or
entitlement changes.

### Three things that are load-bearing and non-obvious

1. **Purchases are acknowledged.** Google refunds anything not acknowledged
   within 3 days. This was missing and every Android sale would have silently
   reversed while the customer kept Pro. Requires the *Manage orders and
   subscriptions* permission on the service account.
2. **Every refusal happens before the payment sheet opens.** On a store purchase
   Google takes the money before the server is consulted, so `storeBillingReady`
   and `lifetimeSoldOut` ride on `/api/billing/status` and are checked first.
   Anything that could reject a purchase must be knowable up front.
3. **Founding Lifetime is capped at 50**, counted across Stripe *and* Play in one
   pool (`countLifetimeSold()`). Enforced at checkout and before the sheet.

### Environment variables
| Name | Purpose |
|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Web payments |
| `PLAY_SERVICE_ACCOUNT_JSON` | Verifies and acknowledges Play purchases |
| `COMP_PRO_EMAILS` | Free Pro for the Play review account and testers |
| `APP_OWNER_EMAIL` | Gates `/admin/stats` |
| `ANTHROPIC_API_KEY` | Friendly |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email |
| `SESSION_SECRET`, `DB_PATH`, `APP_URL` | Core |

## Where the Play launch actually is

**Done:** app created, review passed, closed testing live, all declarations,
content rating (Teen), data safety, target audience 18+, store listing with real
screenshots, three products with trials, payments profile, 15% service fee
enrolment, service account wired up.

**Not done — the only real blocker:**
- **12 testers, opted in for 14 continuous days.** Currently 2 (both the owner's
  own accounts). The clock has not started. Production access needs this *and* a
  written account of how testers were recruited and what feedback they gave.
- **No real purchase has ever been made.** Everything up to Google's servers is
  tested; the last mile is not. After the first test purchase, **check three days
  later that it was not refunded** — that is the only proof acknowledgement works.
  Look for `ACKNOWLEDGE FAILED` in the error log.

Opt-in link (closed test — only works for addresses already on the tester list):

    https://play.google.com/apps/testing/com.turnsomedayintodayone.app

### Play Billing Library 8 deadline (policy warning, July 2026)

Play Console flags: "App must use Google Play Billing Library version 8.0.0 or
later" — the console tile says fix by **Aug 30, 2026** (docs say Aug 31; treat
the earlier date as real). After that date new `.aab` uploads are rejected.
Nothing installed breaks, the tester clock keeps running, and the server is
unaffected — the Billing Library lives only inside the Android shell.

**The fix does not exist yet.** The shell gets its Billing Library from
`com.google.androidbrowserhelper:billing`, and the latest **published** version
is 1.1.0 (bundles BillingClient 7.1.1). The v8 bump (wrapper 1.2.0,
BillingClient 8.3.0) is merged on android-browser-helper's `main` but not
released to Maven. Do **not** pin `billing:1.2.0` (fails to resolve) and do
**not** force `com.android.billingclient:billing:8.x` alongside wrapper 1.1.0 —
it compiles, then crashes at purchase time, because PBL 8 removed deprecated
APIs the 1.1.0 wrapper was built against. Real money runs through this path.

What to do instead:

1. **Extension filed** (or to file): Play Console → Policy status → open the
   Billing Library issue → request the extension to **Nov 1, 2026**. A form on
   that page; granted routinely last cycle.
2. **Watch** https://github.com/GoogleChrome/android-browser-helper/releases
   for `billing-1.2.0` (last cycle Google shipped the v7 wrapper ahead of the
   deadline, announced on chromeos.dev).
3. When it ships, the whole fix is: bump `appVersionCode` in
   `twa-manifest.json`, then `npm install -g @bubblewrap/cli`,
   `bubblewrap update`, `bubblewrap build`, upload to the closed-testing track.
   No manual gradle edit — the updated Bubblewrap template will pull the new
   wrapper. Verify `app/build.gradle` shows `billing:1.2.0` (or later) before
   uploading; if it still says 1.1.0, the template hasn't caught up yet and the
   one-line edit to the published 1.2.0 is then safe.

Until then keep uploading to closed testing normally — the deadline only bites
uploads after it passes, and the 12-tester/14-day clock remains the actual
launch blocker.

## Open bug

**The Android app shows a browser address bar instead of running full screen.**
It falls back to Custom Tabs because Digital Asset Links verification fails.

Verified correct and ruled out:
- The app declares `https://www.turnsomedayintodayone.com` (`assetStatements` in
  the generated `strings.xml`).
- The server serves both certificate fingerprints — app signing key and upload
  key — confirmed live through Google's own validator:

      curl "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.turnsomedayintodayone.com&relation=delegate_permission/common.handle_all_urls"

- Uninstall/reinstall, and Chrome cache clear, on two devices.

Still fails. **Untested leads:** both devices are Samsung — if Samsung Internet
rather than Chrome is the default browser, verification runs through a different
engine. Beyond that it needs `adb logcat` over USB to read Chrome's actual
rejection reason; platform-tools are already on the owner's PC under
`C:\Users\<user>\.bubblewrap\`.

**Impact: cosmetic only.** Install, use, the 14-day clock, purchases and review
all work with the bar present.

## Marketing pages (SEO surface)

Static pages served by explicit routes in `server.js`, all listed in
`sitemap.xml` (with `robots.txt` pointing at it) and linked from the homepage
footer so Google can crawl them:

- `/when-he-drinks` — partner landing, the drinking angle. Bio links
  `/go/tiktok|youtube|facebook` redirect here with UTM tags attached.
- `/for-her` — the broader partner page, PDF email gate.
- `/is-my-husband-an-alcoholic` — **added 5 Aug 2026.** Lowest-difficulty term in
  the keyword set. Refuses to diagnose anyone, reframes the question onto her own
  life, and routes to `/quiz` (primary CTA) and `/for-her` (secondary). Same
  voice, layout and crisis-resources block as `/when-he-drinks`.
- `/quiz` — clean URL for `quiz.html` ("The 2-Minute Check-In"), added so videos
  can say the address out loud.
- `/best-recovery-apps` — our own honest roundup, competitors included.
- 16 `*-alternative` pages — one per competitor app.
- `/brainreset`, `/privacy`.

**Rules for anything new here:** no medical claims, no "research shows", no brain
chemicals (see `reference/medical-claims-audit.md`). Crisis resources (988 and
the DV hotline) go *above* any signup button on pages that reach people living
with active drinking. Add the route in `server.js`, the entry in `sitemap.xml`,
and a footer link on `landing.html`.

**Keyword decisions live in `KEYWORDS.md` at the repo root** — it is the only
source of search data now that Semrush is disconnected. Only build for terms
marked "Build"; never for "Skip" or "Too hard", whatever the volume. Don't
re-run keyword research. The marketing agent
(`.claude/agents/recovery-app-marketer.md`) is bound to that rule and will stop
and ask if the file is missing rather than guess.

**Repo audit, 6 Aug 2026 (full sweep, nothing deleted):** no split, duplicate,
partial, or orphaned files anywhere — same-name files across `Studio/` and
`TurnSomeDayIntoOneday/` are two separate apps, never to be merged. All routes,
sitemap entries, and internal links verified against real files. Fixed then:
three `/quiz.html` links normalized to the canonical `/quiz` route
(`index.html`, `landing.html` ×2), and two stale references to the renamed
`ai-shorts-scripts.md` now point at `AI-SCENES.md`. `KEYWORDS.md` was found to
have never been committed despite this file and the marketer agent depending on
it — **fixed same day**: built at the repo root from a live Semrush pull
(US, 6 Aug 2026) with every term tagged Build / Too hard / Skip.

**`COMPETITORS.md`** (repo root) is a monthly structural log of accounts serving
the partner angle — hook type, length, format only. It exists to inform
structure, never copy. Nothing there gets reworded into our content.

## How to work with the owner

- **One instruction at a time.** Not a numbered list — one step, wait, next.
- **Exact button labels**, exactly as they appear on screen.
- **Always state prices.** Free or a number, never vague.
- **He writes the marketing copy.** Never invent a tagline, headline or store
  description for him. In-app content he explicitly requests is fine.
- **Verify before asking him to retest.** Asking him to test something that was
  never actually deployed wastes his time, and he will say so.

## Testing

Playwright, headless Chromium at `/opt/pw-browsers/chromium`,
`NODE_PATH=/opt/node22/lib/node_modules`. Server on port 4300 from the
`TurnSomeDayIntoOneday/` directory.

Rate limits bite during test runs: signup is 5/hour/IP, chat 20/5min. Restart
the server between full runs.

Store-billing tests stand in a fake `androidpublisher` and assert on the actual
HTTP calls — that is how acknowledgement is verified without a device.
