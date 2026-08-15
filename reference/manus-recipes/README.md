# The Manus recipes — what they are and the one number that mattered

Four reproduction recipes Manus wrote for its own work, saved 15 Aug 2026 before
the free window closed, plus **the actual assembly script** in `scripts/`.

**Read numbers off `scripts/assemble_nia_video.py` first.** It is Manus's own
code, verbatim — nothing in it is interpretation. The PDFs come next. The `.txt`
files beside them are extracted text for searching only: extraction mangled some
digits (they appear as `￾`), so never read a number off a `.txt`.

| Recipe | Episode |
|---|---|
| `Nia_Photo_Series_and_Captioned_Video___Reproduction_Recipe.pdf` | 3 — the fullest one, 13 pages. **Start here.** |
| `Nia_Photo_Story___Exact_Task_Record_and_Reproduction_Recipe.pdf` | 3 — the task record |
| `Eli_Story_Series___Reproduction_Recipe.pdf` | 5 — gaming |
| `Reproducibility_Recipe_Meg_Lily...OST.pdf` | 6 — work |
| `scripts/assemble_nia_video.py` | 3 — **the real script**, not a description of one |

## Why these were captured

Manus was free until 25 Aug 2026. The films are nice; **the commands are the
asset.** A recipe can be run on any machine with ffmpeg, forever, for nothing.

---

## THE FINDING: the camera move is 2%, not 25%

The whole "cinematic" feel comes from one number. Manus's Ken Burns move is:

```
zoom in :  min(zoom+0.00022,1.02)
zoom out:  max(1.02-on*0.00022,1.0)
still   :  1.0+on*0.000035
pan     :  x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'
frame   :  d=1:s=1440x2560:fps=30
prep    :  scale=1440:2560:force_original_aspect_ratio=increase,crop=1440:2560
```

**That is a 2% zoom across a 5-second shot.** Barely perceptible — the frame
breathes rather than moves.

**And there is no such thing as a still shot.** The third line is what Manus
uses when a shot is marked "still": a drift of about half a percent over five
seconds. Nothing in the film is ever locked off. A truly frozen frame next to
moving ones reads as a mistake, so every shot keeps a little life in it.

Studio's default was **0.25 — twelve times more movement**, and even its
"Barely there" setting was 0.08, four times more. That difference is most of why
Manus's films looked composed and Studio's looked like a slideshow.

**Fixed in b0867:** Studio's Ken Burns menu now opens with **"Almost still —
2%"** and it is the default. If a shot ever needs more, the old settings are
still in the list.

## The rest of the pipeline, as recorded

- **Working resolution 1440×2560**, not 1080×1920 — rendered larger, which keeps
  the zoom from softening the image.
- **Captions are burned in with `drawtext`**, not a subtitle stream. Exact
  settings, off the script:

  ```
  fontcolor=0xF4F0E8   fontsize=50        line_spacing=12
  box=1                boxcolor=0x00000099 boxborderw=26
  x=(w-text_w)/2       y=h-390
  fade: 0.5s in, 0.35s out
  ```

  Those fades are the second thing that makes it feel edited rather than
  generated. Note the text is **not white** — `0xF4F0E8` is a warm off-white,
  and the box is black at 60% (`99`), not solid.
- **Music sits at `volume=0.55`** — `[1:a]volume=0.55,apad,atrim=duration=53[a]`.
  A flat level, no sidechain ducking; the captions are read, not heard, so
  nothing has to get out of their way.
- **Assembly is three passes:** render each shot to its own mp4 → `concat`
  demuxer with `-c copy` → mix the music → `tpad=stop_mode=clone:stop_duration=1.8`
  to hold the last frame for the end card.
- **H.264, veryfast, CRF 18, yuv420p, `+faststart`; audio AAC 192k.**
- Verified with `ffprobe` — recorded output `duration=53.000000`.

## What to do with them

1. **Keep them.** They cost nothing to store and cannot be regenerated once the
   free window closes.
2. **Port the good parts into Studio**, one at a time. The 2% zoom is done. Next
   candidates, in order of how much they'd show: the caption fades
   (0.5s/0.35s), the warm off-white `0xF4F0E8` instead of pure white, and the
   drifting "still".
3. Anything ported gets a note in `START-HERE.md` saying where it came from, so
   nobody "tidies" it back to a default that looks worse.
