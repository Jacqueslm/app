// Digital Asset Links is what lets the Android app run as a real app instead of
// a browser tab, and Chrome fetches it with redirects DISABLED - a 301 is not
// followed, it is a verification failure. That makes route ORDER load-bearing:
// the apex->www redirect must never see this path. These tests hold that down,
// plus the two content facts Google's checker cares about.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SERVER = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const FILE = path.join(__dirname, '..', '..', '.well-known', 'assetlinks.json');
const MANIFEST = path.join(__dirname, '..', '..', 'twa', 'twa-manifest.json');

test('the assetlinks route is registered BEFORE the apex redirect', () => {
  const route = SERVER.indexOf("app.get(ASSETLINKS_PATH");
  const redirect = SERVER.indexOf("res.redirect(301, `https://${CANONICAL_HOST}");
  assert.ok(route > 0, 'the assetlinks route exists');
  assert.ok(redirect > 0, 'the apex redirect exists');
  assert.ok(route < redirect,
    'assetlinks must be served before the redirect - Chrome does not follow one');
});

test('nothing that redirects is registered ahead of it', () => {
  const before = SERVER.slice(0, SERVER.indexOf("app.get(ASSETLINKS_PATH"));
  assert.ok(!/res\.redirect\(/.test(before),
    'no redirect may run before the assetlinks route');
});

test('it is served as application/json', () => {
  assert.match(SERVER, /res\.type\('application\/json'\)\.sendFile\(ASSETLINKS_FILE\)/,
    'content type is set explicitly, not inferred');
});

test('the file is valid, complete, and names the right app', () => {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  assert.ok(Array.isArray(data) && data.length >= 1, 'a non-empty statement list');
  const t = data[0].target;
  assert.deepEqual(data[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(t.namespace, 'android_app');
  assert.equal(t.package_name, 'com.turnsomedayintodayone.app');
  assert.ok(Array.isArray(t.sha256_cert_fingerprints));
});

test('BOTH fingerprints are present - upload key and Play app signing key', () => {
  const fps = JSON.parse(fs.readFileSync(FILE, 'utf8'))[0].target.sha256_cert_fingerprints;
  assert.ok(fps.length >= 2,
    'Play App Signing means two certificates matter: the upload key and the key Google re-signs with. One alone fails verification.');
  for (const fp of fps) {
    assert.match(fp, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/,
      `fingerprint must be 32 upper-case hex pairs separated by colons: ${fp}`);
  }
  assert.equal(new Set(fps).size, fps.length, 'no duplicate fingerprints');
});

test('the host the app declares is the canonical host the server serves', () => {
  const declared = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).host;
  const m = SERVER.match(/CANONICAL_HOST = process\.env\.CANONICAL_HOST \|\| '([^']+)'/);
  assert.ok(m, 'canonical host default is readable');
  assert.equal(declared, m[1],
    'twa-manifest host and the server canonical host must be the same origin');
});
