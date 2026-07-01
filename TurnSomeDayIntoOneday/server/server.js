require('dotenv').config();
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_VERSION = '2023-06-01';

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.post('/api/chat', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
  }

  const { model, max_tokens, system, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required.' });
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-5',
        max_tokens: max_tokens || 1000,
        system,
        messages,
      }),
    });

    const data = await anthropicRes.json();
    res.status(anthropicRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach Anthropic API.' });
  }
});

app.listen(PORT, () => {
  console.log(`Turn Someday Into Day One server running on http://localhost:${PORT}`);
});
