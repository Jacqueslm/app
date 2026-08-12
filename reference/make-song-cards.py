#!/usr/bin/env python3
"""One card per song, built the same way the partner cards are built.

    python3 reference/make-song-cards.py

Same look, same two-frame structure, same FREE · NO CARD foot line — these sit
next to the other 34 without announcing that they came from somewhere else. The
build functions are imported rather than copied, so a change to the card design
lands on both sets at once and they can never drift apart.

**No lyrics are quoted.** Each card is written to the idea the song is named
for, aimed at the app and at any of the thirteen habits rather than one of them.
A card that only works for drinking is a card that doesn't work for the person
who came in for the phone or the food.

The two "That's Just the Illness" files are the same song twice. They get two
different cards on purpose — same idea, two angles — so nothing in the set is a
repeat of anything else in it.
"""
import importlib.util
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# The partner-card module has a hyphen in its name, so it can't be imported the
# ordinary way. Loading it by path reuses build() exactly as it stands.
_spec = importlib.util.spec_from_file_location(
    "partner_cards", os.path.join(HERE, "make-partner-cards.py"))
pc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pc)

OUT = os.path.join(HERE, "song-cards")

# (slug, the line, the quiet line under it)
CARDS = [
    # Got To Make A Decision — the trap is thinking it's one decision.
    ("01-decision",
     "You don't make the decision once.",
     "You make it again every time it asks."),

    # Please Forgive Me — the apology everyone skips is the one to themselves,
    # and that is the half of the Day One Plan nobody else builds.
    ("02-forgive",
     "You'll ask them to forgive you\nlong before you ask yourself.",
     "One of those is the one that keeps you here."),

    # That's Just the Illness — the voice wears your voice.
    ("03-the-voice",
     "That voice sounds exactly like you.",
     "It isn't. That's just the illness talking."),

    # That's Just the Illness, second angle — same idea, different door, so the
    # two versions of the song don't produce two of the same card.
    ("04-sounds-reasonable",
     "At 2am the story sounds reasonable.",
     "It always does. That's the whole trick."),

    # Throw It Up / Sobriety Badge — straight at the counter, and at the thing
    # that makes quitting so lonely: nothing happens when you don't do it.
    ("05-nobody-claps",
     "Nobody claps when you don't do it.",
     "So the app counts it. Every single day."),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    pc.OUT = OUT  # build() writes wherever this points
    for f in os.listdir(OUT):
        if f.endswith(".png"):
            os.remove(os.path.join(OUT, f))
    for slug, line, sub in CARDS:
        pc.build(slug, line, sub)
        print(" ", slug, "-a / -b  —", line.replace("\n", " "))
    print("\nWrote %d frames to %s" % (len(CARDS) * 2, OUT))


if __name__ == "__main__":
    main()
