// Cortex: service worker mínimo. Deixa o Chrome instalar o Cortex como app de verdade (sem barra de endereço)
// e guarda o visual (scripts, estilos, ícones) para abrir bem mais rápido. Dados e /api sempre vão direto à rede.

self.addEventListener("message", (e) => { if (e.data && e.data.tipo === "atualizar") self.skipWaiting(); });
const CACHE = "cortex-v4";
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
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put("/cortex", c)); return res; }).catch(() => caches.match("/cortex")));
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

// #833: avisos do Cortex (tarefa feita, travada e resumo das 8h). Toque abre o app.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { corpo: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Cortex", { body: d.corpo || "", tag: d.tag || "cortex", icon: "/cortex-icon-192.png", badge: "/cortex-icon-192.png", data: { url: d.url || "/cortex" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/cortex";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((l) => {
    const aberto = l.find((c) => new URL(c.url).pathname.startsWith("/cortex"));
    return aberto ? aberto.focus() : self.clients.openWindow(url);
  }));
});
