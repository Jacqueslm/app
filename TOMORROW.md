# Tomorrow — 9 Aug 2026

Everything from today's session. Top section is what to actually do; the rest
is what changed, so nothing gets lost.

---

## DO THESE, IN THIS ORDER

### 1. Update Studio (2 minutes, do this first)

Settings → **Update my app** → close the black window → double-click **Start
Studio** → **Ctrl+Shift+R** in the browser. The build stamp top-left should
read **b0819**.

This update installs a speech add-on, so it will take longer than usual. That
is normal.

### 2. Play Store listing (yours — I can't reach Play Console)

Five files are already written and character-counted in
`TurnSomeDayIntoOneday/store-listing/`. Copy each into Play Console:

| File | Where it goes |
|---|---|
| `01-title-and-short-description.md` | Main store listing → App name + Short description |
| `02-full-description.md` | Main store listing → Full description |
| `03-data-safety-answers.md` | App content → Data safety |
| `04-health-declaration.md` | App content → Health apps declaration |
| `05-graphics.md` | Main store listing → Graphics (screenshots are in `store-listing/screenshots/`) |

**The first paragraph of the full description must not be moved or softened.**
Play rejects health-adjacent apps that bury it.

### 3. Production access (around 14 Aug)

Due when the 14-day closed test window completes. Say the word and I'll draft
the answers.

### 4. Tell me about the two voices

Still unanswered from today. You asked for an African American woman's and
man's voice in Studio. I can't pick a voice by race from these free models —
none of them say who the speaker is, and guessing from the sound isn't
something I'll do and call it your answer. Two real routes:

- **Record a real person, 15 seconds.** Anyone who agrees — Studio already
  clones any voice from an audio clip. I'd add a "save this as a narrator"
  button so it becomes a permanent chip with a name you choose. Cloned voices
  cost the fal rate, not free.
- **A paid voice library** (ElevenLabs through fal), where the voice actors
  describe themselves — so you're picking from what people say about their own
  voice, not from my guess. Costs per use.

---

## WHAT SHIPPED TODAY

### Studio (b0819)

**Free narrators.** The Voice card's six narrators now speak on your own
computer. No fal key, no cost, under a second per take. Was ~5c per 1,000
characters. First press on each voice downloads it (~60MB, once). There's a
**▶ Hear this narrator** button — pressing it costs nothing.

Moods (Happy / Sad / Angry) still cost money — the free engine reads plainly.
The card says so the moment you tap a mood.

**Nine new camera moves**, in the Ken Burns picker and Quick Video:

- Hover above — parked above, holds, never travels
- Drone — rises and widens with a little sideways flight
- Looking up / Looking down — low and high angles
- Crane up / Crane down — lifts off wide, or drops in tight
- Orbit left / right — arcs around the subject
- Dutch tilt — horizon off level

**Velocity curves.** New **Speed** dropdown: eases in and out (now the
default), creeps then goes, leaves fast and coasts, snaps away and settles, or
dead even. Note this changes your *existing* moves too — a plain zoom-in looks
different from yesterday. Pick "dead even" for the old flat motion.

**Parallax (3D depth).** Four directions. Splits a photo into near, middle and
far and moves them at different speeds. Depth is worked out on your machine,
free. Best on photos with a clear subject in front of a background; least
useful on flat graphics and text cards.

### Recovery app

**SOS voices rebuilt twice.** Gentle, Clear and Calm male are slower and
softer, Calm male is a different voice (John). All five are now public domain
or CC0 — see below. Testers get the new audio automatically; the cache version
was bumped so nobody keeps the old files.

---

## THE LICENSING THING — READ THIS ONCE

Two of the five SOS voices were licensed **non-commercial**, and a third was
research-only. Your app charges money, so those three weren't allowed. I
picked them originally for how they sounded and never opened the licence file.
That was my miss.

All five are now **public domain or CC0** — nobody owns them, no conditions,
free to use in something you sell.

**I audited everything else third-party in both products.** Full write-up in
`reference/asset-licenses-2026-08-08.md`. Clean: fonts (none bundled), external
scripts (none), images (all yours), recovery-programme text (nothing copied —
the Twelve Steps and Serenity Prayer belong to AA World Services and apps get
pulled for reprinting them; you have none of it), and 280 npm packages.

Two notes, neither urgent:

- **ffmpeg is GPL.** Only matters if you *give Studio to someone*. It runs on
  your machine only, so nothing is triggered — and the videos it makes were
  never covered. They're yours.
- **Suno** — you're on a paid plan, so songs made while subscribed are cleared
  for monetised video. Anything made *before* you subscribed isn't covered
  retroactively. Worth knowing which is which.

**Rule going forward:** before any third-party thing goes into either product
— a voice, a font, an image, a music track — find its licence. "Non-commercial",
"research only", or can't find one at all = no.

---

## EPISODE 2 — "The First Step" (Manus storyboard, ready to build)

Nine panels. Download them from the Manus links, add them to Quick Video in
order, then open **📋 Paste a shot list** and paste this:

```
1. 01_morning     Zoom in      6s  blend  Morning doesn't fix things. It just makes them visible
2. 02_trigger     Zoom in      5s  blend  Habit isn't a choice anymore. It's gravity
3. 03_pause       Hover above  7s  blend  You don't fight the wave. You let it break over you
4. 04_outside     3D depth →   8s  blend  The outside world doesn't know you're fighting
5. 05_walk        Slide →      8s  blend  Movement becomes the antidote to standing still
6. 06_store       Looking up   6s  cut    Every corner is a reminder of where you used to hide
7. 07_return      Zoom out     7s  blend  You come back to the same four walls. The room feels different
8. 08_daytwo      Zoom in     10s  cut    Day one was surviving the night. Day two is surviving the afternoon
9. 09_horizon     Crane up    10s  cut    It doesn't get easier. You get stronger
```

Checked: nine shots, 67 seconds, every row fills in.

**The camera moves are Manus's own directions, translated.** "Slow push-in" is
Zoom in. "Static extreme close-up" became Hover on the breathing shot — it
holds instead of drifting, which is what that beat wants. "Wide tracking from
the doorway" is 3D depth, so stepping outside actually opens up. "Camera
glides alongside him" is Slide. "Every corner is a reminder" is Looking up, so
the store is bigger than he is. The last shot is Crane up — it lifts off and
ends wide, which is what an epilogue is for.

**The on-screen words are Manus's VOICEOVER lines, not its captions.** Its
captions are labels — "The harsh light of day", "The familiar pull". Episode 1
worked because the words on screen were somebody talking: *"I wasn't hungry. I
was filling a hole."* The voiceover lines are the ones that sound like a
person, so those go on screen. Swap them back if you'd rather.

### Three things worth deciding before you build it

1. **67 seconds vs Episode 1's 28.** More than twice as long. The middle —
   outside, walk, store — is 22 seconds of a man walking, and that's where a
   thumb moves. Cutting those three to 5s each brings it to 58 and loses
   nothing. Your call.
2. **Both episodes end on the same picture.** Episode 1's epilogue is Elias at
   the kitchen window with a glass of water in morning light. Episode 2's
   epilogue is Elias at the living room window with a glass of water in
   morning light. Two of the panels sent through are exactly that shot in two
   rooms. If Episode 2 ends the way Episode 1 ended, the series stops feeling
   like it's going anywhere. The notebook — *"Day 2"* in his own handwriting —
   is the ending nobody's seen before. Consider finishing there.
3. **"It doesn't get easier. You get stronger"** is a very well-worn line —
   it's on a million gym posters. Everything else in this script sounds like
   you. That one sounds like everybody. Something plainer in the same place,
   your own words, would land harder.

### Two corrections to things I said earlier

**The scene numbers are fine.** I flagged the jump from Scene 4 to Scene 8 as
possible missing scenes. It isn't — Episode 1's storyboard has the identical
jump (1, 2, 3A–3D, 4, 8, Epilogue). It's just how Manus numbers. Nothing lost.

**Five of the nine panels are in hand**, not all nine: Scene 1 (counter, water
and fruit), Scene 2 (the phone), Scene 3A (eyes closed, breathing), and two
window shots for the epilogue. Still to generate: 3B stepping outside, 3C the
walk, 3D the corner store, 4 the return, and 8 the notebook.

**One more thing worth having:** the character has a name in Manus's files —
**Elias**. Using it in every prompt is part of what's keeping the same face
across both episodes.

## STILL OPEN (not today's work)

- Outreach follow-ups — 15th to 18th, `OUTREACH.md`
- Play Store developer verification (the signing key) — before 30 Sep
- Studio's Buffer send — built, you haven't tested it yet
- Script 39 narration
- Origin-story photo fixes: real app screenshot on the laptop shot,
  "Someday" as one word
