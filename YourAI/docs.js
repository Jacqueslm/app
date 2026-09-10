// docs.js — what Your AI knows.
//
// The assistant is only as honest as the files it reads. This module discovers
// the repo's business documents (root *.md plus a curated reference set) and
// loads whichever ones the user ticks, fresh from disk on every message, so an
// edit made yesterday is what the AI sees today.
//
// Safety: the client never sends a path. It sends a key, and a key is only
// accepted if the server itself discovered it in this module — so a request
// can never read a file outside the allowed set.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');

// Curated set beyond the root *.md files. Root files are discovered
// automatically, so this list only needs to grow when a doc elsewhere in the
// repo becomes something Jacques actually works out of.
const EXTRA_DOCS = [
  'reference/marketing-playbook.md',
  'reference/medical-claims-audit.md',
  'reference/POST-LAUNCH-BUILD-LIST.md',
  'reference/marketing-content-pack.md',
  'TurnSomeDayIntoOneday/HANDOFF.md',
  'TurnSomeDayIntoOneday/docs/GAME-SPEC.md',
  'LeadCatch/README.md',
  'LeadCatch/MARKETING.md',
];

// Files too big to feed a model whole get cut off, with a note so the AI knows
// it only saw the beginning. 300KB is roughly the length of a long book.
const MAX_BYTES_PER_DOC = 300 * 1024;
// The client may tick up to this many docs per message.
const MAX_DOCS_PER_MESSAGE = 10;

// Docs that ship pre-ticked: the standing rules + the current status + the
// medical-claims audit, because every content question should answer from them.
const CORE_DOCS = [
  'CLAUDE.md',
  'START-HERE.md',
  'MASTER-STATUS.md',
  'reference/medical-claims-audit.md',
];

function readSize(file) {
  try {
    return fs.statSync(file).size;
  } catch (_) {
    return 0;
  }
}

function isMarkdown(file) {
  return /\.md$/i.test(file) && !file.startsWith('.');
}

function listDocs() {
  const out = [];

  // Every markdown file at the repo root — discovery, so new docs appear here
  // with no code change.
  let rootFiles = [];
  try {
    rootFiles = fs.readdirSync(REPO_ROOT);
  } catch (_) {
    rootFiles = [];
  }
  for (const name of rootFiles.sort()) {
    if (!isMarkdown(name)) continue;
    const rel = name;
    const size = readSize(path.join(REPO_ROOT, rel));
    if (size <= 0) continue;
    out.push({ key: rel, label: name, size, core: CORE_DOCS.includes(rel) });
  }

  for (const rel of EXTRA_DOCS) {
    const size = readSize(path.join(REPO_ROOT, rel));
    if (size <= 0) continue;
    out.push({
      key: rel,
      label: rel,
      size,
      core: CORE_DOCS.includes(rel),
    });
  }

  // Cores first (in a stable order), then everything else alphabetically.
  const core = CORE_DOCS
    .map((k) => out.find((d) => d.key === k))
    .filter(Boolean);
  const rest = out
    .filter((d) => !CORE_DOCS.includes(d.key))
    .sort((a, b) => a.label.localeCompare(b.label));
  return core.concat(rest);
}

// keys: client-sent keys. Returns the loaded docs; unknown or unreadable keys
// are skipped silently — the UI only offers keys this function produced.
function loadDocs(keys) {
  const allowed = new Map(listDocs().map((d) => [d.key, d]));
  if (!Array.isArray(keys)) return [];
  const seen = new Set();
  const loaded = [];
  for (const key of keys) {
    if (loaded.length >= MAX_DOCS_PER_MESSAGE) break;
    if (!allowed.has(key) || seen.has(key)) continue;
    seen.add(key);
    const file = path.join(REPO_ROOT, key);
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (_) {
      continue;
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_BYTES_PER_DOC) {
      text = text.slice(0, MAX_BYTES_PER_DOC) +
        '\n\n[… file cut off — too long to include whole …]';
    }
    loaded.push({ key, label: allowed.get(key).label, text });
  }
  return loaded;
}

module.exports = { listDocs, loadDocs, REPO_ROOT, MAX_DOCS_PER_MESSAGE };