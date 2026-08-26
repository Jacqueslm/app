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

## Open — the whole list, 26 Aug 2026

### 1. ✅ DONE — full description is live (confirmed 26 Aug)
`02-full-description.md`, the text between the fences. 3,768 of 4,000
characters. **Play Console → Main store listing → Full description.**

**Confirmed in the console 26 Aug:** the character counter reads 3768/4000,
matching this text exactly, and the visible ending matches word for word. The
corrected, post-audit description is live. Nothing to do.

**The first paragraph is not optional.** Play rejects updates from
non-regulated health apps that bury or drop the "not a medical device" line.

### 2. ⏳ Content rating — confirm the user-interaction answers
**Policy and programs → App content → Content rating → Manage.**

The IARC rating went live 26 Aug (Global Rating ID
`d0b9a237-57f4-80e0-88d0-3f837bdfd04f`). IARC's terms require the answers to
account for **all** content in the app, and this app has two things the
questionnaire asks about:

- **Rooms** — users post and read each other's writing. "Does the app allow
  users to interact?" and "Can users share content?" must both be **Yes**.
  Moderation follow-up: yes — every post is held and AI-checked before it
  appears, with report and ban paths.
- **Friendly** — an AI, not another user, so it is **not** user-to-user
  interaction. If there is an AI-generated-content question, answer **yes**
  for Friendly.

If they are already answered that way: close the tab, nothing to do.
If not: fix and resubmit the questionnaire. That is **not** a release. Nothing
live is touched and nothing re-enters review.

### 3. ⏳ Upload the refreshed screenshots
`screenshots-captioned/` — six 1080×1920 panels, rebuilt 26 Aug.
**Main store listing → Phone screenshots.** Replace all, keep the order.

| # | File | Caption |
|---|---|---|
| 1 | `01-home.png` | Every sober day, counted |
| 2 | `02-sos.png` | One tap when the craving hits |
| 3 | `03-climb.png` | **NEW** — Ninety steps, at your pace |
| 4 | `04-lessons.png` | A new lesson every day |
| 5 | `05-journal.png` | Write it down, keep it private |
| 6 | `06-progress.png` | Progress that never resets |

**The Friendly panel was removed on purpose.** Friendly is Pro-only now (zero
free chats). A store screenshot captioned "An AI companion at 3am" implies it
is included, which is exactly the oversell the 24 Aug tier audit went through
the entire product to remove. The Climb took the slot: it is free, it is new,
and no competitor in the category has anything like it.

Also refreshed: the lesson caption now says "listen in a real voice" (six
narrators shipped, including Jacques reading all ninety days), and the journal
caption is now the privacy promise rather than a feature description.

### 3b. ⏳ Re-capture the Friendly screenshot, then add it back
`screenshots/05-chat.png` is from 9 Aug and shows **"Free · 3/day"** and
**"3 free sessions left today"** on screen. Friendly has had zero free chats
since v8.12, so the picture is untrue, not just the caption.

Removing it entirely (first pass, 26 Aug) was the wrong fix — Jacques pushed
back and he was right. Friendly is a real feature and the main reason anyone
buys Pro; hiding it sells nothing. The fix is a fresh capture from a Pro
session plus an honest caption that says "in Pro". The panel is written and
commented out in `make-captioned-screenshots.py` — re-enable it once the source
is re-shot. Play allows 8 panels and only 6 are used, so it costs nothing.

### 4. ⏳ Buy Pro on a real phone, from the real listing
Never done. Closed testing is not the same billing path as a live Production
listing. Install from Play, buy Pro, confirm days 16+ unlock and Friendly
opens, then cancel. Better that Jacques finds a broken purchase than a
stranger does.

### 5. 🕐 Billing Library 8 — nothing to do until Google ships
Console says **fix by Oct 31 2026**. This is the July policy item; the
extension was **granted** (it originally said Aug 30). The app shipped to
Production with the warning standing, which proves it blocks only future
`.aab` uploads, never a release.

The fix does not exist yet: the shell pulls its billing library from
`androidbrowserhelper:billing`, newest published is 1.1.0, and forcing
BillingClient 8 crashes at purchase time. Full detail and the exact steps in
`HANDOFF.md`. **Do not re-request the extension and do not present this to
Jacques as news.**

### 6. ✅ Nothing else
Title, short description, feature graphic, data safety, health declaration,
privacy policy, developer verification — all done and live.

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
