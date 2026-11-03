// Central: service worker mínimo para instalar a Central no celular. Guarda só o visual (scripts, estilos, ícones);
// /api e /__/ (login do Firebase) e qualquer dado vão sempre direto à rede.

// #2917: a versão nova espera o toque em "Atualizar" (public/js/update-banner.js) e então assume.
self.addEventListener("message", (e) => { if (e.data && e.data.tipo === "atualizar") self.skipWaiting(); });
const CACHE = "central-v2"; // Atualiza versão do cache
  self.addEventListener("activate", (e) => {
    e.waitUntil(
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      )
    );
    return self.clients.claim();
  });
self.addEventListener("fetch", (e) => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname.startsWith("/__/")) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put("/central", c)); return res; }).catch(() => caches.match("/central")));
    return;
  }
  if (!["script", "style", "image", "font"].includes(r.destination)) return;
  // Rede primeiro (sempre a versão nova); o cache só serve sem internet.
  e.respondWith(caches.open(CACHE).then((k) => fetch(r).then((res) => { if (res.ok) k.put(r, res.clone()); return res; }).catch(() => k.match(r))));
});
