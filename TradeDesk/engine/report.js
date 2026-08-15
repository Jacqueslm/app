'use strict';
/* Run the structure engine over the real MES exports and print what it found.
     node report.js            all timeframes, summary
     node report.js 1h         one timeframe, full swing/event timeline
     node report.js 1h 3       …with a different fractal N                     */

const path = require('path');
const {load, audit, ET} = require('./csv');
const S = require('./structure');

const TF = ['1d', '4h', '1h', '15m'];
const file = tf => path.join(__dirname, '..', 'data', `MES-${tf}.csv`);

const want = process.argv[2];
const N = Number(process.argv[3]) || 2;

function run(tf){
  const candles = load(file(tf));
  const a = audit(candles);
  const r = S.analyze(candles, {fractalN: N});

  const bos   = r.major.filter(e => e.type === 'BOS');
  const choch = r.major.filter(e => e.type === 'CHoCH');
  const counts = {};
  r.swings.forEach(s => { counts[s.label] = (counts[s.label] || 0) + 1; });

  return {tf, candles, audit: a, r, bos, choch, counts};
}

function summary(x){
  const {tf, candles, audit: a, r, bos, choch, counts} = x;
  const days = ((candles[candles.length-1].t - candles[0].t) / 86400000);
  console.log(`\n${'═'.repeat(74)}`);
  console.log(`MES ${tf.toUpperCase()}   ${a.n} bars   ${days.toFixed(1)} days   ` +
              `${ET(candles[0].t)} → ${ET(candles[candles.length-1].t)}`);
  console.log('─'.repeat(74));
  console.log(`  data      step ${a.stepSeconds}s · ${a.sessionBreaks} session gaps` +
              (a.problems.length ? ` · PROBLEMS: ${a.problems.join('; ')}` : ' · clean'));
  console.log(`  swings    ${r.swings.length}  ` +
              ['HH','HL','LH','LL','—'].map(k => `${k}:${counts[k]||0}`).join('  '));
  console.log(`  major     ${bos.length} BOS  ${choch.length} CHoCH   ` +
              `ratio ${choch.length ? (bos.length/choch.length).toFixed(2) : '\u221e'} BOS per CHoCH`);
  console.log(`  minor     ${r.minor.filter(e=>e.type==='BOS').length} BOS  ` +
              `${r.minor.filter(e=>e.type==='CHoCH').length} CHoCH`);
  console.log(`  sweeps    ${r.sweeps.length}  ` +
              `(${r.sweeps.filter(s=>s.isProtected).length} of a protected level)`);
  console.log(`  bias now  ${(r.bias || 'none').toUpperCase()}` +
              `${S.isConsolidating(r) ? '   [consolidating]' : ''}`);

  const per = 7 / days;
  console.log(`  frequency ${(r.major.length*per).toFixed(1)} major/wk, ` +
              `${(r.sweeps.filter(s=>s.isProtected).length*per).toFixed(2)} protected sweeps/wk`);
  console.log(`  protected low ${r.protectedLow ?? '—'}   high ${r.protectedHigh ?? '—'}`);

  const last = r.swings.slice(-6).map(s =>
    `${s.label}${s.kind === 'high' ? '↑' : '↓'}${s.price}`).join('  ');
  console.log(`  recent    ${last}`);
}

function detail(x){
  const {r} = x;
  console.log('\nTimeline\n' + '─'.repeat(74));
  const rows = [];
  r.swings.forEach(s => rows.push({k: s.confirmedAt, i: s.i, s:
    `${ET(s.t).padEnd(22)}  swing ${(s.kind === 'high' ? 'high' : 'low ')}  ` +
    `${String(s.price).padStart(9)}  ${(s.label||'').padEnd(3)}${s.broken ? ' broken' : ''}`}));
  r.major.forEach(e => rows.push({k: e.i, i: e.i, s:
    `${ET(e.t).padEnd(22)}  MAJOR ${e.type.padEnd(5)} ` +
    `${e.dir.padEnd(4)}  through ${String(e.level).padStart(9)}`}));
  r.minor.forEach(e => rows.push({k: e.i, i: e.i, s:
    `${ET(e.t).padEnd(22)}  minor ${e.type.padEnd(5)} ` +
    `${e.dir.padEnd(4)}  through ${String(e.level).padStart(9)}`}));
  r.sweeps.forEach(s => rows.push({k: s.i, i: s.i, s:
    `${ET(s.t).padEnd(22)}  ~ sweep ${s.side.padEnd(7)} of ${String(s.level).padStart(9)}  ` +
    `by ${s.penetration.toFixed(2)}${s.isProtected ? '   [PROTECTED]' : ''}`}));
  rows.sort((a,b) => a.k - b.k || a.i - b.i);
  console.log(rows.map(r => '  ' + r.s).join('\n'));
}

if(want && TF.includes(want)){
  const x = run(want);
  summary(x);
  detail(x);
} else {
  console.log(`\nStructure engine over real MES data   (fractal N = ${N}, break on close)`);
  TF.forEach(tf => summary(run(tf)));
  console.log(`\n${'═'.repeat(74)}`);
  console.log('  node report.js <1d|4h|1h|15m> [N]   for the full timeline\n');
}
