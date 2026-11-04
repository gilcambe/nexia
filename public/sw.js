// #2917: service worker antigo APOSENTADO.
// Não intercepta fetch.
// No activate, apaga o cache "cortex-cache-v1", desregistra e recarrega as abas ativas.
// #2917: Service worker aposentado.
// Não intercepta fetch.
// No activate, apaga o cache "cortex-cache-v1" e desregistra.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          if (name === "cortex-cache-v1" || name.includes("cortex-cache")) {
            await caches.delete(name);
          }
        }
      } catch (_) {}

      try {
        await self.registration.unregister();
      } catch (_) {}
    })()
  );
});

