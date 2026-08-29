// 29 Aug 2026: a duplicate `const PLAY_PACKAGE` shipped in app 7.3. A duplicate
// declaration is a SyntaxError, and a SyntaxError means the browser parses NONE
// of the script - so every button in the app did nothing, including sign-in,
// and there was no error message anywhere because no code ran at all.
//
// index.html is one 733KB inline script and nothing was checking it. This does.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const APP = path.join(__dirname, '..', '..', 'index.html');

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

test('every inline script in index.html actually parses', () => {
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
  const pages = ['letter.html', 'reviews.html', 'admin-stats.html', 'landing.html'];
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
