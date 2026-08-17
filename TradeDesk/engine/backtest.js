'use strict';
/* ---------------------------------------------------------------------------
   A full backtest, run through the loop rather than the batch pass.

   The loop is the honest engine: it holds one position at a time, cannot see a
   bar that has not closed, and produces the same trades a person following the
   rules would have taken. The batch pass can hold overlapping positions, which
   no account can.

   Everything below is derived from those trades. Nothing is annualised,
   smoothed, or compounded — compounding a 3.6-year sample of 214 trades makes
   a small edge look like a fortune and is the commonest way a backtest lies.
   Position size is fixed-fractional on a constant account, so every trade
   carries the same weight and the equity curve shows the strategy rather than
   the sizing.
   --------------------------------------------------------------------------- */

const L = require('./loop');

const CONTRACTS = {
  MES: {pointValue: 5,  roundTurn: 4.00},
  ES : {pointValue: 50, roundTurn: 4.50},
  MNQ: {pointValue: 2,  roundTurn: 4.00},
  NQ : {pointValue: 20, roundTurn: 4.50}
};

function run(candles, opts){
  const o = Object.assign({
    contract: 'MES', account: 50000, riskPct: 0.5, loop: {}
  }, opts || {});
  const spec = CONTRACTS[o.contract];
  if(!spec) throw new Error(`unknown contract "${o.contract}"`);

  const st = L.create(o.loop);
  for(const c of candles) L.tick(st, c);

  const budget = o.account * o.riskPct/100;
  const trades = [];
  let equityR = 0, equityUsd = 0, peakR = 0, peakUsd = 0, ddR = 0, ddUsd = 0;
  let skipped = 0;

  for(const t of st.trades){
    const perContract = t.risk * spec.pointValue;
    const size = Math.floor(budget / perContract);
    if(size < 1){ skipped++; continue; }          // stop too wide to size — not taken

    const fees  = size * spec.roundTurn;
    const gross = t.r * t.risk * spec.pointValue * size;
    const net   = gross - fees;
    const rNet  = net / (size * perContract);

    equityR   += rNet;
    equityUsd += net;
    peakR   = Math.max(peakR, equityR);   ddR   = Math.min(ddR,   equityR - peakR);
    peakUsd = Math.max(peakUsd, equityUsd); ddUsd = Math.min(ddUsd, equityUsd - peakUsd);

    trades.push({
      t: candles[t.entryAt].t, dir: t.dir,
      entry: t.entry, stop: t.stop, target: t.target,
      riskPts: t.risk, size, fees, gross, net, rGross: t.r, r: rNet,
      barsHeld: t.exitAt - t.entryAt,
      equityR, equityUsd
    });
  }

  return {trades, skipped, spec, opt: o,
          stats: summarise(trades, candles, ddR, ddUsd, o)};
}

function summarise(trades, candles, ddR, ddUsd, o){
  if(!trades.length) return null;
  const wins   = trades.filter(t => t.r > 0);
  const losses = trades.filter(t => t.r <= 0);
  const sum = (a, f) => a.reduce((s,x) => s + f(x), 0);

  const grossWin  = sum(wins,   t => t.net);
  const grossLoss = Math.abs(sum(losses, t => t.net));
  const days = (candles[candles.length-1].t - candles[0].t)/86400000;

  /* longest run of each, which is what actually gets people to stop trading */
  let curW = 0, curL = 0, maxW = 0, maxL = 0;
  for(const t of trades){
    if(t.r > 0){ curW++; curL = 0; maxW = Math.max(maxW, curW); }
    else       { curL++; curW = 0; maxL = Math.max(maxL, curL); }
  }

  const rs = trades.map(t => t.r);
  const mean = sum(rs, x => x)/rs.length;
  const sd = Math.sqrt(sum(rs, x => (x-mean)*(x-mean))/rs.length);

  const byKey = (fn) => {
    const g = {};
    trades.forEach(t => { const k = fn(t); (g[k] = g[k] || []).push(t); });
    return Object.entries(g).sort().map(([k,v]) => ({
      key: k, n: v.length,
      win: v.filter(x => x.r > 0).length / v.length * 100,
      r: sum(v, x => x.r), usd: sum(v, x => x.net)
    }));
  };

  return {
    n: trades.length, days, perWeek: trades.length/(days/7),
    winRate: wins.length/trades.length*100,
    expectancyR: mean, sdR: sd,
    /* mean divided by standard deviation of per-trade R — not annualised,
       because annualising 214 trades invents precision that is not there */
    perTradeSharpe: sd > 0 ? mean/sd : 0,
    totalR: sum(trades, t => t.r), totalUsd: sum(trades, t => t.net),
    fees: sum(trades, t => t.fees),
    grossWin, grossLoss,
    profitFactor: grossLoss > 0 ? grossWin/grossLoss : Infinity,
    avgWin: wins.length ? sum(wins, t => t.net)/wins.length : 0,
    avgLoss: losses.length ? grossLoss/losses.length : 0,
    maxDrawdownR: ddR, maxDrawdownUsd: ddUsd,
    maxWinStreak: maxW, maxLossStreak: maxL,
    avgBarsHeld: sum(trades, t => t.barsHeld)/trades.length,
    returnOnAccount: sum(trades, t => t.net)/o.account*100,
    byYear:  byKey(t => new Date(t.t).getUTCFullYear()),
    byMonth: byKey(t => new Date(t.t).toISOString().slice(0,7)),
    byDir:   byKey(t => t.dir === 'bull' ? 'long' : 'short')
  };
}

module.exports = {run, CONTRACTS};
