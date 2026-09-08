#!/usr/bin/env python3
"""Google + YouTube autocomplete keyword harvester for the recovery app.

Harvests phrases people actually type into Google and YouTube, to mine for
YouTube long-form video titles. Python 3 stdlib only — nothing to install.

See README.md next to this file for why this exists, how to run it, and the
honest limits baked into the output (no volumes, no difficulty scores, and
the tool never fakes an answer when an endpoint is blocked).
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

ENDPOINT = "https://suggestqueries.google.com/complete/search"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
LEAD_INS = ["how to", "why do i", "what happens", "is it", "does", "best"]
LETTERS = "abcdefghijklmnopqrstuvwxyz"
REQUEST_TIMEOUT = 8  # seconds per request, so a blocked endpoint can't stall a run


def normalize(text: str) -> str:
    """Lowercase and collapse whitespace — enough for dedupe and known-marking."""
    return re.sub(r"\s+", " ", text.strip().lower())


def parse_suggestions(raw: str, engine: str) -> list[str]:
    """Turn an autocomplete response body into a list of suggestion strings.

    Handles three shapes: plain JSON arrays (firefox/youtube clients),
    the `window.google.ac.h([...])` wrapper (chrome client), and youtube's
    [[term, 0, []], ...] entries. Returns [] when nothing parseable came back.
    """
    text = raw.strip()
    data = None
    if engine == "youtube" or text.startswith("["):
        try:
            data = json.loads(text)
        except ValueError:
            data = None
    if data is None:
        m = re.search(r"\[.*\]", text, re.S)
        if m:
            try:
                data = json.loads(m.group(0))
            except ValueError:
                return []
    if not isinstance(data, list) or len(data) < 2 or not isinstance(data[1], list):
        return []
    out = []
    for entry in data[1]:
        if isinstance(entry, str) and entry.strip():
            out.append(entry)
        elif isinstance(entry, list) and entry and isinstance(entry[0], str) and entry[0].strip():
            out.append(entry[0])
    return out


def fetch(engine: str, query: str) -> tuple[bool, list[str]]:
    """One autocomplete request. Returns (completed, suggestions).

    completed=False means no HTTP response at all (blocked, timeout, network
    failure). completed=True with [] is a real-but-empty answer — Google and
    YouTube genuinely return nothing for some long-tails.
    """
    params = {"client": "firefox", "hl": "en", "q": query}
    if engine == "youtube":
        params["client"] = "youtube"
        params["ds"] = "yt"
    url = ENDPOINT + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json,text/plain,*/*"},
    )
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, OSError, TimeoutError, ValueError):
        return False, []
    return True, parse_suggestions(raw, engine)


def load_seeds(path: Path) -> list[str]:
    seeds = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        seeds.append(line)
    return seeds


def queries_for(seed: str, expand: bool, prefixes: bool) -> list[tuple[str, str]]:
    """(method, query) pairs for one seed. Methods mirror README.md: the base
    phrase, each letter a–z to surface long-tails, and the six lead-ins
    (a lead-in is skipped when the seed already starts with it)."""
    out = [("seed", seed)]
    if expand:
        for ch in LETTERS:
            out.append((f"letter:{ch}", f"{seed} {ch}"))
    if prefixes:
        for p in LEAD_INS:
            if seed.startswith(p):
                continue
            out.append((f"prefix:{p}", f"{p} {seed}"))
    return out


def load_known_terms(path: Path) -> set[str]:
    """Extract the search terms from KEYWORDS.md tables.

    Exact-match only: a phrase counts as already-known when it equals a term
    in that file. A phrase merely *containing* a known term is still new —
    that is how the test reports marked `... in denial` as new while
    `how to help an alcoholic husband` itself was known.
    """
    terms: set[str] = set()
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return terms
    header_names = {"term", "keyword", "question"}
    for line in text.splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.split("|")]
        if len(cells) < 2:
            continue
        term = cells[1].replace("**", "").replace("`", "")
        if not term or normalize(term) in header_names:
            continue
        if set(term) <= set("-: "):
            continue  # separator row like |---|---|
        for part in re.split(r"\s*/\s*", term):
            norm = normalize(part)
            if norm:
                terms.add(norm)
    return terms


def write_report(
    out_dir: Path,
    seeds: list[str],
    attempted: dict[str, bool],
    sent: dict[str, int],
    answered: dict[str, int],
    new_rows: list[tuple[str, str, str, str]],
    known_rows: list[tuple[str, str, str, str]],
    n_new: int,
    n_known: int,
    failures: list[tuple[str, str]],
    known_file: Path | None,
) -> None:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [f"# Keyword harvest — {now}", ""]

    parts = []
    for engine in ("google", "youtube"):
        if attempted[engine]:
            parts.append(f"{sent[engine]} ({engine})")
    summary = f"Seeds: {len(seeds)}. Queries sent: {', '.join(parts)}. "
    summary += f"New phrases after dedupe: {n_new}. Already in KEYWORDS.md: {n_known}."
    lines.append(summary)
    lines.append("")

    lines.append("## The honest limits")
    lines.append("")
    lines.append(
        "- These are phrases people actually type, returned by the autocomplete "
        "endpoint. There are **no search volumes and no difficulty scores** — "
        "Semrush ended 15 Aug 2026 and no number in this report is invented."
    )
    engine_names = {"google": "Google", "youtube": "YouTube"}
    for engine in ("google", "youtube"):
        name = engine_names.get(engine, engine.title())
        if not attempted[engine]:
            status = f"**{name} autocomplete:** not queried in this run."
        elif answered[engine] > 0:
            status = f"**{name} autocomplete:** answered."
        else:
            status = (
                f"**{name} autocomplete:** returned nothing — that "
                "endpoint is frequently blocked from datacenter/cloud networks; "
                "try the same command from a home connection."
            )
        lines.append(f"- {status}")
    lines.append(
        "- Apply KEYWORDS.md's tags (Build / Too hard / Skip) yourself. A term "
        "missing from KEYWORDS.md is not proof the term is unclaimed, and a term "
        "here with no number is not proof it has no demand."
    )
    if known_file is None:
        lines.append(
            "- **KEYWORDS.md was not found** — nothing is marked already-known; "
            "pass `--known-file PATH` to enable the marking."
        )
    lines.append("")

    if failures:
        lines.append("## Queries that failed")
        lines.append("")
        lines.append(
            "These got no answer at all (blocked, rate-limited, or network). "
            "Re-run with a higher `--delay` or from a home connection if you want them."
        )
        lines.append("")
        lines.append("| Engine | Query |")
        lines.append("|---|---|")
        for engine, query in failures:
            lines.append(f"| {engine} | {query} |")
        lines.append("")

    lines.append("## All new phrases")
    lines.append("")
    lines.append("Sorted alphabetically. One phrase per row; the seed column says where it came from.")
    lines.append("")
    lines.append("| Keyword | Engine | Found via | Seed |")
    lines.append("|---|---|---|---|")
    for keyword, engine, method, seed in new_rows:
        lines.append(f"| {keyword} | {engine} | {method} | {seed} |")
    lines.append("")

    lines.append("## Also seen, already in KEYWORDS.md")
    lines.append("")
    lines.append("Not new — the file already has these. Only listed so you know they were checked.")
    lines.append("")
    lines.append("| Keyword | Engine | Found via | Seed |")
    lines.append("|---|---|---|---|")
    for keyword, engine, method, seed in known_rows:
        lines.append(f"| {keyword} | {engine} | {method} | {seed} |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(
        "Rules this feeds, from KEYWORDS.md: quote the numbers in that file, "
        "never re-estimate them; don't delete it; and when you write a title, "
        "match how the phrase is typed — don't correct the grammar."
    )
    lines.append("")

    (out_dir / "report.md").write_text("\n".join(lines), encoding="utf-8")


def write_csv(out_dir: Path, rows: list[tuple[str, str, str, str]]) -> None:
    with (out_dir / "keywords.csv").open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["keyword", "engine", "method", "seed"])
        for row in rows:
            writer.writerow(row)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Harvest Google/YouTube autocomplete phrases for video titles (recovery app)."
    )
    parser.add_argument("--seed-file", metavar="FILE", default=None,
                        help="seeds to use (default: seeds.txt here)")
    parser.add_argument("--max-seeds", metavar="N", type=int, default=0,
                        help="only the first N seeds (0 = all)")
    parser.add_argument("--expand", choices=["none", "letters"], default="letters",
                        help="skip the a–z expansion (base phrases only)")
    parser.add_argument("--no-prefixes", action="store_true",
                        help="skip the six lead-in queries")
    parser.add_argument("--sources", default="google,youtube",
                        help="comma-separated: google, youtube")
    parser.add_argument("--delay", metavar="SECONDS", type=float, default=0.8,
                        help="gap between requests (default 0.8)")
    parser.add_argument("--out-dir", metavar="DIR", default=None,
                        help="where report.md / keywords.csv land (default: results/ here)")
    parser.add_argument("--known-file", metavar="FILE", default=None,
                        help="KEYWORDS.md location, for the already-known marking")
    parser.add_argument("--quick", action="store_true",
                        help="test mode: 3 seeds, letters on, prefixes off, 0.4s delay")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    seed_file = Path(args.seed_file) if args.seed_file else script_dir / "seeds.txt"
    out_dir = Path(args.out_dir) if args.out_dir else script_dir / "results"
    sources = [s.strip() for s in args.sources.split(",") if s.strip()]

    if args.known_file:
        known_file = Path(args.known_file)
    else:
        known_file = None
        for candidate in (
            script_dir.parents[3] / "KEYWORDS.md",   # repo root
            script_dir.parents[2] / "KEYWORDS.md",   # TurnSomeDayIntoOneday/
            Path("KEYWORDS.md"),
        ):
            if candidate.exists():
                known_file = candidate
                break
    known_terms = load_known_terms(known_file) if known_file else set()

    seeds = load_seeds(seed_file)
    max_seeds = 3 if args.quick else args.max_seeds
    if max_seeds and max_seeds > 0:
        seeds = seeds[:max_seeds]
    if not seeds:
        print(f"No seeds in {seed_file} — nothing to do.")
        return 1

    expand = args.expand == "letters"
    prefixes = not args.no_prefixes
    delay = 0.4 if args.quick else args.delay

    rows: list[tuple[str, str, str, str]] = []   # (keyword, engine, method, seed)
    failures: list[tuple[str, str]] = []
    sent = {"google": 0, "youtube": 0}
    answered = {"google": 0, "youtube": 0}
    attempted = {"google": False, "youtube": False}
    seen: set[tuple[str, str, str, str]] = set()

    total_queries = len(seeds) * len(queries_for(seeds[0], expand, prefixes)) * len(sources)
    print(f"Seeds: {len(seeds)} — {total_queries} queries across {', '.join(sources)} "
          f"(delay {delay}s). Ctrl-C to stop; nothing is written until the end.")

    for i, seed in enumerate(seeds, 1):
        print(f"[{i}/{len(seeds)}] {seed}")
        for method, query in queries_for(seed, expand, prefixes):
            for engine in sources:
                attempted[engine] = True
                time.sleep(delay)
                completed, suggestions = fetch(engine, query)
                if not completed:
                    failures.append((engine, query))
                    continue
                sent[engine] += 1
                if not suggestions:
                    failures.append((engine, query))
                    continue
                answered[engine] += 1
                for suggestion in suggestions:
                    key = (normalize(suggestion), engine, method, seed)
                    if key in seen:
                        continue
                    seen.add(key)
                    rows.append((suggestion.strip(), engine, method, seed))

    rows.sort(key=lambda r: (normalize(r[0]), r[1], r[2], r[3]))

    def unique_count(rs: list[tuple[str, str, str, str]]) -> int:
        return len({normalize(r[0]) for r in rs})

    if known_terms:
        new_rows = [r for r in rows if normalize(r[0]) not in known_terms]
        known_rows = [r for r in rows if normalize(r[0]) in known_terms]
        n_new, n_known = unique_count(new_rows), unique_count(known_rows)
    else:
        new_rows, known_rows, n_new, n_known = rows, [], unique_count(rows), 0

    out_dir.mkdir(parents=True, exist_ok=True)
    write_report(out_dir, seeds, attempted, sent, answered, new_rows, known_rows,
                 n_new, n_known, failures, known_file)
    write_csv(out_dir, rows)

    print(f"\nDone. Queries sent: {sent['google']} (google)"
          + (f", {sent['youtube']} (youtube)" if attempted["youtube"] else "")
          + f". Phrases: {len(rows)} rows ({n_new} unique new, {n_known} unique already in KEYWORDS.md)."
          + (f" {len(failures)} queries returned nothing." if failures else ""))
    print(f"Report: {out_dir / 'report.md'}")
    print(f"CSV:    {out_dir / 'keywords.csv'}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted — no report written.")
        sys.exit(130)