"""Proof of concept: a 14 second title sequence for Freedom, LLC.

Frames are drawn with PIL and piped straight into ffmpeg as raw RGB, so no
frame files touch the disk. Audio is the first 14 seconds of the 90 bpm loop.
Needs the static ffmpeg that imageio-ffmpeg downloads (pip install imageio-ffmpeg).
"""
import math
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1280, 720, 30
INK, RED, BONE, GREY = (10, 10, 11), (179, 18, 26), (238, 233, 222), (150, 145, 137)
N_SCENE_A = 4 * FPS          # wordmark in
N_SCENE_B = 7 * FPS          # cover push-in
N_SCENE_C = 3 * FPS          # end card
XFADE = FPS // 2


FONT_DIR = os.path.join(HERE, "fonts")


def font(size, bold=True):
    """Real font files first: this box ships none, and load_default() renders at
    size 10 no matter what, which is how the first cut came out microscopic."""
    names = ("DejaVuSans-Bold.ttf",) if bold else ("DejaVuSans.ttf", "DejaVuSans-Bold.ttf")
    for base in (FONT_DIR, "/usr/share/fonts/truetype/dejavu"):
        for name in names:
            p = os.path.join(base, name)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)


def grain(img, strength=6.0):
    a = np.random.normal(0, strength, (H // 2, W // 2, 1)).repeat(3, axis=2)
    g = Image.fromarray(np.clip(128 + a, 0, 255).astype("uint8")).resize((W, H))
    return Image.blend(img, g, 0.09)


def spaced(d, xy, text, f, fill, tracking):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + tracking


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, t)))


def scene_a(p):
    """Wordmark fades up on black, red rule draws across."""
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    a = ease(p / 0.55)
    f_big, f_small, f_tiny = font(96), font(22, False), font(15, False)

    d.text((80, 96), "TURN SOMEDAY INTO DAY ONE", font=f_tiny, fill=(110, 106, 100))
    word = Image.new("RGB", (W, H), INK)
    wd = ImageDraw.Draw(word)
    wd.text((78, 250), "FREEDOM,", font=f_big, fill=BONE)
    spaced(wd, (82, 380), "AN ILLNESS PRESENTATION OF HOPE", f_small, GREY, 4.0)
    img = Image.blend(img, word, a)

    # red rule sweeping in from the left, sitting under the wordmark
    w = int((W - 160) * ease((p - 0.2) / 0.6))
    d = ImageDraw.Draw(img)
    if w > 0:
        d.rectangle([80, 460, 80 + w, 466], fill=RED)
    return img


def scene_b(p, cover):
    """Slow push-in on the cover, with a vignette so it doesn't look pasted."""
    zoom = 1.06 + 0.10 * ease(p)
    cw = int(W * zoom) if W / H >= cover.width / cover.height else int(H * zoom * cover.width / cover.height)
    ch = int(cw * cover.height / cover.width)
    c = cover.resize((cw, ch), Image.LANCZOS)
    ox, oy = (cw - W) // 2, (ch - H) // 2
    img = c.crop((ox, oy, ox + W, oy + H)).convert("RGB")

    # light flicker, like a projector that has seen some things
    flick = 1.0 + 0.012 * math.sin(p * math.pi * 26)
    img = Image.eval(img, lambda v: min(255, int(v * flick)))
    return img


def scene_c(p):
    """End card: the barcode line, the tempo, then out."""
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    f_big, f_small = font(46), font(18, False)
    a = ease(p / 0.5)

    for i, line in enumerate(("balance due", "90 BPM  ·  EAST X WEST  ·  UNDERGROUND")):
        layer = Image.new("RGB", (W, H), INK)
        ld = ImageDraw.Draw(layer)
        title = f_big if i == 0 else f_small
        tw = d.textlength(line, font=title)
        ld.text(((W - tw) / 2, 300 + i * 74), line, font=title,
                fill=BONE if i == 0 else GREY)
        img = Image.blend(img, layer, a)
    return img


def frame(i, cover):
    total = N_SCENE_A + N_SCENE_B + N_SCENE_C
    if i < N_SCENE_A:
        return scene_a(i / N_SCENE_A)
    if i < N_SCENE_A + N_SCENE_B:
        p = (i - N_SCENE_A) / N_SCENE_B
        cur = scene_b(p, cover)
        if p < XFADE / N_SCENE_B:
            return Image.blend(scene_a(1.0), cur, ease(p * N_SCENE_B / XFADE))
        return cur
    p = (i - N_SCENE_A - N_SCENE_B) / N_SCENE_C
    cur = scene_c(p)
    if p < XFADE / N_SCENE_C:
        return Image.blend(scene_b(1.0, cover), cur, ease(p * N_SCENE_C / XFADE))
    if p > 0.72:  # fade out on the tail
        k = (p - 0.72) / 0.28
        cur = Image.blend(cur, Image.new("RGB", (W, H), INK), ease(k))
    return cur


def main():
    try:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        ffmpeg = "ffmpeg"

    total = N_SCENE_A + N_SCENE_B + N_SCENE_C
    cover = Image.open(os.path.join(HERE, "freedom-llc-cover.png")).convert("RGB")
    wav = os.path.join(HERE, "freedom-llc-beat-90bpm.wav")
    out = os.path.join(HERE, "freedom-llc-title.mp4")

    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-ss", "0", "-t", f"{total / FPS:.2f}", "-i", wav,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(total):
        proc.stdin.write(np.asarray(grain(frame(i, cover)), dtype="uint8").tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit("ffmpeg failed")
    print("wrote", out, f"{os.path.getsize(out)/1048576:.1f} MB", f"{total/FPS:.1f} s", f"{FPS} fps")


if __name__ == "__main__":
    main()
