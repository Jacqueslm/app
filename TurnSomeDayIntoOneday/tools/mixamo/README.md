# Mixamo → one fighter file

`img/fight/fighter.glb` is the 3D fighter for The Fight of Your Life: Mixamo's
X Bot with thirteen boxing moves baked in (idle, lead_jab, hook, uppercut,
left/right/center_block, dodging, stomach_hit, taking_punch, knocked_out,
getting_up, victory). 1.1 MB. Made 6 Sep 2026 from FBX files Jacques pulled
from mixamo.com (free Adobe account).

To rebuild it, or add a move:

1. On mixamo.com pick the character, then each animation, and Download as
   FBX Binary, 30 fps, no keyframe reduction. "With Skin" for the first one
   only (that carries the body), "Without Skin" for the rest.
2. Put the .fbx files in a folder called `mix` next to `convert.html`, with a
   copy of the `three` npm package (0.170) in `three/package` and the
   `meshoptimizer` package in `three/mo/package`.
3. Edit the `FILES` list in `convert.js` and run `node convert.js` (needs
   Playwright's Chromium). It writes `fighter.glb`.

What the converter does: takes the animations off every file and puts them on
the one skinned body; drops finger tracks (gloves cover the hands) and all
position tracks except the hips; halves the frame rate on clips over two
seconds; strips textures and UVs (the game lights it as a black shadow or a
colour); welds and simplifies the mesh with meshoptimizer to about 7,600
vertices keeping skin weights.

## The ref — `img/fight/ref.glb`

Suzie from Mixamo (the woman in the white shirt and black trousers), with six
moves baked in: `idle` (Standing Idle), `counting` (13.9 s: standing, bends and points for the count,
stands back up), `walking` (1 s loop), `talking`, `waving`, `hand_raising` (she raises her own
arm, 4 s). 2.6 MB. Made 6 Sep
2026 from the zip Jacques put on the GitHub release tagged `suzie`.

She keeps her skin, unlike the fighter: `convert-ref.html` keeps each
material's colour map, shrunk to 512 px and shared between the body parts, and
drops the normal, specular and gloss maps. Mesh cut to about 15,800 vertices.

To rebuild her, or add a move:

1. Put `character.fbx` (the character download, T-pose, FBX Binary, with skin)
   and each animation `.fbx` (Without Skin, 30 fps) in `mix/` next to
   `convert-ref.html`, with the same `three/` folder as above (the simplifier
   import is the `.module.js` build).
2. Edit `FILES` in `convert-ref.js` and run `node convert-ref.js`. It writes
   `ref.glb` next to itself.

`Standing Idle` is renamed `idle` on the way through so the game code can ask
for it by the same name it uses for the fighters.
