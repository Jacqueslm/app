#!/usr/bin/env node
'use strict';
/*
 * Pull real bars for MGC, MNQ and MES from the free delayed feed.
 *
 *   node fetch-bars.js --symbols MES,MNQ,MGC
 *   node fetch-bars.js --symbols MES --interval 15m --range 60d
 *   node fetch-bars.js --from-json saved-chart.json --symbol MES   # no network
 *
 * No key, no account. The cost is the lag: futures quotes from this source run
 * about ten minutes behind, which is why the last bar is dropped — it is still
 * being built and a half-built bar that closes above a level would fire a trade
 * that never happened. lib/yahoo.js does that part; this file only fetches and
 * writes.
 *
 * The feed is rate-limited per IP and answers 429 to busy ones, so this says that
 * plainly when it happens rather than reporting a strategy that ran on no data.
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { barsFromChart, toCsv, intervalMs, tickerFor } = require('./lib/yahoo');
const { loadCandles } = require('./lib/candles');
const { clock } = require('./lib/session');

const HELP = `node fetch-bars.js --symbols MES,MNQ,MGC [options]

  --symbols <list>        comma-separated: ${['MGC', 'MNQ', 'MES'].join(', ')} (default MES)
  --interval <tf>         15m (default), 5m, 30m, 60m
  --range <span>          how far back to ask: 60d is the most this interval allows
  --out-dir <dir>         where the files go (default data/real)
  --delay-minutes <n>     how far the feed lags, in minutes (default 10)
  --from-json <file>      read a saved chart response instead of the network
  --symbol <name>         the instrument for --from-json
  --json                  the summary, for a script
  --help                  this list
`;

function parseArgs(argv) {
  const opts = { symbols: 'MES', interval: '15m', range: '60d', 'out-dir': path.join(__dirname, 'data', 'real'), 'delay-minutes': 10 };
  const bools = new Set(['help', 'json']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument ${arg}`);
    const key = arg.slice(2);
    if (bools.has(key)) { opts[key] = true; continue; }
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${key} needs a value`);
    opts[key] = value;
  }
  return opts;
}

/* One request, with the status kept so a refusal can be reported as it was given. */
function get(url, { tries = 3, waitMs = 5000 } = {}) {
  const attempt = (remaining) => new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'application/json',
      },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const status = res.statusCode || 0;
        if (status === 200) {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error(`the feed answered 200 with something that is not JSON: ${body.slice(0, 120)}`));
          }
          return;
        }
        /* 429 is the IP being rate-limited, and waiting a few seconds rarely helps.
           5xx is worth one more try. Everything else is answered to stay answered. */
        if ((status === 429 || status >= 500) && remaining > 1) {
          setTimeout(() => attempt(remaining - 1).then(resolve, reject), waitMs);
          return;
        }
        if (status === 429) {
          reject(new Error(
            'the free feed is rate-limiting this connection (HTTP 429). It limits by IP, and a shared\n'
            + 'or cloud address is refused almost at once. Run this same command on your own connection —\n'
            + 'the file it writes is the same one, and strategy-one.js does not care where it came from.',
          ));
          return;
        }
        reject(new Error(`the feed answered HTTP ${status}: ${body.slice(0, 200).replace(/\s+/g, ' ')}`));
      });
    });
    req.setTimeout(20000, () => req.destroy(new Error('the feed did not answer within 20 seconds')));
    req.on('error', (err) => reject(new Error(`could not reach the feed: ${err.message}`)));
  });
  return attempt(tries);
}

const central = (ms) => {
  const c = clock(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${c.year}-${pad(c.month)}-${pad(c.day)} ${pad(c.hour)}:${pad(c.minute)}`;
};

async function main() {
  const argv = process.argv.slice(2);
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    console.error(`\n${HELP}`);
    process.exitCode = 2;
    return;
  }
  if (opts.help) { console.log(HELP); return; }

  intervalMs(opts.interval);          // refused here, before any request, if it is not a bar size
  const delayMs = Number(opts['delay-minutes']) * 60e3;
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('--delay-minutes has to be zero or more');

  const jobs = opts['from-json']
    ? [{ symbol: String(opts.symbol || 'MES').toUpperCase(), file: opts['from-json'], from: 'a saved response' }]
    : String(opts.symbols).split(',').map((s) => s.trim()).filter(Boolean).map((symbol) => ({
      symbol: symbol.toUpperCase(),
      ticker: tickerFor(symbol),
      from: 'yahoo delayed',
    }));
  if (!jobs.length) throw new Error('--symbols named nothing');

  fs.mkdirSync(opts['out-dir'], { recursive: true });
  const summary = [];

  for (const job of jobs) {
    const now = Date.now();
    let json;
    if (job.file) {
      json = JSON.parse(fs.readFileSync(job.file, 'utf8'));
    } else {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(job.ticker)}`
        + `?interval=${encodeURIComponent(opts.interval)}&range=${encodeURIComponent(opts.range)}&includePrePost=true`;
      json = await get(url);
    }
    const { bars, droppedNull, droppedIncomplete } = barsFromChart(json, { intervalMs: opts.interval, now, delayMs });
    const file = path.join(opts['out-dir'], `${job.symbol}-${opts.interval}.csv`);
    fs.writeFileSync(file, toCsv(bars, {
      instrument: job.symbol, source: job.from, interval: opts.interval, fetchedAt: now,
    }));

    /* Read back through the same loader the strategy uses, so a file that was
       written wrong fails here instead of inside a report. */
    const read = loadCandles(file);
    summary.push({
      symbol: job.symbol, file, bars: read.length,
      firstCentral: central(read[0].time), lastCentral: central(read[read.length - 1].time),
      droppedIncomplete, droppedNull,
    });
  }

  if (opts.json) { console.log(JSON.stringify(summary, null, 2)); return; }
  for (const s of summary) {
    console.log(`${s.symbol}  ${String(s.bars).padStart(5)} bars  ${s.firstCentral} → ${s.lastCentral} Central`);
    console.log(`       ${s.file}`);
    if (s.droppedIncomplete) console.log(`       dropped ${s.droppedIncomplete} bar(s) that had not finished — a delayed feed is always inside one`);
    if (s.droppedNull) console.log(`       dropped ${s.droppedNull} empty row(s) rather than filling them in`);
  }
  console.log('');
  console.log(`delayed about ${Number(opts['delay-minutes'])} minutes. That is fine for a rule that decides on a`);
  console.log('closed bar; it is not fine for anything that needs the current price.');
  console.log('');
  console.log(`next: node strategy-one.js --data ${summary[0].file} --instrument ${summary[0].symbol} --contracts 4`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
