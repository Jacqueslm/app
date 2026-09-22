// One AI provider, and only one.
//
// On 17 Sep 2026 Jacques said: "unwire claude not going to use it and use the
// gemini key." So the Anthropic path was deleted, not disabled - there is no
// fallback, no second key, and no branch that can quietly answer from somewhere
// else if the Gemini call fails.
//
// WHY THIS NEEDS A TEST. A fallback provider is invisible when it works. If
// someone re-adds one, every symptom of it is a symptom of success: chats keep
// being answered, and nothing anywhere says which company answered them. The
// only place it would show up is a bill, or a privacy policy that names one
// processor while the server calls another. Both of those are too late.
//
// So these tests read the live code - comments excluded, because the note
// explaining WHY Claude was unwired names the vendor on purpose, and deleting
// an accurate record to satisfy a grep would be the wrong trade.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const VENDOR = /anthropic/i;
const SERVER = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

// Every line that is not a comment. That is where a provider would have to be
// named to actually be called.
function liveCode(src) {
  return src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    })
    .join('\n');
}

const LIVE = liveCode(SERVER);

test('no retired provider is reachable from the server', () => {
  assert.doesNotMatch(LIVE, VENDOR,
    'the Claude path was deleted on 17 Sep 2026 - it is not a fallback, do not put it back');
  assert.doesNotMatch(LIVE, /api\.openai\.com|api\.mistral\.ai|generativelanguage[^`]*cohere/i,
    'one provider means one provider, whatever the second one is called');
  assert.doesNotMatch(LIVE, /ANTHROPIC_[A-Z_]+/,
    'no Anthropic key is read anywhere any more - an unread variable is how a fallback starts');
});

test('the one outbound AI call is Google Gemini, and the key rides in a header', () => {
  assert.match(LIVE, /https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\//,
    'the chat route must reach Gemini, or there is no provider at all');
  assert.match(LIVE, /'x-goog-api-key': GEMINI_API_KEY/,
    'the key goes in a header, never a query string - URLs land in logs and error messages');
  assert.doesNotMatch(LIVE, /\?key=/, 'the key must not be in the URL');
});

test('with no key the server says so, and names the one key that exists', () => {
  assert.match(SERVER, /if \(!GEMINI_API_KEY\) \{/,
    'the guard must be the Gemini key alone, not a list of providers that no longer exist');
  assert.match(SERVER, /'No AI key on the server \(GEMINI_API_KEY is unset\)\.'/,
    'the message has to name the variable the operator actually has to set');
  assert.doesNotMatch(SERVER, /GEMINI_API_KEY \/ ANTHROPIC/,
    'and must not send anybody looking for a key that is gone');
});

test('/api/ai-status can only ever answer gemini or none', () => {
  assert.match(SERVER, /const provider = GEMINI_API_KEY \? 'gemini' : 'none';/,
    'this endpoint is the one place the app can say out loud which model is answering you');
  assert.match(SERVER, /keyConfigured: !!GEMINI_API_KEY,/);
  assert.match(SERVER, /model: GEMINI_API_KEY \? GEMINI_MODEL : null,/,
    'no model named unless there is a key to call it with - otherwise it reports a provider it cannot reach');
});

test('the desk and The Key sit on the same provider as Friendly', () => {
  const desk = fs.readFileSync(path.join(__dirname, '..', '..', 'desk.html'), 'utf8');
  assert.match(desk, /fetch\('\/api\/chat'/,
    'the desk answers through the same route, so it inherits the same single provider');
  assert.doesNotMatch(liveCode(desk), VENDOR, 'a page must not name a provider the server no longer calls');
  const key = fs.readFileSync(path.join(__dirname, '..', 'key-reading-route.js'), 'utf8');
  assert.match(key, /generativelanguage\.googleapis\.com/);
  assert.doesNotMatch(liveCode(key), VENDOR);
});

test('the written record matches the code: Google, and no retired processor', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  assert.match(app, /<b>Google<\/b> processes the messages you send to Friendly/,
    'the in-app policy must name the processor that actually receives the messages');
  assert.doesNotMatch(app, VENDOR,
    'the in-app policy named Anthropic until 17 Sep 2026 - that was a false disclosure once Claude was unwired');

  const privacy = fs.readFileSync(path.join(__dirname, '..', '..', 'privacy.html'), 'utf8');
  assert.doesNotMatch(privacy, VENDOR,
    'the public policy carried a conditional line about the fallback - there is no fallback now');
  assert.match(privacy, /<b>Google<\/b> processes the messages/);
});

test('the in-app policy does not promise a count it does not list', () => {
  // It said "Two outside services are used" while listing one. Google and
  // Resend are the two, and both have to be on the page.
  const app = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  assert.match(app, /Two outside services are used/);
  assert.match(app, /• <b>Google<\/b> processes the messages you send to Friendly/);
  assert.match(app, /• <b>Resend<\/b> delivers the emails/,
    'Resend sends the reset links - a page that promises two processors and lists one is a gap, not tidiness');
});
