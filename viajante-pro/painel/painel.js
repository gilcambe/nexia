/* ViajantePro — Painel da agência (Fase 1). JavaScript puro, sem dependências.
   Usa só ações reais de /api/viajante-pro e /api/vp-arquivos. Nenhum número inventado:
   quando não há dado, a tela diz isso.
   Ícones: desenhos lineares no estilo Lucide (ISC License, https://lucide.dev). */
(function () {
  'use strict';

  // ───────────────────────── Ícones ─────────────────────────
  var P = {
    painel: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    cotacao: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    aviao: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    conversa: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    pasta: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    globo: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    ajustes: '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/>',
    busca: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    sino: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    voltar: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    fechar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    mais: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    seta: '<path d="m9 18 6-6-6-6"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    atualizar: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    enviar_arq: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    lixo: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    olho: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    olho_off: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
    copiar: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    coroa: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/>',
    calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    local: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    ok: '<path d="M20 6 9 17l-5-5"/>',
    alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    mandar: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    abrir: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    imprimir: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    alta: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    dinheiro: '<path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    porcento: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    lapis: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    novo_cliente: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
    nova_cot: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="M9 15h6"/>',
    telefone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    cadeado: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
    hotel: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
    carro: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    ingresso: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
    bussola: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/>',
    roteiro: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    planilha: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
    pessoa: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    estrela: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    funil: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  };
  function ic(nome, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[nome] || '') + '</svg>'; }
  function pintarIcones(raiz) {
    (raiz || document).querySelectorAll('svg[data-i]').forEach(function (s) { s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = P[s.getAttribute('data-i')] || ''; s.removeAttribute('data-i'); });
  }

  // ───────────────────────── Utilidades ─────────────────────────
  var TOKEN_KEY = 'vp_admin_token';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return [].slice.call((el || document).querySelectorAll(s)); };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function moeda(v) { return BRL.format(Number(v) || 0); }
  function moedaCurta(v) { v = Number(v) || 0; if (Math.abs(v) >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + ' mi'; if (Math.abs(v) >= 1e4) return 'R$ ' + Math.round(v / 1e3) + ' mil'; return moeda(v); }
  function dataBR(s) { if (!s) return ''; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (!m) return ''; return m[3] + '/' + m[2] + '/' + m[1]; }
  function dataHora(s) { if (!s) return ''; var d = new Date(s); if (isNaN(d)) return ''; return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function relativo(s) {
    if (!s) return ''; var d = new Date(s); if (isNaN(d)) return '';
    var min = Math.round((Date.now() - d) / 60000);
    if (min < 1) return 'agora'; if (min < 60) return 'há ' + min + ' min';
    var h = Math.round(min / 60); if (h < 24) return 'há ' + h + ' h';
    var dias = Math.round(h / 24); if (dias < 30) return 'há ' + dias + ' dia' + (dias > 1 ? 's' : '');
    return d.toLocaleDateString('pt-BR');
  }
  function iniciais(nome) { var p = String(nome || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function tamanho(b) { b = Number(b) || 0; if (b < 1024) return b + ' B'; if (b < 1048576) return Math.round(b / 1024) + ' KB'; return (b / 1048576).toFixed(1).replace('.', ',') + ' MB'; }
  function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }
  function whatsLink(fone, texto) { var d = soDigitos(fone); if (!d) return ''; if (d.length <= 11) d = '55' + d; return 'https://wa.me/' + d + (texto ? '?text=' + encodeURIComponent(texto) : ''); }
  function hojeISO() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function num(v) { if (typeof v === 'number') return v; var s = String(v || '').replace(/[^\d,.-]/g, ''); if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); var n = Number(s); return isFinite(n) ? n : 0; }

  var STATUS_COT = { nova: 'Nova', rascunho: 'Rascunho', em_preparacao: 'Em preparação', enviada: 'Enviada', visualizada: 'Visualizada', em_negociacao: 'Em negociação', aprovada: 'Aprovada', recusada: 'Recusada', expirada: 'Expirada' };
  var STATUS_VIA = { planejada: 'Planejada', confirmada: 'Confirmada', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada' };
  var STATUS_SERV = { solicitada: 'Solicitada', confirmada: 'Confirmada', cancelada: 'Cancelada' };
  var TIPOS = { voo: ['Voo', 'aviao'], hotel: ['Hotel', 'hotel'], transfer: ['Transfer', 'carro'], passeio: ['Passeio', 'ingresso'], seguro: ['Seguro', 'escudo'], trem: ['Trem', 'bussola'], carro: ['Carro', 'carro'], cruzeiro: ['Cruzeiro', 'bussola'], outro: ['Outro', 'estrela'] };
  var CANAIS = { site: 'Site', whatsapp: 'WhatsApp', instagram: 'Instagram', indicacao: 'Indicação', telefone: 'Telefone', email: 'E-mail', presencial: 'Presencial', outro: 'Outros' };
  var CATEGORIAS = { contrato: 'Contrato', voucher: 'Voucher', comprovante: 'Comprovante', passaporte: 'Passaporte', visto: 'Visto', seguro: 'Seguro', bilhete: 'Bilhete', roteiro: 'Roteiro', planilha: 'Planilha', proposta: 'Proposta', foto: 'Foto', outro: 'Outro' };
  function tag(status, mapa) { var s = String(status || ''); return '<span class="tag ' + esc(s) + '">' + esc((mapa || STATUS_COT)[s] || s || '—') + '</span>'; }
  function opcoes(mapa, atual) { return Object.keys(mapa).map(function (k) { return '<option value="' + k + '"' + (k === atual ? ' selected' : '') + '>' + esc(mapa[k]) + '</option>'; }).join(''); }

  function aviso(msg, erro) {
    var el = document.createElement('div');
    el.className = 'aviso' + (erro ? ' erro' : '');
    el.innerHTML = ic(erro ? 'alerta' : 'ok', 'p') + '<span>' + esc(msg) + '</span>';
    $('#avisos').appendChild(el);
    setTimeout(function () { el.remove(); }, erro ? 5000 : 3000);
  }

  function modal(html, aoMontar) {
    var f = document.createElement('div');
    f.className = 'modal-fundo';
    f.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(f);
    var fechar = function () { f.remove(); document.removeEventListener('keydown', tecla); };
    var tecla = function (e) { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', tecla);
    f.addEventListener('click', function (e) { if (e.target === f) fechar(); });
    $$('[data-fechar]', f).forEach(function (b) { b.addEventListener('click', fechar); });
    var primeiro = $('input,select,textarea,button', f); if (primeiro) setTimeout(function () { primeiro.focus(); }, 30);
    if (aoMontar) aoMontar(f, fechar);
    return fechar;
  }
  function confirmar(titulo, texto, botao) {
    return new Promise(function (resolve) {
      modal('<h3>' + esc(titulo) + '</h3><p style="margin:0;color:var(--texto-2)">' + esc(texto) + '</p><div class="rod"><button class="btn" data-fechar>Cancelar</button><button class="btn ouro" id="sim">' + esc(botao || 'Confirmar') + '</button></div>', function (f, fechar) {
        var r = false;
        $('#sim', f).addEventListener('click', function () { r = true; fechar(); resolve(true); });
        $$('[data-fechar]', f).forEach(function (b) { b.addEventListener('click', function () { if (!r) resolve(false); }); });
        f.addEventListener('click', function (e) { if (e.target === f && !r) resolve(false); });
      });
    });
  }
  function ocupado(btn, sim) { if (!btn) return; btn.disabled = !!sim; }
  function carregando() { return '<div class="carregando"><div class="giro"></div><span>Carregando…</span></div>'; }
  function vazio(icone, titulo, texto, acao) { return '<div class="vazio-box">' + ic(icone) + '<b>' + esc(titulo) + '</b>' + (texto ? '<span>' + esc(texto) + '</span>' : '') + (acao ? '<div style="margin-top:12px">' + acao + '</div>' : '') + '</div>'; }

  // ───────────────────────── API ─────────────────────────
  function token() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function erroDe(j, status) { return (j && j.error) || (status === 0 ? 'Sem conexão. Verifique a internet.' : 'Não foi possível concluir (erro ' + status + ').'); }
  function api(acao, corpo) {
    var t = token();
    return fetch('/api/viajante-pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify(Object.assign({ acao: acao, token: t }, corpo || {})),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        marcarConexao(true);
        if (r.status === 401 && acao !== 'entrar') { sair(true); throw new Error('Sua sessão expirou. Entre de novo.'); }
        if (!r.ok) throw new Error(erroDe(j, r.status));
        return j;
      });
    }, function () { marcarConexao(false); throw new Error('Sem conexão. Verifique a internet.'); });
  }
  function arqApi(corpo) {
    return fetch('/api/vp-arquivos', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: JSON.stringify(corpo) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 404 && !j.error) throw new Error('Documentos disponíveis só na hospedagem da Hostinger.');
          if (r.status === 401) { sair(true); throw new Error('Sua sessão expirou.'); }
          if (!r.ok) throw new Error(erroDe(j, r.status));
          return j;
        });
      });
  }
  function marcarConexao(ok) {
    var e = $('#estado'); if (!e) return;
    e.classList.toggle('off', !ok);
    $('span', e).textContent = ok ? 'Conectado · ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Sem conexão';
  }

  // ───────────────────────── Sessão ─────────────────────────
  function mostrarLogin() {
    $('#app').classList.add('oculto');
    $('#tela-login').classList.remove('oculto');
    setTimeout(function () { var s = $('#senha'); if (s) s.focus(); }, 50);
  }
  function sair(expirou) {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ok */ }
    pararTimers();
    mostrarLogin();
    if (expirou) $('#login-erro').textContent = 'Sua sessão expirou. Entre de novo.';
  }
  $('#form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#btn-entrar'); var senha = $('#senha').value;
    $('#login-erro').textContent = '';
    ocupado(btn, true);
    api('entrar', { senha: senha }).then(function (j) {
      try { localStorage.setItem(TOKEN_KEY, j.token); } catch (e2) { /* ok */ }
      $('#senha').value = '';
      iniciarApp();
    }).catch(function (err) { $('#login-erro').textContent = err.message; }).then(function () { ocupado(btn, false); });
  });

  // ───────────────────────── Menu e navegação ─────────────────────────
  var MENU = [
    { grupo: 'Visão geral' },
    { id: 'dashboard', rot: 'Dashboard', i: 'painel' },
    { grupo: 'Comercial' },
    { id: 'clientes', rot: 'Clientes', i: 'clientes' },
    { id: 'cotacoes', rot: 'Cotações', i: 'cotacao', cont: 'cot' },
    { grupo: 'Operação' },
    { id: 'viagens', rot: 'Viagens e reservas', i: 'aviao' },
    { id: 'conversas', rot: 'Conversas', i: 'conversa', cont: 'conv' },
    { id: 'documentos', rot: 'Documentos', i: 'pasta' },
    { grupo: 'Agência' },
    { id: 'site', rot: 'Site da agência', i: 'globo' },
    { id: 'config', rot: 'Configurações', i: 'ajustes' },
  ];
  var contadores = { cot: 0, conv: 0 };
  function desenharMenu(ativo) {
    $('#menu-nav').innerHTML = MENU.map(function (m) {
      if (m.grupo) return '<div class="grupo">' + esc(m.grupo) + '</div>';
      var n = m.cont ? contadores[m.cont] : 0;
      return '<a class="item' + (m.id === ativo ? ' ativo' : '') + '" href="#/' + m.id + '"' + (m.id === ativo ? ' aria-current="page"' : '') + ' title="' + esc(m.rot) + '">' + ic(m.i) + '<span>' + esc(m.rot) + '</span>' + (n ? '<em class="cont">' + n + '</em>' : '') + '</a>';
    }).join('');
    var nb = [['dashboard', 'Início', 'painel'], ['cotacoes', 'Cotações', 'cotacao', 'cot'], ['viagens', 'Viagens', 'aviao'], ['conversas', 'Conversas', 'conversa', 'conv']];
    $('#nav-baixo').innerHTML = nb.map(function (x) {
      var n = x[3] ? contadores[x[3]] : 0;
      return '<a href="#/' + x[0] + '" class="' + (x[0] === ativo ? 'ativo' : '') + '">' + ic(x[2]) + '<span>' + x[1] + '</span>' + (n ? '<em class="cont">' + n + '</em>' : '') + '</a>';
    }).join('') + '<button type="button" id="nb-menu">' + ic('menu') + '<span>Menu</span></button>';
    $('#nb-menu').addEventListener('click', abrirMenu);
  }
  function abrirMenu() { $('#menu').classList.add('aberto'); $('#veu').classList.add('on'); }
  function fecharMenu() { $('#menu').classList.remove('aberto'); $('#veu').classList.remove('on'); }
  $('#btn-menu').addEventListener('click', abrirMenu);
  $('#veu').addEventListener('click', fecharMenu);
  $('#menu').addEventListener('click', function (e) { if (e.target.closest('a.item')) fecharMenu(); });
  $('#btn-recolher').addEventListener('click', function () {
    var rec = !$('#menu').classList.contains('recolhido');
    $('#menu').classList.toggle('recolhido', rec); $('#app').classList.toggle('menu-recolhido', rec);
    try { localStorage.setItem('vp_menu_recolhido', rec ? '1' : ''); } catch (e) { /* ok */ }
  });
  $('#btn-sair').addEventListener('click', function () { confirmar('Sair do painel?', 'Você precisará da senha para entrar de novo.', 'Sair').then(function (s) { if (s) sair(); }); });

  // histórico interno para o botão voltar
  var pilha = [];
  var geracao = 0;
  var timers = [];
  function pararTimers() { timers.forEach(clearInterval); timers = []; }
  function rotaAtual() { return (location.hash || '#/dashboard').replace(/^#\/?/, '') || 'dashboard'; }
  function pai(rota) { var p = rota.split('/'); return p.length > 1 ? p[0] : ''; }
  $('#btn-voltar').addEventListener('click', function () {
    if (pilha.length > 1) { pilha.pop(); var ant = pilha.pop(); location.hash = '#/' + ant; }
    else location.hash = '#/' + (pai(rotaAtual()) || 'dashboard');
  });

  var TELAS = {};
  function navegar() {
    if (!token()) return mostrarLogin();
    pararTimers();
    $('#notifs').classList.add('oculto');
    var rota = rotaAtual();
    if (pilha[pilha.length - 1] !== rota) pilha.push(rota);
    if (pilha.length > 30) pilha = pilha.slice(-30);
    var partes = rota.split('/');
    var base = partes[0];
    var param = partes.slice(1).map(decodeURIComponent).join('/');
    var tela = TELAS[base] || TELAS.dashboard;
    desenharMenu(TELAS[base] ? base : 'dashboard');
    $('#btn-voltar').classList.toggle('oculto', !(param || (base !== 'dashboard' && pilha.length > 1)));
    var g = ++geracao;
    var c = $('#conteudo');
    c.innerHTML = carregando();
    window.scrollTo(0, 0);
    Promise.resolve().then(function () { return tela(param, function () { return g === geracao; }); }).catch(function (err) {
      if (g !== geracao) return;
      c.innerHTML = vazio('alerta', 'Não foi possível abrir esta tela', err.message, '<button class="btn" onclick="location.reload()">' + ic('atualizar', 'p') + 'Tentar de novo</button>');
    });
  }
  window.addEventListener('hashchange', navegar);
  function titulo(t) { $('#titulo').textContent = t; document.title = t + ' · Viajante Pro'; }
  function ir(rota) { location.hash = '#/' + rota; }

  // ───────────────────────── Resumo / notificações ─────────────────────────
  var ultimoResumo = null;
  function atualizarContadores(r) {
    ultimoResumo = r;
    contadores.cot = r.kpis.cotacoes_novas || 0;
    contadores.conv = r.kpis.conversas_sem_resposta || 0;
    desenharMenu(rotaAtual().split('/')[0]);
    var itens = notificacoes(r);
    var n = $('#notif-n');
    n.textContent = itens.length > 99 ? '99+' : String(itens.length);
    n.classList.toggle('oculto', !itens.length);
  }
  function notificacoes(r) {
    var it = [];
    (r.listas.conversas_sem_resposta || []).forEach(function (c) { it.push({ cor: 'b', i: 'conversa', t: 'Mensagem sem resposta · ' + c.viagemNome, s: c.texto, href: 'conversas/' + c.viagemId }); });
    if (r.kpis.cotacoes_novas) it.push({ cor: 'a', i: 'cotacao', t: r.kpis.cotacoes_novas + ' cotação(ões) nova(s) aguardando atendimento', s: 'Pedidos recebidos pelo site', href: 'cotacoes' });
    (r.alertas.cotacoes_vencendo || []).forEach(function (c) { it.push({ cor: 'a', i: 'relogio', t: 'Proposta vence em ' + dataBR(c.validade), s: c.codigo + ' · ' + c.nome, href: 'cotacoes/' + c.id }); });
    (r.alertas.cotacoes_vencidas || []).forEach(function (c) { it.push({ cor: 'v', i: 'alerta', t: 'Proposta vencida', s: c.codigo + ' · ' + c.nome, href: 'cotacoes/' + c.id }); });
    (r.alertas.servicos_pendentes || []).forEach(function (v) { it.push({ cor: 'a', i: 'aviao', t: 'Reservas a confirmar', s: v.nome + ' · ' + dataBR(v.datas && v.datas.inicio), href: 'viagens/' + v.id }); });
    (r.alertas.documentos_vencendo || []).forEach(function (d) { it.push({ cor: 'v', i: 'pasta', t: 'Documento vence em ' + dataBR(d.validade), s: d.nome, href: 'documentos' }); });
    return it;
  }
  function alertasHtml(itens, max) {
    if (!itens.length) return vazio('ok', 'Tudo em dia', 'Nenhuma pendência no momento.');
    return itens.slice(0, max || 99).map(function (a) { return '<a class="alerta" href="#/' + a.href + '"><span class="bola ' + a.cor + '">' + ic(a.i, 'p') + '</span><span><b style="font-weight:600">' + esc(a.t) + '</b><br><small style="color:var(--texto-2)">' + esc(a.s || '') + '</small></span></a>'; }).join('');
  }
  function buscarResumo(dias) { return api('painel-resumo', { dias: dias || 30 }).then(function (r) { atualizarContadores(r); return r; }); }
  $('#btn-notif').addEventListener('click', function (e) {
    e.stopPropagation();
    var box = $('#notifs');
    if (!box.classList.contains('oculto')) return box.classList.add('oculto');
    box.innerHTML = '<div class="card-cab" style="padding:12px 0 6px"><h3>' + ic('sino', 'p') + 'Notificações</h3></div>' + (ultimoResumo ? alertasHtml(notificacoes(ultimoResumo)) : carregando());
    box.classList.remove('oculto');
    if (!ultimoResumo) buscarResumo().then(function (r) { box.innerHTML = '<div class="card-cab" style="padding:12px 0 6px"><h3>' + ic('sino', 'p') + 'Notificações</h3></div>' + alertasHtml(notificacoes(r)); });
  });
  document.addEventListener('click', function (e) { var b = $('#notifs'); if (!b.classList.contains('oculto') && !b.contains(e.target)) b.classList.add('oculto'); });
  $('#notifs').addEventListener('click', function (e) { if (e.target.closest('a')) $('#notifs').classList.add('oculto'); });
  $('#btn-atualizar').addEventListener('click', function () { buscarResumo().catch(function () {}); navegar(); });

  // ───────────────────────── Busca global ─────────────────────────
  var buscaTimer = null;
  function resultadosHtml(lista) {
    if (!lista.length) return vazio('busca', 'Nada encontrado', 'Tente outro nome, e-mail, destino ou código.');
    var ICO = { cliente: 'pessoa', cotacao: 'cotacao', viagem: 'aviao' }, ROT = { cliente: 'Cliente', cotacao: 'Cotação', viagem: 'Viagem' };
    return '<ul class="lista">' + lista.map(function (x) {
      var href = x.tipo === 'cliente' ? 'clientes/' + encodeURIComponent(x.id) : (x.tipo === 'cotacao' ? 'cotacoes/' : 'viagens/') + encodeURIComponent(x.id);
      return '<li><a class="linha" href="#/' + href + '"><span class="av navy">' + ic(ICO[x.tipo], 'p') + '</span><span class="meio"><b>' + esc(x.titulo) + '</b><small>' + ROT[x.tipo] + (x.sub ? ' · ' + esc(x.sub) : '') + '</small></span>' + ic('seta', 'p') + '</a></li>';
    }).join('') + '</ul>';
  }
  function buscar(q, alvo) {
    clearTimeout(buscaTimer);
    if (String(q).trim().length < 2) { alvo.innerHTML = ''; return; }
    buscaTimer = setTimeout(function () {
      api('painel-buscar', { q: q }).then(function (j) { alvo.innerHTML = resultadosHtml(j.resultados || []); }).catch(function (e) { alvo.innerHTML = vazio('alerta', 'Erro na busca', e.message); });
    }, 250);
  }
  $('#busca-global').addEventListener('input', function () {
    var box = $('#notifs'); var q = this.value;
    if (q.trim().length < 2) { box.classList.add('oculto'); return; }
    box.innerHTML = '<div style="padding:8px 0" id="res-busca">' + carregando() + '</div>';
    box.classList.remove('oculto');
    buscar(q, $('#res-busca'));
  });
  $('#busca-global').addEventListener('click', function (e) { e.stopPropagation(); });
  $('#btn-buscar-celular').addEventListener('click', function () {
    modal('<h3>Buscar</h3><div class="barra-lista"><div class="campo-busca">' + ic('busca') + '<input type="search" id="q-cel" placeholder="Cliente, destino, código…"></div></div><div id="res-cel"></div><div class="rod"><button class="btn" data-fechar>Fechar</button></div>', function (f, fechar) {
      $('#q-cel', f).addEventListener('input', function () { buscar(this.value, $('#res-cel', f)); });
      $('#res-cel', f).addEventListener('click', function (e) { if (e.target.closest('a')) fechar(); });
    });
  });

  // ───────────────────────── Gráficos (SVG, sem biblioteca) ─────────────────────────
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function grafEvolucao(serie) {
    var W = 640, H = 230, e = 46, d = 46, t = 16, b = 30;
    var maxV = Math.max.apply(null, serie.map(function (s) { return s.vendido; }).concat([1]));
    var maxC = Math.max.apply(null, serie.map(function (s) { return s.cotacoes; }).concat([1]));
    var passo = (W - e - d) / serie.length;
    var y = function (v, max) { return t + (H - t - b) * (1 - v / max); };
    var g = '';
    for (var i = 0; i <= 4; i++) { var yy = t + (H - t - b) * i / 4; g += '<line x1="' + e + '" x2="' + (W - d) + '" y1="' + yy + '" y2="' + yy + '" stroke="#efe9df"/><text x="' + (e - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + esc(moedaCurta(maxV * (1 - i / 4)).replace(/R\$\s?/, '').replace(/^0,00$/, '0')) + '</text><text x="' + (W - d + 6) + '" y="' + (yy + 4) + '">' + Math.round(maxC * (1 - i / 4)) + '</text>'; }
    var pts = [];
    serie.forEach(function (s, i) {
      var cx = e + passo * i + passo / 2, bw = Math.min(34, passo * .5);
      var yv = y(s.vendido, maxV);
      g += '<rect x="' + (cx - bw / 2) + '" y="' + yv + '" width="' + bw + '" height="' + (H - b - yv) + '" rx="5" fill="url(#gNavy)"><title>' + esc(moeda(s.vendido)) + ' vendido</title></rect>';
      var m = s.mes.split('-'); g += '<text x="' + cx + '" y="' + (H - 10) + '" text-anchor="middle">' + MESES[+m[1] - 1] + '</text>';
      pts.push([cx, y(s.cotacoes, maxC), s.cotacoes]);
    });
    var linha = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var area = linha + ' L' + pts[pts.length - 1][0] + ' ' + (H - b) + ' L' + pts[0][0] + ' ' + (H - b) + ' Z';
    g += '<path d="' + area + '" fill="url(#gOuro)" opacity=".35"/><path d="' + linha + '" fill="none" stroke="#b18a4a" stroke-width="2.5"/>';
    pts.forEach(function (p) { g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4.5" fill="#fff" stroke="#b18a4a" stroke-width="2.5"><title>' + p[2] + ' cotações</title></circle>'; });
    return '<svg class="graf" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Evolução mensal de vendas e cotações"><defs><linearGradient id="gNavy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22385a"/><stop offset="1" stop-color="#142238"/></linearGradient><linearGradient id="gOuro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9a467"/><stop offset="1" stop-color="#c9a467" stop-opacity="0"/></linearGradient></defs>' + g + '</svg>' +
      '<div class="legenda"><span><i style="background:#142238"></i>Vendido (R$, eixo esquerdo)</span><span><i style="background:#b18a4a"></i>Cotações recebidas (eixo direito)</span></div>';
  }
  var CORES = ['#142238', '#b18a4a', '#5f7896', '#d9c39b', '#2f7d5b', '#9aa5b4', '#8a6a30', '#c4cdd8'];
  function grafRosca(dados) {
    var chaves = Object.keys(dados).filter(function (k) { return dados[k] > 0; });
    var total = chaves.reduce(function (t, k) { return t + dados[k]; }, 0);
    if (!total) return vazio('funil', 'Sem cotações no período', 'A origem aparece quando chegarem pedidos.');
    var R = 54, C = 2 * Math.PI * R, acum = 0, arcos = '';
    chaves.forEach(function (k, i) { var parte = dados[k] / total * C; arcos += '<circle r="' + R + '" cx="70" cy="70" fill="none" stroke="' + CORES[i % CORES.length] + '" stroke-width="18" stroke-dasharray="' + parte + ' ' + (C - parte) + '" stroke-dashoffset="' + (-acum) + '" transform="rotate(-90 70 70)"/>'; acum += parte; });
    return '<div class="rosca-wrap"><svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Origem das cotações">' + arcos + '<text x="70" y="68" text-anchor="middle" style="font-size:24px;font-weight:700;fill:#142238">' + total + '</text><text x="70" y="86" text-anchor="middle">total</text></svg><div class="leg">' +
      chaves.map(function (k, i) { return '<div><i style="width:10px;height:10px;border-radius:3px;background:' + CORES[i % CORES.length] + '"></i>' + esc(CANAIS[k] || k) + '<b>' + Math.round(dados[k] / total * 100) + '%</b></div>'; }).join('') + '</div></div>';
  }
  function barrasH(lista, chave, cls) {
    if (!lista.length) return '<p style="color:var(--texto-2);margin:0">Sem dados no período.</p>';
    var max = Math.max.apply(null, lista.map(function (x) { return x.total; }));
    return '<div class="barras-h">' + lista.map(function (x) { return '<div class="b"><span title="' + esc(x[chave]) + '">' + esc(x[chave]) + '</span><div class="trilho"><div class="enche ' + (cls || '') + '" style="width:' + Math.max(4, x.total / max * 100) + '%"></div></div><span>' + x.total + '</span></div>'; }).join('') + '</div>';
  }

  // ───────────────────────── Dashboard ─────────────────────────
  var diasPeriodo = 30;
  TELAS.dashboard = function (_p, vivo) {
    titulo('Dashboard');
    return buscarResumo(diasPeriodo).then(function (r) {
      if (!vivo()) return;
      var k = r.kpis;
      var hora = new Date().getHours();
      var saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
      var kpi = function (href, icone, valor, rot, det, navy, semDado) {
        return '<a class="card kpi' + (semDado ? ' vazio' : '') + '" href="#/' + href + '"><div class="topo-kpi"><span class="ico' + (navy ? ' navy' : '') + '">' + ic(icone) + '</span>' + ic('seta', 'p') + '</div><div class="valor">' + valor + '</div><div class="rot">' + rot + '</div>' + (det ? '<div class="det">' + det + '</div>' : '') + '</a>';
      };
      var semVenda = !k.aprovadas_periodo;
      var html = '<div class="cabeca"><div class="t"><h2>' + saud + ', Viajante Pro</h2><p>Resumo real da agência nos últimos ' + r.periodo_dias + ' dias.</p><div class="linha-ouro"></div></div>' +
        '<div class="chips" style="margin:0">' + [7, 30, 90, 365].map(function (d) { return '<button class="chip' + (d === diasPeriodo ? ' on' : '') + '" data-dias="' + d + '">' + (d === 365 ? '12 meses' : d + ' dias') + '</button>'; }).join('') + '</div></div>' +
        '<div class="kpis">' +
          kpi('clientes', 'clientes', k.clientes, 'Clientes', '<b>' + k.clientes_novos + '</b> novos no período') +
          kpi('cotacoes', 'cotacao', k.cotacoes_abertas, 'Cotações abertas', k.valor_em_aberto ? '<b>' + moedaCurta(k.valor_em_aberto) + '</b> em propostas' : '<b>' + k.cotacoes_periodo + '</b> recebidas no período', true) +
          kpi('viagens', 'aviao', k.viagens_proximas, 'Próximas viagens', '<b>' + k.em_viagem + '</b> em viagem agora · <b>' + k.viagens_confirmadas + '</b> confirmadas') +
          kpi('conversas', 'conversa', k.conversas_sem_resposta, 'Conversas sem resposta', k.conversas_sem_resposta ? 'Responder agora' : 'Tudo respondido', true) +
          kpi('cotacoes', 'dinheiro', semVenda ? '—' : moedaCurta(k.vendido_periodo), 'Vendido no período', semVenda ? 'Sem propostas aprovadas no período' : '<b>' + k.aprovadas_periodo + '</b> propostas aprovadas', false, semVenda) +
          kpi('cotacoes', 'porcento', k.conversao == null ? '—' : String(k.conversao).replace('.', ',') + '%', 'Conversão', 'aprovadas ÷ recebidas no período', true, k.conversao == null) +
          kpi('cotacoes', 'alta', k.ticket_medio == null ? '—' : moedaCurta(k.ticket_medio), 'Ticket médio', 'por proposta aprovada', false, k.ticket_medio == null) +
          kpi('cotacoes', 'estrela', k.margem_estimada == null ? '—' : moedaCurta(k.margem_estimada), 'Margem estimada', 'venda − custo das aprovadas com itens', true, k.margem_estimada == null) +
        '</div>' +
        '<div class="grade g2" style="margin-bottom:14px">' +
          '<section class="card"><div class="card-cab"><h2>' + ic('alta', 'p') + 'Evolução — últimos 6 meses</h2></div><div class="card-corpo">' + grafEvolucao(r.serie) + '</div></section>' +
          '<section class="card"><div class="card-cab"><h2>' + ic('funil', 'p') + 'Origem dos pedidos</h2></div><div class="card-corpo">' + grafRosca(r.origem) + '</div></section>' +
        '</div>' +
        '<div class="grade g3" style="margin-bottom:14px">' +
          '<section class="card"><div class="card-cab"><h2>' + ic('cotacao', 'p') + 'Últimas cotações</h2><a class="ver" href="#/cotacoes">Ver todas</a></div><div class="card-corpo">' + listaCotacoes(r.listas.ultimas_cotacoes) + '</div></section>' +
          '<section class="card"><div class="card-cab"><h2>' + ic('aviao', 'p') + 'Próximas viagens</h2><a class="ver" href="#/viagens">Ver todas</a></div><div class="card-corpo">' + listaViagensCurta(r.listas.proximas_viagens) + '</div></section>' +
          '<section class="card"><div class="card-cab"><h2>' + ic('alerta', 'p') + 'Alertas e pendências</h2></div><div class="card-corpo">' + alertasHtml(notificacoes(r), 6) + '</div></section>' +
        '</div>' +
        '<div class="grade g3">' +
          '<section class="card"><div class="card-cab"><h2>' + ic('local', 'p') + 'Destinos</h2></div><div class="card-corpo"><p class="rot" style="margin:0 0 8px;font-size:12.5px;color:var(--texto-2);font-weight:600">MAIS PROCURADOS</p>' + barrasH(r.destinos_procurados, 'destino') + '<p class="rot" style="margin:16px 0 8px;font-size:12.5px;color:var(--texto-2);font-weight:600">MAIS VENDIDOS</p>' + barrasH(r.destinos_vendidos, 'destino', 'navy') + '</div></section>' +
          '<section class="card"><div class="card-cab"><h2>' + ic('relogio', 'p') + 'Atividades recentes</h2></div><div class="card-corpo">' + atividadesHtml(r.listas.atividades) + '</div></section>' +
          '<section class="card"><div class="card-cab"><h2>' + ic('estrela', 'p') + 'Ações rápidas</h2></div><div class="card-corpo"><div class="rapidas">' +
            '<a class="rapida" href="#/cotacoes/nova">' + ic('nova_cot') + 'Nova cotação</a>' +
            '<a class="rapida" href="#/clientes/novo">' + ic('novo_cliente') + 'Novo cliente</a>' +
            '<a class="rapida" href="#/viagens/nova">' + ic('aviao') + 'Nova viagem</a>' +
            '<a class="rapida" href="#/conversas">' + ic('mandar') + 'Enviar mensagem</a>' +
            '<a class="rapida" href="#/documentos">' + ic('enviar_arq') + 'Enviar documento</a>' +
            '<a class="rapida" href="#/site">' + ic('lapis') + 'Editar site</a>' +
          '</div></div></section>' +
        '</div>';
      $('#conteudo').innerHTML = html;
      $$('[data-dias]').forEach(function (b) { b.addEventListener('click', function () { diasPeriodo = +b.getAttribute('data-dias'); navegar(); }); });
    });
  };
  function listaCotacoes(l) {
    if (!l.length) return vazio('cotacao', 'Nenhuma cotação ainda', 'Os pedidos do site aparecem aqui.');
    return '<ul class="lista">' + l.map(function (c) { return '<li><a class="linha" href="#/cotacoes/' + encodeURIComponent(c.id) + '"><span class="av">' + esc(iniciais(c.nome)) + '</span><span class="meio"><b>' + esc(c.nome) + '</b><small>' + esc(c.codigo || '') + ' · ' + esc(c.destino || 'Destino a definir') + '</small></span><span class="dir">' + tag(c.status) + '<span>' + esc(relativo(c.criado_em)) + '</span></span></a></li>'; }).join('') + '</ul>';
  }
  function listaViagensCurta(l) {
    if (!l.length) return vazio('aviao', 'Nenhuma viagem futura', 'Crie em Viagens ou converta uma cotação aprovada.', '<a class="btn p" href="#/viagens/nova">' + ic('mais', 'p') + 'Nova viagem</a>');
    return '<div class="grade" style="gap:10px">' + l.map(cartaoViagem).join('') + '</div>';
  }
  function cartaoViagem(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec((v.datas && v.datas.inicio) || '');
    return '<a class="cartao-viagem" href="#/viagens/' + encodeURIComponent(v.id) + '"><span class="data">' + (m ? '<b>' + m[3] + '</b><small>' + MESES[+m[2] - 1] + '</small>' : '<b>—</b><small>data</small>') + '</span><span class="meio" style="flex:1;min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(v.nome) + '</b><small style="color:var(--texto-2)">' + esc(v.destino || '') + (v.datas && v.datas.fim ? ' · até ' + dataBR(v.datas.fim) : '') + '</small></span>' + tag(v.status || 'confirmada', STATUS_VIA) + '</a>';
  }
  function atividadesHtml(l) {
    if (!l || !l.length) return vazio('relogio', 'Sem atividades registradas', 'O que for feito no painel aparece aqui.');
    var ICO = { cotacao: 'cotacao', viagem: 'aviao', cliente: 'pessoa', documento: 'pasta' };
    return '<ul class="lista">' + l.map(function (a) {
      var href = a.ref ? (a.ref.tipo === 'cliente' ? 'clientes/' : a.ref.tipo === 'cotacao' ? 'cotacoes/' : a.ref.tipo === 'viagem' ? 'viagens/' : 'documentos/') + encodeURIComponent(a.ref.id || '') : '';
      var inner = '<span class="av navy">' + ic(ICO[a.tipo] || 'ok', 'p') + '</span><span class="meio"><b style="font-weight:500;white-space:normal">' + esc(a.texto) + '</b><small>' + esc(relativo(a.criado_em)) + '</small></span>';
      return '<li>' + (href && a.ref.tipo !== 'geral' ? '<a class="linha" href="#/' + href + '">' + inner + '</a>' : '<div class="linha">' + inner + '</div>') + '</li>';
    }).join('') + '</ul>';
  }

  // ───────────────────────── Clientes ─────────────────────────
  TELAS.clientes = function (param, vivo) {
    if (param === 'novo') return telaClienteForm(null, vivo);
    if (param) return telaCliente(param, vivo);
    titulo('Clientes');
    return api('cliente-listar').then(function (j) {
      if (!vivo()) return;
      var todos = j.clientes || [];
      var filtro = 'todos';
      $('#conteudo').innerHTML = '<div class="cabeca"><div class="t"><h2>Clientes</h2><p>' + todos.length + ' cliente(s) — montados das cotações e viagens, sem duplicar.</p><div class="linha-ouro"></div></div><div class="acoes"><a class="btn ouro" href="#/clientes/novo">' + ic('novo_cliente', 'p') + 'Novo cliente</a></div></div>' +
        '<div class="barra-lista"><div class="campo-busca">' + ic('busca') + '<input type="search" id="f-busca" placeholder="Buscar por nome, e-mail ou WhatsApp"></div></div>' +
        '<div class="chips"><button class="chip on" data-f="todos">Todos<span class="n">' + todos.length + '</span></button><button class="chip" data-f="vip">VIP<span class="n">' + todos.filter(function (c) { return c.vip; }).length + '</span></button><button class="chip" data-f="viajou">Com viagem<span class="n">' + todos.filter(function (c) { return c.viagens; }).length + '</span></button><button class="chip" data-f="lead">Só cotação<span class="n">' + todos.filter(function (c) { return !c.viagens; }).length + '</span></button></div>' +
        '<section class="card"><div id="lista-cli"></div></section>';
      function render() {
        var q = $('#f-busca').value.toLowerCase().trim();
        var l = todos.filter(function (c) {
          if (filtro === 'vip' && !c.vip) return false;
          if (filtro === 'viajou' && !c.viagens) return false;
          if (filtro === 'lead' && c.viagens) return false;
          return !q || [c.nome, c.email, c.whatsapp].join(' ').toLowerCase().indexOf(q) >= 0;
        });
        $('#lista-cli').innerHTML = l.length ? '<table class="tabela resp"><thead><tr><th>Cliente</th><th>Contato</th><th>Cotações</th><th>Viagens</th><th class="num">Aprovado</th><th>Última atividade</th></tr></thead><tbody>' + l.map(function (c) {
          return '<tr class="clica" data-href="clientes/' + encodeURIComponent(c.email) + '"><td class="principal-col"><span style="display:flex;align-items:center;gap:10px"><span class="av" style="width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--ouro-claro);color:#8a6a30;font-weight:600;font-size:13px;flex:none">' + esc(iniciais(c.nome || c.email)) + '</span><span>' + esc(c.nome || '(sem nome)') + (c.vip ? ' <span class="tag vip">' + ic('coroa', 'p') + 'VIP</span>' : '') + '</span></span></td><td data-r="Contato">' + esc(c.email) + (c.whatsapp ? '<br><small style="color:var(--texto-2)">' + esc(c.whatsapp) + '</small>' : '') + '</td><td data-r="Cotações">' + c.cotacoes + '</td><td data-r="Viagens">' + c.viagens + '</td><td class="num" data-r="Aprovado">' + (c.valor_aprovado ? moeda(c.valor_aprovado) : '—') + '</td><td data-r="Última atividade">' + esc(relativo(c.ultima)) + '</td></tr>';
        }).join('') + '</tbody></table>' : vazio('clientes', todos.length ? 'Nenhum cliente com esse filtro' : 'Nenhum cliente ainda', todos.length ? '' : 'Clientes aparecem quando chegam cotações, viagens ou quando você cadastra.', todos.length ? '' : '<a class="btn ouro p" href="#/clientes/novo">Cadastrar cliente</a>');
      }
      $('#f-busca').addEventListener('input', render);
      $$('.chip[data-f]').forEach(function (b) { b.addEventListener('click', function () { $$('.chip[data-f]').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); filtro = b.getAttribute('data-f'); render(); }); });
      $('#lista-cli').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-href]'); if (tr) ir(tr.getAttribute('data-href')); });
      render();
    });
  };

  function formCliente(c) {
    c = c || {}; var p = c.preferencias || {};
    var campo = function (id, rot, val, tipo, extra) { return '<div class="campo ' + (extra || '') + '"><label for="' + id + '">' + rot + '</label><input id="' + id + '" type="' + (tipo || 'text') + '" value="' + esc(val || '') + '"></div>'; };
    var area = function (id, rot, val, extra) { return '<div class="campo ' + (extra || '') + '"><label for="' + id + '">' + rot + '</label><textarea id="' + id + '">' + esc(val || '') + '</textarea></div>'; };
    return '<form id="form-cli" class="grade" style="gap:14px" autocomplete="off">' +
      '<section class="card"><div class="card-corpo"><h3 class="secao-t">' + ic('pessoa', 'p') + 'Dados e contato</h3><div class="form duas" style="margin-top:12px">' +
        campo('c-nome', 'Nome completo *', c.nome) + campo('c-email', 'E-mail *', c.email, 'email') + campo('c-whats', 'WhatsApp', c.whatsapp, 'tel') + campo('c-cidade', 'Cidade', c.cidade) +
        campo('c-aniv', 'Aniversário', c.aniversario, 'date') + campo('c-doc', 'CPF / Passaporte', c.documento) +
        '<div class="campo"><label for="c-canal">Como chegou</label><select id="c-canal"><option value="">—</option>' + opcoes(CANAIS, c.canal) + '</select></div>' +
        campo('c-etq', 'Etiquetas (separe por vírgula)', (c.etiquetas || []).join(', ')) +
        '<label class="check largo"><input type="checkbox" id="c-vip"' + (c.vip ? ' checked' : '') + '>' + ic('coroa', 'p') + ' Cliente VIP (atenção especial)</label>' +
      '</div><p class="ajuda" style="font-size:12px;color:var(--texto-2);margin:10px 0 0">' + ic('cadeado', 'p') + ' Documentos pessoais ficam visíveis só no painel (LGPD).</p></div></section>' +
      '<section class="card"><div class="card-corpo"><h3 class="secao-t">' + ic('estrela', 'p') + 'Preferências de viagem</h3><div class="form duas" style="margin-top:12px">' +
        campo('p-dest', 'Destinos preferidos', p.destinos) + campo('p-hosp', 'Hospedagem', p.hospedagem) + campo('p-cia', 'Companhia aérea', p.companhia) + campo('p-classe', 'Classe', p.classe) +
        campo('p-assento', 'Assento', p.assento) + campo('c-orc', 'Orçamento habitual', c.orcamento_habitual) + campo('c-viaj', 'Viajantes habituais', c.viajantes_habituais) + campo('p-atend', 'Preferência de atendimento', p.atendimento) +
        area('p-exp', 'Experiências que ama', p.experiencias, 'largo') + area('c-ocas', 'Ocasiões especiais (aniversários, lua de mel…)', c.ocasioes, 'largo') + area('c-obs', 'Observações internas', c.observacoes, 'largo') +
      '</div></div></section>' +
      '<div class="barra-salvar"><button type="submit" class="btn ouro" id="c-salvar">' + ic('ok', 'p') + 'Salvar cliente</button></div></form>';
  }
  function lerFormCliente() {
    var v = function (id) { var e = $('#' + id); return e ? e.value : ''; };
    return { nome: v('c-nome'), email: v('c-email'), whatsapp: v('c-whats'), cidade: v('c-cidade'), aniversario: v('c-aniv'), documento: v('c-doc'), canal: v('c-canal'), etiquetas: v('c-etq'), vip: $('#c-vip').checked,
      orcamento_habitual: v('c-orc'), viajantes_habituais: v('c-viaj'), ocasioes: v('c-ocas'), observacoes: v('c-obs'),
      preferencias: { destinos: v('p-dest'), hospedagem: v('p-hosp'), companhia: v('p-cia'), classe: v('p-classe'), assento: v('p-assento'), experiencias: v('p-exp'), atendimento: v('p-atend') } };
  }
  function telaClienteForm(c, vivo) {
    titulo('Novo cliente');
    if (!vivo()) return;
    $('#conteudo').innerHTML = '<div class="cabeca"><div class="t"><h2>Novo cliente</h2><p>Cadastro com preferências e ocasiões especiais.</p><div class="linha-ouro"></div></div></div>' + formCliente(c);
    $('#form-cli').addEventListener('submit', function (e) {
      e.preventDefault(); var b = $('#c-salvar'); ocupado(b, true);
      api('cliente-salvar', lerFormCliente()).then(function (j) { aviso('Cliente salvo.'); pilha.pop(); ir('clientes/' + encodeURIComponent(j.cliente.email)); }).catch(function (er) { aviso(er.message, true); }).then(function () { ocupado(b, false); });
    });
  }
  function telaCliente(email, vivo) {
    titulo('Cliente');
    return api('cliente-detalhe', { email: email }).then(function (j) {
      if (!vivo()) return;
      var c = j.cliente;
      titulo(c.nome || c.email);
      var wpp = whatsLink(c.whatsapp, 'Olá ' + (c.nome || '').split(' ')[0] + ', aqui é da Viajante Pro.');
      $('#conteudo').innerHTML = '<section class="card" style="margin-bottom:14px"><div class="card-corpo"><div class="perfil-cab"><span class="av">' + esc(iniciais(c.nome || c.email)) + '</span><div style="flex:1;min-width:200px"><h2 style="font-family:var(--titulo);margin:0;font-size:24px">' + esc(c.nome || c.email) + ' ' + (c.vip ? '<span class="tag vip">' + ic('coroa', 'p') + 'VIP</span>' : '') + '</h2><div style="color:var(--texto-2);font-size:14px">' + esc(c.email) + (c.cidade ? ' · ' + esc(c.cidade) : '') + (c.primeira ? ' · cliente desde ' + new Date(c.primeira).toLocaleDateString('pt-BR') : '') + '</div>' +
        '<div class="contatos">' + (wpp ? '<a class="btn p" target="_blank" rel="noopener" href="' + esc(wpp) + '">' + ic('telefone', 'p') + 'WhatsApp</a>' : '') + '<a class="btn p" href="mailto:' + esc(c.email) + '">' + ic('email', 'p') + 'E-mail</a><a class="btn p" href="#/cotacoes/nova?email=' + encodeURIComponent(c.email) + '">' + ic('nova_cot', 'p') + 'Nova cotação</a></div></div>' +
        '<div class="totais" style="flex:1 1 280px;margin:0"><div><small>Cotações</small><b>' + (c.cotacoes || 0) + '</b></div><div><small>Viagens</small><b>' + (c.viagens || 0) + '</b></div><div class="venda"><small>Aprovado</small><b>' + (c.valor_aprovado ? moedaCurta(c.valor_aprovado) : '—') + '</b></div></div></div></div></section>' +
        '<div class="abas" role="tablist"><button class="on" data-aba="hist">' + ic('relogio', 'p') + 'Histórico</button><button data-aba="perfil">' + ic('pessoa', 'p') + 'Perfil e preferências</button><button data-aba="docs">' + ic('pasta', 'p') + 'Documentos<span class="n">' + j.documentos.length + '</span></button></div><div id="aba"></div>';
      var abas = {
        hist: function () {
          $('#aba').innerHTML = '<div class="grade g2i"><section class="card"><div class="card-cab"><h3>' + ic('cotacao', 'p') + 'Cotações</h3></div><div class="card-corpo">' + (j.cotacoes.length ? '<ul class="lista">' + j.cotacoes.map(function (q) { return '<li><a class="linha" href="#/cotacoes/' + encodeURIComponent(q.id) + '"><span class="meio"><b>' + esc(q.codigo || q.id) + ' · ' + esc(q.destino || 'Destino a definir') + '</b><small>' + esc(dataHora(q.criado_em)) + (q.valor ? ' · ' + moeda(q.valor) : '') + '</small></span>' + tag(q.status) + '</a></li>'; }).join('') + '</ul>' : vazio('cotacao', 'Sem cotações')) + '</div></section>' +
            '<section class="card"><div class="card-cab"><h3>' + ic('aviao', 'p') + 'Viagens</h3></div><div class="card-corpo">' + (j.viagens.length ? '<div class="grade" style="gap:10px">' + j.viagens.map(cartaoViagem).join('') + '</div>' : vazio('aviao', 'Sem viagens')) + '</div></section></div>';
        },
        perfil: function () {
          $('#aba').innerHTML = formCliente(c);
          $('#c-email').readOnly = true;
          $('#form-cli').addEventListener('submit', function (e) {
            e.preventDefault(); var b = $('#c-salvar'); ocupado(b, true);
            api('cliente-salvar', lerFormCliente()).then(function (r) { Object.assign(c, r.cliente); aviso('Cliente atualizado.'); }).catch(function (er) { aviso(er.message, true); }).then(function () { ocupado(b, false); });
          });
        },
        docs: function () { $('#aba').innerHTML = '<div id="docs-cli"></div>'; blocoDocumentos($('#docs-cli'), 'cliente', c.email); },
      };
      $$('.abas button').forEach(function (b) { b.addEventListener('click', function () { $$('.abas button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); abas[b.getAttribute('data-aba')](); }); });
      abas.hist();
    });
  }

  // ───────────────────────── Cotações ─────────────────────────
  TELAS.cotacoes = function (param, vivo) {
    if (param && param.indexOf('nova') === 0) return telaCotacao(null, vivo, param);
    if (param) return telaCotacao(param, vivo);
    titulo('Cotações');
    return api('cotacao-listar').then(function (j) {
      if (!vivo()) return;
      var todas = (j.cotacoes || []).map(function (c) { c._st = statusNormal(c.status); return c; });
      var filtro = 'abertas';
      var FECH = { aprovada: 1, recusada: 1, expirada: 1 };
      var cont = function (f) { return todas.filter(function (c) { return f === 'todas' || (f === 'abertas' ? !FECH[c._st] : c._st === f); }).length; };
      $('#conteudo').innerHTML = '<div class="cabeca"><div class="t"><h2>Cotações e propostas</h2><p>Pedidos do site e propostas montadas pela agência.</p><div class="linha-ouro"></div></div><div class="acoes"><a class="btn ouro" href="#/cotacoes/nova">' + ic('nova_cot', 'p') + 'Nova cotação</a></div></div>' +
        '<div class="barra-lista"><div class="campo-busca">' + ic('busca') + '<input type="search" id="f-busca" placeholder="Buscar por cliente, código ou destino"></div></div>' +
        '<div class="chips">' + [['abertas', 'Em aberto'], ['nova', 'Novas'], ['enviada', 'Enviadas'], ['em_negociacao', 'Em negociação'], ['aprovada', 'Aprovadas'], ['recusada', 'Recusadas'], ['expirada', 'Expiradas'], ['todas', 'Todas']].map(function (f) { return '<button class="chip' + (f[0] === filtro ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + '<span class="n">' + cont(f[0]) + '</span></button>'; }).join('') + '</div>' +
        '<section class="card"><div id="lista-cot"></div></section>';
      function render() {
        var q = $('#f-busca').value.toLowerCase().trim();
        var l = todas.filter(function (c) {
          if (filtro === 'abertas' && FECH[c._st]) return false;
          if (filtro !== 'abertas' && filtro !== 'todas' && c._st !== filtro) return false;
          return !q || [c.nome, c.email, c.codigo, c.destino].join(' ').toLowerCase().indexOf(q) >= 0;
        });
        $('#lista-cot').innerHTML = l.length ? '<table class="tabela resp"><thead><tr><th>Cliente</th><th>Código</th><th>Destino</th><th>Datas</th><th class="num">Valor</th><th>Status</th><th>Recebida</th></tr></thead><tbody>' + l.map(function (c) {
          var valor = (c.itens || []).reduce(function (t, i) { return t + num(i.preco); }, 0) - num(c.desconto) + num(c.taxas);
          return '<tr class="clica" data-href="cotacoes/' + encodeURIComponent(c.id) + '"><td class="principal-col">' + esc(c.nome) + '</td><td data-r="Código">' + esc(c.codigo || c.id) + '</td><td data-r="Destino">' + esc(c.destino || '—') + '</td><td data-r="Datas">' + (c.dataIda ? dataBR(c.dataIda) + (c.dataVolta ? ' → ' + dataBR(c.dataVolta) : '') : '—') + '</td><td class="num" data-r="Valor">' + ((c.itens || []).length ? moeda(valor) : '—') + '</td><td data-r="Status">' + tag(c._st) + '</td><td data-r="Recebida">' + esc(relativo(c.criado_em)) + '</td></tr>';
        }).join('') + '</tbody></table>' : vazio('cotacao', 'Nenhuma cotação neste filtro', '', '<a class="btn ouro p" href="#/cotacoes/nova">Nova cotação</a>');
      }
      $('#f-busca').addEventListener('input', render);
      $$('.chip[data-f]').forEach(function (b) { b.addEventListener('click', function () { $$('.chip[data-f]').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); filtro = b.getAttribute('data-f'); render(); }); });
      $('#lista-cot').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-href]'); if (tr) ir(tr.getAttribute('data-href')); });
      render();
    });
  };
  function statusNormal(s) {
    s = String(s || 'nova').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
    if (s === 'respondida') return 'enviada'; if (s === 'em_andamento' || s === 'em_atendimento') return 'em_preparacao';
    if (s === 'fechada' || s === 'convertida') return 'aprovada'; if (s === 'cancelada' || s === 'perdida') return 'recusada';
    return STATUS_COT[s] ? s : 'nova';
  }

  function linhaItem(i, idx, comStatus) {
    i = i || {};
    return '<div class="item-linha" data-idx="' + idx + '">' +
      '<div class="campo"><label>Tipo</label><select data-k="tipo">' + Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '"' + (k === (i.tipo || 'voo') ? ' selected' : '') + '>' + TIPOS[k][0] + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo largo"><label>Descrição</label><input data-k="descricao" value="' + esc(i.descricao) + '" placeholder="Ex.: GRU → CDG, executiva"></div>' +
      '<div class="campo"><label>Fornecedor</label><input data-k="fornecedor" value="' + esc(i.fornecedor) + '"></div>' +
      (comStatus
        ? '<div class="campo"><label>Localizador</label><input data-k="localizador" value="' + esc(i.localizador) + '"></div><div class="campo"><label>Status</label><select data-k="status">' + opcoes(STATUS_SERV, i.status || 'solicitada') + '</select></div>' +
          '<div class="campo"><label>Início</label><input data-k="inicio" type="date" value="' + esc(i.inicio) + '"></div><div class="campo"><label>Fim</label><input data-k="fim" type="date" value="' + esc(i.fim) + '"></div><div class="campo largo"><label>Observações internas</label><input data-k="observacoes" value="' + esc(i.observacoes) + '"></div>'
        : '<div class="campo"><label>Custo (R$)</label><input data-k="custo" inputmode="decimal" value="' + (i.custo ? String(i.custo).replace('.', ',') : '') + '"></div><div class="campo"><label>Preço (R$)</label><input data-k="preco" inputmode="decimal" value="' + (i.preco ? String(i.preco).replace('.', ',') : '') + '"></div>') +
      '<button type="button" class="ibtn remover" title="Remover" aria-label="Remover item">' + ic('lixo', 'p') + '</button></div>';
  }
  function lerItens(box) {
    return $$('.item-linha', box).map(function (l) { var o = {}; $$('[data-k]', l).forEach(function (e) { o[e.getAttribute('data-k')] = e.value; }); return o; });
  }

  function telaCotacao(id, vivo, param) {
    var nova = !id;
    titulo(nova ? 'Nova cotação' : 'Cotação');
    var emailPre = nova && /email=([^&]+)/.exec(param || '') ? decodeURIComponent(/email=([^&]+)/.exec(param)[1]) : '';
    var p = nova ? Promise.resolve({ cotacao: { status_painel: 'em_preparacao', email: emailPre, itens: [], adultos: 2 } }) : api('cotacao-detalhe', { id: id });
    return p.then(function (j) {
      if (!vivo()) return;
      var c = j.cotacao;
      if (!nova) titulo((c.codigo || 'Cotação') + ' · ' + (c.nome || ''));
      var campo = function (idc, rot, val, tipo, cls) { return '<div class="campo ' + (cls || '') + '"><label for="' + idc + '">' + rot + '</label><input id="' + idc + '" type="' + (tipo || 'text') + '" value="' + esc(val == null ? '' : val) + '"></div>'; };
      var pedidoSite = !nova && (c.modalidades || c.classeVoo || c.categoriaHospedagem || c.orcamento || c.observacoes) ? '<div style="background:var(--marfim);border:1px solid var(--areia);border-radius:12px;padding:12px 14px;font-size:14px;margin-top:12px"><b style="display:block;margin-bottom:4px">Pedido do cliente</b>' +
        [['Modalidades', (c.modalidades || []).join(', ')], ['Classe', c.classeVoo], ['Hospedagem', c.categoriaHospedagem], ['Regime', c.regime], ['Orçamento', c.orcamento], ['Flexibilidade', c.flexibilidade], ['Cidade', c.cidadeResidencia], ['Observações', c.observacoes]].filter(function (x) { return x[1]; }).map(function (x) { return '<div><span style="color:var(--texto-2)">' + x[0] + ':</span> ' + esc(x[1]) + '</div>'; }).join('') + '</div>' : '';
      var wpp = whatsLink(c.whatsapp, 'Olá ' + String(c.nome || '').split(' ')[0] + ', aqui é da Viajante Pro sobre sua cotação ' + (c.codigo || '') + '.');
      $('#conteudo').innerHTML =
        '<div class="nao-imprime">' +
        (nova ? '' : '<div class="cabeca"><div class="t"><h2>' + esc(c.codigo || '') + ' ' + tag(c.status_painel) + '</h2><p>Recebida ' + esc(dataHora(c.criado_em)) + (c.canal ? ' · ' + esc(CANAIS[c.canal] || c.canal) : '') + '</p></div><div class="acoes">' +
          (wpp ? '<a class="btn p" target="_blank" rel="noopener" href="' + esc(wpp) + '">' + ic('telefone', 'p') + 'WhatsApp</a>' : '') +
          (c.email ? '<a class="btn p" href="#/clientes/' + encodeURIComponent(c.email) + '">' + ic('pessoa', 'p') + 'Cliente</a>' : '') +
          '<button class="btn p" id="b-pdf" type="button">' + ic('imprimir', 'p') + 'Gerar PDF</button>' +
          (c.viagem_id ? '<a class="btn p navy" href="#/viagens/' + encodeURIComponent(c.viagem_id) + '">' + ic('aviao', 'p') + 'Abrir viagem</a>' : '<button class="btn p ouro" id="b-converter" type="button">' + ic('aviao', 'p') + 'Converter em viagem</button>') +
        '</div></div>') +
        '<form id="form-cot" class="grade" style="gap:14px" autocomplete="off">' +
          '<section class="card"><div class="card-corpo"><h3 class="secao-t">' + ic('pessoa', 'p') + 'Cliente</h3><div class="form duas" style="margin-top:12px">' +
            campo('q-nome', 'Nome *', c.nome) + campo('q-email', 'E-mail', c.email, 'email') + campo('q-whats', 'WhatsApp', c.whatsapp, 'tel') +
            '<div class="campo"><label for="q-canal">Canal de origem</label><select id="q-canal">' + opcoes(CANAIS, c.canal || (nova ? 'whatsapp' : 'site')) + '</select></div>' +
          '</div></div></section>' +
          '<section class="card"><div class="card-corpo"><h3 class="secao-t">' + ic('local', 'p') + 'Viagem desejada</h3><div class="form duas" style="margin-top:12px">' +
            campo('q-origem', 'Origem', c.origem) + campo('q-destino', 'Destino', c.destino) + campo('q-ida', 'Ida', c.dataIda, 'date') + campo('q-volta', 'Volta', c.dataVolta, 'date') + campo('q-adultos', 'Adultos', c.adultos || 1, 'number') + campo('q-criancas', 'Crianças', c.criancas || 0, 'number') +
          '</div>' + pedidoSite + '</div></section>' +
          '<section class="card"><div class="card-corpo"><h3 class="secao-t">' + ic('cotacao', 'p') + 'Proposta</h3><p style="margin:4px 0 12px;color:var(--texto-2);font-size:13.5px">Voos, hotéis, transfers, passeios, seguro e serviços. O custo é interno; o cliente só vê o preço.</p><div class="itens" id="itens">' + (c.itens || []).map(function (i, k) { return linhaItem(i, k); }).join('') + '</div>' +
            '<button type="button" class="btn p" id="b-item" style="margin-top:10px">' + ic('mais', 'p') + 'Adicionar item</button>' +
            '<div class="form tres" style="margin-top:14px">' + campo('q-desc', 'Desconto (R$)', c.desconto ? String(c.desconto).replace('.', ',') : '', 'text') + campo('q-taxas', 'Taxas (R$)', c.taxas ? String(c.taxas).replace('.', ',') : '', 'text') + campo('q-val', 'Válida até', c.validade, 'date') + '</div>' +
            '<div class="totais" id="totais"></div>' +
            '<div class="form duas" style="margin-top:14px"><div class="campo"><label for="q-pag">Formas de pagamento</label><textarea id="q-pag">' + esc(c.formas_pagamento) + '</textarea></div><div class="campo"><label for="q-cond">Condições</label><textarea id="q-cond">' + esc(c.condicoes) + '</textarea></div></div>' +
          '</div></section>' +
          '<section class="card"><div class="card-corpo"><h3 class="secao-t">' + ic('cadeado', 'p') + 'Controle interno</h3><div class="form duas" style="margin-top:12px">' +
            '<div class="campo"><label for="q-status">Status</label><select id="q-status">' + opcoes(nova ? { rascunho: 'Rascunho', em_preparacao: 'Em preparação' } : { rascunho: 'Rascunho', em_preparacao: 'Em preparação', enviada: 'Enviada', visualizada: 'Visualizada', em_negociacao: 'Em negociação', aprovada: 'Aprovada', recusada: 'Recusada', expirada: 'Expirada' }, c.status_painel === 'nova' ? '' : c.status_painel) + (c.status_painel === 'nova' ? '<option value="" selected>Nova (não atendida)</option>' : '') + '</select></div>' +
            campo('q-resp', 'Responsável', c.responsavel) +
            '<div class="campo largo"><label for="q-obs">Observações internas</label><textarea id="q-obs">' + esc(c.observacoes_internas) + '</textarea></div>' +
          '</div>' +
          (c.historico && c.historico.length ? '<h4 style="margin:16px 0 6px;font-size:14px">Histórico</h4><ul class="lista">' + c.historico.slice().reverse().map(function (h) { return '<li><div class="linha"><span class="meio"><b style="font-weight:500">' + esc(STATUS_COT[statusNormal(h.novo_status)] || h.novo_status) + '</b><small>' + esc(dataHora(h.data)) + (h.observacoes ? ' · ' + esc(h.observacoes) : '') + '</small></span></div></li>'; }).join('') + '</ul>' : '') +
          '</div></section>' +
          (nova ? '' : '<section class="card"><div class="card-corpo"><h3 class="secao-t">' + ic('pasta', 'p') + 'Documentos da cotação</h3><div id="docs-cot" style="margin-top:12px"></div></div></section>') +
          '<div class="barra-salvar">' + (nova ? '' : '<button type="button" class="btn perigo" id="b-excluir">' + ic('lixo', 'p') + 'Excluir</button>') + '<button type="submit" class="btn ouro" id="b-salvar">' + ic('ok', 'p') + (nova ? 'Criar cotação' : 'Salvar') + '</button></div>' +
        '</form></div><div class="so-impressao" id="impressao"></div>';
      var box = $('#itens');
      function totais() {
        var it = lerItens(box);
        var custo = it.reduce(function (t, i) { return t + num(i.custo); }, 0), bruto = it.reduce(function (t, i) { return t + num(i.preco); }, 0);
        var venda = Math.max(0, bruto - num($('#q-desc').value) + num($('#q-taxas').value));
        $('#totais').innerHTML = '<div><small>Custo</small><b>' + moeda(custo) + '</b></div><div class="venda"><small>Venda ao cliente</small><b>' + moeda(venda) + '</b></div><div><small>Margem</small><b style="color:' + (venda - custo < 0 ? 'var(--vermelho)' : 'var(--verde)') + '">' + moeda(venda - custo) + (venda ? ' <small style="display:inline">(' + Math.round((venda - custo) / venda * 100) + '%)</small>' : '') + '</b></div>';
        return { custo: custo, venda: venda };
      }
      box.addEventListener('input', totais);
      ['#q-desc', '#q-taxas'].forEach(function (s) { $(s).addEventListener('input', totais); });
      box.addEventListener('click', function (e) { var b = e.target.closest('.remover'); if (b) { b.parentNode.remove(); totais(); } });
      $('#b-item').addEventListener('click', function () { box.insertAdjacentHTML('beforeend', linhaItem({}, $$('.item-linha', box).length)); var ult = box.lastElementChild; $('input[data-k="descricao"]', ult).focus(); });
      if (!(c.itens || []).length) $('#b-item').click();
      totais();
      function dados() {
        var v = function (s) { return $(s).value; };
        var d = { nome: v('#q-nome'), email: v('#q-email'), whatsapp: v('#q-whats'), canal: v('#q-canal'), origem: v('#q-origem'), destino: v('#q-destino'), dataIda: v('#q-ida'), dataVolta: v('#q-volta'), adultos: v('#q-adultos'), criancas: v('#q-criancas'),
          itens: lerItens(box), desconto: v('#q-desc'), taxas: v('#q-taxas'), validade: v('#q-val'), formas_pagamento: v('#q-pag'), condicoes: v('#q-cond'), responsavel: v('#q-resp'), observacoes_internas: v('#q-obs') };
        if (v('#q-status')) d.status = v('#q-status');
        return d;
      }
      $('#form-cot').addEventListener('submit', function (e) {
        e.preventDefault(); var b = $('#b-salvar'); ocupado(b, true);
        api(nova ? 'cotacao-criar' : 'cotacao-salvar', Object.assign({ id: id }, dados())).then(function (r) {
          aviso(nova ? 'Cotação criada.' : 'Cotação salva.');
          if (nova) { pilha.pop(); ir('cotacoes/' + encodeURIComponent(r.cotacao.id)); } else navegar();
          buscarResumo().catch(function () {});
        }).catch(function (er) { aviso(er.message, true); }).then(function () { ocupado(b, false); });
      });
      if (nova) return;
      blocoDocumentos($('#docs-cot'), 'cotacao', id);
      $('#b-excluir').addEventListener('click', function () {
        confirmar('Excluir esta cotação?', 'Esta ação não pode ser desfeita. Documentos ligados a ela continuam em Documentos.', 'Excluir').then(function (s) {
          if (!s) return;
          api('cotacao-excluir', { id: id, confirmar: true }).then(function () { aviso('Cotação excluída.'); pilha.pop(); ir('cotacoes'); }).catch(function (er) { aviso(er.message, true); });
        });
      });
      var bc = $('#b-converter');
      if (bc) bc.addEventListener('click', function () {
        confirmar('Converter em viagem?', 'A cotação fica Aprovada e nasce uma viagem com os dados, passageiros e itens desta proposta. Salve antes se você alterou algo.', 'Converter').then(function (s) {
          if (!s) return;
          ocupado(bc, true);
          api('cotacao-converter', { id: id }).then(function (r) { aviso('Viagem criada.'); buscarResumo().catch(function () {}); ir('viagens/' + encodeURIComponent(r.viagem.id)); }).catch(function (er) { aviso(er.message, true); ocupado(bc, false); });
        });
      });
      $('#b-pdf').addEventListener('click', function () { $('#impressao').innerHTML = propostaImpressa(Object.assign({}, c, dados()), totais()); window.print(); });
    });
  }
  function propostaImpressa(c, t) {
    var itens = (c.itens || []).filter(function (i) { return i.descricao || num(i.preco); });
    return '<div style="font-family:var(--fonte);color:#243247;padding:10px 6px">' +
      '<div style="display:flex;align-items:center;gap:16px;border-bottom:2px solid #b18a4a;padding-bottom:14px"><img src="/viajante-pro/img/vp-oficial.jpg" alt="" style="width:76px;height:76px;border-radius:12px"><div><div style="font-family:var(--titulo);font-size:26px;color:#142238">Proposta de viagem</div><div style="color:#78818c">' + esc(c.codigo || '') + ' · emitida em ' + new Date().toLocaleDateString('pt-BR') + (c.validade ? ' · válida até ' + dataBR(c.validade) : '') + '</div></div></div>' +
      '<p style="margin:18px 0 4px"><b>Cliente:</b> ' + esc(c.nome) + '</p><p style="margin:0 0 4px"><b>Destino:</b> ' + esc(c.destino || 'A definir') + (c.origem ? ' (saindo de ' + esc(c.origem) + ')' : '') + '</p>' +
      '<p style="margin:0 0 14px"><b>Datas:</b> ' + (c.dataIda ? dataBR(c.dataIda) + (c.dataVolta ? ' a ' + dataBR(c.dataVolta) : '') : 'A definir') + ' · <b>Viajantes:</b> ' + esc(c.adultos || 1) + ' adulto(s)' + (num(c.criancas) ? ', ' + esc(c.criancas) + ' criança(s)' : '') + '</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="text-align:left;border-bottom:1px solid #e8e1d6;padding:8px">Serviço</th><th style="text-align:left;border-bottom:1px solid #e8e1d6;padding:8px">Descrição</th><th style="text-align:right;border-bottom:1px solid #e8e1d6;padding:8px">Valor</th></tr></thead><tbody>' +
      itens.map(function (i) { return '<tr><td style="padding:8px;border-bottom:1px solid #f2ede4">' + esc((TIPOS[i.tipo] || TIPOS.outro)[0]) + '</td><td style="padding:8px;border-bottom:1px solid #f2ede4">' + esc(i.descricao) + '</td><td style="padding:8px;border-bottom:1px solid #f2ede4;text-align:right">' + moeda(num(i.preco)) + '</td></tr>'; }).join('') +
      (num(c.desconto) ? '<tr><td colspan="2" style="padding:8px;text-align:right">Desconto</td><td style="padding:8px;text-align:right">− ' + moeda(num(c.desconto)) + '</td></tr>' : '') +
      (num(c.taxas) ? '<tr><td colspan="2" style="padding:8px;text-align:right">Taxas</td><td style="padding:8px;text-align:right">' + moeda(num(c.taxas)) + '</td></tr>' : '') +
      '<tr><td colspan="2" style="padding:10px 8px;text-align:right;font-weight:700">Total</td><td style="padding:10px 8px;text-align:right;font-weight:700;color:#b18a4a;font-size:17px">' + moeda(t.venda) + '</td></tr></tbody></table>' +
      (c.formas_pagamento ? '<h4 style="margin:18px 0 4px">Formas de pagamento</h4><p style="white-space:pre-wrap;margin:0">' + esc(c.formas_pagamento) + '</p>' : '') +
      (c.condicoes ? '<h4 style="margin:14px 0 4px">Condições</h4><p style="white-space:pre-wrap;margin:0">' + esc(c.condicoes) + '</p>' : '') +
      '<p style="margin-top:28px;color:#78818c;font-size:12px;border-top:1px solid #e8e1d6;padding-top:10px">Viajante Pro · Travel Agency · Valores sujeitos a disponibilidade no momento da reserva.</p></div>';
  }

  // ───────────────────────── Viagens ─────────────────────────
  TELAS.viagens = function (param, vivo) {
    if (param === 'nova') return telaViagemNova(vivo);
    if (param) return telaViagem(param, vivo);
    titulo('Viagens e reservas');
    return api('viagem-listar').then(function (j) {
      if (!vivo()) return;
      var hj = hojeISO();
      var todas = j.viagens || [];
      var grupo = function (v) { var s = v.status || 'confirmada'; if (s === 'cancelada') return 'cancelada'; var ini = (v.datas && v.datas.inicio) || '', fim = (v.datas && v.datas.fim) || ini; if (s === 'concluida' || (fim && fim < hj)) return 'passadas'; if (ini && ini <= hj) return 'agora'; return 'proximas'; };
      var filtro = 'proximas';
      var cont = function (f) { return todas.filter(function (v) { return f === 'todas' || grupo(v) === f; }).length; };
      $('#conteudo').innerHTML = '<div class="cabeca"><div class="t"><h2>Viagens e reservas</h2><p>Viagens confirmadas, serviços, passageiros, roteiro e link do app.</p><div class="linha-ouro"></div></div><div class="acoes"><a class="btn ouro" href="#/viagens/nova">' + ic('mais', 'p') + 'Nova viagem</a></div></div>' +
        '<div class="barra-lista"><div class="campo-busca">' + ic('busca') + '<input type="search" id="f-busca" placeholder="Buscar por nome, destino ou e-mail"></div></div>' +
        '<div class="chips">' + [['proximas', 'Próximas'], ['agora', 'Em viagem'], ['passadas', 'Concluídas'], ['cancelada', 'Canceladas'], ['todas', 'Todas']].map(function (f) { return '<button class="chip' + (f[0] === filtro ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + '<span class="n">' + cont(f[0]) + '</span></button>'; }).join('') + '</div><div id="lista-via" class="grade" style="gap:10px"></div>';
      function render() {
        var q = $('#f-busca').value.toLowerCase().trim();
        var l = todas.filter(function (v) { return (filtro === 'todas' || grupo(v) === filtro) && (!q || [v.nome, v.destino, v.email, v.cliente_email].join(' ').toLowerCase().indexOf(q) >= 0); })
          .sort(function (a, b) { var x = (a.datas && a.datas.inicio) || '9', y = (b.datas && b.datas.inicio) || '9'; return filtro === 'passadas' ? y.localeCompare(x) : x.localeCompare(y); });
        $('#lista-via').innerHTML = l.length ? l.map(cartaoViagem).join('') : '<section class="card">' + vazio('aviao', 'Nenhuma viagem neste filtro', '', '<a class="btn ouro p" href="#/viagens/nova">Nova viagem</a>') + '</section>';
      }
      $('#f-busca').addEventListener('input', render);
      $$('.chip[data-f]').forEach(function (b) { b.addEventListener('click', function () { $$('.chip[data-f]').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); filtro = b.getAttribute('data-f'); render(); }); });
      render();
    });
  };
  function telaViagemNova(vivo) {
    titulo('Nova viagem');
    if (!vivo()) return;
    var campo = function (idc, rot, tipo, cls, ph) { return '<div class="campo ' + (cls || '') + '"><label for="' + idc + '">' + rot + '</label><input id="' + idc + '" type="' + (tipo || 'text') + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '></div>'; };
    $('#conteudo').innerHTML = '<div class="cabeca"><div class="t"><h2>Nova viagem</h2><p>Depois de criar, adicione serviços, roteiro, documentos e envie o link do app ao passageiro.</p><div class="linha-ouro"></div></div></div>' +
      '<form id="form-nv"><section class="card"><div class="card-corpo"><div class="form duas">' +
        campo('v-nome', 'Nome da viagem *', 'text', 'largo', 'Ex.: Lua de mel nas Maldivas — Ana e Pedro') + campo('v-dest', 'Destino *') + campo('v-ini', 'Início *', 'date') + campo('v-fim', 'Fim *', 'date') +
        campo('v-pax', 'Passageiro principal', 'text', '', 'Nome') + campo('v-email', 'E-mail do cliente', 'email') + campo('v-whats', 'WhatsApp', 'tel') +
      '</div></div></section><div class="barra-salvar"><button class="btn ouro" type="submit" id="v-criar">' + ic('ok', 'p') + 'Criar viagem</button></div></form>';
    $('#form-nv').addEventListener('submit', function (e) {
      e.preventDefault(); var b = $('#v-criar'); ocupado(b, true);
      var v = function (s) { return $(s).value; };
      api('viagem-criar', { nome: v('#v-nome'), destino: v('#v-dest'), datas: { inicio: v('#v-ini'), fim: v('#v-fim') }, email: v('#v-email'), whatsapp: v('#v-whats'), passageiros: v('#v-pax') ? [{ nome: v('#v-pax'), email: v('#v-email'), tipo: 'adulto' }] : [] })
        .then(function (r) { return v('#v-email') ? api('viagem-salvar-detalhes', { id: r.id, cliente_email: v('#v-email'), status: 'confirmada' }).then(function () { return r; }) : r; })
        .then(function (r) { aviso('Viagem criada.'); pilha.pop(); ir('viagens/' + encodeURIComponent(r.id)); })
        .catch(function (er) { aviso(er.message, true); ocupado(b, false); });
    });
  }
  function telaViagem(id, vivo) {
    titulo('Viagem');
    return api('viagem-detalhe', { id: id }).then(function (j) {
      if (!vivo()) return;
      var v = j.viagem;
      titulo(v.nome);
      var link = location.origin + j.link;
      var wpp = whatsLink(v.whatsapp, 'Olá! Aqui está o app da sua viagem ' + v.nome + ' com roteiro, documentos e chat com a agência: ' + link);
      $('#conteudo').innerHTML = '<div class="cabeca"><div class="t"><h2>' + esc(v.nome) + ' ' + tag(v.status || 'confirmada', STATUS_VIA) + '</h2><p>' + ic('local', 'p') + ' ' + esc(v.destino) + ' · ' + dataBR(v.datas && v.datas.inicio) + ' a ' + dataBR(v.datas && v.datas.fim) + (v.cotacao_id ? ' · <a href="#/cotacoes/' + encodeURIComponent(v.cotacao_id) + '">ver cotação</a>' : '') + '</p></div></div>' +
        '<section class="card" style="margin-bottom:14px"><div class="card-corpo"><b style="display:flex;gap:8px;align-items:center;margin-bottom:8px">' + ic('link', 'p') + 'App do passageiro</b><div class="link-app"><code>' + esc(link) + '</code><button class="btn p" id="b-copiar" type="button">' + ic('copiar', 'p') + 'Copiar</button></div><div class="contatos">' + (wpp ? '<a class="btn p" target="_blank" rel="noopener" href="' + esc(wpp) + '">' + ic('telefone', 'p') + 'Enviar por WhatsApp</a>' : '') + '<a class="btn p" target="_blank" rel="noopener" href="' + esc(link) + '">' + ic('abrir', 'p') + 'Abrir como o passageiro</a></div></div></section>' +
        '<div class="abas"><button class="on" data-aba="resumo">' + ic('cotacao', 'p') + 'Resumo</button><button data-aba="servicos">' + ic('aviao', 'p') + 'Serviços<span class="n">' + (v.servicos || []).length + '</span></button><button data-aba="pax">' + ic('roteiro', 'p') + 'Passageiros e roteiro</button><button data-aba="docs">' + ic('pasta', 'p') + 'Documentos</button><button data-aba="chat">' + ic('conversa', 'p') + 'Conversa</button></div><div id="aba"></div>';
      $('#b-copiar').addEventListener('click', function () { (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { aviso('Link copiado.'); }, function () { prompt('Copie o link:', link); }); });
      var campo = function (idc, rot, val, tipo, cls) { return '<div class="campo ' + (cls || '') + '"><label for="' + idc + '">' + rot + '</label><input id="' + idc + '" type="' + (tipo || 'text') + '" value="' + esc(val == null ? '' : val) + '"></div>'; };
      var abas = {
        resumo: function () {
          $('#aba').innerHTML = '<form id="f-res" class="grade" style="gap:14px"><section class="card"><div class="card-corpo"><div class="form duas">' +
            campo('r-nome', 'Nome da viagem', v.nome, 'text', 'largo') + campo('r-dest', 'Destino', v.destino) +
            '<div class="campo"><label for="r-status">Status</label><select id="r-status">' + opcoes(STATUS_VIA, v.status || 'confirmada') + '</select></div>' +
            campo('r-ini', 'Início', v.datas && v.datas.inicio, 'date') + campo('r-fim', 'Fim', v.datas && v.datas.fim, 'date') +
            campo('r-cli', 'E-mail do cliente responsável', v.cliente_email || v.email, 'email') + campo('r-whats', 'WhatsApp do cliente', v.whatsapp, 'tel') +
            campo('r-valor', 'Valor vendido (R$)', v.valor_total ? String(v.valor_total).replace('.', ',') : '') + campo('r-custo', 'Custo total (R$)', v.custo_total ? String(v.custo_total).replace('.', ',') : '') +
            campo('r-emerg', 'Contato de emergência (aparece no app)', v.contato_emergencia, 'text', 'largo') +
            '<div class="campo largo"><label for="r-boas">Mensagem de boas-vindas (aparece no app)</label><textarea id="r-boas">' + esc(v.mensagem_boas_vindas) + '</textarea></div>' +
            '<div class="campo largo"><label for="r-obs">Observações internas (o passageiro não vê)</label><textarea id="r-obs">' + esc(v.observacoes_internas) + '</textarea></div>' +
          '</div></div></section><div class="barra-salvar"><button type="button" class="btn perigo" id="b-excl">' + ic('lixo', 'p') + 'Excluir viagem</button><button class="btn ouro" type="submit" id="b-sres">' + ic('ok', 'p') + 'Salvar</button></div></form>';
          $('#f-res').addEventListener('submit', function (e) {
            e.preventDefault(); var b = $('#b-sres'); ocupado(b, true);
            var g = function (s) { return $(s).value; };
            api('viagem-editar', { id: id, nome: g('#r-nome'), destino: g('#r-dest'), datas: { inicio: g('#r-ini'), fim: g('#r-fim') }, email: g('#r-cli'), whatsapp: g('#r-whats') })
              .then(function () { return api('viagem-salvar-detalhes', { id: id, status: g('#r-status'), cliente_email: g('#r-cli'), valor_total: g('#r-valor'), custo_total: g('#r-custo'), contato_emergencia: g('#r-emerg'), mensagem_boas_vindas: g('#r-boas'), observacoes_internas: g('#r-obs') }); })
              .then(function (r) { Object.assign(v, r.viagem); aviso('Viagem salva.'); titulo(v.nome); }).catch(function (er) { aviso(er.message, true); }).then(function () { ocupado(b, false); });
          });
          $('#b-excl').addEventListener('click', function () {
            confirmar('Excluir esta viagem?', 'O link do app deixa de funcionar e a conversa some do painel. Não pode ser desfeito.', 'Excluir').then(function (s) {
              if (s) api('viagem-excluir', { id: id }).then(function () { aviso('Viagem excluída.'); pilha.pop(); ir('viagens'); }).catch(function (er) { aviso(er.message, true); });
            });
          });
        },
        servicos: function () {
          $('#aba').innerHTML = '<section class="card"><div class="card-corpo"><p style="margin:0 0 12px;color:var(--texto-2);font-size:13.5px">Voos, hotéis, transfers e passeios com localizador e status. O passageiro vê os serviços (sem observações internas e sem os cancelados).</p><div class="itens" id="servs">' + (v.servicos || []).map(function (s, k) { return linhaItem(s, k, true); }).join('') + '</div><button class="btn p" type="button" id="b-serv" style="margin-top:10px">' + ic('mais', 'p') + 'Adicionar serviço</button></div></section><div class="barra-salvar"><button class="btn ouro" type="button" id="b-sserv">' + ic('ok', 'p') + 'Salvar serviços</button></div>';
          var box = $('#servs');
          box.addEventListener('click', function (e) { var b = e.target.closest('.remover'); if (b) b.parentNode.remove(); });
          $('#b-serv').addEventListener('click', function () { box.insertAdjacentHTML('beforeend', linhaItem({}, $$('.item-linha', box).length, true)); });
          if (!(v.servicos || []).length) $('#b-serv').click();
          $('#b-sserv').addEventListener('click', function () {
            var b = this; ocupado(b, true);
            api('viagem-salvar-detalhes', { id: id, servicos: lerItens(box) }).then(function (r) { v.servicos = r.viagem.servicos; aviso('Serviços salvos.'); }).catch(function (er) { aviso(er.message, true); }).then(function () { ocupado(b, false); });
          });
        },
        pax: function () {
          var pax = (v.passageiros || []).length ? v.passageiros : [{}];
          var rot = (v.roteiro || []).length ? v.roteiro : [{ dia: 1 }];
          var lp = function (p) { return '<div class="item-linha" style="grid-template-columns:1fr 1fr"><div class="campo"><label>Nome</label><input data-k="nome" value="' + esc(p.nome) + '"></div><div class="campo"><label>E-mail</label><input data-k="email" type="email" value="' + esc(p.email) + '"></div><div class="campo"><label>Tipo</label><select data-k="tipo"><option value="adulto"' + (p.tipo !== 'crianca' ? ' selected' : '') + '>Adulto</option><option value="crianca"' + (p.tipo === 'crianca' ? ' selected' : '') + '>Criança</option></select></div><button type="button" class="ibtn remover" aria-label="Remover">' + ic('lixo', 'p') + '</button></div>'; };
          var lr = function (r) { return '<div class="item-linha" style="grid-template-columns:90px 1fr"><div class="campo"><label>Dia</label><input data-k="dia" type="number" min="1" value="' + esc(r.dia || 1) + '"></div><div class="campo"><label>O que acontece</label><textarea data-k="descricao" style="min-height:60px">' + esc(r.descricao) + '</textarea></div><button type="button" class="ibtn remover" aria-label="Remover">' + ic('lixo', 'p') + '</button></div>'; };
          $('#aba').innerHTML = '<div class="grade g2i"><section class="card"><div class="card-cab"><h3>' + ic('clientes', 'p') + 'Passageiros</h3></div><div class="card-corpo"><div class="itens" id="pax">' + pax.map(lp).join('') + '</div><button type="button" class="btn p" id="b-pax" style="margin-top:10px">' + ic('mais', 'p') + 'Passageiro</button></div></section>' +
            '<section class="card"><div class="card-cab"><h3>' + ic('roteiro', 'p') + 'Roteiro dia a dia</h3></div><div class="card-corpo"><div class="itens" id="rot">' + rot.map(lr).join('') + '</div><button type="button" class="btn p" id="b-rot" style="margin-top:10px">' + ic('mais', 'p') + 'Dia</button></div></section></div>' +
            '<div class="barra-salvar"><button class="btn ouro" type="button" id="b-spax">' + ic('ok', 'p') + 'Salvar passageiros e roteiro</button></div>';
          ['#pax', '#rot'].forEach(function (s) { $(s).addEventListener('click', function (e) { var b = e.target.closest('.remover'); if (b) b.parentNode.remove(); }); });
          $('#b-pax').addEventListener('click', function () { $('#pax').insertAdjacentHTML('beforeend', lp({})); });
          $('#b-rot').addEventListener('click', function () { $('#rot').insertAdjacentHTML('beforeend', lr({ dia: $$('#rot .item-linha').length + 1 })); });
          $('#b-spax').addEventListener('click', function () {
            var b = this; ocupado(b, true);
            var passageiros = lerItens($('#pax')).filter(function (p) { return p.nome || p.email; });
            var roteiro = lerItens($('#rot')).filter(function (r) { return r.descricao; }).sort(function (a, b2) { return a.dia - b2.dia; });
            api('viagem-editar', { id: id, passageiros: passageiros, roteiro: roteiro }).then(function (r) { v.passageiros = r.viagem.passageiros; v.roteiro = r.viagem.roteiro; aviso('Salvo. O app do passageiro já mostra a versão nova.'); }).catch(function (er) { aviso(er.message, true); }).then(function () { ocupado(b, false); });
          });
        },
        docs: function () { $('#aba').innerHTML = '<p style="margin:0 0 12px;color:var(--texto-2);font-size:13.5px">' + ic('olho', 'p') + ' Marque "Visível no app" para o passageiro baixar (vouchers, bilhetes, seguro, roteiro).</p><div id="docs-via"></div>'; blocoDocumentos($('#docs-via'), 'viagem', id); },
        chat: function () { $('#aba').innerHTML = '<div id="chat-via"></div>'; blocoChat($('#chat-via'), id); },
      };
      $$('.abas button').forEach(function (b) { b.addEventListener('click', function () { pararTimers(); $$('.abas button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); abas[b.getAttribute('data-aba')](); }); });
      abas.resumo();
    });
  }

  // ───────────────────────── Conversas ─────────────────────────
  TELAS.conversas = function (param, vivo) {
    if (param) {
      titulo('Conversa');
      return api('viagem-detalhe', { id: param }).then(function (j) {
        if (!vivo()) return;
        titulo(j.viagem.nome);
        $('#conteudo').innerHTML = '<div id="chat-c"></div><p style="text-align:center;margin:10px 0 0"><a class="btn p" href="#/viagens/' + encodeURIComponent(param) + '">' + ic('aviao', 'p') + 'Abrir a viagem</a></p>';
        blocoChat($('#chat-c'), param);
      });
    }
    titulo('Conversas');
    return api('chat-conversas').then(function (j) {
      if (!vivo()) return;
      var l = j.conversas || [];
      $('#conteudo').innerHTML = '<div class="cabeca"><div class="t"><h2>Conversas</h2><p>Chat do app do passageiro, uma conversa por viagem. Outros canais (WhatsApp) entram quando forem integrados.</p><div class="linha-ouro"></div></div></div>' +
        '<section class="card"><div class="card-corpo">' + (l.length ? '<ul class="lista">' + l.map(function (c) {
          var u = c.ultimaMensagem;
          return '<li><a class="linha" href="#/conversas/' + encodeURIComponent(c.viagemId) + '"><span class="av' + (c.naoLidas ? '' : ' navy') + '">' + ic('conversa', 'p') + '</span><span class="meio"><b>' + esc(c.viagemNome) + '</b><small>' + (u ? (u.autor === 'agencia' ? 'Você: ' : '') + esc(u.texto) : 'Ainda sem mensagens') + '</small></span><span class="dir">' + (c.naoLidas ? '<span class="tag aprovada">' + c.naoLidas + ' nova(s)</span>' : '') + '<span>' + esc(u ? relativo(u.criado_em) : '') + '</span></span></a></li>';
        }).join('') + '</ul>' : vazio('conversa', 'Nenhuma conversa ainda', 'Crie uma viagem e envie o link do app ao passageiro.')) + '</div></section>';
    });
  };
  function blocoChat(el, vId) {
    el.innerHTML = '<div class="chat card"><div class="chat-msgs" id="msgs">' + carregando() + '</div><form class="chat-envio" id="f-chat"><textarea id="t-chat" rows="1" placeholder="Escreva para o passageiro…" aria-label="Mensagem"></textarea><button class="btn ouro so-icone" type="submit" aria-label="Enviar">' + ic('mandar') + '</button></form></div>';
    var msgs = $('#msgs', el), ultimas = '';
    function carregar(rolar) {
      return api('chat-listar', { v: vId }).then(function (j) {
        var l = j.mensagens || [];
        var assin = JSON.stringify(l.map(function (m) { return m.id; }));
        if (assin === ultimas) return;
        ultimas = assin;
        var perto = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80;
        msgs.innerHTML = l.length ? l.map(function (m) { return '<div class="bolha ' + (m.autor === 'agencia' ? 'nos' : 'eles') + '">' + esc(m.texto) + '<small>' + (m.autor === 'agencia' ? 'Agência' : 'Passageiro') + ' · ' + esc(dataHora(m.criado_em)) + '</small></div>'; }).join('') : vazio('conversa', 'Nenhuma mensagem ainda', 'Mande a primeira mensagem para o passageiro.');
        if (rolar || perto) msgs.scrollTop = msgs.scrollHeight;
      });
    }
    carregar(true).catch(function (e) { msgs.innerHTML = vazio('alerta', 'Erro ao abrir a conversa', e.message); });
    timers.push(setInterval(function () { carregar(false).catch(function () {}); }, 8000));
    var ta = $('#t-chat', el);
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#f-chat', el).requestSubmit(); } });
    $('#f-chat', el).addEventListener('submit', function (e) {
      e.preventDefault();
      var t = ta.value.trim(); if (!t) return;
      ta.value = '';
      api('chat-enviar', { v: vId, texto: t }).then(function () { return carregar(true); }).then(function () { buscarResumo().catch(function () {}); }).catch(function (er) { ta.value = t; aviso(er.message, true); });
    });
  }

  // ───────────────────────── Documentos ─────────────────────────
  function icoDoc(d) {
    var e = String(d.extensao || '').toLowerCase();
    var cls = /^(jpg|jpeg|png|webp|gif|heic)$/.test(e) ? 'img' : e;
    return '<span class="doc-ico ' + esc(cls) + '">' + esc(e.toUpperCase().slice(0, 4)) + '</span>';
  }
  function baixar(d, ver) {
    fetch('/api/vp-arquivos?id=' + encodeURIComponent(d.id) + (ver ? '&ver=1' : ''), { headers: { Authorization: 'Bearer ' + token() } }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || 'Não foi possível baixar.'); });
      return r.blob();
    }).then(function (b) {
      var url = URL.createObjectURL(b);
      if (ver) { window.open(url, '_blank', 'noopener'); }
      else { var a = document.createElement('a'); a.href = url; a.download = d.nome; document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }).catch(function (e) { aviso(e.message, true); });
  }
  function enviarArquivo(file, params, progresso) {
    return new Promise(function (resolve, reject) {
      if (file.size > 20 * 1024 * 1024) return reject(new Error(file.name + ': maior que 20 MB.'));
      var q = Object.keys(params).filter(function (k) { return params[k] != null && params[k] !== ''; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
      var x = new XMLHttpRequest();
      x.open('POST', '/api/vp-arquivos?acao=enviar&nome=' + encodeURIComponent(file.name) + '&' + q);
      x.setRequestHeader('Authorization', 'Bearer ' + token());
      x.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      x.upload.onprogress = function (e) { if (e.lengthComputable && progresso) progresso(e.loaded / e.total); };
      x.onload = function () { var j = {}; try { j = JSON.parse(x.responseText); } catch (e) { /* ok */ } if (x.status === 200) resolve(j.documento); else reject(new Error(file.name + ': ' + (j.error || (x.status === 404 ? 'documentos só funcionam na hospedagem Hostinger' : 'erro ' + x.status)))); };
      x.onerror = function () { reject(new Error(file.name + ': falha de conexão.')); };
      x.send(file);
    });
  }
  function linhaDoc(d, mostrarVinculo) {
    var vinc = '';
    if (mostrarVinculo && d.vinculo && d.vinculo.tipo !== 'geral') {
      var href = (d.vinculo.tipo === 'cliente' ? 'clientes/' : d.vinculo.tipo === 'cotacao' ? 'cotacoes/' : 'viagens/') + encodeURIComponent(d.vinculo.id);
      vinc = ' · <a href="#/' + href + '">' + ({ cliente: 'Cliente', cotacao: 'Cotação', viagem: 'Viagem' }[d.vinculo.tipo]) + '</a>';
    }
    var podeVer = /^(pdf|jpg|jpeg|png|webp|gif)$/.test(d.extensao);
    return '<li data-id="' + esc(d.id) + '"><div class="linha" style="flex-wrap:wrap">' + icoDoc(d) + '<span class="meio" style="min-width:160px"><b>' + esc(d.nome) + '</b><small>' + '<span class="tag cat">' + esc(CATEGORIAS[d.categoria] || d.categoria) + '</span> ' + tamanho(d.tamanho) + ' · ' + esc(dataHora(d.criado_em)) + (d.validade ? ' · vence ' + dataBR(d.validade) : '') + vinc + '</small></span>' +
      '<span class="acoes">' + (d.vinculo && d.vinculo.tipo === 'viagem' ? '<button class="btn p" data-a="vis" title="Visível no app do passageiro">' + ic(d.visivel_passageiro ? 'olho' : 'olho_off', 'p') + (d.visivel_passageiro ? 'Visível no app' : 'Só agência') + '</button>' : '') +
      (podeVer ? '<button class="btn p so-icone" data-a="ver" title="Abrir" aria-label="Abrir">' + ic('abrir', 'p') + '</button>' : '') +
      '<button class="btn p so-icone" data-a="baixar" title="Baixar" aria-label="Baixar">' + ic('baixar', 'p') + '</button><button class="btn p so-icone perigo" data-a="excluir" title="Excluir" aria-label="Excluir">' + ic('lixo', 'p') + '</button></span></div></li>';
  }
  function ligarListaDocs(lista, docs, recarregar) {
    lista.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a]'); if (!b) return;
      var d = docs().filter(function (x) { return x.id === b.closest('li').getAttribute('data-id'); })[0]; if (!d) return;
      var a = b.getAttribute('data-a');
      if (a === 'baixar') return baixar(d);
      if (a === 'ver') return baixar(d, true);
      if (a === 'vis') return arqApi({ acao: 'atualizar', id: d.id, visivel_passageiro: !d.visivel_passageiro }).then(function () { aviso(d.visivel_passageiro ? 'Documento oculto do passageiro.' : 'Documento liberado no app do passageiro.'); recarregar(); }).catch(function (er) { aviso(er.message, true); });
      if (a === 'excluir') confirmar('Excluir "' + d.nome + '"?', 'O arquivo será apagado do servidor. Não pode ser desfeito.', 'Excluir').then(function (s) { if (s) arqApi({ acao: 'excluir', id: d.id, confirmar: true }).then(function () { aviso('Documento excluído.'); recarregar(); }).catch(function (er) { aviso(er.message, true); }); });
    });
  }
  function zonaUpload(id) {
    return '<label class="solta" id="' + id + '" tabindex="0">' + ic('enviar_arq') + '<b>Arraste arquivos aqui ou toque para escolher</b><small>PDF, fotos, Excel, CSV, Word e PowerPoint · até 20 MB cada</small><input type="file" multiple class="sr" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.xls,.xlsx,.csv,.ods,.doc,.docx,.odt,.txt,.ppt,.pptx"></label><div id="' + id + '-prog"></div>';
  }
  function ligarUpload(zona, paramsFn, aoTerminar) {
    var input = $('input[type=file]', zona);
    var prog = $('#' + zona.id + '-prog');
    function enviarTodos(files) {
      files = [].slice.call(files || []); if (!files.length) return;
      var params = paramsFn(); if (!params) return;
      var feitos = 0;
      prog.innerHTML = files.map(function (f, i) { return '<div style="margin-top:10px;font-size:13px"><span>' + esc(f.name) + '</span><div class="progresso"><div id="pg-' + zona.id + '-' + i + '"></div></div></div>'; }).join('');
      var seq = Promise.resolve();
      files.forEach(function (f, i) {
        seq = seq.then(function () { return enviarArquivo(f, params, function (p) { var b = $('#pg-' + zona.id + '-' + i); if (b) b.style.width = Math.round(p * 100) + '%'; }).then(function () { feitos++; }, function (er) { aviso(er.message, true); }); });
      });
      seq.then(function () { prog.innerHTML = ''; input.value = ''; if (feitos) aviso(feitos + ' arquivo(s) enviado(s).'); aoTerminar(); });
    }
    input.addEventListener('change', function () { enviarTodos(input.files); });
    zona.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    ['dragenter', 'dragover'].forEach(function (ev) { zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.add('sobre'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.remove('sobre'); }); });
    zona.addEventListener('drop', function (e) { enviarTodos(e.dataTransfer.files); });
  }
  function blocoDocumentos(el, vTipo, vId) {
    var docs = [];
    el.innerHTML = '<section class="card"><div class="card-corpo"><div class="form duas" style="margin-bottom:12px"><div class="campo"><label>Categoria do próximo envio</label><select id="cat-' + vTipo + '">' + opcoes(CATEGORIAS, vTipo === 'viagem' ? 'voucher' : vTipo === 'cotacao' ? 'proposta' : 'outro') + '</select></div>' + (vTipo === 'viagem' ? '<label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" id="vis-' + vTipo + '">Já liberar no app do passageiro</label>' : '') + '</div>' + zonaUpload('up-' + vTipo) + '<ul class="lista" id="ld-' + vTipo + '" style="margin-top:12px"></ul></div></section>';
    var lista = $('#ld-' + vTipo, el);
    function carregar() {
      lista.innerHTML = '<li>' + carregando() + '</li>';
      arqApi({ acao: 'listar', vinculo_tipo: vTipo, vinculo_id: vId }).then(function (j) {
        docs = j.documentos || [];
        lista.innerHTML = docs.length ? docs.map(function (d) { return linhaDoc(d, false); }).join('') : '<li>' + vazio('pasta', 'Nenhum documento ainda', 'Envie contratos, vouchers, comprovantes, planilhas ou PDFs.') + '</li>';
      }).catch(function (e) { lista.innerHTML = '<li>' + vazio('alerta', 'Documentos indisponíveis', e.message) + '</li>'; });
    }
    ligarListaDocs(lista, function () { return docs; }, carregar);
    ligarUpload($('#up-' + vTipo, el), function () { var vis = $('#vis-' + vTipo, el); return { categoria: $('#cat-' + vTipo, el).value, vinculo_tipo: vTipo, vinculo_id: vId, visivel: vis && vis.checked ? '1' : '' }; }, carregar);
    carregar();
  }
  TELAS.documentos = function (_p, vivo) {
    titulo('Documentos');
    return Promise.all([arqApi({ acao: 'listar' }).catch(function (e) { return { erro: e.message }; }), api('cliente-listar'), api('cotacao-listar'), api('viagem-listar')]).then(function (rs) {
      if (!vivo()) return;
      var docs = rs[0].documentos || [];
      var cli = rs[1].clientes || [], cot = rs[2].cotacoes || [], via = rs[3].viagens || [];
      var filtro = 'todos';
      $('#conteudo').innerHTML = '<div class="cabeca"><div class="t"><h2>Documentos</h2><p>Contratos, vouchers, comprovantes, planilhas e arquivos de viagem — guardados com segurança no servidor.</p><div class="linha-ouro"></div></div></div>' +
        '<section class="card" style="margin-bottom:14px"><div class="card-corpo"><h3 class="secao-t">' + ic('enviar_arq', 'p') + 'Enviar arquivos</h3><div class="form tres" style="margin:12px 0">' +
          '<div class="campo"><label for="d-tipo">Pertence a</label><select id="d-tipo"><option value="geral">Agência (geral)</option><option value="cliente">Um cliente</option><option value="cotacao">Uma cotação</option><option value="viagem">Uma viagem</option></select></div>' +
          '<div class="campo"><label for="d-id">Qual</label><select id="d-id" disabled><option value="">—</option></select></div>' +
          '<div class="campo"><label for="d-cat">Categoria</label><select id="d-cat">' + opcoes(CATEGORIAS, 'outro') + '</select></div>' +
        '</div>' + zonaUpload('up-geral') + '</div></section>' +
        '<div class="chips">' + [['todos', 'Todos']].concat(Object.keys(CATEGORIAS).map(function (k) { return [k, CATEGORIAS[k]]; })).map(function (f) { var n = f[0] === 'todos' ? docs.length : docs.filter(function (d) { return d.categoria === f[0]; }).length; return (n || f[0] === 'todos') ? '<button class="chip' + (f[0] === filtro ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + '<span class="n">' + n + '</span></button>' : ''; }).join('') + '</div>' +
        '<section class="card"><div class="card-corpo"><ul class="lista" id="ld-todos"></ul></div></section>';
      var opc = {
        cliente: cli.map(function (c) { return [c.email, (c.nome || c.email) + ' — ' + c.email]; }),
        cotacao: cot.map(function (c) { return [c.id, (c.codigo || c.id) + ' — ' + c.nome + (c.destino ? ' · ' + c.destino : '')]; }),
        viagem: via.map(function (v) { return [v.id, v.nome + ' — ' + dataBR(v.datas && v.datas.inicio)]; }),
      };
      $('#d-tipo').addEventListener('change', function () {
        var t = this.value, s = $('#d-id');
        s.disabled = t === 'geral';
        s.innerHTML = t === 'geral' ? '<option value="">—</option>' : '<option value="">Escolha…</option>' + (opc[t] || []).map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('');
      });
      function render() {
        var l = docs.filter(function (d) { return filtro === 'todos' || d.categoria === filtro; });
        $('#ld-todos').innerHTML = rs[0].erro ? '<li>' + vazio('alerta', 'Documentos indisponíveis', rs[0].erro) + '</li>' : l.length ? l.map(function (d) { return linhaDoc(d, true); }).join('') : '<li>' + vazio('pasta', 'Nenhum documento', 'Envie o primeiro arquivo acima.') + '</li>';
      }
      $$('.chip[data-f]').forEach(function (b) { b.addEventListener('click', function () { $$('.chip[data-f]').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); filtro = b.getAttribute('data-f'); render(); }); });
      ligarListaDocs($('#ld-todos'), function () { return docs; }, navegar);
      ligarUpload($('#up-geral'), function () {
        var t = $('#d-tipo').value, idv = $('#d-id').value;
        if (t !== 'geral' && !idv) { aviso('Escolha a qual ' + ({ cliente: 'cliente', cotacao: 'cotação', viagem: 'viagem' }[t]) + ' o arquivo pertence.', true); return null; }
        return { vinculo_tipo: t, vinculo_id: idv, categoria: $('#d-cat').value };
      }, navegar);
      render();
    });
  };

  // ───────────────────────── Site e configurações ─────────────────────────
  TELAS.site = function (_p, vivo) {
    titulo('Site da agência');
    if (!vivo()) return;
    $('#conteudo').innerHTML = '<div class="cabeca"><div class="t"><h2>Site da agência</h2><p>Textos, destinos e fotos da página principal. As mudanças aparecem no site na hora.</p></div><div class="acoes"><a class="btn p" target="_blank" rel="noopener" href="/viajante-pro">' + ic('abrir', 'p') + 'Ver o site</a></div></div><iframe class="iframe-site" src="/viajante-pro/editar" title="Editor do site"></iframe>';
  };
  TELAS.config = function (_p, vivo) {
    titulo('Configurações');
    return fetch('/saude', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (s) {
      if (!vivo()) return;
      $('#conteudo').innerHTML = '<div class="cabeca"><div class="t"><h2>Configurações</h2><p>Acesso e informações do sistema.</p><div class="linha-ouro"></div></div></div><div class="grade g2i">' +
        '<section class="card"><div class="card-corpo"><h3 class="secao-t">' + ic('cadeado', 'p') + 'Trocar a senha da agência</h3><p style="color:var(--texto-2);font-size:13.5px;margin:6px 0 12px">Depois de trocar, a senha inicial deixa de funcionar. Use pelo menos 8 caracteres.</p><form id="f-senha" class="form"><div class="campo"><label for="s1">Nova senha</label><input id="s1" type="password" autocomplete="new-password" minlength="8" required></div><div class="campo"><label for="s2">Repita a nova senha</label><input id="s2" type="password" autocomplete="new-password" minlength="8" required></div><button class="btn ouro" type="submit" id="b-senha">' + ic('ok', 'p') + 'Trocar senha</button></form></div></section>' +
        '<section class="card"><div class="card-corpo"><h3 class="secao-t">' + ic('escudo', 'p') + 'Sistema</h3><ul class="lista" style="margin-top:8px">' +
          '<li><div class="linha"><span class="meio"><b>Banco de dados</b><small>' + (s ? (s.banco === 'ok' ? 'Funcionando (' + esc(s.driver) + ')' : 'Com problema') : 'Informação disponível na hospedagem Hostinger') + '</small></span>' + (s && s.banco === 'ok' ? '<span class="tag aprovada">OK</span>' : '') + '</div></li>' +
          '<li><div class="linha"><span class="meio"><b>Backup</b><small>Backup diário automático da Hostinger (banco e arquivos)</small></span></div></li>' +
          '<li><div class="linha"><span class="meio"><b>Sessão</b><small>Vale 30 dias neste aparelho. Use "Sair" em computadores compartilhados.</small></span></div></li>' +
          '<li><a class="linha" href="/viajante-pro/painel-classico"><span class="meio"><b>Painel clássico</b><small>A versão anterior do painel continua disponível</small></span>' + ic('seta', 'p') + '</a></li>' +
        '</ul></div></section></div>';
      $('#f-senha').addEventListener('submit', function (e) {
        e.preventDefault();
        if ($('#s1').value !== $('#s2').value) return aviso('As senhas não são iguais.', true);
        var b = $('#b-senha'); ocupado(b, true);
        api('trocar-senha', { senha_nova: $('#s1').value }).then(function () { aviso('Senha trocada. Use a nova senha nos próximos acessos.'); $('#f-senha').reset(); }).catch(function (er) { aviso(er.message, true); }).then(function () { ocupado(b, false); });
      });
    });
  };

  // ───────────────────────── Início ─────────────────────────
  function iniciarApp() {
    $('#tela-login').classList.add('oculto');
    $('#app').classList.remove('oculto');
    try { if (localStorage.getItem('vp_menu_recolhido') && innerWidth >= 1100) { $('#menu').classList.add('recolhido'); $('#app').classList.add('menu-recolhido'); } } catch (e) { /* ok */ }
    pilha = [];
    navegar();
    if (rotaAtual().split('/')[0] !== 'dashboard') buscarResumo().catch(function () {});
    clearInterval(iniciarApp.t);
    iniciarApp.t = setInterval(function () { if (token() && !document.hidden) buscarResumo().catch(function () {}); }, 60000);
  }
  pintarIcones();
  if (token()) iniciarApp(); else mostrarLogin();
})();
