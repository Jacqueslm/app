// Merges the per-pack source files in data/lessons/lesson1.json..lesson11.json into
// data/lessons.json, the single file the app actually fetches at runtime. Run this after
// editing any file under data/lessons/ and commit the regenerated data/lessons.json alongside.
//
//   node data/build-lessons.js

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, 'lessons');
const OUTPUT_FILE = path.join(__dirname, 'lessons.json');
const PACK_COUNT = 11;

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

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2) + '\n');
console.log(`Wrote ${OUTPUT_FILE} from ${PACK_COUNT} source packs.`);
