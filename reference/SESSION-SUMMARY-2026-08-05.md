# Session summary — 5 Aug 2026

What got done this session, in order.

1. **SEO groundwork.** Sitemap, robots.txt, homepage footer links. Confirmed
   with Jacques that Search Console was set up and the sitemap submitted.
2. **Schedule rewrite (`DO-THIS-NEXT.md`).** His wife took over comments and
   followers — his daily dropped to 10 min. Removed "lead with her," replaced
   with "post for everybody" per his call that the app is for straight, gay,
   bi, nonconforming, any gender.
3. **Studio — Dynamics templates.** Shipped 10 free CapCut-style effects (Beat
   Mix, Strobe, Color Flip, Thermal, Glow Up, Echo Trails, Hype Shake, Mirror
   World, Time Machine, 3-2-1 Opener). Tested on his real uploaded video
   through the live API. Extended to pictures (still → 4-15s clip). Settled
   the Kling-subscription question with real math — pay-per-use wins at his
   volume.
4. **File cleanup**, after he called out duplication and unfinished work: split
   `AI-SCENES.md` out of `SCRIPTS.md`; rewrote `OUTREACH.md` so all 30 emails
   are fully written, no "personalize this" left; added contact-form
   instructions for sites with no direct email.
5. **13 new scripts (26–38)**, VICTORY fighter-tone voice from his card.
   Covers every one of the 13 tracks that had nothing yet (gambling, social
   media, smoking, work, anger, spending, gaming), one for the supporting
   person, one stating plainly the app is for everyone.
6. **Rebuilt `Studio/Studio-Guide.pdf`** — the old one (30 Jul) was missing
   everything shipped since. New 8-pager covers Dynamics, Ken Burns
   strength/fit, captions, all 24 output sizes, current prices.
7. **Marketing infrastructure**, at his request:
   - `recovery-app-marketer` agent now must read `KEYWORDS.md` first and only
     write for terms marked Build (never Skip/Too-hard, whatever the volume);
     stops and asks if the file is missing rather than guessing.
   - `COMPETITORS.md` — monthly structural log (hook type/length/format only,
     never wording) for accounts serving the partner angle.
   - New page `/is-my-husband-an-alcoholic`, lowest-difficulty term in the set,
     routes to `/quiz`.
8. **Weekly Play-launch check-in fired** (per standing Routine) — awaiting his
   answer on production status.
9. **Research report** (`reference/RESEARCH-2026-08-apis-margins-posting.md`),
   requested, nothing built pending his decision: LLM pricing for Friendly,
   fal.ai vs Replicate/Runware/Kling, real net margin after Stripe vs Play fees
   and hosting at 10/100/1,000 users (Stripe beats Play at every price point
   he sells), Buffer's new GraphQL API + MCP as the free already-paid-for
   answer to auto-posting vs alternatives, five candidate agents.
10. **Schools/employer-benefits angle**, discussed honestly: real money math,
    long sales cycle and paperwork he doesn't have yet, cheap test path
    (free to wellness coordinators, no procurement) recommended first.
11. **His seven personal photos → the origin story.** Built the sequence (bar →
    floor → her carrying him out → couch → day 150 → the room → the street).
    Caught two brand issues: a fake app screenshot on the laptop shot, and
    "Someday" incorrectly split into two words on two images — both flagged,
    not yet fixed by him. Built two ways: AI-animated (A6, not yet written up)
    and, per his choice, **script 39** in `SCRIPTS.md` — his real stills, his
    own narrated voice, $0 cost, full Studio recording method included.

## Where things stand at end of session
~39 scripts ready across `SCRIPTS.md`, 5 AI concepts in `AI-SCENES.md`, first
outreach batch (Week 1) sent, Search Console live, wife handling comments,
one new free video (39) queued the moment he records the seven lines. Play
production status unconfirmed — check-in pending his reply.

---

## Continued same day — more requests, all closed out

12. **Reviewed two more of his personal photos** (him and his wife arm-in-arm
    leaving a bar, and a solo street portrait). Revised the origin-story order:
    it's her carrying HIM out (not the reverse) — title became "She carried
    me out of places I walked into on my own." Street shot became the closing
    frame. Full 7-shot arc now: bar → floor → she carries him out → couch →
    laptop (day 150) → the room → the street.
13. **He asked to narrate it himself over stills, not AI-animated.** Delivered
    as **script 39** in `SCRIPTS.md` (not `AI-SCENES.md` — no AI generation,
    $0 cost): per-shot Ken Burns motion/strength/length, all seven narration
    lines, and the exact Studio recording method (teleprompter line-by-line →
    🎙 Take the voice out → sync in Sequencer). The two open picture fixes
    (fake app screenshot on the laptop shot, "Someday" split into two words)
    are still unresolved — flag again if a future session touches those images.
14. **Explained two things he found himself:** a donation-funded third-party
    video site (why its "free" generations aren't really free — someone else
    is paying fal/Replicate rates and subsidizing via tips/limits/watermarks;
    not something to build around), and Search Atlas/OTTO SEO ($99-999/mo) —
    verdict: skip it, it automates technical SEO that's already done by hand
    at $0, and can't manufacture the backlinks that are the actual bottleneck.
15. **Diagnosed the watermark "Patch it out" tool leaving a visible patch.**
    Read `cleanmark` in `studio.js`: it's ffmpeg's `delogo` filter blending
    surrounding pixels inward, not AI inpainting — clean on flat backgrounds,
    leaves a soft/smeared patch on busy ones (bottles, lights, texture) because
    it can't recreate detail, only average it away. Verified live with a test
    render. No code change made — walked him through two existing fixes: drop
    to the "Small" mark size, or switch method to "Zoom past it" (crops the
    corner off — genuinely clean, no smear, small edge trade-off).
16. Saved this summary and closed the session at his request to start fresh.

## Carry into the next session
- **Play Store: answered 6 Aug — STILL IN CLOSED TESTING.** Not applied for
  production. No Play-side work until he says it's live.
- **Outreach: answered 6 Aug — 10 of 30 sent**, Weeks 1–2 now ticked in
  `OUTREACH.md`. 17 scripts loaded into Buffer, refills 6 Aug.
- **Two picture fixes pending** on his 7-photo origin story (script 39 /
  future A6): real app screenshot needed on the laptop-shot screen; "Someday"
  needs to be one word on the slide and phone mockup images.
- Nothing else blocking — Tuesday outreach, Search Console, and the schedule
  are all running under their own steam.
