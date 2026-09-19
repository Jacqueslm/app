// The daily (the "Today" tab), put into key.html — 19 Sep 2026.
//
//   node tools/apply-today.js
//
// Safe to run twice: it skips whatever is already there. Kept in the repo for
// the same reason tools/apply-key-player.js is: key.html is the one page here
// that is GENERATED ELSEWHERE (the Zodiac repo) and copied in, so the day that
// build writes over it, this is how the daily comes back.
//
// It is surgery rather than an edit because the file is 1.35MB and the engine
// this belongs beside is at the very bottom of it. The feature itself — the
// banner comment, the engine, the panel and the tab — is tools/today-block.html,
// split by its own markers, so none of it has to be escaped in here and the
// block can be read as the HTML it is.
//
// Seven insertions, every one anchored on text that is unique in the file. The
// script refuses to guess: if an anchor is missing it stops and changes nothing,
// which is the right answer on a page somebody else has rebuilt.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'key.html');
const BLOCK = path.join(__dirname, 'today-block.html');

const src = fs.readFileSync(BLOCK, 'utf8');
function piece(name, next){
  const a = src.indexOf('<!--@@' + name + '@@-->');
  if(a === -1) throw new Error('no ' + name + ' marker in tools/today-block.html');
  const b = next ? src.indexOf('<!--@@' + next + '@@-->') : src.length;
  if(b === -1) throw new Error('no ' + next + ' marker in tools/today-block.html');
  return src.slice(a + ('<!--@@' + name + '@@-->').length, b).replace(/^\n/, '').replace(/\n$/, '');
}
const HEAD = piece('HEAD', 'NAV');
const NAV = piece('NAV', 'PANEL');
const PANEL = piece('PANEL', 'END');

let page = fs.readFileSync(FILE, 'utf8');
const before = page.length;

if(page.includes('TODAY — THE DAILY, OFF THE TABLES THIS PAGE ALREADY HAS')){
  console.log('key.html already carries the daily — nothing to do.');
  process.exit(0);
}

function swap(what, find, replace){
  const at = page.indexOf(find);
  if(at === -1) throw new Error(what + ': anchor not found — refusing to guess');
  if(page.indexOf(find, at + 1) !== -1) throw new Error(what + ': anchor is not unique — refusing to guess');
  page = page.slice(0, at) + replace + page.slice(at + find.length);
  console.log('  ' + what);
}

/* 1. The block itself, at the end of the head — after the voice block, so its
      DOMContentLoaded listener runs after that one and the read bar is already
      on the panel when the wiring looks for it. */
swap('head: the daily, its engine, and its own copy of the day tables',
  '</head>', HEAD + '\n</head>');

/* 2. The tab, first in the nav, and opening the page. The address bar still
      wins: a shared reading opens its reading (see the last swap below). */
swap('nav: Today, ahead of Read a birthday',
  '  <button role="tab" id="tab-read"   aria-selected="true"  data-panel="panel-read">Read a birthday</button>',
  NAV + '\n  <button role="tab" id="tab-read"   aria-selected="false" data-panel="panel-read">Read a birthday</button>');

/* 3. The panel, ahead of the Read panel. */
swap('panel: the daily',
  '<!-- READ -->', PANEL + '\n\n<!-- READ -->');

/* 4. Read a birthday starts hidden, because Today is what opens. */
swap('panel-read: hidden until it is tapped',
  '<section class="panel" id="panel-read" role="tabpanel">',
  '<section class="panel" id="panel-read" role="tabpanel" hidden>');

/* 5 & 6. The voice block: it mounts a read bar on every tab it is told about,
      and it looks up which box on each tab holds the words. Miss either and the
      daily is the one screen with no way to be read aloud — the exact fault
      key-voice.test.js was written for. */
swap('voice: a read bar on the daily',
  "  /* The five tabs that had no bar. The birthday and The Key keep their own —\n     they came first, and their copies are written for a long read. */\n" +
  "  const BARS = ['panel-people', 'panel-pair', 'panel-matrix', 'panel-game', 'panel-wheel'];",
  "  /* The tabs that had no bar of their own. The birthday and The Key keep\n     theirs — they came first, and their copies are written for a long read.\n     Today joined on 19 Sep 2026 and takes this bar like the rest. */\n" +
  "  const BARS = ['panel-today', 'panel-people', 'panel-pair', 'panel-matrix', 'panel-game', 'panel-wheel'];");

swap('voice: the daily is read off the result box',
  "    'panel-key':    'k-result',",
  "    'panel-key':    'k-result',\n    'panel-today':  'td-result',");

/* 7. What the page does with no reading in the address bar. It used to put the
      cursor in the name box on the Read tab, which on a phone throws the
      keyboard up over a screen nobody asked for. Now the daily draws itself
      instead, and the reading is one tap away. */
swap('opening screen: the daily, with no keyboard over it',
  "if(!applyHash()) $('f-name').focus();",
  "if(!applyHash()) todayLoad();");

fs.writeFileSync(FILE, page);
console.log('key.html: ' + (page.length - before) + ' bytes added (' + before + ' -> ' + page.length + ')');
