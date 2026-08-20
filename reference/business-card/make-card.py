from PIL import Image, ImageDraw, ImageFont
import segno, os, math

F="/mnt/skills/examples/canvas-design/canvas-fonts/"
def f(n,s): return ImageFont.truetype(F+n,s)
BOLD="WorkSans-Bold.ttf"; REG="WorkSans-Regular.ttf"

DPI=300
TRIM_W,TRIM_H=int(3.5*DPI),int(2*DPI)
BLEED=int(0.125*DPI)
W,H=TRIM_W+2*BLEED,TRIM_H+2*BLEED
SAFE=BLEED+int(0.125*DPI)

BRAND=(15,12,41); ACCENT=(83,74,183); GREEN=(126,232,162)
WHITE=(255,255,255); MUTED=(150,147,178)
PAPER=(250,249,247); INK=(24,22,45); GREY=(100,97,120)

SS=4  # supersample the logo for clean curves

def tracked(d,y,text,font,fill,track,cx):
    ws=[d.textlength(c,font=font) for c in text]
    x=cx-(sum(ws)+track*(len(text)-1))/2
    for c,w in zip(text,ws):
        d.text((x,y),c,font=font,fill=fill); x+=w+track

def logo(base,cx,cy,size):
    """App mark: rounded square, green keyline, white lemniscate."""
    S=size*SS
    tile=Image.new("RGBA",(int(S),int(S)),(0,0,0,0))
    d=ImageDraw.Draw(tile)
    d.rounded_rectangle([0,0,S-1,S-1],radius=S*0.30,fill=ACCENT,
                        outline=GREEN,width=max(4,int(S*0.045)))
    # Lemniscate of Gerono, stroked by stamping discs along the path.
    a=S*0.255; b=S*0.175; lw=S*0.085; ccx=ccy=S/2
    for i in range(900):
        t=2*math.pi*i/900
        x=ccx+a*math.cos(t); y=ccy+b*math.sin(2*t)/1.0
        d.ellipse([x-lw/2,y-lw/2,x+lw/2,y+lw/2],fill=WHITE)
    tile=tile.resize((int(size),int(size)),Image.LANCZOS)
    base.paste(tile,(int(cx-size/2),int(cy-size/2)),tile)

def guides(img,name):
    g=img.copy(); d=ImageDraw.Draw(g)
    d.rectangle([BLEED,BLEED,W-BLEED-1,H-BLEED-1],outline=(255,0,0),width=2)
    d.rectangle([SAFE,SAFE,W-SAFE-1,H-SAFE-1],outline=(0,200,255),width=2)
    g.save(name)

# ── FRONT ──
front=Image.new("RGB",(W,H),BRAND); d=ImageDraw.Draw(front); cx=W//2
logo(front,cx,BLEED+158,124); d=ImageDraw.Draw(front)
tracked(d,BLEED+244,"TURN SOMEDAY INTO DAY ONE",f(BOLD,25),GREEN,4.5,cx)
d.text((cx,BLEED+312),"No pressure. No worries.",font=f(BOLD,47),fill=WHITE,anchor="ma")
d.text((cx,BLEED+373),"Just progress.",font=f(BOLD,47),fill=WHITE,anchor="ma")
d.text((cx,BLEED+464),"turnsomedayintodayone.com",font=f(REG,28),fill=MUTED,anchor="ma")
front.save("card-front.png"); guides(front,"card-front-GUIDES.png")

# ── BACK ──
back=Image.new("RGB",(W,H),PAPER); d=ImageDraw.Draw(back)
QS=292; QZ=4
segno.make("https://www.turnsomedayintodayone.com",error='h')\
     .save("_qr.png",scale=20,border=QZ,dark="#0f0c29",light="#faf9f7")
qi=Image.open("_qr.png").convert("RGB").resize((QS,QS),Image.LANCZOS)
qx,qy=SAFE-4,SAFE+52
back.paste(qi,(qx,qy))
d.text((qx+QS//2,qy+QS+8),"Scan it",font=f(BOLD,25),fill=GREY,anchor="ma")

tx=qx+QS+50
d.text((tx,SAFE+58),"Free to start.",font=f(BOLD,45),fill=INK)
d.text((tx,SAFE+112),"No card, no trial.",font=f(BOLD,45),fill=INK)
y=SAFE+190
for line in ["A day counter that doesn't shame you.",
             "A button for the worst ten minutes.",
             "A lesson a day. A private journal.",
             "Someone to talk to at 2am."]:
    d.text((tx,y),line,font=f(REG,25),fill=GREY); y+=37
d.line([tx,y+14,W-SAFE-14,y+14],fill=(220,217,229),width=2)
d.text((tx,y+32),"Jacques Malone  ·  St. Louis, MO",font=f(BOLD,24),fill=INK)
d.text((tx,y+66),"turnsomedayintodayone.com",font=f(REG,24),fill=GREY)
back.save("card-back.png"); guides(back,"card-back-GUIDES.png")
os.remove("_qr.png")
print("OK",front.size)
