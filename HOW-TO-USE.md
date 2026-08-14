# 🎬 Studio — Owner's Manual

*Everything you need to run Studio. No tech knowledge required.*

> This is **Studio**, your music-video maker. Start it with **Start Studio** — it opens at **localhost:4400**. (Studio is now its own standalone download; nothing else comes bundled with it.)

---

## No subscription. Ever.

Studio isn't rented. There's no monthly fee, no plan, no seat, no trial that turns into a bill. You run it on your own computer, your files stay on your own drive, and it keeps working whether or not you ever spend another cent.

The only money that ever leaves your pocket is **AI generation**, and it works like a pay-as-you-go phone: you put a few dollars on a fal.ai account, each button tells you what it costs *before* you tap it, and when you stop tapping, the spending stops. No auto-renew to cancel.

**If your budget is tight, read this bit:**
- **Most of Studio is free and unlimited.** Whole videos, captions, shorts, editing, mastering — see *What Things Cost* below for the full list.
- **Set a daily cap** (⚙ Settings → daily spend cap). Say $2. Studio then flat refuses any generation that would go over it. Overspending becomes impossible, not just unlikely.
- **You already own more than you think.** Photos you've taken, clips you've filmed, your own voice — all of it can go straight in, free. Generating is for the shots you *can't* get any other way.
- **Draft cheap, finish expensive.** Make it on the cheapest tier, and only re-make the keepers on Best.

---

## The 5 Golden Rules

1. **Always start Studio with `Start Studio`** (the file with gears). Never by opening index.html.
2. **The black window IS the app.** Keep it open while you work. Close it when you're done.
3. **The address bar must say `localhost:4400`.** If it says "File C:/..." you opened the wrong thing.
4. **Free stuff is unlimited. AI stuff costs cents.** Every AI button shows its price before you tap it.
5. **Not sure what a button does? Hover your mouse over it.** A little note appears explaining what it does and whether it's free or a spend button.

---

## 1. Starting the App (every time)

1. Open your app folder
2. Double-click **Start Studio**
3. Black window opens → browser opens by itself → you're in

That's it. No internet needed except for AI generations.

---

## 2. First-Time Setup (only once)

1. **Sign up** — Studio greets you with a welcome screen: type any email + a password and your account is created right there. It lives only on your computer. Tap the **👁 eye** in the password box to check what you typed. To leave, there's **Sign out** in the top bar — it signs out only the device you're on, so the computer stays signed in when you sign out on your phone.
2. **Turn on AI** — Studio → **⚙ Settings** tab → **🔑 AI key (fal.ai)** → paste your key → Save.
   The badge at the top says **AI READY** when it worked. (AI buttons like Sing/Animate stay hidden until the key is set.)
3. **Credits** — your fal.ai account needs money on it ($10 lasts a while). No credits = every AI button fails.

---

## 3. The Six Tabs

| Tab | What it's for |
|---|---|
| **🖼 My Media** | Your home base — every picture, video clip and song you've uploaded or made, shown as thumbnails, split into Pictures / Video clips / Songs. Upload here, and "Open my media folder". |
| **AI Scenes** | Make AI images (1–4 takes at once), animate them into clips, **Sing** (lip-sync), dance, Live Portrait, simple screens. Your **Library** (with its free editing tools, incl. the **Sing** button on each picture) lives here. |
| **Characters** | Your stars — photos + a trained face lock so every scene shows the same face. Paste a LoRA URL + trigger word here to restore a face lock. |
| **Sequencer** | Where videos get made — Quick Video, timeline, lyrics, shorts, everything. |
| **📅 Post** | Your posting schedule — line up finished clips with captions and times, and Studio tells you the moment each one is due. |
| **⚙ Settings** | AI key, open Studio on your phone, update the app, back up everything, and **🗑 Start fresh** (wipe everything). |

The Sequencer opens simple (3 cards). Tap **🛠 Show studio tools** for the full editor.

---

## 4. Make a Music Video (the recipe)

**The 5-minute way (Quick Video):**
1. Sequencer tab → pictures come from either place:
   - **1️⃣ Add pictures from this device** — photos off your computer or phone
   - **🖼 Use pictures made in Studio** — a grid of everything Studio has already made for you (AI Scenes, Storyboard). Tap to add; anything already in the cut goes dim with a green edge so you don't double it up
2. **2️⃣ Add your song** — or paste a **Suno link** (Share → Copy link) in the box underneath and press **🔗 Import**; the song downloads straight into Studio
3. Pick a shape: Phone 9:16 · YouTube 16:9 · Square 1:1
4. **▶ Preview — free, instant** to watch the plan before spending a render: order, timing, camera moves, words and blends play right in the browser with your song. Rough on purpose — the render is smoother, and looks like grain or slow-mo are done properly at render — but it answers "is this the video I meant?" in seconds instead of minutes. Tap again to stop.
5. **3️⃣ Assemble my video** → wait for the bar → **Download my video**

**🎯 Fit shots to song length** — one tap scales every picture's time so the finished video (blends already subtracted) lands exactly on your song's last note. Clips you filmed keep their own length; only stills stretch. Set your relative rhythm first (which shots hold longer), then fit.

**Your plan survives a refresh now.** Quick Video shots — order, times, words, effects, positions — are saved on every change and come back when you reopen Studio. A picture deleted from the library since is quietly dropped, never guessed at.

**"⚡ Cut on the beat" — leave it on for songs, turn it OFF for slideshows.**
It's ticked by default, and on a song it's exactly what you want: every cut
lands on the music. But it works by rounding each picture up to a whole musical
bar, with a minimum of 1.5 seconds — so on a sparse instrumental, or any cut
where you asked for short holds, it can stretch a 17-second piece past 30.
**Untick it whenever you've set your own times and want them respected.**

**🏁 End with a 3-second CTA card (b0857)** — ticked by default. Every Quick
Video finishes on a dark card with your big line and the small line beneath it
(edit both in the boxes — the defaults point at your 2-minute test). The card
is drawn in the video's own shape and held for 3 seconds, so every piece of
content ends at your funnel instead of a dead stop. It's remembered in saved
templates, so a series keeps the same card without re-typing it. Untick it for
slideshows or anything that should end cold.

### Typing your own shot list (the paste box)

Instead of setting every picture by hand, you can paste a whole plan — one line
per shot — and Studio fills the rows in order. It reads three things off each
line and puts whatever's left in the caption:

```
1. 2s  slow push in   Nothing looked wrong.
2. 1.3s hold          Not from the outside.
3. 4s  drift left     That was the whole trick.
```

- **Two optional columns, both needing their prefix:** `words safe` /
  `words bottom` / `words top` / `words center` (and the corners) sets where
  that shot's text sits, and `move slow` / `move medium` / `move fast` sets how
  far the camera travels. **The prefix is required** — bare "slow" or "center"
  appear in real captions all the time, and a line reading *"Cut the light off.
  Slow down."* would lose its "Slow" to the column.
- **Times can have decimals.** `1.3s`, `0.5s`, `2.5s` all work. *(Before build
  b0845 they didn't — `1.3s` came out as 3 seconds, because the row number and
  the decimal point confused each other. Fixed.)*
- **Row numbers are optional** — `1.` or `1)` or a dash or nothing at all.
- A bare number only counts as a time if it's on its own, so a caption like
  "Day 400" keeps its 400.
- Remember the beat-snap note above: paste sub-second times, then **untick
  "⚡ Cut on the beat"**, or they'll be rounded straight back up.

### Lower thirds (a name in the corner)

Two of the **words:** positions put text at 72% of the frame height, which is
below faces and above the platform buttons: **lower (safe)** centres it, and
**lower left** puts it where a broadcast lower third goes. In a pasted shot
list they're `words safe` and `words lower left`.

### Controlling the zoom speed

Every picture row has a **move:** dropdown — **slow**, **medium** (the default)
or **fast**. It sets how far the camera travels in the time that shot has, so
the same 3-second push reads as a barely-there drift on slow and a real move on
fast. Slow on a long hold is the "creeping in" look; fast on a short shot has
punch. In a pasted shot list it's `move slow` / `move medium` / `move fast`.

**The AI way (your characters star in it):**
1. **Characters** tab → create your character, upload **6–20 clear photos, different angles** (straight on, both sides, one smiling — good light, no sunglasses, same-ish hair). Variety is what makes it *look like them*.
   - Only photos **you upload** count as reference photos — AI-generated scenes never do, even when the character appears in them.
   - Tap any thumbnail in their gallery to **remove it** from the reference set (it stays in your library).
   - Short on photos? **Crop** a face out of a bigger picture — crops of your uploads count as reference photos too.
   - Fill in their **cast sheet** line ("male lead — gold chains, tattoos"): the Director uses it to recognize them in your lyrics, and it keeps their signature details consistent in every generated scene.
2. Press **🔒 Train face lock** (~$3.60, one-time, ~10 minutes — keep the tab open). This teaches the AI that face permanently; every solo scene with that character then uses it automatically. Changed their photos later? Press **↻ Retrain face lock** — the new lock replaces the old one.
3. **Lyrics & Captions** card → paste your lyrics
4. **Storyboard** card → **Build storyboard from my lyrics** → it detects your song's structure (🎬 Intro · 🎤 Verse · 🔥 Chorus · 🌉 Bridge · 🌅 Outro — it spots repeated stanzas as the chorus, and `[Chorus]`-style tags in your sheet work too) and matches each scene's energy: big dynamic shots on choruses, intimate shots on verses, moody on the bridge. **Generate** each scene (~4–9¢). Chorus stills even land on the timeline with shorter, punchier holds.
   - **Already have a picture for a shot?** Tap **🖼 My own** on that scene and pick it — from your Studio library or straight off your device. It fills the scene exactly like a generated one, so **+ Timeline** and **Add all generated scenes** carry it with the same pacing. Costs nothing, and it's the cheapest way to build a storyboard: use your own photos for everything you can, generate only the shots you can't film.
5. On each scene in your Library → **Animate** → pick quality → tap the price button
6. Clips land on your timeline → add your song → **Render full video**

**Writing prompts that work (the 4 rules):**
1. **One subject per image.** Five ideas = five separate scenes cut together on the timeline, not one crowded picture. (The app automatically stops the AI from drawing split-screen collages.)
2. **Pick characters in the dropdowns, keep names out of the prompt.** Writing a name does nothing — only the dropdown attaches their face. Say "he leans on the car," not "DBC leans on the car."
3. **Describe what the camera sees** — who, where, light, mood. Story logic ("unaware they miss each other") isn't visible and just confuses it.
4. **Words inside the picture** (phone screens, signs, jewelry text)? Use **✨ Best (Banana Pro)** or **🤖 GPT-Image** — those two spell reliably.

**Which image tier?** Four chips, cheapest first: **Flux** (~4¢, the everyday workhorse) · **🤖 GPT-Image** (~7¢, best at following a prompt literally and at text in the picture) · **✨ Banana Pro** (~15¢, top-quality finish) — and a character's face lock only works on Flux, so scenes starring a trained character stay there. GPT-Image and Banana Pro both hold a likeness using the character's reference photos instead.

If you try to generate a scene nearly identical to one you already have, Studio warns you first so you don't pay twice by accident.

**Your world, remembered (Characters tab):**
- **📍 Locations** — save a place once (name + a detail line + 1–2 photos) and it appears as a dropdown in AI Scenes. Every scene with it picked matches those photos — same club, same colors, every time. A generated scene you love can become a location photo too: **Save** it, re-upload it to the location.
- **🤝 Relationships** — once you have two characters, a Relationships card appears. Write their chemistry once ("tender but strained — deep history, longing looks") and it automatically rides along on **every** two-person scene with them. No retyping, no drift.
- **🎥 Shots** button on any generated scene = camera coverage, like a real shoot: re-renders the *same moment* as Wide / Medium / Close-up / Over-shoulder / Detail (pick which, price on the button). Cutting between coverage of one moment is what makes edits feel professionally shot.

**AI extras, any time:**
- **Two characters in one scene** — a second dropdown appears once you have two characters: pick "+ (name)" and describe them together. Both need reference photos (duo scenes use photos even when face locks exist — two locks in one image would blend).
- **Sing** button on any image/video = lip-sync to a part of your song. On videos you pick a tier: **Draft (~4¢)** to check the timing, **✨ Hero (20¢)** for the polished final pass.
- **🎭 Live Portrait** = an approved still performs — film your own face doing the expressions (talking, vibing, head nods) and the still copies it exactly, without regenerating the image. Cheap (~10¢).
- **Dance Transfer** = film yourself dancing full-body, your character copies the moves. Three tiers with prices on the chips: **Draft (Wan)** to test the moves, **Standard (Kling)** for solid quality, **✨ Hero (Kling 3 Pro)** for the final cut. (Prices are estimates — the exact charge shows on your fal dashboard.)

**🆓 The free editing toolbox (no AI, no cost, originals always kept):**
| Button | On | What it does |
|---|---|---|
| **Motion** | photos | Camera movement — zoom, pan, drift, shake — turns a still into a clip |
| **Crop** | photos | Cut a copy at 9:16 / 1:1 / 4:5 / 16:9, keeping the part you choose |
| **2×** | photos | Double the resolution (sharp resize — free, instant) |
| **Cut** | videos | **Keep only** a section, or **remove** a middle piece and join the sides (sound intact) |
| **Loop** | videos | 2×/4×/6× longer — plays forward, then smoothly backward (no jump cut) |
| **Sound** | videos | **🔇 Remove the sound**, or **🎵 swap in a song** from the second you choose |
| **🎨 Simple screens** | (card) | Black / white / gradient / any-color screens for pauses, flash frames, lyric backdrops |

Tap any picture or video in the Library to see it **full-screen**.

---

## 4a. 🎬 Director & 💼 Producer (drop images, they do the rest)

The laziest good way to make a video, at the top of the Sequencer:

1. Have **audio** loaded (a song via upload or Suno link — or your own recorded voice) and **words** (paste lyrics, press 🪄 Auto-captions, or **🎙️ Captions from my own voice**, which is free)
2. Give it visuals — **🎞 Drop images or clips from this device**, or **🖼 Use pictures made in Studio** to pull from your own library. Tap them in the order you want them; the Director follows that order
3. Set the **Producer's budget** (max AI spend for filling gaps)
4. **🎬 Director: plan my video** — the Director reads your song's structure and shows you the full plan: which of your images plays which scene, what gets generated to fill gaps (choruses first, inside budget), and the camera move + pacing for every section
5. Like the plan? **💼 Producer: make it** — generates the gap scenes (using your selected character/location dropdowns from AI Scenes), gives every shot its camera move, and assembles the whole video on the beat with your captions

Nothing generates or spends until you press the Producer button — the plan is always yours to reject, tweak (budget, lyrics, images), and re-plan for free.

**The rest of the crew works inside the plan automatically:**
- **🎭 Casting Director** — fill each star's **cast sheet** line on the Characters tab ("male lead — gold chains, tattoos"). When your lyrics mention a star by name or their signature look, the Director casts them in that exact scene — the plan shows "starring Da Brown Chris" per scene, and generated scenes use their photos/face lock plus the cast-sheet notes.
- **🔍 QC Inspector** — every scene the Producer generates gets inspected by a vision AI (~½¢): faces, fingers, limbs, structure. Flagged shots get a **⚠ QC badge** in the Library (hover it for the reason) so you can regenerate before a defect reaches your video. There's also a manual **🔍 QC** button on any generated image.
- **🎨 Production Designer** — reads your lyrics and picks one consistent look for the whole video (Neon nightlife / Moody blue / Golden hour / Street documentary / Clean cinematic) and bakes it into every generated scene. Type your own style in the Storyboard style box to overrule them.
- **🎥 Cinematographer** — chooses lenses per section (anamorphic energy on choruses, 35mm intimacy on verses, silhouettes on the bridge), varies the camera moves so no two shots feel identical, and grades the timeline (choruses punchier, bridge desaturated).
- **🎚 Sound Mixer** — masters the audio, sets the fade-in/fade-out, and keeps music ducked under any clip sound. Runs at render, every time.

---

## 4b. The 🚀 One-Click Pipeline (the whole flow, guided)

At the top of the Sequencer there's a pipeline card with the full journey: **Song → Captions → Storyboard → Scenes → Timeline → Render → Shorts.** Each step lights up when the one before it is done, and each has its own button — nothing generates without you pressing it, so every checkpoint is yours. If you ever wonder "what do I do next?", the pipeline card is the answer.

---

## 5. Make Shorts (daily content, free)

**The one-tap way:** with your video's timeline still loaded, press **⚡ Auto shorts**. Studio listens for your chorus or drop (captions first — repeated lines are the chorus — loudness as backup), plans 15s and 30s cuts that each **open** on that moment, and renders the whole batch. The list appears as it works; tweak any cut or just **Download all shorts**. No song, or a song it can't read? It still cuts from the open, middle and end rather than stopping.

**The fine-control way** lives under the **🛠 Fine control** drawer on the same card: mark your own moments, pick the strongest sentences from a filmed video with the clip picker, choose lengths (7/15/30/60s), then **Build shorts list** → type a different caption on each one (free A/B testing) → **Render all shorts**.

One music video = a week of posts. Seamless loop makes them replay forever.

---

## 5a. 🎤 The Teleprompter (stay on script, still sound like you)

At the top of the **📅 Post** tab. Write the words once, then read them steady instead of guessing on camera.

1. **📅 Post** tab → type a **Script name** and paste your script into the box
   - Put **each thought on its own line** — short lines read naturally; a wall of text makes anyone sound like a robot
   - Leave a **blank line** where you want to pause and breathe
2. **💾 Save script** — it's saved to your account, so it's there next week and on your phone too. Tap any saved script to load it back; save again to update it.
3. **▶ Open teleprompter** → the screen goes black, you get a 3-2-1 countdown, then the words scroll

**Set your camera up like this:** put the screen showing the prompter **directly behind or under your camera**, as close to the lens as you can. The green band across the middle marks the line to read — keeping your eyes in that band is what makes you look like you're talking *to* someone instead of reading.

**While it's rolling:**
| Control | Does |
|---|---|
| **Space** or **▶/❚❚** | Play / pause |
| **+ speed / − speed** (or ↑ ↓) | Faster or slower — start slow, 3 is a calm speaking pace |
| **A+ / A−** | Bigger or smaller words (bigger = you can stand further back; A− goes all the way down to tiny for a long or wordy script) |
| **␣− / ␣+** | Condense or stretch the letters — pull a line that's still too wide back onto the screen without shrinking the type |
| **Mirror** | Flips the text for a teleprompter glass rig |
| **↺ Restart** (or R) | Back to the top for another take |
| **✕ Close** (or Esc) | Done |

**Getting it heartfelt, not robotic:** run it slower than feels natural, read a line *then* look at the lens as you say it, and let yourself go off-script when a real feeling shows up — the script is a floor, not a cage. If you flub a line, don't stop; press ↺ Restart and go again. Takes are free.

---

## 5b. 📅 The Post tab (your posting schedule)

Studio can't post for you — TikTok, Instagram and YouTube all make a brand-new app wait weeks for a manual review before it's allowed to publish, and even then a video posted through their back door gets less reach than one you upload yourself. So the Post tab does everything **except** the final tap:

1. **📅 Post** tab → pick a clip, write the caption once, tick the platforms, set the date and time
2. **Add to schedule** — repeat for the whole week (do this right after a Sunday batch)
3. When a post comes due, a red banner appears and a red dot lights on the **Post** tab — even if Studio was closed when the moment passed
4. On that due post: **Copy caption** · **⬇ Download clip** · **Open TikTok / YouTube / Instagram / Facebook** → post it natively → tap **Posted ✓**

Posting to TikTok now and YouTube tonight? Tick them off one at a time — the post stays on the list until every platform is done.

**Tip:** open Studio on your phone (⚙ Settings → 📱 Open Studio on your phone, same Wi-Fi) and you can download the clip straight to the phone you're posting from.

---

## 5c. 📱 Open Studio on your phone

Studio runs on this computer, but your phone can open it over your home Wi-Fi — which is how finished clips get onto the phone you post from.

1. **⚙ Settings** → **📱 Open Studio on your phone** → tap **Copy** (the address looks like `http://192.168.1.47:4400`). It's also printed in the black window when Studio starts.
2. On your phone (same Wi-Fi), type that address into the browser → sign in
3. Add it to your phone's home screen — then it's an icon, and you never type it again

The first time, Windows may ask to allow Studio through the firewall — choose **Allow** on private networks. This computer has to be on with Studio running; the phone is a window into it, not a copy.

**Use the same account on both.** One account works on as many devices as you like — just sign in with the same email and password. Two things that trip people up:
- **Don't type `localhost` on the phone.** On a phone that means the phone itself. Use the `192.168.…` address from Settings.
- **If it says the password is wrong, it means the password is wrong** — tap the 👁 eye to see what you typed. (Phone keyboards and a hidden password are a bad combination.)

---

## 5d. Narrating in your own voice (free, always)

Your voice costs nothing and never did — but until b0850 the button that put it
on the video only appeared after a *paid* generation, so the free path saved
your recording and stopped there. Fixed. The flow now:

1. Sequencer → **🎙 Voice** card → **🎙 Record my voice — free**
2. Read your line (the **Teleprompter** on the 📅 Post tab holds the script if
   it's long), tap again to stop
3. **🎬 Use in video (narration + captions)** → it's the narration track on
   your video, and every caption tool works on it

That is your real voice, free, unlimited, and better than any clone. Two people
reading two parts = two real voices — record one, then the other.

**What the three options actually cost:**

| Option | Cost | What it is |
|---|---|---|
| **🎙 Record my voice** | **Free** | Your actual voice. Unlimited |
| **Built-in narrators** (Warm, Calm male…) | **Free** | Speak on your own computer. Plain reads only |
| **🎤 Clone a voice** | **Free once installed** (see below), otherwise ~$0.05 per 1,000 characters | AI speaks *typed text* in a voice from a clip |

### Free voice cloning (b0851) — install once, never pay for a voice again

Cloning is for when you want text spoken **without anyone reading it aloud**.
That used to be the one part of this card that cost money. Now it can run on
your own computer for nothing:

1. **🎤 Clone a voice** chip → the panel under it appears
2. **⬇ Install free voice cloning (one time)** → several minutes; it downloads
   Python packages and the speech engine (about 2 GB). You can leave the page,
   it keeps going
3. Pick your reference clip, type the line, **Speak** — free, unlimited, as many
   takes as you want

**Two things to expect the first time.** The very first line downloads the voice
model (about another gigabyte), so it takes a few minutes; every line after that
is quick. And it runs on your processor, not a graphics card, so a long
narration is minutes rather than seconds — start it and go do something else.

**If the install says Python is missing:** get it from python.org and tick
*"Add Python to PATH"* during setup, then press the button again.

**Moods still use fal.** The local engine reads plainly — 😊 Happy / 🔥 Hyped
and the rest still go through your fal key, and still show their price first.

**Remove it any time** with the button in that panel; it deletes the lot and
gives the disk space back.

**Why this model:** Chatterbox is MIT-licensed *including its weights*, so
videos you make with it can be sold. That is the same bar the free narrators
are held to, and it rules out the better-known free cloners — XTTS-v2 and
F5-TTS are both non-commercial.

---

## 5e. Diagnostics — and clearing it (b0853)

**⚙ Settings → Diagnostics** lists recent errors so you can screenshot them when
something breaks. It now has **🧹 Clear the list** — safe to press any time. It
is a rolling view of recent errors, not a record you need to keep, and an old
list full of already-fixed problems makes a new one hard to spot. Clear it, then
reproduce the problem, and whatever appears is the actual fault.

**Two cards were removed in b0853:**
- **🎵 Your Audience** — a fan-email signup list for `join.html`, built for
  musicians collecting emails at gigs. It only ever worked on this computer, and
  the recovery app has its own email system. Nothing you were using.
- **⚡ One-tap short** — it captioned a single filmed clip from a pasted script.
  The same job is now: put the clip in **Quick Video**, use **Lyrics & Captions →
  🎙️ Captions from my voice (free)** or **Auto-spread** to time the lines, then
  Assemble. One place for shorts instead of two.

---

## 5g. 📆 Make the week (b0857) — stage once, every template becomes a queued post

On the **📅 Post tab**, under the Send card: **📆 Make the week**. It runs your
saved Quick Video templates one after another against the pictures + song
currently staged in Quick Video, and queues each finished video to Buffer with
the caption on its row — the whole week in one button.

1. **Quick Video** → add the pictures (and song) for this run. This is the
   batch's input — every template gets the same pictures, each in its own
   style (its own moves, timings, words, CTA card).
2. **📅 Post tab** → **📆 Make the week** → tick the templates you want this
   week, write a caption per row (left blank, it uses the template's name)
3. **📆 Make this week** → watch the log: each row goes *applying →
   assembling → queuing to Buffer*
4. Done. Each video sits in your Buffer queue for the next open slot
   (8am / 12pm / 7pm).

It stops at the first failure — the log shows which rows are already ✅
queued, so untick those, fix the problem, and press Make again to finish the
rest. Posts use the post type (and channel ticks) selected in the **Send** card
above, so an AI-made week gets its "Made with AI" label automatically.

---

## 5f. Sending to Buffer — what each network demands (b0855)

Buffer refused every post until b0855, and its own error messages said exactly
why. Three separate things, now all handled automatically:

- **No thumbnail.** Studio used to render a first frame and send it as the
  video's `thumbnailUrl`. Buffer's schema *lists* that field but its validator
  rejects it — *"social networks do not accept custom video thumbnail images"* —
  and that one field failed the whole post on **every** channel. It is gone.
- **YouTube needs a title and a category.** The title is taken from the first
  line of your caption (trimmed to YouTube's 100-character limit), and the
  category defaults to **People & Blogs**.
- **Facebook needs a post type.** Defaults to a normal feed **post**.

You don't set any of it — Studio reads what each network requires from Buffer
directly and fills it in per channel, so YouTube gets its title while TikTok
gets left alone.

**If a post is still refused,** the message now lands in ⚙ Settings →
Diagnostics in Buffer's own words. Clear the list, try again, screenshot it.

---

## 6. From finished video to posted (what replaced Campaign Export)

Campaign Export (the ZIP-for-Buffer card) is gone as of b0849 — it was a detour nobody took. The flow that replaced it is shorter and already in the app: **⚡ Auto shorts** cuts the batch, the **📅 Post tab** holds the schedule and captions, and your phone (**⚙ Settings → 📱 Open Studio on your phone**) is where the final tap happens, natively, which the platforms reward anyway. Song title and artist now live at the top of the **Lyrics & Captions** card — the title-card button and the storyboard both read them from there.

---

## 7. Lyrics & Captions (words on screen)

1. **Lyrics & Captions** card → paste lyrics, one line per caption
2. Four ways to time them:
   - **Auto-spread** — instant guess, free
   - **▶ Tap to sync** — perfect and free: the song plays, you tap once per line
   - **🎙️ Captions from my voice (free)** — Studio listens on **your own computer** and writes every line with its real timing. Nothing is uploaded, nothing is charged, and it works offline after the first use. **Best choice for talking videos.** The first run downloads the listening model once (a few minutes); after that it's instant. Optional afterwards: a paid AI tidy-up of the wording — the price is shown before you agree, and you can always say no.
     *It doesn't need the recording on your timeline.* If your timeline is pictures (a storyboard cut, say), Studio offers the newest recording in your library by name and listens to that once you say yes. So "storyboard pictures + my own voice + captions" works without a filmed clip anywhere in the edit. This button is also on the **Make My Video** card now, so you don't have to go hunting for it.
   - **🪄 Auto-captions (AI)** — the cloud version, for songs. Costs cents; price shows on the button.
3. Captions burn into your video AND your shorts automatically
4. **+ Song title intro** puts your title card at the start

**Pasting from a chat, doc or notes app?** Just paste it. Studio strips the `>` quote marks and bullet dots people's apps add, and throws away the marker-only lines between paragraphs — those used to become blank captions that ate a timing slot and pushed every later line early.

### ⭐ Where captions go on a phone (the mistake that wrecks good videos)

**Never put words in the bottom fifth of a vertical video.** TikTok, Reels and
Shorts all stack their own username, caption, music line and buttons across the
bottom of the screen. Anything you put down there is sitting *underneath* their
furniture, and on at least one platform it will be unreadable.

On a 1080 × 1920 video, the rule is:

| Zone | Pixels from top | Use it? |
|---|---|---|
| Top bar | 0 – 250 | Avoid — some apps put a header here |
| **Faces** | 250 – 950 | Never cover a face with type |
| **✅ The safe stripe** | **1150 – 1470** | **Put your captions here** — chest height, below faces, above the buttons |
| Platform buttons | 1500 – 1920 | Never. This is their space |

**Studio's default was in that danger zone too** — corrected in b0846. Quick
Video used to put every caption at the very bottom of the frame (93% down),
which is under the buttons. Each shot now has a **words:** dropdown, and the
first option, **words: lower (safe)**, sits the text at 72% — below the faces,
above the furniture. Pick it per shot, or write `words safe` in a pasted shot
list. The old bottom position is still there if you want it.

And a black bar at the bottom is not a fix: the buttons sit on top of the bar,
not below it.

Also worth knowing: a video whose picture doesn't fill the whole 1080 × 1920
frame — black bars top or bottom — is **not really 9:16**, even if the file
says it is. Use **Reframe (9:16)** in the editing toolbox to fill the frame
properly.

> ⚠️ **Captions are words, not sound.** A video with captions and nothing else renders **silent** — Studio warns you before you render. To hear your voice, the recording has to be added as audio: **🎬 Use in video** on the Voice card, the Music card, or the extraction trick below.

---

## 8. What Things Cost

**Free forever:** Quick Video (with its instant preview and fit-to-song), motion, timeline, lyrics, captions & styles, shorts (with ⚡ Auto shorts), thumbnails, storyboard prompts, backups, **the Post schedule, phone access, 🎙️ Captions from my voice (listening happens on your own computer), 🎙 Take the voice out of a clip, and using your own pictures for storyboard scenes** — plus the whole editing toolbox: Crop, 2× resize, Cut, Loop, Sound swap, Simple screens, **Mirror, Slow-mo, Freeze-frame, Clean audio, Master for release (48k WAV), Reframe (9:16/1:1/16:9), Remove corner mark, Green screen, brand watermark, keep-clip-audio + song ducking, Screen recording, ▦ Panels (4-panel collage + Duet), and free stock b-roll (Pexels)**. Everything except AI generation.

**A whole video for $0 is a real option.** Your own photos or filmed clips → your own voice (film it, take the voice out) → free captions from that voice → assemble, master, render, and cut shorts. Every step above is free and unlimited. AI generation is for the shots you can't get any other way, not a toll on the door.

> 📄 **Want this as a one-page sheet?** A printable **Studio Price List** PDF is available — ask for it any time.
>
> 📖 **The full guide is built in.** Open **⚙ Settings → 📖 Guide & help → Open the guide (PDF)** for the complete Studio manual (every tab, tool, fix, the money-safety layers, and the ideal video-to-post flow). The price list is right beside it.

**AI (from your fal.ai balance) — verified July 2026, and every price shows on the button before you tap:**
| Thing | Rough cost |
|---|---|
| Scene image | ~4¢ |
| Scene image starring your character | ~9¢ |
| Scene image on ✨ Best (Banana Pro) | ~15¢ |
| Scene image on 🤖 GPT-Image | ~7¢ |
| 🔒 Face lock training (per character, one-time) | ~$3.60 |
| 5-second clip — Draft (Wan) | ~25¢ |
| 5-second clip — Standard (Kling Turbo) | ~35¢ |
| 5-second clip — ✨ Best (Seedance) | ~$1.20 |
| Sing on a video — Draft / ✨ Hero | ~4¢ / 20¢ |
| Sing on a still | ~50¢–$1.50 |
| Dance Transfer (10s) — Draft / Standard / ✨ Hero | ~$1.50 / $1.30 / $1.70 |
| 🎭 Live Portrait clip | ~10¢ |
| 🎙 Voice — Neutral | $0.05 / 1,000 chars (~½¢ a line, ~5¢/min) |
| 🎙 Voice — with a mood (emotion) | ~$0.12 / 1,000 chars |
| 🪄 Auto-captions (whole song) | ~35¢ *(free if you paste your own lyrics)* |
| 🔍 QC inspection (per image) | ~½¢ |
| 🎧 Crew Room chat (Creative Director, etc.) | fraction of a cent per message |

The exact price shows **on the button** before you tap, and every number above rounds **up** so a real bill is never a surprise. Smart habit: draft cheap, re-make only the keepers on Best. The app has a daily safety cap so nothing can drain your balance.

### 💸 Recover paid clips + spend ledger (Settings → Storage area)
Every AI generation is now saved the moment it's sent. The card shows a **running total of what you've spent on AI** (estimated from the verified button rates — your real fal.ai balance is the final word) and a per-item breakdown, so you can always see where the money went. Failed generations aren't counted (they aren't billed).

**🛑 Daily spend cap:** set a dollar limit (e.g. $5/day) and Studio **flat refuses to start any AI generation that would go over it** — every button: Animate, Scenes, Sing, Dance, Voice, face-lock training. Runaway spend becomes impossible. It resets at midnight UTC. Set it to 0 to turn it off. If a clip you paid for didn't land in your library (you closed the tab, refreshed, or the render ran long), tap **Find my finished clips** — Studio pulls in anything fal already finished. This never costs anything (reading a result is free). For clips paid for *before* this existed, paste the output file link from your fal.ai dashboard into the "Recover an older one" box.

### The free toolbox (no AI, on every clip/photo in My Media)
- **🧽 Remove corner mark** (Crop → *Remove corner mark ✦*) — cleans a decorative sparkle / corner watermark off **your own** generated image. *Patch it out* blends it into the pixels around it and keeps the whole frame (best when the subject is near the corner); *Zoom past it* crops the corner off. Free & instant. It's for tidying a provider's sparkle on your own art — it can't touch invisible watermarks and isn't for anyone else's work.
- **▶ Continue (extend a clip)** — on any video, tap **▶ Continue**: Studio grabs its last frame and opens Animate pre-loaded with a "keep the motion going" prompt. The new clip carries on from exactly where the first ended — place them back-to-back in the Sequencer for one seamless longer shot (chain it as many times as you want). This is real *forward* motion, unlike Loop which repeats. Costs one Animate per extension.
- **Mirror / Slow-mo / Freeze** — flip a shot for variety, slow it for drama (doubles its length too), or grab a still from a clip.
- **🎙 Take the voice out** (on any video clip) — lifts the sound off a filmed clip into its own audio file in your Songs, cleaned up on the way. Free. This is how you use your **own voice** without re-recording it: film yourself talking, take the voice out, then add it as narration and caption it with 🎙️ Captions from my voice. (It's the same job as **✨ Master for release** on a video — just named for what people actually go looking for.)
- **🔊 Clean audio** — de-noise, de-rumble, and level-out narration or any clip with sound (great for spoken-word).
- **🟢 Green screen** — drop a subject shot on a solid color onto any picture or clip as the new background.
- **🎥 Record my screen** (My Media) — capture anything playing on screen straight into your library.
- **🎨 Color preset** (any picture or clip) — twelve one-tap film grades:
  Teal & Orange, Bleach Bypass, Moody Blue, Golden Hour, Soft Pastel, Crushed
  Blacks, Kodak Warm, Fuji Green, Silver, High Key, Low Key. A graded copy
  lands in your library and the original is untouched, so you can try five and
  keep one. Free — it's a filter, nothing is generated.
- **🎬 Free stock b-roll** (My Media) — paste a free Pexels key and search millions of free clips & photos for establishing shots and transitions.
- **▦ Panels** (any picture or clip in your Library) — the two CapCut layouts, free and made on your own machine. **4-panel collage** puts four things in a 2×2 grid; **⬍ Duet** stacks two — a reference clip on top, you underneath — which is the "follow the move" layout. Cells crop to fill rather than letterbox, and a shorter clip loops instead of freezing on its last frame.
- **Pre-render check** — when you press Render, Studio warns you first about anything worth fixing (no song, reused clips, super-short flashes, length mismatch).
- **One-click setups** (AI Scenes → Director's brief) — tap a face-locked character to make them the star; save your vibe/energy/star/place as a reusable setup; your last brief is remembered.

### Make a character TALK (with a moving, expressive face)
It's three steps, and each one is its own button:
1. **🎙 Voice** — pick a reference voice clip (a vocal stem you pulled from Suno, or one you made free with **🎙 Take the voice out** of a clip you filmed), type the line, generate. Out comes DBC (or SBGQ) *saying* it, in their voice. Pick a **mood** (Happy / Hyped / Sad / Angry / Calm) to change the delivery — no filming needed. Neutral is cheapest (~½¢ a line); a mood is a touch more (~pennies), and the price shows before you spend.
   When it's done, **🎬 Use in video** puts it straight into your video as narration and jumps you to the timeline — from there it captions like anything else. (It's saved in your Songs either way.)
2. **🎤 Sing** — on DBC's photo or clip, tap **Sing**, and in the song list pick the **voice line you just made**. It lip-syncs his mouth to the words. (Draft ~4¢ / Hero 20¢.)
3. **🎭 Live Portrait** — for full expressions (eyes, head, mood), film your own face doing the performance and it maps that onto his still. (~10¢.)

For expressions in **still scenes**, just say it in the prompt — "DBC looking intense," "SBGQ smiling softly." That's free (part of the image).

---

## 9. Updating the App

1. Sequencer → **🛠 Show studio tools** → **Storage & Backup** card
2. **Check for updates** → if one exists, **⬆ Update my app**
3. Wait for "Update installed!" → close the black window → double-click Start Studio again

Your library, account, and key always survive updates. Don't update while a render is running.

---

## 10. Backing Up (do this sometimes)

Same card: **⬇ Download full backup (ZIP)** → save it to a USB stick or cloud drive.
Your whole library lives only on this computer — a backup means a broken laptop costs you nothing.

Also on that card: see what's using disk space and delete big old files.

**Automatic snapshots (b0857):** Studio now saves a rotating copy of
`data.sqlite` — the file that holds your account, characters and face locks —
on every start and again right before every update (the last 8 are kept). A
failed snapshot never blocks startup, and it's no replacement for the ZIP
backup: the ZIP holds your whole library; the snapshots are the insurance that
survives an update gone wrong. If you ever need one back, the copies live in
`Studio\server\backups\`.

---

## 11. When Something Goes Wrong

| Problem | Fix |
|---|---|
| Buttons do nothing / page looks empty | Press **F5 twice**. Still broken? Press F12 → Console tab → screenshot the red text and send it to Claude. |
| "Could not reach the server" | The black window isn't running. Double-click Start Studio. |
| Address bar says "File C:/..." | Wrong door. Close the tab, use Start Studio. |
| Welcome screen keeps showing | Type email + password and press Let's go — a wrong password on an existing account shows the reason underneath. |
| AI button says "not set up yet" | Paste your fal key in AI Scenes → 🔑 Turn on AI. |
| AI fails with a balance error | Add credits at fal.ai → Billing → Credits. |
| "Safety checker flagged this" | Usually a false alarm with real-people photos. You weren't charged — reword the prompt slightly and go again. |
| Generated image is a split-screen collage | Your prompt describes several places/moments at once. One subject per scene — the app blocks most of these automatically now. |
| Upload/generation dies mid-send | Studio retries by itself; if it still fails, check your internet. With two characters on ✨ Best, removing a couple of reference photos also helps. |
| "You already have an almost identical scene" | The duplicate guard saving you money. Check the existing shot in your Library before paying to regenerate. |
| ⚠ QC badge on an image | The AI inspector spotted a likely defect (hover the badge for the reason — e.g. wrong finger count). Regenerate the scene if it bothers you; ✅ QC means it passed. |
| Suno import fails | Make sure you paste the **Share → Copy link** URL from Suno. If it still fails, download the song in your browser and use the normal upload button — same result. |
| Windows blocks Start Studio | Right-click → Properties → Unblock → OK. Or "More info → Run anyway". |
| I see "Turn Someday Into Day One" / localhost:4300 | That's a different app from an OLD download. Close it and use **Start Studio** (localhost:4400). A fresh Studio download has only one launcher. |
| A feature (Sing, Animate) is missing | Those show only when AI is on. Check the badge says **AI READY**; if not, set your key in ⚙ Settings. **Sing** appears **on each picture in the AI Scenes → Library**, so you need at least one picture there. |
| My face lock / character disappeared | If you have your old `data.sqlite`, copy it back into `Studio\server\`. Otherwise the LoRA link may still be on **fal.ai/dashboard** under the `flux-lora-portrait-trainer` training request — "Show files" → copy the `.safetensors` link → paste it into the character's **LoRA URL** box (+ its trigger word) → Save. If the file expired, retrain (~$3.60). |
| Daily cap reached | You generated a LOT today. It resets at midnight UTC (or raise it in server/.env). |
| Something weird I can't figure out | Open a Claude Code session on the repo and describe it. Screenshots help. |

---

## 12. Where Your Files Live

- **Your library** (everything you make): `Studio\server\media\` — managed by the app, don't rearrange it by hand
- **Downloads you click**: your normal Downloads folder
- **Your key & settings**: `Studio\server\.env`
- **Your account**: `Studio\server\data.sqlite`

Those three files/folders = your stuff. Everything else is replaceable code.

**⭐ BACK UP `data.sqlite` — this is the one that hurts to lose.** It holds your account, your characters, and your **face locks**. After you train or restore a face lock, copy `Studio\server\data.sqlite` to your Desktop (and a cloud folder / USB). Do it again whenever you add characters. The in-app **⚙ Settings → ⬇ Back up everything (ZIP)** button saves media + a manifest too. If you ever lose your setup, copying an old `data.sqlite` back into `Studio\server\` restores everything at once.

**Updating:** ⚙ Settings → **⬆ Update my app** (wait ~2 min even if it looks stuck, then close the black window, run **Start Studio** again, and press Ctrl+Shift+R). Or grab a fresh copy — extract it to a **new empty folder** to avoid leftover files, then copy your saved `.env` and `data.sqlite` into its `Studio\server\`.

---

*Made with Claude Code. To change anything about this app, open a session on the repo and just ask.*
