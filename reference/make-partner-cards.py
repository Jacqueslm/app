#!/usr/bin/env python3
"""Build the partner-angle cards, as 7-15 second shorts.

Each card is now **two frames, not one**:

    ...-a.png   the big line on its own
    ...-b.png   the big line with the quiet line under it

Hold A for about 4 seconds, cut to B for about 6, then the shared end frame
for 3. That is a 13-second short with a beat in the middle, instead of one
still image sitting there for 13 seconds hoping somebody reads it slowly.
The pause before the second line is the whole trick — it is why these read as
a thought landing rather than a poster.

Also writes:

    99-free-end.png       the closing frame every short ends on
    99-free-end-2x.png

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
FREE = (150, 214, 176)         # the one green thing on screen — the word "free"

BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

# (slug, the line, the quiet line under it)
# 1-12 are written to the person who loves someone using — the half of this
# audience nobody else writes for. 13-16 say the app is free out loud, because
# "free" is the thing that gets a stranger to tap and nothing on the old cards
# ever said it.
CARDS = [
    ("01-not-the-only-one-tired",
     "You're not the only one who's tired.",
     "You're just the one nobody asks about."),
    ("02-holding-breath",
     "You've been holding your breath\nfor years.",
     "You might not remember what it felt like before."),
    ("03-not-a-relapse-detector",
     "You are not a relapse detector.",
     "You were never supposed to be."),
    ("04-checking-their-eyes",
     "You can read their face\nfrom across a room.",
     "Nobody taught you that. You learned it."),
    ("05-hope-costs",
     "Hoping again is the scariest\npart for you.",
     "Because you've paid for it before."),
    ("06-love-isnt-enough",
     "Loving them harder\nwas never going to fix it.",
     "That's not a failure. That's the illness."),
    ("07-your-own-day-one",
     "They get a Day One.",
     "So do you."),
    ("08-someone-asked-you",
     "When did somebody last ask\nhow YOU are?",
     "Take your time. That pause is the answer."),
    ("09-promise-vs-change",
     "A promise and a change\nsound the same at 2am.",
     "They don't look the same after a month."),
    ("10-not-your-fault",
     "You didn't cause it.",
     "You can't control it. You can't cure it."),
    ("11-allowed-to-be-angry",
     "You're allowed to be angry\nat someone you love.",
     "Both things are true at once."),
    ("12-what-you-carried",
     "Nobody counts the days\nyou survived.",
     "We do."),

    # --- the free ones -------------------------------------------------
    ("13-free-at-3am",
     "There's nobody to call\nat 3am.",
     "There is now. It's free."),
    ("14-no-card",
     "No card. No trial.\nNo 'first week free'.",
     "The part that keeps you alive doesn't cost anything."),
    ("15-built-by-someone-who",
     "Built by someone who was\naddicted for 38 years.",
     "Free, because that's what I needed and couldn't afford."),
    ("16-what-costs-nothing",
     "The counter, the panic button,\nthe lessons, the journal.",
     "All free. Pay only if you want more."),
]

# The frame every short ends on.
END_HEAD = "FREE TO USE"
END_SUB = "No card. No trial. Upgrade only if you want more."
END_FOOT = "TURN SOMEDAY INTO DAY ONE"


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


def chrome(im, d):
    """Icon at the top, two footer lines at the bottom. Same on every frame so
    a cut between A and B moves only the words."""
    try:
        ic = Image.open(ICON).convert("RGBA").resize((84, 84), Image.LANCZOS)
        im.paste(ic, (int(W / 2 - 42), 150), ic)
    except Exception:
        pass

    # "No card" beats "link in bio": a card cannot be tapped, the link lives in
    # the bio regardless, and not needing a credit card is the actual reason
    # somebody chooses this over an app charging $9.99 a month.
    f_foot = ImageFont.truetype(BOLD, 24)
    tracked(d, "FREE  ·  NO CARD", f_foot, 6, W / 2, H - 250, FREE)
    f_brand = ImageFont.truetype(REG, 21)
    tracked(d, "TURN SOMEDAY INTO DAY ONE", f_brand, 5, W / 2, H - 200, FOOT)


def build(slug, line, sub):
    """Two frames. The big line sits in exactly the same place on both, so the
    cut adds a line instead of jumping the layout."""
    d0 = ImageDraw.Draw(Image.new("RGB", (W, H)))
    margin = 96
    max_w = W - margin * 2

    # Start big and step down until it fits in four lines. A card that reads in
    # one glance is the whole format; shrinking beats reflowing to five lines.
    for size in (82, 76, 70, 64, 58):
        f_big = ImageFont.truetype(BOLD, size)
        lines = wrap(d0, line, f_big, max_w)
        if len(lines) <= 4:
            break
    f_sub = ImageFont.truetype(REG, 30)
    subs = wrap(d0, sub, f_sub, max_w)

    lh = round(size * 1.24)
    sh = 44
    # Both frames are laid out as if the quiet line is already there, then
    # frame A just doesn't draw it. That keeps the big line from sliding.
    block = len(lines) * lh + 46 + len(subs) * sh
    top = (H - block) / 2 - 40

    for with_sub in (False, True):
        im = grad(W, H)
        d = ImageDraw.Draw(im)
        y = top
        for ln in lines:
            d.text((W / 2, y), ln, font=f_big, fill=INK, anchor="ma")
            y += lh
        if with_sub:
            y += 46
            for ln in subs:
                d.text((W / 2, y), ln, font=f_sub, fill=SUB, anchor="ma")
                y += sh
        chrome(im, d)
        name = "%s-%s.png" % (slug, "b" if with_sub else "a")
        im.save(os.path.join(OUT, name), "PNG", optimize=True)


def build_end(k=1):
    im = grad(W * k, H * k)
    d = ImageDraw.Draw(im)

    f1 = ImageFont.truetype(BOLD, 64 * k)
    f2 = ImageFont.truetype(REG, 30 * k)
    f3 = ImageFont.truetype(REG, 22 * k)

    y = H * k * 0.42
    tracked(d, END_HEAD, f1, 10 * k, W * k / 2, y, FREE)
    for ln in wrap(d, END_SUB, f2, W * k - 180 * k):
        d.text((W * k / 2, y + 130 * k), ln, font=f2, fill=SUB, anchor="ma")
        y += 44 * k
    tracked(d, END_FOOT, f3, 5 * k, W * k / 2, H * k - 260 * k, FOOT)

    try:
        s = 96 * k
        ic = Image.open(ICON).convert("RGBA").resize((s, s), Image.LANCZOS)
        im.paste(ic, (int(W * k / 2 - s / 2), int(H * k * 0.27)), ic)
    except Exception:
        pass

    name = "99-free-end.png" if k == 1 else "99-free-end-2x.png"
    im.save(os.path.join(OUT, name), "PNG", optimize=True)
    return name


def main():
    os.makedirs(OUT, exist_ok=True)
    # The old single-frame files would sit alongside the new -a/-b pair and
    # you'd never know which was current. Clear them.
    for f in os.listdir(OUT):
        if f.endswith(".png") and not f[:-4].endswith(("-a", "-b", "end", "end-2x")):
            os.remove(os.path.join(OUT, f))

    for slug, line, sub in CARDS:
        build(slug, line, sub)
        print(" ", slug, "-a / -b  —", line.replace("\n", " "))
    for k in (1, 2):
        print(" ", build_end(k))
    print("\nWrote %d frames to %s" % (len(CARDS) * 2 + 2, OUT))


if __name__ == "__main__":
    main()
