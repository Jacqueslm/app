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
const { signUnsubToken, signLeadUnsubToken } = require('./auth');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Jacques <jacques@turnsomedayintodayone.com>';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || 'turnsomedayintodayone@gmail.com';
const APP_URL = (process.env.APP_URL || 'https://www.turnsomedayintodayone.com').replace(/\/$/, '');
const DRY_RUN = process.env.EMAIL_DRY_RUN === '1';

function isConfigured() {
  return Boolean(RESEND_API_KEY);
}

// Every send funnels through here. Honoring `unsubscribed` lives at this
// choke point on purpose - no caller can forget it. The single exception is
// force:true, reserved for account access (password reset): opting out of
// emails must never lock someone out of their own account.
async function sendEmail({ to, subject, text, force }) {
  const addr = String(to).toLowerCase();
  const user = db.getUserByEmail(addr);
  if (user && user.unsubscribed && !force) {
    return { ok: false, skipped: 'unsubscribed' };
  }
  const lead = db.getLeadByEmail(addr);
  if (lead && lead.unsubscribed && !force) {
    return { ok: false, skipped: 'unsubscribed' };
  }
  if (DRY_RUN) {
    const lastLine = text.trimEnd().split('\n').pop();
    console.log(`[email dry-run] to=${to} subject="${subject}" (${text.length} chars) last-line="${lastLine}"`);
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
  // The unsubscribe footer is attached at send time, never stored in the copy:
  // marketing sequences (trial, future quiz nurture) get it; transactional
  // account mail does not.
  let outgoing = text;
  if (sequence !== 'transactional') {
    outgoing += `\n\nUnsubscribe: ${APP_URL}/unsubscribe?token=${signUnsubToken(user.id, user.email)}`;
  }
  const result = await sendEmail({ to: user.email, subject, text: outgoing });
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

If it happens this week, open the app and hit SOS - the breathing, the grounding, and "Talk me through it" are free and awake at that hour.

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

Days 16-90 of every track unlock - the whole 90-Day Bootcamp - plus Friendly, your AI companion (up to 30 chats a day), and the live rooms. The recovery tools stay free either way.
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

// ---- Quiz nurture sequence (copy VERBATIM from quiz-nurture-emails.md) -----
// Day 1 substitutes {result}; days 4-5 substitute {APP_URL}.

const QUIZ_EMAILS = [
  { step: 1, subject: 'Your result, and the one thing it actually means', text: `Jacques here. You took the check-in, so you're getting an email from me and not a robot.

Your result: {result}.

Here's what that actually means, stripped of anything fancy: the habit has a pattern, and now you've seen a piece of it on paper. Most men never get that far — they fight the fog instead of the pattern, lose, and call themselves weak. You just did the one thing willpower can't: you looked at it.

The single most useful thing you can do this week costs nothing. Pick your worst hour — for most of us it's late, alone, tired — and change ONE thing about it. Phone charges in the kitchen. Lights out at a decided time. A walk at the hour the walls usually close in. Don't fix your life. Move one domino.

That's it. That's day one.

Tomorrow I'll tell you about 2am — the hour that beat me for 38 years.

— Jacques` },
  { step: 2, subject: 'The 2am problem', text: `At noon you're fine. At noon you're a guy with a plan.

It's never noon when it happens. It's late, the house is quiet, and your head starts talking. And here's the part nobody tells you — it isn't a stupid argument. It's a good one. It's reasonable. It has evidence. You've been rehearsing it for years.

I lost to that argument for 38 years. Not because I was weak. Because I kept trying to out-think it live, at 2am, with the worst version of my brain in the driver's seat.

You cannot win that fight in real time. You can only win it in advance.

Tomorrow I'm going to give you the exact tool for that — the relapse plan. You'll write it on paper, in the daylight, and it'll be waiting for the 2am version of you like a note from someone smarter.

Tonight, just notice the hour your head gets loud. That's all. Name the hour.

— Jacques` },
  { step: 3, subject: 'Write this down before you need it', text: `Today you write the plan. Ten minutes, on paper, while you're clear-headed. This is the tool that finally worked for me, and I'm giving you the whole thing — no app required, no catch.

Grab a pen. Answer these five, in your own words:

1. MY TOP 3 TRIGGERS ARE:
   (The exact times, feelings, places. "Alone after 11pm." "After a fight." "Bored on Sunday afternoon.")

2. THE STORY MY HEAD TELLS ME AT THE WORST MOMENT IS:
   (Write the actual sentence. "One more time won't matter." "I've had a hard week, I deserve it." Seeing it in daylight takes half its power.)

3. WHEN THE URGE HITS, MY FIRST THREE MOVES ARE:
   (Physical, decided now: 1) Leave the room. 2) Cold water on my face. 3) Walk around the block. Motion first — argue later.)

4. THE PERSON I CAN TEXT, AND THE WORD I'LL SEND:
   (One safe person. One code word. Secrets are where this thing gets its power.)

5. IF I SLIP, I WILL:
   (Reset the same hour — not Monday. Ask "what was the trigger," not "what's wrong with me." The slip costs one day. The shame spiral costs thirty.)

Fold it. Put it in your wallet or your nightstand. That paper is now smarter than 2am you — and that's the whole trick.

The app does this with reminders and a panic button, but the paper version works. Start with the paper.

— Jacques` },
  { step: 4, subject: "If there's someone else in the house", text: `This one you might not read for yourself. That's fine. It might be one to forward.

For 38 years, my addiction made everything about me. My struggle, my shame, my progress, my slips. And the person lying next to me — worrying, wondering, doing quiet math about what was real — got erased. Nobody asked how she was doing. Nobody built anything for her.

If you're the one struggling: the person who loves you is carrying this too, even when they don't say it. You don't have to have the whole conversation today. But know there's something built for them when it's time.

If this email was forwarded to you — if you're the one on the other side of this: you're not crazy, and you're not the only one awake right now. Your emotions are valid. Supporting someone doesn't mean losing yourself. There's a section built just for you — not about them, FOR you:

{APP_URL}/for-her

Whichever side of this you're on, it counts.

— Jacques` },
  { step: 5, subject: '38 years', text: `I'll keep this one honest and then I'll leave you alone.

I was addicted for 38 years. Porn. Food. Anger. Not one habit — a rotation, each one covering for the others. I made the Sunday promise a thousand times. Broke it by Tuesday a thousand times. I got very good at hiding, and very good at hating myself quietly, and I called that "managing it."

At 50 it was do or die. Not a slogan — an actual fork. I looked at the next thirty years and saw the same fog, just older. And something in me said: someday is a real place, and it's crowded, and nobody there is happy.

So I chose day one. And it held. Not because I found more willpower — because I finally stopped fighting at 2am and started winning at 2pm. The plan on paper. The named triggers. The one safe person. Everything I've sent you this week.

Then I built all of it into an app, because paper doesn't ping you at your worst hour and paper can't talk back at 2am.

Turn Someday Into Day One. A private AI companion for the hour your head gets loud — your 2am conversations are never saved. A relapse plan with a panic button. A day counter that doesn't shame you when you reset. And a section for the partner that no other app has.

The check-in you took is the front door. The free tier is real. Pro is $9.99 a month with 7 days free, and I email you before anything is ever charged.

{APP_URL}

Whatever you decide, you have the tools now. The plan works on paper too — I'd rather you free than subscribed.

Day one is a decision, not a date.

— Jacques` },
];

// The lead-magnet delivery mail (subject and body approved by Jacques).
// It carries an unsubscribe link like everything else that goes to a lead: a
// for-her lead is promised exactly one email and never enters a sequence, so
// this is the only message she ever gets - and it was the only one with no way
// out of the list at the bottom of it.
function brainresetPdfEmail(lead) {
  let text = `Here it is — the whole 90-day map in five pages. Read section 06 before you need it.

${APP_URL}/The90DayBrainReset.pdf

— Jacques`;
  if (lead && lead.id && lead.email) {
    text += `\n\nUnsubscribe: ${APP_URL}/unsubscribe?token=${signLeadUnsubToken(lead.id, lead.email)}`;
  }
  return { subject: 'The 90-Day Brain Reset (your PDF)', text };
}

// Same contract as sendSequenceEmail, but for leads: guard keys on the email
// address, the unsubscribe footer carries a lead token, log rows carry no user id.
async function sendLeadSequenceEmail(lead, sequence, step, subject, text) {
  if (db.hasEmailBeenSentToAddress(lead.email, sequence, step)) {
    return { ok: false, skipped: 'already-sent' };
  }
  const outgoing = text + `\n\nUnsubscribe: ${APP_URL}/unsubscribe?token=${signLeadUnsubToken(lead.id, lead.email)}`;
  const result = await sendEmail({ to: lead.email, subject, text: outgoing });
  if (result.ok) {
    db.logEmailSent(null, lead.email, sequence, step);
  }
  return result;
}

// ---- Partner sequence (written 12 Aug 2026, wired 13 Aug) -----------------
// Five emails for the person who LOVES somebody with a habit - never the
// person with the habit. It exists because every other sequence here is
// written in Jacques's voice TO the one struggling, and would land badly on a
// wife who just took the codependency check-in at midnight.
// The rules these follow, and which must survive any rewrite:
//   - no day counting, no relapse talk, no quitting advice; she isn't quitting
//   - never tells her to leave, and never tells her to stay. That is her call
//   - never asks her to manage him. His recovery is not her job
//   - Jacques's angle is the one nobody else has: he was the one with the
//     secret for 38 years, so he can say what was behind the behaviour
const PARTNER_EMAILS = [
  { step: 1, subject: "You're not imagining it", text: `Jacques here. I built this thing, so you get an email from me and not a robot.

I'm going to start with the thing nobody said to you: you're not imagining it, and you're not dramatic, and you're not "reading into things."

I know that because I was the one being read. For thirty-eight years I was the person with the secret in the house. And every single time somebody close to me noticed something was off, they were right. Every time. Not once was anybody wrong about me - they just couldn't prove it, and I was very good at making them feel unreasonable for asking.

So if you've been told you're paranoid, or too sensitive, or that you're making something out of nothing - I'd trust what you noticed over what you were told about noticing it.

That's all for today. Tomorrow I'll tell you the one thing that changed everything for the people around me, and it isn't what you'd expect.

- Jacques
{APP_URL}` },
  { step: 2, subject: 'Two jobs, and you only ever had one', text: `There are two jobs in your house.

One is his: stopping, and staying stopped, and dealing with whatever the drink or the phone or the betting was covering up. The other is yours: sleeping, eating, seeing your friends, being someone other than the person who manages him.

Almost everybody in your position quietly takes on both. It's not weakness - it's what happens when somebody has to keep the household upright and nobody else is going to. But here's the thing I watched from the other side: me not getting better was never once caused by somebody not managing me well enough. Nobody talked me into it and nobody could have. The people who tried the hardest just got the most worn out.

Your healing does not have to wait in a queue behind his.

That's not permission to stop caring. It's permission to stop carrying the half that was never yours.

- Jacques
{APP_URL}` },
  { step: 3, subject: 'The ten minutes when you want to check his phone', text: `You know the ten minutes. He's in the shower, or asleep, or out, and the phone is right there, and you hate that you want to look and you're going to look anyway.

I'm not going to tell you not to. Checking is not a character flaw - it's what a person does when they've been lied to and their own judgment stopped feeling reliable. That's the real injury, by the way. Not the drinking. The fact that you can't trust your own read on your own life anymore.

Here's what I'd say instead. Whatever you find, you already know. You've known for a while. Checking doesn't give you information - it gives you thirty seconds of certainty and then a worse night.

So: when the ten minutes come, write it down instead. In the app, in a notebook, in your phone's notes. There's a journal in there that nobody else can open, and it's free. Put the 2am sentence somewhere other than around and around your own head.

It won't fix anything tonight. It'll give you back one night.

- Jacques
{APP_URL}` },
  { step: 4, subject: 'A promise and a change look identical from the outside', text: `This is the one I owe you an honest answer on, because I made a lot of promises and meant every single one of them.

That's what nobody tells you. They aren't lies at the moment they're said. At 9am I completely intended it. By 6pm I was a different set of priorities with the same face. Which is why "he promised" and "he lied to me" both feel true - they are both true, and living inside that contradiction is exhausting.

So here's the only thing I know that separates a promise from a change, and it's not what he says:

A promise is about the future. A change shows up in the boring middle of an ordinary week. Not a grand declaration after a bad night - the Tuesday. Did anything about the Tuesday get different? That's the whole test. It takes weeks to read, it can't be rushed, and it's the only honest measure there is.

You don't have to decide anything based on it. Just stop grading him on the apologies. They were never the evidence.

- Jacques
{APP_URL}` },
  { step: 5, subject: "One thing this week that's yours", text: `Last one, then I'll leave you alone.

I want you to do one thing this week that has nothing to do with him. Not a grand gesture. One hour, one coffee, one walk, one phone call to the friend you've been too tired to ring back.

I'm asking because of something I saw and can't unsee. The people around me disappeared slowly. Not in a dramatic way - they just stopped having answers to "what have you been up to?", because the answer was him, for years. By the time I finally stopped, some of them had no idea what they even liked anymore. That was mine too. That was on my account.

Don't let that be yours.

The app's free and there's a section built for your side of it - not monitoring tools, not couples homework. Yours. Use it, don't use it, that's genuinely fine. But do the one hour.

You've been the reliable one for a long time. Somebody should be telling you to put it down for an afternoon, so it may as well be me.

- Jacques
{APP_URL}` },
];

function partnerEmailFor(step) {
  const e = PARTNER_EMAILS.find((x) => x.step === step);
  if (!e) return null;
  return { subject: e.subject, text: e.text.split('{APP_URL}').join(APP_URL) };
}

function quizEmailFor(step, lead) {
  const e = QUIZ_EMAILS.find((x) => x.step === step);
  if (!e) return null;
  const text = e.text
    .replace('{result}', lead.quiz_result || 'your check-in result')
    .split('{APP_URL}').join(APP_URL);
  return { subject: e.subject, text };
}

// Fired at capture time so day 1 lands while the quiz is still open in their
// other tab. The guard makes any later scheduler pass a no-op.
async function startQuizNurture(lead) {
  const e = quizEmailFor(1, lead);
  return sendLeadSequenceEmail(lead, 'quiz', 1, e.subject, e.text);
}

async function startPartnerNurture(lead) {
  const e = partnerEmailFor(1);
  return sendLeadSequenceEmail(lead, 'partner', 1, e.subject, e.text);
}

// Hourly runner: step N sends only while the lead is actually on day N-1
// (created day counts as day 0), same skip-if-down policy as the trial.
// Brainreset leads had step 1 pre-marked consumed at signup, so they start
// at step 2 with no special casing here.
async function runQuizNurture() {
  for (const lead of db.getLeadsInNurtureWindow()) {
    // The sequence is written in the voice of the man doing the work. Partner
    // leads (source 'for-her') asked for one PDF, not his emails - and any
    // future source is excluded until a sequence is written for it.
    //
    // KEEP THIS LIST IN STEP WITH /api/lead's `isSelfQuiz`. Day 1 is sent
    // directly at signup and days 2-5 only ever come from this loop, so a
    // self-facing source that is missing here does not fail loudly - it
    // delivers exactly one of the five emails the page promised and stops.
    // 'binge-quiz' was added 28 Aug for that reason.
    const NURTURE_SOURCES = ['quiz', 'binge-quiz', 'brainreset'];
    if (lead.source && !NURTURE_SOURCES.includes(lead.source)) continue;
    const day = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000);
    const step = day + 1;
    if (step < 1 || step > 5) continue;
    const e = quizEmailFor(step, lead);
    if (e) await sendLeadSequenceEmail(lead, 'quiz', step, e.subject, e.text);
  }
}

// The partner side. Same one-a-day cadence as the quiz nurture, but a separate
// sequence name so email_log can never confuse the two - and so a person who
// somehow appears on both lists still gets each one exactly once.
async function runPartnerNurture() {
  for (const lead of db.getLeadsInNurtureWindow()) {
    if (lead.source !== 'partner') continue;
    const day = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000);
    const step = day + 1;
    if (step < 1 || step > 5) continue;
    const e = partnerEmailFor(step);
    if (e) await sendLeadSequenceEmail(lead, 'partner', step, e.subject, e.text);
  }
}

// ---- Win-back (13 Aug 2026) ------------------------------------------------
// The gap this closes: somebody slips, stops opening the app out of shame, and
// hears nothing from us ever again. That is the exact moment the whole product
// is FOR, and it was the one moment with no email attached to it.
//
// Rules, because this one can do harm if it gets them wrong:
//   - it is never disappointed, and it never mentions a broken streak
//   - it never asks why they stopped
//   - it goes out ONCE. If it doesn't land, that's the answer, and a second
//     nudge to somebody in shame is just pressure
//   - a person who reset and came back is active, so the quiet window is
//     measured from their last activity, not from their start date
const WINBACK_EMAILS = [
  { step: 1, subject: 'Day one is still there', text: `It's Jacques. You haven't been in for a couple of weeks, and I'm not writing to ask why.

I stopped and started more times than I could count over thirty-eight years, and the thing that kept me away longest was never the drink. It was the feeling of having to explain myself to somebody before I could start again.

So: no explanation needed here. Nothing expired. Your account is exactly where you left it, and the counter starts whenever you say it does - today, next week, or a year from now.

If you want the smallest possible step, open the app and do one lesson. Not a plan, not a commitment. One lesson, then close it.

And if you're not ready, that's genuinely all right. This email is the only one you'll get about it - I'm not going to chase you. But the door doesn't lock.

- Jacques
{APP_URL}/app

If you'd rather not hear from me again, the unsubscribe link is below and I won't take it personally.` },
];

function winbackEmailFor(step) {
  const e = WINBACK_EMAILS.find((x) => x.step === step);
  if (!e) return null;
  return { subject: e.subject, text: e.text.split('{APP_URL}').join(APP_URL) };
}

// Quiet for 14+ days, but with a real history behind them (someone who signed
// up and never started has nothing to come back TO - they get the trial
// sequence instead, and a win-back would just be a second cold pitch).
const WINBACK_QUIET_DAYS = 14;
const WINBACK_MAX_QUIET_DAYS = 120; // beyond this it reads as a cold email, not a welcome back

async function runWinbackSequence() {
  let rows = [];
  try { rows = db.getUsersWithState(); } catch (_) { return; }
  for (const row of rows) {
    let st = null;
    try { st = JSON.parse(row.state_json); } catch (_) { continue; }
    if (!st || !st.startDate) continue;
    if (st.remindersEnabled === false) continue; // they asked for quiet; honour it here too
    const log = Array.isArray(st.activityLog) ? st.activityLog : [];
    if (!log.length) continue;
    const last = log.reduce((m, a) => {
      const t = a && a.ts ? new Date(a.ts).getTime() : 0;
      return t > m ? t : m;
    }, 0);
    if (!last) continue;
    const quietDays = Math.floor((Date.now() - last) / 86400000);
    if (quietDays < WINBACK_QUIET_DAYS || quietDays > WINBACK_MAX_QUIET_DAYS) continue;
    const e = winbackEmailFor(1);
    // sendSequenceEmail's email_log guard makes this send-once by construction.
    await sendSequenceEmail({ id: row.id, email: row.email }, 'winback', 1, e.subject, e.text);
  }
}

// ---- Review ask (16 Aug 2026) --------------------------------------------
// Closes the trust gap named in REVENUE-PLAN.md: the /reviews page exists but
// stays empty until real people say something, and a recovery app converts on
// proof. Sent ONCE around day 30 to people who actually used the app.
// Rules: never pressure, never reward, never invent anything. If it didn't
// help, the copy says the right move is to not leave one.
const REVIEW_EMAIL = {
  subject: '30 days — one honest line, if you have one',
  text: `Jacques here. You've been in for about a month now, and I've got one ask — and it isn't money.

If the app has done anything for you — a hard night it got you through, a morning it made easier — would you leave one sentence where people can see it?

${APP_URL}/reviews

There aren't many there yet. That's on purpose. I don't fake reviews, so the page says so until real people write them. One line from you is worth more than any ad I could buy.

If it hasn't helped, don't leave one. You don't owe me a review for trying. But if it has, that sentence is how the next person at 2am finds it.

— Jacques`,
};

const REVIEW_DAY = 30;
const REVIEW_END_DAY = 60; // a server down for a while shouldn't cost anyone the ask

async function runReviewAskSequence() {
  let rows = [];
  try { rows = db.getUsersWithState(); } catch (_) { return; }
  for (const row of rows) {
    let st = null;
    try { st = JSON.parse(row.state_json); } catch (_) { continue; }
    if (!st || !st.startDate) continue;
    if (st.remindersEnabled === false) continue; // they asked for quiet
    const log = Array.isArray(st.activityLog) ? st.activityLog : [];
    if (!log.length) continue; // never really used it — nothing honest to review
    const day = Math.floor((Date.now() - new Date(st.startDate).getTime()) / 86400000);
    if (day < REVIEW_DAY || day > REVIEW_END_DAY) continue;
    await sendSequenceEmail({ id: row.id, email: row.email }, 'review', 1, REVIEW_EMAIL.subject, REVIEW_EMAIL.text);
  }
}

// Hourly scheduler. Task 5 ships the machinery; Tasks 6/7 register their
// sequences. Each runner must use the guarded senders so email_log applies.
const SEQUENCE_RUNNERS = [runTrialSequence, runQuizNurture, runPartnerNurture, runWinbackSequence, runReviewAskSequence];

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
  startQuizNurture,
  runQuizNurture,
  startPartnerNurture,
  runPartnerNurture,
  runWinbackSequence,
  runReviewAskSequence,
  brainresetPdfEmail,
  sendLeadSequenceEmail,
  runScheduledEmails,
  startScheduler,
  SEQUENCE_RUNNERS,
};
