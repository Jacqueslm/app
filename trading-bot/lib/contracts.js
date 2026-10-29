'use strict';
/*
 * What a contract is worth.
 *
 * The engine in lib/backtest.js sizes in fractions of equity, which is fine for
 * shares and wrong for futures. A futures contract is a fixed thing: it moves in
 * ticks, each tick is a fixed number of dollars, and four of them is four times
 * that. Before any rule can be sized or any loss counted, those numbers have to
 * exist in one place, exact, so nothing downstream quietly uses a share price
 * where a contract belongs.
 *
 * The three instruments are the micros that were named: MGC, MNQ, MES.
 *
 *   multiplier  dollars per one whole point of the quoted price
 *   tickSize    the smallest price increment the exchange quotes
 *   tick value  tickSize x multiplier — the dollars one tick is worth
 *
 * Spot-checked by hand:
 *   MGC  gold, 10 troy ounces. $1.00/oz move is $10. A 0.10 tick is $1.00.
 *   MNQ  Nasdaq-100, $2 a point. A 0.25 tick is $0.50.
 *   MES  S&P 500, $5 a point. A 0.25 tick is $1.25.
 *
 * What is deliberately NOT in here:
 *
 *   Margin. It is set by the broker, not the exchange, and it changes with
 *   volatility. A number baked into a file is a number that is wrong later and
 *   that nobody re-checks. It comes from the broker's API when paper trading
 *   starts, or from you, and it is passed in — never assumed.
 *
 *   Commission. Same reason: per-contract, per-side, and it varies by broker and
 *   by whether you are taking or making liquidity. It goes in as a number per
 *   contract, not as a guess.
 *
 *   Rollover. MGC, MNQ and MES expire quarterly. A continuous series is stapled
 *   together from contracts that stop existing, so a backtest run across a roll
 *   is trading a price that never existed. That is not solved here and the README
 *   says so.
 */

const CONTRACTS = {
  MGC: {
    symbol: 'MGC',
    name: 'Micro Gold',
    exchange: 'COMEX',
    unit: 'troy ounces',
    multiplier: 10,
    tickSize: 0.1,
    /* Two decimals on the tick: 0.10, not 0.1, so printed prices line up. */
    decimals: 2,
    session: 'nearly round the clock, Sunday evening to Friday afternoon, with a short daily halt',
  },
  MNQ: {
    symbol: 'MNQ',
    name: 'Micro E-mini Nasdaq-100',
    exchange: 'CME',
    unit: 'index points',
    multiplier: 2,
    tickSize: 0.25,
    decimals: 2,
    session: 'nearly round the clock, with a daily maintenance halt in the evening',
  },
  MES: {
    symbol: 'MES',
    name: 'Micro E-mini S&P 500',
    exchange: 'CME',
    unit: 'index points',
    multiplier: 5,
    tickSize: 0.25,
    decimals: 2,
    session: 'nearly round the clock, with a daily maintenance halt in the evening',
  },
};

/* In the order they were named, and frozen: this list is read out in error
   messages, so a caller sorting it must not be able to change what a later
   refusal says. */
const KNOWN = Object.freeze(['MGC', 'MNQ', 'MES']);

/* A symbol to its spec. Case and stray spaces are forgiven, anything else is not:
   an unknown instrument is a typo, and a typo that trades is a real loss. */
function spec(symbol) {
  const key = String(symbol == null ? '' : symbol).trim().toUpperCase();
  if (!key) throw new Error(`no instrument given — this bot trades ${KNOWN.join(', ')}`);
  const found = CONTRACTS[key];
  if (!found) throw new Error(`${JSON.stringify(symbol)} is not an instrument this bot knows — it knows ${KNOWN.join(', ')}`);
  return found;
}

/* The dollars one tick is worth, worked out rather than typed twice, so the two
   numbers can never drift apart. */
function tickValue(contract) {
  return round(contract.tickSize * contract.multiplier, 6);
}

/* Dollars per one whole point of price, for one contract. */
function pointValue(contract) {
  return contract.multiplier;
}

/* A quantity of contracts, refused unless it is a positive whole number. Four is
   four; 0.4 of a futures contract does not exist. */
function count(n) {
  const value = Number(n);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`contracts has to be a whole number, 1 or more; got ${JSON.stringify(n)}`);
  }
  return value;
}

/* The nearest tradable price. An order priced off the tick is rejected by the
   exchange, so a stop or a target built from a swing gets rounded onto the grid
   before it is ever sent. */
function roundToTick(contract, price) {
  const p = Number(price);
  if (!Number.isFinite(p)) throw new Error(`cannot round ${JSON.stringify(price)} to a tick`);
  const steps = Math.round(p / contract.tickSize);
  return round(steps * contract.tickSize, contract.decimals + 2);
}

/* How many ticks a price move is, exactly. Used to sanity-check a stop distance
   against what the instrument actually quotes. */
function ticksBetween(contract, from, to) {
  const a = Number(from);
  const b = Number(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('ticksBetween needs two prices');
  return round(Math.abs(b - a) / contract.tickSize, 6);
}

/* Notional: what the position is notionally exposed to. For futures this is not
   what it cost to put on — the money actually at risk is margin plus the move —
   so it is reported as an exposure figure and never as a cash outlay. */
function notional(contract, price, contracts) {
  const p = Number(price);
  if (!Number.isFinite(p)) throw new Error('notional needs a price');
  return round(p * contract.multiplier * count(contracts), 2);
}

/* The dollars a given price move is worth, unsigned. The caller says which way. */
function moveValue(contract, priceMove, contracts) {
  const d = Number(priceMove);
  if (!Number.isFinite(d)) throw new Error('moveValue needs a price move');
  return round(Math.abs(d) * contract.multiplier * count(contracts), 2);
}

/*
 * Profit and loss in dollars for one round trip. Long gains when price rises,
 * short when it falls. Signed, so a loss comes back negative without a caller
 * having to remember to flip it.
 */
function pnl(contract, entry, exit, contracts, side = 'long') {
  const a = Number(entry);
  const b = Number(exit);
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('pnl needs an entry and an exit price');
  const dir = String(side).toLowerCase();
  if (dir !== 'long' && dir !== 'short') throw new Error(`side is long or short, got ${JSON.stringify(side)}`);
  const diff = dir === 'long' ? b - a : a - b;
  return round(diff * contract.multiplier * count(contracts), 2);
}

/* The whole sheet, for a report or a printout. */
function sheet() {
  return KNOWN.map((key) => {
    const c = CONTRACTS[key];
    return {
      symbol: c.symbol,
      name: c.name,
      multiplier: c.multiplier,
      tickSize: c.tickSize,
      tickValue: tickValue(c),
      /* Four contracts, the size that was given. */
      fourTicks: round(tickValue(c) * 4, 2),
      fourPerPoint: round(c.multiplier * 4, 2),
    };
  });
}

/* Cents-and-cents rounding without the float fuzz, e.g. 0.1 * 3 coming out as
   0.30000000000000004 and printing as 0.30 in one place and 0.3 in another. */
function round(n, places) {
  const f = 10 ** places;
  return Math.round((n + Number.EPSILON) * f) / f;
}

module.exports = {
  CONTRACTS, KNOWN, spec, tickValue, pointValue, count,
  roundToTick, ticksBetween, notional, moveValue, pnl, sheet,
};
