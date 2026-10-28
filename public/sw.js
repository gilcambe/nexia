const CACHE_NAME = 'cortex-app-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/cortex-icon.svg',
  '/cortex-icon-180.png',
  '/src/main.tsx',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.origin !== location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      return fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse.ok &&
            request.cache !== 'no-store'
          ) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse)
        .catch(() => {
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('', { status: 408, statusText: 'Offline' });
        });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
