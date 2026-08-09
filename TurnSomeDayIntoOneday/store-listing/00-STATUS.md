# Play Store — live status

**Read this first, before anything else in this folder.** It is the record of
what is actually done in Play Console, so nobody re-walks finished ground.

Last checked in the console: **9 Aug 2026**

---

## Done

| What | When | Note |
|---|---|---|
| App created, closed test running | 28 Jul | Track: alpha |
| Main store listing — title, short and full description | 28 Jul | |
| All 10 App content declarations | 28 Jul | Financial features, Health apps, Government apps, Advertising ID, Data safety, Target audience, Content ratings, Ads, Sign in details, Privacy policy |
| Android developer verification | — | Console confirms all apps registered ahead of the 30 Sep deadline |
| Screenshots replaced with the captioned set | **9 Aug** | Submitted, status *In review* |

The App content declarations were **already complete on 28 July**. Do not send
anyone back through that wizard looking for them — they live under
**Monitor and improve → Policy and programs → App content → Actioned tab**,
which is not where any documentation says to look.

---

## Open

### 1. Data safety says 8 data types. The audit says 9.

`03-data-safety-answers.md` was written **30 July** — two days *after* the form
was filled in. So the console holds whatever was decided on the 28th, not what
the audit later worked out.

The console summary reads *"8 data types collected or shared"*. Counting the
audit's list of collected types — Name, Email, Phone number, User IDs, Health
info, Photos, App interactions, Crash logs, Purchase history — gives nine. One
of them is missing and the summary doesn't say which.

The three worth checking specifically, because they are the ones that draw
enforcement and the ones most likely to have been skipped:

- **Health info** — the day counter, moods, journal text
- **Photos** — the profile picture, which does reach the server
- **Voice or sound recordings** — voice journaling, ticked as processed ephemerally

To check: App content → Data safety → **Manage**, and step through without
saving until the data-types checklist appears.

**Not urgent, but do it before production goes live.** Under-declaring here is
an enforcement action after launch, not a rejection now.

### 2. Health apps declaration — which category was picked

The console only says *"You told us about the health features in your app"*. It
does not show which category, and the category is the part that matters:

- **"Stress management, relaxation, mental acuity"** — correct, wellness group
- **"Mental and behavioural health"** — wrong, sits under **Medical**, which
  carries regulatory expectations and can require an **Organization account**.
  This account is a **Personal account** (confirmed on the console home page).

To check: App content → Health apps → **Manage**.

If it reads Mental and behavioural health, stop and say so — it changes the plan.

### 3. Production access — around 13 Aug

The closed test started **28 July**. Google wants 12+ testers for 14
consecutive days.

Answers are written and ready, with a copy button on each:
**https://claude.ai/code/artifact/27923b2f-74c7-4e92-a283-0c1e6dd7d2c9**

Do not use the answer sheet the testing provider sent. Two of its answers
describe work that does not exist.

---

## Corrections to the other files in this folder

- **Data deletion URL.** `03-data-safety-answers.md` describes the in-app route
  (Profile → Danger zone). The console has a dedicated field and it is already
  set to `https://www.turnsomedayintodayone.com/delete-account`, which is the
  right answer. Leave it.
- **Where App content lives.** Not "Policy and programs" at the top level, and
  not under Test and release. It is **Monitor and improve → Policy and
  programs → App content**.
