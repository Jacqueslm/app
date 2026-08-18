'use strict';

const path = require('path');
const { round, loadJson, saveJson } = require('./util');

const ROOT = path.join(__dirname, '..');
const ACCOUNT_FILE = path.join(ROOT, 'paper', 'account.json');

function newAccount(startCash) {
  return { startCash, pnl: 0, positions: [], closed: [], updated: null };
}

function loadAccount(startCash) {
  const acc = loadJson(ACCOUNT_FILE, null);
  if (acc && typeof acc.startCash === 'number') return acc;
  const a = newAccount(startCash);
  saveJson(ACCOUNT_FILE, a);
  return a;
}

function saveAccount(acc) {
  acc.updated = Date.now();
  saveJson(ACCOUNT_FILE, acc);
}

function openPosition(signal, cfg, sym, time) {
  const s = cfg.symbols[sym] || { pointValue: 1, tickSize: 0.25 };
  return {
    id: signal.id,
    symbol: sym,
    dir: signal.dir,
    entry: signal.entry,
    stop: signal.stop,
    t1: signal.t1,
    t2: signal.t2,
    risk: signal.risk,
    pointValue: s.pointValue,
    contracts: cfg.contracts || 1,
    entryTime: time,
    beMoved: false,
  };
}

// Close a position at `price` and compute points, $ P&L and R multiple.
function closePosition(pos, price, reason, time) {
  const points = pos.dir === 'long' ? price - pos.entry : pos.entry - price;
  const pnl = round(points * pos.pointValue * pos.contracts, 2);
  const r = pos.risk ? round(points / pos.risk, 2) : 0;
  return {
    ...pos,
    exit: round(price, 4),
    exitTime: time,
    reason,
    points: round(points, 4),
    pnl,
    r,
  };
}

// Advance an open position by one closed candle. Returns a closed trade object
// if the position exits on this bar, otherwise null. Stop is checked first
// (conservative on a bar that spans both stop and target).
//   1R hit  → move stop to entry (breakeven)
//   2R hit  → take profit
//   BE hit  → close flat
function stepPosition(pos, candle) {
  if (pos.dir === 'long') {
    if (candle.l <= pos.stop) {
      return closePosition(pos, pos.stop, pos.beMoved ? 'breakeven' : 'stop', candle.t);
    }
    if (candle.h >= pos.t2) return closePosition(pos, pos.t2, 'target', candle.t);
    if (!pos.beMoved && candle.h >= pos.t1) {
      pos.beMoved = true;
      pos.stop = pos.entry;
    }
  } else {
    if (candle.h >= pos.stop) {
      return closePosition(pos, pos.stop, pos.beMoved ? 'breakeven' : 'stop', candle.t);
    }
    if (candle.l <= pos.t2) return closePosition(pos, pos.t2, 'target', candle.t);
    if (!pos.beMoved && candle.l <= pos.t1) {
      pos.beMoved = true;
      pos.stop = pos.entry;
    }
  }
  return null;
}

module.exports = {
  ACCOUNT_FILE,
  newAccount,
  loadAccount,
  saveAccount,
  openPosition,
  closePosition,
  stepPosition,
};
