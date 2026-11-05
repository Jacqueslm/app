#!/usr/bin/env python3
"""Apply day rewrites staged as JSON into key.html.

usage: python3 tools/apply-days.py patch1.json [patch2.json ...]
Each patch is {"M-D": {field: value, ...}} and only the given fields are
replaced; everything else in the file is left byte-for-byte alone.
"""
import io
import json
import re
import sys

PATH = "TurnSomeDayIntoOneday/key.html"


def entry_span(text, key):
    m = re.search(r'"%s":\s*\{' % re.escape(key), text)
    assert m, "entry not found: " + key
    j = m.end() - 1
    depth, instr, esc = 0, False, False
    while j < len(text):
        c = text[j]
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
                    return m.start(), j + 1
        j += 1
    raise AssertionError("unbalanced " + key)


def days_object(text):
    i = text.index("const DAYS = {") + len("const DAYS = ")
    j, depth, instr, esc = i, 0, False, False
    while True:
        c = text[j]
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
                    break
        j += 1
    return json.loads(text[i:j + 1])


def main():
    s = io.open(PATH, encoding="utf-8").read()
    applied = 0
    for path in sys.argv[1:]:
        patch = json.load(io.open(path, encoding="utf-8"))
        for key, fields in patch.items():
            a, b = entry_span(s, key)
            old = json.loads(s[a + len('"%s":' % key):b])
            old.update(fields)
            s = s[:a] + '"%s":' % key + json.dumps(old, ensure_ascii=False) + s[b:]
            applied += 1
        print(f"{path}: {len(patch)} entries")
    io.open(PATH, "w", encoding="utf-8").write(s)
    days = days_object(s)
    done = [k for k, v in days.items() if v.get("he") and v.get("me")]
    print(f"applied {applied} | total days {len(days)} | written from the books {len(done)}")


if __name__ == "__main__":
    main()
