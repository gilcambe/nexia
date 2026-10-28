// Viajante Pro App — Service Worker v1
var CACHE_VERSION = 'vp-app-v1';
var APP_FILES = [
  './',
  'index.html',
  'app.js',
  'manifest.webmanifest',
  'icone-192.png',
  'icone-512.png',
  'icone-maskable-512.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(APP_FILES);
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
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
    ])
  );
});

self.addEventListener('fetch', function (e) {
  var url = e.request.url;

  // Chamadas de API sempre vão à rede primeiro
  if (url.indexOf('/api/') !== -1) {
    e.respondWith(
      fetch(e.request).catch(function () {
        return new Response(JSON.stringify({ offline: true, error: 'Sem conexão com a internet' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Demais arquivos estáticos: rede primeiro, cache como fallback se offline
  e.respondWith(
    fetch(e.request).catch(function () {
      return caches.match(e.request).then(function (res) {
        return res || caches.match('./') || caches.match('index.html');
      });
    })
  );
});
