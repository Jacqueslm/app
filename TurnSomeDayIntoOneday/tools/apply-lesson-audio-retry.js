#!/usr/bin/env node
/* Make a lesson recording recover instead of dying until the app is closed.
 * 24 Sep 2026, after Jacques: "I dont have voice for the rest of the lessons
 * after" (screenshot: Porn & Sex, day 26, "This lesson's recording isn't
 * available on this device right now").
 *
 * Same reason as tools/apply-desk-wick.js and friends: index.html is 1MB and
 * the file tools match against a truncated read of it, so edits down in the
 * lesson-audio code silently fail to find their anchor. This is the only
 * reliable way in.
 *
 *   node tools/apply-lesson-audio-retry.js
 *
 * What was actually wrong. Checked against the live site and the CDN first:
 * production serves a manifest byte-identical to the repo's, and all 7,458
 * recordings the manifest points at exist on the lesson-audio branch. Nothing
 * is missing from the library, so the fault had to be in how the app asked for
 * it:
 *
 *   1. A failed manifest fetch was remembered as a resolved null for the rest
 *      of the session - `lessonAudioManifestReq` was never cleared. One bad
 *      moment on a weak signal and every lesson after it said "recording isn't
 *      available", with no way back short of closing the app.
 *   2. The manifest was fetched inside the tap. A phone grants playback inside
 *      the gesture that asked for it, so a manifest that had to load first
 *      spent that gesture and play() was refused - the same popup, from the
 *      same place, for a completely different reason. The stories player was
 *      fixed for exactly this on 28 Aug; the lesson player never was.
 *   3. A file that no longer exists because the page is holding an out-of-date
 *      manifest landed on that popup too, with no second look.
 *
 * Safe to run more than once. Each of the six edits below needs its anchor
 * exactly once and refuses to write if its replacement is already in place; the
 * preload at the end is rebuilt from its anchor rather than inserted, so it
 * cannot be written twice.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'index.html');
let src = fs.readFileSync(FILE, 'utf8');

const OLD_STATE = "let lessonAudioMode='tts',laAudio=null,laPausedByUser=false,lessonAudioMeta=null,lessonAudioText='',lessonAudioTtsPausedIdx=0;";
const NEW_STATE = "let lessonAudioMode='tts',laAudio=null,laPausedByUser=false,lessonAudioMeta=null,lessonAudioText='',lessonAudioTtsPausedIdx=0,laLastResume=null;";

const OLD_MANIFEST = `function loadLessonAudioManifest(){
  if(LESSON_AUDIO_MANIFEST)return Promise.resolve(LESSON_AUDIO_MANIFEST);
  if(!lessonAudioManifestReq)lessonAudioManifestReq=fetch('data/lesson-audio-manifest.json')
    .then(r=>r.ok?r.json():null).then(m=>{LESSON_AUDIO_MANIFEST=m;return m;}).catch(()=>null);
  return lessonAudioManifestReq;
}`;

const NEW_MANIFEST = `// force asks for a new copy from the network rather than the one in memory.
// It is asked for by a query string, because a plain re-fetch is answered out
// of the service worker's cached copy - which is the stale thing we are trying
// to get past.
function loadLessonAudioManifest(force){
  if(LESSON_AUDIO_MANIFEST&&!force)return Promise.resolve(LESSON_AUDIO_MANIFEST);
  if(lessonAudioManifestReq&&!force)return lessonAudioManifestReq;
  const url='data/lesson-audio-manifest.json'+(force?('?v='+Date.now()):'');
  const req=fetch(url).then(r=>r.ok?r.json():null)
    .then(m=>{
      if(m&&m.items){LESSON_AUDIO_MANIFEST=m;return m;}
      // A failed fetch is NOT remembered. It used to be: the empty answer stayed
      // the answer for the rest of the session, so one bad moment on a weak
      // signal made every lesson after it silent, with no way back short of
      // closing the app.
      if(lessonAudioManifestReq===req)lessonAudioManifestReq=null;
      return null;
    })
    .catch(()=>{if(lessonAudioManifestReq===req)lessonAudioManifestReq=null;return null;});
  lessonAudioManifestReq=req;
  return req;
}`;

const OLD_START = `function startLessonAudio(text,btnId,meta,resume){
  stopLessonAudio();
  lessonAudioText=text;lessonAudioBtnId=btnId;lessonAudioMeta=meta||null;
  lessonAudioState='playing';laPausedByUser=!!(resume&&resume.paused);
  updateListenBtn();
  logActivity('lesson_listen',{});
  wakeLockAcquire('lesson-audio');
  const voice=lessonVoiceKey();
  const key=meta&&meta.category&&meta.day?\`\${meta.category}|\${meta.day}|\${meta.variant||'base'}\`:null;
  const fail=()=>{if(lessonAudioState==='playing'&&lessonAudioText===text)laRecordingUnavailable();};
  if(!key){fail();return;}
  loadLessonAudioManifest().then(m=>{
    if(lessonAudioState!=='playing'||lessonAudioText!==text)return;// stopped or replaced while the manifest loaded
    const entry=m&&m.items&&m.items[key];
    const rel=entry&&entry[voice];
    if(rel)startLessonMp3((m.base||'')+rel,resume);
    else fail();
  });
}`;

const NEW_START = `function startLessonAudio(text,btnId,meta,resume){
  stopLessonAudio();
  lessonAudioText=text;lessonAudioBtnId=btnId;lessonAudioMeta=meta||null;
  laLastResume=resume||null;
  lessonAudioState='playing';laPausedByUser=!!(resume&&resume.paused);
  updateListenBtn();
  logActivity('lesson_listen',{});
  wakeLockAcquire('lesson-audio');
  laStartFromManifest(false);
}
// Find the recording for the lesson already being listened to and start it.
// Kept apart from startLessonAudio so a recording that fails can be looked up a
// second time without setting the whole listen up again.
function laStartFromManifest(fresh){
  const meta=lessonAudioMeta||{};
  const text=lessonAudioText;
  const voice=lessonVoiceKey();
  const key=meta.category&&meta.day?\`\${meta.category}|\${meta.day}|\${meta.variant||'base'}\`:null;
  const fail=()=>{if(lessonAudioState==='playing'&&lessonAudioText===text)laRecordingUnavailable();};
  if(!key){fail();return;}
  loadLessonAudioManifest(fresh).then(m=>{
    if(lessonAudioState!=='playing'||lessonAudioText!==text)return;// stopped or replaced while it loaded
    // No manifest at all means the fetch failed, which is a different thing from
    // a lesson with no recording. Ask for it again before saying there is none.
    if(!m){
      if(!fresh){laStartFromManifest(true);return;}
      fail();return;
    }
    const entry=m.items&&m.items[key];
    const rel=entry&&entry[voice];
    if(rel)startLessonMp3((m.base||'')+rel,laLastResume,fresh);
    else fail();
  });
}`;

const OLD_MP3_SIG = 'function startLessonMp3(url,resume){';
const NEW_MP3_SIG = 'function startLessonMp3(url,resume,fresh){';

const OLD_ERR = `  // A recording that can't load or play hands the lesson to the phone's own
  // voice at the same spot, rather than going silent.
  a.addEventListener('error',()=>{
    if(laAudio!==a||lessonAudioState!=='playing')return;
    laStopMp3();laRecordingUnavailable();
  });`;

const NEW_ERR = `  // A file that will not load is looked up once more against a fresh manifest:
  // a page left open for days can be holding file names that have since been
  // replaced, which looks exactly like a lesson with no recording.
  a.addEventListener('error',()=>{
    if(laAudio!==a||lessonAudioState!=='playing')return;
    laStopMp3();
    if(!fresh)laStartFromManifest(true);else laRecordingUnavailable();
  });`;

const OLD_PLAY = `  const p=a.play();
  if(p&&p.catch)p.catch(()=>{
    if(laAudio!==a||lessonAudioState!=='playing')return;
    laStopMp3();laRecordingUnavailable();
  });`;

const NEW_PLAY = `  const p=a.play();
  if(p&&p.catch)p.catch(err=>{
    if(laAudio!==a||lessonAudioState!=='playing')return;
    laStopMp3();
    // The recording is there and the phone refused to start it, because the tap
    // that asked for it was spent waiting on the manifest. That is not a missing
    // recording, so say the thing that is actually true - and the fix is one
    // more tap, not another voice.
    if(!fresh&&err&&err.name==='NotAllowedError'){
      stopLessonAudio();
      appInfo('Listen','Your phone wouldn\\'t start the recording that time. Tap Listen again and it will play.');
      return;
    }
    if(!fresh)laStartFromManifest(true);else laRecordingUnavailable();
  });`;

const EDITS = [
  ['the narrator state', OLD_STATE, NEW_STATE],
  ['loadLessonAudioManifest', OLD_MANIFEST, NEW_MANIFEST],
  ['startLessonAudio', OLD_START, NEW_START],
  ['startLessonMp3 signature', OLD_MP3_SIG, NEW_MP3_SIG],
  ['the mp3 error handler', OLD_ERR, NEW_ERR],
  ['the play() refusal', OLD_PLAY, NEW_PLAY],
];

let done = 0;
for (const [what, oldText, newText] of EDITS) {
  const at = src.indexOf(oldText);
  if (at < 0) {
    // Already applied is fine; anything else is a wrong edit on a moved file.
    if (src.includes(newText)) { console.log('already applied: ' + what); continue; }
    throw new Error('anchor not found (has index.html moved?): ' + what);
  }
  if (src.indexOf(oldText, at + 1) >= 0) throw new Error('anchor is not unique: ' + what);
  src = src.slice(0, at) + newText + src.slice(at + oldText.length);
  done++;
}

// The preload, rebuilt rather than inserted. A phone only lets a recording
// start inside the tap that asked for it, and waiting on this fetch spends that
// tap - so having the manifest in hand already is what makes the first press of
// Listen work. Rebuilt from the anchor up to the line that follows it, because
// a plain replace would find its own output on the next run and write a second
// copy.
const PRELOAD = `  // Fetched here as well as when the lesson screen opens. A phone only lets a
  // recording start inside the tap that asked for it, and waiting on this fetch
  // spends that tap - so having it in hand already is what makes the first
  // press of Listen work.
  loadLessonAudioManifest();`;
const ENTER_ANCHOR = '  updateAccountUI();\n  loadLessonPacks();';
const ENTER_AFTER = '\n  // Also checked on open, not only after a lesson.';
const at = src.indexOf(ENTER_ANCHOR);
if (at < 0) throw new Error('enterApp anchor not found');
const end = src.indexOf(ENTER_AFTER, at);
if (end < 0) throw new Error('the line after the preload has moved');
// Everything between the anchor and the line that follows is rebuilt as one
// copy of the preload. Only this region is compared and only this region is
// replaced - the tail below it is carried through untouched, or the rebuild
// appends the rest of the file to itself.
const want = ENTER_ANCHOR + '\n' + PRELOAD;
if (src.slice(at, end) !== want) {
  src = src.slice(0, at) + want + src.slice(end);
  done++;
  console.log('enterApp: the preload is in place');
}

// The replacements have to have landed, and the things they lean on have to
// still be there. A wrong edit is worse than no edit.
for (const must of [
  'let LESSON_AUDIO_MANIFEST=null,lessonAudioManifestReq=null;',
  'function laStartFromManifest(fresh){',
  'if(lessonAudioManifestReq===req)lessonAudioManifestReq=null;',
  "startLessonMp3((m.base||'')+rel,laLastResume,fresh);",
  'function startLessonMp3(url,resume,fresh){',
  'if(!fresh)laStartFromManifest(true);else laRecordingUnavailable();',
  "if(!fresh&&err&&err.name==='NotAllowedError'){",
  'laLastResume=resume||null;',
  'function lessonVoiceKey(){',
  'function laRecordingUnavailable(){',
  "startLessonAudio(text,'lessonListenBtn',meta);",
  "startLessonAudio(text,'pack-listen-btn',{",
  "wakeLockRelease('lesson-audio');",
  ENTER_ANCHOR + '\n' + PRELOAD + ENTER_AFTER,
]) {
  if (!src.includes(must)) throw new Error('missing after applying: ' + must);
}
if (src.includes('loadLessonAudioManifest()\n    .then')) throw new Error('the unretried lookup is still there');
const calls = src.split('loadLessonAudioManifest();').length - 1;
if (calls !== 2) throw new Error('the manifest should be called in exactly two places (the lesson screen and the preload), found ' + calls);

fs.writeFileSync(FILE, src);
console.log('index.html: ' + done + ' edit(s) written, ' + Buffer.byteLength(src) + ' bytes');
