"""Rebuild video 23's captions.

Every caption was written with a literal 'n' where a line break belonged -
'together\\nevery' printed as 'togethernevery'. This lays a corrected two-line
strip over the old one.

The bar underneath stays fully opaque for the whole run. Only the text fades.
If the bar faded too, the old broken caption would show through at every
five-second boundary.
"""
from PIL import Image, ImageDraw, ImageFont
import os

W=1080; SH=200; STRIP_Y=1560     # strip covers y 1560..1760; old text sits 1628..1665
FPS=30
FONT="/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
SIZE=50; LINE=62
FEATHER=34                       # soft top and bottom edge so a solid bar is not a hard box
TEXT=(245,245,245)
CENTER_Y=1646-STRIP_Y            # keep the new text on the old caption's centre line

# (start, end, line1, line2)
CAPS=[
 (0.0 , 5.0 ,"We eat dinner together","every night."),
 (5.0 ,10.0 ,"He never eats much","in front of me."),
 (10.0,15.0 ,"Then the kitchen light goes on","at eleven."),
 (15.0,20.0 ,"I found them in the car.","Not the house."),
 (20.0,25.0 ,"Eleven forty.","Every night that week."),
 (25.0,30.0 ,"Nobody hides a meal.","They hide the second one."),
 (30.0,35.0 ,"He's not greedy.",""),
 (35.0,40.0 ,"That's what makes it hard.",""),
 (40.0,45.0 ,"He'd never said it out loud.","Not once."),
 # 45-52.5 was two captions repeating the same sentence. One caption, held.
 (45.0,52.6 ,"So I asked.","And then I shut up and listened."),
]
END=53.0
FADE=0.3

f=ImageFont.truetype(FONT,SIZE)
os.makedirs("frames",exist_ok=True)
n=int(round(END*FPS))
for i in range(n):
    t=i/FPS
    im=Image.new("RGBA",(W,SH),(0,0,0,0))
    d=ImageDraw.Draw(im)
    # Fully opaque through the middle. At 236 the old white caption still
    # ghosted through at about level 18 against a background near 3 - faint,
    # but plainly readable. Solid is the only alpha that actually erases it.
    # The old text sits at strip-y 68..105, well inside the solid core.
    for yy in range(SH):
        a=255
        if yy<FEATHER: a=int(255*yy/FEATHER)
        elif yy>SH-FEATHER: a=int(255*(SH-yy)/FEATHER)
        d.line([(0,yy),(W,yy)],fill=(0,0,0,a))
    for (s,e,l1,l2) in CAPS:
        if not (s<=t<e): continue
        a=1.0
        if t-s<FADE: a=(t-s)/FADE
        elif e-t<FADE: a=max(0.0,(e-t)/FADE)
        col=TEXT+(int(255*a),)
        lines=[l1]+([l2] if l2 else [])
        y=CENTER_Y-(len(lines)-1)*LINE/2-SIZE*0.62
        for ln in lines:
            d.text((W/2,y),ln,font=f,fill=col,anchor="ma")
            y+=LINE
        break
    im.save("frames/f_%05d.png"%i)
print("frames:",n,"strip",W,"x",SH,"at y",STRIP_Y)
