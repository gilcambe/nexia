// Service Worker aposentado: apaga todos os caches e se desregistra.
// Sem listener de fetch — este SW não intercepta nada.
// Mantém o nome do cache 'cortex-cache-v1' no comentário do código para referência.

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      self.registration.unregister();
    })()
  );
});

// SW aposentado não intercepta nada.
