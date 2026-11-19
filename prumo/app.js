// Prumo: casca do app (login Google, abas, chamada à API /api/prumo).
// Cada aba é um arquivo próprio (carteira.js, gastos.js, compras.js, objetivos.js) que registra
// window.MB.telas[nome] = function (elemento) { ... }. Se o arquivo não existir, mostra "Em breve".
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ABAS = ['inicio', 'documentos', 'contas', 'cartoes', 'dividas', 'investimentos', 'economizar', 'metas', 'familia', 'impostos', 'alertas', 'conexoes', 'assistente', 'carteira', 'gastos', 'compras', 'objetivos', 'orcamento', 'consultor', 'pontos', 'viagens', 'ajuda', 'mercado', 'robos', 'aposentadoria', 'fluxo', 'carreira', 'mes', 'patrimonio', 'beneficios', 'perfil'];
  // Redesign fase 2: cada tela antiga "mora" numa das 5 abas de baixo (a aba fica acesa) ou no Perfil.
  const CASA = { inicio: 'inicio', mes: 'mes', orcamento: 'mes', contas: 'mes', cartoes: 'mes', gastos: 'mes', compras: 'mes', fluxo: 'mes', documentos: 'mes', carreira: 'mes', conexoes: 'mes',
    patrimonio: 'patrimonio', investimentos: 'patrimonio', carteira: 'patrimonio', mercado: 'patrimonio', robos: 'patrimonio', dividas: 'patrimonio', aposentadoria: 'patrimonio', objetivos: 'patrimonio', metas: 'patrimonio',
    beneficios: 'beneficios', pontos: 'beneficios', viagens: 'beneficios' };
  const TITULO = { inicio: 'Início', mes: 'Mês', patrimonio: 'Patrimônio e futuro', beneficios: 'Benefícios', perfil: 'Perfil' };
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

  // opts.silencioso: chamada opcional (gráfico, cotação, score) não mostra a faixa vermelha de erro.
  const LEITURA_IMG = /^ler_print$|_ler$/;
  async function api(acao, dados, opts) {
    const avisar = (m) => { if (!(opts && opts.silencioso)) mostrarErro(m); };
    if (!usuario) { mostrarErro('Entre com sua conta.'); throw new Error('sem login'); }
    let r;
    // Nada pode ficar esperando para sempre: LER imagem (holerite, print, PDF) tem até 3 min, o resto até 25 s.
    // 17/11: só ler_print tinha 3 min; salario_ler e os *_print_ler desistiam em 25 s e o holerite nunca era lido.
    const limite = LEITURA_IMG.test(String(acao)) ? 180000 : 25000;
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
      avisar(msg);
      const err = new Error(msg); err.status = 0; err.mostrar = true; throw err;
    } finally { clearTimeout(relogio); }
    let j = {};
    try { j = await r.json(); } catch { /* resposta vazia */ }
    if (!r.ok) {
      const msg = j.error || 'Algo deu errado. Tente de novo.';
      avisar(msg);
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

  // Dono 19/11 ("simplifique"): o botão único "Mandar documento" do Início deixa o arquivo aqui e abre a aba certa;
  // a aba pega o arquivo uma vez só (pegarPendente) e já começa a ler. Expira em 2 minutos.
  let pendente = null;
  MB.deixarPendente = (aba, modo, arquivos) => { pendente = { aba, modo, arquivos: [...arquivos], em: Date.now() }; };
  MB.pegarPendente = (aba) => { const p = pendente; if (!p || p.aba !== aba || Date.now() - p.em > 120000) return null; pendente = null; return p; };

  // Entrega o documento do botão único ao leitor da aba (o mesmo que a pessoa usaria tocando no botão de lá).
  const LEITOR = { holerite: '#sal-arq', ponto: '#sal-arq', fatura: '#ca-fat-arq', doc: '#kf-arq', fgts: '#apo-fgts-arq', cnis: '#apo-arq', score: '#score-arq', milhas: '#pp-arq', divida: '#dv-ler-arq', conta: '#ct-ler-arq' };
  function entregarPendente(nome, alvo) {
    const p = MB.pegarPendente(nome);
    if (!p) return;
    let n = 0;
    const tentar = () => { // o card do score, por exemplo, aparece um pouco depois da aba
      const inp = alvo.querySelector(LEITOR[p.modo] || '#kf-arq');
      if (inp && typeof inp.onchange === 'function') { inp.onchange({ target: { files: p.arquivos }, modo: p.modo }); return; }
      if (++n < 25) setTimeout(tentar, 300);
    };
    tentar();
  }

  // Dono 19/11: "nenhuma tela tem voltar; o voltar do celular fecha o app". Cada tela entra no histórico do navegador:
  // o voltar do celular (e o botão ← no topo) volta para a tela anterior; janelas abertas fecham primeiro.
  const PRINCIPAIS = ['inicio', 'mes', 'patrimonio', 'beneficios'];
  function marcarHistorico(nome, opts) {
    if (opts && opts.historico) return;
    try { const st = history.state; if (!st || st.aba !== nome) history.pushState({ aba: nome }, '', location.pathname + location.search); } catch { /* sem histórico */ }
  }
  function abertoPorCima() {
    const f = document.querySelector('.kl-fundo'); if (f) { f.remove(); return true; }
    const d = document.querySelector('dialog[open]'); if (d) { d.close(); return true; }
    return false;
  }
  if (typeof window.addEventListener === 'function') window.addEventListener('popstate', (e) => {
    if (abertoPorCima()) { try { history.pushState({ aba: atual }, '', location.pathname + location.search); } catch { /* segue */ } return; }
    const nome = (e.state && e.state.aba) || 'inicio';
    abrirAba(nome, { historico: true });
  });
  let atual = 'inicio';
  async function abrirAba(nome, opts) {
    if (!ABAS.includes(nome)) nome = 'carteira';
    marcarHistorico(nome, opts);
    atual = nome;
    const bv = $('voltar'); if (bv) bv.hidden = PRINCIPAIS.includes(nome);
    document.querySelectorAll('#abas button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === nome)));
    const btn = document.querySelector(`#abas button[data-aba="${nome}"]`);
    tituloAba.textContent = TITULO[nome] || (btn && btn.textContent ? btn.textContent.trim() : '');
    document.querySelectorAll('#barra button[data-ir]').forEach((b) => { if (b.dataset.ir === (CASA[nome] || '')) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
    try { localStorage.setItem('prumo-aba', nome); } catch { /* sem armazenamento */ }
    const grupo = btn && btn.closest('.grupo');
    if (grupo) {
      grupo.hidden = false;
      const t = grupo.previousElementSibling;
      if (t && t.hasAttribute('data-mais')) document.body.classList.add('ver-tudo');
      if (t && t.classList.contains('titulo-grupo')) t.setAttribute('aria-expanded', 'true');
    }
    fecharMenu();
    if (MB.prepararAviso && nome !== 'inicio' && nome !== 'mes') MB.prepararAviso(); // guarda o "antes" para o aviso do que mudou
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
      entregarPendente(nome, alvo);
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
    $('sair').hidden = true; // "Sair" mora no Perfil (redesign)
    if ($('barra')) $('barra').hidden = !logado;
    if ($('avatar')) $('avatar').hidden = !logado;
    if (!logado) $('aviso').hidden = true;
    if (!logado) fecharMenu();
  }

  // Junta no MB que já existe (cache-api.js e outros scripts carregados antes guardam funções nele).
  window.MB = Object.assign(window.MB || {}, { api, usuario: () => usuario, telas: window.MB && window.MB.telas ? window.MB.telas : {}, abrirAba, mostrarErro });
  MB.abrirLancar = async () => { const ok = MB.lancar || await carregarScript('lancar'); if (ok && MB.lancar) MB.lancar.abrir(); else mostrarErro('Não consegui abrir o Lançar. Feche e abra o app.'); };

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
    MB.sair = () => auth.signOut();
    // Barra de baixo: 4 telas e o "+ Lançar" (folha que sobe com foto, PDF, extrato e digitar).
    document.querySelectorAll('#barra button[data-ir]').forEach((b) => { b.onclick = () => (b.dataset.ir === 'lancar' ? MB.abrirLancar() : abrirAba(b.dataset.ir)); });
    if ($('avatar')) $('avatar').onclick = () => abrirAba('perfil');
    if ($('voltar')) $('voltar').onclick = () => { if (history.state && history.state.aba && history.length > 1) history.back(); else abrirAba('inicio'); };
    document.querySelectorAll('#abas button').forEach((b) => { b.onclick = () => abrirAba(b.dataset.aba); });
    document.querySelectorAll('.titulo-grupo').forEach((b) => { b.onclick = () => toggleGrupo(b); });
    // Menu curto (dono 19/11): "Mais telas" mostra o resto; fica lembrado neste aparelho.
    const vm = document.getElementById('ver-mais');
    const mostrarTudo = (sim) => { document.body.classList.toggle('ver-tudo', sim); if (vm) { vm.setAttribute('aria-expanded', String(sim)); vm.textContent = sim ? '➖ Menos telas' : '➕ Mais telas'; } };
    let tudo = false; try { tudo = localStorage.getItem('kf-ver-tudo') === '1'; } catch { tudo = false; }
    mostrarTudo(tudo);
    if (vm) vm.onclick = () => { tudo = !tudo; mostrarTudo(tudo); try { localStorage.setItem('kf-ver-tudo', tudo ? '1' : '0'); } catch { /* sem guardar */ } };
    if (btnMenu) btnMenu.onclick = () => { if (navAbas.classList.contains('aberto')) fecharMenu(); else abrirMenu(); };
    if (fundoMenu) fundoMenu.onclick = fecharMenu;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenu(); });
    document.getElementById('fechar-menu').onclick = fecharMenu;
    auth.onAuthStateChanged((u) => {
      usuario = u;
      const av = $('avatar');
      if (av && u) { const ini = String(u.displayName || u.email || '?').trim().charAt(0).toUpperCase(); av.textContent = ini; if (u.photoURL) { const im = document.createElement('img'); im.alt = ''; im.referrerPolicy = 'no-referrer'; im.src = u.photoURL; im.onerror = () => { av.textContent = ini; }; av.textContent = ''; av.appendChild(im); } }
      if (window.MB.api && typeof window.MB.api.limpar === 'function') window.MB.api.limpar();
      mostrar(!!u);
      if (u) {
        let ultima = 'inicio';
        try { ultima = localStorage.getItem('prumo-aba') || 'inicio'; } catch { /* sem armazenamento */ }
        // Aberto pelo "Compartilhar" do Android: pega os arquivos guardados pelo service worker e vai ao Salário.
        const qtdComp = new URLSearchParams(location.search).get('compartilhado');
        if (qtdComp !== null) {
          try { history.replaceState(null, '', '/prumo/'); } catch { /* segue */ }
          (async () => {
            const arqs = [];
            try {
              const c = await caches.open('kf-compartilhado');
              for (const k of await c.keys()) { const r = await c.match(k); const b = await r.blob(); if (b.size) arqs.push(new File([b], decodeURIComponent(r.headers.get('X-Nome') || 'arquivo'), { type: b.type || r.headers.get('Content-Type') || '' })); await c.delete(k); }
            } catch { /* sem arquivos */ }
            if (!arqs.length) { mostrarErro('O arquivo compartilhado chegou vazio. Tente de novo ou mande um print.'); return abrirAba(ultima); }
            // Pergunta o que é e leva o arquivo à tela certa (a tela lê com o mesmo caminho do botão dela).
            const DEST = [
              ['holerite', 'Holerite / contracheque', 'orcamento'], ['ponto', 'Folha de ponto', 'orcamento'],
              ['documento', 'Extrato, fatura, comprovante, nota, boleto', 'documentos', '#kf-arq', '#kf-ler'],
              ['conta', 'Conta (luz, água, internet, aluguel...)', 'contas', '#ct-ler-arq'], ['cartao', 'Cartão de crédito', 'cartoes', '#ca-ler-arq'],
              ['divida', 'Dívida / contrato / boleto de acordo', 'dividas', '#dv-ler-arq'], ['score', 'Score (Serasa, SPC, Boa Vista)', 'inicio', '#score-arq'],
              ['milhas', 'Milhas / pontos', 'pontos', '#pp-arq'], ['cnis', 'CNIS (extrato do INSS)', 'aposentadoria', '#apo-arq'],
            ];
            const dlg = document.createElement('dialog');
            dlg.innerHTML = '<h3 style="margin-top:0">' + (arqs.length === 1 ? 'Arquivo recebido' : arqs.length + ' arquivos recebidos') + '</h3><label>O que é?</label><select id="kf-dest">'
              + DEST.map((d) => '<option value="' + d[0] + '">' + d[1] + '</option>').join('') + '</select><div class="linha" style="margin-top:16px"><button type="button" class="btn sec" id="kf-dest-nao">Cancelar</button><button type="button" class="btn" id="kf-dest-ok">Ler</button></div>';
            document.body.appendChild(dlg); dlg.showModal();
            dlg.querySelector('#kf-dest-nao').onclick = () => { dlg.close(); dlg.remove(); abrirAba(ultima); };
            dlg.querySelector('#kf-dest-ok').onclick = async () => {
              const d = DEST.find((x) => x[0] === dlg.querySelector('#kf-dest').value) || DEST[0];
              dlg.close(); dlg.remove();
              if (d[2] === 'orcamento') { MB.compartilhados = arqs; MB.compartilhadoTipo = d[0]; return abrirAba('orcamento'); }
              await abrirAba(d[2]);
              // Espera a tela desenhar o campo de arquivo (até 8 s) e entrega os arquivos a ele.
              let inp = null;
              for (let i = 0; i < 40 && !inp; i++) { inp = document.querySelector(d[3]); if (!inp) await new Promise((r) => setTimeout(r, 200)); }
              if (!inp) return mostrarErro('Não achei onde ler este arquivo. Abra a tela e use o botão de print.');
              try { const dt = new DataTransfer(); arqs.forEach((f) => dt.items.add(f)); inp.files = dt.files; } catch { return mostrarErro('Este celular não deixou passar o arquivo. Use o botão de print na tela.'); }
              if (d[4]) { const bt = document.querySelector(d[4]); if (bt) bt.click(); } else inp.dispatchEvent(new Event('change'));
            };
          })();
        } else {
          // O app sempre tem o Início embaixo no histórico: voltar de qualquer tela chega nele; do Início, sai.
          try { history.replaceState({ aba: 'inicio' }, '', location.pathname + location.search); } catch { /* segue */ }
          abrirAba(ultima, ultima === 'inicio' ? { historico: true } : undefined);
        }
        // Redesign fase 7: os avisos (pontos vencendo etc.) agora ficam no "Atenção" do Início, no máximo 3; a faixa de cima saiu.
        void verAvisos;
      }
    });
  }

  // Redesign fase 3: depois de gravar qualquer coisa que mexe nos números, um aviso mostra o que mudou
  // ("Pode gastar hoje: R$ X → R$ Y"). O "antes" é o último painel lido; as telas pegam um logo ao abrir.
  const apiCache = MB.criarCacheApi(api);
  const MUDA = new Set(['doc_confirmar', 'pagamento_salvar', 'cartao_salvar', 'conta_salvar', 'divida_salvar', 'gasto_salvar', 'orcamento_salvar', 'carteira_salvar', 'fgts_salvar', 'previsto_confirmar', 'previsto_adiar', 'lanc_editar', 'lanc_apagar', 'cadastro_apagar', 'desfazer', 'salario_config', 'ponto_salvar', 'invest_dividendo_salvar', 'pontos_salvar', 'score_salvar', 'conta_apagar', 'cartao_apagar', 'divida_apagar', 'pagamento_apagar', 'lote_apagar']);
  let ultimoPainel = null; let avisoMudou = null;
  const apiAviso = async (acao, dados, opts) => {
    const r = await apiCache(acao, dados, opts);
    if (acao === 'painel_resumo') ultimoPainel = r;
    else if (MUDA.has(acao) && ultimoPainel && !(opts && opts.semAviso)) {
      const antes = ultimoPainel; clearTimeout(avisoMudou);
      avisoMudou = setTimeout(async () => { if (MB.lancar || await carregarScript('lancar')) MB.lancar.oQueMudou(antes); }, 400);
    }
    return r;
  };
  apiAviso.limpar = apiCache.limpar;
  MB.painelAgora = () => ultimoPainel;
  MB.prepararAviso = () => { if (!ultimoPainel) apiAviso('painel_resumo', {}, { silencioso: true }).catch(() => {}); };
  window.MB.api = apiAviso;

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/prumo/sw.js', { scope: '/prumo/' }).catch(() => {});
  iniciar();
})();
