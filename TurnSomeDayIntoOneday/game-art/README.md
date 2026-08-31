# game-art

Drop the boxer photos in this folder, then commit and push.
Claude Code cuts them out, mirrors what needs mirroring, and wires them into
the fight in the Game tab. Nothing here ships until it has been processed —
these are source files, not what the app loads.

## Files to put here

| filename      | what it is                                                    |
|---------------|---------------------------------------------------------------|
| `guard.png`   | gloves up beside the cheeks, chin down, looking at camera      |
| `windup.png`  | one arm cocked back to throw (only one side — the other side is mirrored in code) |
| `hit.png`     | head snapped back, arms falling away, taking the shot          |
| `knee.png`    | down on one knee, gloves on the floor, head bowed              |
| `down.png`    | the wide knockdown shot in the ring (used full-frame behind the count) |

## Rules for the source images

- One man per image. No sheets, no rows of poses.
- Same fighter in every image: same face, same hair, same tank top, same shorts, same gloves.
- Plain flat wall behind him for `guard` / `windup` / `hit` / `knee` so the background
  can be removed cleanly. `down.png` is the exception — that one keeps its ring.
- Whole body in frame with empty space around him. Nothing touching or crossing the edge.
- PNG or JPG both fine. Bigger is better; they get scaled down.

## Licensing

Anything in here ships inside an app published on Google Play, so it must be
licensed for commercial use. Generated art from Studio qualifies. Photos found
online do not.
