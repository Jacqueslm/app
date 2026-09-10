# Your AI — private assistant

A chat AI that knows Jacques's business files. Runs on his own machine like
Studio does: double-click the launcher, it opens `http://localhost:4410`, and
everything stays local except the messages sent to the AI provider.

## Run it

Double-click the launcher for your machine:

- Windows: **Start Your AI.bat**
- Mac: **Start Your AI.command**
- Linux: **start-your-ai.sh**

First run installs what it needs and creates `YourAI/.env` from
`env.example.txt`. Open `.env` and paste **one** API key:

- `ANTHROPIC_API_KEY=...` — Claude (Sonnet 5). Best writing. ~$3 per million
  input tokens, ~$15 per million output (Sep 2026 snapshot).
- `GEMINI_API_KEY=...` — Gemini (3.6 Flash). Cheaper, and there is a free tier
  for light use. Free key at https://aistudio.google.com with a Google account.

If both are set, Claude is used unless `GEMINI_FIRST=1` in `.env`. Restart
after changing `.env`.

## What it knows

The panel on the left lists the business documents — the standing rules
(`CLAUDE.md`), current status (`START-HERE.md`, `MASTER-STATUS.md`), keywords,
scripts, outreach, competitors, influencers, the marketing playbook and the
medical-claims audit. Tick the ones for the job; they are read **fresh from
disk with every message**, so the answers track the latest edits. Files are
discovered automatically — a new `.md` at the repo root appears in the list
with no code change.

## Privacy

The server binds to `127.0.0.1` — only this machine can reach it. Your key
lives in `YourAI/.env` and is never uploaded anywhere. Messages and the ticked
files go only to the AI provider whose key you set. Nothing is stored: chat
history lives in the page's memory and is gone when you close the tab.

## Layout

```
YourAI/
  server.js        Express server: /api/health, /api/docs, /api/chat
  docs.js          discovers + loads the repo's business documents
  web/index.html   the chat page (no build step)
  env.example.txt  template copied to .env on first run
  Start Your AI.bat / .command / start-your-ai.sh
```

## Developer notes

- The AI call shapes (Anthropic `/v1/messages` and Gemini
  `generateContent`, including the Gemini 400-retry on the thinking field and
  the empty-answer check) are lifted from the recovery app's `/api/chat`
  (`TurnSomeDayIntoOneday/server/server.js`), which is production-tested
  against the same providers. Keep the two in step when provider APIs change.
- Cost line uses snapshot rates in `server.js` (`RATES`), overridable via
  `ANTHROPIC_INPUT_RATE` / `ANTHROPIC_OUTPUT_RATE` / `GEMINI_INPUT_RATE` /
  `GEMINI_OUTPUT_RATE` (USD per million tokens). Gemini free tier charges $0;
  the estimate shows paid-tier rates, so free tier comes in cheaper than shown.
- Provider/model overrides: `ANTHROPIC_MODEL`, `GEMINI_MODEL`,
  `GEMINI_MAX_TOKENS`, `GEMINI_THINKING_LEVEL`, `PORT`.
- Smoke test: `node -e "const {createApp}=require('./server.js');const s=createApp().listen(0,'127.0.0.1',async()=>{const p=s.address().port;for(const u of ['/api/health','/api/docs']){const r=await fetch('http://127.0.0.1:'+p+u);console.log(u,r.status)}s.close()})"`.