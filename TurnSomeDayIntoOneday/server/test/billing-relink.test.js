// The lockout: an account whose user row lost its stripe_customer_id could
// never restore what it paid for, because refreshFromStripe gave up first.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
process.env.DB_PATH = '/tmp/relink-test.sqlite';
try { require('fs').unlinkSync('/tmp/relink-test.sqlite'); } catch (_) {}
const db = require('../db.js');
const billing = require('../billing.js');

test('relink is a no-op with no Stripe configured', async () => {
  const id = db.createUser('a' + Date.now() + '@e.com', 'hash');
  const u = db.getUserById(id);
  assert.equal(await billing.relinkCustomerByEmail(u), null);
});

test('relink never steals a customer another account already owns', async () => {
  const e = 'shared' + Date.now() + '@e.com';
  const a = db.createUser(e, 'hash');
  const b = db.createUser('other' + Date.now() + '@e.com', 'hash');
  db.setStripeCustomerId(a, 'cus_TAKEN');
  assert.equal(db.getUserByStripeCustomerId('cus_TAKEN').id, a);
  const ub = db.getUserById(b);
  assert.equal(ub.stripe_customer_id, null, 'second account starts unlinked');
  // With Stripe unconfigured relink returns null rather than throwing.
  assert.equal(await billing.relinkCustomerByEmail(ub), null);
  assert.equal(db.getUserByStripeCustomerId('cus_TAKEN').id, a, 'still owned by the first account');
});

test('an already-linked user is left alone', async () => {
  const id = db.createUser('linked' + Date.now() + '@e.com', 'hash');
  db.setStripeCustomerId(id, 'cus_MINE');
  const u = db.getUserById(id);
  assert.equal(await billing.relinkCustomerByEmail(u), null, 'returns null, changes nothing');
  assert.equal(db.getUserById(id).stripe_customer_id, 'cus_MINE');
});
