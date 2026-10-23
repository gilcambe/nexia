// Painel Splash — Service Worker v1
// Estratégia: rede primeiro, cache se estiver sem internet (apenas arquivos do painel).
// Outras origens e /api/ vão direto à rede sem tocar no cache.
var CACHE_VERSION = 'splash-painel-v1';
var PAINEL_ARQUIVOS = [
  './',
  'index.html',
  'painel.js',
  'manifest.webmanifest',
  'icone-192.png',
  'icone-512.png',
  'icone-maskable-512.png'
];

self.addEventListener('install', function (e) {
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
