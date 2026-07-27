const Stripe = require('stripe');
const db = require('./db');
const emailer = require('./email');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// Prices are defined inline on the Checkout Session (price_data) rather than referencing
// pre-created Stripe Price IDs, so there's no separate one-time setup script required.
const PLANS = {
  monthly: { amount: 999, currency: 'usd', interval: 'month', name: 'Pro Monthly' },
  yearly: { amount: 5999, currency: 'usd', interval: 'year', name: 'Pro Yearly' },
  lifetime: { amount: 14999, currency: 'usd', name: 'Pro Lifetime' },
};
// Both subscription plans start with a free trial - trials roughly double how many
// people are willing to start, and the card is only charged after day 7.
const TRIAL_DAYS = 7;

// ─── FOUNDING LIFETIME CAP ───────────────────────────────────────────────────
// 50 means 50. The landing page has promised "limited to the first 50 members"
// since launch, so this is a commitment being kept, not a marketing device.
const LIFETIME_CAP = 50;
// Shown once the cap is reached, and returned verbatim as the checkout refusal.
const LIFETIME_SOLD_OUT_MESSAGE = 'Founding Lifetime — sold out. Lifetime returns at $249.';
// The remaining count stays private until it is low enough to be worth stating.
const LIFETIME_COUNT_VISIBLE_BELOW = 25;

// Two lines of defense. The cached count serves the public availability endpoint,
// which every landing-page view hits, so it must not COUNT on each request. The
// authoritative count runs on every checkout attempt, so a stale cache can only
// ever make the page look wrong - never sell a 51st seat. The cache is
// invalidated the moment a purchase confirms (webhook or ?refresh=1) and
// otherwise expires on a short TTL.
const LIFETIME_CACHE_TTL_MS = 60000;
let lifetimeSoldCache = null;
let lifetimeSoldCachedAt = 0;

function invalidateLifetimeCount() {
  lifetimeSoldCache = null;
  lifetimeSoldCachedAt = 0;
}

function cachedLifetimeSold() {
  const now = Date.now();
  if (lifetimeSoldCache === null || now - lifetimeSoldCachedAt > LIFETIME_CACHE_TTL_MS) {
    lifetimeSoldCache = db.countLifetimeSold();
    lifetimeSoldCachedAt = now;
  }
  return lifetimeSoldCache;
}

// showCount is decided here rather than on each surface, so the app and the
// landing page can never disagree about when the number becomes public.
function getLifetimeAvailability() {
  const sold = cachedLifetimeSold();
  const remaining = Math.max(0, LIFETIME_CAP - sold);
  return {
    limit: LIFETIME_CAP,
    sold,
    remaining,
    soldOut: remaining === 0,
    showCount: remaining > 0 && remaining < LIFETIME_COUNT_VISIBLE_BELOW,
    soldOutMessage: LIFETIME_SOLD_OUT_MESSAGE,
  };
}

function isLifetimeSoldOut() {
  return db.countLifetimeSold() >= LIFETIME_CAP;
}

function isConfigured() {
  return !!stripe;
}

async function getOrCreateCustomer(user) {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { app_user_id: String(user.id) },
  });
  db.setStripeCustomerId(user.id, customer.id);
  return customer.id;
}

async function createCheckoutSession(user, plan, origin) {
  const planDef = PLANS[plan];
  if (!planDef) throw new Error('Unknown plan.');
  // The cap is enforced here, against the authoritative count, before Stripe is
  // touched at all - hiding the option in the UI is a courtesy, this is the rule.
  // An existing lifetime owner already holds their seat, so they are never blocked.
  if (plan === 'lifetime' && user.plan !== 'lifetime' && isLifetimeSoldOut()) {
    const err = new Error(LIFETIME_SOLD_OUT_MESSAGE);
    err.code = 'lifetime_sold_out';
    throw err;
  }
  const customerId = await getOrCreateCustomer(user);

  const lineItem = {
    quantity: 1,
    price_data: {
      currency: planDef.currency,
      unit_amount: planDef.amount,
      product_data: { name: planDef.name },
      ...(planDef.interval ? { recurring: { interval: planDef.interval } } : {}),
    },
  };

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: plan === 'lifetime' ? 'payment' : 'subscription',
    line_items: [lineItem],
    success_url: `${origin}/app?checkout=success`,
    cancel_url: `${origin}/app?checkout=cancel`,
    metadata: { app_user_id: String(user.id), plan },
    ...(plan !== 'lifetime'
      ? { subscription_data: { trial_period_days: TRIAL_DAYS, metadata: { app_user_id: String(user.id), plan } } }
      : { payment_intent_data: { metadata: { app_user_id: String(user.id), plan } } }),
  });

  return session.url;
}

// The second line of defense. By the time a purchase confirms the money is
// already taken, so an over-cap seat is still granted - refusing someone their
// product after charging them would be the worse failure. It is recorded loudly
// instead, so an oversell surfaces in diagnostics rather than silently.
function recordLifetimePurchase(userId) {
  const alreadyOwned = (db.getUserById(userId) || {}).plan === 'lifetime';
  const soldBefore = db.countLifetimeSold();
  db.updateSubscriptionFromStripe(userId, {
    plan: 'lifetime',
    subscriptionStatus: 'active',
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  });
  invalidateLifetimeCount();
  if (!alreadyOwned && soldBefore >= LIFETIME_CAP) {
    try {
      db.logError(
        'lifetime_cap',
        `Founding Lifetime oversold: seat ${soldBefore + 1} of ${LIFETIME_CAP} granted to user ${userId}`,
        'Payment already completed, so access was granted. Check Stripe for a refund decision.'
      );
    } catch (e) { /* logging must never break a paid upgrade */ }
  }
}

async function createPortalSession(user, origin) {
  if (!user.stripe_customer_id) {
    throw new Error('No billing account found yet. Upgrade to Pro first.');
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${origin}/app`,
  });
  return session.url;
}

function getBillingStatus(user) {
  return {
    isPro: user.plan === 'monthly' || user.plan === 'yearly' || user.plan === 'lifetime',
    plan: user.plan || 'free',
    subscriptionStatus: user.subscription_status || null,
    currentPeriodEnd: user.current_period_end || null,
    cancelAtPeriodEnd: !!user.cancel_at_period_end,
  };
}

async function cancelStripeSubscriptionForUser(user) {
  if (!user.stripe_subscription_id) return;
  try {
    await stripe.subscriptions.cancel(user.stripe_subscription_id);
  } catch (e) {
    // Best-effort: if Stripe is unreachable or the subscription is already gone, the local
    // account deletion should still proceed rather than getting blocked on this call.
  }
}

// Webhook-optional reconciliation: ask Stripe directly what this customer has
// paid for. A home install has no public URL for Stripe to send webhooks to,
// so after checkout the app pulls the truth on demand and updates the local
// account to match - Pro activates without any webhook setup.
async function refreshFromStripe(user) {
  if (!stripe || !user.stripe_customer_id) return;
  try {
    // Lifetime is a one-time payment, not a subscription - it shows up as a
    // completed payment-mode Checkout Session. A lifetime purchase never downgrades.
    const sessions = await stripe.checkout.sessions.list({ customer: user.stripe_customer_id, limit: 10 });
    const lifetimePaid = sessions.data.some(
      (s) => s.mode === 'payment' && s.payment_status === 'paid' && s.metadata && s.metadata.plan === 'lifetime'
    );
    if (lifetimePaid || user.plan === 'lifetime') {
      recordLifetimePurchase(user.id);
      return;
    }
    const subs = await stripe.subscriptions.list({ customer: user.stripe_customer_id, status: 'all', limit: 10 });
    const best = subs.data.find((s) => s.status === 'active' || s.status === 'trialing') || subs.data[0];
    if (!best) return;
    const isActive = best.status === 'active' || best.status === 'trialing';
    const { trialJustStarted } = db.updateSubscriptionFromStripe(user.id, {
      plan: isActive ? ((best.metadata && best.metadata.plan) || user.plan || 'monthly') : 'free',
      subscriptionStatus: best.status,
      stripeSubscriptionId: best.id,
      currentPeriodEnd: best.current_period_end
        ? new Date(best.current_period_end * 1000).toISOString()
        : null,
      cancelAtPeriodEnd: best.cancel_at_period_end,
    });
    if (trialJustStarted) {
      const freshUser = db.getUserById(user.id);
      if (freshUser) emailer.startTrialSequence(freshUser).catch(() => {});
    }
  } catch (e) {
    // Stripe unreachable - keep the last known local state; the next refresh catches up.
  }
}

async function handleWebhookEvent(rawBody, signature) {
  if (!WEBHOOK_SECRET) throw new Error('Webhook secret not configured.');
  const event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = Number(session.metadata && session.metadata.app_user_id);
      const plan = session.metadata && session.metadata.plan;
      if (!userId || !plan) break;
      if (plan === 'lifetime') {
        recordLifetimePurchase(userId);
      } else if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        const { trialJustStarted } = db.updateSubscriptionFromStripe(userId, {
          plan,
          subscriptionStatus: sub.status,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
        if (trialJustStarted) {
          const freshUser = db.getUserById(userId);
          if (freshUser) emailer.startTrialSequence(freshUser).catch(() => {});
        }
      }
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const user = db.getUserByStripeCustomerId(sub.customer);
      if (!user) break;
      const isActive = sub.status === 'active' || sub.status === 'trialing';
      const { trialJustStarted } = db.updateSubscriptionFromStripe(user.id, {
        plan: isActive ? (user.plan === 'lifetime' ? 'lifetime' : sub.metadata.plan || user.plan) : 'free',
        subscriptionStatus: sub.status,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      });
      if (trialJustStarted) {
        const freshUser = db.getUserById(user.id);
        if (freshUser) emailer.startTrialSequence(freshUser).catch(() => {});
      }
      break;
    }
    default:
      break;
  }
}

module.exports = {
  isConfigured,
  LIFETIME_CAP,
  getLifetimeAvailability,
  recordLifetimePurchase,
  invalidateLifetimeCount,
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
  refreshFromStripe,
  cancelStripeSubscriptionForUser,
  handleWebhookEvent,
};
