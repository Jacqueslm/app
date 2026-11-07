#!/usr/bin/env python3
# Rebuild content/relationship-profiles.json from the Relationships PDF.
# pypdf is not installed system-wide; run with:
#   python3 -m pip install --target /tmp/pylibs pypdf
#   PYTHONPATH=/tmp/pylibs python3 tools/relationship-profiles.py [out.json]
#
# Each scanned sheet carries two pair entries, stacked. An entry opens with two
# header blocks -- one per period -- and the pair title usually sits between
# them, so the reading order is:
#
#     March 19-24 / THE CUSP OF REBIRTH / PISCES-ARIES CUSP
#     Star Wars                                  <- the pair title
#     April 19-24 / THE CUSP OF POWER / ARIES-TAURUS CUSP
#     Power struggles may endanger ...           <- the reading
#
# The key comes from the two headers, never from the position of the next
# page, so an entry at a section break cannot be keyed to its neighbour's first
# week. Same-week pages the book prints (Aries I with Aries I) are included;
# they are the extra 48 that take 1,128 distinct pairs to the book's 1,176.
# The committed JSON is this pass merged over the previously verified pairs:
# the older extraction is kept wherever it already had a page, and only the
# entries it missed are filled in from this parse.
import re, json, itertools, difflib, sys
from pypdf import PdfReader

OUT = sys.argv[1] if len(sys.argv) > 1 else 'content/relationship-profiles.json'
APP = open('TurnSomeDayIntoOneday/key.html', encoding='utf-8').read()
i = APP.index('const PERIODS = ['); j = APP.index('\n];', i)
PER = [(m.group(1), m.group(2)) for m in re.finditer(r'\{n:"([^"]+)", t:"([^"]*)"', APP[i:j])]

def norm(x): return re.sub(r'[^A-Z]', '', x.upper())

NAME = {norm(n): k for k, (n, _) in enumerate(PER)}
TITLE = {norm(t): k for k, (n, t) in enumerate(PER)}
VOCAB = list(NAME) + [t for t in TITLE if t not in NAME]

H = re.compile(r'THE\s+(WEEK|CUSP)\s+O[FE]\s+(.+)$')
MONTH = re.compile(r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\b')
SKIP = re.compile(r"^(\^?\s*RELATIONS\w*|Page\s*\d+|\d+)$", re.I)
CAPS = re.compile(r"[A-Z0-9 .,'’&/\-]+")

def is_header(line):
    return bool(H.search(line)) and len(line) <= 42 and line.count(' ') <= 6

def resolve(lines, k):
    """Period for the header at k, plus the index of the line naming it."""
    for d in (1, 2, 3):
        if k + d < len(lines):
            c = norm(lines[k + d])
            if c in NAME:
                return NAME[c], k + d
    head = norm(H.search(lines[k]).group(0))
    if head in TITLE:
        return TITLE[head], k
    for d in (0, 1, 2, 3):
        if k + d >= len(lines):
            break
        w = norm(lines[k + d])
        if len(w) < 6:
            continue
        near = difflib.get_close_matches(w, VOCAB, n=1, cutoff=0.86)
        if near:
            m = near[0]
            return (NAME.get(m) if m in NAME else TITLE.get(m)), k + d
    return None, None

def title_line(lines, start, end):
    for x in range(start, min(end, len(lines))):
        line = lines[x]
        if not line or SKIP.match(line) or MONTH.search(line):
            continue
        if CAPS.fullmatch(line) or norm(line) in NAME:
            continue
        if 2 < len(line) <= 70:
            return x
    return None

def tidy(text):
    text = re.sub(r'\s*\^\s*RELATIONSHIPS?\s*\^\s*', ' ', text)
    text = ' '.join(text.split('\n'))
    text = re.sub(r'(\w)-\s+(\w)', r'\1\2', text)
    return re.sub(r'\s+', ' ', text).strip()

reader = PdfReader('704811944-The-Secret-Language-of-Relationships.pdf')
entries = []
for pno in range(200, min(836, len(reader.pages))):
    ls = [l.strip() for l in (reader.pages[pno].extract_text() or '').split('\n')]
    n = len(ls)
    for k in range(n):
        if not is_header(ls[k]):
            continue
        p, pe = resolve(ls, k)
        if p is None:
            continue
        q = qe = None
        for d in range(pe - k + 1, 9):
            if k + d >= n:
                break
            if is_header(ls[k + d]):
                q2, q2e = resolve(ls, k + d)
                if q2 is not None and len(' '.join(ls[pe + 1:k + d]).split()) < 22:
                    q, qe = q2, q2e
                    break
        if q is None:
            continue
        entries.append((pno + 1, k, p, q, pe, qe, ls))

profiles = {}
for idx, (pno, k, a, b, pe, qe, ls) in enumerate(entries):
    n = len(ls)
    chunk_end = entries[idx + 1][1] if idx + 1 < len(entries) and entries[idx + 1][0] == pno else n
    pre_title = title_line(ls, pe + 1, qe)          # title between the two headers
    if pre_title is not None:
        ti, body_start = pre_title, qe + 1
    else:
        ti = title_line(ls, qe + 1, chunk_end)      # title after both headers
        body_start = ti + 1 if ti is not None else None
    if ti is None or body_start is None:
        continue
    body = re.split(r"(?i)\b(AD'?VICE|STRENGTHS)\s*[:.]", '\n'.join(ls[body_start:chunk_end]))[0]
    body = tidy(body)
    if len(body.split()) < 80:
        continue
    seg = ' '.join(ls[qe + 1:chunk_end])
    bm = re.search(r'\bBEST\s*[:.]\s*([A-Z][A-Z ,\-/]{1,40})', seg)
    wm = re.search(r'\bWORST\s*[:.]\s*([A-Z][A-Z ,\-/]{1,40})', seg)
    rec = {'t': ls[ti], 'best': (bm.group(1).strip(' -,') if bm else ''),
           'worst': (wm.group(1).strip(' -,') if wm else ''),
           'body': body, 'a': a, 'b': b}
    key = (min(a, b), max(a, b))
    if key in profiles and len(profiles[key]['body']) >= len(body):
        continue
    profiles[key] = rec

out = {f'{a}|{b}': v for (a, b), v in profiles.items()}
json.dump(out, open(OUT, 'w'), ensure_ascii=False)
allp = set(itertools.combinations(range(len(PER)), 2))
have = set(profiles)
print('entries seen', len(entries), 'profiles', len(out),
      'distinct', len(have & allp), 'of', len(allp),
      'self', sum(1 for a, b in have if a == b), 'of', len(PER))
print('missing distinct', len(allp - have), '| words', sum(len(v['body'].split()) for v in profiles.values()))
