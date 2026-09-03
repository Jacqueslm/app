# GAME-SPEC.md — "The Fight of Your Life"

Renamed from "2AM" on 3 Sep 2026 (Jacques). Code identifiers still say `tower`, `2AM`, `gm-`.

The recovery game inside Turn Someday Into Day One. The Game tab opens it, with
The Climb on the same screen.

**Rewritten 3 Sep 2026.** Jacques on the previous version (a 90-floor tower with
a collectable vault): "I don't like it. Make it fun and challenging to want to do
better in your recovery — that's the point." The tower and the vault are gone.
The old design is in git history before this date if anyone needs it.

---

## Core idea in one sentence

You climb buildings at night. Twelve quick floors, then the thing you are
fighting waits on the roof, by name. Beat it and a ride takes you to the next
building. It never ends. Your strength comes from the work you do in the app.

---

## Non-negotiable rules

1. **The game knows the track from the app.** The opponent is the person's own
   addiction — `The Drink`, `The Screen`, `The Bet`, and so on — with lines
   written for it. A supporter gets `The Checking`: the voice that says "check
   their phone", "if you'd said it better". Never their person's habit.
2. **Unbiased.** Nothing blames the person struggling to comfort the supporter,
   or the supporter to comfort the person struggling. No pronouns for a
   supporter's person.
3. **No medical claims.** Quick-fire says what people report and what the app
   does. Tests enforce the words.
4. **It can end a fight, a floor, a building. It never tells anyone they are
   finished.** The boss's last line is always "Down. Not out. Same time
   tomorrow." Buildings never run out.
5. **A relapse costs nothing in here.** The building stands where it stood.
6. **Strength is earned in the app, never in the game.** No taps, coins or
   grinding make you stronger. The door lists exactly what is missing.
7. **Free.** All of it. Pro is Friendly and the rooms, nothing here.

---

## The loop

- **Building N.** Floors 1–12, then the rooftop (floor 13).
- **Floors 1–12** rotate four tests, each under a minute:
  - *Spot the voice* — three lines, one is the addiction talking. Tap it.
  - *Quick fire* — five true/false statements, four to pass.
  - *Finish the line* — a sentence from a lesson the person has actually done,
    one word blanked, three choices. Falls back to their own counters if no
    lesson is done yet.
  - *The exit* — a situation and three moves. One gets you out.
  - Fail = "stairs again": same floor, new draw, nothing else lost.
- **The rooftop.** Turn-based. The boss says its line, you pick the counter on a
  clock. Right answer opens a 2.5 s punch window: tap to land up to three, the
  third is the hook. Wrong answer or too slow, it hits you.
- **Win.** The ride is picked by how much you had left: under 40 % parachute,
  under 70 % helicopter, else jet. Next building.
- **Lose.** "Saved by the bell." Back to the door, not the ground. The roof is
  locked until one real thing happens in the app: today's lesson, a journal
  line, the pledge, or a craving logged. That is the whole hook.

## Pace

Jacques, on the demo: "start each rooftop level off slow and the questions are
too long — start them off with just a word, as levels progress they can become
longer."

| Buildings | Lines            | Rooftop clock | Boss hit |
|-----------|------------------|---------------|----------|
| 1–2       | single words     | 12 s (+2 s round 1) | 7–9  |
| 3–4       | short lines      | 10 s          | 10–13    |
| 5+        | full sentences   | 8 s           | 13–16    |

Every rooftop opens with a beat: the boss stands there for a second before it
speaks. Boss health: 90 + 6 per building, capped at 160.

## Strength

`50 + days (cap 30) + today's lesson 12 + today's journal 10 + today's pledge 10
+ 3 per craving logged in the last 7 days (cap 9) + floors cleared this
building (cap 12)`, capped at 120. The door shows each line and a hint for any
that is zero ("Take the pledge on Home: +10").

## Where it lives

- `index.html`: CSS block `2AM — THE BUILDINGS`, screen `#s-tower`, JS block
  `2AM — THE BUILDINGS (the Game tab)`. Data tables: `GAME_BOSSES`,
  `GAME_EXITS`, `GAME_QUICK_GENERIC`, `GAME_QUICK_TRACK`, `GAME_RIDES`.
- State: `S.bld` — `{b, f, cleared, wins, losses, locked, rides, streak}`.
- Tests: `server/test/game.test.js`.
