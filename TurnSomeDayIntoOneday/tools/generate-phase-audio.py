"""Voice the bootcamp phases (days 31-90) for every narrator.

Days 1-30 are separate lessons per track, so one recording covers one lesson.
Days 31-90 (data/phases.json) are shared lessons personalised per track via
{{habit}} - the same day reads "drinking" on Alcohol and "porn" on Porn & Sex -
so each phase day needs one recording PER TRACK: 12 tracks x 60 days = 720
texts per voice. Keys land in data/lesson-audio-manifest.json exactly like the
day 1-30 entries ("<Track>|<day>|base"), which the app already looks up - no
app change needed.

Voices are the license-clean Piper set (public domain / CC0 - the same set the
SOS talk was rebuilt with on 8 Aug; check MODEL_CARD before ever changing one),
plus 'jacques' cloned with YourTTS from his approved reference recordings.

Piper narrators:
    python3 tools/generate-phase-audio.py piper <voices-folder> <output-folder>
Jacques:
    python3 tools/generate-phase-audio.py jacques <ref1.wav> <ref2.wav> <output-folder>

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
PHASES = os.path.join(HERE, 'data', 'phases.json')
MANIFEST = os.path.join(HERE, 'data', 'lesson-audio-manifest.json')
MP3_KBPS = 40
LENGTH_SCALE = 1.05  # same conversational pace as the day 1-30 recordings

# Must mirror HABIT_WORDS in index.html.
HABIT_WORDS = {'Alcohol': 'drinking', 'Porn & Sex': 'porn', 'Smoking': 'smoking',
               'Substances': 'using', 'Gambling': 'gambling', 'Social media': 'the scroll',
               'Gaming': 'gaming', 'Food / Binging': 'binging', 'Shopping / Spending': 'the spending',
               'Work': 'overworking', 'Anger & Control': 'the anger', 'Other': 'the habit'}

# License-clean set only (public domain / CC0). hfc_*, ryan, lessac, amy are
# NOT usable - see reference/asset-licenses-2026-08-08.md.
PIPER_VOICES = {
    'warm':   'vits-piper-en_US-kristin-medium/en_US-kristin-medium.onnx',
    'soft':   'vits-piper-en_GB-cori-medium/en_GB-cori-medium.onnx',
    'gentle': 'vits-piper-en_US-kathleen-low/en_US-kathleen-low.onnx',
    'clear':  'vits-piper-en_US-ljspeech-high/en_US-ljspeech-high.onnx',
    'male':   'vits-piper-en_US-john-medium/en_US-john-medium.onnx',
}


def slug(s):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower())).strip('-')


def speakable(text):
    """YourTTS drops digits from its vocabulary; spell numbers out. Piper
    handles digits, but the same spoken form keeps all narrators consistent."""
    from num2words import num2words
    text = text.replace('—', ',').replace('–', ',').replace('%', ' percent')
    def am_pm(m):
        return num2words(int(m.group(1))) + ' ' + ('a m' if m.group(2).lower().startswith('a') else 'p m')
    text = re.sub(r'\b(\d{1,2})\s*(am|pm|AM|PM)\b', am_pm, text)
    text = re.sub(r'\b(\d{1,2}):(\d{2})\b', lambda m: num2words(int(m.group(1))) + ' ' +
                  ('o\'clock' if m.group(2) == '00' else num2words(int(m.group(2)))), text)
    text = re.sub(r'\$(\d+)', lambda m: num2words(int(m.group(1))) + ' dollars', text)
    text = re.sub(r'\d+', lambda m: num2words(int(m.group(0))), text)
    return text


def collect_jobs():
    lessons = json.load(open(PHASES, encoding='utf-8'))['lessons']
    jobs = []  # (track, day, text)
    for track, word in HABIT_WORDS.items():
        sub = lambda t: str(t or '').replace('{{habit}}', word)
        for l in lessons:
            text = f"{sub(l['title'])}. {sub(l['content'])}"
            if l.get('action'):
                text += "\n\nToday's action: " + sub(l['action'])
            if l.get('reflection'):
                text += "\n\nSomething to reflect on: " + sub(l['reflection'])
            jobs.append((track, l['day'], text))
    return jobs


def rel_path(voice_key, track, day, text):
    h = hashlib.sha1((voice_key + '\x00' + text).encode('utf-8')).hexdigest()[:10]
    return f"{voice_key}/{slug(track)}-d{day}-{h}.mp3"


def encode_mp3(audio_int16, rate):
    import lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(MP3_KBPS)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    return enc.encode(audio_int16.tobytes()) + enc.flush()


_engine = None
_rate = None
_refs = None


def _init_piper(model_path):
    global _engine, _rate
    from piper import PiperVoice
    _engine = PiperVoice.load(model_path)
    _rate = _engine.config.sample_rate


def _synth_piper(args):
    import numpy as np
    from piper import SynthesisConfig
    voice_key, track, day, text, out_dir = args
    rel = rel_path(voice_key, track, day, text)
    path = os.path.join(out_dir, rel)
    if os.path.exists(path):
        return (track, day, voice_key, rel)
    cfg = SynthesisConfig(length_scale=LENGTH_SCALE)
    chunks = [np.frombuffer(c.audio_int16_bytes, dtype=np.int16)
              for c in _engine.synthesize(speakable(text), cfg)]
    audio = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.int16)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(encode_mp3(audio, _rate))
    return (track, day, voice_key, rel)


def _init_jacques(refs):
    global _engine, _rate, _refs
    from TTS.api import TTS
    _engine = TTS('tts_models/multilingual/multi-dataset/your_tts', progress_bar=False)
    _rate = _engine.synthesizer.output_sample_rate
    _refs = refs


def _synth_jacques(args):
    import numpy as np
    voice_key, track, day, text, out_dir = args
    rel = rel_path(voice_key, track, day, text)
    path = os.path.join(out_dir, rel)
    if os.path.exists(path):
        return (track, day, voice_key, rel)
    wav = _engine.tts(text=speakable(text), speaker_wav=_refs, language='en')
    audio = np.clip(np.array(wav) * 32767, -32768, 32767).astype(np.int16)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(encode_mp3(audio, _rate))
    return (track, day, voice_key, rel)


def run_pool(voice_key, jobs, out_dir, workers, init, initargs, synth):
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    items = manifest['items']
    t0 = time.time()
    args = [(voice_key, tr, d, t, out_dir) for (tr, d, t) in jobs]
    with mp.Pool(workers, initializer=init, initargs=initargs) as pool:
        for i, (track, day, vk, rel) in enumerate(pool.imap_unordered(synth, args, chunksize=4)):
            items.setdefault(f'{track}|{day}|base', {})[vk] = rel
            if (i + 1) % 50 == 0:
                print(f'  {vk}: {i+1}/{len(args)} ({time.time()-t0:.0f}s)', flush=True)
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=1)
    print(f'{voice_key} done in {time.time()-t0:.0f}s', flush=True)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    jobs = collect_jobs()
    print(f'{len(jobs)} phase texts ({len(HABIT_WORDS)} tracks x {len(jobs)//len(HABIT_WORDS)} days), {sum(len(j[2]) for j in jobs)} chars')
    workers = int(os.environ.get('PHASE_WORKERS', '2'))
    if mode == 'piper' and len(sys.argv) == 4:
        base, out_dir = sys.argv[2], sys.argv[3]
        for vk, rel_model in PIPER_VOICES.items():
            run_pool(vk, jobs, out_dir, workers, _init_piper,
                     (os.path.join(base, rel_model),), _synth_piper)
    elif mode == 'jacques' and len(sys.argv) == 5:
        refs, out_dir = [sys.argv[2], sys.argv[3]], sys.argv[4]
        run_pool('jacques', jobs, out_dir, workers, _init_jacques, (refs,), _synth_jacques)
    else:
        sys.exit('usage: generate-phase-audio.py piper <voices-folder> <out> | jacques <ref1> <ref2> <out>')


if __name__ == '__main__':
    main()
