// /api/mucus-plan — the seven-day plan, written by Gemini from the mucus scale
// and the two Afrika books. The private page is /herbs, on its Mucus scale tab.
//
// WHY THIS IS ITS OWN FILE
// Same reason as key-reading-route.js: the page at /herbs is private, so the
// endpoint the page calls has to check the same door for itself, and a test
// should be able to say so without booting server.js. It mounts above the
// global parsers in server.js, so it attaches its own cookieParser and
// express.json — without them req.cookies is undefined and every request fails
// the gate, which looks private and is broken.
//
// WHAT IT MUST NEVER DO
//   1. Answer anybody who is not signed in AND on the allowlist.
//   2. Put the Gemini key in a response, a URL or a log line.
//   3. Send the person's answers anywhere except Google's generateContent
//      endpoint for this one request. Nothing is stored here.

const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { requireAuth } = require('./auth');
const mucusPlan = require('./mucus-plan');

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down a moment — a plan is a big answer. Give it a few minutes.' },
});

const BUSY_STATUSES = new Set([429, 503]);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function mount(app, deps) {
  const { isFriendlyRequest, gemini, ownerEmail } = deps || {};
  const key = (gemini && gemini.key) || '';
  const model = (gemini && gemini.model) || 'gemini-3.6-flash';
  const maxTokens = (gemini && gemini.maxTokens) || 5000;
  const thinkingLevel = (gemini && gemini.thinkingLevel) || 'LOW';
  const busyRetries = Number(gemini && gemini.busyRetries) || 2;
  const ownerEmailOf = typeof ownerEmail === 'function' ? ownerEmail : () => ownerEmail;
  const isOwner = (userId) => {
    try {
      const u = db.getUserById(userId);
      const owner = ownerEmailOf();
      return !!(owner && u && u.email === owner);
    } catch (_) { return false; }
  };

  async function ask(answers, jsonMode, thinking) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': key };
    const body = mucusPlan.requestBody({ answers, model, maxTokens, thinkingLevel, jsonMode, thinking });
    let r = await fetch(url, { method: 'POST', headers, body });
    // Google's "high demand" no is a queue, not a verdict. Two more asks, a
    // second apart, is the same patience the other AI routes use.
    for (let n = 0; n < busyRetries && BUSY_STATUSES.has(r.status); n += 1) {
      await sleep(1000 * (n + 1));
      r = await fetch(url, { method: 'POST', headers, body });
    }
    return r;
  }

  app.post('/api/mucus-plan',
    cookieParser(), express.json({ limit: '128kb' }), limiter, requireAuth,
    async (req, res) => {
      if (!isFriendlyRequest(req)) {
        return res.status(403).json({ error: 'Not available on this account.' });
      }
      if (!key) {
        const why = 'No GEMINI_API_KEY on the server, so a mucus plan cannot be written.';
        try { db.logError('mucus-plan', why); } catch (_) {}
        const body = { error: 'The plan cannot be written right now.' };
        if (isOwner(req.userId)) body.ownerError = why;
        return res.status(503).json(body);
      }

      const answers = mucusPlan.answersFrom(req.body);
      if (!mucusPlan.complete(answers)) {
        return res.status(400).json({
          error: 'Answer the goal, age, gender, race and health question first.',
        });
      }

      try {
        // First ask for JSON mode, which is the reliable way to get a parseable
        // object. A 400 here is the same trap the chat route has met: a model
        // or an API surface that rejects an optional generation field with a
        // bare "invalid argument". Ask again without the optional parts rather
        // than handing the person an error nobody can act on.
        let r = await ask(answers, true, true);
        if (r.status === 400) r = await ask(answers, false, true);
        if (r.status === 400) r = await ask(answers, false, false);
        const data = await r.json().catch(() => null);

        if (!r.ok) {
          const e = (data && data.error) || null;
          const detail = e && e.details ? ` | ${JSON.stringify(e.details).slice(0, 400)}` : '';
          const why = `HTTP ${r.status}: ${(e && (e.message || e.status)) || 'unknown error'}${detail}`;
          try { db.logError('mucus-plan', why); } catch (_) {}
          const body = { error: 'The plan could not be written just now. Try again in a moment.' };
          if (isOwner(req.userId)) body.ownerError = why;
          return res.status(502).json(body);
        }

        const cand = (data && data.candidates && data.candidates[0]) || null;
        const text = ((cand && cand.content && cand.content.parts) || [])
          .map((p) => p.text || '').join('').trim();
        if (!text) {
          const finish = (cand && cand.finishReason)
            || (data && data.promptFeedback && data.promptFeedback.blockReason)
            || 'no reason given';
          const why = `Gemini returned an empty plan (finishReason: ${finish}).`;
          try { db.logError('mucus-plan', why); } catch (_) {}
          const body = { error: 'The plan came back empty. Try again in a moment.' };
          if (isOwner(req.userId)) body.ownerError = why;
          return res.status(502).json(body);
        }

        const plan = mucusPlan.parsePlan(text);
        if (!plan) {
          const why = 'Gemini returned a plan that could not be read as JSON.';
          try { db.logError('mucus-plan', why); } catch (_) {}
          const body = { error: 'The plan came back unreadable. Try again.' };
          if (isOwner(req.userId)) body.ownerError = why;
          return res.status(502).json(body);
        }

        res.json({ plan, model });
      } catch (err) {
        try { db.logError('mucus-plan', 'Failed to reach Gemini', err && err.message); } catch (_) {}
        const body = { error: 'The plan could not be written just now. Try again in a moment.' };
        if (isOwner(req.userId)) body.ownerError = `Could not reach Google: ${(err && err.message) || 'unknown error'}`;
        res.status(502).json(body);
      }
    });
}

module.exports = { mount };
