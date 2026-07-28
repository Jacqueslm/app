// ─── STORE BILLING ───────────────────────────────────────────────────────────
// In-app purchases made through an app store, as opposed to Stripe on the web.
//
// Deliberately store-agnostic. Google Play ships first, but nothing above the
// verifier layer knows or cares which store a receipt came from: adding Apple
// later means writing verifyAppleReceipt and adding one line to VERIFIERS, not
// touching routes, entitlement, the Founding 50 cap, or the database schema.
//
// A store purchase writes the same plan/subscription_status fields Stripe
// writes, so the trial sequence, the lifetime cap and the admin stats keep
// working without knowing this file exists.

const db = require('./db');

// Product IDs are configured in each store's console and mapped here rather
// than parsed, so a malformed or unknown ID can never be coerced into a plan.
const PRODUCT_PLANS = {
  // Google Play
  'pro_monthly': { plan: 'monthly', recurring: true },
  'pro_yearly': { plan: 'yearly', recurring: true },
  'pro_lifetime': { plan: 'lifetime', recurring: false },
};

function planForProduct(productId) {
  return PRODUCT_PLANS[productId] || null;
}

// ─── GOOGLE PLAY ─────────────────────────────────────────────────────────────
// Verification asks Google directly rather than trusting the client. A purchase
// token from the device is meaningless on its own - anyone can post one.
const PLAY_PACKAGE = process.env.PLAY_PACKAGE_NAME || 'com.turnsomedayintodayone.app';

function playServiceAccount() {
  const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function isPlayConfigured() {
  return !!playServiceAccount();
}

// Google's APIs need an OAuth access token signed with the service account key.
// Done by hand with node's crypto rather than pulling in googleapis: one JWT,
// one token exchange, no dependency tree.
async function playAccessToken() {
  const sa = playServiceAccount();
  if (!sa) throw new Error('Play service account not configured.');
  const crypto = require('crypto');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(claim)}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error('Could not authenticate with Google Play.');
  const data = await res.json();
  if (!data.access_token) throw new Error('Google Play returned no access token.');
  return data.access_token;
}

async function verifyPlayPurchase({ productId, purchaseToken, recurring }) {
  const token = await playAccessToken();
  // Subscriptions and one-time products live on different endpoints.
  const url = recurring
    ? `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PLAY_PACKAGE}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`
    : `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PLAY_PACKAGE}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = new Error('Google Play could not confirm that purchase.');
    err.code = 'store_verification_failed';
    throw err;
  }
  const p = await res.json();

  if (recurring) {
    // expiryTimeMillis in the future means the subscription is live. Google
    // reports cancellation separately from expiry - a cancelled subscription
    // stays valid until it actually runs out, which is what the user paid for.
    const expiry = Number(p.expiryTimeMillis || 0);
    if (!expiry || expiry < Date.now()) {
      const err = new Error('That subscription is no longer active.');
      err.code = 'store_purchase_expired';
      throw err;
    }
    return {
      active: true,
      currentPeriodEnd: new Date(expiry).toISOString(),
      subscriptionStatus: 'active',
    };
  }
  // One-time purchase: 0 = purchased, 1 = cancelled/refunded.
  if (Number(p.purchaseState) !== 0) {
    const err = new Error('That purchase was cancelled or refunded.');
    err.code = 'store_purchase_not_valid';
    throw err;
  }
  return { active: true, currentPeriodEnd: null, subscriptionStatus: 'active' };
}

// ─── APPLE ───────────────────────────────────────────────────────────────────
// Placeholder with the same shape as the Play verifier. When Apple ships, this
// validates the signed transaction against the App Store Server API and returns
// the identical object - nothing else in this file or above it changes.
async function verifyAppleReceipt() {
  const err = new Error('Apple purchases are not available yet.');
  err.code = 'store_not_supported';
  throw err;
}

const VERIFIERS = {
  play: verifyPlayPurchase,
  apple: verifyAppleReceipt,
};

function isStoreSupported(source) {
  return Object.prototype.hasOwnProperty.call(VERIFIERS, source);
}

// ─── THE ONE ENTRY POINT ─────────────────────────────────────────────────────
async function redeemPurchase({ userId, source, productId, purchaseToken }) {
  if (!isStoreSupported(source)) {
    const err = new Error('Unknown store.'); err.code = 'store_not_supported'; throw err;
  }
  const mapping = planForProduct(productId);
  if (!mapping) {
    const err = new Error('Unknown product.'); err.code = 'unknown_product'; throw err;
  }
  if (!purchaseToken) {
    const err = new Error('Missing purchase token.'); err.code = 'missing_token'; throw err;
  }

  // A receipt belongs to exactly one account. Without this, one purchase could
  // be replayed to upgrade any number of accounts for free.
  const existing = db.getUserByPurchaseToken(purchaseToken);
  if (existing && existing.id !== userId) {
    const err = new Error('That purchase is already linked to another account.');
    err.code = 'token_already_used';
    throw err;
  }

  const result = await VERIFIERS[source]({
    productId, purchaseToken, recurring: mapping.recurring,
  });

  db.recordStorePurchase(userId, {
    source,
    plan: mapping.plan,
    productId,
    purchaseToken,
    subscriptionStatus: result.subscriptionStatus,
    currentPeriodEnd: result.currentPeriodEnd,
  });

  return { plan: mapping.plan, currentPeriodEnd: result.currentPeriodEnd };
}

module.exports = {
  redeemPurchase,
  planForProduct,
  isStoreSupported,
  isPlayConfigured,
  PRODUCT_PLANS,
};
