"""Generate audio/sos-talk.mp3 + the VG_CUES timeline for index.html.

The SOS "Talk me through it" voice is a pre-recorded MP3 because a real
<audio> element is the only audio Android keeps playing when the screen locks.
This script builds that MP3 locally with Piper TTS - free, no API, no account.

One-time setup (all free):
    pip install piper-tts lameenc numpy
    # Piper's own voice host is huggingface; the same files are mirrored in
    # sherpa-onnx's GitHub releases, which is what this uses:
    curl -L -o vits-piper.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-lessac-medium.tar.bz2
    tar xjf vits-piper.tar.bz2

Run from the TurnSomeDayIntoOneday directory:
    python3 tools/generate-sos-talk.py path/to/vits-piper-en_US-lessac-medium/en_US-lessac-medium.onnx

It writes audio/sos-talk.mp3 and prints the cue list. If STEPS below ever
changes, VG_STEPS and VG_CUES in index.html MUST be updated in the same commit -
the captions are synced to these exact timings.
"""
import json, os, sys
import numpy as np
import lameenc
from piper import PiperVoice, SynthesisConfig

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_MP3 = os.path.join(HERE, 'audio', 'sos-talk.mp3')

# Must mirror VG_STEPS in index.html exactly.
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

GAP_S = 0.6          # silence between steps, matches the speechSynthesis pacing
COUNT_PAUSE_S = 0.55 # breathing-count pause where the script writes "..."

if len(sys.argv) != 2:
    sys.exit("usage: python3 tools/generate-sos-talk.py path/to/en_US-lessac-medium.onnx")

voice = PiperVoice.load(sys.argv[1])
rate = voice.config.sample_rate
cfg = SynthesisConfig(length_scale=1.12)  # a touch slower = calmer

def synth(text):
    chunks = [np.frombuffer(c.audio_int16_bytes, dtype=np.int16)
              for c in voice.synthesize(text.replace("—", ","), cfg)]
    return np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.int16)

def trim(a, thresh=300):
    # trim leading/trailing near-silence so our own gaps set the rhythm
    idx = np.where(np.abs(a.astype(np.int32)) > thresh)[0]
    if not len(idx):
        return a
    pad = int(0.08 * rate)
    return a[max(0, idx[0] - pad):min(len(a), idx[-1] + pad)]

silence_gap = np.zeros(int(GAP_S * rate), dtype=np.int16)
silence_count = np.zeros(int(COUNT_PAUSE_S * rate), dtype=np.int16)

cues, out, pos = [], [], 0
for text in STEPS:
    cues.append(round(pos / rate, 2))
    # "..." carries the breathing pace; Piper reads it too fast, so each beat
    # is synthesized alone and the pause inserted as real silence.
    pieces = [p.strip() for p in text.split("...") if p.strip()]
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

os.makedirs(os.path.dirname(OUT_MP3), exist_ok=True)
with open(OUT_MP3, 'wb') as f:
    f.write(bytes(mp3))

print("wrote", OUT_MP3, f"({len(mp3)/1024:.0f} KB, {len(pcm)/rate:.1f}s)")
print("VG_CUES=[" + ",".join(str(c) for c in cues) + "];")
