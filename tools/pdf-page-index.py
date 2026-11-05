#!/usr/bin/env python3
"""Index every page of a scan so we can tell what it does and does not contain.

usage: python3 tools/pdf-page-index.py book.pdf out.tsv
Prints page number, character count and a one-line sample for each page.
"""
import sys

from pypdf import PdfReader


def main():
    pdf, out = sys.argv[1], sys.argv[2]
    reader = PdfReader(pdf)
    rows = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception as exc:  # a broken page must not stop the index
            text = f"__ERROR__ {exc}"
        flat = " ".join(text.split())
        rows.append(f"{i}\t{len(flat)}\t{flat[:110]}")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(rows) + "\n")
    blank = sum(1 for r in rows if r.split("\t")[1] == "0")
    print(f"{pdf}: {len(rows)} pages indexed, {blank} with no text -> {out}")


if __name__ == "__main__":
    main()
