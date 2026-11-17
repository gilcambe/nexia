// Prumo: casca do app (login Google, abas, chamada à API /api/prumo).
// Cada aba é um arquivo próprio (carteira.js, gastos.js, compras.js, objetivos.js) que registra
// window.MB.telas[nome] = function (elemento) { ... }. Se o arquivo não existir, mostra "Em breve".
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ABAS = ['inicio', 'documentos', 'contas', 'cartoes', 'dividas', 'investimentos', 'economizar', 'metas', 'familia', 'impostos', 'alertas', 'conexoes', 'assistente', 'carteira', 'gastos', 'compras', 'objetivos', 'orcamento', 'consultor', 'pontos', 'viagens', 'ajuda', 'mercado', 'robos'];
  const btnMenu = $('btn-menu');
  const navAbas = $('abas');
  const fundoMenu = $('fundo-menu');
  const tituloAba = $('titulo-aba');
  let usuario = null;

  function toggleGrupo(btn) {
    const id = btn.dataset.grupo;
    if (!id) return;
    const grupo = $(`grupo-${id}`);
    const aberto = !grupo.hidden;
    grupo.hidden = aberto;
    btn.setAttribute('aria-expanded', String(!aberto));
  }

  function mostrarErro(msg) {
    const el = $('erro');
    el.textContent = msg;
    el.hidden = !msg;
    if (msg) setTimeout(() => { if (el.textContent === msg) el.hidden = true; }, 8000);
  }

  async function api(acao, dados) {
    if (!usuario) { mostrarErro('Entre com sua conta.'); throw new Error('sem login'); }
    let r;
    // Nada pode ficar esperando para sempre: ler print tem até 2 min, o resto até 25 s.
    const limite = acao === 'ler_print' ? 180000 : 25000;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const relogio = setTimeout(() => { if (ctrl) ctrl.abort(); }, limite);
    try {
      const token = await Promise.race([usuario.getIdToken(), new Promise((_, n) => setTimeout(() => n(new Error('login demorou')), 15000))]);
      r = await fetch('/api/prumo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(Object.assign({}, dados || {}, { acao })),
        signal: ctrl ? ctrl.signal : undefined,
      });
    } catch (e) {
      const msg = (ctrl && ctrl.signal.aborted) ? 'O servidor demorou para responder. Tente de novo.' : 'Sem internet agora. Tente de novo quando a conexão voltar.';
      mostrarErro(msg);
      const err = new Error(msg); err.status = 0; err.mostrar = true; throw err;
    } finally { clearTimeout(relogio); }
    let j = {};
    try { j = await r.json(); } catch { /* resposta vazia */ }
    if (!r.ok) {
      const msg = j.error || 'Algo deu errado. Tente de novo.';
      mostrarErro(msg);
      const e = new Error(msg); e.status = r.status; throw e;
    }
    return j;
  }

  let abrindo = 0;
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
    const btn = document.querySelector(`#abas button[data-aba="${nome}"]`);
    if (btn && btn.textContent) tituloAba.textContent = btn.textContent.trim();
    try { localStorage.setItem('prumo-aba', nome); } catch { /* sem armazenamento */ }
    const grupo = btn && btn.closest('.grupo');
    if (grupo) {
      grupo.hidden = false;
      const t = grupo.previousElementSibling;
      if (t && t.classList.contains('titulo-grupo')) t.setAttribute('aria-expanded', 'true');
    }
    fecharMenu();
    const el = $('conteudo');
    const vez = ++abrindo;
    el.innerHTML = '<p class="em-breve">Carregando…</p>';
    const ok = await carregarScript(nome);
    if (vez !== abrindo) return; // a pessoa já tocou em outra aba
    const tela = window.MB.telas[nome];
    if (!ok || typeof tela !== 'function') { el.innerHTML = '<p class="em-breve">Não consegui carregar esta aba. Feche e abra o app.</p>'; return; }
    // Cada abertura desenha num quadro próprio: uma aba antiga que termina tarde não apaga a aba nova.
    const alvo = document.createElement('div');
    el.appendChild(alvo);
    try {
      // Mantém o "Carregando…" visível até a aba desenhar; no máximo 30 s.
      await Promise.race([tela(alvo), new Promise((_, n) => setTimeout(() => n(Object.assign(new Error('A aba demorou demais para abrir.'), { mostrar: true })), 30000))]);
      if (vez !== abrindo) return;
      if (!alvo.textContent.trim() && !alvo.querySelector('img,svg,canvas,input,button')) throw Object.assign(new Error('A aba abriu vazia.'), { mostrar: true });
      const aviso = el.querySelector(':scope > .em-breve'); if (aviso) aviso.remove();
    } catch (e) {
      if (vez !== abrindo) return;
      // Nunca deixa a aba em branco: mostra o motivo e um botão para tentar de novo.
      const msg = (e && e.message && (e.status || e.mostrar)) ? e.message : 'Não consegui abrir esta aba agora.';
      el.innerHTML = '<div class="faixa erro" style="margin:0 0 12px"></div><button class="btn" type="button">Tentar de novo</button>';
      el.querySelector('.faixa').textContent = msg;
      el.querySelector('button').onclick = () => abrirAba(nome);
    }
  }

  async function verAvisos() {
    try {
      const r = await api('avisos');
      const lista = (r && r.avisos) || [];
      const el = $('aviso');
      if (!lista.length) { el.hidden = true; return; }
      el.textContent = lista.map((a) => (a.tipo === 'pontos'
        ? `✈️ ${a.saldo.toLocaleString('pt-BR')} pontos da ${a.programa} vencem em ${a.dias} dia(s).`
        : `🛒 Lembrete: na lista "${a.nome}" ainda faltam ${a.faltam} item(ns).`)).join(' ');
      el.hidden = false;
    } catch { /* aviso é opcional */ }
  }

  function fecharMenu() {
    navAbas.classList.remove('aberto');
    if (btnMenu) btnMenu.setAttribute('aria-expanded', 'false');
    if (fundoMenu) fundoMenu.hidden = true;
  }

  function abrirMenu() {
    navAbas.classList.add('aberto');
    if (btnMenu) btnMenu.setAttribute('aria-expanded', 'true');
    if (fundoMenu) fundoMenu.hidden = false;
  }

  function mostrar(logado) {
    $('tela-entrar').hidden = logado;
    $('tela-app').hidden = !logado;
    $('abas').hidden = !logado;
    $('sair').hidden = !logado;
    if (!logado) $('aviso').hidden = true;
    if (!logado) fecharMenu();
  }

  // Junta no MB que já existe (cache-api.js e outros scripts carregados antes guardam funções nele).
  window.MB = Object.assign(window.MB || {}, { api, usuario: () => usuario, telas: window.MB && window.MB.telas ? window.MB.telas : {}, abrirAba, mostrarErro });

  // Mostra o motivo real do erro de login (código do Firebase) para ficar fácil de corrigir.
  function msgLogin(e) {
    const c = (e && e.code) || 'desconhecido';
    if (c === 'auth/unauthorized-domain') return `Este endereço (${location.hostname}) ainda não está liberado no Firebase. (${c})`;
    if (c === 'auth/web-storage-unsupported' || c === 'auth/operation-not-supported-in-this-environment') return `Abra o link direto no Chrome (não dentro de outro app) e tente de novo. (${c})`;
    if (c === 'auth/network-request-failed') return `Sem internet agora. Tente de novo. (${c})`;
    return `Não consegui entrar com o Google. Tente de novo. (${c})`;
  }

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
          mostrarErro(msgLogin(e));
        }
      }
    };
    auth.getRedirectResult().catch((e) => mostrarErro(msgLogin(e)));
    $('sair').onclick = () => auth.signOut();
    document.querySelectorAll('#abas button').forEach((b) => { b.onclick = () => abrirAba(b.dataset.aba); });
    document.querySelectorAll('.titulo-grupo').forEach((b) => { b.onclick = () => toggleGrupo(b); });
    if (btnMenu) btnMenu.onclick = () => { if (navAbas.classList.contains('aberto')) fecharMenu(); else abrirMenu(); };
    if (fundoMenu) fundoMenu.onclick = fecharMenu;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenu(); });
    document.getElementById('fechar-menu').onclick = fecharMenu;
    auth.onAuthStateChanged((u) => {
      usuario = u;
      if (window.MB.api && typeof window.MB.api.limpar === 'function') window.MB.api.limpar();
      mostrar(!!u);
      if (u) {
        let ultima = 'inicio';
        try { ultima = localStorage.getItem('prumo-aba') || 'inicio'; } catch { /* sem armazenamento */ }
        abrirAba(ultima);
        verAvisos();
      }
    });
  }

  window.MB.api = MB.criarCacheApi(api);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/prumo/sw.js', { scope: '/prumo/' }).catch(() => {});
  iniciar();
})();
