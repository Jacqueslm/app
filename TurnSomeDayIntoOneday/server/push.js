// Web push: the only way a reminder reaches a phone with the app fully closed.
//
// Design notes that matter:
// - The VAPID keypair is generated on first boot and stored in app_settings, so
//   push works with no manual environment setup. Setting VAPID_PUBLIC_KEY /
//   VAPID_PRIVATE_KEY in the environment overrides that (useful if the database
//   is ever rebuilt and existing subscriptions must keep working - the keys are
//   what tie a subscription to this server).
// - Reminder times live in the user's own state blob, written by the client, so
//   the schedule the user set in the app is the schedule the server honors -
//   there is no second copy to drift out of sync.
// - Local time is derived from tzOffsetMinutes, which the client stamps on every
//   save. Without it a user is assumed to be on the server's clock, which is
//   wrong often enough that the reminder is simply skipped instead.
const webpush = require('web-push');
const db = require('./db');

const CONTACT = process.env.PUSH_CONTACT_EMAIL || 'mailto:support@turnsomedayintodayone.com';
let keys = null;

function getKeys() {
  if (keys) return keys;
  const envPub = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const envPriv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (envPub && envPriv) {
    keys = { publicKey: envPub, privateKey: envPriv };
  } else {
    let pub = db.getSetting('vapid_public');
    let priv = db.getSetting('vapid_private');
    if (!pub || !priv) {
      const generated = webpush.generateVAPIDKeys();
      pub = generated.publicKey;
      priv = generated.privateKey;
      db.setSetting('vapid_public', pub);
      db.setSetting('vapid_private', priv);
    }
    keys = { publicKey: pub, privateKey: priv };
  }
  webpush.setVapidDetails(CONTACT, keys.publicKey, keys.privateKey);
  return keys;
}

function publicKey() {
  return getKeys().publicKey;
}

// Sends to one stored subscription. Returns true only when the push service
// accepted it, so callers can record a real delivery rather than an attempt.
async function sendToSubscription(row, payload) {
  getKeys();
  const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    return true;
  } catch (err) {
    const code = err && err.statusCode;
    // 404/410: the browser install is gone. Anything else may be transient.
    if (code === 404 || code === 410) db.deletePushSubscription(row.endpoint);
    else db.bumpPushFailure(row.id);
    return false;
  }
}

async function sendToUser(userId, payload) {
  const rows = db.getPushSubscriptions(userId);
  let sent = 0;
  for (const row of rows) {
    if (await sendToSubscription(row, payload)) sent += 1;
  }
  return sent;
}

function parseState(userId) {
  try {
    const raw = db.getState(userId);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

// The user's wall-clock time, from the offset their client last reported.
// Date#getTimezoneOffset is minutes behind UTC, hence the sign flip.
function localNow(state) {
  const off = Number(state && state.tzOffsetMinutes);
  if (!Number.isFinite(off)) return null;
  return new Date(Date.now() - off * 60000);
}

function hourOf(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : fallback;
}

function didLessonOn(state, dateStr) {
  return (state.activityLog || []).some(
    (a) => a && a.type === 'lesson_completed' && new Date(a.ts).toDateString() === dateStr
  );
}

// Mirrors the client's own copy so the two can never disagree about what a
// reminder says; kept short because a notification body is truncated anyway.
function reminderPayload(state, missedYesterday) {
  const partner = state.userType === 'partner';
  if (missedYesterday) {
    return {
      title: 'Your lesson is waiting',
      body: "Yesterday's lesson is still there whenever you want it — nothing expired. Today's is ready too.",
    };
  }
  return {
    title: "Today's lesson is ready",
    body: partner
      ? "Whenever you're ready, today's lesson is here — built for the one carrying this."
      : 'A few minutes is all it takes. Today\'s lesson is ready whenever you are.',
  };
}

// Hourly pass. One reminder per device per day, fired in the hour the user
// chose, and only when today's lesson is still undone.
async function runPushReminders() {
  const rows = db.getAllPushSubscriptions();
  if (!rows.length) return;
  const byUser = new Map();
  for (const row of rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id).push(row);
  }
  for (const [userId, subs] of byUser) {
    const state = parseState(userId);
    if (!state) continue;
    if (state.remindersEnabled === false) continue;
    if (state.pushRemindersEnabled === false) continue;
    const now = localNow(state);
    if (!now) continue; // unknown timezone - never guess and wake someone at 3am
    const startHour = hourOf(state.reminderStartHour, 9);
    const endHour = hourOf(state.reminderEndHour, 21);
    const hour = now.getHours();
    // Fire at the start of their window; if the app was never opened that day
    // the last hour of the window gets one final, gentler nudge.
    const isStart = hour === startHour;
    const isLastCall = hour === (endHour === 0 ? 23 : endHour - 1) && endHour !== startHour;
    if (!isStart && !isLastCall) continue;
    const today = now.toDateString();
    if (didLessonOn(state, today)) continue;
    const yesterday = new Date(now.getTime() - 86400000).toDateString();
    // A brand-new account has nothing to be reminded about yet.
    if (!state.startDate) continue;
    const missedYesterday =
      !!(state.lessonsCompletedCount > 0) &&
      !didLessonOn(state, yesterday) &&
      new Date(state.startDate).toDateString() !== yesterday;
    const payload = { ...reminderPayload(state, missedYesterday && isStart), url: '/app', tag: 'daily-lesson' };
    for (const sub of subs) {
      if (sub.last_sent_date === today) continue;
      const ok = await sendToSubscription(sub, payload);
      if (ok) db.markPushSent(sub.id, today);
    }
  }
}

function startScheduler() {
  // Aligned to the top of each hour so a reminder set for 9am arrives at 9am
  // rather than at whatever minute the server happened to boot.
  const msToNextHour = 3600000 - (Date.now() % 3600000);
  setTimeout(() => {
    runPushReminders().catch((e) => {
      try { db.logError('push-scheduler', e.message, e.stack); } catch (_) {}
    });
    setInterval(() => {
      runPushReminders().catch((e) => {
        try { db.logError('push-scheduler', e.message, e.stack); } catch (_) {}
      });
    }, 3600000);
  }, msToNextHour + 5000);
}

module.exports = { publicKey, sendToUser, runPushReminders, startScheduler };
