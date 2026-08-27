# Handoff — Turn Someday Into Day One

State as of 3 August 2026. Written so someone picking this up cold does not have
to rediscover it. Current version: **5.0.1** (`APP_VERSION` in `index.html`,
`tsid-shell-v5.0.1` in `sw.js` — the line was deliberately renamed from 12.x
back to 7, the same kind of reset done once before launch; the in-app updater
compares commit SHAs, so the number only has to change, never increase).

---

## What this is

A recovery companion — day counter, 30-day lesson programs, private journal,
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
deliberately reset from 35 to 7 before launch; it is now 5.0.1 (5.0.0 was a reset from 7.0.3 at the owner's request, 6 Aug 2026 — the number only has to change, never increase).

### Two gates that are easy to confuse
- `isSupporterUI()` — `S.userType === 'partner'`. About the **person**.
- `isSupporterTrack()` — `S.currentAddiction === 'Supporting Someone'`. About the
  **term** shown. Grammar belongs to the track, not the person.

## Android

The `.aab` is a **shell**. It contains no app content — it opens
`https://www.turnsomedayintodayone.com/app?src=play` full screen. Every Railway
deploy updates the Android app instantly, with no rebuild and no review.

Rebuild only for shell-level changes (package name, icon, splash color, target
SDK): `cd twa && bubblewrap build`, after bumping `appVersionCode` in
`twa-manifest.json`.

- Package `com.turnsomedayintodayone.app` — permanent, matches `assetlinks.json`.
- Signing: `twa/android-upload.keystore`, alias `upload`. **This file is the only
  way to ever ship an update to this listing.** Correctly gitignored (a keystore
  in git history is a public keystore), so its absence from the repo is by
  design, not a loss. **Backup verified by Jacques 2026-08-07: it lives on his
  computer and on a USB drive.** Don't re-flag this.
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
- **No real *Play* purchase has ever been made.** Everything up to Google's
  servers is tested; the last mile is not. After the first test purchase,
  **check three days later that it was not refunded** — that is the only proof
  acknowledgement works. Look for `ACKNOWLEDGE FAILED` in the error log.

  Do not let the Stripe side confuse this. **Stripe is proven and works.**
  Confirmed against the live account (`acct_1TvjcJCDHXSEg3rL`) on 27 Aug 2026:
  two live subscriptions, `app_user_id` 11 and 18, both Jacques's own accounts,
  and one real settled charge — `ch_3U1RLwCDHXSEg3rL0Ju6KvMj`, $9.99, 6 Aug
  2026, Visa debit ...8776, `status: succeeded`, never refunded. Trial started
  30 Jul, converted 6 Aug, cancelled 18 Aug. So checkout, the webhook, and the
  entitlement flip all work end to end on the web path.

  That proves nothing about Play. The two paths do not share code past
  `becomePro()`: the web path posts to `/api/billing/create-checkout-session`
  (`billing.js`), the Play path calls `becomeProViaStore()` →
  `getDigitalGoodsService` (`store-billing.js`). A Stripe purchase cannot even
  be *made* from inside the Play app — `becomePro()` refuses it as the policy
  line. So the fact that Jacques bought Pro with a card means he was in a plain
  browser at the time, not in the installed app. The broken path is still
  untested by that purchase.

Opt-in link (closed test — only works for addresses already on the tester list):

    https://play.google.com/apps/testing/com.turnsomedayintodayone.app

### Play Billing Library 8 — CLOSED. Already updated, no extension.

**Jacques, 26 Aug 2026: "it's already updated, no extension."** The shell is on
a current Google Play Billing Library. Nothing to do here. Do not re-open it.

**The extension was for Android 16 target SDK, not for Billing.** Jacques
requested that one on 17 Aug and it moved 31 Aug → 1 Nov. Earlier versions of
this file attached that extension to Billing 8 and invented an "Oct 31 Billing
deadline" from it. There is no such deadline.

If Play Console still shows a Billing Library tile, treat it as stale console
text. Do NOT tell Jacques it is new, do NOT request an extension, and do NOT
schedule a bubblewrap rebuild for it.

**Still true about the shape of the thing:** the Billing Library lives only
inside the Android shell. The website and the server are unaffected by anything
in this section, and a Play upload is only ever needed for shell-level changes
(icon, package config, target SDK).


## Open bug

**The Android app is not running as a verified Trusted Web Activity, and that
is why nobody can buy Pro.** Settled 27 Aug 2026 by the app's own error text.
Read this whole section before changing anything — the cause was correctly
identified weeks ago, then talked out of by me on the same day, then confirmed
again. Do not restart that loop.

### The proof, in Jacques's own screenshot

The failure dialog (app 5.8, which prints the real error) reads:

    failed while opening the store connection.
    OperationError: unsupported context
    bridge=present · playBuild=yes · display=standalone · engine=Chrome 151 · app=5.8

`unsupported context` is not a generic failure. It is Chromium's
`kUnsupportedContext` from `DigitalGoodsFactoryImpl`, surfaced as an
`OperationError`, and it has exactly one meaning: **the document calling
`getDigitalGoodsService()` is not inside a Trusted Web Activity.** The address
bar across the top of that same screenshot says the same thing visually.

### The trap that cost a day — do not fall in it

`bridge=present` does **not** mean the billing bridge works.
`storeBillingAvailable()` only tests `'getDigitalGoodsService' in window`, and
that function exists in ordinary Chrome on Android. It is there, it is
callable, and outside a TWA it rejects. So:

- The purchase sails past the `storeBillingAvailable()` guard and its message
  ("In-app purchases are not available on this device") never appears.
- It dies in the deepest catch instead, which used to print only "Could not
  complete that purchase."
- On 27 Aug I read that message as proof the bridge was working and **wrongly
  retired the Digital Asset Links diagnosis.** It was right. `display=standalone`
  misleads the same way — Chrome reports standalone here even with a visible
  address bar.

The 12:39 screenshots with no address bar were a **separate installed PWA**
(he had just used Chrome's "Install and create shortcut" at 12:38), not the
Play app. A Chrome-installed PWA is also not a TWA, so it fails identically.

### Where the fault is not

- **The served file is correct and reachable.** Google's own validator returns
  both statements cleanly for the host the TWA launches:

      curl "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.turnsomedayintodayone.com&relation=delegate_permission/common.handle_all_urls"

- **The host matches.** `twa/twa-manifest.json` has
  `host: www.turnsomedayintodayone.com`, `startUrl: /app?src=play`, and
  `.well-known/assetlinks.json` declares `com.turnsomedayintodayone.app`.
- **Not the apex.** `turnsomedayintodayone.com` does fail the validator with a
  redirect error, but nothing launches the apex. Ignore it.
- **Not Samsung Internet.** `engine=Chrome 151`.

### Signing is ruled out — do not look there again

Jacques read both SHA-256 values off Play Console → App signing (direct link:
`.../app/4972165923818128065/keymanagement`) on 27 Aug 2026. Both match
`.well-known/assetlinks.json` character for character:

    99:D2:75:… app signing key (classical)   — present in the file
    91:7B:4C:… upload key                     — present in the file

The "Quantum-ready (beta)" badge and the *Previous app signing keys* row dated
28 Jul 2026 look alarming and are a red herring; the classical fingerprint in
use is the one already listed. Ignore the post-quantum column entirely —
Chrome's asset-link check does not use it.

### What is actually still open

**Nothing in this repo proves what the shell in the Play Store contains.**
`twa/twa-manifest.json` was added on 24 Aug 2026 (commit `614864e`) as a
reconstruction. The `.aab` that is live was built on Jacques's PC well before
that, and `git ls-remote` shows **no `twa-build` branch**, so the CI workflow
that would build from this manifest has never produced an artifact. Two
settings that the live shell may therefore lack, either of which alone causes
what we see:

1. **`features.playBilling.enabled`** — the repo manifest has it true. Bubblewrap
   does **not** enable it by default. Without it the Android shell omits the
   Play Billing delegation and `getDigitalGoodsService()` rejects with exactly
   `unsupported context`, even inside a perfectly verified TWA.
2. **`host`** — the repo manifest says `www.turnsomedayintodayone.com`. If the
   live shell declares the **apex** instead, Chrome fetched
   `https://turnsomedayintodayone.com/.well-known/assetlinks.json`, got the
   301 to www, and failed: asset-link fetches do not follow redirects. Google's
   validator returns `ERROR_CODE_REDIRECT` for the apex and full statements for
   www. That would explain the address bar as well.

**Fixed here (27 Aug):** `server.js` now serves `/.well-known/assetlinks.json`
before the apex→www redirect, so both hosts return it with a 200. Verified by
replaying both middlewares in registration order against real `Host` headers —
apex and www both 200 `application/json`, and every other apex path still 301s
to www. This removes cause 2 without a Play upload.

**Cause 1 is also weaker than it looks.** `PLAY-CHECKLIST.md` records that the
live 1.0.1 / code 2 bundle was built on 17 Aug from this very manifest, with
"Play Billing on, notifications on, Android 16, Billing 8". So the live shell
probably does carry the billing feature and the `www` host. Do not order a
rebuild as the first move; it is a real cost to Jacques and may change nothing.

**What app 5.9 adds, and why it is the next step instead.** One thing has never
been established: whether the failing window is the Play shell at all. The
`playBuild` flag latches into `localStorage` and, on Android, is permanent — a
single visit to `/app?src=play` in ordinary Chrome latches it forever, after
which every Upgrade tap routes to Play billing and fails exactly like a broken
shell. Jacques also installed a PWA from Chrome's menu on 27 Aug, which is a
third context that looks like the app and is not.

So the latch now records **how** it was set — `referrer` (an `android-app://`
launch, which is proof the shell opened the page), `param` (a query string,
which proves nothing), or `unknown` (the legacy `'1'`, never upgraded to
`referrer` because that would invent evidence). The diagnostic line adds
`host=`, `launch=` and `latch=`.

**The answer came back at 14:06 on 27 Aug, and it is `launch=shell`:**

    bridge=present · host=www.turnsomedayintodayone.com ·
    launch=shell · latch=referrer@2026-08-27T19:05 ·
    display=standalone · engine=Chrome 151 · app=5.9

`launch=shell` means `document.referrer` was `android-app://com.turnsomedayintodayone.app`
— the Android shell itself opened this page. Not a stale flag, not the PWA, not
a browser tab. `host=` is the exact host the file is served under. And the
address bar is still across the top.

**So this is now established, not inferred: the Play app launches, on the right
host, and Chrome refuses to run it as a verified TWA.** Everything on the
server side checks out, so the fault is in the installed shell or in Chrome's
verification of it — the one component nothing in this repo can inspect.

Historical read of the field, kept because the reasoning still holds:
- `launch=shell` → the Android app really did open this page, the shell is at
  fault, and a rebuild is then justified.
- `launch=param` or `launch=none` with `latch=unknown` → this is not the Play
  app. Nothing about Play billing has been tested yet, and the rebuild would
  have been wasted.

**Still needs Jacques:** rebuild the shell from `twa/twa-manifest.json`, sign it
with the upload key, and upload it. That is the only way to settle cause 1.
Run the `Build the Play app (.aab)` workflow (`workflow_dispatch`), take the
unsigned bundle off the `twa-build` branch, sign, upload, then reinstall on the
phone. Bump `appVersionCode` past whatever is live before building.

Install, use, the 14-day tester clock and reviews all work. Purchases do not.
Do not call this cosmetic.


app, reopen.** That is a 30-second test and it costs nothing.

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
