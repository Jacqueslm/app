# Graphics — what to upload where

All files are in `store-listing/screenshots/`.

| Play Console field | File | Size |
|---|---|---|
| App icon | `icons/icon-512.png` | 512 x 512 |
| Feature graphic | `feature-graphic-1024x500.png` | 1024 x 500 |
| Phone screenshots (min 2, max 8) | `01-home` ... `06-sos` | 1080 x 1920 |

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
