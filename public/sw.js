// Service Worker aposentado: apaga todos os caches e se desregistra.

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      self.registration.unregister();
    })()
  );
});

self.addEventListener('fetch', () => {
  // SW aposentado: não intercepta requisições.
});
