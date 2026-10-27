'use strict';
/*
 * A reference strategy, and nothing more than that.
 *
 * It is here so the engine can be run end to end and so the tests have something
 * to measure. It is NOT a strategy of yours and it is not a recommendation: a
 * moving-average crossover is the first thing anyone writes and it is not an edge.
 * When your own strategy arrives, this file stays what it is and yours sits beside
 * it under its own name.
 *
 * The rule: in when the fast average is above the slow one, out when it is not.
 * Long only, no stop, always the same size.
 */

const FAST = 10;
const SLOW = 30;

function average(bars, from, to) {
  let sum = 0;
  for (let i = from; i <= to; i++) sum += bars[i].close;
  return sum / (to - from + 1);
}

module.exports = {
  name: 'example-sma',
  params: { fast: FAST, slow: SLOW },

  describe: () => `in when the ${FAST}-bar average is above the ${SLOW}-bar one, out when it drops below`,

  signal(ctx) {
    const { history, i } = ctx;
    if (i < SLOW - 1) return 0;              // not enough past to average yet
    const fast = average(history, i - FAST + 1, i);
    const slow = average(history, i - SLOW + 1, i);
    if (!Number.isFinite(fast) || !Number.isFinite(slow)) return 0;
    return fast > slow ? 1 : 0;
  },
};
