// Minimal offline-first service worker for the SignBridge app shell.
// Strategy: cache-first with a background revalidate ("stale-while-revalidate").
// This keeps the core translation UI, MediaPipe WASM runtime, and hand-landmark
// model usable even when the counter loses internet after the first load.

const CACHE_NAME = 'signbridge-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // This file contains the deployment-specific backend origin and must not
  // be served from an old service-worker cache after a redeploy.
  if (new URL(request.url).pathname.endsWith('/runtime-config.js')) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
