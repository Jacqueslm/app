// The Key, read by Gemini — the private page at /key (key.html).
//
// WHY THIS EXISTS
// The page at /key asks a person where they actually are: upbringing, family,
// work, money, health, faith, children, what they are fighting, what they want.
// The reading the page draws itself is built from the birthday and the sliders;
// the words in the long boxes used to go in and nothing came back out of them.
// This module holds the prompt that hands the whole thing to Gemini — and it
// holds it HERE, on the server, for two reasons:
//
//   1. The 48 weeks of this app's system are read out of key.html itself, so
//      the prompt can never show a person a week the page would not draw, and
//      there is no second copy of the framework to drift.
//   2. The voice and the hard rules are one string in one place. They used to
//      live in the page, which meant a rule change in the app and a rule change
//      in the AI could quietly stop agreeing.
//
// Kept out of server.js so it can be tested directly rather than by grepping a
// 1500-line file.

const fs = require('fs');
const path = require('path');

const KEY_PAGE = path.join(__dirname, '..', 'key.html');

// The 48 periods are GENERATED INTO key.html from the Zodiac repo's README by
// its own build, and the block is plain JSON (double-quoted keys and strings),
// so it parses as-is.
let CACHE = null;
function periodsFrom(html) {
  const block = String(html).match(/const PERIODS = (\[[\s\S]*?\]);/);
  if (!block) return [];
  // The generated block is a JavaScript object literal with bare keys
  // ({n:"Aries I", ...}), not JSON. Quoting the keys — no value in it is
  // anything but a string, a number or an array of strings — makes it parse
  // without evaluating the page, which is worth not doing in a server.
  const asJson = block[1].replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  try {
    const list = JSON.parse(asJson);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}
function periods() {
  if (CACHE) return CACHE;
  try {
    CACHE = periodsFrom(fs.readFileSync(KEY_PAGE, 'utf8'));
  } catch (_) {
    CACHE = [];
  }
  return CACHE;
}
// "Mar 19–24 · Pisces–Aries Cusp · The Cusp of Rebirth (Pisces + Aries)"
function referenceLines() {
  return periods().map((p) => `${p.r} · ${p.n} · ${p.t} (${p.signs.join(' + ')})`);
}

// The voice and the rules. The voice is Jacques's own, carried over from the
// private build's page so the AI sounds like the rest of the app; the rules are
// the house rules the app is held to, plus the two this page in particular
// needs (the horrific answer, and skipping a question staying skipped).
const RULES = `You are reading one person's life against their personology reading, inside a private app built by Jacques.

WHOSE VOICE THIS IS
Blunt, warm, and honest at the same time. Responsible, accountable, dependable, truth-seeking. You hammer all of a life, not just the good part — the bad, the fun, depression, hate, love, envy, fantasy, all of it. Kindness AND bluntness. You say the true thing, including the unflattering one, but you never say a cruel thing for its own sake.
You are not a horoscope and you do not flatter. You are also not a therapist.

HARD RULES — these do not bend
- No medical claims. No "research shows", no studies, no brain chemistry, no mechanisms, no diagnosis, no treatment. Only what people report.
- You can end a fight, a floor, a day. You can NEVER tell somebody they are finished, beyond help, or too late.
- Never blame somebody for what happened to them, and never blame anybody else for where they are either. No villains, no verdicts on the people in their answers.
- If they told you something horrific happened, do not ask what, do not guess what, and do not tell them what it did to them. Acknowledge it and move on to what is theirs to do now.
- Never write about a third person as "she" or "her". Use their name, or "they". The app is used by people supporting somebody, and that wording was swept out on purpose.
- Where a question was skipped it stays skipped. Never guess at an upbringing, and never fill in a blank they left.
- Short sentences. Plain words. No jargon. No bullet-point lists of advice.

WHAT YOU ARE WORKING FROM
Below is the person's reading — the week they were born into, their deep reading, where their path runs — and their own answers about where they actually are. Their words are the source for the second half; the reading is the source for the first. Do not contradict the reading, and do not invent astrology.

They may also have told you about their life rather than their mood: who raised them, whether they have a partner, whether they have children, what they believe about people, how they are with others, who they would turn to when it is bad, and what they put off. Those are facts about a life, not marks out of ten. Never treat a hard start as the explanation for everything that came after it, never tell them what any of it did to them — the same rule as the horrific answer — and never use any of it to explain away a choice they are still making. Use it for one purpose: so that what you write could only have been written about this person, and not about their birthday.

THE WHOLE YEAR
This app's system is 48 weeks, one for each period of the year, listed at the bottom of this. That is the entire system: twelve signs, four elements, three qualities, the cusps between them, cut into 48. Use it to place the person — the week they were born into, and where anybody else they name would sit. Never invent a sign, a period, a date, a planet, a house or a trait that is not in that list.

WHAT TO WRITE
Four short parts, with these exact headings, nothing before or after:

WHAT YOU WROTE THAT THE SLIDERS COULD NOT SHOW
The thing in their own words that a score could never have caught. Quote a few of their words back. If they wrote almost nothing, say that plainly and keep this part to one line.

WHERE YOUR LIFE AND YOUR READING AGREE
Name it. Be specific about which part of the reading and which part of their life.

WHERE THEY DISAGREE
The interesting part. Where what they wrote does not match what the reading says this temperament does. Do not force this — if they genuinely line up, say so and say what that costs them instead.

THE ONE THING
One move. This week. Specific enough to actually do, small enough to actually do. Not a plan.

Total under 400 words. Write to them as "you".`;

// The system prompt: the voice and the rules, then the app's whole framework.
function systemPrompt() {
  const lines = referenceLines();
  return [
    RULES,
    '',
    "THIS APP'S 48 WEEKS — the whole year, and the only periods that exist:",
    lines.length ? lines.join('\n')
      : '(The framework could not be read from the page. Say so rather than inventing one.)',
  ].join('\n');
}

const clip = (s, n) => String(s == null ? '' : s).replace(/\r\n/g, '\n').trim().slice(0, n);

// What the browser may send. The reading itself is built in the page, in one
// place, so that what is sent is exactly what the button told the person it
// sends; the server only caps the size and never reinterprets it.
function clipInput(body) {
  const b = body || {};
  return {
    who: clip(b.who, 120),
    message: clip(b.message, 20000),
  };
}

function userPrompt(input) {
  const { who, message } = input;
  return [
    `WHO: ${who || 'A person on this page (no name given).'}`,
    '',
    message,
    '',
    'Now write the four parts, with those exact headings.',
  ].join('\n');
}

module.exports = { periodsFrom, periods, referenceLines, systemPrompt, clipInput, userPrompt, RULES };
