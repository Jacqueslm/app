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
