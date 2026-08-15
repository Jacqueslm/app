'use strict';
/* Aggregate candles up to a higher timeframe. Buckets are absolute clock
   boundaries, which is how futures sessions actually align, and which means a
   session gap simply yields a bucket with fewer source bars rather than
   smearing across the break. */
function resample(candles, targetMs, offsetMs){
  /* Futures bars phase off the session open, not UTC midnight — CME index
     futures start at 18:00 ET, so a 4H bucket boundary sits two hours off the
     UTC grid. Default to the source series' own phase; pass offsetMs to match
     a specific vendor's grid. */
  const off = ((offsetMs != null ? offsetMs : (candles[0] ? candles[0].t : 0)) % targetMs
               + targetMs) % targetMs;
  const out = []; let cur = null, key = null;
  for(const c of candles){
    const k = Math.floor((c.t - off) / targetMs) * targetMs + off;
    if(k !== key){
      if(cur) out.push(cur);
      key = k; cur = {t:k, o:c.o, h:c.h, l:c.l, c:c.c, n:1};
    } else {
      cur.h = Math.max(cur.h, c.h);
      cur.l = Math.min(cur.l, c.l);
      cur.c = c.c; cur.n++;
    }
  }
  if(cur) out.push(cur);
  return out;
}


/* Daily bars for CME index futures cannot be bucketed on a fixed offset: the
   session runs 18:00 ET to 17:00 ET, and the ET clock shifts twice a year, so
   a fixed grid mis-assigns the bars around each DST change. Bucketing by the
   actual ET calendar date of (bar time + 6h) puts the 18:00 open into the
   session it belongs to and follows DST automatically. */
const ET_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
});

function resampleDaily(candles){
  const out = []; let cur = null, key = null;
  for(const c of candles){
    const k = ET_DATE.format(new Date(c.t + 6*3600*1000));
    if(k !== key){
      if(cur) out.push(cur);
      key = k; cur = {t:c.t, o:c.o, h:c.h, l:c.l, c:c.c, n:1};
    } else {
      cur.h = Math.max(cur.h, c.h);
      cur.l = Math.min(cur.l, c.l);
      cur.c = c.c; cur.n++;
    }
  }
  if(cur) out.push(cur);
  return out;
}

module.exports = {resample, resampleDaily};
