#!/usr/bin/env python3
"""
tools-md-to-pdf.py — Markdown -> PDF (reportlab, no external deps).

Usage:
    python3 tools-md-to-pdf.py file1.md [file2.md ...] [--out DIR]

Each input file is written to `<DIR>/<basename>.pdf` (default DIR = "pdf").
"""
import sys
import os
import re
import html

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Preformatted,
    Table, TableStyle, HRFlowable,
)


def inline(text):
    """Convert basic inline markdown to reportlab paragraph markup."""
    text = html.escape(text, quote=False)
    text = re.sub(r"`([^`]+)`", r'<font face="Courier">\1</font>', text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<i>\1</i>", text)
    return text


def build_styles():
    s = {}
    s["h1"] = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=20,
                             leading=24, spaceAfter=12, textColor=colors.HexColor("#0d1c3a"))
    s["h2"] = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=15,
                             leading=19, spaceBefore=12, spaceAfter=6,
                             textColor=colors.HexColor("#0d1c3a"))
    s["h3"] = ParagraphStyle("h3", fontName="Helvetica-Bold", fontSize=12.5,
                             leading=16, spaceBefore=10, spaceAfter=4,
                             textColor=colors.HexColor("#13294b"))
    s["h4"] = ParagraphStyle("h4", fontName="Helvetica-Bold", fontSize=11,
                             leading=14, spaceBefore=8, spaceAfter=3,
                             textColor=colors.HexColor("#13294b"))
    s["body"] = ParagraphStyle("body", fontName="Helvetica", fontSize=10,
                               leading=14, spaceAfter=6)
    s["code"] = ParagraphStyle("code", fontName="Courier", fontSize=8.5,
                               leading=11, leftIndent=10, backColor=colors.HexColor("#f2f4f8"),
                               borderPadding=6, spaceAfter=8)
    s["quote"] = ParagraphStyle("quote", fontName="Helvetica-Oblique", fontSize=10,
                                leading=14, leftIndent=16, textColor=colors.HexColor("#44506b"),
                                spaceAfter=8)
    s["list"] = ParagraphStyle("list", fontName="Helvetica", fontSize=10,
                               leading=14, leftIndent=16, firstLineIndent=-12,
                               spaceAfter=3)
    s["cell"] = ParagraphStyle("cell", fontName="Helvetica", fontSize=8.5, leading=11)
    return s


def render_table(lines, styles):
    rows = []
    for ln in lines:
        cells = [c.strip() for c in ln.strip().strip("|").split("|")]
        rows.append(cells)
    data = []
    for r in rows:
        if all(re.match(r"^:?-{2,}:?$", c) for c in r if c != ""):
            continue
        data.append([Paragraph(inline(c), styles["cell"]) for c in r])
    if not data:
        return Spacer(1, 1)
    t = Table(data, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c7cedb")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8edf5")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def render(text):
    styles = build_styles()
    lines = text.split("\n")
    story = []
    para = []
    in_code = False
    code_buf = []

    def flush_para():
        nonlocal para
        if para:
            story.append(Paragraph(inline(" ".join(para)), styles["body"]))
            para = []

    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("```"):
            if in_code:
                story.append(Preformatted("\n".join(code_buf), styles["code"]))
                code_buf = []
                in_code = False
            else:
                flush_para()
                in_code = True
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        s = line.strip()
        if not s:
            flush_para()
            i += 1
            continue

        if s == "---" or s == "***" or set(s) <= {"-"} or set(s) <= {"*"}:
            flush_para()
            story.append(HRFlowable(width="100%", thickness=0.6,
                                    color=colors.HexColor("#c7cedb"),
                                    spaceBefore=4, spaceAfter=8))
            i += 1
            continue

        if s.startswith("#"):
            flush_para()
            level = len(s) - len(s.lstrip("#"))
            key = {1: "h1", 2: "h2", 3: "h3"}.get(level, "h4")
            story.append(Paragraph(inline(s[level:].strip()), styles[key]))
            i += 1
            continue

        if s.startswith("|"):
            flush_para()
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i].strip())
                i += 1
            story.append(render_table(table_lines, styles))
            story.append(Spacer(1, 6))
            continue

        if s.startswith(">"):
            flush_para()
            quote_lines = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote_lines.append(lines[i].strip()[1:].strip())
                i += 1
            story.append(Paragraph(inline(" ".join(quote_lines)), styles["quote"]))
            continue

        m = re.match(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$", line)
        if m:
            flush_para()
            ordered = bool(re.match(r"^\s*\d+[.)]", line))
            items = []
            while i < len(lines):
                l2 = lines[i]
                m2 = re.match(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$", l2)
                if m2 and (bool(re.match(r"^\s*\d+[.)]", l2)) == ordered):
                    items.append(m2.group(3))
                    i += 1
                elif l2.strip() == "":
                    break
                elif l2.startswith("    ") or l2.startswith("\t"):
                    if items:
                        items[-1] = items[-1] + " " + l2.strip()
                    i += 1
                else:
                    break
            for idx, it in enumerate(items):
                prefix = f"{idx + 1}." if ordered else "\u2022"
                story.append(Paragraph(f"{prefix}  {inline(it)}", styles["list"]))
            continue

        para.append(s)
        i += 1

    flush_para()
    if in_code and code_buf:
        story.append(Preformatted("\n".join(code_buf), styles["code"]))
    return story


def main():
    args = [a for a in sys.argv[1:]]
    out_dir = "pdf"
    if "--out" in args:
        k = args.index("--out")
        out_dir = args[k + 1]
        args = args[:k] + args[k + 2:]
    files = [a for a in args if not a.startswith("--")]
    if not files:
        print("usage: python3 tools-md-to-pdf.py file1.md [file2.md ...] [--out DIR]")
        sys.exit(1)
    os.makedirs(out_dir, exist_ok=True)
    for f in files:
        with open(f, "r", encoding="utf-8") as fh:
            text = fh.read()
        base = os.path.splitext(os.path.basename(f))[0]
        out_path = os.path.join(out_dir, base + ".pdf")
        doc = SimpleDocTemplate(out_path, pagesize=letter,
                                rightMargin=0.7 * inch, leftMargin=0.7 * inch,
                                topMargin=0.6 * inch, bottomMargin=0.6 * inch,
                                title=base)
        doc.build(render(text))
        print("wrote", out_path)


if __name__ == "__main__":
    main()
