#!/usr/bin/env python3
"""Business card. Two finishes, same words.

The line is the positioning: a recovery app for you AND the one who
supports you. Nothing else in this category says that, so it leads.

Back proves it - two columns, FOR YOU and FOR THEM - which is the
"tells everything" the cards do, in the shape of the brand.

3.5 x 2in trim, 0.125in bleed, 300dpi. Writes light-* and dark-*.
"""
import os, segno
from PIL import Image, ImageDraw, ImageFont

HERE=os.path.dirname(os.path.abspath(__file__))
ICON=os.path.join(HERE,"icon-512.png")
DPI=300
TRIM_W,TRIM_H=int(3.5*DPI),int(2*DPI)
BLEED=int(0.125*DPI); W,H=TRIM_W+2*BLEED,TRIM_H+2*BLEED
SAFE=BLEED+int(0.125*DPI)

BOLD="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
REG="/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
def fb(s): return ImageFont.truetype(BOLD,s)
def fr(s): return ImageFont.truetype(REG,s)

THEMES={
 "dark": dict(top=(26,20,62),bot=(12,10,32),ink=(255,255,255),sub=(168,160,208),
              foot=(110,104,150),green=(150,214,176),rule=(58,50,102),
              qr_dark="#0c0a20",qr_light="#ffffff",tile=(255,255,255)),
 "light":dict(top=(253,252,250),bot=(244,242,247),ink=(20,17,44),sub=(92,88,116),
              foot=(140,136,162),green=(46,138,90),rule=(219,215,228),
              qr_dark="#14112c",qr_light="#ffffff",tile=None),
}

def grad(t):
    im=Image.new("RGB",(W,H)); d=ImageDraw.Draw(im)
    for y in range(H):
        k=y/(H-1)
        d.line([(0,y),(W,y)],fill=tuple(round(t["top"][i]+(t["bot"][i]-t["top"][i])*k) for i in range(3)))
    return im

def tracked(d,text,font,tr,cx,y,fill):
    ws=[d.textlength(c,font=font) for c in text]
    x=cx-(sum(ws)+tr*(len(text)-1))/2
    for c,w in zip(text,ws): d.text((x,y),c,font=font,fill=fill); x+=w+tr

def tracked_l(d,text,font,tr,x,y,fill):
    for c in text:
        d.text((x,y),c,font=font,fill=fill); x+=d.textlength(c,font=font)+tr

def icon(im,cx,cy,size):
    ic=Image.open(ICON).convert("RGBA").resize((size,size),Image.LANCZOS)
    im.paste(ic,(int(cx-size/2),int(cy-size/2)),ic)

def guides(img,name):
    g=img.copy(); d=ImageDraw.Draw(g)
    d.rectangle([BLEED,BLEED,W-BLEED-1,H-BLEED-1],outline=(255,0,0),width=2)
    d.rectangle([SAFE,SAFE,W-SAFE-1,H-SAFE-1],outline=(0,200,255),width=2)
    g.save(name)

def build(key):
    t=THEMES[key]

    # ── FRONT ── the positioning, and nothing competing with it
    f=grad(t); d=ImageDraw.Draw(f)
    icon(f,W/2,SAFE+128,84); d=ImageDraw.Draw(f)
    tracked(d,"TURN SOMEDAY INTO DAY ONE",fb(20),5,W/2,SAFE+196,t["green"])
    d.text((W/2,SAFE+254),"A recovery app for you",font=fb(44),fill=t["ink"],anchor="ma")
    d.text((W/2,SAFE+308),"and the one who supports you.",font=fb(44),fill=t["ink"],anchor="ma")
    d.text((W/2,H-SAFE-70),"turnsomedayintodayone.com",font=fr(25),fill=t["sub"],anchor="ma")
    tracked(d,"FREE  ·  NO CARD",fb(20),5,W/2,H-SAFE-32,t["green"])
    f.save(f"{key}-front.png"); guides(f,f"{key}-front-GUIDES.png")

    # ── BACK ── two columns: what each person gets
    b=grad(t); d=ImageDraw.Draw(b)
    QS=224; PAD=14
    segno.make("https://www.turnsomedayintodayone.com",error='h')\
         .save("_qr.png",scale=20,border=4,dark=t["qr_dark"],light=t["qr_light"])
    qi=Image.open("_qr.png").convert("RGB").resize((QS,QS),Image.LANCZOS)
    if t["tile"]:
        tile=Image.new("RGB",(QS+PAD*2,QS+PAD*2),t["tile"]); tile.paste(qi,(PAD,PAD))
    else:
        tile=qi
    qx=SAFE+8; qy=SAFE+112
    b.paste(tile,(qx,qy))
    d.text((qx+tile.width/2,qy+tile.height+12),"Scan to open it",font=fr(19),fill=t["sub"],anchor="ma")

    x1=qx+tile.width+46
    x2=x1+322
    def col(x,head,lines):
        tracked_l(d,head,fb(19),3.5,x,SAFE+116,t["green"])
        y=SAFE+152
        for ln in lines:
            d.text((x,y),ln,font=fr(23),fill=t["sub"]); y+=31
        return y
    yA=col(x1,"FOR YOU",["The day counter.","The panic button.","The daily lessons.",
                         "The private journal.","Someone at 2am."])
    yB=col(x2,"FOR THEM",["A track written for","the person living with","someone's addiction.",
                          "","Free the same way."])
    y=max(yA,yB)+10
    d.line([x1,y,W-SAFE-8,y],fill=t["rule"],width=2)
    d.text((x1,y+18),"Jacques Malone  ·  Founder",font=fb(23),fill=t["ink"])
    d.text((x1,y+50),"turnsomedayintodayone.com",font=fr(23),fill=t["sub"])
    b.save(f"{key}-back.png"); guides(b,f"{key}-back-GUIDES.png")
    os.remove("_qr.png")

    Image.open(f"{key}-front.png").convert("RGB").save(
        f"business-card-{key}.pdf",save_all=True,
        append_images=[Image.open(f"{key}-back.png").convert("RGB")],resolution=300.0)

for k in THEMES: build(k)

# side-by-side preview sheet
pad=34
tiles=[Image.open(f"{k}-{s}.png") for k in ("light","dark") for s in ("front","back")]
sheet=Image.new("RGB",(W*2+pad*3,H*2+pad*3),(206,203,214))
for i,im in enumerate(tiles):
    r,c=divmod(i,2)
    sheet.paste(im,(pad+c*(W+pad),pad+r*(H+pad)))
sheet.save("card-preview.png")
print("built light + dark")
