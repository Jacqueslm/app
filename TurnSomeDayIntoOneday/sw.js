const CACHE_NAME = 'tsid-shell-v12.5.2'; // v12.5.2: lesson audio survives a voiceless TTS engine and says when the phone's voice is off
const SHELL_FILES = [
  '/',
  '/app',
  '/manifest.json',
  '/manifest-discrete.json',
  '/audio/sos-talk-warm.mp3',
  '/audio/sos-talk-soft.mp3',
  '/audio/sos-talk-gentle.mp3',
  '/audio/sos-talk-clear.mp3',
  '/audio/sos-talk-male.mp3',
  '/data/lessons.json',
  '/data/stories.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-discrete-192.png',
  '/icons/icon-discrete-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Never cache API calls - auth, chat, and state must always hit the network so the app's
// own online/offline handling (e.g. Nova's local fallback) stays in control of that behavior.
//
// Pages (HTML) are network-first so app updates show up on the very next load;
// the cached copy is only a fallback for offline. Static assets stay
// cache-first for speed.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  // Cross-origin requests (the lesson-audio CDN) are left to the browser: its
  // HTTP cache handles them, and copying multi-megabyte recordings into the
  // shell cache would burn the storage quota for no gain.
  if (url.origin !== location.origin) return;

  const isPage = event.request.mode === 'navigate' || event.request.destination === 'document';

  if (isPage) {
    // Network-first so updates appear on the next load. Offline, fall back to
    // the cached copy - and because a navigation often carries a query string
    // (e.g. /app?join=1) that won't exact-match the cached '/app', ignoreSearch
    // is used, with '/app' and '/' as last resorts. Without this, an offline
    // PWA launch with any query string got a blank error page - stranding a
    // user the app is otherwise fully able to serve offline.
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() =>
          caches.match(event.request, { ignoreSearch: true })
            .then((c) => c || caches.match('/app'))
            .then((c) => c || caches.match('/'))
        )
    );
    return;
  }

  // Static assets: cache-first for speed, revalidating in the background.
  // Audio elements fetch with Range headers and get 206 partials back;
  // cache.put() rejects those, so only full 200 responses are stored (the MP3
  // itself is already precached whole above). ignoreSearch/ignoreVary aren't
  // needed here, but a Range request must still match the cached full copy -
  // Cache.match ignores request headers, so it does.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok && res.status === 200) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
