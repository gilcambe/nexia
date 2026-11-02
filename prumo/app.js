'use strict';
// Prumo: casca do app (login Google, chamada à API e abas). As telas ficam em /prumo/telas.js.
(function () {
  const tela = document.getElementById('tela');
  const abas = document.getElementById('abas');
  const MB = (window.MB = { telas: {}, usuario: null });

  MB.brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  MB.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  MB.erro = (msg, ok) => {
    const d = document.createElement('div');
    d.className = 'erro';
    if (ok) d.style.cssText = 'background:#0f3a20;color:#bbf7d0';
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), ok ? 2500 : 5000);
  };
  MB.api = async (acao, dados) => {
    if (!MB.usuario) throw new Error('Entre com sua conta.');
    const token = await MB.usuario.getIdToken();
    let r, j;
    try {
      r = await fetch('/api/prumo', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ acao, ...(dados || {}) }) });
      j = await r.json().catch(() => ({}));
    } catch {
      MB.erro('Sem internet. Tente de novo.');
      throw new Error('offline');
    }
    if (!r.ok) { MB.erro(j.error || 'Algo deu errado.'); throw new Error(j.error || String(r.status)); }
    return j;
  };

  let abaAtual = 'carteira';
  MB.abrir = async (aba) => {
    abaAtual = aba;
    try { localStorage.setItem('prumo_aba', aba); } catch { /* sem armazenamento */ }
    abas.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.aba === aba));
    tela.innerHTML = '<p class="fraco">Carregando…</p>';
    const fn = MB.telas[aba];
    if (!fn) { tela.innerHTML = '<div class="card">Em breve.</div>'; return; }
    try { await fn(tela); } catch (e) { if (e.message !== 'offline') tela.innerHTML = '<div class="card">Não consegui abrir agora. Puxe para atualizar.</div>'; }
    mostrarAvisos();
  };
  MB.recarregar = () => MB.abrir(abaAtual);
  abas.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) MB.abrir(b.dataset.aba); });

  async function mostrarAvisos() {
    try {
      const { avisos } = await MB.api('avisos');
      if (avisos && avisos.length) {
        const d = document.createElement('div');
        d.className = 'aviso';
        d.innerHTML = '🔔 ' + avisos.map((a) => `Lista <b>${MB.esc(a.nome)}</b>: faltam ${a.faltam} itens`).join('<br>');
        tela.prepend(d);
      }
    } catch { /* aviso é opcional */ }
  }

  function telaEntrar() {
    abas.hidden = true;
    document.getElementById('sair').hidden = true;
    tela.innerHTML = `<div class="entrar"><img src="/prumo/icone.svg" alt=""><h1>Prumo</h1>
      <p class="fraco">Seus investimentos de todos os bancos, gastos de cartão, objetivos e lista de compras num lugar só.</p>
      <button class="btn" id="entrar">Entrar com Google</button></div>`;
    document.getElementById('entrar').onclick = async () => {
      const prov = new firebase.auth.GoogleAuthProvider();
      try { await firebase.auth().signInWithPopup(prov); } catch (e) {
        if (e && /popup/.test(e.code || '')) await firebase.auth().signInWithRedirect(prov);
        else MB.erro('Não consegui entrar. Tente de novo.');
      }
    };
  }

  async function iniciar() {
    let cfg = null;
    try { cfg = await (await fetch('/api/firebase-config', { cache: 'no-store' })).json(); } catch { /* abaixo */ }
    if (!cfg || !cfg.apiKey) { tela.innerHTML = '<div class="card">Serviço indisponível. Tente em instantes.</div>'; return; }
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    document.getElementById('sair').onclick = () => firebase.auth().signOut();
    firebase.auth().onAuthStateChanged((u) => {
      MB.usuario = u;
      if (!u) return telaEntrar();
      abas.hidden = false;
      document.getElementById('sair').hidden = false;
      let aba = 'carteira';
      try { aba = localStorage.getItem('prumo_aba') || aba; } catch { /* padrão */ }
      MB.abrir(aba);
    });
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/prumo/sw.js', { scope: '/prumo/' }).catch(() => {});
  iniciar();
})();
