// Every AI in this app writes in English.
//
// Jacques, 15 Sep 2026: "I'm not Chinese" — one of the four prompts came back
// in another language, and the reason was that none of them had ever been told
// which language to write in. Four separate prompts, four separate chances to
// drift, so the rule is pinned in all four here rather than in one.
//
// This is a prompt test, not a model test: it cannot prove the model obeys. It
// proves the instruction is in the bytes that actually get sent, which is the
// half that is ours.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const BACKSLASH = String.fromCharCode(92);

// The ask boxes hold their instructions in one array literal, so the test reads
// the array rather than grepping the page — what is asserted is what the page
// evaluates, not what looks like it is there.
function arrayLiteral(src, at) {
  const open = src.indexOf('[', at);
  let depth = 0, quote = null;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === BACKSLASH) { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '[') depth++;
    if (ch === ']') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  return null;
}

function askRules(file) {
  const h = read(file);
  const at = h.indexOf('var ASK_SYS=');
  assert.ok(at > -1, `${file} declares ASK_SYS`);
  const literal = arrayLiteral(h, at);
  assert.ok(literal, `${file} ASK_SYS literal is closed`);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext('this.S = ' + literal + ';', ctx);
  assert.ok(Array.isArray(ctx.S), `${file} ASK_SYS is an array`);
  return ctx.S.join('\n');
}

test('Friendly, the chat, is told to answer in English', () => {
  const h = read('index.html');
  const base = h.indexOf('const SYSTEM_BASE');
  const rule = h.indexOf('You write in plain English, always');
  assert.ok(base > -1 && rule > base, 'the English rule is inside SYSTEM_BASE, not loose in the page');
  assert.match(h.slice(base, rule), /You are Friendly/, 'and it is still Friendly being described');
});

test('The Key reading is told to answer in English', () => {
  const sys = require('../key-reading.js').systemPrompt();
  assert.match(sys, /plain English/);
  assert.match(sys, /HARD RULES/, 'and the hard rules are still in the same prompt');
});

test('both reference ask boxes are told to answer in English', () => {
  ['herbs.html', 'tax.html'].forEach((f) => {
    const rules = askRules(f);
    assert.match(rules, /- In English, always\./, `${f} carries the rule as its own bullet`);
  });
});

test('the pages keep the rules that were there before the language rule', () => {
  // A prompt is one string in one place: rewording it is how a safety line goes
  // missing without anybody noticing. These are the ones that must survive.
  assert.match(askRules('herbs.html'), /An infection is a doctor/, 'herb box still sends an infection to a doctor');
  assert.match(askRules('herbs.html'), /988/, 'herb box still names the crisis line for withdrawal');
  assert.match(askRules('tax.html'), /never invent a number/i, 'tax box still refuses to invent a figure');

  const sys = require('../key-reading.js').systemPrompt();
  assert.match(sys, /No medical claims/, 'the reading still makes no medical claims');
  assert.match(sys, /never tell somebody they are finished/i, 'and never tells anybody they are finished');
  assert.match(sys, /"she" or "her"/, 'and still has the no-pronouns rule for a supporter');
});
