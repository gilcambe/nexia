// #2917: service worker antigo APOSENTADO.
// Não intercepta fetch.
// No activate, apaga o cache "cortex-cache-v1", desregistra e recarrega as abas ativas.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  try {
    await caches.delete("cortex-cache-v1");
  } catch (_) {}
  try {
    await self.registration.unregister();
  } catch (_) {}
  try {
    const clientsList = await self.clients.matchAll({ type: "window" });
    for (const client of clientsList) {
      if (client.url && 'navigate' in client) {
        try {
          await client.navigate(client.url);
        } catch (_) {}
      }
    }
  } catch (_) {}
})()));

