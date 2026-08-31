// The service worker cache name and APP_VERSION must move together.
//
// sw.js says so in its own header comment: "the cache name now tracks
// APP_VERSION in index.html so the two cannot drift apart unnoticed again."
// Nothing enforced it, so they drifted anyway - the cache sat at v9.0 while
// index.html went 9.4, 9.5, 9.6. A stale cache name means the install event
// never repopulates the shell, so an installed user keeps being served the
// old precached copy of /app whenever the network answer is not used - which
// is exactly what "I'm seeing an old version" looks like from the outside.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

test('the service worker cache name matches APP_VERSION', () => {
  const cache = SW.match(/const CACHE_NAME = 'tsid-shell-v([\d.]+)'/);
  const app = APP.match(/const APP_VERSION='([\d.]+)'/);
  assert.ok(cache, 'sw.js must declare CACHE_NAME as tsid-shell-v<version>');
  assert.ok(app, 'index.html must declare APP_VERSION');
  assert.equal(cache[1], app[1],
    `sw.js caches v${cache[1]} but the app is ${app[1]} - bump CACHE_NAME with every release`);
});

test('every precached shell file is a real file', () => {
  // A missing entry no longer fails the install (it is tolerant), but it does
  // mean the file is silently not available offline.
  const list = SW.slice(SW.indexOf('const SHELL_FILES = ['), SW.indexOf('\n];'));
  const files = [...list.matchAll(/'(\/[^']*)'/g)].map(m => m[1]);
  assert.ok(files.length > 5, 'the shell list should not be empty');
  const missing = files.filter(f => {
    if (f === '/' || f === '/app') return false;         // routes, not files
    return !fs.existsSync(path.join(ROOT, f));
  });
  assert.deepEqual(missing, [], `precached but not in the repo: ${missing.join(', ')}`);
});
