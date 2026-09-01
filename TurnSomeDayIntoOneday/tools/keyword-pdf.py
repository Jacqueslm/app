# -*- coding: utf-8 -*-
import csv, json, re
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether, CondPageBreak)

D=json.load(open('/tmp/claude-0/-home-user-app/453451a7-47bf-524d-b141-0975730740ac/scratchpad/kw/data.json'))
OUT='/home/user/app/TurnSomeDayIntoOneday/store-listing/KEYWORD-RESEARCH.pdf'

INK=colors.HexColor('#14161d'); MUTE=colors.HexColor('#5f6478')
ACC=colors.HexColor('#534AB7'); GRN=colors.HexColor('#1f7a4d')
RED=colors.HexColor('#a8324a'); RULE=colors.HexColor('#d8dae4')
BG=colors.HexColor('#f2f3f7')

def S(n,**k):
    d=dict(fontName='Helvetica',fontSize=9.5,leading=13.5,textColor=INK,alignment=TA_LEFT)
    d.update(k); return ParagraphStyle(n,**d)
H1=S('h1',fontName='Helvetica-Bold',fontSize=21,leading=24,spaceAfter=2)
SUB=S('sub',fontSize=9.5,leading=13,textColor=MUTE,spaceAfter=14)
H2=S('h2',fontName='Helvetica-Bold',fontSize=13,leading=16,spaceBefore=16,spaceAfter=5,textColor=ACC)
H3=S('h3',fontName='Helvetica-Bold',fontSize=10,leading=13,spaceBefore=9,spaceAfter=3)
BODY=S('body',spaceAfter=6)
SMALL=S('small',fontSize=8.5,leading=11.5,textColor=MUTE)
EYE=S('eye',fontName='Helvetica-Bold',fontSize=7.5,leading=10,textColor=MUTE)

def page(c,doc):
    c.saveState()
    c.setFont('Helvetica',7.5); c.setFillColor(MUTE)
    c.drawString(0.75*inch,0.5*inch,'Turn Someday Into Day One  ·  Keyword & Search-Term Research  ·  1 Sep 2026')
    c.drawRightString(LETTER[0]-0.75*inch,0.5*inch,'Page %d'%doc.page)
    c.setStrokeColor(RULE); c.setLineWidth(0.5)
    c.line(0.75*inch,0.68*inch,LETTER[0]-0.75*inch,0.68*inch)
    c.restoreState()

doc=BaseDocTemplate(OUT,pagesize=LETTER,leftMargin=0.75*inch,rightMargin=0.75*inch,
                    topMargin=0.7*inch,bottomMargin=0.8*inch,
                    title='Keyword & Search-Term Research',author='Turn Someday Into Day One')
doc.addPageTemplates([PageTemplate(id='n',frames=[Frame(doc.leftMargin,doc.bottomMargin,
    doc.width,doc.height,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=page)])
W=doc.width
E=[]

def note(txt,col=BG,bar=ACC):
    t=Table([[Paragraph(txt,S('n',fontSize=9,leading=12.5))]],colWidths=[W])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),col),('LEFTPADDING',(0,0),(-1,-1),10),
        ('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),8),
        ('BOTTOMPADDING',(0,0),(-1,-1),8),('LINEBEFORE',(0,0),(0,-1),2.5,bar)]))
    return t

def tbl(head,rows,widths,align=None):
    data=[[Paragraph('<b>%s</b>'%h,S('th',fontSize=8,leading=10,textColor=colors.white)) for h in head]]
    for r in rows:
        data.append([Paragraph(str(c),S('td',fontSize=8.5,leading=11)) for c in r])
    t=Table(data,colWidths=widths,repeatRows=1)
    st=[('BACKGROUND',(0,0),(-1,0),INK),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),
        ('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4),
        ('LINEBELOW',(0,1),(-1,-1),0.4,RULE)]
    for i in range(1,len(data)):
        if i%2==0: st.append(('BACKGROUND',(0,i),(-1,i),colors.HexColor('#fafbfc')))
    t.setStyle(TableStyle(st)); return t

# ── cover ────────────────────────────────────────────────────────────────────
E.append(Paragraph('Keyword &amp; Search-Term Research',H1))
E.append(Paragraph('Turn Someday Into Day One &nbsp;·&nbsp; 1 September 2026 &nbsp;·&nbsp; built from live search research and %s scraped competitor reviews'%f"{D['reviews']:,}",SUB))

E.append(note('<b>Read this before you use any number in here.</b><br/><br/>'
 '<b>Semrush returned no data.</b> The account is active but has no API units left, so there '
 'are <b>no search volumes anywhere in this report</b>. Every figure you see is counted from '
 'your own scraped files or came from published research, and each one says where it came from. '
 'Nothing is estimated. Top up at <b>semrush.com/mcp-access</b> and the volumes can be filled in '
 'against the companion file <b>KEYWORDS.csv</b>, which is built to take them.',
 colors.HexColor('#fdf2f2'),RED))

E.append(Paragraph('WHAT WENT INTO THIS',EYE))
E.append(Spacer(1,4))
src=[['Live web research','Google, TikTok, Reddit and AI-search behaviour, Sep 2026'],
     ['Your review scrape','%s reviews across %d apps (scraper-output/reviews-top25.csv)'%(f"{D['reviews']:,}",D['apps'])],
     ['Your app scrape','%d Play Store listings (scraper-output/apps-metadata.csv)'%D['meta_apps']],
     ['Your site','46 live pages audited for coverage'],
     ['Semrush','<font color="#a8324a">nothing — out of API units</font>']]
E.append(tbl(['Source','What it gave'],src,[1.5*inch,W-1.5*inch]))

# ── 1 the shift ──────────────────────────────────────────────────────────────
E.append(Paragraph('1. The shift that matters most',H2))
E.append(Paragraph('A Google search averages <b>3.4 words</b>. A ChatGPT prompt averages about '
 '<b>60</b>. People now paste their whole situation in and expect an answer back, and Google\'s '
 'AI Overviews trigger <i>more</i> often on long, question-shaped queries — not fewer.',BODY))
E.append(Paragraph('Your 46 pages are written for the 3.4-word world. The eight questions below '
 'are the shape people actually type now. None of them has a page.',BODY))
ai=[['how do I stop drinking without going to AA','Your app is the non-AA answer. Nothing says so.'],
    ['is it normal to still want to drink after a month sober','Tower floors 21 and 25 already answer this.'],
    ['free app to count days sober without a subscription','Your free tier is the differentiator.'],
    ['how to help someone who doesn\'t want help','Big supporter question, no page.'],
    ['what do I do at 2am when I want to relapse','SOS exists in-app but nothing is indexable.'],
    ['my partner says they will stop but they never do','partner-drinks.html is close, wrong phrasing.'],
    ['how do I know if I am an alcoholic or just drink a lot','Only the partner angle is covered.'],
    ['what happens to your body when you quit drinking day by day','<font color="#1f7a4d">Covered — your strongest AI page.</font>']]
E.append(tbl(['The question people type','Where you stand'],ai,[3.5*inch,W-3.5*inch]))

# ── 2 review language ────────────────────────────────────────────────────────
E.append(CondPageBreak(3.4*inch))
E.append(Paragraph('2. What real users actually say',H2))
E.append(Paragraph('Counted from your own scrape of %s reviews. This is not opinion — it is the '
 'literal frequency of two-word phrases people wrote about competitor apps.'%f"{D['reviews']:,}",BODY))
pairs=[(p,c) for p,c in D['bi_all'] if c>=10][:20]
half=(len(pairs)+1)//2
rows=[]
for i in range(half):
    a=pairs[i]; b=pairs[i+half] if i+half<len(pairs) else ('','')
    rows.append([a[0],a[1],b[0],b[1] if b[0] else ''])
E.append(tbl(['Phrase','n','Phrase','n'],rows,[2.3*inch,0.5*inch,2.3*inch,W-5.1*inch]))
E.append(Spacer(1,6))
E.append(note('<b>"screen time" is the single most common phrase in the whole scrape (50 mentions), '
 'and six of the 25 apps are screen-time apps.</b> Phone and social-media addiction are tracked '
 'inside your app and have <b>no page at all</b>. That is the widest open door in this document.'))

# ── 3 complaints ─────────────────────────────────────────────────────────────
E.append(CondPageBreak(3.4*inch))
E.append(Paragraph('3. What they complain about — your positioning',H2))
E.append(Paragraph('From the %d one- and two-star reviews. Complaints are worth more than praise: '
 'they are the sentences a competitor\'s customer types into a search box right before they leave.'%D['low'],BODY))
cl=[(p,c) for p,c in D['bi_low'] if c>=5][:14]
half=(len(cl)+1)//2
rows=[]
for i in range(half):
    a=cl[i]; b=cl[i+half] if i+half<len(cl) else ('','')
    rows.append([a[0],a[1],b[0],b[1] if b[0] else ''])
E.append(tbl(['Complaint','n','Complaint','n'],rows,[2.3*inch,0.5*inch,2.3*inch,W-5.1*inch]))
E.append(Spacer(1,6))
E.append(note('<b>%d reviews (%d%%) mention price, paywalls, subscriptions or refunds — and %d%% of '
 'those are one- or two-star.</b> "pay wall", "free version", "cancel subscription" and "free trial" '
 'all rank in the complaints. Your free tier is not a feature on a list. It is the loudest '
 'unmet demand in %s reviews of your competitors.'%(D['price_n'],D['price_pct'],D['price_low_pct'],f"{D['reviews']:,}"),
 colors.HexColor('#f0f7f2'),GRN))

# ── 4 ASO ────────────────────────────────────────────────────────────────────
E.append(CondPageBreak(3.4*inch))
E.append(Paragraph('4. Play Store title words your rivals buy',H2))
E.append(Paragraph('Counted across %d competitor Play listings. On Google Play every word in the '
 'title, short description and long description is a ranking signal — so these are the words the '
 'category is fighting over.'%D['meta_apps'],BODY))
tws=[(w,c) for w,c in D['title_words']][:18]
half=(len(tws)+1)//2
rows=[]
for i in range(half):
    a=tws[i]; b=tws[i+half] if i+half<len(tws) else ('','')
    rows.append([a[0],a[1],b[0],b[1] if b[0] else ''])
E.append(tbl(['Word in title','Apps','Word in title','Apps'],rows,[2.3*inch,0.6*inch,2.3*inch,W-5.2*inch]))

E.append(CondPageBreak(3.4*inch))
E.append(Paragraph('5. The gaps, in priority order',H2))
gaps=[['1','IWNDWYT','r/stopdrinking\'s motto — "I Will Not Drink With You Today". It is exactly what your daily pledge does. It appears nowhere on your site.'],
      ['2','Phone / screen time / social media','Top phrase in the scrape. Tracked in the app, no page.'],
      ['3','Free, no subscription','The loudest complaint about every rival. Say it out loud.'],
      ['4','"my wife drinks"','Every supporter page you have is written for a woman about a man.'],
      ['5','Gaming, shopping, work, anger','Four more tracked addictions with no page each.'],
      ['6','"quit drinking app"','The head commercial term, only hit sideways by alternative pages.'],
      ['7','Dopamine detox cluster','Rank for the words — but your spec bans brain-chemistry claims, so never write "research shows".']]
E.append(tbl(['#','Gap','Why it is worth doing'],gaps,[0.3*inch,1.7*inch,W-2.0*inch]))

E.append(CondPageBreak(3.4*inch))
E.append(Paragraph('6. The apps this was measured against',H2))
E.append(Paragraph('Worth knowing what the scrape is and is not: 25 apps, and not all of them are '
 'your competitors. Ten are direct rivals, six are screen-time apps, five are mental-health apps, '
 'and MyFitnessPal and Calm are in there too. The review language is directionally right for the '
 'category — treat the screen-time and mental-health signals as adjacent, not identical.',BODY))
apps=D['app_list']; third=(len(apps)+2)//3
rows=[]
for i in range(third):
    r=[apps[i] if i<len(apps) else '']
    r.append(apps[i+third] if i+third<len(apps) else '')
    r.append(apps[i+2*third] if i+2*third<len(apps) else '')
    rows.append(r)
E.append(tbl(['App','App','App'],rows,[W/3.0]*3))

E.append(Spacer(1,14))
E.append(Paragraph('Companion file: <b>store-listing/KEYWORDS.csv</b> — 83 terms tagged yes / NO / '
 'partial against your 46 live pages, with an empty volume column ready for Semrush once units are '
 'topped up.',SMALL))
doc.build(E)
print('built',OUT)
