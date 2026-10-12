# Handoff — Turn Someday Into Day One

## Where things stand, 4 Oct 2026 (read this first)

**The app is three pages and nothing else — and it is called The Truth.**
Jacques named it on 4 Oct 2026 ("name the app the truth"); that is the name on
the phone (the home-screen name), the browser tab, the shell heading and
`manifest.json`. `/app` serves `hub.html`, a small
shell holding three cards: the Zodiacs (`/key`), the Herbs (`/herbs`) and the
Player (`/music`).

**The Fight is deleted — 10 Oct 2026.** Jacques: "delete the fight from
everywhere." The door, the pages, the 3D ring, its art and sound, its routes,
its lines in the gate, the worker and the build, its spec and its tests were all
removed the same day, and its own record here was stripped with them. The shell
went to four doors with it and the cache name moved to `tsid-shell-v2.5`,
or an installed phone keeps a door that is not there. **Do not rebuild it.**

**The Trainer is back — 11 Oct 2026.** It was deleted on 10 Oct ("Ddelete the
trainer": the door, the page, its two routes, its lines in the gate, the worker,
the Vercel rewrites and the build's file list all went, with its tests), and it
returned the next day, smaller: "then create the trainer we will be slowly so
start off with just basic input information that's it." So the page
(`trainer.html`) asks for the basic information — name, age, height and weight,
days a week, what time of day, what is in the house, what you want out of it,
anything that hurts, anything a doctor has ruled out, and day one — keeps it on
the phone (`localStorage`, key `tsid_trainer_intake_v1`), sends nothing
anywhere and **plans nothing yet**. There is no exercise, no plan and no session
on it on purpose; that is the next step, deliberately one at a time. The door is
back on the shell, so the shell is **four doors** again and the cache name moved
to `tsid-shell-v2.7` with it, for the same reason as every bump before it.

**The herb library has no Friendly on it.** The ask box came off `/herbs` on
4 Oct 2026 ("take a friendly off the herbs"). An open herb carries a **Read it
to me** button instead, which reads the entry out loud with the phone's own
voice (`speechSynthesis`) — no key, no server, no cost and nothing sent
anywhere. Its safety lines are unchanged and still on the page's own safety tab;
the tax page's ask box is untouched. Everything else is a reference page (`/tax`, `/privacy`,
`/delete-account`, `/letter.html`, `/admin/stats`), or an asset.

**The recovery app is deleted.** Its page — the one 15,000-line file that held
the entire client, every entry below's "the app's page" — was removed on 4 Oct
2026, along with the server routes that served it and the eighteen test files
that read it. Anything below this note that describes editing that page is a
dated record of work done while it existed. **Nothing edits it now, and no rule
about it applies.** Where an entry says to change a version, a screen or a
helper, the file to change today is almost always `hub.html` (the shell) or the
page the feature lives on.

**What is live and what is not.** The day counter, the lesson programs, the
journal, the SOS tools, the weeklies and Friendly were all part of that app and
went with it. `/app` is free and private: the door is the `FRIENDLY_EMAILS`
allowlist plus the owner address. Nothing is sold, so ignore every entry below
about payments, Stripe, rooms or the store listing billing.

**Where it is served, 4 Oct 2026.** The app runs on **Vercel**, not Railway.
The live address is **https://thetruth-theta.vercel.app** (a second alias,
`https://app-thetruth.vercel.app`, resolves to the same build and behaves
identically — both gate every private page). Vercel checks the filesystem
before it runs any rewrite, so the private pages are deliberately **not**
static files there: `vercel.json` builds into `webroot/`, `vercel-build.js`
copies only assets into it and refuses to finish if a `.html` ever lands
there, and the pages travel inside the `api/index.js` function
(`includeFiles` is one brace-expansion glob — Vercel rejects a list). The door
is `APP_PASSWORD` plus the `FRIENDLY_EMAILS` allowlist; the AI routes proxy
Gemini with `GEMINI_API_KEY` held server-side. The Railway host below is kept
as the record of how it was built, not as the current host.

**The spare word, 5 Oct 2026.** Jacques could not get in — the password box
answered "that password is not right" — and there was no way back: one word,
kept nowhere but the host's own settings screen, on a host he had to find on a
phone. So there are now two settings beside `APP_PASSWORD`:
`APP_RECOVERY_PASSWORD` (a second word that opens the same door) and
`APP_OWNER_EMAIL` (the one address it opens for — the same address Friendly
already uses for diagnostics, and it must be on `FRIENDLY_EMAILS` as well).
Either word signs the owner in; the list still decides who belongs. Set both
and keep the spare written down somewhere away from the phone. With
`APP_OWNER_EMAIL` unset the spare opens nothing, on purpose: a word that opens
the door for whoever guesses it is a back door, not a way back. The tests in
`server/test/vercel-app.test.js` hold all of this, including that the spare is
refused for the wife's address.

**The meditation room, 5 Oct 2026.** The eleven tracks in `audio/meditation/`
(rain, ocean, night, night fade, cozy storm, deep focus, himalayan still,
still waters, midnight lullaby, fading into the night, whispers in the forest)
belonged to the recovery app and were referenced by nothing at all after it
went — they were not even reachable: the build copied only the folders the app
still needed, so every one of them answered 404 on the live host. They now sit in the Music
page's Player as a card of their own, one tap each, stepping with the same
prev/next as the person's own songs. They are deliberately **not** in the
`songs` list: they are not the person's files, so they carry no ✕, "remove all"
leaves them alone, and nothing is copied into the phone's storage for them.
`vercel-build.js` gained `audio/meditation` in `DIRS`, which makes those files
public URLs on Vercel (about 32 MB of deployment weight) — that is the trade for
them playing at all, since a gated route cannot stream range requests the way
the static file can.

**The push rule (from CLAUDE.md, and it is the current one):** never push unless
Jacques says push. When he does: `claude/new-session-im7bzg`, then `main`, then
`claude/vibe-code-uwxxlk` — all three, same commit. The branch names in older
entries below are out of date.

---

## What this is

**Four doors and nothing else, free and private.** The Zodiacs (`/key`), the
Herb Library (`/herbs`), the Player (`/music`) and the Trainer (`/trainer`),
reached from the shell at `/app`, plus a reference page for tax, the policy
pages the store requires, a letter link and the owner's stats page. The day counter, the lesson
programs, the journal, the SOS tools, the weeklies, the live rooms and the AI
companion all belonged to the recovery app that was deleted on 4 Oct 2026.
Nothing is sold. One person built it and runs it.

## Shape of it

- `hub.html` — the shell at `/app`: three cards, the sign-in form and the door.
- `music.html` (the Player) — added 5 Oct 2026, behind the same door as the rest.
  (`trainer.html`, the gym, was added 9 Oct 2026 and deleted on 10 Oct 2026.)
- `key.html` (The Zodiacs), `herbs.html` (the Herb Library), `tax.html` — the
  private reference pages. `letter.html`, `admin-stats.html`, `privacy.html`,
  `delete-account.html` — the plumbing and the policy pages.
- `server/` — Node/Express, `node:sqlite`. `server.js` routes, `db.js` schema,
  `auth.js`, `private-app.js` (the door), `key-reading.js`, `push.js`,
  `backup.js`, `email.js`, `analytics.js`.
- **The lessons are deleted (6 Oct 2026).** `data/lessons/lesson1..13.json`,
  `data/lessons.json` and `data/build-lessons.js` are gone. No page served them
  after 4 Oct, when the app that read them was removed, so 390 lessons of text
  had no screen left to reach. `data/stories.json` and
  `data/audio-stories.json` are still here.
- **Lesson audio went with them.** `data/lesson-audio-manifest.json`,
  `tools/generate-lesson-audio.py`, `tools/generate-pack-audio.py` and the
  `preview/` lesson page are deleted, and the `/preview` gate in `server.js`
  went with it — nothing read the manifest once the lesson screen was gone. The
  recordings themselves are still on the repo's **`lesson-audio` branch**
  (never merged, served from `raw.githubusercontent.com`, so they add zero
  weight to Railway builds and home-install updates) and are untouched.
- `tools/generate-phase-audio.py` writes that same manifest path, for days
  31-90 out of `data/phases.json`. It now starts a fresh file when there is
  none, so it still runs — and running it brings
  `data/lesson-audio-manifest.json` back.
- `twa/` — the Android wrapper config (see Android, below).
- Hosted on **Railway**, auto-deploys on push. Domain `www.turnsomedayintodayone.com`.
  The apex domain without `www` serves nothing.

### Two branches, always both
Every commit gets pushed to `claude/app-qc-competitive-analysis-lehsn9` **and**
`claude/vibe-code-uwxxlk`. The second is what Railway deploys.

### Versioning
Four files move together on every user-visible change: `sw.js` (`CACHE_NAME`),
`hub.html` (`APP_VERSION`), `package.json`, `server/package.json`. The service
worker cache name must change or clients keep the old shell. The number was
deliberately reset from 35 to 7 before launch; it is now 5.2 (5.0.0 was a reset from 7.0.3 at the owner's request, 6 Aug 2026 — the number only has to change, never increase).

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
| `GEMINI_API_KEY` | Friendly and The Key — the only AI provider |
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


## Testing purchases: never use the owner account

`isComped()` in `server/billing.js` grants Pro to `APP_OWNER_EMAIL` — and to
every address in `COMP_PRO_EMAILS` — with no payment. So a Pro badge on
Jacques's own account proves nothing about billing, and on 28 Aug it very
nearly went into the log as "payment system proven end to end". He caught it:
*"i already got all time pro on my owner account."*

**Test on a fresh address that is neither.** If you must use his, read
Profile → the subscription line, which distinguishes the two cases because
`getBillingStatus` resolves `paid` before `comped`:

- `Pro plan — Monthly` / `Yearly` / `Lifetime` → a real `user.plan`, written
  only by the Stripe webhook. The chain worked.
- `Pro plan — Complimentary` → `plan: 'comp'`, no payment involved. Whatever
  you were testing is still untested.

## The Play latch: why it is sessionStorage, and do not "fix" it back

A Trusted Web Activity **is** Chrome, sharing one storage jar with the browser
for this origin. So the old `localStorage` flag written by the Android shell
was read back by every ordinary Chrome tab and every Chrome-installed shortcut
on that phone, permanently — the site believed it was the Play build, routed
Upgrade to Google billing, and `create-checkout-session` refused Stripe by
policy (403 on `X-TSID-Client: play`). Combined with the broken shell, **every
Android owner of the app was unable to pay by any route.** Stripe had created
no checkout session between 30 July and 28 Aug.

The flag now lives in `sessionStorage` (one browsing context), and the legacy
`localStorage` key is deleted wherever found.

**Both directions are covered, and both were tested in headless Chrome on an
Android user agent — rerun these before touching `detectPlayBuild`:**

| Context | `isPlayBuild()` | Why it must be that |
|---|---|---|
| Play app launch (`?src=play`) | `true` | Play policy: never Stripe in the shell |
| Play app after a reload with no query | `true` | sessionStorage carries it |
| Play app returning from a redirect | `true` | same |
| Chrome-installed shortcut / plain tab | `false` | not Play-distributed; Stripe is correct and is revenue |

**Do not add a `display-mode: standalone` test as a backstop.** It looks
tempting and it is wrong: a Chrome-installed shortcut reports `standalone` too
(Jacques's 27 Aug screenshots show exactly that), so it would re-break the very
case this fixed. The honest discriminator once the shell is healthy is
`getDigitalGoodsService()` actually resolving; it cannot be used while the
shell is broken, because it rejects there too.

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
(the app's page, `landing.html` ×2), and two stale references to the renamed
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

## 24 Sep 2026 — the two Afrika books go into the herb library (no version bump)

Jacques put two books in the repo and asked for them in the herb part: *"put
them in the herb part dont cre about medical claims organize the herb part more
make it more sufficient and more detailed"*. The two are **African Holistic
Health** (the copy in the repo is Bookey's **summary** of it, not the book) and
an OCR scan of **Nutricide**. Both were read in the same session.

`herbs.html` was 244 herbs, a search box, four tabs and an ask box. It now carries:

- **Eighteen herbs it did not have** — the kitchen seasonings Nutricide names
  that were missing (allspice, chervil, dill, marjoram, paprika, savory,
  vanilla), and the ones African Holistic Health names in its classifications
  and its remedy table (wheatgrass, grape seed, pine bark, chaparral, buchu,
  wild violet, spikenard root, blue cohosh, black haw, centaury, gymnema). Each
  has a new **`bk`** field — *From the books* — with the book's own line for it.
- **A new tab, From the books**, sixteen sections: how the books say to prepare a
  herb; the multi-vitamin method and the herbs in it; the seasoning amounts
  (Nutricide p339); which seasoning goes on which food; what each seasoning is
  for (p341); the blood cleansers (p342); the immune builders (p342-343); the
  book's short shelves for skin, yeast, sleep and digestive enzymes; the
  nutritional approach; **the twenty classes of herb**; the herbs-for-dis-eases
  table; the vitamin and mineral guides; the doctrine of signatures; the diet it
  argues for; and a section naming which book every part came from.
- **Three new shelves** under By need: blood cleansers, building the defences,
  kitchen seasonings.
- The tabs, the cards and the click handling are unchanged — a book section
  opens and shuts through the same `data-h` toggle a herb card uses.

**The books' own amounts are printed as the book's, and labelled as the book's**
in the tab before the reader reaches them. That is the whole of what makes
printing them honest, and a test holds it. Three things the books name are marked
rather than handed over, on the page and on their own entries: **blue cohosh**
(harmed babies), **lobelia** (measured in drops; has killed people who guessed)
and **chaparral** (liver damage; an FDA warning in the 1990s). The safety tab is
untouched, and the twenty classes carry the line that a class says what a plant
is for, not that it is safe.

Also: **the app's page no longer prints "244 herbs"** — a count that is wrong is
worse than no count — and the row says *herbs, seasonings and cleansers* instead.

**No version bump.** `sw.js:136` hands `/herbs` and `/herbs.html` straight to
the network, so that page is never served from the cache and nothing has to be
invalidated for it. Version stays 5.1.

**How it was changed:** `tools/apply-herbs-books.js` — re-runnable, one anchor per
edit, refuses to write unless every anchor appears exactly once, and checks what
landed afterwards.

**Tests:** `server/test/herbs-books.test.js`, 7 new — the eighteen named herbs
and their `bk` lines; no herb pointing at a shelf that does not exist (the way a
hand-typed list goes silently missing); no empty shelf; the tab rendering with
the book material in it; the figures staying labelled as the book's; search
reaching a herb by its book words; and no count printed in the app's page.
`npm test` 474 pass / 0 fail.

**Not verified:** there is no browser in this environment, so the tab was run
through the same stub DOM the other page tests use — the wiring and the markup,
not the pixels, and not on a phone.

## 24 Sep 2026 — the claims go in, and everything held back goes back (`tools/apply-herbs-books2.js`)

His words after the first pass: *"put medical claims in and whatever you left off"*.

**The page stopped saying it does not claim anything.** The line under the title,
the note at the top of the inline script, the field legend, the label on every
herb card (`What people have used it for` → `What it does`), the safety tab's
own box and the ask box's instructions all now state what a plant does. The old
box said *"Nothing here says it works"*; it now says the claims are made here.

**Every refusal came off the entries.** Gone: `this page will not hand you`,
`this page will not hand over`, `Its place here is history, not a
recommendation`, `this page will not send you to a root for it`, `It is not
recommended`, `Do not make this at home`, `Do not make tea from it`. Affected:
goldenseal, oregano oil, coltsfoot, pleurisy root, uva ursi, lobelia, pennyroyal,
periwinkle, wormwood, chaparral, blue cohosh. **The facts stayed** — a plant that
has killed people still says so, in the plant's own entry. The tab's hedges went
the same way, and the **beef row went back into the seasoning list**.

**What was left off went in**, eight new sections: the book's dis-ease chart (21
conditions and what it gives for each), its easy remedies, the food chapter (food
combining, white sugar as a drug, the microwave), the **food as medicine chart**
from Nutricide p337-338, how the book reads the body before treating it, colours
and the organ clock, the history chapter, and the book's own quotable lines.
**Four more herbs**: castor, henna, tormentil, stone seed. Zinc and selenium
added to the minerals.

**Still in, on purpose:** an infection, withdrawal (988), a new and sudden
headache, a chest that hurts to breathe, and anything on a prescription — the
`ASK_SYS` bullet list is untouched. Those are not claims, they are the
difference between a page and a person being hurt, and the ask box is built to
say them. He has not asked for those out; if he does, that is the one list to
change.

**Not added, deliberately:** the race-and-history polemic in the middle of
Nutricide (the `White Folks Thinking` chapter and the grease-and-candles
passage). It is not herb content and it is not health content; the herb part is
what he asked for. Said so to him rather than doing it quietly.

**Tests:** `server/test/herbs-books.test.js` updated — the refusals are now
asserted **absent**, the claim language asserted present, and the new sections
covered. `npm test` 476 pass / 0 fail. No version bump (the same reason as
above: /herbs never comes from the cache).

## 24 Sep 2026 — the trading goes, every last piece of it (5.2)

Jacques: "now remove the trading game the desk everything about trading im done."

**Deleted, not hidden:** `desk.html`, `desk-assistant.js`,
`market-maker.html`, `trading-school.html`, `tradingview/` (both .pine
scripts), `vendor/lightweight-charts/` (the charting library only the desk
loaded) and `server/market-data.js` (the candle feed). Their six test files
went with them: `desk`, `market-maker`, `trading-school`, `market-data`,
`tradingview-pine` and `chart-picture`. Twenty-two builder scripts under
`tools/` went too - the desk, market and school patchers and their block files
- because they could only ever build pages that no longer exist.

**Also deleted, at the repo root:** `tools/market-maker/` - the original
Market Maker Warfare: `mmw.html`, its manual PDF and its README. It was never
part of the shipped app, but it is trading, so it went with the rest. Git
history still has it, as it has everything else deleted here.

**Out of the server:** the routes `/market-maker.html`, `/school`,
`/school.html`, `/desk`, `/desk.html`, `/someday-strategy.pine`,
`/someday-frames.pine` and the candle feed `/api/candles`, all from
`server.js`; the market-maker, school and desk entries from `OPEN_PAGES` in
`server/private-app.js`; the three never-cache lines from `sw.js`; and the
chart-picture half of `server/ai-chat-body.js`.

That picture matters more than the rest of the deletion. It was the only image
on any route in this app and the desk was the only thing that could attach one,
so **no route accepts an image anywhere now**. The rule it was built to keep -
a picture is never silently dropped - has nothing left to apply to.
`server/test/ai-body.test.js` replaces `chart-picture.test.js` and asserts the
image path is gone as well as that the thinking knob still matches the model
generation.

**Out of the app:** the three Settings rows (Trading Game, Trading School,
Trading Desk) in the app's page, and the sentence in the in-app policy and in
`privacy.html` that named the trading questions and chart screenshots. Both
policies now say only the message is sent. That is the half a policy must not get
wrong, and there is a test for it. The desk's assistant prompt (`DESK_SYS`) is
gone with the page - four AI prompts are left: Friendly, The Key, and the herb
and tax ask boxes.

**Kept, and why:** the **Tax Centre stays**. It is a tax reference - 2026
figures, mileage, set-aside, records - and the only "trading" in it is one
deduction line about a first year of business. Not a trading page, so it was left
alone and he was told so. **The herb library stays** untouched.

**Version 5.2.** The four files moved together. Unlike /herbs, the app shell is
what changed here - the Settings rows and the in-app policy live in
the app's page, which is cached - so the bump was required, or phones would keep
the old shell with rows pointing at pages that are gone.

**Tests:** 285 pass / 0 fail across 33 files. It was 476 before: the trading
tests are the difference, not tests going quiet. The 476 written into the herb
entry above was the total before this removal.

**Not verified in a browser.** There is no browser in this environment. The
checks are the suite above and `node --check` on the server; nothing was opened
on a phone.
