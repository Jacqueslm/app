#!/usr/bin/env node
'use strict';
/*
 * The paper trading receiver.
 *
 *   PAPER_TOKEN=some-long-word node paper/server.js
 *
 * Three jobs, in the order they matter:
 *
 *   1. Take the alert TradingView posts and put it in the paper account. The alert
 *      is the same JSON the Pine script builds: type, symbol, side, order, entry,
 *      stop, target, qty, id.
 *   2. Ask a price feed for the instrument while something is resting or open, and
 *      hand that price to the account. Nothing fills without a price.
 *   3. Draw it — / is the account page, /state.json is the same thing as JSON.
 *
 * The feed is Yahoo's free chart endpoint, the same one fetch-bars.js uses: no key,
 * and about ten minutes behind for futures. That delay is the honest limit of this
 * whole thing. A fill here is what the rule would have got ten minutes ago, not
 * what it would get on a live tick, so treat it as a rehearsal and not a quote.
 *
 * Nothing in this file can reach a broker. There is no broker to reach.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { createAccount, applyAlert, applyPrice, snapshot } = require('./lib/engine');
const { tickerFor } = require('../lib/yahoo');

const STATE_FILE = path.join(__dirname, 'state.json');
const PAGE_FILE = path.join(__dirname, 'page.html');

const PORT = Number(process.env.PAPER_PORT || 8787);
const TOKEN = (process.env.PAPER_TOKEN || '').trim();
const CAPITAL = process.env.PAPER_CAPITAL === undefined ? undefined : Number(process.env.PAPER_CAPITAL);
const COMMISSION = process.env.PAPER_COMMISSION === undefined ? undefined : Number(process.env.PAPER_COMMISSION);
const POLL_MS = Number(process.env.PAPER_POLL_MS || 15000);
const FEED_OFF = String(process.env.PAPER_FEED || '').toLowerCase() === 'off';
const MAX_BODY = 64 * 1024;

/* ---------------------------------------------------------------- the state */

function load() {
  if (!fs.existsSync(STATE_FILE)) {
    console.log(`paper: new account, ${CAPITAL === undefined ? 10000 : CAPITAL} to start`);
    return createAccount({ capital: CAPITAL, commission: COMMISSION });
  }
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const account = { ...createAccount({ capital: CAPITAL, commission: COMMISSION }), ...raw };
    console.log(`paper: picked up the ledger — ${account.trades.length} closed trade(s), equity ${snapshot(account).equity}`);
    return account;
  } catch (err) {
    console.error(`paper: the ledger at ${STATE_FILE} could not be read (${err.message}); starting a fresh one`);
    return createAccount({ capital: CAPITAL, commission: COMMISSION });
  }
}

let account = load();

function save() {
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(account, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

/* ----------------------------------------------------------------- the feed */

async function quote(instrument) {
  const ticker = tickerFor(instrument);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (paper account; one poll a few seconds)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`the feed answered ${res.status}`);
  const json = await res.json();
  const meta = json && json.chart && json.chart.result && json.chart.result[0] && json.chart.result[0].meta;
  const price = Number(meta && meta.regularMarketPrice);
  if (Number.isFinite(price) && price > 0) return price;

  const closes = (json && json.chart && json.chart.result && json.chart.result[0]
    && json.chart.result[0].indicators && json.chart.result[0].indicators.quote
    && json.chart.result[0].indicators.quote[0]
    && json.chart.result[0].indicators.quote[0].close) || [];
  for (let i = closes.length - 1; i >= 0; i--) {
    if (Number.isFinite(closes[i]) && closes[i] > 0) return closes[i];
  }
  throw new Error('the feed had no price in it');
}

let polling = false;

async function poll() {
  if (FEED_OFF || polling) return;
  const wanted = new Set();
  if (account.position) wanted.add(account.position.symbol);
  for (const order of account.orders) wanted.add(order.symbol);
  if (!wanted.size) return;

  polling = true;
  try {
    for (const instrument of wanted) {
      try {
        const price = await quote(instrument);
        const result = applyPrice(account, { symbol: instrument, price });
        account.feed = { at: Date.now(), error: null };
        if (result.actions.length) {
          save();
          for (const action of result.actions) {
            console.log(`paper: ${action.action} ${action.symbol || ''} ${action.side || ''} `
              + `${action.price !== undefined ? `@ ${action.price} ` : ''}${action.dollars !== undefined ? `(${action.dollars})` : ''}`.trim());
          }
        }
      } catch (err) {
        account.feed = { at: Date.now(), error: err.message };
        console.error(`paper: no price for ${instrument}: ${err.message}`);
      }
    }
  } finally {
    polling = false;
  }
}

/* ------------------------------------------------------------------- routes */

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('the alert is bigger than this receiver takes'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function allowed(url, req) {
  if (!TOKEN) return true;
  return url.searchParams.get('token') === TOKEN || req.headers['x-paper-token'] === TOKEN;
}

const json = (res, status, body) => {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(text);
};

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, feed: account.feed, open: !!account.position, resting: account.orders.length });
  }

  if (req.method === 'GET' && url.pathname === '/state.json') {
    if (!allowed(url, req)) return json(res, 401, { ok: false, reason: 'a token is required' });
    return json(res, 200, { ok: true, ...snapshot(account) });
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const page = fs.readFileSync(PAGE_FILE);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(page);
  }

  if (req.method === 'POST' && url.pathname === '/alert') {
    if (!allowed(url, req)) {
      console.error('paper: an alert arrived without the token');
      return json(res, 401, { ok: false, reason: 'a token is required' });
    }
    let alert;
    try {
      const raw = await readBody(req);
      alert = JSON.parse(raw);
    } catch (err) {
      console.error(`paper: unreadable alert: ${err.message}`);
      return json(res, 400, { ok: false, reason: `the body is not JSON: ${err.message}` });
    }
    try {
      const result = applyAlert(account, alert, { at: Date.now() });
      if (result.actions.some((a) => a.action !== 'ignored')) save();
      for (const action of result.actions) console.log(`paper: alert ${alert.type} → ${action.action}${action.reason ? `: ${action.reason}` : ''}`);
      /* TradingView only wants a 2xx; the body is for whoever is watching the log. */
      return json(res, 200, { ok: true, ...result });
    } catch (err) {
      console.error(`paper: refused the alert: ${err.message}`);
      return json(res, 200, { ok: false, reason: err.message });
    }
  }

  /* Manual price, for testing the account without the feed. */
  if (req.method === 'POST' && url.pathname === '/price') {
    if (!allowed(url, req)) return json(res, 401, { ok: false, reason: 'a token is required' });
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (err) {
      return json(res, 400, { ok: false, reason: `the body is not JSON: ${err.message}` });
    }
    try {
      const result = applyPrice(account, body, { at: Date.now() });
      if (result.actions.length) save();
      return json(res, 200, { ok: true, ...result });
    } catch (err) {
      return json(res, 200, { ok: false, reason: err.message });
    }
  }

  return json(res, 404, { ok: false, reason: `${req.method} ${url.pathname} is not a route` });
}

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    console.error(`paper: ${err.stack || err.message}`);
    if (!res.headersSent) json(res, 500, { ok: false, reason: 'the receiver failed; read its log' });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`paper: listening on http://0.0.0.0:${PORT}`);
  console.log(`paper: the page is /, the state is /state.json, alerts go to POST /alert${TOKEN ? '?token=…' : ''}`);
  console.log(`paper: price feed ${FEED_OFF ? 'off — POST /price by hand' : `on, one poll every ${POLL_MS}ms, about ten minutes behind`}`);
  if (!TOKEN) console.log('paper: no PAPER_TOKEN set — anyone who finds this URL can post an alert');
});

setInterval(poll, POLL_MS);
poll();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`paper: ${signal}, closing`);
    server.close(() => process.exit(0));
  });
}
