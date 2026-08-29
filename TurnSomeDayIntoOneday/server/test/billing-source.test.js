// 29 Aug 2026: Jacques bought Pro through Google Play, tapped Cancel on his own
// active plan, and got "No billing account found yet. Upgrade to Pro first."
// Every cancel went to the Stripe portal, which has no customer for a Play
// subscriber. Google also requires a subscriber can reach their subscription
// management, so the dead end was a policy risk on top of a nonsense message.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SERVER = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

test('billing status tells the client where the subscription is billed', () => {
  assert.match(SERVER, /billingSource: user\.billing_source \|\| 'stripe'/,
    'the client cannot route Cancel without knowing this');
  assert.match(SERVER, /storeProductId: user\.store_product_id \|\| null/,
    'the Play deep link needs the product id');
});

test('the Stripe portal refuses a Play subscriber instead of confusing them', () => {
  const portal = SERVER.slice(SERVER.indexOf("app.post('/api/billing/create-portal-session'"));
  const guard = portal.indexOf("(user.billing_source || 'stripe') === 'play'");
  const call = portal.indexOf('billing.createPortalSession');
  assert.ok(guard > 0, 'there is a Play guard');
  assert.ok(guard < call, 'it runs BEFORE the Stripe call that produces the bad message');
  assert.match(portal.slice(0, call), /managedBy: 'play'/,
    'the refusal is machine-readable so the client can redirect');
});

test('cancel goes to Google Play when Play is the biller', () => {
  assert.match(APP, /function billedByPlay\(\)\{return \(S\.billingSource\|\|'stripe'\)==='play';\}/);
  assert.match(APP, /play\.google\.com\/store\/account\/subscriptions/,
    'the Play subscriptions deep link');
  assert.match(APP, /function manageProBilling\(\)\{\s*if\(billedByPlay\(\)\)\{openPlaySubscriptions\(\);return;\}/,
    'Play is checked before falling through to Stripe');
});

test('both cancel and resume route through the same decision', () => {
  const cancel = APP.slice(APP.indexOf('function cancelProSubscription()'));
  assert.match(cancel.slice(0, 400), /manageProBilling\(\)/, 'cancel routes');
  const resume = APP.slice(APP.indexOf('function resumeProSubscription()'));
  assert.match(resume.slice(0, 200), /manageProBilling\(\)/, 'resume routes');
});

test('lifetime is still answered before any billing route is chosen', () => {
  const cancel = APP.slice(APP.indexOf('function cancelProSubscription()'), APP.indexOf('function resumeProSubscription()'));
  const lifetime = cancel.indexOf("S.proPlan==='lifetime'");
  const route = cancel.indexOf('manageProBilling()');
  assert.ok(lifetime > 0 && lifetime < route,
    'a one-time purchase has nothing to cancel and must never be sent to a portal');
});
