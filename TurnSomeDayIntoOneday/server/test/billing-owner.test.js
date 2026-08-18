// The owner must never be locked out of the tier he built - and must never be
// charged for it. This is the regression guard for the 18 Aug lockout.
const test = require('node:test');
const assert = require('node:assert');
process.env.DB_PATH = '/tmp/owner-test.sqlite';
process.env.APP_OWNER_EMAIL = 'Owner@Example.com';   // deliberately mixed case
process.env.COMP_PRO_EMAILS = 'tester@example.com';
try { require('fs').unlinkSync('/tmp/owner-test.sqlite'); } catch (_) {}
const billing = require('../billing.js');

const u = (email, extra) => Object.assign({ id: 1, email, plan: 'free' }, extra || {});

test('the owner is Pro with no payment at all', () => {
  const s = billing.getBillingStatus(u('owner@example.com'));
  assert.equal(s.isPro, true);
  assert.equal(s.plan, 'comp', 'shows as a comp, so it never counts as revenue');
});

test('owner match ignores case', () => {
  assert.equal(billing.getBillingStatus(u('OWNER@EXAMPLE.COM')).isPro, true);
});

test('a paying owner keeps their real plan, not the comp', () => {
  const s = billing.getBillingStatus(u('owner@example.com', { plan: 'yearly', current_period_end: '2027-01-01' }));
  assert.equal(s.isPro, true);
  assert.equal(s.plan, 'yearly', 'a real purchase always wins over the comp');
  assert.equal(s.currentPeriodEnd, '2027-01-01');
});

test('the comp list still works alongside the owner', () => {
  assert.equal(billing.getBillingStatus(u('tester@example.com')).isPro, true);
});

test('everyone else is still free', () => {
  assert.equal(billing.getBillingStatus(u('someone@example.com')).isPro, false);
  assert.equal(billing.getBillingStatus(u('')).isPro, false);
  assert.equal(billing.getBillingStatus({ id: 2, plan: 'free' }).isPro, false);
});
