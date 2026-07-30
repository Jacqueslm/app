# Post-launch build list

Things deliberately deferred until Turn Someday Into Day One is through Play
Store testing and live. Not started — captured here so they're ready to build.

---

## 1. Real background lesson audio (podcast-style) — ✅ DONE (in another session)

Completed elsewhere: lessons converted to real audio for background/locked
playback. No further work here. (If it shipped on a different branch, make sure
it's merged into main / the vibe-code-uwxxlk branch before the Play-side update.)

---

## 2. Wire up the real AI for Friendly

**Now:** no `ANTHROPIC_API_KEY` on the server, so Friendly runs entirely on the
built-in guided replies (the fixed library). The "AI mode" badge and the Pro
"X of 30 left" counter are built and correct, but the counter won't tick down
and the badge won't light up until real AI is active (guided replies are free
and don't consume the quota).

**Fix:** add `ANTHROPIC_API_KEY` to the server `.env`. That's the whole change —
the chat endpoint, quota enforcement, and counter are already built around it.
Then Friendly becomes a real back-and-forth and the Pro counter goes live.

**Note:** do this AFTER Play testing, and confirm the Data safety form still
matches (chat content transits to the AI provider — already disclosed, but
re-verify before flipping it on).

---

## 3. Accountability partner link — the /together door

**Idea (validated as a strong angle, tabled for build):** one revocable link a
user shares with someone in their corner (partner, sponsor, friend). The partner
sees only what the user chooses — a "checked in today" dot and/or the day count.
Never journal entries, never slip details. Either side can unlink instantly.

**Why deferred:** it's a real feature (new table, share/redeem routes, a partner
progress page) AND it changes what data is shared between users — which means the
Play Console **Data safety form must be updated before it ships.** Not a
mid-testing change.

**When built, it powers all three marketing doors** (for-her, for-him, together)
off one primitive.

---

## Guardrail reminder
None of these get built until through the 12-tester/14-day window and live.
Items 1 and 3 also need the Data safety form checked before they go live.
