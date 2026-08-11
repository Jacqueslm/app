#!/usr/bin/env python3
"""Who is winning in the recovery niche, and what are they posting.

    python3 reference/competitor-watch.py
    python3 reference/competitor-watch.py --days 14 --out reference/watch-report.md

This is the legitimate version of "scrape people's traffic". It reads only
things the platforms publish for reading:

  * YouTube channel RSS feeds - youtube.com/feeds/videos.xml. An official,
    documented, key-free endpoint. Returns the last 15 uploads per channel
    with titles, links and publish dates.
  * Reddit's public .json views of subreddit listings, which Reddit's own API
    terms allow for read-only, rate-limited, non-commercial use.

What it deliberately does NOT do, and why:

  * No logging in, no cookies, no headless browser, no pretending to be one.
  * No TikTok or Instagram. Neither publishes a key-free read endpoint, so the
    only way in is against their terms - and the realistic outcome is the
    account getting limited or banned. With the Play Store listing days from
    production that is not a trade worth making.
  * No view counts. RSS does not carry them and inferring them is guesswork.
    What you get is what somebody CHOSE TO POST and WHEN - which is the part
    that is actually useful, because titles and cadence are copyable and view
    counts are not.

Rate limited to one request a second with a real contact string in the
User-Agent, which is what both platforms ask for.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from xml.etree import ElementTree

UA = "turnsomedayintodayone-research/1.0 (+https://www.turnsomedayintodayone.com; turnsomedayintodayone@gmail.com)"
PAUSE = 1.0  # seconds between requests - be a good guest

# YouTube channels in this niche. Add or remove freely; a channel id starts
# "UC" and is on the channel's page under Share > Copy channel ID.
CHANNELS = [
    ("Put The Shovel Down", "UCTQF_wGnLPHqPRHnvJ2xVaQ"),
    ("Sober Leon", "UCkKDGkC0Ye6iL6zqHUbxYUw"),
    ("Recovery Elevator", "UCWy6y5Cx6hHUvGiJHKfHRJA"),
    ("The Sober Experiment", "UCjOxHOjJ0ycTv0h5C8yqL0w"),
]

# Subreddits where this audience actually talks. Partner rooms first - that is
# the lane KEYWORDS.md says is winnable and the one nobody else writes for.
SUBREDDITS = ["AlAnon", "stopdrinking", "loveafteraddiction", "SupportforWaywardSpouses"]

NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}


def get(url, as_json=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        return {"__error__": f"HTTP {e.code}"}
    except Exception as e:  # network blocked, DNS, timeout
        return {"__error__": str(e)[:120]}
    finally:
        time.sleep(PAUSE)
    if as_json:
        try:
            return json.loads(raw)
        except Exception:
            return {"__error__": "not JSON (blocked or rate-limited)"}
    return raw


def youtube(days):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    out = []
    for name, cid in CHANNELS:
        raw = get(f"https://www.youtube.com/feeds/videos.xml?channel_id={cid}")
        if isinstance(raw, dict):
            out.append({"channel": name, "error": raw["__error__"], "videos": []})
            continue
        try:
            root = ElementTree.fromstring(raw)
        except ElementTree.ParseError:
            out.append({"channel": name, "error": "feed did not parse", "videos": []})
            continue
        vids = []
        for entry in root.findall("a:entry", NS):
            pub = entry.findtext("a:published", "", NS)
            try:
                when = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            except ValueError:
                continue
            if when < cutoff:
                continue
            vids.append({
                "title": (entry.findtext("a:title", "", NS) or "").strip(),
                "url": (entry.find("a:link", NS).get("href") if entry.find("a:link", NS) is not None else ""),
                "published": when.strftime("%Y-%m-%d"),
            })
        out.append({"channel": name, "error": None, "videos": vids})
    return out


def reddit(days, limit=25):
    cutoff = time.time() - days * 86400
    out = []
    for sub in SUBREDDITS:
        data = get(f"https://www.reddit.com/r/{sub}/top.json?t=month&limit={limit}", as_json=True)
        if "__error__" in data:
            out.append({"sub": sub, "error": data["__error__"], "posts": []})
            continue
        posts = []
        for child in data.get("data", {}).get("children", []):
            d = child.get("data", {})
            if d.get("created_utc", 0) < cutoff:
                continue
            posts.append({
                "title": (d.get("title") or "").strip(),
                "score": d.get("score", 0),
                "comments": d.get("num_comments", 0),
                "url": "https://reddit.com" + (d.get("permalink") or ""),
            })
        posts.sort(key=lambda p: p["comments"], reverse=True)
        out.append({"sub": sub, "error": None, "posts": posts})
    return out


# Titles are the copyable part. These are the phrasings that repeat across a
# niche, and they map onto the lanes in KEYWORDS.md.
HOOKS = {
    "question": r"^\s*(how|what|why|when|is|are|do|does|can|should)\b",
    "number": r"\b\d+\s+(things|ways|signs|reasons|days|rules|lessons)\b",
    "day count": r"\b(day|days)\s*\d+\b|\b\d+\s*(days|months|years)\s+sober\b",
    "partner-facing": r"\b(husband|wife|boyfriend|girlfriend|partner|spouse|loved one)\b",
    "first person": r"\b(i|my|me)\b",
    "you-facing": r"\byou(r|'re)?\b",
}


def title_shapes(titles):
    counts = {k: 0 for k in HOOKS}
    for t in titles:
        for k, pat in HOOKS.items():
            if re.search(pat, t, re.I):
                counts[k] += 1
    return counts


def report(days):
    L = []
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    L.append(f"# Competitor watch — last {days} days\n")
    L.append(f"Generated {stamp} by `reference/competitor-watch.py`.\n")
    L.append("Sources: YouTube channel RSS (official, key-free) and Reddit public "
             "JSON listings. No logins, no scraping, no TikTok or Instagram — "
             "neither publishes a readable endpoint and the only way in breaks "
             "their terms.\n")

    yt = youtube(days)
    L.append("\n## YouTube — what they published, and how often\n")
    all_titles = []
    for ch in yt:
        if ch["error"]:
            L.append(f"\n**{ch['channel']}** — could not read ({ch['error']}).\n")
            continue
        n = len(ch["videos"])
        pace = f"{n} in {days} days" + (f" — about one every {days // n} days" if n else "")
        L.append(f"\n**{ch['channel']}** — {pace}\n")
        if not n:
            L.append("\nNothing published in this window.\n")
        for v in ch["videos"]:
            L.append(f"- `{v['published']}` [{v['title']}]({v['url']})")
            all_titles.append(v["title"])
        L.append("")

    if all_titles:
        L.append("\n### What their titles have in common\n")
        L.append(f"Across {len(all_titles)} titles:\n")
        L.append("| Shape | Titles using it |")
        L.append("|---|---|")
        for k, c in sorted(title_shapes(all_titles).items(), key=lambda x: -x[1]):
            L.append(f"| {k} | {c} of {len(all_titles)} |")
        L.append("\n**Read it against `KEYWORDS.md`.** If 'partner-facing' is low "
                 "across everyone, that is the moat showing up from a third "
                 "direction — nobody is making videos for the person who loves "
                 "someone using.\n")

    rd = reddit(days)
    L.append("\n## Reddit — what this audience is actually saying\n")
    L.append("Sorted by comments, not upvotes: a post with 200 comments is a "
             "question people need answered, which is a video subject. A post "
             "with 2,000 upvotes and 6 comments is just agreement.\n")
    for sub in rd:
        L.append(f"\n### r/{sub['sub']}\n")
        if sub["error"]:
            L.append(f"Could not read ({sub['error']}).\n")
            continue
        if not sub["posts"]:
            L.append("Nothing in this window.\n")
        for p in sub["posts"][:10]:
            L.append(f"- **{p['comments']} comments** · {p['score']} pts — [{p['title'][:110]}]({p['url']})")
        L.append("")

    L.append("\n---\n")
    L.append("**How to use this.** The titles are the copyable part — a phrasing "
             "that repeats across four channels is one the audience responds to. "
             "The Reddit rows are subject matter: a question asked over and over "
             "with a hundred replies is a script you have not written yet. "
             "Neither is a reason to change the plan on its own; check it against "
             "`KEYWORDS.md` before making anything, because search volume beats a "
             "hunch.\n")
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser(description="Competitor watch from official, key-free sources.")
    ap.add_argument("--days", type=int, default=30, help="how far back to look (default 30)")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "watch-report.md"))
    args = ap.parse_args()

    print(f"Reading {len(CHANNELS)} YouTube feeds and {len(SUBREDDITS)} subreddits "
          f"(one request a second, so about {len(CHANNELS) + len(SUBREDDITS)} seconds)…\n")
    md = report(args.days)
    with open(args.out, "w") as f:
        f.write(md)
    print(md[:1500])
    print(f"\n… full report written to {args.out}")


if __name__ == "__main__":
    main()
