# START HERE

Orientation for Jacques and for any Claude session picking this up. Chat history
does NOT carry between sessions — this repo is the shared memory. Read this first.

---

## What this repo is

Two separate apps in one repo (kept fully separate on disk):

- **`TurnSomeDayIntoOneday/`** — the recovery app + companion for the person who
  loves them. A web app (Node/Express server + `index.html` front end) wrapped as
  an Android TWA for the Play Store. This is the one in active launch.
- **`Studio/`** — an AI music-video / content-creation tool (separate product;
  used here to produce marketing videos: teleprompter, webcam recorder, AI scenes).

**Positioning:** "the recovery app that includes the person who loves them."
**Lead audience:** the partner (usually a wife) of someone who drinks. Secondary:
the person struggling (porn, alcohol, food, gambling).

---

## Deploy & branches

- **STUDIO LIVES ON ONE BRANCH: `claude/vibe-code-uwxxlk`.** Studio's in-app
  "Update my app" downloads that branch and nothing else (`UPDATE_BRANCH` in
  `Studio/server/studio.js`). **Commit every change under `Studio/` to that
  branch**, whatever branch the session was assigned for everything else. A
  Studio fix sitting on a session branch does not exist as far as Jacques's
  machine is concerned — on 9 Aug an hour went on a build stamp that would
  never move, because the fix was on the wrong branch and the updater was
  working perfectly.
  Everything else goes to **`main`** — outreach, episodes, reference, docs.
  Decided 9 Aug 2026. Do not open a session branch for this project; work that
  sits on one never appears where Jacques looks, which is the repo's front page.
- **THE SITE ALSO DEPLOYS FROM `claude/vibe-code-uwxxlk`, NOT FROM `main`.**
  So a change under `TurnSomeDayIntoOneday/` has to reach that branch too or it
  never goes live. Merge `main` into it and push. Learned twice on 11 Aug: first
  with a Studio build stamp that would not move, then again with an admin page
  still showing an old product name after it had been "fixed" on main.
  **Rule of thumb: `main` is the record, `claude/vibe-code-uwxxlk` is what runs.**
  Anything that has to actually work for Jacques — the site or Studio — belongs
  on both.
- **Host:** Railway, auto-deploys the site from `claude/vibe-code-uwxxlk` on push.
- **DNS: Cloudflare, not IONOS** (moved 8 Aug 2026). The domain is still bought
  from IONOS, but its nameservers point at Cloudflare — `adi` and `glen`
  `.ns.cloudflare.com`. **Change DNS records in Cloudflare. IONOS DNS is dead.**
  Why it moved: Railway needs a CNAME at the apex, and IONOS refuses one at the
  root ("A CNAME record can only be set for a subdomain") — it only offered its
  own redirect service, which had no SSL certificate, so `https://` on the bare
  domain returned nothing. That was four of the five site-audit errors. Cloudflare
  does CNAME flattening at the root, which is the whole reason for the move.
- **The bare domain is handled by Cloudflare, not Railway.** Railway's plan is at
  its custom-domain limit, so the apex is a Cloudflare **Redirect Rule**
  (`https://turnsomedayintodayone.com/*` → `https://www.turnsomedayintodayone.com/${1}`,
  301, query string preserved) with the apex DNS record **proxied**. Everything
  else is DNS-only. `server.js` also 301s the apex to www as a backstop if the
  domain is ever pointed straight at Railway.
- **Email lives on this domain** — IONOS mailboxes (mx00/mx01) and **Resend**
  (`send` MX + `resend._domainkey` TXT + SPF), which is what actually delivers
  the app's trial sequence. Those records are in Cloudflare now. Don't drop them.
- **Site Audit is at 0 errors, 96% health (8 Aug 2026)** — above Semrush's
  top-10% benchmark of 92%. **The 9 remaining warnings are deliberate. Do not
  "fix" them:**
  - *Low text-to-HTML ratio · low word count · duplicate h1-and-title* land on
    `/app` and `/app?join=1`, which are the application shell, not documents.
    That page already canonicalises to `/`, so it isn't competing for anything.
    Rewriting its headings for a crawler risks a visual regression in an app
    under Play Store testing, for no ranking gain.
  - *Low word count* also flags `/quiz` and `/for-her`. They are short because
    short converts. Padding them makes them worse at the one job they have.
  - **Cloudflare's "Block AI training bots" must stay OFF.** On by default for
    new zones, it serves a managed robots.txt that (a) Semrush rejects as
    invalid, (b) drops the Sitemap line, and (c) blocked Google-Extended on 35
    pages — the opposite of what `llms.txt` is there to do.
- **Working branch:** `claude/vibe-code-uwxxlk` — this is the one that deploys.
  Keep it in sync with `main` after every app change.
- The app also has an in-app "Update my app" button (pulls the GitHub tarball) as
  a backup update path — fixed to use tarball+tar (no `unzip` needed).
- **Play Store:** app is in the 12-tester / 14-day closed-testing window. Do NOT
  change billing or push risky deploys until through testing. Web/content changes
  are safe. Any feature that changes data collection needs the Data safety form
  updated before it ships.

---

## The map

**Jacques only ever needs these three — keep it that way:**
- `DO-THIS-NEXT.md` — his routine, including the weekly schedule.
- `SCRIPTS.md` — numbered videos. Each number = one complete video (title,
  script or AI prompts, caption). He picks a number and makes it.
  **Every new script carries TWO titles:** `Title (TikTok / Facebook)` = the
  hook, `Title (YouTube)` = a real search term from `KEYWORDS.md` with its
  volume. Buffer builds the YouTube title from the caption's first line and he
  overrides it per network, so one title for both makes him do the translating
  by hand. No honest term for that script? Say so — never invent a keyword.
  Scripts 1–39 predate the rule and are mapped in `YOUTUBE-TITLES.md`.
- `OUTREACH.md` — Tuesday's sales block: 30 verified rehab/media targets in
  weekly batches of 5, with the email written.

Plus the files he opens only when doing that specific work:
- `AI-SCENES.md` — the AI videos that cost money (A1–A5, full prompts).
- `INFLUENCERS.md` — podcasts/authors pile, separate from the rehab outreach.
- `KEYWORDS.md` — the final search dataset. **Only write for terms marked
  "Build"**; never Skip/Too-hard, whatever the volume. Still the source of
  search truth: its numbers were verified against two live pulls, so quote them
  rather than re-estimating. (A fresh Semrush account was connected 8 Aug 2026 —
  the connector reads reports but cannot write, so it can't add tracked keywords
  or start a crawl. Those are clicks only he can do.)
- `COMPETITORS.md` — monthly structural log (hook type / length / format only,
  never wording). Informs structure, never copy.
- `reference/Getting-Noticed-Course.pdf` — his sales & marketing course, one
  module a week in the Wednesday slot.

**NEVER re-send a whole file he works out of.** He deletes scripts and ticks
emails as he does them — sending SCRIPTS.md/OUTREACH.md back wipes his
progress and makes him re-sort. When you add something, send ONLY the new
piece in its own small file, and say which file it belongs in. This was a real
complaint; do not repeat it.

**Do NOT add more top-level files or hand him more docs.** He works best with one
next action at a time. If something new is needed, fold it into an existing file.

**Reference (background, for sessions — not for him):**
- `reference/marketing-playbook.md` — full strategy, the door/positioning thinking.
- `reference/search-titles.md` — search-language research + forum hooks.
- `reference/marketing-content-pack.md`, `AI-SCENES.md` (formerly `reference/ai-shorts-scripts.md`) — the
  older script sets that SCRIPTS.md was built from.
- `reference/POST-LAUNCH-BUILD-LIST.md` — deferred features, what's done.
- `reference/medical-claims-audit.md` — claims to keep out of copy.
- `TurnSomeDayIntoOneday/PLAY-CHECKLIST.md` — Play Store steps.

---

## CURRENT STATUS (2026-08-12) — newest, read this first

**Play Store:** closed testing ends **14 Aug**. That is the day Jacques applies
for production, not before. Everything on the Play side is done and waiting.
Do not call it overdue.

**Deploy branch confirmed from Railway's own settings this session:**
`claude/vibe-code-uwxxlk`, auto-deploy on push, root dir `/TurnSomeDayIntoOneday`,
"Wait for CI" off. The rule above is correct — this is the branch that runs.

### Late 12 Aug — Jacques's phone-test list, and what shipped off it (v5.2.0)
He walked the whole app on his phone and dictated a list; it lives triaged in
`reference/POST-LAUNCH-BUILD-LIST.md`. Shipped the same night:
- **v5.1.6:** voice journaling no longer cuts off at the first pause (mic is
  now a tap-to-finish toggle), and the phone back button closes modals →
  overlays → steps Home instead of exiting the app from anywhere.
- **v5.2.0:** **"Do this together" is a real 30-day couples program** with
  progression (`S.togetherDone`), the six old cards kept as anytime exercises —
  and the **supporter track grew days 31-35, the boundary course** (why, what,
  against who, how to hold it, when it's crossed). **All 35 lessons have real
  MP3s in all five voices** — generated in-session with the Piper pipeline,
  audio pushed to the `lesson-audio` branch (c235a4c), manifest shipped, CDN
  spot-checked. No Data safety change, no Play impact.

**Still open from his list:** notifications not arriving on his phone — needs
him present (per-device subscription, Android permission, battery optimization,
then a live test push). Layout moves (Rooms/Share milestones/custom packs →
Tools), Ask-me-anything as first-open greeter, Friendly conversation realism,
"talk me through it" pacing, and the Rooms-as-community question (that one is
moderation + privacy + Data safety — a decision, not a build).

### Shipped today
- **iPhone install fixed.** `landing.html` had **no manifest link and none of
  the Apple home-screen tags** that `index.html` has always carried. Add to Home
  Screen from the front page was saving a Safari bookmark to marketing copy
  instead of installing the app. Broken long before this session. Now installs
  correctly from `/` or `/app`. ("Daily Journal" on the icon is discretion
  mode working as designed — not a bug.)
- **Studio b0844** — `▦ Panels`: **4-panel collage** and **Duet** (stacked
  top/bottom, the "follow the move" layout). The two CapCut layouts, free and
  local. Cells crop to fill rather than letterbox; shorter inputs loop instead
  of freezing on a last frame.
- **124 British→American spelling fixes** across 36 files, including live site
  copy (`hangxiety.html` said "apologise" to real visitors). The ASS subtitle
  field names `PrimaryColour` / `SecondaryColour` / `OutlineColour` /
  `BackColour` are a **file format** and were deliberately left alone —
  Americanizing them breaks captions.
- **`DAILY-50.md`** — 50 outreach targets a day with six templates.
- **Ten song cards** — `reference/song-cards/`, built by
  `reference/make-song-cards.py` off five Suno tracks Jacques wrote. **No
  lyrics are quoted** — he did not want to paste them and there is no
  transcription in this environment, so each card is written to the idea the
  song is named for. The two "That's Just the Illness" files are the same song
  twice and got two different cards rather than one card twice.
  **Every card is habit-agnostic on purpose** — no card says "sober", because
  that word makes it invisible to whoever came in for the phone, the food or
  the money.
- **`reference/EPISODE-CAPTIONS.md`** — one caption per episode for all three
  channels. **Not per-platform splits**: it goes into **Buffer**, which pushes
  the same text everywhere. YouTube's title box is the only field the others
  don't have. **No Instagram** — Jacques does Facebook, YouTube and TikTok.

### ⭐ CARD RULE CHANGED — two frames must say two different things
The partner cards draw the hook on frame A, then the hook **plus** a quiet line
on frame B. Jacques called that out on 12 Aug: *"if you write two make them say
different things."* He is right — that cut redraws what the reader already read.

**The song cards now put a whole sentence on each frame, and the second one is
the turn.** Either half stands alone: *"Nobody relapses on their worst day."* /
*"They relapse on their best one."* Type runs to 96px since a frame holds one
sentence instead of a sentence plus a footnote.

**The 34 partner cards were left on the old build** — they are made and posted
already. If they ever get rebuilt, rebuild them this way.
- **`TARGET-MARKET.md`**, **`reference/NEW-AVENUES.md`**,
  **`reference/REDDIT-ORGANIC.md`**, **`reference/EPISODE-CAPTIONS.md`**,
  **`reference/IPHONE-INSTALL.md`** — all new.

### Shipped 12 Aug, later — the two partner pages
**`/codependency` and `/what-is-al-anon` are live** (v5.1.3). These are the two
biggest doors into the partner audience and the site had no page for either.
Routes, sitemap, `llms.txt`, landing footer, cross-links from the four other
partner pages, crisis block above every signup link, server boot-tested.

**Aimed at the winnable half of each cluster, not the head term** — a fresh
Semrush pull (12 Aug, appended to `KEYWORDS.md` as an addendum; the 6 Aug
numbers were not touched) put `codependency` at **KD 72** and `al anon` at
**KD 68**. So `/codependency` is written to `how to stop being codependent`
(1,600, KD 46), `signs of codependency` (1,900), `am i codependent` (880) and
`codependency in relationships` (1,300); `/what-is-al-anon` to
`what is al anon` (3,600, KD 33, **CPC $5.76**) and `al anon online meetings`
(2,900, KD 26).

**`codependency test` is 390/mo at difficulty 15 — the lowest number on the
whole site.** A dedicated check-in page (the `/quiz` pattern) is the next
obvious build and nobody has taken it.

**Two deliberate calls on the Al-Anon page, don't undo them:** it links out to
al-anon.org and states plainly that we are not affiliated with Al-Anon Family
Groups; and `al anon meetings near me` (14,800/mo) is tagged **Skip**, not
Build. We cannot honestly answer "where is my meeting" — a page that intercepts
it is a bait page. The app is offered for the six days *between* meetings.
*(One thing to click: the outbound al-anon.org link could not be loaded from
this environment — the network policy blocks the domain — so it went out
unverified.)*

### THE BUILD ORDER IS DONE — six pages shipped 12 Aug (v5.1.5)
All of it live: `/codependency`, `/what-is-al-anon`, `/dry-drunk`,
`/adult-children-of-alcoholics`, `/alcoholic-personality`,
`/codependency-test`. Roughly **45,000 searches a month** of target terms,
every one at a difficulty the site can reach. Routes, sitemap, `llms.txt`,
landing footer, cross-links, crisis-above-signup, boot-tested each time.

**Three things a future session must not undo:**
- **`/codependency-test` has no email capture, on purpose.** `/api/lead`
  collapses any unrecognized `source` into the `'quiz'` nurture — which the
  server's own comment says is written in Jacques's voice and must never go to
  her. This audience *is* her. **A partner-side sequence has to be written
  before a capture box belongs on that page.** That sequence does not exist yet
  and is the obvious next build.
- **The ACA Laundry List is not reproduced.** It's theirs; the page describes
  the traits in its own words and links to `adultchildren.org`. Same
  not-affiliated line as the Al-Anon page.
- **`/alcoholic-personality` opens by denying its own head term** — "there
  isn't one" — then explains what each behavior is *doing*. It is one keystroke
  from a page that labels people. Do not "strengthen" it.

*(Two outbound links went out unverified: `al-anon.org` and `adultchildren.org`
are both blocked from session environments. Worth one click each.)*

### ⭐ LAST SEMRUSH PULL — the trial is ending, KEYWORDS.md is now closed
Jacques said the trial was nearly up, so a final sweep went into `KEYWORDS.md`
("FINAL PULL — 12 Aug 2026"). **After this there is no way to pull a number.
Quote the file; never re-estimate, and never assume a term missing from it is
unclaimed — it may simply never have been pulled.**

Three lanes came out of it that the file never had, all bigger than anything
currently built:

1. **"dry drunk" — ~11,700/mo at difficulty 30-34, one page.** Sober and still
   the same person. It is the closest term in the whole dataset to what Jacques
   actually lived, the site never mentions it, and it is the strongest unbuilt
   page anywhere in the file.
2. **Adult children of alcoholics — 8,100/mo at KD 31**, plus the "laundry
   list" cluster at ~6,000/mo and difficulty 14-24. **A third audience**, not a
   variant of the drinker or the partner: the person who grew up in it.
3. **"Alcoholic personality" — ~9,400/mo, all KD 33 or under**, six phrasings
   of one question. Tone warning in the file: one keystroke from a page that
   labels people.

**The Skip rule held again and it cost the most this time:** `aca meetings` and
`acoa meetings near me` are 14,000+/mo at difficulty 11-21 — the cheapest
traffic in the document — and they are tagged Skip for the same reason as
`al anon meetings near me`. We cannot say where somebody's meeting is.

### The finding that should steer marketing
Semrush, live: **the partner audience is ~74,500 US searches a month against
~23,000 for the drinker.** Three times bigger, and the segment nothing else in
the category serves.

**But the aim is wrong.** The two words that audience actually types are
**`al anon` (33,100/mo)** and **`codependency` (33,100/mo, CPC $0.12 — nobody
monetizing it)**. Both now have pages, built later the same day — see the block
above for what they actually target, which is not the head terms.
`is-my-husband-an-alcoholic.html` targets a **260/mo** phrase.

**Best term already owned: `hangxiety` — 12,100/mo, difficulty 35, CPC $0.11.**

Three corrections to older numbers: "binge eating at night" is **140**/mo, not
3,480 (that was the whole cluster reported as one term). `partner-watches-porn`
targets a **20**/mo phrase. **Gambling is difficulty 94 — dead as SEO**, still
alive as video and outreach.

### Outreach state
- **7 emails sent 12 Aug**, plus NCPG, Betrayal Trauma Recovery and SMART
  Recovery later the same day.
- **Missouri DBH replied** and named the door: their listings are limited to
  *"affiliated national organizations such as SAMHSA and NASADAD."* NASADAD was
  emailed the same morning, which makes it **the highest-value pending item in
  the whole file.** No reply owed to DBH now. The reply that *is* owed comes
  later, in that same thread, if NASADAD lists it: *"You mentioned NASADAD.
  We're on their list now."*
- **Salvation Army St. Louis ARC — 3949 Forest Park Ave, (314) 535-0057.** Ten
  minutes from Jacques. Free residential rehab. This is a walk-in, not an email.
- **SHRM is two targets.** St. Louis chapter directory costs $500/$700 — skip.
  Their **speaker call is free** (7 meetings/yr, 200+ HR people). The national
  vendor directory is free but goes through a **Calendly call with a MediaBrains
  rep**, not a form.

### ✅ FIXED 12 Aug — Studio b0845, the Quick Video decimal bug
`1.3s` set a shot to **3 seconds**, `2.0s` to **1**, and the row number turned
up at the front of the caption. **That was one bug, not two:** the leading
`/\d{1,3}\s*[.)]/` numbering strip ate the `1.` of `1.3s` as a row number and
left `3s` for the duration match to find.

The strip now requires the dot to be followed by a space or end of line — a row
number is `1. `, a decimal is `1.3` — and the duration regex accepts decimals
to one place. Verified against ten lines through the real `parseShotLine()`,
including the regressions that had to keep working (`1. 30s A long hold.` still
reads 30; `Day 400 was the hard one.` still refuses to treat 400 as a length).

**Still true, and not a bug:** "⚡ Cut on the beat of the song" is on by default
and rounds every shot up to a whole musical bar with a 1.5s floor, so sub-second
times still come out longer with it ticked. Uncheck it for the episode
slideshows. If it ever becomes worth fixing properly, the culprit is
`Math.max(1, Math.round(d / bar)) * bar` — forcing a minimum of one full bar is
what turns a 17-second piece into 30+ on a slow song.

**Also:** "⚡ Cut on the beat of the song" is **on by default** and snaps every
shot to a whole musical bar with a 1.5s floor. On a sparse instrumental that
turns a 17-second piece into 30+. Uncheck it for the episode slideshows.

---

## CURRENT STATUS (2026-08-06, later) — read this before anything below

**Latest facts, verified from the code this session — these override anything
older that disagrees:**
- **App version `5.1.0`** (`APP_VERSION`, `sw.js` CACHE_NAME). **Studio build
  `b0807`.** Earlier notes saying 5.0.1 / b0804 / b0806 are stale.
- **Web push shipped (5.1.0):** lesson reminders now arrive with the app fully
  closed (`server/push.js`, new db tables). Also fixed: Reset Recovery keeping
  the old date, and lesson reminders never reaching Pro (5.0.3).
- **Phone number at signup is back** (commit 6bedd08, optional field,
  `#gate-phone`). It was present when Data safety was first completed, so the
  form still matches the app — **Jacques confirms nothing on the Play side has
  been touched since the original submission, and nothing needs changing.**
  Closed; don't re-raise it.
- **Studio, this session:** multi-select delete in My Media (☑ Select multiple →
  tap thumbnails → bulk delete); **touch-drag timeline reorder** — the old
  reorder used the HTML5 `draggable` API, which mobile browsers never fire for a
  finger, so it only ever worked with a mouse; now Pointer Events on a ⠿ handle,
  verified with real touch input. Arrows kept as fallback.
- **Studio caption sizing fixed (b0807):** Studio has TWO text systems —
  server-burned ASS **captions** and client-drawn **overlays** (title cards and
  Quick Video's per-picture words). The Size control only fed captions, and
  Quick Video's text was hardcoded at size 64 (~40% larger than a real caption,
  so even "Small" read big). Size now multiplies overlays too
  (`captionSizeMul`), and auto-written text uses `AUTO_TEXT_SIZE = 0.042 * 1080`
  — the same fraction as `ASS_SIZES.medium`. Confirmed working by Jacques.
- **`reference/Getting-Noticed-Course.pdf` (new):** a 16-page sales/marketing
  course written for him — 8 modules, quizzes, final exam, reasoned answer key.
  Module 0 is how to work with Claude (repo-as-memory, "read START-HERE.md").
  Meant for the Wednesday small-win slot, one module a week.
- **Also landed from other sessions:** `reference/SCHOOLS-BENEFITS-PLAYBOOK-2026-08.md`
  (the employer/school-benefits angle, with ready-to-send emails) and
  `reference/ADS-AND-CONTENT-MISTAKES-2026-08.md` (advertising and social
  content mistakes, with live paid-search data).

**Note on rhythm:** he moves between several concurrent sessions. Always
`git fetch origin main && git merge origin/main` before editing, and always
re-read this block rather than trusting a summary in your own context.

### "Does this change affect the Play Store test?" — the standing answer

He asks this on most changes. The app is a **TWA**: the `.aab` is an empty shell
that opens `https://www.turnsomedayintodayone.com/app?src=play`. So:

| Change | Play impact |
|---|---|
| Anything in `index.html`, `server/`, pages, lessons, audio, Studio | **None.** Ships with the Railway deploy. No .aab, no review, no clock reset. |
| A **web API** the page calls (wake lock, push, camera, notifications) | **None for the .aab** — the browser handles it, Android sees no new permission. |
| Anything in `TurnSomeDayIntoOneday/twa/` — package name, icon, splash, target SDK, `startUrl` | **New .aab required.** Bump `appVersionCode`, `bubblewrap build`, re-upload. |
| Anything that **collects new user data** | **No .aab, but the Data safety form must be updated BEFORE it ships.** |

**How to check, don't guess:** `git log --oneline -- TurnSomeDayIntoOneday/twa/`
— if that path is untouched, no new build is needed. As of 2026-08-06 the shell
is still at `appVersionCode: 1` and has not changed since it was first created.

**Verified example:** the SOS/lesson wake-lock fix (PR #46, branch
`claude/sos-talk-screen-cutoff-dfhjw4`) — web-only, TWA untouched, zero Play
impact.

**2026-08-06 — Jacques tested the whole app on his real phone and reports
everything working**, SOS "Talk me through it" and lesson audio included. He
has not touched the Play Store configuration since the very first submission,
and the `twa/` folder confirms it (`appVersionCode` still `1`, untouched since
creation). **Nothing is outstanding on the Play side.** The only remaining
blocker to production is the one that was always there: 12 testers opted in for
14 continuous days.

**Phone number / Data safety — resolved 2026-08-06.** The optional phone field
was in the app when the Data safety form was originally completed; it was
removed for a while and has since been restored, so the form still describes
what the app actually does. **Jacques confirms he has not changed anything on
the Play side since the first submission, and nothing needs changing.** Treat
this as closed. (If a future session ever *adds* a genuinely new data type,
that's when the form moves — not for a field that was always declared.)

---

## STATUS (2026-08-06, earlier)

Everything under "Where things stand" is older background. This block is the
live picture. **Update this block at the end of every session** — a session that
reads only the older text will give him advice that's a week behind.

- **Play Store: still in CLOSED TESTING.** Not applied for production yet.
  Testers still running the 14-day window. Don't touch billing; don't plan
  Play-side work; don't tell him to "check production."
- **Outreach: 10 of 30 sent** (Weeks 1 and 2 ticked in `OUTREACH.md`).
  Week 3's five are next. He is doing the sales work — do not imply otherwise.
- **Content: live and posting.** 17 scripts loaded into Buffer; refills happening
  6 Aug. Videos are out in the world. The bank is being worked through, not
  sitting idle.
- **Branch drift found 6 Aug — FIXED same day (his go-ahead):** the stranded
  `claude/app-qc-competitive-analysis-lehsn9` branch was fast-forwarded level
  with `main`, and the version quadruple (`sw.js` CACHE_NAME, `APP_VERSION`,
  both package.json files) was bumped **7.0.0 → 7.0.1** for the wake-lock
  change, per the HANDOFF rule. Keep both habits: every ship moves the
  quadruple and lands on both branches plus `claude/vibe-code-uwxxlk` (deploy).
- **Studio: build stamp is now `b0806`** (the 08-05 notes still said b0804 —
  it has moved). Confirmed present in `Studio/web/index.html`: templates, the
  teleprompter, and webcam recording (`getUserMedia`). This is the toolchain
  `DO-THIS-NEXT.md` tells him to record with, so it is working end to end.
- **SOS + lessons screen-cutoff fix: merged to main and in this repo.** A shared
  screen wake-lock manager (`wakeLockAcquire/Release/Ensure`, index.html ~6271)
  now serves the SOS voice guide, breathing, urge surfing, panic mode and lesson
  audio; re-acquires if the system revokes it; resumes on unlock. **No Play
  impact** — the Android app is a TWA pointing at the live site, so the fix ships
  with the server deploy: no new .aab, no version bump, no review, no reset of
  the 14-day clock, no new permissions. Only step left is the site being deployed
  from main. **Verified on a real phone by Jacques, 6 Aug — it works.**
  Deploy path confirmed: Railway deploys `claude/vibe-code-uwxxlk`, which is at
  the same commit as `main` (92165e7), so the fix is live. Service-worker cache
  is not a blocker — `sw.js` serves pages network-first, so a new `index.html`
  lands on the next load even though the version quadruple wasn't bumped.
  - *Caveat for a future session:* the write-up that shipped it said both
    features rely on the phone's built-in voice and that "true screen-off audio
    would need real audio files." That's not right — SOS defaults to real MP3s
    (`vgStartAudio`, phone TTS is only the fallback option) and all 395 lessons
    have MP3s. The audio itself can survive a lock; what stalls is the
    **setTimeout-driven step sequencing**, which browsers freeze on a hidden
    page. Keeping the screen on dodges that, so his symptom is fixed — but real
    screen-off playback is a solvable job (drive steps off audio `timeupdate`/
    `ended` + MediaSession), not an impossible one. Don't repeat the claim that
    it needs recordings he doesn't have.
- **6 Aug: `KEYWORDS.md` created at the repo root** (two verified Semrush
  pulls, final dataset — the marketer agent is unblocked), and the first two
  pages of its page plan are LIVE: **/partner-drinks** and
  **/partner-watches-porn** — the inclusive supporter pages (husband, wife,
  boyfriend, girlfriend named on each; KD 6-25 cluster). Routes, sitemap,
  landing-footer links, and a when-he-drinks cross-link all wired; crisis
  resources above every signup link; server boot-tested. Version 7.0.3.
  Also live 6 Aug: **/how-to-stop-binge-eating** (the 9,900/mo anchor),
  **/betrayal-trauma-recovery** (the moat's companion; cross-linked from
  /partner-watches-porn), and **/how-to-stop-drinking** (long-form; the
  cold-turkey SAFETY warning appears twice — above the fold AND above signup).
  **The KEYWORDS.md five-page plan is COMPLETE.** All five: routes, sitemap,
  landing footer, crisis-above-signup, server boot-tested. Version 5.0.1.
- **Version reset 7.0.3 → 5.0.0 on 6 Aug at Jacques' request.** Precedented
  (35→7, 12→7); the updater compares SHAs, the number only has to change.
  Future bumps go 5.0.1, 5.0.2… — do not "correct" it back upward.
- **Open from 08-05, still unresolved:** the two origin-story picture fixes
  (real app screenshot on the laptop shot; "Someday" split into two words), and
  the watermark "Patch it out" tool — it's ffmpeg `delogo` (pixel averaging), so
  it smears on busy backgrounds. Real fix would be AI inpainting; not built.

---

## Where things stand (2026-08-03, historical)

**Done & live:** Pro chat cap set to 30/day everywhere; Pro "X of 30 left" counter;
`/when-he-drinks` partner landing page; `/go/tiktok|youtube|facebook` tracked bio
links (all three set in the socials); shared-device logout wipe; offline boot fix;
guided-mode label removed; in-app updater fixed; SOS "Talk me through it" now real
MP3 audio with a voice picker (survives screen lock); wake-lock keeps the screen
awake during lessons; SEO groundwork shipped (sitemap.xml, robots.txt, homepage
footer links, /best-recovery-apps roundup, 16 competitor "-alternative" pages).
Google Search Console is verified and the sitemap submitted (done 2026-08-03)
- check it ~monthly for which searches show his pages; don't re-walk setup.

**Lessons overhaul (2026-08-03, done in a parallel session, merged to main):**
the app now targets EVERYONE - straight, gay, bi, gender-neutral, men and
women; all lessons rewritten inclusive/gender-neutral and claims-audited.
Recorded audio for all 395 lessons x 5 voices (1,975 MP3s) with a voice picker
like SOS; pause button (no more restart-from-zero); pop-out big player with
read-along; on completion auto-scroll + next lesson (follows multi-addiction
tracks); audio keeps playing with the screen off. Find-anything button moved
off the Friendly send button; phone-number option removed.

**Division of labor (2026-08):** Jacques' wife runs social comments and followers
- he never opens the feeds or dashboards; his daily is 10 min (Buffer check).
Positioning widened by his call: post for EVERYBODY (HIM, HER, alcohol, food),
Monday stats decide the lean - nothing says "her first" anymore.

**Reality check (as of 08-03):** /admin/stats shows only Jacques' own test
signups - normal; first outreach batch and consistent Buffer posting just
starting. First stranger signup expected in weeks, not days. Don't let a session
panic about flat numbers. Cleanup pending: remove test123 + test signups when he
gives the word (keep his real owner account).

**Studio (2026-08):** Dynamics templates shipped - 10 free CapCut-style one-tap
effects (Beat Mix, B/W Strobe, Color Flip, Thermal, Glow Up, Echo Trails, Hype
Shake, Mirror World, Time Machine old-to-new, 3-2-1 Opener) on any video OR
picture (stills become 4-15s clips). Build stamp b0804.

**Deferred (post-launch, see build list):**
1. ~~Lesson background audio~~ DONE 2026-08-03 (all 395 lessons, 5 voices, free).
2. Wire up real Friendly AI (`ANTHROPIC_API_KEY` on the server) — also activates
   the Pro chat counter (guided replies don't consume quota, so it reads full now).
3. Accountability partner link (`/together`) — needs Data safety update.

**Marketing next actions:** make videos in Studio → post via Buffer 3×/day
(Morning=HIM, Midday=HER, Night=PROOF) → reply to comments → check
`/admin/stats` Mondays → do more of what grows. (Superseded 08-04: post for
EVERYBODY, the Monday numbers pick the lane — nothing leads with "her" anymore.)

**Standing reminder:** a weekly Routine fires into the owning session every
Wednesday to handle the Play-side update + offer the deferred features the moment
the app is live in the Play Store.

---

## Pictures and video — who can fetch what

Recorded 12 Aug 2026 because a session tried to walk Jacques through setting up
something he had already been using for weeks.

- **Pexels is already set up in Studio, and has been.** Studio → My Media →
  **🎬 Free stock b-roll**, with **🎬 Clips** and **🖼 Photos** chips. Free key,
  free clips, no attribution, imports straight to My Media and onto the
  timeline. **Do not tell him to go and get a key — he has one.** The key lives
  in his local `.env` and is deliberately not in this repo.
- **This is the first place to look for anything that isn't a scripted moment**
  — establishing shots, weather, textures, transitions. An AI scene is ~$2; a
  Pexels clip is free and lands in two taps. Reserve fal.ai spend for shots
  Pexels cannot give.
- **A session CANNOT search Pexels.** `pexels.com` and `api.pexels.com` are both
  blocked by the session network policy, there is no Pexels connector in the
  registry, and the key isn't here. Verified 12 Aug. A session's job is to write
  the search terms; Jacques runs the search in Studio.
- **A session CAN search Shutterstock** (connector, read-only: previews and
  metadata, no licensing or download). It's paid, and it has no video import
  path into Studio — so it's the fallback for one specific shot Pexels lacks,
  not the default.
- **Faces are the thing to avoid, on either service.** Shutterstock's license
  restricts showing a recognizable person in connection with sensitive subjects
  (addiction, mental health) without a "posed by a model" disclaimer, and
  Pexels' license says identifiable people may not appear "in a bad light or in
  a way that is offensive" — with no disclaimer option at all. This app's whole
  subject sits inside that clause. **Search rooms, weather, hands, doors, roads,
  light — not people.** The text cards already work precisely because the reader
  supplies the face.
- **What a session can and cannot make.** No session can generate an image or a
  video — there is no image model here. What it CAN do is write code that draws
  deterministically (`reference/make-song-cards.py` is PIL: gradient, icon,
  type), and write the prompts that Studio sends to fal.ai. Cards are free and
  instant; AI scenes cost money and run in Studio, on his account.
- Licence terms for everything in use are logged in
  `reference/asset-licenses-2026-08-08.md`.

---

## Rules of the house

- **Every email drafted into Gmail is written as HTML with a real link, never
  as a bare URL in plain text.** Gmail rewrites every link it sends through
  `google.com/url?q=…&source=gmail&ust=…` — that happens to everyone, on every
  message, whether the link was typed by hand or inserted through the API, and
  it cannot be turned off. What it *can* be stopped from doing is making that
  string the text the reader sees. Write
  `<a href="https://www.turnsomedayintodayone.com">www.turnsomedayintodayone.com</a>`
  and the recipient reads the address; the redirect stays in the invisible href
  where it belongs. Write the bare URL and the reader gets a wall of
  `google.com/url?q=` in the middle of a cold pitch, which reads like tracking.
  Learned 11 Aug 2026, after 22 school emails and two podcast pitches had
  already gone out the wrong way. **Broken again 12 Aug** — NCPG, Betrayal
  Trauma Recovery and SMART Recovery were all drafted with a bare URL and sent
  before it was caught. Twice now. **Use `htmlBody` with a real `<a href>` on
  every single draft**, including the ones that feel too short to bother with.

- **Jacques's send address is `turnsomedayintodayone@gmail.com`.** Not the
  address on the account profile. Every draft on 12 Aug signed off with the
  wrong one and had to be corrected — a reply landing in a different inbox than
  the one it came from is a reply that gets lost.

- **Put answers in chat, not only in a file.** Jacques does not read the repo
  and git is not installed on his machine. Writing something to a markdown file
  and telling him the filename means he never sees it. Write it in the message,
  *then* also save it. He said so plainly on 12 Aug after a full set of episode
  captions went into a file he never opened.

- **Don't decide what to skip.** Parking a target, dropping a lane, or calling
  something not worth doing is his call, not the session's. On 12 Aug the
  Salvation Army was filed as "worth doing, not worth doing badly — park it,"
  and it turned out to be the strongest target in the file and ten minutes from
  his house. If something is hard, do it or list it as undone with what is
  blocking it. No verdicts.

- Story, not statistics (see medical-claims-audit.md).
- **Music: offer a range, never pick one lane for him.** Corrected by Jacques
  himself on 12 Aug: *"i do rnb and hihop but i like a variety even latin
  music."* The old wording here said "never default to R&B, hip-hop or soul,"
  which read as though he didn't want them — wrong. **He does R&B and hip-hop.**
  The actual problem is that tools keep *defaulting* to that lane for him
  without asking. So: offer a spread — R&B, hip-hop, **Latin**, folk, rock,
  country, cinematic, electronic — and let him choose. Same for any other
  assumption about his taste. Offer the range, don't choose for him.
  (Worth knowing: Episode 2's ROSA is Latina, so a Latin bed there is the right
  music for whose story it is, not decoration.)
- Privacy is the product: never expose one user's data to another; "he doesn't
  see what you write" must stay true.
- Anything worth remembering across sessions goes in a file — chat doesn't persist.
