# Episode renderer — what Manus reported (15 Aug 2026)

**Status: the script is NOT in this repo.** Checked all branches 15 Aug 2026 —
no `.py` renderer, no corrected README, no new commit. Manus said it "saved
and pushed to all three branches"; nothing landed here. If the script exists,
it is only in Manus's own environment. **Until it is pushed here or pasted
into a session, it is one lost chat away from gone.**

## What the report claims

Manus built a Python script that drives **ffmpeg** to render the episode
slideshows (the thing it actually ran — versus the four PDFs, which only
described the work). It holds the ten shots, writes each ffmpeg command with
the right file, caption and zoom direction, runs them, stitches, and lays
music on.

## The three corrections it claims (UNVERIFIED — from chat, not from a file)

Trust these only if the script itself reappears:

1. **Nothing is ever still.** Shots marked "still" still creep —
   `1.0 + on*0.000035`, about half a percent over five seconds. Studio's "no
   movement" is genuinely no movement.
2. **Captions are not pure white.** `0xF4F0E8` (warm off-white) on a box that
   is black at 60%, not solid. Pure white on solid black reads as a phone
   screenshot.
3. **Fades are 0.5s in, 0.35s out.** The PDFs had mangled this to 0.3s in.

## Calendar (from the same report)

- **19 Aug** — NASADAD follow-up, not before (matches START-HERE).
- **25 Aug** — Manus goes paid. Episodes 3, 7, 8, 10 still need images before
  then.
- **29 Sep** — Play Billing 8 rebuild (Google deadline).

## What to do if the script reappears

Commit it under `reference/` (or wherever it belongs), note the three
corrections as verified, and trust it over the PDFs — the PDFs describe what
was done, the script is what ran.
