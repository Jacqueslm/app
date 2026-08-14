// Auto-backup: rotating snapshots of data.sqlite, taken on server start and
// before every "Update my app". data.sqlite is the file that "hurts to lose"
// (account, characters, face locks, projects, captions) and it lives on one
// computer only — the manual Backup button ZIPs everything, but nothing
// reminded anyone to press it. These snapshots are the cheap insurance: they
// use SQLite's own VACUUM INTO, so a snapshot is a consistent copy even if a
// write is in flight, and they never touch the media folder (that is what the
// manual full backup is for).
//
// Retention is "keep the newest N", oldest deleted. A snapshot is a few MB,
// so keeping 8 costs nothing and gives a week+ of rollback points.
const path = require('path');
const fs = require('fs');

const BACKUP_DIR = path.join(__dirname, 'backups', 'auto');
const SNAPSHOT_RE = /^studio-\d{8}-\d{6}\.sqlite$/;
const KEEP = 8;

// studio-2026-08-14-093000.sqlite — lexicographic sort == chronological sort,
// which is what makes retentionCut a simple slice.
function snapshotName(now) {
  const d = now instanceof Date ? now : new Date(now || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  return `studio-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.sqlite`;
}

// Given snapshot filenames (sorted oldest→newest), return which to delete so
// the newest `keep` survive. Pure — unit-tested.
function retentionCut(names, keep) {
  const keepN = Number.isFinite(keep) && keep >= 0 ? keep : KEEP;
  const snaps = (names || []).filter((n) => SNAPSHOT_RE.test(n)).sort();
  return snaps.slice(0, Math.max(0, snaps.length - keepN));
}

// db: the node:sqlite DatabaseSync. Uses VACUUM INTO so the copy is consistent
// even mid-write. The path is built by us (no user input), so interpolating it
// with quote-escaping is safe.
function snapshot(db) {
  try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (_) {}
  const dest = path.join(BACKUP_DIR, snapshotName());
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  let names = [];
  try { names = fs.readdirSync(BACKUP_DIR); } catch (_) {}
  for (const n of retentionCut(names, KEEP)) {
    try { fs.unlinkSync(path.join(BACKUP_DIR, n)); } catch (_) {}
  }
  return dest;
}

module.exports = { snapshot, snapshotName, retentionCut, BACKUP_DIR, KEEP, SNAPSHOT_RE };
