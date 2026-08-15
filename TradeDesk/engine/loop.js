'use strict';
/* ---------------------------------------------------------------------------
   The loop.

     track      structure, folded one candle at a time
     compare    price against the level already computed
     enter      when price reaches it
     exit       at the target, the stop, or invalidation

   Same four steps, with the difference that every number here was measured
   rather than claimed.

   This is a state machine, not a re-scan. analyze() walks the whole array and
   costs 129ms on 21,000 bars; that is fine for research and wrong for a loop.
   tick() folds in one candle and holds everything it needs between calls, so
   the cost per bar is flat no matter how long the session has run.

   It must produce exactly the trades the backtest produced, or the backtest was
   measuring something else. loop.test.js asserts that over 21,369 bars.

   No orders. No broker. It returns a decision; the human places it.
   --------------------------------------------------------------------------- */

const DEFAULTS = {
  fractalN : 2,
  depth    : 0.75,     // how far back into the leg the entry rests
  exitFrac : 0.65,     // exit at this fraction of the leg, measured from origin
  tickBuffer: 0.25,
  maxBars  : 40        // a leg older than this is stale
};

/* One timeframe's structure, folded a candle at a time. */
function newStruct(N){
  return {N, n:0, buf:[], swings:[], bias:null, minorBias:null,
          pendingHigh:null, pendingLow:null, lastHigh:null, lastLow:null,
          protectedLow:null, protectedHigh:null};
}

const ET_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit'});

function create(opts){
  const o = Object.assign({}, DEFAULTS, opts || {});
  return {
    o, n: 0,
    h1: newStruct(o.fractalN),      // execution
    h4: newStruct(o.fractalN),      // external
    d1: newStruct(o.fractalN),      // external
    agg4: null, aggD: null, dKey: null,   // buckets still filling
    leg: null,
    pos: null,
    armed: null,
    trades: []
  };
}

/* Accumulate a 1H candle into a higher-timeframe bucket, returning the bucket
   only once it is COMPLETE — which is what keeps the higher timeframes honest:
   a bar still forming is never visible. */
function roll(bucket, c, key){
  if(!bucket || bucket.key !== key)
    return {key, o:c.o, h:c.h, l:c.l, c:c.c, t:c.t};
  bucket.h = Math.max(bucket.h, c.h);
  bucket.l = Math.min(bucket.l, c.l);
  bucket.c = c.c;
  return bucket;
}

/* --- the same swing test as structure.js, over the rolling window --- */
function swingAt(buf, k, N){
  const c = buf, i = k;
  if(i - N < 0 || i + N >= c.length) return null;
  let hi = true, lo = true;
  for(let j = i - N; j < i; j++){
    if(!(c[i].h >  c[j].h)) hi = false;
    if(!(c[i].l <  c[j].l)) lo = false;
  }
  for(let j = i + 1; j <= i + N; j++){
    if(!(c[i].h >= c[j].h)) hi = false;
    if(!(c[i].l <= c[j].l)) lo = false;
  }
  return hi ? 'high' : lo ? 'low' : null;
}

function pushSwing(st, sw){
  const last = st.swings[st.swings.length - 1];
  if(last && last.kind === sw.kind){
    const more = sw.kind === 'high' ? sw.price > last.price : sw.price < last.price;
    if(!more) return;
    st.swings.pop();
    if(st.pendingHigh === last) st.pendingHigh = null;
    if(st.pendingLow  === last) st.pendingLow  = null;
  }
  let prev = null;
  for(let k = st.swings.length - 1; k >= 0; k--)
    if(st.swings[k].kind === sw.kind){ prev = st.swings[k]; break; }
  sw.label = !prev ? '—'
    : sw.kind === 'high' ? (sw.price > prev.price ? 'HH' : 'LH')
                         : (sw.price > prev.price ? 'HL' : 'LL');
  st.swings.push(sw);
  if(st.swings.length > 64) st.swings.shift();          // bounded memory
  if(sw.kind === 'high'){ st.pendingHigh = sw; st.lastHigh = sw; }
  else                  { st.pendingLow  = sw; st.lastLow  = sw; }
}

/* One candle into one timeframe. Returns {majorBOS, events, minorLevel}. */
function feedStruct(st, c){
  const N = st.N, i = st.n++;
  st.buf.push(c);
  if(st.buf.length > 2*N + 2) st.buf.shift();

  const events = [];

  /* 1 — confirm the swing N bars back */
  const k = st.buf.length - 1 - N;
  if(k >= N){
    const kind = swingAt(st.buf, k, N);
    if(kind) pushSwing(st, {
      i: i - N, kind, price: kind === 'high' ? st.buf[k].h : st.buf[k].l,
      confirmedAt: i, label: null
    });
  }

  /* 2 — breaks, minor then major, exactly as structure.js orders them */
  const mUp   = st.pendingHigh && st.pendingHigh.confirmedAt < i && c.c > st.pendingHigh.price;
  const mDown = st.pendingLow  && st.pendingLow.confirmedAt  < i && c.c < st.pendingLow.price;
  let mDir = null;
  if(mUp && mDown) mDir = c.c >= c.o ? 'bull' : 'bear';
  else if(mUp)   mDir = 'bull';
  else if(mDown) mDir = 'bear';

  let minorLevel = null;
  if(mDir === 'bull'){ minorLevel = st.pendingHigh.price; st.pendingHigh = null; st.minorBias = 'bull'; }
  else if(mDir === 'bear'){ minorLevel = st.pendingLow.price; st.pendingLow = null; st.minorBias = 'bear'; }

  let majorBOS = null;
  if(st.bias === 'bull'){
    if(mDir === 'bull'){ majorBOS = 'bull'; if(st.lastLow) st.protectedLow = st.lastLow; }
    else if(st.protectedLow && c.c < st.protectedLow.price){
      events.push({type:'CHoCH', dir:'bear', level:st.protectedLow.price});
      st.bias = 'bear'; st.protectedHigh = st.lastHigh; st.protectedLow = null;
    }
  } else if(st.bias === 'bear'){
    if(mDir === 'bear'){ majorBOS = 'bear'; if(st.lastHigh) st.protectedHigh = st.lastHigh; }
    else if(st.protectedHigh && c.c > st.protectedHigh.price){
      events.push({type:'CHoCH', dir:'bull', level:st.protectedHigh.price});
      st.bias = 'bull'; st.protectedLow = st.lastLow; st.protectedHigh = null;
    }
  } else if(mDir){
    st.bias = mDir; majorBOS = mDir;
    if(mDir === 'bull') st.protectedLow = st.lastLow; else st.protectedHigh = st.lastHigh;
  }

  if(majorBOS) events.push({type:'BOS', dir:majorBOS, level:minorLevel});
  return {majorBOS, events, i};
}

/* --- one candle in, one decision out --- */
function tick(st, c){
  const o = st.o, i = st.n++;

  /* higher timeframes first, and only on completed buckets */
  const k4 = Math.floor((c.t - 7200000) / 14400000);
  if(st.agg4 && st.agg4.key !== k4){ feedStruct(st.h4, st.agg4); st.agg4 = null; }
  st.agg4 = roll(st.agg4, c, k4);

  const kD = ET_DATE.format(new Date(c.t + 6*3600*1000));
  if(st.aggD && st.aggD.key !== kD){ feedStruct(st.d1, st.aggD); st.aggD = null; }
  st.aggD = roll(st.aggD, c, kD);

  const r = feedStruct(st.h1, c);
  const events = r.events;
  const external = (st.h4.bias && st.h4.bias === st.d1.bias) ? st.h4.bias : null;

  /* 3 — a BOS starts a fresh leg, but only with the higher timeframes behind it */
  if(r.majorBOS && r.majorBOS === external){
    const origin = r.majorBOS === 'bull'
      ? (st.h1.protectedLow  ? st.h1.protectedLow.price  : null)
      : (st.h1.protectedHigh ? st.h1.protectedHigh.price : null);
    if(origin != null)
      st.leg = {dir: r.majorBOS, origin, extreme: r.majorBOS === 'bull' ? c.h : c.l, bornAt: i};
  }

  /* 4 — the position state machine */
  let action = null, reason = null;

  if(st.pos){
    const p = st.pos;
    const hitStop   = p.dir === 'bull' ? c.l <= p.stop   : c.h >= p.stop;
    const hitTarget = p.dir === 'bull' ? c.h >= p.target : c.l <= p.target;
    /* stop first — a bar touching both is unresolvable from OHLC, and taking
       the target would be marking your own homework */
    if(hitStop){
      action = 'stop'; reason = `stopped at ${p.stop}`;
      st.trades.push({...p, exitAt:i, exit:p.stop, r:-1});
      st.pos = null;
    } else if(hitTarget){
      action = 'exit'; reason = `target ${p.target}`;
      st.trades.push({...p, exitAt:i, exit:p.target, r:Math.abs(p.target-p.entry)/p.risk});
      st.pos = null;
    }
  }

  if(st.leg && !st.pos){
    const L = st.leg, dir = L.dir;
    L.extreme = dir === 'bull' ? Math.max(L.extreme, c.h) : Math.min(L.extreme, c.l);

    const dead = (dir === 'bull' ? c.c < L.origin : c.c > L.origin) ||
                 (i - L.bornAt > o.maxBars);
    if(dead){ st.leg = null; if(!action){ action = null; reason = 'leg invalidated'; } }
    else if(i > L.bornAt){
      const span = Math.abs(L.extreme - L.origin);
      if(span > 0){
        const entry  = dir === 'bull' ? L.extreme - o.depth*span : L.extreme + o.depth*span;
        const stop   = dir === 'bull' ? L.origin - o.tickBuffer  : L.origin + o.tickBuffer;
        const target = dir === 'bull' ? L.origin + o.exitFrac*span : L.origin - o.exitFrac*span;
        const risk   = Math.abs(entry - stop);
        const reachable = dir === 'bull' ? target > entry : target < entry;
        const touched   = dir === 'bull' ? c.l <= entry : c.h >= entry;

        if(risk > 0 && reachable && touched){
          st.pos = {dir, entry, stop, target, risk, entryAt: i, origin: L.origin, extreme: L.extreme};
          action = 'enter'; reason = `limit filled at ${entry.toFixed(2)}`;
          st.leg = null;

          /* The fill happened inside this bar, so the rest of this bar can still
             take the stop or the target. Skipping it would score a trade stopped
             on its own entry bar as if it had survived — the same mistake the
             batch evaluator made before it was fixed. Stop first, because the
             order within a bar is unknowable from OHLC. */
          const p = st.pos;
          const sHit = dir === 'bull' ? c.l <= p.stop : c.h >= p.stop;
          if(sHit){
            action = 'stop'; reason = 'filled and stopped on the same bar';
            st.trades.push({...p, exitAt:i, exit:p.stop, r:-1});
            st.pos = null;
          }
          /* The TARGET is deliberately not honoured on the entry bar. OHLC
             carries no path: a bull entry fills when the bar trades DOWN to the
             limit, and that bar's high may well have printed before the fill.
             Counting it as a win assumes an order of events the data cannot
             show. The stop is treated differently on purpose — taking the
             pessimistic side of an unknowable ordering is the only safe
             asymmetry. */
        } else if(risk > 0 && reachable){
          st.armed = {dir, entry, stop, target, risk};
        }
      }
    }
  }
  if(!st.leg) st.armed = null;

  return {
    i, t: c.t, price: c.c,
    bias: st.h1.bias, daily: st.d1.bias, h4: st.h4.bias, external,
    protected: st.h1.protectedLow ? st.h1.protectedLow.price
             : st.h1.protectedHigh ? st.h1.protectedHigh.price : null,
    state: st.pos ? 'in' : st.armed ? 'armed' : 'flat',
    levels: st.pos || st.armed || null,
    action, reason, events
  };
}

module.exports = {create, tick, DEFAULTS};
