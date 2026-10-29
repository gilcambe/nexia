// Service Worker para PWA
const CACHE_NAME = 'viajante-pro-painel-v1';
const urlsToCache = [
  '/',
  '/painel.js',
  '/styles.css',
  // Adicione outros recursos estáticos aqui
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});
