// The request body every AI answer in the app is sent in.
//
// This file was chart-picture.test.js until 24 Sep 2026. Jacques: "remove the
// trading game the desk everything about trading im done." The chart picture
// existed for the Trading Desk alone, so it went with the desk, and this is
// what is left: the text path and the thinking setting.
//
// THE FAILURE THESE EXIST TO CATCH. Gemini spends thinking tokens out of
// maxOutputTokens. 3.x cannot turn thinking off at all and defaults to MEDIUM;
// 2.x takes thinkingBudget and 3.x takes thinkingLevel. Sending the wrong one
// is a bare HTTP 400 with no field named, which is what had Friendly canned on
// 18 Aug 2026.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const body = require('../ai-chat-body');
const SERVER = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('a question goes as plain text, with the system prompt beside it', () => {
  const out = JSON.parse(body.buildBody({
    model: 'gemini-3.6-flash', system: 'sys',
    messages: [{ role: 'user', content: 'How do I get through tonight?' }],
    maxTokens: 4096, thinkingLevel: 'LOW', withThinkingOff: true,
  }));
  assert.deepEqual(out.contents[0].parts, [{ text: 'How do I get through tonight?' }],
    'the text path is what every question in the app uses - it must not change');
  assert.equal(out.contents[0].role, 'user');
  assert.equal(out.systemInstruction.parts[0].text, 'sys');
});

test('no message can carry a picture any more', () => {
  const out = JSON.parse(body.buildBody({
    model: 'gemini-3.6-flash', system: 'sys',
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'hello' },
      { type: 'image', media_type: 'image/jpeg', data: 'AAAA' },
    ] }],
    maxTokens: 4096, thinkingLevel: 'LOW', withThinkingOff: true,
  }));
  assert.deepEqual(out.contents[0].parts, [{ text: 'hello' }],
    'the picture went with the desk, so no part of one is forwarded');
  assert.equal(body.collectImages, undefined, 'and the image collector is gone, not left lying about');
});

test('a message with nothing in it still sends a part, or the API 400s', () => {
  const out = JSON.parse(body.buildBody({ model: 'gemini-3.6-flash', messages: [{ role: 'user', content: '' }], maxTokens: 100 }));
  assert.deepEqual(out.contents[0].parts, [{ text: '' }]);
});

test('the thinking knob still matches the model generation', () => {
  const three = JSON.parse(body.buildBody({ model: 'gemini-3.6-flash', messages: [{ role: 'user', content: 'x' }], maxTokens: 100, thinkingLevel: 'LOW', withThinkingOff: true }));
  assert.deepEqual(three.generationConfig.thinkingConfig, { thinkingLevel: 'LOW' });
  const two = JSON.parse(body.buildBody({ model: 'gemini-2.5-flash', messages: [{ role: 'user', content: 'x' }], maxTokens: 100, thinkingLevel: 'LOW', withThinkingOff: true }));
  assert.deepEqual(two.generationConfig.thinkingConfig, { thinkingBudget: 0 },
    '2.x takes thinkingBudget, 3.x takes thinkingLevel - sending the wrong one is a bare 400 with no field named');
  const off = JSON.parse(body.buildBody({ model: 'gemini-3.6-flash', messages: [{ role: 'user', content: 'x' }], maxTokens: 100, withThinkingOff: false }));
  assert.equal(off.generationConfig.thinkingConfig, undefined, 'the retry drops the field entirely, which is the point of the retry');
});

test('the chat route no longer examines a picture', () => {
  assert.doesNotMatch(SERVER, /collectImages/,
    'the desk was the only caller - the route went back to text alone');
});
