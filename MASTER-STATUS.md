# MASTER STATUS — every request, one place

**This file is the running log.** When you open a new conversation with me (or any AI), the first thing it should do is read THIS file + START-HERE.md. Never make me re-explain what's done. Updated: Aug 16, 2026 (third pass).

Legend: ✅ done+pushed · 🛠 done in files, not pushed · 🔬 research done · ⏳ waiting on you · 🚫 decided no

---

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

## HOUSE RULES (keep)

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
