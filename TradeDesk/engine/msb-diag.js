'use strict';
/* Gate diagnostic — where do setups die?
   Usage: node engine/msb-diag.js [--align] [--pv 3] */
const {run, prep} = require('./msb-sweep');
const argv = process.argv.slice(2);
const useAlign = argv.includes('--align');
const pv = +(argv[argv.indexOf('--pv') + 1]) || 3;

const D = prep([pv], useAlign);
console.log(`\nMES 1H · ${D.span} · ${D.months.toFixed(1)} months · swing strength ${pv}` +
            `\n15m alignment: ${useAlign ? 'ON (four timeframes)' : 'OFF (three timeframes)'}\n`);

for(const m of [{k:'pullback',usePB:true,useSeq:false},
                {k:'retest',  usePB:false,useSeq:true},
                {k:'both',    usePB:true, useSeq:true}]){
  const r = run(D, {pv, holdBars: 1, usePB: m.usePB, useSeq: m.useSeq, useAlign});
  const g = r.gates;
  const pct = (a, b) => b ? (a / b * 100).toFixed(1).padStart(5) + '%' : '    -';
  console.log(`── ${m.k} ──`);
  console.log(`  1H bars examined                 ${String(g.bars).padStart(6)}`);
  console.log(`  ...inside 09:30-15:00 ET         ${String(g.inSess).padStart(6)}  ${pct(g.inSess, g.bars)} of bars`);
  console.log(`  ...with every timeframe aligned  ${String(g.aligned).padStart(6)}  ${pct(g.aligned, g.bars)} of bars`);
  console.log(`  structural triggers (any bar)    ${String(g.rawTrig).padStart(6)}`);
  console.log(`     survived alignment            ${String(g.afterAlign).padStart(6)}  ${pct(g.afterAlign, g.rawTrig)} kept`);
  console.log(`     killed: already in a trade    ${String(g.rejOpen).padStart(6)}`);
  console.log(`     killed: bullet spent today    ${String(g.rejDay).padStart(6)}`);
  console.log(`     killed: outside the session   ${String(g.rejSess).padStart(6)}`);
  console.log(`     killed: not enough room       ${String(g.rejRoom).padStart(6)}`);
  console.log(`  TRADES TAKEN                     ${String(g.taken).padStart(6)}  ${(g.taken / D.months).toFixed(2)}/month\n`);
}
