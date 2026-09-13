// Where Studio keeps everything it owns — decided once, here.
//
// 13 Sep 2026 — Studio used to run on its own machine and keep its database,
// its media library and its auto-backups next to its own code. It now runs
// inside Turn Someday Into Day One, which is hosted, and that changes the one
// thing that matters: a hosted container's own disk is wiped on every deploy.
// The app's database survives because DB_PATH points at the persistent volume,
// so Studio's data goes beside it — otherwise every push to the repo would
// throw away every clip, character and scheduled post.
//
// A local install (no DB_PATH) keeps the old layout exactly: a data.sqlite,
// media/ and backups/ folder next to this file.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.STUDIO_DATA_DIR
  || (process.env.DB_PATH
    ? path.join(path.dirname(process.env.DB_PATH), 'studio')
    : __dirname);

// Made here, once, before any caller opens a file in it: node:sqlite will not
// create the folder itself, and a fresh volume is an empty folder. Failing to
// make it is not fatal here - the caller that actually needs it will say so.
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

module.exports = {
  DATA_DIR,
  DB_PATH: path.join(DATA_DIR, 'data.sqlite'),
  MEDIA_DIR: path.join(DATA_DIR, 'media'),
  BACKUP_DIR: path.join(DATA_DIR, 'backups', 'auto'),
};
