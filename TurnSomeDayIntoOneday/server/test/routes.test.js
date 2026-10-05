// Every link inside the app must land somewhere the server actually serves.
//
// Written 15 Aug 2026, after a site audit found six errors and five of them
// came from ONE missing route: /do-i-have-a-binge-eating-problem-quiz. The page
// file existed, so it looked fine in the repo — but express.static only serves
// it at the .html address, and there is no catch-all (deliberately: unknown
// paths must keep 404ing). So the clean URL 404'd while two pages linked to it.
//
// That is invisible in code review and invisible in the browser unless you
// happen to click the exact link. It is not invisible here.
//
// 5 Oct 2026: the marketing pages, the sitemap and the per-competitor routes
// all went, and this file got shorter with them. What it guards now is the
// handful of addresses the app itself still points at.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
//
// NOT `node --test test/`. On Node 22 that tries to LOAD a module called
// `test` instead of globbing the folder, and reports a single mysterious
// "not ok 1 - test / ERR_TEST_FAILURE" while every real test passes. It cost a
// session a scare on 28 Aug 2026. `npm test` runs `node --test test/*.test.js`,
// which is the form that actually works.
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
  // The ALT_PAGES loop (fourteen "<app> alternative" routes) used to be read
  // out of the source here. Those routes went on 5 Oct 2026, so there is
  // nothing to expand.
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

// The sitemap test that used to run here went on 5 Oct 2026 with the file it
// read. A sitemap exists to hand a search engine a list of pages to carry, and
// this site now tells every crawler to stay out (robots.txt, "Disallow: /").
// The old test walked it and failed on any URL that 404'd; the honest version
// of that check now is that neither half of the pair comes back.
test('nothing invites a crawler in: no sitemap, and robots.txt still shuts the door', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'sitemap.xml')),
    'a sitemap must not come back - it is a list of pages offered to a search engine');
  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  assert.match(robots, /^Disallow: \/$/m, 'robots.txt must still turn everything away');
});

test('no page links to a clean URL that has no route', () => {
  // This is the one that caught the marketing links left behind in
  // delete-account.html when the pages they pointed at were deleted.

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
