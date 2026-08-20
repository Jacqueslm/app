#!/usr/bin/env python3
"""Business card in the same house style as the partner cards.

Same gradient, same real app icon, same Liberation Sans, same
FREE · NO CARD / TURN SOMEDAY INTO DAY ONE foot. The front carries the
line from card 15; the back is card 16 broken out into the list of what
costs nothing, plus a QR to the site.

3.5 x 2in trim, 0.125in bleed, 300dpi.
"""
import os, segno
from PIL import Image, ImageDraw, ImageFont

HERE=os.path.dirname(os.path.abspath(__file__))
ICON=os.path.join(HERE,"icon-512.png")

DPI=300
TRIM_W,TRIM_H=int(3.5*DPI),int(2*DPI)
BLEED=int(0.125*DPI)
W,H=TRIM_W+2*BLEED,TRIM_H+2*BLEED
SAFE=BLEED+int(0.125*DPI)

# straight from make-partner-cards.py
BG_TOP=(26,20,62); BG_BOT=(12,10,32)
INK=(255,255,255); SUB=(168,160,208); FOOT=(110,104,150); FREE=(150,214,176)
BOLD="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
REG="/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
def fb(s): return ImageFont.truetype(BOLD,s)
def fr(s): return ImageFont.truetype(REG,s)

def grad(w,h):
    im=Image.new("RGB",(w,h)); d=ImageDraw.Draw(im)
    for y in range(h):
        t=y/(h-1)
        d.line([(0,y),(w,y)],fill=tuple(round(BG_TOP[i]+(BG_BOT[i]-BG_TOP[i])*t) for i in range(3)))
    return im

def tracked(d,text,font,tracking,cx,y,fill):
    ws=[d.textlength(c,font=font) for c in text]
    x=cx-(sum(ws)+tracking*(len(text)-1))/2
    for c,w in zip(text,ws):
        d.text((x,y),c,font=font,fill=fill); x+=w+tracking

def icon(im,cx,cy,size):
    ic=Image.open(ICON).convert("RGBA").resize((size,size),Image.LANCZOS)
    im.paste(ic,(int(cx-size/2),int(cy-size/2)),ic)

def foot(im,d):
    """The same two lines that close every card we make."""
    tracked(d,"FREE  ·  NO CARD",fb(21),5.5,W/2,H-SAFE-58,FREE)
    tracked(d,"TURN SOMEDAY INTO DAY ONE",fr(18),4.5,W/2,H-SAFE-26,FOOT)

def guides(img,name):
    g=img.copy(); d=ImageDraw.Draw(g)
    d.rectangle([BLEED,BLEED,W-BLEED-1,H-BLEED-1],outline=(255,0,0),width=2)
    d.rectangle([SAFE,SAFE,W-SAFE-1,H-SAFE-1],outline=(0,200,255),width=2)
    g.save(name)

# ─── FRONT: card 15, the line that says who made it and why ───
front=grad(W,H); d=ImageDraw.Draw(front)
icon(front,W/2,SAFE+74,76); d=ImageDraw.Draw(front)
y=SAFE+146
for ln in ["Built by someone who was","addicted for 38 years."]:
    d.text((W/2,y),ln,font=fb(44),fill=INK,anchor="ma"); y+=54
y+=26
d.text((W/2,y),"Free, because that's what I needed",font=fr(24),fill=SUB,anchor="ma"); y+=32
d.text((W/2,y),"and couldn't afford.",font=fr(24),fill=SUB,anchor="ma")
foot(front,d)
front.save("card-front.png"); guides(front,"card-front-GUIDES.png")

# ─── BACK: card 16, broken out — what costs nothing, and the QR ───
back=grad(W,H); d=ImageDraw.Draw(back)
QS=252; PAD=18
segno.make("https://www.turnsomedayintodayone.com",error='h')\
     .save("_qr.png",scale=20,border=4,dark="#0c0a20",light="#ffffff")
qi=Image.open("_qr.png").convert("RGB").resize((QS,QS),Image.LANCZOS)
tile=Image.new("RGB",(QS+PAD*2,QS+PAD*2),(255,255,255))
tile.paste(qi,(PAD,PAD))
qx,qy=SAFE+6,SAFE+46
back.paste(tile,(qx,qy))
d.text((qx+tile.width/2,qy+tile.height+14),"Scan to open it",font=fr(21),fill=SUB,anchor="ma")

tx=qx+tile.width+52
d.text((tx,SAFE+42),"What costs nothing:",font=fb(30),fill=INK)
y=SAFE+92
for ln in ["The day counter.","The panic button.","The daily lessons.","The private journal.",
           "Someone to talk to at 2am."]:
    d.text((tx,y),ln,font=fr(25),fill=SUB); y+=34
d.line([tx,y+16,W-SAFE-10,y+16],fill=(58,50,102),width=2)
d.text((tx,y+34),"Jacques Malone  ·  Founder",font=fb(23),fill=INK)
d.text((tx,y+66),"turnsomedayintodayone.com",font=fr(23),fill=SUB)
foot(back,d)
back.save("card-back.png"); guides(back,"card-back-GUIDES.png")
os.remove("_qr.png")
print("built",front.size)
