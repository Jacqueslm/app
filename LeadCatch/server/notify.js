// "You have a new lead" email, sent through Resend's REST API.
//
// A small business owner is not sitting in a dashboard - the email is the
// product. So this is plain text, short, and puts the phone number and the
// message in the first three lines where a phone preview will show them.
//
// Env:
//   RESEND_API_KEY   - required for real sends; missing = log and skip
//   EMAIL_FROM       - e.g. "LeadCatch <leads@yourdomain.com>"
//   APP_URL          - absolute base URL used for the dashboard link
//   EMAIL_DRY_RUN=1  - pretend the send worked (tests, local dev)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'LeadCatch <onboarding@resend.dev>';
const APP_URL = (process.env.APP_URL || 'http://localhost:3100').replace(/\/$/, '');
const DRY_RUN = process.env.EMAIL_DRY_RUN === '1';

function isConfigured() {
  return Boolean(RESEND_API_KEY) || DRY_RUN;
}

async function sendEmail({ to, subject, text, replyTo }) {
  if (DRY_RUN) {
    console.log(`[email dry-run] to=${to} subject="${subject}" (${text.length} chars)`);
    return { ok: true, dryRun: true };
  }
  if (!RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY not set - skipping "${subject}" to ${to}`);
    return { ok: false, skipped: 'no-key' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        // Replying to the notification should reach the customer directly -
        // that is the fastest possible path from "lead arrives" to "contacted".
        reply_to: replyTo || undefined,
        subject,
        text,
      }),
    });
    if (!res.ok) {
      console.warn(`[email] Resend returned ${res.status}: ${await res.text()}`);
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (err) {
    console.warn(`[email] send failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

function newLeadEmail(form, lead) {
  const who = lead.name || lead.email || lead.phone || 'Someone';
  const lines = [`${who} just filled in "${form.name}".`, ''];
  if (lead.name) lines.push(`Name:  ${lead.name}`);
  if (lead.phone) lines.push(`Phone: ${lead.phone}`);
  if (lead.email) lines.push(`Email: ${lead.email}`);
  if (lead.message) lines.push('', lead.message);
  if (lead.extra) {
    for (const [label, value] of Object.entries(lead.extra)) lines.push(`${label}: ${value}`);
  }
  lines.push('', `Open your leads: ${APP_URL}/app`);
  if (lead.source_url) lines.push(`Came from: ${lead.source_url}`);
  return {
    subject: `New lead: ${who}`,
    text: lines.join('\n'),
  };
}

// Fired after the visitor already got their success response - a slow or broken
// mail provider must never make a customer's form look like it failed.
async function notifyNewLead(form, lead) {
  const to = form.notify_email;
  if (!to) return { ok: false, skipped: 'no-recipient' };
  const msg = newLeadEmail(form, lead);
  return sendEmail({ to, subject: msg.subject, text: msg.text, replyTo: lead.email || undefined });
}

module.exports = { isConfigured, sendEmail, newLeadEmail, notifyNewLead };
