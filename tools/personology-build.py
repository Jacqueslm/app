#!/usr/bin/env python3
"""Build one record per calendar day from the column-rebuilt Birthdays text.

Segmentation is anchored on the words BORN ON THIS DAY, which open the
sidebar of every day spread. The sidebar's MONTH/DAY box gives the date
where the OCR kept it; spreads whose box was lost are placed by counting
on from the nearest anchored neighbour.

usage: python3 tools/personology-build.py /tmp/bday.txt out.json
"""
import datetime
import json
import re
import sys

MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY",
          "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"]
NUM = {m: i + 1 for i, m in enumerate(MONTHS)}
ORDINAL = {1: "First", 2: "Second", 3: "Third", 4: "Fourth", 5: "Fifth",
           6: "Sixth", 7: "Seventh", 8: "Eighth", 9: "Ninth", 10: "Tenth",
           11: "Eleventh", 12: "Twelfth", 13: "Thirteenth", 14: "Fourteenth",
           15: "Fifteenth", 16: "Sixteenth", 17: "Seventeenth",
           18: "Eighteenth", 19: "Nineteenth", 20: "Twentieth",
           21: "Twenty-First", 22: "Twenty-Second", 23: "Twenty-Third",
           24: "Twenty-Fourth", 25: "Twenty-Fifth", 26: "Twenty-Sixth",
           27: "Twenty-Seventh", 28: "Twenty-Eighth", 29: "Twenty-Ninth",
           30: "Thirtieth", 31: "Thirty-First"}


def sp(word):
    return r"\s*".join(word)


MONTH_RE = "|".join(sp(m) for m in MONTHS)


def unsquash(text):
    out = []
    for line in text.split("\n"):
        prev = None
        while prev != line:
            prev = line
            line = re.sub(r"\b([A-Z])\s([A-Z])\s([A-Z])\s([A-Z])\b", r"\1\2\3\4", line)
            line = re.sub(r"(?<=\b[A-Z])\s(?=[A-Z]\b)", "", line)
        out.append(line)
    return "\n".join(out)


def flat(text):
    text = text.replace("\u00ad", "").replace("\u2019", "'")
    text = re.sub(r"\n<<< PAGE \d+[^\n]*>>>\n", "\n", text)
    text = unsquash(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text


def para(text, limit=4200):
    text = re.sub(r"-\n", "", text)
    text = re.sub(r"\s+", " ", text)
    text = text.replace(" ,", ",").replace(" .", ".")
    return text.strip()[:limit]


def cut(body, label):
    """Everything between one printed heading and the next one."""
    marks = []
    for name, pat in (
        ("numbers", r"NUMBERS\s*(?:AND|ANI\)?|ANL\)?)\s*PLANET"),
        ("tarot", r"\bTAROT\b"),
        ("health", r"\bHEALTH\b"),
        ("advice", r"\bADVICE\b"),
        ("meditation", r"\bMEDITATION\b"),
        ("strengths", r"\bSTRENGTHS\b"),
        ("weaknesses", r"\bWEAKNESSES\b"),
    ):
        for m in re.finditer(pat, body):
            marks.append((m.start(), m.end(), name))
    marks.sort()
    out = {}
    for i, (start, end, name) in enumerate(marks):
        stop = marks[i + 1][0] if i + 1 < len(marks) else len(body)
        chunk = body[end:stop].strip()
        if chunk and name not in out:
            out[name] = chunk
    return out


def wordlist(text, top=6):
    skip = {"STRENGTH", "STRENGTHS", "WEAKNESS", "WEAKNESSES", "HEALTH", "ADVICE",
            "MEDITATION", "TAROT", "NUMBERS", "PLANETS", "BORN", "THIS", "DAY",
            "AND", "THE", "THAT", "WITH", "THEIR", "WEEK"}
    out = []
    for w in re.findall(r"\b[A-Z][A-Z'\-]{3,}\b", text):
        w = w.strip("'-")
        if w in skip or len(w) < 4 or w in out:
            continue
        out.append(w.title())
        if len(out) >= top:
            break
    return out


def main():
    src, out = sys.argv[1], sys.argv[2]
    text = flat(open(src, encoding="utf-8", errors="replace").read())
    anchors = [m.start() for m in re.finditer(sp("BORN ON THIS DAY"), text)]
    box = re.compile(sp("MONTH") + r"\s*[:\-.,]?\s*(" + MONTH_RE + r")\s*"
                     + sp("DAY") + r"\s*[:\-.,]?\s*(\d{1,2})\b")
    stamps = []
    for pos in anchors:
        head = text[max(0, pos - 900):pos]
        found = list(box.finditer(head))
        if found:
            m = found[-1]
            stamps.append((NUM[re.sub(r"\s+", "", m.group(1))], int(m.group(2))))
        else:
            stamps.append(None)
    # place the spreads whose date box the OCR lost
    dates = list(stamps)
    for i, s in enumerate(dates):
        if s is not None:
            continue
        nxt = next((dates[j] for j in range(i + 1, len(dates)) if dates[j]), None)
        prv = next((dates[j] for j in range(i - 1, -1, -1) if dates[j]), None)
        if nxt:
            back = sum(1 for j in range(i + 1, len(dates)) if dates[j] is None and j < len(dates)) 
            step = 0
            for j in range(i + 1, len(dates)):
                if dates[j] is not None:
                    break
                step += 1
            try:
                d = datetime.date(2024, nxt[0], nxt[1]) - datetime.timedelta(days=step + 1)
                dates[i] = (d.month, d.day)
            except ValueError:
                dates[i] = prv
        elif prv:
            d = datetime.date(2024, prv[0], prv[1]) + datetime.timedelta(days=1)
            dates[i] = (d.month, d.day)
    days = {}
    for i, pos in enumerate(anchors):
        stop = anchors[i + 1] if i + 1 < len(anchors) else len(text)
        body = text[pos - 900:stop]
        stamp = dates[i]
        if not stamp:
            continue
        key = f"{stamp[0]}-{stamp[1]}"
        if key in days:
            continue
        sign = re.search(r"SIGN[:\s]*([0-9]{1,2}\s*[-\u2013]\s*[0-9]{1,2}\s*[°o]?\s*[A-Z]{3,9})", body)
        period = re.search(r"PERIOD[:\s]*([A-Z]{3,9})\s*(I{1,3})\b", body)
        eq = re.search(r"\b(CARDINAL|FIXED|MUTABLE)\s+(FIRE|EARTH|AIR|WATER)\b", body)
        parts = cut(body[pos - pos:])
        rec = {
            "month": stamp[0],
            "day": stamp[1],
            "title": f"{MONTHS[stamp[0] - 1].title()} {ORDINAL.get(stamp[1], stamp[1])}",
            "sign": para(sign.group(1), 40) if sign else "",
            "period": para(period.group(1) + " " + period.group(2), 20) if period else "",
            "element": (eq.group(1).title() + " " + eq.group(2).title()) if eq else "",
        }
        if parts:
            for name in ("numbers", "tarot", "health", "advice", "meditation"):
                if parts.get(name):
                    rec[name] = para(parts[name])
            if parts.get("strengths"):
                rec["strengths"] = wordlist(parts["strengths"])
            if parts.get("weaknesses"):
                rec["weaknesses"] = wordlist(parts["weaknesses"])
        days[key] = rec
    json.dump(days, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    have_period = sum(1 for d in days.values() if d.get("period"))
    have_advice = sum(1 for d in days.values() if d.get("advice"))
    print(f"{len(days)} days | {have_period} with period | {have_advice} with advice -> {out}")


if __name__ == "__main__":
    main()
