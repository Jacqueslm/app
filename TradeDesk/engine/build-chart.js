'use strict';
/* Bakes the engine and the CSV data into one self-contained chart.html, so it
   opens straight off the filesystem with no server and no fetch(). */
const fs = require('fs'), path = require('path');
const {load} = require('./csv');

const TFS = ['1d','4h','2h','1h','15m'];
const root = path.join(__dirname, '..');

const {resample} = require('./resample');
const data = {};
TFS.forEach(tf => {
  data[tf] = load(path.join(root, 'data', `MES-${tf}.csv`))
    .map(c => ({t:c.t, o:c.o, h:c.h, l:c.l, c:c.c}));
});
/* 2H and 4H rebuilt from the 466-day 1H series — identical to the vendor
   exports on every overlapping bucket, and several times deeper. */
const slim = c => ({t:c.t, o:c.o, h:c.h, l:c.l, c:c.c});
data['2h'] = resample(data['1h'], 2*3600*1000, data['2h'][0].t).map(slim);
data['4h'] = resample(data['1h'], 4*3600*1000, data['4h'][0].t).map(slim);

const engine = fs.readFileSync(path.join(__dirname, 'structure.js'), 'utf8')
  .replace(/^'use strict';/, '')
  .replace(/if\(typeof module[\s\S]*?module\.exports = API;/, '');

const out = fs.readFileSync(path.join(__dirname, 'chart-template.html'), 'utf8')
  .replace('/*__ENGINE__*/', engine)
  .replace('/*__DATA__*/', JSON.stringify(data));

const dest = path.join(root, 'chart.html');
fs.writeFileSync(dest, out);
console.log(`chart.html  ${(out.length/1024).toFixed(0)} KB  ` +
  TFS.map(tf => `${tf}:${data[tf].length}`).join(' '));
