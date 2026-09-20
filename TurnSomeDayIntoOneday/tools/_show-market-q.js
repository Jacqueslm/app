// Print what the game's step one actually asks, and how often each read can be
// asked at all — the evidence for the 19 Sep 2026 rebuild. Nothing here ships.
//
//   node tools/_show-market-q.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'market-maker.html'), 'utf8');
const TAPE = HTML.match(/<script type="application\/json" id="mkt">([\s\S]*?)<\/script>/)[1];

const EXPORT = ';window.__mm={levelSpec:levelSpec,buildQ:buildQ,stNow:stNow,structure:structure,'
  + 'drawChart:drawChart,makeMarket:makeMarket,pickWindow:pickWindow,windowBars:windowBars,'
  + 'qLevel:qLevel,qInner:qInner,qEvent:qEvent,qAgree:qAgree,'
  + 'tape:function(){return TAPE},setGm:function(g){Gm=g},setTf:function(t){G.tf=t;return tfNow()}};';

let src = '';
for (const m of HTML.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (/\bsrc=/.test(m[1])) continue;
  if (/\btype=/.test(m[1]) && !/javascript/i.test(m[1])) continue;
  src += m[2] + '\n;\n';
}
const at = src.lastIndexOf('})();');
src = src.slice(0, at) + EXPORT + src.slice(at);

const noop = () => {};
const grad = { addColorStop: noop };
function fakeCtx(store) {
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'start', globalAlpha: 1,
    fillRect: noop, clearRect: noop, strokeRect: noop, arc: noop, rect: noop, beginPath: noop,
    closePath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop, save: noop, restore: noop,
    setLineDash: noop, translate: noop, scale: noop, clip: noop,
    createRadialGradient: () => grad, createLinearGradient: () => grad,
    fillText: (t) => store.push(String(t)), strokeText: (t) => store.push(String(t)),
    measureText: (t) => ({ width: String(t).length * 6 }),
  };
}
const els = new Map();
function el(id) {
  if (els.has(id)) return els.get(id);
  const e = {
    id, textContent: '', innerHTML: '', value: '', disabled: false, style: {}, dataset: {},
    width: 700, height: 320, offsetWidth: 700, offsetHeight: 320, clientWidth: 340,
    attributes: {}, _h: {}, _texts: [],
    classList: { _s: new Set(), add(c) { this._s.add(c) }, remove(c) { this._s.delete(c) }, toggle(c, f) { f ? this._s.add(c) : this._s.delete(c) }, contains(c) { return this._s.has(c) } },
    addEventListener(t, fn) { this._h[t] = fn }, setAttribute(n, v) { this.attributes[n] = v; },
    removeAttribute(n) { delete this.attributes[n] }, getAttribute(n) { return this.attributes[n] ?? null; },
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 700, height: 320 }),
    querySelectorAll: () => [], appendChild: (c) => c, remove: noop, focus: noop, closest: () => null,
    getContext() { return this.__ctx || (this.__ctx = fakeCtx(this._texts)); },
  };
  els.set(id, e);
  return e;
}
const doc = {
  getElementById: el, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => el('_new' + Math.random()), addEventListener: noop,
  body: el('body'), documentElement: el('html'), readyState: 'complete',
};
el('mkt').textContent = TAPE;

const sandbox = {
  document: doc, console, Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error,
  Promise, Map, Set, Intl, parseFloat, parseInt, isNaN, isFinite, setTimeout, clearTimeout,
  setInterval, clearInterval, devicePixelRatio: 1, innerWidth: 390, innerHeight: 844,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }),
  matchMedia: () => ({ matches: false, addEventListener: noop }),
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  scrollTo: noop, requestAnimationFrame: noop, cancelAnimationFrame: noop,
  addEventListener: noop, removeEventListener: noop, location: { href: '', search: '' },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
try { vm.runInContext(src, sandbox) } catch (e) { console.log('boot threw (fine):', e.message) }

const MM = sandbox.__mm;
if (!MM) { console.error('the page did not expose its engine'); process.exit(1) }
console.log('tape windows:', MM.tape().c.length, '· reels:', MM.tape().r.length);

let Gm = null;
function open(n, fromTape) {
  const spec = MM.levelSpec(n);
  MM.setTf(0);
  let bars = null;
  if (fromTape) { const w = MM.pickWindow(spec, n); if (w) bars = MM.windowBars(w) }
  if (!bars || bars.length < 100) bars = MM.makeMarket(spec, n * 7919 + 5);
  Gm = {
    spec, bars, i: 60, gate: null, qn: 0, st: null, stAt: -1, xrayOn: false, pos: null, over: false,
    bot: { pos: null }, shieldOn: false, left: spec.session, R: 0, bullets: spec.bullets, tilt: 0,
    reads: 0, readsRight: 0, readStreak: 0, xray: 0, shield: 0, cash: 0, wins: 0, losses: 0,
    streak: 0, best: 0, revenges: 0, blown: 0, tf: null, win: null,
  };
  MM.setGm(Gm);
  return bars;
}

const counts = { level: 0, inner: 0, event: 0, agree: 0, outside: 0, none: 0 };
const avail = { level: 0, inner: 0, event: 0, agree: 0 };
let barsTotal = 0;
const shown = { level: 0, inner: 0, event: 0, agree: 0 };

console.log('\n── the level pool: how often a question can be built ──');
let poolOk = 0, strictOk = 0, noRef = 0, refCrossed = 0, wrongSide = 0, notEnoughTurns = 0, notSep = 0, noStraddle = 0;

for (let n = 1; n <= 24; n++) {
  const bars = open(n, true);
  for (let i = 60; i <= bars.length - 3; i += 3) {
    barsTotal++;
    Gm.i = i; Gm.st = null; Gm.stAt = -1;
    const st = MM.stNow();
    // the level read's own gates, in order
    if (st.legDir) {
      const down = st.legDir < 0;
      const ref = down ? st.lastL : st.lastH;
      const start = Math.max(0, i - 70);
      const px = bars[i].c;
      if (!ref || ref.i < start) noRef++;
      else {
        const through = (p) => { for (let j = Math.max(p.i + 1, start); j <= i; j++) if (down ? bars[j].c < p.p : bars[j].c > p.p) return true; return false };
        if (through(ref)) refCrossed++;
        else if (down ? px <= ref.p : px >= ref.p) wrongSide++;
        else {
          const turns = st.seq.filter(t => t.t === ref.t && t.i < ref.i && t.i >= start && through(t));
          if (turns.length < 2) notEnoughTurns++;
          else {
            poolOk++;
            let lo = Infinity, hi = -Infinity;
            for (let j = start; j <= i; j++) { if (bars[j].h > hi) hi = bars[j].h; if (bars[j].l < lo) lo = bars[j].l }
            const gap = Math.max((hi - lo) * 0.05, 0.1);
            const apart = (a, b) => Math.abs(a - b) >= gap;
            let straddle = false, anypair = false;
            for (let a = 0; a < turns.length; a++) for (let b = a + 1; b < turns.length; b++) {
              if (!apart(turns[a].p, ref.p) || !apart(turns[b].p, ref.p) || !apart(turns[a].p, turns[b].p)) continue;
              anypair = true;
              if ((turns[a].p > px) !== (turns[b].p > px)) straddle = true;
            }
            if (straddle) strictOk++;
            else if (anypair) noStraddle++;
            else notSep++;
          }
        }
      }
    }
    for (const k of ['level', 'inner', 'event', 'agree']) {
      const q = k === 'level' ? MM.qLevel(st) : k === 'inner' ? MM.qInner(st) : k === 'event' ? MM.qEvent(st) : MM.qAgree(st);
      if (q) avail[k]++;
    }
    const q = MM.buildQ();
    if (!q) { counts.none++; continue }
    counts[q.kind] = (counts[q.kind] || 0) + 1;
    if (shown[q.kind] >= 2 || !q.prices) continue;
    shown[q.kind]++;
    console.log('\n' + q.kind + ' · level ' + n + ' · bar ' + i + ' · now ' + bars[i].c.toFixed(1));
    console.log('  ' + q.q);
    // The same label the button now carries: the number the tape drew on that
    // line, then the text. Before this the button was a bare price and the
    // chart's 1/2/3 meant nothing to it.
    q.o.forEach((o, k) => console.log('    ' + (k === q.a ? '→' : ' ') + ' ' + (k + 1) + '  ·  ' + o + (k === q.a ? '   ← marked' : '')));
    q.prices.forEach((p, k) => {
      const down = /heading down/.test(q.q);
      // The LAST turn that prints as this price, not the first: an old turn at
      // the same number was being reported as the line the question is about,
      // and a price with two turns behind it got called the wrong one.
      let at = null;
      for (let j = 0; j <= i - 3; j++) {
        const v = down ? bars[j].l : bars[j].h;
        if (v.toFixed(1) === p.toFixed(1)) at = j;
      }
      let taken = null;
      if (at !== null) {
        taken = false;
        for (let j = at + 1; j <= i; j++) if (down ? bars[j].c < p : bars[j].c > p) { taken = true; break }
      }
      const side = p > bars[i].c ? 'above price' : 'below price';
      console.log('    price ' + p.toFixed(1) + ' · real turn at bar ' + at + ' · ' + side + ' · ' +
        (taken === true ? 'TAKEN (price closed through it)' : taken === false ? 'RESTING' : 'not found'));
    });
  }
}

console.log('\nbars walked:', barsTotal);
console.log('questions asked by kind:', counts);
console.log('buildable by kind:', avail, ' out of', barsTotal, 'bars');
console.log('\nlevel pool gates:');
console.log('  pool ok                 ', poolOk);
console.log('  strict straddle ok      ', strictOk);
console.log('  pool but no straddle    ', noStraddle);
console.log('  pool but no separated   ', notSep);
console.log('  no ref / off screen     ', noRef);
console.log('  ref already crossed     ', refCrossed);
console.log('  price on the wrong side ', wrongSide);
console.log('  fewer than two taken    ', notEnoughTurns);
