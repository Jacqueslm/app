// Photo tools — the pure parts. Filter strings and geometry only, no I/O, so
// every number in here is unit-tested instead of eyeballed in a render.
//
// Four of these are genuinely free (ffmpeg or a local model) and three cost,
// because they need a generation model. Which is which is stated on the button,
// never implied.

// ---------------------------------------------------------------- upscaler
// Free. Lanczos is the best of ffmpeg's built-in scalers for enlarging, and a
// light unsharp afterwards puts back the edge that any interpolation softens.
// This is NOT an AI upscaler and does not invent detail — it makes a small
// picture usable at a bigger size, which is what "my footage looks soft on a
// 1080 timeline" actually needs.
const UPSCALE_TARGETS = {
  '1080': 1080,
  '1440': 1440,
  '4k': 2160,
};

// Sharpening has to come down as the jump goes up: a 4x enlargement is already
// mushy, and a heavy unsharp on top turns mush into crunch. Measured in
// luma_amount for ffmpeg's unsharp.
function sharpenFor(factor) {
  if (factor >= 3) return 0.5;
  if (factor >= 2) return 0.7;
  return 0.9;
}

function upscaleFilter(srcW, srcH, targetKey, sharpen = true) {
  const shortSide = UPSCALE_TARGETS[targetKey];
  if (!shortSide) return null;
  if (!(srcW > 0) || !(srcH > 0)) return null;
  // Scale by the SHORT side so a vertical video reaches the target height and
  // a landscape one reaches the target width. Scaling by height alone made
  // 9:16 clips enormous and 16:9 clips barely change.
  const src = Math.min(srcW, srcH);
  const factor = shortSide / src;
  // Never "upscale" downward — that is a different tool and a silent quality
  // loss if it happens by accident.
  if (factor <= 1.001) return null;
  const even = (n) => 2 * Math.round(n / 2);
  const w = even(srcW * factor);
  const h = even(srcH * factor);
  const parts = [`scale=${w}:${h}:flags=lanczos`];
  if (sharpen) parts.push(`unsharp=5:5:${sharpenFor(factor).toFixed(2)}:5:5:0.0`);
  return { filter: parts.join(','), width: w, height: h, factor: Number(factor.toFixed(3)) };
}

// ------------------------------------------------------------- text remover
// Free. delogo was built for station idents but it is the same job: pick the
// rectangle, and it rebuilds the inside by interpolating from the border. It
// works well over flat or gently varying areas (sky, wall, table, blurred
// background) and poorly over detail — which is honest to say on the button
// rather than discover in a render.
//
// Boxes arrive as fractions of the frame (0..1) so the same box works whatever
// resolution the source is.
function delogoFilter(boxes, W, H) {
  if (!Array.isArray(boxes) || !boxes.length) return null;
  if (!(W > 0) || !(H > 0)) return null;
  const out = [];
  for (const b of boxes) {
    const fx = Number(b.x), fy = Number(b.y), fw = Number(b.w), fh = Number(b.h);
    if (![fx, fy, fw, fh].every((n) => Number.isFinite(n))) continue;
    if (!(fw > 0) || !(fh > 0)) continue;
    // delogo needs at least a 1px border inside the frame to sample from, so
    // a box touching the edge is pulled in rather than rejected.
    const x = Math.max(1, Math.round(fx * W));
    const y = Math.max(1, Math.round(fy * H));
    const w = Math.max(2, Math.min(Math.round(fw * W), W - x - 1));
    const h = Math.max(2, Math.min(Math.round(fh * H), H - y - 1));
    if (w < 2 || h < 2) continue;
    out.push(`delogo=x=${x}:y=${y}:w=${w}:h=${h}`);
  }
  return out.length ? out.join(',') : null;
}

// ---------------------------------------------------------- passport photos
// Free. US spec, which is also what most countries accept: 2x2 inches at
// 300dpi = 600x600, head 50%-69% of the frame height, eye line 56%-69% up from
// the bottom. Targets sit mid-range so a slightly-off face detection still
// lands inside the legal window.
const PASSPORT = {
  size: 600,
  headFraction: 0.58,   // head height as a share of the square
  eyeFromTop: 0.41,     // 1-0.59; eyes 59% up from the bottom
  // A browser FaceDetector box is roughly brow-to-chin, not the whole head.
  // Hair and the crown add about half again — measured against real detections,
  // not guessed, because getting this wrong is what makes passport crops fail.
  faceToHead: 1.5,
  eyeInFace: 0.42,      // eye line sits ~42% down the detected face box
};

// Returns the square crop in SOURCE pixels, clamped to the image. Returns null
// when the correct crop would fall outside the picture — better to say "stand
// further back and retake it" than to silently deliver a non-compliant photo.
function passportCrop(face, imgW, imgH, spec = PASSPORT) {
  if (!face || !(imgW > 0) || !(imgH > 0)) return null;
  const fw = Number(face.width), fh = Number(face.height);
  const fx = Number(face.x), fy = Number(face.y);
  if (![fx, fy, fw, fh].every((n) => Number.isFinite(n)) || fw <= 0 || fh <= 0) return null;

  const headH = fh * spec.faceToHead;
  const side = Math.round(headH / spec.headFraction);
  const eyeY = fy + fh * spec.eyeInFace;
  const left = Math.round(fx + fw / 2 - side / 2);
  const top = Math.round(eyeY - side * spec.eyeFromTop);

  if (side > imgW || side > imgH) {
    return { error: 'The face fills too much of this photo for a passport crop. Retake it from further back so there is space above the head and either side of the shoulders.' };
  }
  if (left < 0 || top < 0 || left + side > imgW || top + side > imgH) {
    return { error: 'There is not enough room around the head for a compliant crop. Retake it with the whole head and some space above it in frame.' };
  }
  return { x: left, y: top, side, outSize: spec.size };
}

// ------------------------------------------------- AI restyles (these cost)
// One engine, three prompts. Each is written to change ONE thing and hold
// everything else, because an edit model left to its own devices redraws the
// whole picture and the result stops being a photo of that person.
const RESTYLE = {
  genderswap: {
    label: 'Gender swap',
    prompt: 'Show this same person as the opposite gender. Keep their exact age, skin tone, ethnicity, body type, expression, pose, clothing style, lighting and background identical. Change only the facial structure, hair and features that read as gender. It must still be recognisably the same individual.',
  },
  caricature: {
    label: 'Caricature',
    prompt: 'Turn this photograph into a hand-drawn caricature illustration: exaggerate the most distinctive features affectionately, keep the person clearly recognisable, keep their clothing and the setting, warm friendly tone, clean line work with soft colour. Not grotesque, not insulting.',
  },
  hairstyle: {
    label: 'Hairstyle',
    // filled in per style below
    prompt: null,
  },
};

const HAIRSTYLES = {
  buzz: 'a very short buzz cut',
  short: 'a short tidy modern cut',
  medium: 'a medium-length layered style',
  long: 'long flowing hair past the shoulders',
  curly: 'natural tight curls',
  waves: 'soft loose waves',
  braids: 'neat shoulder-length braids',
  locs: 'shoulder-length locs',
  afro: 'a full rounded afro',
  bob: 'a sharp chin-length bob',
  ponytail: 'hair pulled back into a high ponytail',
  bald: 'a completely shaved head',
};

const HAIR_COLORS = {
  same: null,
  black: 'jet black',
  brown: 'warm brown',
  blonde: 'blonde',
  red: 'auburn red',
  grey: 'silver grey',
  blue: 'deep blue',
  pink: 'pastel pink',
};

function hairstylePrompt(styleKey, colorKey) {
  const style = HAIRSTYLES[styleKey];
  if (!style) return null;
  const color = HAIR_COLORS[colorKey];
  const hair = color ? `${style}, coloured ${color}` : style;
  return `Change only this person's hair to ${hair}. Keep their face, facial structure, skin tone, age, expression, pose, clothing, lighting and background completely unchanged. The hair must sit naturally on their head with realistic edges against the background. It must still be obviously the same person.`;
}

function restylePrompt(kind, opts = {}) {
  if (kind === 'hairstyle') return hairstylePrompt(opts.style, opts.color);
  const r = RESTYLE[kind];
  return r && r.prompt ? r.prompt : null;
}

// ---------------------------------------------------------- palm reading
// Entertainment, and labelled as entertainment. This exists because Jacques
// asked for it for personal use; it is not part of the recovery app and must
// never be presented as insight into anyone's actual life. The prompt says so
// to the model as well, so the output does not drift into fortune-telling
// people might act on.
const PALM_PROMPT = `Look at this photograph of a palm and write a short, warm, entertainment-only palm reading.

Rules:
- Describe the lines you can actually see in the image (heart, head, life, fate). If a line is not visible, say so rather than inventing it.
- Keep it to about 150 words, in four short paragraphs.
- Warm and playful in tone. Never ominous, never a prediction of illness, death, money loss or relationship breakdown.
- No medical, financial or legal claims of any kind.
- End with one sentence making clear this is for fun.

If the image is not a palm, say only that you cannot see a palm in it.`;

module.exports = {
  UPSCALE_TARGETS,
  upscaleFilter,
  sharpenFor,
  delogoFilter,
  PASSPORT,
  passportCrop,
  RESTYLE,
  HAIRSTYLES,
  HAIR_COLORS,
  hairstylePrompt,
  restylePrompt,
  PALM_PROMPT,
};
