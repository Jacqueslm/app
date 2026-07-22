const Stripe = require('stripe');
const db = require('./db');

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
    success_url: `${origin}/?checkout=success`,
    cancel_url: `${origin}/?checkout=cancel`,
    metadata: { app_user_id: String(user.id), plan },
    ...(plan !== 'lifetime'
      ? { subscription_data: { trial_period_days: TRIAL_DAYS, metadata: { app_user_id: String(user.id), plan } } }
      : { payment_intent_data: { metadata: { app_user_id: String(user.id), plan } } }),
  });

  return session.url;
}

async function createPortalSession(user, origin) {
  if (!user.stripe_customer_id) {
    throw new Error('No billing account found yet. Upgrade to Pro first.');
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${origin}/`,
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
        db.updateSubscriptionFromStripe(userId, {
          plan: 'lifetime',
          subscriptionStatus: 'active',
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        });
      } else if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        db.updateSubscriptionFromStripe(userId, {
          plan,
          subscriptionStatus: sub.status,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
      }
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const user = db.getUserByStripeCustomerId(sub.customer);
      if (!user) break;
      const isActive = sub.status === 'active' || sub.status === 'trialing';
      db.updateSubscriptionFromStripe(user.id, {
        plan: isActive ? (user.plan === 'lifetime' ? 'lifetime' : sub.metadata.plan || user.plan) : 'free',
        subscriptionStatus: sub.status,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      });
      break;
    }
    default:
      break;
  }
}

module.exports = {
  isConfigured,
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
  cancelStripeSubscriptionForUser,
  handleWebhookEvent,
};
