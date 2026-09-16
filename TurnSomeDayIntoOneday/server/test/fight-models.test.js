// The 3D ring (game3d.html) and the three things that came back from a real fight
// on 16 Sep 2026: "knockout didn't fall, ref counting in opposite direction, and
// characters still walking through each other".
//
// What was actually wrong, and what this file now guards:
//
//   1. THE REFEREE'S MARK. The knockdown lens stands on the house side of the body,
//      but the referee's mark was worked out from where the middle of the ring was.
//      For a body down on the far half - exactly where the addiction's own mark is -
//      "towards the middle" is also "towards the camera", so the referee stood
//      between the lens and the man he was counting, back to us, pointing at
//      somebody out of frame. That is the shot that reads as the referee standing in
//      the opposite direction, and it is also why a count over a man on the canvas
//      looked like a count over a man on his feet: what filled the frame was the
//      referee, standing. The mark and the lens now read off one point.
//   2. WALKING THROUGH EACH OTHER. Only a punch step held a separation. A walk aimed
//      straight at its mark from wherever the body was, so two of them crossing took
//      each other through the ribs. clearOf() now covers walks and steps back.
//   3. THE END-OF-FIGHT POSE. decision() put a knocked-out addiction back on its
//      feet (idle) the instant the fight ended, so the man who had just been counted
//      out stood up over his own count.
//
// And the thing that was NOT wrong, pinned here because it cost a session: the
// addiction wears a body of its own (img/fight/boss-<key>.glb) whose bones are named
// mixamorig:Hips against the library's mixamorigHips, which looks fatal. It is not.
// GLTFLoader runs every node name through PropertyBinding.sanitizeNodeName, which
// strips the colon, so by the time the moves meet the body both sides are
// mixamorigHips and they bind. What the colon form does is worse than failing: three
// reads everything before a colon as a directory name, so "mixamorig:Hips.quaternion"
// quietly becomes a track for a node called Hips - which does not exist, anywhere.
// This test binds with the real three.js, so the rule is checked rather than assumed.
//
// It is not a browser: it proves the bones bind and the geometry holds, not pixels.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const FIGHT = fs.readFileSync(path.join(ROOT, 'game3d.html'), 'utf8');
const ART = path.join(ROOT, 'img', 'fight');

// ── the real three.js, out of the page's own bundle ────────────────────────
let THREE = null;
function three() {
  if (THREE) return THREE;
  const ctx = { console };
  ctx.window = ctx; ctx.self = ctx;
  ctx.document = {
    createElementNS: () => ({ style: {} }),
    createElement: () => ({ style: {}, getContext: () => null }),
  };
  ctx.navigator = { userAgent: 'node' };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'ring3d-three.js'), 'utf8'), ctx);
  THREE = ctx.THREE;
  assert.ok(THREE && THREE.REVISION, 'three.js did not load out of js/ring3d-three.js');
  assert.equal(typeof THREE.PropertyBinding.sanitizeNodeName, 'function',
    'this test binds the way GLTFLoader does, so it needs the real sanitizeNodeName');
  return THREE;
}
const san = (n) => three().PropertyBinding.sanitizeNodeName(n);

// ── the page's own functions, lifted out by name ───────────────────────────
function fnSource(name) {
  const a = FIGHT.indexOf('function ' + name + '(');
  assert.ok(a > 0, 'game3d.html no longer defines ' + name + '()');
  let depth = 0;
  for (let j = FIGHT.indexOf('{', a); j < FIGHT.length; j++) {
    const c = FIGHT[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return FIGHT.slice(a, j + 1); }
  }
  throw new Error('unterminated ' + name);
}

const CLEAR = Number((FIGHT.match(/const CLEAR=([\d.]+)/) || [])[1]);
assert.ok(CLEAR > 0, 'game3d.html no longer declares CLEAR');

// downCamAt, refSpot and clearOf, run in a context with three.js, so the test
// drives the shipping functions rather than a copy of them
function page() {
  const T = three();
  const ctx = { T, console, YOU: null, BOSS: null, CLEAR };
  vm.createContext(ctx);
  vm.runInContext([
    fnSource('downCamAt'), fnSource('refSpot'), fnSource('clearOf'),
    'this.downCamAt=downCamAt;this.refSpot=refSpot;this.clearOf=clearOf;',
  ].join('\n'), ctx);
  ctx.fighter = (x, z) => ({ root: { position: new T.Vector3(x, 0, z) } });
  return ctx;
}

// ── the models ─────────────────────────────────────────────────────────────
function gltf(file) {
  const b = fs.readFileSync(path.join(ART, file));
  assert.equal(b.readUInt32LE(0), 0x46546c67, file + ' is not a glb');
  return JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
}
const bodies = fs.readdirSync(ART).filter((f) => /^boss-.*\.glb$/.test(f)).sort();
assert.ok(bodies.length > 5, 'expected the addiction bodies in img/fight');

const GLTF_PROP = { rotation: 'quaternion', translation: 'position' };

// A track named the way the mixer will see it, with values that make a bound bone
// visibly move. The real numbers are irrelevant - binding is by name.
function tracks(g, clipName) {
  const anim = (g.animations || []).find((a) => a.name === clipName);
  assert.ok(anim, 'the model library has no ' + clipName + ' clip');
  const T = three(); const seen = new Set(); const out = [];
  for (const c of anim.channels) {
    const node = g.nodes[c.target.node];
    const prop = GLTF_PROP[c.target.path];
    if (!node || !node.name || !prop) continue;
    const name = node.name + '.' + prop;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(prop === 'quaternion'
      ? new T.QuaternionKeyframeTrack(name, [0, 1], [0, 0.707, 0, 0.707, 0, 0.707, 0, 0.707])
      : new T.VectorKeyframeTrack(name, [0, 1], [3, 3, 3, 3, 3, 3]));
  }
  return out;
}

// The body as GLTFLoader hands it over: every node name sanitized.
function bodyRoot(file) {
  const T = three(); const root = new T.Object3D(); root.name = 'Scene';
  for (const n of (gltf(file).nodes || []).map((x) => x.name)) {
    if (!n) continue;
    const b = new T.Bone(); b.name = san(n); root.add(b);
  }
  return root;
}

// Play the clip on the real mixer and count the bones that actually moved. A track
// that binds to nothing leaves the bone at its rest value and says nothing about it.
function bonesMoved(root, list) {
  const T = three();
  if (!list.length) return 0;
  const clip = new T.AnimationClip('probe', 1, list);
  const before = new Map();
  root.traverse((o) => before.set(o.uuid, { q: o.quaternion.clone(), p: o.position.clone() }));
  const mixer = new T.AnimationMixer(root);
  mixer.clipAction(clip).play();
  mixer.update(0.5); mixer.update(0.5);
  let moved = 0;
  root.traverse((o) => {
    const b = before.get(o.uuid); if (!b) return;
    if (b.q.x !== o.quaternion.x || b.q.y !== o.quaternion.y || b.q.z !== o.quaternion.z || b.q.w !== o.quaternion.w
      || b.p.x !== o.position.x || b.p.y !== o.position.y || b.p.z !== o.position.z) moved++;
  });
  return moved;
}

test('every body the addiction can wear really plays the moves it is given', () => {
  const lib = gltf('fighter.glb');
  const ko = tracks(lib, 'knocked_out');
  assert.ok(ko.length >= 8, 'knocked_out should carry the major bones, got ' + ko.length);

  // the rule that makes it work, stated as the loader states it
  const raw = (gltf(bodies[0]).nodes || []).map((n) => n.name).filter(Boolean);
  assert.ok(raw.some((n) => n.includes(':')), 'expected the Mixamo colon in a body rig - has it been re-exported?');
  assert.equal(san('mixamorig:Hips'), 'mixamorigHips');
  assert.equal(three().PropertyBinding.parseTrackName('mixamorig:Hips.quaternion').nodeName, 'Hips',
    'the colon form now parses as a node of its own - three.js changed, and the note above is wrong');

  for (const file of bodies) {
    const moved = bonesMoved(bodyRoot(file), ko);
    assert.ok(moved >= Math.ceil(ko.length * 0.8),
      file + ' bound only ' + moved + ' of ' + ko.length + ' bones - it would stand still through its own knockdown');
  }

  // and every move, not just the knockdown: a body that can fall but not punch is
  // still a statue. (A fresh body per clip - the mixer leaves the bones where the
  // last clip put them, and a second clip writing the same rotation is no change.)
  for (const a of lib.animations.slice(0, 12)) {
    const list = tracks(lib, a.name);
    const moved = bonesMoved(bodyRoot(bodies[0]), list);
    assert.ok(moved >= Math.ceil(list.length * 0.8),
      a.name + ' bound only ' + moved + ' of ' + list.length + ' bones on ' + bodies[0]);
  }

  // and the colon form, which is what the raw file shows and which must never be
  // built by hand: it binds to nothing at all
  const T = three();
  const colon = ['mixamorig:Hips.quaternion'].map((n) =>
    new T.QuaternionKeyframeTrack(n, [0, 1], [0, 0.707, 0, 0.707, 0, 0.707, 0, 0.707]));
  assert.equal(bonesMoved(bodyRoot(bodies[0]), colon), 0,
    'a colon-named track bound to something - it must not, or the mixer is not parsing names the way this file assumes');
});

test('the referee is never stood between the lens and the body he is counting', () => {
  const P = page(); const T = three();
  for (let x = -1.9; x <= 1.9001; x += 0.2) {
    for (let z = -1.9; z <= 1.9001; z += 0.2) {
      const body = new T.Vector3(x, 0, z);
      const cam = P.downCamAt(body);
      const mark = P.refSpot({ root: { position: body } });
      const toCam = cam.clone().sub(body).setY(0);
      const toRef = mark.clone().sub(body).setY(0);

      // the lens looks at the body, so he has to be behind its centre line
      assert.ok(toRef.dot(toCam) <= -0.3,
        'referee is level with or in front of the body at ' + x + ',' + z + ' - the lens is looking through him');

      // and off that line, so the body is in shot rather than behind him
      const lateral = Math.abs(toRef.x * toCam.z - toRef.z * toCam.x) / toCam.length();
      assert.ok(lateral >= 0.35,
        'referee sits only ' + lateral.toFixed(2) + 'm off the lens at ' + x + ',' + z);

      // and clear of the body: refFace keeps its old heading inside a quarter metre,
      // and a referee inside a body is the fault this mark exists to avoid
      assert.ok(toRef.length() >= 0.9,
        'referee is ' + toRef.length().toFixed(2) + 'm from the body at ' + x + ',' + z);

      // the mark is a person and stays inside the ropes (+/-2.6). The lens is a
      // camera and is allowed outside them; all that is asked of it is its own clamp.
      assert.ok(Math.abs(mark.x) <= 2.7 && Math.abs(mark.z) <= 2.7,
        'referee placed outside the ropes at ' + x + ',' + z);
      assert.ok(Math.abs(cam.x) <= 2.2 && cam.z >= 1.2 && cam.z <= 3.2,
        'the knockdown lens left its own clamp at ' + x + ',' + z);
    }
  }
});

test('the mark and the lens cannot disagree about which way is behind', () => {
  assert.match(FIGHT, /function downLowPos\(\)\{[\s\S]{0,400}?return downCamAt\(downWho\.root\.position\);/,
    'downLowPos must stand off the body using downCamAt');
  assert.match(FIGHT, /const d=downCamAt\(p\)\.setY\(0\)\.sub\(p\)/,
    'refSpot must read its side off the same point the lens stands at');
  assert.match(FIGHT, /refFace\(downWho\.root\.position\);/,
    'a referee who has walked somewhere must turn and look at what he walked to');
});

test('no walk ends inside the other fighter', () => {
  const P = page(); const T = three();
  const you = P.fighter(-0.2, 0.45);
  const boss = P.fighter(0, -1.05);
  P.YOU = you; P.BOSS = boss;

  // a destination that is already clear is left exactly where it was
  const far = new T.Vector3(-1.85, 0, 1.85);
  assert.equal(P.clearOf(far, you), far, 'a clear walk must be left alone');

  // and one that is not is pulled back out to the edge of CLEAR, along its own line
  for (const to of [new T.Vector3(0, 0, -1.0), new T.Vector3(-0.1, 0, -0.9), new T.Vector3(0.05, 0, 0.1)]) {
    const out = P.clearOf(to.clone(), you);
    const gap = out.distanceTo(boss.root.position);
    assert.ok(gap >= CLEAR - 1e-6,
      'clamped walk still ended ' + gap.toFixed(2) + 'm from the other fighter');
    const want = to.clone().sub(boss.root.position).setY(0);
    const got = out.clone().sub(boss.root.position).setY(0);
    assert.ok(want.dot(got) > 0, 'the walk was pushed sideways instead of back along its own line');
  }

  // and both of the things that move a fighter hold it
  assert.match(FIGHT, /function fighterWalk\(F,to,mps,faceAfter,clip\)\{to=clearOf\(to,F\);/,
    'fighterWalk must clear its mark before it walks');
  assert.match(FIGHT, /to=clearOf\(F\.home\.clone\(\),F\)/,
    'stepBack must clear home too - an interrupted step is how they drift into each other');
  assert.match(FIGHT, /const CLEAR=1\.15;/,
    'the separation itself is gone');
});

test('the count knows how tall the body stands before the first knockdown', () => {
  // the gate that makes the referee wait for the fall reads standH. It used to be
  // set only inside fallen(), so a fall that never played left the gate comparing
  // against a default - and the count ran over a man on his feet
  assert.match(FIGHT, /function groundFeet\(F\)\{[\s\S]{0,1400}?if\(!F\.standH\)F\.standH=hipsY\(F\);/,
    'groundFeet must record the height the body stands at, off the idle');
  assert.match(FIGHT, /hipsY\(downWho\)>\(downWho\.standH\|\|1\.0\)\*0\.55/,
    'the count gate must still read standH');
});

test('a knockout is not stood back up', () => {
  // the addiction was put into idle the instant the fight ended, so the man who had
  // just been counted out got up over his own count
  assert.match(FIGHT, /else if\(how!=='ko'\)BOSS\.idle\(\);/,
    'decision() must leave a knocked-out body on the canvas');
  assert.match(FIGHT, /BOSS\.play\('knocked_out',\{speed:1\.2\}\);YOU\.play\('victory'/,
    'the knockdown still has to play the fall');
  assert.match(FIGHT, /await fallen\(BOSS,'knocked_out'\);/,
    'and the referee still has to wait for it to land before counting');
});
