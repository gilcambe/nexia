// Central: service worker mínimo para instalar a Central no celular. Guarda só o visual (scripts, estilos, ícones);
// /api e /__/ (login do Firebase) e qualquer dado vão sempre direto à rede.

// #2917: a versão nova espera o toque em "Atualizar" (public/js/update-banner.js) e então assume.
self.addEventListener("message", (e) => { if (e.data && e.data.tipo === "atualizar") self.skipWaiting(); });
const CACHE = "central-v5"; // Atualiza versão do cache com gerenciamento de versões e remoção de antigos
self.addEventListener("install", (e) => {
  // Removido skipWaiting automático; aguarda mensagem de atualização explícita
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (k !== CACHE) {
          return caches.delete(k);
        }
      }))
    ).then(() => self.clients.claim())
  );
});
const guardavel = (res) => res && res.ok && res.type === 'basic';
self.addEventListener("fetch", (e) => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname.startsWith("/__/")) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put("/central", c)); return res; }).catch(() => caches.match("/central")));
    return;
  }
  // Scripts/estilos sem hash e arquivos estáticos sem versão: rede primeiro, cache offline.
  if (!u.pathname.includes("/assets/") && /\.(webmanifest|json|html|js|css)$/i.test(u.pathname)) {
    e.respondWith(fetch(r).then((res) => {
      if (guardavel(res)) { const copy = res.clone(); caches.open(CACHE).then((k) => k.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r).then((hit) => hit || Response.error())));
    return;
  }
  if (!["script", "style", "image", "font"].includes(r.destination)) return;
  // Rede primeiro (sempre a versão nova); o cache só serve sem internet.
  e.respondWith(caches.open(CACHE).then((k) => fetch(r).then((res) => { if (res.ok) k.put(r, res.clone()); return res; }).catch(() => k.match(r))));
});
