// Plausible Analytics — privacy-preserving, cookieless, server-side events.
//
// Nothing in this file touches the visitor's device, sets a cookie, or sends
// an email, name, or account id anywhere. The only data that leaves this
// server is the event name, the page URL, and the props listed at each call
// site. Every send is fire-and-forget: analytics can never slow down or fail
// a page load, a signup, or a purchase.
//
// It is a complete no-op unless PLAUSIBLE_DOMAIN is set, so running locally or
// on a preview costs nothing and sends nothing.

const PLAUSIBLE_DOMAIN = (process.env.PLAUSIBLE_DOMAIN || '').trim();
const ENDPOINT = 'https://plausible.io/api/event';
// A neutral UA for events that originate server-side (a webhook-confirmed
// payment, for instance) and therefore have no visitor request to forward.
// It only exists because Plausible requires the User-Agent header.
const SERVER_UA = 'tsid-server/1.0';

// Gross amounts per plan, for Plausible's goal-revenue attribution. Kept here
// (not in billing.js) so all Plausible knowledge lives in one file.
const PLAN_AMOUNTS = { monthly: 9.99, yearly: 59.99, lifetime: 149.99 };

function isEnabled() {
  return !!PLAUSIBLE_DOMAIN;
}

// Props must stay flat and PII-free: Plausible drops nested values and keeps
// only the first 30 keys. Nulls/empties are stripped so the dashboard stays
// clean, and everything is coerced to a string for safety.
function cleanProps(props) {
  if (!props) return undefined;
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === '') continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

function track(name, { url, referrer, userAgent, ip, props, revenue } = {}) {
  if (!isEnabled()) return;
  const body = {
    name,
    domain: PLAUSIBLE_DOMAIN,
    url: url || 'https://' + PLAUSIBLE_DOMAIN + '/',
  };
  if (referrer) body.referrer = referrer;
  const cleaned = cleanProps(props);
  if (cleaned) body.props = cleaned;
  if (revenue && revenue.amount) body.revenue = revenue;

  fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': userAgent || SERVER_UA,
      ...(ip ? { 'X-Forwarded-For': ip } : {}),
    },
    body: JSON.stringify(body),
  }).catch(() => {});
}

// A pageview, forwarding the visitor's own UA and IP so Plausible's unique
// visitor counting, device reports and geo stay accurate.
function pageview(req) {
  if (!isEnabled()) return;
  track('pageview', {
    url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    referrer: req.get('referer') || undefined,
    userAgent: req.get('user-agent'),
    ip: req.ip,
  });
}

// A custom goal (Signup, Lead, ...) tied to the request that caused it, so
// Plausible can attribute the conversion to the same session as the pageviews.
function event(req, name, props) {
  if (!isEnabled()) return;
  track(name, {
    url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    referrer: req.get('referer') || undefined,
    userAgent: req.get('user-agent'),
    ip: req.ip,
    props,
  });
}

// A purchase is a conversion with a dollar value, so it carries revenue for
// Plausible's goal-revenue attribution. Called from the billing paths, where
// there is no request to forward.
function purchase(plan) {
  if (!isEnabled()) return;
  const amount = PLAN_AMOUNTS[plan];
  track('Purchase', {
    props: { plan },
    revenue: amount ? { currency: 'USD', amount: String(amount) } : undefined,
  });
}

module.exports = { isEnabled, track, pageview, event, purchase };
