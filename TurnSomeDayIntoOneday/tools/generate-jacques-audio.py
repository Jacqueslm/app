"""Add the 'jacques' narrator to the lesson recordings + manifest.

Same contract as generate-lesson-audio.py (read it first), but one voice:
Jacques's own, cloned with coqui YourTTS from his two reference recordings
(the approved "sample-v2-both" configuration - both refs as speaker_wav).
Only the 'jacques' entries in data/lesson-audio-manifest.json are touched;
the five Piper voices keep their existing files untouched.

Run from the TurnSomeDayIntoOneday directory:
    python3 tools/generate-jacques-audio.py <ref1.wav> <ref2.wav> <output-folder>

Then commit the output folder to the `lesson-audio` branch and the updated
manifest to main in the same change.
"""
import hashlib
import json
import multiprocessing as mp
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LESSONS = os.path.join(HERE, 'data', 'lessons.json')
MANIFEST = os.path.join(HERE, 'data', 'lesson-audio-manifest.json')
VOICE_KEY = 'jacques'
MP3_KBPS = 40


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
    jobs = []
    for category, items in packs.items():
        for item in items:
            jobs.append((category, item['day'], 'base', lesson_text(item, 'base')))
            if item.get('single_variant'):
                jobs.append((category, item['day'], 'single', lesson_text(item, 'single')))
            if item.get('family_variant'):
                jobs.append((category, item['day'], 'family', lesson_text(item, 'family')))
    return jobs


def speakable(text):
    """YourTTS's vocabulary has no digits - it silently DROPS them ('2am'
    becomes 'am'). Spell numbers out before synthesis. Hashing stays on the
    raw lesson text, so this never changes file names."""
    from num2words import num2words
    text = text.replace('—', ',').replace('–', ',').replace('%', ' percent').replace('&', ' and ')
    def am_pm(m):
        return num2words(int(m.group(1))) + ' ' + ('a m' if m.group(2).lower().startswith('a') else 'p m')
    text = re.sub(r'\b(\d{1,2})\s*(am|pm|AM|PM)\b', am_pm, text)
    text = re.sub(r'\b(\d{1,2}):(\d{2})\b', lambda m: num2words(int(m.group(1))) + ' ' +
                  ('o\'clock' if m.group(2) == '00' else num2words(int(m.group(2)))), text)
    text = re.sub(r'\$(\d+)', lambda m: num2words(int(m.group(1))) + ' dollars', text)
    text = re.sub(r'\d+', lambda m: num2words(int(m.group(0))), text)
    return text


_tts = None
_refs = None


def _init_worker(refs):
    global _tts, _refs
    from TTS.api import TTS
    _tts = TTS('tts_models/multilingual/multi-dataset/your_tts', progress_bar=False)
    _refs = refs


def _synth_one(args):
    import numpy as np
    import lameenc
    category, day, variant, text, out_dir = args
    h = hashlib.sha1((VOICE_KEY + '\x00' + text).encode('utf-8')).hexdigest()[:10]
    rel = f"{VOICE_KEY}/{slug(category)}-d{day}" + ('' if variant == 'base' else f"-{variant}") + f"-{h}.mp3"
    path = os.path.join(out_dir, rel)
    if os.path.exists(path):
        return (category, day, variant, rel, None)
    # YourTTS reads em-dashes and long pauses awkwardly; commas read naturally.
    wav = _tts.tts(text=speakable(text), speaker_wav=_refs, language='en')
    rate = _tts.synthesizer.output_sample_rate
    audio = np.clip(np.array(wav) * 32767, -32768, 32767).astype(np.int16)
    enc = lameenc.Encoder()
    enc.set_bit_rate(MP3_KBPS)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    mp3 = enc.encode(audio.tobytes()) + enc.flush()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(mp3)
    return (category, day, variant, rel, len(audio) / rate)


def main():
    if len(sys.argv) != 4:
        sys.exit('usage: python3 tools/generate-jacques-audio.py <ref1.wav> <ref2.wav> <output-folder>')
    ref1, ref2, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    refs = [ref1, ref2]
    jobs = collect_jobs()
    print(f'{len(jobs)} lesson texts, {sum(len(j[3]) for j in jobs)} chars')
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    items = manifest['items']
    workers = int(os.environ.get('JACQUES_WORKERS', '3'))
    t0 = time.time()
    args = [(c, d, v, t, out_dir) for (c, d, v, t) in jobs]
    done = 0
    with mp.Pool(workers, initializer=_init_worker, initargs=(refs,)) as pool:
        for (category, day, variant, rel, dur) in pool.imap_unordered(_synth_one, args, chunksize=2):
            key = f'{category}|{day}|{variant}'
            items.setdefault(key, {})[VOICE_KEY] = rel
            done += 1
            if done % 10 == 0:
                print(f'  {done}/{len(args)} ({time.time()-t0:.0f}s)', flush=True)
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=1)
    size = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(out_dir) for fn in fns)
    print(f'done in {time.time()-t0:.0f}s - wrote {MANIFEST}, audio total {size/1e6:.0f} MB')


if __name__ == '__main__':
    main()
