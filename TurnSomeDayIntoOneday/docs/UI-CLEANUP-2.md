# UI cleanup — part two

Continues `UICLEANUP.md` (8 Sep 2026). Same file, `TurnSomeDayIntoOneday/index.html`.

**Do not push. Commit and stop.** No pull request. All rules in `CLAUDE.md` and in the
first handoff still apply: no medical claims, never tell somebody they are finished, no
pronouns for a supporter's person, reply to Jacques short and plain. The lock rule has
changed — see section A.

---

## The one rule for this pass

**Every screen answers one question. Every row is a door to one place. Every subtitle
says what happens when you tap it.**

If two rows would need the same subtitle to describe them, they are the same row.

---

## A. The app is free. There is no Pro. — Jacques' call, 8 Sep

The whole app is free to everybody. **Friendly is not a paid feature any more, it is a
private one** — Jacques and people he grants access to. Nobody else sees it or is sold it.

**Money comes out of the app first, then the UI work in the rest of this file.**

### A1. Nobody is paying — Jacques confirmed, 8 Sep

There are no live customers to protect. **Delete the billing outright.** No report-first
step, no staging. Take it all out in one commit and list what you removed afterwards.

Out of the app: the Plans screen, every checkout entry point, the Stripe session routes,
the Play purchase verification, the entitlement checks, the Founding-50 cap and counter,
the distress upsell, every trial banner.

No subscription is running anywhere, his own test purchases included — confirmed 8 Sep.
Nothing to cancel, nothing to refund.

One thing Jacques does himself, outside the repo: deactivate the three products in the
Play Console and drop the in-app-purchases flag on the listing, so the store stops saying
the app sells something. Remind him of it in your reply.

### A2. What comes out of the app

- Plans screen, prices, the 7-day trial, Founding-50 counter and cap
- Every lock icon, Pro badge, upgrade prompt and paywall redirect
- Every day gate on lessons — every day of every track opens
- Pricing on the landing page and every marketing page in the repo
- The trial email sequence and its hourly scheduler — it emails people about charges
  that no longer exist

### A3. What Friendly becomes

Server-side allowlist. Not a client check — a client check means anyone can call
`/api/chat` directly.

- an environment variable on Railway, a list of emails
- `/api/chat` checks the signed-in email against it and returns 403 if it is not there
- adding somebody = Jacques edits the variable, no deploy of the app itself

**And hide it for everybody else.** A tab that most people cannot use is exactly the
clutter this cleanup is for.

- `bn-nova` comes out of the bottom bar unless the account is on the list. **The tab bar
  goes from five tabs to four: Today · Tools · The Fight · Profile.**
- the *Talk to Friendly* row on `s-relapse-toolkit` hides the same way
- the search index entry hides the same way
- no "upgrade to unlock" state anywhere — for a normal account Friendly does not exist

Report what the four-tab bar looks like before committing it.

### A4. Do not touch

The Railway config, the Play Console, and the Stripe account itself. Jacques closes those
down. Your job stops at the code.

Leave the welcome email, password reset and lead nurture working. Only the trial sequence
dies.

---

## 0. Rooms, and the four small fixes — do these first

**a. "For the one who loves you" is on two screens.** It is on Tools under LOOK BACK
and on `s-relapse-toolkit` under PEOPLE. That is exactly the duplication this cleanup
is for. **Keep it on Tools. Remove the toolkit row.** The supporter section is a place
you go and read, not something you reach for mid-craving.

PEOPLE then holds one row, so drop the heading and move *Talk to Friendly* up into
RIGHT NOW as the last item.

**b. Delete live Rooms. Jacques' call, 8 Sep.** Remove `s-rooms` and everything that
points at it:

- the Rooms row on Tools (READ AND LISTEN)
- the `TITLES` entry and the `SCREEN_TO_BN` entry
- the search index entry and its `go:()`
- any guided-tour step that names it
- **any paywall or upgrade copy that sells live rooms** — the Plans screen, the Pro
  comparison list, and anywhere else. Grep for "room" case-insensitive and report every
  hit before deleting, so nothing that mentions rooms is left advertising them.

Then check `s-community`. If Rooms was the only thing in it, it is now an empty screen
with no door — say so and it goes too. If something else lives there, list what.

**Paywall copy that mentions rooms is covered by section A — it is all coming out.**

**c. One room: the Meditation room.** **This is already built — do not rebuild it.** The
row, the sheet and the three options all shipped last session. This is a rename and one
deletion, nothing more. Jacques' name, 8 Sep — use it exactly.

With live Rooms deleted, the Meditation room is the only thing in the app called a room,
so the old name collision is gone.

- On `s-relapse-toolkit`, the row *Breathe with me* becomes **Meditation room**, subtitle
  *Pick how long you have*. Same position, first block.
- The picker sheet `#breathe-pick` (~line 2185) stays exactly as it is — three options,
  three functions, no change to `breathe()`, `openWave()` or `openMeditation()`:

      Calm down    about a minute      → breathe()
      Ride it out  three minutes       → openWave()
      Sit quiet    five to fifteen min → openMeditation()

- Retitle the sheet header to *Meditation room*. The sheet's markup, its three options
  and `openBreathe()` / `pickBreathe(k)` / `closeBreathe()` are untouched.
- **Remove the separate Meditation room entry from `PRO_TOOLS`** so there are not two
  doors to the same place. The room is now reached one way: the toolkit row → the sheet.
  Leave the key and the `open:` string alone if anything else calls them — check first
  and say what you found.
- Update the search index so "meditation", "breathe", "breathing", "quiet", "wave",
  "calm" and "grounding" all land on the Meditation room.

So: two labels and one registry row. That is the whole job.

**d. Locks — superseded by section A above.** There is no Pro. Nothing in the app is
locked. What follows is kept only because it names the places to check.

**Old note:**

Everything else in the app is free. Every lesson day of every track, every tool, the
journal, insights, reminders, the supporter side, stories, the Climb, Meditation room —
free, with no day limit and no gate.

This is not new policy, it is the `CLAUDE.md` rule with rooms taken out: *free tier is
everything except Friendly chats; never put a lock on anything else; never advertise a
lesson day as paid.*

Do this:

- Grep the whole file for every lock icon, `isPro` / `hasPro` check, upgrade prompt,
  "Pro" badge and paywall redirect. **List every hit with its line number before
  changing anything.** Say which screen each one sits on.
- Every one that is not Friendly comes out.
- Any day gate on lessons comes out — check the pack and lesson screens especially, and
  check `PRO_TOOLS` for lock badges on Sit quiet, Urge Surfing Timer, Panic Mode,
  Distraction Generator, Accountability Reminders and the recovery scripts.
- The Plans screen and any Free-vs-Pro comparison get rewritten around one line: Pro is
  Friendly. Do not pad the list back out to look fuller.

**Do not change prices, the trial, Stripe, or the Play products.** Those stay exactly as
they are. This is about what is locked, not what it costs.

The website and the Play Store listing are outside this repo. If either still sells Pro
as a list of features, flag it for Jacques in your reply — do not try to fix it here.

**e. Confirm every icon on the new rows against the Tabler list** at the bottom of
`UICLEANUP.md`. Six were wrong last pass.

---

## 1. Today (`s-home`)

**Today answers three questions and nothing else:**

1. Where am I? → day count, the Climb
2. What do I do today? → today's lesson, the check-in
3. What if I'm not okay right now? → one button to *When it's hard*

Method:

- List every block on `s-home` with its line numbers.
- For each one, mark it **KEEP**, **MOVE** (name the screen), or **CUT** (name the row
  that already does it).
- Anything that reflects backwards — patterns, milestones, film, reports — is Progress,
  not Today.
- Anything that is a library or a list of things to browse is Tools.
- Aim for **three blocks and no more than one scroll** on a phone.

Post the KEEP/MOVE/CUT list before editing anything. Do not touch `renderMilestones()`
or the `#home-milestones` id.

---

## 2. Profile (`s-profile`)

Nine headings for ~240 lines, and Settings alone carries 14 mixed rows. Rebuild the
screen as **seven headings**, in this order:

    YOU              Name and photo · Focus areas
    REMINDERS        (every reminder and notification row, together)
    HOW IT LOOKS     Dark mode · Text size
    PRIVACY          App lock · Discretion mode
    HELP             How to use this app · Contact us · FAQ
    ABOUT            Version and updates · Diagnostics · Privacy policy · Terms
    ACCOUNT          Erase my history · Delete my account

Notes:

- *How to use this app* is help, not a setting. It sits under HELP.
- Personalize and Focus areas collapse into YOU. **Subscription is gone entirely** —
  see section A. If an account has a live subscription, that is handled outside the app.
- App updates, Diagnostics and About collapse into ABOUT.
- ACCOUNT stays last and stays visually separated — the delete row has to remain easy
  to find, it is a Play requirement.
- If a row does not fit one of the seven, it is probably a duplicate. Flag it, do not
  invent an eighth heading.

---

## 3. Progress (`s-progress`)

Six sections after the last pass. Collapse to **two**:

    HOW FAR YOU'VE COME    The Climb · Milestones · Share my milestone · Your film
    WHAT WE'VE NOTICED     Patterns and weekly reports · Insights

If Insights and *Patterns and weekly reports* show the same numbers, they are one row.
Check before keeping both.

---

## 4. The copy pass

The subtitles are where "everything sounds the same" actually lives. Rules:

- Seven words or fewer.
- Say what happens on tap, not what the feature is about.
- No two subtitles on one screen may start with the same verb.
- Banned openings: *helps you*, *tools to*, *a guided*, *designed to*, *your journey*,
  *learn about*.
- No mechanism, no body, no brain, no "research", no promise of an outcome.

Use these. They are approved copy — paste them as written.

**Tools**

| Row | Subtitle |
| --- | --- |
| When it's hard | Right now, one screen |
| Craving tracker | Note the urge, watch the pattern |
| Journal | Write it down |
| Lesson Library | Every day, every track |
| Stories | Other people, same fight |
| Withdrawal timeline | Where you are in the first weeks |
| Progress | Days, patterns, milestones |
| For the one who loves you | Their side of the app |

**When it's hard** (`s-relapse-toolkit`)

| Row | Subtitle |
| --- | --- |
| Talk me through it | A voice, step by step |
| Meditation room | Pick how long you have |
| 5-4-3-2-1 grounding | Name what is around you |
| I'm triggered | Say what set it off |
| I slipped | Start the next hour |
| Your emergency plan | Written before you needed it |
| What to say | Lines for the hard conversation |
| Daily check-in | Two minutes, once a day |
| Talk to Friendly | Someone awake at 2am | *(only shown to allowlisted accounts)*

**Progress**

| Row | Subtitle |
| --- | --- |
| The Climb | Your steps up the mountain |
| Milestones | The days that counted |
| Share my milestone | Make a card to send |
| Your film | Your months, cut together |
| Patterns and weekly reports | What your week looked like |

---

## Order of work

1. Section A — strip the billing, wire the Friendly allowlist, drop to four tabs.
2. Section 0 — Rooms, the Meditation room rename, the duplicate row, the icons.
3. Today — post the KEEP/MOVE/CUT list, wait, then edit.
4. Profile.
5. Progress.
6. Copy pass across all four screens.
7. Screenshots with `scratchpad/shots.js`, add `s-home` and `s-profile` to the shot list.

Commit after each numbered step. **Do not push.**
