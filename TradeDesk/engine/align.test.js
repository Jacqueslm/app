'use strict';
/* Tests for multi-timeframe alignment. The point of most of these is a single
   property: no higher timeframe may contribute information that had not closed
   yet. Everything else the method does is built on top of that being true. */

const path = require('path');
const {align, findSetups, evaluate, barDuration, lastClosedAt} = require('./align');
const {load} = require('./csv');
const {resample} = require('./resample');
const S = require('./structure');

/* The 1H series now reaches back years further than the 4H and daily exports,
   so tests that pair them must derive the higher timeframe from the 1H rather
   than loading a file whose history starts later. */
const derive4h = h1 => resample(h1, 4*3600000, h1[0].t);

let pass = 0, fail = 0; const out = [];
function check(name, got, want){
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  out.push((ok ? '  ok    ' : '  FAIL  ') + name +
    (ok ? '' : `\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
}
const group = n => out.push('\n' + n);

const HOUR = 3600000;
const bars = (n, step, t0) => Array.from({length:n}, (_, i) => ({
  t: (t0 || 0) + i*step, o:100+i, h:101+i, l:99+i, c:100.5+i
}));

/* ------------------------------------------------------------ mechanics -- */
group('Bar duration and closure');
{
  check('duration is the modal gap', barDuration(bars(10, HOUR)), HOUR);
  const gappy = bars(10, HOUR);
  gappy[5].t += 12*HOUR;                       // a weekend
  for(let i=6;i<10;i++) gappy[i].t += 12*HOUR;
  check('a session gap does not change it', barDuration(gappy), HOUR);
}
{
  const c = bars(5, 4*HOUR, 0);                // closes at 4h, 8h, 12h, 16h, 20h
  check('nothing has closed before the first bar ends', lastClosedAt(c, 4*HOUR, 1*HOUR), -1);
  check('the first bar closes exactly at its end',      lastClosedAt(c, 4*HOUR, 4*HOUR), 0);
  check('one second before, it has not',                lastClosedAt(c, 4*HOUR, 4*HOUR - 1), -1);
  check('mid-way through the third bar',                lastClosedAt(c, 4*HOUR, 10*HOUR), 1);
}
{
  /* the scan carries a cursor between calls; a stale one must not mislead it */
  const c = bars(50, HOUR, 0);
  const truth = t => lastClosedAt(c, HOUR, t, 0);
  check('a forward hint gives the same answer',
    [5,20,44].map(k => lastClosedAt(c, HOUR, k*HOUR, 49)), [5,20,44].map(k => truth(k*HOUR)));
  check('a backward hint gives the same answer',
    [5,20,44].map(k => lastClosedAt(c, HOUR, k*HOUR, 0)),  [5,20,44].map(k => truth(k*HOUR)));
}

/* ------------------------------------------------------------ lookahead -- */
group('No lookahead (the whole point)');
{
  const h1  = load(path.join(__dirname, '..', 'data', 'MES-1h.csv'));
  const h4  = derive4h(h1);
  const d1  = load(path.join(__dirname, '..', 'data', 'MES-1d.csv'));
  const a   = align({'1d':d1, '4h':h4, '1h':h1}, {exec:'1h', external:['1d','4h'], internal:[]});

  const dur = {'1d':barDuration(d1), '4h':barDuration(h4)};
  const src = {'1d':d1, '4h':h4};

  let bad = 0, checked = 0;
  for(const row of a.rows){
    const execClose = row.t + barDuration(h1);
    for(const tf of ['1d','4h']){
      const j = row.tf[tf].barIndex;
      if(j < 0) continue;
      checked++;
      /* the bar used must have closed by now… */
      if(src[tf][j].t + dur[tf] > execClose) bad++;
      /* …and the next one must not have */
      if(j+1 < src[tf].length && src[tf][j+1].t + dur[tf] <= execClose) bad++;
    }
  }
  check('every higher-timeframe bar consulted had already closed', bad, 0);
  check('and it is the latest such bar, not an older one', checked > 700, true);
}
{
  /* Truncating the future must not change the past. If a bias at bar 200 shifts
     when later bars are removed, something downstream is reading ahead. */
  const h1 = load(path.join(__dirname, '..', 'data', 'MES-1h.csv'));
  const h4 = derive4h(h1);
  const cut = 250;
  const full = align({'4h':h4, '1h':h1}, {exec:'1h', external:['4h'], internal:[]});
  const part = align({'4h':h4.filter(c => c.t <= h1[cut].t),
                      '1h':h1.slice(0, cut+1)}, {exec:'1h', external:['4h'], internal:[]});
  check('bias history is identical when the future is removed',
    part.rows.map(r => r.external),
    full.rows.slice(0, cut+1).map(r => r.external));
}
{
  /* stateAt must never reach past the bar asked for */
  const h1 = load(path.join(__dirname, '..', 'data', 'MES-1h.csv'));
  const res = S.analyze(h1, {fractalN:2});
  let bad = 0;
  for(let i = 0; i < h1.length; i += 17){
    const st = S.stateAt(res, i);
    const lastEv = [...res.major].reverse().find(e => e.i <= i);
    if((lastEv ? lastEv.dir : null) !== st.bias) bad++;
  }
  check('stateAt(i) matches the last event at or before i', bad, 0);
}

/* -------------------------------------------------------------- setups --- */
group('Setups');
{
  const h1 = load(path.join(__dirname, '..', 'data', 'MES-1h.csv'));
  const h4 = derive4h(h1);
  const d1 = load(path.join(__dirname, '..', 'data', 'MES-1d.csv'));
  const a  = align({'1d':d1,'4h':h4,'1h':h1}, {exec:'1h', external:['1d','4h'], internal:[]});
  const s  = findSetups(a);

  check('every setup agrees with its external bias',
    s.every(x => x.dir === x.external), true);
  check('confirmation always follows the sweep, never precedes it',
    s.every(x => x.shiftAt > x.sweepAt), true);
  check('confirmation lands inside the window',
    s.every(x => x.shiftAt - x.sweepAt <= 6), true);
  check('stop is on the losing side of entry',
    s.every(x => x.dir === 'bull' ? x.stop < x.entry : x.stop > x.entry), true);
  check('risk is always positive', s.every(x => x.risk > 0), true);

  const ev = evaluate(s, h1, 2);
  check('a resolved trade is worth +2R or -1R',
    ev.filter(x => x.outcome !== 'open').every(x => x.r === 2 || x.r === -1), true);
  check('nothing resolves before it is entered',
    ev.every(x => x.barsHeld >= 0), true);
}

/* ------------------------------------------------------ pullback timing -- */
group('Pullback entries cannot precede their own signal');
{
  const {findPullbacks} = require('./align');
  const h2 = load(path.join(__dirname, '..', 'data', 'MES-2h.csv'));
  const d1 = load(path.join(__dirname, '..', 'data', 'MES-1d.csv'));
  const a  = align({'1d':d1,'2h':h2}, {exec:'2h', external:['1d'], internal:[]});

  for(const on of ['swing','bos']){
    const p = findPullbacks(a, {depth:0.62, on});
    check(`[${on}] entry is strictly after the leg became knowable`,
      p.every(x => x.entryAt > x.bosAt), true);
    check(`[${on}] stop sits beyond the origin, never on it`,
      p.every(x => x.dir === 'bull' ? x.stop < x.origin : x.stop > x.origin), true);
    check(`[${on}] risk is positive`, p.every(x => x.risk > 0), true);
    check(`[${on}] entry lies between origin and extreme`,
      p.every(x => x.dir === 'bull'
        ? x.entry > x.origin && x.entry <= x.extreme
        : x.entry < x.origin && x.entry >= x.extreme), true);
  }
}

group('Non-overlapping histories fail loudly');
{
  let msg = null;
  try { barDuration([]); } catch(e){ msg = e.message; }
  check('an empty series explains itself', /do not overlap/.test(msg || ''), true);
  msg = null;
  try { barDuration([{t:0}]); } catch(e){ msg = e.message; }
  check('a single bar does too', /at least 2 bars/.test(msg || ''), true);
}

console.log(out.join('\n'));
console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
