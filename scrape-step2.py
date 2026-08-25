#!/usr/bin/env python3
"""Step 2: Reviews for top 25 apps + PDF summary"""
import csv, os, json, time
from collections import Counter
from datetime import datetime
from google_play_scraper import reviews as gp_reviews, Sort

OUT = "scraper-output"

# Load metadata
with open(f"{OUT}/apps-metadata.json") as f:
    apps = json.load(f)

# Sort by ratings count, take top 25 (skip apps with None ratings)
ranked = sorted(
    [a for a in apps if a.get("ratings") and a["ratings"] > 0],
    key=lambda x: x["ratings"],
    reverse=True
)[:25]

print(f"Top 25 apps by ratings count:")
for i, a in enumerate(ranked):
    print(f"  {i+1}. {a['title'][:40]:40s}  {a['score']:.1f}★  {a['ratings']:,} ratings")

print(f"\n=== PHASE 3: Pulling reviews for top 25 ===")
all_reviews = []
for i, a in enumerate(ranked):
    aid = a["appId"]
    print(f"  [{i+1}/25] {a['title'][:40]}…", end=" ", flush=True)
    try:
        result, _ = gp_reviews(aid, lang="en", country="us", sort=Sort.NEWEST, count=100)
        revs = []
        for r in result:
            revs.append({
                "appId": aid,
                "appTitle": a["title"][:60],
                "userName": str(r.get("userName",""))[:40],
                "score": r.get("score",""),
                "text": str(r.get("content",""))[:400].replace("\n"," "),
                "date": r.get("at","").strftime("%Y-%m-%d") if hasattr(r.get("at",""),"strftime") else "",
                "thumbsUp": r.get("thumbsUpCount",0),
            })
        all_reviews.extend(revs)
        avg = sum(r["score"] for r in revs if r["score"]) / max(len([r for r in revs if r["score"]]),1)
        print(f"✓ {len(revs)} reviews (avg {avg:.1f}★)")
    except Exception as e:
        print(f"✗ {e}")
    time.sleep(0.4)

# Write reviews CSV
revs_csv = f"{OUT}/reviews-top25.csv"
if all_reviews:
    with open(revs_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(all_reviews[0].keys()))
        w.writeheader()
        w.writerows(all_reviews)
    print(f"\n✓ {len(all_reviews)} reviews → {revs_csv}")

# ── Generate PDF ──────────────────────────────────────────────────
print(f"\n=== PHASE 4: PDF Report ===")
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

pdf_path = f"{OUT}/play-store-report.pdf"
doc = SimpleDocTemplate(pdf_path, pagesize=A4, topMargin=15*mm, bottomMargin=15*mm)
styles = getSampleStyleSheet()
story = []

title_s = ParagraphStyle("T", parent=styles["Title"], fontSize=18, spaceAfter=6)
h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, spaceAfter=4, textColor=colors.HexColor("#0f766e"))
body = ParagraphStyle("B", parent=styles["BodyText"], fontSize=9, leading=12, spaceAfter=4)
small = ParagraphStyle("S", parent=styles["BodyText"], fontSize=8, leading=10, textColor=colors.HexColor("#666666"))

story.append(Paragraph("Play Store Competitor Report", title_s))
story.append(Paragraph(f"{datetime.now().strftime('%d %b %Y')}  •  {len(apps)} apps scanned  •  {len(all_reviews)} reviews analyzed", body))
story.append(Spacer(1, 8*mm))

# Top competitors table
story.append(Paragraph("TOP 25 COMPETITORS (by ratings volume)", h2))
td = [["#", "App", "Score", "Ratings", "Genre"]]
for i, a in enumerate(ranked[:25]):
    td.append([str(i+1), Paragraph(a["title"][:35], small), f"{a['score']:.1f}" if a["score"] else "—", f"{a['ratings']:,}", a["genre"][:20]])
t = Table(td, colWidths=[15, 140, 35, 65, 100])
t.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#0f766e")),
    ("TEXTCOLOR",(0,0),(-1,0),colors.white),
    ("FONTSIZE",(0,0),(-1,-1),8),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.HexColor("#f0fdfa"),colors.white]),
    ("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#94a3b8")),
    ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("TOPPADDING",(0,0),(-1,-1),2),
    ("BOTTOMPADDING",(0,0),(-1,-1),2),
]))
story.append(t)
story.append(Spacer(1, 6*mm))

# Pain points from 1-2★ reviews
story.append(Paragraph("PAIN POINTS — words in 1★ and 2★ reviews", h2))
stop = set("the a an and or but in on at to for of is it that this with from by as be are was were been has have had do does did can will would could should may might shall not yes we you our my your its all each every any some much many more most very like just really".split())
low = [r for r in all_reviews if r["score"] in (1,2)]
lc = Counter()
for r in low:
    words = [w.strip(".,!?:;()[]\"'").lower() for w in r["text"].split()]
    lc.update(w for w in words if len(w) > 3 and w not in stop)
pain = lc.most_common(15)
if pain:
    for i in range(0, len(pain), 5):
        chunk = "  •  ".join(f"{w} ({c})" for w, c in pain[i:i+5])
        story.append(Paragraph(chunk, small))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("→ Use these words in your Play Store description to signal you solved their problem.", body))
story.append(Spacer(1, 4*mm))

# Positive words from 4-5★ reviews
story.append(Paragraph("WHAT PEOPLE LOVE — words in 4★ and 5★ reviews", h2))
high = [r for r in all_reviews if r["score"] in (4,5)]
hc = Counter()
for r in high:
    words = [w.strip(".,!?:;()[]\"'").lower() for w in r["text"].split()]
    hc.update(w for w in words if len(w) > 3 and w not in stop)
love = hc.most_common(15)
if love:
    for i in range(0, len(love), 5):
        chunk = "  •  ".join(f"{w} ({c})" for w, c in love[i:i+5])
        story.append(Paragraph(chunk, small))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("→ These are the features people value most. Double down on them in your copy.", body))
story.append(Spacer(1, 4*mm))

# Lowest rated apps (opportunity)
story.append(Paragraph("WEAKEST COMPETITORS (lowest scores, most opportunity)", h2))
weak = sorted([a for a in apps if a.get("score") and a["ratings"] and a["ratings"] > 20], key=lambda x: x["score"])
for a in weak[:10]:
    story.append(Paragraph(f"<b>{a['title'][:40]}</b>  {a['score']:.1f}★ ({a['ratings']:,} ratings) — {a['genre']}", small))
story.append(Paragraph("→ These have ratings volume but low scores = frustrated users looking for alternatives.", body))

story.append(Spacer(1, 6*mm))
story.append(Paragraph(f"Files: {OUT}/apps-metadata.csv, reviews-top25.csv, play-store-report.pdf", small))

doc.build(story)
print(f"✓ PDF → {pdf_path}")
print(f"\n=== COMPLETE — {len(apps)} apps, {len(all_reviews)} reviews ===")
