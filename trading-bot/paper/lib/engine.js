'use strict';
/*
 * The paper account — a broker that fills orders out of a price, not out of a
 * promise.
 *
 * TradingView can send this file an alert; it cannot send it a fill. So the
 * account is deliberately dumb and honest about its inputs: a resting limit fills
 * only when a price is handed in at or through the level, the stop and the target
 * are the ones the alert carried, and nothing is ever filled at a price nobody
 * saw.
 *
 * The bracket lives here rather than at TradingView because Pine's alert() fires
 * on the entry, the cancel and the flatten — not on the exit. So the account keeps
 * the stop and the target from the entry alert and closes the trade itself.
 *
 * The dollars come from lib/contracts.js, the one place that knows what a point of
 * MGC, MNQ or MES is worth. Four contracts and $0.35 a side are the defaults the
 * Pine script ships with.
 *
 * What this is not: a broker. No account number, no margin, no routing, and no way
 * for a fill in here to reach an exchange. The only thing it shares with a real one
 * is the arithmetic.
 */

const { spec, pnl } = require('../../lib/contracts');

const DEFAULTS = Object.freeze({ capital: 10000, commission: 0.35 });

const round = (n, places = 2) => {
  const f = 10 ** places;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/*
 * What the alert calls the market, and what this folder calls it. TradingView
 * sends `syminfo.ticker` — MES1!, MNQ1!, MGC1! on a continuous contract — and a
 * hand-written test may send `MES` or `MES=F`. All three mean the same instrument;
 * anything else is refused rather than guessed at.
 */
function instrumentOf(symbol) {
  const raw = String(symbol == null ? '' : symbol).trim().toUpperCase();
  if (!raw) throw new Error('the alert has no symbol');
  const key = raw.replace(/=F$/, '').replace(/[^A-Z]/g, '');
  try {
    return spec(key).symbol;
  } catch {
    throw new Error(`${JSON.stringify(symbol)} is not an instrument this paper account can price — it knows MGC, MNQ, MES`);
  }
}

function note(account, text, at, kind = 'note') {
  account.events.push({ at, kind, text });
  if (account.events.length > 200) account.events.splice(0, account.events.length - 200);
}

function createAccount({ capital = DEFAULTS.capital, commission = DEFAULTS.commission } = {}) {
  const c = Number(capital);
  const f = Number(commission);
  if (!Number.isFinite(c) || c <= 0) throw new Error(`the starting capital has to be above zero; got ${JSON.stringify(capital)}`);
  if (!Number.isFinite(f) || f < 0) throw new Error(`the commission cannot be negative; got ${JSON.stringify(commission)}`);
  return {
    capital: round(c, 2),
    commission: round(f, 4),
    realized: 0,
    fees: 0,
    position: null,
    orders: [],
    trades: [],
    prices: {},
    events: [],
    seen: [],
    feed: null,
  };
}

/* --------------------------------------------------------------- the fills */

function fill(account, order, price, at) {
  const contract = spec(order.symbol);
  const entryFee = round(account.commission * order.qty, 2);
  account.fees = round(account.fees + entryFee, 2);
  account.position = {
    id: order.id,
    symbol: order.symbol,
    side: order.side,
    qty: order.qty,
    entry: round(price, contract.decimals + 2),
    stop: order.stop,
    target: order.target,
    order: order.order,
    openedAt: at,
    entryFee,
    closeRequested: false,
  };
  note(account, `filled ${order.side} ${order.qty} ${order.symbol} at ${account.position.entry}`, at, 'fill');
  return {
    action: 'filled',
    id: order.id,
    symbol: order.symbol,
    side: order.side,
    qty: order.qty,
    price: account.position.entry,
  };
}

function closePosition(account, price, reason, at) {
  const pos = account.position;
  const contract = spec(pos.symbol);
  const exit = round(price, contract.decimals + 2);
  const gross = pnl(contract, pos.entry, exit, pos.qty, pos.side);
  const exitFee = round(account.commission * pos.qty, 2);
  const fees = round(pos.entryFee + exitFee, 2);

  account.fees = round(account.fees + exitFee, 2);
  account.realized = round(account.realized + gross, 2);
  const trade = {
    id: pos.id,
    symbol: pos.symbol,
    side: pos.side,
    qty: pos.qty,
    entry: pos.entry,
    exit,
    reason,
    points: round(pos.side === 'long' ? exit - pos.entry : pos.entry - exit, 4),
    gross,
    fees,
    dollars: round(gross - fees, 2),
    openedAt: pos.openedAt,
    closedAt: at,
  };
  account.trades.push(trade);
  account.position = null;
  note(account, `${reason} ${trade.side} ${trade.qty} ${trade.symbol} at ${exit} for ${trade.dollars}`, at, 'close');
  return { action: 'closed', ...trade };
}

/* ------------------------------------------------------------------ alerts */

function readEntry(alert) {
  const symbol = instrumentOf(alert.symbol);
  const side = String(alert.side == null ? '' : alert.side).toLowerCase();
  if (side !== 'buy' && side !== 'sell') {
    throw new Error(`the side is buy or sell; got ${JSON.stringify(alert.side)}`);
  }
  const qty = Number(alert.qty);
  if (!Number.isInteger(qty) || qty < 1) {
    throw new Error(`qty has to be a whole number of contracts; got ${JSON.stringify(alert.qty)}`);
  }
  const stop = Number(alert.stop);
  const target = Number(alert.target);
  if (!Number.isFinite(stop) || stop <= 0) throw new Error(`the stop has to be a price above zero; got ${JSON.stringify(alert.stop)}`);
  if (!Number.isFinite(target) || target <= 0) throw new Error(`the target has to be a price above zero; got ${JSON.stringify(alert.target)}`);

  const order = String(alert.order || (alert.entry === 'market' ? 'market' : 'limit')).toLowerCase();
  if (order !== 'limit' && order !== 'market') {
    throw new Error(`the order is limit or market; got ${JSON.stringify(alert.order)}`);
  }

  let limit = null;
  if (order === 'limit') {
    limit = Number(alert.entry);
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error(`a limit order needs the limit price in "entry"; got ${JSON.stringify(alert.entry)}`);
    }
    /* A bracket on the wrong side of its own entry is not a trade: it would close
       on the bar it opened, at a price the rule never asked for. */
    if (side === 'buy' && !(stop < limit && target > limit)) {
      throw new Error(`a long needs its stop under ${limit} and its target over it; got stop ${stop} and target ${target}`);
    }
    if (side === 'sell' && !(stop > limit && target < limit)) {
      throw new Error(`a short needs its stop over ${limit} and its target under it; got stop ${stop} and target ${target}`);
    }
  }

  return {
    symbol,
    side: side === 'buy' ? 'long' : 'short',
    qty,
    stop,
    target,
    order,
    limit,
    id: alert.id ? String(alert.id) : `${symbol}-${Date.now()}-${side}`,
  };
}

function entry(account, alert, at) {
  const order = readEntry(alert);

  if (account.seen.includes(order.id)) {
    return { actions: [{ action: 'ignored', id: order.id, reason: 'this alert id already came through' }] };
  }
  if (account.position) {
    throw new Error(`a ${account.position.side} ${account.position.symbol} is already open; this account holds one at a time`);
  }
  if (account.orders.some((o) => o.symbol === order.symbol)) {
    throw new Error(`a ${order.symbol} order is already resting; cancel it before sending another`);
  }

  account.seen.push(order.id);
  if (account.seen.length > 1000) account.seen.splice(0, account.seen.length - 1000);

  const resting = {
    id: order.id,
    symbol: order.symbol,
    side: order.side,
    order: order.order,
    limit: order.limit,
    stop: order.stop,
    target: order.target,
    qty: order.qty,
    at,
  };
  account.orders.push(resting);
  note(account, `${order.order} ${order.side} ${order.qty} ${order.symbol}`
    + (order.order === 'limit' ? ` at ${order.limit}` : ' at the market'), at, 'order');

  /* A market order fills as soon as there is a price to fill it at. If the feed
     has already spoken, that is now; otherwise it waits for the next tick. */
  if (order.order === 'market' && Number.isFinite(account.prices[order.symbol])) {
    account.orders.pop();
    return { actions: [fill(account, resting, account.prices[order.symbol], at)] };
  }
  return {
    actions: [{
      action: 'pending',
      id: order.id,
      symbol: order.symbol,
      side: order.side,
      order: order.order,
      limit: order.limit,
      qty: order.qty,
    }],
  };
}

function cancel(account, alert, at) {
  const id = alert.id ? String(alert.id) : '';
  const index = account.orders.findIndex((o) => o.id === id);
  if (index < 0) {
    return { actions: [{ action: 'ignored', id, reason: 'no resting order has that id' }] };
  }
  const [order] = account.orders.splice(index, 1);
  note(account, `cancelled ${order.side} ${order.qty} ${order.symbol}`, at, 'cancel');
  return { actions: [{ action: 'cancelled', id: order.id, symbol: order.symbol }] };
}

function flatten(account, at) {
  const pos = account.position;
  if (!pos) return { actions: [{ action: 'ignored', reason: 'nothing is open to flatten' }] };
  const last = account.prices[pos.symbol];
  if (Number.isFinite(last)) return { actions: [closePosition(account, last, 'flatten', at)] };
  pos.closeRequested = true;
  note(account, `flatten asked for ${pos.symbol}; waiting for a price`, at, 'flatten');
  return { actions: [{ action: 'requested-close', symbol: pos.symbol }] };
}

/**
 * Take one alert, exactly as TradingView posted it.
 *
 * Returns { actions }. A refusal — a bad bracket, a second position, an unknown
 * symbol — throws, so the caller can report why instead of pretending it filled.
 */
function applyAlert(account, alert, { at = Date.now() } = {}) {
  if (!alert || typeof alert !== 'object' || Array.isArray(alert)) {
    throw new Error('the alert is not a JSON object');
  }
  const type = String(alert.type == null ? '' : alert.type).toLowerCase();
  if (type === 'entry') return entry(account, alert, at);
  if (type === 'cancel') return cancel(account, alert, at);
  if (type === 'flatten') return flatten(account, at);
  throw new Error(`the alert type has to be entry, cancel or flatten; got ${JSON.stringify(alert.type)}`);
}

/**
 * Take one price. This is the only thing that can fill anything.
 *
 * The convention, stated because a backtest and a broker can disagree about it:
 *   - a LIMIT fills at its own level, never worse, because that is what resting at
 *     a price means;
 *   - a STOP fills at the observed price when price has gone past it, because a
 *     stop is a market order and a gap is a gap;
 *   - a TARGET fills at its own level, for the same reason as the limit.
 */
function applyPrice(account, { symbol, price }, { at = Date.now() } = {}) {
  const instrument = instrumentOf(symbol);
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) throw new Error(`a price has to be a number above zero; got ${JSON.stringify(price)}`);
  account.prices[instrument] = p;

  const actions = [];
  const pos = account.position;
  if (pos && pos.symbol === instrument) {
    if (pos.closeRequested) {
      actions.push(closePosition(account, p, 'flatten', at));
    } else if (pos.side === 'long') {
      if (p <= pos.stop) actions.push(closePosition(account, Math.min(p, pos.stop), 'stop', at));
      else if (p >= pos.target) actions.push(closePosition(account, pos.target, 'target', at));
    } else if (p >= pos.stop) {
      actions.push(closePosition(account, Math.max(p, pos.stop), 'stop', at));
    } else if (p <= pos.target) {
      actions.push(closePosition(account, pos.target, 'target', at));
    }
  }

  for (let i = account.orders.length - 1; i >= 0; i--) {
    const order = account.orders[i];
    if (order.symbol !== instrument) continue;
    if (order.order === 'market') {
      account.orders.splice(i, 1);
      actions.push(fill(account, order, p, at));
      continue;
    }
    const reached = order.side === 'long' ? p <= order.limit : p >= order.limit;
    if (reached) {
      account.orders.splice(i, 1);
      actions.push(fill(account, order, order.limit, at));
    }
  }

  return { actions };
}

/* -------------------------------------------------------------- the report */

function snapshot(account) {
  const pos = account.position;
  const last = pos ? account.prices[pos.symbol] : null;
  const open = pos && Number.isFinite(last)
    ? round(pnl(spec(pos.symbol), pos.entry, last, pos.qty, pos.side), 2)
    : 0;

  return {
    capital: account.capital,
    realized: round(account.realized, 2),
    fees: round(account.fees, 2),
    unrealised: open,
    equity: round(account.capital + account.realized - account.fees + open, 2),
    commission: account.commission,
    position: pos ? { ...pos, last: Number.isFinite(last) ? last : null, unrealised: open } : null,
    orders: account.orders.map((o) => ({ ...o })),
    trades: account.trades.slice(-25).reverse(),
    events: account.events.slice(-25).reverse(),
    feed: account.feed || null,
    updatedAt: Date.now(),
  };
}

module.exports = {
  DEFAULTS, createAccount, applyAlert, applyPrice, snapshot, instrumentOf,
};
