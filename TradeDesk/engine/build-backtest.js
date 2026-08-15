'use strict';
/* Bakes the engine and the 1H series into a single backtest.html. */
const fs = require('fs'), path = require('path');
const {load} = require('./csv');
const strip = f => fs.readFileSync(path.join(__dirname, f), 'utf8')
  .replace(/^'use strict';/, '')
  .replace(/const S = require\('\.\/structure'\);/, '')
  .replace(/const G = require\('\.\/gaps'\);/, '')
  .replace(/module\.exports = \{[\s\S]*?\};\s*$/, '');

const bars = load(path.join(__dirname, '..', 'data', 'MES-1h.csv'))
  .map(c => ({t: c.t, o: c.o, h: c.h, l: c.l, c: c.c}));

const engine = `const Loop = (function(){ ${strip('loop.js')}
  return {create, tick, DEFAULTS}; })();`;

const out = fs.readFileSync(path.join(__dirname, 'backtest-template.html'), 'utf8')
  .replace('/*__ENGINE__*/', engine)
  .replace('/*__DATA__*/', JSON.stringify(bars));

fs.writeFileSync(path.join(__dirname, '..', 'backtest.html'), out);
console.log(`backtest.html  ${(out.length/1024/1024).toFixed(2)} MB  ${bars.length} bars`);
