
### Security audit — shared links (28 Aug)

Two things fixed in the paths a stranger can reach:

- **Together codes are now generated with a proper random source.** They used
  to come from `Math.random()`, whose generator can be worked out from a few
  codes you have already seen — meaning someone who made a handful of their own
  links could in principle guess other people's. Now `crypto.randomInt`.
- **Joining with a code is rate limited** — 20 attempts an hour per network.
  A six-character code is short enough to guess at if nothing stops you trying
  a million times; now something stops you.

Checked and found fine: letter links use a 128-bit random token (unguessable),
letter creation and letter-accept were already rate limited, and a letter that
is unknown, revoked, or expired all look identical to whoever opens it.

Two more, same sweep:

- **The error log can no longer be flooded.** It only keeps the last 200 lines,
  so an app stuck in a retry loop could have pushed the real failures out before
  you ever read them. Reporting is now capped at 30 an hour.
- **The session cookie is marked Secure based on the connection itself**, not on
  a `NODE_ENV` variable the host has to remember to set. If that variable ever
  went missing, sign-in cookies would have quietly started travelling without
  the flag that keeps them off plain http.

Also checked and clean: the admin pages and stats are owner-gated (and the admin
shell 404s for everyone else), reviews and room posts are escaped everywhere they
are shown, letters are printed as text and never as HTML, unsubscribe links are
signed, and `/go/` redirects only to a fixed list.

### Email audit (28 Aug)

Checked every promise a page makes about email against what actually sends.
All five sequences fire for the sources that feed them, prices are identical
across all 46 pages, every internal link resolves, and no page points at a
missing image or file.

One fix: **the free PDF email now carries an unsubscribe link.** Everything
else that goes to a lead already had one. The partner page (`/when-he-drinks`)
promises exactly one email and no sequence, and it kept that promise — but that
one email was the only thing you send with no way out of the list at the bottom.

### Lesson and pricing-claim audit (28 Aug) — app 6.9

Counted every lesson day in the app. **All 90 days are there on all 14 tracks**
— days 1–30 written per track, days 31–90 shared and personalised, no gaps, no
blank days. Supporting Someone runs its own 35 and Together its own 30, exactly
as the Pro card says.

One claim was wrong and it was on the screen where people decide to pay. The
plans screen said Pro gives you "days 16–90 of every track, **including the
Spiritual Path and Together**". Those two are 30-day programs, and the Pro card
directly below it already said so correctly. Fixed to "day 16 onward on every
track, all the way to day 90 on the recovery tracks", which is true of all of
them.

### Stories audit (28 Aug) — app 7.0

Downloaded all ten story recordings and timed them. Every one was labelled
**"~10 min" in the app and none of them is** — they run 6.9 to 8.5 minutes.
Each story now shows its own real length (7, 8 or 9), and the shelf blurb says
"seven to nine minutes each" instead of "about ten minutes each".

Also confirmed: all ten stories have a recording on the `lesson-audio` branch,
there are no orphan files, and no story in the app is missing audio.

Service worker cache bumped to v6.8 so the corrected lengths reach people who
already have the app open.

### The win-back email went to an active member (28 Aug) — FIXED

Jacques forwarded a screenshot: someone who has been using the app got the
"Day one is still there — you haven't been in for a couple of weeks" email.

**Why.** The win-back worked out whether you had been away by looking at the
activity log, and the activity log only records 33 specific actions — finishing
a lesson, logging a craving, playing a story. Open the app, read, close it, and
it writes nothing. To that email you had vanished.

**Fixed** by asking three questions instead of one, and taking the most recent
answer:

- did she do something the app counts (activity log, as before)
- did her app sync anything back to the server
- did any signed-in request arrive at all — a new `last_seen_at` stamp, written
  on every authenticated request, throttled to one write an hour

The third is the honest reading of "been in" and it did not exist before.

**Nobody gets it twice.** The send-once guard means anyone already emailed by
mistake will not be emailed again. `last_seen_at` starts empty and fills in as
people use the app, so the state-sync signal is what protects the next few days.

Five regression tests in `server/test/winback.test.js`, including the exact
shape of this false send.

Retention in /admin/stats still counts *actions*, not app opens, and that is
deliberate — retention should measure engagement. Only the win-back needed the
broader definition.

### Together rebuilt — 30 days → 90 (29 Aug) — app 7.1

Jacques read the couples track and said it looked repetitive, and that the
things he needs to repair a marriage were not in it. He was right. The old
30 days measured out like this:

- **24 of 30 daily actions were talking or writing.** It was a talking program.
- Physical affection: 3 days, and only one was really about it — and that one
  was a *conversation* about closeness, not touching.
- Fun, dates or play: 4 days. Two dates booked once, on day 14. Nothing recurring.
- Chores or doing something for the other: 3 days.
- Game night, eye contact, kissing, massage: **not in it at all.**
- Nobody was ever asked their schedule.

**The rebuild, on his direction:**

- **For any couple who needs repair**, not only couples touched by addiction.
- **90 days**, matching every other track.
- **One phone, both people, every day.** Nothing is done separately, ever.
  Linking two accounts is no longer the way in — it stays as an option.
- **Every day has two parts:** a TOGETHER action and a FOR THEM act of service.
  All 90 days have both.
- **Day 1 is the schedule.** The program is built on when they are actually in
  the same room, because anything not in the calendar loses to everything that is.
- Framed as training throughout — his own line: a relationship is a muscle, and
  you do not get the benefit if you do not do the work.

New coverage: touch on 12 days, kissing 5, holding 7, massage 4, dates 19,
game night 8, acts of service on all 90. Six phases of fifteen — Show Up,
Turn Toward, Clear The Air, Play Again, Closeness, Make It Permanent.

Together is now excluded from the shared recovery phases (it would have
addressed a couple as one person working on "the habit"). Every "Together is
30 days" claim in the app is updated to 90, including the Friendly system
prompt. Cache v6.9.

### The database now has backups (29 Aug) — it had NONE

Jacques asked about free hosting. Free hosting is not the real risk; the answer
to that is in the reply. What the question uncovered is: **there was no database
backup of any kind.** Every account, password, Stripe link, couple link and
person's progress lived in one SQLite file on one volume, and if that volume had
gone, there was no way back. `/api/account/export` is one person's own data on
request — it was never a backup.

**What exists now:**

- **A daily snapshot**, taken with `VACUUM INTO` so it is consistent while the
  app is running. Last 7 kept beside the database. These cover the likely
  disaster — a bad deploy, a wrong delete.
- **An emailed copy** to `APP_OWNER_EMAIL` with the database attached. This is
  the layer that survives losing the machine, because it lands somewhere the
  hosting provider does not control. Skipped above 15 MB, and the skip is
  written to the error log rather than passing quietly.
- **A Download button** on `/admin/stats`, plus "Back up now". One tap puts a
  copy on his own machine.

Owner-gated the same as diagnostics — verified by test: 401 signed out, 403
signed in as anyone else.

**Two real bugs were caught by testing before this shipped:**

1. The prune deleted the **newest** snapshots and kept the oldest. It sorted on
   file modification time, which a restore or a volume migration resets. It now
   sorts on the timestamp in the filename.
2. Two snapshots in the same second **threw** instead of backing up —
   `VACUUM INTO` will not write over an existing file. It now takes the next
   free name.

Six tests in `server/test/backup.test.js`, including an actual restore: the live
database is thrown away and the snapshot is opened to prove the accounts and
their data come back. A backup nobody has restored is only a belief.

---

## 29 AUG 2026 — PLAY BILLING: WHAT IS RULED OUT. READ BEFORE TOUCHING IT.

**The symptom.** The Play Store app opens with a browser bar at the top (an ✕,
the web address, a share icon). That bar means Android is NOT running it as a
trusted app — it has fallen back to a browser tab. Play Billing is unavailable
in a browser tab, so buying Pro fails with:

    OperationError: unsupported context
    bridge=present · launch=shell · display=standalone · engine=Chrome 151

**These are checked and eliminated. Do not re-walk them.**

| Checked | Result |
|---|---|
| `assetlinks.json` reachable | **Yes** — 200, `application/json`, on the apex AND on www |
| File contents | **Correct** — right package name, right relation, valid JSON |
| Fingerprint vs Play Console | **Exact match**, compared programmatically not by eye. Google's app signing SHA-256 `99:D2:75:...:6B:F5` is present in the file |
| Assetlinks served before the apex→www redirect | **Yes** — route registered at server.js line ~115, redirect at ~119 |
| Uninstall + reinstall from Play Store | **Tried. Did not fix it.** |
| Wrong app being tested | **Ruled out** — Jacques confirmed he installed from the Play Store, and it still shows the bar. An earlier theory that he was testing a Chrome-installed copy was WRONG for this case; he does have two copies, but the Play one fails too |
| Is `playBilling` enabled in the build? | **Yes, and it was already enabled in 1.0.1** — the 1.0.2 bump changed version numbers only |
| Which app is actually installed | **PROVEN 29 Aug from Android's own app info screen:** "App downloaded from Google Play Store", **Version 1.0.1**. Not a Chrome copy, not a guess |

**How to know when to retest:** Android Settings → Apps → Turn Someday Into Day
One shows the installed version at the bottom. It read **1.0.1** on 29 Aug. When
that screen says **1.0.2**, the fresh build has landed — open the app and look
for the browser bar. Bar gone = fixed.

### 🟢 29 Aug, 2:42 PM — CONFIRMED WORKING ON A REAL DEVICE

After the fingerprint fix deployed, Jacques uninstalled, reinstalled from Play
and opened the app. **The browser bar is gone** — the app runs as a real
Trusted Web Activity — and **a Google Play purchase completed**: "You're Pro.
Your purchase is confirmed." with the Pro column showing Current plan.

Android in-app purchases work. This was broken from launch.

### 29 Aug, 2:26 PM — the cause: the app signing key had been rotated.

**Play Console's own "Digital Asset Links JSON" snippet** (App signing page,
below "Request upload key reset") named the fingerprint Google actually signs
this app with:

    6D:F4:77:66:48:55:36:6D:F2:10:A8:C7:4C:3C:5B:27:A7:59:F4:97:29:8F:C1:FC:74:68:6D:D2:6A:EF:76:9A

**It was not in assetlinks.json.** The file held `99:D2:75:...` (a previous app
signing key) and `91:7B:4C:...` (the upload key). The signing key had been
rotated — the page shows a "Previous app signing keys" section and the current
key marked "Quantum-ready (beta)" — and the file was never updated to match.

Android compares the certificate on the phone against that file. No match means
no trust, which means the app runs as a plain browser tab, which means the
Digital Goods API refuses with `unsupported context`. Every symptom, one cause.

All three fingerprints are now in the file, current key first. The previous key
and the upload key are kept deliberately: Google's own instruction is to MERGE
with existing statements, and keeping them costs nothing while covering old
installs and local debug builds.

**The lesson worth keeping: never transcribe fingerprints by hand.** Two of them
were pasted into this file from screenshots over two days and one was simply the
wrong key. Play Console generates the exact snippet — use that, always.

### (superseded) 29 Aug, 2:22 PM — 1.0.2 tested, did not fix it

1.0.2 published at ~1:40 PM (under an hour of review, full rollout). Jacques
uninstalled, installed fresh from Play, opened it: **same browser bar, same
`OperationError: unsupported context`.** Diagnostics `app=7.2 ·
latch=referrer@2026-08-29T19:21 · engine=Chrome 151`.

So the age of the build was NOT the cause. Do not rebuild again expecting a fix.

**The single fact still unverified** — asked for twice, not yet supplied — is
**which Play Console section the fingerprint `99:D2:75:...:6B:F5` came from.**
If it is the *upload* key, and Google's *app signing* key is a third value that
is not in the file at all, then every other check passing is exactly what you
would expect and verification still fails. That is the last hypothesis standing
and it fits every symptom. Get a screenshot of **Test and release → Setup →
App signing** showing BOTH certificates before doing anything else.

**The old one-variable theory, now disproved:** the shell on Play was built weeks ago with
older build tools and an older Play Billing library. **1.0.2 (code 3) is a
fresh rebuild** and was signed and submitted 29 Aug — it was in Google review
at end of session. When it publishes: reinstall, open, and look for the bar.
Bar gone = fixed. Bar still there = this is beyond what was worked out from
here and deserves fresh eyes.

**Do not re-suggest the following — they were offered and Jacques said no:**

- A Stripe fallback when Play billing fails (see below). He declined it.

### The Stripe fallback — offered 29 Aug, DECLINED

The app detects "launched from an app shell" and switches to Play purchases.
A Chrome-installed copy looks identical from the inside, so the app offers Play
billing where it can never work, and blocks the Stripe path that would have
worked — the user gets "Upgrade unavailable" instead of a card form.

Fixing it means falling through to Stripe when the Digital Goods call fails.
**Jacques was offered this and said no.** Do not implement it or raise it again
unless he asks.

### Signing the Play bundle — the toolchain, so it is never re-derived

Three scripts in `twa/`, in the order they are used:

1. **`Install-Java.bat`** — his PC had NO Java. jarsigner ships inside Java, so
   signing was impossible until this was installed. One time only.
2. **`Sign-Play-App-v2.bat`** — downloads the cloud-built .aab, finds Java
   (PATH, `.bubblewrap`, Android Studio's jbr, Program Files vendors), signs it.
   v1 is dead: it looked in exactly one guessed folder and failed.
3. **`Find-Signed-App.bat`** — the move to the Desktop fails on this machine
   because **his Desktop is inside OneDrive** (`C:\Users\malon\OneDrive\Desktop`),
   so `%USERPROFILE%\Desktop` does not exist. This finds the bundle, verifies
   the signature, and copies it to the real Desktop.

Signing works. It produced `day-one-1.0.2-signed.aab`, 1.75 MB, verified.

### Free hosting — asked twice, answered, CLOSED

He asked about free hosting twice. The honest answer: the only genuinely free
option that runs this app unchanged is a self-administered VM (Oracle Always
Free) or a home machine behind Cloudflare Tunnel; everything else either sleeps
(killing the hourly email scheduler) or has no persistent disk (destroying the
SQLite database). **He said "leave it alone." Staying on Railway. Do not raise
it again.**

The lasting good that came out of it: the database had no backup at all, and
now has one (see the backup section above).

### A Play subscriber could not cancel (29 Aug) — app 7.3

Minutes after the first successful Play purchase, Jacques tapped **Cancel
subscription** on his own active plan and got:

> "No billing account found yet. Upgrade to Pro first."

Every cancel went to the Stripe billing portal, and a Play subscriber has no
Stripe customer, so `createPortalSession` threw that message at somebody
looking at a live subscription. The client had no idea `billing_source` even
existed — the word appeared nowhere in index.html.

Fixed: `/api/billing/status` now returns `billingSource` and `storeProductId`;
the app routes Cancel and Resume to the Google Play subscriptions page when
Play is the biller and to Stripe otherwise; and the portal endpoint refuses a
Play user with a machine-readable `managedBy: 'play'` instead of the misleading
error, so even a stale client redirects correctly.

This was a policy risk as well as a bug — Google requires that a subscriber can
reach their subscription management. Five tests in `server/test/billing-source.test.js`,
including that lifetime is still answered before any billing route is chosen.

### 🔴 I BROKE THE LIVE APP FOR ~25 MINUTES (29 Aug) — app 7.4 is the fix

App 7.3 shipped `const PLAY_PACKAGE='com.turnsomedayintodayone.app';` a second
time. It was already declared at index.html:11565. A duplicate `const` is a
**SyntaxError**, and a SyntaxError means the browser parses **none** of the
script — so every button in the app did nothing. Sign-in did nothing. There was
no error message anywhere, because no code ran at all.

Jacques found it the hard way: reinstalled twice, then reported "it does
nothing". He was right and I had shipped it.

**Root cause of the root cause: nothing was checking that index.html parses.**
It is one 733KB inline script, edited constantly by scripted find-and-replace,
and a single duplicate identifier takes the whole product down silently.

`server/test/app-syntax.test.js` now extracts every inline script from
index.html and the other shipped pages and runs `node --check` on each. It
excludes `type="application/ld+json"` blocks, which are structured data rather
than JavaScript — checking those as JS reported a false failure on reviews.html
the first time round.

**Rule from this: never ship an index.html edit without running the tests.**
The suite catches this in under a second; a person cannot eyeball 733KB.

### Stories now rotate in fortnightly SETS (29 Aug) — app 7.5

Jacques: *"every 2 weeks there should be new stories — the first five, then
switch to the next five, and deleted, and a new set of 10."*

A **set of ten runs four weeks**: five for a fortnight, the other five for the
fortnight after, then the set retires and the next one begins. The old code
picked five weekly with a stride, so a story could appear two weeks running and
a set could never end.

`data/audio-stories.json` now accepts either shape:

    { "batches": [ { "id": "...", "stories": [ ...10 ] }, ... ] }
    { "stories": [ ...10 ] }          // a flat file is read as one set

**Adding the next set is a data change only** — append a batch, put ten mp3s on
the `lesson-audio` branch under `stories/<id>.mp3`, done. No code.

**Order inside a set is load-bearing.** The file's original order would have made
fortnight one all five *from the fight* and fortnight two all five *for the
supporter* — a wife opening the app in week one would have found nothing written
for her. Reordered to 3/2 then 2/3, with topics spread across both halves. Keep
that balance when writing the next set.

**With only one set written, it repeats rather than emptying.** That is deliberate,
and it is the honest consequence of the next ten not existing yet — "deleted for
good" needs a fresh set to exist, and that means ten new stories plus ten new
recordings, roughly monthly.

Nine tests in `server/test/story-rotation.test.js` cover the fortnight boundaries
(days 0/13/14/27/28), that no story appears in both halves, that a set owns
exactly 28 days, the single-set repeat, and that a set shorter than ten is served
whole rather than sliced to nothing.

### Why the app had ZERO Play ratings (29 Aug) — app 7.8

Jacques: *"i rated apps on google store within 30 minutes of trying it. i want
a user to rate it on google store immediately, not in the app."*

Three things were stopping that:

1. **It never checked whether the person could actually rate.** The ask fired
   for web and Chrome-installed users, who have nowhere to leave a Play rating.
   `S.ratingAsked` is permanent, so if they later installed properly they were
   never asked again. Now gated on `isPlayBuild()`.

2. **The bar was unreachable, and then still too slow.** It wanted 7 days AND
   7 finished lessons — on 6 installs nobody cleared that, so it never fired.
   The only bar now is **three logged actions**: somebody looking around
   clears it in their first sitting.

3. **It could only fire after a finished lesson.** That one hook made an early
   ask impossible. It is now also checked shortly after the app opens.

The prompt said **"Seven days of showing up."** — a lie the moment it could
fire on day one. Now "Liking it so far?". It opens the Play listing; no rating
is collected inside the app.

**No manual email.** A one-off outreach email was written and Jacques killed
it: *"im not sending nothing"*. Deleted. The day-30 review email already goes
out automatically and now carries the Play link — that is the whole email side
of this, and it should stay automatic.

Profile also carries a permanent **"Rate this app"** row, Play installs only.

Numbers to judge it against: 6 installs, 23 monthly active devices, 0 ratings
as of 29 Aug.

### The rating ask now repeats until they tap through (29 Aug) — app 7.9

Jacques: *"keep the app asking for a rating every time they open it and never
rated it."* Done. It is no longer once-only.

- Shows on **every open** until `S.ratedOnStore` is set.
- **"Not now" is not an answer any more** — it comes back next time.
- The only thing that stops it is **tapping through to the Play listing**.

**The limit he was told about before choosing this:** the app cannot know
whether anybody actually left a rating. Google does not report it back. Tapping
through is the only signal that exists, so somebody who taps and then changes
their mind is never asked again. There is no way around that.

**He was also told the risk:** people who keep dismissing now see it every
single time, and a share of them leave one star out of irritation. He chose it
anyway, which is his call.

Still guarded: Play installs only (nobody else can leave a Play rating), and
never on a day with a slip logged. `S.ratingAsked` is dead — nothing reads it.
