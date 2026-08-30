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

### 2. URGE WAVE — the Simon-says layer
Triggers randomly on ~1 in 4 floors, and always on floors ending in 0.

A pattern of 3–7 pulses plays on screen. The player repeats it back by tapping.
Each correct round extends the wave. The wave runs a fixed **90 seconds** and then
breaks on its own — the player learns the wave ends whether or not they fight it.

Failing a round does not end the game. It restarts the sequence and the clock keeps
running. The lesson is "wait it out," delivered mechanically instead of stated.

### 3. TONE — the Call of Duty layer
Serious, not cartoon. Dark UI, high contrast, no bright colors, no confetti.

Each floor opens with a short **briefing card**: 2 lines, cold and factual, in his
narrator voice (reuse the six existing voice tracks — Warm, Soft, Gentle, Clear,
Calm male, and his own). Stakes are stated plainly. No jokes.

### 4. THE TOWER — the Uncharted layer
Floors are not a straight list. Each floor is a small top-down map with 2–4 rooms.

- One room holds the door (the Truth-or-Dare choice).
- Optional rooms hold **artifacts**: a lesson excerpt, a story fragment, a letter.
  Collectible, viewable later in a Vault screen.
- Some doors are **locked from the outside** — they only open after the player
  completes a real streak day in the main app. This ties the game to actual sobriety
  instead of letting it be grinded in one sitting.

Movement is tap-to-move between rooms. No joystick, no physics.

### 5. ROBLOX — the sixth reference (WAS MISREAD AS "ROBOT")
The original spec turned this line into an animated robot guide and then into
Friendly with a body. That was wrong and it has been removed from the build.

**Still to be decided with Jacques** — what Roblox means here. It is not the
platform and it is not user-generated content. It is one of:
  a) the LOOK — blocky, chunky, low-poly rooms and a blocky figure;
  b) the AVATAR — a character that is yours, that you change and keep;
  c) the WORLDS — each floor its own small place with its own rules, rather
     than the same map format ten times.

Until that is settled, nothing in the game fills this slot. The per-floor line
is written as the building's, spoken by nobody.

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
- Urge Wave mini-game
- Voice briefings using existing narrator tracks

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
