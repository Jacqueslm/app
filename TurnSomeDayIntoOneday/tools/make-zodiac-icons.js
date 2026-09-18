// The home-screen icon for Life's Zodiacs, drawn rather than downloaded.
//
//   node tools/make-zodiac-icons.js
//
// Writes icons/zodiacs-192.png and icons/zodiacs-512.png.
//
// WHY THIS EXISTS: key.html already draws its own icon as an inline SVG data
// URI (the apple-touch-icon), and that was enough while the page was only ever
// opened in a tab. Once the page can be SAVED to a home screen, Android and
// Chrome want real PNG files named in a manifest — an SVG data URI is not a
// file a manifest can point at. Rather than ship the recovery app's icon on the
// Zodiacs page (wrong app, wrong picture), the same drawing is rendered here
// into two PNGs: dark ground, gold ring, gold mark above it.
//
// No image library and no browser is needed — a PNG is a header, the pixels and
// three CRC-checked chunks, so it is written by hand. That keeps this runnable
// on the hosting box, where nothing else can draw.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');

/* ---- the drawing, taken from the apple-touch-icon in key.html --------------
   That SVG is a 180x180 square: ground #07060d, a ring of radius 54 at the
   centre stroked 7 wide, and a filled dot of radius 10 sitting on the top edge
   of the ring. Everything below is those numbers as fractions of the side, so
   the same picture comes out at any size. */
const GROUND = [0x07, 0x06, 0x0d];
const GOLD = [0xe8, 0xc0, 0x7a];
const RING_R = 54 / 180;
const RING_W = 7 / 180;
const DOT_R = 10 / 180;
const DOT_Y = 36 / 180;

function pixel(size, x, y) {
  const cx = (x + 0.5) / size - 0.5;   // -0.5 .. 0.5, centre of the square
  const cy = (y + 0.5) / size - 0.5;
  const d = Math.hypot(cx, cy);
  if (Math.abs(d - RING_R) <= RING_W / 2) return GOLD;
  const dot = Math.hypot(cx, cy + 0.5 - DOT_Y);   // the mark sits above centre
  if (dot <= DOT_R) return GOLD;
  return GROUND;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let at = 0;
  for (let y = 0; y < size; y++) {
    raw[at++] = 0;                       // filter: none
    for (let x = 0; x < size; x++) {
      const p = pixel(size, x, y);
      raw[at++] = p[0]; raw[at++] = p[1]; raw[at++] = p[2]; raw[at++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const file = path.join(OUT, `zodiacs-${size}.png`);
  fs.writeFileSync(file, png(size));
  console.log(`${path.relative(path.join(__dirname, '..'), file)}  ${fs.statSync(file).size} bytes`);
}
