// Prumo: casca do app (login Google, abas, chamada à API /api/prumo).
// Cada aba é um arquivo próprio (carteira.js, gastos.js, compras.js, objetivos.js) que registra
// window.MB.telas[nome] = function (elemento) { ... }. Se o arquivo não existir, mostra "Em breve".
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ABAS = ['carteira', 'gastos', 'compras', 'objetivos'];
  let usuario = null;

  function mostrarErro(msg) {
    const el = $('erro');
    el.textContent = msg;
    el.hidden = !msg;
    if (msg) setTimeout(() => { if (el.textContent === msg) el.hidden = true; }, 8000);
  }

  async function api(acao, dados) {
    if (!usuario) { mostrarErro('Entre com sua conta.'); throw new Error('sem login'); }
    let r;
    try {
      const token = await usuario.getIdToken();
      r = await fetch('/api/prumo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(Object.assign({}, dados || {}, { acao })),
      });
    } catch (e) {
      mostrarErro('Sem internet agora. Tente de novo quando a conexão voltar.');
      throw e;
    }
    let j = {};
    try { j = await r.json(); } catch { /* resposta vazia */ }
    if (!r.ok) {
      const msg = j.error || 'Algo deu errado. Tente de novo.';
      mostrarErro(msg);
      const e = new Error(msg); e.status = r.status; throw e;
    }
    return j;
  }

  const carregados = {};
  function carregarScript(nome) {
    if (carregados[nome]) return carregados[nome];
    carregados[nome] = new Promise((ok) => {
      const s = document.createElement('script');
      s.src = '/prumo/' + nome + '.js';
      s.onload = () => ok(true);
      s.onerror = () => { delete carregados[nome]; ok(false); };
      document.body.appendChild(s);
    });
    return carregados[nome];
  }

  async function abrirAba(nome) {
    if (!ABAS.includes(nome)) nome = 'carteira';
    document.querySelectorAll('#abas button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === nome)));
    try { localStorage.setItem('prumo-aba', nome); } catch { /* sem armazenamento */ }
    const el = $('conteudo');
    el.innerHTML = '<p class="em-breve">Carregando…</p>';
    const ok = await carregarScript(nome);
    const tela = window.MB.telas[nome];
    if (!ok || typeof tela !== 'function') { el.innerHTML = '<p class="em-breve">Em breve</p>'; return; }
    el.innerHTML = '';
    try { await tela(el); } catch (e) { if (!e.status) mostrarErro('Não consegui abrir esta aba. Tente de novo.'); }
  }

  async function verAvisos() {
    try {
      const r = await api('avisos');
      const lista = (r && r.avisos) || [];
      const el = $('aviso');
      if (!lista.length) { el.hidden = true; return; }
      el.textContent = lista.length === 1
        ? `🛒 Lembrete: na lista "${lista[0].nome}" ainda faltam ${lista[0].faltam} item(ns).`
        : `🛒 Você tem ${lista.length} listas de compras com itens faltando.`;
      el.hidden = false;
    } catch { /* aviso é opcional */ }
  }

  function mostrar(logado) {
    $('tela-entrar').hidden = logado;
    $('tela-app').hidden = !logado;
    $('abas').hidden = !logado;
    $('sair').hidden = !logado;
    if (!logado) $('aviso').hidden = true;
  }

  window.MB = { api, telas: window.MB && window.MB.telas ? window.MB.telas : {}, abrirAba, mostrarErro };

  async function iniciar() {
    let cfg;
    try {
      const r = await fetch('/api/firebase-config');
      cfg = await r.json();
      if (!r.ok || !cfg.apiKey) throw new Error('sem config');
    } catch {
      mostrar(false);
      mostrarErro('Não consegui conectar agora. Feche e abra o app de novo.');
      return;
    }
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    const auth = firebase.auth();
    $('entrar').onclick = async () => {
      mostrarErro('');
      try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
      catch (e) {
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
          await auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider());
        } else if (!(e && e.code === 'auth/popup-closed-by-user')) {
          mostrarErro('Não consegui entrar com o Google. Tente de novo.');
        }
      }
    };
    $('sair').onclick = () => auth.signOut();
    document.querySelectorAll('#abas button').forEach((b) => { b.onclick = () => abrirAba(b.dataset.aba); });
    auth.onAuthStateChanged((u) => {
      usuario = u;
      mostrar(!!u);
      if (u) {
        let ultima = 'carteira';
        try { ultima = localStorage.getItem('prumo-aba') || 'carteira'; } catch { /* sem armazenamento */ }
        abrirAba(ultima);
        verAvisos();
      }
    });
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/prumo/sw.js', { scope: '/prumo/' }).catch(() => {});
  iniciar();
})();
