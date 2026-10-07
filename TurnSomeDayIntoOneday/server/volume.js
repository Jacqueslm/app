// Where the app keeps the files that have to outlive a deploy — decided once.
//
// 13 Sep 2026, Jacques: "how you do that". Attaching the volume was the easy
// half. The other half was typing DB_PATH into Railway's Variables tab and
// getting it identical to the volume's mount path — a typo, a trailing space or
// a differently chosen path and the app boots happily, writes to the container's
// throwaway disk, and throws away every day count and journal entry on the next
// deploy. Silently, and only days later. That is the failure this file removes.
//
// Railway publishes the mount path it actually used as RAILWAY_VOLUME_MOUNT_PATH,
// so the app reads that and names its own file inside it. Attaching the volume is
// now the entire setup, and whatever mount path he picked works.
//
// DB_PATH still wins when it is set: every test sets it, and so does any
// deployment that predates the volume. A home install sets neither, so there is
// no VOLUME_DIR and files stay beside the code exactly as they always have.
const path = require('path');

function volumeDirFrom(env) {
  const e = env || {};
  if (e.DB_PATH) return path.dirname(String(e.DB_PATH));
  // Railway pastes what it has; a stray space or newline is not a different path.
  return String(e.RAILWAY_VOLUME_MOUNT_PATH || '').trim();
}

const VOLUME_DIR = volumeDirFrom(process.env);

module.exports = { volumeDirFrom, VOLUME_DIR };
