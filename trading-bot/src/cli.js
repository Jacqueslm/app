'use strict';

const path = require('path');
const { loadJson, fmtTime, fmtMoney, fmtPrice, round } = require('./util');
const { fetchSeries } = require('./data');
const { evalSignal, closedUpTo, MIN } = require('./engine');
const { recentSweeps } = require('./signal');
const { backtest } = require('./backtest');
const { loadAccount, saveAccount, openPosition, stepPosition } = require('./paper');

const ROOT = path.join(__dirname, '..');
const cfg = loadJson(path.join(ROOT, 'config.json'), {});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  const args = { command: 'help', symbols: null, source: 'yahoo', poll: cfg.pollSeconds || 60 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === 'scan' || a === 'backtest' || a === 'run' || a === 'test' || a === 'help') args.command = a;
    else if (a === '--symbols' || a === '-s') args.symbols = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--source') args.source = argv[++i] || 'yahoo';
    else if (a === '--poll') args.poll = parseInt(argv[++i] || '60', 10);
  }
  return args;
}

function allSymbols() {
  return Object.keys(cfg.symbols);
}

function resolveSymbols(args) {
  const list = args.symbols && args.symbols.length ? args.symbols : allSymbols();
  const bad = list.filter((s) => !cfg.symbols[s]);
  if (bad.length) {
    console.error(`Unknown symbol(s): ${bad.join(', ')} — options: ${allSymbols().join(', ')}`);
    process.exit(1);
  }
  return list;
}

const ARROW = { up: '↑', down: '↓', flat: '—' };
const arrow = (t) => ARROW[t] || ARROW.flat;

function lastEvent(events, type, dir) {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === type && (dir == null || e.dir === dir)) return e;
  }
  return null;
}

function describeSweeps(tf15, dir) {
  // dir: 'down' = sell-side sweep (bullish), 'up' = buy-side sweep (bearish)
  return recentSweeps(tf15.candles, tf15.levels, dir, cfg.sweepLookbackBars);
}

function renderScan(sym, ctx, signal, source) {
  const s = cfg.symbols[sym];
  const { tf15, tf5 } = ctx;
  const line = '─'.repeat(62);

  console.log('');
  console.log(line);
  console.log(` ${sym} — ${s.label}   (source: ${source})`);
  console.log(line);

  const biasTag = ctx.bias === 'bull' ? 'BULL' : ctx.bias === 'bear' ? 'BEAR' : 'NEUTRAL';
  console.log(` Bias: ${biasTag}    Daily ${arrow(ctx.trends.daily)} · 4H ${arrow(ctx.trends.h4)} · 1H ${arrow(ctx.trends.h1)}`);
  console.log('');

  const tfs = [
    ['1D', ctx.trends.daily, null],
    ['4H', ctx.trends.h4, null],
    ['1H', ctx.trends.h1, null],
    ['15m', tf15.structure.trend, tf15.structure],
    ['5m', tf5.structure.trend, tf5.structure],
  ];
  for (const [label, trend, structure] of tfs) {
    let extra = '';
    if (structure) {
      const bosUp = lastEvent(structure.events, 'bos', 'up');
      const bosDn = lastEvent(structure.events, 'bos', 'down');
      const chUp = lastEvent(structure.events, 'choch', 'up');
      const chDn = lastEvent(structure.events, 'choch', 'down');
      const recent = [bosUp, bosDn, chUp, chDn].filter(Boolean).sort((a, b) => b.index - a.index)[0];
      if (recent) {
        const kind = recent.type === 'bos' ? 'BOS' : 'CHoCH';
        extra = `   last ${kind} ${arrow(recent.dir)} ${fmtPrice(recent.price)} @ ${fmtTime(recent.time)}`;
      }
    }
    console.log(` ${label.padEnd(4)} ${arrow(trend).padEnd(2)} ${extra}`);
  }

  // 15m manipulation (both directions) — shown even without a full signal.
  const bullSweeps = describeSweeps(tf15, 'down');
  const bearSweeps = describeSweeps(tf15, 'up');
  const lastBull = bullSweeps.length ? bullSweeps[bullSweeps.length - 1] : null;
  const lastBear = bearSweeps.length ? bearSweeps[bearSweeps.length - 1] : null;
  if (lastBull) {
    console.log('');
    console.log(` 15m manipulation (bullish): sell-side sweep — wick low ${fmtPrice(lastBull.extreme)} @ ${fmtTime(lastBull.time)}`);
  }
  if (lastBear) {
    console.log('');
    console.log(` 15m manipulation (bearish): buy-side sweep — wick high ${fmtPrice(lastBear.extreme)} @ ${fmtTime(lastBear.time)}`);
  }

  console.log('');
  if (signal) {
    const dirTag = signal.dir === 'long' ? 'LONG' : 'SHORT';
    console.log(` ── SIGNAL: ${dirTag} ──`);
    console.log(`   Entry  ${fmtPrice(signal.entry)}   ·  Stop  ${fmtPrice(signal.stop)}   ·  Risk  ${fmtPrice(signal.risk)} pts`);
    console.log(`   T1  ${fmtPrice(signal.t1)}   ·  T2  ${fmtPrice(signal.t2)}`);
    const side = signal.dir === 'long' ? 'below' : 'above';
    console.log(`   Stop ${side} manipulation extreme ${fmtPrice(signal.sweep.extreme)} (${fmtTime(signal.sweep.time)})`);
    console.log(`   Triggered by 5m BOS ${arrow(signal.dir === 'long' ? 'up' : 'down')} @ ${fmtPrice(signal.entryBos.price)}`);
    console.log(`   Signal id  ${signal.id}`);
  } else {
    console.log(' ── No signal — waiting for HTF bias + manipulation + 15m/5m alignment ──');
  }
}

async function cmdScan(args) {
  const symbols = resolveSymbols(args);
  for (const sym of symbols) {
    try {
      const series = await fetchSeries(sym, cfg, args.source);
      if (!series.m15 || !series.m15.length) {
        console.error(` ${sym}: no 15m data returned`);
        continue;
      }
      const { ctx, signal } = evalSignal(series, series.m15.length - 1, sym, cfg);
      renderScan(sym, ctx, signal, series.meta ? series.meta.source : args.source);
    } catch (e) {
      console.error(` ${sym}: ${e.message}`);
    }
  }
  console.log('');
}

function renderTrade(t) {
  const dir = t.dir === 'long' ? 'LONG ' : 'SHORT';
  const r = (t.r >= 0 ? '+' : '') + t.r.toFixed(2);
  return `${t.symbol.padEnd(4)} ${dir}  entry ${fmtPrice(t.entry).padStart(9)}  exit ${fmtPrice(t.exit).padStart(9)}  ${t.reason.padEnd(9)}  ${r.padStart(6)}R  ${fmtMoney(t.pnl).padStart(10)}  ${fmtTime(t.exitTime)}`;
}

async function cmdBacktest(args) {
  const symbols = resolveSymbols(args);
  let grandTotal = 0;
  let grandPnl = 0;
  for (const sym of symbols) {
    try {
      const series = await fetchSeries(sym, cfg, args.source);
      const res = backtest(series, sym, cfg, cfg.backtest);
      grandTotal += res.total;
      grandPnl += res.sumPnl;

      console.log('');
      console.log(`${'─'.repeat(74)}`);
      console.log(` ${sym} — ${cfg.symbols[sym].label}  (${series.meta ? series.meta.source : args.source}, ${series.m5.length} 5m bars)`);
      console.log(`${'─'.repeat(74)}`);
      console.log(` Trades ${res.total}   Wins ${res.wins}   Losses ${res.losses}   BE ${res.breakeven}   Win rate ${res.winRate}%`);
      console.log(` Sum ${res.sumR}R   Avg ${res.avgR}R   P&L ${fmtMoney(res.sumPnl)}   Profit factor ${res.profitFactor === Infinity ? '∞' : res.profitFactor}   Max DD ${res.maxDrawdownR}R`);
      if (res.trades.length) {
        console.log('');
        for (const t of res.trades.slice(-30)) console.log(' ' + renderTrade(t));
        if (res.trades.length > 30) console.log(` … ${res.trades.length - 30} earlier trades omitted`);
      }
    } catch (e) {
      console.error(` ${sym}: ${e.message}`);
    }
  }
  if (symbols.length > 1) {
    console.log('');
    console.log(` Total across ${symbols.join(', ')}: ${grandTotal} trades · ${fmtMoney(grandPnl)} P&L`);
  }
  console.log('');
}

async function cmdRun(args) {
  const symbols = resolveSymbols(args);
  const acc = loadAccount(cfg.startCash);
  const opened = new Set(acc.closed.map((t) => t.id));
  let stop = false;
  const onSig = () => { stop = true; };
  process.on('SIGINT', onSig);

  console.log(`Paper mode · ${symbols.join(', ')} · ${args.source} · poll ${args.poll}s · Ctrl-C to stop`);
  console.log('');

  while (!stop) {
    for (const sym of symbols) {
      try {
        const series = await fetchSeries(sym, cfg, args.source);
        const now = Date.now();
        const m5 = closedUpTo(series.m5, 5 * MIN, now);
        const m15 = closedUpTo(series.m15, 15 * MIN, now);
        if (!m5.length || !m15.length) continue;
        const filtered = { ...series, m5, m15 };

        // Manage the open position with the newest closed 5m candle.
        let pos = acc.positions.find((p) => p.symbol === sym);
        if (pos) {
          const bar = m5[m5.length - 1];
          if (bar.t + 5 * MIN > pos.entryTime) {
            const closed = stepPosition(pos, bar);
            if (closed) {
              acc.positions = acc.positions.filter((p) => p !== pos);
              acc.closed.push(closed);
              acc.pnl = round(acc.pnl + closed.pnl, 2);
              console.log(` ${fmtTime(Date.now()).slice(0, 16)}  CLOSE ${renderTrade(closed)}`);
            }
          }
        }

        // New signal when flat on this symbol.
        if (!acc.positions.find((p) => p.symbol === sym)) {
          const { signal } = evalSignal(filtered, m15.length - 1, sym, cfg);
          if (signal && !opened.has(signal.id)) {
            opened.add(signal.id);
            const p = openPosition(signal, cfg, sym, signal.at);
            acc.positions.push(p);
            const dir = p.dir === 'long' ? 'LONG ' : 'SHORT';
            console.log(` ${fmtTime(Date.now()).slice(0, 16)}  OPEN  ${sym.padEnd(4)} ${dir}  entry ${fmtPrice(p.entry).padStart(9)}  stop ${fmtPrice(p.stop).padStart(9)}  t1 ${fmtPrice(p.t1).padStart(9)}  t2 ${fmtPrice(p.t2).padStart(9)}`);
          }
        }
      } catch (e) {
        console.error(` ${sym}: ${e.message}`);
      }
    }
    saveAccount(acc);
    if (stop) break;
    await sleep(args.poll * 1000);
  }

  const open = acc.positions.length;
  console.log('');
  console.log(` Stopped. Account P&L ${fmtMoney(acc.pnl)} · ${acc.closed.length} closed trades · ${open} open position(s)`);
  console.log(` Account file: paper/account.json`);
}

function printHelp() {
  console.log(`
Market Structure Bot — HTF bias + manipulation + 15m scalp + 5m break of structure
Symbols: ${allSymbols().join(', ')} (CME micro futures)

Usage:
  node src/cli.js scan      [--symbols MNQ,MES] [--source yahoo|synthetic]
  node src/cli.js backtest  [--symbols MNQ,MES] [--source yahoo|synthetic]
  node src/cli.js run       [--symbols MNQ,MES] [--source yahoo] [--poll 60]
  node src/cli.js test

  scan      Show current HTF bias, manipulation, structure and any active signal.
  backtest  Replay history with the paper engine and print trade stats.
  run       Live paper trading loop (persists to paper/account.json).
  test      Run the offline unit tests.

  --source synthetic  Use deterministic generated data (no network, for demos/tests).
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'scan') await cmdScan(args);
  else if (args.command === 'backtest') await cmdBacktest(args);
  else if (args.command === 'run') await cmdRun(args);
  else if (args.command === 'test') require(path.join(__dirname, '..', 'test', 'engine.test.js'));
  else printHelp();
}

main().catch((e) => {
  console.error('Fatal:', e && e.message ? e.message : e);
  process.exit(1);
});
