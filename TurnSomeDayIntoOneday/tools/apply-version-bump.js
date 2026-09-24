#!/usr/bin/env node
/* Move the app version across the four files that must move together.
 *
 *   node tools/apply-version-bump.js 5.1
 *
 * HANDOFF.md, under Versioning: sw.js (CACHE_NAME), index.html (APP_VERSION),
 * package.json and server/package.json move together on every user-visible
 * change, because the service worker cache name is what makes an installed
 * phone build a fresh shell instead of serving the copy of /app it already has.
 * Nothing enforced the four moving together, so they drifted (sw.js sat at v9.0
 * while index.html went 9.4, 9.5, 9.6) and server/test/sw-version.test.js was
 * written to catch the two that matter. This is the other half: it refuses to
 * touch anything unless all four currently name the same version, then writes
 * the new one to all four.
 *
 * index.html can only change through a script like this one - it is 1MB, and
 * the file tools match against a truncated read of it - so the bump lives here
 * rather than in a hand edit.
 *
 * Safe to run more than once: a second run reports the four are already at the
 * target and writes nothing.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const want = (process.argv[2] || '').trim().replace(/^v/, '');
if (!/^\d+(\.\d+)*$/.test(want)) {
  console.error('usage: node tools/apply-version-bump.js <version>   e.g. 5.1');
  process.exit(1);
}

// Each file, the pattern holding the current version, and how to say the new
// one. The pattern must match exactly once or the file has moved.
const FILES = [
  {
    file: 'sw.js',
    re: /const CACHE_NAME = 'tsid-shell-v(\d+(?:\.\d+)*)';/,
    build: (v) => `const CACHE_NAME = 'tsid-shell-v${v}';`,
  },
  {
    file: 'index.html',
    re: /const APP_VERSION='(\d+(?:\.\d+)*)';/,
    build: (v) => `const APP_VERSION='${v}';`,
  },
  {
    file: 'package.json',
    re: /"version": "(\d+(?:\.\d+)*)"/,
    build: (v) => `"version": "${v}"`,
  },
  {
    file: 'server/package.json',
    re: /"version": "(\d+(?:\.\d+)*)"/,
    build: (v) => `"version": "${v}"`,
  },
];

const loaded = FILES.map((f) => {
  const full = path.join(ROOT, f.file);
  const text = fs.readFileSync(full, 'utf8');
  const found = text.match(new RegExp(f.re.source, 'g')) || [];
  if (found.length !== 1) {
    throw new Error(`${f.file}: expected exactly one version line, found ${found.length}`);
  }
  const current = found[0].match(f.re)[1];
  return { ...f, full, text, current };
});

const versions = [...new Set(loaded.map((f) => f.current))];
if (versions.length !== 1) {
  const detail = loaded.map((f) => `${f.file}=${f.current}`).join(', ');
  throw new Error(`the four files disagree already (${detail}) - fix that first`);
}
const from = versions[0];

if (from === want) {
  console.log(`already at ${want} in all four files - nothing written`);
  process.exit(0);
}

let written = 0;
for (const f of loaded) {
  const next = f.text.replace(f.re, f.build(want));
  if (!next.includes(f.build(want))) throw new Error(`${f.file}: the new version did not land`);
  if (next === f.text) throw new Error(`${f.file}: no change was made`);
  fs.writeFileSync(f.full, next);
  written++;
  console.log(`${f.file}: ${from} -> ${want}`);
}
console.log(`${written} file(s) written`);
