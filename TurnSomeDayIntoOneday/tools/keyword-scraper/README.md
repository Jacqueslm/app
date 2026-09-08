# Keyword scraper — Google autocomplete

Harvests phrases people actually type, to mine for YouTube long-form video
titles for the recovery app. Two engines, both free, no API key:

- **Google autocomplete** — works from most networks.
- **YouTube autocomplete** — often blocked from cloud/datacenter networks. When
  it returns nothing the report says so; it never fakes an answer.

Python 3 only (stdlib). Nothing to install.

## Why this exists

Semrush ended 15 Aug 2026 — nothing new can be pulled from it, and
`KEYWORDS.md` (repo root) is final and must not be re-estimated. This tool is
the replacement idea-stream: it records what people actually type into Google,
which is the same raw material video titles are built from. It does **not**
replace `KEYWORDS.md` and does not add volumes — read that file's rules before
writing a title from these results.

## Run it

From this folder:

```bash
# test run, ~1 minute, 3 seeds
python3 scrape_keywords.py --quick

# full run — all seeds in seeds.txt, Google + YouTube, ~10–15 minutes
python3 scrape_keywords.py

# Google only, first 6 seeds
python3 scrape_keywords.py --sources google --max-seeds 6
```

## What it sends

For every seed it queries the base phrase, the base + each letter `a`–`z`
(`how to stop drinking a…` → surfaces long-tail completions), and six
lead-ins (`how to`, `why do i`, `what happens`, `is it`, `does`, `best` —
a lead-in is skipped when the seed already starts with it). That is ~33
requests per seed per engine, spaced `--delay` seconds apart (0.8s default —
keep it gentle so Google doesn't block the run).

## What comes out

Written to `results/` (throwaway — delete freely):

- `report.md` — new phrases grouped and tabled, marked against `KEYWORDS.md`
  so fresh finds stand out, plus anything that failed to answer.
- `keywords.csv` — same data, one row per phrase: `keyword, engine, method, seed`.

## The honest limits (baked in)

- **No volumes, no difficulty scores.** The report never invents a number.
  Semrush is gone; a phrase with no number is not proof it has no demand.
- A phrase **not in KEYWORDS.md is not proof it is unclaimed** — apply that
  file's Build / Too hard / Skip tags yourself when picking titles.
- Raw search phrasing includes brands and navigational terms (`al anon`,
  `i am sober app`). The scraper reports; KEYWORDS.md's rules decide.
- YouTube's endpoint is frequently blocked from cloud networks. Run the same
  command from a home connection if `report.md` says YouTube returned nothing.

## Options

```
--seed-file FILE   seeds to use (default: seeds.txt here)
--max-seeds N      only the first N seeds (0 = all)
--expand none      skip the a–z expansion (base phrases only)
--no-prefixes      skip the six lead-in queries
--sources google[,youtube]
--delay SECONDS    gap between requests (default 0.8)
--out-dir DIR      where report.md / keywords.csv land
--known-file FILE  KEYWORDS.md location, for the already-known marking
--quick            test mode: 3 seeds, letters on, prefixes off, 0.4s delay
```