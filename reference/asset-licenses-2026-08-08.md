# What we're allowed to use — license audit, 8 Aug 2026

Both products, everything third-party. Prompted by finding that two of the
recovery app's five SOS voices were licensed **non-commercial** while the app
charges money.

The rule this is all measured against: **the app takes money, so anything in it
has to be free for commercial use.** "Free to download" is not the same thing.

---

## The problem that started this — FIXED

The five SOS "Talk me through it" recordings were built with Piper voices
picked for how they sounded. Nobody read the license file inside the download.

| File | Old voice | Old license | Allowed? |
|---|---|---|---|
| sos-talk-warm.mp3 | hfc_female | CC BY-NC-SA 4.0 | **No** — non-commercial |
| sos-talk-male.mp3 | hfc_male | CC BY-NC-SA 4.0 | **No** — non-commercial |
| sos-talk-clear.mp3 | lessac | Blizzard 2013 research license | **No** |
| sos-talk-soft.mp3 | amy | unstated, points at a dead URL | Unknown |
| sos-talk-gentle.mp3 | kristin | public domain | Yes |

Rebuilt 8 Aug with voices that are all public domain or CC0:

| File | New voice | License |
|---|---|---|
| sos-talk-warm.mp3 | en_US-kristin-medium | public domain |
| sos-talk-soft.mp3 | en_GB-cori-medium | public domain (LibriVox) |
| sos-talk-gentle.mp3 | en_US-kathleen-low | CC0 |
| sos-talk-clear.mp3 | en_US-ljspeech-high | public domain |
| sos-talk-male.mp3 | en_US-norman-medium | public domain |

Studio's narrators were built from the same bad voices and were replaced in the
same pass (`Studio/server/speak.js`) with public-domain ones.

**Piper voices that are NOT usable in either product:** hfc_female, hfc_male,
ryan, lessac (any tier), southern_english_female, alba. Check the `MODEL_CARD`
file inside any voice download before adding it.

---

## Everything else — clean

**Fonts.** None bundled, no Google Fonts, no `@font-face`. Both products use
whatever the device already has. Nothing to license.

**External scripts and stylesheets.** None. No CDN, no analytics tag, no
embedded widget. Every byte the app serves comes from our own server.

**Images.** Every image in the repo is ours: the OG link-preview images are
Jacques-made, the icons and Play Store screenshots were made for this app, and
Studio's watermark is the Day One logo. No stock, no scraped images.

**Recovery-program text.** Nothing copied. This matters more than it sounds:
the Twelve Steps, the Serenity Prayer and the Big Book text are all owned by
Alcoholics Anonymous World Services, and recovery apps get taken down for
reprinting them. Searched the whole app — no trace of any of it. The lessons
are original writing.

**npm packages, recovery app server.** 95 packages: 85 MIT, 4 ISC, 4 BSD,
1 Apache-2.0, 1 MPL-2.0. All permissive, all fine. (MPL only bites if you edit
that library's own files, which we don't.)

**npm packages, Studio.** 185 packages, almost all MIT/Apache/BSD. Three worth
naming:

- `ffmpeg-static` — **GPL-3.0-or-later**. It's the video encoder.
- `sharp-libvips` — LGPL-3.0. Image resizing.
- Everything else — permissive.

GPL only creates obligations when you **give the software to someone else**.
Studio runs on Jacques's own machine and is not distributed, so nothing is
triggered. **The videos ffmpeg produces are not covered by its license** — what
comes out is entirely his to sell. If Studio is ever handed to another person,
revisit this first.

**Whisper** (local transcription, `Xenova/whisper-small.en`) — MIT. Fine
commercially.

**Pexels stock footage** — free for commercial use, no attribution required.
The one rule: don't resell the clips unaltered as stock. Using them inside a
video is exactly what the license is for.

**fal.ai generated images, video and voice** — fal's terms assign the output to
the account that generated it. His to use and sell.

---

## Music — settled, 8 Aug

Studio imports songs from Suno links, and those songs go into monetised
YouTube videos, so the question was whether they were cleared for commercial
use.

**Jacques confirmed he has permission for every track he uses**, and that he's
on a paid Suno plan. Closed — don't raise it at him again.

For reference if the situation ever changes: Suno's free tier is
non-commercial, and a paid plan clears songs made **while subscribed** without
retroactively covering anything made earlier on the free plan.

---

## Rule going forward

Before any third-party asset goes into either product — a voice, a font, an
image, a music track, a sound effect — find its license and write it down. If
the license says "non-commercial", "research only", or "no derivatives", it
cannot go in. If it can't be found at all, treat it as a no.
