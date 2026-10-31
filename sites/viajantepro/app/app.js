// Viajante Pro — app do viajante. Abre só pelo link (?t=TOKEN), sem senha. Funciona sem internet.
(function () {
  'use strict';
  const VP = window.VP;
  const SITE = 'viajantepro';
  const API = window.VP_API || 'https://nexia.gcbezerra.workers.dev/api/viagem';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hojeISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const dataBR = iso => (/^\d{4}-\d{2}-\d{2}/.test(iso || '') ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : (iso || ''));
  const horaBR = iso => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };

  // ── Guardar no aparelho (IndexedDB, com localStorage de reserva) ──
  let _db = null;
  function abrirDB() {
    if (_db) return _db;
    _db = new Promise(ok => {
      try {
        const r = indexedDB.open('viajantepro', 2);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ok(null);
      } catch (e) { ok(null); }
    });
    return _db;
  }
  async function ler(k) {
    const db = await abrirDB();
    if (!db) { try { return JSON.parse(localStorage.getItem('vp:' + k)); } catch (e) { return null; } }
    return new Promise(ok => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => ok(r.result == null ? null : r.result); r.onerror = () => ok(null); });
  }
  async function gravar(k, v) {
    const db = await abrirDB();
    if (!db) { try { localStorage.setItem('vp:' + k, JSON.stringify(v)); } catch (e) { /* cheio */ } return; }
    return new Promise(ok => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = ok; tx.onerror = ok; });
  }

  async function chamar(corpo) {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ site: SITE, ...corpo }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'Erro ' + r.status); e.status = r.status; throw e; }
    return j;
  }

  // ── Estado ──
  let T = '';
  let dados = null; // { viagem, agencia, salvo_em }
  let fila = [];
  let conversa = [];
  let offlineDesde = navigator.onLine ? 0 : Date.now();
  let aba = 'hoje';

  function irPara(nome) {
    aba = nome;
    document.querySelectorAll('.tela').forEach(s => s.classList.toggle('ativa', s.dataset.aba === nome));
    document.querySelectorAll('#menu button').forEach(b => b.classList.toggle('ativo', b.dataset.ir === nome));
    if (nome === 'conversa') { $('badge').classList.add('oculto'); atualizarConversa(); setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 50); }
    else window.scrollTo(0, 0);
  }

  // ── Telas ──
  function telaHoje(v) {
    const f = VP.fase(v, hojeISO());
    let topo = '';
    if (f.fase === 'antes') topo = `<div class="cartao contagem"><b>${f.dias}</b>${f.dias === 1 ? 'dia' : 'dias'} para a viagem<p class="det">Saída ${esc(dataBR(v.data_saida))} · ${esc(v.destino)}</p></div>`;
    else if (f.fase === 'depois') topo = `<div class="cartao contagem"><b>🏠</b>Bem-vindo de volta! Conte para a gente como foi.</div>`;
    const ev = VP.eventosDoDia(v, f.fase === 'antes' ? v.data_saida : hojeISO());
    const tit = f.fase === 'antes' ? `No dia da saída (${esc(dataBR(v.data_saida))})` : 'Hoje';
    const lista = ev.length ? `<ul class="linha-tempo">${ev.map(e => `<li><span class="hora">${esc(e.hora || '—')}</span><div><b>${esc(e.titulo)}</b>${e.detalhe ? `<div class="det">${esc(e.detalhe)}</div>` : ''}${e.alerta ? `<span class="tag-alerta">${esc(e.alerta)}</span>` : ''}</div></li>`).join('')}</ul>` : '<p class="vazio">Nada marcado para este dia.</p>';
    const avisos = (v.avisos || []).map(a => `<div class="cartao aviso">📢 ${esc(a.texto || a)}</div>`).join('');
    const checkins = (v.voos || []).map(x => ({ x, a: VP.avisoCheckin(x, Date.now()) })).filter(o => o.a)
      .map(o => `<div class="cartao aviso">✈️ ${esc(o.x.trecho || o.x.numero)}: ${esc(o.a)}${o.x.link_checkin ? ` <a href="${esc(o.x.link_checkin)}" target="_blank" rel="noopener">Fazer check-in</a>` : ''}</div>`).join('');
    $('tela-hoje').innerHTML = topo + avisos + checkins + `<div class="cartao"><h2>${tit}</h2>${lista}</div>` +
      `<div class="linha-btns"><button class="btn contorno" data-ir="motorista" type="button">🚕 Mostre ao motorista</button><button class="btn contorno" data-ir="conversa" type="button">💬 Falar com a agência</button></div>`;
  }

  function telaVoos(v) {
    const voos = v.voos || [];
    $('tela-voos').innerHTML = voos.length ? voos.map((x, i) => `
      <div class="cartao">
        <h2>${esc(x.trecho || 'Voo')}</h2>
        ${VP.alertaVoo(x) ? `<span class="tag-alerta">${esc(VP.alertaVoo(x))}</span>` : (x.status ? `<p class="det">Status: ${esc(x.status)}</p>` : '')}
        <div class="dados">
          <div><small>Companhia</small><b>${esc(x.cia)} ${esc(x.numero)}</b></div>
          <div><small>Data</small><b>${esc(dataBR(x.data))}</b></div>
          <div><small>Saída</small><b>${esc(x.partida || '—')}</b></div>
          <div><small>Chegada</small><b>${esc(x.chegada || '—')}</b></div>
          <div><small>Terminal</small><b>${esc(x.terminal || '—')}</b></div>
          <div><small>Portão</small><b>${esc(x.portao || '—')}</b></div>
          <div><small>Assento</small><b>${esc(x.assento || '—')}</b></div>
          <div><small>Localizador</small><b>${esc(x.localizador || '—')}</b></div>
          <div><small>Bagagem de mão</small><b>${esc(x.bagagem_mao || '—')}</b></div>
          <div><small>Despachada</small><b>${esc(x.bagagem_despachada || '—')}</b></div>
        </div>
        ${VP.avisoCheckin(x, Date.now()) ? `<p class="det">⏰ ${esc(VP.avisoCheckin(x, Date.now()))}</p>` : ''}
        <div class="linha-btns">
          ${x.localizador ? `<button class="btn contorno" type="button" data-copiar="${esc(x.localizador)}">Copiar localizador</button>` : ''}
          ${x.link_checkin ? `<a class="btn" href="${esc(x.link_checkin)}" target="_blank" rel="noopener" data-voo="${i}">Fazer check-in</a>` : ''}
        </div>
      </div>`).join('') : '<p class="vazio">A agência ainda não colocou os voos.</p>';
  }

  function telaRoteiro(v) {
    const r = v.roteiro || [];
    $('tela-roteiro').innerHTML = r.length ? r.map(d => `
      <div class="cartao"><h2>${esc(dataBR(d.data))} ${esc(d.titulo || '')}</h2>
        <ul class="linha-tempo">${(d.itens || []).map(i => `<li><span class="hora">${esc(i.hora || '—')}</span><div><b>${esc(i.titulo)}</b>${i.endereco ? `<div class="det">${esc(i.endereco)}</div><a href="${VP.linkMapa(i.endereco)}" target="_blank" rel="noopener">Abrir no mapa</a>` : ''}</div></li>`).join('')}</ul>
      </div>`).join('') : '<p class="vazio">O roteiro dia a dia ainda não foi colocado.</p>';
  }

  function telaEstadia(v) {
    const h = (v.hoteis || []).map(x => `<div class="cartao"><h2>🏨 ${esc(x.nome)}</h2>
      ${x.endereco ? `<p>${esc(x.endereco)}</p>` : ''}
      <div class="dados"><div><small>Check-in</small><b>${esc(dataBR(x.checkin))} ${esc(x.checkin_hora || '')}</b></div><div><small>Check-out</small><b>${esc(dataBR(x.checkout))} ${esc(x.checkout_hora || '')}</b></div>
      <div><small>Telefone</small><b>${esc(x.telefone || '—')}</b></div><div><small>Voucher</small><b>${esc(x.voucher || '—')}</b></div></div>
      <div class="linha-btns">${x.endereco ? `<a class="btn contorno" href="${VP.linkMapa(x.endereco)}" target="_blank" rel="noopener">Abrir no mapa</a>` : ''}${x.telefone ? `<a class="btn contorno" href="tel:${esc(x.telefone)}">Ligar</a>` : ''}<button class="btn" type="button" data-ir="motorista">Mostre ao motorista</button></div></div>`).join('');
    const c = (v.carros || []).map(x => `<div class="cartao"><h2>🚗 ${esc(x.locadora || 'Carro')}</h2><div class="dados"><div><small>Retirada</small><b>${esc(dataBR(x.retirada))} ${esc(x.retirada_hora || '')}</b></div><div><small>Devolução</small><b>${esc(dataBR(x.devolucao))}</b></div><div><small>Reserva</small><b>${esc(x.reserva || '—')}</b></div></div>${x.endereco ? `<p class="det">${esc(x.endereco)}</p>` : ''}</div>`).join('');
    const t = (v.transfers || []).map(x => `<div class="cartao"><h2>🚐 Transfer ${esc(dataBR(x.data))} ${esc(x.hora || '')}</h2><p>${esc(x.de)} → ${esc(x.para)}</p>${x.motorista ? `<p class="det">Motorista: ${esc(x.motorista)} ${esc(x.telefone || '')}</p>` : ''}</div>`).join('');
    const bag = v.bagagem && (v.bagagem.mao || v.bagagem.despachada || v.bagagem.dicas) ? `<div class="cartao"><h2>🧳 Bagagem</h2>${v.bagagem.mao ? `<p>Mão: ${esc(v.bagagem.mao)}</p>` : ''}${v.bagagem.despachada ? `<p>Despachada: ${esc(v.bagagem.despachada)}</p>` : ''}${v.bagagem.dicas ? `<p class="det">${esc(v.bagagem.dicas)}</p>` : ''}</div>` : '';
    $('tela-estadia').innerHTML = (h + c + t + bag) || '<p class="vazio">Hotel, carro e transfer ainda não foram colocados.</p>';
  }

  function telaDocs(v) {
    const d = v.documentos || [];
    $('tela-docs').innerHTML = d.length ? d.map((x, i) => `<div class="cartao"><h3>📄 ${esc(x.titulo || 'Documento')}</h3><div class="linha-btns">${x.arquivo ? `<button class="btn" type="button" data-doc="${i}">Abrir</button>` : ''}${x.url ? `<a class="btn contorno" href="${esc(x.url)}" target="_blank" rel="noopener">Abrir link</a>` : ''}</div><p class="det" id="doc-st-${i}"></p></div>`).join('') : '<p class="vazio">Nenhum documento ainda (vouchers, seguro e bilhetes aparecem aqui).</p>';
    d.forEach((x, i) => { if (x.arquivo) ler('arq:' + x.arquivo).then(a => { const el = $('doc-st-' + i); if (el) el.textContent = a ? '✓ Guardado no celular (abre sem internet)' : 'Abra uma vez com internet para guardar no celular.'; }); });
  }

  async function abrirDoc(i) {
    const x = (dados.viagem.documentos || [])[i];
    if (!x) return;
    let a = await ler('arq:' + x.arquivo);
    if (!a) {
      try {
        const r = await fetch(`${API}?site=${SITE}&t=${T}&arquivo=${encodeURIComponent(x.arquivo)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        a = j.arquivo; await gravar('arq:' + x.arquivo, a);
      } catch (e) { alert('Sem internet: este documento ainda não foi guardado no celular.'); return; }
    }
    const w = window.open();
    if (w) { w.document.title = a.nome || 'Documento'; w.document.body.style.margin = 0; const el = a.dados.startsWith('data:application/pdf') ? w.document.createElement('iframe') : w.document.createElement('img'); el.src = a.dados; el.style.cssText = 'width:100%;height:100vh;border:0;object-fit:contain'; w.document.body.appendChild(el); }
    telaDocs(dados.viagem);
  }

  function telaMotorista(v) {
    const h = (v.hoteis || [])[0];
    $('tela-motorista').innerHTML = h ? `<div class="motorista"><p>Please take me to / Por favor, lléveme a:</p><div class="grande">${esc(h.nome)}</div><p class="grande" style="font-size:1.4rem">${esc(h.endereco_local || h.endereco || '')}</p>${h.telefone ? `<p>☎ ${esc(h.telefone)}</p>` : ''}</div><div class="linha-btns"><button class="btn contorno" type="button" data-ir="hoje">Voltar</button></div>` : '<p class="vazio">A agência ainda não colocou o hotel.</p>';
  }

  function numero24h() { const e = dados.viagem.emergencia || {}; return e.telefone_24h || dados.agencia.telefone_24h || dados.agencia.whatsapp || ''; }

  function telaSOS(v) {
    const e = v.emergencia || {};
    $('tela-sos').innerHTML = `
      <div class="cartao"><h2>Emergência</h2><p>O botão abaixo pega sua localização pelo GPS (funciona sem internet) e prepara um SMS para a agência.</p>
      <button id="btn-sos" class="btn vermelho sos-grande" type="button">🆘 SOS — pedir ajuda</button><div id="sos-saida"></div></div>
      <div class="cartao"><h3>Telefones</h3>
        <p>Viajante Pro 24h: ${numero24h() ? `<a href="tel:+${esc(numero24h())}">+${esc(numero24h())}</a>` : '—'}</p>
        ${e.numero_pais ? `<p>Emergência do país: <a href="tel:${esc(e.numero_pais)}">${esc(e.numero_pais)}</a></p>` : ''}
        ${e.consulado ? `<p>Consulado: ${esc(e.consulado)}</p>` : ''}
        ${e.contato_nome ? `<p>Seu contato: ${esc(e.contato_nome)} ${e.contato_telefone ? `<a href="tel:+${esc(e.contato_telefone)}">${esc(e.contato_telefone)}</a>` : ''}</p>` : ''}
        ${e.seguro ? `<p>Seguro viagem: ${esc(e.seguro)}</p>` : ''}
      </div>`;
  }

  function sos() {
    const v = dados.viagem;
    const saida = $('sos-saida');
    saida.innerHTML = '<p>Pegando sua localização…</p>';
    const montar = (lat, lon) => {
      const texto = VP.mensagemSOS(v.cliente_nome || (v.passageiros[0] || {}).nome, v.titulo, lat, lon);
      const e = v.emergencia || {};
      saida.innerHTML = `<p class="det">${esc(texto)}</p><div class="linha-btns">
        <a class="btn vermelho" id="sos-sms" href="${VP.linkSMS(numero24h(), texto)}">SMS para a agência</a>
        ${e.contato_telefone ? `<a class="btn contorno" href="${VP.linkSMS(e.contato_telefone, texto)}">SMS para ${esc(e.contato_nome || 'seu contato')}</a>` : ''}
        <a class="btn verde" href="${VP.linkWhats(numero24h(), texto)}" target="_blank" rel="noopener">WhatsApp</a></div>`;
      enfileirar(texto);
    };
    if (!navigator.geolocation) return montar();
    navigator.geolocation.getCurrentPosition(p => montar(p.coords.latitude, p.coords.longitude), () => montar(), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  // ── Conversa com fila sem internet ──
  function desenharConversa() {
    const tudo = VP.juntarConversa(conversa, fila);
    $('msgs').innerHTML = tudo.length ? tudo.map(m => `<div class="msg ${m.de === 'cliente' ? 'eu' : ''}">${m.de === 'equipe' ? `<b>${esc(m.nome_equipe || 'Agência')}</b><br>` : ''}${esc(m.texto)}<small>${esc(horaBR(m.criado_em))} ${m.de === 'cliente' ? (m.pendente ? '🕓' : '✓') : ''}</small></div>`).join('') : '<p class="vazio">Mande uma mensagem. A agência responde aqui.</p>';
    const semNet = offlineDesde && Date.now() - offlineDesde > 60000;
    $('sem-net-opcoes').classList.toggle('oculto', !semNet);
    const ult = fila.map(m => m.texto).join('\n') || 'Olá, preciso de ajuda com minha viagem.';
    const txt = `Viajante Pro - ${dados.viagem.cliente_nome || ''} (${dados.viagem.titulo}): ${ult}`;
    $('btn-sms').href = VP.linkSMS(numero24h(), txt);
    $('btn-whats').href = VP.linkWhats(dados.agencia.whatsapp || numero24h(), txt);
  }

  async function enfileirar(texto) {
    if (!String(texto || '').trim()) return;
    fila = VP.novaMensagem(fila, texto, Date.now()).fila;
    await gravar('fila:' + T, fila);
    desenharConversa();
    enviarPendentes();
  }

  let enviando = false;
  async function enviarPendentes() {
    if (enviando || !fila.length) return;
    enviando = true;
    try {
      const r = await VP.enviarFila(fila, m => chamar({ acao: 'msg_enviar', t: T, texto: m.texto, id_local: m.id_local }));
      fila = r.fila;
      await gravar('fila:' + T, fila);
      if (r.enviadas.length) await atualizarConversa();
    } finally { enviando = false; desenharConversa(); }
  }

  async function atualizarConversa() {
    try {
      const j = await chamar({ acao: 'msg_listar', t: T });
      const antes = conversa.filter(m => m.de === 'equipe').length;
      conversa = j.mensagens || [];
      await gravar('conversa:' + T, conversa);
      const novas = conversa.filter(m => m.de === 'equipe').length - antes;
      if (novas > 0 && aba !== 'conversa') { $('badge').textContent = novas; $('badge').classList.remove('oculto'); }
    } catch (e) { /* sem internet: fica a cópia guardada */ }
    desenharConversa();
  }

  // ── Carregar viagem ──
  function desenhar(salvoEm, offline) {
    const v = dados.viagem;
    $('agencia-nome').textContent = dados.agencia.nome || 'Viajante Pro';
    $('viagem-titulo').textContent = `${v.titulo}${v.destino ? ' · ' + v.destino : ''}`;
    const al = VP.alertas(v);
    $('faixa-alerta').classList.toggle('oculto', !al.length);
    $('faixa-alerta').textContent = al.map(a => `⚠️ ${a.voo.trecho || a.voo.numero}: ${a.texto}`).join(' · ');
    $('faixa-offline').classList.toggle('oculto', !offline);
    $('faixa-offline').textContent = `Sem internet — mostrando a cópia guardada, atualizada às ${horaBR(salvoEm)} de ${dataBR(String(salvoEm).slice(0, 10))}`;
    telaHoje(v); telaVoos(v); telaRoteiro(v); telaEstadia(v); telaDocs(v); telaMotorista(v); telaSOS(v);
    $('carregando').classList.remove('ativa'); $('menu').classList.remove('oculto');
    if (!document.querySelector('.tela.ativa[data-aba]')) irPara(aba);
    desenharConversa();
  }

  async function carregar() {
    try {
      const j = await chamar({ acao: 'app_viagem', t: T });
      dados = { viagem: j.viagem, agencia: j.agencia || {}, salvo_em: new Date().toISOString() };
      await gravar('viagem:' + T, dados);
      desenhar(dados.salvo_em, false);
      // guarda os documentos no celular para abrir sem internet
      (dados.viagem.documentos || []).forEach(async d => {
        if (!d.arquivo || await ler('arq:' + d.arquivo)) return;
        try { const r = await fetch(`${API}?site=${SITE}&t=${T}&arquivo=${encodeURIComponent(d.arquivo)}`); const a = await r.json(); if (r.ok) { await gravar('arq:' + d.arquivo, a.arquivo); telaDocs(dados.viagem); } } catch (e) { /* tenta depois */ }
      });
    } catch (e) {
      const salvo = await ler('viagem:' + T);
      if (salvo && e.status !== 404) { dados = salvo; desenhar(salvo.salvo_em, true); return; }
      $('carregando').classList.remove('ativa'); $('erro').classList.add('ativa');
      $('erro-texto').textContent = e.status === 404 ? e.message : 'Sem internet e sem cópia guardada neste celular.';
    }
  }

  async function iniciar() {
    const p = new URLSearchParams(location.search);
    T = (p.get('t') || '').toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(T)) T = (await ler('token')) || '';
    if (!/^[a-f0-9]{32}$/.test(T)) { $('carregando').classList.remove('ativa'); $('erro').classList.add('ativa'); $('erro-texto').textContent = 'Este link está incompleto.'; return; }
    await gravar('token', T);
    fila = (await ler('fila:' + T)) || [];
    conversa = (await ler('conversa:' + T)) || [];
    await carregar();
    if (!dados) return;
    enviarPendentes();
    atualizarConversa();
    setInterval(() => { if (navigator.onLine && document.visibilityState === 'visible') { enviarPendentes(); atualizarConversa(); } }, 20000);
    setInterval(() => { if (aba === 'conversa') desenharConversa(); }, 15000);
  }

  // ── Eventos ──
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-ir],[data-copiar],[data-doc],#btn-sos');
    if (!b) return;
    if (b.dataset.ir) irPara(b.dataset.ir);
    else if (b.dataset.copiar) { navigator.clipboard && navigator.clipboard.writeText(b.dataset.copiar); b.textContent = 'Copiado ✓'; }
    else if (b.dataset.doc) abrirDoc(Number(b.dataset.doc));
    else if (b.id === 'btn-sos') sos();
  });
  $('form-msg').addEventListener('submit', ev => { ev.preventDefault(); const i = $('msg-texto'); enfileirar(i.value); i.value = ''; });
  window.addEventListener('online', () => { offlineDesde = 0; $('faixa-offline').classList.add('oculto'); if (dados) { enviarPendentes(); carregar(); } });
  window.addEventListener('offline', () => { offlineDesde = Date.now(); if (dados) desenharConversa(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && dados && navigator.onLine) { enviarPendentes(); atualizarConversa(); } });

  let pedidoInstalar = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedidoInstalar = e; $('btn-instalar').classList.remove('oculto'); });
  $('btn-instalar').addEventListener('click', () => { if (pedidoInstalar) { pedidoInstalar.prompt(); pedidoInstalar = null; $('btn-instalar').classList.add('oculto'); } });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  iniciar();
})();
