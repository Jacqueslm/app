// 17 Sep 2026: the Someday indicator is a TradingView script, and there is no
// Pine compiler anywhere in this repo or on this machine. A typo in it ships
// invisibly and reaches Jacques as "line 214: no viable alternative" on his
// chart - a wall of nothing that costs him the session.
//
// These are the faults a reader can catch without a compiler: a bracket left
// open, indentation Pine will not accept, two things wearing one name, a
// function called with the wrong number of arguments, and a request.security
// tuple that hands back a different number of values than the line claims.
// It is not a compile check and it is not pretending to be one.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PINE = path.join(__dirname, '..', '..', 'tradingview', 'Someday-Zones.pine');

function read() {
  return fs.readFileSync(PINE, 'utf8');
}

// Code only. A comment or a string body is not syntax, and an apostrophe in a
// sentence ("the chart's own timeframe") would otherwise read as a broken quote.
function bare(line) {
  return line.replace(/\/\/.*$/, '').replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
}

function body() {
  return read().split('\n').map(bare);
}

// The text between an opening bracket and its partner, nesting respected - so
// a tuple that contains [swingLen] is still read as one list.
function inside(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '[' || text[i] === '(' || text[i] === '{') depth++;
    else if (text[i] === ']' || text[i] === ')' || text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return null;
}

function topCommas(list) {
  let depth = 0;
  let n = 0;
  for (const ch of list) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) n++;
  }
  return n;
}

test('the file is a Pine script and starts by saying so', () => {
  const lines = read().split('\n');
  assert.strictEqual(lines[0].trim(), '//@version=5', 'the version directive must be the first line - TradingView reads it before anything else');
  assert.match(lines[1], /^\/\/ Someday/, 'and the whole thing is named right under it');
});

test('no tabs, and no characters that are not plain ASCII', () => {
  // The Pine editor is a browser text box. A smart quote or a non-breaking
  // space typed from a phone arrives as a character Pine does not know, and the
  // error names a line that looks correct.
  const lines = read().split('\n');
  lines.forEach((l, i) => {
    assert.ok(!l.includes('\t'), `line ${i + 1} has a tab - Pine wants spaces`);
    for (const ch of l) {
      assert.ok(ch.charCodeAt(0) < 128, `line ${i + 1} has a character Pine will not read: ${JSON.stringify(ch)}`);
    }
  });
});

test('every bracket that opens, closes', () => {
  for (const [i, line] of body().entries()) {
    let depth = 0;
    for (const ch of line) {
      if ('([{'.includes(ch)) depth++;
      if (')]}'.includes(ch)) depth--;
      assert.ok(depth >= 0, `line ${i + 1} closes a bracket it never opened: ${line.trim()}`);
    }
    assert.strictEqual(depth, 0, `line ${i + 1} leaves a bracket open: ${line.trim()}`);
  }
});

test('indentation is the multiple of four Pine insists on', () => {
  body().forEach((line, i) => {
    if (line.trim() === '') return;
    const lead = line.match(/^ */)[0].length;
    assert.strictEqual(lead % 4, 0, `line ${i + 1} is indented ${lead} spaces - Pine counts in fours: ${line.trim()}`);
  });
});

test('no two things at the top level share a name', () => {
  // Pine answers a second declaration of the same name with "Variable already
  // declared", and the first one silently stops being what you think it is.
  const seen = new Map();
  body().forEach((line, i) => {
    const m = line.match(/^(?:var\s+\S+\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/);
    if (!m) return;
    const name = m[1];
    const isZoneType = /^type\s/.test(line);
    if (isZoneType) return;
    assert.ok(!seen.has(name), `"${name}" is declared twice - line ${seen.get(name)} and line ${i + 1}`);
    seen.set(name, i + 1);
  });
  assert.ok(seen.size > 20, 'and the check found the declarations at all');
});

test('nothing is reassigned that was never declared', () => {
  // `x := 1` with no `x =` before it is "Undeclared identifier" in Pine, and it
  // is the mistake you make when you move a line.
  const text = body().join('\n');
  const declared = new Set();
  for (const m of text.matchAll(/^[ \t]*(?:var\s+\S+\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/gm)) declared.add(m[1]);
  for (const m of text.matchAll(/^[ \t]*\[([^\]]+)\]\s*=/gm)) {
    for (const part of m[1].split(',')) declared.add(part.trim());
  }
  for (const m of text.matchAll(/^[ \t]*([A-Za-z_][A-Za-z0-9_]*)\s*:=/gm)) {
    assert.ok(declared.has(m[1]), `"${m[1]}" is reassigned but never declared`);
  }
});

test('every function is called with as many values as it takes', () => {
  const text = body().join('\n');
  const arity = new Map();
  for (const m of text.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=>/gm)) {
    arity.set(m[1], m[2].trim() === '' ? 0 : topCommas(m[2]) + 1);
  }
  assert.ok(arity.size >= 4, 'found the script\'s own functions');
  for (const [name, want] of arity) {
    for (const m of text.matchAll(new RegExp(`(^|[^A-Za-z0-9_.])${name}\\s*\\(`, 'gm'))) {
      const open = m.index + m[0].length - 1;
      const args = inside(text, open);
      assert.ok(args !== null, `${name}( is never closed`);
      const got = args.trim() === '' ? 0 : topCommas(args) + 1;
      assert.strictEqual(got, want, `${name} takes ${want} value(s) and is called with ${got}`);
    }
  }
});

test('a request.security tuple hands back as many values as the line claims', () => {
  // This is the one that would take the longest to find by eye: TradingView
  // reports it as "Cannot use 'request.security' with a tuple of a different
  // size", which does not say which side is wrong.
  const text = body().join('\n');
  const calls = [...text.matchAll(/request\.security\(/g)];
  assert.ok(calls.length >= 4, 'found the higher timeframes');
  for (const call of calls) {
    const lineStart = text.lastIndexOf('\n', call.index) + 1;
    const line = text.slice(lineStart, text.indexOf('\n', call.index));
    const offset = call.index - lineStart;
    const names = line.match(/^\s*\[([^\]]+)\]\s*=/);
    assert.ok(names, 'every security call in this script is destructured into named values');
    // The tuple is the first square bracket after the timeframe argument.
    const afterTf = line.indexOf(',', line.indexOf(',', offset) + 1);
    const tuple = inside(line, line.indexOf('[', afterTf));
    assert.ok(tuple !== null, 'the tuple is closed');
    assert.strictEqual(
      topCommas(names[1]) + 1,
      topCommas(tuple) + 1,
      `${line.trim().slice(0, 46)} names ${topCommas(names[1]) + 1} values but asks for ${topCommas(tuple) + 1}`
    );
  }
});

test('every input is filed under a group', () => {
  // His settings panel is nine inputs deep already; an input with no group
  // lands in a nameless pile at the bottom.
  body().forEach((line, i) => {
    if (!/input\./.test(line)) return;
    assert.match(line, /group="/, `line ${i + 1} has an input with no group: ${line.trim()}`);
  });
});

test('the zones are built from confirmed swings and never from the future', () => {
  const text = read();
  assert.match(text, /lookahead=barmerge\.lookahead_off/, 'the higher timeframes must not be read ahead of the bar');
  assert.ok(!/lookahead_on/.test(text), 'and never with lookahead on - that is reading what has not happened');
  assert.match(text, /ta\.pivothigh\(high, swingLen, swingLen\)/, 'swings are still swings');
  assert.match(text, /pruneZones\(supplyZones, true\)|pruneZones\(supplyZones,true\)/, 'supply zones are kept tidy');
  assert.match(text, /pruneZones\(demandZones, false\)|pruneZones\(demandZones,false\)/, 'so are demand zones');
});
