#!/usr/bin/env python3
"""Build captioned Play Store screenshots from the raw app screenshots.

Testers Community's feedback report (Aug 2026) said the listing used plain
mobile screenshots that don't explain what each screen does, and asked for
captions on them. This puts a caption band above each screenshot and writes
the results to screenshots-captioned/.

Raw screenshots stay untouched in screenshots/ so this can be re-run.

    python3 make-captioned-screenshots.py
"""

import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "screenshots")
OUT = os.path.join(HERE, "screenshots-captioned")

W, H = 1080, 1920
BAND = 300                     # caption band height
SHOT_H = H - BAND              # screenshot fills the rest, flush to the bottom
SHOT_W = round(SHOT_H * W / H)
SHOT_X = (W - SHOT_W) // 2
RADIUS = 30

BG = (15, 12, 41)              # the app's own header navy
HEAD = (255, 255, 255)
SUB = (154, 160, 190)
ACCENT = (74, 222, 128)        # the day-counter green

BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

# Order here is the order they should be uploaded to Play Console.
PANELS = [
    ("01-home.png",     "Every sober day, counted",       "Days, hours and money back — on one screen"),
    ("06-sos.png",      "One tap when the craving hits",  "Breathe, talk it through, or reach 988 — instantly"),
    ("05-chat.png",     "An AI companion at 3am",         "Friendly listens. No judgment, any hour."),
    ("02-lessons.png",  "A new lesson every day",         "Read it, or listen hands-free"),
    ("03-journal.png",  "Write it down, keep it private", "A daily entry and a mood, in your account"),
    ("04-progress.png", "Progress that never resets",     "A setback doesn't erase what you've already done"),
]


def wrap(draw, text, font, max_w):
    words, lines, line = text.split(), [], ""
    for w in words:
        trial = (line + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_w:
            line = trial
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def rounded_top(img, radius):
    """Round the top two corners only; the bottom sits flush on the canvas."""
    mask = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1 + radius],
                        radius=radius, fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img.convert("RGBA"), (0, 0), mask)
    return out


def build(src_name, headline, subline, dest):
    canvas = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(canvas)

    f_head = ImageFont.truetype(BOLD, 62)
    f_sub = ImageFont.truetype(REG, 36)

    margin = 70
    max_w = W - margin * 2

    head_lines = wrap(draw, headline, f_head, max_w)
    sub_lines = wrap(draw, subline, f_sub, max_w)

    head_lh, sub_lh, gap = 76, 48, 18
    block_h = len(head_lines) * head_lh + gap + len(sub_lines) * sub_lh
    y = (BAND - block_h) // 2 - 8

    for line in head_lines:
        draw.text((W / 2, y), line, font=f_head, fill=HEAD, anchor="ma")
        y += head_lh
    y += gap
    for line in sub_lines:
        draw.text((W / 2, y), line, font=f_sub, fill=SUB, anchor="ma")
        y += sub_lh

    shot = Image.open(os.path.join(SRC, src_name)).convert("RGB")
    shot = shot.resize((SHOT_W, SHOT_H), Image.LANCZOS)
    shot = rounded_top(shot, RADIUS)
    canvas.paste(shot, (SHOT_X, BAND), shot)

    # thin accent rule sitting on the top edge of the screenshot
    draw.rounded_rectangle(
        [W / 2 - 46, BAND - 26, W / 2 + 46, BAND - 20], radius=3, fill=ACCENT)

    canvas.save(dest, "PNG", optimize=True)
    return dest


def main():
    os.makedirs(OUT, exist_ok=True)
    for i, (src, head, sub) in enumerate(PANELS, 1):
        dest = os.path.join(OUT, "%02d-%s" % (i, src.split("-", 1)[1]))
        build(src, head, sub, dest)
        print("%2d. %-22s %s" % (i, os.path.basename(dest), head))
    print("\nWrote %d files to %s" % (len(PANELS), OUT))


if __name__ == "__main__":
    main()
