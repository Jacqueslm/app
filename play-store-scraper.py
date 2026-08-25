#!/usr/bin/env python3
"""
Play Store Scraper — Turn Someday Into Day One
Pulls reviews + metadata for your app and every competitor across
recovery, sobriety, addiction, habit, and wellness categories.
Exports: CSV (raw data) + PDF (readable summary).
"""
import csv, os, time, textwrap
from datetime import datetime
from google_play_scraper import (
    reviews as gp_reviews,
    app as gp_app,
    search as gp_search,
    Sort,
)

# ── your app ──────────────────────────────────────────────────────
YOUR_APP = "com.turnsomedayintodayone.app"  # adjust if the package is different

# ── search buckets — each term pulls ~20 apps, we dedupe by appId ─
SEARCH_QUERIES = [
    # Recovery & sobriety
    "sobriety counter app",
    "addiction recovery app",
    "quit drinking app",
    "recovery community app",
    "sober tracker",
    # Porn / sex addiction (your lane)
    "porn addiction recovery",
    "quit porn app",
    "nOfap tracker",
    # Gambling
    "gambling addiction recovery",
    "gambling self exclusion app",
    # Habit / self-improvement
    "habit tracker streak",
    "habit recovery daily",
    # Mental health / crisis
    "mental health crisis app",
    "anxiety coping tools",
    "depression daily check in",
    # Faith-based
    "devotional recovery bible",
    "faith based sobriety",
    # Food / eating
    "binge eating recovery",
    "food addiction tracker",
    # Smoking / substances
    "quit smoking counter",
    "substance abuse recovery",
    # Social media / gaming
    "screen time addiction",
    "digital detox tracker",
    "gaming addiction quit",
]

# ── known competitor app IDs (skip search, pull directly) ─────────
KNOWN_IDS = [
    # From COMPETITORS.md + research
    "com.fueledbyinspiration.iamsober",       # I Am Sober
    "com.sobergrid.sobergrid",                # Sober Grid
    "com.nomo.sobrietyclocks",                # Nomo Sobriety Clocks
    "com.quitzilla",                          # Quitzilla
    "com.reframe",                            # Reframe
    "com.rewire.app",                         # Rewire: Addiction Recovery
    "com.fivecircles.fivecircles",            # Five Circles (gambling)
    "com.calm.calm",                          # Calm (mental health)
    "com.changecollective.twentyone",         # Twenty One (AA in pocket)
    "com.iamwithyou.willpower",              # Willpower (porn)
    "com.covenanteyes.android",               # Covenant Eyes
    "com.fortify.fortifyapp",                 # Fortify (porn)
    "com.lighthouseproject.lighthouse",       # Lighthouse (porn)
    "com.appstinence.app",                    # Appstinence (porn)
    "com.quitsocial.quitsocial",              # Quit Social Media
    "com.androxus.gamblock",                  # Gamblock
    "com.recoverydharma.meditation",          # Recovery Dharma
    "com.sparkpeople.android",               # SparkPeople (food)
    "com.myfitnesspal.android",               # MyFitnessPal (food)
    "com.noom.noom",                          # Noom (weight)
]

OUT_DIR = "scraper-output"
os.makedirs(OUT_DIR, exist_ok=True)

# ── helpers ───────────────────────────────────────────────────────
def safe_str(v, max_len=500):
    if v is None:
        return ""
    s = str(v).replace("\n", " ").replace("\r", "")
    return s[:max_len]

def pull_app_info(app_id):
    """Return metadata dict for one app, or None on failure."""
    try:
        d = gp_app(app_id, lang="en", country="us")
        return {
            "appId": app_id,
            "title": safe_str(d.get("title"), 120),
            "developer": safe_str(d.get("developer"), 100),
            "installs": safe_str(d.get("realInstalls"), 30),
            "score": d.get("score", ""),
            "ratings": d.get("ratings", ""),
            "reviews": d.get("reviews", ""),
            "description": safe_str(d.get("description"), 800),
            "genre": safe_str(d.get("genre"), 60),
            "categories": safe_str(d.get("categories"), 120),
            "url": d.get("url", ""),
        }
    except Exception as e:
        print(f"  ✗ app info failed for {app_id}: {e}")
        return None

def pull_reviews(app_id, n=100):
    """Pull up to n recent reviews for one app."""
    try:
        result, _ = gp_reviews(
            app_id,
            lang="en",
            country="us",
            sort=Sort.NEWEST,
            count=n,
        )
        rows = []
        for r in result:
            rows.append({
                "appId": app_id,
                "userName": safe_str(r.get("userName"), 60),
                "score": r.get("score", ""),
                "title": safe_str(r.get("title"), 100),
                "text": safe_str(r.get("content"), 600),
                "date": r.get("at", "").strftime("%Y-%m-%d") if hasattr(r.get("at", ""), "strftime") else str(r.get("at", ""))[:10],
                "thumbsUp": r.get("thumbsUpCount", 0),
            })
        return rows
    except Exception as e:
        print(f"  ✗ reviews failed for {app_id}: {e}")
        return []

# ── Phase 1: Discover apps via search ────────────────────────────
print("=" * 60)
print("PHASE 1 — Discovering competitor apps via search…")
print("=" * 60)
seen_ids = set()
all_app_ids = list(KNOWN_IDS)

for q in SEARCH_QUERIES:
    print(f"  Searching: {q}")
    try:
        results = gp_search(q, lang="en", country="us", n_hits=20)
        for r in results:
            aid = r.get("appId", "")
            if aid and aid not in seen_ids:
                seen_ids.add(aid)
                all_app_ids.append(aid)
    except Exception as e:
        print(f"    ✗ search error: {e}")
    time.sleep(0.5)  # rate limit courtesy

print(f"\n  → {len(all_app_ids)} unique apps discovered\n")

# ── Phase 2: Pull app metadata ───────────────────────────────────
print("=" * 60)
print("PHASE 2 — Pulling app metadata…")
print("=" * 60)
apps_data = []
for i, aid in enumerate(all_app_ids):
    print(f"  [{i+1}/{len(all_app_ids)}] {aid}")
    info = pull_app_info(aid)
    if info:
        apps_data.append(info)
    time.sleep(0.4)

# Write apps CSV
apps_csv = os.path.join(OUT_DIR, "apps-metadata.csv")
if apps_data:
    with open(apps_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(apps_data[0].keys()))
        w.writeheader()
        w.writerows(apps_data)
    print(f"\n  ✓ Wrote {len(apps_data)} apps → {apps_csv}\n")

# ── Phase 3: Pull reviews for top apps (by rating count) ─────────
print("=" * 60)
print("PHASE 3 — Pulling reviews for top 30 apps + your app…")
print("=" * 60)
# Sort by ratings count descending, take top 30 + make sure your app is included
ranked = sorted(apps_data, key=lambda x: int(x.get("ratings", 0) or 0), reverse=True)
top_ids = [a["appId"] for a in ranked[:30]]
if YOUR_APP not in top_ids:
    top_ids.insert(0, YOUR_APP)

all_reviews = []
for i, aid in enumerate(top_ids):
    title = next((a["title"] for a in apps_data if a["appId"] == aid), aid)
    print(f"  [{i+1}/{len(top_ids)}] Reviews for: {title[:50]}…")
    revs = pull_reviews(aid, n=100)
    all_reviews.extend(revs)
    print(f"    → {len(revs)} reviews")
    time.sleep(0.4)

# Write reviews CSV
revs_csv = os.path.join(OUT_DIR, "reviews-all.csv")
if all_reviews:
    with open(revs_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(all_reviews[0].keys()))
        w.writeheader()
        w.writerows(all_reviews)
    print(f"\n  ✓ Wrote {len(all_reviews)} reviews → {revs_csv}\n")

# ── Phase 4: Generate summary PDF ────────────────────────────────
print("=" * 60)
print("PHASE 4 — Generating summary PDF…")
print("=" * 60)

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

pdf_path = os.path.join(OUT_DIR, "play-store-report.pdf")
doc = SimpleDocTemplate(pdf_path, pagesize=A4, topMargin=15*mm, bottomMargin=15*mm)
styles = getSampleStyleSheet()
story = []

title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=18, spaceAfter=6)
h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, spaceAfter=4, textColor=colors.HexColor("#0f766e"))
body = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=9, leading=12, spaceAfter=4)
small = ParagraphStyle("Small", parent=styles["BodyText"], fontSize=8, leading=10, textColor=colors.HexColor("#666666"))

story.append(Paragraph("Play Store Competitor Report", title_style))
story.append(Paragraph(f"Generated {datetime.now().strftime('%d %b %Y %H:%M')}  •  {len(apps_data)} apps  •  {len(all_reviews)} reviews", body))
story.append(Spacer(1, 8*mm))

# ── Your app section ──
story.append(Paragraph("YOUR APP — Turn Someday Into Day One", h2))
your = next((a for a in apps_data if a["appId"] == YOUR_APP), None)
if your:
    story.append(Paragraph(f"Score: {your['score']}★  |  Ratings: {your['ratings']}  |  Reviews: {your['reviews']}  |  Installs: {your['installs']}", body))
    your_revs = [r for r in all_reviews if r["appId"] == YOUR_APP]
    if your_revs:
        avg = sum(r["score"] for r in your_revs if r["score"]) / max(len([r for r in your_revs if r["score"]]), 1)
        story.append(Paragraph(f"Recent reviews pulled: {len(your_revs)}  |  Avg of pulled: {avg:.1f}★", body))
        for r in your_revs[:10]:
            stars = "★" * r["score"] + "☆" * (5 - r["score"]) if r["score"] else "—"
            txt = safe_str(r["text"], 200)
            story.append(Paragraph(f"<b>{r['userName']}</b>  {stars}  {r['date']}<br/>{txt}", small))
            story.append(Spacer(1, 2*mm))
else:
    story.append(Paragraph("App not found on Play Store — check package ID", body))
story.append(Spacer(1, 6*mm))

# ── Top competitors table ──
story.append(Paragraph("TOP COMPETITORS (by ratings count)", h2))
table_data = [["App", "Score", "Ratings", "Reviews", "Installs", "Genre"]]
for a in ranked[:25]:
    table_data.append([
        Paragraph(safe_str(a["title"], 40), small),
        str(a["score"]),
        str(a["ratings"]),
        str(a["reviews"]),
        safe_str(a["installs"], 12),
        safe_str(a["genre"], 25),
    ])
if len(table_data) > 1:
    t = Table(table_data, colWidths=[130, 35, 50, 50, 65, 75])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#0f766e")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTSIZE", (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.HexColor("#f8fafc"), colors.white]),
        ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))
    story.append(t)
story.append(Spacer(1, 6*mm))

# ── Keyword ideas from descriptions ──
story.append(Paragraph("COMMON KEYWORDS IN COMPETITOR DESCRIPTIONS", h2))
from collections import Counter
stop_words = set("the a an and or but in on at to for of is it that this with from by as be are was were been has have had do does did can will would could should may might shall not no yes we you our my your their its all each every any some much many more most very".split())
word_counter = Counter()
for a in apps_data:
    desc = (a.get("description") or "").lower()
    words = [w.strip(".,!?:;()[]\"'") for w in desc.split()]
    words = [w for w in words if len(w) > 3 and w not in stop_words]
    word_counter.update(words)
top_words = word_counter.most_common(40)
kw_text = "  •  ".join(f"{w} ({c})" for w, c in top_words)
# Wrap into paragraphs
for i in range(0, len(top_words), 8):
    chunk = "  •  ".join(f"{w} ({c})" for w, c in top_words[i:i+8])
    story.append(Paragraph(chunk, small))
    story.append(Spacer(1, 2*mm))

# ── Competitor review sentiment highlights ──
story.append(Spacer(1, 6*mm))
story.append(Paragraph("REVIEW SENTIMENT HIGHLIGHTS", h2))
story.append(Paragraph("Most-mentioned words in 1★ and 2★ competitor reviews (pain points to exploit):", body))
low_revs = [r for r in all_reviews if r["score"] in (1, 2) and r["appId"] != YOUR_APP]
low_words = Counter()
for r in low_revs:
    txt = (r.get("text") or "").lower()
    words = [w.strip(".,!?:;()[]\"'") for w in txt.split()]
    words = [w for w in words if len(w) > 3 and w not in stop_words]
    low_words.update(words)
pain_points = low_words.most_common(20)
if pain_points:
    pp_text = "  •  ".join(f"{w} ({c})" for w, c in pain_points[:10])
    story.append(Paragraph(pp_text, small))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph("→ These are the words people use when they're frustrated with competitor apps. Use them in your description and play-store copy to signal you solved their problem.", body))
else:
    story.append(Paragraph("Not enough low-rated reviews to analyze yet.", body))

story.append(Spacer(1, 8*mm))
story.append(Paragraph(f"Files saved in {OUT_DIR}/: apps-metadata.csv, reviews-all.csv, play-store-report.pdf", small))

# Build PDF
doc.build(story)
print(f"\n  ✓ PDF → {pdf_path}")

# ── Done ──────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"COMPLETE — {len(apps_data)} apps, {len(all_reviews)} reviews")
print(f"  CSV: {apps_csv}")
print(f"  CSV: {revs_csv}")
print(f"  PDF: {pdf_path}")
print("=" * 60)
