// Every clean URL this site promises must actually be served.
//
// Written 15 Aug 2026, after a site audit found six errors and five of them
// came from ONE missing route: /do-i-have-a-binge-eating-problem-quiz. The page
// file existed, so it looked fine in the repo — but express.static only serves
// it at the .html address, and there is no catch-all (deliberately: unknown
// paths must keep 404ing). So the clean URL 404'd while the sitemap listed it
// and two pages linked to it.
//
// That is invisible in code review and invisible in the browser unless you
// happen to click the exact link. It is not invisible here.
//
// Run:  node --test TurnSomeDayIntoOneday/server/test/
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');

function routedPaths() {
  const routes = new Set(
    [...SRC.matchAll(/app\.(?:get|use)\(\s*'\/([a-z0-9\-/.]*)'/g)].map((m) => m[1]),
  );
  // Pages served by the ALT_PAGES loop rather than one call each.
  const block = SRC.match(/const ALT_PAGES = \[(.*?)\];/s);
  if (block) for (const m of block[1].matchAll(/'([a-z0-9\-]+)'/g)) routes.add(m[1]);
  return routes;
}

function staticFiles() {
  return new Set(fs.readdirSync(ROOT).filter((f) => fs.statSync(path.join(ROOT, f)).isFile()));
}

// express.static serves a file only at its exact name, extension included.
function isServed(urlPath, routes, files) {
  const s = urlPath.replace(/^\/+|\/+$/g, '');
  if (s === '' || routes.has(s) || files.has(s)) return true;
  return ['api', 'go', 'icons', 'og', 'assets', 'data', 'fonts', 'img'].includes(s.split('/')[0]);
}

test('every URL in sitemap.xml has a route or a real file behind it', () => {
  const routes = routedPaths();
  const files = staticFiles();
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const bad = [];
  for (const m of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)) {
    const url = m[1];
    const p = url.includes('.com/') ? '/' + url.split('.com/')[1] : '/';
    if (!isServed(p, routes, files)) bad.push(url);
  }
  assert.deepStrictEqual(bad, [], `sitemap lists URLs that 404:\n  ${bad.join('\n  ')}`);
});

test('no page links to a clean URL that has no route', () => {
  const routes = routedPaths();
  const files = staticFiles();
  const bad = [];
  for (const f of fs.readdirSync(ROOT).filter((n) => n.endsWith('.html'))) {
    const body = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of body.matchAll(/href="(\/[^"#?]*)"/g)) {
      if (!isServed(m[1], routes, files)) bad.push(`${f} -> ${m[1]}`);
    }
  }
  assert.deepStrictEqual(bad, [], `broken internal links:\n  ${bad.join('\n  ')}`);
});

test('every canonical tag points at a URL this server actually serves', () => {
  // A canonical pointing at a 404 tells Google the real page does not exist.
  const routes = routedPaths();
  const files = staticFiles();
  const bad = [];
  for (const f of fs.readdirSync(ROOT).filter((n) => n.endsWith('.html'))) {
    const body = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const m = body.match(/<link rel="canonical" href="([^"]+)"/);
    if (!m) continue;
    const p = m[1].includes('.com/') ? '/' + m[1].split('.com/')[1] : '/';
    if (!isServed(p, routes, files)) bad.push(`${f} -> ${m[1]}`);
  }
  assert.deepStrictEqual(bad, [], `canonical tags pointing at 404s:\n  ${bad.join('\n  ')}`);
});
