'use strict';
/* CSV loader for TradingView exports.

   Format seen from TradingView's "Export chart data":
     time,open,high,low,close,Volume
     1786358700,7786,7788,7783.75,7785.25,2082

   `time` is Unix epoch seconds, so it carries no timezone of its own. Everything
   downstream displays in America/New_York, because that is the clock a CME index
   futures trader actually reads. Note TradingView stamps a daily bar with the
   session *open* (18:00 ET the previous calendar day), not the calendar date. */

const fs = require('fs');

function parse(text){
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].toLowerCase().split(',').map(s => s.trim());

  const col = name => {
    const i = head.indexOf(name);
    if(i < 0) throw new Error(`CSV is missing a "${name}" column. Found: ${head.join(', ')}`);
    return i;
  };
  const iT = col('time'), iO = col('open'), iH = col('high'), iL = col('low'), iC = col('close');
  const iV = head.indexOf('volume');

  const out = [];
  for(let n = 1; n < lines.length; n++){
    const row = lines[n].split(',');
    if(row.length < 5) continue;

    const raw = row[iT].trim();
    /* epoch seconds, epoch millis, or an ISO string — accept all three */
    const t = /^\d+$/.test(raw)
      ? (raw.length > 10 ? Number(raw) : Number(raw) * 1000)
      : Date.parse(raw);

    const c = {
      t,
      o: parseFloat(row[iO]), h: parseFloat(row[iH]),
      l: parseFloat(row[iL]), c: parseFloat(row[iC]),
      v: iV >= 0 ? parseFloat(row[iV]) : null
    };
    if(!isFinite(c.t) || !isFinite(c.o) || !isFinite(c.h) || !isFinite(c.l) || !isFinite(c.c)) continue;
    out.push(c);
  }

  out.sort((a, b) => a.t - b.t);
  return out;
}

/* Sanity checks worth running before trusting anything built on the data. */
function audit(candles){
  const problems = [];
  let dupes = 0, badRange = 0;

  for(let i = 0; i < candles.length; i++){
    const c = candles[i];
    if(c.h < c.l || c.h < c.o || c.h < c.c || c.l > c.o || c.l > c.c) badRange++;
    if(i > 0 && candles[i].t === candles[i-1].t) dupes++;
  }
  if(badRange) problems.push(`${badRange} bars where OHLC is internally inconsistent`);
  if(dupes)    problems.push(`${dupes} duplicate timestamps`);

  /* Modal gap between bars — the nominal timeframe. Anything much larger is a
     session break or a holiday, which is expected and not an error. */
  const gaps = {};
  for(let i = 1; i < candles.length; i++){
    const g = (candles[i].t - candles[i-1].t) / 1000;
    gaps[g] = (gaps[g] || 0) + 1;
  }
  const modal = Object.entries(gaps).sort((a,b) => b[1] - a[1])[0];
  const step = modal ? Number(modal[0]) : null;
  const breaks = Object.entries(gaps)
    .filter(([g]) => Number(g) > step * 1.5)
    .reduce((a, [,n]) => a + n, 0);

  return {n: candles.length, stepSeconds: step, sessionBreaks: breaks, problems};
}

const load = path => parse(fs.readFileSync(path, 'utf8'));

const ET = t => new Date(t).toLocaleString('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: 'short', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false
});

module.exports = {load, parse, audit, ET};
