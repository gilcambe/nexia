// Service Worker — NEXIA OS
// Casca offline (abre sem rede) + cache de dados de hoje (atualiza depois).
// Custo 0. Não toca Firestore, não grava segredos, não remove função existente.

const SHELL_CACHE = 'nexia-shell-v1';
const DATA_CACHE = 'nexia-data-v1';

// Casca pré-cacheada no install (mesma origem, arquivos que existem no repo).
const SHELL_URLS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css',
  '/cortex-icon.svg',
  '/cortex.webmanifest'
];

function isNavigation(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function isShellAsset(url) {
  return SHELL_URLS.includes(url) ||
    url.startsWith('/src/') ||
    url.startsWith('/cortex-') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('cdnjs.cloudflare.com');
}

function isDataRequest(request) {
  if (isNavigation(request)) return false;
  if (isShellAsset(request.url)) return false;
  return true;
}

// Resposta do cache é de hoje?
function sameDayCached(cachedResponse) {
  try {
    const cachedAt = cachedResponse.headers.get('x-nexia-cached-at');
    if (!cachedAt) return false;
    const today = new Date().toISOString().slice(0, 10);
    return cachedAt.slice(0, 10) === today;
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return Promise.all(
        SHELL_URLS.map((url) => {
          return cache.add(new Request(url, { credentials: 'same-origin' })).catch((err) => {
            // Um URL indisponível não impede os demais.
            console.warn('[SW] install skip:', url, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1) Navegação / documentos: cache-first da casca, rede de fallback.
  if (isNavigation(request)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request);
      })
    );
    return;
  }

  // 2) Dados: rede primeiro. Sucesso guarda no cache com timestamp de hoje.
  //    Sem rede, serve do cache do mesmo dia. Atualização em segundo plano.
  if (isDataRequest(request)) {
    event.respondWith(
      fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const headers = new Headers(networkResponse.headers);
          headers.set('x-nexia-cached-at', new Date().toISOString());
          const modified = new Response(networkResponse.body, {
            status: networkResponse.status,
            statusText: networkResponse.statusText,
            headers
          });
          caches.open(DATA_CACHE).then((cache) => {
            cache.put(request, modified);
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.open(DATA_CACHE).then((cache) => {
          return cache.match(request).then((cached) => {
            if (cached && sameDayCached(cached)) return cached;
            return new Response(
              JSON.stringify({ error: 'offline', message: 'Sem rede e sem dado de hoje em cache.' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        });
      })
    );
    return;
  }

  // 3) Outros estáticos: stale-while-revalidate (casca instantânea, atualiza depois).
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          caches.open(SHELL_CACHE).then((cache) => {
            cache.put(request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(() => {});
      return cached || networkFetch;
    })
  );
});