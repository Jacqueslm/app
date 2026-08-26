# Play Store — live status

**Read this first, before anything else in this folder.** It is the record of
what is actually done in Play Console, so nobody re-walks finished ground.

## 🟢 LIVE — released 26 Aug 2026, 7:59 AM

**Turn Someday Into Day One, release 2 (1.0.1), is Available on Google Play.**
Production track, full rollout, 177 of 177 countries, 20,237 supported devices.
Package `com.turnsomedayintodayone.app`. Developer: Jacques Malone (personal
account, ID 4619499919117466586).

Everything in the old "Open" section below is **closed** — closed testing,
production access, data safety and the health declaration all cleared and the
app shipped. That history is kept at the bottom for reference only. Do not
re-walk it.

---

## Open — 26 Aug 2026, 11:20 AM

### ✅ CLOSED TODAY (confirmed in the console, not assumed)

| What | Evidence |
|---|---|
| Full description (keyword pass) | Box reads **3925/4000**, ends "addicted for 38 years and free at 50" |
| Short description | Box reads **78/80**, "Addiction recovery: sober day counter, 90-day program, and support for family." |
| Screenshots — Climb added, stale Friendly removed | 6 panels live |
| Everything sent + published | Publishing overview empty, "Last published August 26, 2026" |
| Developer name → "Turn Someday Into Day One" | Banner: *"Your new developer name is being reviewed"* — Jacques's own name comes off the listing when Google approves, 1–2 days |

**Do not re-walk any of the above.** Two separate loops happened today because
the description was confirmed "done" before it was checked, then rewritten and
re-pasted. It is right now.

### ⛔ BLOCKED UNTIL THE CURRENT REVIEW CLEARS
**Google greys out the asset Upload button while a submission is in review**
("Changes in review" shows at the top of the Default store listing page).
Confirmed on screen 26 Aug, 11:30. Both uploads below are blocked by this —
it is not a broken button and there is no workaround. Wait for the review to
clear, then upload. Do not send Jacques round this loop again.

### 1. ⏳ Upload `07-chat.png` (optional)
The re-shot Friendly panel — header reads **Pro · 30/day**, footer **30 of 30
chats left**, caption says "in Pro". Add as panel 7; Play allows 8 and 6 are
used. Not urgent: nothing currently on the listing is untrue without it.

### 2. ⏳ Upload the new feature graphic (optional)
`screenshots/feature-graphic-1024x500.png`, rebuilt 26 Aug. The old one said
the app's name and nothing else — no category, no reason to install. The new
one adds: *"Addiction recovery, one day at a time — with a whole side for the
one who loves you."*

### 2b. ⏳ Store listing video — MADE, needs a YouTube upload
`content/store-video.mp4` — 26s, 1080x1920, a real screen recording of the live
app (not stills): day counter -> SOS sheet -> The Climb -> Tools -> Friendly ->
home, five captions, brand end card, scored.

Play's Video field takes a **YouTube URL only** - public or unlisted, ads off,
not age restricted. So: upload it to the channel as **unlisted**, then paste the
watch URL into Default store listing -> Video.

How it was built (for the next rebuild): Playwright `recordVideo` drives a
seeded Pro account against a local server, then captions are overlaid. NOTE:
this ffmpeg build has **no drawtext filter** - captions must be rendered as
transparent PNGs and overlaid, the same way `tools/make-film.py` does it.

### 3. ⏳ Content rating — confirm the user-interaction answers
**Policy and programs → App content → Content rating → Manage.**
Rooms means "users interact" and "users share content" must both be **Yes**
(moderation: yes, AI-checked before posting). Friendly is an AI, not a user —
not user-to-user; answer yes only to an AI-generated-content question.
If already answered that way, close the tab. Fixing it is not a release.

### 4. ⏳ Buy Pro on a real phone, from the live listing
Never tested. Closed testing is a different billing path. Install from Play,
buy, confirm days 16+ unlock and Friendly opens, cancel.

### 5. 🕐 Billing Library 8 — nothing to do until Google ships
**Fix by Oct 31 2026.** July item, extension **granted** (was Aug 30). The app
shipped to Production with the warning standing — it blocks only future `.aab`
uploads, never a release. Detail in `HANDOFF.md`. **Do not re-request the
extension and do not present it to Jacques as news.**

### 6. 🕐 Title keyword — decided against, revisit only if installs climb
`Turn Someday Into Day One` (25/30) carries no search term, and the title is
Play's heaviest ranking field. Kept anyway: that name is on the business cards,
the domain, the YouTube channel and the end card of every video. Splitting the
store name off from all of it to chase a head term he cannot win yet is a bad
trade. `Day One: Sober & Recovery` (25) is the alternative if he ever wants it.

---

## Remember the shape of this app

The Android build is a **TWA shell that loads the website**. Everything shipped
through Railway (`claude/vibe-code-uwxxlk`) reaches Play users with no new
bundle and no review — that is how v5.3, the letter invites and the new web
pages all reached users on launch day itself.

A Play upload is only needed for shell-level changes: billing library, icon,
package config, target SDK.

---

## Closed history (do not re-walk)

| What | When |
|---|---|
| App created, closed test running | 28 Jul |
| All 10 App content declarations | 28 Jul |
| Screenshots (first captioned set) published | 9 Aug |
| Data safety: Diagnostics unticked, 12 types ticked / 8 counted | 9 Aug |
| Health apps declaration — wellness group, personal account stands | 9 Aug |
| Closed testing complete — 38 testers vs target 15, day 16 of 16 | 14 Aug |
| Production access granted | Aug |
| IARC content rating live | 26 Aug |
| **Released to Production** | **26 Aug, 7:59 AM** |

App content declarations live under **Monitor and improve → Policy and
programs → App content → Actioned tab**, which is not where any documentation
says to look.

The "8 data types collected or shared" line is **not** a count of ticks —
ephemeral data is not "collected" in Play's sense. Twelve ticked, eight
counted. Reading that 8 as a tick count raised a false alarm on 9 Aug; do not
repeat it.
