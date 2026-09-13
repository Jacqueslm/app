const { test } = require('node:test');
const assert = require('node:assert');
const {
  upscaleFilter, sharpenFor, delogoFilter, passportCrop, PASSPORT,
  hairstylePrompt, restylePrompt,
} = require('../photo-tools');

/* ---------------- upscaler ---------------- */

test('upscales by the SHORT side so vertical and landscape both land on target', () => {
  // The bug this prevents: scaling by height made a 9:16 clip enormous and a
  // 16:9 clip barely move, for the same "1080" button.
  const vert = upscaleFilter(540, 960, '1080');
  assert.strictEqual(vert.width, 1080);
  const land = upscaleFilter(960, 540, '1080');
  assert.strictEqual(land.height, 1080);
});

test('refuses to run when the source is already big enough', () => {
  // Silently scaling down under an "upscale" button is a quality loss nobody
  // asked for.
  assert.strictEqual(upscaleFilter(1920, 1080, '1080'), null);
  assert.strictEqual(upscaleFilter(3840, 2160, '1440'), null);
});

test('output dimensions are always even, for h264', () => {
  const r = upscaleFilter(533, 941, '1440');
  assert.strictEqual(r.width % 2, 0);
  assert.strictEqual(r.height % 2, 0);
});

test('sharpening eases off as the jump gets bigger', () => {
  assert.ok(sharpenFor(4) < sharpenFor(2));
  assert.ok(sharpenFor(2) < sharpenFor(1.5));
});

test('an unknown target is refused rather than guessed', () => {
  assert.strictEqual(upscaleFilter(640, 480, '8k'), null);
});

/* ---------------- text remover ---------------- */

test('a box in fractions becomes pixels at any resolution', () => {
  const f = delogoFilter([{ x: 0.25, y: 0.5, w: 0.5, h: 0.1 }], 1000, 1000);
  assert.strictEqual(f, 'delogo=x=250:y=500:w=500:h=100');
});

test('a box touching the edge is pulled inside instead of failing', () => {
  // delogo needs a border to sample from; x=0 makes ffmpeg error out.
  const f = delogoFilter([{ x: 0, y: 0, w: 1, h: 1 }], 100, 100);
  assert.ok(f.startsWith('delogo=x=1:y=1:'), f);
  const m = f.match(/w=(\d+):h=(\d+)/);
  assert.ok(Number(m[1]) <= 98 && Number(m[2]) <= 98, f);
});

test('several boxes chain', () => {
  const f = delogoFilter([
    { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
    { x: 0.5, y: 0.5, w: 0.2, h: 0.2 },
  ], 500, 500);
  assert.strictEqual(f.split(',').length, 2);
});

test('junk boxes are dropped, not passed to ffmpeg', () => {
  assert.strictEqual(delogoFilter([{ x: 0.1, y: 0.1, w: 0, h: 0.2 }], 500, 500), null);
  assert.strictEqual(delogoFilter([{ x: 'a', y: 1, w: 1, h: 1 }], 500, 500), null);
  assert.strictEqual(delogoFilter([], 500, 500), null);
});

/* ---------------- passport ---------------- */

test('a well-framed face produces a compliant crop', () => {
  // 1200x1600 portrait, face box 300 wide x 400 tall starting at (450, 300).
  const c = passportCrop({ x: 450, y: 300, width: 300, height: 400 }, 1200, 1600);
  assert.ok(!c.error, c.error);
  // head = 400*1.5 = 600; side = 600/0.58 ≈ 1034
  assert.strictEqual(c.side, Math.round(400 * PASSPORT.faceToHead / PASSPORT.headFraction));
  assert.strictEqual(c.outSize, 600);
  // the crop must be square and inside the image
  assert.ok(c.x >= 0 && c.y >= 0);
  assert.ok(c.x + c.side <= 1200 && c.y + c.side <= 1600);
});

test('the eye line lands where the passport spec wants it', () => {
  const face = { x: 450, y: 300, width: 300, height: 400 };
  const c = passportCrop(face, 1200, 1600);
  const eyeSrc = face.y + face.height * PASSPORT.eyeInFace;
  const eyeInCrop = (eyeSrc - c.y) / c.side;
  // spec allows 0.31..0.44 from the top; we aim at 0.41
  assert.ok(Math.abs(eyeInCrop - PASSPORT.eyeFromTop) < 0.01, `eye at ${eyeInCrop}`);
});

test('a face filling the frame is refused with a reason, not silently cropped', () => {
  const c = passportCrop({ x: 10, y: 10, width: 900, height: 1400 }, 1000, 1500);
  assert.ok(c.error);
  assert.match(c.error, /further back/i);
});

test('a head too close to the top is refused', () => {
  // No room above the crown — a crop here would cut the head off.
  const c = passportCrop({ x: 400, y: 5, width: 300, height: 400 }, 1200, 1600);
  assert.ok(c.error);
});

test('no face, no crop', () => {
  assert.strictEqual(passportCrop(null, 1200, 1600), null);
  assert.strictEqual(passportCrop({ x: 1, y: 1, width: 0, height: 5 }, 1200, 1600), null);
});

/* ---------------- restyle prompts ---------------- */

test('every restyle prompt insists the person stays recognisable', () => {
  for (const kind of ['genderswap', 'caricature']) {
    const p = restylePrompt(kind);
    assert.match(p, /recognisab/i, `${kind} does not protect identity`);
  }
});

test('hairstyle changes hair and explicitly holds the face', () => {
  const p = hairstylePrompt('locs', 'same');
  assert.match(p, /locs/);
  assert.match(p, /face[^.]*unchanged|unchanged/i);
  assert.ok(!/coloured/.test(p), 'colour "same" should not add a colour instruction');
});

test('a hair colour is added only when one was chosen', () => {
  assert.match(hairstylePrompt('bob', 'pink'), /pastel pink/);
});

test('unknown styles are refused rather than sent as a blank prompt', () => {
  assert.strictEqual(hairstylePrompt('mullet', 'same'), null);
  assert.strictEqual(restylePrompt('nonsense'), null);
});
