// Email sending via Resend's REST API - plain text only, no HTML templates.
// "It should look like a man wrote it on his phone, because that's the whole
// brand." (email-sequences.md)
//
// ─── THE MARKETING SEQUENCES WENT, 5 OCT 2026 ────────────────────────────────
// This file used to carry four things beyond the two below: a five-day quiz
// nurture, a five-day sequence for the partner, a win-back email for somebody
// who had gone quiet, and an hourly scheduler that walked every lead and every
// account to decide who was due one. All of it was written to sell the app, and
// all of it was addressed to strangers who had handed an address to a landing
// page. There are no landing pages and no addresses now. What is left is the
// two messages that are about the account itself, which nobody opted into and
// which nobody can opt out of.
//
// Env:
//   RESEND_API_KEY   - required for real sends; missing = emails silently skip
//   EMAIL_FROM       - e.g. "Jacques <jacques@turnsomedayintodayone.com>"
//   EMAIL_REPLY_TO   - where replies land; defaults to the business Gmail
//   APP_URL          - absolute base URL used in links
//   EMAIL_DRY_RUN=1  - treat sends as successful without calling Resend (tests)
const db = require('./db');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Jacques <jacques@turnsomedayintodayone.com>';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || 'turnsomedayintodayone@gmail.com';
const APP_URL = (process.env.APP_URL || 'https://www.turnsomedayintodayone.com').replace(/\/$/, '');
const DRY_RUN = process.env.EMAIL_DRY_RUN === '1';

function isConfigured() {
  return Boolean(RESEND_API_KEY);
}

// Every send funnels through here, and there is no longer an opt-out to honour:
// the only two messages left are an account's own welcome and its own password
// reset, and opting out of those is not a thing. `force` survives because the
// reset path passes it and the call reads better than a missing argument.
async function sendEmail({ to, subject, text, force, attachments }) {
  if (DRY_RUN) {
    const lastLine = text.trimEnd().split('\n').pop();
    const att = attachments && attachments.length ? ` +${attachments.length} attachment(s)` : '';
    console.log(`[email dry-run] to=${to} subject="${subject}" (${text.length} chars)${att} last-line="${lastLine}"`);
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
        reply_to: EMAIL_REPLY_TO,
        subject,
        text,
        // Only the database backup uses this. Resend takes base64 content.
        ...(attachments && attachments.length ? { attachments } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[email] Resend ${res.status} for "${subject}" to ${to}: ${body.slice(0, 300)}`);
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (err) {
    console.error(`[email] network error for "${subject}" to ${to}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// Guarded send for anything that must happen at most once per (user, sequence,
// step). Logging happens only after a successful send, so a failed attempt is
// retried on the next call while a restart can never produce duplicates.
//
// No unsubscribe footer is appended any more: the footer pointed at a
// /unsubscribe route that no longer exists, and both messages left are
// transactional - one is the welcome that says who is writing, the other is the
// only way back into a locked account.
async function sendSequenceEmail(user, sequence, step, subject, text) {
  if (db.hasEmailBeenSent(user.id, sequence, step)) {
    return { ok: false, skipped: 'already-sent' };
  }
  const result = await sendEmail({ to: user.email, subject, text });
  if (result.ok) {
    db.logEmailSent(user.id, user.email, sequence, step);
  }
  return result;
}

// ---- Transactional copy (approved by Jacques, 2026-07-26) ------------------

function welcomeEmail() {
  return {
    subject: "You're in. One thing before anything else.",
    text: `Jacques here. I built this thing, so you're getting an email from me and not a robot.

You're on the free plan — the check-in, the day counter, and your first lesson pack are yours, no card, no clock.

One piece of advice before you explore: don't try to do the whole app today. Open it, set your day one, and read the first lesson. That's the whole assignment.

And if you haven't taken the 2-minute check-in yet, start there — it's how the app learns what you're actually up against.

Reply to this email whenever you want. I read them. It's just me here.

— Jacques`,
  };
}

function passwordResetEmail(token) {
  return {
    subject: 'Reset your password',
    text: `Someone asked to reset the password for this account. If it was you, tap the link below — it works once and expires in an hour.

${APP_URL}/reset.html?token=${token}

If it wasn't you, ignore this and nothing changes.

— Turn Someday Into Day One`,
  };
}

module.exports = {
  isConfigured,
  sendEmail,
  sendSequenceEmail,
  welcomeEmail,
  passwordResetEmail,
};
