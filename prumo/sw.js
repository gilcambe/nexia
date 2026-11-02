'use strict';
// Prumo: guarda só a casca do app para abrir sem internet. Respostas da API nunca ficam em cache.
const CACHE = 'prumo-v1';
const CASCA = ['/prumo/', '/prumo/app.js', '/prumo/telas.js', '/prumo/icone.svg', '/prumo/manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/prumo/')) return;
  // Rede primeiro (sempre a versão nova); sem internet, usa a casca guardada.
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('/prumo/'))));
});
