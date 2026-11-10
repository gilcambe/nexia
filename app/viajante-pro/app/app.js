/* Viajante Pro — App do passageiro (mobile first).
   Abre pelo link que a agência envia: /viajante-pro/app?v=<código secreto da viagem>.
   Usa só ações reais da API: app-viagem, app-chat-listar, app-chat-enviar e /api/vp-arquivos (app-listar).
   Sem internet: mostra a última cópia salva e guarda mensagens para enviar depois.
   Ícones: desenhos lineares no estilo Lucide (ISC License). */
(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/viajante-pro/app/sw.js', { scope: '/viajante-pro/app/' }).catch(function () { /* sem SW, segue online */ });
    });
  }

  var P = {
    casa: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    roteiro: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    aviao: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    pasta: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    conversa: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    carro: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    hotel: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
    telefone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    local: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    pessoas: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    mandar: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    copiar: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    ingresso: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
    escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
    bussola: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/>',
    estrela: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  };
  function ic(n, c) { return '<svg class="ic' + (c ? ' ' + c : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>'; }
  document.querySelectorAll('svg[data-i]').forEach(function (s) { s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = P[s.getAttribute('data-i')] || ''; });

  var $ = function (s) { return document.querySelector(s); };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function dataBR(s, longa) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); if (!m) return ''; return longa ? (+m[3]) + ' ' + MESES[+m[2] - 1] + ' ' + m[1] : m[3] + '/' + m[2]; }
  function hojeISO() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function diasEntre(a, b) { return Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000); }
  function somaDias(iso, n) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* cheio ou privado */ } }
  function ler(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function aviso(t) { var a = document.createElement('div'); a.className = 'aviso'; a.textContent = t; $('#avisos').appendChild(a); setTimeout(function () { a.remove(); }, 2800); }
  function whats(fone, texto) { var d = String(fone || '').replace(/\D/g, ''); if (!d) return ''; if (d.length <= 11) d = '55' + d; return 'https://wa.me/' + d + (texto ? '?text=' + encodeURIComponent(texto) : ''); }

  // ── Rede ──
  function atualizarStatusRede() {
    var b = $('#badge-status-rede'); if (!b) return;
    b.classList.toggle('off', !navigator.onLine);
    b.title = navigator.onLine ? 'Online' : 'Sem internet';
  }
  window.addEventListener('online', function () { atualizarStatusRede(); enviarPendentes(); carregar(); });
  window.addEventListener('offline', atualizarStatusRede);

  // ── Código da viagem (link da agência) ──
  var params = new URLSearchParams(location.search);
  var codigo = params.get('v') || params.get('t') || '';
  if (codigo) { try { localStorage.setItem('vp_token', codigo); } catch (e) { /* ok */ } }
  else { try { codigo = localStorage.getItem('vp_token') || ''; } catch (e) { codigo = ''; } }
  var CACHE = 'vp_viagem_cache';
  var viagem = null;
  var agencia = ler('vp_agencia') || {};
  var abaAtual = 'hoje';

  function api(corpo) {
    return fetch('/api/viajante-pro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (j && j.offline === true) { var e0 = new Error('sem_rede'); e0.codigo = 0; throw e0; }
        if (!r.ok) { var e = new Error(j.error || 'erro'); e.codigo = r.status; throw e; }
        return j;
      });
    });
  }

  // Normaliza a viagem da API para as telas (nunca inventa dados).
  function converter(resposta) {
    var v = (resposta && resposta.viagem) || {};
    return {
      id: v.id || '',
      nome: v.nome || 'Minha viagem',
      destino: v.destino || '',
      inicio: (v.datas && v.datas.inicio) || '',
      fim: (v.datas && v.datas.fim) || '',
      status: v.status || 'confirmada',
      passageiros: (v.passageiros || []).filter(function (p) { return p && (p.nome || p.email); }),
      roteiro: (v.roteiro || []).filter(function (r) { return r && r.descricao; }).sort(function (a, b) { return (a.dia || 0) - (b.dia || 0); }),
      servicos: (v.servicos || []).filter(function (s) { return s && s.status !== 'cancelada'; }),
      boas_vindas: v.mensagem_boas_vindas || '',
      emergencia: v.contato_emergencia || '',
    };
  }

  function mostrarMensagem(texto, comBotao) {
    $('#app-conteudo').innerHTML = '<div class="msg-central"><div class="logo-g"><img src="/viajante-pro/img/vp-oficial.jpg" alt="Viajante Pro"></div><h2 style="font-family:var(--titulo);font-weight:600;margin:0 0 8px">Sua viagem, na palma da mão</h2><p>' + esc(texto) + '</p>' + (comBotao ? '<p><button class="btn ouro" onclick="location.reload()">Tentar de novo</button></p>' : '') + '</div>';
    $('#carimbo-atualizacao').textContent = 'Viajante Pro';
  }

  function carimbo(quando, offline) {
    var d = new Date(quando || Date.now());
    $('#carimbo-atualizacao').textContent = (offline ? 'Sem internet · ' : '') + 'atualizado às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function carregar() {
    if (!codigo) return Promise.resolve(mostrarMensagem('Abra o link que a Viajante Pro enviou para você para ver sua viagem.'));
    return api({ acao: 'app-viagem', codigo: codigo }).then(function (r) {
      viagem = converter(r);
      guardar(CACHE, { codigo: codigo, viagem: viagem, em: Date.now() });
      carimbo(Date.now());
      desenhar();
    }).catch(function (err) {
      if (err.codigo === 404) {
        try { localStorage.removeItem('vp_token'); localStorage.removeItem(CACHE); } catch (e) { /* ok */ }
        viagem = null;
        return mostrarMensagem('Este link não é mais válido. Peça um link novo à Viajante Pro.');
      }
      var salvo = ler(CACHE);
      if (salvo && salvo.codigo === codigo) { viagem = salvo.viagem; carimbo(salvo.em, true); desenhar(); }
      else mostrarMensagem('Sem internet e sem cópia salva neste aparelho. Conecte-se e tente de novo.', true);
    });
  }

  function buscarAgencia() {
    return fetch('/api/viajante-pro?site=viajantepro').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.config) { agencia = { whatsapp: j.config.whatsapp || '', email: j.config.email || '', nome: j.config.nome || 'Viajante Pro' }; guardar('vp_agencia', agencia); }
    }).catch(function () { /* usa a cópia salva */ });
  }

  // ── Telas ──
  var TIPO = { voo: ['Voo', 'aviao'], hotel: ['Hospedagem', 'hotel'], transfer: ['Transfer', 'carro'], passeio: ['Passeio', 'ingresso'], seguro: ['Seguro viagem', 'escudo'], trem: ['Trem', 'bussola'], carro: ['Carro', 'carro'], cruzeiro: ['Cruzeiro', 'bussola'], outro: ['Serviço', 'estrela'] };
  function situacao(v) {
    var hj = hojeISO();
    if (!v.inicio) return { rot: 'Datas a confirmar', num: '', txt: '' };
    var falta = diasEntre(hj, v.inicio);
    if (falta > 0) return { rot: 'Contagem regressiva', num: falta, txt: falta === 1 ? 'dia para embarcar' : 'dias para embarcar' };
    var total = v.fim ? diasEntre(v.inicio, v.fim) + 1 : 0;
    var dia = diasEntre(v.inicio, hj) + 1;
    if (!v.fim || dia <= total) return { rot: 'Boa viagem!', num: 'Dia ' + dia, txt: total ? 'de ' + total : '', dia: dia };
    return { rot: 'Viagem concluída', num: '', txt: 'Esperamos que tenha sido inesquecível.' };
  }
  function servicoHtml(s) {
    var t = TIPO[s.tipo] || TIPO.outro;
    var quando = s.inicio ? dataBR(s.inicio, true) + (s.fim && s.fim !== s.inicio ? ' até ' + dataBR(s.fim, true) : '') : '';
    return '<div class="servico"><span class="ico">' + ic(t[1]) + '</span><div class="meio"><small>' + t[0] + (s.fornecedor ? ' · ' + esc(s.fornecedor) : '') + '</small><b>' + esc(s.descricao) + '</b>' + (quando ? '<small>' + quando + '</small>' : '') +
      (s.localizador ? '<button class="localizador" type="button" data-copiar="' + esc(s.localizador) + '">' + ic('copiar', 'p') + esc(s.localizador) + '</button>' : '') +
      '<div><span class="tag ' + esc(s.status) + '">' + (s.status === 'confirmada' ? 'Confirmado' : 'Em confirmação') + '</span></div></div></div>';
  }

  var TELAS = {
    hoje: function () {
      var v = viagem, s = situacao(v), hj = hojeISO();
      var doDia = s.dia ? v.roteiro.filter(function (r) { return +r.dia === s.dia; })[0] : null;
      var proximos = v.servicos.filter(function (x) { return x.inicio && x.inicio >= hj; }).sort(function (a, b) { return a.inicio.localeCompare(b.inicio); }).slice(0, 2);
      return '<section class="hero"><small class="rot">' + esc(s.rot) + '</small><h1>' + esc(v.nome) + '</h1><div class="linha">' +
        (v.destino ? '<span>' + ic('local', 'p') + esc(v.destino) + '</span>' : '') +
        (v.inicio ? '<span>' + ic('calendario', 'p') + dataBR(v.inicio, true) + (v.fim ? ' — ' + dataBR(v.fim, true) : '') + '</span>' : '') +
        (v.passageiros.length ? '<span>' + ic('pessoas', 'p') + v.passageiros.length + ' viajante' + (v.passageiros.length > 1 ? 's' : '') + '</span>' : '') +
        '</div>' + (s.num !== '' || s.txt ? '<div class="contagem">' + (s.num !== '' ? '<b>' + esc(s.num) + '</b>' : '') + '<span>' + esc(s.txt) + '</span></div>' : '') + '</section>' +
        (v.boas_vindas ? '<section class="cartao"><h2>' + ic('estrela', 'p') + 'Da sua agência</h2><p class="boas-vindas">' + esc(v.boas_vindas) + '</p></section>' : '') +
        (doDia ? '<section class="cartao"><h2>' + ic('roteiro', 'p') + 'Hoje · dia ' + s.dia + '</h2><p style="white-space:pre-wrap">' + esc(doDia.descricao) + '</p></section>' : '') +
        (proximos.length ? '<section class="cartao"><h2>' + ic('relogio', 'p') + 'Próximos compromissos</h2>' + proximos.map(servicoHtml).join('') + '</section>' : '') +
        '<div class="atalhos"><button class="atalho" data-aba="roteiro">' + ic('roteiro') + 'Roteiro completo</button><button class="atalho" data-aba="documentos">' + ic('pasta') + 'Vouchers e documentos</button><button class="atalho" data-aba="voos">' + ic('aviao') + 'Voos e reservas</button><button class="atalho" data-aba="conversa">' + ic('conversa') + 'Falar com a agência</button></div>';
    },
    roteiro: function () {
      var v = viagem, s = situacao(v);
      if (!v.roteiro.length) return '<h2 class="titulo-secao">Roteiro</h2>' + vazio('roteiro', 'Roteiro em preparação', 'A agência vai publicar aqui o seu dia a dia.');
      return '<h2 class="titulo-secao">Roteiro dia a dia</h2><div class="linha-tempo">' + v.roteiro.map(function (r) {
        var data = v.inicio ? dataBR(somaDias(v.inicio, (+r.dia || 1) - 1), true) : '';
        return '<div class="dia' + (s.dia === +r.dia ? ' hoje' : '') + '"><div class="cartao"><small>Dia ' + esc(r.dia) + (data ? ' · ' + data : '') + (s.dia === +r.dia ? ' · hoje' : '') + '</small><p>' + esc(r.descricao) + '</p></div></div>';
      }).join('') + '</div>';
    },
    voos: function () {
      var v = viagem;
      if (!v.servicos.length) return '<h2 class="titulo-secao">Voos e reservas</h2>' + vazio('aviao', 'Reservas em andamento', 'Seus voos, hotéis e transfers aparecem aqui assim que a agência confirmar.');
      var ordem = ['voo', 'hotel', 'transfer', 'passeio', 'seguro', 'trem', 'carro', 'cruzeiro', 'outro'];
      var grupos = {};
      v.servicos.forEach(function (s) { (grupos[s.tipo] = grupos[s.tipo] || []).push(s); });
      return '<h2 class="titulo-secao">Voos e reservas</h2>' + ordem.filter(function (t) { return grupos[t]; }).map(function (t) {
        return '<section class="cartao"><h2>' + ic((TIPO[t] || TIPO.outro)[1], 'p') + (TIPO[t] || TIPO.outro)[0] + '</h2>' + grupos[t].sort(function (a, b) { return String(a.inicio).localeCompare(String(b.inicio)); }).map(servicoHtml).join('') + '</section>';
      }).join('');
    },
    documentos: function () {
      setTimeout(carregarDocs, 0);
      return '<h2 class="titulo-secao">Vouchers e documentos</h2><section class="cartao" id="docs">' + vazio('pasta', 'Carregando…', '') + '</section>';
    },
    motorista: function () {
      var v = viagem, hj = hojeISO();
      var hoteis = v.servicos.filter(function (s) { return s.tipo === 'hotel'; });
      var hotel = hoteis.filter(function (h) { return !h.fim || h.fim >= hj; })[0] || hoteis[0];
      var alvo = hotel ? hotel.descricao : v.destino;
      return '<h2 class="titulo-secao">Mostre ao Motorista</h2><div class="motorista"><small>Leve-me para · Please take me to</small><div class="grande">' + esc(alvo || 'Pergunte à agência pelo endereço') + '</div>' + (hotel && hotel.fornecedor ? '<div class="medio">' + esc(hotel.fornecedor) + '</div>' : '') + (hotel && hotel.localizador ? '<p style="color:#78818c;margin-top:10px">Reserva ' + esc(hotel.localizador) + '</p>' : '') + '</div>' +
        '<p style="color:var(--texto-2);font-size:13px;text-align:center;margin-top:12px">Vire a tela para o motorista. Os dados vêm da sua reserva de hospedagem.</p>';
    },
    emergencia: function () {
      var v = viagem;
      var tel = String(v.emergencia || '').replace(/[^\d+]/g, '');
      var wpp = whats(agencia.whatsapp, 'Olá, sou passageiro(a) da viagem ' + v.nome + ' e preciso de ajuda.');
      return '<h2 class="titulo-secao">Ajuda e emergência</h2><div class="pilha">' +
        '<button class="btn perigo largo" id="b-local" type="button">' + ic('local') + 'Enviar minha localização à agência</button>' +
        (wpp ? '<a class="btn ouro largo" href="' + esc(wpp) + '" target="_blank" rel="noopener">' + ic('telefone') + 'WhatsApp da agência</a>' : '') +
        (agencia.whatsapp ? '<a class="btn largo" href="tel:+' + esc(String(agencia.whatsapp).replace(/\D/g, '')) + '">' + ic('telefone') + 'Ligar para a agência</a>' : '') +
        (v.emergencia ? '<section class="cartao"><h2>' + ic('alerta', 'p') + 'Contato de emergência</h2><p style="font-size:17px">' + esc(v.emergencia) + '</p>' + (tel.replace(/\D/g, '').length >= 8 ? '<p style="margin-top:10px"><a class="btn largo" href="tel:' + esc(tel) + '">' + ic('telefone') + 'Ligar agora</a></p>' : '') + '</section>' : '') +
        '<section class="cartao"><h2>' + ic('escudo', 'p') + 'Em caso de perigo</h2><p style="color:var(--texto-2)">Ligue primeiro para o serviço de emergência local do país onde você está. Depois avise a agência.</p></section></div>';
    },
    conversa: function () {
      setTimeout(iniciarChat, 0);
      return '<div class="chat"><h2 class="titulo-secao" style="margin-bottom:8px">Conversa com a agência</h2><div class="msgs" id="mensagens-container">' + vazio('conversa', 'Carregando…', '') + '</div><form class="envio" id="f-envio"><textarea id="input-mensagem" rows="1" placeholder="Escreva sua mensagem…" aria-label="Mensagem"></textarea><button type="submit" id="btn-enviar-mensagem" aria-label="Enviar">' + ic('mandar') + '</button></form></div>';
    },
  };
  function vazio(i, t, s) { return '<div class="vazio">' + ic(i) + '<b>' + esc(t) + '</b>' + (s ? '<span>' + esc(s) + '</span>' : '') + '</div>'; }

  var chatTimer = null;
  function desenhar() {
    if (!viagem) return;
    clearInterval(chatTimer);
    document.querySelectorAll('[data-aba]').forEach(function (b) { b.classList.toggle('ativo', b.getAttribute('data-aba') === abaAtual && b.closest('.nav, .extras') !== null); });
    $('#app-conteudo').innerHTML = (TELAS[abaAtual] || TELAS.hoje)();
    var bl = $('#b-local'); if (bl) bl.addEventListener('click', enviarLocalizacao);
    var f = $('#f-envio'); if (f) ligarEnvio(f);
  }
  window.navegarAba = function (aba) { abaAtual = aba; window.scrollTo(0, 0); desenhar(); };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-aba]');
    if (b) { e.preventDefault(); window.navegarAba(b.getAttribute('data-aba')); return; }
    var c = e.target.closest('[data-copiar]');
    if (c) { var t = c.getAttribute('data-copiar'); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { aviso('Código copiado: ' + t); }, function () { aviso(t); }); }
  });
  $('#btn-whats-agencia').addEventListener('click', function () {
    var w = whats(agencia.whatsapp, viagem ? 'Olá! Sou da viagem ' + viagem.nome + '.' : 'Olá!');
    if (w) window.open(w, '_blank', 'noopener'); else window.navegarAba('conversa');
  });

  function enviarLocalizacao() {
    if (!navigator.geolocation) return aviso('Este aparelho não informa a localização.');
    aviso('Buscando sua localização…');
    navigator.geolocation.getCurrentPosition(function (p) {
      var link = 'https://maps.google.com/?q=' + p.coords.latitude.toFixed(6) + ',' + p.coords.longitude.toFixed(6);
      var texto = 'SOS Viajante Pro - ' + (viagem.passageiros[0] && viagem.passageiros[0].nome || viagem.nome) + ' - ' + viagem.destino + ' - estou em ' + link;
      var w = whats(agencia.whatsapp, texto);
      enviarMensagem(texto);
      if (w) window.open(w, '_blank', 'noopener');
    }, function () { aviso('Não foi possível pegar a localização. Permita o acesso e tente de novo.'); }, { enableHighAccuracy: true, timeout: 15000 });
  }

  // ── Documentos liberados pela agência ──
  var docsCache = 'vp_docs_cache';
  function carregarDocs() {
    var box = $('#docs'); if (!box) return;
    fetch('/api/vp-arquivos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'app-listar', codigo: codigo }) })
      .then(function (r) { return r.ok ? r.json() : r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || 'indisponível'); }); })
      .then(function (j) { if (j.offline) throw new Error('sem_rede'); guardar(docsCache, { codigo: codigo, docs: j.documentos || [] }); listaDocs(j.documentos || [], false); })
      .catch(function () { var s = ler(docsCache); listaDocs(s && s.codigo === codigo ? s.docs : [], true); });
  }
  function listaDocs(docs, offline) {
    var box = $('#docs'); if (!box) return;
    if (!docs.length) { box.innerHTML = vazio('pasta', 'Nenhum documento ainda', offline ? 'Sem internet agora.' : 'Vouchers, bilhetes e seguro aparecem aqui quando a agência liberar.'); return; }
    box.innerHTML = docs.map(function (d) { return '<button class="doc" type="button" data-doc="' + esc(d.id) + '"><span class="tipo">' + esc(String(d.extensao || '').toUpperCase().slice(0, 4)) + '</span><span class="meio"><b>' + esc(d.nome) + '</b><small>' + esc((d.categoria || '').replace(/^./, function (c) { return c.toUpperCase(); })) + ' · ' + Math.max(1, Math.round((d.tamanho || 0) / 1024)) + ' KB</small></span>' + ic('baixar') + '</button>'; }).join('') + (offline ? '<p style="color:var(--texto-2);font-size:12.5px;margin-top:8px">Sem internet: para abrir, conecte-se.</p>' : '');
    box.querySelectorAll('[data-doc]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = docs.filter(function (x) { return x.id === b.getAttribute('data-doc'); })[0];
        aviso('Abrindo ' + d.nome + '…');
        fetch('/api/vp-arquivos?id=' + encodeURIComponent(d.id), { headers: { 'X-VP-Codigo': codigo } }).then(function (r) { if (!r.ok) throw new Error(); return r.blob(); }).then(function (blob) {
          var url = URL.createObjectURL(blob), a = document.createElement('a');
          a.href = url; a.download = d.nome; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        }).catch(function () { aviso('Não foi possível abrir agora. Verifique a internet.'); });
      });
    });
  }

  // ── Conversa (com fila sem internet: vp_pending_chats) ──
  var PEND = 'vp_pending_chats';
  var ultimaAssinatura = '';
  function pendentes() { return (ler(PEND) || []).filter(function (p) { return p.codigo === codigo; }); }
  function iniciarChat() {
    ultimaAssinatura = '';
    listarMensagens(true);
    clearInterval(chatTimer);
    chatTimer = setInterval(function () { if (!document.hidden) listarMensagens(false); }, 8000);
  }
  function listarMensagens(rolar) {
    var box = $('#mensagens-container'); if (!box) return Promise.resolve();
    return api({ acao: 'app-chat-listar', codigo: codigo }).then(function (j) {
      var l = j.mensagens || [];
      guardar('vp_chat_cache', { codigo: codigo, l: l });
      try { localStorage.setItem('vp_chat_visto', String(l.filter(function (m) { return m.autor !== 'viajante'; }).length)); } catch (e) { /* ok */ }
      marcarNaoLidas(0);
      pintar(l, rolar);
    }).catch(function () { var s = ler('vp_chat_cache'); pintar(s && s.codigo === codigo ? s.l : [], rolar); });
  }
  function pintar(l, rolar) {
    var box = $('#mensagens-container'); if (!box) return;
    var pend = pendentes();
    var assin = JSON.stringify([l.map(function (m) { return m.id; }), pend.length]);
    if (assin === ultimaAssinatura && !rolar) return;
    ultimaAssinatura = assin;
    var html = l.map(function (m) { return '<div class="bolha ' + (m.autor === 'viajante' ? 'eu' : 'agencia') + '">' + esc(m.texto) + '<small>' + (m.autor === 'viajante' ? 'Você' : 'Viajante Pro') + ' · ' + new Date(m.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</small></div>'; }).join('') +
      pend.map(function (p) { return '<div class="bolha eu pendente">' + esc(p.texto) + '<small>Aguardando internet…</small></div>'; }).join('');
    box.innerHTML = html || vazio('conversa', 'Fale com a sua agência', 'Dúvidas, pedidos especiais ou ajuda durante a viagem.');
    box.scrollTop = box.scrollHeight;
  }
  function enviarMensagem(texto) {
    return api({ acao: 'app-chat-enviar', codigo: codigo, texto: texto }).then(function () { return listarMensagens(true); }).catch(function () {
      var fila = ler(PEND) || []; fila.push({ codigo: codigo, texto: texto, em: Date.now() }); guardar(PEND, fila);
      aviso('Sem internet: a mensagem será enviada quando você se conectar.');
      listarMensagens(true);
    });
  }
  function flushPendingChatMessages() { return enviarPendentes(); }
  function enviarPendentes() {
    var fila = ler(PEND) || [];
    if (!fila.length || !navigator.onLine) return Promise.resolve();
    var resto = [];
    return fila.reduce(function (p, m) {
      return p.then(function () { return api({ acao: 'app-chat-enviar', codigo: m.codigo, texto: m.texto }).catch(function () { resto.push(m); }); });
    }, Promise.resolve()).then(function () { guardar(PEND, resto); if ($('#mensagens-container')) listarMensagens(true); });
  }
  function ligarEnvio(f) {
    var ta = $('#input-mensagem');
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } });
    f.addEventListener('submit', function (e) { e.preventDefault(); var t = ta.value.trim(); if (!t) return; ta.value = ''; enviarMensagem(t); });
  }
  function marcarNaoLidas(n) { var b = $('#n-conversa'); if (!b) return; b.textContent = n; b.classList.toggle('oculto', !n); }
  function conferirNovas() {
    if (!codigo || abaAtual === 'conversa' || !navigator.onLine) return;
    api({ acao: 'app-chat-listar', codigo: codigo }).then(function (j) {
      var visto = +(localStorage.getItem('vp_chat_visto') || 0);
      var l = j.mensagens || [];
      marcarNaoLidas(Math.max(0, l.filter(function (m) { return m.autor !== 'viajante'; }).length - visto));
    }).catch(function () { /* sem rede */ });
  }

  // ── Instalar como app ──
  var pedidoInstalar = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); pedidoInstalar = e; $('#btn-instalar').classList.remove('oculto'); });
  $('#btn-instalar').addEventListener('click', function () { if (pedidoInstalar) { pedidoInstalar.prompt(); pedidoInstalar = null; $('#btn-instalar').classList.add('oculto'); } });

  function inicializar() {
    atualizarStatusRede();
    buscarAgencia();
    carregar().then(function () { enviarPendentes(); conferirNovas(); });
    setInterval(conferirNovas, 60000);
    window.flushPendingChatMessages = flushPendingChatMessages;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializar); else inicializar();
})();
