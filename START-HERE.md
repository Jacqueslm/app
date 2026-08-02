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

**Do NOT add more top-level files or hand him more docs.** He works best with one
next action at a time. If something new is needed, fold it into one of those two.

**Reference (background, for sessions — not for him):**
- `reference/marketing-playbook.md` — full strategy, the door/positioning thinking.
- `reference/search-titles.md` — search-language research + forum hooks.
- `reference/marketing-content-pack.md`, `reference/ai-shorts-scripts.md` — the
  older script sets that SCRIPTS.md was built from.
- `reference/POST-LAUNCH-BUILD-LIST.md` — deferred features, what's done.
- `reference/medical-claims-audit.md` — claims to keep out of copy.
- `TurnSomeDayIntoOneday/PLAY-CHECKLIST.md` — Play Store steps.

---

## Where things stand (2026-07)

**Done & live:** Pro chat cap set to 30/day everywhere; Pro "X of 30 left" counter;
`/when-he-drinks` partner landing page; `/go/tiktok|youtube|facebook` tracked bio
links (all three set in the socials); shared-device logout wipe; offline boot fix;
guided-mode label removed; in-app updater fixed; SOS "Talk me through it" now real
MP3 audio with a voice picker (survives screen lock); wake-lock keeps the screen
awake during lessons.

**Deferred (post-launch, see build list):**
1. Lesson background audio (MP3 conversion — free method proven; ~390 files).
2. Wire up real Friendly AI (`ANTHROPIC_API_KEY` on the server) — also activates
   the Pro chat counter (guided replies don't consume quota, so it reads full now).
3. Accountability partner link (`/together`) — needs Data safety update.

**Marketing next actions:** make videos in Studio → post via Buffer 3×/day
(Morning=HIM, Midday=HER, Night=PROOF) → reply to comments → check
`/admin/stats` Mondays → do more of what grows. Lead with the HER/drinking lane.
First video to make: "Am I overreacting about my husband's drinking?"

**Standing reminder:** a weekly Routine fires into the owning session every
Wednesday to handle the Play-side update + offer the deferred features the moment
the app is live in the Play Store.

---

## Rules of the house
- Story, not statistics (see medical-claims-audit.md).
- Privacy is the product: never expose one user's data to another; "he doesn't
  see what you write" must stay true.
- Anything worth remembering across sessions goes in a file — chat doesn't persist.
