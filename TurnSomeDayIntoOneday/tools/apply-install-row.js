// "Save to my phone" in the app's Profile — 18 Sep 2026.
//
//   node tools/apply-install-row.js
//
// Kept in the repo rather than thrown away, and safe to run twice: it skips what
// is already there and re-places the wiring block if it is in the wrong spot.
// Like tools/apply-key-player.js, this is surgery rather than an edit — the app
// page is 983KB and the developer file tools stop reading it partway through, so
// the row and the wiring go in by anchor.
//
// The same offer key.html already makes, in the app where the settings live:
//
//   1. Profile → About: one setting row, "Save to my phone";
//   2. before the BOOT banner: the wiring. Where the browser hands us a real
//      install prompt (Chrome, Android, Edge) that prompt is used; Safari has no
//      install button at all, so on an iPhone the two taps are explained. The
//      row retires itself once the app is already open from the home screen;
//   3. the app version, but only when index.html has fallen behind sw.js. The
//      cache name is the thing that actually reaches the phone, and a version
//      the two disagree on means the change never arrives.
//
// Nothing is downloaded and nothing is charged either way, and the row carries
// no claim about the app beyond what the manifest already says. The head needs
// nothing added: manifest.json, the apple-touch-icon and the four apple-* tags
// were already there.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'index.html');
let page = fs.readFileSync(FILE, 'utf8');

function once(needle, what) {
  const first = page.indexOf(needle);
  if (first === -1) throw new Error(what + ': anchor not found — refusing to guess');
  if (page.indexOf(needle, first + 1) !== -1) throw new Error(what + ': anchor is not unique in the file');
  return first;
}

/* --------------------------------------------------- 1. the row in Profile */
if (page.includes('id="d1-install-row"')) {
  console.log('row: already patched, skipping');
} else {
  const at = once('      <div class="setting-row" style="cursor:default">',
    'the version row in Profile');
  const row = [
    '      <!-- Save to my phone (18 Sep 2026). The same offer the Zodiacs page makes,',
    '           in Profile where the rest of the settings live. Chrome and Android hand',
    '           us a real install prompt; Safari has no such thing, so on an iPhone the',
    '           two taps are explained instead. The row retires itself once the app is',
    '           already open from the home screen — there is nothing left to offer. -->',
    '      <div class="setting-row" id="d1-install-row" onclick="dayOneInstall()">',
    '        <i class="ti ti-download"></i>',
    '        <div class="setting-row-txt"><p>Save to my phone</p><span>Its own icon, like a real app — no address bar</span></div>',
    '        <i class="ti ti-chevron-right" style="font-size:1.125rem;color:var(--tm)"></i>',
    '      </div>',
    '',
  ].join('\n');
  page = page.slice(0, at) + row + page.slice(at);
  console.log('row: inserted above the version row in Profile');
}

/* -------------------------------------------------------- 2. the wiring */
// Placed immediately before the BOOT banner, so boot reads as one block: the
// install helpers are defined, then the row is checked, then the app boots.
// Running this twice re-places the same block rather than adding a second one,
// so a wrong position can be corrected by running it again.
const BOOT = '// ─── BOOT ';
const BLOCK = '// ─── SAVE TO MY PHONE';
const END_OF_BLOCK = '\ndayOneInstallRow();\n';
const js = [
  BLOCK + ' ─────────────────────────────────────────────────────────',
  '// The same offer the Zodiacs page makes (see key.html), in Profile. Where the',
  '// browser offers a real install prompt — Chrome, Android, Edge — that prompt is',
  '// what gets used. Safari has no install button at all, so on an iPhone the two',
  '// taps are explained instead. Nothing is downloaded and nothing is charged',
  '// either way: it is this same app, with its own icon and no address bar, and',
  '// the data stays on the account.',
  'let dayOneInstallEvent=null;',
  'function dayOneStandalone(){',
  '  try{ if(window.matchMedia&&matchMedia(\'(display-mode: standalone)\').matches)return true; }catch(e){}',
  '  return navigator.standalone===true;',
  '}',
  'function dayOneApple(){',
  '  if(/iphone|ipad|ipod/i.test(navigator.userAgent||\'\'))return true;',
  '  // iPadOS 13+ reports itself as a Macintosh; a Mac with a touch screen is an iPad.',
  '  return /macintosh/i.test(navigator.userAgent||\'\')&&\'ontouchend\' in document;',
  '}',
  'function dayOneInstall(){',
  '  if(dayOneStandalone()){',
  '    appInfo(\'Already saved\',\'This app is already on your home screen, and it opened from there.\');',
  '    return;',
  '  }',
  '  if(dayOneInstallEvent){',
  '    try{ dayOneInstallEvent.prompt(); }catch(e){}',
  '    dayOneInstallEvent=null;',
  '    return;',
  '  }',
  '  if(dayOneApple()){',
  '    appInfo(\'Save it to your home screen\',',
  '      \'Tap the Share button in Safari — the square with the arrow coming out of the top — then scroll down the list and tap Add to Home Screen.\\n\\nIt sits next to your other apps with its own icon and no address bar. Nothing is downloaded and nothing is charged; it is this same app, and your days, journal and lessons stay on this account.\');',
  '    return;',
  '  }',
  '  appInfo(\'Save it to your home screen\',',
  '    \'Open the browser menu — the three dots or the three lines in the corner — and choose Install app, or Add to Home screen.\\n\\nIt opens in its own window with no address bar. Nothing is downloaded and nothing is charged; it is this same app, and your days, journal and lessons stay on this account.\');',
  '}',
  'window.addEventListener(\'beforeinstallprompt\',e=>{',
  '  e.preventDefault();',
  '  dayOneInstallEvent=e;',
  '  dayOneInstallRow();',
  '});',
  'function dayOneInstallRow(){',
  '  const row=document.getElementById(\'d1-install-row\');',
  '  if(!row)return;',
  '  // Opened from the home screen already: there is nothing to offer.',
  '  row.style.display=dayOneStandalone()?\'none\':\'\';',
  '}',
  'dayOneInstallRow();',
  '',
].join('\n');

// Where the block belongs: the whole of it, one blank line, then the banner.
const inPlace = (at, bootAt) => at + js.length + 1 === bootAt && page.slice(at, at + js.length) === js;
const at = page.indexOf(BLOCK);
if (at > -1 && inPlace(at, page.indexOf(BOOT))) {
  console.log('wiring: already in place ahead of the BOOT banner, skipping');
} else {
  // A previous run put it somewhere else: take it back out first — block,
  // trailing blank line and all — so the file cannot grow a copy each time.
  if (at > -1) {
    const end = page.indexOf(END_OF_BLOCK, at);
    if (end === -1) throw new Error('wiring: the install block has no end marker');
    let cut = end + END_OF_BLOCK.length;
    if (page[cut] === '\n') cut += 1;
    page = page.slice(0, at) + page.slice(cut);
  }
  const bootAt = once(BOOT, 'the BOOT banner');
  page = page.slice(0, bootAt) + js + '\n' + page.slice(bootAt);
  console.log(at > -1 ? 'wiring: moved ahead of the BOOT banner' : 'wiring: inserted ahead of the BOOT banner');
}

/* ------------------------------------------- 3. keep the version in step */
// sw.js is bumped by hand or by tools/rotate-stories.js; index.html has to say
// the same number or the app reports a version nobody is running.
const swFile = path.join(__dirname, '..', 'sw.js');
const sw = fs.readFileSync(swFile, 'utf8');
const cache = sw.match(/tsid-shell-v(\d+\.\d+)/);
if (!cache) {
  console.log('version: no cache name in sw.js, leaving index.html alone');
} else {
  const want = cache[1];
  const found = page.match(/const APP_VERSION='([\d.]+)';/);
  if (!found) throw new Error('version: no APP_VERSION in index.html — refusing to guess');
  if (found[1] === want) {
    console.log('version: already ' + want + ', skipping');
  } else {
    page = page.replace(found[0], "const APP_VERSION='" + want + "';");
    console.log('version: index.html ' + found[1] + ' -> ' + want + ' (sw.js cache)');
  }
}

fs.writeFileSync(FILE, page);
console.log('index.html written (' + page.length + ' chars)');
