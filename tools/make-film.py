#!/usr/bin/env python3
"""One command: a JSON spec in, a finished vertical video out.

    python3 tools/make-film.py spec.json out.mp4

Does everything the hand-cut videos do - letterboxed photo bands on a blurred
blowup of the same frame, Ken Burns per shot, house caption strips, the brand
end card, watermark, score, fades - so a new Cause & Effect piece is one
command instead of an hour of ffmpeg.

spec.json:
{
  "shots": [
    {"src": "cause.png", "seconds": 3, "caption": "It lasted ten seconds.",
     "motion": "in"|"out"|"none", "full_bleed": false}
  ],
  "endcard": {"big": "Anger is a habit. It can be broken.",
              "green": "It's free. Link in bio."},
  "music": "content/score/silent-impact-3.mp3",
  "music_volume": 0.85,
  "voiceover": null,          # optional wav/mp3, mixed under the music
  "voiceover_delay": 1.3
}
Captions already burned into the source images: just omit "caption".
"""
import json, os, subprocess, sys, tempfile, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = "/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"
CHROME = os.environ.get("PW_CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
NODE_PATH = os.environ.get("NODE_PATH", "")
WATERMARK = os.path.join(ROOT, "reference/business-card/icon-512.png")
W, H = 1080, 1920

CAP_HTML = """<!doctype html><meta charset="utf-8"><style>
body{margin:0;width:1080px;height:300px;display:flex;align-items:center;justify-content:center;background:transparent}
.cap{font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:52px;line-height:1.3;color:#fff;
 text-align:center;max-width:860px;padding:16px 30px;border-radius:14px;letter-spacing:.5px;
 background:rgba(5,5,10,.55);text-shadow:0 2px 10px rgba(0,0,0,.7)}
</style><div class="cap" id="c"></div>
<script>document.getElementById('c').textContent=decodeURIComponent(location.hash.slice(1));</script>"""

CARD_HTML = """<!doctype html><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1920px;background:#0f0c29;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
display:flex;flex-direction:column;align-items:center;text-align:center;position:relative}
#mark{width:210px;height:210px;border-radius:62px;background:#534AB7;border:7px solid #7ee8a2;
display:flex;align-items:center;justify-content:center;margin-top:430px}
#mark svg{width:132px;height:132px}
#tag{color:#fff;font-size:52px;font-weight:600;line-height:1.35;max-width:880px;margin-top:52px}
#tag .g{color:#7ee8a2}
#mid{display:flex;flex-direction:column;align-items:center;width:100%;margin-top:120px}
#rule{width:120px;height:3px;background:rgba(126,232,162,.45);margin:0 auto 56px;border-radius:2px}
#big{color:#fff;font-size:86px;font-weight:700;line-height:1.15;max-width:900px}
#green{color:#7ee8a2;font-size:54px;font-weight:600;margin-top:48px}
#brand{position:absolute;bottom:120px;width:100%;color:#6672a0;font-size:34px;letter-spacing:6px;font-weight:600}
</style>
<div id="mark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l3-2.5c.8-.6 1.9-.6 2.6.1l1 1"/><path d="M21 12l-3-2.5c-.8-.6-1.9-.6-2.6.1l-2.6 2.3c-.6.5-.6 1.4 0 2l.2.2c.6.6 1.6.6 2.2 0"/><path d="M9.6 10.6l2.3 2.1c.6.6.6 1.5 0 2.1-.6.6-1.5.6-2.1 0l-1-.9"/><path d="M3 12v4a1 1 0 0 0 1 1h1M21 12v4a1 1 0 0 1-1 1h-1"/></svg></div>
<div id="tag">An app for <span class="g">you</span><br>and the one who <span class="g">supports you</span></div>
<div id="mid"><div id="rule"></div><div id="big">BIG</div><div id="green">GREEN</div></div>
<div id="brand">TURN SOMEDAY INTO DAY ONE</div>"""

SHOT_JS = """const {chromium}=require('playwright');
(async()=>{
const jobs=JSON.parse(process.argv[2]);
const b=await chromium.launch({executablePath:process.argv[3]});
for(const j of jobs){
  const ctx=await b.newContext({viewport:{width:j.w,height:j.h}});
  const p=await ctx.newPage();
  await p.goto('file://'+j.file+(j.hash?('#'+encodeURIComponent(j.hash)):''));
  await p.waitForTimeout(250);
  await p.screenshot({path:j.out,omitBackground:!!j.transparent});
  await ctx.close();
}
await b.close();console.log('shot ok');
})();"""

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.stderr.write(r.stdout + r.stderr)
        raise SystemExit("failed: " + " ".join(cmd[:3]))
    return r

def build(spec_path, out_path):
    spec = json.load(open(spec_path))
    base = os.path.dirname(os.path.abspath(spec_path))
    tmp = tempfile.mkdtemp(prefix="film-")
    try:
        jobs = []
        cap_file = os.path.join(tmp, "cap.html"); open(cap_file, "w").write(CAP_HTML)
        for i, s in enumerate(spec["shots"]):
            if s.get("caption"):
                jobs.append({"file": cap_file, "hash": s["caption"], "w": 1080, "h": 300,
                             "out": os.path.join(tmp, f"cap{i}.png"), "transparent": True})
        ec = spec.get("endcard")
        if ec:
            card = CARD_HTML.replace(">BIG<", ">" + ec.get("big", "") + "<") \
                            .replace(">GREEN<", ">" + ec.get("green", "It's free. Link in bio.") + "<")
            card_file = os.path.join(tmp, "card.html"); open(card_file, "w").write(card)
            jobs.append({"file": card_file, "w": 1080, "h": 1920, "out": os.path.join(tmp, "endcard.png")})
        if jobs:
            js = os.path.join(tmp, "shoot.js"); open(js, "w").write(SHOT_JS)
            env = dict(os.environ); env["NODE_PATH"] = NODE_PATH
            r = subprocess.run(["node", js, json.dumps(jobs), CHROME], capture_output=True, text=True, env=env)
            if r.returncode:
                sys.stderr.write(r.stdout + r.stderr); raise SystemExit("screenshot step failed")

        inputs, filters, segs = [], [], []
        idx = 0
        def add(*a):
            nonlocal idx
            inputs.extend(a); i = idx; idx += 1; return i

        shot_inputs = []
        for i, s in enumerate(spec["shots"]):
            src = s["src"] if os.path.isabs(s["src"]) else os.path.join(base, s["src"])
            dur = float(s.get("seconds", 3))
            is_video = src.lower().endswith((".mp4", ".webm", ".mov"))
            if is_video:
                bgi = add("-t", str(dur), "-i", src); fgi = bgi
            else:
                bgi = add("-loop", "1", "-t", str(dur), "-i", src)
                fgi = add("-i", src)
            capi = None
            if s.get("caption"):
                capi = add("-loop", "1", "-t", str(dur), "-i", os.path.join(tmp, f"cap{i}.png"))
            shot_inputs.append((i, s, dur, bgi, fgi, capi, is_video))

        ec_i = add("-loop", "1", "-t", str(float((ec or {}).get("seconds", 2))), "-i",
                   os.path.join(tmp, "endcard.png")) if ec else None
        wm_i = add("-i", WATERMARK)
        mus = spec.get("music")
        mus_i = add("-i", mus if os.path.isabs(mus) else os.path.join(ROOT, mus)) if mus else None
        vo = spec.get("voiceover")
        vo_i = add("-i", vo if os.path.isabs(vo) else os.path.join(ROOT, vo)) if vo else None

        total = 0.0
        for i, s, dur, bgi, fgi, capi, is_video in shot_inputs:
            total += dur
            frames = int(dur * 30)
            m = s.get("motion", "in")
            z = {"in": "1.0+0.0012*on", "out": "1.05-0.0008*on", "none": "1.0"}[m]
            if s.get("full_bleed"):
                filters.append(
                    f"[{fgi}:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
                    f"zoompan=z='{z}':d={frames}:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':s={W}x{H}:fps=30,setsar=1[v{i}]")
            else:
                band = int(W * 9 / 16 * 1.02)
                filters.append(
                    f"[{bgi}:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
                    f"boxblur=34:2,eq=brightness=-0.24:saturation=0.58,fps=30,setsar=1[bg{i}]")
                if is_video:
                    filters.append(f"[{fgi}:v]scale={W}:-2,fps=30,setsar=1[fg{i}]")
                else:
                    filters.append(
                        f"[{fgi}:v]scale=1560:-2,zoompan=z='{z}':d={frames}:x='(iw-iw/zoom)/2':"
                        f"y='(ih-ih/zoom)/2':s={W}x{band}:fps=30,setsar=1[fg{i}]")
                filters.append(f"[bg{i}][fg{i}]overlay=0:({H}-{band})/2-30:shortest=1,setsar=1[v{i}]")
            if capi is not None:
                filters.append(f"[v{i}][{capi}:v]overlay=0:1430:shortest=1,setsar=1[s{i}]")
                segs.append(f"[s{i}]")
            else:
                segs.append(f"[v{i}]")
        if ec_i is not None:
            filters.append(f"[{ec_i}:v]scale={W}:{H},fps=30,setsar=1[ec]")
            segs.append("[ec]"); total += float(ec.get("seconds", 2))
        filters.append("".join(segs) + f"concat=n={len(segs)}:v=1,settb=AVTB[seq]")
        filters.append(f"[{wm_i}:v]scale=130:130[wm]")
        filters.append(f"[seq][wm]overlay=910:1700:format=auto,"
                       f"fade=t=out:st={total-0.5:.2f}:d=0.45,format=yuv420p[v]")

        amaps = []
        if mus_i is not None:
            vol = spec.get("music_volume", 0.85 if vo_i is None else 0.45)
            filters.append(f"[{mus_i}:a]atrim=0:{total:.2f},volume={vol},afade=t=in:st=0:d=0.4,"
                           f"afade=t=out:st={max(0,total-1.6):.2f}:d=1.5[mus]"); amaps.append("[mus]")
        if vo_i is not None:
            d = int(float(spec.get("voiceover_delay", 1.3)) * 1000)
            filters.append(f"[{vo_i}:a]adelay={d}|{d},loudnorm=I=-14:TP=-1.5[vo]"); amaps.append("[vo]")
        if len(amaps) == 2:
            filters.append("".join(amaps) + "amix=inputs=2:duration=longest:dropout_transition=0,alimiter=limit=0.95[a]")
            amap = "[a]"
        elif amaps:
            amap = amaps[0]
        else:
            amap = None

        cmd = [FF, "-y", "-v", "error"] + inputs + ["-filter_complex", ";".join(filters), "-map", "[v]"]
        if amap: cmd += ["-map", amap]
        cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "19", "-c:a", "aac",
                "-b:a", "128k", "-t", f"{total:.2f}", out_path]
        run(cmd)
        print(f"{out_path}  {total:.1f}s  {len(spec['shots'])} shots"
              f"{' + end card' if ec else ''}{' + VO' if vo else ''}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    build(sys.argv[1], sys.argv[2])
