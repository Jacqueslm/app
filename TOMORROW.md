# Tomorrow — 9 Aug 2026

Everything from today's session. Top section is what to actually do; the rest
is what changed, so nothing gets lost.

---

## DO THESE, IN THIS ORDER

### 1. Update Studio (2 minutes, do this first)

Settings → **Update my app** → close the black window → double-click **Start
Studio** → **Ctrl+Shift+R** in the browser. The build stamp top-left should
read **b0830**.

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

### Studio (now b0830)

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

## EPISODE 2 — rewritten, ready for Manus

Everything is in **`EPISODE-2.md`** — hand that whole file to Manus and it has
the style, the character, and all eight image prompts.

Retitled **"The Afternoon"**, cut from 67 seconds to 46, eight shots instead of
nine. It ends on the notebook rather than a second window shot, the walking
middle is gone, and there's a new three-o'clock shot — the hour the episode is
named for and that every draft skipped.

Two panels already exist (the counter, the phone). Six need generating,
including a new Shot 3 where the phone shows **your app** — the SOS breathing
circle, mid-craving, doing its job.

The paste block at the bottom of that file drops straight into Quick Video.
Checked: eight shots, 46 seconds, every row fills in.

## EPISODE 3 — "That Was Me"

**`EPISODE-3.md`.** Eight shots, 49 seconds. Shots 1–7 go to Manus. **Shot 8
is not generated — it's you, on your own phone, in your own room.**

The arc: twelve days in, the old life calls, he goes to the restaurant anyway,
it nearly goes wrong, he steps outside for four minutes, he goes home and
writes the number. Then the picture stops being beautiful and it's you saying
it was never a story. Thirty-eight years. Free at fifty.

You asked for spectacular. Drone shots and swelling music would undo
everything the first two episodes earned — that's the ending of a supplement
advert. This is the floor going out instead: three episodes of a man they
assume is an actor, and then he isn't.

Costs nothing. Seven panels and one video of you talking.

**There's a fallback ending in the file if you don't want to be on camera** —
a stack of filled notebooks and "Day 400". It's good. It just isn't the one
nobody else can make.

Paste block checked: eight shots, 49 seconds.

## STILL OPEN (not today's work)

- Outreach follow-ups — 15th to 18th, `OUTREACH.md`
- Studio's Buffer send — **parked at Jacques' request.** It gets as far as
  Buffer's own validation; the last blocker is that Buffer rejects custom video
  thumbnails outright, so the thumbnail Studio attaches has to come back out
  (one deletion, in `buffer/post`). Manual posting works today: render →
  Download my video → upload to each platform.
- Play Store **developer verification: DONE** — the console confirms all apps
  are registered ahead of the Sep 30 deadline. Nothing further needed.
- Script 39 narration
- Origin-story photo fixes: real app screenshot on the laptop shot,
  "Someday" as one word
