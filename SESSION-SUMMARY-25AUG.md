# Session summary — 23–25 Aug 2026 (hand this to the other AI)

Written for another AI picking up this project. Everything below is done and
pushed unless marked OPEN. Repo: `Jacqueslm/app` (PUBLIC — verified 25 Aug: no
keys, no `.env`, no keystore, no `data.sqlite` committed; all gitignored).
Branches: `claude/start-here-2ujk0y` (working) → `main` → `claude/vibe-code-uwxxlk`
(all three kept in sync). Audio lives on the `lesson-audio` branch.

## App state: v5.2 (Jacques reset the number from 8.x back to 5.0 on 24 Aug)

### Shipped this session
- **Jacques is the sixth narrator.** His voice was cloned locally (XTTS/YourTTS,
  refs in scratchpad `voice/jacques-ref*.wav`) and now reads **all 90 days × 12
  tracks** (1,150 files) plus the SOS "Talk me through it". The five stock Piper
  voices also cover days 31–90 (1,243 files each). Generators:
  `tools/generate-jacques-audio.py`, `generate-phase-audio.py`,
  `generate-jacques-sos.py`, `generate-stories-audio.py`. Manifest:
  `data/lesson-audio-manifest.json`. **Gotcha:** two generators writing the
  manifest at once race each other — re-run one at the end (files exist, so it's
  a manifest-only pass, seconds).
- **The Climb** — avatar climbs 90 carved steps. Earned by finishing today's
  lesson; seeds from days already banked; slip = campfire, never a lost step;
  past 90 the ridge continues. Avatar sheet: 3 builds, **8 skin tones**, 6
  jackets, no default (first open asks). Slips record which track they were on.
- **Ride the Wave** — 2.5-min breathing game in SOS; urge rises, peaks, passes;
  logs a survived craving.
- **Stories** — 10 original ~8-min narrated stories (5 addict POV, 5 supporter
  POV) in `data/audio-stories.json`; shelf shows 5, rotates weekly by ISO week.
- **Your film** — personal video rendered ON the member's phone (canvas +
  MediaRecorder) from their real numbers, music mixed live, nothing uploaded.
  Offered at milestones and in Tools; member picks the score from 7 tracks.
- **Friendly is Pro-only** (Jacques's business call) — 0 free chats, enforced
  server-side. Free = days 1–15, all recovery tools, journal, insights,
  reminders, partner side, stories, Climb. Pro = days 16–90, Friendly, Rooms.
- **Fixes**: reminder window is now its own server setting (was being wiped by
  stale device sync); motivation card fresh per open; cross-link card rotates
  tracks; Bigger text fits every screen (`tools/bigtext-audit.js`); Tools cut
  28 → 13 rows with 5 insight screens merged into one; sheets no longer stack;
  reviews publish instantly + email Jacques; review structured data fixed for
  Search Console (was 0 valid / 11 invalid).

## House rules added (full text in MASTER-STATUS.md)
- **23** — run `tools/bigtext-audit.js` before any layout ship.
- **24** — new features are SHOWN IN CHAT (screenshots/video) and discussed
  BEFORE they ship. Born from "The Rebuild", which shipped and was reverted the
  same day ("looks cheap"). Bug fixes he reported still ship immediately.
- **25** — Pro sells itself quietly. He studied I Am Sober's constant upselling
  and rejected it: no popups, no countdowns, no upsell after milestones or
  slips, never a pitch to someone in distress.
- Short sentences, fragments over clauses, no filler lines in scripts.
- **Cause & Effect** is the default short AI video: 3 images (cause / effect /
  end card), 8–10s, sad and serious, one caption per image (the choice on the
  cause, the price on the effect); hope only on the end card.

## Content made (all in `content/`)
12 finished videos: keys (drunk driving), the mail (gambling, both sides), ten
seconds + mother's version (anger), hangxiety ×2, pills, after-recovery, plus 4
capability samples. 5 score tracks in `content/score/` (Jacques's own Suno).
**`tools/make-film.py`** — one command, JSON spec in, finished captioned +
scored + watermarked video out (~27s for a 4-shot piece).

## Competitor intelligence (from the 160-app / 2,500-review scrape)
Written up in `COMPETITORS.md`. Headlines:
- **28% of all 1–2★ reviews across 25 apps are about MONEY** — the category's
  open wound. Ads 7%, forced signup 7%, bugs 5%.
- **ZERO of 160 apps serve the supporter/partner.** Measured gap, not a guess.
- Faith niche nearly empty: 3 apps, ~200K installs; leader *Unchaind* is also a
  top paywall offender (16 complaints).
- Food/binging: 12 apps, 476K installs total — mostly clinical, not habit.
- Alcohol is a fortress: I Am Sober, 12.4M installs, 4.74★.
- Screen time = biggest pool (48M) and worst rated (one leader at 3.03★).
- Category average **4.44★**. 5-star reviews praise *simple, helpful, track,
  daily, progress* — simplicity and momentum, not features.

## The real problem (agreed 25 Aug — do NOT re-suggest "post more")
Traffic, not conversion: ~10 search impressions/day, 10 signups, 0 paid.
Jacques rejected volume-posting advice, correctly: **nobody follows a recovery
account** — liking/sharing is public and his audience is hiding. Feeds are the
wrong front door. The two real channels are **search** (people type at 2am) and
**human referral** (counselor, sponsor, pastor, spouse). Highest-leverage plays,
in his stated order of interest: treatment centers / sober-living licensing →
recovery podcast guesting (his story is the asset) → long-form YouTube titled as
searched questions from `KEYWORDS.md`.

## OPEN
1. **Google Play** — production access GRANTED. Still 3 of 5 steps left in the
   Console: Preview and confirm the release → Send for review → Publish. **Paste
   the corrected `store-listing/02-full-description.md` first** (the submitted
   one still says the companion is free).
2. **Search Console** — hit "Validate fix" on Review snippets.
3. **Outreach** — 3 drafts sit in his Gmail (In The Rooms, The Phoenix, SMART
   Recovery); the `info@` addresses are UNVERIFIED guesses. 12 more letters
   written in `EMAIL-DRAFTS.md` with no addresses yet.
4. Interactive self-check page is published but PRIVATE (his call to share).

## Facts to not get wrong
- The 11 quotes in `data/reviews.json` are **REAL PEOPLE** — Jacques confirmed
  25 Aug. Do not question or remove them again.
- All music is Jacques's own Suno work (commercial plan) or synthesized from
  scratch here. No licensing exposure anywhere.
- Buffer = ONE post a day, Facebook + YouTube Shorts only. TikTok and long-form
  YouTube are manual (Buffer's TikTok kept rejecting). Everything queued before
  24 Aug was already posted by hand — never re-queue it.
- Deliver work IN THE CHAT, not as "it's in the file". He reads PDFs, not .md.
