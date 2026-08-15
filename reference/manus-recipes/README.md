# The Manus recipes — what they are and the one number that mattered

Four reproduction recipes Manus wrote for its own work, saved 15 Aug 2026 before
the free window closed. **The PDFs are the source of truth.** The `.txt` files
beside them are extracted text for searching — text extraction mangled some
digits (they appear as `￾`), so read a number off the PDF, never off the `.txt`.

| Recipe | Episode |
|---|---|
| `Nia_Photo_Series_and_Captioned_Video___Reproduction_Recipe.pdf` | 3 — the fullest one, 13 pages. **Start here.** |
| `Nia_Photo_Story___Exact_Task_Record_and_Reproduction_Recipe.pdf` | 3 — the task record |
| `Eli_Story_Series___Reproduction_Recipe.pdf` | 5 — gaming |
| `Reproducibility_Recipe_Meg_Lily...OST.pdf` | 6 — work |

## Why these were captured

Manus was free until 25 Aug 2026. The films are nice; **the commands are the
asset.** A recipe can be run on any machine with ffmpeg, forever, for nothing.

---

## THE FINDING: the camera move is 2%, not 25%

The whole "cinematic" feel comes from one number. Manus's Ken Burns move is:

```
zoom in :  min(zoom+0.00022,1.02)
zoom out:  max(1.02-on*0.00022,1.0)
pan     :  x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'
frame   :  d=1:s=1440x2560:fps=30
prep    :  scale=1440:2560:force_original_aspect_ratio=increase,crop=1440:2560
```

**That is a 2% zoom across a 5-second shot.** Barely perceptible — the frame
breathes rather than moves.

Studio's default was **0.25 — twelve times more movement**, and even its
"Barely there" setting was 0.08, four times more. That difference is most of why
Manus's films looked composed and Studio's looked like a slideshow.

**Fixed in b0867:** Studio's Ken Burns menu now opens with **"Almost still —
2%"** and it is the default. If a shot ever needs more, the old settings are
still in the list.

## The rest of the pipeline, as recorded

- **Working resolution 1440×2560**, not 1080×1920 — rendered larger, which keeps
  the zoom from softening the image.
- **Captions are burned in with `drawtext`**, not a subtitle stream. DejaVu Sans,
  centred, sat near `y=h-400`, with a backing box, and a **0.3s fade in / 0.35s
  fade out per shot**. Those fades are the second thing that makes it feel
  edited rather than generated.
- **Assembly is three passes:** render each shot to its own mp4 → `concat`
  demuxer with `-c copy` → mix the music → `tpad=stop_mode=clone` to hold the
  last frame for the end card.
- **H.264, veryfast, CRF (no fixed bitrate), yuv420p, `+faststart`.**
- Verified with `ffprobe` — recorded output `duration=53.000000`.

## What to do with them

1. **Keep them.** They cost nothing to store and cannot be regenerated once the
   free window closes.
2. **Port the good parts into Studio**, one at a time. The 2% zoom is done. The
   caption fades are the next candidate.
3. Anything ported gets a note in `START-HERE.md` saying where it came from, so
   nobody "tidies" it back to a default that looks worse.
