# A19 — "Nobody saw the second half" · BUILT 26 Aug 2026

Cause & Effect, 3 shots, 8s. Binge → the bathroom after.
File: `content/a19/binge-purge.mp4  (handed over in chat, not in the repo)` (1080x1920, 8.0s).

| Shot | Source | Caption |
|---|---|---|
| 1 — CAUSE, 3s, push in | `01-cause.png` | *Nobody saw her eat it.* |
| 2 — EFFECT, 3s, push in | `02-effect.png` | *Nobody saw this either.* |
| 3 — END CARD, 2s | house rule 16 | **This cycle can be broken.** / *It's free. Link in bio.* |

**Music:** `content/score/weisser-schnee.mp3` (22.7s), one of the 26 Aug tracks.

**Titles**
- YouTube: How to stop binge eating at night — what happens after everyone's asleep *(880/mo, KD 33)*
- TikTok / Facebook: Nobody saw the second half

**Buffer caption:** The binge isn't the end of it. There's a second half nobody
talks about, and doing it alone is the reason it keeps happening. It's free.
Link in bio.

**Posting:** YouTube + Facebook first. TikTok and Instagram both restrict
content about purging even in a recovery frame — this cut helps, because the
act is never shown, only the moment after. AI-generated toggle ON everywhere
(house rule 19).

**Rebuild:**
```
export NODE_PATH=/opt/node22/lib/node_modules
python3 tools/make-film.py content/a19/spec.json content/a19/binge-purge.mp4  (handed over in chat, not in the repo)
```
Note: shot `src` paths are relative to this spec file; `music` is relative to
the repo root.


**Renumbered twice, 27 Aug 2026.** Another session on `main` claimed A15, A16, A16b
and A17 while this was being built, so this piece moved to A19. The .mp4 is handed
over in chat, not committed (rule, 27 Aug); the spec, the stills and
`tools/make-film.py` are all here to re-render it.

