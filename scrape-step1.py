#!/usr/bin/env python3
"""Step 1: Discover apps + pull metadata (fast)"""
import csv, os, time, json
from google_play_scraper import app as gp_app, search as gp_search

OUT = "scraper-output"
os.makedirs(OUT, exist_ok=True)

YOUR_APP = "com.turnsomedayintodayone.app"

QUERIES = [
    "sobriety counter app", "addiction recovery app", "quit drinking app",
    "recovery community app", "sober tracker", "porn addiction recovery",
    "quit porn app", "gambling addiction recovery", "habit tracker streak",
    "mental health crisis app", "anxiety coping tools", "faith based sobriety",
    "binge eating recovery", "quit smoking counter", "screen time addiction",
]

KNOWN = [
    "com.fueledbyinspiration.iamsober", "com.sobergrid.sobergrid",
    "com.nomo.sobrietyclocks", "com.quitzilla", "com.reframe",
    "com.rewire.app", "com.fivecircles.fivecircles", "com.calm.calm",
    "com.covenanteyes.android", "com.fortify.fortifyapp",
    "com.appstinence.app", "com.androxus.gamblock", "com.noom.noom",
    "com.myfitnesspal.android", "com.sparkpeople.android",
]

print("=== PHASE 1: Discover ===")
seen = set()
ids = list(KNOWN)
for q in QUERIES:
    print(f"  {q}…", end=" ", flush=True)
    try:
        res = gp_search(q, lang="en", country="us", n_hits=15)
        n = 0
        for r in res:
            aid = r.get("appId", "")
            if aid and aid not in seen:
                seen.add(aid)
                ids.append(aid)
                n += 1
        print(f"+{n}")
    except Exception as e:
        print(f"ERR: {e}")
    time.sleep(0.3)

print(f"\n→ {len(ids)} apps total\n")

print("=== PHASE 2: Metadata ===")
apps = []
for i, aid in enumerate(ids):
    print(f"  [{i+1}/{len(ids)}] {aid[:50]}", end=" ", flush=True)
    try:
        d = gp_app(aid, lang="en", country="us")
        apps.append({
            "appId": aid,
            "title": str(d.get("title",""))[:100],
            "developer": str(d.get("developer",""))[:80],
            "score": d.get("score",""),
            "ratings": d.get("ratings",0),
            "reviews": d.get("reviews",0),
            "installs": d.get("realInstalls",0),
            "genre": str(d.get("genre",""))[:40],
            "url": d.get("url",""),
        })
        print(f"✓ {d.get('score','?')}★ ({d.get('ratings',0)} ratings)")
    except Exception as e:
        print(f"✗ {e}")
    time.sleep(0.3)

# Save
with open(f"{OUT}/apps-metadata.csv","w",newline="",encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(apps[0].keys()))
    w.writeheader()
    w.writerows(apps)

with open(f"{OUT}/apps-metadata.json","w") as f:
    json.dump(apps, f, indent=2)

print(f"\n✓ {len(apps)} apps saved to {OUT}/apps-metadata.csv")
print(f"✓ IDs for step 2 saved to {OUT}/apps-metadata.json")
