// The reading player, put into key.html — 18 Sep 2026.
//
//   node tools/apply-key-player.js
//
// Kept in the repo rather than thrown away, and safe to run twice: it skips
// whatever is already there. key.html is the one page in this repo that is
// generated elsewhere (the Zodiac side) and copies into here, so the day it is
// regenerated, this is how the player and the home-screen tags come back.
//
// It is surgery rather than an edit because the file is 1.3MB and the voice
// engine sits 1.30MB into it. The player itself is documented in the block this
// writes; this file is only the anchor points.
//
// Two insertions, both anchored on text that is unique in the file:
//
//   1. the head: the manifest, and the four meta tags iOS reads when the page
//      is saved to a home screen;
//   2. just before </body>: the reading player — pause that holds its place,
//      back/next by paragraph, a bar that stays on screen, where-you-left-off
//      kept on the device, the install button and a way out to the app.
//
// The player is APPENDED rather than edited into the voice engine because the
// engine sits 1.30MB into the file. Top-level function declarations in a classic
// script land on window, so it replaces speakReading/stopSpeaking by assignment.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'key.html');
let page = fs.readFileSync(FILE, 'utf8');
const before = page.length;

/* ---------------------------------------------------------------- 1. the head */
if (page.includes('manifest-zodiacs.json')) {
  console.log('head: already patched, skipping');
} else {
  const at = page.indexOf('<link rel="apple-touch-icon"');
  if (at === -1) throw new Error('apple-touch-icon link not found — refusing to guess');
  const eol = page.indexOf('\n', at);
  if (eol === -1) throw new Error('no end of line after the icon link');
  const head = [
    '',
    '<!-- Saved to a home screen (18 Sep 2026). Android and Chrome read the',
    '     manifest: its own name, its own moon icon, its own window with no',
    '     browser chrome. iPhone ignores the manifest\'s icons and uses the',
    '     apple-touch-icon above, so the four apple-* tags say the same thing in',
    '     the language that phone actually reads. Both point at the same page —',
    '     this one, at /key — so an icon saved from here opens here.',
    '',
    '     Keyed to the Zodiacs and NOT to the recovery app: two different apps,',
    '     two different pictures on the home screen. -->',
    '<link rel="manifest" href="manifest-zodiacs.json">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black">',
    '<meta name="apple-mobile-web-app-title" content="Zodiacs">',
  ].join('\n');
  page = page.slice(0, eol) + head + page.slice(eol);
  console.log('head: manifest + apple-* tags inserted');
}

/* --------------------------------------------------------- 2. the player */
const MARK = 'THE READING PLAYER';
if (page.includes(MARK)) {
  console.log('player: already patched, skipping');
} else {
  const close = page.lastIndexOf('</body>');
  if (close === -1) throw new Error('no </body> — refusing to guess');

  const block = `<!-- ─── ${MARK} ──────────────────────────────────────────────────────
     18 Sep 2026. Jacques: "when you hit pause on a reading it starts back to the
     beginning ... so I can fast forward to rewind pause continue where it left
     off ... so iPhone has to go completely out to go to another part of the app."

     He was right about the pause, and it was the honest kind of bug: the button
     said Pause and did Stop. It called speechSynthesis.cancel() and emptied the
     queue, so the only way on was the top of the reading again — and a reading
     here is forty-odd paragraphs. On a phone that is the whole reading gone.

     What this adds:

       - Pause that holds its place. The word being said is remembered from the
         engine's own boundary events, which the read-along already listens to,
         so Continue starts at that word rather than at the top of the screen.
         It CANCELS rather than calling speechSynthesis.pause(): pause/resume is
         the one corner of the speech API Safari on iOS is known to get wrong,
         and cancel-then-speak-the-rest behaves the same on every engine.
       - Back a paragraph / Next paragraph. A spoken reading has no scrub bar —
         there is no file to seek in, the voice is made as it goes — so rewind
         and fast forward are by paragraph, which is what a person wants anyway.
       - A bar that stays on screen while it reads: which line of how many, the
         words of that line, the two skips, pause/continue, stop, start over.
       - Where you left off is kept on the device. Leave for another part of the
         app, lock the phone, switch tabs — come back and the reading button
         says "Continue where it left off".
       - A way out to the rest of the app that does not have to close the page,
         and a button that saves this page to a phone's home screen.

     Nothing is invented here: the words come from the page's own
     readableBlocks(), the voice from its own pickVoice(), the highlighting from
     its own lightBlock()/lightWord(), the screen-wake from its own
     wakeAcquire(). It is a second script at the end of the page rather than an
     edit inside the voice engine because the engine sits 1.30MB into a 1.3MB
     file. Top-level function declarations in a classic script land on window,
     so speakReading and stopSpeaking are REPLACED BY ASSIGNMENT — the page's own
     buttons, its tab switch and its voice picker all arrive at this player
     without one line of the file being rewritten. -->
<script>
(function(){
  'use strict';

  /* ----------------------------------------------------------------- styles */
  var style = document.createElement('style');
  style.id = 'rp-style';
  style.textContent = [
    '#rp-bar{position:fixed;left:0;right:0;bottom:0;z-index:80;background:rgba(10,9,20,.97);border-top:1px solid var(--line);padding:10px 12px 13px;font-family:var(--sans);box-shadow:0 -10px 30px rgba(0,0,0,.5)}',
    '#rp-bar[hidden]{display:none}',
    'body.rp-on{padding-bottom:118px}',
    '.rp-where{display:flex;align-items:baseline;gap:10px;max-width:760px;margin:0 auto 8px}',
    '.rp-where b{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dimmer);white-space:nowrap}',
    '.rp-now{flex:1;min-width:0;color:var(--dim);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.rp-over{flex:0 0 auto;background:none;border:none;color:var(--dimmer);font:inherit;font-size:11.5px;text-decoration:underline;cursor:pointer;padding:0}',
    '.rp-row{display:flex;gap:8px;max-width:760px;margin:0 auto}',
    '.rp-btn{flex:1;min-width:0;font:inherit;font-size:13px;color:var(--ink);background:var(--card2);border:1px solid var(--line);border-radius:11px;padding:10px 4px;cursor:pointer}',
    '.rp-btn:active{transform:translateY(1px)}',
    '.rp-main{background:var(--gold);border-color:var(--gold);color:#1a1408;font-weight:600}',
    '.rp-topline{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}',
    '.rp-note{position:fixed;left:12px;right:12px;bottom:126px;z-index:81;max-width:520px;margin:0 auto;background:#12102a;border:1px solid var(--line);border-radius:14px;padding:14px 16px;color:var(--ink);font-size:13px;line-height:1.5;box-shadow:0 12px 40px rgba(0,0,0,.6)}',
    '.rp-note[hidden]{display:none}',
    '.rp-note h4{margin:0 0 8px;font-size:13px;letter-spacing:.02em}',
    '.rp-note p{margin:0 0 8px;color:var(--dim)}',
    '.rp-note button{margin-top:2px;font:inherit;font-size:12.5px;color:var(--ink);background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:7px 12px;cursor:pointer}',
  ].join('\\n');
  document.head.appendChild(style);

  /* ------------------------------------------------------------- the player */
  var MEM = 'personology.reading.v1';   // where each reading stopped, on this device
  var RP = { queue: [], at: 0, pos: 0, sig: '', speaking: false, paused: false, hold: null, tick: null };
  var ANDROID = /android/i.test(navigator.userAgent || '');
  var bar = null, count = null, now = null, main = null, note = null;

  function mkBar(){
    bar = document.createElement('div');
    bar.id = 'rp-bar';
    bar.hidden = true;
    bar.innerHTML =
      '<div class="rp-where">' +
        '<b id="rp-count">line 1 of 1</b>' +
        '<span class="rp-now" id="rp-now"></span>' +
        '<button class="rp-over" data-rp="over" title="Start this reading again from the top">Start over</button>' +
      '</div>' +
      '<div class="rp-row">' +
        '<button class="rp-btn" data-rp="back" title="Back a paragraph">&#8249; Back</button>' +
        '<button class="rp-btn rp-main" data-rp="play" title="Pause or continue">Pause</button>' +
        '<button class="rp-btn" data-rp="fwd" title="Forward a paragraph">Next &#8250;</button>' +
        '<button class="rp-btn" data-rp="stop" title="Stop — the place is kept">Stop</button>' +
      '</div>';
    document.body.appendChild(bar);
    count = bar.querySelector('#rp-count');
    now = bar.querySelector('#rp-now');
    main = bar.querySelector('[data-rp="play"]');
  }

  /* The page's own list of what is on screen, cut into the same ~240-character
     pieces its reader used (several engines truncate a very long utterance).
     'off' is where the piece starts inside its paragraph, because the read-along
     highlights by character position in the whole block. */
  function rpQueue(){
    var q = [];
    readableBlocks().forEach(function(b){
      var t = b.text;
      if(t.length <= 240){ q.push({ el: b.el, text: t, off: 0 }); return; }
      var re = /[^.!?]+[.!?]*/g, m, buf = '', bufAt = 0;
      var keep = function(){
        if(!buf) return;
        var lead = buf.length - buf.replace(/^\\s+/, '').length;
        q.push({ el: b.el, text: buf.trim(), off: bufAt + lead });
      };
      while((m = re.exec(t))){
        if(!buf){ buf = m[0]; bufAt = m.index; }
        else if((buf + m[0]).length > 240){ keep(); buf = m[0]; bufAt = m.index; }
        else buf += m[0];
      }
      keep();
    });
    return q;
  }

  function rpSig(){
    var blocks = readableBlocks();
    if(!blocks.length) return '';
    var all = blocks.map(function(b){ return b.text; }).join(' ');
    return blocks.length + ':' + all.length + ':' + all.slice(0, 40);
  }

  function rpMemory(){
    try{ return JSON.parse(localStorage.getItem(MEM) || 'null'); }catch(e){ return null; }
  }
  function rpSave(){
    if(!RP.queue.length) return;
    try{
      localStorage.setItem(MEM, JSON.stringify({
        sig: RP.sig || rpSig(), at: RP.at, pos: RP.pos, of: RP.queue.length
      }));
    }catch(e){}
  }

  /* ------------------------------------------------------------- the state */
  function rpBar(){
    if(!bar) return;
    var show = RP.speaking || RP.paused;
    bar.hidden = !show;
    document.body.classList.toggle('rp-on', show);
    if(!show) return;
    var of = RP.queue.length || 1;
    count.textContent = 'line ' + Math.min(RP.at + 1, of) + ' of ' + of;
    var bit = RP.queue[RP.at];
    now.textContent = bit ? bit.text.replace(/\\s+/g, ' ').slice(0, 90) : '';
    main.textContent = RP.speaking ? 'Pause' : 'Continue';
    document.querySelectorAll('.stop-btn').forEach(function(x){ x.hidden = false; });
  }

  /* The label is the only place the memory shows itself when the bar is away:
     "Read it to me" when there is nothing to continue, otherwise the offer to
     pick up where it stopped. Set on every panel's button, like the page's own
     speakLabel(), because which panel is open is not this function's business. */
  function rpLabels(){
    var text = RP.speaking ? 'Pause'
             : RP.paused ? 'Continue'
             : rpContinue() ? 'Continue where it left off'
             : 'Read it to me';
    document.querySelectorAll('.speak-btn').forEach(function(x){ x.textContent = text; });
  }

  function rpContinue(){
    var mem = rpMemory(), sig = rpSig();
    return !!(mem && sig && mem.sig === sig && (mem.at > 0 || mem.pos > 0));
  }

  /* ---------------------------------------------------------------- speaking */
  function rpTick(on){
    clearInterval(RP.tick); RP.tick = null;
    if(!on || ANDROID) return;
    /* Desktop Chrome stops speaking after about fifteen seconds unless it is
       nudged; a pause/resume every ten seconds prevents it. Deliberately not
       done on Android, where it causes the opposite fault. Same trick, and the
       same reason, as the page's own speakKeepAlive(). */
    RP.tick = setInterval(function(){
      try{ if(RP.speaking && speechSynthesis.speaking){ speechSynthesis.pause(); speechSynthesis.resume(); } }catch(e){}
    }, 10000);
  }

  function rpSay(){
    if(!RP.speaking) return;
    var bit = RP.queue[RP.at];
    if(!bit) return rpFinish();
    var start = RP.pos;
    var text = bit.text.slice(start);
    if(!text.trim()){ RP.at++; RP.pos = 0; return rpSay(); }
    lightBlock(bit.el);
    var u = new SpeechSynthesisUtterance(text);
    RP.hold = u;                                   // held so it cannot be collected mid-sentence
    var v = pickVoice();
    if(v) u.voice = v;
    u.rate = 0.9; u.pitch = 1;
    u.onboundary = function(e){
      if(e.name && e.name !== 'word') return;
      var at = start + (typeof e.charIndex === 'number' ? e.charIndex : 0);
      if(at >= 0 && at < bit.text.length){ RP.pos = at; lightWord(bit.off + at, e.charLength); }
    };
    var moved = false, began = Date.now();
    var next = function(){ if(moved) return; moved = true; RP.at++; RP.pos = 0; rpSay(); };
    u.onend = next;
    u.onerror = function(){ if(Date.now() - began > 1500) next(); else rpStop(); };
    try{ speechSynthesis.speak(u); }catch(e){ rpStop(); }
  }

  function rpStart(at, pos){
    RP.queue = rpQueue();
    if(!RP.queue.length) return;
    RP.sig = rpSig();
    RP.at = Math.max(0, Math.min(at || 0, RP.queue.length - 1));
    RP.pos = Math.max(0, pos || 0);
    RP.speaking = true; RP.paused = false;
    try{ speechSynthesis.cancel(); }catch(e){}
    wakeAcquire('reading');
    rpTick(true); rpSave(); rpBar(); rpLabels(); rpSay();
  }

  /* The reading reached its own end. Nothing to continue, so the place is
     forgotten and the button goes back to Read it to me — finishing is not the
     same thing as stopping halfway. */
  function rpFinish(){
    try{ speechSynthesis.cancel(); }catch(e){}
    RP.speaking = false; RP.paused = false; RP.hold = null;
    RP.at = 0; RP.pos = 0; RP.sig = '';
    rpTick(false); wakeRelease('reading'); clearLit();
    try{ localStorage.removeItem(MEM); }catch(e){}
    rpBar(); rpLabels();
    document.querySelectorAll('.stop-btn').forEach(function(x){ x.hidden = true; });
  }

  function rpPause(){
    if(!RP.speaking) return;
    try{ speechSynthesis.cancel(); }catch(e){}
    RP.speaking = false; RP.paused = true; RP.hold = null;
    rpTick(false); wakeRelease('reading');
    rpSave(); rpBar(); rpLabels();
  }

  function rpResume(){
    if(!RP.queue.length){
      var mem = rpMemory(), sig = rpSig();
      RP.queue = rpQueue();
      if(!RP.queue.length) return;
      RP.sig = sig;
      RP.at = mem && mem.sig === sig ? Math.min(mem.at, RP.queue.length - 1) : 0;
      RP.pos = mem && mem.sig === sig ? (mem.pos || 0) : 0;
    }
    RP.paused = false; RP.speaking = true;
    wakeAcquire('reading');
    rpTick(true); rpSave(); rpBar(); rpLabels(); rpSay();
  }

  /* Stop keeps the place — that is the whole point of it being on a bar with
     Pause. Start over is the button that forgets. */
  function rpStop(){
    try{ speechSynthesis.cancel(); }catch(e){}
    RP.speaking = false; RP.paused = false; RP.hold = null;
    rpTick(false); wakeRelease('reading');
    clearLit();
    rpSave(); rpBar(); rpLabels();
    document.querySelectorAll('.stop-btn').forEach(function(x){ x.hidden = true; });
  }

  function rpSkip(dir){
    if(!RP.speaking && !RP.paused) return;
    if(!RP.queue.length) return;
    var was = RP.speaking;
    if(dir < 0){
      if(RP.pos > 0) RP.pos = 0;                      // back: restart this line first
      else if(RP.at > 0){ RP.at--; RP.pos = 0; }
    }else{
      if(RP.at < RP.queue.length - 1){ RP.at++; RP.pos = 0; }
      else return;                                    // the last line has nothing after it
    }
    RP.sig = rpSig();
    if(was){
      try{ speechSynthesis.cancel(); }catch(e){}
      rpSave(); rpBar(); rpSay();
    }else{ rpSave(); rpBar(); }
  }

  function rpStartOver(){
    var was = RP.speaking;
    try{ localStorage.removeItem(MEM); }catch(e){}
    RP.pos = 0; RP.at = 0;
    RP.queue = rpQueue();
    RP.sig = rpSig();
    if(was){ rpSave(); rpBar(); try{ speechSynthesis.cancel(); }catch(e){} rpSay(); }
    else { RP.paused = RP.queue.length > 0; rpBar(); rpLabels(); }
  }

  /* The page's own Read it to me / Pause buttons all come through here now. */
  function rpPressed(){
    if(typeof speechSynthesis === 'undefined') return;
    if(RP.speaking) return rpPause();
    if(RP.paused) return rpResume();
    var all = rpQueue();
    if(!all.length) return;
    if(!voiceList().length){ if(typeof toast === 'function') toast('No voice is installed on this device.'); return; }
    var mem = rpMemory(), sig = rpSig();
    if(mem && sig && mem.sig === sig) rpStart(mem.at, mem.pos);
    else rpStart(0, 0);
  }

  /* -------------------------------------------------------------- the install */
  var installEvent = null;
  function rpStandalone(){
    try{ if(window.matchMedia && matchMedia('(display-mode: standalone)').matches) return true; }catch(e){}
    return navigator.standalone === true;
  }
  function rpApple(){
    if(/iphone|ipad|ipod/i.test(navigator.userAgent || '')) return true;
    /* iPadOS 13+ reports itself as a Macintosh; a Mac with a touch screen is an iPad. */
    return /macintosh/i.test(navigator.userAgent || '') && 'ontouchend' in document;
  }
  function rpNote(title, html){
    if(!note){
      note = document.createElement('div');
      note.id = 'rp-note';
      note.className = 'rp-note';
      note.hidden = true;
      document.body.appendChild(note);
    }
    note.innerHTML = '<h4></h4><div class="rp-body"></div>' +
      '<button id="rp-note-close">Close</button>';
    note.querySelector('h4').textContent = title;
    note.querySelector('.rp-body').innerHTML = html;
    note.hidden = false;
    note.querySelector('#rp-note-close').addEventListener('click', function(){ note.hidden = true; });
  }
  function rpInstall(){
    if(rpStandalone()){
      rpNote('Already saved', '<p>This page is already on your home screen, and it opened from there.</p>');
      return;
    }
    if(installEvent){
      try{ installEvent.prompt(); }catch(e){}
      installEvent = null;
      return;
    }
    if(rpApple()){
      rpNote('Save it to your home screen',
        '<p>Tap the <b>Share</b> button in Safari — the square with the arrow coming out of the top — then scroll down the list and tap <b>Add to Home Screen</b>.</p>' +
        '<p>It will sit next to your other apps with its own moon icon and no address bar. Nothing is downloaded and nothing is charged; it is this same page.</p>');
      return;
    }
    rpNote('Save it to your home screen',
      '<p>Open the browser menu — the three dots or the three lines in the corner — and choose <b>Install app</b>, or <b>Add to Home screen</b>.</p>' +
      '<p>It will open in its own window with no address bar. Nothing is downloaded and nothing is charged; it is this same page.</p>');
  }
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    installEvent = e;
    var b = document.getElementById('rp-install');
    if(b) b.hidden = false;
  });

  /* ----------------------------------------------------------------- wiring */
  function rpWire(){
    mkBar();

    var help = document.getElementById('btn-help');
    if(help && !document.getElementById('rp-install')){
      help.insertAdjacentHTML('afterend',
        '<div class="rp-topline">' +
          '<a class="btn ghost sm" href="/app" title="Back to the app — this reading keeps its place">Day One app</a>' +
          '<button class="btn ghost sm" id="rp-install">Save to my phone</button>' +
        '</div>');
    }
    var ib = document.getElementById('rp-install');
    if(ib) ib.hidden = rpStandalone();

    document.addEventListener('click', function(e){
      var t = e.target;
      if(t.id === 'rp-install'){ rpInstall(); return; }
      var b = t.closest ? t.closest('[data-rp]') : null;
      if(b){
        var k = b.getAttribute('data-rp');
        if(k === 'play') RP.speaking ? rpPause() : rpResume();
        else if(k === 'back') rpSkip(-1);
        else if(k === 'fwd') rpSkip(1);
        else if(k === 'stop') rpStop();
        else if(k === 'over') rpStartOver();
        return;
      }
      /* Any other click may have rendered a new reading, so the label is
         refreshed after it rather than on a timer alone. */
      setTimeout(rpLabels, 0);
    });

    /* Leaving the page, locking the phone, switching app: keep the place. */
    addEventListener('pagehide', rpSave);
    addEventListener('beforeunload', rpSave);
    document.addEventListener('visibilitychange', function(){
      if(document.hidden) rpSave(); else rpLabels();
    });

    /* Slow safety net for readings that appear without a click (a pair drawn
       from a saved person, an AI answer landing). Cheap: one label write. */
    setInterval(function(){ if(!RP.speaking && !RP.paused) rpLabels(); }, 3000);

    /* The page is served at /key behind a session check, and the worker is told
       never to cache it (see sw.js). Registering it here is for the install
       button: Chrome will not offer to install a page that no worker controls. */
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('/sw.js').catch(function(){});
    }

    rpLabels();
  }

  /* --- replace the page's reader, by assignment, from the outside ---------- */
  window.speakReading = rpPressed;   // Read it to me / Pause / Continue
  window.stopSpeaking = rpStop;      // Stop, the voice picker, a tab switch, unload

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rpWire);
  else rpWire();
})();
</script>
`;

  page = page.slice(0, close) + block + page.slice(close);
  console.log('player: appended before </body>');
}

fs.writeFileSync(FILE, page);
console.log(`key.html ${before} -> ${page.length} bytes`);
