'use strict';

const { sweepAt } = require('./structure');
const { round } = require('./util');

const MIN = 60 * 1000;

// All liquidity sweeps on the given candles. A level is only usable once it
// exists (`lv.index < i`), so a precomputed sweep list stays lookahead-free.
function sweeps(candles, levels, dir, fromIndex = 0) {
  const list = dir === 'up' ? levels.bsl : levels.ssl;
  const out = [];
  for (let i = Math.max(0, fromIndex); i < candles.length; i++) {
    const c = candles[i];
    for (const lv of list) {
      if (lv.index >= i) continue;
      if (sweepAt(c, lv, dir)) {
        out.push({ index: i, time: c.t, level: lv, dir, extreme: dir === 'up' ? c.h : c.l });
        break;
      }
    }
  }
  return out;
}

function recentSweeps(candles, levels, dir, lookbackBars) {
  return sweeps(candles, levels, dir, Math.max(0, candles.length - lookbackBars));
}

// Turn a confirmed setup into a concrete trade plan (entry/stop/targets).
function buildPlan(sym, dir, bias, sweep, scalpBos, entryBos, cfg) {
  const tick = cfg.symbols[sym] ? cfg.symbols[sym].tickSize : 0.25;
  const buf = cfg.risk.stopBufferTicks * tick;
  const entry = entryBos.price;
  const stop = dir === 'long' ? sweep.extreme - buf : sweep.extreme + buf;
  const risk = Math.abs(entry - stop);
  if (risk <= 0) return null;

  const t1 = dir === 'long' ? entry + risk * cfg.risk.reward1 : entry - risk * cfg.risk.reward1;
  const t2 = dir === 'long' ? entry + risk * cfg.risk.reward2 : entry - risk * cfg.risk.reward2;

  return {
    id: `${sym}:${dir}:${sweep.time}`,
    symbol: sym,
    dir,
    bias,
    entry: round(entry, 4),
    stop: round(stop, 4),
    t1: round(t1, 4),
    t2: round(t2, 4),
    risk: round(risk, 4),
    sweep: { time: sweep.time, level: sweep.level, extreme: sweep.extreme },
    scalpBos: { time: scalpBos.time, price: scalpBos.price },
    entryBos: { time: entryBos.time, price: entryBos.price },
    at: entryBos.time,
  };
}

// Fresh-context path (used by `scan` and live `run` — computed once per poll).
//   LONG : bias bull → 15m sell-side sweep → 15m BOS up → 5m BOS up
//   SHORT: mirror.
function scanSignal(ctx, cfg) {
  const dir = ctx.bias === 'bull' ? 'long' : ctx.bias === 'bear' ? 'short' : null;
  if (!dir) return null;

  const sweepDir = dir === 'long' ? 'down' : 'up';
  const bosDir = dir === 'long' ? 'up' : 'down';

  const list = recentSweeps(ctx.tf15.candles, ctx.tf15.levels, sweepDir, cfg.sweepLookbackBars);
  if (!list.length) return null;
  const sweep = list[list.length - 1];

  const scalpBos = ctx.tf15.structure.events.find(
    (e) => e.type === 'bos' && e.dir === bosDir && e.index > sweep.index
  );
  if (!scalpBos) return null;

  const entryBoses = ctx.tf5.structure.events.filter(
    (e) => e.type === 'bos' && e.dir === bosDir && e.time >= sweep.time
  );
  if (!entryBoses.length) return null;
  const entryBos = entryBoses[entryBoses.length - 1];

  const invalid = ctx.tf5.structure.events.some(
    (e) => e.type === 'choch' && e.dir !== bosDir && e.index > entryBos.index
  );
  if (invalid) return null;

  return buildPlan(ctx.symbol, dir, ctx.bias, sweep, scalpBos, entryBos, cfg);
}

module.exports = { sweeps, recentSweeps, buildPlan, scanSignal };
