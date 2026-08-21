from PIL import Image, ImageDraw, ImageFont
import segno, os

W,H=1700,2200
BG_TOP=(26,20,62); BG_BOT=(12,10,32)
INK=(255,255,255); SUB=(168,160,208); GREEN=(150,214,176); FOOT=(110,104,150)
CARD=(37,31,80)
BOLD="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
REG="/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
def fb(s):return ImageFont.truetype(BOLD,s)
def fr(s):return ImageFont.truetype(REG,s)

im=Image.new("RGB",(W,H))
d=ImageDraw.Draw(im)
for y in range(H):
    t=y/(H-1)
    d.line([(0,y),(W,y)],fill=tuple(round(BG_TOP[i]+(BG_BOT[i]-BG_TOP[i])*t) for i in range(3)))

def tracked(text,font,tr,cx,y,fill):
    ws=[d.textlength(c,font=font) for c in text]
    x=cx-(sum(ws)+tr*(len(text)-1))/2
    for c,w in zip(text,ws): d.text((x,y),c,font=font,fill=fill); x+=w+tr

ic=Image.open("icon-512.png").convert("RGBA").resize((140,140),Image.LANCZOS)
im.paste(ic,(W//2-70,100),ic)
tracked("TURN SOMEDAY INTO DAY ONE",fb(32),8,W//2,278,GREEN)
d.text((W//2,340),"The 90-Day Bootcamp",font=fb(94),fill=INK,anchor="ma")
d.text((W//2,458),"An addiction program with continuous support —",font=fr(38),fill=SUB,anchor="ma")
d.text((W//2,510),"for you, and the one who supports you.",font=fr(38),fill=SUB,anchor="ma")

phases=[
 ("PHASE 1 · DAYS 1–30","BREAK IT",
  "Learn your loop. Ride out the urges. Survive the worst ten minutes,\nover and over, until they lose. A lesson every day, written by\nsomebody who lived it — not a textbook."),
 ("PHASE 2 · DAYS 31–60","REBUILD",
  "The habit left a hole — this month fills it. Sleep, meals, money\nturning around, trust repaired by pattern instead of speeches,\nevenings that run on your script."),
 ("PHASE 3 · DAYS 61–90","KEEP IT & GIVE IT",
  "Armor what you built: your relapse signature, the worst-day plan,\nthe forever rules. Day 90's last lesson: help the next person\nthrough the door. What you give away, you keep."),
]
y=620
for tag,name,body in phases:
    d.rounded_rectangle([120,y,W-120,y+268],radius=22,fill=CARD,outline=(83,74,183),width=3)
    d.rectangle([120,y+16,131,y+252],fill=GREEN)
    tx=185
    d.text((tx,y+28),tag,font=fb(25),fill=GREEN)
    d.text((tx,y+64),name,font=fb(52),fill=INK)
    d.text((tx,y+136),body,font=fr(29),fill=SUB)
    y+=306

y+=16
d.text((W//2,y),"Every addiction gets its own clock — a slip on one never erases your",font=fr(30),fill=SUB,anchor="ma")
d.text((W//2,y+42),"days on another. Faith woven through every lesson, if you want it.",font=fr(30),fill=SUB,anchor="ma")

qs=310
segno.make("https://www.turnsomedayintodayone.com",error='h').save("_q.png",scale=20,border=4,dark="#0c0a20",light="#ffffff")
q=Image.open("_q.png").convert("RGB").resize((qs,qs),Image.LANCZOS)
im.paste(q,(W//2-qs//2,y+112))
d.text((W//2,y+112+qs+22),"Scan to start — days 1–15 free. No card. No trial.",font=fb(36),fill=GREEN,anchor="ma")
d.text((W//2,y+112+qs+76),"13 full programs — plus a track for the person who loves someone struggling.",font=fr(28),fill=SUB,anchor="ma")
tracked("TURNSOMEDAYINTODAYONE.COM",fb(28),7,W//2,H-80,FOOT)
im.save("bootcamp-handout.png")
im.save("bootcamp-handout.pdf",resolution=200.0)
os.remove("_q.png")
print("rebuilt")
