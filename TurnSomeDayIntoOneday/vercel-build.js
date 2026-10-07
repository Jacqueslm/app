// What Vercel is allowed to serve as plain files — and, more to the point, what
// it is not.
//
// Vercel hands a request to a file before any code of ours runs ("precedence is
// given to the filesystem prior to rewrites being applied", from Vercel's own
// vercel.json docs). That is the whole problem with moving The Truth there: if
// herbs.html, key.html, tax.html, fight.html, game3d.html and hub.html sit in
// the deployment as files, then /herbs.html and its four siblings are readable
// by anybody who types the name, password or no password. The gate only works
// if the pages are not files.
//
// So the deployment's static output is this folder, webroot, and the build step
// below fills it with the things that are genuinely public — the icons, the
// ring's three.js, the fight's photos and crowd, the manifests — and with
// nothing else. Every .html file is left out on purpose. The private pages are
// reached through the function (api/index.js), which reads them out of the
// repository and checks the password first.
//
// Only what the pages actually ask for is copied: the rest of this folder
// (audio/, data/, the marketing pages, the two book scans) belonged to the
// recovery app or to the public site and would be weight with no reader.
//
// This runs as Vercel's build command, and the test suite runs it too — into a
// temporary folder — to prove that no page ever lands where the world can read
// it.
const fs = require('fs');
const path = require('path');
const { listFor } = require('./server/music-list');

const ROOT = __dirname;

// Directories, as they sit in the repository. img/fight is the fight's own
// pictures and audio/fight its crowd; the ring's engine is js/ring3d-three.js.
// audio/meditation is the meditation room's eleven tracks, played by the Music
// page (5 Oct 2026) — they belong here rather than in the function because the
// music player streams them straight from disk.
const DIRS = ['icons', 'js', 'img/fight', 'audio/fight', 'audio/meditation'];
// Loose files. Each one is either linked by a page or fetched by the browser.
// robots.txt is fetched by a crawler before it fetches anything else, and it is
// the one file whose absence is not quiet: a site with none at its root reads to
// most crawlers as "carry on", where this one says "stay out". It was eating
// the 404 for it until 6 Oct 2026 — the file was in the repository and simply
// never copied, so the live root answered 404 and the door stood open.
const FILES = [
  'manifest.json', 'manifest-discrete.json', 'manifest-zodiacs.json', 'sw.js',
  'robots.txt',
];

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
  }
}

// The rule the whole file exists for, checked rather than assumed: a page in the
// public folder is a page served to the world, and it would happen silently.
function checkNoPages(out) {
  const strays = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.html?$/i.test(entry.name)) strays.push(path.relative(out, full));
    }
  })(out);
  if (strays.length) {
    throw new Error(
      'A page landed in the public webroot, where Vercel would hand it out '
      + 'before any password check runs: ' + strays.join(', '));
  }
  return strays;
}

function build(opts) {
  const o = opts || {};
  const out = o.out || path.join(ROOT, 'webroot');
  const dirs = o.dirs || DIRS;
  const files = o.files || FILES;

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const copied = [];
  for (const dir of dirs) {
    const from = path.join(ROOT, dir);
    if (!fs.existsSync(from)) continue;   // a host without a folder is not a broken host
    copyDir(from, path.join(out, dir));
    copied.push(dir + '/');
  }
  for (const file of files) {
    const from = path.join(ROOT, file);
    if (!fs.existsSync(from)) continue;
    fs.copyFileSync(from, path.join(out, file));
    copied.push(file);
  }

  // The Music page's scanner asks what is in the meditation folder, because a
  // web address cannot list one (7 Oct 2026). It is written fresh on every
  // build, so a track added to the folder reaches the next scan without
  // anybody editing a list by hand — and it lands here, beside the tracks it
  // describes, where the static layer hands it out before any code runs.
  const medOut = path.join(out, 'audio', 'meditation');
  if (fs.existsSync(medOut)) {
    const tracks = listFor(medOut) || [];
    fs.writeFileSync(path.join(medOut, 'list.json'), `${JSON.stringify(tracks, null, 2)}\n`);
    copied.push('audio/meditation/list.json');
  }

  checkNoPages(out);
  if (!o.quiet) {
    console.log(`Vercel build: copied ${copied.length} public entries into ${path.relative(ROOT, out) || '.'}/, and no pages.`);
  }
  return copied;
}

if (require.main === module) build();

module.exports = { build, checkNoPages, ROOT, DIRS, FILES, out: () => path.join(ROOT, 'webroot') };
