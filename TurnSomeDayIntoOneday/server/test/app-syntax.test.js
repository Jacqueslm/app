// 29 Aug 2026: a duplicate `const PLAY_PACKAGE` shipped in app 7.3. A duplicate
// declaration is a SyntaxError, and a SyntaxError means the browser parses NONE
// of the script - so every button in the app did nothing, including sign-in,
// and there was no error message anywhere because no code ran at all.
//
// The app's own page was one 733KB inline script and nothing was checking it.
// This does.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// 4 Oct 2026: this read the recovery app's page, which is deleted. hub.html is
// the app now, and it brings its own inline script, so the same guard moves with
// it.
const APP = path.join(__dirname, '..', '..', 'hub.html');

// Only real JavaScript. A <script type="application/ld+json"> block holds
// structured data for search engines and is not JS - checking it as JS reports
// a syntax error on a perfectly good page.
const JS_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'module']);
function inlineScripts(file) {
  const html = fs.readFileSync(file, 'utf8');
  const out = [];
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1];
    if (/\bsrc=/.test(attrs)) continue;
    const type = (attrs.match(/\btype\s*=\s*["']([^"']*)["']/) || ['', ''])[1].toLowerCase().trim();
    if (!JS_TYPES.has(type)) continue;
    out.push(m[2]);
  }
  return out;
}

test('every inline script in the app shell actually parses', () => {
  const blocks = inlineScripts(APP);
  assert.ok(blocks.length > 0, 'found inline scripts to check');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-syntax-'));
  try {
    blocks.forEach((src, i) => {
      const f = path.join(dir, `block${i}.js`);
      fs.writeFileSync(f, src);
      try {
        execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
      } catch (err) {
        const detail = (err.stderr || Buffer.from('')).toString().split('\n').slice(0, 6).join('\n');
        assert.fail(`inline script block ${i} does not parse - the whole app is dead in the browser:\n${detail}`);
      }
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the other shipped HTML pages parse too', () => {
  const dirHtml = path.join(__dirname, '..', '..');
  // key.html is in here because it carries more inline script than any of the
  // others put together — the whole Key, its questionnaire and its AI pass — and
  // a SyntaxError in it leaves the page looking private and doing nothing.
  // herbs.html and tax.html joined on 15 Sep 2026, when the ask box put a live
  // AI in them; their scripts are now the longest of the reference pages.
  // trading-school.html and desk.html were on this list too until 24 Sep 2026,
  // when they were deleted with everything else trading: "remove the trading
  // game the desk everything about trading im done."
  // game3d.html joined on 16 Sep 2026 and fight.html on 4 Oct 2026, the ring and
  // the game around it; both came off this list on 10 Oct 2026 with the fight
  // itself - "delete the fight from everywhere". The rule they are here for has
  // not gone anywhere: hub.html above is the shell, and a SyntaxError in it
  // leaves an app that looks loaded and does nothing.
  // music.html joined on 5 Oct 2026. Its whole page is one inline script - the
  // player, the WAV cutter and the canvas cover maker - so a SyntaxError in it
  // leaves a page that looks loaded and does nothing.
  // trainer.html was on this list from 9 Oct 2026 until 10 Oct 2026, when the
  // trainer came off the app altogether - "Ddelete the trainer" - and the file
  // went with it. It came back on 11 Oct 2026 as a smaller page of the same name
  // - "start off with just basic input information that's it" - so it is back on
  // the list: it keeps what you type on the phone, and a SyntaxError in the
  // script that does the keeping leaves a form that looks fine and saves nothing.
  // certify.html joined on 12 Oct 2026. Its whole page is one inline script - the
  // two ninety-day tracks, the quizzes, the tests and the certificate - so a
  // SyntaxError in it leaves a page that looks loaded and does nothing, which is
  // exactly the failure this list was written for.
  // body.html and spells.html joined on 21 Oct 2026. body.html is mostly markup,
  // but spells.html keeps his own workings on the phone, and a SyntaxError in
  // the script that does the keeping would leave a form that looks fine and saves
  // nothing - the same failure this list exists for.
  const pages = ['key.html', 'herbs.html', 'letter.html', 'admin-stats.html', 'landing.html', 'tax.html', 'music.html', 'trainer.html', 'certify.html', 'body.html', 'spells.html'];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-syntax-pages-'));
  try {
    for (const page of pages) {
      const full = path.join(dirHtml, page);
      if (!fs.existsSync(full)) continue;
      inlineScripts(full).forEach((src, i) => {
        const f = path.join(dir, `${page}.${i}.js`);
        fs.writeFileSync(f, src);
        try {
          execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
        } catch (err) {
          const detail = (err.stderr || Buffer.from('')).toString().split('\n').slice(0, 6).join('\n');
          assert.fail(`${page} block ${i} does not parse:\n${detail}`);
        }
      });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
