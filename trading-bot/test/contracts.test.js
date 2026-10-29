'use strict';
/*
 * What a contract is worth, checked by hand.
 *
 * These are the numbers every futures figure in this bot will be built on, and
 * they are the kind of number that is wrong quietly: if MES were $50 a point
 * instead of $5, a loss would be reported as a tenth of what it really is and the
 * report would still read perfectly. So each one is pinned against a figure done
 * on paper, and the tick value is checked against the multiplier rather than
 * trusted as a second hard-coded number.
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  CONTRACTS, KNOWN, spec, tickValue, pointValue, count,
  roundToTick, ticksBetween, notional, moveValue, pnl, sheet,
} = require('../lib/contracts');

test('the three instruments are the three that were named, and nothing else', () => {
  // Sorted on a copy: sorting the module's own list in place would rewrite the
  // order the refusals read out, which is what this file did on its first run.
  assert.deepEqual([...KNOWN].sort(), ['MES', 'MGC', 'MNQ']);
  for (const key of KNOWN) {
    const c = CONTRACTS[key];
    assert.equal(c.symbol, key, 'each one answers to its own symbol');
    assert.ok(c.name && c.exchange && c.unit, `${key} says what it is`);
    assert.ok(c.multiplier > 0 && c.tickSize > 0, `${key} has a multiplier and a tick`);
  }
});

test('the tick is the price step times the multiplier, on every instrument', () => {
  assert.equal(tickValue(spec('MGC')), 1.0, 'gold: 0.10 x 10 oz = $1.00');
  assert.equal(tickValue(spec('MNQ')), 0.5, 'nasdaq: 0.25 x $2 = $0.50');
  assert.equal(tickValue(spec('MES')), 1.25, 's&p: 0.25 x $5 = $1.25');
  for (const key of KNOWN) {
    const c = CONTRACTS[key];
    assert.equal(tickValue(c), Math.round(c.tickSize * c.multiplier * 1e6) / 1e6, `${key} agrees with itself`);
  }
});

test('a point is worth what the exchange says it is worth', () => {
  assert.equal(pointValue(spec('MGC')), 10, 'a dollar an ounce is $10 a contract');
  assert.equal(pointValue(spec('MNQ')), 2);
  assert.equal(pointValue(spec('MES')), 5);
});

test('four contracts is four times one, on each instrument', () => {
  // The size that was given: 4 contracts per instrument.
  const mgc = spec('MGC');
  assert.equal(moveValue(mgc, 0.1, 4), 4.0, 'MGC: four ticks, four dollars');
  assert.equal(moveValue(spec('MNQ'), 0.25, 4), 2.0, 'MNQ: four ticks, two dollars');
  assert.equal(moveValue(spec('MES'), 0.25, 4), 5.0, 'MES: four ticks, five dollars');
  // One full point, four contracts.
  assert.equal(moveValue(spec('MNQ'), 1, 4), 8.0);
  assert.equal(moveValue(spec('MES'), 1, 4), 20.0);
  // And it is linear, so 8 contracts is twice 4 rather than a separate table.
  assert.equal(moveValue(spec('MES'), 1, 8), 40.0);
});

test('a long gains going up and a short gains going down, signed', () => {
  const mes = spec('MES');
  assert.equal(pnl(mes, 5000, 5001, 4), 20, 'four contracts, one point up, long: $20');
  assert.equal(pnl(mes, 5000, 4999, 4), -20, 'and the same move is a $20 loss the other way');
  assert.equal(pnl(mes, 5000, 4999, 4, 'short'), 20, 'the short is paid for the fall');
  assert.equal(pnl(mes, 5000, 5001, 4, 'short'), -20);
  assert.equal(pnl(spec('MGC'), 2400, 2400.1, 4), 4, 'one tick on gold, four contracts');
  // A zero move is zero, not a rounding crumb.
  assert.equal(pnl(mes, 5000, 5000, 4), 0);
});

test('a quantity of contracts has to be a whole number', () => {
  for (const bad of [0.4, 1.5, 0, -1, 'four', null, undefined, NaN]) {
    assert.throws(() => count(bad), /whole number/, `${JSON.stringify(bad)} is not a contract count`);
  }
  assert.equal(count(4), 4);
  assert.equal(count('4'), 4, 'a number written as text, from a command line, still counts');
});

test('an instrument this bot does not trade is refused, by name', () => {
  // A wrong symbol and a missing symbol are different mistakes, so they say
  // different things: one is a typo, the other is nothing at all being asked for.
  for (const bad of ['NQ', 'ES', 'GC', 'M6E']) {
    assert.throws(() => spec(bad), /not an instrument this bot knows/, `${JSON.stringify(bad)} is refused`);
  }
  for (const empty of ['', '   ', null, undefined]) {
    assert.throws(() => spec(empty), /no instrument given/, `${JSON.stringify(empty)} is refused as missing`);
  }
  // And the refusal says what it does know, so a typo has an obvious fix.
  assert.throws(() => spec('NQ'), /MGC, MNQ, MES/);
  // Case and spaces are not typos.
  assert.equal(spec(' mnq ').symbol, 'MNQ');
  assert.equal(spec('Mes').symbol, 'MES');
});

test('prices land on the tick the instrument actually quotes', () => {
  const mes = spec('MES');
  assert.equal(roundToTick(mes, 5000.13), 5000.25, 'closer to a quarter than to a whole');
  assert.equal(roundToTick(mes, 5000.1), 5000.0, 'closer to the whole than to the quarter');
  assert.equal(roundToTick(mes, 5000.25), 5000.25, 'already on the grid, left alone');
  const mgc = spec('MGC');
  assert.equal(roundToTick(mgc, 2400.04), 2400.0);
  assert.equal(roundToTick(mgc, 2400.06), 2400.1);
  assert.equal(ticksBetween(mgc, 2400, 2400.5), 5, 'half a dollar of gold is five ticks');
  assert.equal(ticksBetween(mes, 5000, 5001), 4, 'a point of the s&p is four ticks');
});

test('the notional is reported as exposure, not as money paid', () => {
  // Four MES at 5000 is a hundred thousand of index exposure and far less than
  // that in margin. Nothing here claims it is the cash cost.
  assert.equal(notional(spec('MES'), 5000, 4), 100000);
  assert.equal(notional(spec('MNQ'), 20000, 4), 160000);
  assert.equal(notional(spec('MGC'), 2400, 4), 96000);
});

test('the sheet is the numbers the report shows, and it is internally consistent', () => {
  const rows = sheet();
  assert.equal(rows.length, 3);
  const mes = rows.filter((r) => r.symbol === 'MES')[0];
  assert.equal(mes.tickValue, 1.25);
  assert.equal(mes.fourTicks, 5.0, 'four contracts, one tick: five dollars');
  assert.equal(mes.fourPerPoint, 20.0, 'four contracts, one point: twenty dollars');
  for (const row of rows) {
    assert.equal(row.tickValue, Math.round(row.tickSize * row.multiplier * 1e6) / 1e6);
    assert.equal(row.fourTicks, Math.round(row.tickValue * 4 * 100) / 100);
  }
});

test('no margin or commission is baked in anywhere', () => {
  // Both are the broker's numbers and both change. A constant here would be
  // wrong within a quarter and nobody would re-check it.
  for (const key of KNOWN) {
    const c = CONTRACTS[key];
    assert.equal(c.margin, undefined, `${key} does not carry a margin figure`);
    assert.equal(c.commission, undefined, `${key} does not carry a commission figure`);
  }
});
