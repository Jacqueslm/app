// What the Music page's scanner reads — 7 Oct 2026.
//
// Jacques: "a scanner i can scan for new music". A web address cannot list a
// folder: there is no way for a page to ask "what is in /audio/meditation/"
// and get an answer from static hosting alone. So the answer is produced for
// it — by this function at build time (vercel-build.js writes list.json beside
// the tracks) and by the server during a live Express run, which reads the
// folder as it is on disk, so a track dropped into the folder turns up on the
// next scan rather than waiting for somebody to edit a list by hand.
//
// Audio files only: a .json or a stray .txt in that folder is not music and
// must never arrive as a track with nothing behind it.
const fs = require('fs');

const AUDIO_FILE = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i;

function listFor(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && AUDIO_FILE.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch (err) {
    return null; // no folder at that address — the caller decides what that means
  }
}

module.exports = { listFor, AUDIO_FILE };
