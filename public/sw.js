// Service Worker aposentado: apaga todos os caches e se desregistra.
// Sem listener de fetch — este SW não intercepta nada.
// Mantém o nome do cache 'cortex-cache-v1' no comentário do código para referência.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => client.navigate(client.url));
    })()
  );
});
