// The Gemini request body, and the one place an image is allowed into the app.
//
// WHY THIS IS ITS OWN FILE. It was inline in server.js, which meant the only
// way to find out whether a chart picture actually reached the model was to
// ask the model. That is a bad test. Everything that decides what leaves the
// phone now lives here, where it can be called with real input and checked.
//
// The picture (Jacques said yes on 17 Sep 2026): the Trading Desk can attach
// one screenshot of his own chart to a question. Not a photo picker for the
// app - the desk only - and it is the only image on any route.
//
// THE RULE THAT MATTERS MOST: a picture is never silently dropped. If it is the
// wrong type or too big the request is refused with a sentence, because a
// discarded image produces an answer about a chart the model never saw, and
// "the answer is about a chart I cannot see" is the exact lie this app is built
// not to tell.

// Gemini takes JPEG, PNG and WebP. Screenshots from a phone are all three.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Below the server's own 2MB JSON body limit with room for the prompt and the
// base64 overhead (4/3). The desk shrinks a picture on the phone before it is
// ever sent, so this is the backstop, not the working limit.
const MAX_IMAGE_BYTES = 1_200_000;
// One chart at a time. The desk already has four timeframes off the feed; the
// picture is the broker's chart in front of him, and there is one of those.
const MAX_IMAGES = 1;

function imageBytes(base64) {
  const clean = String(base64 || '').replace(/\s+/g, '');
  if (!clean) return 0;
  const padding = (clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0);
  return Math.floor((clean.length * 3) / 4) - padding;
}

// A data URL arrives whole from a browser FileReader; the API wants the base64
// alone. Accept both rather than trusting whichever the caller happened to use.
function stripDataUrl(data) {
  return String(data || '')
    .replace(/^data:[^;]*;base64,/, '')
    .replace(/\s+/g, '');
}

// Returns { ok: true } or { ok: false, error: 'a sentence for the person' }.
// The sentence is shown in the desk as-is, so it says what to do, not what
// went wrong in the code.
function collectImages(messages) {
  let found = 0;
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || !Array.isArray(m.content)) continue;
    for (const b of m.content) {
      if (!b || b.type !== 'image') continue;
      found += 1;
      if (found > MAX_IMAGES) {
        return { ok: false, error: 'One chart picture at a time. Ask about this one first.' };
      }
      const media = String(b.media_type || b.mediaType || '').toLowerCase();
      if (!IMAGE_TYPES.includes(media)) {
        return { ok: false, error: 'That is not a picture this can read. A JPEG, PNG or WebP screenshot works.' };
      }
      const data = stripDataUrl(b.data);
      if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
        return { ok: false, error: 'That picture could not be read. Try it again from a screenshot.' };
      }
      if (imageBytes(data) > MAX_IMAGE_BYTES) {
        return { ok: false, error: 'That picture is too big. A screenshot works better than a photo of a screen.' };
      }
    }
  }
  return { ok: true, count: found };
}

// Images go BEFORE the words. Gemini reads a picture first and the question
// after it; the other way round the question tends to be answered from the
// text alone.
function partsFor(content) {
  const images = [];
  const texts = [];
  if (Array.isArray(content)) {
    for (const b of content) {
      if (!b) continue;
      if (b.type === 'image') {
        const media = String(b.media_type || b.mediaType || '').toLowerCase();
        const data = stripDataUrl(b.data);
        // Belt and braces: collectImages has already refused anything else, and
        // this must never forward a part the API would reject wholesale (which
        // would take the whole question down, not just the picture).
        if (IMAGE_TYPES.includes(media) && data) {
          images.push({ inlineData: { mimeType: media, data } });
        }
        continue;
      }
      const t = (b && b.text) || '';
      if (t) texts.push({ text: t });
    }
  } else {
    const t = String(content || '');
    if (t) texts.push({ text: t });
  }
  const parts = images.concat(texts);
  // A message with nothing in it still needs a part, or the API 400s on an
  // empty parts array.
  return parts.length ? parts : [{ text: '' }];
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

module.exports = { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES, imageBytes, collectImages, partsFor, buildBody };
