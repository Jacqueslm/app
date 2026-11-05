#!/usr/bin/env python3
"""Rebuild reading order from a column-set PDF.

The personology books are laid out in two or three columns per page and
their plain-text rips come out interleaved ("said to represent Rebirth.
Beginning the year with      QUALITIES      flict and flux."). This walks
the PDF's own text boxes, clusters lines into columns by x, and prints
each column top-to-bottom, left-to-right, so the prose reads as prose.

usage: python3 tools/pdf-columns.py book.pdf --from 56 --to 62 [--gap 40]
"""
import argparse
import sys

from pdfminer.high_level import extract_pages
from pdfminer.layout import LAParams, LTTextContainer, LTTextLine


def lines_of(page):
    out = []

    def walk(obj):
        if isinstance(obj, LTTextLine):
            out.append(obj)
            return
        for child in getattr(obj, "_objs", []) or []:
            walk(child)

    for obj in page:
        walk(obj)
    return [o for o in out if o.get_text().strip()]


def columns(lines, gap):
    """Cluster line left edges into columns and return them left to right."""
    if not lines:
        return []
    edges = sorted({round(l.x0, 1) for l in lines})
    groups = [[edges[0]]]
    for x in edges[1:]:
        if x - groups[-1][-1] > gap:
            groups.append([x])
        else:
            groups[-1].append(x)
    cols = []
    for g in groups:
        lo, hi = g[0], g[-1]
        members = [l for l in lines if lo - 1 <= l.x0 <= hi + 1]
        if members:
            cols.append(members)
    return cols


def tidy(text):
    text = text.replace("\u00ad", "")
    # rejoin words broken across a line by a hyphen
    text = text.replace("-\n", "")
    return " ".join(text.split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--from", dest="start", type=int, default=1)
    ap.add_argument("--to", dest="end", type=int, default=0)
    ap.add_argument("--gap", type=float, default=40.0)
    ap.add_argument("--out", default="")
    args = ap.parse_args()

    pages = range(args.start - 1, args.end) if args.end else None
    fh = open(args.out, "w", encoding="utf-8") if args.out else None
    total = 0
    try:
        for i, page in enumerate(extract_pages(args.pdf, laparams=LAParams(), page_numbers=pages)):
            num = (args.start or 1) + i
            lines = lines_of(page)
            cols = columns(lines, args.gap)
            body = []
            for c in cols:
                ordered = sorted(c, key=lambda l: (-l.y0, l.x0))
                body.append("\n".join(l.get_text() for l in ordered))
            chunk = f"\n<<< PAGE {num} | {len(lines)} lines | {len(cols)} cols >>>\n" + "\n\n".join(body)
            total += len(chunk)
            if fh:
                fh.write(chunk + "\n")
                fh.flush()
            else:
                sys.stdout.write(chunk)
    finally:
        if fh:
            fh.close()
            print(f"wrote {args.out} ({total} chars, {num} pages)")


if __name__ == "__main__":
    main()
