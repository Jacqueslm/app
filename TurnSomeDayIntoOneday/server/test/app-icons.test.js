// The invisible back button — 19 Sep 2026.
//
// Jacques, on his iPhone: "no back button on app yet and on the iphone". Nothing
// was missing from the markup. The header has always had
// <i class="ti ti-arrow-left" id="hdr-back">, switchTo() has always shown it off
// Home and hidden it on Home, and goBackScreen() has always walked the screen
// history. What was missing was one key in ICON_PATHS: 'ti-arrow-right' was
// there and 'ti-arrow-left' was not, and renderIcons() gives up quietly on a key
// it cannot find (if(!paths)return). So the element was in the page, in the tab
// order, listening for taps, and drawing NOTHING — a back button nobody could
// see or hit.
//
// That matters more on an iPhone than anywhere else. There is no browser back
// button on iOS, and none at all once the app is saved to the home screen, so
// the header arrow and a swipe are the only ways back. It is also the only bug
// in this family that fails with no error anywhere: an icon with no path is a
// blank space, not a broken image.
//
// Ten more classes in the page were missing the same way — the film button, the
// Tools tabs, the Zodiacs / Key / Tools rows, and the lesson player's back and
// forward buttons, which rendered as two blank squares at the ends of the
// overlay. The first test here is the general guard: every icon class the page
// actually uses must have a path. The rest check that the paths draw.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', '..', 'index.html');
const html = fs.readFileSync(APP, 'utf8');

// The map, read from its own braces so a key named in a lesson, a comment or a
// CSS rule further down the page cannot be mistaken for a mapped icon.
function iconPaths() {
  const at = html.indexOf('const ICON_PATHS=');
  assert.ok(at > -1, 'ICON_PATHS is declared in the page');
  const open = html.indexOf('{', at);
  let depth = 0;
  let close = -1;
  for (let i = open; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { close = i; break; } }
  }
  assert.ok(close > open, 'ICON_PATHS has a closing brace');
  const body = html.slice(open, close);
  const map = new Map();
  for (const m of body.matchAll(/'((?:ti-)?[a-z0-9-]+)'\s*:\s*'([^']*)'/g)) map.set(m[1], m[2]);
  assert.ok(map.size > 40, `found the icon map (${map.size} entries)`);
  return map;
}

// Every class the page renders an icon with. The closing quote is part of the
// match, so a class built at runtime by concatenation ("ti-player-" + something)
// is not counted here — its finished names are, because they appear literally.
function usedIconClasses() {
  const used = new Set();
  for (const m of html.matchAll(/class=(["'])ti\s+([a-z0-9-]+)\1/g)) used.add(m[2]);
  assert.ok(used.size > 20, `found the page's icon classes (${used.size})`);
  return used;
}

test('every icon the app draws has a path — a missing key renders nothing at all', () => {
  const map = iconPaths();
  const missing = [...usedIconClasses()].filter(cls => !map.has(cls)).sort();
  assert.deepStrictEqual(missing, [],
    `these classes are used in the page with no entry in ICON_PATHS, so they draw an empty box: ${missing.join(', ')}`);
});

test('the header back button actually draws, and points back', () => {
  const map = iconPaths();
  const arrow = map.get('ti-arrow-left');
  assert.ok(arrow, "'ti-arrow-left' is in ICON_PATHS - without it the app has no visible way back");
  assert.ok(/(<path|<line|<polyline)/.test(arrow), 'the back arrow is drawn, not an empty string');
  // The mirror of ti-arrow-right. A left arrow's shaft runs from the right edge
  // to the left, and its head points left — so the first x is the larger one.
  const pts = arrow.match(/points="([^"]+)"/);
  assert.ok(pts, 'the back arrow has a polyline head');
  const nums = pts[1].trim().split(/[\s,]+/).map(Number);
  assert.ok(nums[0] > nums[2], 'the arrowhead points left, not right');
  const right = map.get('ti-arrow-right').match(/points="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);
  assert.ok(right[0] < right[2], 'and ti-arrow-right still points right');
});

test('every path in the map is drawable markup, so a typo fails here not on his phone', () => {
  const map = iconPaths();
  const DRAW = /<(path|line|circle|rect|polyline|polygon|ellipse)[\s/]/;
  for (const [cls, svg] of map) {
    assert.ok(svg.trim().length > 0, `${cls} has a path`);
    assert.ok(DRAW.test(svg), `${cls} contains something to draw`);
    assert.ok(!svg.includes("'"), `${cls} holds no apostrophe to break its quoted string`);
    const stack = [];
    for (const m of svg.matchAll(/<(\/?)([a-z]+)[^>]*?(\/?)>/g)) {
      if (m[3] === '/') continue;
      if (m[1] === '/') assert.strictEqual(stack.pop(), m[2], `${cls} closes <${m[2]}> in order`);
      else stack.push(m[2]);
    }
    assert.deepStrictEqual(stack, [], `${cls} leaves no tag open`);
  }
});

test('the arrow is wired, and it is shown exactly where there is somewhere to go back to', () => {
  assert.match(html, /<i class="ti ti-arrow-left" id="hdr-back" onclick="goBackScreen\(\)"/,
    'the header arrow runs goBackScreen');
  assert.match(html, /id="hdr-back"[^>]*aria-label="Back"/,
    'and it says what it is, for a screen reader');
  // Hidden on Home, shown on every other screen. This is the line that decides
  // whether the button exists for him on a phone with no browser back.
  assert.match(html, /backEl\.style\.display=\(id==='home'\)\?'none':''/,
    'switchTo hides the arrow on Home and shows it everywhere else');
  // The iPhone fallback: the swipe / hardware back walks the same history.
  assert.match(html, /function armAppBackTrap\(\)/, 'the swipe-back trap is still there');
});
