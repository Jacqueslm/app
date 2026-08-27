"""Generate the lesson recordings + data/lesson-audio-manifest.json.

Lessons play as real MP3s (like the SOS talk) so they survive screen-off and
app-switch, with the same five voices. The recordings do NOT live in the app
repo/deploy - they'd bloat every Railway build and home-install update by a
gigabyte. They live on the repo's dedicated `lesson-audio` branch, served to
the app straight from raw.githubusercontent.com (public repo = public CDN).
The app only ships the small manifest, which maps

    "<Category>|<day>|<variant>"  ->  { voiceKey: "relative/path.mp3", ... }

Variants mirror applyRelationshipVariant in index.html: 'base' for everyone,
plus 'single' / 'family' where a lesson authors single_variant/family_variant.
The spoken text mirrors toggleLessonAudio's composition exactly:

    "<title>. <content>\n\nToday's action: <action>\n\nSomething to reflect on: <reflection>"

File names embed a hash of (voice, text): editing a lesson and re-running this
script yields new file names, so stale CDN/browser caches can never play old
text. Unchanged lessons keep their names and re-encode for free.

One-time setup (same as generate-sos-talk.py):
    pip install piper-tts lameenc numpy
    # download the five voice folders from sherpa-onnx's release mirror

Run from the TurnSomeDayIntoOneday directory:
    python3 tools/generate-lesson-audio.py path/to/voices-folder path/to/output-folder

Then commit the output folder to the `lesson-audio` branch and the regenerated
data/lesson-audio-manifest.json to main in the same change.
"""
import hashlib
import json
import multiprocessing as mp
import os
import re
import sys
import time

import lameenc
import numpy as np

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LESSONS = os.path.join(HERE, 'data', 'lessons.json')
MANIFEST = os.path.join(HERE, 'data', 'lesson-audio-manifest.json')
BASE_URL = 'https://raw.githubusercontent.com/Jacqueslm/app/lesson-audio/'

# Same five voices as the SOS talk (VG_VOICES in index.html). Lessons are read
# at conversational pace - the in-app speed button handles slower/faster.
# FIXED 27 Aug 2026. This map still pointed at hfc_female, amy, hfc_male and
# lessac - the four voices the 8 Aug licence audit banned as non-commercial.
# The shipped recordings were made with the clean set, but re-running this file
# would have quietly produced non-commercial audio for any new lesson text.
# Now identical to PIPER_VOICES in generate-phase-audio.py. File names hash
# (voice_key, text), not the model, so this change renames nothing.
VOICES = {
    'warm':   'vits-piper-en_US-kristin-medium/en_US-kristin-medium.onnx',
    'soft':   'vits-piper-en_GB-cori-medium/en_GB-cori-medium.onnx',
    'gentle': 'vits-piper-en_US-kathleen-low/en_US-kathleen-low.onnx',
    'clear':  'vits-piper-en_US-ljspeech-high/en_US-ljspeech-high.onnx',
    'male':   'vits-piper-en_US-john-medium/en_US-john-medium.onnx',
    'deep':   'vits-piper-en_US-joe-medium/en_US-joe-medium.onnx',
}

def wanted(voices):
    only = os.environ.get('PHASE_ONLY', '').strip()
    return {k: v for k, v in voices.items() if k == only} if only else voices
LENGTH_SCALE = 1.05
MP3_KBPS = 40  # mono speech: transparent enough, ~5KB/s

def lesson_text(item, variant):
    v = item.get(variant + '_variant') if variant != 'base' else None
    def field(k):
        if v and v.get(k):
            return v[k]
        return item.get(k, '') or ''
    text = f"{field('title')}. {field('content')}"
    if field('action'):
        text += "\n\nToday's action: " + field('action')
    if field('reflection'):
        text += "\n\nSomething to reflect on: " + field('reflection')
    return text

def slug(s):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower())).strip('-')

def collect_jobs():
    packs = json.load(open(LESSONS, encoding='utf-8'))
    jobs = []  # (category, day, variant, text)
    for category, items in packs.items():
        for item in items:
            jobs.append((category, item['day'], 'base', lesson_text(item, 'base')))
            if item.get('single_variant'):
                jobs.append((category, item['day'], 'single', lesson_text(item, 'single')))
            if item.get('family_variant'):
                jobs.append((category, item['day'], 'family', lesson_text(item, 'family')))
    return jobs

_voice = None
_rate = None

def _init_worker(model_path):
    global _voice, _rate
    from piper import PiperVoice
    _voice = PiperVoice.load(model_path)
    _rate = _voice.config.sample_rate

def _synth_one(args):
    voice_key, category, day, variant, text, out_dir = args
    from piper import SynthesisConfig
    h = hashlib.sha1((voice_key + '\x00' + text).encode('utf-8')).hexdigest()[:10]
    rel = f"{voice_key}/{slug(category)}-d{day}" + ('' if variant == 'base' else f"-{variant}") + f"-{h}.mp3"
    path = os.path.join(out_dir, rel)
    if os.path.exists(path):
        return (category, day, variant, voice_key, rel, None)
    cfg = SynthesisConfig(length_scale=LENGTH_SCALE)
    chunks = [np.frombuffer(c.audio_int16_bytes, dtype=np.int16)
              for c in _voice.synthesize(text.replace('—', ','), cfg)]
    audio = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.int16)
    enc = lameenc.Encoder()
    enc.set_bit_rate(MP3_KBPS)
    enc.set_in_sample_rate(_rate)
    enc.set_channels(1)
    enc.set_quality(2)
    mp3 = enc.encode(audio.tobytes()) + enc.flush()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(mp3)
    return (category, day, variant, voice_key, rel, len(audio) / _rate)

def main():
    if len(sys.argv) != 3:
        sys.exit('usage: python3 tools/generate-lesson-audio.py <voices-folder> <output-folder>')
    voices_base, out_dir = sys.argv[1], sys.argv[2]
    jobs = collect_jobs()
    total_chars = sum(len(j[3]) for j in jobs)
    print(f'{len(jobs)} lesson texts, {total_chars} chars, x{len(VOICES)} voices')
    # Merge into the existing manifest. This used to start from {} and write
    # the file at the end, which silently deleted every days 31-90 entry that
    # generate-phase-audio.py had put there.
    try:
        items = json.load(open(MANIFEST, encoding='utf-8'))['items']
    except Exception:
        items = {}
    workers = max(1, (os.cpu_count() or 2) - 0)
    for voice_key, rel_model in wanted(VOICES).items():
        model = os.path.join(voices_base, rel_model)
        t0 = time.time()
        args = [(voice_key, c, d, v, t, out_dir) for (c, d, v, t) in jobs]
        with mp.Pool(workers, initializer=_init_worker, initargs=(model,)) as pool:
            for i, (category, day, variant, vk, rel, dur) in enumerate(pool.imap_unordered(_synth_one, args, chunksize=4)):
                key = f'{category}|{day}|{variant}'
                items.setdefault(key, {})[vk] = rel
                if (i + 1) % 50 == 0:
                    print(f'  {voice_key}: {i+1}/{len(args)} ({time.time()-t0:.0f}s)', flush=True)
        print(f'{voice_key} done in {time.time()-t0:.0f}s', flush=True)
    manifest = {'v': 1, 'base': BASE_URL, 'items': items}
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=1)
    size = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(out_dir) for fn in fns)
    print(f'wrote {MANIFEST} ({len(items)} lessons) - audio total {size/1e6:.0f} MB')

if __name__ == '__main__':
    main()
