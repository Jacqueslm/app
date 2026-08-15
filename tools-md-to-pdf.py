#!/usr/bin/env python3
"""Turn any markdown file in this repo into a PDF.

Why this exists: Jacques reads and forwards PDFs, not .md files. Every handover
written as markdown had to be converted by hand, and whoever was doing it kept
forgetting — so he kept receiving files he could not comfortably read on a phone
or send to anyone.

This is the same renderer as Studio/tools-make-guide.py, made general.

    python3 tools-md-to-pdf.py KEYWORDS.md
    python3 tools-md-to-pdf.py reference/*.md
    python3 tools-md-to-pdf.py --all          # every handover doc, in one go

PDFs land next to the markdown they came from, same name, .pdf.

Needs: pip install reportlab
"""

import glob
import os
import re
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (HRFlowable, ListFlowable, ListItem,
                                Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

HERE = os.path.dirname(os.path.abspath(__file__))

# The set that gets handed to people. --all rebuilds exactly these.
HANDOVER = [
    'START-HERE.md',
    'KEYWORDS.md',
    'reference/HANDOVER-SEARCH-RESEARCH.md',
    'reference/SERIES-COUPLES.md',
    'reference/SERIES-2026-08-FOUR-EPISODES.md',
    'reference/BUFFER-QUEUE-2026-08-14.md',
    'reference/MUSIC-LIBRARY.md',
    'reference/marketing-playbook.md',
    'reference/medical-claims-audit.md',
]

# Same palette as the Studio guide, so every document looks like a set.
INK = colors.HexColor('#14121f')
ACCENT = colors.HexColor('#6d5efc')
MUTED = colors.HexColor('#6b6b7b')
LIGHT = colors.HexColor('#f2f1fb')
LINE = colors.HexColor('#dddaee')

H1 = ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=22, textColor=INK,
                    alignment=TA_LEFT, leading=26, spaceBefore=16, spaceAfter=8)
H2 = ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=15, textColor=ACCENT,
                    leading=19, spaceBefore=14, spaceAfter=6)
H3 = ParagraphStyle('H3', fontName='Helvetica-Bold', fontSize=12, textColor=INK,
                    leading=15, spaceBefore=10, spaceAfter=4)
BODY = ParagraphStyle('Body', fontName='Helvetica', fontSize=9.5, textColor=INK,
                      leading=13.5, spaceAfter=5)
BULLET = ParagraphStyle('Bullet', parent=BODY, leftIndent=10, spaceAfter=3)
CODE = ParagraphStyle('Code', fontName='Courier', fontSize=8.5, textColor=INK,
                      leading=11, backColor=LIGHT, borderPadding=5,
                      leftIndent=6, spaceBefore=4, spaceAfter=6)


def esc(text):
    """Markdown inline -> reportlab's mini-HTML, with real escaping first."""
    t = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    t = re.sub(r'`([^`]+)`', r'<font face="Courier" size="8.5">\1</font>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', t)
    # Single asterisks only when they wrap a word, so "2 * 3" survives.
    t = re.sub(r'(?<!\*)\*([^*\n]+)\*(?!\*)', r'<i>\1</i>', t)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<link href="\2" color="#6d5efc">\1</link>', t)
    return t


def split_row(line):
    cells = [c.strip() for c in line.strip().strip('|').split('|')]
    return cells


def build(src, out, title):
    if not os.path.exists(src):
        sys.exit(f'Cannot find {src}')
    with open(src, encoding='utf-8') as fh:
        lines = fh.read().split('\n')

    flow = []
    i = 0
    in_code = False
    code_buf = []
    bullets = []

    def flush_bullets():
        if not bullets:
            return
        flow.append(ListFlowable(
            [ListItem(Paragraph(b, BULLET), leftIndent=14) for b in bullets],
            bulletType='bullet', start='•', bulletFontSize=7, leftIndent=12))
        flow.append(Spacer(1, 4))
        bullets.clear()

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()

        if line.strip().startswith('```'):
            if in_code:
                flow.append(Paragraph('<br/>'.join(
                    c.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    .replace(' ', '&nbsp;') for c in code_buf), CODE))
                code_buf = []
                in_code = False
            else:
                flush_bullets()
                in_code = True
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        # tables
        if line.startswith('|') and i + 1 < len(lines) and re.match(r'^\|[\s:|-]+\|?$', lines[i + 1].strip()):
            flush_bullets()
            header = split_row(line)
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                rows.append(split_row(lines[i]))
                i += 1
            ncols = len(header)
            data = [[Paragraph(f'<b>{esc(c)}</b>', BODY) for c in header]]
            for r in rows:
                r = (r + [''] * ncols)[:ncols]
                data.append([Paragraph(esc(c), BODY) for c in r])
            width = 7.0 * inch
            tbl = Table(data, colWidths=[width / ncols] * ncols, hAlign='LEFT')
            tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), LIGHT),
                ('GRID', (0, 0), (-1, -1), 0.4, LINE),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            flow.append(tbl)
            flow.append(Spacer(1, 8))
            continue

        if not line.strip():
            flush_bullets()
            i += 1
            continue

        if line.startswith('# '):
            flush_bullets()
            flow.append(Paragraph(esc(line[2:]), H1))
        elif line.startswith('## '):
            flush_bullets()
            flow.append(Paragraph(esc(line[3:]), H2))
        elif line.startswith('### '):
            flush_bullets()
            flow.append(Paragraph(esc(line[4:]), H3))
        elif re.match(r'^\s*[-*]\s+', line):
            bullets.append(esc(re.sub(r'^\s*[-*]\s+', '', line)))
        elif re.match(r'^\s*\d+\.\s+', line):
            m = re.match(r'^\s*(\d+)\.\s+(.*)', line)
            flush_bullets()
            flow.append(Paragraph(f'<b>{m.group(1)}.</b> {esc(m.group(2))}', BULLET))
        elif line.startswith('> '):
            flush_bullets()
            flow.append(Paragraph(esc(line[2:]), ParagraphStyle(
                'Quote', parent=BODY, leftIndent=14, textColor=MUTED, fontName='Helvetica-Oblique')))
        elif re.match(r'^\s*---+\s*$', line):
            flush_bullets()
            flow.append(HRFlowable(width='100%', thickness=0.5, color=LINE,
                                   spaceBefore=6, spaceAfter=6))
        else:
            flush_bullets()
            flow.append(Paragraph(esc(line), BODY))
        i += 1

    flush_bullets()


    flush_bullets()

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(0.75 * inch, 0.5 * inch, f'{title} — built from {os.path.basename(src)}')
        canvas.drawRightString(7.75 * inch, 0.5 * inch, str(doc.page))
        canvas.restoreState()

    doc = SimpleDocTemplate(
        out, pagesize=letter,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.7 * inch, bottomMargin=0.75 * inch,
        title=title, author='Turn Someday Into Day One')
    doc.build(flow, onFirstPage=footer, onLaterPages=footer)
    return out


def title_from(src):
    """Use the first '# ' heading as the document title, else the filename."""
    try:
        for line in open(src, encoding='utf-8'):
            if line.startswith('# '):
                return line[2:].strip()
    except OSError:
        pass
    return os.path.splitext(os.path.basename(src))[0]


def main(argv):
    if not argv or argv[0] == '--all':
        targets = [os.path.join(HERE, p) for p in HANDOVER]
    else:
        targets = []
        for a in argv:
            targets.extend(sorted(glob.glob(a)) or [a])
    if not targets:
        sys.exit('Nothing to convert.')
    for src in targets:
        if not os.path.exists(src):
            print(f'skipped (missing): {src}')
            continue
        out = os.path.splitext(src)[0] + '.pdf'
        build(src, out, title_from(src))
        print(f'{out}  ({os.path.getsize(out) / 1024:.0f} KB)')


if __name__ == '__main__':
    main(sys.argv[1:])
