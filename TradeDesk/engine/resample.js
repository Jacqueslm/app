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
module.exports = {resample};
