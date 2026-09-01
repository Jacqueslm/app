# Pull every number the PDF quotes straight from the two scraped files, so the
# report cannot drift from the data it claims to be built on.
import csv, re, json
from collections import Counter

REV='scraper-output/reviews-top25.csv'
META='scraper-output/apps-metadata.csv'
rows=list(csv.DictReader(open(REV,encoding='utf-8',errors='replace')))
meta=list(csv.DictReader(open(META,encoding='utf-8',errors='replace')))

STOP=set('''the a an and or but if of to in on for with is it this that i you my me we they he she at as
be been am are was were do does did so not no very really just too much more most other some any can will
would could should have has had get got make makes made use using used app apps its it's im i'm ive i've
dont don't cant can't thats that's there here about from than then when what which who how all out up down
over again also only even still one two your their them our us because being what's want need able'''.split())
def toks(t): return [w for w in re.findall(r"[a-z']+", (t or '').lower()) if len(w)>2 and w not in STOP]

def ngrams(rs,n):
    c=Counter()
    for r in rs:
        w=toks(r['text'])
        c.update(' '.join(w[i:i+n]) for i in range(len(w)-n+1))
    return c

low=[r for r in rows if (r['score'] or '').strip() in ('1','2')]
D={}
D['reviews']=len(rows)
D['apps']=len(set(r['appTitle'] for r in rows))
D['meta_apps']=len(meta)
D['low']=len(low)
D['bi_all']=ngrams(rows,2).most_common(24)
D['bi_low']=ngrams(low,2).most_common(18)
D['uni']=ngrams(rows,1).most_common(24)
price=re.compile(r'subscription|paywall|pay wall|expensive|free version|free trial|refund|charge|too expensive',re.I)
pm=[r for r in rows if price.search(r['text'] or '')]
D['price_n']=len(pm)
D['price_pct']=round(100*len(pm)/len(rows))
D['price_low']=sum(1 for r in pm if (r['score'] or '').strip() in ('1','2'))
D['price_low_pct']=round(100*D['price_low']/len(pm))
D['app_list']=sorted(set(r['appTitle'] for r in rows))
# words used in competitor Play titles - straight ASO signal
tw=Counter()
for m in meta:
    for w in re.findall(r"[a-z]+", (m['title'] or '').lower()):
        if len(w)>2 and w not in STOP: tw[w]+=1
D['title_words']=tw.most_common(22)
D['genres']=Counter(m['genre'] for m in meta).most_common(6)
json.dump(D,open('/tmp/claude-0/-home-user-app/453451a7-47bf-524d-b141-0975730740ac/scratchpad/kw/data.json','w'))
print('reviews',D['reviews'],'| apps',D['apps'],'| meta',D['meta_apps'],'| price mentions',D['price_n'],f"({D['price_pct']}%)")
print('top title words:',', '.join(w for w,_ in D['title_words'][:12]))
