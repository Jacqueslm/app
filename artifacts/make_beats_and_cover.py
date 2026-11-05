"""Freedom, LLC - a 90 bpm underground beat and its cover, made from nothing.

No samples, no downloads: the drums are synthesised here (kick sweep, noise
snare, hats), the cover is drawn with PIL. Run it and it writes both files.
"""
import math
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SR = 44100
BPM = 90.0
BARS = 16
BEAT = 60.0 / BPM
STEP = BEAT / 4.0  # one sixteenth
HERE = os.path.dirname(os.path.abspath(__file__))


# ------------------------------------------------------------------ drums ---
def kick(dur=0.42):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t / 0.018)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.105)
    click = np.random.randn(n) * np.exp(-t / 0.004) * 0.35
    return (body + click) * 0.95


def sub808(dur=0.34, note=49.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    glide = note * (1 + 0.25 * np.exp(-t / 0.03))
    ph = 2 * np.pi * np.cumsum(glide) / SR
    return np.sin(ph) * np.exp(-t / 0.16) * 0.55


def snare(dur=0.26):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = np.random.randn(n)
    noise = np.diff(noise, prepend=0.0)  # crude high-pass: dusty, not clean
    tone = np.sin(2 * np.pi * 184 * t) * 0.35
    return (noise * 0.55 + tone) * np.exp(-t / 0.075)


def hat(dur=0.055, open_=False):
    d = 0.055 if not open_ else 0.16
    n = int(d * SR)
    t = np.arange(n) / SR
    noise = np.random.randn(n)
    noise = np.diff(np.diff(noise, prepend=0.0), prepend=0.0)
    return noise * np.exp(-t / (0.016 if not open_ else 0.05)) * 0.30


def place(buf, sound, at_sec, gain=1.0, pan=0.0):
    start = int(at_sec * SR)
    end = min(start + len(sound), len(buf))
    if start >= len(buf):
        return
    seg = sound[: end - start] * gain
    left = math.sqrt((1 - pan) / 2) * seg
    right = math.sqrt((1 + pan) / 2) * seg
    buf[start:end, 0] += left
    buf[start:end, 1] += right


def build():
    total = int(BARS * 4 * BEAT * SR) + SR
    buf = np.zeros((total, 2), dtype=np.float64)

    k = kick()
    s = snare()
    h = hat()
    ho = hat(open_=True)
    sub = sub808()

    # boom-bap: kick 1 and the "and" of 2, snare on 2 and 4, swung eighths
    kicks = {0: 1, 3: 0}
    for bar in range(BARS):
        bar0 = bar * 4 * BEAT
        for step, extra in kicks.items():
            place(buf, k, bar0 + step * STEP, 1.0)
            if step == 0:
                place(buf, sub, bar0 + step * STEP, 0.9)
        # the push kick on the and-of-3
        place(buf, k, bar0 + 10 * STEP, 0.85, pan=0.0)
        if bar % 4 == 3:
            place(buf, k, bar0 + 14 * STEP, 0.7)
        # snares
        place(buf, s, bar0 + 4 * STEP, 0.95, pan=-0.05)
        place(buf, s, bar0 + 12 * STEP, 1.0, pan=0.05)
        if bar % 8 == 7:  # fill into the next section
            for i, g in zip((13, 14, 15), (0.45, 0.6, 0.8)):
                place(buf, s, bar0 + i * STEP, g)
        # hats: swung eighths, open hat on the last eighth of every bar
        for step in range(0, 16, 2):
            swing = 0.045 * STEP if step % 4 == 2 else 0.0
            place(buf, h, bar0 + step * STEP + swing, 0.8, pan=0.25)
        place(buf, ho, bar0 + 14 * STEP + 0.05 * STEP, 0.75, pan=0.2)

    # tape dust, then a little saturation so it hits like a loud record rather
    # than a quiet loop (first pass measured -25 dBFS RMS, too soft to rap on)
    buf += np.random.randn(*buf.shape) * 0.0025
    peak = np.max(np.abs(buf)) or 1.0
    buf = buf / peak
    buf = np.tanh(buf * 2.0) / math.tanh(2.0)
    peak = np.max(np.abs(buf)) or 1.0
    buf = buf / peak * 0.94
    return buf


def write_wav(path, buf):
    data = (np.clip(buf, -1.0, 1.0) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


# ------------------------------------------------------------------ cover ---
def font(size, bold=True):
    for p in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def cover(size=3000):
    ink, red, bone = (10, 10, 11), (179, 18, 26), (238, 233, 222)
    img = Image.new("RGB", (size, size), ink)
    d = ImageDraw.Draw(img)

    # paper grain
    grain = np.random.normal(0, 7, (size // 4, size // 4, 1)).repeat(3, axis=2)
    g = Image.fromarray(np.clip(128 + grain, 0, 255).astype("uint8")).resize((size, size))
    img = Image.blend(img, g, 0.10)
    d = ImageDraw.Draw(img)

    m = int(size * 0.085)
    d.rectangle([m, m, size - m, size - m], outline=(70, 68, 64), width=3)

    # the red band behind LLC
    band_top = int(size * 0.455)
    band_h = int(size * 0.20)
    d.rectangle([m, band_top, size - m, band_top + band_h], fill=red)

    # fit the title to the frame instead of guessing: the comma clipped on the
    # first pass, and a clipped comma is the whole cover looking broken.
    inner_w = size - 2 * m - int(size * 0.07)
    title_size = int(size * 0.185)
    while title_size > 100:
        probe = font(title_size)
        if d.textlength("FREEDOM,", font=probe) <= inner_w:
            break
        title_size -= 4
    f_title = font(title_size)
    f_llc = font(int(size * 0.155))
    f_sub = font(int(size * 0.036), bold=False)
    f_sub_b = font(int(size * 0.034))
    f_small = font(int(size * 0.026), bold=False)

    d.text((m + int(size * 0.035), int(size * 0.185) - title_size // 2), "FREEDOM,", font=f_title, fill=bone)

    # LLC, letter-spaced inside the red band
    x = m + int(size * 0.035)
    for ch in "LLC":
        d.text((x, band_top + int(band_h * 0.10)), ch, font=f_llc, fill=bone)
        x += int(size * 0.098)
    d.text((size - m - int(size * 0.30), band_top + int(band_h * 0.62)),
           "EST. NEVER", font=f_small, fill=(255, 214, 208))

    # the subtitle, spaced out like a stamp
    sub = "AN ILLNESS PRESENTATION OF HOPE"
    x = m + int(size * 0.035)
    y = band_top + band_h + int(size * 0.055)
    for ch in sub:
        d.text((x, y), ch, font=f_sub_b, fill=bone)
        x += d.textlength(ch, font=f_sub_b) + size * 0.0042

    # barcode: the barcode and the buzz
    bx, by = size - m - int(size * 0.26), size - m - int(size * 0.155)
    x = bx
    rng = np.random.default_rng(7)
    while x < size - m - int(size * 0.035):
        w = int(rng.choice([3, 4, 6, 9]))
        d.rectangle([x, by, x + w, by + int(size * 0.075)], fill=bone)
        x += w + int(rng.choice([5, 7, 9, 12]))

    d.text((m + int(size * 0.035), size - m - int(size * 0.145)),
           "90 BPM  ·  EAST X WEST  ·  UNDERGROUND", font=f_small, fill=(150, 145, 137))
    d.text((m + int(size * 0.035), size - m - int(size * 0.095)),
           "balance due", font=f_small, fill=(120, 116, 110))

    out = os.path.join(HERE, "freedom-llc-cover.png")
    img.save(out, "PNG", optimize=True)
    return out


if __name__ == "__main__":
    buf = build()
    wav = os.path.join(HERE, "freedom-llc-beat-90bpm.wav")
    write_wav(wav, buf)
    print("wrote", wav, f"{os.path.getsize(wav)/1048576:.1f} MB", f"{len(buf)/SR:.1f} s")
    print("wrote", cover(), f"{os.path.getsize(os.path.join(HERE,'freedom-llc-cover.png'))/1024:.0f} KB")
