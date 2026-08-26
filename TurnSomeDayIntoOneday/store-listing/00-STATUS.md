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

### ✅ 1 + 2. Both uploads DONE — Jacques, 26 Aug 2026
**"uploads are done."** The review cleared and both went up:
- `07-chat.png` — the re-shot Friendly panel (header **Pro · 30/day**, footer
  **30 of 30 chats left**, caption says "in Pro"), added as panel 7.
- `screenshots/feature-graphic-1024x500.png` — the rebuilt feature graphic that
  says what the app is, not just its name.

**Do not ask him to upload either again, and do not re-check the console for
them.** The earlier note here said Google greys out the asset Upload button
while a submission is in review — that was true at 11:30 on 26 Aug and is now
history, not a live blocker.

### 2b. ✅ Store listing video — DONE
`content/store-video.mp4` — 26s, 1080x1920, a real screen recording of the live
app (not stills): day counter -> SOS sheet -> The Climb -> Tools -> Friendly ->
home, five captions, brand end card, scored.

**Jacques confirmed 26 Aug 2026: the video is done.** It is on the channel and
the listing's Video field is handled. Do not ask him to upload it again.

(For reference only, if it is ever replaced: Play's Video field takes a
**YouTube URL only** - public or unlisted, ads off, not age restricted.)

How it was built (for the next rebuild): Playwright `recordVideo` drives a
seeded Pro account against a local server, then captions are overlaid. NOTE:
this ffmpeg build has **no drawtext filter** - captions must be rendered as
transparent PNGs and overlaid, the same way `tools/make-film.py` does it.

### 3. ✅ Content rating — DONE 26 Aug 2026. New questionnaire submitted.

**Jacques re-did the whole IARC questionnaire on 26 Aug, saved it, and sent it
for review.** Fully closed. Do not re-walk it and do not ask him to check it
again.

**READ THIS BEFORE YOU EVER "AUDIT" THE CONTENT RATING AGAIN.**
The IARC **Summary does not display the User Content Sharing answers.** Earlier
today this file claimed the interaction questions had been answered No, because
they were absent from the July summary. That conclusion was wrong — absence from
the summary proves nothing. It was disproved on screen: User Content Sharing was
set to **Yes**, and the summary still showed no interaction line. Never infer
those answers from the summary again.

**Where the button is:** Content ratings → **Start new questionnaire**, a blue
button at the **top right**, above "Your current ratings". It is not at the
bottom of the page.

**The answers, so nobody re-derives them.** A new questionnaire starts blank —
nothing carries over from the previous one.

| Section | Answer |
|---|---|
| Category | All Other App Types |
| Downloaded App | Yes |
| Violence / Fear / Gambling / Crude Humor | No |
| Sexuality | Yes → Suggestive/Sexual Themes → *References to sexual activity without descriptive detail* |
| Language | **No** — verified in code: the only profanity in the repo is the Rooms blocklist at `index.html:7890` |
| Controlled Substance | Yes → Illegal/Recreational **Reference**, Medical **Reference**, Alcohol **Reference + Often**, Tobacco **Reference + Often**. Not Fantasy Drugs. No "Use", no "Encourages/Glamorizes". |
| **User Content Sharing** | **Yes** — Rooms is native in-app text between users |
| ↳ UGC the primary source of content? | No |
| ↳ Public sharing of nudity / graphic violence? | No — Rooms is text only |
| ↳ Block users or content? | **No** — verified: no block/mute/ignore exists anywhere in the app |
| ↳ Report users or content? | **Yes** — `index.html:7969` `reportPost()`; line 7791 "two reports hide a post until a human reviews it" |
| ↳ Chat moderation? | **Yes** — `index.html:2571` a moderator reads every post before the room sees it |
| ↳ Limited to invited friends only? | No — no friends-only mode exists |
| Online Content | **Yes** — the app is a TWA that loads the website, embeds YouTube, and Friendly generates AI content |
| ↳ Is this content the focus? | No |
| ↳ Visual depictions of illegal/recreational drugs? | Yes |
| ↳ Referred to in text or spoken? | Yes |
| Promotion or Sale of Age-Restricted Products | No — the app helps people quit, it does not promote or sell |
| Miscellaneous — shares precise location with other users? | No |
| Miscellaneous — allow users to purchase digital goods? | **Yes** — Pro |
| ↳ Loot boxes / chance-based purchases? | No |
| ↳ Cash rewards, crypto, NFTs? | No |
| ↳ Web browser or search engine? | No |
| ↳ Primarily a news or educational product? | No |

**Two traps found while doing it, both caught before saving:**
1. A fresh questionnaire silently answers the later sections **No**. The first
   pass dropped Online Content, the Controlled-Substance access lines and
   "Can purchase digital goods" — all of which the July certificate carried.
   Saving that would have made the certificate *less* accurate than before.
   **Always compare the new Summary against the previous certificate before
   saving.**
2. "Medical drugs" frequency defaulted to **Often**; July recorded **Rarely**.
   It does not change the resulting ratings either way.

**Ratings are unchanged by this pass:** ESRB Teen / 14+, PEGI 12, USK 12,
IARC 12+, ClassInd 14.

### 4. ⏳ Buy Pro on a real phone, from the live listing
Never tested. Closed testing is a different billing path. Install from Play,
buy, confirm days 16+ unlock and Friendly opens, cancel.

### 5. ✅ Billing Library 8 — CLOSED, already updated
**Jacques, 26 Aug 2026: "it's already updated, no extension."** The shell is on
a current Billing Library. There is no Oct 31 deadline — the extension that was
granted was the **Android 16 target-SDK** one (31 Aug → 1 Nov). The app shipped
to Production with the console warning standing, which proves it never blocked a
release. Detail in `HANDOFF.md`. **Do not request an extension, do not plan a
rebuild for it, and do not present it to Jacques as news.**

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
