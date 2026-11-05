// Prumo: guarda só a casca do app para abrir sem internet. Respostas da API nunca são guardadas.
const CACHE = 'prumo-casca-v11-kernexfinance';
const CASCA = ['/prumo/', '/prumo/index.html', '/prumo/app.js', '/prumo/manifest.webmanifest', '/prumo/icone.svg', '/prumo/ui.js', '/prumo/carteira.js', '/prumo/gastos.js', '/prumo/compras.js', '/prumo/objetivos.js', '/prumo/orcamento.js', '/prumo/consultor.js', '/prumo/pontos.js', '/prumo/instalar.js', '/prumo/privacidade.js', '/prumo/inicio.js', '/prumo/documentos.js', '/prumo/contas.js', '/prumo/cartoes.js', '/prumo/assistente.js', '/prumo/landing.html', '/prumo/icone-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('prumo-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith('/prumo/')) return;
  // Rede primeiro (sempre a versão nova); sem internet, usa a casca guardada.
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && CASCA.includes(url.pathname)) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('/prumo/index.html'))));
});
