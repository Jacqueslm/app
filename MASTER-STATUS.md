# MASTER STATUS — every request, one place

**This file is the running log.** When you open a new conversation with me (or any AI), the first thing it should do is read THIS file + START-HERE.md. Never make me re-explain what's done. Updated: Aug 16, 2026 (second pass).

Legend: ✅ done+pushed · 🛠 done in files, not pushed · 🔬 research done · ⏳ waiting on you · 🚫 decided no

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

---

## ⏳ WAITING ON YOU — the three setup steps (only these block the "AI" features)

**Why the app says "not hooked to anything":** the server code is ready, but no API key is configured. Keys live in `server/.env` (self-hosted) or the hosting platform's environment settings — I cannot write them for you (secrets).

1. **`ANTHROPIC_API_KEY`** (or `GEMINI_API_KEY`) → makes **Friendly actually intelligent** instead of canned replies.
   - Sonnet 5 (Anthropic): best quality, ~$0.63/day at 30 Pro chats/day ≈ **$19/mo at heavy use**.
   - Gemini 2.5 Flash (Google): **free tier** (~1,500 requests/day), ~$0.07/day at the same load ≈ **$2/mo**. Good enough, ~15× cheaper.
   - Recommendation: start **Gemini** (free), switch to Sonnet when quality matters more than $17/mo.
2. **`APP_UPDATE_TOKEN`** → GitHub **fine-grained PAT** with **Contents: read** on the `Jacqueslm/app` repo, pasted into `server/.env` as `APP_UPDATE_TOKEN=...`. The repo went private, so the in-app update button can't read it without this token. (What a token IS: a secret password GitHub gives you that lets ONE app read ONE repo. Create it at github.com → Settings → Developer settings → Fine-grained personal access tokens → Generate new token → Repository access: only `Jacqueslm/app` → Permissions: Contents = Read-only. That's the whole thing. It never sees anything but that one repo.)
3. **`APP_OWNER_EMAIL=turnsomedayintodayone@gmail.com`** → `server/.env` → only your email can trigger the update button (already coded; without it the update button refuses to work for everyone, by design).

**Also flagged (needs your call, not code):** the 2,615 lesson recordings (523 lessons × 5 voices, all public-domain Piper voices, ~2 GB) exist on the `lesson-audio` branch, but the private repo blocks them from loading on phones. Fix = host the audio somewhere public (the app's own hosting or a storage bucket) and point `data/lesson-audio-manifest.json`'s `base` at it. Say the word and I wire it.

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
11. **Nothing pushes without Jacques's approval.**
12. No screenshot blocking, no hard IP blocking — decided no, don't re-add.
