#!/usr/bin/env python3
"""Build Studio-Guide.pdf from HOW-TO-USE.md.

Why this exists: the in-app "📖 Open the guide (PDF)" button serves a static
Studio-Guide.pdf. It was generated once by hand and then drifted — by 14 Aug
2026 it was sixteen builds behind and still described Campaign Export, a card
that had been removed. The markdown manual was current the whole time; only the
PDF was stale, and nothing in the repo could rebuild it.

Now there is one source of truth (HOW-TO-USE.md) and one command:

    python3 Studio/tools-make-guide.py

Run it whenever HOW-TO-USE.md changes, and commit the regenerated PDF.

Needs: pip install reportlab
"""

import os
import re
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (HRFlowable, ListFlowable, ListItem, PageBreak,
                                Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'HOW-TO-USE.md')
OUT = os.path.join(HERE, 'Studio-Guide.pdf')

# Same palette as the price list, so the two documents look like a set.
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


def build():
    if not os.path.exists(SRC):
        sys.exit(f'Cannot find {SRC}')
    with open(SRC, encoding='utf-8') as fh:
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

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(0.75 * inch, 0.5 * inch, 'Studio — built from HOW-TO-USE.md')
        canvas.drawRightString(7.75 * inch, 0.5 * inch, str(doc.page))
        canvas.restoreState()

    doc = SimpleDocTemplate(
        OUT, pagesize=letter,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.7 * inch, bottomMargin=0.75 * inch,
        title='Studio Guide', author='Studio')
    doc.build(flow, onFirstPage=footer, onLaterPages=footer)
    print(f'Wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)')


if __name__ == '__main__':
    build()
