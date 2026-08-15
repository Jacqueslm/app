'use strict';
/* Tests for the structure engine. No framework, no dependencies: node structure.test.js
   Each case is a hand-built price path whose correct labelling is obvious by eye,
   so a failure means the engine is wrong rather than the test being clever. */

const S = require('./structure');

let pass = 0, fail = 0;
const results = [];

function check(name, got, want){
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  results.push((ok ? '  ok    ' : '  FAIL  ') + name +
    (ok ? '' : `\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
}
function group(name){ results.push('\n' + name); }

/* Build candles that walk between waypoints. Each leg gets `bars` candles and
   the waypoint is hit exactly on the final close of its leg, so the turning
   bar carries the extreme. */
function path(waypoints, bars = 4){
  const c = [];
  let t = Date.UTC(2025, 0, 6, 14, 0);
  for(let i = 0; i < waypoints.length - 1; i++){
    const a = waypoints[i], b = waypoints[i+1];
    for(let k = 0; k < bars; k++){
      const o = a + (b - a) * (k / bars);
      const cl = a + (b - a) * ((k + 1) / bars);
      c.push({t, o, h: Math.max(o, cl), l: Math.min(o, cl), c: cl});
      t += 3600000;
    }
  }
  return c;
}

const labels = (r, kind) => r.swings.filter(s => s.kind === kind).map(s => s.label);
const evs    = r => r.events.map(e => e.type + ':' + e.dir);

/* ---------------------------------------------------------------- swings -- */
group('Swing detection');
{
  const c = path([100, 110, 105, 120]);
  const r = S.analyze(c);
  check('alternates high/low/high…',
    r.swings.map(s => s.kind), ['high', 'low']);
  check('swing high price is the leg extreme', r.swings[0].price, 110);
  check('swing low price is the leg extreme',  r.swings[1].price, 105);
}
{
  const c = path([100, 110, 105, 120]);
  const r = S.analyze(c, {fractalN: 2});
  const sw = r.swings[0];
  check('confirmation lags the swing by exactly N bars', sw.confirmedAt - sw.i, 2);
}
{
  /* Double top: two bars at the same high. Strict-left / non-strict-right
     must resolve to the first, not both and not neither. */
  const c = [
    {t:1,o:100,h:101,l:99, c:100},
    {t:2,o:100,h:103,l:100,c:102},
    {t:3,o:102,h:105,l:102,c:105},  // <- the swing
    {t:4,o:105,h:105,l:103,c:103},  // equal high
    {t:5,o:103,h:104,l:101,c:101},
    {t:6,o:101,h:102,l: 99,c: 99},
    {t:7,o: 99,h:100,l: 97,c: 97}
  ];
  const r = S.analyze(c, {fractalN: 2});
  const highs = r.swings.filter(s => s.kind === 'high');
  check('double top yields one swing', highs.length, 1);
  check('double top takes the first bar', highs[0].i, 2);
}

/* ---------------------------------------------------------------- labels -- */
group('Labelling (§3)');
{
  /* Clean uptrend: highs 110 → 120 → 130 → 140, lows 105 → 112 → 122.
     The trailing leg exists so the 140 high has bars after it to confirm on. */
  const r = S.analyze(path([100, 110, 105, 120, 112, 130, 122, 140, 132]));
  check('uptrend highs are HH', labels(r, 'high'), ['—', 'HH', 'HH', 'HH']);
  check('uptrend lows are HL',  labels(r, 'low'),  ['—', 'HL', 'HL']);
}
{
  /* Clean downtrend: lows 120 → 110 → 100 → 90, highs 125 → 115 → 105 */
  const r = S.analyze(path([130, 120, 125, 110, 115, 100, 105, 90, 95]));
  check('downtrend lows are LL',  labels(r, 'low'),  ['—', 'LL', 'LL', 'LL']);
  check('downtrend highs are LH', labels(r, 'high'), ['—', 'LH', 'LH']);
}
{
  /* The final extreme of a series sits on the last bar, so nothing has traded
     after it. It must be withheld rather than guessed at — this is the same
     property as not repainting, seen from the right-hand edge. */
  const withTail = S.analyze(path([100, 110, 105, 120, 112, 130, 122, 140, 132]));
  const noTail   = S.analyze(path([100, 110, 105, 120, 112, 130, 122, 140]));
  check('the last swing is withheld until bars print after it',
    labels(noTail, 'high').length, labels(withTail, 'high').length - 1);
}

/* ------------------------------------------------------------ BOS/CHoCH -- */
group('BOS and CHoCH (§4)');
{
  const r = S.analyze(path([100, 110, 105, 120, 112, 130]));
  check('uptrend gives bullish BOS only',
    evs(r).every(e => e === 'BOS:bull'), true);
  check('final bias is bull', r.bias, 'bull');
}
{
  /* The pattern in your words: HH, HL, HH, then break the previous HL.
     100 → 110(H) → 105(L) → 120(HH) → 112(HL) → 118(LH) → 104 breaks 112. */
  const r = S.analyze(path([100, 110, 105, 120, 112, 118, 104]));
  check('HH HL HH then breaking the HL is a bearish CHoCH',
    evs(r), ['BOS:bull', 'CHoCH:bear']);
  check('bias flips to bear on the CHoCH', r.bias, 'bear');
  const choch = r.events.find(e => e.type === 'CHoCH');
  check('CHoCH breaks the HL level, not the low of the move', choch.level, 112);
  check('the swing that broke was labelled HL',
    r.swings.find(s => s.i === choch.brokeSwingAt).label, 'HL');
}
{
  /* Mirror: downtrend, then break the previous LH upward. */
  const r = S.analyze(path([130, 120, 125, 110, 118, 112, 126]));
  check('LL LH LL then breaking the LH is a bullish CHoCH',
    evs(r), ['BOS:bear', 'CHoCH:bull']);
  check('bias flips to bull', r.bias, 'bull');
}
{
  /* A level, once broken, is spent — re-touching it must not fire again. */
  const r = S.analyze(path([100, 110, 105, 120, 114, 121, 115, 122]));
  const perLevel = {};
  r.events.forEach(e => { perLevel[e.level] = (perLevel[e.level] || 0) + 1; });
  check('no level produces two events',
    Object.values(perLevel).every(n => n === 1), true);
}

/* ----------------------------------------------------------- causality --- */
group('Causality');
{
  const c = path([100, 110, 105, 120, 112, 118, 104]);
  const r = S.analyze(c);
  check('every event uses a swing confirmed on an earlier bar',
    r.events.every(e => {
      const sw = r.swings.find(s => s.i === e.brokeSwingAt);
      return sw && sw.confirmedAt < e.i;
    }), true);
  check('no swing is reported before its own bar',
    r.swings.every(s => s.confirmedAt > s.i), true);
}
{
  /* Feeding the engine a prefix of the data must not change the events that
     fall inside that prefix — the definition of not repainting. */
  const c = path([100, 110, 105, 120, 112, 118, 104, 112, 98]);
  const full = S.analyze(c);
  const cut  = 30;
  const part = S.analyze(c.slice(0, cut));
  check('past events are identical on a truncated history',
    part.events.map(e => e.i + e.type + e.dir),
    full.events.filter(e => e.i < cut).map(e => e.i + e.type + e.dir));
}

/* -------------------------------------------------------------- sweeps --- */
group('Sweeps (§5)');
{
  /* Build a confirmed swing high at 120, then a bar that wicks to 123 and
     closes at 118 — through the level but rejected. */
  const c = path([100, 120, 112], 4);
  c.push({t:9e12,   o:112, h:114, l:111, c:113});
  c.push({t:9e12+1, o:113, h:123, l:113, c:118});   // the sweep
  c.push({t:9e12+2, o:118, h:119, l:114, c:115});
  c.push({t:9e12+3, o:115, h:116, l:112, c:113});
  const r = S.analyze(c);
  check('wick through a swing high closing back inside is a bearish sweep',
    r.sweeps.map(s => s.side), ['bearish']);
  check('the sweep is measured against the swing level', r.sweeps[0].level, 120);
  check('penetration is the distance beyond the level', r.sweeps[0].penetration, 3);
  check('a sweep is not counted as a break',
    r.events.filter(e => e.dir === 'bull').length, 0);
}
{
  /* Same level, but the bar closes above it. That is a break, not a sweep —
     the two must be mutually exclusive. */
  const c = path([100, 120, 112], 4);
  c.push({t:9e12,   o:112, h:114, l:111, c:113});
  c.push({t:9e12+1, o:113, h:123, l:113, c:122});   // closes through
  c.push({t:9e12+2, o:122, h:123, l:120, c:121});
  const r = S.analyze(c);
  check('closing through the level is a break', evs(r).includes('BOS:bull'), true);
  check('and produces no sweep', r.sweeps.length, 0);
}

/* ------------------------------------------------------- consolidation --- */
group('Consolidation (§6)');
{
  const trend = S.analyze(path([100, 110, 105, 120, 112, 130, 122, 140]));
  check('a clean uptrend is not consolidation', S.isConsolidating(trend), false);

  const range = S.analyze(path([100, 110, 102, 108, 101, 109, 103, 107, 104]));
  const labs  = range.swings.slice(-4).map(s => s.label);
  check('a range mixes both label families',
    labs.some(l => l === 'HH' || l === 'HL') && labs.some(l => l === 'LL' || l === 'LH'),
    true);
}

/* --------------------------------------------------------------- output -- */
console.log(results.join('\n'));
console.log('\n' + pass + ' passed, ' + fail + ' failed\n');

if(!fail){
  console.log('--- sample timeline: HH HL HH then the HL breaks ---');
  const c = path([100, 110, 105, 120, 112, 118, 104]);
  console.log(S.describe(S.analyze(c), c));
}
process.exit(fail ? 1 : 0);
