// Versão do cache: suba a cada mudança deste arquivo (o activate apaga os caches antigos).
// Regras: HTML e API sempre pela rede primeiro; /api/ e o login do Firebase (/__/) nunca vão para o cache.
const CACHE = 'body-coach-v5';
// Abertura instantânea: sem resposta da rede neste tempo, abre a casca guardada e a rede atualiza depois.
const ESPERA_REDE_MS = 3500;
const MAX_ITENS = 120;
// Vídeo e áudio não ficam no aparelho (ocupam muito); o resto guarda só os 120 mais recentes.
const PESADO = /\.(mp4|webm|mov|mp3|m4a|wav)$/i;
// A casca (index.html e os arquivos principais que ele pede) nunca sai: sem ela o app abriria em branco sem internet.
function aparar(c) {
  return Promise.all([c.keys(), c.match('./index.html').then((r) => (r ? r.clone().text() : '')).catch(() => '')]).then(([todas, html]) => {
    const keys = todas.filter((k) => {
      const u = k.url || String(k);
      if (/\/(index\.html)?$/.test(u)) return false;
      const nome = /\/assets\/[^/?]+$/.exec(u);
      return !(nome && html.includes(nome[0]));
    });
    if (keys.length <= MAX_ITENS) return;
    const toDelete = keys.slice(0, keys.length - MAX_ITENS);
    return Promise.all(toDelete.map((k) => c.delete(k)));
  });
}
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Nunca guardado no aparelho: outras origens (Firebase, Google), /api/ e o login do Firebase (/__/auth, /__/firebase).
function naoGuarda(req, url) {
  return req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/') || url.pathname.includes('/__/');
}
const guardavel = (res) => res && res.ok && res.type === 'basic';
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (naoGuarda(req, url)) return;
  if (req.mode === 'navigate') {
    // Rede primeiro (deploy novo chega na hora). Rede lenta ou sem internet: a casca guardada abre na hora.
    const rede = fetch(req).then((res) => {
      if (guardavel(res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); }
      return res;
    });
    const guardada = () => caches.match('./index.html');
    // Na rede lenta só usa a casca guardada se o arquivo principal dela também estiver guardado (senão: tela branca).
    const cascaPronta = () => guardada().then((r) => r && r.clone().text().then((html) => {
      const m = /["']([^"']*\/assets\/index-[^"']+\.js)["']/.exec(html);
      if (!m) return undefined;
      return caches.match(new URL(m[1], self.registration.scope).href).then((js) => (js ? r : undefined));
    })).catch(() => undefined);
    e.respondWith(new Promise((ok) => {
      let feito = false;
      const responder = (r) => { if (!feito && r) { feito = true; ok(r); } };
      const t = setTimeout(() => { cascaPronta().then(responder); }, ESPERA_REDE_MS);
      rede.then((r) => { clearTimeout(t); responder(r); })
        .catch(() => { clearTimeout(t); cascaPronta().then((r) => { if (r) responder(r); else if (!feito) { feito = true; ok(Response.error()); } }); });
    }));
    e.waitUntil(rede.catch(() => undefined));
    return;
  }
  // Manifesto e arquivos sem versão no nome: rede primeiro, cache só sem internet.
  if (!url.pathname.includes('/assets/') && /\.(webmanifest|json|html)$/i.test(url.pathname)) {
    e.respondWith(fetch(req).then((res) => {
      if (guardavel(res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || Response.error())));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (!guardavel(res)) return res;
    if (PESADO.test(req.url)) return res; // vídeo/áudio não ficam no aparelho
    const copy = res.clone();
    caches.open(CACHE).then((c) => {
      c.put(req, copy);
      aparar(c);
    });
    return res;
  })));
});

// Avisos no celular (Web Push): mensagem do coach/aluno, hora do treino, beber água.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { corpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Body Coach', {
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
