#!/usr/bin/env python3
"""Build the 'to be continued' end cards for the Elias episodes.

Plain type on near-black, 1080x1920, no logo and no web address. The films work
because they don't sell anything; the card shouldn't be where that breaks.

    python3 reference/make-end-cards.py

Writes to reference/end-cards/.
"""

import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "end-cards")

W, H = 1080, 1920
SCALES = [1, 2]        # 1080x1920 and 2160x3840 — match whatever the episode was rendered at
INK = (232, 228, 220)          # warm off-white, not pure white
DIM = (128, 122, 112)
BG = (10, 10, 10)              # near-black, never #000

REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

CARDS = [
    ("01-to-be-continued.png",      "TO BE CONTINUED", None),
    ("02-ep1-next.png",             "TO BE CONTINUED", "EPISODE TWO  ·  THE AFTERNOON"),
    ("03-ep2-next.png",             "TO BE CONTINUED", "EPISODE THREE"),
]


def tracked(draw, text, font, tracking, cx, y, fill):
    """Draw letterspaced text centered on cx. PIL has no tracking, so step it."""
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + tracking
    return total


def build(name, line1, line2, k=1):
    im = Image.new("RGB", (W * k, H * k), BG)
    d = ImageDraw.Draw(im)

    f1 = ImageFont.truetype(REG, 46 * k)
    f2 = ImageFont.truetype(REG, 28 * k)

    # Sits just above center. Dead center reads as a title card; a little high
    # reads as an ending.
    y = H * k * 0.46
    tracked(d, line1, f1, 14 * k, W * k / 2, y, INK)

    if line2:
        tracked(d, line2, f2, 8 * k, W * k / 2, y + 104 * k, DIM)

    im.save(os.path.join(OUT, name), "PNG", optimize=True)
    return name


def main():
    os.makedirs(OUT, exist_ok=True)
    n = 0
    for name, l1, l2 in CARDS:
        for k in SCALES:
            out = name if k == 1 else name.replace(".png", "-2x.png")
            build(out, l1, l2, k)
            print(" ", out, "—", l1, ("/ " + l2) if l2 else "")
            n += 1
    print("\nWrote %d cards to %s" % (n, OUT))


if __name__ == "__main__":
    main()
