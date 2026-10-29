'use strict';
/*
 * The paper account, checked on the arithmetic that a fake broker can get wrong.
 *
 * The beliefs these tests defend:
 *   - an order fills only when a price arrives at it, never when the alert does;
 *   - a limit fills at its own level, a stop fills where the price actually was;
 *   - the stop and the target come from the alert, so the bracket survives without
 *     TradingView sending an exit;
 *   - four contracts of MES are $5 a point each, and $0.35 a side is charged twice;
 *   - one position at a time, and a repeated alert id does not double up.
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  createAccount, applyAlert, applyPrice, snapshot, instrumentOf,
} = require('../lib/engine');

const MES = 'MES1!';

const short = (over = {}) => ({
  type: 'entry', symbol: MES, side: 'sell', order: 'limit', entry: 100, stop: 102, target: 95, qty: 4, id: 's1', ...over,
});
const long = (over = {}) => ({
  type: 'entry', symbol: MES, side: 'buy', order: 'limit', entry: 100, stop: 98, target: 105, qty: 4, id: 'l1', ...over,
});

function opened(alert = short()) {
  const account = createAccount();
  applyAlert(account, alert, { at: 1 });
  applyPrice(account, { symbol: MES, price: alert.entry }, { at: 2 });
  assert.ok(account.position, 'the fixture was meant to be in a trade');
  return account;
}

/* ------------------------------------------------------------- the symbols */

test('the alert symbol is read back to an instrument this folder can price', () => {
  assert.equal(instrumentOf('MES1!'), 'MES');
  assert.equal(instrumentOf('MNQ1!'), 'MNQ');
  assert.equal(instrumentOf('mgc'), 'MGC');
  assert.equal(instrumentOf('MES=F'), 'MES');
  assert.throws(() => instrumentOf('ES'), /is not an instrument/);
  assert.throws(() => instrumentOf(''), /has no symbol/);
});

/* --------------------------------------------------------------- the entry */

test('a resting limit waits for a price, and does not fill on the alert alone', () => {
  const account = createAccount();
  applyAlert(account, short(), { at: 1 });
  assert.equal(account.position, null, 'an alert is not a fill');
  assert.equal(account.orders.length, 1);
  assert.equal(account.orders[0].limit, 100);
  assert.equal(snapshot(account).equity, 10000, 'nothing has been charged yet');
});

test('a sell limit fills when the price reaches it, and not a tick before', () => {
  const account = createAccount();
  applyAlert(account, short(), { at: 1 });
  applyPrice(account, { symbol: MES, price: 99.75 }, { at: 2 });
  assert.equal(account.position, null, '99.75 has not reached a sell limit at 100');

  const result = applyPrice(account, { symbol: MES, price: 100 }, { at: 3 });
  assert.equal(result.actions[0].action, 'filled');
  assert.equal(account.position.side, 'short');
  assert.equal(account.position.entry, 100);
  assert.equal(account.position.stop, 102);
  assert.equal(account.position.target, 95);
});

test('a limit fills at its own price even when the market went further', () => {
  const account = createAccount();
  applyAlert(account, short(), { at: 1 });
  applyPrice(account, { symbol: MES, price: 101 }, { at: 2 });
  assert.equal(account.position.entry, 100, 'a resting sell does not fill at 101');
});

test('a buy limit fills when the price falls to it', () => {
  const account = createAccount();
  applyAlert(account, long(), { at: 1 });
  applyPrice(account, { symbol: MES, price: 100.25 }, { at: 2 });
  assert.equal(account.position, null);
  applyPrice(account, { symbol: MES, price: 99.9 }, { at: 3 });
  assert.equal(account.position.side, 'long');
  assert.equal(account.position.entry, 100);
});

test('a market entry fills at the next price it is given', () => {
  const account = createAccount();
  applyAlert(account, short({ order: 'market', entry: 'market', id: 'm1' }), { at: 1 });
  assert.equal(account.orders.length, 1, 'no price yet, so it is waiting');
  applyPrice(account, { symbol: MES, price: 99.5 }, { at: 2 });
  assert.equal(account.position.side, 'short');
  assert.equal(account.position.entry, 99.5);
});

/* ---------------------------------------------------------------- the exits */

test('a short reaches its target and books the dollars, fees included', () => {
  const account = opened();
  const result = applyPrice(account, { symbol: MES, price: 95 }, { at: 3 });

  assert.equal(result.actions[0].action, 'closed');
  const trade = account.trades[0];
  assert.equal(trade.exit, 95);
  assert.equal(trade.reason, 'target');
  assert.equal(trade.gross, 100, '5 points × $5 × 4 contracts');
  assert.equal(trade.fees, 2.8, '$0.35 a side on four contracts, twice');
  assert.equal(trade.dollars, 97.2);
  assert.equal(snapshot(account).equity, 10097.2);
  assert.equal(account.position, null);
});

test('a target fills at the target, not at the better price that gapped past it', () => {
  const account = opened();
  applyPrice(account, { symbol: MES, price: 93 }, { at: 3 });
  assert.equal(account.trades[0].exit, 95);
});

test('a stop fills where the price was, because a stop is a market order', () => {
  const account = opened();
  applyPrice(account, { symbol: MES, price: 102.5 }, { at: 3 });

  const trade = account.trades[0];
  assert.equal(trade.reason, 'stop');
  assert.equal(trade.exit, 102.5, 'not 102 — the gap is real');
  assert.equal(trade.gross, -50, '-2.5 points × $5 × 4');
  assert.equal(trade.dollars, -52.8);
  assert.equal(snapshot(account).equity, 9947.2);
});

test('a stop touched exactly fills at the stop', () => {
  const account = opened();
  applyPrice(account, { symbol: MES, price: 102 }, { at: 3 });
  assert.equal(account.trades[0].exit, 102);
  assert.equal(account.trades[0].gross, -40);
});

test('the long side is the mirror: target above, stop below', () => {
  const account = opened(long({ id: 'l1' }));
  assert.equal(account.position.side, 'long');

  applyPrice(account, { symbol: MES, price: 105 }, { at: 3 });
  assert.equal(account.trades[0].exit, 105);
  assert.equal(account.trades[0].dollars, 97.2);

  const second = opened(long({ id: 'l2' }));
  applyPrice(second, { symbol: MES, price: 97.5 }, { at: 3 });
  assert.equal(second.trades[0].reason, 'stop');
  assert.equal(second.trades[0].exit, 97.5);
  assert.equal(second.trades[0].gross, -50);
});

test('a stop is checked before a target, so a bar that spans both is a loss', () => {
  const account = opened();
  /* Nothing can be both, but the poller can see a price beyond both if the feed
     missed the middle. The stop is the conservative answer. */
  applyPrice(account, { symbol: MES, price: 102.5 }, { at: 3 });
  assert.equal(account.trades[0].reason, 'stop');
});

/* ------------------------------------------------------ flatten and cancel */

test('a flatten closes at the last price it knows', () => {
  const account = opened();
  applyPrice(account, { symbol: MES, price: 99 }, { at: 3 });
  const result = applyAlert(account, { type: 'flatten', symbol: MES, qty: 4, id: 's1' }, { at: 4 });

  assert.equal(result.actions[0].action, 'closed');
  assert.equal(account.trades[0].reason, 'flatten');
  assert.equal(account.trades[0].exit, 99);
  assert.equal(account.trades[0].dollars, 17.2, '1 point × $5 × 4, less $2.80');
});

test('a flatten with no price yet waits for one instead of inventing it', () => {
  const account = createAccount();
  applyAlert(account, short(), { at: 1 });
  applyPrice(account, { symbol: MES, price: 100 }, { at: 2 });
  account.prices = {};

  const result = applyAlert(account, { type: 'flatten', symbol: MES, id: 's1' }, { at: 3 });
  assert.equal(result.actions[0].action, 'requested-close');
  assert.equal(account.position.closeRequested, true);

  applyPrice(account, { symbol: MES, price: 98 }, { at: 4 });
  assert.equal(account.position, null);
  assert.equal(account.trades[0].exit, 98);
});

test('a cancel takes the order away, and no price fills it afterwards', () => {
  const account = createAccount();
  applyAlert(account, short(), { at: 1 });
  const result = applyAlert(account, { type: 'cancel', symbol: MES, id: 's1' }, { at: 2 });

  assert.equal(result.actions[0].action, 'cancelled');
  assert.equal(account.orders.length, 0);
  applyPrice(account, { symbol: MES, price: 100 }, { at: 3 });
  assert.equal(account.position, null);
});

test('cancelling something that is not there is reported, not crashed', () => {
  const account = createAccount();
  const result = applyAlert(account, { type: 'cancel', symbol: MES, id: 'nope' }, { at: 1 });
  assert.equal(result.actions[0].action, 'ignored');
});

/* -------------------------------------------------------------- the refusals */

test('the same alert id twice does not put on two trades', () => {
  const account = createAccount();
  applyAlert(account, short(), { at: 1 });
  const again = applyAlert(account, short(), { at: 2 });
  assert.equal(again.actions[0].action, 'ignored');
  assert.equal(account.orders.length, 1);
});

test('a second entry while one is open is refused', () => {
  const account = opened();
  assert.throws(() => applyAlert(account, short({ id: 's2' }), { at: 5 }), /already open/);
});

test('a bracket on the wrong side of its own limit is refused', () => {
  assert.throws(() => applyAlert(createAccount(), short({ stop: 99 }), { at: 1 }), /stop over 100/);
  assert.throws(() => applyAlert(createAccount(), short({ target: 101 }), { at: 1 }), /target under it/);
  assert.throws(() => applyAlert(createAccount(), long({ stop: 101 }), { at: 1 }), /stop under 100/);
  assert.throws(() => applyAlert(createAccount(), long({ target: 99 }), { at: 1 }), /target over it/);
});

test('an alert with no qty, no stop or no type is refused with a reason', () => {
  assert.throws(() => applyAlert(createAccount(), short({ qty: 0 }), { at: 1 }), /whole number of contracts/);
  assert.throws(() => applyAlert(createAccount(), short({ stop: null }), { at: 1 }), /stop has to be a price/);
  assert.throws(() => applyAlert(createAccount(), { symbol: MES }, { at: 1 }), /entry, cancel or flatten/);
  assert.throws(() => applyAlert(createAccount(), 'nope', { at: 1 }), /not a JSON object/);
});

test('an alert for a market this account cannot price is refused, by name', () => {
  assert.throws(() => applyAlert(createAccount(), short({ symbol: 'CL1!' }), { at: 1 }), /is not an instrument/);
});

/* ------------------------------------------------------------- the position */

test('the snapshot carries the open trade at the price it last saw', () => {
  const account = opened();
  applyPrice(account, { symbol: MES, price: 98 }, { at: 3 });

  const s = snapshot(account);
  assert.equal(s.position.entry, 100);
  assert.equal(s.position.last, 98);
  assert.equal(s.unrealised, 40, '2 points × $5 × 4');
  assert.equal(s.fees, 1.4, 'the entry side only');
  assert.equal(s.equity, 10038.6);
});

test('a fresh account is worth exactly its capital and holds nothing', () => {
  const s = snapshot(createAccount({ capital: 25000 }));
  assert.equal(s.equity, 25000);
  assert.equal(s.position, null);
  assert.deepEqual(s.trades, []);
  assert.deepEqual(s.orders, []);
});
