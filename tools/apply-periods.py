#!/usr/bin/env python3
"""Apply period (week) and sign (month) rewrites into TurnSomeDayIntoOneday/key.html.

Usage:
    python3 tools/apply-periods.py TurnSomeDayIntoOneday/data/weeks-1.json [...]

Patch shape — any of the five top-level names, any subset of keys:

    {"LORE":      {"Capricorn I": {"k": "...", "g": "...", "s": "...", "p": "..."}},
     "PORTRAIT":  {"Capricorn I": "one paragraph of essay"},
     "DESTINY":   {"Capricorn I": {"from": "...", "toward": "...", "lesson": "...",
                                   "goal": "...", "pitfall": "...", "release": "...",
                                   "reward": "...", "step": "..."}},
     "WELLBEING": {"Capricorn I": {"h": "...", "m": "..."}},
     "SIGNREAD":  {"Aries": {"p": "...", "st": "...", "we": "...", "ad": "...",
                             "he": "...", "me": "..."}}}

Existing fields are replaced in place, so untouched fields (LORE path/pur) survive.
SIGNREAD is inserted as a new block if it is not there yet.
"""

import io
import json
import os
import re
import sys

HTML = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "TurnSomeDayIntoOneday", "key.html")
HTML = os.environ.get("PERIODS_HTML") or HTML
OBJ = {"LORE", "DESTINY", "WELLBEING"}
STRMAP = {"PORTRAIT"}
SIGNREAD_FIELDS = ("p", "st", "we", "ad", "he", "me")


def match_brace(s, i):
    """Index of the brace closing the one at s[i]."""
    assert s[i] == "{", s[i - 40:i + 10]
    depth = 0
    instr = False
    esc = False
    k = i
    while True:
        c = s[k]
        if instr:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                instr = False
        else:
            if c == '"':
                instr = True
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return k
        k += 1


def match_quote(s, i):
    """Index of the quote closing the string opening at s[i]."""
    assert s[i] == '"', s[i - 40:i + 10]
    k = i + 1
    while True:
        if s[k] == "\\":
            k += 2
            continue
        if s[k] == '"':
            return k
        k += 1


def object_span(s, name):
    head = "const %s = {" % name
    i = s.find(head)
    if i < 0:
        return None
    o = s.index("{", i)
    return o, match_brace(s, o)


def entry_span(s, lo, hi, key):
    p = s.find('"%s":' % key, lo, hi)
    if p < 0:
        return None
    return p + len(key) + 3, hi


def set_field(chunk, field, value):
    """Replace field:"..." inside one entry, or append it if absent."""
    lit = json.dumps(value, ensure_ascii=False)
    pat = re.compile(r'(?:^|(?<=[{,\s]))%s\s*:\s*"' % re.escape(field), re.M)
    m = pat.search(chunk)
    if m:
        q = chunk.index('"', m.start())
        end = match_quote(chunk, q)
        return chunk[:q] + lit + chunk[end + 1:]
    close = len(chunk) - 1 - len(chunk[::-1].lstrip()) - 1
    # find the entry's own closing brace
    b = chunk.index("{")
    close = match_brace(chunk, b)
    before = chunk[:close].rstrip()
    sep = "" if before.endswith("{") else ","
    return before + sep + "\n  %s:%s" % (field, lit) + "\n" + chunk[close:]


def build_signread(entries):
    rows = []
    for name in entries:
        e = entries[name]
        fields = ",\n  ".join("%s:%s" % (f, json.dumps(e[f], ensure_ascii=False))
                              for f in SIGNREAD_FIELDS if e.get(f))
        rows.append('"%s":{\n  %s}' % (name, fields))
    return ("/* ============================================================\n"
            "   SIGNREAD — the twelve months. Written from the sign pages of\n"
            "   The Secret Language of Birthdays: the personality of the sign\n"
            "   itself, before it is broken into its three weeks.\n"
            "   ============================================================ */\n"
            "const SIGNREAD = {\n" + ",\n".join(rows) + "\n};\n\n")


def main(paths):
    s = io.open(HTML, encoding="utf-8").read()
    counts = {}

    for path in paths:
        patch = json.load(io.open(path, encoding="utf-8"))
        print("%s: %d block(s)" % (path, len(patch)))

        for name, entries in patch.items():
            if name == "SIGNREAD":
                block = build_signread(entries)
                anchor = "const LORE = {"
                i = s.find("const SIGNREAD = {")
                if i < 0:
                    s = s.replace(anchor, block + anchor, 1)
                else:
                    e = match_brace(s, s.index("{", i))
                    s = s[:i] + block[len(block) - len(block.lstrip()):].replace(
                        "const SIGNREAD = {", "const SIGNREAD = {", 1).rstrip() + "\n" + s[e + 1:]
                counts["SIGNREAD"] = counts.get("SIGNREAD", 0) + len(entries)
                continue

            span = object_span(s, name)
            if span is None:
                raise SystemExit("no const %s in key.html" % name)
            lo, hi = span

            for key, value in entries.items():
                es = entry_span(s, lo, hi, key)
                if es is None:
                    raise SystemExit("%s: no entry %r" % (name, key))
                start, _ = es
                if name in STRMAP:
                    q = s.index('"', start)
                    end = match_quote(s, q)
                    s = s[:q] + json.dumps(value, ensure_ascii=False) + s[end + 1:]
                else:
                    b = s.index("{", start)
                    e = match_brace(s, b)
                    chunk = s[b:e + 1]
                    for field, text in value.items():
                        chunk = set_field(chunk, field, text)
                    s = s[:b] + chunk + s[e + 1:]
                lo, hi = object_span(s, name)
                counts[name] = counts.get(name, 0) + 1

    io.open(HTML, "w", encoding="utf-8").write(s)
    print("applied " + " | ".join("%s %d" % (k, counts[k]) for k in
                                  ("SIGNREAD", "PORTRAIT", "LORE", "DESTINY", "WELLBEING")
                                  if k in counts))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    main(sys.argv[1:])
