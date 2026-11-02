// Viajante Pro — guarda as telas do app para abrir sem internet. Os dados da viagem ficam no IndexedDB (app.js).
const CACHE = 'vp-app-v2';
const ARQUIVOS = ['./', './index.html', './app.css', './nucleo.js', './app.js', './manifest.webmanifest', './icone.svg', './icone-192.png', './icone-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // API sempre direto na rede
  // rede primeiro (pega versão nova), cópia guardada quando não tem internet
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});

// #2917: versão nova espera o toque em "Toque para atualizar" (update-banner.js); limpa o cache velho e assume.
self.addEventListener('message', function (e) {
  if (!e.data || e.data.tipo !== 'atualizar') return;
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }).then(function () { return self.skipWaiting(); }));
});
