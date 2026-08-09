#!/usr/bin/env python3
"""Build the partner-angle text cards for TikTok, Reels and Shorts.

These copy the four cards already working on the account: dark ground, one
big line somebody recognises themselves in, one small quiet line under it,
LINK IN BIO at the foot. Nothing else — no stock photo, no face, no logo
crowding the top.

    python3 reference/make-partner-cards.py

Writes to reference/partner-cards/. Lines live in CARDS below; edit and re-run.
"""

import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "partner-cards")
ICON = os.path.join(HERE, "..", "TurnSomeDayIntoOneday", "icons", "icon-512.png")

W, H = 1080, 1920

BG_TOP = (26, 20, 62)          # indigo, lifting slightly toward the top
BG_BOT = (12, 10, 32)
INK = (255, 255, 255)
SUB = (168, 160, 208)          # the quiet second line
FOOT = (110, 104, 150)

BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

# (filename, the line, the quiet line under it)
# Every one of these is written to the person who loves someone using — the
# half of this audience nobody else writes for, and the half that is already
# performing best on the account.
CARDS = [
    ("01-not-the-only-one-tired.png",
     "You're not the only one who's tired.",
     "You're just the one nobody asks about."),
    ("02-holding-breath.png",
     "You've been holding your breath\nfor years.",
     "You might not remember what it felt like before."),
    ("03-not-a-relapse-detector.png",
     "You are not a relapse detector.",
     "You were never supposed to be."),
    ("04-checking-their-eyes.png",
     "You can read their face\nfrom across a room.",
     "Nobody taught you that. You learned it."),
    ("05-hope-costs.png",
     "Hoping again is the scariest\npart for you.",
     "Because you've paid for it before."),
    ("06-love-isnt-enough.png",
     "Loving them harder\nwas never going to fix it.",
     "That's not a failure. That's the illness."),
    ("07-your-own-day-one.png",
     "They get a Day One.",
     "So do you."),
    ("08-someone-asked-you.png",
     "When did somebody last ask\nhow YOU are?",
     "Take your time. That pause is the answer."),
    ("09-promise-vs-change.png",
     "A promise and a change\nsound the same at 2am.",
     "They don't look the same after a month."),
    ("10-not-your-fault.png",
     "You didn't cause it.",
     "You can't control it. You can't cure it."),
    ("11-allowed-to-be-angry.png",
     "You're allowed to be angry\nat someone you love.",
     "Both things are true at once."),
    ("12-what-you-carried.png",
     "Nobody counts the days\nyou survived.",
     "We do."),
]


def grad(w, h):
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / (h - 1)
        d.line([(0, y), (w, y)], fill=tuple(
            round(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3)))
    return im


def wrap(draw, text, font, max_w):
    """Respect explicit newlines, wrap anything still too wide."""
    out = []
    for para in text.split("\n"):
        line = ""
        for word in para.split():
            trial = (line + " " + word).strip()
            if draw.textlength(trial, font=font) <= max_w:
                line = trial
            else:
                if line:
                    out.append(line)
                line = word
        out.append(line)
    return out


def tracked(draw, text, font, tracking, cx, y, fill):
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + tracking


def build(name, line, sub):
    im = grad(W, H)
    d = ImageDraw.Draw(im)

    margin = 96
    max_w = W - margin * 2

    # Start big and step down until it fits in four lines. A card that reads in
    # one glance is the whole format; shrinking beats reflowing to five lines.
    for size in (82, 76, 70, 64, 58):
        f_big = ImageFont.truetype(BOLD, size)
        lines = wrap(d, line, f_big, max_w)
        if len(lines) <= 4:
            break
    f_sub = ImageFont.truetype(REG, 30)
    subs = wrap(d, sub, f_sub, max_w)

    lh = round(size * 1.24)
    sh = 44
    block = len(lines) * lh + 46 + len(subs) * sh
    y = (H - block) / 2 - 40

    for ln in lines:
        d.text((W / 2, y), ln, font=f_big, fill=INK, anchor="ma")
        y += lh
    y += 46
    for ln in subs:
        d.text((W / 2, y), ln, font=f_sub, fill=SUB, anchor="ma")
        y += sh

    # icon, small, at the top — presence not branding
    try:
        ic = Image.open(ICON).convert("RGBA").resize((84, 84), Image.LANCZOS)
        im.paste(ic, (int(W / 2 - 42), 150), ic)
    except Exception:
        pass

    f_foot = ImageFont.truetype(REG, 24)
    tracked(d, "LINK IN BIO", f_foot, 6, W / 2, H - 250, FOOT)
    f_brand = ImageFont.truetype(REG, 21)
    tracked(d, "TURN SOMEDAY INTO DAY ONE", f_brand, 5, W / 2, H - 200, FOOT)

    im.save(os.path.join(OUT, name), "PNG", optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, line, sub in CARDS:
        build(name, line, sub)
        print(" ", name, "—", line.replace("\n", " "))
    print("\nWrote %d cards to %s" % (len(CARDS), OUT))


if __name__ == "__main__":
    main()
