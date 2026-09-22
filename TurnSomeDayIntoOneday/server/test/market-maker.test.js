// The practice game (/market-maker.html) — 19 Sep 2026.
//
// Jacques, on the game's step one, twice over:
//   "the number in the question answers and on the chart are incompatible
//    doesn't makes sense I'm still guessing"
//   "still doesn't make sense you might have to redo this whole game over"
//
// He was right, and this file is the half of the fix that keeps it fixed. The
// page had no test at all, which is how a question nobody could answer lived in
// it. Every check below is made against the bars, not against the page's own
// flags — the page's flags are what was wrong.
//
//   1. Every price in an answer option is a price the tape actually traded.
//      The three prices used to be the last low plus and minus a fraction of
//      the last leg. On his screenshot one of them came out exactly level with
//      the current price — under the yellow "now" tag — and another below every
//      bar on the screen. Neither was a level, and nothing said so.
//   2. Exactly one of the three carries the property the question asks about:
//      the answer is untaken and the other two have been closed through.
//   3. No option is the current price.
//   4. Everything the question asks the player to judge is drawn inside the
//      frame, and the three marks are actually drawn.
//   5. The inside read's words describe the tape. "Coiling" has to mean the
//      small lows stepping up while the small highs step back, and the old
//      catch-all must never come back.
//   6. The read is asked at all: a gate that locks the trigger and asks nothing
//      is a game with no step one.
//
// It runs the page's real inline script in a stub DOM, over the game's real
// packed tape as well as over freshly generated markets. Not a browser: it
// proves the numbers and the marking, not the pixels.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = path.join(ROOT, 'market-maker.html');
const HTML = fs.readFileSync(PAGE, 'utf8');

// The game keeps everything inside one IIFE, so nothing is reachable from
// outside it. Rather than ship a debug hook in the page, the harness splices
// one export line in before the IIFE closes: the same functions, no behaviour
// changed. If the page ever stops being wrapped that way, this throws instead
// of quietly testing nothing.
const EXPORT = ';window.__mm={levelSpec:levelSpec,buildQ:buildQ,stNow:stNow,structure:structure,'
  + 'drawChart:drawChart,paintGate:paintGate,makeMarket:makeMarket,pickWindow:pickWindow,'
  + 'windowBars:windowBars,qLevel:qLevel,qInner:qInner,qEvent:qEvent,qAgree:qAgree,qOutside:qOutside,'
  + 'tape:function(){return TAPE},setGm:function(g){Gm=g},setTf:function(t){G.tf=t;return tfNow()}};';

function pageScript() {
  let out = '';
  for (const m of HTML.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(m[1])) continue;
    if (/\btype=/.test(m[1]) && !/javascript/i.test(m[1])) continue;   // the packed tape is JSON, not code
    out += m[2] + '\n;\n';
  }
  const at = out.lastIndexOf('})();');
  if (at === -1) throw new Error('market-maker.html is no longer one IIFE — this harness needs updating');
  return out.slice(0, at) + EXPORT + out.slice(at);
}

// The game ships its market history as JSON inside the page. The test hands the
// same bytes to the page's own loader, so every window driven below is a piece
// of market that actually happened and not a fixture invented for the test.
const TAPE_JSON = (HTML.match(/<script type="application\/json" id="mkt">([\s\S]*?)<\/script>/) || [])[1];
if (!TAPE_JSON) throw new Error('the packed tape is no longer in market-maker.html');

function fakeCtx(store) {
  const noop = () => {};
  const grad = { addColorStop: noop };
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'start', globalAlpha: 1,
    fillRect: noop, clearRect: noop, strokeRect: noop, arc: noop, rect: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop,
    save: noop, restore: noop, setLineDash: noop, translate: noop, scale: noop, clip: noop,
    createRadialGradient: () => grad, createLinearGradient: () => grad,
    fillText: (t) => store.push(String(t)),
    strokeText: (t) => store.push(String(t)),
    measureText: (t) => ({ width: String(t).length * 6 }),
  };
}

function stubDom() {
  const els = new Map();
  const mk = (id) => {
    const el = {
      id, value: '', textContent: '', innerHTML: '', disabled: false,
      className: '', style: {}, dataset: {}, width: 700, height: 320,
      offsetWidth: 700, offsetHeight: 320, clientWidth: 340,
      _h: {}, attributes: {}, _texts: [],
      classList: {
        _s: new Set(),
        add(c) { this._s.add(c) }, remove(c) { this._s.delete(c) },
        toggle(c, f) {
          if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c) }
          else if (f) { this._s.add(c) } else { this._s.delete(c) }
        },
        contains(c) { return this._s.has(c) },
      },
      addEventListener(t, fn) { this._h[t] = fn },
      setAttribute(n, v) { this.attributes[n] = v },
      removeAttribute(n) { delete this.attributes[n] },
      getAttribute(n) { return this.attributes[n] === undefined ? null : this.attributes[n] },
      getBoundingClientRect() { return { top: 0, left: 0, width: 700, height: 320 } },
      focus() {}, closest() { return null }, querySelectorAll() { return [] },
      appendChild(c) { return c }, remove() {}, scrollIntoView() {},
      getContext() { return this.__ctx || (this.__ctx = fakeCtx(this._texts)) },
    };
    return el;
  };
  return {
    els,
    doc: {
      getElementById(id) { if (!els.has(id)) els.set(id, mk(id)); return els.get(id) },
      querySelectorAll() { return [] }, querySelector() { return null },
      addEventListener() {}, createElement() { return mk('_new') },
      body: mk('body'), documentElement: mk('html'), readyState: 'complete',
      hidden: false,
    },
  };
}

function loadPage() {
  const { doc, els } = stubDom();
  const sandbox = {
    document: doc, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set, Intl,
    parseFloat, parseInt, isNaN, isFinite,
    localStorage: { _d: {}, getItem(k) { return this._d[k] || null }, setItem(k, v) { this._d[k] = v }, removeItem(k) { delete this._d[k] } },
    fetch: async () => ({ status: 404, ok: false, json: async () => ({}) }),
    scrollTo() {}, requestAnimationFrame() {}, cancelAnimationFrame() {},
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    devicePixelRatio: 1, innerWidth: 390, innerHeight: 844,
    location: { href: '', search: '' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.__els = els;
  els.set('mkt', doc.getElementById('mkt'));
  doc.getElementById('mkt').textContent = TAPE_JSON;
  vm.createContext(sandbox);
  // The page boots itself at the bottom: the battlefield atmosphere, then the
  // home screen. That wants a real canvas, and whatever it throws there is not
  // this test's business — the export line has already run by then.
  try { vm.runInContext(pageScript(), sandbox) } catch (e) { sandbox.__boot = e }
  return { sandbox, els };
}

const page = loadPage();
const S = page.sandbox;
const MM = S.__mm;
if (!MM) throw new Error('the page did not expose its engine to the test — ' + (S.__boot && S.__boot.message));

// ── the harness ─────────────────────────────────────────────────────────────

let Gm = null;

function openMarket(n, seed, fromTape) {
  const spec = MM.levelSpec(n);
  MM.setTf(0);                       // the 1H execution frame
  let bars = null;
  if (fromTape) {
    const w = MM.pickWindow(spec, n);
    if (w) bars = MM.windowBars(w);
  }
  if (!bars || bars.length < 100) bars = MM.makeMarket(spec, seed);
  Gm = {
    spec, bars, i: 60, left: spec.session, R: 0, wins: 0, losses: 0, bullets: spec.bullets,
    pos: null, cash: 0, over: false, tilt: 0, sinceLoss: 99, streak: 0, best: 0,
    xray: 0, shield: 0, shieldOn: false, revenges: 0, blown: 0,
    reads: 0, readsRight: 0, readStreak: 0, qn: 0, st: null, stAt: -1, gate: null,
    xrayOn: false, round: 1, roundLen: 40, tf: null, win: null,
    bot: { R: 0, wins: 0, losses: 0, bullets: spec.bullets, pos: null, done: true },
  };
  MM.setGm(Gm);
  return Gm;
}

const SPAN = 70;                      // the bars drawChart shows

function askAt(i) {
  Gm.i = i; Gm.st = null; Gm.stAt = -1;
  const q = MM.buildQ();
  return q ? { q, i, st: MM.stNow() } : null;
}

// Rebuilt here from the bars, exactly as the page defines a swing: a bar whose
// high (or low) is beyond the k bars either side of it.
function isSwing(bars, i, k, kind) {
  if (i < k || i > bars.length - 1 - k) return false;
  for (let j = 1; j <= k; j++) {
    if (kind === 'low' && (bars[i].l >= bars[i - j].l || bars[i].l >= bars[i + j].l)) return false;
    if (kind === 'high' && (bars[i].h <= bars[i - j].h || bars[i].h <= bars[i + j].h)) return false;
  }
  return true;
}

// Has price closed beyond this price since that bar?
function closedThrough(bars, i, p, down, upto) {
  for (let j = i + 1; j <= upto; j++) {
    if (down ? bars[j].c < p : bars[j].c > p) return true;
  }
  return false;
}

// Every bar in the window that could be the turn this price is: a swing of the
// right kind whose price prints as the option does.
//
// Compared on what the screen shows, not on the raw float. The chart prints one
// decimal, so a turn at 6206.75 prints as "6206.8" — and an option reading
// "6206.8" is the same number as far as anybody reading the chart is concerned.
// Comparing the raw values made that a 0.05 miss and failed a price the tape
// plainly did trade.
function turnsAt(bars, price, kind, upto) {
  const shown = price.toFixed(1);
  const hits = [];
  for (let i = 0; i <= upto - 3; i++) {
    const v = kind === 'low' ? bars[i].l : bars[i].h;
    if (v.toFixed(1) === shown && isSwing(bars, i, 3, kind)) hits.push(i);
  }
  return hits;
}

// The outside structure, rebuilt from the bars under the page's own rules: a
// swing is a bar beyond the three either side of it, two turns of the same kind
// in a row keep only the more extreme, and the four words are read off what is
// left. This is the one read whose answer is pure arithmetic on the tape, so it
// can be checked exactly rather than argued about.
function outsideLabels(bars, upto) {
  const hi = [], lo = [];
  for (let i = 3; i <= upto - 3; i++) {
    if (isSwing(bars, i, 3, 'high')) hi.push(i);
    if (isSwing(bars, i, 3, 'low')) lo.push(i);
  }
  const pts = hi.map(i => ({ i, t: 'H', p: bars[i].h }))
    .concat(lo.map(i => ({ i, t: 'L', p: bars[i].l })))
    .sort((a, b) => a.i - b.i);
  const seq = [];
  for (const p of pts) {
    const last = seq[seq.length - 1];
    if (!last || last.t !== p.t) seq.push(p);
    else if ((p.t === 'H' && p.p > last.p) || (p.t === 'L' && p.p < last.p)) seq[seq.length - 1] = p;
  }
  const labs = [];
  for (let i = 2; i < seq.length; i++) {
    const prev = seq[i - 2];
    labs.push(seq[i].t === 'H' ? (seq[i].p > prev.p ? 'HH' : 'LH') : (seq[i].p < prev.p ? 'LL' : 'HL'));
  }
  const last4 = labs.slice(-4);
  if (last4.length < 3) return null;
  return {
    labels: last4,
    up: last4.includes('HH') && last4.includes('HL') && !last4.includes('LL'),
    down: last4.includes('LL') && last4.includes('LH') && !last4.includes('HH'),
  };
}

// ── where the reads come from ───────────────────────────────────────────────

test('the page loads and still has the pieces this test drives', () => {
  for (const fn of ['buildQ', 'stNow', 'structure', 'drawChart', 'makeMarket', 'levelSpec', 'pickWindow', 'windowBars', 'qLevel', 'qInner', 'qEvent', 'qAgree', 'qOutside']) {
    assert.strictEqual(typeof MM[fn], 'function', `${fn} is not a function — the page did not parse`);
  }
  const tape = MM.tape();
  assert.ok(tape && tape.r && tape.c, 'the packed tape did not load');
  assert.ok(tape.c.length > 100, 'the tape window index is empty');
});

test('the level read offers three real turns, exactly one of them untaken', () => {
  let seen = 0, downs = 0, ups = 0;
  for (let n = 1; n <= 24; n++) {
    const bars = openMarket(n, 4000 + n, true).bars;
    for (let i = 60; i <= bars.length - 3; i += 3) {
      const a = askAt(i);
      if (!a || a.q.kind !== 'level') continue;
      const { q } = a;
      seen++;
      const down = /heading down/.test(q.q);
      down ? downs++ : ups++;
      const kind = down ? 'low' : 'high';
      const px = bars[i].c;
      const start = Math.max(0, i - SPAN);

      assert.strictEqual(q.prices.length, 3, 'a level question with the wrong number of prices');
      assert.strictEqual(q.o.length, 3, 'a level question with the wrong number of options');
      assert.strictEqual(new Set(q.o).size, 3, 'two options print the same price: ' + q.o.join(' / '));
      assert.ok(q.a >= 0 && q.a < 3, 'the answer index is not one of the options');

      let untaken = 0, above = 0, below = 0;
      for (let k = 0; k < 3; k++) {
        const p = q.prices[k];
        // it is a price the tape traded: a real swing of the kind asked about,
        // inside the bars the chart actually shows
        const hits = turnsAt(bars, p, kind, i);
        assert.ok(hits.length, `option ${k + 1} (${q.o[k]}) is not a ${kind} the tape ever made`);
        assert.ok(Math.max(...hits) >= start, `option ${k + 1} (${q.o[k]}) is not in the last ${SPAN} bars`);
        if (!closedThrough(bars, Math.max(...hits), p, down, i)) untaken++;
        if (p > px) above++; else if (p < px) below++;
        assert.notStrictEqual(q.o[k], px.toFixed(1), 'an option is the current price');
      }
      assert.strictEqual(untaken, 1,
        `${untaken} of the three are untaken — the question has no single answer: ` + q.o.join(' / '));
      const at = Math.max(...turnsAt(bars, q.prices[q.a], kind, i));
      assert.ok(!closedThrough(bars, at, q.prices[q.a], down, i), 'the marked answer is a level price has been through');
      // and the two wrong ones straddle price, so the answer is never simply
      // the outermost line
      assert.ok((above === 1 && below === 2) || (above === 2 && below === 1),
        `the wrong answers do not straddle price (${above} above, ${below} below)`);
    }
  }
  assert.ok(seen >= 40, `only ${seen} level questions were buildable — the read has gone quiet`);
  assert.ok(downs > 0 && ups > 0, 'the level read only ever asks one direction');
});

test('the inside read says what the tape is doing, and never the old catch-all', () => {
  let seen = 0;
  const counts = { up: 0, down: 0, coil: 0 };
  for (let n = 1; n <= 24; n++) {
    const bars = openMarket(n, 5000 + n, true).bars;
    for (let i = 60; i <= bars.length - 3; i += 3) {
      const a = askAt(i);
      if (!a || (a.q.kind !== 'inner' && a.q.kind !== 'agree')) continue;
      const { q, st } = a;
      seen++;
      // recomputed here: the small turns inside the leg, k=1, last pair each side
      const lows = [], highs = [];
      for (let j = Math.max(1, st.legFrom + 1); j <= i - 1; j++) {
        if (bars[j].l < bars[j - 1].l && bars[j].l < bars[j + 1].l) lows.push(bars[j].l);
        if (bars[j].h > bars[j - 1].h && bars[j].h > bars[j + 1].h) highs.push(bars[j].h);
      }
      const step = (arr) => arr.length > 1 ? Math.sign(+(arr[arr.length - 1] - arr[arr.length - 2]).toFixed(9)) : 0;
      const lowStep = step(lows), highStep = step(highs);
      const dir = (lowStep && highStep && lowStep === highStep) ? lowStep : 0;
      const coil = lowStep === 1 && highStep === -1;
      const expand = lowStep === -1 && highStep === 1;
      assert.ok(!expand, 'the inside read was asked on a range opening out — that has no answer');
      assert.ok(dir !== 0 || coil, 'the inside read was asked on a state it cannot name');

      const text = q.o[q.a];
      if (q.kind === 'inner') {
        if (dir > 0) { assert.match(text, /^Up/, 'the answer should be Up: ' + text); counts.up++ }
        else if (dir < 0) { assert.match(text, /^Down/, 'the answer should be Down: ' + text); counts.down++ }
        else { assert.match(text, /^Coiling/, 'the answer should be Coiling: ' + text); counts.coil++ }
        assert.ok(!/chopping|neither yet/i.test(text), 'the old catch-all is back: ' + text);
      } else {
        const up = /reads UP/.test(q.q);
        const want = dir === 0 ? /^Neither/ : ((up ? dir > 0 : dir < 0) ? /^Yes/ : /^No/);
        assert.match(text, want, `the agree read disagrees with the tape: ${text} · ${q.q}`);
      }
    }
  }
  assert.ok(seen >= 40, `only ${seen} inside reads were buildable`);
  assert.ok(counts.up + counts.down + counts.coil > 0, 'no inside read was ever marked');
});

test('the event read still names the thing price actually did', () => {
  const WANT = {
    sweptLow: /handed it straight back/, sweptHigh: /handed it straight back/,
    brokeLow: /Closed through the low/, brokeHigh: /Closed through the high/,
  };
  const IDX = { sweptLow: 0, sweptHigh: 1, brokeLow: 2, brokeHigh: 3 };
  let seen = 0;
  for (let n = 1; n <= 24; n++) {
    const bars = openMarket(n, 6000 + n, true).bars;
    for (let i = 60; i <= bars.length - 3; i += 3) {
      const a = askAt(i);
      if (!a || a.q.kind !== 'event') continue;
      seen++;
      assert.ok(a.st.last, 'an event question with no event');
      assert.strictEqual(a.q.a, IDX[a.st.last.kind], 'the answer is not the event that happened');
      assert.match(a.q.o[a.q.a], WANT[a.st.last.kind], 'the option text does not describe the event');
    }
  }
  assert.ok(seen > 0, 'the event read never came up');
});

test('the outside read is the one the tape can always make, and it is right', () => {
  let seen = 0, up = 0, down = 0, flat = 0;
  for (let n = 1; n <= 12; n++) {
    const bars = openMarket(n, 8000 + n, true).bars;
    for (let i = 60; i <= bars.length - 3; i += 3) {
      const st = (() => { Gm.i = i; Gm.st = null; Gm.stAt = -1; return MM.stNow() })();
      const mine = outsideLabels(bars, i);
      const q = MM.qOutside(st);
      if (!mine) { assert.strictEqual(q, null, 'the outside read offered an answer the tape has no four words for'); continue }
      // when the tape carries three labelled turns the read can always be asked,
      // which is the whole reason it is the last thing buildQ tries
      assert.ok(q, 'the outside read declined a tape that carries ' + mine.labels.join(' '));
      seen++;
      const word = q.o[q.a];
      const want = mine.up ? 0 : mine.down ? 1 : 2;
      assert.strictEqual(q.a, want, `the outside read says "${word}" on ${mine.labels.join(' ')}`);
      assert.match(word, mine.up ? /^Higher highs/ : mine.down ? /^Lower lows/ : /^Neither/,
        'the option does not describe the structure it is marked as: ' + word);
      mine.up ? up++ : mine.down ? down++ : flat++;
    }
  }
  assert.ok(seen > 100, `only ${seen} outside reads could be made`);
  assert.ok(up > 0 && down > 0 && flat > 0, `the outside read never says all three: ${up} up, ${down} down, ${flat} sideways`);
});

test('the trigger is never locked without a question to answer', () => {
  let asks = 0, none = 0;
  for (let n = 1; n <= 12; n++) {
    const bars = openMarket(n, 7000 + n, true).bars;
    for (let i = 60; i <= bars.length - 3; i += 3) {
      asks++;
      if (!askAt(i)) none++;
    }
  }
  assert.ok(none / asks < 0.10, `${none} of ${asks} asks had nothing to say — the gate locks for no reason`);
  assert.ok(asks - none > 100, 'not enough asks to judge');
});

test('the three marks are drawn, and every price asked about is inside the frame', () => {
  const bars = openMarket(3, 11, true).bars;
  const found = [];
  for (let i = 60; i <= bars.length - 3; i++) {
    const a = askAt(i);
    if (a && a.q.kind === 'level') found.push(a);
  }
  assert.ok(found.length, 'no level question to draw');
  const cv = page.els.get('cv');
  let drawn = 0;
  for (const { q, i } of found.slice(0, 12)) {
    Gm.i = i; Gm.st = null; Gm.stAt = -1;
    Gm.gate = { state: 'ask', q, pick: -1 };
    cv._texts.length = 0;
    MM.drawChart();
    for (const k of ['1', '2', '3']) assert.ok(cv._texts.includes(k), `mark ${k} was not drawn`);
    // the frame drawChart builds, rebuilt here, then the y of each mark
    const start = Math.max(0, i - SPAN);
    let hi = -Infinity, lo = Infinity;
    for (const b of bars.slice(start, i + 1)) { if (b.h > hi) hi = b.h; if (b.l < lo) lo = b.l }
    for (const p of q.prices) { if (p > hi) hi = p; if (p < lo) lo = p }
    const pad = (hi - lo) * 0.12 || 1; hi += pad; lo -= pad;
    for (const p of q.prices) {
      const y = 320 - 30 - ((p - lo) / (hi - lo)) * (320 - 60);
      assert.ok(y >= 26 && y <= 320 - 26, `${p} is drawn off the frame (y ${y.toFixed(1)})`);
    }
    drawn++;
    Gm.gate = null;
  }
  assert.ok(drawn >= 5, `only ${drawn} level questions could be drawn`);
});

test('after the answer the three lines say what they were', () => {
  const bars = openMarket(2, 21, true).bars;
  let found = null;
  for (let i = 60; i <= bars.length - 3 && !found; i++) {
    const a = askAt(i);
    if (a && a.q.kind === 'level') found = a;
  }
  assert.ok(found, 'no level question to reveal');
  const { q, i } = found;
  const cv = page.els.get('cv');
  Gm.i = i; Gm.st = null; Gm.stAt = -1;
  Gm.gate = { state: 'observe', q, pick: q.a === 0 ? 1 : 0 };
  cv._texts.length = 0;
  MM.drawChart();
  const resting = cv._texts.filter(t => t.startsWith('RESTING')).length;
  const taken = cv._texts.filter(t => t.startsWith('TAKEN')).length;
  assert.strictEqual(resting, 1, 'the untaken line was not named after the answer');
  assert.strictEqual(taken, 2, 'the two taken lines were not named after the answer');
});

// The other half of the complaint, and the half a marking test cannot see:
// "the number in the question answers and on the chart are incompatible". The
// chart drew a line per price with 1, 2, 3 on it, and the buttons underneath
// showed a bare price. Nothing on screen said which button was line 2, so the
// one thing the question asked could not be done. The number and the price have
// to be on the button, in that order, and the number has to be the same one the
// tape drew on that line.
test('the buttons carry the number the tape drew on their line', () => {
  const bars = openMarket(3, 33, true).bars;
  let found = null;
  for (let i = 60; i <= bars.length - 3 && !found; i++) {
    const a = askAt(i);
    if (a && a.q.kind === 'level') found = a;
  }
  assert.ok(found, 'no level question to number');
  const { q, i } = found;
  Gm.i = i; Gm.st = null; Gm.stAt = -1;
  Gm.gate = { state: 'ask', q, pick: -1 };

  // the gate builds its buttons through document.createElement, so they are
  // collected here — the stub DOM does not keep children
  const made = [];
  const realCreate = S.document.createElement;
  S.document.createElement = function (tag) { const el = realCreate.call(S.document, tag); made.push(el); return el };
  try { MM.paintGate() } finally { S.document.createElement = realCreate }

  assert.strictEqual(made.length, 3, 'the gate did not make three buttons');
  made.forEach((b, k) => {
    assert.strictEqual(b.textContent, (k + 1) + '  ·  ' + q.o[k],
      `button ${k + 1} reads "${b.textContent}" — it must carry the number the tape drew on that line`);
  });
  assert.match(made[q.a].textContent, new RegExp('^' + (q.a + 1) + '  ·  '),
    'the marked line and the button for it do not share a number');

  // and that number is on the tape: the chart draws a mark per line
  const cv = page.els.get('cv');
  cv._texts.length = 0;
  MM.drawChart();
  for (let k = 0; k < 3; k++) assert.ok(cv._texts.includes(String(k + 1)), `mark ${k + 1} was not drawn`);
  Gm.gate = null;
});

test('generated markets carry the same reads as the real tape', () => {
  let seen = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const bars = openMarket(6, seed * 7919 + 13, false).bars;
    for (let i = 60; i <= bars.length - 3; i += 7) {
      const a = askAt(i);
      if (!a) continue;
      seen++;
      const { q } = a;
      assert.ok(q.a >= 0 && q.a < q.o.length, 'answer index outside the options');
      assert.strictEqual(new Set(q.o).size, q.o.length, 'duplicate options: ' + q.o.join(' / '));
      assert.ok(q.q.length > 20 && q.w.length > 40, 'a question with no question, or with no reason given');
    }
  }
  assert.ok(seen > 100, `only ${seen} questions on generated markets`);
});
