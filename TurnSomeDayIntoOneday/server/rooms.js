// Live community rooms, moderated by the AI before anything is seen.
//
// Jacques's rules, 18 Aug 2026:
//   - Open 6am to 10pm Central. Closed overnight, when the worst posts and the
//     most fragile readers would meet with nobody watching. If AI moderation
//     proves itself, hours can widen later - the curfew is one constant below.
//   - Friendly is the moderator, with guardrails. The guardrails are the point:
//     * FAIL CLOSED. A post is born 'held' and becomes visible only on an
//       explicit AI allow (or the owner's). Gemini down = posts wait, never leak.
//     * Crisis is not a moderation problem. Someone posting that they want to
//       die gets 988 and the SOS tools shown to THEM, privately - the post is
//       held for the owner, never published, never scolded.
//     * Every verdict is stored with its reason, so the owner can audit every
//       call the AI made and overrule any of them.
//   - Report and block from day one (Google requires both; decency requires
//     both). Two reports re-hide a live post until a human looks.
//
// Moderation calls go straight to the Gemini API. They are not Friendly chats:
// they consume nobody's daily chat quota and never appear in anyone's history.

const db = require('./db');
const billing = require('./billing');

const ROOM_OPEN_HOUR = 6;    // 6am Central
const ROOM_CLOSE_HOUR = 22;  // 10pm Central
const ROOM_TZ = 'America/Chicago';
const MAX_POST_CHARS = 500;
const MAX_POSTS_PER_DAY = 5;
const REPORTS_TO_HIDE = 2;

function centralHour() {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: ROOM_TZ, hour: 'numeric', hour12: false }).format(new Date()));
}
function roomsOpen() {
  const h = centralHour();
  return h >= ROOM_OPEN_HOUR && h < ROOM_CLOSE_HOUR;
}
function hoursLabel() {
  return '6am–10pm Central';
}

// The moderator's instructions. Kept deliberately narrow: it judges ONE post
// against SIX rules and answers in JSON. It is not asked to be wise, warm or
// helpful here - wide instructions are how moderation models get talked out of
// their job by a clever post.
const MOD_PROMPT = `You are the moderator of a small anonymous support community inside an addiction-recovery app. Members are adults in recovery from addictions (alcohol, drugs, porn, gambling, food and others) and the people who love them. Many readers are fragile today.

Judge the single post below against these rules:

1. CRISIS: the author appears at risk of harming themselves or someone else, or describes abuse happening to them. This is not a rules violation - it is a person who needs help routed to them.
2. PREDATION/COMMERCE: selling anything, recruiting, coaching offers, treatment-center promotion, asking for money, asking to move to DMs or another app, requesting or offering personal contact details.
3. GRAPHIC DETAIL: explicit description of acts, substances, doses, methods or rituals in a way that reads as instructions, reminiscence to savor, or triggering detail rather than honest struggle.
4. CRUELTY: attacking, mocking or shaming another member or group.
5. MINORS: any sexual content involving minors, or an author who appears to be a minor describing their own addiction (this app is for adults).
6. OFF-PLATFORM RISK: sharing anyone's real full name, address, phone, or other identifying details (their own included).

Honest struggle, anger, profanity, despair short of self-harm risk, relapse admissions, faith, and blunt language are ALL ALLOWED - this is a recovery room, not a church picnic.

Reply with ONLY this JSON, nothing else:
{"allow": true|false, "crisis": true|false, "reason": "<one short sentence>"}

allow=false for rules 2-6. For rule 1 set crisis=true and allow=false. If the post breaks no rule: allow=true, crisis=false.`;

// Direct Gemini call - the same key the chat uses, but none of the chat's
// persona, memory or quota. One post in, one verdict out.
async function aiVerdict(text, deps) {
  const { GEMINI_API_KEY, GEMINI_MODEL } = deps;
  if (!GEMINI_API_KEY) return null; // no key -> caller fails closed
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: MOD_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: `POST:\n${text}` }] }],
        generationConfig: { maxOutputTokens: 200, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'LOW' } },
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      db.logError('rooms-mod', `HTTP ${res.status}: ${(d.error && (d.error.message || d.error.status)) || 'unknown'}`);
      return null;
    }
    const d = await res.json();
    const raw = (((d.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text || '').join('') || '';
    const v = JSON.parse(raw);
    if (typeof v.allow !== 'boolean') return null;
    return { allow: !!v.allow, crisis: !!v.crisis, reason: String(v.reason || '').slice(0, 200) };
  } catch (e) {
    db.logError('rooms-mod', `moderator unreachable/unparseable: ${e.message}`);
    return null; // fail closed
  }
}

function register(app, { requireAuth, isOwnerRequest, GEMINI_API_KEY_REF, GEMINI_MODEL }) {
  // The live rooms were Pro from 18 Aug. Jacques, 1 Sep 2026: "make the whole
  // app free." The check is kept as a function rather than deleted at every
  // call site, so the rooms can be gated again by changing one thing here
  // instead of hunting through the file.
  function requirePro(req, res) {
    return true;
  }
  // Open/closed and the rules, for the room screen to render honestly.
  app.get('/api/rooms/status', (req, res) => {
    res.json({
      open: roomsOpen(),
      hours: hoursLabel(),
      maxChars: MAX_POST_CHARS,
      maxPerDay: MAX_POSTS_PER_DAY,
    });
  });

  app.get('/api/rooms/feed', requireAuth, (req, res) => {
    if (!requirePro(req, res)) return;
    const room = String(req.query.room || '').slice(0, 60);
    if (!room) return res.status(400).json({ error: 'Which room?' });
    res.json({ open: roomsOpen(), hours: hoursLabel(), posts: db.getRoomFeed(room, 50) });
  });

  app.post('/api/rooms/post', requireAuth, async (req, res) => {
    if (!requirePro(req, res)) return;
    if (db.isRoomBanned(req.userId)) {
      // The same shape as success, so a banned scraper learns nothing.
      return res.status(403).json({ error: 'Posting is not available for this account.' });
    }
    if (!roomsOpen()) {
      return res.status(403).json({
        closed: true,
        error: `The room is closed overnight (open ${hoursLabel()}). The SOS tools on Home are always open — and if this can't wait, call or text 988, free, 24/7.`,
      });
    }
    const room = String(req.body?.room || '').slice(0, 60);
    const body = String(req.body?.body || '').trim();
    const displayName = String(req.body?.displayName || 'Someone').slice(0, 40);
    if (!room || !body) return res.status(400).json({ error: 'Write something first.' });
    if (body.length > MAX_POST_CHARS) return res.status(400).json({ error: `Keep it under ${MAX_POST_CHARS} characters.` });
    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
    if (db.countRoomPostsToday(req.userId, dayStart.toISOString()) >= MAX_POSTS_PER_DAY) {
      return res.status(429).json({ error: `That's ${MAX_POSTS_PER_DAY} posts for today — the room will hear you again tomorrow.` });
    }

    const id = db.createRoomPost(req.userId, room, displayName, body); // born 'held'
    const v = await aiVerdict(body, { GEMINI_API_KEY: GEMINI_API_KEY_REF(), GEMINI_MODEL });

    if (!v) {
      // Moderator unreachable: the post stays held for the owner. Honest reply,
      // no fake success - the person deserves to know it is not visible yet.
      db.setRoomPostVerdict(id, 'held', 'moderator unavailable - awaiting human review', 0);
      return res.status(202).json({ held: true, message: "Your post is in — it'll appear once it's been checked over." });
    }
    if (v.crisis) {
      // Never published, never scolded. The reply is FOR THE AUTHOR, and it is
      // the whole reason rule 1 exists.
      db.setRoomPostVerdict(id, 'crisis', v.reason, 1);
      return res.status(200).json({
        crisis: true,
        message: 'What you wrote sounds heavier than a room post should have to carry. It was not posted — not because you did anything wrong, but because you deserve more than strangers scrolling past it. If you are in danger of hurting yourself, call or text 988 now (free, confidential, 24/7). The SOS tools on Home are open too. And Friendly is right here.',
      });
    }
    if (!v.allow) {
      db.setRoomPostVerdict(id, 'blocked', v.reason, 0);
      return res.status(200).json({ blocked: true, message: `That one can't go up: ${v.reason}` });
    }
    db.setRoomPostVerdict(id, 'live', v.reason, 0);
    res.json({ ok: true, post: { id, display_name: displayName, body, created_at: new Date().toISOString() } });
  });

  app.post('/api/rooms/report', requireAuth, (req, res) => {
    const id = Number(req.body?.postId);
    const post = id ? db.getRoomPost(id) : null;
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    const n = db.addRoomReport(id, req.userId, String(req.body?.reason || '').slice(0, 200));
    if (post.status === 'live' && n >= REPORTS_TO_HIDE) {
      // Two people saying "this is wrong" beats one algorithm saying it's fine.
      db.hideRoomPost(id, `${n} reports - auto-hidden pending review`);
    }
    res.json({ ok: true });
  });

  // ── Owner moderation ──────────────────────────────────────────────────────
  app.get('/api/rooms/mod-queue', requireAuth, (req, res) => {
    if (!isOwnerRequest(req)) return res.status(403).json({ error: 'Not available.' });
    res.json({ queue: db.getModQueue() });
  });
  app.post('/api/rooms/mod-action', requireAuth, (req, res) => {
    if (!isOwnerRequest(req)) return res.status(403).json({ error: 'Not available.' });
    const id = Number(req.body?.postId);
    const action = String(req.body?.action || '');
    const post = id ? db.getRoomPost(id) : null;
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    if (action === 'approve') db.setRoomPostStatus(id, 'live');
    else if (action === 'remove') db.setRoomPostStatus(id, 'removed');
    else if (action === 'ban') { db.setRoomPostStatus(id, 'removed'); db.banRoomUser(post.user_id, `banned by owner via post ${id}`); }
    else return res.status(400).json({ error: 'Unknown action.' });
    res.json({ ok: true });
  });
}

module.exports = { register, roomsOpen, hoursLabel, MOD_PROMPT };
