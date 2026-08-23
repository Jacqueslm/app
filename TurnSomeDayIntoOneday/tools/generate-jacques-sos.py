"""Generate audio/sos-talk-jacques.mp3 + its cue line, in Jacques's own voice.

Mirrors generate-sos-talk.py exactly - same STEPS, same gap/pause rhythm, same
cue computation - but synthesizes with coqui YourTTS cloned from his two
reference recordings (the approved "sample-v2-both" configuration).

The printed cues line must be pasted into VG_VOICES in index.html in the same
commit that ships the mp3 - captions are synced to these exact timings.

Run from the TurnSomeDayIntoOneday directory:
    python3 tools/generate-jacques-sos.py <ref1.wav> <ref2.wav>
"""
import json, os, sys
import numpy as np
import lameenc

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(HERE, 'audio')

# Must mirror VG_STEPS in index.html / generate-sos-talk.py exactly.
STEPS = [
    "I'm here with you. You don't have to do anything right now except listen.",
    "This craving is a wave. It rises, it peaks, and it always comes back down. Your only job is to ride it out with me.",
    "Let's slow your body down. Breathe in through your nose... two... three... four.",
    "Now hold it gently... just hold... three... four... five... six... seven.",
    "And breathe out slowly through your mouth... let your shoulders drop... all the way out... six... seven... eight.",
    "Good. Again — breathe in... two... three... four.",
    "Hold... you're doing this... four... five... six... seven.",
    "And slowly out... let everything go... six... seven... eight.",
    "Notice where the urge sits in your body. Don't fight it. Just watch it, like weather passing through.",
    "You have outlasted every craving you have ever had. Every single one. That's why you're still here.",
    "One more. Breathe in... two... three... four.",
    "Hold... almost there... five... six... seven.",
    "And out... nice and slow... six... seven... eight.",
    "The wave is already losing power. You don't need to be perfect today. You just need this next minute — and you're already in it.",
    "Stay here breathing with the circle as long as you like. When you're ready, tap the button and go do the next small thing.",
]

GAP_S = 0.6
COUNT_PAUSE_S = 0.55

if len(sys.argv) != 3:
    sys.exit('usage: python3 tools/generate-jacques-sos.py <ref1.wav> <ref2.wav>')
refs = [sys.argv[1], sys.argv[2]]

from TTS.api import TTS
tts = TTS('tts_models/multilingual/multi-dataset/your_tts', progress_bar=False)
rate = tts.synthesizer.output_sample_rate


def synth(text):
    wav = tts.tts(text=text.replace('—', ','), speaker_wav=refs, language='en')
    return np.clip(np.array(wav) * 32767, -32768, 32767).astype(np.int16)


def trim(a, thresh=300):
    idx = np.where(np.abs(a.astype(np.int32)) > thresh)[0]
    if not len(idx):
        return a
    pad = int(0.08 * rate)
    return a[max(0, idx[0] - pad):min(len(a), idx[-1] + pad)]


silence_gap = np.zeros(int(GAP_S * rate), dtype=np.int16)
silence_count = np.zeros(int(COUNT_PAUSE_S * rate), dtype=np.int16)

os.makedirs(OUT_DIR, exist_ok=True)
cues, out, pos = [], [], 0
for text in STEPS:
    cues.append(round(pos / rate, 2))
    pieces = [p.strip() for p in text.split('...') if p.strip()]
    parts = []
    for i, piece in enumerate(pieces):
        parts.append(trim(synth(piece)))
        if i < len(pieces) - 1:
            parts.append(silence_count)
    step_audio = np.concatenate(parts)
    out.append(step_audio)
    out.append(silence_gap)
    pos += len(step_audio) + len(silence_gap)

pcm = np.concatenate(out)
enc = lameenc.Encoder()
enc.set_bit_rate(64)
enc.set_in_sample_rate(rate)
enc.set_channels(1)
enc.set_quality(2)
mp3 = enc.encode(pcm.tobytes()) + enc.flush()
path = os.path.join(OUT_DIR, 'sos-talk-jacques.mp3')
with open(path, 'wb') as f:
    f.write(bytes(mp3))
print(f'wrote {path} ({len(mp3)/1024:.0f} KB, {len(pcm)/rate:.1f}s)')
print(f'  jacques: cues={json.dumps(cues)}')
