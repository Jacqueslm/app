# Graphics — what to upload where

| Play Console field | File | Size |
|---|---|---|
| App icon | `icons/icon-512.png` | 512 x 512 |
| Feature graphic | `screenshots/feature-graphic-1024x500.png` | 1024 x 500 |
| Phone screenshots (min 2, max 8) | `screenshots-captioned/01` ... `06` | 1080 x 1920 |

## Upload the captioned set, in this order

The tester report (9 Aug 2026) said the listing used plain screenshots that
don't say what any screen does, and asked for captions. `screenshots-captioned/`
is that: the same real screens with a headline band above each one.

| # | File | Caption |
|---|---|---|
| 1 | `01-home.png` | Every sober day, counted |
| 2 | `02-sos.png` | One tap when the craving hits |
| 3 | `03-chat.png` | An AI companion at 3am |
| 4 | `04-lessons.png` | A new lesson every day |
| 5 | `05-journal.png` | Write it down, keep it private |
| 6 | `06-progress.png` | Progress that never resets |

Order matters. Play shows the first two or three before anyone scrolls, so the
day counter leads and the craving button follows. The old upload led with the
988 crisis screen — a heavy first impression for someone still deciding.

To change any caption, edit `PANELS` in `make-captioned-screenshots.py` and
re-run it. The raw screenshots are never touched.

Two rules the captions are written to: **no outcome claims** ("helps you quit",
"reduces cravings") anywhere in a screenshot, and the companion is named as an
AI rather than as a person. Both come from the health-apps declaration in
`04-health-declaration.md`, and both are things listings get rejected over.

## The screenshots

Captured from the real running app, not mocked up, so the listing shows what
someone actually gets. They are seeded with a 47-day account because an empty
app photographs badly and misrepresents it - zeros everywhere read as "nothing
happens here".

1080 x 1920 is deliberate: 9:16 is the tallest ratio Play accepts, and a real
phone viewport scaled 3x is what makes the app fill the frame instead of
rendering as a narrow column.

Three things are suppressed in the captures and remain in the app: the guide
bubble, the milestone offer card on the home shot, and the one-time AI safety
notice, which dims the whole screen behind it.

To regenerate after a UI change, re-run the capture script against a local
server on port 4300.

## The feature graphic

The app icon and the app name on the app's own gradient. **No tagline** - the
marketing line is yours to write. If you want one added, send me the words and
I will set them; I will not invent them.

## What is still missing, and is optional

- **Tablet screenshots.** Not required. Without them Play may show a "not
  optimised for tablets" note on tablet devices. Not worth blocking on.
- **Promo video.** Optional, and a YouTube URL rather than an upload.
