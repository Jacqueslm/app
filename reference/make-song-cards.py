#!/usr/bin/env python3
"""One card per song. Two frames, and the two frames say different things.

    python3 reference/make-song-cards.py

**This is where these differ from the partner cards.** Those draw the hook on
frame A and then the hook *plus* a quiet line on frame B, so the cut redraws
what the reader already read. Here each frame carries its own sentence at full
size and the second one is the turn. On a short that is a real cut — a thought
landing, not a line being added to a poster.

Same gradient, same icon, same FREE · NO CARD foot, so they still sit next to
the other 34 without announcing they came from somewhere else. Only the
two-frame logic is different, which is why build() is local rather than
imported.

**No lyrics are quoted.** Each card is written to the idea the song is named
for and aimed at any of the thirteen habits rather than one of them. A card
that only works for drinking is a card that doesn't work for whoever came in
for the phone or the food.
"""
import importlib.util
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))

# The partner-card module has a hyphen in its name so it can't be imported the
# ordinary way. Loading it by path reuses the palette, the gradient and the
# chrome exactly as they stand — only the frame logic below is new.
_spec = importlib.util.spec_from_file_location(
    "partner_cards", os.path.join(HERE, "make-partner-cards.py"))
pc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pc)

OUT = os.path.join(HERE, "song-cards")
W, H = pc.W, pc.H

# (slug, frame A, frame B) — two sentences, either of which stands on its own.
CARDS = [
    # Got To Make A Decision — the trap is thinking it's one decision.
    ("01-decision",
     "You don't make the decision once.",
     "You make it again every time it asks."),

    # Please Forgive Me — the apology everyone skips is the one to themselves,
    # which is the half of the Day One Plan nobody else builds.
    ("02-forgive",
     "You'll ask them to forgive you.",
     "Now do the harder one. Ask yourself."),

    # That's Just the Illness — the voice wears your voice.
    ("03-the-voice",
     "That voice sounds exactly like you.",
     "It isn't you. It's the illness talking."),

    # That's Just the Illness, second angle, so the two versions of the song
    # don't produce two of the same card.
    ("04-sounds-reasonable",
     "At 2am the story sounds reasonable.",
     "It always does. That's the whole trick."),

    # Throw It Up / Sobriety Badge — the counter, and the thing that makes
    # quitting lonely: nothing happens when you don't do it.
    ("05-nobody-claps",
     "Nobody claps when you don't do it.",
     "So the app counts it. Every single day."),

    # The celebration. Every other card names something hard; a set with no win
    # in it only ever takes. Deliberately doesn't say "sober" — that word makes
    # the card invisible to whoever came in for the phone, the food or the money.
    ("06-you-survived",
     "You survived something that kills people.",
     "Celebrate that. Nobody else is going to."),

    # Thinking it over. Card 01 says the decision comes back daily; this is the
    # minute before it, and the tell is that it stopped being a decision at all.
    ("07-negotiating",
     "You're not deciding. You're negotiating.",
     "Nobody argues about something they weren't going to do."),

    # After the celebration — the milestone trap, and the one moment in the set
    # nobody else warns about. The turn IS the second frame here.
    ("08-after-the-good-news",
     "Nobody relapses on their worst day.",
     "They relapse on their best one."),

    # Giving your strength away. The opposite of what this audience has been
    # told its whole life — not weak, just handed over, and it comes back the
    # same way it went. "One at a time" is also how the counter works.
    ("09-handed-it-over",
     "You didn't lose your strength.",
     "You handed it over, one yes at a time."),

    # Blaming yourself for somebody else's addiction. Straight at the partner,
    # and it names the behavior rather than the feeling — from the inside this
    # doesn't feel like blame, it feels like searching.
    ("10-nothing-you-did",
     "You keep looking for the thing you did wrong.",
     "There isn't one. Nobody ever tells you that."),
]


def frame(text, path):
    """One sentence, as big as it will go, centered, with the usual chrome."""
    d0 = ImageDraw.Draw(Image.new("RGB", (W, H)))
    margin = 96
    max_w = W - margin * 2
    # Start big and step down until it fits in three lines. These carry one
    # sentence rather than a sentence plus a footnote, so they can run larger
    # than the partner cards do — a card is read at arm's length while scrolling.
    for size in (96, 88, 82, 76, 70, 64):
        f = ImageFont.truetype(pc.BOLD, size)
        lines = pc.wrap(d0, text, f, max_w)
        if len(lines) <= 3:
            break
    lh = round(size * 1.24)
    im = pc.grad(W, H)
    d = ImageDraw.Draw(im)
    y = (H - len(lines) * lh) / 2 - 40
    for ln in lines:
        d.text((W / 2, y), ln, font=f, fill=pc.INK, anchor="ma")
        y += lh
    pc.chrome(im, d)
    im.save(path, "PNG", optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    pc.OUT = OUT
    for f in os.listdir(OUT):
        if f.endswith(".png"):
            os.remove(os.path.join(OUT, f))
    for slug, a, b in CARDS:
        frame(a, os.path.join(OUT, "%s-a.png" % slug))
        frame(b, os.path.join(OUT, "%s-b.png" % slug))
        print(" ", slug)
        print("      a:", a)
        print("      b:", b)
    print("\nWrote %d frames to %s" % (len(CARDS) * 2, OUT))


if __name__ == "__main__":
    main()
