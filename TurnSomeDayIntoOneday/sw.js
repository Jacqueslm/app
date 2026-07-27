const CACHE_NAME = 'tsid-shell-v30-4'; // v30.4: audio wake lock + stall detection
const SHELL_FILES = [
  '/',
  '/app',
  '/manifest.json',
  '/manifest-discrete.json',
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

  const isPage = event.request.mode === 'navigate' || event.request.destination === 'document';
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return isPage ? network : (cached || network);
    })
  );
});
