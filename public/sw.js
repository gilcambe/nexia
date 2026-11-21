// Service Worker aposentado (#2917)
// Não intercepta fetch, apaga todos os caches (cortex-cache-v1) e desregistra.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (err) {}

      try {
        await self.registration.unregister();
      } catch (err) {}
    })()
  );
});





