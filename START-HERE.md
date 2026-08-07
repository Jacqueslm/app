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

- **Host:** Railway, auto-deploys the site from the deploy branch on push.
- **Working branch:** `claude/vibe-code-uwxxlk` (kept in sync with `main`).
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
- `OUTREACH.md` — Tuesday's sales block: 30 verified rehab/media targets in
  weekly batches of 5, with the email written.

Plus the files he opens only when doing that specific work:
- `AI-SCENES.md` — the AI videos that cost money (A1–A5, full prompts).
- `INFLUENCERS.md` — podcasts/authors pile, separate from the rehab outreach.
- `KEYWORDS.md` — the final search dataset. **Only write for terms marked
  "Build"**; never Skip/Too-hard, whatever the volume. Semrush is disconnected,
  so this file is the only source of search truth — don't propose new research.
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

## Rules of the house
- Story, not statistics (see medical-claims-audit.md).
- Privacy is the product: never expose one user's data to another; "he doesn't
  see what you write" must stay true.
- Anything worth remembering across sessions goes in a file — chat doesn't persist.
