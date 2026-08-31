"""Generate the narrated story recordings for data/audio-stories.json.

Written 29 Aug 2026. The first ten stories were recorded by an earlier session
that never committed its script, so the audio could not be reproduced from this
repo and set two could not be made without re-deriving the whole pipeline. This
is that script.

Each story becomes ONE mp3 named after its id, matching what index.html asks
for: <base>stories/<id>.mp3, where base comes from the lesson audio manifest.
The recordings live on the repo's `lesson-audio` branch and are served from
raw.githubusercontent.com, exactly like the lesson audio - they are far too
large to ship in the app.

A story is one person talking, so unlike the lessons there are no variants and
no voice picker: each story is recorded once, in the voice that fits its
narrator. VOICE_FOR maps story id to voice; add a row when you add a story.

    pip install piper-tts lameenc numpy
    # voice folders from sherpa-onnx's release mirror:
    #   https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/<name>.tar.bz2

Run from the TurnSomeDayIntoOneday directory:

    python3 tools/generate-story-audio.py path/to/voices-folder path/to/output-folder
    python3 tools/generate-story-audio.py voices out --only smoking-user-ray

Then commit the output folder's contents to `lesson-audio` under stories/.
"""
import argparse
import json
import os
import re
import sys

import lameenc
import numpy as np
from piper import PiperVoice, SynthesisConfig

# Same six-voice library as the lessons. Stories are one narrator each, so the
# choice is per story rather than offered to the listener.
VOICES = {
    'warm':   ('vits-piper-en_US-kristin-medium/en_US-kristin-medium.onnx', 1.12),
    'soft':   ('vits-piper-en_GB-cori-medium/en_GB-cori-medium.onnx', 1.12),
    'male':   ('vits-piper-en_US-john-medium/en_US-john-medium.onnx', 1.38),
    'deep':   ('vits-piper-en_US-joe-medium/en_US-joe-medium.onnx', 1.38),
}

# One row per story. Chosen to fit the narrator and to vary across a fortnight,
# so five stories in a row are not the same voice.
VOICE_FOR = {
    'smoking-user-ray': 'deep',
    'vaping-user-tasha': 'warm',
    'gaming-user-eli': 'male',
    'shopping-supporter-dean': 'deep',
    'socialmedia-supporter-nadia': 'soft',
    'shopping-user-brenda': 'soft',
    'work-user-victor': 'deep',
    'gaming-supporter-priya': 'warm',
    'vaping-supporter-james': 'male',
    'socialmedia-user-lorna': 'soft',
}

PARA_GAP_S = 0.75   # between paragraphs: a breath, not a scene change
BITRATE = 48        # matches the existing ten


def load_stories(path):
    d = json.load(open(path, encoding='utf-8'))
    if isinstance(d.get('batches'), list):
        out = []
        for b in d['batches']:
            out += (b if isinstance(b, list) else b.get('stories', []))
        return out
    return d.get('stories', [])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('voices')
    ap.add_argument('out')
    ap.add_argument('--only', default='', help='comma-separated story ids')
    ap.add_argument('--data', default='data/audio-stories.json')
    a = ap.parse_args()

    stories = load_stories(a.data)
    if a.only:
        want = {s.strip() for s in a.only.split(',') if s.strip()}
        stories = [s for s in stories if s['id'] in want]
    os.makedirs(a.out, exist_ok=True)

    # Load each voice once and do every story that uses it: loading is the slow
    # part, and doing it per story tripled the run for no reason.
    by_voice = {}
    for s in stories:
        key = VOICE_FOR.get(s['id'])
        if not key:
            print(f"  SKIP {s['id']} - no voice mapped. Add it to VOICE_FOR.")
            continue
        by_voice.setdefault(key, []).append(s)

    for key, group in by_voice.items():
        rel, length_scale = VOICES[key]
        voice = PiperVoice.load(os.path.join(a.voices, rel))
        rate = voice.config.sample_rate
        cfg = SynthesisConfig(length_scale=length_scale)
        gap = np.zeros(int(PARA_GAP_S * rate), dtype=np.int16)

        def synth(text):
            # Piper reads an em dash as a word; a comma gives the pause it means.
            chunks = [np.frombuffer(c.audio_int16_bytes, dtype=np.int16)
                      for c in voice.synthesize(text.replace('—', ','), cfg)]
            return np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.int16)

        for s in group:
            paras = [p.strip() for p in re.split(r'\n\s*\n', s['text']) if p.strip()]
            parts = []
            for i, p in enumerate(paras):
                parts.append(synth(p))
                if i < len(paras) - 1:
                    parts.append(gap)
            pcm = np.concatenate(parts)

            enc = lameenc.Encoder()
            enc.set_bit_rate(BITRATE)
            enc.set_in_sample_rate(rate)
            enc.set_channels(1)
            enc.set_quality(2)
            mp3 = enc.encode(pcm.tobytes()) + enc.flush()

            path = os.path.join(a.out, f"{s['id']}.mp3")
            with open(path, 'wb') as f:
                f.write(bytes(mp3))
            mins = len(pcm) / rate / 60
            print(f"  {s['id']:32} {key:5} {len(mp3)/1024:6.0f} KB  {mins:4.1f} min")
            # The listing states a length; keep data/audio-stories.json honest.
            if round(mins) != s.get('minutes'):
                print(f"      NOTE: json says {s.get('minutes')} min, actual rounds to {round(mins)}")


if __name__ == '__main__':
    main()
