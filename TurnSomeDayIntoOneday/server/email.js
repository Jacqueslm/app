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

// ---- Trial sequence (copy VERBATIM from email-sequences.md) ----------------

const TRIAL_EMAILS = [
  { step: 0, subject: "You're in. Read this one thing first.", text: `Jacques here. I built this thing, so you're getting an email from me and not a robot.

Two housekeeping items, then the actual advice:

Your trial runs 7 days. I'll email you on day 5 to remind you before anything is charged. If you cancel before then you pay nothing, and I won't chase you about it.

Now the thing that matters. Don't try to do the whole app today. Do one thing:

Open the app and write your relapse plan.

Not lessons. Not the counter. The plan. It takes eleven minutes and it is the only part of this that works at 2am.

Write it now, while you're clear-headed and a little bit motivated, because that version of you is the only one who can. The 2am version of you can't write it — he can only read it.

— Jacques` },
  { step: 1, subject: 'Nobody quits at noon', text: `At noon you're fine. At noon you're a guy with a plan.

It's never noon when it happens. It's late, you're tired, the house is quiet, and your head starts talking. And here's the part people get wrong — it isn't a stupid argument. It's a good one. It's reasonable. You've been rehearsing it for years.

I lost to that argument for 38 years. Not because I was weak. Because I kept trying to out-think it live, at 2am, with the worst version of my brain in the driver's seat.

You cannot win that fight in real time. You can only win it in advance.

That's what the plan is for. If you didn't write yours yesterday, write it today. Eleven minutes.

— Jacques` },
  { step: 2, subject: "There's a section in there that isn't for you", text: `Something you probably haven't opened yet.

There's a whole section in the app built for your partner. Not about her — for her. Her own space.

Here's why I built it. When I was in it, I thought I was the one suffering. I was wrong. She'd been awake for years, being told she was overreacting, doing quiet math on whether to stay. Nobody built her anything. Every app in this space treats her like a bystander.

I'm not going to tell you when to show it to her. You know your marriage and I don't.

But it's there. And if you're ever going to have that conversation, having something to hand her is better than having nothing.

If you want to send it to her directly without her seeing the rest of your account: turnsomedayintodayone.com/for-her

— Jacques` },
  { step: 3, subject: "The reset button isn't failure", text: `Day 3 is usually where the first wobble shows up.

One thing I want to say before it does: resetting your counter is not starting over.

The old way — the way I did it for decades — a slip erased everything. Back to zero, back to worthless, and since I was back to zero anyway I might as well make it a bad week. That's not a relapse. That's a story about a relapse, and the story did more damage than the thing itself.

In this app you reset the number and you keep everything else. What you learned. What you noticed. The plan you wrote. Those don't go to zero, because they didn't.

If it happens this week, open Nova and say what happened. That's what it's there for at that hour.

— Jacques` },
  { step: 4, subject: '"I\'ve tried before"', text: `Someone emailed me this week: I've quit six times. Why would an app change that?

Fair. Here's my honest answer, and it's not a sales answer.

The app doesn't have willpower in it. There's no feature that makes you want it more. If you're waiting for a piece of software to make you want it, this isn't it and neither is anything else.

What it has is three things you probably didn't have on the previous six attempts:

A plan written before you needed it, by you, not by a stranger on a podcast.
Something to talk to at the hour when talking to a person isn't possible.
Someone else in the house who finally has language for what's happening.

Six failed attempts isn't evidence you can't. It's six times you tried without those.

— Jacques` },
  { step: 5, subject: 'Your trial ends in 2 days', text: `Told you I'd tell you, so here it is.

Two days left. On day 7 your card gets charged for whatever plan you picked. If you don't want that, cancel now — two clicks, inside the app, Settings → Billing. You keep the free tier and I won't email you about it again.

If you do want to keep it, don't do anything. It just continues.

One thought before you decide. Don't judge this on how you feel today. Feelings on day 5 are noise. Ask a flatter question:

Did I write the plan? Did I use it once? Is there anything here I'd miss?

If the answer's no across the board, cancel — with my blessing. You'd be right.

— Jacques

P.S. — If money is the actual issue, reply and say so. I've been broke. I'd rather you have it than not.` },
  { step: 6, subject: 'Last day', text: `Last day of your trial. Tomorrow it renews unless you cancel.

Nothing to sell you today. Just one thing.

At 50 I'd made the "I'll start Monday" promise so many times it had stopped meaning anything, even to me. Someday is a real place, and it's crowded, and nobody there is happy.

That's the whole name of the thing. Someday isn't a date. Day one is.

Whichever way you go tomorrow — cancel or stay — pick one on purpose instead of letting it happen to you. That's the actual skill.

— Jacques` },
];

const TRIAL_DAY7_CHARGED = { subject: "You're Pro. Here's what that means.", text: `Card went through, you're in properly, thank you. That money is what keeps this running and it's not lost on me that you chose to spend it here.

Three things:

Everything's unlocked. All 11 lesson packs, unlimited Nova, the full partner section.
Cancel any time, two clicks, no phone call, no retention trap.
Reply to this email whenever you want. I read them. It's still just me.

One ask — when something in here works, tell me what it was. Specifically. I'm using those to decide what to build next, and honestly, to keep going on the hard days.

— Jacques` };

const TRIAL_DAY7_CANCELLED = { subject: 'No hard feelings', text: `You cancelled, nothing was charged, and that's completely fine.

Your account stays open on the free tier. Day counter, the check-in, first lesson pack. It's yours as long as you want it, no expiry, no nagging.

If you're up for it, hit reply and tell me the one thing that was missing. One line is plenty. I'd rather hear it than guess.

And if you come back in six months, everything's still here.

— Jacques` };

function trialDay(user) {
  return Math.floor((Date.now() - new Date(user.trial_started_at).getTime()) / 86400000);
}

// Fired by billing the moment a trial begins (either activation path). The
// ('trial', 0) guard makes it safe for both paths to call.
async function startTrialSequence(user) {
  if (!user || !user.trial_started_at) return;
  const e = TRIAL_EMAILS[0];
  return sendSequenceEmail(user, 'trial', 0, e.subject, e.text);
}

// Hourly runner. Days 1-6 send only while the trial is actually on that day -
// if the server were down a full day, that day's email is skipped rather than
// dumping a stack of stale emails at once. Day 7 is the confirmation and may
// send late; charged and cancelled share one guard slot so exactly one of the
// two variants can ever go out.
async function runTrialSequence() {
  for (const user of db.getUsersInTrialWindow()) {
    const day = trialDay(user);
    if (day < 0) continue;
    const todays = TRIAL_EMAILS.find((e) => e.step === day);
    if (todays) {
      await sendSequenceEmail(user, 'trial', todays.step, todays.subject, todays.text);
    }
    if (day >= 7 && !db.hasEmailBeenSent(user.id, 'trial', 7)) {
      const charged = user.subscription_status === 'active';
      const cancelled = user.subscription_status === 'canceled'
        || (user.subscription_status === 'trialing' && user.cancel_at_period_end)
        || (user.plan === 'free' && user.subscription_status !== 'past_due');
      if (charged) {
        await sendSequenceEmail(user, 'trial', 7, TRIAL_DAY7_CHARGED.subject, TRIAL_DAY7_CHARGED.text);
      } else if (cancelled) {
        await sendSequenceEmail(user, 'trial', 7, TRIAL_DAY7_CANCELLED.subject, TRIAL_DAY7_CANCELLED.text);
      }
      // Still trialing with no cancel flag, or past_due: wait for the next tick.
    }
  }
}

// Hourly scheduler. Task 5 ships the machinery; Task 6 registers the trial
// sequence into SEQUENCE_RUNNERS. Each runner must use sendSequenceEmail so
// the email_log guard applies.
const SEQUENCE_RUNNERS = [runTrialSequence];

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
  startTrialSequence,
  runTrialSequence,
  runScheduledEmails,
  startScheduler,
  SEQUENCE_RUNNERS,
};
