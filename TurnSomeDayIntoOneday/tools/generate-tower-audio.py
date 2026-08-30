"""Generate the spoken floor briefings for 2AM (docs/GAME-SPEC.md §3).

Every floor opens with two cold lines. This records them in all six narrator
voices, so the tower speaks in whichever voice the member already chose for
their lessons - there is no separate voice picker for the game.

    <base>tower/<voice>/floor-01.mp3 ... floor-10.mp3

where base is the lesson audio manifest's base. Sixty short files; they live on
the repo's `lesson-audio` branch and are served from raw.githubusercontent.com,
same as the lessons and the stories.

The briefing text is read straight out of index.html rather than duplicated
here, so there is exactly one copy of those twenty lines and a rewrite cannot
leave the recordings quietly saying something else. That extraction needs node,
which the repo already depends on for its tests.

    pip install piper-tts lameenc numpy
    # voice folders from sherpa-onnx's release mirror:
    #   https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/<name>.tar.bz2

Run from the TurnSomeDayIntoOneday directory:

    python3 tools/generate-tower-audio.py path/to/voices-folder path/to/output-folder
    python3 tools/generate-tower-audio.py /tmp/voices out --only warm --floors 1,2

Then commit the output folder's contents to `lesson-audio` under tower/.
"""
import argparse
import json
import os
import subprocess
import sys

import lameenc
import numpy as np
from piper import PiperVoice, SynthesisConfig

# The same six the lessons offer, at the same speeds, so a member who picked
# "deep" for their lessons hears the same person read the floor to them.
VOICES = {
    'warm':   ('vits-piper-en_US-kristin-medium/en_US-kristin-medium.onnx', 1.12),
    'soft':   ('vits-piper-en_GB-cori-medium/en_GB-cori-medium.onnx', 1.12),
    'gentle': ('vits-piper-en_US-kathleen-low/en_US-kathleen-low.onnx', 1.10),
    'clear':  ('vits-piper-en_US-ljspeech-high/en_US-ljspeech-high.onnx', 1.05),
    'male':   ('vits-piper-en_US-john-medium/en_US-john-medium.onnx', 1.38),
    'deep':   ('vits-piper-en_US-joe-medium/en_US-joe-medium.onnx', 1.38),
}

LINE_GAP_S = 0.7   # between the two lines: a beat, and no more than that
LEAD_IN_S = 0.25   # a moment of nothing before the voice starts
BITRATE = 48       # matches the lessons and the stories


def briefings(app_html):
    """The twenty lines, lifted from the TOWER_FLOORS literal in index.html."""
    js = (
        "const fs=require('fs');"
        "const s=fs.readFileSync(process.argv[1],'utf8');"
        "const m=s.match(/const TOWER_FLOORS=(\\[[\\s\\S]*?\\n\\];)/);"
        "if(!m)throw new Error('TOWER_FLOORS not found in '+process.argv[1]);"
        "const f=new Function('return '+m[1].replace(/;$/,''))();"
        "console.log(JSON.stringify(f.map(x=>({n:x.n,name:x.name,brief:x.brief}))));"
    )
    out = subprocess.run(['node', '-e', js, app_html], capture_output=True, text=True)
    if out.returncode:
        sys.exit('Could not read the briefings from index.html:\n' + out.stderr.strip())
    return json.loads(out.stdout)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('voices')
    ap.add_argument('out')
    ap.add_argument('--app', default='index.html')
    ap.add_argument('--only', default='', help='comma-separated voice keys')
    ap.add_argument('--floors', default='', help='comma-separated floor numbers')
    a = ap.parse_args()

    floors = briefings(a.app)
    if a.floors:
        want = {int(x) for x in a.floors.split(',') if x.strip()}
        floors = [f for f in floors if f['n'] in want]
    keys = [k.strip() for k in a.only.split(',') if k.strip()] or list(VOICES)
    for k in keys:
        if k not in VOICES:
            sys.exit(f'No voice called "{k}". Have: {", ".join(VOICES)}')

    total = 0
    for key in keys:
        rel, length_scale = VOICES[key]
        voice = PiperVoice.load(os.path.join(a.voices, rel))
        rate = voice.config.sample_rate
        cfg = SynthesisConfig(length_scale=length_scale)
        gap = np.zeros(int(LINE_GAP_S * rate), dtype=np.int16)
        lead = np.zeros(int(LEAD_IN_S * rate), dtype=np.int16)
        d = os.path.join(a.out, key)
        os.makedirs(d, exist_ok=True)

        def synth(text):
            # Piper reads an em dash as a word; a comma gives the pause it means.
            chunks = [np.frombuffer(c.audio_int16_bytes, dtype=np.int16)
                      for c in voice.synthesize(text.replace('—', ','), cfg)]
            return np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.int16)

        for f in floors:
            parts = [lead]
            for i, line in enumerate(f['brief']):
                parts.append(synth(line))
                if i < len(f['brief']) - 1:
                    parts.append(gap)
            pcm = np.concatenate(parts)

            enc = lameenc.Encoder()
            enc.set_bit_rate(BITRATE)
            enc.set_in_sample_rate(rate)
            enc.set_channels(1)
            enc.set_quality(2)
            mp3 = enc.encode(pcm.tobytes()) + enc.flush()

            path = os.path.join(d, 'floor-%02d.mp3' % f['n'])
            with open(path, 'wb') as fh:
                fh.write(bytes(mp3))
            total += len(mp3)
            print(f"  {key:6} floor-{f['n']:02d}  {len(mp3)/1024:5.0f} KB  "
                  f"{len(pcm)/rate:4.1f}s  {f['name']}")

    print(f"=== {len(keys) * len(floors)} files, {total/1048576:.1f} MB ===")


if __name__ == '__main__':
    main()
