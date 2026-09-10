// server.js — Your AI, a private chat assistant that knows Jacques's files.
//
// Runs only on this machine (binds 127.0.0.1) so nothing on the network can
// reach it. The API key stays in YourAI/.env, never uploaded anywhere.
//
// The AI call pattern is lifted from the recovery app's /api/chat
// (TurnSomeDayIntoOneday/server/server.js) — the same two providers, the same
// request shapes, the same Gemini 400-retry — because that code is already
// battle-tested in production against exactly these providers.

const express = require('express');
const fs = require('fs');
const path = require('path');
const { listDocs, loadDocs } = require('./docs.js');

// --- tiny .env loader (no dependency) -------------------------------------
function loadEnv(file) {
  const out = {};
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (_) {
    /* no .env yet — keys just stay unset */
  }
  return out;
}

const ENV = Object.assign({}, loadEnv(path.join(__dirname, '.env')), process.env);

const PORT = Number(ENV.PORT || 4410);
const HOST = '127.0.0.1'; // private: this machine only

// --- provider config -------------------------------------------------------
const ANTHROPIC_API_KEY = ENV.ANTHROPIC_API_KEY || '';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = ENV.ANTHROPIC_MODEL || 'claude-sonnet-5';
const ANTHROPIC_MAX_TOKENS = 2000;

const GEMINI_API_KEY = ENV.GEMINI_API_KEY || '';
// gemini-2.5-flash was retired to new callers (404 "use models/gemini-3.6-flash")
// — that is what had the app's chat canned once. Overridable by env.
const GEMINI_MODEL = ENV.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_MAX_TOKENS = Number(ENV.GEMINI_MAX_TOKENS || 4096);
const GEMINI_THINKING_LEVEL = ENV.GEMINI_THINKING_LEVEL || 'LOW';

// Whichever key is present wins. If both are set, Gemini wins only when
// GEMINI_FIRST=1; Claude stays the default because it writes better.
const GEMINI_FIRST = ENV.GEMINI_FIRST === '1';
function pickProvider() {
  if (GEMINI_FIRST && GEMINI_API_KEY) return 'gemini';
  if (ANTHROPIC_API_KEY) return 'anthropic';
  if (GEMINI_API_KEY) return 'gemini';
  return null;
}

// Cost per million tokens — snapshot, Sep 2026, overridable via env.
// Claude Sonnet 5: $3 in / $15 out (intro $2/$10 ended 31 Aug 2026).
// Gemini 3.6 Flash: $1.50 in / $7.50 out; free tier charges $0 (we can't tell
// which tier the key is on, so the estimate uses paid rates — the free tier
// will just come in cheaper than shown).
const RATES = {
  anthropic: {
    input: Number(ENV.ANTHROPIC_INPUT_RATE || 3),
    output: Number(ENV.ANTHROPIC_OUTPUT_RATE || 15),
    label: 'Claude',
  },
  gemini: {
    input: Number(ENV.GEMINI_INPUT_RATE || 1.5),
    output: Number(ENV.GEMINI_OUTPUT_RATE || 7.5),
    label: 'Gemini',
  },
};

// --- the brain: standing rules for every answer ----------------------------
const SYSTEM_PROMPT = `You are Your AI — Jacques's private assistant. You are talking to Jacques, the founder of Turn Someday Into Day One (a recovery app), Studio (a music-video maker) and LeadCatch (a lead-capture tool). He is not a developer.

HOW TO TALK TO HIM
- Plain words, short answers, one step at a time. No jargon, no framework names, no corporate filler.
- He reads on a phone. Short paragraphs, ready to paste.
- When he asks for copy (captions, emails, scripts, titles), give him the FULL finished thing in the message, not an outline, not "here's a draft to build on".
- Do not ask him to read a file — quote the relevant part into the chat.

HARD RULES — never break these
1. Never invent numbers, search volumes, metrics, prices or claims. If the files below don't contain a number, say so plainly and leave the space empty. Never estimate a search volume from memory.
2. No medical claims. No "research shows", no brain chemistry, no mechanisms — only what people report feeling.
3. The app can end a fight, a floor, a day. It can never tell somebody they are finished. Never write copy that says someone is cured or done.
4. Never blame the person struggling to comfort the supporter, or the supporter to comfort the person struggling.
5. Never use "her" or "she" for a supporter's person. Keep it gender-neutral.
6. If a claim is not in the files, say you don't know rather than filling the gap. Point him at which file would have it, or say to verify before publishing.

THE FILES
Business documents are attached below under "YOUR FILES". They are the truth about the business — answer from them when the question is about the business (features, pricing, free vs paid, keywords, scripts, outreach, rules). When a fact is in the files, use it; when the files conflict, say so and quote both sides. When the question is personal or about his day, just be a good colleague.`;

// --- chat handlers (pattern copied from the recovery app) ------------------
async function callAnthropic(system, messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system,
      messages,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data.error && (data.error.message || data.error.type)) || `HTTP ${res.status}`;
    throw new Error(`Claude said: ${String(msg).slice(0, 300)}`);
  }
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text || '')
    .join('')
    .trim();
  const usage = data.usage || {};
  return {
    text,
    usage: { input: usage.input_tokens || 0, output: usage.output_tokens || 0 },
  };
}

async function callGemini(system, messages) {
  const sysText = Array.isArray(system)
    ? system.map((b) => (b && b.text) || '').join('\n\n')
    : String(system || '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const buildBody = (withThinking) => JSON.stringify({
    systemInstruction: sysText ? { parts: [{ text: sysText }] } : undefined,
    contents: (messages || []).map((m) => {
      const c = Array.isArray(m.content)
        ? m.content.map((b) => (b && b.text) || '').join('')
        : String(m.content || '');
      return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: c }] };
    }),
    generationConfig: Object.assign(
      { maxOutputTokens: GEMINI_MAX_TOKENS },
      // 2.x: thinkingBudget 0 (thinking off). 3.x: thinkingLevel (3.x cannot
      // turn thinking off at all; unset defaults to MEDIUM, which is slower and
      // burns output tokens on thinking for what should feel like a quick chat).
      !withThinking ? {}
        : /^gemini-2\./.test(GEMINI_MODEL) ? { thinkingConfig: { thinkingBudget: 0 } }
        : { thinkingConfig: { thinkingLevel: GEMINI_THINKING_LEVEL } }
    ),
  });
  const headers = {
    'Content-Type': 'application/json',
    'x-goog-api-key': GEMINI_API_KEY, // header, not ?key= — keeps the secret out of URLs and logs
  };
  let res = await fetch(url, { method: 'POST', headers, body: buildBody(true) });
  if (res.status === 400) {
    // Google answers with a generic "Request contains an invalid argument" for
    // any config detail it doesn't like — drop the thinking field and retry
    // once rather than letting a config detail kill the chat.
    res = await fetch(url, { method: 'POST', headers, body: buildBody(false) });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data.error && data.error.message) || `HTTP ${res.status}`;
    throw new Error(`Gemini said: ${String(msg).slice(0, 300)}`);
  }
  const cand = (data.candidates && data.candidates[0]) || null;
  const parts = (cand && cand.content && cand.content.parts) || [];
  const text = parts.map((p) => p.text || '').join('').trim();
  if (!text) {
    // A 200 with no words is still a failure — surface it, don't hide it.
    const reason = (cand && cand.finishReason)
      || (data.promptFeedback && data.promptFeedback.blockReason)
      || 'no reason given';
    throw new Error(`Gemini returned an empty answer (${reason}).`);
  }
  const um = data.usageMetadata || {};
  // Output cost includes thinking tokens, so count them.
  const output = (um.candidatesTokenCount || 0) + (um.thoughtsTokenCount || 0);
  return {
    text,
    usage: { input: um.promptTokenCount || 0, output },
  };
}

// --- the app ---------------------------------------------------------------
function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(path.join(__dirname, 'web')));

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      provider: pickProvider() || null,
      anthropic: !!ANTHROPIC_API_KEY,
      gemini: !!GEMINI_API_KEY,
      model: pickProvider() === 'gemini' ? GEMINI_MODEL : ANTHROPIC_MODEL,
    });
  });

  app.get('/api/docs', (req, res) => {
    res.json({ docs: listDocs() });
  });

  app.post('/api/chat', async (req, res) => {
    const { messages, docs } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Send at least one message.' });
    }

    const provider = pickProvider();
    if (!provider) {
      return res.status(503).json({
        error: 'No AI key yet.',
        hint: 'Open YourAI/.env, paste ANTHROPIC_API_KEY=… or GEMINI_API_KEY=… (a free Gemini key from aistudio.google.com), then restart.',
      });
    }

    const loaded = loadDocs(docs);
    let system = SYSTEM_PROMPT;
    if (loaded.length) {
      system += '\n\n# YOUR FILES — read these; they are the truth about the business\n';
      for (const d of loaded) {
        system += `\n<document name="${d.label}">\n${d.text}\n</document>\n`;
      }
    } else {
      system += '\n\n(No files attached to this message — if the question is about the business, tell Jacques to tick the right files, or answer from what you know and say it is not from a file.)';
    }

    try {
      const out = provider === 'gemini'
        ? await callGemini(system, messages)
        : await callAnthropic(system, messages);
      const rate = RATES[provider];
      const costUsd = (out.usage.input * rate.input + out.usage.output * rate.output) / 1e6;
      return res.json({
        text: out.text,
        provider,
        model: provider === 'gemini' ? GEMINI_MODEL : ANTHROPIC_MODEL,
        usage: out.usage,
        costUsd,
        docs: loaded.map((d) => d.label),
      });
    } catch (err) {
      return res.status(502).json({ error: err.message || 'The AI call failed.' });
    }
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, HOST, () => {
    const provider = pickProvider();
    console.log(`Your AI is running at http://localhost:${PORT}`);
    console.log(provider
      ? `  AI: ${provider === 'gemini' ? GEMINI_MODEL : ANTHROPIC_MODEL}`
      : '  No API key yet — paste one into YourAI/.env and restart.');
  });
}

module.exports = { createApp };