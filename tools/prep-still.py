#!/usr/bin/env python3
"""Prepare a still for the parallax pipeline: upscale it, and cut the subject out.

    python3 tools/prep-still.py content/food/01-table.jpg

Writes two files next to the source:
    <name>-up.jpg   the upscaled/sharpened plate  (background layer)
    <name>-cut.png  the subject on transparency   (foreground layer)

The film source then moves those two layers at different speeds, which is what
makes a flat photo read as depth instead of sliding around as one sheet.

WHY THIS EXISTS: image *generation* is blocked in this environment (every model
host 403s at the gateway) but background removal is not - rembg's u2net model
lives on a GitHub release, which is reachable. So the subject cutout is free and
local, and it is the one real camera upgrade available here.

FIRST RUN builds a venv and downloads u2net (~176MB, GitHub). After that it is
offline and takes ~4s a picture. The venv lives outside the repo on purpose.
"""
import os, subprocess, sys, shutil

VENV = os.environ.get("STILL_VENV", "/tmp/still-venv")
PY = os.path.join(VENV, "bin", "python")
FF = "/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"


def ensure_venv():
    """Build the venv on first use. Never installs into system site-packages -
    that fails here on a broken setuptools dist-info."""
    if os.path.exists(PY):
        try:
            subprocess.run([PY, "-c", "import rembg"], check=True,
                           capture_output=True)
            return
        except subprocess.CalledProcessError:
            pass
    print("first run: building venv + fetching u2net (~176MB, one time)...")
    subprocess.run([sys.executable, "-m", "venv", VENV], check=True)
    subprocess.run([PY, "-m", "pip", "install", "-q", "--upgrade", "pip"], check=True)
    subprocess.run([PY, "-m", "pip", "install", "-q", "rembg", "onnxruntime", "pillow"],
                   check=True)


CUT_SRC = """
import sys
from rembg import remove, new_session
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGBA")
out = remove(img, session=new_session("u2net"))
out.save(dst)
a = out.split()[-1]
n = sum(1 for v in a.getdata() if v > 200)
print("subject %.1f%%" % (100.0 * n / (out.size[0] * out.size[1])))
"""


def upscale(src, dst, target_h=1920):
    """Lanczos + a light unsharp. Borrowed from Studio's photo-tools.js: this is
    NOT an AI upscaler and invents no detail - it makes a small picture usable
    at 1080x1920, which is what the soft 784px stills actually need."""
    subprocess.run([FF, "-y", "-v", "error", "-i", src,
                    "-vf", f"scale=-2:{target_h}:flags=lanczos,unsharp=5:5:0.9:5:5:0.0",
                    "-q:v", "2", dst], check=True)


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    src = sys.argv[1]
    base, _ = os.path.splitext(src)
    up, cut = base + "-up.jpg", base + "-cut.png"
    ensure_venv()
    upscale(src, up)
    r = subprocess.run([PY, "-c", CUT_SRC, up, cut], capture_output=True, text=True)
    if r.returncode:
        sys.stderr.write(r.stdout + r.stderr)
        raise SystemExit("cutout failed")
    print(f"{up}\n{cut}  {r.stdout.strip()}")


if __name__ == "__main__":
    main()
