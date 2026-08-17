#!/usr/bin/env python3
"""Claymation-look end cards, drawn entirely with code — no AI, no cost.

Clay reads as clay because of four things, and all four are just maths:
  1. a MATTE surface: no specular hotspot, a broad soft highlight instead
  2. a soft ambient-occlusion shadow that hugs the object, not a drop shadow
  3. fingerprint-scale surface noise - clay is never perfectly smooth
  4. rounded everything; real clay has no sharp corner that survives handling

Text is PRESSED IN rather than printed on: a dark offset below-right and a
light offset above-left, which is what a thumb-pressed letter actually looks
like under a light from the top-left.
"""
import random, math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

CARDS = [
    ("Learn to love\nyourself again", "turnsomedayintodayone.com", (206, 122, 92)),
    ("Face yourself",               "turnsomedayintodayone.com", (122, 138, 120)),
    ("Keep going",                  "turnsomedayintodayone.com", (196, 150, 84)),
    ("Let me be honest",            "turnsomedayintodayone.com", (150, 122, 150)),
]

def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)

def grain(size, strength, seed):
    """Fingerprint-scale noise. Generated small and scaled up so the speckle is
    the size of a thumbprint ridge, not a pixel — pixel noise reads as JPEG
    damage, clay noise reads as a surface."""
    rnd = random.Random(seed)
    small = Image.new("L", (size[0] // 6, size[1] // 6))
    small.putdata([128 + rnd.randint(-strength, strength) for _ in range(small.width * small.height)])
    return small.resize(size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))

def clay_slab(size, colour, radius, seed):
    """One lump of clay: base colour, a light that falls from the top-left,
    a rounded edge that catches it, and surface noise over the whole thing."""
    w, h = size
    lump = Image.new("RGBA", size, (0, 0, 0, 0))
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)

    # Broad diagonal falloff — the whole form turning away from the light.
    body = Image.new("RGB", size)
    px = body.load()
    for y in range(h):
        for x in range(0, w, 4):
            t = (x / w) * 0.45 + (y / h) * 0.55
            f = 1.16 - t * 0.34
            c = shade(colour, f)
            for dx in range(4):
                if x + dx < w:
                    px[x + dx, y] = c

    # The rim: erode the mask and take the difference, so the light sits ON the
    # rounded edge where it actually would, instead of a flat inner glow.
    inner = mask.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(9))
    rim = Image.new("L", size, 0)
    rim.paste(Image.eval(inner, lambda v: 255 - v), (0, 0))
    body = Image.composite(Image.new("RGB", size, shade(colour, 1.30)), body,
                           Image.eval(rim, lambda v: int(v * 0.42)))

    g = grain(size, 12, seed)
    body = Image.composite(Image.new("RGB", size, shade(colour, 1.10)), body,
                           Image.eval(g, lambda v: max(0, v - 128) * 2))
    body = Image.composite(Image.new("RGB", size, shade(colour, 0.92)), body,
                           Image.eval(g, lambda v: max(0, 128 - v) * 2))
    lump.paste(body, (0, 0), mask)
    return lump, mask

def fit_font(text, max_w, start, floor=44):
    """Shrink until the longest line fits. A card whose words run off the slab
    is worse than a card with smaller words, and at 1080 wide there is no
    second chance to notice."""
    for size in range(start, floor - 1, -2):
        f = ImageFont.truetype(FONT, size)
        widest = max(f.getbbox(l)[2] - f.getbbox(l)[0] for l in text.split("\n"))
        if widest <= max_w:
            return f, size
    return ImageFont.truetype(FONT, floor), floor

def pressed_text(draw, xy, text, font, base, spacing):
    """A letter pushed into clay: the far wall of the dent catches the light,
    the near wall is in shadow. Deep offsets on purpose - a shallow emboss in
    the slab's own colour is unreadable at arm's length, which is the only
    distance that matters on a phone."""
    x, y = xy
    draw.multiline_text((x + 5, y + 6), text, font=font, fill=shade(base, 0.40),
                        anchor="ma", align="center", spacing=spacing)
    draw.multiline_text((x - 4, y - 5), text, font=font, fill=shade(base, 1.62),
                        anchor="ma", align="center", spacing=spacing)
    draw.multiline_text((x, y), text, font=font, fill=shade(base, 0.72),
                        anchor="ma", align="center", spacing=spacing)

def make(big, small, colour, path, seed):
    bg = shade(colour, 0.42)
    img = Image.new("RGB", (W, H), bg)

    # Backdrop is clay too — a flat colour behind a clay object gives the whole
    # thing away instantly.
    g = grain((W, H), 9, seed)
    img = Image.composite(Image.new("RGB", (W, H), shade(bg, 1.10)), img,
                          Image.eval(g, lambda v: max(0, v - 128) * 2))
    img = Image.composite(Image.new("RGB", (W, H), shade(bg, 0.90)), img,
                          Image.eval(g, lambda v: max(0, 128 - v) * 2))

    sw, sh = 860, 620
    sx, sy = (W - sw) // 2, (H - sh) // 2 - 40
    slab, mask = clay_slab((sw, sh), colour, 96, seed)

    # Contact shadow: tight and dark where the slab meets the ground, opening
    # out as it leaves. One blurred copy can't do that, so it's two.
    for blur, off, alpha in ((16, 10, 130), (48, 34, 90)):
        sh_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sh_img.paste((0, 0, 0, alpha), (sx, sy + off), mask)
        img = Image.alpha_composite(img.convert("RGBA"),
                                    sh_img.filter(ImageFilter.GaussianBlur(blur))).convert("RGB")

    img.paste(slab, (sx, sy), slab)

    d = ImageDraw.Draw(img)
    lines = big.count("\n") + 1
    f_big, size = fit_font(big, sw - 150, 112)
    block = lines * size + (lines - 1) * 18
    pressed_text(d, (W // 2, sy + (sh - block) // 2 - size * 0.16), big, f_big, colour, 18)

    f_small = ImageFont.truetype(FONT, 38)
    d.text((W // 2 + 2, sy + sh + 92 + 2), small, font=f_small,
           fill=shade(bg, 0.70), anchor="ma")
    d.text((W // 2, sy + sh + 92), small, font=f_small,
           fill=shade(colour, 1.25), anchor="ma")

    img.save(path, quality=95)
    return path

if __name__ == "__main__":
    import os, re
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "end-cards-clay")
    os.makedirs(out, exist_ok=True)
    for i, (big, small, colour) in enumerate(CARDS):
        name = re.sub(r"[^a-z]+", "-", big.lower().replace("\n", " ")).strip("-") + ".jpg"
        print(make(big, small, colour, os.path.join(out, name), 41 + i * 7))
