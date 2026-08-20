'use strict';
/* =============================================================================
   MSB PURE — parameter sweep

   A JavaScript port of Trading/pine/MSB-Pure.pine, run over the local MES data
   so the settings can be calibrated against real bars instead of impressions.

   The question it answers is the one the Pine header asks: which swing strength
   makes the machine find setups at roughly the rate a human finds them? Trade
   COUNT is the first thing to read. Expectancy only means something once the
   frequency is in the right neighbourhood.

   Everything is measured in R, so position size does not affect the edge — but
   an equity column at the configured risk % is printed too, because that is
   where 10% stops being an abstraction.

   No lookahead: a pivot is confirmed pvR bars after it forms, and a higher
   timeframe's trend is read from the last HTF bar that CLOSED at or before the
   execution bar's close. Both match the Pine exactly.
   ========================================================================== */

const path = require('path');
const {load} = require('./csv');
const {resample, resampleDaily} = require('./resample');

const HOUR = 3600e3;

// ── ET clock, precomputed once per bar (Intl is far too slow to call in a loop)
const ET_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
});
function etStamp(ms){
  const p = ET_FMT.formatToParts(new Date(ms));
  const g = t => (p.find(x => x.type === t) || {}).value;
  return {date: `${g('year')}-${g('month')}-${g('day')}`, hm: +g('hour') * 100 + +g('minute')};
}

/* ── Structure ──────────────────────────────────────────────────────────────
   A swing high is a bar whose high is the highest of the pvL bars before and
   pvR bars after it. It does not exist until those pvR bars have closed, which
   is why structure confirms late and why that lateness is honest rather than a
   flaw. trend[i] / pivHi[i] / pivLo[i] are the values KNOWN at the close of
   bar i — never before. */
function structure(c, pvL, pvR){
  const n = c.length;
  const trend = new Int8Array(n), pivHi = new Float64Array(n), pivLo = new Float64Array(n);
  let h1 = NaN, h2 = NaN, l1 = NaN, l2 = NaN, t = 0, lastHi = NaN, lastLo = NaN;
  // Bar index each pivot sits on, so a pullback can be told from a fresh break.
  const hiBar = new Int32Array(n).fill(-1), loBar = new Int32Array(n).fill(-1);
  let lastHiBar = -1, lastLoBar = -1;

  for(let i = 0; i < n; i++){
    const j = i - pvR;                       // the bar that could be confirmed now
    if(j >= pvL){
      let isHi = true, isLo = true;
      const hj = c[j].h, lj = c[j].l;
      for(let k = j - pvL; k <= j + pvR; k++){
        if(k === j) continue;
        if(c[k].h >= hj) isHi = false;
        if(c[k].l <= lj) isLo = false;
        if(!isHi && !isLo) break;
      }
      if(isHi){ h2 = h1; h1 = hj; lastHi = hj; lastHiBar = j; }
      if(isLo){ l2 = l1; l1 = lj; lastLo = lj; lastLoBar = j; }
      if(!isNaN(h1) && !isNaN(h2) && !isNaN(l1) && !isNaN(l2)){
        if(h1 > h2 && l1 > l2) t = 1;
        else if(h1 < h2 && l1 < l2) t = -1;
      }
    }
    trend[i] = t; pivHi[i] = lastHi; pivLo[i] = lastLo;
    hiBar[i] = lastHiBar; loBar[i] = lastLoBar;
  }
  return {trend, pivHi, pivLo, hiBar, loBar};
}

/* Map each execution bar to the last higher-timeframe bar that had already
   CLOSED when the execution bar closed. This is the whole of "no lookahead". */
function alignIndex(execCloseT, htf, htfMs){
  const out = new Int32Array(execCloseT.length).fill(-1);
  let j = -1;
  for(let i = 0; i < execCloseT.length; i++){
    while(j + 1 < htf.length && htf[j + 1].t + htfMs <= execCloseT[i]) j++;
    out[i] = j;
  }
  return out;
}

/* ── The run ─────────────────────────────────────────────────────────────── */
function run(D, opt){
  const {exec, execET, S, maps} = D;
  const {pv, holdBars, usePB, useSeq} = opt;
  const setupTO = opt.setupTO ?? 40, freshBrk = opt.freshBrk ?? true;
  const minRoom = opt.minRoom ?? 1.0, stopBuf = (opt.stopTicks ?? 4) * 0.25;
  const maxPerDay = opt.maxPerDay ?? 1, riskPct = opt.riskPct ?? 10;
  const sessFrom = opt.sessFrom ?? 930, sessTo = opt.sessTo ?? 1500;

  const X = S.exec[pv], B4 = S.b4[pv], BD = S.bd[pv], B15 = S.a15[pv];
  const useAlign = opt.useAlign && B15 !== undefined;

  // sequence state — a direct port of the Pine block
  let st = 0, stDir = 0, zone = NaN, prot = NaN, trigLvl = NaN,
      pullExt = NaN, legHi = NaN, legLo = NaN, held = 0, stBars = 0;

  let day = '', took = 0;
  const trades = [];
  let open = null;                          // the live position, if any

  // The gate funnel: where do setups actually die? This is the number that
  // tells you whether a rule is selective or simply broken.
  const g = {bars: 0, inSess: 0, aligned: 0, rawTrig: 0, afterAlign: 0,
             rejOpen: 0, rejDay: 0, rejSess: 0, rejRisk: 0, rejRoom: 0, taken: 0};

  for(let i = 0; i < exec.length; i++){
    const c = exec[i], et = execET[i];
    if(et.date !== day){ day = et.date; took = 0; }

    // ── manage an open position first: this bar's range decides its fate ────
    if(open){
      const L = open.dir === 1;
      const hitStop = L ? c.l <= open.stop : c.h >= open.stop;
      const hitT1   = !open.t1 && (L ? c.h >= open.T1 : c.l <= open.T1);
      const hitT2   = L ? c.h >= open.T2 : c.l <= open.T2;
      // Both touched inside one bar: assume the stop went first. Pessimistic on
      // purpose — the alternative flatters every result that matters.
      if(hitStop){
        open.R += open.t1 ? 0 : -1;         // BE stop after T1 costs nothing more
        trades.push(finish(open, open.t1 ? 'BE after T1' : 'stop'));
        open = null;
      } else if(hitT1 && hitT2 && open.T2 !== open.T1){
        open.R += 0.5 + 0.5 * open.room;
        trades.push(finish(open, 'T2'));
        open = null;
      } else {
        if(hitT1){ open.t1 = true; open.R += 0.5; open.stop = open.entry;
                   if(open.T2 === open.T1){ trades.push(finish(open, 'scalp T1')); open = null; } }
        if(open && hitT2 && open.t1){ open.R += 0.5 * open.room; trades.push(finish(open, 'T2')); open = null; }
      }
      // Flatten at the session close — the bot does, so the test must.
      if(open && et.hm >= sessTo){
        const px = c.c, r = (L ? px - open.entry : open.entry - px) / open.risk;
        open.R += (open.t1 ? 0.5 : 1) * r;
        trades.push(finish(open, 'EOD'));
        open = null;
      }
    }

    // ── higher-timeframe permission, as of this bar's close ────────────────
    const i4 = maps.b4[i], id = maps.bd[i], i15 = useAlign ? maps.a15[i] : -1;
    if(i4 < 0 || id < 0 || (useAlign && i15 < 0)) continue;
    const tD = BD.trend[id], t4 = B4.trend[i4], tX = X.trend[i], t15 = useAlign ? B15.trend[i15] : 0;

    const alignedL = tD === 1 && t4 === 1 && tX === 1 && (!useAlign || t15 === 1);
    const alignedS = tD === -1 && t4 === -1 && tX === -1 && (!useAlign || t15 === -1);
    g.bars++;
    if(et.hm >= sessFrom && et.hm <= sessTo) g.inSess++;
    if(alignedL || alignedS) g.aligned++;

    // ── structure on the execution chart ───────────────────────────────────
    const swHi = X.pivHi[i], swLo = X.pivLo[i];
    const pPrev = i > 0 ? exec[i - 1].c : c.c;
    const bosUp = !isNaN(swHi) && c.c > swHi && pPrev <= swHi;
    const bosDn = !isNaN(swLo) && c.c < swLo && pPrev >= swLo;

    // ── the retest sequence ────────────────────────────────────────────────
    let armed = false;
    if(st === 0 && useSeq){
      if(bosUp && tD === 1){
        st = 1; stDir = 1; zone = swHi; prot = isNaN(swLo) ? c.l : swLo;
        legLo = prot; legHi = c.h; pullExt = c.l; trigLvl = NaN; held = 0; stBars = 0; armed = true;
      } else if(bosDn && tD === -1){
        st = 1; stDir = -1; zone = swLo; prot = isNaN(swHi) ? c.h : swHi;
        legHi = prot; legLo = c.l; pullExt = c.h; trigLvl = NaN; held = 0; stBars = 0; armed = true;
      }
    } else if(st > 0) stBars++;

    if(st > 0 && !armed){
      if(stDir === 1){
        pullExt = Math.min(pullExt, c.l); legHi = Math.max(legHi, c.h);
        if(st === 1 && c.l < zone) st = 2;
        else if(st === 2 && c.c > zone){ st = 3; trigLvl = c.h; held = 0; }
        else if(st === 3){ if(c.c < zone){ st = 2; held = 0; } else held++; }
      } else {
        pullExt = Math.max(pullExt, c.h); legLo = Math.min(legLo, c.l);
        if(st === 1 && c.h > zone) st = 2;
        else if(st === 2 && c.c < zone){ st = 3; trigLvl = c.l; held = 0; }
        else if(st === 3){ if(c.c > zone){ st = 2; held = 0; } else held++; }
      }
    }
    if(st > 0 && ((stDir === 1 && ((!isNaN(prot) && c.c < prot) || tD === -1)) ||
                  (stDir === -1 && ((!isNaN(prot) && c.c > prot) || tD === 1)) || stBars > setupTO)){
      st = 0; stDir = 0; zone = NaN; prot = NaN; trigLvl = NaN;
    }

    // ── triggers ───────────────────────────────────────────────────────────
    const heldOK = held >= holdBars;
    const seqL = useSeq && st === 3 && stDir === 1 && heldOK && (!freshBrk || (!isNaN(trigLvl) && c.c > trigLvl));
    const seqS = useSeq && st === 3 && stDir === -1 && heldOK && (!freshBrk || (!isNaN(trigLvl) && c.c < trigLvl));
    // Pullback: a swing AGAINST the trend is on the record (so a pullback
    // actually happened and finished), and price has just closed back through
    // the swing it came from.
    const pbL = usePB && bosUp && X.loBar[i] > X.hiBar[i] && !isNaN(swLo) && c.c > swLo;
    const pbS = usePB && bosDn && X.hiBar[i] > X.loBar[i] && !isNaN(swHi) && c.c < swHi;

    if(seqL || pbL || seqS || pbS) g.rawTrig++;
    const tL = (seqL || pbL) && alignedL, tS = (seqS || pbS) && alignedS;
    if(!tL && !tS) continue;
    g.afterAlign++;
    if(open){ g.rejOpen++; continue; }
    if(took >= maxPerDay){ g.rejDay++; continue; }
    if(et.hm < sessFrom || et.hm > sessTo){ g.rejSess++; continue; }

    const dir = tL ? 1 : -1, entry = c.c;
    const stop = tL ? (seqL ? Math.min(pullExt, zone) : swLo) - stopBuf
                    : (seqS ? Math.max(pullExt, zone) : swHi) + stopBuf;
    const risk = Math.abs(entry - stop);
    if(!(risk > 0)){ g.rejRisk++; continue; }

    // Target: the nearest opposing swing on the 4H or Daily. In open air, the
    // measured move of the leg that built the setup. Structure projects
    // structure — nothing is invented.
    const walls = tL ? [B4.pivHi[i4], BD.pivHi[id]].filter(v => v > entry)
                     : [B4.pivLo[i4], BD.pivLo[id]].filter(v => v < entry);
    let target = walls.length ? (tL ? Math.min(...walls) : Math.max(...walls)) : NaN;
    if(isNaN(target)){
      // For a pullback the leg is the swing that preceded it; for the retest
      // it is the leg tracked through the sequence.
      const span = (seqL || seqS) ? legHi - legLo : Math.abs(swHi - swLo);
      if(!(span > 0)){ g.rejRoom++; continue; }
      target = tL ? entry + span : entry - span;
    }
    const room = Math.abs(target - entry) / risk;
    if(room < minRoom){ g.rejRoom++; continue; }

    g.taken++; took++;
    open = {dir, entry, stop, risk, room, t1: false, R: 0,
            T1: tL ? entry + risk : entry - risk, T2: target, tIn: c.t};
  }

  return Object.assign(summarise(trades, riskPct, D.months), {gates: g});
}

const finish = (o, how) => ({R: o.R, how, t: o.tIn});

function summarise(trades, riskPct, months){
  const n = trades.length;
  if(!n) return {n: 0};
  let sum = 0, wins = 0, eq = 1, peak = 1, dd = 0, peakR = 0, ddR = 0, cum = 0, worst = 0, streak = 0, maxStreak = 0;
  for(const t of trades){
    sum += t.R; if(t.R > 0) wins++;
    if(t.R < 0){ streak++; maxStreak = Math.max(maxStreak, streak); } else streak = 0;
    cum += t.R; peakR = Math.max(peakR, cum); ddR = Math.max(ddR, peakR - cum);
    eq *= (1 + riskPct / 100 * t.R);
    peak = Math.max(peak, eq); dd = Math.max(dd, (peak - eq) / peak);
    worst = Math.min(worst, t.R);
  }
  return {n, win: wins / n * 100, exp: sum / n, totR: sum, ddR, eq, ddPct: dd * 100,
          perMonth: n / months, maxStreak};
}

/* ── Data prep ───────────────────────────────────────────────────────────── */
function prep(pvList, useAlign){
  const dir = path.join(__dirname, '..', 'data');
  const h1 = load(path.join(dir, 'MES-1h.csv'));
  const m15 = load(path.join(dir, 'MES-15m.csv'));

  // The 4H and Daily are resampled from the 1H rather than taken from the
  // vendor files, which only cover a few recent months.
  const b4 = resample(h1, 4 * HOUR);
  const bd = resampleDaily(h1);

  // A four-timeframe test can only run where the 15m exists.
  const from = useAlign ? m15[0].t : h1[0].t;
  const exec = h1.filter(c => c.t >= from);
  const execET = exec.map(c => etStamp(c.t));
  const execCloseT = exec.map(c => c.t + HOUR);
  const months = (exec[exec.length - 1].t - exec[0].t) / (30.44 * 24 * HOUR);

  const S = {exec: {}, b4: {}, bd: {}, a15: {}};
  for(const pv of pvList){
    S.exec[pv] = structure(exec, pv, pv);
    S.b4[pv]   = structure(b4, pv, pv);
    S.bd[pv]   = structure(bd, pv, pv);
    if(useAlign) S.a15[pv] = structure(m15, pv, pv);
  }
  const maps = {
    b4: alignIndex(execCloseT, b4, 4 * HOUR),
    bd: alignIndex(execCloseT, bd, 24 * HOUR),
    a15: useAlign ? alignIndex(execCloseT, m15, 15 * 60e3) : null
  };
  return {exec, execET, S, maps, months,
          span: `${new Date(exec[0].t).toISOString().slice(0,10)} → ${new Date(exec[exec.length-1].t).toISOString().slice(0,10)}`};
}

module.exports = {run, prep, structure};
