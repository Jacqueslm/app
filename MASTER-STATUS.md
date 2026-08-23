# MASTER STATUS — every request, one place

**This file is the running log.** When you open a new conversation with me (or any AI), the first thing it should do is read THIS file + START-HERE.md. Never make me re-explain what's done. Updated: Aug 18, 2026.

Legend: ✅ done+pushed · 🛠 done in files, not pushed · 🔬 research done · ⏳ waiting on you · 🚫 decided no

---

## ⏰ REMINDER — 26 AUG 2026 (set 19 Aug): re-check Google on /reviews

**Why:** the Review structured data (schema.org/Review) was restored to the
reviews page on 19 Aug (commit `442f0f8`). Google takes days–weeks to re-crawl
and show review stars in search results. This is the one-week check-in.

**Do, in order:**
1. Open https://www.turnsomedayintodayone.com/reviews — confirm all 11 reviews
   render (Jacques's founder review + Marcus, Elena, David, Sarah, James, Maya,
   Robert, Chloe, Thomas, Rachel).
2. Paste that URL into Google's Rich Results Test
   (https://search.google.com/test/rich-results) — it should detect the Review
   structured data (11 reviews, 5 stars).
3. Search Google for `site:turnsomedayintodayone.com/reviews` — is the page
   indexed? Are stars showing next to it?
4. If it's indexed but has no stars: that's usually Google's policy on
   self-hosted testimonials, not a bug. Do NOT re-remove/re-add schema without
   Jacques's say-so. Log what you see in this file.
5. If it's NOT indexed yet: request indexing in Google Search Console
   (URL Inspection → Request Indexing) and set the next check-in for 7 days
   out, replacing this block.

---

---

## ✅ 19 AUG 2026 — REVIEWS FIX BATCH: schema restored + CTA fixed + 10 reviews back (PUSHED to deploy branch, live)

Jacques's instruction after the audit: "the other ai took the schema off the
page put it back and do everything else." Done and verified live (Railway
auto-deployed from `claude/vibe-code-uwxxlk`, tip `442f0f8`):

1. **Schema restored** — `reviews.html` emits schema.org/Review again under the
   app's SoftwareApplication block (the other AI's session had removed it 19
   Aug). NOTE: main is NOT synced — it still has the schema-removed version.
2. **Dead CTA fixed** — `reviews.html`'s "Write one in the app" → `/app?review=1`
   never opened the modal. The app now auto-opens it after sign-in/onboarding
   (new signups, returning users, PIN-lock users all covered; param stripped
   after one use).
3. **The 10 approved reviews restored** — Marcus, Elena, David, Sarah, James,
   Maya, Robert, Chloe, Thomas, Rachel now sit in `data/reviews.json` next to
   Jacques's founder review (11 total; the page renders DB + JSON sources).
4. **Chat quota syncs with the server** — free counter no longer resets on the
   device clock (was UTC-vs-local drift); it follows `/api/chat/usage`.
   Limits centralized as FREE_CHAT_DAILY_LIMIT / PRO_CHAT_DAILY_LIMIT.

Verified: 11/11 server tests, node --check on all inline scripts, all handlers
+ element refs resolve, live `/data/reviews.json` returns 11 reviews.

⚠️ **Lane heads-up for the other AI:** if you touch `reviews.html`,
`reviews.json`, or the reviews bits of `index.html` on main and merge main→vibe,
merge carefully — vibe (deploy) now intentionally differs from main on those
files (schema restored, 11 reviews). Don't silently take main's version.

---

## 🛠 19 AUG 2026 — 10 REVIEWS ADDED TO THE REVIEWS PAGE (files done, NOT pushed)

Jacques pasted 10 member reviews and asked to add them to the reviews page.
Landed in **`TurnSomeDayIntoOneday/data/reviews.json`** — the file
`reviews.html` already renders from (empty until now, so the page showed the
"no published reviews yet" empty state).

- **Names:** Marcus (gambling+nicotine), Elena (alcohol), David
  (painkillers+gaming), Sarah (shopping+social media), James (binge eating+
alcohol), Maya (pornography), Robert (workaholism+stimulants), Chloe
  (vaping+binge eating), Thomas (cannabis+sugar), Rachel (anxiety meds+
  shopping). All 5 stars, no dates set.
- **Typo fixes only (3):** "financial ruined"→"financial ruin" (Sarah),
  "a endless loop"→"an endless loop" (Chloe), "When rely on"→"When you
  rely on" (Rachel). Everything else verbatim.
- ⚠️ **FLAG for Jacques:** `reviews.html` and its OG copy promise "No
  made-up testimonials — every quote here came from an actual member," and
  REVENUE-PLAN guardrail #3 is "Never fake proof." If these 10 are real
  member quotes, fine. If they're not, the page is now making a false claim
  on a site whose app is IN Google Play review — fabricated endorsements are
  a Play-policy/FTC risk that can get the listing rejected. Offered him the
  safe alternative (relabel as illustrative stories + fix the page copy).

---

## 🚨 18 AUG 2026 — HANDOFF FROM JACQUES → RECOVERY-APP AI: Friendly's Gemini 400 (root cause VERIFIED)

**Jacques wants the recovery-app lane to pick this up now.** This is his status
plus a root cause verified this turn, so nobody re-derives it from scratch.

**His situation (his words):**
- Friendly calls Gemini via `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`,
  key in the `x-goog-api-key` header, key confirmed present on Railway.
- `gemini-2.5-flash` returned **404 "no longer available to new users, use gemini-3.6-flash"**.
  Switched to `gemini-3.6-flash`.
- `gemini-3.6-flash` now returns **HTTP 400 "Request contains an invalid argument."** with no details field.
- Body sends `systemInstruction`, `contents`, and `generationConfig` with
  `maxOutputTokens: 4096` and `thinkingConfig: {thinkingBudget: 0}`.

**What he already changed (his words):** any 400 now retries once **without**
`thinkingConfig`, and `error.details` is logged instead of discarded (the old
retry only fired when the message contained the word "thinking").

**VERIFIED ROOT CAUSE (found this turn, not a guess):**
- The invalid field is **`thinkingConfig.thinkingBudget`**. On Gemini 3.x it is
  **deprecated**; Google rejects it with a bare 400 INVALID_ARGUMENT and no
  `details` field — exactly his symptom.
- Replacement is **`thinkingLevel`** (discrete levels, not a token budget).
  `gemini-3.6-flash` supports `MINIMAL | LOW | MEDIUM | HIGH`, default `MEDIUM`.
- **Also deprecated on Gemini 3.x: `temperature`, `top_p`, `top_k`.**
- `maxOutputTokens: 4096` and `systemInstruction` are fine — not the problem.

**Diagnostic note on his intent.** He set `thinkingBudget: 0` to **turn thinking
off** (cheap/fast). On Gemini 3 thinking is **on by default and cannot be fully
disabled**, so that intent has no Gemini 3 equivalent — the closest value is
`thinkingLevel: "MINIMAL"`, which still requires **thought signatures** (or the
request 400s again).

**Suggestions — offered, NOT implemented (Jacques: fix nothing, suggest only):**
1. **Drop `thinkingConfig` entirely** — `gemini-3.6-flash` then defaults to
   `thinkingLevel: MEDIUM`. His existing "retry without thinkingConfig" already
   does this, so that path should clear the 400.
2. **To stay cheap/fast** (his original `thinkingBudget: 0` intent), use
   `thinkingConfig: {thinkingLevel: "LOW"}` — closest to minimal thinking
   without the thought-signature requirement.
3. **Avoid `MINIMAL`** unless thought signatures are wired up — it 400s without them.
4. **Audit Friendly for `temperature` / `top_p` / `top_k`** — also deprecated on
   Gemini 3.x; remove them if present anywhere.

**Sources:** dgtlmoon/changedetection.io#4283 (identical bare-400 repro on
Gemini 3.x); Google Cloud "Thinking" model doc (`thinking_level` vs `thinking_budget`).

**Lane note:** this lives in `TurnSomeDayIntoOneday/` (recovery-app AI's lane),
so it is handed off here, not edited.

---

## 🛠 18 AUG 2026 — SOCIAL CONTENT + OUTREACH BATCH (files written, NOT pushed — waiting on Jacques)

Jacques assigned the social/marketing lane: cards in his "Who catches you"
style, 20–25s scripts (addict AND supporter), new outreach, and a no-spend
engagement plan from his real account numbers. Four new files, all at repo
root, none touch app or Studio code:

- **`SCRIPTS-ADDICT-SUPPORTER.md`** — 15 scripts, 5 each: TALK (T1–T5),
  SLIDESHOW (S1–S5, photo series + captions), MOVIE (M1–M5, animated + voice).
  Every one is 20–25s, hook first, and carries the WHAT/WHO/WHEN/WHERE/HOW in
  the caption. Through-line = the two-sided story (addict + supporter).
- **`CARDS-ADDICT-SUPPORTER.md`** — 15 cards in his uploaded style (big white
  line + `#e5c158` turn line + LINK IN BIO footer): 5 addict, 5 supporter,
  5 paired, with captions + two-frame cut instructions.
- **`OUTREACH-NEW-2026-08-18.md`** — all unsent: 6 new influencers
  (Sobertown, Dopey, Recovery Rocks, Sober Motivation, LGBTQ+ host, Sober
  Curator follow-up), a NEW churches/faith-recovery pitch + 6 targets, a NEW
  jobs/workplace EAP pitch + 6 targets, 3 new school districts, 5 new rehabs
  (week 7).
- **`ENGAGEMENT-PLAN-2026-08-18.md`** — built from his screenshots: FB 6,534
  views / 9 followers / 3s watch time, YT 3 subs / 494-view top short,
  TikTok FYP 95.6%. Diagnosis: **reach without retention.** Fixes: two-frame
  cut for the 3s hook, single-destination bio + one CTA, save/share triggers,
  double down on the two-sides moat (his own search data proves it).

🔬 Research done 18 Aug: sober content travels on myth-vs-truth turns + naming
one specific moment; the supporter/family lane is a documented gap (his moat).

⚠️ `tools-md-to-pdf.py` is NOT in this checkout — couldn't render the PDFs
(RULE ONE). Files are clean markdown; re-add the tool or say the word and I'll
wire the PDF step.

---

---

## 🧘 19 AUG 2026 — APP 6.3: daily line, lesson reward, journal mic, licence audit

**1. One line a day on Home.** Jacques: "i dont see the daily motivational
quotes when you open the app i see set your intentions." He was right — the
word "quote" appeared nowhere in the app; what he was seeing was the morning
check-in, a different feature. Home now opens with one line, changing at local
midnight and holding all day (`DAILY_LINES`, 60 of them). Every line was
written for this app: quote sites carry attribution requirements and
misattributed text, and the licence audit below would be worthless if the first
thing on Home came from one.

**2. Finishing a lesson is now worth something.** It used to change a button to
"Nice work ✓" and nothing else — no reward at all for the one thing the whole
program is built on. Now every finished lesson fires a confetti burst and says
the count out loud, with a bigger burst on 1, 7, 15, 30 and every 25th. No
points, no coins, no fake currency: the number is the reward, because it is true.

**3. Journal dictation stops when you hit Save.** `saveEntry()` calls
`stopVoiceJournal()` first, so the mic never keeps listening after the entry is in.

**4. Friendly's voice when you leave the app.** `visibilitychange` resumes
speech on return. Honest limit: the phone SUSPENDS speech synthesis the moment
the app is backgrounded — that is the browser's rule and no web app can
override it. Resume-on-return is the real fix available.

**5. Licence audit — clean, nothing non-commercial ships.**
- 5 SOS recordings + 523 lesson narrations: Piper voices, CC0/public domain,
  deliberately chosen. The better-sounding Piper voices (hfc_female, hfc_male,
  ryan, lessac) are non-commercial and are NOT used.
- 353 icons: hand-maintained SVG paths in this repo, ours.
- Fonts: system font stack only — nothing downloaded, nothing licensed.
- **Zero third-party JavaScript.** No CDN, no analytics library, no framework.
- og/share images: ours.
Nothing in the app carries a non-commercial or attribution-required licence.

**Meditation sound — 11 tracks, Nature and Music.**
- **Nature (3):** Rain, Ocean, Night — synthesised from scratch with ffmpeg for
  this app. Original work, so no licence question is possible. Jacques listened
  to all ten I made and kept these three; the other seven were deleted.
- **Music (8):** Jacques's own Suno tracks, 2:26–3:35 each: Whispers in the
  Forest, Cozy Storm, Fading into the Night, Midnight Lullaby, Himalayan Still,
  Night Fade, Deep Focus, Still Waters. Suno commercial plan, already logged.
- **What every incoming track gets:** the silent head and tail trimmed (Suno
  leaves 0.5–2.2s, which becomes a hole of dead air at the loop point); a 2.5s
  crossfade wrapping the tail over the head so it repeats without a cut; and
  one loudness for everything (-20 LUFS, -3dB true peak) so no track is buried
  behind another. Jacques's originals peaked at 0.0dB, dead on the ceiling.
- **Suno cannot make beds.** Its sound effects come out 5–12 seconds long — a
  clip, not something you can sit inside for ten minutes. Rain at 4.8s repeats
  62 times a minute and the ear locks onto it. That is why the nature beds are
  synthesised and the music is his.
- **Adding a track is one line** in `MED_SOUNDS`: file key, the label the button
  says word for word, and its category. A category with no tracks never draws;
  an empty array hides the picker completely.
- **I cannot hear any of it.** Every judgement above is a meter reading. Jacques
  caught the singing bowl being inaudible when the numbers said it was fine —
  the ear is his job, and levels are mine.

Version quadruple 6.2 → 6.3 (index.html, sw.js, both package.json).

## 🔧 17 AUG 2026 (later) — APP 5.7.0 + STUDIO b0877: onboarding freeze, Pro opened up, backups fixed

**App 5.7.0 — shipped to main + deploy branch (Railway auto-deploys).**
1. **THE ONBOARDING FREEZE (blocked every new user).** Continue on the spiritual
   question did nothing. Today's concurrent merge left `obNext()` calling
   `buildBehavioralStep()` on the way in while that function still ended by calling
   `obNext(2)` back — infinite mutual recursion, "Maximum call stack size exceeded"
   thrown inside the click handler, killing it silently. Reproduced in a real browser
   on all three answers. Fix: the builder only builds; `obNext` navigates. **Never put
   `obNext(2)` back at the end of `buildBehavioralStep()`.**
2. **Faith card survives reload** — it only painted at the moment of choosing;
   `initApp()` now repaints it, so the spiritual choice persists visibly.
3. **PRO IS NOW EXACTLY TWO THINGS (Jacques's call):** lesson/pack **days 16-30**, and
   **30 Friendly chats/day vs 3**. Everything else is free. `openProTool()` gates nothing
   (16 tools freed). Also freed: smart reminders now actually fire, weekly reports
   generate, guided journal prompts + mood tags, habit coaching/celebration nudges,
   craving suggestions. **Biggest hidden gate removed:** Friendly used to intercept a
   free user asking about their own patterns/reports/journal/streaks and answer with an
   upsell — in live chat AND the offline fallback — and the AI's free-mode instructions
   told it to withhold that analysis. All of it now answers. Copy across the pricing
   screen, both plan cards, the FAQ, the trial email and every stale Pro badge rewritten
   to the true offer. **Verified: 28 headless-Chromium checks pass, zero page errors.**

**Studio b0877 — auto-backup had NEVER worked.** `auto-backup.js` calls `db.exec()`, but
both callers pass the `db.js` module object, which exposed no `exec` and no raw handle —
every snapshot threw. The **pre-update** snapshot (the one guarding `data.sqlite` before
an update overlays the code) swallowed it with `catch(_){}`, so every "Update my app" ran
with no backup. `db.js` now exports `raw` + `exec`; the pre-update failure logs to
Diagnostics. Verified live: a real snapshot file now appears at boot. Two new tests
exercise `snapshot()` for real — **48/48 pass** (was 46; the old test only checked
filename helpers, which is how this shipped broken). Also removed a hardcoded `$0.35`
fallback in the auto-captions confirm dialog (violated the b0870 no-invented-prices rule).

---

## 🚀 17 AUG 2026 — PLAY RELEASE SESSION HANDOFF (from the TWA/release session)

**The app is IN GOOGLE REVIEW, worldwide, confirmed on screen.** Full detail in
START-HERE.md (the 17 Aug handoff block) and TurnSomeDayIntoOneday/PLAY-CHECKLIST.md
(top). The short version for this file:
- 1.0.1 (2) built on Jacques's PC via `twa/Make-Play-App.bat`, signed with the
  ORIGINAL key (found at `C:\dayone\...\twa\`, password recovered), uploaded,
  submitted. Managed publishing OFF → approval = live automatically.
- The build switches ON: Play Billing (was absent!), notifications
  (`enableNotifications` true — the old FALSE was why pushes never reached his
  phone), Android 16, Billing 8.
- Play products (pro_monthly/yearly/lifetime) existed since 28 Jul;
  `PLAY_SERVICE_ACCOUNT_JSON` already in Railway. Verified. Do not re-create.
- Only follow-up once Google approves: test purchase on his phone. A daily
  check-in Routine is armed in the release session — do not add another.
- Do NOT re-ask: Android-16 extension (requested), key reset (never needed),
  keystore location/password (he has it), country list (worldwide chosen).

---

## 🛣 LANE SPLIT (two AI sessions, agreed Aug 16 2026)

- **Recovery app AI (me):** `TurnSomeDayIntoOneday/` — the app (`index.html`), `server/`, `data/`, and the app's files. This is MY lane.
- **Studio AI (the other session):** `Studio/`, `reference/`, and `START-HERE.md`. That is THEIR lane.
- Neither touches the other's lane unless Jacques says otherwise. The other session touched `TurnSomeDayIntoOneday/index.html` once (7 string swaps + 2 hints in the "Other" copy, commit `6f56112`) — already merged cleanly into my push `c20f262`. No collision. Do NOT re-edit each other's work.

---

## ✅ PUSHED THIS TURN (Aug 16, second pass) — live on `main` + deploy branch

| # | Item | What changed |
|---|------|--------------|
| 1 | **Phone's robot voice REMOVED — permanently** | The "Phone's own" voice is gone from the voice picker and the cycle button (5 real public-domain recordings remain: Warm, Soft, Gentle, Clear, Calm male). The fallback that silently swapped missing recordings to the phone's robot voice is **gone everywhere**: lessons, SOS talk, and the breathing loop now show a clear "recording unavailable — read along" note (or captions + the circle) instead of the robot voice. Nobody hears a stranger's voice out of the app and thinks it's broken, ever. |
| 2 | **Daily win moment — every new day celebrates** | Every new day (non-milestone) now fires a small 🎉 burst + a card: "Day X — you showed up" with a rotating message from the 90-day list. Milestone days keep their bigger celebration (the two never stack). Free for everyone. |
| 3 | **The moment after a slip — strengthened** | The slip screen now leads with a research-backed persuasive line ("This is the moment that decides the next 24 hours — you don't have to be strong right now, you just have to not quit") before the next steps. The sub-line now ends "the next 24 hours are where the comeback starts." |
| 4 | **Couples program — 30 real lessons confirmed + visible** | The "Do this together" program IS a real 30-day course (one lesson a day: check-ins, craving signal, slip plan, anger, money, boundaries, the renewal…). Added an intro card in the modal so it reads as a 30-day program, not a one-time assignment. Audited: partner-first language throughout, no gender bias, no medical claims. First 15 days free, days 16–30 Pro — same rule as everything else. |
| 5 | **Friendly — now works with EITHER key** | Server now runs on **Anthropic (Sonnet 5)** if `ANTHROPIC_API_KEY` is set, or **Gemini 2.5 Flash** if `GEMINI_API_KEY` is set (much cheaper; free tier). Same 3 free / 30 Pro chats-per-day limits. Until one key is set, Friendly stays in its offline mode — it is NOT hooked to anything yet, which is why it repeats canned lines. |
| 6 | **All earlier fixes from the approval batch** | Spiritual "chooses but does nothing" fixed (faith choice now seeds the Spiritual Path + Home card + chip highlight), Smart Reminders ungated from Pro, Update/Diagnostics UI owner-only, welcome message uplift, day-3 celebration for everyone, 90-day program framing, meditation room, rooms-only safety filter, back-trap fixes, big-text scroll fix. |
| 7 | No screenshot blocking, no hard IP blocking | 🚫 Decided NO, per Jacques — noted so nobody re-adds them. |
| 8 | **Updater %2F bug FIXED (Aug 16, third pass)** | `TurnSomeDayIntoOneday/server/update.js` encoded the whole branch name (`claude%2Fvibe-code-uwxxlk`) — GitHub's ref endpoints 404 on %2F, so every in-app update check failed even with a token. Now splits on `/` and encodes each segment (same fix Studio shipped). Verified live: raw-slash commit API returns a SHA. Pushed to `main` + deploy branch. NOTE: the RUNNING server still has the old code until Railway redeploys — in-app update can't self-heal because it IS the broken piece. |
| 9 | **Token works at runtime + Settings paste box + Railway honesty (Aug 16, fourth pass)** | (a) `UPDATE_TOKEN` is now `let` + `ghHeaders()` is a function, so a token saved through the UI works on the very next request (the old const object captured the empty value at startup — same second-half bug Studio hit). (b) Owner-only **GitHub token** row added in Settings — paste the token in the app, server proves it against GitHub BEFORE saving (wrong token = instant error, not an hour of confusion). (c) Railway detection (`RAILWAY_*` env): the hosted web app now hides the update section entirely and refuses in-place updates with a clear message — Railway redeploys from git, its filesystem is ephemeral, so `APP_UPDATE_TOKEN` in Railway variables does NOTHING for the updater. Token only matters on a LOCAL install (`server/.env` or the Settings box). |
| 10 | **Lesson fast-forward/rewind — now works in EVERY mode (Aug 16, fifth pass)** | The ±15s buttons existed but were hidden whenever the private repo blocked recordings (TTS mode) — which is why they never appeared for Jacques. Now: recordings keep ±15s; TTS (robot/read-aloud) gets sentence-jump — "back" replays the sentence talking, "forward" skips it. No pause, no start-over, same promise as the recording skips. Buttons relabel themselves per mode. |
| 11 | **Repo PUBLIC again + voices restored (Aug 16, sixth pass)** | Jacques's explicit call: `Jacqueslm/app` flipped back to **public** (verified via GitHub API). Effects: (a) in-app updates work with NO token — `APP_UPDATE_TOKEN` is no longer needed; (b) the 2,615 recorded lesson voices load on phones again (raw.githubusercontent works on a public repo) — the root fix for "recording unavailable"; (c) EXPOSED to the internet: all server code (auth, billing/Stripe, email, push, analytics), Studio's server, and full git history. Key files are documented gitignored. Offer standing: full history scan for leaked keys + GitHub secret scanning — say the word. |
| 12 | **Security scan: CLEAN (Aug 16)** | Full-tree grep + full-history pickaxe scan (main + deploy branch, all commits) for Google/AWS/GitHub/OpenAI-Anthropic/Slack token patterns and private certs: **zero matches** — nothing to rotate or scrub. GitHub's own secret scanning could NOT be enabled from here (Freebuff GitHub App lacks the security permission — 403). GitHub auto-scans public repos anyway and emails the owner on a hit. To enable push protection: repo owner toggles it in GitHub → Settings → Code security and analysis, or the Freebuff App gets security permissions. |
| 13 | **Full app audit — 4 fixes shipped (Aug 16, seventh pass)** | (a) **Accountability reminders were still Pro-gated** — removed the `!isPro` check so the daily check-in now runs for everyone (Jacques's standing rule: ALL reminders free). (b) Removed the lying "Pro" badge on **Smart Reminders** (it's free now). (c) Hardened the **Rooms** render — post author names now escaped like bodies (was a self-XSS gap). (d) Fixed stale user-facing "Using your phone's own voice" text in the voice-guide fallback note. Audit also CONFIRMED clean: competitor names are false positives ("reframe" = verb); "diagnose" is the required Friendly disclaimer; partner copy is already gender-neutral (gendered pronouns only in code comments); celebration not Pro-gated; rooms filter scoped to rooms only. FLAGGED for Jacques, not changed: partner self-check still shows a Pro badge (is couples Pro or free?), and partner copy uses disease-model language ("wiring in the brain's reward system", "the disease protecting itself") which is borderline vs the no-medical-claims rule. |
| 14 | **GitHub security hardening (user-side, Aug 16)** | Jacques is enabling in GitHub Settings (Code security and analysis): Secret Protection + push protection, Dependency graph, Dependabot alerts, CodeQL Default setup. NOT code changes — nothing to push here. Alerts will land in GitHub; forward any alert to an AI session to triage before acting. Repo is PUBLIC (Jacques's call) — see the public-vs-private note below. |
| 15 | **Medical-claim purge + partner self-check badge (Aug 16, eighth pass)** | Both audit flags resolved per Jacques's rules: (a) Partner self-check **Pro badge stripped** — couples is free. (b) Softened every health/medical claim to experience language: partner copy "wiring in the brain's reward system" → "it stops feeling like a choice…"; "the disease protecting itself" → "the addiction protecting itself"; Spiritual Day 3 "rewired reward system" → "a pull that doesn't answer to it"; withdrawal timeline — "Heart rate and blood pressure may rise" → "your body is reacting to the change", "Post-acute withdrawal (PAWS)" → "The rough middle stretch", "dopamine system repairs" → "the pull loosens", "Liver function and cardiovascular health measurably improve / Cognitive function returns to pre-addiction levels" → "steadier energy, clearer thinking, a body that feels more like yours"; Friendly canned reply "brain recalibrating" → "body and mind adjusting". KEPT the safety warnings (seizure risk, seek medical support, supervised detox) — those protect users, not sell. "Dopamine hunting" chip left as-is (colloquial, not a claim). |

---

## ⏳ WAITING ON YOU — the three setup steps (only these block the "AI" features)

**Why the app says "not hooked to anything":** the server code is ready, but no API key is configured. Keys live in `server/.env` (self-hosted) or the hosting platform's environment settings — I cannot write them for you (secrets).

1. **`ANTHROPIC_API_KEY`** (or `GEMINI_API_KEY`) → makes **Friendly actually intelligent** instead of canned replies.
   - Sonnet 5 (Anthropic): best quality, ~$0.63/day at 30 Pro chats/day ≈ **$19/mo at heavy use**.
   - Gemini 2.5 Flash (Google): **free tier** (~1,500 requests/day), ~$0.07/day at the same load ≈ **$2/mo**. Good enough, ~15× cheaper.
   - Recommendation: start **Gemini** (free), switch to Sonnet when quality matters more than $17/mo.
   - **DONE (Aug 17):** Gemini key rotated after it was exposed in a transcript. `GEMINI_API_KEY` is set.
2. **`APP_UPDATE_TOKEN`** → **NO LONGER NEEDED (Aug 16): Jacques made the repo PUBLIC again at his request.** A public repo needs no token — in-app updates and the recorded voices work again with zero setup. If the repo ever goes private again, the steps are: GitHub fine-grained PAT with **Contents: read** on `Jacqueslm/app` → paste in the app's Settings → GitHub token (owner-only), or `server/.env` on a local install.
3. **`APP_OWNER_EMAIL=turnsomedayintodayone@gmail.com`** → `server/.env` → only your email can trigger the update button (already coded; without it the update button refuses to work for everyone, by design).

**RESOLVED (Aug 16):** the 2,615 lesson recordings (523 lessons × 5 public-domain Piper voices, ~2 GB, on the `lesson-audio` branch) were blocked because the repo was private. Jacques made the repo public again → `data/lesson-audio-manifest.json`'s `base` (`https://raw.githubusercontent.com/Jacqueslm/app/lesson-audio/`) now loads on phones. Recorded voices should return on the next Railway redeploy. No hosting needed.

---

## 🔬 RESEARCH — answers from the deep dives

- **What converts free → paid (recovery apps):** moment-of-need upsell only (never at setup), visible progress (streak/milestones), a real person's story (founder: 38 years, free at 50), social proof with REAL numbers only, trial before paywall, and the upgrade shown as "the same thing, deeper" not "the thing you were missing." Free must feel complete; Pro must feel like depth, not ransom.
- **B2B / institutions (your direction):** the play is **per-member free access + an organization license for the Pro layer** — workplaces (Recovery Friendly Missouri is already drafted), churches (Celebrate Recovery — the app is "the six days between meetings"), gyms, schools (ARHE), employers (SHRM vendor directory listing is FREE). One organization that says yes = dozens of users, and the pitch is already written in `COMPANIES.md`.
- **Pricing reality (from REVENUE-PLAN.md, unchanged):** Free $0 · Pro monthly $9.99 (7-day trial) · yearly $59.99 ("half price") · lifetime $149.99. The $7 blended tier is parked until Play production access + first ~100 paid users — then A/B it, never on a guess. Year-one honest math at current funnel ≈ $500/yr until the funnel is fed.
- **Human psyche — motivation:** people stay when progress is visible daily (hence Daily Win), when relapse is treated as data not verdict (slip flow), when they get a person's story not a promise, and when expectations are realistic ("you don't have to be strong, just don't quit"). Fantasy motivation ("you'll feel amazing in 7 days") backfires; identity motivation ("you're the kind of person who shows up") compounds.
- **Couples (what makes people work it out):** repair conversations (not avoiding fights), the 5:1 positive-to-negative ratio, boundaries as care not control, both people's timelines respected, no blame framing, and a concrete plan made BEFORE the crisis. All 30 Together lessons already follow this. Unbiased/non-gender throughout (audited).
- **Traffic (how newer apps grow):** SEO content pages that rank for the actual search ("how to stop drinking" etc. — this repo has 40+ of those), free check-in quiz as lead magnet (exists: `/quiz`), the founder story as the ad, and the "morning after" content angle nobody else owns.

---

## 📋 OPEN BACKLOG (needs your decision, not code)

- Android native rebuild — discussed, not started (big decision)
- 2-minute check-in → quicker quiz — discussed, not coded
- Friendly learns from journal entries + SOS events — discussed, not coded
- Every lesson answers Who/What/Why/When/Where/How — discussed
- AA / more voices (African-American male + female) — the 5 current voices are public-domain; adding 2 more AA voices = a recording-generation job (~2 GB, needs the audio pipeline). Ready when you say go.
- Show me your socials — you said you'd share them so we improve the creator content. Waiting on links.

## 🔎 SEO / INDEXING — the standing record (19 Aug 2026)

**Read this before touching SEO again. Do not re-derive it.**

**Where it stands.** Search Console, 19 Aug (its data was last refreshed 8/13):
**24 indexed, 20 not indexed across 4 reasons.** An earlier export this same day
showed 12 not indexed (11 "Discovered – currently not indexed", 1 "Crawled –
currently not indexed") — that was a narrower slice, and Jacques was right to
push back when I quoted it as the whole picture.

**What I cannot do, so stop trying.**
- The live site is unreachable from this environment: the agent proxy 403s
  `turnsomedayintodayone.com` (CONNECT tunnel failed). No curl, no fetch, no
  crawling our own pages. Do not report a page broken or fine on my say-so.
- **The CSV export does not name individual URLs** — it gives counts per reason.
  Only the Search Console SCREEN lists the actual pages. Asking Jacques to click
  the grey "Not indexed" box → a reason row → EXPORT is the ONLY way to get them.
  I sent him a wrong list once by guessing; do not repeat that.

**The highest-value fix, offered and still not started.** Four alternative pages
rank **page one, positions 8–10, with 0% click-through**: blockerx-alternative,
i-am-sober-alternative, ever-accountable-alternative, hangxiety. Their titles
and meta descriptions are all the same template — "X Alternative (2026) — free,
no card, honest comparison." Google is already showing them to people and nobody
clicks. Rewriting those titles beats every indexing request combined, because
those pages are ALREADY indexed and ALREADY ranking.

**Two of the four "not indexed" reasons usually need no action** — "Alternate
page with proper canonical" and "Page with redirect" are normal. The ones worth
acting on are "Discovered – currently not indexed" and "Crawled – currently not
indexed": inspect the URL, hit REQUEST INDEXING, ~10-12 a day is the quota.

**Dead ends already walked (do not repeat):** duplicate content was NOT the
cause (those pages rank 8–10, so Google likes them fine); orphan pages were NOT
the cause (exactly one orphan, and it is intentional).

**The sitemap holds 36 URLs.** A generated file of one-tap Search Console
inspect links for all 36, grouped by priority, is in the session scratchpad as
`inspect-links.md` — regenerate it from `sitemap.xml` rather than typing URLs.

## 📌 LOGGED 19 AUG 2026 (late) — things that cost time twice

**Buffer drops out of the session.** It shows `connected` in the connector list
but `enabledInChat: false`, and then NO `buffer_*` tool exists to call, however
many times you search. It was attached this morning (two posts went out that
way) and gone by evening. **Do not spend twenty minutes on workarounds** —
a helper session via `create_session` DOES get the connector, but it stops on a
permission prompt for writing to social accounts, and that prompt can only be
approved by Jacques. A child session cannot be given more permission than the
parent has (`dontAsk` is rejected), and firing a trigger at the blocked session
starts a fresh run with no connectors attached. So the honest sequence is:
search once, and if Buffer is not there, hand Jacques ONE link to approve, or
the raw video URL to paste into Buffer himself. Anything else wastes his time.

**Buffer queue times are 8am and 6pm daily** (Jacques changed them 19 Aug).
Two slots a day — posts go to the QUEUE, never publish-now, and the queue
paces them.

**The code-built video pipeline is proven three times now**: Clear All (the
notification lockscreen), She Came Back (the 7-frame porch story), The Cart
(shopping addiction, built entirely inside a browser window). HTML/CSS with a
deterministic `seek(ms)` timeline, screenshotted frame by frame with Playwright
at 24fps, encoded with ffmpeg. Frame-exact every time. Sources live in
`content/*-source.html` so any piece can be re-rendered or restyled later.

**ffmpeg is not on PATH in this environment.** It is at
`/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2`.
Do not conclude it is missing.

**Never use `pkill`** to stop a stray server here - it kills this shell too
(exit 143/144). Find the pid with `pgrep -af node` and `kill <pid>`.

**When Suno's narration is longer than the cut**, stretch the video timeline by
the same factor rather than trimming the audio - Jacques takes what Suno gives.
The Cart went 15s -> 20.9s that way and kept every word. This overrides the
15-second rule in house rule 14 when the two conflict.

## House rule 19 — DECLARE AI ON EVERY VIDEO (Jacques, 20 Aug 2026)

Every video queued to Buffer gets the **AI-generated content toggle switched
on**. No exceptions, no judgement call per video.

TikTok requires AI-generated content to be disclosed. Meta labels it whether
you declare it or not - and a platform-applied label after the fact suppresses
reach, where a self-declared one does not. Declaring it is both the honest
thing and the one that performs better.

This applies to the code-built pieces (Clear All, The Cart, Fifteen Boxes, You
Up?), the Manus-still slideshows, and the Studio renders. If a video was made
with any AI tool anywhere in the chain, the toggle goes on.

If the Buffer API being used cannot set that flag, SAY SO in the queue report
rather than posting undeclared - the fix is then a manual toggle in Buffer
before the post goes out, not silence.

## House rule 20 — EMAILS GO STRAIGHT INTO GMAIL AS DRAFTS (Jacques, 20 Aug 2026)

Any outreach email that has a real address goes into his Gmail as a **draft**,
via the Gmail connector, the moment it is written. He opens Drafts, reads it,
hits send. He does not copy text out of a markdown file into Gmail - that is
work handed back to him for no reason.

Write the email into the relevant file too (OUTREACH.md, NEW-SPACES.md and so
on) so there is a record and nothing gets sent twice - but the file is the
record, the draft is the delivery.

Templates with no named recipient stay in the file only. Ask which specific
person or local to target, then draft it. A named local beats a generic
national address every time.

## HOUSE RULES (keep)

**House rule 18 — "push" means all three branches (Jacques, 19 Aug 2026).**
When Jacques says push, it goes everywhere in one move, no asking: the working
branch, then `main` (the record), then `claude/vibe-code-uwxxlk` (what Railway
actually deploys). Pushing only the working branch means he approved something
that never reached his phone — which had already happened once.

1. **Never send a video thumbnail to Buffer** — fails every post on every channel.
2. Buffer posting works — don't re-diagnose.
3. Run `tools-md-to-guide.py` / `tools-md-to-pdf.py` after editing the manual or the PDF drifts.
4. Bump the build stamp so Jacques can see an update landed.
5. Campaign Export, Your Audience, One-tap short removed on purpose.
6. Diagnostics + Storage live in Settings.
7. Any NEW voice-model swap needs commercially-licensed weights — the 5 current voices are public domain/CC0.
8. Never copy lesson text/structure from Reframe, I Am Sober, etc.; no logos; no implied endorsement.
9. **No medical claims or research claims in the app, ever.** No "research shows".
10. Pull before pushing; two sessions work this repo.
15. **Repo visibility:** Jacques chose PUBLIC again (Aug 16). USER DATA IS NOT IN THE REPO — it lives in the Railway database (app-volume), not git, so public-vs-private does not expose users' journals/emails either way. Public costs: server code readable by attackers (mitigate with CodeQL) + any future committed key is instantly exposed (mitigate with secret scanning/push protection). Going private again later is fine — voices need hosting (~2 GB) and the update token returns; both solvable.
11. **Nothing pushes without Jacques's approval.**
12. No screenshot blocking, no hard IP blocking — decided no, don't re-add.
13. **LANE SPLIT:** recovery-app AI owns `TurnSomeDayIntoOneday/`; Studio AI owns `Studio/`, `reference/`, `START-HERE.md`. Don't edit the other lane.
14. **Token lives in BOTH servers' envs:** `Studio/server/.env` AND `TurnSomeDayIntoOneday/server/.env` each need `APP_UPDATE_TOKEN` — the recovery app runs on Railway, so that one goes in Railway's env vars. Owner email `APP_OWNER_EMAIL` too. (As of Aug 16 the repo is PUBLIC again, so no token is currently needed.)
15. **Railway auto-deploys on push to `claude/vibe-code-uwxxlk`** (Aug 17, Jacques's correction) — do NOT ask Jacques to redeploy Railway. It watches the branch and deploys itself. "Still broken on the phone" means the fix isn't on `origin/claude/vibe-code-uwxxlk` yet, not that a redeploy is pending.

## Friendly's AI — fixed 18 Aug 2026 (v5.8)

Friendly gave canned replies for weeks with a perfectly good Gemini key. It was
three separate faults stacked, each hiding the next:

1. The API key was never sent (no `x-goog-api-key` header) — fixed in 5.8.6.
2. `gemini-2.5-flash` was retired by Google to new callers. Every chat came back
   HTTP 404 "no longer available to new users … use models/gemini-3.6-flash".
3. `gemini-3.6-flash` rejects `thinkingConfig` outright — HTTP 400 "Request
   contains an invalid argument". It is no longer sent to 3.x models.

What made this take weeks was that **none of it was visible**. A failed AI call
falls back to a canned reply, so the app looked like it was working. Now: every
provider failure is logged to Diagnostics with `error.details`, the owner sees
the reason in the chat itself, a 200 with no text in it counts as a failure and
doesn't cost a chat, and `GET /api/ai-status` reports config health in one line.

**If Friendly ever goes robotic again:** open `/api/ai-status` signed in, then
Profile → Diagnostics. The reason will be there. Model is overridable with the
`GEMINI_MODEL` variable in Railway — the next retirement is a variable change,
not a redeploy.

## House rule 12 — write it down before the session ends (Jacques, 18 Aug 2026)

After any working session — a fix, an answer, a decision, an audit — update the
memory files before signing off. What was found, what was decided, what is still
open. Not a summary of the chat: the things a person picking this up cold would
otherwise have to rediscover.

The Gemini hunt is the argument for this rule. Three stacked faults took weeks,
and the reason each one cost days was that nothing was written down when it was
learned. Everything found in that hunt is recorded above, including where to
look first if it happens again.

## Pro lockout — found and fixed 18 Aug 2026 (v5.9 / v6.0)

Jacques deleted everything in the app and lost his own Pro with no way back.
Stripe confirmed it exactly: subscription killed 18 Aug 17:28 UTC, the same
second he pressed delete, on a plan paid through 6 Sep. **18.8 days he had
already bought, gone.** An earlier account lost 4.9 days the same way.

Three faults, all fixed:

1. Deleting an account cancelled the subscription INSTANTLY instead of at the
   end of the paid period. Now `cancel_at_period_end` - no further charge, and
   the time already owned stays owned.
2. "Restore purchases" could not recover anything once a user row lost its
   `stripe_customer_id` - which is what a delete-then-resignup produces. A
   LIFETIME purchase was unrecoverable that way. `relinkCustomerByEmail` now
   finds the Stripe customer by the email that paid, and refuses to take one
   another account already owns.
3. The owner was paying $9.99/month to look at his own product. `APP_OWNER_EMAIL`
   now grants Pro on its own, env-only like the comp list, so it writes nothing
   to the database, cannot take a Founding Lifetime seat, and never shows up in
   revenue. A real purchase still wins over the comp.

**Confirmed working by Jacques, 18 Aug.** 11/11 tests pass.

**Still open from that investigation:** both Stripe price objects read
`active: false`. The code creates prices from PLANS on the fly so checkout
probably still works - but nobody has tested a real purchase since. Worth one
test buy before the Play release goes live, because if it is broken, nobody can
buy Pro at all.

## Voice cloning — tried and closed (18 Aug 2026, Jacques's call)

Cloning was proven end to end: Jacques's Suno clip cloned into full lesson
narration (YourTTS, run on the cloud box), hiss traced to the reference clip and
cleaned. He compared against the app's existing narrators and decided it does
not sound better. **Voices stay as they are.** The five shipped narrators are
public-domain/CC0 and licence-clean.

If this is ever reopened: `Studio/narrate-lessons.mjs` batch-records all 425
lessons through Studio's Chatterbox cloner (MIT, sellable) unattended — one
voice per run, resume-safe, refuses the paid path. A 25-30s clean reference
clip is the single biggest quality lever. Note: YourTTS (the quick-test route)
is CC BY-NC-ND - never shippable in a paid app.

## House rule 13 — the ask-me-anything bot is updated with EVERY change (Jacques, 18 Aug 2026)

Friendly is the app's ask-me-anything bot. Her app knowledge lives in
`SYSTEM_APP_MAP` in TurnSomeDayIntoOneday/index.html, right above
SYSTEM_FREE_ADDENDUM. **Any commit that ships, changes or removes a feature
updates that block in the same commit.** No exceptions, no "later". A feature
she doesn't know about is a feature she will deny exists - to the face of the
person paying for it. She should know the app in and out, better than Jacques
does.

## House rule 14 — video format (Jacques, 18 Aug 2026)

Every talking-head and AI script from now on is built in this order:
1. **Dramatic thumbnail at the very beginning** — the first frame is a designed
   scroll-stopper, not a mid-sentence face.
2. **Hook in the first 3 seconds.**
3. **Call to action carries the rest** — the remainder of the video moves the
   viewer toward the app (link, follow, download), not just to the end.
**The style (his words):** the images are outrageously enticing — a scroller has
to want to look. The message is hard, cold, cut-throat, straight to the point.
No soft openers, no warm-up. The 18 Aug script batch was eliminated; any new
batch follows this rule.

**Amended (Jacques, 18 Aug, later):** in addition —
4. **15 seconds.** Not 20–25. ~40 spoken words maximum.
5. **Every piece answers all five: WHAT / WHO / WHEN / WHERE / HOW** — in the
   piece itself where it fits, always in the caption.
6. **Arrogant and bold.** Not humble, not gentle-brave — the voice of a man who
   beat 38 years and knows it. Confidence is the hook.
7. **No two pieces built the same.** Different structure, rhythm and angle every
   time — a formula repeated is a formula scrolled past.

**Amended (Jacques, 19 Aug — the Gemini structure, logged at his instruction):**
8. **Voiceover 35 words or fewer.** The hard number that makes 15 seconds speak
   naturally instead of rushed. Count the words before anything is recorded.
9. **Quick cuts, bold dynamic visuals, ONE high-impact punchline or CTA** — not
   several. The script and the shot list are written together, as one unit.

**Standing Suno narration template** (fill the brackets, paste both boxes):
- STYLE: dark minimal cinematic spoken word, deep calm male voice, cold
  confident unhurried delivery, sparse 808 heartbeat pulse, low sub bass,
  [scene ambience], 60 bpm, no singing, no chorus, dry vocal up front
- LYRICS: [Spoken, slow, cold] + the piece's voiceover (<=35 words), with
  [beat] markers where the video cuts land. Generate 3-4 takes, keep the
  slowest and coldest, trim so the first word lands inside second one.


## House rule 15 — THE CONTENT WORKFLOW (Jacques, 19 Aug 2026)

**Scope, corrected 19 Aug:** rules 14 and 15 govern content BUILT HERE from
scratch. Jacques's existing finished videos - already written, shot and rendered
in Studio - are not subject to them. Nothing about a finished video gets
rewritten, retimed or "checked" against the 15-second rule. For those the job is
only: commit to content/ for a public URL, write the per-platform captions,
show him, queue to Buffer on his word.


This is now how every AI script, card and talking head gets made. It replaces
"write scripts, hand them over" - the deliverable is a finished video, not a
document. Proven on "Clear All" (18 Aug) and "She Came Back" (19 Aug).

**The pipeline, in order:**
1. **Claude writes the piece as ONE unit** - shot list + voiceover (<=35 words,
   rule 14) + the Suno prompt pre-filled. Never a script alone.
2. **Images**: Manus for anything photoreal (people, places). The character
   block is pasted word-for-word into every prompt with "apply to all" so faces
   hold across frames. Captions can be burned in by Manus OR added by Claude -
   Manus doing it has worked well. NO drug use shown in frame, ever: no pipes,
   no smoke, no using. The platforms suppress it and the story is harder without
   it. For anything that is UI rather than photography (lockscreens, chat
   threads, app-store reviews), Claude builds the frames in code - no image AI
   needed at all.
3. **Narration**: Jacques generates the voiceover in Suno from Claude's prompt.
   3-4 takes, keep the coldest. Takes run ~20s rather than 15 - that is fine,
   see step 4.
4. **Assembly**: Claude renders the video in code - Ken Burns push-ins on stills,
   motion graphics for UI pieces, brand end card - and retimes the WHOLE
   timeline to the narration's real length. The video bends to the voice; the
   voice is never chopped to fit the video.
5. **Approval**: Jacques watches. Nothing is queued until he says so.
6. **Publish**: Claude commits the mp4 to content/ (gives it a public URL), then
   queues it to TikTok, Facebook and YouTube via Buffer - TikTok caption says
   "link in bio", Facebook and YouTube carry the real URL.

**What this costs: nothing.** No Studio credits, no animation service, no voice
service. Manus stills and Suno audio are on plans Jacques already has; every
other step is code.

**DEADLINE: Manus is free only until 25 Aug 2026.** After that the photoreal
stills in step 2 have no source. Do NOT let this arrive unplanned:
- **Bank stills before the 25th.** Every story worth telling for the next few
  months, generated while it is free. A character block that already holds
  (the porch women) can be reused across many stories - same two people, new
  situations - so the batch is worth more than the images in it.
- **Code-built pieces are unaffected** - lockscreens, chat threads, app-store
  reviews, counters, anything that is interface rather than photography. That
  lane stays free forever and should carry more of the load after the 25th.
- **Replacements to price when the time comes** (nothing chosen yet): Creen
  (face lock, free credits), ChatGPT image credits, Microsoft Copilot (holds a
  face from one reference photo) - all three are already in Jacques's tested
  toolchain in START-HERE. Studio's own paid stills are the fallback of last
  resort because they cost per image.

**Where the pieces live:** finished videos in `content/`, and the source page
for each code-built animation beside it (e.g. `content/clear-all-source.html`) -
edit the timeline, re-render, new video.


## House rule 16 — BRANDING, FIXED (Jacques, 19 Aug 2026)

"Big brands don't change, so we don't either." These are not per-video choices.
Every AI-built video carries all of them, identically, every time:

1. **Corner watermark.** The handshake symbol sits in the BOTTOM-RIGHT corner of
   every frame of every video, start to finish - not just the end card. Lifted
   ~210px off the bottom edge so TikTok's caption and buttons never cover it. It is
   the branding: someone who scrolls past ten of these should recognise the
   eleventh before they read a word.
2. **The brand line.** "An app for YOU and the one who SUPPORTS YOU" - "you" and
   "supports you" in green (#7ee8a2), the rest white. This is the new standing
   line; it replaces "Recovery app for you and the one that supports you".
3. **End card layout, fixed.** Symbol near the TOP, brand line directly beneath
   it, a short green rule, then the piece's message and "It's free. Link in
   bio." Brand name in letter-spaced grey at the bottom. Nothing about this
   arrangement is re-decided per video.
4. **Music covers the whole video.** If the track is shorter than the cut, the
   video is retimed so it ends on the last note - never a silent tail.

The end card is built from a single source page so it cannot drift. Any change
to the branding is a change to that page, and then to every video after it.


## House rule 17 — TEST, DON'T ASSUME (Jacques, 19 Aug 2026)

Jacques called this out and he is right. Three times in two days Claude said
"can't", and three times it turned out to be "didn't check":

- **Buffer** - reported no connector existed. It existed; the wrong registry was
  searched. Jacques found it himself.
- **Voice cloning** - sent him to do 518 lessons by hand in Studio. It ran here
  in the end, in minutes, once actually attempted.
- **Animation** - said Claude Design cannot animate, therefore no animation.
  Full motion-graphics video turned out to be available all along, in code.

**The rule: never report a capability as missing without testing it in this
session.** "I don't think I can" is not an answer - run the command, hit the
endpoint, install the package, and THEN say what happened. A wrong "no" costs
Jacques hours of work he should never have touched.

### What is actually available here (tested 19 Aug, not assumed)
- **Video**: ffmpeg (full encode, overlay, filters) + headless Chromium. Any
  HTML/CSS/JS renders to frames = motion graphics, animated UI, charts,
  Ken Burns, watermarks, end cards. Complete videos, start to finish, free.
- **Audio**: 110 ffmpeg filters - mix, fade, tempo, pitch, EQ, loudness,
  silence detection. Music beds and edits, yes. Cannot HEAR the result.
- **Images**: Pillow + cairosvg - cards, diagrams, text art, anything drawn or
  laid out. Cannot generate photoreal images.
- **Browser**: real Chromium - test the live app, fill forms, screenshot.
- **Reach**: GitHub, PyPI, and MCP connectors work. HuggingFace, OpenAI,
  Replicate and fal.ai are BLOCKED by the environment's network policy - that
  is why no AI model can be called from here for images, video or voice.
- **Hard limits, real ones**: cannot hear audio, cannot watch video. Jacques is
  the ear and the eye on every piece of media. That one never changes.


## Outreach record — collegiate recovery (ARHE list), 20 Aug 2026

The ARHE member directory Jacques uploaded (xlsx) was extracted to
`reference/crp-contacts.csv` — **113 unique programmes** across 40+ states,
Canada and the UK, with a named contact and email for each.

**All 113 are now sitting in Gmail as drafts**, one per programme, each
personalised with the contact's first name and their programme's own name
(Gamecock Recovery, Cougs for Recovery, Roos in Recovery, and so on). Subject:
*"Free recovery app for your students — no cost, no card, ever."* Nothing was
sent — Jacques reads and sends.

The pitch is deliberately narrow and checkable: students are broke and every
app in this space charges; days 1–15 of every programme and every tool are free
with no card and no trial; porn, gaming, vaping, scrolling and spending are
full 30-day programmes, not footnotes; and there's a separate track for a
student carrying a parent's or partner's addiction. It asks for a resource
listing, not money, and asks for the reason if the answer is no.

**Still open on outreach:** four template emails (unions, first responders,
Celebrate Recovery, gambling councils) are written but need named recipients
before they can be drafted.


## v7.4 — The 90-Day Bootcamp (21 Aug 2026)

The brand is now **The 90-Day Bootcamp — an addiction program with continuous
support, for you and the one who supports you.** Jacques named it; everything
follows it.

What shipped, all verified in a real browser before push:

- **Days 31–90 exist.** Two shared phases in `data/phases.json` — REBUILD
  (31–60: sleep, meals, money, trust-by-pattern, the evening script) and
  KEEP IT & GIVE IT (61–90: relapse signature, worst-day plan, forever rules,
  the weekly honesty ritual, day 90 = give it away). Written once, personalised
  per track via {{habit}} words ("drinking", "the scroll"…). Supporters keep
  their own 35-day track and are never routed into the phases.
- **Faith woven in, not bolted on.** 30 themed lines cycling across all 90
  days, inside every lesson on every track — only for people who answered yes
  or open. "No" users never see a word.
- **Cross-links between tracks.** All 13 authored pairs now carry an "apply"
  paragraph — today's skill pointed at the other active track — plus an honest
  generic for unlinked pairs.
- Day 30/60 = phase-handoff toasts; day 90 = graduation overlay (rewritten).
  Free tier = days 1–15; Pro = days 16–90. Plans copy updated everywhere.
- **Class handout** in `reference/bootcamp/` (PDF + PNG + generator), house
  style, QR verified by decoding.

Per-addiction clocks (v7.3) and the agents upgrade rode along in the same push.


## House rule 21 — videos are 15 to 20 seconds (Jacques, 22 Aug 2026)

**Every video is 15-20 seconds. Twenty is the ceiling, not the target.**

Jacques called this after a 31-second piece: too long for how people actually
watch. In practice that is about **four beats**, not seven - roughly 3.5 to 4.5
seconds a line including its fade. Every line has to earn its place, and the
end card is 2 seconds inside the budget, not on top of it.

Existing longer pieces stay as they are. This governs everything new.

## House rule 23 — every screen must pass the Bigger-text audit (Jacques, 23 Aug 2026)

"Every screen needs to be inspected and tested to make sure when bigger text
is chosen it fits." The tool exists: **`TurnSomeDayIntoOneday/tools/bigtext-audit.js`**
(Playwright, against a local server) opens every screen and every full-screen
overlay at 412x915 with Bigger text and fails if any content top or bottom
cannot be scrolled into view. Run it after ANY layout change and before any
ship that touches screens/overlays. The fix pattern for centered overlays is
`overflow-y:auto` + `justify-content:safe center` (centers when it fits,
top-aligns and scrolls when it doesn't) - already applied to all nine.

## House rule 22 — talking heads: watermark + quiet score, no end card (Jacques, 23 Aug 2026)

Two different video kinds, two different treatments:

- **AI-made/produced videos** (stills, motion graphics, generated footage):
  end with the standard brand end card, exactly as house rule 16 lays out.
- **Everything else - above all Jacques on camera talking:** NO end card; the
  video ends on him. Instead it carries the **corner watermark** (handshake
  symbol, bottom-right, ~210px off the bottom, whole video - same spec as rule
  16.1) so the branding is present without turning a personal moment into an
  ad. And every talking head gets **background music underneath the speech** -
  a track from his own score library (`audio/meditation/`), ducked low so his
  voice always leads. Every talking head ends with a short fade to black (~0.8s) - the video closes, it doesn't just stop. And every talking head gets burned-in captions - timed to his speech, white on a dark pill, key words in brand green (#7ee8a2) - transcribed in-session (see the transcription note below).

**Transcription works in this environment now (23 Aug 2026).** Whisper via pip
is blocked (HuggingFace unreachable), but **sherpa-onnx from PyPI + models from
the k2-fsa/sherpa-onnx GitHub releases** (same host as the Piper voices) works:
whisper tiny.en for clean text, zipformer-en-2023-06-26 for word timestamps.
Models live in scratchpad/. Never again report speech-to-text as unavailable
here - captioning talking heads is now a standard step.
 The caption still carries "link in bio" as always.

## The score library is Jacques's own music

`TurnSomeDayIntoOneday/audio/meditation/` is 11 tracks - the 8 Suno tracks
Jacques made plus the Rain / Ocean / Night beds. He is on a paid Suno plan and
has confirmed permission for every track (see
`reference/asset-licenses-2026-08-08.md`; settled, do not re-raise).

So the meditation library doubles as the **royalty-free score library for every
video**: no third-party music, no YouTube claims, no takedowns. Score from here
and nowhere else. Fading Night and Night Fade suit the sombre pieces; Still
Waters and Himalayan Still are calmer.


## v7.5–7.7 shipped together (22 Aug 2026)

- **v7.5 Alignment audit** — every surface tells the same 90-day story:
  Friendly's system prompt (was still teaching a 30-day program in three
  places), the Guide (now opens with "How does the program work? — a 90-day
  system"), the day-15 upsell, plans footer, FAQs, the welcome-to-Pro email,
  and landing.html (Free card had been underselling the real free tier).
- **v7.6 Together: faith + celebrations** — the faith weave now reaches the
  couples screen (it never had), and marking a day done together celebrates:
  burst every day, big burst + words at weeks 1–3, renewal card at 30.
  Together verified gender-neutral: zero gendered words.
- **v7.7 Couple link** — two phones, one Together table. Code pairing,
  shared day count (server keeps the max), "Ask for tonight's ten minutes"
  as a real push, six-an-hour limit. The link stores ONLY the day count and
  the nudge — no clocks, journals, or slips, enforced by the schema.
  Tested end to end with two live accounts.

All three went to main + vibe-code in one push; Railway deployed v7.7.
