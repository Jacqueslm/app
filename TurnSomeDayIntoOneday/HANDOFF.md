# Handoff — Turn Someday Into Day One

State as of 29 July 2026. Written so someone picking this up cold does not have
to rediscover it. Current version: **12.0.0** (`APP_VERSION` in `index.html`,
`tsid-shell-v12` in `sw.js`).

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
deliberately reset from 35 to 7 before launch; it is now 12.

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
