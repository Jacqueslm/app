#!/usr/bin/env python3
# Rebuild content/relationship-profiles.json from the Relationships PDF.
# pypdf is not installed system-wide; run with:
#   python3 -m pip install --target /tmp/pylibs pypdf
#   PYTHONPATH=/tmp/pylibs python3 tools/relationship-profiles.py
# One profile per period pair, read from the PDF's own text layer: title,
# best/worst categories, and the reading, keyed '<period index>|<period index>'.
import re,json
from pypdf import PdfReader
APP=open('TurnSomeDayIntoOneday/key.html').read()
i=APP.index('const PERIODS = ['); j=APP.index('\n];',i)
PER=[]
for m in re.finditer(r'\{n:"([^"]+)", t:"([^"]*)"', APP[i:j]):
    PER.append((m.group(1),m.group(2)))
def norm(x): return re.sub(r'[^A-Z]','',x.upper())
TITLE={norm(t):n for n,t in PER}
NAME={norm(n):n for n,_ in PER}
ORDER={n:k for k,(n,_) in enumerate(PER)}
r=PdfReader('704811944-The-Secret-Language-of-Relationships.pdf'); pages=r.pages
lines=[]
for n in range(215,829):
    t=pages[n].extract_text() or ''
    lines += [l.strip() for l in t.split('\n')]
H=re.compile(r'^THE (WEEK OF|CUSP OF) (.+)$')
starts=[]
for k,l in enumerate(lines):
    m=H.match(l)
    if not m: continue
    per=None
    for d in range(1,4):
        if k+d<len(lines):
            cand=norm(lines[k+d])
            if cand in NAME: per=NAME[cand]; break
    if not per:
        per=TITLE.get(norm(l))
    if per: starts.append((k,per))
print('header starts',len(starts),'unique periods',len(set(p for _,p in starts)))
out={}; skipped=0
for si,(k,p1) in enumerate(starts[:-1]):
    k2,p2=starts[si+1]
    if p1==p2: skipped+=1; continue
    block=lines[k:k2]
    # title after the period-name line
    ti=None
    for x,l in enumerate(block[1:12],1):
        if norm(l) in NAME or not l: continue
        if re.fullmatch(r'RELATIONSHIPS?', l, re.I): continue
        if re.fullmatch(r'[A-Z0-9 .,\'’&/\-]+', l): continue
        if 2<len(l)<=70: ti=x; break
    if ti is None: skipped+=1; continue
    body='\n'.join(block[ti+1:])
    body=re.split(r"(?i)\b(AD'?VICE|STRENGTHS)\s*[:.]", body)[0]
    body=' '.join(body.split('\n')); body=re.sub(r'(\w)-\s+(\w)',r'\1\2',body); body=re.sub(r'\s+',' ',body).strip()
    seg=' '.join(block)
    bm=re.search(r'(?i)\bbest\s*[:.]\s*([A-Z][A-Z ,\-/]*)', seg); wm=re.search(r'(?i)\bworst\s*[:.]\s*([A-Z][A-Z ,\-/]*)', seg)
    key=(min(ORDER[p1],ORDER[p2]),max(ORDER[p1],ORDER[p2]))
    if key in out or len(body.split())<80: skipped+=1; continue
    out[key]={'t':block[ti],'best':(bm.group(1).strip(' -,') if bm else ''),'worst':(wm.group(1).strip(' -,') if wm else ''),'body':body,'a':p1,'b':p2}
print('pairs',len(out),'skipped',skipped,'missing',1176-len(out))
for k in list(out)[:3]:
    v=out[k]; print('---',v['a'],'x',v['b'],'|',v['t'],'|',v['best'],'|',v['worst'],'|',len(v['body'].split()),'words'); print('  ',v['body'][:200])
json.dump({f'{a}|{b}':v for (a,b),v in out.items()},open('/tmp/pairpage.json','w'),ensure_ascii=False)
print('words',sum(len(v['body'].split()) for v in out.values()))
