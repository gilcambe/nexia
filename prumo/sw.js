// Prumo: guarda só a casca do app para abrir sem internet. Respostas da API nunca são guardadas.
const CACHE = 'prumo-casca-v55-kernexfinance';
const CASCA = ['/prumo/', '/prumo/index.html', '/prumo/app.js', '/prumo/cache-api.js', '/prumo/manifest.webmanifest', '/prumo/icone.svg', '/prumo/ui.js', '/prumo/previsto.js', '/prumo/graficos.js', '/prumo/carteira.js', '/prumo/gastos.js', '/prumo/compras.js', '/prumo/objetivos.js', '/prumo/orcamento.js', '/prumo/salario.js', '/prumo/consultor.js', '/prumo/pontos.js', '/prumo/instalar.js', '/prumo/privacidade.js', '/prumo/inicio.js', '/prumo/tutorial.js', '/prumo/documentos.js', '/prumo/pdf.js', '/prumo/contas.js', '/prumo/cartoes.js', '/prumo/assistente.js', '/prumo/dividas.js', '/prumo/investimentos.js', '/prumo/economizar.js', '/prumo/metas.js', '/prumo/familia.js', '/prumo/impostos.js', '/prumo/alertas.js', '/prumo/conexoes.js', '/prumo/ajuda.js', '/prumo/mercado.js', '/prumo/robos.js', '/prumo/landing.html', '/prumo/icone-192.png', '/prumo/milhas.js', '/prumo/viagens.js', '/prumo/apos.js', '/prumo/aposentadoria.js', '/prumo/fluxo.js', '/prumo/fluxo-visao.js', '/prumo/carreira.js', '/prumo/carreira-visao.js', '/prumo/leitura.js', '/prumo/score.js', '/prumo/lancar.js', '/prumo/raiox.js', '/prumo/hubs.js', '/prumo/mes.js', '/prumo/patrimonio.js', '/prumo/beneficios.js', '/prumo/perfil.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('prumo-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Arquivo compartilhado pelo Android ("Compartilhar" → Kernex Finance): guarda e abre o app para ler.
  if (e.request.method === 'POST' && url.pathname === '/prumo/compartilhar') {
    e.respondWith((async () => {
      let n = 0;
      try {
        const fd = await e.request.formData();
        const arqs = fd.getAll('arquivos').filter((f) => f && typeof f !== 'string' && f.size > 0).slice(0, 5);
        const c = await caches.open('kf-compartilhado');
        for (const k of await c.keys()) await c.delete(k);
        for (const f of arqs) await c.put('/prumo/__compartilhado/' + (n++), new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-Nome': encodeURIComponent(f.name || 'arquivo') } }));
      } catch (err) { n = 0; }
      return Response.redirect('/prumo/?compartilhado=' + n, 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith('/prumo/')) return;
  // Rede primeiro (sempre a versão nova); sem internet, usa a casca guardada.
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && CASCA.includes(url.pathname)) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('/prumo/index.html'))));
});
