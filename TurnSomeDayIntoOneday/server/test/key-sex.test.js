// The woman-and-man layer, and the main-menu button — 5 Oct 2026.
//
// Jacques: "in the horoscope app add the option for female and male and add the
// difference between women and men they choose their sex the difference on life
// prospective naturing, expectations, roles in society make sure is modern ...
// put a back button on the horoscope or something thats takes all the selections
// back to the main menu".
//
// Two things are worth running rather than reading here. The layer is a set of
// passages picked by a choice, and the ways that goes wrong are quiet: the wrong
// half first, the other half missing, a passage with a word the house rules
// forbid, or a pronoun this app has been swept of. So renderSex is RUN with the
// page's own copy and its own escaper. The main-menu button is checked by its
// wiring, because what it does is navigation and that is one line each.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'key.html'), 'utf8');

/* The layer's own block: the passages and the function that draws them. */
function layerSource() {
  const a = PAGE.indexOf('const SEXREAD = [');
  const b = PAGE.indexOf('function renderReading(P){');
  assert.ok(a > -1, 'SEXREAD must be in key.html');
  assert.ok(b > a, 'and renderSex must sit with it, before renderReading');
  return PAGE.slice(a, b);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const render = new Function('esc', layerSource() + '; return renderSex;')(esc);
const HTML = { woman: render({ person: { sex: 'woman' } }), man: render({ person: { sex: 'man' } }), none: render({ person: {} }) };

const READ = PAGE.slice(PAGE.indexOf('id="panel-read"'), PAGE.indexOf('</section>', PAGE.indexOf('id="panel-read"')));

/* ------------------------------------------------------------------- the choice */

test('the read form offers woman, man, and a way to say neither', () => {
  assert.match(READ, /<label for="f-sex">/, 'the form must carry a label for it');
  assert.match(READ, /<select id="f-sex">/, 'and the select itself');
  assert.match(READ, /<option value="woman">Woman<\/option>/, 'woman is one of the answers');
  assert.match(READ, /<option value="man">Man<\/option>/, 'man is the other');
  assert.match(READ, /<option value="">Not saying<\/option>/, 'and it can be left alone');
  assert.strictEqual((PAGE.match(/id="f-year"/g) || []).length, 1,
    'adding a field must not have duplicated the one beside it');
});

test('the choice is read off the form, and read safely', () => {
  const at = PAGE.indexOf('function currentInput(){');
  const body = PAGE.slice(at, PAGE.indexOf('\n}', at));
  assert.match(body, /const sexEl = \$\(.f-sex.\);/, 'the form is asked for the choice');
  assert.match(body, /const sex = sexEl \? sexEl\.value : '';/, 'and a missing field is not a crash');
  assert.match(body, /name, month, day, year, sex\}/, 'it travels with the person');
});

test('the layer is drawn with the reading, not left out of it', () => {
  assert.match(PAGE, /renderDepth\(P\) \+\s*\n\s*renderSex\(P\) \+ renderPairStub/,
    'the reading must include it, between the deep layer and the rest');
});

/* -------------------------------------------------------------------- the layer */

test('four areas are drawn: life, care, what is expected, and the place held', () => {
  for (const html of [HTML.woman, HTML.man, HTML.none]) {
    assert.strictEqual((html.match(/class="dt"/g) || []).length, 4, 'four areas, no more and no less');
  }
  for (const heading of ['Life, looked at', 'Care and nurture', 'What is expected', 'The place held']) {
    assert.ok(HTML.none.includes(heading), `the layer must carry "${heading}"`);
  }
  assert.match(HTML.none, /<div class="layer sex">/, 'and it is its own layer, with its own heading colour');
  assert.match(PAGE, /\.layer\.sex > h3\{/, 'which is defined in the stylesheet');
});

test('the half that was chosen is put first, and the other one is still there', () => {
  assert.ok(HTML.woman.indexOf('As a woman.') < HTML.woman.indexOf('As a man.'),
    'choosing woman puts the woman first');
  assert.ok(HTML.man.indexOf('As a man.') < HTML.man.indexOf('As a woman.'),
    'choosing man puts the man first');
  assert.match(HTML.woman, /You said <b>woman<\/b>/, 'and it says so');
  assert.match(HTML.man, /You said <b>man<\/b>/);
  for (const html of [HTML.woman, HTML.man]) {
    assert.ok(html.includes('As a woman.') && html.includes('As a man.'),
      'both halves are always drawn — the choice orders them, it does not hide one');
  }
});

test('with no choice made, both halves are shown and nothing is invented', () => {
  assert.match(HTML.none, /Nobody has said which/, 'it says the choice was not made');
  assert.ok(!/You said/.test(HTML.none), 'and claims nothing about the person');
  assert.ok(HTML.none.includes('As a woman.') && HTML.none.includes('As a man.'));
});

test('the house rules hold: no medical claim, and no pronoun for either half', () => {
  const src = layerSource();
  for (const banned of ['research', 'brain', 'chemical', 'study', 'proven', 'cure', 'diagnos']) {
    assert.ok(!src.toLowerCase().includes(banned), `the layer must not say "${banned}"`);
  }
  for (const html of [HTML.woman, HTML.man, HTML.none]) {
    assert.doesNotMatch(html, /\b(she|her|hers|herself)\b/i, 'the sweep for she/her must hold');
    // The copy goes further than the rule asks and names nobody in the third
    // person at all, so a stray "he" is caught here rather than shipped.
    assert.doesNotMatch(html, /\b(he|him|his)\b/i, 'and nothing is written about a man in the third person either');
  }
  assert.match(HTML.none, /Written as description, not instruction/,
    'it says out loud what it is');
  assert.ok(!/https?:\/\//.test(src), 'and it sends nobody anywhere');
});

test('neither half is blamed, and neither is flattered out of the difficulty', () => {
  const src = layerSource();
  // The layer names a cost on each side. If one side ever became only praise or
  // only fault, this is the line that would notice.
  assert.ok(/What is reported as the cost/.test(src), 'the cost of the expected side is named');
  assert.ok(/nowhere to put the hard parts/.test(src), 'and so is the silence on the other');
  assert.ok(/nothing underneath it/.test(src), 'and what happens when the doing stops');
});

/* ---------------------------------------------------------------- the main menu */

test('the main-menu button is in the header, beside the help', () => {
  const at = PAGE.indexOf('<header class="top">');
  const head = PAGE.slice(at, PAGE.indexOf('</header>', at));
  assert.match(head, /id="btn-home"[^>]*>Main menu<\/button>/, 'a Main menu button in the header');
  assert.ok(head.indexOf('btn-home') < head.indexOf('btn-help'),
    'ahead of the help button, so the app row the player adds still lands after it');
});

test('one press puts the page back on the screen it opens on', () => {
  assert.match(PAGE, /function goHome\(\)\{/, 'the button needs its handler');
  assert.match(PAGE, /closest\('#btn-home'\)\) goHome\(\);/, 'and the handler must be wired to it');
  assert.match(PAGE, /showTab\('tab-today', true\);/, 'it lands on Today, the tab the page opens on');
  assert.match(PAGE, /if\(window\.todayShow\) window\.todayShow\(\);/, 'and draws the morning there');
});

test('it closes what is open and throws the walked steps away', () => {
  const at = PAGE.indexOf('function goHome(){');
  const body = PAGE.slice(at, PAGE.indexOf('\n}', PAGE.indexOf('showTab(\'tab-today\'', at)));
  assert.match(body, /stopSpeaking\(\)/, 'anything being read is stopped');
  assert.match(body, /help-box/, 'the instructions close');
  assert.match(body, /voicebar/, 'so does the voice picker');
  assert.match(body, /simple-box/, 'and the short version goes back to the long one');
  assert.match(body, /BACK = \[\];/, 'the steps it would have walked are dropped');
  assert.match(body, /backPaint\(\);/, 'so the corner arrow is asked to hide itself');
  assert.match(body, /history\.go\(-steps\)/, 'and the phone back button is not left with stale entries');
});

test('a silent tab change records no step, so the arrow stays hidden', () => {
  assert.match(PAGE, /function showTab\(id, silent\)\{/, 'showTab takes the flag');
  assert.match(PAGE, /if\(!silent\) backPush\(\{k:'tab', id:already\.id\}\);/,
    'and only records a step when it was not asked to stay quiet');
  // Everywhere else still calls it the old way, one argument.
  assert.match(PAGE, /showTab\('tab-read'\); doRead\(\);/, 'the shared-link path is untouched');
});

test('the help text tells somebody the button is there', () => {
  const help = PAGE.slice(PAGE.indexOf('<div class="help"'), PAGE.indexOf('</div>', PAGE.indexOf('btn-help-close')));
  assert.match(help, /<strong>Main menu<\/strong>/, 'the instructions name it');
  assert.match(help, /back on the screen the page opens on/, 'and say what it does');
});
