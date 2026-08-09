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
    """Draw letterspaced text centred on cx. PIL has no tracking, so step it."""
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + tracking
    return total


def build(name, line1, line2):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)

    f1 = ImageFont.truetype(REG, 46)
    f2 = ImageFont.truetype(REG, 28)

    # Sits just above centre. Dead centre reads as a title card; a little high
    # reads as an ending.
    y = H * 0.46
    tracked(d, line1, f1, 14, W / 2, y, INK)

    if line2:
        tracked(d, line2, f2, 8, W / 2, y + 104, DIM)

    im.save(os.path.join(OUT, name), "PNG", optimize=True)
    return name


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, l1, l2 in CARDS:
        build(name, l1, l2)
        print(" ", name, "—", l1, ("/ " + l2) if l2 else "")
    print("\nWrote %d cards to %s" % (len(CARDS), OUT))


if __name__ == "__main__":
    main()
