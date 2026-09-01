#!/usr/bin/env python3
"""Script in, narrated slide video out - the format the channel already posts.

    python3 tools/make-talk.py reference/scripts/02-2500-reviews.md out.mp4

Reads a script written as `## SECTION` headings with prose under each, renders
one slide per section in the house style (dark gradient, big number, green
rule, the app mark), narrates the prose with Piper, and holds each slide for
exactly as long as its narration runs.

Deliberately still slides rather than 30fps frames: the existing videos on the
channel are stills, and a 12-minute film at 30fps is 21,600 screenshots for no
visible gain. One PNG per section renders in seconds.

Lines starting with `>` or `**` are notes to the presenter and are never
spoken. Everything above the first `##` is front matter and is skipped.
"""
import json, os, re, subprocess, sys, tempfile, wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = "/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
VOICE = "/tmp/voices/vits-piper-en_US-joe-medium/en_US-joe-medium.onnx"
W, H = 1920, 1080

def sections(md):
    """[(title, spoken_text)] - one per ## heading."""
    body = md.split('\n## ', 1)
    if len(body) < 2:
        raise SystemExit('no ## sections found')
    out = []
    for chunk in ('## ' + body[1]).split('\n## '):
        chunk = chunk.lstrip('# ').strip()
        if not chunk:
            continue
        head, _, rest = chunk.partition('\n')
        title = re.sub(r'\s*[-—·]\s*.*$', '', head).strip()
        said = []
        for line in rest.split('\n'):
            s = line.strip()
            if not s or s.startswith(('>', '**', '-', '|', '#')):
                continue
            said.append(s)
        text = ' '.join(said)
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
        text = re.sub(r'\*(.+?)\*', r'\1', text)
        if text:
            out.append((title, text))
    return out

SLIDE = """<!doctype html><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:%(W)dpx;height:%(H)dpx;overflow:hidden;
 font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
 background:linear-gradient(140deg,#141a3a 0%%,#1b2350 45%%,#0e1330 100%%);
 color:#fff;display:flex;align-items:center;padding:0 130px}
.n{position:absolute;left:96px;top:84px;font-size:150px;font-weight:800;
 color:rgba(255,255,255,.16);letter-spacing:-6px;line-height:1}
h1{font-size:%(FS)dpx;font-weight:800;line-height:1.06;letter-spacing:-2px;max-width:1500px}
.rule{width:120px;height:7px;background:#5ce0a0;border-radius:4px;margin:34px 0 30px}
p{font-size:37px;line-height:1.5;color:rgba(255,255,255,.62);max-width:1360px;font-weight:400}
.foot{position:absolute;left:130px;bottom:76px;font-size:27px;color:rgba(255,255,255,.5)}
.mark{position:absolute;right:112px;bottom:64px;width:104px;height:104px;border-radius:26px;
 background:#534AB7;border:2px solid #5ce0a0;display:flex;align-items:center;
 justify-content:center;font-size:46px;font-weight:800}
</style>
<div class="n">%(NUM)s</div>
<div><h1>%(TITLE)s</h1><div class="rule"></div><p>%(SUB)s</p></div>
<div class="foot">Free &nbsp;·&nbsp; turnsomedayintodayone.com</div>
<div class="mark">&#8734;</div>
"""

def esc(s):
    return (s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;'))

def build(script_path, out_path):
    md = open(script_path, encoding='utf-8').read()
    secs = sections(md)
    print('sections:', len(secs))
    tmp = tempfile.mkdtemp(prefix='talk-')

    # 1. narration, one wav per section, so each slide holds exactly its own line
    durs = []
    for i, (title, text) in enumerate(secs):
        wav = os.path.join(tmp, 'a%03d.wav' % i)
        p = subprocess.run(['piper', '--model', VOICE, '--output_file', wav],
                           input=text, text=True, capture_output=True)
        if not os.path.exists(wav):
            raise SystemExit('piper failed on section %d: %s' % (i, p.stderr[:300]))
        with wave.open(wav) as w:
            durs.append(w.getnframes() / float(w.getframerate()))
        print('  %2d  %5.1fs  %s' % (i + 1, durs[-1], title[:52]))

    # 2. one slide per section
    pages = []
    for i, (title, text) in enumerate(secs):
        first = text.split('. ')[0]
        if len(first) > 150:
            first = first[:147].rsplit(' ', 1)[0] + '...'
        elif not first.endswith('.'):
            first += '.'
        fs = 96 if len(title) < 34 else (78 if len(title) < 52 else 64)
        html = SLIDE % dict(W=W, H=H, FS=fs, NUM='%02d' % (i + 1),
                            TITLE=esc(title), SUB=esc(first))
        f = os.path.join(tmp, 's%03d.html' % i)
        open(f, 'w', encoding='utf-8').write(html)
        pages.append(f)
    shot = os.path.join(ROOT, 'tools', '_shot.js')
    open(shot, 'w').write("""
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'%s'});
const p=await(await b.newContext({viewport:{width:%d,height:%d},deviceScaleFactor:1})).newPage();
for(const a of process.argv.slice(2)){const [src,out]=a.split('::');
 await p.goto('file://'+src);await p.waitForTimeout(90);await p.screenshot({path:out});}
await b.close();})();""" % (CHROME, W, H))
    args = ['%s::%s' % (pages[i], os.path.join(tmp, 'f%03d.png' % i)) for i in range(len(pages))]
    subprocess.run(['node', shot] + args, check=True)
    os.remove(shot)

    # 3. each still for the length of its own narration, then one concat
    parts = []
    for i, d in enumerate(durs):
        seg = os.path.join(tmp, 'v%03d.mp4' % i)
        subprocess.run([FF, '-y', '-loop', '1', '-i', os.path.join(tmp, 'f%03d.png' % i),
            '-i', os.path.join(tmp, 'a%03d.wav' % i),
            '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage', '-crf', '23',
            '-c:a', 'aac', '-b:a', '160k', '-pix_fmt', 'yuv420p', '-r', '25',
            # loudnorm before the pad: raw Piper output peaked at 0.0 dB (clipping)
            # and averaged -20 dB, which is quiet for YouTube. This lands near
            # the -14 LUFS platforms normalise to, with headroom left.
            '-t', '%.3f' % (d + 0.55), '-shortest',
            '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11,apad=pad_dur=0.55', seg],
            capture_output=True, check=True)
        parts.append(seg)
    lst = os.path.join(tmp, 'list.txt')
    open(lst, 'w').write('\n'.join("file '%s'" % p for p in parts))
    subprocess.run([FF, '-y', '-f', 'concat', '-safe', '0', '-i', lst,
                    '-c', 'copy', out_path], capture_output=True, check=True)
    total = sum(durs) + 0.55 * len(durs)
    print('\n%s  ·  %d slides  ·  %d:%02d' % (out_path, len(secs), total // 60, total % 60))

if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    build(sys.argv[1], sys.argv[2])
