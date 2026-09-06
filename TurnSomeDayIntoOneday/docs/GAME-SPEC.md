# GAME-SPEC.md — "The Fight of Your Life"

The recovery game inside Turn Someday Into Day One. The Game tab opens it, with
The Climb on the same screen. Code identifiers still say `tower`, `2AM`, `gm`,
`g2-`.

**Rewritten 6 Sep 2026.** Jacques on the 3 Sep version: "the game is wack, the
fight is ok but the questions on all levels are wack." The quick-fire floors are
gone. Floors are game shows now, the roof plays like Punch-Out, there is no
clock anywhere, and it has photos and real sound. The previous design is in git
history before this date.

---

## Core idea in one sentence

You climb buildings at night. Every floor starts with a wheel that lands on one
of three game shows. Twelve floors, then the thing you are fighting waits on the
roof, by name, as a shadow in the ring. Beat it and a ride takes you to the next
building. It never ends. Your strength comes from the work you do in the app.

---

## Non-negotiable rules

1. **The game knows the track from the app.** The opponent is the person's own
   addiction — `The Drink`, `The Screen`, `The Bet`, and so on — with lines
   written for it and its own shadow photo. A supporter gets `The Checking`:
   the voice that says "check their phone", "if you'd said it better". Never
   their person's habit.
2. **Unbiased.** Nothing blames the person struggling to comfort the supporter,
   or the supporter to comfort the person struggling. No pronouns for a
   supporter's person.
3. **No medical claims.** It says what people report and what the app does.
   Tests enforce the words.
4. **It can end a fight, a floor, a building. It never tells anyone they are
   finished.** The boss's last line is always "Down. Not out. Same time
   tomorrow." Buildings never run out.
5. **A relapse costs nothing in here.** The building stands where it stood.
6. **Strength is earned in the app, never in the game.** No taps, coins or
   grinding make you stronger. The door lists exactly what is missing.
7. **No clock. Anywhere.** Jacques: "no timer, it's added stress." The only
   thing that tightens is the wind-up before the boss swings. Tests enforce it.
8. **Nothing invented.** Every card behind a door, every corner line, every
   puzzle word is read from what this person actually did: days, money kept,
   journal lines, the person they named, today's lesson. No "% of people".
   Tests enforce it.
9. **Free.** All of it. Pro is Friendly and the rooms, nothing here.

---

## The floors (1–12)

Every floor: spin the wheel. Three slices. The first three spins of a person's
life land on each show once so the whole game shows itself; after that it is
the wheel's call. Floors score **Ups**. Ups are never taken away.

**Who Wants to Recover.** A moment from this track (`GAME_EXITS`), the boss's
own line as the voice, three moves, one is yours. Pick, then *Make the move*.
Lifelines are earned in the app, once per building: 50:50 (today's pledge),
Your words (a journal line, reads one back to you), Skip (today's lesson).

**Wheel of Your Addictions.** This person's own words with one letter missing.
Buildings 1–2: one word from their journal. Building 3 on: a whole line from
their journal, or a sentence from a lesson they have done. If they have written
nothing yet, one of their own counters to the boss. Tap a letter. Three wrong
and it is down.

**Time to Heal.** Three wooden doors. Two heal, one is the boss. Pick a door;
before it opens the boss offers a deal in one of its own lines. *Take the deal*
is always a down: there is never anything behind it. *Keep my door*: two in
three it opens on something of theirs (their day count, what stayed in their
pocket, a line they wrote, the person they named, today's lesson, a breathing
circle). One in three it is the boss, the other two doors open so you see what
you missed, and the words say plainly it is not on you.

**Up / Down.** Up is an Up and the next floor. Past floor 4 you can *Walk* (keep
every Up, same building next time) or push on. Down drops you to the last safe
floor (4 or 8, else 1) "for reinforcements". Never the ground.

---

## The roof

**The door.** Strength, itemised, with what is missing. The boss's fighting
style. Glove colour. *Ring the bell.* If the roof is locked after a loss, the
door says exactly which one real thing in the app opens it.

**The fight.** Announcer ("Round one"), bell, crowd. Each round:

1. *Its line, your counter.* Three, one is yours. No clock.
2. *Your opening* (right counter only). Targets light up on it — head, ribs,
   chin — tap the light, three is the combo. **Stars** are uppercuts: one for
   each of pledge, journal, lesson done today.
3. *Its turn.* A pattern of swings, each with a **tell**: whoosh, it leans and
   glows to one side. Swipe or use the arrows to dodge the other way, or tap
   Block for half. Dodge clean and it misses and a green chin target opens for
   a counter-punch. Buildings 1–2 show an arrow saying which way; after that
   you read it. Feints arrive at building 3, the switch (winds up one side,
   swings from the other) at building 6.
4. Every three rounds: bell, **your corner** talks in your own words from the
   app, bell.

It **tires** under a third health: slower sway, greyer, and it starts talking
in single words again. **Knocked down**: the ref counts ten out loud, big
numbers, you tap to beat the count and get up with a third of your health.
**Knock it down**: the ref counts it out, three bells, "Winner", and the ride
(jet / helicopter / parachute by health left) to the next building. **Lose**:
"Saved by the bell", the roof locks until one real thing is done in the app.

**Patterns** (`GAME_PATTERNS`): The Drink feints then the big one; The Scroll
fast jabs; The Bet bluffs; The Heat slow and heavy; The Screen never the same
twice; The Smoke comes back when you relax; One More Match one more, one more;
The Checking nags then lunges; everyone else straight ahead.

**Pace** (`gameTier`): buildings 1–2 single words, 1000 ms tell, two swings,
arrows; 3–4 short lines, 800 ms, three swings, feints; 5+ full sentences,
620 ms, four swings, the switch. Boss health 90 + 6 per building, capped 160.
Strength 50 + days (to 30) + lesson 12 + journal 10 + pledge 10 + cravings
ridden out 3 each (to 9) + floors cleared, capped 120.

---

## Art and sound

- `img/fight/` — scenes (`temple`, `tomb`, `monastery`, `rooftop`), boss shadows
  (`boss-<key>.jpg`, one per opponent plus `boss-shadow`), boxers
  (`boxerN-{punch,guard,corner,count,down}.jpg`; complete sets are listed in
  `GAME_BOXERS`), gloves (`glove-{red,blue,white}.png`, cut out, knuckles up).
  People pick their boxer and glove colour on the door; stored in `S.bld`.
- `audio/fight/` — bell, bell3, crowd (loop), cheer, ref count 1–10, round 1–6,
  winner, saved, down, getup, boss and fighter grunts (man and woman sets).
  Ref and announcer are the app's Deep male Piper voice, the same as the SOS
  talk. Boxers 3, 5 and 7 use the woman's grunts.
- Punch thuds, the wind-up whoosh and the whiff are synthesised in WebAudio.

---

## State (`S.bld`)

`b` building, `f` floor (13 = roof), `cleared`, `ups` (this building),
`upsTotal`, `wins`, `losses`, `rides`, `locked` (snapshot at a loss), `boxer`,
`glove`, `spun`, `used` (lifelines this building), `streak`.

## Tests

`server/test/game.test.js`: every track has an opponent, a shadow photo and a
pattern; every line has one right counter; the pace slows early and tightens;
no clock; nothing invented; every listed boxer has all five photos; the audio
exists; strength and the lock read the app; the house rules on words.

## Next

3D fighters. A Three.js proof exists (shadow boxer, gloves, ref) built from
shapes; real fighters and moves come from Mixamo when Jacques pulls them.
The same rules drive them.
