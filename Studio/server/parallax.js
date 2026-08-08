// Parallax: pull a flat photo apart into depth layers and move them at
// different speeds, so the picture has actual depth instead of sliding around
// as one sheet. What's close travels furthest, what's far barely moves - the
// same thing that makes scenery outside a car window separate.
//
// Depth comes from a model running on this computer (free, offline after the
// first download, same library the local transcription already uses). If that
// model can't be had, it falls back to assuming the bottom of the picture is
// nearer than the top, which is true of most shots taken standing up and
// still gives real separation.
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const CACHE_DIR = path.join(__dirname, 'model-cache');
const MODEL_ID = process.env.STUDIO_DEPTH_MODEL || 'onnx-community/depth-anything-v2-small';

let depthPipe;
async function getDepth(onPct) {
  if (!depthPipe) {
    depthPipe = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = CACHE_DIR;
      return pipeline('depth-estimation', MODEL_ID, {
        progress_callback: (pr) => {
          if (pr.status === 'progress' && pr.total) onPct && onPct(Math.round((pr.loaded / pr.total) * 100));
        },
      });
    })();
    depthPipe.catch(() => { depthPipe = null; });   // a failed download must not poison retries
  }
  return depthPipe;
}

// Write a greyscale depth image next to the source: white = near, black = far.
// Returns null (never throws) when the model isn't available, so the caller can
// fall back instead of the whole render dying.
async function depthMap(imagePath, outPath, onPct) {
  try {
    const pipe = await getDepth(onPct);
    const out = await pipe(imagePath);
    const img = out && (out.depth || out.predicted_depth);
    if (!img || typeof img.save !== 'function') return null;
    await img.save(outPath);
    return fs.existsSync(outPath) ? outPath : null;
  } catch (_) {
    return null;
  }
}

// No model: a top-to-bottom ramp. Ground is near, sky is far.
function gradientDepth(ffmpeg, w, h, outPath) {
  return run(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi',
    '-i', `gradients=s=${w}x${h}:c0=black:c1=white:x0=0:y0=0:x1=0:y1=${h}`,
    '-frames:v', '1', outPath]).then(() => outPath).catch(() => null);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (c) => { err += c.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-500) || `exit ${code}`))));
  });
}

// How far each layer travels, as a share of the drift budget. The back plate
// is the whole picture so it can never tear; the two cutouts ride on top of it.
const LAYER_TRAVEL = { back: 0.18, mid: 0.55, near: 1 };
// Where the depth map is cut into layers (0-255, higher = nearer).
const MID_LO = 90, NEAR_LO = 165;

// Build the filtergraph. `dir` picks which way the camera slides; `strength`
// 1..3 scales the separation. Everything is composed oversized and the middle
// is cropped out at the end, so a layer sliding off its edge is never visible.
function buildChain({ W, H, dur, fps, dir, strength }) {
  const s = Math.min(3, Math.max(1, Math.round(strength || 2)));
  const drift = [0.05, 0.09, 0.14][s - 1];        // furthest layer's travel, as a share of width
  const OVER = 1.34;
  const even = (n) => 2 * Math.round(n / 2);
  const BW = even(W * OVER), BH = even(H * OVER);
  const vertical = dir === 'up' || dir === 'down';
  // Travel is a share of the axis it happens on - using width for a vertical
  // slide would make it crawl on a portrait video and sprint on a landscape one.
  const px = Math.round((vertical ? BH : BW) * drift);
  // Eased travel, -0.5..0.5 so the shot is centred on its midpoint rather than
  // starting at one extreme and only ever leaving.
  const p = `(t/${dur.toFixed(3)})`;
  const eased = `(${p}*${p}*(3-2*${p}))`;
  const s01 = `(${eased}-0.5)`;
  // Always returns a term that can follow a '+'. Writing a bare minus here
  // produces "+-(" in the overlay expression, which ffmpeg rejects outright -
  // it took a failed render of every vertical direction to find that.
  const off = (share, axis) => {
    const amt = (px * share).toFixed(1);
    const fwd = `(${amt}*${s01})`;
    const back = `(0-${amt}*${s01})`;
    if (dir === 'up') return axis === 'y' ? back : '0';
    if (dir === 'down') return axis === 'y' ? fwd : '0';
    if (dir === 'left') return axis === 'x' ? back : '0';
    return axis === 'x' ? fwd : '0';   // right, the default
  };
  const at = (share) => {
    const x = off(share, 'x'), y = off(share, 'y');
    return { x: `(main_w-overlay_w)/2+${x}`, y: `(main_h-overlay_h)/2+${y}` };
  };

  // Layers are drawn a little larger than the canvas so their own travel never
  // exposes an edge.
  const LW = even(BW * 1.12), LH = even(BH * 1.12);
  const fit = `scale=${LW}:${LH}:force_original_aspect_ratio=increase,crop=${LW}:${LH},setsar=1`;
  // A soft edge on each cutout hides the fact the mask is only approximate -
  // a hard edge round a person is what makes this look like a cheap collage.
  const mask = (lo, hi) =>
    `scale=${LW}:${LH},format=gray,` +
    `lut=y='if(between(val,${lo},${hi}),255,0)',` +
    `gblur=sigma=6`;

  const back = at(LAYER_TRAVEL.back), mid = at(LAYER_TRAVEL.mid), near = at(LAYER_TRAVEL.near);
  return [
    `[0:v]${fit},split=4[im0][imfill][im1][im2]`,
    `[1:v]split=3[dfill][d0][d1]`,
    // Everything lifted onto a faster layer leaves a hole in the plate behind
    // it. Left alone you see the same object twice - once creeping along on
    // the plate, once racing on the cutout. The hole is patched with a heavily
    // blurred copy of the picture, which reads as an out-of-focus background
    // rather than a hole, and a wider blur on this mask makes the patch spill
    // past the cutout's edge so no hard rim shows.
    `[dfill]scale=${LW}:${LH},format=gray,lut=y='if(gte(val,${MID_LO}),255,0)',gblur=sigma=18[fillmask]`,
    `[d0]${mask(MID_LO, NEAR_LO - 1)}[mmask]`,
    `[d1]${mask(NEAR_LO, 255)}[nmask]`,
    `[imfill]gblur=sigma=34,format=rgba[blurred]`,
    `[blurred][fillmask]alphamerge[patch]`,
    `[im0][patch]overlay=0:0[plate]`,
    `[im1]format=rgba[midsrc]`,
    `[im2]format=rgba[nearsrc]`,
    `[midsrc][mmask]alphamerge[midl]`,
    `[nearsrc][nmask]alphamerge[nearl]`,
    // canvas -> patched back plate -> middle -> near
    `color=c=black:s=${BW}x${BH}:d=${dur.toFixed(3)}:r=${fps}[canvas]`,
    `[canvas][plate]overlay=x='${back.x}':y='${back.y}':shortest=1[s1]`,
    `[s1][midl]overlay=x='${mid.x}':y='${mid.y}'[s2]`,
    `[s2][nearl]overlay=x='${near.x}':y='${near.y}'[s3]`,
    `[s3]crop=${W}:${H},fps=${fps},format=yuv420p[v]`,
  ].join(';');
}

module.exports = { depthMap, gradientDepth, buildChain, MODEL_ID };
