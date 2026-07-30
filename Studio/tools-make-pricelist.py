from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable)
from reportlab.lib.enums import TA_LEFT

OUT = "/tmp/claude-0/-home-user-app/a6efbfa4-a711-56dc-98bb-80aae0615635/scratchpad/Studio-Price-List.pdf"
INK=colors.HexColor("#14121f"); ACCENT=colors.HexColor("#6d5efc"); MUTED=colors.HexColor("#6b6b7b")
LIGHT=colors.HexColor("#f2f1fb"); GREEN=colors.HexColor("#1f9d55"); LINE=colors.HexColor("#dddaee")

H1=ParagraphStyle("H1",fontName="Helvetica-Bold",fontSize=24,textColor=INK,alignment=TA_LEFT,leading=27)
SUB=ParagraphStyle("SUB",fontName="Helvetica",fontSize=10.5,textColor=MUTED,leading=14)
SEC=ParagraphStyle("SEC",fontName="Helvetica-Bold",fontSize=12.5,textColor=INK,spaceBefore=13,spaceAfter=5,leading=15)
NOTE=ParagraphStyle("NOTE",fontName="Helvetica",fontSize=9.5,textColor=MUTED,leading=13)
CELL=ParagraphStyle("CELL",fontName="Helvetica",fontSize=10,textColor=INK,leading=13)
CELLB=ParagraphStyle("CELLB",fontName="Helvetica-Bold",fontSize=10,textColor=INK,leading=13)

doc=SimpleDocTemplate(OUT,pagesize=letter,topMargin=0.55*inch,bottomMargin=0.55*inch,leftMargin=0.7*inch,rightMargin=0.7*inch,title="Studio AI Price List",author="Synborn Studios")
S=[]
def P(t,st=CELL): return Paragraph(t,st)
def hdr(cols): return [P(c,CELLB) for c in cols]
def table(rows,widths):
    t=Table(rows,colWidths=widths,hAlign="LEFT")
    st=[("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6),
        ("LEFTPADDING",(0,0),(-1,-1),9),("RIGHTPADDING",(0,0),(-1,-1),9),("LINEBELOW",(0,0),(-1,-2),0.4,LINE),
        ("BOX",(0,0),(-1,-1),0.6,LINE),("BACKGROUND",(0,0),(-1,0),INK),("TEXTCOLOR",(0,0),(-1,0),colors.white),
        ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("FONTSIZE",(0,0),(-1,0),9.5),
        ("TOPPADDING",(0,0),(-1,0),7),("BOTTOMPADDING",(0,0),(-1,0),7)]
    for r in range(2,len(rows),2): st.append(("BACKGROUND",(0,r),(-1,r),LIGHT))
    t.setStyle(TableStyle(st)); return t

S.append(Paragraph("Studio - AI Price List",H1))
S.append(Paragraph("Synborn Studios   -   verified rates, pulled from the app",SUB))
S.append(HRFlowable(width="100%",thickness=2,color=ACCENT,spaceBefore=4,spaceAfter=4))
S.append(Paragraph("Every price shows on the button <b>before</b> you spend, and rounds <b>up</b> - a real bill is never higher. All charges come from your own fal.ai balance.",NOTE))

S.append(Paragraph("Video - animating a shot (charged per second)",SEC))
S.append(table([hdr(["Tier","Model","Rate","5-sec clip","10-sec clip"]),
 [P("Draft"),P("Wan 2.5"),P("$0.05/sec"),P("~$0.25"),P("~$0.50")],
 [P("Standard"),P("Kling 2.5 Turbo"),P("$0.07/sec"),P("~$0.35"),P("~$0.70")],
 [P("Best"),P("Seedance"),P("$0.24/sec"),P("~$1.20"),P("~$2.40")]],
 [0.9*inch,1.7*inch,1.0*inch,1.15*inch,1.15*inch]))

S.append(Paragraph("Images - generating a scene (per image)",SEC))
S.append(table([hdr(["What","Model","Price"]),
 [P("Scene image"),P("Flux"),P("~$0.035  (3-4 cents)")],
 [P("Scene with your face-locked character"),P("Flux multi-reference"),P("~$0.09")],
 [P("Best image"),P("Nano Banana Pro"),P("~$0.15")]],
 [3.0*inch,1.9*inch,1.35*inch]))

S.append(Paragraph("Character face-lock training (one-time, per character)",SEC))
S.append(table([hdr(["What","Price"]),
 [P("Train a face lock (1,500 steps)"),P("~$3.60  (one-time)",CELLB)]],[4.4*inch,1.85*inch]))

S.append(Paragraph("Performance and voice",SEC))
S.append(table([hdr(["What","Price"]),
 [P("Sing / lip-sync on a video - Draft (MuseTalk)"),P("~$0.04")],
 [P("Sing / lip-sync on a video - Hero (LatentSync)"),P("~$0.20")],
 [P("Sing on a still photo"),P("~$0.50 - $1.50  (varies)")],
 [P("Live Portrait (animate a still's face)"),P("~$0.10")],
 [P("Voice / narration - Neutral"),P("$0.05 per 1,000 chars  (~half a cent a line, ~5c/min)")],
 [P("Voice / narration - with a mood (emotion)"),P("~$0.12 per 1,000 chars")]],
 [3.55*inch,2.7*inch]))

S.append(Paragraph("Dance / motion transfer (charged per second)",SEC))
S.append(table([hdr(["Tier","Model","Rate","10-sec clip"]),
 [P("Draft"),P("Wan-Animate"),P("$0.15/sec"),P("~$1.50")],
 [P("Standard"),P("Kling v2.6"),P("$0.13/sec"),P("~$1.30")],
 [P("Best"),P("Kling v3 Pro"),P("$0.17/sec"),P("~$1.70")]],
 [1.0*inch,1.9*inch,1.2*inch,2.15*inch]))

S.append(Paragraph("Small AI helpers",SEC))
S.append(table([hdr(["What","Price"]),
 [P("Auto-captions (AI listens to whole song)"),P("~$0.35  -  FREE if you paste your lyrics")],
 [P("QC image inspection (checks faces / hands)"),P("~$0.005  (half a cent)")],
 [P("Crew Room chat (Creative Director, etc.)"),P("a fraction of a cent per message")]],
 [3.55*inch,2.7*inch]))

S.append(Paragraph("Everything else is FREE (unlimited)",SEC))
fb=Table([[Paragraph("Renders  -  shorts  -  campaign export  -  all editing  -  2x upscale  -  Master for release (48k WAV)  -  Clean audio  -  Reframe (9:16 / 1:1 / 16:9)  -  Green screen  -  Mirror / Slow-mo / Freeze  -  Ken Burns motion  -  captions and styles  -  brand watermark  -  keep-clip-audio + song ducking  -  screen recording  -  Pexels stock b-roll  -  backups.",
 ParagraphStyle("F",fontName="Helvetica",fontSize=10,textColor=INK,leading=16))]],colWidths=[6.25*inch])
fb.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#eafaf0")),("BOX",(0,0),(-1,-1),1,GREEN),
 ("TOPPADDING",(0,0),(-1,-1),10),("BOTTOMPADDING",(0,0),(-1,-1),10),("LEFTPADDING",(0,0),(-1,-1),12),("RIGHTPADDING",(0,0),(-1,-1),12)]))
S.append(fb)
S.append(Spacer(1,10)); S.append(HRFlowable(width="100%",thickness=1,color=LINE)); S.append(Spacer(1,4))
S.append(Paragraph("<b>The money-saver:</b> your only costs are generating brand-new AI images, video, voice, lip-sync, and the one-time face-lock. Everything about <b>assembling and finishing</b> the video is free. A daily safety cap keeps runaway spend impossible. Rates as configured in the app; fal.ai's live pricing is the final word.",NOTE))
doc.build(S)
print("WROTE",OUT)
