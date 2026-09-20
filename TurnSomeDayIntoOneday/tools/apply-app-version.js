// Move the app version — index.html and the service worker cache name together.
//
//   node tools/apply-app-version.js 5.0        # set it
//   node tools/apply-app-version.js 5.0 --check # report, change nothing
//
// index.html is 1MB, past what the editor can open, so it is patched by script
// here too. Two strings carry the version and they are read back and compared
// before anything is written:
//
//   index.html   const APP_VERSION='…'        what Profile says
//   sw.js        const CACHE_NAME='tsid-shell-v…'   what the phone has cached
//
// Profile calls it "App version" and it is kept in step with the cache name, so
// the two are never allowed to disagree: if they already do, this stops rather
// than picking one. The version is Jacques's to choose, not a build number —
// asked on 20 Sep 2026 to take it back to 5.0, which is why it went down and
// not up. server/test/sw-version.test.js holds the pair together either way.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const want = (process.argv[2] || '').replace(/^v/, '');
const CHECK = process.argv.includes('--check');
if (!/^\d+(\.\d+)*$/.test(want)) {
  console.error('usage: node tools/apply-app-version.js <version>   e.g. 5.0');
  process.exit(1);
}

let page = fs.readFileSync(APP, 'utf8');
let sw = fs.readFileSync(SW, 'utf8');

const appRe = /const APP_VERSION='([\d.]+)';/;
const cacheRe = /const CACHE_NAME = 'tsid-shell-v([\d.]+)';/;
const app = page.match(appRe);
const cache = sw.match(cacheRe);
if (!app) throw new Error('index.html does not declare APP_VERSION — refusing to guess');
if (!cache) throw new Error('sw.js does not declare CACHE_NAME — refusing to guess');
if (app[1] !== cache[1]) {
  throw new Error('the app and the cache name already disagree (' + app[1] + ' / ' + cache[1] +
    ') — this will not pick one of them for you');
}

if (app[1] === want) {
  console.log('app version: already ' + want + ' in index.html and sw.js, nothing written');
  process.exit(0);
}

if (CHECK) {
  console.log('app version would move ' + app[1] + ' -> ' + want + ' in index.html and sw.js');
  process.exit(0);
}

if (!page.includes(app[0])) throw new Error('index.html anchor vanished between read and write');
page = page.replace(appRe, "const APP_VERSION='" + want + "';");
sw = sw.replace(cacheRe, "const CACHE_NAME = 'tsid-shell-v" + want + "';");

// The service worker has to still parse: a broken one takes the app offline
// rather than merely failing to update. And the semicolon has to still be
// there — dropping it parses fine and quietly changes nothing, so both are
// checked before either file is written.
try {
  execFileSync(process.execPath, ['--check', '-'], { input: sw });
} catch (e) {
  throw new Error('the patched sw.js does not parse — nothing written');
}
if (!sw.includes("const CACHE_NAME = 'tsid-shell-v" + want + "';")) {
  throw new Error('the cache name did not come out whole — nothing written');
}
if (!page.includes("const APP_VERSION='" + want + "';")) {
  throw new Error('APP_VERSION did not come out whole — nothing written');
}

fs.writeFileSync(APP, page);
fs.writeFileSync(SW, sw);
console.log('app version: ' + app[1] + ' -> ' + want + '  (index.html APP_VERSION and sw.js cache name)');
