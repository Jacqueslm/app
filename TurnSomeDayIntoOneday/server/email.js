// Email sending via Resend's REST API - plain text only, no HTML templates.
// "It should look like a man wrote it on his phone, because that's the whole
// brand." (email-sequences.md)
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

// Every send funnels through here. Honouring `unsubscribed` lives at this
// choke point on purpose - no caller can forget it. The single exception is
// force:true, reserved for account access (password reset): opting out of
// emails must never lock someone out of their own account.
async function sendEmail({ to, subject, text, force }) {
  const user = db.getUserByEmail(String(to).toLowerCase());
  if (user && user.unsubscribed && !force) {
    return { ok: false, skipped: 'unsubscribed' };
  }
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
        reply_to: EMAIL_REPLY_TO,
        subject,
        text,
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
// step) - the double-send protection from the spec. Logging happens only after
// a successful send, so a failed attempt is retried on the next scheduler tick
// while a restart mid-sequence can never produce duplicates.
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

// Hourly scheduler. Task 5 ships the machinery; Task 6 registers the trial
// sequence into SEQUENCE_RUNNERS. Each runner must use sendSequenceEmail so
// the email_log guard applies.
const SEQUENCE_RUNNERS = [];

async function runScheduledEmails() {
  for (const runner of SEQUENCE_RUNNERS) {
    try {
      await runner();
    } catch (err) {
      try { db.logError('email-scheduler', err.message, err.stack); } catch (_) {}
    }
  }
}

function startScheduler() {
  // Hourly per the spec, plus one pass shortly after boot so a restart never
  // delays a due send by a full hour.
  setTimeout(runScheduledEmails, 15 * 1000);
  setInterval(runScheduledEmails, 60 * 60 * 1000);
}

module.exports = {
  isConfigured,
  sendEmail,
  sendSequenceEmail,
  welcomeEmail,
  passwordResetEmail,
  runScheduledEmails,
  startScheduler,
  SEQUENCE_RUNNERS,
};
