#!/usr/bin/env python3
"""Build the 3-second end cards as 1080x1920 PNGs.

Studio's CTA card draws text over a plain background at render time. These are
picture versions of the same thing, for when you want the card as an image you
can drop on a timeline, hand to Manus, or post on its own.

Colours are the app's, not invented: the header navy and the day-counter green,
the same pair the store screenshots use. Keeping one palette across the app,
the listing and the videos is most of what makes a one-person operation look
like it was art-directed.

Run:  python3 Studio/tools-make-end-cards.py
Out:  Studio/end-cards/*.png
"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
BG = (15, 12, 41)          # the app's header navy
HEAD = (255, 255, 255)
SUB = (168, 178, 209)
ACCENT = (74, 222, 128)    # the day-counter green

BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "end-cards")

# (filename, big line, small line)
CARDS = [
    ("let-me-be-honest", "Let me be honest", "38 years. Free at 50.\nturnsomedayintodayone.com"),
    ("learn-to-love-yourself", "Learn to love yourself again", "Free. No card.\nturnsomedayintodayone.com"),
    ("face-yourself", "Face yourself", "The 2-minute check-in. Free.\nturnsomedayintodayone.com/quiz"),
    ("keep-going", "Keep going", "turnsomedayintodayone.com"),
]


def wrap(draw, text, font, max_w):
    """Break a line to fit, word by word. Explicit newlines are kept."""
    out = []
    for para in text.split("\n"):
        line = ""
        for word in para.split():
            trial = f"{line} {word}".strip()
            if draw.textlength(trial, font=font) <= max_w or not line:
                line = trial
            else:
                out.append(line)
                line = word
        out.append(line)
    return out


def build(name, big, small):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # A big line has to shrink to fit rather than wrap to three cramped lines,
    # so the size is chosen from the text instead of fixed.
    size = 108
    while size > 48:
        f_big = ImageFont.truetype(BOLD, size)
        if len(wrap(d, big, f_big, W - 160)) <= 2:
            break
        size -= 6
    f_big = ImageFont.truetype(BOLD, size)
    # 34, not 40, and measured against a much narrower column. At 40pt across
    # the full width the sub-line ran almost edge to edge, which reads as
    # cramped on a phone and is unreadable in the 3 seconds it is on screen.
    f_small = ImageFont.truetype(REG, 34)

    big_lines = wrap(d, big, f_big, W - 160)
    small_lines = wrap(d, small, f_small, W - 380)

    big_h = len(big_lines) * (size + 18)
    small_h = len(small_lines) * 50
    # Sit the block slightly above centre — text centred in a 9:16 frame reads
    # low, because the eye finds the middle higher than the maths does.
    y = (H - big_h - small_h - 90) / 2 - 60

    for line in big_lines:
        d.text((W / 2, y), line, font=f_big, fill=HEAD, anchor="ma")
        y += size + 18

    y += 34
    d.line([(W / 2 - 60, y), (W / 2 + 60, y)], fill=ACCENT, width=5)
    y += 46

    for line in small_lines:
        d.text((W / 2, y), line, font=f_small, fill=SUB, anchor="ma")
        y += 50

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}.png")
    img.save(path)
    return path


if __name__ == "__main__":
    for card in CARDS:
        print(build(*card))
