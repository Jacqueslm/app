// The Gemini request body — the one place that decides what leaves the phone.
//
// WHY THIS IS ITS OWN FILE. It was inline in server.js, which meant the only
// way to find out what a request actually contained was to ask the model. That
// is a bad test. Everything that decides what leaves the phone now lives here,
// where it can be called with real input and checked.
//
// 24 Sep 2026. Jacques: "remove the trading game the desk everything about
// trading im done." The Trading Desk went, and the chart picture went with it:
// that one screenshot was the only image on any route in this app, and nothing
// else ever asked for one. Text only, here as everywhere else.

// Only the words are collected. Nothing in this app attaches a picture any
// more, and anything else a caller sends is left out rather than forwarded,
// because a part the API rejects takes the whole question down with it.
function partsFor(content) {
  const texts = [];
  if (Array.isArray(content)) {
    for (const b of content) {
      if (!b) continue;
      const t = (b && b.text) || '';
      if (t) texts.push({ text: t });
    }
  } else {
    const t = String(content || '');
    if (t) texts.push({ text: t });
  }
  // A message with nothing in it still needs a part, or the API 400s on an
  // empty parts array.
  return texts.length ? texts : [{ text: '' }];
}

function buildBody(opts) {
  const o = opts || {};
  const model = String(o.model || '');
  const withThinkingOff = !!o.withThinkingOff;
  const sysText = Array.isArray(o.system)
    ? o.system.map((b) => (b && b.text) || '').join('\n\n')
    : String(o.system || '');
  return JSON.stringify({
    systemInstruction: sysText ? { parts: [{ text: sysText }] } : undefined,
    contents: (o.messages || []).map((m) => ({
      role: m && m.role === 'assistant' ? 'model' : 'user',
      parts: partsFor(m && m.content),
    })),
    generationConfig: Object.assign(
      { maxOutputTokens: o.maxTokens },
      // Gemini spends thinking tokens out of maxOutputTokens, so a model left
      // thinking freely can use the whole budget and return no words at all.
      // The knob is named differently per generation, so send the one this
      // model understands.
      //
      //   2.x  thinkingBudget: 0     (thinking off entirely)
      //   3.x  thinkingLevel: 'LOW'  (3.x cannot turn thinking off at all;
      //                               left unset it defaults to MEDIUM, which
      //                               means every reply is slower and costs
      //                               more thinking tokens for a companion
      //                               that should feel like texting a friend)
      //
      // Sending 2.x's thinkingBudget to a 3.x model is a bare HTTP 400
      // "Request contains an invalid argument" with nothing naming the field -
      // that is what had Friendly canned on 18 Aug. If this model rejects the
      // field the caller retries with withThinkingOff true.
      !withThinkingOff ? {}
        : /^gemini-2\./.test(model) ? { thinkingConfig: { thinkingBudget: 0 } }
        : { thinkingConfig: { thinkingLevel: o.thinkingLevel } }
    ),
  });
}

module.exports = { partsFor, buildBody };
