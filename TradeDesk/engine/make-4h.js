'use strict';
/* NAS100 and XAU only exist as 1h and 15m. Roll them up to 4h so the same
   engine can be pointed at either timeframe with nothing else changed. */
const fs = require('fs'), path = require('path');
const {load} = require('./csv');
const {resample} = require('./resample');
const dir = path.join(__dirname, '..', 'data');

for (const name of ['NAS100', 'XAU', 'MES']) {
  const src = load(path.join(dir, name + '-1h.csv'));
  const out = resample(src, 4 * 3600e3);
  const lines = ['time,open,high,low,close'];
  for (const c of out) lines.push([Math.floor(c.t / 1000), c.o, c.h, c.l, c.c].join(','));
  fs.writeFileSync(path.join(dir, name + '-4h.csv'), lines.join('\n') + '\n');
  console.log(name + '-4h.csv', out.length, 'bars',
    new Date(out[0].t).toISOString().slice(0,10), '→',
    new Date(out[out.length-1].t).toISOString().slice(0,10));
}
