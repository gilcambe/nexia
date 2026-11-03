// #2917: service worker antigo APOSENTADO. Ele guardava a tela /cortex para sempre e deixava o app Kernex velho.
// Agora ele só apaga o cache que criou, se desregistra e recarrega as abas para pegarem a versão nova.
// Não intercepta fetch.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  await caches.delete("cortex-cache-v1");
  await self.registration.unregister();
  const abas = await self.clients.matchAll({ type: "window" });
  abas.forEach((c) => { try { c.navigate(c.url); } catch (_) {} });
})()));
