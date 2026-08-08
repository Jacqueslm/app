"""Generate the three SOS "Talk me through it" recordings + their cue timelines.

The SOS talk plays as pre-recorded MP3s because a real <audio> element is the
only audio Android keeps playing when the screen locks. The app offers three
voices (Warm / Soft / Clear - VG_VOICES in index.html) plus the phone's own
speech engine; this script builds the three recordings locally with Piper TTS -
free, no API, no account.

One-time setup (all free):
    pip install piper-tts lameenc numpy
    # Piper's own voice host is huggingface; the same files are mirrored in
    # sherpa-onnx's GitHub releases, which is what this uses:
    for v in vits-piper-en_US-kristin-medium vits-piper-en_GB-cori-medium vits-piper-en_US-kathleen-low vits-piper-en_US-ljspeech-high vits-piper-en_US-norman-medium; do
        curl -L -o $v.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/$v.tar.bz2
        tar xjf $v.tar.bz2
    done

Run from the TurnSomeDayIntoOneday directory:
    python3 tools/generate-sos-talk.py path/to/folder-containing-the-three-voice-folders

It writes audio/sos-talk-{warm,soft,clear}.mp3 and prints the VG_VOICES cue
lines. If STEPS below ever changes, VG_STEPS and VG_VOICES in index.html MUST
be updated in the same commit - captions are synced to these exact timings.

REQUIRED LAST STEP - soften, then match the loudness. The models come out up
to 6dB apart, which means switching voice in the app means reaching for the
volume button mid-crisis. The three voices in SOFTENED also get an EQ that
rolls off the sharp top end and eases the sibilance - that, plus their slower
length_scale, is what makes them calmer to listen to. Run this over each file
afterwards (two-pass, so the level change is straight gain and never pumps):

    SOFTEN='treble=g=-5:f=3800,equalizer=f=6500:t=q:w=1.4:g=-4,lowpass=f=8500,'
    for v in warm soft gentle clear male; do
      case $v in gentle|clear|male) S=$SOFTEN;; *) S='';; esac
      f=audio/sos-talk-$v.mp3
      m=$(ffmpeg -v info -i $f -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 \
          | python3 -c "import sys,json,re;t=sys.stdin.read();j=json.loads(t[t.rfind('{'):t.rfind('}')+1]);print(j['input_i'],j['input_tp'],j['input_lra'],j['input_thresh'])")
      set -- $m
      ffmpeg -y -v error -i $f -af "${S}loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=$1:measured_TP=$2:measured_LRA=$3:measured_thresh=$4:linear=true,aresample=22050" -ac 1 -b:a 64k /tmp/$v.mp3
      mv /tmp/$v.mp3 $f
    done

Loudness normalising does not change the sample count, so the cues printed by
this script stay correct.
"""
import json, os, sys
import numpy as np
import lameenc
from piper import PiperVoice, SynthesisConfig

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(HERE, 'audio')

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

# App voice key -> (Piper model relative to the folder passed on the command
# line, length_scale). Higher length_scale = slower delivery; the two
# soft-spoken voices are paced slower than the rest by design.
#
# EVERY VOICE HERE MUST BE PUBLIC DOMAIN OR CC0, and the MODEL_CARD inside each
# download is where you check. This app charges money, and the best-sounding
# voices in the Piper catalogue - hfc_female, hfc_male, ryan, lessac - are all
# non-commercial or research-only licences. The first version of this script
# used two of them, which took a year of shipping to notice. Read the card.
#
# The catalogue holds exactly THREE licence-clean American women's voices -
# kristin, kathleen and ljspeech - and they are all already in use here. So
# when a voice needs to be calmer, it cannot come from picking a different
# model; it comes from the slower length_scale below plus the softening EQ in
# the post step. Everything softer than this is British and needs a credit
# line, which we chose not to take on.
VOICES = {
    'warm':   ('vits-piper-en_US-kristin-medium/en_US-kristin-medium.onnx', 1.12),   # public domain
    'soft':   ('vits-piper-en_GB-cori-medium/en_GB-cori-medium.onnx', 1.12),         # public domain (LibriVox)
    'gentle': ('vits-piper-en_US-kathleen-low/en_US-kathleen-low.onnx', 1.38),       # CC0
    'clear':  ('vits-piper-en_US-ljspeech-high/en_US-ljspeech-high.onnx', 1.34),     # public domain
    'male':   ('vits-piper-en_US-john-medium/en_US-john-medium.onnx', 1.38),         # public domain
}
# Voices that get the softening EQ as well as the slower pace.
SOFTENED = {'gentle', 'clear', 'male'}

if len(sys.argv) != 2:
    sys.exit("usage: python3 tools/generate-sos-talk.py path/to/folder-with-voice-folders")
base = sys.argv[1]

os.makedirs(OUT_DIR, exist_ok=True)
for key, (rel, length_scale) in VOICES.items():
    voice = PiperVoice.load(os.path.join(base, rel))
    rate = voice.config.sample_rate
    cfg = SynthesisConfig(length_scale=length_scale)

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
        # "..." carries the breathing pace; Piper reads it too fast, so each
        # beat is synthesized alone and the pause inserted as real silence.
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
    path = os.path.join(OUT_DIR, f'sos-talk-{key}.mp3')
    with open(path, 'wb') as f:
        f.write(bytes(mp3))
    print(f"wrote {path} ({len(mp3)/1024:.0f} KB, {len(pcm)/rate:.1f}s)")
    print(f"  {key}: cues={json.dumps(cues)}")
