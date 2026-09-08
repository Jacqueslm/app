# UI cleanup — handoff

**Date:** 8 Sep 2026
**File:** `TurnSomeDayIntoOneday/index.html` (single file, ~15k lines)
**State:** part done, **committed but not pushed**. Read "What is done" then "What is left".

Jacques' words: *"a lot of things are hidden in something else… breathe with me, the
meditation, those things repeat in the recovery toolkit… a lot of stuff is saying the
same thing."*

---

## The problem, measured

Tools had **15 rows**. Five were doors to places that already had their own door:

| Row on Tools | Also reachable from |
| --- | --- |
| The Fight of Your Life | its own bottom-tab |
| The Climb | Today, and the end of a lesson |
| Insights & reports | a section inside Progress |
| Share my milestone | a section inside Progress |
| Rooms | inside Community |

Four rows in the Recovery Toolkit were four names for *sit down and breathe*:
Breathing exercise, Ride the wave, Meditation room, and Panic Mode (whose first
screen is a breathing coach).

The red SOS button opened a sheet that repeated five rows already on the toolkit
screen underneath it.

Three headings on Tools covered exactly one row each, and one heading was empty.

---

## What is done

All in `index.html`, one commit, **not pushed**.

**Tools — 15 rows down to 11**, three headings that each mean something:

    WHEN YOU NEED IT   When it's hard · Craving tracker · Journal
    READ AND LISTEN    Lesson Library · Stories · Rooms · Withdrawal timeline
    LOOK BACK          Progress · For the one who loves you

**`s-relapse-toolkit` renamed** in the UI to *When it's hard* (`TITLES` map,
~line 12400 — the screen id is unchanged, don't rename it, it is referenced in
`SCREEN_TO_BN`, the guided tour and the search index). Now one list:

    RIGHT NOW              Talk me through it · Breathe with me · 5-4-3-2-1
                           grounding · I'm triggered · I slipped
    KEEP FOR THE HARD DAYS Your emergency plan · What to say · Daily check-in
    PEOPLE                 Talk to Friendly · For the one who loves you

The red SOS button and the Tools row both land here now, instead of a sheet that
repeated the screen behind it.

**Breathe with me** is one row that opens a small sheet asking how long you have:

    Calm down    about a minute      → breathe()
    Ride it out  three minutes       → openWave()
    Sit quiet    five to fifteen min → openMeditation()

`openBreathe()` / `pickBreathe(k)` / `closeBreathe()`, ~line 9356. The sheet markup
is `#breathe-pick`, ~line 2185.

**Progress** picked up what Tools was holding: The Climb, Your film,
Patterns & weekly reports, Share my milestone — under a heading
*See how far you have come*.

**Six icon names were wrong** and rendered as blank space (`ti-books`,
`ti-messages`, `ti-heart-handshake`, `ti-script`, `ti-report-analytics`, `ti-id`).
The app only ships the icons listed at the bottom of this file. **Check any new
icon against that list.**

### Nothing was deleted

Urge Surfing Timer, Panic Mode, Distraction Generator, Accountability Reminders,
Category-Specific Recovery Scripts and Meditation room all still exist and still
work. They lost their duplicate row, not their function:

- every one is still in the `PRO_TOOLS` registry (~line 11862) and still opens
  through `openProTool('key')`
- the search index (~line 14300, *Profile → Find anything*) still finds them

---

## What is left

Roughly in the order worth doing.

**1. Today (`s-home`) has not been touched.** It is the screen people open first
and it is the longest. Same treatment: list what is on it, find what repeats
elsewhere, group the rest.

**2. Profile (`s-profile`) is ~240 lines and one long run of rows.** Headings
exist (Personalize, Subscription, Focus areas, Help, Settings, Danger zone, App
updates, Diagnostics, About) but Settings alone carries 14 rows mixing
reminders, dark mode, text size, app lock, discretion mode and "How to use this
app". Wants splitting.

**3. `s-progress` now has six sections** and is getting long — worth a look
after Today.

**4. The empty-state and copy pass.** Jacques' other note was *"a lot of stuff is
saying the same thing"* — the subtitles. Several rows describe themselves in
near-identical language. Read every `<span>` under a `<p>` on Tools, the toolkit
and Progress out loud, one after another, and cut the repeats.

**5. Screenshots.** `scratchpad/shots.js` (Playwright, headless Chromium) walks the
app past the sign-in gate and shoots Tools, the toolkit, the Breathe sheet and
Progress. It seeds `localStorage.tsid_v2` with a day-34 account. Reuse it — it is
the fastest way to see a change. Serve with:

    node /opt/node22/lib/node_modules/http-server/bin/http-server \
      /home/user/app/TurnSomeDayIntoOneday -p 4311 -s

---

## Rules that apply to this work

From `CLAUDE.md`, they are not negotiable:

- **Never push.** Commit and stop. Jacques says when to push, and then it goes to
  `claude/new-session-im7bzg`, `main`, `claude/vibe-code-uwxxlk` — all three, same
  commit, after merging `origin/main`.
- **Never open a pull request** unless he asks.
- Free tier is everything except Friendly chats and the live rooms. **Never put a
  lock on anything else**, and never advertise a lesson day as paid.
- No medical claims. No "research shows", no brain chemistry, no mechanisms.
- It can end a fight, a floor, a day. **It can never tell somebody they are
  finished.** There are tests on this.
- Never blame the person struggling to comfort the supporter, or the other way round.
- **No pronouns** for a supporter's person. Swept for "her"/"she" on 31 Aug — do
  not reintroduce them.
- Reply to Jacques short and plain. He is not a developer.

---

## Reference

**Screen ids** (`<div id="s-…" class="scr">`): home, nova, journal, craving,
lesson-library, rooms, community, timeline, lesson, progress, relapse-toolkit,
reminder-settings, insights, stories, tower, tools, pack-list, pack-lesson, plans,
profile, partner.

**Bottom tabs:** Today · Tools · The Fight · Friendly · Profile
(`bn-home`, `bn-tools`, `bn-game`, `bn-nova`, `bn-plans`). `SCREEN_TO_BN` ~line
12401 decides which tab lights up for a screen — update it if you move a screen.

**Icons that exist** (Tabler subset, `ti ti-…`). Anything else renders blank:

    activity alert-triangle arrow-left arrow-right arrows-maximize award backspace
    bell book building chart-dots chart-line check chevron-down chevron-right
    circle-filled clock cloud coin compass devices download eye eye-off file-text
    flame glove hand-stop handshake headphones heart help home info-circle key
    lifebuoy lock logout message-2 message-circle microphone moon moon-stars
    mountain movie notebook pencil phone player-pause player-play player-skip-back
    player-skip-forward player-stop refresh ripple seedling send share shield
    sparkles star sun-high text-size user-circle users volume volume-off wind x

**Things that break if you are careless:**

- `TITLES` (~12400) — the header text per screen.
- `SCREEN_TO_BN` (~12401) — which tab highlights.
- The guided tour (~5046) targets `#bn-tools` and names screens by id.
- The search index (~14300) has a `go:()` for each entry — if you move a screen,
  fix its `go`.
- `PRO_TOOLS` (~11862) — `open:'fnName'` strings are called by name.
- `renderMilestones()` (~5740) writes into `#home-milestones`. That element moved
  to Progress; it is still found by id, but do not delete the id.
