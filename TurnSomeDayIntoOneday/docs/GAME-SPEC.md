# GAME-SPEC.md — "2AM"

The recovery game for Turn Someday Into Day One.
Built on top of The Climb. Not a separate app — a new tab inside the existing PWA.

**Working name:** 2AM (from the landing H1: "You don't quit at noon. You quit at 2am.")

---

## Core idea in one sentence

You climb a 90-floor building at night. Every floor is a day. Every floor asks you
to either tell the truth or do the dare, and some floors trap you in an urge you
have to survive before the door opens.

---

## Non-negotiable rules (do not break these)

1. **No character at all.** Corrected by Jacques 30 Aug 2026: the sixth reference
   was **Roblox**, not "robot". There was never meant to be a guide. Friendly is
   not in this game either — it lives in the rest of the app and stays there. The
   floor's line is unattributed. Nothing in the tower talks to you.
2. **Unbiased.** The game never blames the addict to comfort the supporter, or
   blames the supporter to comfort the addict.
3. **No medical claims.** No brain-chemistry language, no "research shows."
4. **No relapse punishment.** Relapse drops you to the last landing (floors 10, 20,
   30...). It never resets to zero. Same rule as The Climb.
5. **Free tier gets floors 1–10.** Pro unlocks 11–90. Android build stays free-tier
   only per existing gating.
6. **No new dependencies.** HTML5 canvas + vanilla JS inside the existing
   Node/Express PWA. No Unity, no Phaser, no game engine, no app store rebuild.

---

## The six mechanics (mapped from the reference list)

### 1. TRUTH or DARE — the choice at every floor
Each floor presents a locked door with two keys.

- **TRUTH** — one blunt question about the player's own habit. Private, stored
  locally, feeds the Insights screen. Example: "What time did you almost lose it
  last night?" Answering unlocks the door.
- **DARE** — one real-world action with a timer. Examples: text one person the word
  "hey"; delete one app off the home screen; stand outside for 60 seconds; put the
  phone in another room for 10 minutes. Player marks it done.

Player picks one. Both unlock the floor. Truth is the safe path; Dare is worth more
progress. This is the adventurous layer.

### 2. URGE WAVE — the Simon-says layer  ✅ BUILT (30 Aug 2026)
Stands between the player and the door on floors 4, 7 and 10 — "~1 in 4 floors,
and always on floors ending in 0". Declared per floor rather than rolled at
runtime: a trap that appears at random is unfair, and a random trap cannot be
tested. Survive it once and the floor remembers.

A pattern of 3 pulses plays across four pads; the player taps it back. Each
round they get right makes the next pattern one longer, to a maximum of 7.
Getting one wrong restarts the sequence at 3 and ends nothing.

**The one rule that must never be "improved":** nothing the player does moves
the clock. The wave runs a fixed 90 seconds and breaks on its own whether they
play every round perfectly, fail every one, or put the phone down and stare at
the wall. Winning a round buys a longer pattern and not one second. The pads
are something to do with your hands while it passes, not a way to beat it.
Six tests exist purely to stop someone later rewarding a good round with time
off, or ending the wave early on a fail.

The whole curve — including the part that has not happened yet — is drawn from
the first second, so the player can see it stop before they get there. A bar
that only filled in behind them would hide exactly what the mechanic teaches.

Each pad carries its own shape (circle, square, diamond, triangle), so the
pattern is readable as shapes and not only as which square lit up.

When it breaks: *"It would have broken if you had played every round, and it
would have broken if you had put the phone down and stared at the wall. Ninety
seconds either way."*

Walking off the screen mid-wave does not bank it. It runs again next time.

### 3. TONE — the Call of Duty layer  (briefings ✅ BUILT 30 Aug 2026)
Serious, not cartoon. Dark UI, high contrast, no bright colors, no confetti.
Each floor is its own palette; see §5.

Every floor opens with a **briefing card**: 2 lines, cold and factual. They can
be read aloud in the member's own narrator — the same six voices as the
lessons (Warm, Soft, Gentle, Clear, Male, Deep), following whatever they
already picked. The game never asks them to choose a voice a second time.

Sixty recordings (10 floors x 6 voices, ~7-9 seconds each, 2.6 MB total) live
on the `lesson-audio` branch under `tower/<voice>/floor-NN.mp3`, made by
`tools/generate-tower-audio.py`. That script reads the twenty lines straight
out of index.html rather than keeping a copy, so a rewrite of a briefing can
never leave the recordings quietly saying something else.

It is off until asked for once. After that every floor reads itself — and
because a floor only changes on a tap, that autoplay always happens inside a
real gesture, which is what phones require. A recording that will not load is
silent and disables the button; it never interrupts the floor with a dialog,
because the two lines are already on the screen. Leaving the screen, the wave,
and the door all stop it.

*"No confetti" is enforced in code, not just written here: `celebrationBurst`
is a page-level canvas above everything, so a milestone landing while the
tower is open would rain colour over it. It waits until the player leaves.*

### 4. THE TOWER — the Uncharted layer
Floors are not a straight list. Each floor is a small top-down map with 2–4 rooms.

- One room holds the door (the Truth-or-Dare choice).
- Optional rooms hold **artifacts**: a lesson excerpt, a story fragment, a letter.
  Collectible, viewable later in a Vault screen.
- Some doors are **locked from the outside** — they only open after the player
  completes a real streak day in the main app. This ties the game to actual sobriety
  instead of letting it be grinded in one sitting.

Movement is tap-to-move between rooms. No joystick, no physics.

### 5. ROBLOX — every floor is its own place
The original spec misread this reference as "robot" and turned it into an
animated guide, then into Friendly with a body. Removed.

Jacques, 30 Aug 2026, on what it actually meant: **"floor 3 doesn't look or
play like floor 7."** Not the platform, not user-generated content, not a
blocky art style — ten small places rather than one map drawn ten times.

Built as: every floor carries its own room layout, its own palette, its own
air, and its own rule. The rules come from six primitives, implemented once
and reused, because ten bespoke rule engines is how a two-week build becomes a
four-month one:

| primitive | what it does | floors |
|---|---|---|
| `dark` | a room stays unlit and unnamed until you stand next to it | 1 |
| `dim` | the lights fade the longer you stand still; moving relights them | 4 |
| `echo` | every room is drawn again, reflected, underneath itself | 5 |
| `oneway` | a corridor you cannot come back through | 6 |
| `sequence` | the door will not open until you have been somewhere else first | 3, 9 |
| `slow` | you move heavily | 8 |

Floors 2, 7 and 10 carry no rule on purpose — an unbroken floor between the
awkward ones is what makes the awkward ones land.

A rule the player cannot see is a bug, so a room that refuses you says why.

**Not built, deliberately:** a blocky/low-poly art style, and a character you
own and dress. Both were live readings of "Roblox" until Jacques settled it;
neither is in the game. Revisit only if the tower ever needs an avatar.

### 6. TRIGGER BOARD — the Candy Crush / Angry Birds layer
Appears on landing floors (10, 20, 30...). This is the thinking puzzle.

A 5x5 grid of **trigger tiles**: Bored, Stressed, Alone, Tired, Phone, Angry, Late
Night, Argument. The player has a fixed number of moves (start at 8, tighten as
floors rise) and a hand of **coping tiles** drawn from the lesson content: Call
Someone, Move, Eat, Sleep, Write, Leave the Room, Tell Her.

Placing a coping tile clears matching triggers around it. Limited moves means the
player has to plan which trigger to attack first — that planning is the point.

Clearing the board earns the landing. Failing means retry, not loss.

---

## Progression

- 90 floors = 90 days = the existing lesson days. Floor N pulls from lesson day N.
- Landings every 10 floors. Relapse returns to last landing.
- Past floor 90 the tower keeps going — same rule as The Climb.
- **Supporter version:** same tower, her own floors. Truth questions are about her
  own experience, Dares are about her own boundaries and rest. Never framed as
  monitoring him.

---

## Build order — ship in this sequence, do not build all at once

**Phase 1 (ship first, this is playable on its own):**
- Tower map screen, 10 floors, tap-to-move
- Truth or Dare door
- The floor's own unattributed line
- Progress synced to existing Climb data

**Phase 2:**
- ~~Urge Wave mini-game~~ — built 30 Aug 2026
- ~~Voice briefings using existing narrator tracks~~ — built 30 Aug 2026

Phase 2 is complete. Phase 3 (Trigger Board, artifact rooms, Vault) has not
been started.

**Phase 3:**
- Trigger Board puzzle on landings
- Artifact rooms + Vault screen

**Phase 4:**
- Floors 11–90 unlocked behind Pro
- Supporter tower variant

Do not start Phase 2 until Phase 1 is live and he has played it as a stranger.

---

## Why this is worth building

- It is the only feature that gives him free short-form content: screen-recorded
  floor clips are 15-second videos with no AI generation cost.
- It makes Pro stickier — a tower you are 40 floors into is harder to cancel than a
  lesson list.
- The Climb already exists. This is an upgrade to a shipped feature, not a new app.
