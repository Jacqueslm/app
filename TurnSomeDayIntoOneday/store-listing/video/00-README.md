# Play promo video

`day-one-promo.mp4` — 15s, 1920×1080, 24fps, ~2MB.

## Why it was remade (29 Aug 2026)

The previous trailer said **"Every tool, free."** while showing **Friendly** on
screen. Friendly is Pro. The app's own words: *"Friendly is part of Pro, so the
free plan does not include chats."* So the claim was contradicted by the exact
frame it played over — on a Health & Fitness listing, which is held to accurate
representation.

## What this one claims, and why each is safe

| On screen | Why it is true |
|---|---|
| "It counts the days. It never shames a slip." | Reset keeps everything but the number |
| "Breathing, grounding, a voice that talks you through it, and 988. Always free." | Matches the app: *the SOS set, breathing, Talk me through it and 988 are always free and never behind a paywall* |
| "A lesson a day, on twelve habits. Every one reads itself aloud." | Twelve recovery tracks; every lesson has narration |
| "Free is genuinely free" split | Free: counter, SOS & breathing, journal, weekly reports, first 15 days. Pro: days 16–90, Friendly, live rooms |
| "Addicted for 38 years and got free at 50" | His own story, not a health claim |

**No outcome claims.** Nothing says helps, cures, reduces, proven. That is
deliberate — Health & Fitness pulls Google's Health Content policy.

## To publish

1. Upload the mp4 to YouTube (unlisted or public — Play accepts either).
2. Play Console → Main store listing → Graphics → **Promo video** → paste the
   YouTube URL → Save.

## To rebuild or edit

`promo-source.html` is the film. It exposes `window.FILM_LEN` and
`window.seek(ms)`; timings live in the `SHOTS` array.

    node tools/render-film.js promo-source.html /tmp/frames 24    # viewport 1920x1080
    ffmpeg -framerate 24 -i /tmp/frames/f%04d.png -i <score>.mp3 ...

Screens come from `../screenshots/`. Music is `content/score/fading-light-1.mp3`
— Suno, cleared for commercial use on Jacques's paid plan (see
`reference/asset-licenses-2026-08-08.md`).
