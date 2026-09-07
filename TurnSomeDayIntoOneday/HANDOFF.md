# Handoff — Turn Someday Into Day One

## Where the game is, 6 Sep 2026 (read this first if you are continuing the game work)

Jacques is rebuilding **The Fight of Your Life** (the Game tab) with the person
in this chat, one preview at a time. He is not a developer. Short replies, plain
words, one step at a time, never push unless he says "push", commit locally.

**Shipped, live in the app (version 10.4):** the whole v2 game. Spec in
`docs/GAME-SPEC.md`. Floors are game shows (Who Wants to Recover, Wheel of Your
Addictions, Time to Heal), no clock anywhere, nothing invented; the roof is a
Punch-Out style fight against the addiction's shadow photo: counters, tap the
lights, stars, tells, dodge, block, counter-punch, patterns per boss, corner
talk, bell, ref count, announcer, crowd, grunts, get up before ten. Art in
`img/fight`, sound in `audio/fight` (Piper deep male, same as SOS). Tests in
`server/test/game.test.js` (100 pass). Boxer and glove picker on the door.

**Committed after that (may be local-only if he never said push):**
- `img/fight/fighter.glb` — Mixamo X Bot with thirteen boxing moves in one
  1.1 MB file, and `tools/mixamo/` (the converter and how to run it).
- `img/fight/ref.png` — Jacques's referee, cut out. In the app she slides in for
  every ref count (`.g2-ref`, `gmRefCount`).
- `tools/ring3d/ring3d.html` — the 3D ring proof: Three.js bundled inline, the
  real fighter as the black shadow boss with amber rim light and as you (blue,
  red gloves, over-the-shoulder camera), jab/hook/uppercut, its swing with a
  tell, dodge/block, knockdown with the ref (her photo on a board) walking over
  and counting. Open it in a browser as is. Published for him as an artifact.

**Done 6 Sep, later that day (local commits, not pushed unless he said push):**
- The ref is **Suzie** from Mixamo (he picked her over Megan: white shirt, black
  trousers). `img/fight/ref.glb`, 2.6 MB, moves: idle, counting, walking, talking,
  waving, hand_raising. Converter and notes in `tools/mixamo/convert-ref.*` and the README.
- She is in `tools/ring3d/ring3d.html` in place of the photo board: stands at
  ringside, walks over with her own walk when somebody is down, bends and
  counts, then walks to you and raises her arm for the winner. Verified headless: no errors, screenshots checked.
- Big files reach a chat only through GitHub: a zip over 25 MB goes on a
  **release** (`github.com/jacqueslm/app/releases/new`, tag it, drop the file in
  the bottom "Attach binaries" box, publish). The `suzie` release holds her
  original FBX files. Drive, Dropbox and Mixamo are blocked from the container.
- Jacques tested the first cut and called it off-beat and cheap: fighters not
  touching, dodge dead, the ref sliding. Measured and fixed the same day:
  every clip in both `.glb` files is now **in place** (the hips keep height but
  never travel; the converters do this on the way through, `Hips(_\d+)?`
  because the ref's hip track carries a suffix), the bodies stand 0.9 m apart
  (a jab reaches 0.73 m from the hips), and reactions fire on the measured
  contact frame: jab 0.50 s, hook 0.40 s, uppercut 0.47 s into the clip,
  divided by the play speed. Dodge and block play the instant they are tapped
  and count if they came during the wind-up or swing; the cue arrow points the
  way to slip. Suzie walks at 1.35 m/s with her clip at 0.8 so her feet do not
  slide, and her count numbers land on her pointing: one at 2.4 s, then every
  0.87 s. The camera drops to the floor for a count. Verified with a tiled
  frame sequence (`seq.js`/`tile.js` in that session's scratchpad, not in the
  repo).
- **The ref showed as a white ghost on the published preview page** (fine in
  headless Chromium from disk). The page's rules stop the model loader from
  unpacking images embedded in the `.glb`, so `ring3d.html` now carries a
  texture-less copy of her plus her two skin images as plain `data:` PNGs
  (`REF_TEX`, keyed by mesh name: Body/Pants/Shirt/Coat/Shoe share one, Hair
  and Eyelashes the other) and puts them on after loading. `img/fight/ref.glb`
  keeps its textures for the app, which serves from its own origin.
- Dodge right went left: one duck clip, and the camera swung the other way.
  Now your body steps 0.3 m the way you tapped and the camera follows.
- The hand raise is her raising her own arm (Mixamo has no two-person clip).
  Staged: she walks to your right side, the camera swings to the front, her
  arm holds up beside your glove while you play `victory`. A real "lifts your
  wrist" needs a custom two-character animation (Blender), not Mixamo.
- He asked twice whether the characters are commercial-safe: Adobe's Mixamo
  FAQ allows characters and animations in commercial games and apps, no
  credit; not for resale as files. `helpx.adobe.com` is blocked from the
  container, so this was from memory; he was given the URL to confirm.
- **The ring is a fight now, on the Unified Rules of Boxing, shortened** (he asked
  for real rules, 60-second rounds): six rounds of sixty seconds, ten seconds in
  the corner, ten-point must scoring with a knockdown taking an extra point,
  mandatory eight count, counted out at ten (the boss, on its fourth trip down
  in the fight), three-knockdown rule (either side; you always rise at eight),
  the clock stops for a count and nobody is saved by the bell, then the cards.
  Sounds ride inside the page as data URIs (bell, round calls, cheer, winner,
  down, get-up). No male count voice for Suzie. Test the endings with
  `?secs=45&rounds=2&rest=3` (both endings verified headless, no errors).
  **Settled 6 Sep: the app stays clockless; only the 3D fight has a clock.**
  Recorded in CLAUDE.md.
- Both fighters now punch with both hands: Mixamo's jab, hook, uppercut and
  dodge are all left-handed, so `tools/mixamo/mirror.html` makes right-handed
  twins (`right_jab`, `right_hook`, `right_uppercut`, `dodging_right`). The
  shipped `fighter.glb` has them. Punches alternate hands; the boss throws a
  left hook you slip left, a right hook or right jab you slip right.
- Suzie's colour shifted under the amber and blue ring lights; her own picture
  now lifts her from inside (`emissiveMap`, 0.55) so the lights only shade her.
- He asked how to get Blender and what it does: blender.org, free, Windows
  installer; it builds and animates 3D characters, the tool for any move
  Mixamo does not have (the referee lifting the winner's actual wrist).
- **6 Sep, evening. The ring is a fight now**, on the Unified Rules of Boxing,
  shortened at his request: six rounds of sixty seconds, ten seconds in the
  corner, ten-point must (10-9, an even round 10-10, one point more per
  knockdown), mandatory eight count, counted out at ten (the boss beats the
  count until its fourth knockdown of the fight; the person always gets up at
  eight), three-knockdown rule for either side, clock stops for a count, nobody
  saved by the bell, cards after six. It can end a fight; the lines never end
  the person. `?secs=&rounds=&rest=` on the URL shorten it for testing.
  **Settled the same evening: the app itself stays clockless; only this fight
  has a clock.** Written into CLAUDE.md.
- Punches landing: Mixamo's jab/hook were made with a half-step forward that
  the in-place bake removed, so gloves stopped short. `stepIn`/`stepBack` now
  carry the body 0.3 m along its facing for each punch and bring it back; the
  fighters also face each other (`faceOff`) instead of standing parallel.
- **Sound.** Punch thud, slap and whoosh are synthesised in the page with the
  browser's own audio (nothing downloaded, nothing to license). Grunts, bell,
  round calls, crowd loop, cheer and winner are the app's own Piper recordings
  from `audio/fight`, inlined. Piper is not installed in this container.
- **Crowd.** Two banks of flat silhouettes behind the far ropes: left, red, the
  temptations rooting for the addiction; right, green, the tools and supporters
  rooting for the person. Each bank jumps when its side scores. Chant lines
  flash on that side. In the proof the lines are stand-ins (`TEMPT`, `SUPPORT`);
  **in the app they must come from the person's own data**: recorded triggers
  and excuses on the left, their SOS tools and supporters' names on the right.
- Free, commercial-safe tools he asked about (all checked 6 Sep): Blender
  (blender.org, GPL, free for commercial work), Mixamo (Adobe, characters and
  moves free in commercial games, not for resale as files), Piper TTS (MIT,
  already the app's voice), Audacity (GPL). For sounds: Pixabay CC0 and
  ZapSplat's CC0 collection need no credit; Mixkit has its own free licence;
  ElevenLabs' free tier requires attribution. Freesound must be filtered to
  CC0 per clip. He wants only free-for-commercial-use or public-domain
  downloads, voices included.
- **The road he set, 6 Sep, late** (one step at a time, in this order): 1 rings,
  2 announcer, 3 ring girl with the round card, 4 corner people, 5 a real
  crowd with faces, 6 a real boxer. His frame for all of it: the fight never
  ends, the addiction is always on the card, you walk in stronger each time;
  trauma stays and you get stronger at carrying it. It can lose. It never
  says you are finished.
- **Step 1 done: the rings.** The app's four places (Temple, Tomb, Monastery,
  Rooftop) are venues in `ring3d.html`, each with its own key, rim, fog, floor
  and ambient colour and the scene photo as the far wall; glove colour red,
  blue or white on your gloves. Picked on the start screen or by
  `?place=&glove=`; the app will pass the person's own door choices. He is
  downloading the announcer for step 2 (man in a suit, T-pose with skin, plus
  Idle, Talking, Walking, Cheering without skin, release tag `announcer`).
- **Step 6 came early: six fighters with skin.** Jacques had already put six
  Mixamo characters on a draft release tagged `Fighters` (a draft is
  downloadable with the session's `GITHUB_TOKEN` through the API assets URL;
  the public link does not work for drafts). Converted with
  `tools/mixamo/convert-fighter.*`: the shadow's thirteen moves plus mirrors
  are renamed onto each body's bones (prefix `mixamorig`, `mixamorig1`, and so
  on) and saved as `img/fight/fighter1..6.glb` (1 = blue goblin, 2 = woman in
  yellow, 3 = man in black, 4 = Claire, 5 = Kaya with the mushroom hat,
  6 = the motion-capture man). In `ring3d.html` the bodies ride without moves
  and get them from the shadow at load, skins as plain images; the page is
  10 MB, under the 16 MB limit. Every fighter is scaled to stand 1.8 m. Picker
  row 1–6 before the bell, `?fighter=`; the app will pass the door's choice.
  The boss stays the black shadow.
- **Fighters, second pass (his call: Claire and Kaya's arms did not bend, out).**
  Now five: 1 goblin, 2 woman in yellow, 3 man in black, 4 **Jackie** (Ch29,
  from the draft release `fightermoves`), 5 motion-capture man. Claire and
  Kaya deleted from `img/fight`. That release also carried four moves, added
  to the set with `tools/mixamo/addmoves.html`: `head_hit` (the short head
  snap, now the reaction to a hook and to the boss's hooks), `jab_cross`
  (the **1-2** button: left lands at 0.40 s, right at 0.67 s of the clip),
  `lead_jab2` (spare), `defeat` (the boss slumps when it loses; the person
  never plays it). Gloves are now sized from each hand, wrist to middle
  fingertip, and centred on it (`fitGlove`), so no fingers poke out on any
  body. Three files in that zip had lost their `.fbx` extension.
- **Steps 2 and 3 done: announcer and ring girl** from the published release
  `characters` (Ch33, a man in a suit; Peasant Girl). Neither came with moves,
  so Suzie's six (idle, walking, talking, waving, hand_raising, counting) are
  renamed onto them at load, `tools/mixamo/convert-cast.*`, files
  `img/fight/announcer.glb`, `ringgirl.glb`. The announcer walks to ringside
  centre before round 1: the roof, "In this corner: you", the boss by name,
  and the damage line; he walks in again to read the cards and puts his arm
  up on a win. The ring girl walks the round card across between rounds,
  holds it up with the arm-raise clip; **tap the card and it flips** to the
  corner's line (raycast on the canvas). Names and days come from the app
  later; the proof says "you".
- **The boss wears the damage.** Six kinds cycle with the building number:
  body (red), money (gold), people (violet), time (blue), mind (grey), trust
  (amber). The shadow's colour, its glow and the light behind it change,
  and the announcer says which. `DAMAGE` in `ring3d.html`, `?building=N`;
  the Temple/Tomb/Monastery buttons set 1/2/3 within the current cycle. The
  app will pass its own building number.
- **Step 4 done: the corners**, from the published release `trainers` (four
  characters, no moves; Suzie's clips again, `convert-cast2` settings: mesh
  to 8%, error 0.05, 96 px skins, so the page stays under 16 MB). Your
  corner: **Remy** in gym clothes is the trainer, the **soldier** (Ch49) is the
  cut-man. The addiction's corner: the **clown** (Whiteclown N Hallin) and
  the masked **wrestler** (Ch43), who come to its corner between rounds and
  heckle with the temptation lines. Between rounds a row appears: **Water**
  (+8), **Towel** (+5, clears the red), **A word** (a supporter line; in the
  app, the person's own journal line or their person's text). One tap each per
  rest; the row hides when the bell goes. Files `img/fight/trainer.glb`,
  `cutman.glb`, `clown.glb`, `wrestler.glb`. Every cast body is scaled to
  1.78 m at load (Remy's file came in at a different unit).
- **Step 5 done: a real crowd**, from the published release `crowd` (nineteen
  characters, twelve seated moves). Jacques: **monsters are the addiction's
  side, people are the person's.** Six of the nineteen (`character (4)`,
  `(5)`, `(6)`, `(7)`, `(11)`, `(12)`) are FBX 6.1 files three.js cannot read;
  re-download those as FBX Binary 7.x if wanted. The thirteen usable bodies
  are in `img/fight/crowd/c*.glb` (body only, 5% mesh, 64 px skins): monsters
  c2 ghoul, c4 "The Boss", c5 zombie in a red dress, c6 mushroom-head, c16
  shadow, c18 masked ninja; people c0, c1, c3, c9, c10, c11, c17. Eight seated
  moves (`sitting_idle`, `sitting_clap`, `cheering_while_sitting`,
  `sitting_yell`, `sitting_disapproval`, `sitting_disbelief`,
  `sitting_talking`, `sitting_laughing`) are baked into `fighter.glb` at a
  third of their keys (`tools/mixamo/addmoves-crowd.html`); `stand_to_sit`,
  `standing_clap`, `sitting`, `sitting_and_pointing` were left out for size.
  The page seats 24: two rows a side on dark blocks behind the far ropes,
  three monster bodies left under red light, three people right under
  green, cloned with a small in-page skeleton clone. They idle, cheer or boo
  on each landed punch (`crowdReact`), chat between rounds (`crowdChat`),
  and the house comes up on a knockdown. **The page is 15.6 MB against a
  16 MB limit**: Suzie's page copy was cut to a third of her triangles and
  four seated moves dropped to fit. Nothing more can go in the preview
  page; the app serves files from its own origin and has no such limit.
- **Concept change, 6 Sep evening: the Rumble cut.** He did not like the
  first full fight: "more talking, more interaction, different camera views
  like Big Rumble Boxing, better visual and sound, the addictions like the
  images with the glow." New section at the end of `docs/GAME-SPEC.md`.
  Built so far: the addiction's look (silhouette, its colour's glow and
  backlight following the camera, its prop: glass, phone, chips, ember,
  bags, slab; `ADDICTIONS`, `?boss=drink`) and the camera director (`SHOTS`
  tv/shoulder/low/crowd/corner, cuts every few seconds in a round, slow
  motion and a low camera on knockdowns, punch-in on big hits, a **Cam**
  button). Still to build in this order: it talks and you answer from
  `GAME_BOSSES`; the DAY ONE meter and flurry; announcer calls; the sound
  layer. He has Blender installed now, for two-person moves later.
- **"I want it like Big Rumble Boxing"** (Creed Champions, 2021, Survios):
  side-on like a TV fight, light and heavy punches, a special and a super per
  fighter, story through talk between matches. Built on top of the Rumble
  cut: the **side camera follows the two of them** and leans in when they
  close (`camTick`), **impact flashes and freeze frames** on every landed
  punch (`hitFx`, `freeze`), a **DAY ONE meter** under each health bar
  (`ysp`, `bsp`; yours fills on landed punches and right answers, its on
  punches it lands), your **super** at a full meter (a pulsing DAY ONE button:
  slow motion, low camera, speed lines, jab-jab-hook-uppercut, the house up;
  `superMove`), **its special** at a full meter (aura flares, three punches;
  block halves them; `bossSpecial`), and **the talk-back**: during its wind-up
  it says one of its own lines from the app's `GAME_BOSSES` (the Alcohol set
  is in the page as `LINES.drink`; the app passes the real set per track),
  two answers appear for 1.9 s, the right one slips and counters (`COUNTER`,
  a ding), the wrong one eats a harder punch and feeds its meter. Verified
  headless: counter 74 after a hook and counter, wrong answer 84 and its
  meter 18, super takes 46, its special 30 (or 12 blocked).
- **Ring walks, corners and voices (6 Sep, late).** His notes: the announcer
  never actually spoke, the fighters stayed on their marks between rounds
  while only the corner team moved, everyone stood in front of the ring girl,
  and there were no entrances. Researched the real order (ABC referee manual,
  cutman/cornerman practice) and rebuilt the shell of the fight:
  **the announcer, the referee and the addiction now speak aloud** through the
  browser's own speech (`speak()`, no files, nothing to license; announcer low
  and slow, the addiction lower and slower, the referee a female voice).
  **Ring walks**: you come up the near aisle with your trainer and cut-man
  behind you and the house up, it comes up the far aisle in its own colour
  with the clown and the wrestler; both cameras are fixed at the ring apron
  looking down the aisle, the way television shoots it (a tracking camera kept
  catching the crew). Then **introductions at centre ring** and the
  **referee's instructions** ("Protect yourself at all times. Obey my
  commands. Touch gloves."), a glove touch, and both go to their corners.
  **Between rounds the fighters walk to their own corners and sit on stools**
  (`toCorners`/`toMarks`, the seated clip from the crowd set; the ref's walk
  is renamed onto both fighters by `giveWalk`), the corner team works from
  the side, the ring girl crosses an otherwise clear ring, "Seconds out" and
  the bell. Rest is 14 s by default now. The crowd reacts on nearly every
  seat rather than a third.
- **Announcer calls the action** (the last piece of the Rumble cut): a short
  spoken line over the bottom of the screen on a big punch, a jab working, a
  slip, a block, a counter, either fighter hurt under 28, ten seconds left,
  a knockdown, up at eight, and both supers. `call()` throttles to one every
  3.4 s, gives way to whoever else is speaking, and never invents a number.
  Verified headless: seven lines in one round, correct triggers.
- **The 3D fight is in the app** (version 10.5). `game3d.html` at the app root
  is the same fight with the blobs taken out: three.js moved to
  `js/ring3d-three.js` and every model and sound loads from `img/fight/` and
  `audio/fight/`, so it is **724 KB instead of 15.6 MB and opens in 2.5 s**.
  The app's roof screen (`startFight` in `index.html`) now mounts it in a
  full-screen iframe (`#g2-3d`) and hands it, by postMessage, the person's own
  opponent and its lines from `GAME_BOSSES` at the building's tier, their
  boxer (1-9 mapped onto the five 3D bodies), glove colour, building, place
  and name, plus supporter lines built from their last journal entries, their
  person's name and their day count. It posts back `{type:'fight-over',
  result, how, round, youHP, cards}`; `game3dWon` gives the ride and the next
  building exactly as the photo fight did, `game3dLost` locks the roof.
  Verified over http with a stand-in host page: config in, result out, all
  files 200. **Not yet verified inside the real signed-in app** — the server
  needs its npm packages, which are not installed in this container. The
  photo roof it replaced is in git before this commit; `tools/ring3d/` stays
  as the standalone proof.
- **The twelve game-show floors are gone.** He said it again on 6 Sep:
  "the whole question is wacky, the graphics is not fun." `renderTower()` now
  sends every building straight to `renderRoofDoor()` and `gameNextBuilding()`
  starts the next building on its roof; the floor strip in the header counts
  buildings instead of floors. The shows' code (`renderDoor`, `gameSpin`, the
  three shows) is still in `index.html` but unreachable — **delete it once he
  confirms he likes the simpler game**. Nothing was lost: the addiction's lines
  live in the ring now.
- **The corner, sitting, and a 360 camera (10.6).** His notes: the fighter
  stood instead of sitting, the trainer did nothing, and he wanted the camera
  free. Fixed: `fighter1..5.glb` carry 23 boxing moves and no seated one, so
  `loadFighter` now **merges** their own clips with the seated set from
  `fighter.glb` (32 in total) — that is why the fighter would not sit. The
  corner now runs itself: the cut-man brings water (+6) and says so, then the
  trainer says three lines out loud, drawn from the person's own supporter
  lines first (journal, their person, day count) and a short `ADVICE` list of
  plain corner talk after — nothing medical, nothing invented. The three
  buttons still work on top. **360 camera**: drag anywhere to swing right
  round the ring, two fingers or the wheel to come in and out, and it
  re-centres on every cut (`orbit`, `recentre`). Swipe-to-dodge is gone; the
  dodge buttons remain. Applied to both `game3d.html` and `tools/ring3d/`.
- **The Big Rumble look (10.7).** He sent Creed Champions screenshots as the
  target. Added: **sparks** off every landed punch (`sparks`, more on a power
  punch), a **streak behind the glove** that throws it (`trail`), the
  **connecting glove lights up** (`flashGlove`), a **lit blue ring canvas**
  with its own light, **red/white/blue padded corner posts**, the camera
  **leans** on a power punch (`roll`), and an arcade **HUD**: angled bars each
  side, the round and clock in the middle, stars for rounds taken, a SUPER bar
  in each bottom corner. The main camera dropped and came in so the two of
  them fill the frame.
- **Power punches and pressure.** One landed hook, cross or uppercut in four
  is a **power punch**: slow motion, a hard freeze, the camera leans, speed
  lines, `POWER`, and half again the damage. The addiction attacks far more:
  the gap between swings shortens each round (1.9 s down to 0.75 s) and it
  **doubles up** with a second swing about a third of the time, rising with
  the round; its own meter fills faster and blocks feed it too. Measured: four
  swings and 48 health in twenty seconds.
- **The camera moves on its own** (`camDrift`): a slow swing round, a slow
  push in and out, easing back to the shot a few seconds after you let go of a
  drag. Held still while a ring card or a count is read (`holdCam`).
- **The ring card leads into the bell.** Round order is now: the announcer
  calls the round, the ring girl walks out with the card and the camera goes
  with her (`girl`, `girlclose`), she holds it up, then the fighters take their
  marks, then the bell. The card rides above her hand in world space facing
  the camera, so her fingers never cover the number.
- **A real battle (10.8).** Nine more Mixamo moves from him (Boxing, Punching,
  Combo Punch, Big Hit To Head, Head Hit, Side Hit, Getting Hit Backwards,
  Stunned, **Sitting Drinking**) baked into `fighter.glb` (40 clips) and
  **added onto all five fighters** with `tools/mixamo/topup.*` — a glb-to-glb
  top-up, because the original character FBX files had been cleared for disk.
  Every fighter now has 40 (41 with the ref's walk).
  - **He sits properly at last.** The seated clip already puts the feet on the
    canvas with the hips at 0.545 m, so the root belongs at y=0, not 0.42 —
    that is why he was perched on the top rope. Stool is 0.50 m, top at 0.50.
  - **Rounds are 30 seconds** (`?secs=` still overrides).
  - **The addiction blocks**: 12% rising to 34% by the late rounds; a blocked
    punch does about a fifth and feeds its meter. It also throws far more
    (gap 1.5 s down to 0.62 s) and doubles up about half the time, and it uses
    the new punches and reactions; it plays `stunned` when it is hurt.
  - **The referee faces whoever is down and counts out loud**, one to ten, with
    "Are you alright? Come on." at eight.
  - **The entrances are grander and slower**: they start 9-11 m out, walk at
    0.66-0.8 m/s with two stops and two roars, and a **follow-spot tracks each
    fighter** up the aisle (the ring light does not reach out there) — white
    for the person, the addiction's own colour for it.
- The photo referee (`img/fight/ref.png`, `.g2-ref`, `gmRefCount`) is still what
  the app itself uses. She goes into the app with step 6 below, when the 3D
  fight replaces the photo boss on the roof; the app has no 3D engine before
  then.
- The fighters have no skin because `fighter.glb` is the grey X Bot stand-in and
  `convert.html` strips colour on purpose (black shadow boss). He asked why on
  6 Sep. A skinned fighter needs a Mixamo boxer character downloaded like Suzie
  and run through `convert-ref.html`, which keeps the colour map.

**What he asked for next, in order:**
1. ~~The ref switches to a Mixamo character~~ done (Suzie).
2. **Announcer** (photo + clips: standing, talking into mic, arm up for the
   winner) — introduces the person by name, days, boxer, then the boss.
3. **Round-card woman** (photo with a blank card held up + walking/holding
   clips) — walks the ring between rounds with the round number; tap the card
   to flip it to the corner's line.
4. **Corner people interactive** (cut-man, trainer: photo + clips) — between
   rounds tap for water (bit of health), towel (clear a hit), a word (the
   person's own journal line or their person's text). One tap each per corner.
5. **Every character interactive**: tap the ref for a warning, tap the boss
   while it winds up for a free block, tap yourself to hear your last counter.
6. Then put the 3D fight on the roof in the app in place of the photo boss,
   driven by the same rules already in `index.html`.

He sends art as zips (inline images do not always arrive as files). Boss
photos for every addiction are done; boxers 1,2,3,5,6,7,9 are complete sets;
the Latino man (4) and the white woman (8) are punch-only.

---

State as of 3 August 2026. Written so someone picking this up cold does not have
to rediscover it. Current version: **5.0.1** (`APP_VERSION` in `index.html`,
`tsid-shell-v5.0.1` in `sw.js` — the line was deliberately renamed from 12.x
back to 7, the same kind of reset done once before launch; the in-app updater
compares commit SHAs, so the number only has to change, never increase).

---

## What this is

A recovery companion — day counter, 30-day lesson programs, private journal,
SOS tools, and an AI companion called **Friendly**. Live, taking real payments.
One person built it and runs it.

Two audiences share the same app: people working on their own recovery, and
people supporting someone else. That split runs through the whole codebase.

## Shape of it

- `index.html` — the entire client, ~9,000 lines, no build step. Plain JS.
- `server/` — Node/Express, `node:sqlite`. `server.js` routes, `db.js` schema,
  `billing.js` Stripe, `store-billing.js` Play/Apple, `email.js`.
- `data/lessons/lesson1..13.json` → `node data/build-lessons.js` → `lessons.json`.
  **390 lessons, ~166k words. Never hand-edit `lessons.json`.**
- Lesson audio: real recordings (five Piper voices, same as the SOS talk) live
  on the repo's **`lesson-audio` branch** — never merged, served straight from
  `raw.githubusercontent.com`, so they add zero weight to Railway builds and
  home-install updates. The app ships only `data/lesson-audio-manifest.json`
  mapping `"Category|day|variant"` → per-voice file paths. **If lesson text
  changes**: `node data/build-lessons.js`, then
  `python3 tools/generate-lesson-audio.py <voices> <out>` (file names are
  content-hashed, unchanged lessons re-encode for free), commit the new files
  to `lesson-audio` and the regenerated manifest to main in the same change.
  No recording / no manifest entry = the app silently falls back to the
  phone's own voice, so audio can never hard-break the lesson screen.
- `twa/` — the Android wrapper config (see Android, below).
- Hosted on **Railway**, auto-deploys on push. Domain `www.turnsomedayintodayone.com`.
  The apex domain without `www` serves nothing.

### Two branches, always both
Every commit gets pushed to `claude/app-qc-competitive-analysis-lehsn9` **and**
`claude/vibe-code-uwxxlk`. The second is what Railway deploys.

### Versioning
Four files move together on every user-visible change: `sw.js` (`CACHE_NAME`),
`index.html` (`APP_VERSION`), `package.json`, `server/package.json`. The service
worker cache name must change or clients keep the old shell. The number was
deliberately reset from 35 to 7 before launch; it is now 5.0.1 (5.0.0 was a reset from 7.0.3 at the owner's request, 6 Aug 2026 — the number only has to change, never increase).

### Two gates that are easy to confuse
- `isSupporterUI()` — `S.userType === 'partner'`. About the **person**.
- `isSupporterTrack()` — `S.currentAddiction === 'Supporting Someone'`. About the
  **term** shown. Grammar belongs to the track, not the person.

## Android

The `.aab` is a **shell**. It contains no app content — it opens
`https://www.turnsomedayintodayone.com/app?src=play` full screen. Every Railway
deploy updates the Android app instantly, with no rebuild and no review.

Rebuild only for shell-level changes (package name, icon, splash color, target
SDK): `cd twa && bubblewrap build`, after bumping `appVersionCode` in
`twa-manifest.json`.

- Package `com.turnsomedayintodayone.app` — permanent, matches `assetlinks.json`.
- Signing: `twa/android-upload.keystore`, alias `upload`. **This file is the only
  way to ever ship an update to this listing.** Correctly gitignored (a keystore
  in git history is a public keystore), so its absence from the repo is by
  design, not a loss. **Backup verified by Jacques 2026-08-07: it lives on his
  computer and on a USB drive.** Don't re-flag this.
- `?src=play` is how the client knows it is the Play build and must route
  purchases to Google rather than Stripe. Do not remove it from `startUrl`.
- The Play-mode latch is **Android-only** as of 12.0.1. Opening `?src=play` in
  a desktop browser used to latch Play mode into localStorage forever, which
  blocked Stripe checkout from that browser with "In-app purchases are not
  available on this device". `detectPlayBuild()` now refuses to latch on a
  non-Android UA and clears a stale latch on load, so affected browsers
  self-heal. Do not paste the start URL anywhere a person might click it, all
  the same.

## Money

Two payment paths behind one entitlement model. `getBillingStatus()` in
`billing.js` is the single choke point — everything else reads `isPro`.

| Where | Processor |
|---|---|
| Web | Stripe |
| Android | Google Play (Digital Goods + Payment Request) |

Prices must match on both sides: **$9.99/mo, $59.99/yr, $149.99 lifetime**,
7-day trial on both subscriptions. Play product IDs are mapped literally in
`PRODUCT_PLANS` (`store-billing.js`) — an unknown ID is refused, never guessed.

`store-billing.js` is deliberately store-agnostic. Adding Apple means writing
`verifyAppleReceipt` and one line in `VERIFIERS` — no route, schema or
entitlement changes.

### Three things that are load-bearing and non-obvious

1. **Purchases are acknowledged.** Google refunds anything not acknowledged
   within 3 days. This was missing and every Android sale would have silently
   reversed while the customer kept Pro. Requires the *Manage orders and
   subscriptions* permission on the service account.
2. **Every refusal happens before the payment sheet opens.** On a store purchase
   Google takes the money before the server is consulted, so `storeBillingReady`
   and `lifetimeSoldOut` ride on `/api/billing/status` and are checked first.
   Anything that could reject a purchase must be knowable up front.
3. **Founding Lifetime is capped at 50**, counted across Stripe *and* Play in one
   pool (`countLifetimeSold()`). Enforced at checkout and before the sheet.

### Environment variables
| Name | Purpose |
|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Web payments |
| `PLAY_SERVICE_ACCOUNT_JSON` | Verifies and acknowledges Play purchases |
| `COMP_PRO_EMAILS` | Free Pro for the Play review account and testers |
| `APP_OWNER_EMAIL` | Gates `/admin/stats` |
| `ANTHROPIC_API_KEY` | Friendly |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email |
| `SESSION_SECRET`, `DB_PATH`, `APP_URL` | Core |

## Where the Play launch actually is

**Done:** app created, review passed, closed testing live, all declarations,
content rating (Teen), data safety, target audience 18+, store listing with real
screenshots, three products with trials, payments profile, 15% service fee
enrolment, service account wired up.

**Not done — the only real blocker:**
- **12 testers, opted in for 14 continuous days.** Currently 2 (both the owner's
  own accounts). The clock has not started. Production access needs this *and* a
  written account of how testers were recruited and what feedback they gave.
- **No real *Play* purchase has ever been made.** Everything up to Google's
  servers is tested; the last mile is not. After the first test purchase,
  **check three days later that it was not refunded** — that is the only proof
  acknowledgement works. Look for `ACKNOWLEDGE FAILED` in the error log.

  Do not let the Stripe side confuse this. **Stripe is proven and works.**
  Confirmed against the live account (`acct_1TvjcJCDHXSEg3rL`) on 27 Aug 2026:
  two live subscriptions, `app_user_id` 11 and 18, both Jacques's own accounts,
  and one real settled charge — `ch_3U1RLwCDHXSEg3rL0Ju6KvMj`, $9.99, 6 Aug
  2026, Visa debit ...8776, `status: succeeded`, never refunded. Trial started
  30 Jul, converted 6 Aug, cancelled 18 Aug. So checkout, the webhook, and the
  entitlement flip all work end to end on the web path.

  That proves nothing about Play. The two paths do not share code past
  `becomePro()`: the web path posts to `/api/billing/create-checkout-session`
  (`billing.js`), the Play path calls `becomeProViaStore()` →
  `getDigitalGoodsService` (`store-billing.js`). A Stripe purchase cannot even
  be *made* from inside the Play app — `becomePro()` refuses it as the policy
  line. So the fact that Jacques bought Pro with a card means he was in a plain
  browser at the time, not in the installed app. The broken path is still
  untested by that purchase.

Opt-in link (closed test — only works for addresses already on the tester list):

    https://play.google.com/apps/testing/com.turnsomedayintodayone.app

### Play Billing Library 8 — CLOSED. Already updated, no extension.

**Jacques, 26 Aug 2026: "it's already updated, no extension."** The shell is on
a current Google Play Billing Library. Nothing to do here. Do not re-open it.

**The extension was for Android 16 target SDK, not for Billing.** Jacques
requested that one on 17 Aug and it moved 31 Aug → 1 Nov. Earlier versions of
this file attached that extension to Billing 8 and invented an "Oct 31 Billing
deadline" from it. There is no such deadline.

If Play Console still shows a Billing Library tile, treat it as stale console
text. Do NOT tell Jacques it is new, do NOT request an extension, and do NOT
schedule a bubblewrap rebuild for it.

**Still true about the shape of the thing:** the Billing Library lives only
inside the Android shell. The website and the server are unaffected by anything
in this section, and a Play upload is only ever needed for shell-level changes
(icon, package config, target SDK).


## Testing purchases: never use the owner account

`isComped()` in `server/billing.js` grants Pro to `APP_OWNER_EMAIL` — and to
every address in `COMP_PRO_EMAILS` — with no payment. So a Pro badge on
Jacques's own account proves nothing about billing, and on 28 Aug it very
nearly went into the log as "payment system proven end to end". He caught it:
*"i already got all time pro on my owner account."*

**Test on a fresh address that is neither.** If you must use his, read
Profile → the subscription line, which distinguishes the two cases because
`getBillingStatus` resolves `paid` before `comped`:

- `Pro plan — Monthly` / `Yearly` / `Lifetime` → a real `user.plan`, written
  only by the Stripe webhook. The chain worked.
- `Pro plan — Complimentary` → `plan: 'comp'`, no payment involved. Whatever
  you were testing is still untested.

## The Play latch: why it is sessionStorage, and do not "fix" it back

A Trusted Web Activity **is** Chrome, sharing one storage jar with the browser
for this origin. So the old `localStorage` flag written by the Android shell
was read back by every ordinary Chrome tab and every Chrome-installed shortcut
on that phone, permanently — the site believed it was the Play build, routed
Upgrade to Google billing, and `create-checkout-session` refused Stripe by
policy (403 on `X-TSID-Client: play`). Combined with the broken shell, **every
Android owner of the app was unable to pay by any route.** Stripe had created
no checkout session between 30 July and 28 Aug.

The flag now lives in `sessionStorage` (one browsing context), and the legacy
`localStorage` key is deleted wherever found.

**Both directions are covered, and both were tested in headless Chrome on an
Android user agent — rerun these before touching `detectPlayBuild`:**

| Context | `isPlayBuild()` | Why it must be that |
|---|---|---|
| Play app launch (`?src=play`) | `true` | Play policy: never Stripe in the shell |
| Play app after a reload with no query | `true` | sessionStorage carries it |
| Play app returning from a redirect | `true` | same |
| Chrome-installed shortcut / plain tab | `false` | not Play-distributed; Stripe is correct and is revenue |

**Do not add a `display-mode: standalone` test as a backstop.** It looks
tempting and it is wrong: a Chrome-installed shortcut reports `standalone` too
(Jacques's 27 Aug screenshots show exactly that), so it would re-break the very
case this fixed. The honest discriminator once the shell is healthy is
`getDigitalGoodsService()` actually resolving; it cannot be used while the
shell is broken, because it rejects there too.

## Open bug

**The Android app is not running as a verified Trusted Web Activity, and that
is why nobody can buy Pro.** Settled 27 Aug 2026 by the app's own error text.
Read this whole section before changing anything — the cause was correctly
identified weeks ago, then talked out of by me on the same day, then confirmed
again. Do not restart that loop.

### The proof, in Jacques's own screenshot

The failure dialog (app 5.8, which prints the real error) reads:

    failed while opening the store connection.
    OperationError: unsupported context
    bridge=present · playBuild=yes · display=standalone · engine=Chrome 151 · app=5.8

`unsupported context` is not a generic failure. It is Chromium's
`kUnsupportedContext` from `DigitalGoodsFactoryImpl`, surfaced as an
`OperationError`, and it has exactly one meaning: **the document calling
`getDigitalGoodsService()` is not inside a Trusted Web Activity.** The address
bar across the top of that same screenshot says the same thing visually.

### The trap that cost a day — do not fall in it

`bridge=present` does **not** mean the billing bridge works.
`storeBillingAvailable()` only tests `'getDigitalGoodsService' in window`, and
that function exists in ordinary Chrome on Android. It is there, it is
callable, and outside a TWA it rejects. So:

- The purchase sails past the `storeBillingAvailable()` guard and its message
  ("In-app purchases are not available on this device") never appears.
- It dies in the deepest catch instead, which used to print only "Could not
  complete that purchase."
- On 27 Aug I read that message as proof the bridge was working and **wrongly
  retired the Digital Asset Links diagnosis.** It was right. `display=standalone`
  misleads the same way — Chrome reports standalone here even with a visible
  address bar.

The 12:39 screenshots with no address bar were a **separate installed PWA**
(he had just used Chrome's "Install and create shortcut" at 12:38), not the
Play app. A Chrome-installed PWA is also not a TWA, so it fails identically.

### Where the fault is not

- **The served file is correct and reachable.** Google's own validator returns
  both statements cleanly for the host the TWA launches:

      curl "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.turnsomedayintodayone.com&relation=delegate_permission/common.handle_all_urls"

- **The host matches.** `twa/twa-manifest.json` has
  `host: www.turnsomedayintodayone.com`, `startUrl: /app?src=play`, and
  `.well-known/assetlinks.json` declares `com.turnsomedayintodayone.app`.
- **Not the apex.** `turnsomedayintodayone.com` does fail the validator with a
  redirect error, but nothing launches the apex. Ignore it.
- **Not Samsung Internet.** `engine=Chrome 151`.

### Signing is ruled out — do not look there again

Jacques read both SHA-256 values off Play Console → App signing (direct link:
`.../app/4972165923818128065/keymanagement`) on 27 Aug 2026. Both match
`.well-known/assetlinks.json` character for character:

    99:D2:75:… app signing key (classical)   — present in the file
    91:7B:4C:… upload key                     — present in the file

The "Quantum-ready (beta)" badge and the *Previous app signing keys* row dated
28 Jul 2026 look alarming and are a red herring; the classical fingerprint in
use is the one already listed. Ignore the post-quantum column entirely —
Chrome's asset-link check does not use it.

### What is actually still open

**Nothing in this repo proves what the shell in the Play Store contains.**
`twa/twa-manifest.json` was added on 24 Aug 2026 (commit `614864e`) as a
reconstruction. The `.aab` that is live was built on Jacques's PC well before
that, and `git ls-remote` shows **no `twa-build` branch**, so the CI workflow
that would build from this manifest has never produced an artifact. Two
settings that the live shell may therefore lack, either of which alone causes
what we see:

1. **`features.playBilling.enabled`** — the repo manifest has it true. Bubblewrap
   does **not** enable it by default. Without it the Android shell omits the
   Play Billing delegation and `getDigitalGoodsService()` rejects with exactly
   `unsupported context`, even inside a perfectly verified TWA.
2. **`host`** — the repo manifest says `www.turnsomedayintodayone.com`. If the
   live shell declares the **apex** instead, Chrome fetched
   `https://turnsomedayintodayone.com/.well-known/assetlinks.json`, got the
   301 to www, and failed: asset-link fetches do not follow redirects. Google's
   validator returns `ERROR_CODE_REDIRECT` for the apex and full statements for
   www. That would explain the address bar as well.

**Fixed here (27 Aug):** `server.js` now serves `/.well-known/assetlinks.json`
before the apex→www redirect, so both hosts return it with a 200. Verified by
replaying both middlewares in registration order against real `Host` headers —
apex and www both 200 `application/json`, and every other apex path still 301s
to www. This removes cause 2 without a Play upload.

**Cause 1 is also weaker than it looks.** `PLAY-CHECKLIST.md` records that the
live 1.0.1 / code 2 bundle was built on 17 Aug from this very manifest, with
"Play Billing on, notifications on, Android 16, Billing 8". So the live shell
probably does carry the billing feature and the `www` host. Do not order a
rebuild as the first move; it is a real cost to Jacques and may change nothing.

**What app 5.9 adds, and why it is the next step instead.** One thing has never
been established: whether the failing window is the Play shell at all. The
`playBuild` flag latches into `localStorage` and, on Android, is permanent — a
single visit to `/app?src=play` in ordinary Chrome latches it forever, after
which every Upgrade tap routes to Play billing and fails exactly like a broken
shell. Jacques also installed a PWA from Chrome's menu on 27 Aug, which is a
third context that looks like the app and is not.

So the latch now records **how** it was set — `referrer` (an `android-app://`
launch, which is proof the shell opened the page), `param` (a query string,
which proves nothing), or `unknown` (the legacy `'1'`, never upgraded to
`referrer` because that would invent evidence). The diagnostic line adds
`host=`, `launch=` and `latch=`.

**The answer came back at 14:06 on 27 Aug, and it is `launch=shell`:**

    bridge=present · host=www.turnsomedayintodayone.com ·
    launch=shell · latch=referrer@2026-08-27T19:05 ·
    display=standalone · engine=Chrome 151 · app=5.9

`launch=shell` means `document.referrer` was `android-app://com.turnsomedayintodayone.app`
— the Android shell itself opened this page. Not a stale flag, not the PWA, not
a browser tab. `host=` is the exact host the file is served under. And the
address bar is still across the top.

**So this is now established, not inferred: the Play app launches, on the right
host, and Chrome refuses to run it as a verified TWA.** Everything on the
server side checks out, so the fault is in the installed shell or in Chrome's
verification of it — the one component nothing in this repo can inspect.

Historical read of the field, kept because the reasoning still holds:
- `launch=shell` → the Android app really did open this page, the shell is at
  fault, and a rebuild is then justified.
- `launch=param` or `launch=none` with `latch=unknown` → this is not the Play
  app. Nothing about Play billing has been tested yet, and the rebuild would
  have been wasted.

**Still needs Jacques:** rebuild the shell from `twa/twa-manifest.json`, sign it
with the upload key, and upload it. That is the only way to settle cause 1.
Run the `Build the Play app (.aab)` workflow (`workflow_dispatch`), take the
unsigned bundle off the `twa-build` branch, sign, upload, then reinstall on the
phone. Bump `appVersionCode` past whatever is live before building.

Install, use, the 14-day tester clock and reviews all work. Purchases do not.
Do not call this cosmetic.


app, reopen.** That is a 30-second test and it costs nothing.

## Marketing pages (SEO surface)

Static pages served by explicit routes in `server.js`, all listed in
`sitemap.xml` (with `robots.txt` pointing at it) and linked from the homepage
footer so Google can crawl them:

- `/when-he-drinks` — partner landing, the drinking angle. Bio links
  `/go/tiktok|youtube|facebook` redirect here with UTM tags attached.
- `/for-her` — the broader partner page, PDF email gate.
- `/is-my-husband-an-alcoholic` — **added 5 Aug 2026.** Lowest-difficulty term in
  the keyword set. Refuses to diagnose anyone, reframes the question onto her own
  life, and routes to `/quiz` (primary CTA) and `/for-her` (secondary). Same
  voice, layout and crisis-resources block as `/when-he-drinks`.
- `/quiz` — clean URL for `quiz.html` ("The 2-Minute Check-In"), added so videos
  can say the address out loud.
- `/best-recovery-apps` — our own honest roundup, competitors included.
- 16 `*-alternative` pages — one per competitor app.
- `/brainreset`, `/privacy`.

**Rules for anything new here:** no medical claims, no "research shows", no brain
chemicals (see `reference/medical-claims-audit.md`). Crisis resources (988 and
the DV hotline) go *above* any signup button on pages that reach people living
with active drinking. Add the route in `server.js`, the entry in `sitemap.xml`,
and a footer link on `landing.html`.

**Keyword decisions live in `KEYWORDS.md` at the repo root** — it is the only
source of search data now that Semrush is disconnected. Only build for terms
marked "Build"; never for "Skip" or "Too hard", whatever the volume. Don't
re-run keyword research. The marketing agent
(`.claude/agents/recovery-app-marketer.md`) is bound to that rule and will stop
and ask if the file is missing rather than guess.

**Repo audit, 6 Aug 2026 (full sweep, nothing deleted):** no split, duplicate,
partial, or orphaned files anywhere — same-name files across `Studio/` and
`TurnSomeDayIntoOneday/` are two separate apps, never to be merged. All routes,
sitemap entries, and internal links verified against real files. Fixed then:
three `/quiz.html` links normalized to the canonical `/quiz` route
(`index.html`, `landing.html` ×2), and two stale references to the renamed
`ai-shorts-scripts.md` now point at `AI-SCENES.md`. `KEYWORDS.md` was found to
have never been committed despite this file and the marketer agent depending on
it — **fixed same day**: built at the repo root from a live Semrush pull
(US, 6 Aug 2026) with every term tagged Build / Too hard / Skip.

**`COMPETITORS.md`** (repo root) is a monthly structural log of accounts serving
the partner angle — hook type, length, format only. It exists to inform
structure, never copy. Nothing there gets reworded into our content.

## How to work with the owner

- **One instruction at a time.** Not a numbered list — one step, wait, next.
- **Exact button labels**, exactly as they appear on screen.
- **Always state prices.** Free or a number, never vague.
- **He writes the marketing copy.** Never invent a tagline, headline or store
  description for him. In-app content he explicitly requests is fine.
- **Verify before asking him to retest.** Asking him to test something that was
  never actually deployed wastes his time, and he will say so.

## Testing

Playwright, headless Chromium at `/opt/pw-browsers/chromium`,
`NODE_PATH=/opt/node22/lib/node_modules`. Server on port 4300 from the
`TurnSomeDayIntoOneday/` directory.

Rate limits bite during test runs: signup is 5/hour/IP, chat 20/5min. Restart
the server between full runs.

Store-billing tests stand in a fake `androidpublisher` and assert on the actual
HTTP calls — that is how acknowledgement is verified without a device.

## 7 Sep 2026 — the entrances, and a wider screen (10.9)

Three things Jacques asked for after 10.8, all in `game3d.html` and mirrored in
`tools/ring3d/ring3d.html`:

1. **The crowd was standing in front of the addiction's walk-in.** The old
   entrance camera sat at a fixed point beyond the seats (`SHOTS.far`) and
   looked back down the aisle, so the front two rows were between the lens and
   the fighter. Gone. There is now a camera man who walks with each fighter —
   `camWalk(F,'front'|'back')`, `walkPos()`, `walkLook()`, a `SHOTS.walk` that
   is recomputed every frame. `front` is a head-on hero shot 2.4 m ahead of
   them; `back` rides 2.1 m behind their shoulder looking down the aisle at the
   ring. Nothing can get between the camera and the fighter in either.
   The seats also moved: wider apart and 0.7 m further back, so the aisle is a
   real corridor.
2. **The aisle is lit.** A glowing runner on the floor plus four travelling
   lights (`aisleOn`/`aisleOff`), blue for you and the addiction's own colour
   for it, so the walk-in is not a walk through a black room.
3. **Nobody is cut off at the edges.** Two parts. In the fight page, the lens
   now widens itself on a tall phone (`fitFov()` holds roughly a constant
   *width* in shot, 46°–68° vertical) and the aim drops slightly so the sky
   does not eat the top of the frame. In the app, the fight now takes the whole
   screen: `#g2` gets `g2-full` while the 3D fight is mounted (fixed, inset 0,
   full width) and drops it again on the win or loss screen. It was a 480 px
   column before.

Checked in headless Chromium at 390×844: your walk, the addiction's walk from
three angles, the centre-ring introductions, and the round itself. The full
screen class was measured on a 820×900 window — 430×768 before, 820×900 after.
The signed-in app on the live site was not tested from here; the container
cannot reach turnsomedayintodayone.com.

## 7 Sep 2026 — an empty ring, and stepping through the ropes (11.0)

- **The addiction is no longer waiting in the ring.** Both fighters, the
  addiction's glow, its floor light and its prop are hidden at the top of
  `ringWalks()`. Only the announcer, the referee and the ring girl are in there
  when the show starts. You appear at the head of your aisle when your walk
  begins; the addiction does not exist until the announcer says "and his
  opponent".
- **Nobody walks through the ring any more.** The ropes are kept per side
  (`ROPES.N/S/E/W`) and `partRopes(side,open)` drops the bottom two and lifts
  the top one while a fighter steps through, then puts them back. Each fighter
  stops at the ring edge, the ropes part, and a camera stood inside the ring
  (`entryShot`) watches them come in — no crowd or corner man can cross that
  shot.
- **The crowd reads as a crowd.** One long dark riser a side instead of a crate
  under every body, every body a slightly different size, angle and place,
  materials darkened so they sit in shadow instead of being lit like the ring,
  and the coloured house lights and aisle lights turned down so the front row
  is not blown out.
- The ring girl stood in the red corner, which put her in the middle of the
  addiction's entrance and beside the main TV camera. She now stands on the far
  side, clear of both corners.

Checked in headless Chromium at 390×844: the empty ring during your walk, you
stepping through the near ropes, the addiction's walk-in, it stepping through
the far ropes, and the centre-ring introductions.

## 7 Sep 2026 — Auto play, named fighters, colour (11.1)

- **Auto.** `youAI()` in the fight boxes for you: it punches, dodges, blocks,
  answers the line the addiction throws during its tell, and takes water or a
  word in the corner. It is ON when the fight opens, so the whole thing plays
  through by itself. Touching any punch, dodge, block or swipe turns it off and
  hands the fight back; the Auto button turns it on again. It deliberately
  leaves gaps between its own actions — without them the addiction never gets a
  turn, because a swing needs `!busy` (measured: 99–0 with no gaps, roughly
  74–40 with them).
- **Fighter 1 to Fighter 5.** The picker in the fight says so instead of bare
  numbers, and the app's roof door now has the same picker — it had none, and
  the fighter was derived from the old photo-boxer number. `gameFighter()` and
  `gameSetFighter()` in index.html; `g.fighter` in the saved game.
- **The addiction keeps its colour.** `bossLook` painted the body near-black
  once it was in the ring, so it walked in gold and fought black. The body is
  now its own glow colour, dark (glow × 0.13) with a low emissive of the same
  colour, all the way through.

Checked in headless Chromium: the menu with the Fighter buttons and the gold
addiction, an auto-played round with both fighters landing, and the corner.

## 7 Sep 2026 — ninety levels, and the buttons are gone (12.0)

Jacques: *"i dont like your level ideals and levels get locked if you dont do
the work in the app and when the addiciton is saying its temptation that take
away those buttons … every fight gets difficult the fight scene always change
its does ends 90 levels like the app 90 day program"*

- **Ninety levels.** `GAME_LEVELS=90`, `g.b` clamped to it, `gameTier` split in
  thirds (1–30 / 31–60 / 61–90), the door and the top strip read "Level n of
  90", and clearing 90 goes to `renderNinety()` — the game ends, the person is
  never told they are finished, and `gameRestartLevels()` walks it again.
- **Locked without the work.** `gameWorkToday()` — today's lesson, a journal
  line, the pledge, or a craving logged. The roof door needs it as well as the
  old post-loss lock.
- **The two answer buttons are gone.** `askLine()` (question, right answer,
  wrong answer, `#talk` panel) is now `temptLine()`: the addiction just says the
  thing it says while it leans. Reading the lean is the whole defence, and
  slipping it now pays a counter hook, which is what the right answer used to.
- **Harder every level**, driven off the level number: `tellMs()` 1900 → 900,
  `hitDmg()` 11 → 22, `bossBlocks()` up to 45%, the swing gap down to 460 ms.
- **The scene changes.** Six moods for the canvas and the ring light rotate with
  the level on top of the three roofs.
- **Every temptation, per addiction.** `GAME_TEMPT` in index.html (13 tracks)
  and the built-in `LINES` in the fight: what each one actually says to get
  someone to engage — just one, you've earned it, nobody will know, start again
  tomorrow, it's how you cope. The ones the app does not name a track for live
  under Other/The Habit, which covers vaping, caffeine, streaming, picking,
  spending, the phone at night. No medical claims, nothing that blames anyone.

Checked in headless Chromium: index.html loads clean with GAME_LEVELS 90 and 13
temptation sets, and the fight at levels 1, 2 and 45 shows the tell shortening,
the damage rising and the canvas colour changing, with an auto-played round
through the bell and no page errors.

## 7 Sep 2026 — Auto is a preview, not a fight (12.1)

Settled: *"auto is just a preview not a fight it stops as soon as the user rings
the bell."*

- The fight page opens in **preview**: it starts itself and boxes both sides, so
  the person watches a real fight play out without touching anything.
- **Ringing the bell ends the preview** and opens the same page with `?live=1`,
  which starts the fight with Auto off and the person in the controls. Touching
  any punch, dodge or block during the preview does the same thing — your fight
  starts.
- The Auto button now only goes back to the preview; it can never take a live
  fight over.
- Done as a reload rather than an in-place restart on purpose: the ring walks
  are a long chain of awaits with no way to cancel them cleanly, and a reload
  guarantees the live fight starts from nothing. The models come from the
  browser cache, and the app re-posts its settings on the iframe's load event.

Checked in headless Chromium: the page with no parameter comes up with auto on
and the preview running; `?live=1` comes up with auto off and the fight running.
No page errors either way.

## 7 Sep 2026 — the mission: buildings, floors, elements (13.0 / 13.1)

New concept, replacing the ninety levels. Spec in docs/GAME-SPEC.md.

**In the fight page (13.0).** `FLOORS` (ten elements), `floorN` from `?floor=`
or postMessage, `setElement()` building each one live in the ring out of points
and lines — rain that falls and splashes on the canvas, fire climbing, wind
streaks, drifting earth, ash, ice with a frost sheen, smoke, lightning that
flashes and shakes the room, blown sand, rising shadow with a veil over the
arena. The ring takes the floor's colours and the addiction wears them; the roof
keeps the addiction's own colour. Difficulty is one continuous curve —
`step()` counts every floor of every building and `ease()` flattens it, so
`tellMs` runs 1.9s down towards 0.9s, `hitDmg` 10 up towards 26, the guard up to
46% and the swing gap down to 430ms, forever, without becoming unbeatable.

**In the app (13.1).** `GAME_BUILDINGS` (thirteen, each with its kind and the
track its temptations come from), `GAME_ELEMENTS`, `GAME_FLOORS=10`.
Screens: `renderApproach()` — the street, the building, its name across the
front; `gameGoIn()`; `renderFloors()` — the stairs, ten floors and the roof,
cleared/here/locked; `gameFloorGo(n)`; `renderRoofDoor()` now the door of
whichever floor you are on; `game3dWon()` clears a floor and moves you up;
`renderJump()` — the chute, after the roof; `gameNextBuilding()` lands you in
the next street. The opponent now comes from the building, not the person's
track, and the temptations come with it.

Checked by driving the flow in a headless browser and reading what each screen
rendered: approach shows The Drink, the stairs show eleven, the door reads
"floor 1 · Rain", a win reads "Floor clear", the roof win reads "The Drink is
done", and the next building is The Screen. No page errors. Not seen by eye —
the game screens sit behind the sign-in wall and this container has no account.

**Still to do:** the thirteen building fronts (`img/fight/bld-*.jpg`) are not
drawn yet; the approach falls back to whatever `gmPhoto` finds. The prompts for
them are in the chat of 7 Sep.

## 7 Sep 2026 — the rooms and the buildings arrive (13.2)

Jacques generated the artwork from the prompts and sent it up.

- **Ten rooms**, one an element, plus a plain one spare:
  `img/fight/ring-{rain,fire,wind,earth,ash,ice,smoke,lightning,sand,shadow,plain}.jpg`
  — 1024 px wide, about 1 MB for the set. `setRingPic()` puts the floor's room on
  the backdrop wall; the roof keeps the temple/tomb/monastery picture.
  The preview (`tools/ring3d/ring3d.html`) carries 512 px copies inside itself
  as data URIs, 331 KB, so it still fits the artifact ceiling.
- **Thirteen building fronts**: `img/fight/bld-<key>.jpg`, 900 px wide, 2 MB for
  the set. `renderApproach()` was already asking for them, so the street now has
  the real building on it with its name across the front.

Checked in headless Chromium at floors 1, 2 and 10: the right room is on the
wall each time and no page errors. Floor 1 photographs well — the flooded
warehouse behind, rain falling through the frame, splashes on the canvas.

## 7 Sep 2026 — thirteen rooms, and every building deals a different hand (13.3)

Three more rooms arrived: a foggy dungeon (**Rust**), a worn jail cell (**Void**)
and an abandoned hospital (**Metal**). Each got its own effect —
rust is a wet brown haze with flakes coming off the walls; void has nothing
falling at all, the room empties and what is left is pulled inward under a heavy
veil; metal throws cold blue-white sparks off the walls.

Thirteen rooms and ten floors, so the floors now rotate: floor *n* of building
*b* is room *(b + n)*. Building 1 opens in Rain, building 2 opens in Fire,
building 11 in Rust — no two buildings climb through the same ten rooms in the
same order, and all thirteen get used.

Checked in headless Chromium: Rust, Void and Metal all build their effect and
load their room, and building 2 floor 1 comes up Fire, which is the rotation
working. No page errors.

## 7 Sep 2026 — the camera never sits still in the preview (13.4)

The director used to cut only during a round, and only every third tick. In the
preview it now cuts every 3.4 seconds through the whole room — ringside, over
the shoulder, down on the canvas, up in the house, in the corner — and it keeps
cutting between rounds and in the corner, not just while the bell is going. It
stands off during the ring walks and the rope entries, where the walking cameras
are in charge, and while somebody is down. A live fight is unchanged.

Checked in headless Chromium: through 42 seconds of preview the camera moved
through tv, shoulder, low, crowd and corner and back round, and the camera
position changed on every cut. No page errors.

## 7 Sep 2026 — four fixes from watching it (13.5 / 13.6)

- **The preview picks a fighter.** With no fighter set it used to open on the
  same one every time; it now draws one of the five, and ringing the bell carries
  that fighter into the live fight. The app's own pick still wins.
- **The referee watches the fighters.** She stood at a fixed angle facing nothing.
  During a round she now turns to keep the midpoint between the two in front of
  her, easing round rather than snapping, and stands off while she is walking or
  counting. Measured: zero degrees off across five samples of a live round.
- **Everybody got out of the ring.** The announcer, the ring girl, the trainer,
  the cut man and the addiction's two were all standing inside the ropes, which
  are at ±2.6. They now stand outside, near the corner they belong to, facing in.
  Measured during a round: you, the addiction and the referee inside; all six
  others outside. The corner men still come in between rounds, as they should.
- **The ring girl does one lap, not three.** She used to walk to a mark, walk to
  the middle, raise her arm and only then have the card, then walk two more legs
  to get out. She now carries the card in, holds it up in the middle, and walks
  straight back out.
- **The ropes lift and they bend under.** The bottom rope stays where it is and
  they step over it; the top two lift to 1.44 and 1.88 and the fighter bends
  forward (a 0.46 rad tilt) to come through underneath, then straightens up.

## 7 Sep 2026 — stepping over the bottom rope (13.7)

*"her leg didnt lift"* — the fighter walked straight through the bottom rope.

`fighterWalk` used to write the whole position vector, which flattened any
height a fighter was at. It now carries x and z only and leaves y alone, so a
fighter can be lifted while they walk. Going through the ropes now rises 0.34
and bends 0.46 rad at the same time, walks through, then straightens and comes
back down — the feet clear the bottom rope instead of passing through it.

Honest limit: this lifts the whole body, it is not a leg animation. None of the
forty Mixamo clips is a climb-through. A real one — hand on the top rope, one
leg over, head under — needs a clip from Mixamo or a pass in Blender.

## 7 Sep 2026 — the card looks like a card (14.0)

From three reference photos: hard shafts of light in the dark, the spray off a
clean shot, a fighter slumped after a knockdown.

- **The entry.** Three hard shafts of light over the ring (`shaftsOn`/`shaftsOff`,
  additive cones that breathe), white for your walk and the addiction's own
  colour for its walk, over the dimmed house.
- **A gate in the ropes.** `partRopes` now drops the bottom rope flat to the
  canvas (0.04) and lifts the other two to 1.58 and 2.02, so there is a real
  doorway. They walk through nearly upright and it shuts behind them.
- **Hits.** An expanding ring of force at the point of impact (`impactRing`), a
  burst of sweat off the head (`sweat`, droplets with gravity that die on the
  canvas), and the camera itself takes the punch — `camKick` shoves it along the
  line of the shot for 170 ms. Longer hit-stop on the ones that land clean.
- **Knockdowns.** Longer slow motion, a hard freeze, the camera rolls, and the
  house drops to almost nothing with a single hard spot on whoever is down
  (`koLights`).
- **Getting up is not clean.** After the count they come up on the `getting_up`
  clip and then `stagger()` — a wobble left and right that settles over about a
  second and a half before the guard comes back.
- **Sweat and breath through the round.** Under 42 health they drip and you hear
  them breathing; under 22 it is heavier and faster. The breath is synthesised
  noise through a bandpass, so there is no file to license.
- **The referee stops it.** Not only three knockdowns: if somebody has already
  been down and gets caught again below 9 health, the referee steps in, says
  "That is enough. It is over," and it is a TKO.
- **Seven gloves** instead of three: red, blue, white, black, gold, green, pink.

Checked in headless Chromium: the gate opens to 0.04/2.02 on the entry; eleven
sweat droplets in the air with both fighters tired; the referee stopping a fight
returns `tko`; the knockdown lights come back up afterwards. No page errors.

## 7 Sep 2026 — the announcer stopped saying "he" (14.1)

Five fighters, men and women, and the announcer called every one of them "he":
*"Making his way to the ring…"* and *"And his opponent…"*. They are now
*"Making the walk to the ring…"* and *"And the opponent…"*.

Swept the rest of the fight and the game screens in the app: no other spoken or
written line names a gender for the fighter or the addiction. The only "she" and
"her" left are code comments about the referee and the ring girl, who are
particular characters, not the person playing.

Checked by reading every line the fight actually said through a walk-in and a
round: none gendered.

## 7 Sep 2026 — feet on the canvas, and taller ropes (14.2)

*"why he floating"* — he was. Every body is scaled to 1.8 m at load, but these
models do not all have their feet at their own origin, so the taller ones stood
in the air above the canvas. `skinned()` now measures the bottom of the body
after scaling and drops it so it touches the floor. Measured after the change:
you 0.000, the addiction 0.001, the referee 0.000, the announcer 0.000, the ring
girl -0.006. The crowd is untouched at 0.422 — they sit on risers.

*"raise the ropes higher"* — with bodies that size the ropes sat at the waist.
They now run at 0.62, 1.12 and 1.62, the posts and pads grew to match, and the
gate opens to 2.05 and 2.62 so the tallest of them walks through without
ducking.

## 7 Sep 2026 — the TKO moves to the end, cameras follow, the preview is a real fight (14.3)

- **TKO at the end.** Jacques: *"tko is at the end of the fight if none gets
  knocked out."* Six rounds with nobody counted out is now announced as a
  technical knockout on the cards. (In real boxing that is called a decision and
  a TKO is a stoppage; his call, his game.) The referee no longer waves a fight
  off mid-round for low health — that experiment is out. The three-knockdown
  stoppage, which was always in the spec, stays.
- **No camera points at dead air.** Every camera except the walking ones and the
  ring card now keeps the middle of the two fighters in frame, easing on to it
  rather than snapping; between rounds it holds on whoever is on the stool.
  Measured through a round: never more than 0.21 m off the middle of the two,
  and 0.00–0.02 m on the shoulder camera.
- **The addiction stopped losing every preview.** Three reasons, all fixed:
  a slip paid a free counter *every* time (now 42% of the time, and for less);
  the preview player read the lean almost perfectly (it now draws a form for the
  night, 0.28 to 0.78, and reads it that well); and the addiction lost its turn
  whenever the person was mid-punch, because a swing needs `!busy` — it now
  waits for an opening instead of skipping. Measured before: 88–0 in landed
  punches. After: 42–16 at a form of 0.63, with the addiction landing all round.

## 7 Sep 2026 — no dead air in the introductions either (14.4)

The camera tracking from 14.3 only ran while a round was on, so during the
introductions and the referee's instructions the preview director could cut to
the corner or the house camera and point at an empty post. It now holds the
fighters whenever a fight is on, introductions included. The referee gave the
instructions to the camera; she now gives them to the fighters, and keeps facing
them between rounds too. Measured during "Protect yourself at all times": camera
0.21 m off the pair, referee 0° off.
