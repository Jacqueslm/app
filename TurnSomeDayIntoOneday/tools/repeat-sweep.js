// Wording sweep: repeated copy across the shipped pages.
//   node tools/repeat-sweep.js
//
// Jacques, 11 Sep 2026: the readings repeat themselves in places and there was
// no way to see it. Almost all of the copy lives inside the pages' own scripts,
// in data tables and long strings, so long string literals are what get read —
// anything holding markup or an escaped quote is a template or a blob and is
// skipped. What comes out is the same line used more than once, the same
// sentence inside two different pieces, and the stock phrases, so the sweep is
// driven by what is actually on the pages rather than by memory.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = ['index.html', 'key.html'];

function values(html) {
  const out = [];
  const re = /"((?:[^"\\\n]|\\.){45,})"|'((?:[^'\\\n]|\\.){45,})'/g;
  for (const m of html.matchAll(re)) {
    const raw = m[1] || m[2];
    if (/\\["']/.test(raw)) continue;              // a blob holding other strings
    if (/[<>{}`;]/.test(raw)) continue;            // markup or code
    if (!/[a-z] [a-z]/i.test(raw)) continue;       // not prose
    const t = raw.replace(/\\n/g, ' ').replace(/\\(.)/g, '$1').replace(/\s+/g, ' ').trim();
    if (t.length < 45) continue;
    if (/^(https?:|\/|data:|image\/)/.test(t)) continue;
    out.push(t);
  }
  return out;
}

const norm = (s) => s.toLowerCase()
  .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  .replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

const items = [];
for (const p of PAGES) for (const s of values(fs.readFileSync(path.join(ROOT, p), 'utf8'))) items.push({ page: p, text: s });
console.log(`read ${items.length} pieces of prose (longer than 45 characters)\n`);

function group(list, get) {
  const map = new Map();
  for (const it of list) {
    const key = norm(get(it));
    if (!key) continue;
    if (!map.has(key)) map.set(key, { count: 0, pages: new Set(), hits: [], sample: get(it) });
    const e = map.get(key);
    e.count++; e.pages.add(it.page);
    if (e.hits.length < 3 && !e.hits.includes(it.page)) e.hits.push(it.page);
  }
  return [...map].filter(([, e]) => e.count > 1).sort((a, b) => b[1].count - a[1].count);
}

console.log('=== whole pieces used more than once ===');
const whole = group(items, (it) => it.text);
if (!whole.length) console.log('(none)');
for (const [, e] of whole) console.log(`${e.count}x [${e.hits.join(',')}] ${e.sample.slice(0, 170)}`);

console.log('\n=== the same sentence in two different pieces ===');
const sentences = [];
for (const it of items) {
  const parts = it.text.split(/(?<=[.!?])\s+/);
  if (parts.length < 2) continue;               // a one-sentence piece is covered above
  for (const s of parts) {
    const t = s.trim();
    if (t.length >= 45 && t.length <= 300) sentences.push({ page: it.page, text: t, whole: it.text });
  }
}
const dupes = group(sentences, (s) => s.text);
if (!dupes.length) console.log('(none)');
for (const [, e] of dupes) {
  console.log(`\n${e.count}x [${e.hits.join(',')}] ${e.sample}`);
}

console.log('\n=== stock phrases: five-word runs, 6 or more ===');
const runs = new Map();
for (const it of items) {
  const w = norm(it.text).split(' ');
  for (let i = 0; i + 5 <= w.length; i++) runs.set(w.slice(i, i + 5).join(' '), (runs.get(w.slice(i, i + 5).join(' ')) || 0) + 1);
}
for (const [k, c] of [...runs].sort((a, b) => b[1] - a[1])) {
  if (c < 6) break;
  console.log(`${String(c).padStart(4)}  ${k}`);
}
