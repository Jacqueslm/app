# What I changed on 8 Sep, and how to undo any of it

Written for Jacques, 8 Sep 2026, after a day that ended with the fight glitching
and being put back to where it started.

**The fight page is already back to yesterday.** `game3d.html` is byte for byte
the file from 7 Sep 22:39. Nothing I did today is in it. If the fight still
glitches, it is glitching on yesterday's code, and the cause is not in this list.

Everything below is what is **still in** the app from today, and what it was
before. Copies of every original file are in `docs/before-8-sep/`.

---

## The Play Store update

One file changed: `TurnSomeDayIntoOneday/twa/twa-manifest.json`. That is the
settings file the Android app is built from.

| Setting | Before | After |
| --- | --- | --- |
| `appVersionName` | 1.0.2 | 1.0.3 |
| `appVersionCode` | 3 | 4 |
| `features.playBilling.enabled` | true | **false** |
| `alphaDependencies.enabled` | true | false |
| `appVersion` | 1.0.2 | 1.0.3 |

**Why:** the "In-app purchases" badge on the store listing comes from the Play
Billing library being inside the uploaded app file, not from the products in Play
Console. Those products can no longer be deleted — once a base plan has been
published Google only allows deactivating it, which was already done — so the
badge only lifts once a build without the library is live.

**What you did with it:** built 1.0.3 with `MakePlayApp.bat`, uploaded
`app-release-bundle.aab` to Production, and it went into review. The upload
measured 626 KB against the old 1,798 KB — that drop is the billing library
coming out.

**To undo:** copy `docs/before-8-sep/twa/twa-manifest.json` back over
`TurnSomeDayIntoOneday/twa/twa-manifest.json`, rebuild, upload as a new release.
You would be putting billing back into an app that sells nothing, so the badge
would return. I would leave it.

---

## Still in the app from today

### `index.html`

- **Friendly is private.** Six ways in — the tab, the Tools row, two Profile
  rows, the SOS sheet, the "I slipped" sheet — are all hidden unless the server
  says the account is on the list. Plus the guide's answers and the search entry.
- **Chats are unlimited.** The old cap that gave everyone zero chats a day is gone.
- **The Meditation room** holds Talk me through it, Calm down, 5-4-3-2-1
  grounding, Ride it out and Sit quiet. "Right now" as a heading is gone.
- **The Spiritual Path** is no longer a separate card on Today. Faith is already
  woven into every daily lesson; the card was a second track competing with it.
- **The stairs:** cleared floors say "cleared · go again" and can be replayed,
  and there is a "Start the whole thing over" button. A replay changes nothing —
  no floor re-cleared, no win or loss recorded, the climb does not move.
- **Sign-up** no longer asks you to pick a voice for Friendly, or name Friendly
  in the questions and the summary.
- **Play-install detection restored** (`isPlayBuild`, `applyPlayBuildUI`). The
  billing removal deleted these but left the call, so `initApp` threw there and
  every line after it — dark mode, discretion mode, the toggles, the notification
  state — stopped running. That was a real break and this fixed it.
- **App version 3.7.**

### `sw.js`

Cache name `tsid-shell-v3.7`, so phones fetch fresh files.

### `tools/ring3d/ring3d.html`

One line: a viewport meta tag. Preview tool only, not the app.

### `tools/posetest/index.html` (new)

The lean test page at `/tools/posetest/`. Not linked from anywhere, not part of
the app. Camera and body tracking, to answer whether body-dodging is possible.

### `server/test/game.test.js`

Tests for the stairs replay and start-over. The tests I wrote for the fight
features were removed with those features.

### `START-HERE.md`

A note recording that Play billing is off and not to switch it back on.

---

## Taken out again (all of today's fight work)

Every one of these is still in the history and can come back on its own:

| What | Commit |
| --- | --- |
| Go again, start over, skip the walk-in, one voice on the round | `43f84ba5` |
| Four rooms on the picker, Rooftop added | `18c34921` |
| Thirteen element fighting styles, and feints | `697bef7e` |
| A fifth punch (Body) and combinations | `24d96d8e` |
| You get yourself up — GET UP, no ten count | `a996b6d0` |
| The iPhone viewport line, iOS speech, full-screen fight | `8d4357fa` |
| Camera clamp so a dodge cannot swing it round | `6a979867` |
| Ringside camera rebuilt off the line between fighters | `2061d639` |
| Model addresses versioned against the cache | `47239860` |
| Skip walk-in facing fix | `bb3c1bbd` |
| Knockdown lights not restoring — the black screen | `48da9432` |
| Render loop self-healing and on-screen diagnostics | `2d09472b` |
| Round stops cutting behind your own fighter | `d742eb7a` |

To bring one back on its own, on a branch, without touching anything live:

```
git checkout -b try-one-thing origin/main
git cherry-pick <commit>
```

---

## What went wrong today, plainly

I made thirteen changes to the fight in about two hours, pushed them together,
and could not tell which one broke it when you said it was wrong. Then I guessed
at what "backwards" meant instead of measuring it, and each guess added another
change.

When I said I was reverting "to this morning", I went back to 21:06 **today** —
which still had four of my own changes in it. So that revert fixed nothing, and I
spent the evening chasing faults I had put there and telling you they were old
ones. That was wrong and I should have checked before saying it.

The fight is now genuinely back to yesterday. Anything that comes back should
come back one at a time, on a branch, checked on your phone before the next one.
