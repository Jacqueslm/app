# HANDOVER — 26 August 2026

**For the next AI session. Read this, then `START-HERE.md` and
`MASTER-STATUS.md` in the repo. Do not make Jacques re-explain any of it.**

---

## The headline

**Turn Someday Into Day One went live on Google Play today at 7:59 AM.**
Production, full rollout, 177 countries, 20,237 devices,
`com.turnsomedayintodayone.app`. Eight installs, still on the July test build.

The launch is closed. Closed testing, production access, data safety, health
declaration and IARC rating are all done. Do not re-open any of them.

---

## Read this before you touch the version number

The app is on **v5.6**. Older notes in START-HERE say v8.13 — that is a
different lane's numbering and is not what the app reports. Jacques reset the
line to 5.0 on 25 Aug.

`grep APP_VERSION TurnSomeDayIntoOneday/index.html` is the only source of truth.

Every ship bumps the quadruple — `APP_VERSION`, `sw.js` CACHE_NAME, and both
`package.json` files — then goes to all three branches.

---

## What shipped today

**v5.3 — the letter is the invitation.** Nobody installs a recovery app because
a friend asked. They open a letter because somebody they love wrote it. Both
letters now mint a private, expiring link; the reader sees the letter first,
then one tap creates their account on the opposite side and links the two
Together tables server-side. No code is ever typed.

**v5.4 — text follows the Android font-size setting.** All 638 font sizes in
the app were in px, so the OS accessibility setting did nothing whatsoever.
All converted to rem. Pixel-identical at default, scales properly now.

**v5.5 / v5.6 — a one-time Play rating ask** after the day-7+ lesson, plus two
bug fixes on it that Jacques caught on a real screen.

**Website:** four thin pages rebuilt (two were quizzes whose whole content sat
inside `display:none` — a crawler saw nothing), three new pages, and every
YouTube video finally embedded on its matching page. Also fixed a crisis
helpline whose tap-to-call link dialled a different number than the one shown.

**Play listing:** the live description contained zero instances of recovery,
sober, addiction or quit. Rewritten with them. New short description. New
screenshots, new feature graphic, developer name changed off Jacques's own name.

---

## Two mistakes today. Do not repeat them.

**1. Work was called finished before it was checked against its purpose.**
The store description was confirmed live in the morning. Hours later a keyword
audit found it carried none of the words it exists to carry, and Jacques had to
paste a second version over the first. He said, fairly: *"you got me going in
circles giving me bad advice."*

**2. A real feature was removed to fix a misleading caption.**
The Friendly screenshot said "An AI companion at 3am" without saying it is Pro.
The fix was the caption. Removing the screenshot hid the main reason anybody
buys Pro. He pushed back and he was right.

---

## How to work with him

- **He is not a developer.** Give one instruction at a time. When he says
  "step by step" or "too much", stop listing and name the single next click.
- **He catches real bugs from screenshots.** Both v5.6 fixes came from him
  looking at one image. Take it seriously when he says something looks wrong.
- **Do not tell him to post more.** He has heard it, he rejects it, and he is
  right: nobody follows a recovery account publicly. Search and human referral
  are the channels.
- **PDFs, not markdown** (rule one). And put the answer in the chat, not only
  in a file (rule three).
- **Files often fail to reach him through chat.** When something has to change
  hands, publish it to a page he can open and save from.
- **Show new features before shipping them** (house rule 24). Bug fixes he
  reported ship immediately.

---

## What is actually open

Nothing urgent. Nothing with a deadline this week.

1. **Two optional Play uploads** — the re-shot Friendly panel and the new
   feature graphic. Both are in the repo under `store-listing/`.
2. **A store listing video exists** — `content/store-video.mp4`, 26s, a real
   screen recording. Play's Video field takes a YouTube URL only, so it needs
   uploading to the channel first.
3. **Content rating** — confirm the two user-interaction questions say Yes
   (Rooms lets people post and read each other's writing).
4. **Buy Pro on a real phone.** Never tested on the live billing path. His own
   account is comped, so it needs a second email.
5. **Billing Library 8** — Oct 31. The extension was granted. The fix does not
   exist on Google's end yet. Do not present this as news; it is a July item.
6. **A15 and A16** — two Cause & Effect videos fully scripted in `AI-SCENES.md`
   but not built, because the source images never reached disk.

---

## The honest picture on traffic

Ten signups. Eight installs. Roughly 10–15 search impressions a day, up from
zero four weeks ago. Indexed pages went 13 → 32 across August.

That is what week four looks like. It is not a failure and it is not yet a
business. The moat is real and it is the family: zero of 160 recovery apps on
the Play Store serve the wife, the husband, the mother. Every page and every
video that leans into that is playing on an empty shelf. Everything that
competes on "addiction" head terms is a fight against treatment chains with
medical review boards, and it will lose.
