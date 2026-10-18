// Cortex: service worker mínimo. Deixa o Chrome instalar o Cortex como app de verdade (sem barra de endereço)
// e guarda o visual (scripts, estilos, ícones) para abrir bem mais rápido. Dados e /api sempre vão direto à rede.
const CACHE = "cortex-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put("/cortex", c)); return res; }).catch(() => caches.match("/cortex")));
    return;
  }
  if (!["script", "style", "image", "font"].includes(r.destination)) return;
  e.respondWith(caches.open(CACHE).then(async (k) => {
    const guardado = await k.match(r);
    const rede = fetch(r).then((res) => { if (res.ok) k.put(r, res.clone()); return res; }).catch(() => guardado);
    return guardado || rede;
  }));
});
