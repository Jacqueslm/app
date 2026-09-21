// The Gemini request body, and everything that decides what is sent to it.
//
// WHY THIS IS ITS OWN FILE. It was inline in server.js, which meant the only
// way to find out whether a question actually reached the model whole was to
// ask the model. That is a bad test. Everything that decides what leaves the
// server now lives here, where it can be called with real input and checked.
//
// TEXT ONLY. Until 21 Sep 2026 this also carried an image attachment - one
// screenshot, accepted by one private page and nowhere else in the app. That
// page was removed on Jacques's word and the picture went with it: nothing in
// the app can attach an image now, so the route that accepted one came out
// rather than stay as a door nothing can open. The privacy pages no longer
// claim a picture can be sent either, which is the half that actually matters
// to anybody reading them.

// The messages, mapped to the shape Gemini takes. Images used to be lifted out
// here and put in front of the words; with the desk gone there is nothing left
// to lift, so the mapping is straight text and a message with nothing in it
// still gets a part - the API 400s on an empty parts array.
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
