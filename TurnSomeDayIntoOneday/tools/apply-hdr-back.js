// The header's back button has never drawn.
//
// Jacques, 19 Sep 2026: "no back button on app yet and on the iphone". He is
// right, and the cause is one line: the arrow is an <i class="ti ti-arrow-left">
// and ICON_PATHS has 'ti-arrow-right' but not 'ti-arrow-left'. renderIcons()
// returns early on a missing key (if(!paths)return), so the element stays empty
// and draws nothing at all - a back button that is in the markup, in the
// screen history, and invisible to the person holding the phone. On an iPhone
// there is no browser back button to fall back on, notably once the app is
// saved to the home screen, so this is the only way back except the swipe.
//
// Nine more classes used in the page were missing the same way and were drawing
// nothing: ti-movie (the 30-day film button), ti-chart-dots and ti-chart-candle
// (Tools tabs), ti-chess-knight, ti-compass, ti-key, ti-target-arrow, ti-ripple,
// and the lesson player's ti-player-skip-back / ti-player-skip-forward, whose
// buttons were blank at the two ends of the overlay.
//
// Run:  cd TurnSomeDayIntoOneday && node tools/apply-hdr-back.js
//
// Safe to run twice: it skips anything already present.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'index.html');
let page = fs.readFileSync(FILE, 'utf8');
const before = page.length;

// --- 1. the arrow itself and its nine siblings ---------------------------------
// Stroke-based paths on a 24x24 box, the same shape as every other entry in the
// map, because the svg renderIcons() writes is fill="none" stroke="currentColor".
const ICONS = [
  ['ti-arrow-left', '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 6 5 12 11 18"/>'],
  ['ti-movie', '<rect x="4" y="4" width="16" height="16" rx="2"/><line x1="8" y1="4" x2="8" y2="20"/><line x1="16" y1="4" x2="16" y2="20"/><line x1="4" y1="9" x2="8" y2="9"/><line x1="4" y1="15" x2="8" y2="15"/><line x1="16" y1="9" x2="20" y2="9"/><line x1="16" y1="15" x2="20" y2="15"/>'],
  ['ti-chart-dots', '<path d="M3 4v16h18"/><circle cx="9" cy="10" r="1.3"/><circle cx="13" cy="14" r="1.3"/><circle cx="17" cy="8" r="1.3"/>'],
  ['ti-chart-candle', '<path d="M3 3v18h18"/><line x1="10" y1="4" x2="10" y2="7"/><rect x="8" y="7" width="4" height="7" rx="0.6"/><line x1="10" y1="14" x2="10" y2="18"/><line x1="16" y1="6" x2="16" y2="9"/><rect x="14" y="9" width="4" height="5" rx="0.6"/><line x1="16" y1="14" x2="16" y2="17"/>'],
  ['ti-chess-knight', '<path d="M9 21h9v-2h-2c1.5-1.7 2-4 2-6.5C18 8 15.5 5 12.5 5c-1 0-2 .3-2.8.8L11 3 9 2 7.8 5C6.5 6.2 6 7.9 6 9.5c0 1.4.5 2.6 1.3 3.5L5 17h4"/><line x1="7" y1="21" x2="18" y2="21"/>'],
  ['ti-compass', '<circle cx="12" cy="12" r="9"/><polygon points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5"/>'],
  ['ti-key', '<circle cx="8" cy="8" r="3"/><line x1="10.2" y1="10.2" x2="20" y2="20"/><line x1="16.5" y1="16.5" x2="19" y2="14"/>'],
  ['ti-ripple', '<path d="M3 8c3-2.5 6-2.5 9 0s6 2.5 9 0"/><path d="M3 16c3-2.5 6-2.5 9 0s6 2.5 9 0"/>'],
  ['ti-target-arrow', '<circle cx="12" cy="12" r="1.2"/><path d="M12 7a5 5 0 1 0 5 5"/><path d="M13 3.1a9 9 0 1 0 7.9 7.9"/><path d="M12 12l7-7"/>'],
  ['ti-player-skip-back', '<path d="M20 5v14l-12-7z"/><line x1="4" y1="5" x2="4" y2="19"/>'],
  ['ti-player-skip-forward', '<path d="M4 5v14l12-7z"/><line x1="20" y1="5" x2="20" y2="19"/>'],
];

const missing = ICONS.filter(([cls]) => !page.includes(`'${cls}':`));
if (missing.length) {
  const anchor = "'ti-arrow-right':'";
  const at = page.indexOf(anchor);
  if (at < 0) throw new Error("could not find ICON_PATHS' ti-arrow-right entry to insert before");
  const note = [
    "// The header's back button is an <i class=\"ti ti-arrow-left\"> and there was no",
    '// ti-arrow-left in this map, so it rendered an EMPTY BOX - the app shipped',
    '// with a back button nobody could see or tap, which is the one control an',
    '// iPhone cannot do without. The ten below were missing the same way and were',
    '// drawing nothing: the film button, the Tools tabs, the Zodiacs / Key / Tools',
    '// rows, and the lesson player\'s back and forward buttons.',
    '// server/test/app-icons.test.js fails if any class used in the page is not in',
    '// this map, so the next one cannot ship invisible.',
    '',
  ].join('\n');
  const added = missing.map(([cls, paths]) => `'${cls}':'${paths}',`).join('\n');
  page = page.slice(0, at) + note + added + '\n' + page.slice(at);
  console.log(`icons: added ${missing.length} - ${missing.map(m => m[0]).join(', ')}`);
} else {
  console.log('icons: all present, skipped');
}

// --- 2. make it a thumb, not a pixel ------------------------------------------
// 22px of arrow with 4px of padding is a ~30px target. Apple's own guidance is
// 44px, and this is the button a person reaches for with one hand.
const OLD_TAG = '<i class="ti ti-arrow-left" id="hdr-back" onclick="goBackScreen()" style="font-size:1.375rem;color:#a0a8d0;cursor:pointer;display:none;padding:4px" title="Back"></i>';
const NEW_TAG = '<i class="ti ti-arrow-left" id="hdr-back" onclick="goBackScreen()" style="font-size:1.5rem;color:#a0a8d0;cursor:pointer;display:none;padding:9px;margin-left:-9px" title="Back" aria-label="Back"></i>';
if (page.includes(OLD_TAG)) {
  page = page.replace(OLD_TAG, NEW_TAG);
  console.log('arrow: tap target widened to 42px, aria-label added');
} else if (page.includes(NEW_TAG)) {
  console.log('arrow: already widened, skipped');
} else {
  throw new Error('could not find the header back arrow element');
}

if (page.length === before) {
  console.log('nothing written');
} else {
  fs.writeFileSync(FILE, page);
  console.log(`wrote index.html (${before} -> ${page.length} bytes)`);
}
