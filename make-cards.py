#!/usr/bin/env python3
"""
make-cards.py — generate the 15 "Who catches you" cards as PNG with Pillow.

Usage:
    python3 make-cards.py

Output: cards-png/*.png (1080x1920)
Fonts:  tools/fonts/Lato-Regular.ttf, tools/fonts/Lato-Bold.ttf
"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
MAX_WIDTH = 900

# The app's own palette, straight out of index.html:31. The first version of
# these cards was navy and gold with a generic circle-dot mark - neither of which
# appears anywhere in the product, so the card and the app someone lands in
# looked like two different companies.
C0 = (15, 12, 41)      # 0f0c29  --brand, the app's own near-black
C1 = (26, 20, 60)
C2 = (42, 34, 92)
WHITE = (255, 255, 255)
GREEN = (126, 232, 162)  # 7ee8a2  --green, the accent used throughout the app
ACCENT = (83, 74, 183)   # 534AB7  --accent, the purple behind the app's mark
GREY = (120, 126, 160)

REGULAR = "tools/fonts/Lato-Regular.ttf"
BOLD = "tools/fonts/Lato-Bold.ttf"

TAGLINE = "Recovery app for you and the one that supports you"
FOOTER_1 = "LINK IN BIO"
FOOTER_2 = "TURN SOMEDAY INTO DAY ONE"

CARDS = [
    ("You were never weak.", "You were tired, alone, and unarmed."),
    ('"One more won\'t hurt."', "That exact sentence has hurt you for years."),
    ("Day four gets you nothing.", "That's why it counts the most."),
    ("You hide it so well", "you've started hiding it from yourself."),
    ('"I can stop whenever I want."', "So prove it \u2014 tonight, not someday."),
    ("Who catches you", "when you're the one who falls?"),
    ("You can't pull him up", "if he's pulling you under."),
    ("Everyone asks how he's doing.", "Nobody asks how you are."),
    ("You didn't cause it.", "You were never supposed to cure it."),
    ("You can tell from the doorway.", "That's not a skill anyone should need."),
    ("Two people in this house.", "Two recoveries. One app."),
    ("He's not the only one", "who needs a day one."),
    ("How do the two sides", "change the story?"),
    ("The habit isn't the problem \u2014", "it's the symptom. For both of you."),
    ("One of you is fighting it.", "The other is carrying it. Free for both."),
]


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def color_at(stops, t):
    for i in range(len(stops) - 1):
        t0, c0 = stops[i]
        t1, c1 = stops[i + 1]
        if t0 <= t <= t1:
            return lerp(c0, c1, (t - t0) / (t1 - t0))
    return stops[-1][1]


def background():
    stops = [(0.0, C0), (0.55, C1), (1.0, C2)]
    img = Image.new("RGB", (1, H))
    for y in range(H):
        img.putpixel((0, y), color_at(stops, y / (H - 1)))
    return img.resize((W, H))


def wrap(text, font, draw, max_width):
    words = text.split()
    lines = []
    cur = ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=font) <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit_font(text, font_path, draw, max_width, max_lines, start_size):
    size = start_size
    while size > 20:
        font = ImageFont.truetype(font_path, size)
        lines = wrap(text, font, draw, max_width)
        if len(lines) <= max_lines and all(
            draw.textlength(ln, font=font) <= max_width for ln in lines
        ):
            return font, lines
        size -= 2
    font = ImageFont.truetype(font_path, 20)
    return font, wrap(text, font, draw, max_width)


def line_height(font):
    bbox = font.getbbox("Ag")
    return bbox[3] - bbox[1]


def draw_centered(draw, lines, font, center_y, fill, gap=1.25):
    lh = line_height(font)
    total = lh * len(lines) + lh * (gap - 1) * (len(lines) - 1)
    y = center_y - total / 2
    for i, ln in enumerate(lines):
        w = draw.textlength(ln, font=font)
        x = (W - w) / 2
        draw.text((x, y + i * lh * gap), ln, font=font, fill=fill)


def draw_mark(img, cx, cy, size=112):
    """The app's mark: two interlocking rings on the purple accent square with the
    green border - the same square, radius and border as the onboarding logo.

    Two rings, not a dot. The whole product is one person and the person holding
    them up, and the mark should say that at 40px in a feed. A hand-drawn
    handshake was tried first and read as a squiggle at this size; two linked
    rings survive the shrink, which is the only test a social mark has to pass."""
    S = 4                                    # supersample, then downscale for clean edges
    pad = int(size * 0.5)
    box = size + pad * 2
    tile = Image.new("RGBA", (box * S, box * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    o = pad * S
    n = size * S
    d.rounded_rectangle([o, o, o + n, o + n], radius=int(n * 0.30),
                        fill=ACCENT, outline=GREEN, width=max(1, int(n * 0.045)))
    # Two rings, overlapping in the middle.
    lw = max(2, int(n * 0.070))
    r = n * 0.185
    gap = r * 0.78
    mid = o + n / 2
    for dx in (-gap, gap):
        d.ellipse([mid + dx - r, mid - r, mid + dx + r, mid + r],
                  outline=WHITE, width=lw)
    tile = tile.resize((box, box), Image.LANCZOS)
    img.paste(tile, (int(cx - box / 2), int(cy - box / 2)), tile)


def draw_card(draw, big, turn, img):
    draw_mark(img, W // 2, 168)

    # tagline
    tf = ImageFont.truetype(BOLD, 28)
    tw = draw.textlength(TAGLINE, font=tf)
    draw.text(((W - tw) / 2, 252), TAGLINE, font=tf, fill=WHITE)

    # big line (single line, auto-shrink)
    bf, blines = fit_font(big, BOLD, draw, MAX_WIDTH, 1, 72)
    draw_centered(draw, blines, bf, 690, WHITE)

    # turn line (up to 2 lines)
    yf, ylines = fit_font(turn, BOLD, draw, MAX_WIDTH, 2, 46)
    draw_centered(draw, ylines, yf, 900, GREEN)

    # footer
    ff = ImageFont.truetype(BOLD, 34)
    fw = draw.textlength(FOOTER_1, font=ff)
    draw.text(((W - fw) / 2, 1710), FOOTER_1, font=ff, fill=GREEN)

    sf = ImageFont.truetype(REGULAR, 24)
    sw = draw.textlength(FOOTER_2, font=sf)
    draw.text(((W - sw) / 2, 1766), FOOTER_2, font=sf, fill=GREY)


def main():
    os.makedirs("cards-png", exist_ok=True)
    for i, (big, turn) in enumerate(CARDS, start=1):
        img = background()
        draw_card(ImageDraw.Draw(img), big, turn, img)
        name = f"cards-png/{i:02d}-{slug(big)}.png"
        img.save(name)
        print("wrote", name)


def slug(s):
    keep = []
    for ch in s.lower():
        if ch.isalnum():
            keep.append(ch)
        elif ch in " -":
            keep.append("-")
    slugged = "".join(keep)
    slugged = "-".join([p for p in slugged.split("-") if p])
    return slugged[:32]


if __name__ == "__main__":
    main()
