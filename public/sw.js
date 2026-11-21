// Service Worker aposentado
// Apaga todos os caches e desregistra.

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
