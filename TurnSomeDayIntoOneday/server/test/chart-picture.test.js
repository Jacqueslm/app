// One chart picture, and the rule that it is never silently dropped.
//
// 17 Sep 2026: Jacques asked whether he could load a chart and have the
// assistant read it, and said yes when told the picture would go to Google. It
// is the only image on any route in this app - the rest of it refuses images
// entirely - so what it accepts, and what it refuses, is worth a test rather
// than a hope.
//
// THE FAILURE THIS EXISTS TO CATCH. Image handling fails quietly. A block the
// mapping does not recognise becomes an empty string and vanishes, the request
// still succeeds, and the model answers about a chart it never received. That
// reads exactly like a working feature and is the one lie this page is built
// not to tell. So: the picture either arrives in the body, or the request is
// refused with a sentence.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const body = require('../ai-chat-body');
const SERVER = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const DESK = fs.readFileSync(path.join(__dirname, '..', '..', 'desk.html'), 'utf8');

const JPEG = 'data:image/jpeg;base64,' + 'A'.repeat(400);
const BAD = { type: 'image', media_type: 'image/gif', data: 'AAAA' };

test('a question with no picture still goes as plain text', () => {
  const out = JSON.parse(body.buildBody({
    model: 'gemini-3.6-flash', system: 'sys', messages: [{ role: 'user', content: 'Should I take this one?' }],
    maxTokens: 4096, thinkingLevel: 'LOW', withThinkingOff: true,
  }));
  assert.deepEqual(out.contents[0].parts, [{ text: 'Should I take this one?' }],
    'the text path is what every existing question uses - it must not change');
  assert.equal(out.contents[0].role, 'user');
  assert.equal(out.systemInstruction.parts[0].text, 'sys');
});

test('an attached picture reaches the model as an image part, before the words', () => {
  const out = JSON.parse(body.buildBody({
    model: 'gemini-3.6-flash', system: 'sys',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'Is this one of my setups?' }, { type: 'image', media_type: 'image/jpeg', data: JPEG }] }],
    maxTokens: 4096, thinkingLevel: 'LOW', withThinkingOff: true,
  }));
  const parts = out.contents[0].parts;
  assert.equal(parts.length, 2, 'both the question and the picture must survive the mapping');
  assert.equal(parts[0].inlineData.mimeType, 'image/jpeg');
  assert.ok(parts[0].inlineData.data, 'the bytes have to be in the body, not referenced');
  assert.doesNotMatch(parts[0].inlineData.data, /^data:/,
    'the API wants the base64 alone - a data: prefix is rejected wholesale and takes the whole question with it');
  assert.deepEqual(parts[1], { text: 'Is this one of my setups?' },
    'the picture goes first: asked the other way round, the question gets answered from the text alone');
});

test('a picture of the wrong kind is refused, not dropped', () => {
  const bad = body.collectImages([{ role: 'user', content: [{ type: 'text', text: 'hi' }, BAD] }]);
  assert.equal(bad.ok, false, 'a GIF is not a format the model takes - dropping it would answer a question about a chart nobody sent');
  assert.match(bad.error, /JPEG, PNG or WebP/, 'the refusal has to say what does work');
});

test('too big is refused with a size, and one at a time', () => {
  const huge = 'A'.repeat(Math.ceil((body.MAX_IMAGE_BYTES + 1000) * 4 / 3));
  const big = body.collectImages([{ role: 'user', content: [{ type: 'image', media_type: 'image/png', data: huge }] }]);
  assert.equal(big.ok, false);
  assert.match(big.error, /too big/);

  const two = body.collectImages([{ role: 'user', content: [
    { type: 'image', media_type: 'image/png', data: 'AAAA' },
    { type: 'image', media_type: 'image/png', data: 'AAAA' },
  ] }]);
  assert.equal(two.ok, false);
  assert.match(two.error, /One chart picture/);
});

test('a normal screenshot passes, whole or as a data URL', () => {
  const one = body.collectImages([{ role: 'user', content: [{ type: 'image', media_type: 'image/jpeg', data: JPEG }] }]);
  assert.equal(one.ok, true, 'a 300-byte JPEG must not be refused by its own size check');
  assert.equal(one.count, 1);
  const bare = body.collectImages([{ role: 'user', content: [{ type: 'image', media_type: 'image/jpeg', data: 'QUJD' }] }]);
  assert.equal(bare.ok, true, 'base64 without the data: prefix is just as valid');
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

test('the route refuses a bad picture itself, after access and the daily ceiling', () => {
  assert.match(SERVER, /const pics = aiChatBody\.collectImages\(messages\);/,
    'the route has to ask the module, not decide on its own');
  assert.match(SERVER, /if \(!pics\.ok\) return res\.status\(400\)\.json\(\{ error: pics\.error \}\);/,
    'a picture that cannot be sent stops the question - it is never sent without it');
  const quota = SERVER.indexOf('used >= CHAT_LIMIT');
  const check = SERVER.indexOf('aiChatBody.collectImages(messages)');
  assert.ok(quota !== -1 && check > quota,
    'a stranger or a spent account must be turned away before any picture is examined');
});

test('the desk sends the picture only while it is attached', () => {
  assert.match(DESK, /if\(PIC\) content\.push\(\{type:'image',media_type:PIC\.media,data:PIC\.data\}\);/,
    'no picture, no image block - the same question must keep working with nothing attached');
  assert.match(DESK, /messages:\[\{role:'user',content:content\}\]/);
  assert.match(DESK, /del\.addEventListener\('click',function\(\)\{ PIC=null; paintPic\(\); picNote\(''\); \}\)/,
    'removing it has to actually clear it, or it keeps being sent behind his back');
});

test('the picture is shrunk on the phone before it is sent', () => {
  assert.match(DESK, /var PIC=null, PIC_MAX_EDGE=1200, PIC_MAX_BYTES=900000;/);
  assert.match(DESK, /c\.toDataURL\('image\/jpeg',0\.75\)/,
    'a 12 megapixel photo of a screen costs money and reads worse than a 1200px screenshot');
  assert.match(DESK, /accept="image\/\*"/, 'on a phone this is what offers the camera or the gallery');
});

test('both privacy pages say a chart picture can leave the phone', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  assert.match(app, /trading questions and chart screenshots you send from the trading desk/,
    'the in-app policy names what leaves, and this is now more than text');
  assert.match(app, /no picture ever leaves this app unless you attach one/,
    'and it says the picture is his choice, because it is');
  const privacy = fs.readFileSync(path.join(__dirname, '..', '..', 'privacy.html'), 'utf8');
  assert.match(privacy, /trading questions and chart screenshots you choose to send/);
  assert.match(DESK, /A picture you add is sent to Google with your question/,
    'and the page he attaches it on says so at the point he attaches it');
});
