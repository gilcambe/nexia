// Service Worker aposentado (#2917)
// Não intercepta fetch, apaga todos os caches (cortex-cache-v1) e desregistra.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // SW aposentado: não intercepta fetch, deixa o browser buscar normalmente.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      } catch (err) {}

      try {
        if (typeof self.registration !== 'undefined' && self.registration.unregister) {
          await self.registration.unregister();
        }
      } catch (err) {}

      try {
        const clientsList = await clients.matchAll({ type: 'window' });
        for (const client of clientsList) {
          client.navigate(client.url);
        }
      } catch (err) {}
    })()
  );
});





