// Lesson recordings: the manifest must never be remembered as "failed".
//
// 24 Sep 2026. Jacques, with a screenshot of Porn & Sex day 26: "I dont have
// voice for the rest of the lessons after." The library was fine - production
// serves a manifest byte-identical to the repo's and all 7,458 recordings it
// points at exist on the lesson-audio branch - but the app could not recover
// from asking for it once on a bad connection:
//
//   * `lessonAudioManifestReq` held the failed fetch as a resolved null for the
//     rest of the session, so every lesson after that one moment said "this
//     lesson's recording isn't available on this device right now" with no way
//     back short of closing the app. That is the whole bug in one line, and it
//     is exactly what a future session would reintroduce by "tidying up" the
//     cache into a single if.
//   * The manifest was only fetched inside the tap, and a phone grants playback
//     inside the gesture that asked for it - so the first Listen press of a
//     session could be refused for a reason that had nothing to do with the
//     recording. The stories player was fixed for this on 28 Aug; the lesson
//     player never was.
//
// The first two tests run the function itself with a stubbed fetch, because the
// difference between "remembered as failed" and "asked again" is behaviour, not
// text. The rest are shape guards for the parts that only exist inside a tap.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const HTML = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

// The function as it ships, closing over its own copy of the two variables it
// writes - the app's own declarations are not exported anywhere, so a harness
// that rebuilds them is the only way to run it.
function manifestHarness(fetchImpl) {
  const m = HTML.match(/function loadLessonAudioManifest\(force\)\{[\s\S]*?\n\}\n/);
  assert.ok(m, 'loadLessonAudioManifest must still exist in index.html');
  const build = new Function('fetch', `
let LESSON_AUDIO_MANIFEST=null,lessonAudioManifestReq=null;
${m[0]}
return {load:loadLessonAudioManifest,manifest:()=>LESSON_AUDIO_MANIFEST,held:()=>lessonAudioManifestReq};
`);
  return build(fetchImpl);
}

test('a manifest fetch that fails is not remembered, so the next tap asks again', async () => {
  let calls = 0;
  const fresh = { base: 'https://example.invalid/', items: {} };
  const h = manifestHarness(() => { calls++; return Promise.reject(new Error('offline')); });

  assert.equal(await h.load(false), null, 'a failed fetch resolves to nothing');
  assert.equal(h.held(), null, 'the failed request must not stay in lessonAudioManifestReq');

  // The phone is back on signal. Nothing else is reset in between - this is the
  // second tap on the same screen.
  const h2 = manifestHarness((url) => {
    calls++;
    assert.match(String(url), /data\/lesson-audio-manifest\.json/);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(fresh) });
  });
  assert.equal(await h2.load(false), fresh, 'the next attempt really does fetch again');
  assert.equal(calls, 2);
});

test('a manifest that loaded is kept, and force re-reads it past the cache', async () => {
  let calls = 0;
  const urls = [];
  const h = manifestHarness((url) => {
    calls++; urls.push(String(url));
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: {}, n: calls }) });
  });

  await h.load(false);
  await h.load(false);
  assert.equal(calls, 1, 'the copy in memory is still used - this is not a fetch per tap');
  assert.equal(h.manifest().n, 1);

  await h.load(true);
  assert.equal(calls, 2, 'force asks the network again');
  assert.match(urls[1], /[?&]v=\d+/, 'and it carries a query string, or the service worker answers with the stale copy');
});

test('a recording is looked for a second time before the app says there is none', () => {
  // Every route to the "recording isn't available" note goes through the fresh
  // retry first. laStartFromManifest(false) is the lookup the tap makes.
  assert.match(HTML, /if\(!m\)\{\n\s*if\(!fresh\)\{laStartFromManifest\(true\);return;\}\n\s*fail\(\);return;\n\s*\}/,
    'a manifest that failed to load is retried, not reported as a missing recording');
  assert.match(HTML, /if\(!fresh\)laStartFromManifest\(true\);else laRecordingUnavailable\(\);/,
    'a file that will not play is looked up again against a fresh manifest');
  assert.doesNotMatch(HTML, /loadLessonAudioManifest\(\)\.then/,
    'the lookup must not be awaited straight from the tap with no retry behind it');
});

test('the manifest is already in hand when the app opens, not only when Listen is pressed', () => {
  const enter = HTML.match(/function enterApp\(\)\{[\s\S]*?\n\}/);
  assert.ok(enter, 'enterApp must still exist');
  assert.match(enter[0], /loadLessonAudioManifest\(\);/,
    'a phone only lets a recording start inside the tap that asked for it - waiting on this fetch spends it');
});
