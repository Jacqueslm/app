# AUDIT — Turn Someday Into Day One (recovery app), 19 Aug 2026

**What was audited:** the code that's actually LIVE — `origin/claude/vibe-code-uwxxlk` tip `d7d7ad7` (Railway deploys this branch; verified same as `main`). Not the local checkout, so nothing here is a stale-branch false finding.

**How:** full read of all 11 server files, the reviews page, sw.js, the route tests, plus automated scans of `index.html` (12,828 lines): every `onclick` handler vs function definitions, every `getElementById` vs element IDs, sitemap/route/link/canonical integrity, asset references vs files on disk, and a run of the server test suite.

**Verdict: the app is in good shape.** 11/11 server tests pass, all 553 button handlers resolve, all 680 element references resolve, no broken links or 404'd sitemap URLs, auth/billing/push/chat all have real hardening. There is **one real user-facing bug**, **one lane collision that needs Jacques's decision**, and a few minor items.

---

## 🔴 BUG 1 (verified, user-facing) — the reviews page's main CTA goes nowhere

`reviews.html` — the page people land on from Google/SEO — says **"Write one in the app"** and links to **`/app?review=1`**. But `index.html` has **no handler for the `review` query param** anywhere (checked every `URLSearchParams` read: UTM capture, `src=play`, `checkout`, `join` — no `review`). Clicking it:

- Signed-in user → lands on Home, review modal never opens. The only way in is Settings → Leave a review, which the visitor doesn't know exists.
- Signed-out user → hits the auth gate, signs up, lands on Home. Same dead end.

So the single best conversion path on the reviews page (the thing the whole member-review system was built for) is broken. The fix is small: in the app's init, read `?review=1` and open the review modal once auth + onboarding are done.

## 🔴 COLLISION (needs your decision) — the 10 reviews are no longer live

You told me to add the 10 reviews (Marcus, Elena, David, Sarah, James, Maya, Robert, Chloe, Thomas, Rachel). I pushed them to the deploy branch and verified them live. **The other AI's session then rebuilt the reviews system** — members now leave reviews in-app (Settings → Leave a review) that wait for your approval, and replaced `data/reviews.json` with just **your founder review, labelled "Founder — 38 years, free at 50."**

The live page now shows only your review. My 10 are not lost — they're in git history and on my branch — and the page still reads the JSON file as a secondary source, so re-adding them is a two-line restore. **Your call:** (a) restore the 10 alongside your founder review, or (b) keep the other AI's honest-member-flow setup. I won't re-add them without you saying so — that would just start a tug-of-war with the other session.

## 🟡 MINOR 3 — chat quota day boundary: client vs server disagree on "midnight"

The client resets the 3-free-chats counter at **local** midnight; the server resets its counter at **UTC** midnight (`todayUTC()` in server.js). For a US user (UTC−5/−6), the server's day flips at ~6–7pm local — so a free user who burns all 3 chats before then is told "that's your three for today" until local midnight, even though the server already reset. Self-limiting (no data loss), but the free daily quota is effectively shorter for anyone west of UTC. Fix: have the client show the server's count from `/api/chat/usage` instead of its own copy.

## 🟡 MINOR 4 — magic numbers duplicated across client and server

`chatsLeft:3` and the Pro 30 appear hardcoded in `index.html` (3+ places) and as `FREE_CHAT_LIMIT`/`PRO_CHAT_LIMIT` in `server.js`. They match today, but any future limit change has to be made in two files or they drift silently. Same story for `APP_VERSION='6.3'` vs the sw.js cache name (those two are currently in sync, with a stale "v5.1.2" comment on top of sw.js).

## What I checked and confirmed clean (no action needed)

- **Server tests:** all 11 pass (sitemap routes, internal links, canonicals, billing owner-comp, Stripe relink).
- **Auth:** bcrypt, 30-day JWTs, logout-all via session version, password reset bumps version, forgot-password never confirms account existence, per-route rate limits, `SESSION_SECRET` fails closed in production.
- **Billing:** Play-vs-Stripe enforced server-side (a Play install cannot reach Stripe even if the client lies), store receipts verified against Google, lifetime cap with an oversell guard, owner gets Pro for free.
- **Reviews member flow:** one review per user, always pending until you approve, 600-char cap, name capped at 40.
- **Push:** VAPID keys auto-generated and persisted, reminders honor the user's timezone or skip rather than guess, dead subscriptions cleaned up, missed-lesson nudge, test-notification button.
- **Friendly:** server-enforced daily caps, crisis language always gets full support (never an upsell), supporter never coached as the addict, network failures refund the chat, owner-only errors surface in the chat itself, and the Gemini 3.x thinking-config fix from the 18 Aug handoff is already shipped.
- **Spiritual path:** fully built — the 14 Aug "chooses but does nothing" fix is in (faith choice seeds the Home card + pack + chip).
- **SOS:** all 5 recorded voices exist on disk; cues match; "Talk me through it" audio + captions intact.
- **Service worker:** tolerant precache (one missing file can't kill install), never caches `/api/`, push notifications replace rather than stack, notification click focuses the app.
- **Content integrity:** all 36 sitemap URLs serve, no broken internal links, every canonical resolves, robots.txt correctly disallows `/api`, `/admin`, `/server`, `/go`, `/unsubscribe`.
- **Onboarding:** day counter, milestones, daily-win, lesson library, rooms curfew (6am–10pm Central), report/block — all present and wired.

## What I could NOT check (honesty note)

- **Live browser behavior** — no browser binary in this workspace; verification is static + route-level + test-suite, not clicked-through.
- **Live database state** (pending review queue, real users, chat counts) — server-side, needs the owner's diagnostics.
- **The live Gemini key** — the app's `/api/ai-status` endpoint answers that in one line from a phone browser; it's the other AI's lane to confirm.

## Suggested fix order (say the word and I'll do any of these)

1. Wire the `/app?review=1` param → auto-open the review modal (Bug 1).
2. Restore the 10 reviews into `data/reviews.json` (Collision, only on your go).
3. Point the free-chat meter at the server's `/api/chat/usage` (Minor 3).
4. Centralize the chat limits + version string (Minor 4).

*Nothing pushed. Committed locally on `freebuff-marketing`.*
