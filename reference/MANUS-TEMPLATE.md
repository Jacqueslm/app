# The Manus template — one paste, one finished episode

Fill the five brackets, paste the whole thing into a new Manus task. Written
15 Aug 2026 after the first four episodes, so every line in it exists because
something went wrong without it.

**Why each rule is there** (do not trim these out — that is how they come back):

- **Wardrobe is spelled out and repeated.** The first Nia render came back with
  her near-undressed in all ten frames, because the reference image was a
  fashion photo and *a reference picture beats one word of wardrobe every time.*
- **"No text in the image"** — generators love to add captions of their own, and
  they arrive misspelled.
- **Nothing shown for substances.** TikTok and Meta remove content depicting
  drugs and a recovery framing is not an exemption. Absence is also the truer
  picture: what it looks like from the inside is rooms you stopped going into.
- **Ask for the recipe.** Manus is free until 25 Aug 2026. The commands it
  writes are the part worth keeping — they can be rebuilt into Studio later.
- **53 seconds** = ten shots at five plus a three-second end card.

---

## THE TEMPLATE — copy everything in the block

```
Make one finished vertical video, and give me the recipe you used.

=== THE CHARACTER ===
[NAME]: [age, ethnicity, build, hair, distinguishing features].
Wearing [specific clothes]. Fully covered in every shot.

Keep this description word for word identical in every image prompt so the face
does not drift. Never put the character's name inside an image prompt — describe
them instead.

WARDROBE RULE FOR ALL IMAGES: everyday modest clothing, fully clothed,
shoulders and chest covered. No swimwear, no lingerie, no bare midriff, no
cleavage. This is a documentary-style film — dress them the way an ordinary
person is actually dressed at home.

=== THE TEN SHOTS ===
One image per line, in this order, no merging and no reordering:

1. [shot description]
2. [shot description]
3. [shot description]
4. [shot description]
5. [shot description]
6. [shot description]
7. [shot description]
8. [shot description]
9. [shot description]
10. [shot description]

=== THE HOUSE LOOK — apply to all ten ===
cinematic photograph, shot on 35mm, shallow depth of field, warm practical light
from lamps and screens only, muted color grade, documentary realism, vertical
9:16 composition, ordinary American apartment, no text in the image.

=== THE NARRATION, ONE LINE PER SHOT ===
1. [line]
2. [line]
3. [line]
4. [line]
5. [line]
6. [line]
7. [line]
8. [line]
9. [line]
10. [line]

Show these as on-screen captions, bottom third, verbatim — do not paraphrase,
re-transcribe or "improve" them. The wording is exact.

=== THE MUSIC ===
Instrumental only, no vocals, 55 seconds: [music brief — instruments, tempo,
mood]. Original composition, not based on any existing recording.

=== THE VIDEO ===
- 1080x1920, 9:16, 30fps, H.264 MP4
- Each shot holds 5 seconds. Hard cuts between shots, no crossfades.
- A slow Ken Burns move on every shot — alternate push in / pull out / drift.
- Music under the whole thing, ducked so the captions read.
- End on a 3-second card: "[END CARD BIG LINE]" with
  "[END CARD SMALL LINE]" beneath it. Same navy background as the images.
- Total runtime 53 seconds.

=== ALSO GIVE ME THE RECIPE ===
As well as the MP4, write a markdown file containing:
1. Each image prompt you sent, verbatim, numbered.
2. The full ffmpeg command lines you ran — including the zoompan/Ken Burns
   filters, the caption burn-in, and the audio mix. The actual commands, not a
   description.
3. The folder structure and every filename.
4. The music prompt and which tool generated the track.
5. Frame rate, resolution, codec, bitrate, audio settings.

Deliver: the 10 images, the music file, the MP4, and the recipe file.
```

---

## Add this line when the episode involves substances or alcohol

Paste it directly under THE CHARACTER:

```
NOTHING IS SHOWN: no pills, powder, needles, paraphernalia, bottles, glasses of
alcohol or any substance — not in a single frame, not blurred, not in the
background. Every table and every hand is empty. This film is built on absence.
```

---

## Filling it in — worked example, Episode 7

- **[NAME]** → `DEE: white woman, late 40s, hair up in a clip, reading glasses
  pushed on her head, cardigan, tired kind face. Wearing a cardigan over a
  t-shirt and jeans.` (A second character goes on the next line, same shape.)
- **The ten shots** → the SHOT lines from the episode in
  `SERIES-2026-08-FOUR-EPISODES.md`, without the backticks.
- **The narration** → the caption column of that episode's sequencer table.
- **The music brief** → that episode's Suno prompt.
- **The end card** → one of the four in `Studio/end-cards/`. Match it to the
  episode: *Keep going* for the ones told by the person who found out, *Face
  yourself* for the two spiritual ones, *Learn to love yourself again* for the
  ones told from inside.

## After it delivers

1. **Watch it before anything else.** Check the wardrobe, check the captions
   word for word, and check no character's face drifted.
2. **Save the recipe file into this repo.** That is the part that outlives the
   free window.
3. **Log the music** in `MUSIC-LIBRARY.md` — prompt, file, date.
4. **Post through Studio**, not the tool, so the AI-disclosure flag is set and
   it lands in the Buffer queue.
