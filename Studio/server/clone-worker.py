# Runs one voice-clone narration in its own process, then exits.
#
# Chatterbox (Resemble AI) is MIT-licensed including its weights, which is why
# it is the model here: speak.js deliberately ships only public-domain/CC0
# voices because videos made in Studio are commercial, and a non-commercial
# clone model would quietly break that promise. Same bar, same reason.
#
# Reads one JSON job from stdin:
#   { ref, text, out, cacheDir, exaggeration?, cfg? }
# Writes { "seconds": float } as JSON on stdout on success.
# Progress lines go to stderr prefixed with "@PCT "; anything else on stderr is
# a real error. Non-zero exit on failure.

import json
import os
import re
import sys


def pct(n):
    sys.stderr.write("@PCT %d\n" % int(n))
    sys.stderr.flush()


def chunk_text(text, limit=280):
    """Chatterbox generates roughly 40 seconds at a time, so a narration
    script has to be broken up or the tail is silently dropped. Split on
    sentence ends, then pack sentences back together up to `limit` characters
    so we make as few passes as possible without cutting mid-thought."""
    text = re.sub(r"\s+", " ", str(text)).strip()
    if not text:
        return []
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks, cur = [], ""
    for s in sentences:
        # A single sentence longer than the limit gets hard-split on commas,
        # and failing that on whitespace - better a seam than a truncation.
        while len(s) > limit:
            cut = s.rfind(",", 0, limit)
            if cut < limit // 2:
                cut = s.rfind(" ", 0, limit)
            if cut <= 0:
                cut = limit
            piece, s = s[:cut].strip(), s[cut:].strip()
            if piece:
                chunks.append(piece)
        if not s:
            continue
        if len(cur) + len(s) + 1 <= limit:
            cur = (cur + " " + s).strip()
        else:
            if cur:
                chunks.append(cur)
            cur = s
    if cur:
        chunks.append(cur)
    return chunks


def main():
    raw = sys.stdin.read()
    try:
        job = json.loads(raw)
    except Exception:
        sys.stderr.write("bad job JSON")
        return 2

    ref = job.get("ref")
    text = job.get("text") or ""
    out = job.get("out")
    if not ref or not os.path.exists(ref):
        sys.stderr.write("the reference voice clip was not found")
        return 1
    if not text.strip():
        sys.stderr.write("no words to speak")
        return 1
    if not out:
        sys.stderr.write("no output path")
        return 1

    # Keep every downloaded weight inside Studio's own cache folder so
    # "where did my disk go" has one answer, and Start fresh can clear it.
    cache = job.get("cacheDir")
    if cache:
        os.makedirs(cache, exist_ok=True)
        os.environ.setdefault("HF_HOME", cache)
        os.environ.setdefault("HUGGINGFACE_HUB_CACHE", cache)
        os.environ.setdefault("TORCH_HOME", cache)

    pct(4)
    try:
        import torch
        import torchaudio
        from chatterbox.tts import ChatterboxTTS
    except Exception as e:
        sys.stderr.write("voice cloning is not installed properly: %s" % e)
        return 1

    # One thread per core is not always faster on CPU for this model and it
    # starves the rest of Studio; leave a core free for the render queue.
    try:
        n = max(1, (os.cpu_count() or 2) - 1)
        torch.set_num_threads(n)
    except Exception:
        pass

    pct(8)
    try:
        model = ChatterboxTTS.from_pretrained(device="cpu")
    except Exception as e:
        sys.stderr.write("could not load the voice model: %s" % e)
        return 1

    pct(25)
    chunks = chunk_text(text)
    if not chunks:
        sys.stderr.write("no words to speak")
        return 1

    kw = {"audio_prompt_path": ref}
    if job.get("exaggeration") is not None:
        kw["exaggeration"] = float(job["exaggeration"])
    if job.get("cfg") is not None:
        kw["cfg_weight"] = float(job["cfg"])

    pieces = []
    for i, chunk in enumerate(chunks):
        try:
            wav = model.generate(chunk, **kw)
        except TypeError:
            # Older/newer signatures may not take the tuning arguments.
            wav = model.generate(chunk, audio_prompt_path=ref)
        except Exception as e:
            sys.stderr.write("the voice model failed on part %d: %s" % (i + 1, e))
            return 1
        pieces.append(wav)
        pct(25 + (70.0 * (i + 1) / len(chunks)))

    try:
        audio = torch.cat(pieces, dim=-1) if len(pieces) > 1 else pieces[0]
        if audio.dim() == 1:
            audio = audio.unsqueeze(0)
        torchaudio.save(out, audio, model.sr)
    except Exception as e:
        sys.stderr.write("could not save the narration: %s" % e)
        return 1

    if not os.path.exists(out) or os.path.getsize(out) == 0:
        sys.stderr.write("no audio was written")
        return 1

    pct(100)
    sys.stdout.write(json.dumps({"seconds": audio.shape[-1] / float(model.sr)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
