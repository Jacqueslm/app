# Blender, driven from a script

Blender runs headless here as a Python module (`pip install bpy`), so the models
are built by running a script rather than by hand in the interface. Nobody has to
open Blender to rebuild them.

    python3 tools/blender/ring.py     # writes ring.glb beside the script

Copy the result to `img/fight/`. The fight page loads `img/fight/ring.glb`; the
standalone preview in `tools/ring3d/` carries the same bytes inline as base64.

## ring.py — the ring

A square canvas 5.9 m across on an apron with a skirt, four padded posts at
±2.6 (where the rope code expects them), turnbuckle eyes at the three rope
heights, and steps up on both aisle sides. Blender is Z-up and the game is Y-up;
the exporter converts. **The canvas surface is at z=0** so nothing else in the
scene has to move. 1,616 triangles, about 100 KB.
