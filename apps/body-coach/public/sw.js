const CACHE = 'body-coach-v3';
const MAX_ITENS = 120;
// Vídeo e áudio não ficam no aparelho (ocupam muito); o resto guarda só os 120 mais recentes.
const PESADO = /\.(mp4|webm|mov|mp3|m4a|wav)$/i;
function aparar(c) {
  return c.keys().then((keys) => {
    if (keys.length <= MAX_ITENS) return;
    const toDelete = keys.slice(0, keys.length - MAX_ITENS);
    return Promise.all(toDelete.map((k) => c.delete(k)));
  });
}
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return res; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => {
        c.put(req, copy);
        if (!PESADO.test(req.url)) aparar(c);
      });
    }
    return res;
  })));
});

// Avisos no celular (Web Push): mensagem do coach/aluno, hora do treino, beber água.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { corpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'NEXIA Body Coach', {
    body: d.corpo || '', icon: 'icon-192.png', badge: 'badge-96.png', tag: d.tag || undefined, renotify: !!d.tag,
    vibrate: [200, 100, 200], data: { url: d.url || '' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const alvo = new URL(`./${(e.notification.data && e.notification.data.url) || ''}`, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
    const aberta = lista.find((c) => c.url.startsWith(self.registration.scope));
    if (aberta) return aberta.focus().then((c) => (c && 'navigate' in c ? c.navigate(alvo) : c));
    return self.clients.openWindow(alvo);
  }));
});

// Fim do descanso com a tela bloqueada ou em outro app: a página pede, o service worker avisa na hora certa.
let descanso = 0;
self.addEventListener('message', (e) => {
  const m = e.data || {};
  if (m.tipo === 'descanso_cancelar') { descanso += 1; self.registration.getNotifications({ tag: 'descanso' }).then((ns) => ns.forEach((n) => n.close())); return; }
  if (m.tipo !== 'descanso') return;
  const meu = ++descanso;
  const falta = Math.max(0, Math.min(10 * 60000, Number(m.fimEm) - Date.now()));
  e.waitUntil(new Promise((ok) => setTimeout(ok, falta)).then(() => {
    if (meu !== descanso) return undefined;
    return self.clients.matchAll({ type: 'window' }).then((lista) => {
      if (lista.some((c) => c.visibilityState === 'visible')) return undefined; // app na tela: a própria página avisa
      return self.registration.showNotification('Descanso acabou ⏱️', { body: m.proximo ? `Próxima série: ${m.proximo}` : 'Bora para a próxima série!', icon: 'icon-192.png', tag: 'descanso', renotify: true, requireInteraction: false, vibrate: [400, 150, 400, 150, 400], data: { url: 'workout' } });
    });
  }));
});
