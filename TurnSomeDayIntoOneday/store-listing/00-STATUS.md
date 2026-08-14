# Play Store — live status

**Read this first, before anything else in this folder.** It is the record of
what is actually done in Play Console, so nobody re-walks finished ground.

Last checked in the console: **9 Aug 2026** · answers refreshed **14 Aug 2026**

---

## Done

| What | When | Note |
|---|---|---|
| App created, closed test running | 28 Jul | Track: alpha |
| Main store listing — title, short and full description | 28 Jul | |
| All 10 App content declarations | 28 Jul | Financial features, Health apps, Government apps, Advertising ID, Data safety, Target audience, Content ratings, Ads, Sign in details, Privacy policy |
| Android developer verification | — | Console confirms all apps registered ahead of the 30 Sep deadline |
| Screenshots replaced with the captioned set | **9 Aug** | **Published** — console confirms last published 9 Aug |
| Data safety: Diagnostics unticked | **9 Aug** | Submitted for review |

The App content declarations were **already complete on 28 July**. Do not send
anyone back through that wizard looking for them — they live under
**Monitor and improve → Policy and programs → App content → Actioned tab**,
which is not where any documentation says to look.

---

## Open

### 1. Data safety — CHECKED 9 Aug, nothing missing

The form was walked through in the console. Twelve data types are selected and
every category that should be empty is empty:

| Category | Selected | Expected |
|---|---|---|
| Location | 0 / 2 | 0 |
| Personal info | 4 / 9 | Name, Email, Phone number, User IDs |
| Financial info | 1 / 4 | Purchase history |
| Health and fitness | 1 / 2 | Health info |
| Messages | 1 / 3 | Other in-app messages (ephemeral) |
| Photos and videos | 1 / 2 | Photos |
| Audio files | 1 / 3 | Voice or sound recordings (ephemeral) |
| Files and docs, Calendar, Contacts, Web browsing, Device IDs | 0 | 0 |
| App activity | 1 / 5 | App interactions |
| App info and performance | **2 / 3** | Crash logs — see below |

**The "8 data types collected or shared" line on the summary page is not a
count of ticks.** It counts a narrower thing — data processed ephemerally is
not "collected" in Play's sense. Twelve ticked, eight counted. Reading that 8
as a tick count is what raised a false alarm here on 9 Aug; do not repeat it.

**Tidied 9 Aug.** App info and performance had both Crash logs and Diagnostics
ticked. Diagnostics means battery life, loading time, latency and framerate,
none of which is recorded anywhere — `error_log` holds server errors, which is
crash logs. Diagnostics unticked and the change submitted for review. The
category now reads 1 of 3.

### 2. Health apps declaration — RESOLVED 9 Aug

Nothing in the **Medical** group is ticked — confirmed by Jacques in the
console. So the declaration sits in the wellness group, no regulatory
expectations are triggered, and the **Personal account** stands. Nothing to do.

The disclaimer still has to stay as the first paragraph of the full
description, because there is no regulatory clearance. See
`04-health-declaration.md`.

### 3. Production access — REQUIREMENT MET 14 Aug, answers current

**Closed testing is finished: day 16 of 16, 0 days remaining, 38 testers
against a target of 15, both reports delivered.** The 12-testers-for-14-days
requirement is satisfied. Nothing is blocking the application.

Answers are written and ready, with a copy button on each:
**https://claude.ai/code/artifact/27923b2f-74c7-4e92-a283-0c1e6dd7d2c9**

**Rewritten 14 Aug** and now current — it previously said "the current build is
5.1.0" when the app is on **5.5.0**, which was the one checkable falsehood in
it. Question 8 also gained the five fixes that came out of Jacques walking the
whole app on his own phone (voice journaling cutting off, the back button
closing the app, tools buried in Profile, the couples dead end, the free tier),
and question 3 now says 38 testers rather than twelve.

**Do not use the answer sheet the testing provider sent.** Its question 8 claims
a first-run walkthrough and Google Sign-In. Verified 14 Aug: the app has
**neither** — login is email/password, zero Google Sign-In in the codebase. Only
the screenshots claim is true. Google can check this.

---

## Corrections to the other files in this folder

- **Data deletion URL.** `03-data-safety-answers.md` describes the in-app route
  (Profile → Danger zone). The console has a dedicated field and it is already
  set to `https://www.turnsomedayintodayone.com/delete-account`, which is the
  right answer. Leave it.
- **Where App content lives.** Not "Policy and programs" at the top level, and
  not under Test and release. It is **Monitor and improve → Policy and
  programs → App content**.
