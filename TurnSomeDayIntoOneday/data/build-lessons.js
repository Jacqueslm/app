// Merges the per-pack source files in data/lessons/lesson1.json..lesson11.json into
// data/lessons.json, the single file the app actually fetches at runtime. Run this after
// editing any file under data/lessons/ and commit the regenerated data/lessons.json alongside.
//
//   node data/build-lessons.js

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, 'lessons');
const OUTPUT_FILE = path.join(__dirname, 'lessons.json');
// Full content for the paid days lives under server/, which is NOT web-served, so it can
// only be reached through the Pro-entitlement check on GET /api/lessons/pro.
const PRO_OUTPUT_FILE = path.join(__dirname, '..', 'server', 'lessons-pro.json');
const PACK_COUNT = 11;
const FREE_LESSON_CAP = 15;

const merged = {};

for (let i = 1; i <= PACK_COUNT; i++) {
  const file = path.join(SOURCE_DIR, `lesson${i}.json`);
  const pack = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!pack.title || !Array.isArray(pack.items)) {
    throw new Error(`${file} must have a "title" string and an "items" array`);
  }
  if (Object.prototype.hasOwnProperty.call(merged, pack.title)) {
    throw new Error(`Duplicate pack title "${pack.title}" (from ${file})`);
  }
  merged[pack.title] = pack.items;
}

// Split into a public file (free days in full; paid days as title + short teaser only, for
// the locked-view upsell) and a server-only file (paid days in full).
const publicLessons = {};
const proLessons = {};
for (const [category, items] of Object.entries(merged)) {
  publicLessons[category] = items.map((l) => {
    if (l.day <= FREE_LESSON_CAP) return l;
    return {
      day: l.day,
      title: l.title,
      teaser: (l.content || '').slice(0, 140).trim() + '…',
      pro: true,
    };
  });
  proLessons[category] = items.filter((l) => l.day > FREE_LESSON_CAP);
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(publicLessons, null, 2) + '\n');
fs.writeFileSync(PRO_OUTPUT_FILE, JSON.stringify(proLessons, null, 2) + '\n');
console.log(`Wrote ${OUTPUT_FILE} (public: free days full, paid days teaser-only).`);
console.log(`Wrote ${PRO_OUTPUT_FILE} (paid days full content, server-only).`);
