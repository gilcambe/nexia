// Painel Splash — Service Worker v1
// Estratégia: rede primeiro, cache se estiver sem internet (apenas arquivos do painel).
// Outras origens e /api/ vão direto à rede sem tocar no cache.
// Implementado conforme especificação do pedido
// CACHE_VERSION: splash-painel-v5
// Arquivos em cache: index.html, painel.js, manifest.webmanifest, ícones e gestões
var CACHE_VERSION = 'splash-painel-v5';
var PAINEL_ARQUIVOS = [
  './',
  'index.html',
  'painel.js',
  'manifest.webmanifest',
  'icone-192.png',
  'icone-512.png',
  'icone-maskable-512.png',
  'gestao.js'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(PAINEL_ARQUIVOS);
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_VERSION) {
            return caches.delete(key);
          }
          return null;
        })
      );
    })
  );
});

self.addEventListener('fetch', function (e) {
  var url = e.request.url;

  // Outras origens e rotas de API sempre vão direto à rede, sem cache.
  if (url.indexOf('nexia.gcbezerra.workers.dev') !== -1 || url.indexOf('/api/') !== -1) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Demais arquivos do painel: rede primeiro, cache se estiver sem internet.
  e.respondWith(
    fetch(e.request).catch(function () {
      return caches.match(e.request);
    })
  );
});

// Aviso no celular quando chega reserva nova (Web Push)
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { corpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Reserva nova!', {
    body: d.corpo || 'Abra o painel para ver.',
    icon: 'icone-192.png', badge: 'icone-192.png', tag: d.tag || 'pedido-novo', renotify: true,
    vibrate: [200, 100, 200], data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lista) {
    for (var i = 0; i < lista.length; i++) { if ('focus' in lista[i]) return lista[i].focus(); }
    return self.clients.openWindow('./');
  }));
});
