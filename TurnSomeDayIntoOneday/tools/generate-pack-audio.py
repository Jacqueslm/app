#!/usr/bin/env python3
"""Voice the themed packs (the Spiritual Path + the nine 7-day packs).

The third source of lesson text, and the one the other two generators miss.
generate-lesson-audio.py reads data/lessons.json (days 1-30 per track) and
generate-phase-audio.py reads data/phases.json (days 31-90); the packs live in
PREDEFINED_PACKS inside index.html and were voiced by neither.

    node tools/dump-packs.js > /tmp/packs.json     # or extract however you like
    PACK_ONLY=deep python3 tools/generate-pack-audio.py <packs.json> <voices> <out>

NOTE, 27 Aug 2026: the pack recordings the five stock voices already have use a
hash that is IDENTICAL across all five, and it matches no hash of the current
pack text. They were generated from older wording by a script that is gone, and
have never been regenerated - so those five are stale against what the app now
shows on screen. This file uses the same per-voice hash as the other two
generators, which means a voice built here says what the lesson actually says.
"""
import hashlib, json, multiprocessing as mp, os, re, sys, time

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(HERE, 'data', 'lesson-audio-manifest.json')
MP3_KBPS = 40
LENGTH_SCALE = 1.05

VOICES = {
    'warm':   'vits-piper-en_US-kristin-medium/en_US-kristin-medium.onnx',
    'soft':   'vits-piper-en_GB-cori-medium/en_GB-cori-medium.onnx',
    'gentle': 'vits-piper-en_US-kathleen-low/en_US-kathleen-low.onnx',
    'clear':  'vits-piper-en_US-ljspeech-high/en_US-ljspeech-high.onnx',
    'male':   'vits-piper-en_US-john-medium/en_US-john-medium.onnx',
    'deep':   'vits-piper-en_US-joe-medium/en_US-joe-medium.onnx',
}

def slug(s):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower())).strip('-')

def lesson_text(l):
    t = f"{l.get('title','')}. {l.get('content','')}"
    if l.get('action'):
        t += "\n\nToday's action: " + l['action']
    if l.get('reflection'):
        t += "\n\nSomething to reflect on: " + l['reflection']
    return t

def collect_jobs(packs):
    jobs = []  # (manifest_key, slug_name, day, text)
    for pack_id, pack in packs.items():
        for l in pack.get('lessons', []):
            jobs.append((f"pack:{pack_id}|{l['day']}|base", slug(pack_id), l['day'], lesson_text(l)))
    return jobs

def rel_path(voice_key, name, day, text):
    h = hashlib.sha1((voice_key + '\x00' + text).encode('utf-8')).hexdigest()[:10]
    return f"{voice_key}/{name}-d{day}-{h}.mp3"

_engine = _rate = None
def _init(model_path):
    global _engine, _rate
    from piper import PiperVoice
    _engine = PiperVoice.load(model_path); _rate = _engine.config.sample_rate

def _synth(args):
    import numpy as np, lameenc
    from piper import SynthesisConfig
    vk, key, name, day, text, out_dir = args
    rel = rel_path(vk, name, day, text)
    path = os.path.join(out_dir, rel)
    if not os.path.exists(path):
        cfg = SynthesisConfig(length_scale=LENGTH_SCALE)
        chunks = [np.frombuffer(c.audio_int16_bytes, dtype=np.int16)
                  for c in _engine.synthesize(text, cfg)]
        audio = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.int16)
        enc = lameenc.Encoder()
        enc.set_bit_rate(MP3_KBPS); enc.set_in_sample_rate(_rate)
        enc.set_channels(1); enc.set_quality(2)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(enc.encode(audio.tobytes()) + enc.flush())
    return (key, vk, rel)

def main():
    if len(sys.argv) != 4:
        sys.exit('usage: generate-pack-audio.py <packs.json> <voices-folder> <out-folder>')
    packs = json.load(open(sys.argv[1], encoding='utf-8'))
    base, out_dir = sys.argv[2], sys.argv[3]
    jobs = collect_jobs(packs)
    only = os.environ.get('PACK_ONLY', '').strip()
    voices = {k: v for k, v in VOICES.items() if k == only} if only else VOICES
    print(f'{len(jobs)} pack lessons x {len(voices)} voice(s)', flush=True)
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    items = manifest['items']
    for vk, rel_model in voices.items():
        t0 = time.time()
        args = [(vk, k, n, d, t, out_dir) for (k, n, d, t) in jobs]
        with mp.Pool(max(1, (os.cpu_count() or 2)), initializer=_init,
                     initargs=(os.path.join(base, rel_model),)) as pool:
            for i, (key, v, rel) in enumerate(pool.imap_unordered(_synth, args, chunksize=2)):
                items.setdefault(key, {})[v] = rel
                if (i + 1) % 25 == 0:
                    print(f'  {vk}: {i+1}/{len(args)} ({time.time()-t0:.0f}s)', flush=True)
        print(f'{vk} done in {time.time()-t0:.0f}s', flush=True)
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=1)
    print(f'manifest updated ({len(items)} keys)', flush=True)

if __name__ == '__main__':
    main()
