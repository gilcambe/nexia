// Painel Viajante Pro — abre as telas sem internet (os dados vêm sempre da API).
const CACHE = 'vp-painel-v2';
const ARQ = ['./', './index.html', './painel.css', './nucleo.js', './painel.js', '../app/app.css', '../app/icone.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQ))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

// #2917: versão nova espera o toque em "Toque para atualizar" (update-banner.js); limpa o cache velho e assume.
self.addEventListener('message', function (e) {
  if (!e.data || e.data.tipo !== 'atualizar') return;
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }).then(function () { return self.skipWaiting(); }));
});
