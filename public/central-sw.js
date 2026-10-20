// Central: service worker mínimo para instalar a Central no celular. Guarda só o visual (scripts, estilos, ícones);
// /api e /__/ (login do Firebase) e qualquer dado vão sempre direto à rede.
const CACHE = "central-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname.startsWith("/__/")) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put("/central", c)); return res; }).catch(() => caches.match("/central")));
    return;
  }
  if (!["script", "style", "image", "font"].includes(r.destination)) return;
  e.respondWith(caches.open(CACHE).then(async (k) => {
    const guardado = await k.match(r);
    const rede = fetch(r).then((res) => { if (res.ok) k.put(r, res.clone()); return res; }).catch(() => guardado);
    return guardado || rede;
  }));
});
