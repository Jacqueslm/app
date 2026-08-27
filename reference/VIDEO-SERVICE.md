# The video service — done-for-you films for recovery professionals

Built 25 Aug 2026. The second income stream after treatment-center licensing.
Runs entirely on `tools/make-film.py` — a finished, captioned, scored,
watermarked film takes under a minute of compute, so the margin is his time on
the script, not production.

**Sales page (artifact, private until he shares it) — the five films PLAY on the
page, they are not stills.** Each is embedded twice, H.264/AAC for Safari/iOS and
VP9/Opus for Chromium/Firefox, decoded into Blob URLs at load because Chrome will
not play a multi-megabyte data: URI in a video src. Page weight 3.2MB. Source
kept at `reference/pitch/video-service.html`; rebuild by re-encoding at 480px
wide and re-embedding.

**Sales page:**
https://claude.ai/code/artifact/96d9ff30-6c44-4c12-9ce3-f3f7d280f35d

## The offer

| Package | Price | What they get |
|---|---|---|
| Try one | **$150 once** | 3 finished films, captions, 48h, no subscription |
| Monthly | **$399/mo** | 8 films, 2/week, per-platform captions, one revision |
| Program | **$699/mo** | 16 films, alumni + family angles, intake pages reviewed for search |

Month to month, cancel by email, they keep every file. Music is original
(his own Suno tracks and beds synthesized here), so there is no licensing
question — worth saying out loud to any program with a compliance officer.

## Who to sell to

1. **Recovery coaches and counselors in private practice** — they know they
   should post, they have no time, and $150 is under the threshold where they
   need to think about it.
2. **Sober living operators** — often the same person already being pitched the
   app partnership. Do NOT pitch both in the same email; lead with the free app,
   and let video come up later if they ask who makes the videos.
3. **Small treatment programs** without a marketing person.
4. **Recovery podcasters** — they need clips from episodes; that's the same
   pipeline with their audio dropped in.
5. **Faith-based recovery ministries** — Celebrate Recovery groups run in
   thousands of churches and almost none have content.

## Why he wins against an agency

- He was in it 38 years. An agency writes recovery content from a brief.
- 48-hour turnaround, because the pipeline is one command.
- Original music, no stock, nothing subcontracted.
- He is not selling them software or a retainer they cannot leave.

## Delivery flow (keep it this simple)

1. Ten-minute call or a voice note from the client.
2. He writes 3 scripts in their voice, sends for a yes.
3. Images: their own photos if they have them, generated stills if not.
4. `python3 tools/make-film.py spec.json out.mp4` per film.
5. Send the files plus a written caption for each. Done.

## Emails
Two cold drafts are in his Gmail (25 Aug): one for counselors/coaches in private
practice, one for programs. Both link the sales page rather than attaching
anything. Rule: never pitch the app partnership and the video service in the
same email — one is a gift, the other is an invoice, and mixing them makes the
gift look like bait.
