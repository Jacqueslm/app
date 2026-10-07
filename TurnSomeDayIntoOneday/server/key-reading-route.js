// /api/key-reading — The Key, read by Gemini. The private page is at /key
// (key.html); this is the only thing in it that leaves the phone.
//
// WHY THIS IS ITS OWN FILE
// server.js is 1500 lines and reaches its AI code at the very end. This route
// has to be testable on its own — the gate is a privacy boundary, so a test
// should be able to say "this refuses anyone not on the allowlist" without
// booting the whole server — so it is mounted from near the top of server.js
// and everything it needs is passed in.
//
// The two things it must never do:
//   1. Answer anybody who is not signed in AND on the allowlist. The page is
//      private to two accounts, so the endpoint has to be too. The allowlist
//      function is passed in rather than copied, so there is exactly one copy
//      of that rule in the app.
//   2. Leak the key. The Gemini key is read on the server and sent to Google
//      in a header; it is never put in a response, a URL or a log line.
//
// Ordering note: this mounts ABOVE the global express.json() and cookieParser()
// in server.js, so the route attaches its own. Without that, req.cookies is
// undefined and every request would fail the gate — which would look like
// "private" while actually being "broken for everyone".

const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { requireAuth } = require('./auth');
const keyReading = require('./key-reading');

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down a moment — give it a minute between readings.' },
});

function mount(app, deps) {
  const { isFriendlyRequest, gemini, ownerEmail } = deps || {};
  const key = (gemini && gemini.key) || '';
  const model = (gemini && gemini.model) || 'gemini-3.6-flash';
  const maxTokens = (gemini && gemini.maxTokens) || 6000;
  const thinkingLevel = (gemini && gemini.thinkingLevel) || 'MEDIUM';
  // Passed as a function because APP_OWNER_EMAIL is read further down
  // server.js than this mounts, so the value is not there yet at load time.
  const ownerEmailOf = typeof ownerEmail === 'function' ? ownerEmail : () => ownerEmail;
  const isOwner = (userId) => {
    try {
      const u = db.getUserById(userId);
      const owner = ownerEmailOf();
      return !!(owner && u && u.email === owner);
    } catch (_) { return false; }
  };

  app.post('/api/key-reading',
    cookieParser(), express.json({ limit: '1mb' }), limiter, requireAuth,
    async (req, res) => {
      // Signed in (requireAuth) AND allowed (the same function that opens the
      // page and /api/chat). Checked here rather than in the browser, so calling
      // the endpoint directly gets you nothing.
      if (!isFriendlyRequest(req)) {
        return res.status(403).json({ error: 'Not available on this account.' });
      }
      if (!key) {
        const why = 'No GEMINI_API_KEY on the server, so The Key cannot be read by Gemini.';
        try { db.logError('key-reading', why); } catch (_) {}
        const body = { error: 'The reading cannot be written right now.' };
        if (isOwner(req.userId)) body.ownerError = why;
        return res.status(503).json(body);
      }

      const input = keyReading.clipInput(req.body);
      // The page builds the message; the server only checks that something came
      // with it. An empty body is a 400, not a wasted call to Google.
      if (!input.message) {
        return res.status(400).json({ error: 'Nothing has been answered yet.' });
      }

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const payload = (withThinking) => JSON.stringify({
          systemInstruction: { parts: [{ text: keyReading.systemPrompt() }] },
          contents: [{ role: 'user', parts: [{ text: keyReading.userPrompt(input) }] }],
          generationConfig: Object.assign(
            { maxOutputTokens: maxTokens },
            // 2.x wants thinkingBudget, 3.x wants thinkingLevel and rejects the
            // other name with a bare 400 — the same trap that had Friendly
            // canned on 18 Aug. A reading is long and worth thought, so this
            // does NOT ask for the fast setting the chat uses.
            !withThinking ? {}
              : /^gemini-2\./.test(model) ? { thinkingConfig: { thinkingBudget: 0 } }
              : { thinkingConfig: { thinkingLevel } }
          ),
        });
        // Header, not ?key=, so the secret stays out of URLs, proxy logs and
        // error messages.
        const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': key };

        let r = await fetch(url, { method: 'POST', headers, body: payload(true) });
        if (r.status === 400) {
          const probe = await r.clone().json().catch(() => null);
          const msg = (probe && probe.error && probe.error.message) || 'no message';
          try { db.logError('key-reading', `400 with thinkingConfig, retrying without it: ${msg}`); } catch (_) {}
          r = await fetch(url, { method: 'POST', headers, body: payload(false) });
        }
        const data = await r.json();

        if (!r.ok) {
          const eobj = (data && data.error) || null;
          const why = `HTTP ${r.status}: ${(eobj && (eobj.message || eobj.status)) || 'unknown error'}`;
          try { db.logError('key-reading', why); } catch (_) {}
          const out = { error: 'The reading could not be written just now.' };
          if (isOwner(req.userId)) out.ownerError = why;
          return res.status(502).json(out);
        }

        const cand = (data.candidates && data.candidates[0]) || null;
        const parts = (cand && cand.content && cand.content.parts) || [];
        const text = parts.map((p) => p.text || '').join('').trim();
        if (!text) {
          // A 200 with no words in it is still a failure, and the kind that
          // hides. Report it rather than handing the page a blank block.
          const reason = (cand && cand.finishReason)
            || (data.promptFeedback && data.promptFeedback.blockReason)
            || 'no reason given';
          const why = `Gemini returned an empty reading (finishReason: ${reason}).`;
          try { db.logError('key-reading', why); } catch (_) {}
          const out = { error: 'The reading came back empty. Try again in a moment.' };
          if (isOwner(req.userId)) out.ownerError = why;
          return res.status(502).json(out);
        }

        // No chat quota is spent here: it is a reading, not a conversation, and
        // the page is private to two accounts.
        res.json({ text, model });
      } catch (err) {
        try { db.logError('key-reading', 'Failed to reach Gemini', err && err.message); } catch (_) {}
        res.status(502).json({ error: 'The reading could not be written just now.' });
      }
    });
}

module.exports = { mount };
