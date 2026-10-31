// Viajante Pro — App do Viajante (IndexedDB, PWA Offline, Multi-Telas)
'use strict';

(function () {
  var DB_NAME = 'viajante-pro-db';
  var DB_VERSION = 1;
  var STORE_NAME = 'viagem_store';
  var abaAtual = 'hoje';
  var dadosViagem = null;

  // Registrar Service Worker com escopo explícito
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/viajante-pro/app/sw.js', { scope: '/viajante-pro/app/' }).catch(function (e) {
        console.warn('Falha ao registrar SW:', e);
      });
    });
  }

  // Monitorar Estado de Conexão
  function atualizarStatusRede() {
    var badge = document.getElementById('badge-status-rede');
    if (badge) {
      if (navigator.onLine) {
        badge.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500';
        badge.title = 'Online';
      } else {
        badge.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse';
        badge.title = 'Offline (exibindo cópia guardada)';
      }
    }
  }

  window.addEventListener('online', atualizarStatusRede);
  window.addEventListener('offline', atualizarStatusRede);

  // Manipulação de IndexedDB
  function abrirDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  function salvarNoIndexedDB(chave, valor) {
    return abrirDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var req = store.put(valor, chave);
        req.onsuccess = function () { resolve(); };
        req.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  function obterDoIndexedDB(chave) {
    return abrirDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.get(chave);
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  // Buscar Viagem da API
  function buscarViagem(token) {
    return fetch('/api/viajante-pro?site=viajantepro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'app-viagem', v: token })
    }).then(function (res) {
      if (res.status === 404) {
        var err = new Error('link_invalido');
        err.codigo = 404;
        err.mensagem = 'link_invalido';
        throw err;
      }
      if (!res.ok) {
        var errHttp = new Error('Erro HTTP: ' + res.status);
        errHttp.codigo = res.status;
        errHttp.mensagem = 'erro_http';
        throw errHttp;
      }
      return res.json().then(function (json) {
        // O service worker devolve {offline:true} (status 200) quando não há rede: isso NÃO é uma viagem.
        if (json && json.offline === true) {
          var errOff = new Error('sem_rede');
          errOff.codigo = 0;
          errOff.mensagem = 'sem_rede';
          throw errOff;
        }
        return json;
      });
    });
  }

  // Converter resposta para o formato esperado por renderizarTela
  function converter(resposta) {
    var raw = resposta.viagem || resposta || {};
    var agora = new Date();
    var horaFormatada = ('0' + agora.getHours()).slice(-2) + ':' + ('0' + agora.getMinutes()).slice(-2);

    return {
      token: raw.token || '',
      atualizado_em: horaFormatada,
      passageiro: raw.passageiro || '',
      destino: raw.destino || '',
      data_inicio: raw.data_inicio || '',
      data_fim: raw.data_fim || '',
      status_viagem: raw.status_viagem || 'antes',
      alerta_imprevisto: raw.alerta_imprevisto || null,
      hoje: raw.hoje || {},
      voos: raw.voos || [],
      roteiro: raw.roteiro || [],
      hotel_carro: raw.hotel_carro || {},
      documentos: raw.documentos || [],
      motorista: raw.motorista || {},
      emergencia: raw.emergencia || {}
    };
  }

  // Navegação
  window.navegarAba = function (aba) {
    abaAtual = aba;
    var botoes = document.querySelectorAll('.nav-btn');
    botoes.forEach(function (btn) {
      if (btn.id === 'tab-' + aba) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    renderizarTela();
  };

  // Copiar para área de transferência
  window.copiarTexto = function (texto, idBtn) {
    navigator.clipboard.writeText(texto).then(function () {
      var btn = document.getElementById(idBtn);
      if (btn) {
        var orig = btn.innerText;
        btn.innerText = 'Copiado!';
        setTimeout(function () { btn.innerText = orig; }, 2000);
      }
    });
  };

  // Renderizadores de Telas
  function renderizarHoje() {
    var h = dadosViagem.hoje || {};
    var html = '';

    // Alerta em Vermelho se houver imprevisto
    if (dadosViagem.alerta_imprevisto && dadosViagem.alerta_imprevisto.ativo) {
      html += '<div class="mb-4 p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-start space-x-2 shadow-lg animate-pulse">' +
        '<span class="text-base">⚠️</span>' +
        '<div>' +
          '<strong class="block text-red-400 font-bold uppercase tracking-wider text-[11px]">Aviso de Voo / Operação</strong>' +
          '<span>' + dadosViagem.alerta_imprevisto.mensagem + '</span>' +
        '</div>' +
      '</div>';
    }

    if (dadosViagem.status_viagem === 'antes') {
      html += '<div class="bg-brand-card p-6 rounded-2xl border border-white/10 text-center space-y-3">' +
        '<div class="text-3xl">✈️</div>' +
        '<h2 class="text-lg font-bold text-white">Sua viagem para ' + dadosViagem.destino + ' está chegando!</h2>' +
        '<p class="text-xs text-brand-muted">Faltam poucos dias para o embarque. Acompanhe os detalhes nas abas acima.</p>' +
        '<div class="inline-block bg-brand-accent/10 border border-brand-accent/30 text-brand-accent px-4 py-2 rounded-xl text-xs font-semibold">' +
          'Data do Embarque: ' + dadosViagem.data_inicio +
        '</div>' +
      '</div>';
    } else {
      html += '<div class="space-y-4">' +
        '<div class="flex justify-between items-center bg-brand-card p-4 rounded-xl border border-white/10">' +
          '<div>' +
            '<span class="text-[10px] text-brand-accent font-bold uppercase tracking-widest">Dia ' + (h.dia_numero || 1) + ' da Viagem</span>' +
            '<h2 class="text-base font-bold text-white">' + dadosViagem.destino + '</h2>' +
          '</div>' +
          '<span class="text-xs bg-white/10 px-2.5 py-1 rounded-lg font-mono text-brand-muted">' + (h.data || '') + '</span>' +
        '</div>' +

        '<h3 class="text-xs font-bold uppercase tracking-wider text-brand-muted px-1">Linha do Tempo de Hoje</h3>' +
        '<div class="relative border-l-2 border-brand-accent/30 ml-3 space-y-4 pl-4 py-1">';

      var eventos = h.eventos || [];
      eventos.forEach(function (ev) {
        html += '<div class="relative group">' +
          '<div class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-brand-accent shadow-[0_0_8px_#00E5FF]"></div>' +
          '<div class="bg-brand-card p-3 rounded-xl border border-white/5 space-y-1">' +
            '<div class="flex justify-between items-center text-xs">' +
              '<span class="font-mono text-brand-accent font-semibold">' + ev.hora + '</span>' +
              '<span class="text-[10px] bg-white/5 text-brand-muted px-2 py-0.5 rounded capitalize">' + ev.tipo + '</span>' +
            '</div>' +
            '<div class="text-xs font-medium text-white">' + ev.titulo + '</div>' +
            (ev.endereco ? '<div class="text-[11px] text-brand-muted truncate">' + ev.endereco + '</div>' : '') +
          '</div>' +
        '</div>';
      });

      html += '</div></div>';
    }

    return html;
  }

  function renderizarVoos() {
    var voos = dadosViagem.voos || [];
    var html = '<div class="space-y-4">';
    voos.forEach(function (v, idx) {
      html += '<div class="bg-brand-card p-4 rounded-2xl border border-white/10 space-y-3 shadow-sm">' +
        '<div class="flex justify-between items-center border-b border-white/10 pb-2">' +
          '<div class="flex items-center space-x-2">' +
            '<span class="text-sm">✈️</span>' +
            '<div>' +
              '<div class="font-bold text-xs text-white">' + v.cia + ' — ' + v.numero + '</div>' +
              '<div class="text-[10px] text-brand-muted">' + v.data + '</div>' +
            '</div>' +
          '</div>' +
          '<span class="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">' + v.status + '</span>' +
        '</div>' +

        '<div class="grid grid-cols-2 gap-2 text-xs py-1">' +
          '<div class="bg-white/5 p-2 rounded-lg">' +
            '<span class="text-[10px] text-brand-muted block">De</span>' +
            '<strong class="text-white">' + v.origem + '</strong>' +
            '<span class="block text-[11px] text-brand-accent mt-0.5">' + v.horario_partida + '</span>' +
          '</div>' +
          '<div class="bg-white/5 p-2 rounded-lg">' +
            '<span class="text-[10px] text-brand-muted block">Para</span>' +
            '<strong class="text-white">' + v.destino + '</strong>' +
            '<span class="block text-[11px] text-brand-accent mt-0.5">' + v.horario_chegada + '</span>' +
          '</div>' +
        '</div>' +

        '<div class="grid grid-cols-3 gap-2 text-center text-[11px] bg-white/5 p-2 rounded-lg">' +
          '<div><span class="text-brand-muted block text-[10px]">Terminal</span><strong class="text-white">' + v.terminal + '</strong></div>' +
          '<div><span class="text-brand-muted block text-[10px]">Portão</span><strong class="text-white">' + v.portao + '</strong></div>' +
          '<div><span class="text-brand-muted block text-[10px]">Assento</span><strong class="text-white">' + v.assento + '</strong></div>' +
        '</div>' +

        '<div class="space-y-1 text-xs text-brand-muted pt-1">' +
          '<div>🧳 <strong>Mão:</strong> ' + v.bagagem_mao + '</div>' +
          '<div>🧳 <strong>Despachada:</strong> ' + v.bagagem_despachada + '</div>' +
        '</div>' +

        (v.aviso_checkin ? '<div class="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-300 p-2 rounded-lg">⏰ ' + v.aviso_checkin + '</div>' : '') +

        '<div class="pt-2 flex items-center justify-between space-x-2 border-t border-white/5">' +
          '<div class="flex items-center space-x-1 text-xs">' +
            '<span class="text-brand-muted text-[10px]">LOC:</span>' +
            '<strong class="text-brand-accent font-mono">' + v.localizador + '</strong>' +
            '<button id="btn-loc-' + idx + '" onclick="copiarTexto(\'' + v.localizador + '\', \'btn-loc-' + idx + '\')" class="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white hover:bg-white/20">Copiar</button>' +
          '</div>' +
          (v.link_checkin ? '<a href="' + v.link_checkin + '" target="_blank" class="bg-brand-accent text-brand-dark px-3 py-1.5 rounded-xl text-xs font-bold hover:brightness-110">Fazer Check-in</a>' : '') +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderizarRoteiro() {
    var roteiro = dadosViagem.roteiro || [];
    var html = '<div class="space-y-3">';
    roteiro.forEach(function (item) {
      var mapaUrl = 'https://maps.google.com/?q=' + encodeURIComponent(item.endereco || item.titulo);
      html += '<div class="bg-brand-card p-4 rounded-xl border border-white/10 space-y-2">' +
        '<div class="flex justify-between items-start">' +
          '<div>' +
            '<span class="text-[10px] bg-brand-accent/20 text-brand-accent px-2 py-0.5 rounded font-bold">Dia ' + item.dia + ' (' + item.data + ')</span>' +
            '<h3 class="text-sm font-bold text-white mt-1">' + item.titulo + '</h3>' +
          '</div>' +
        '</div>' +
        '<p class="text-xs text-brand-muted">' + item.descricao + '</p>' +
        (item.endereco ? '<div class="text-[11px] text-white/80 bg-white/5 p-2 rounded-lg flex justify-between items-center space-x-2">' +
          '<span class="truncate">📍 ' + item.endereco + '</span>' +
          '<a href="' + mapaUrl + '" target="_blank" class="bg-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-brand-dark text-[10px] font-bold px-2 py-1 rounded transition-colors whitespace-nowrap">Abrir no Mapa</a>' +
        '</div>' : '') +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderizarHotelCarro() {
    var hc = dadosViagem.hotel_carro || {};
    var h = hc.hotel || {};
    var c = hc.carro || {};
    var mapaHotel = 'https://maps.google.com/?q=' + encodeURIComponent(h.endereco || h.nome);

    var html = '<div class="space-y-4">' +
      // Hotel
      '<div class="bg-brand-card p-4 rounded-2xl border border-white/10 space-y-3">' +
        '<div class="flex justify-between items-center border-b border-white/10 pb-2">' +
          '<div class="font-bold text-sm text-white flex items-center space-x-1"><span>🏨</span><span>Hotel</span></div>' +
          '<span class="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono">Voucher: ' + (h.voucher || '-') + '</span>' +
        '</div>' +
        '<div class="text-xs space-y-1">' +
          '<div class="font-bold text-white text-sm">' + (h.nome || 'Não informado') + '</div>' +
          '<div class="text-brand-muted">📍 ' + (h.endereco || '') + '</div>' +
          '<div class="text-brand-muted">📞 ' + (h.telefone || '') + '</div>' +
        '</div>' +
        '<div class="grid grid-cols-2 gap-2 text-center text-[11px] bg-white/5 p-2 rounded-lg">' +
          '<div><span class="text-brand-muted block text-[10px]">Check-in</span><strong class="text-white">' + (h.checkin || '-') + '</strong></div>' +
          '<div><span class="text-brand-muted block text-[10px]">Check-out</span><strong class="text-white">' + (h.checkout || '-') + '</strong></div>' +
        '</div>' +
        '<a href="' + mapaHotel + '" target="_blank" class="block text-center bg-white/10 hover:bg-white/20 text-white text-xs py-2 rounded-xl font-medium">Ver Hotel no Mapa</a>' +
      '</div>' +

      // Carro
      '<div class="bg-brand-card p-4 rounded-2xl border border-white/10 space-y-3">' +
        '<div class="flex justify-between items-center border-b border-white/10 pb-2">' +
          '<div class="font-bold text-sm text-white flex items-center space-x-1"><span>🚗</span><span>Aluguel de Carro</span></div>' +
          '<span class="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono">Voucher: ' + (c.voucher || '-') + '</span>' +
        '</div>' +
        '<div class="text-xs space-y-1">' +
          '<div class="font-bold text-white text-sm">' + (c.empresa || 'Sem aluguel') + ' — ' + (c.modelo || '') + '</div>' +
          '<div class="text-brand-muted">📍 Retirada: ' + (c.retirada || '-') + '</div>' +
          '<div class="text-brand-muted">📍 Devolução: ' + (c.devolucao || '-') + '</div>' +
          '<div class="text-brand-muted">📞 Central: ' + (c.telefone || '-') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    return html;
  }

  function renderizarDocumentos() {
    var docs = dadosViagem.documentos || [];
    var html = '<div class="space-y-3">';
    docs.forEach(function (d) {
      html += '<div class="bg-brand-card p-4 rounded-xl border border-white/10 flex justify-between items-center">' +
        '<div>' +
          '<span class="text-[10px] bg-brand-accent/20 text-brand-accent px-2 py-0.5 rounded font-semibold uppercase">' + d.tipo + '</span>' +
          '<h3 class="text-xs font-bold text-white mt-1">' + d.titulo + '</h3>' +
          '<span class="text-[10px] text-brand-muted block font-mono">Código: ' + d.codigo + '</span>' +
        '</div>' +
        '<button onclick="alert(\'Documento disponível para consulta offline.\')" class="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-xs font-medium">Visualizar</button>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderizarMotorista() {
    var m = dadosViagem.motorista || {};
    var html = '<div class="bg-brand-card p-6 rounded-2xl border-2 border-brand-accent/50 text-center space-y-4 shadow-xl">' +
      '<div class="inline-block bg-brand-accent/20 text-brand-accent p-3 rounded-full text-2xl">🚕</div>' +
      '<div>' +
        '<span class="text-xs text-brand-accent font-bold uppercase tracking-widest block">Mostre ao Motorista / Taxista</span>' +
        '<h2 class="text-2xl font-black text-white mt-2 leading-tight">' + (m.hotel_nome || 'Hotel') + '</h2>' +
      '</div>' +

      '<div class="bg-black/40 p-4 rounded-xl border border-white/10 space-y-2">' +
        '<span class="text-[11px] text-brand-muted block uppercase tracking-wider font-semibold">Endereço Completo:</span>' +
        '<div class="text-lg font-bold text-yellow-300 leading-snug break-words">' + (m.hotel_endereco || 'Endereço não disponível') + '</div>' +
      '</div>' +

      (m.instrucoes_idioma_local ?
        '<div class="bg-white/5 p-3 rounded-xl text-xs italic text-brand-muted border border-white/5">' +
          '“' + m.instrucoes_idioma_local + '”' +
        '</div>' : '') +

      '<div class="text-[10px] text-emerald-400 bg-emerald-500/10 py-1.5 px-3 rounded-full inline-block">✓ Funciona Offline sem internet</div>' +
    '</div>';

    return html;
  }

  function renderizarEmergencia() {
    var e = dadosViagem.emergencia || {};
    var html = '<div class="space-y-3">' +
      '<div class="bg-red-950/40 border border-red-500/30 p-4 rounded-2xl space-y-3">' +
        '<h2 class="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center space-x-1"><span>🚨</span><span>Contatos de Emergência 24h</span></h2>' +

        '<div class="bg-black/30 p-3 rounded-xl space-y-2 text-xs">' +
          '<div class="flex justify-between items-center border-b border-white/5 pb-1.5">' +
            '<span class="text-brand-muted">Viajante Pro (24h):</span>' +
            '<a href="tel:' + e.atendimento_vp_24h + '" class="font-bold text-brand-accent text-sm">' + (e.atendimento_vp_24h || '-') + '</a>' +
          '</div>' +

          '<div class="flex justify-between items-center border-b border-white/5 pb-1.5">' +
            '<span class="text-brand-muted">Emergência Local (País):</span>' +
            '<a href="tel:' + e.emergencia_pais + '" class="font-bold text-red-400 text-sm">' + (e.emergencia_pais || '-') + '</a>' +
          '</div>' +

          '<div class="flex justify-between items-center border-b border-white/5 pb-1.5">' +
            '<span class="text-brand-muted">Consulado do Brasil:</span>' +
            '<a href="tel:' + e.consulado_brasil + '" class="font-bold text-white text-sm">' + (e.consulado_brasil || '-') + '</a>' +
          '</div>' +

          '<div class="flex justify-between items-center pt-0.5">' +
            '<span class="text-brand-muted">Seguro Viagem:</span>' +
            '<a href="tel:' + e.seguro_viagem + '" class="font-bold text-cyan-300 text-sm">' + (e.seguro_viagem || '-') + '</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    return html;
  }

  function mostrarMensagem(texto) {
    var container = document.getElementById('app-conteudo');
    if (container) {
      container.innerHTML = '<div class="bg-brand-card p-6 rounded-2xl border border-white/10 text-center space-y-3">' +
        '<div class="text-3xl">ℹ️</div>' +
        '<p class="text-xs text-brand-muted">' + texto + '</p>' +
      '</div>';
    }
    var carimboEl = document.getElementById('carimbo-atualizacao');
    if (carimboEl) {
      carimboEl.innerText = '';
    }
  }

  function renderizarTela() {
    var container = document.getElementById('app-conteudo');
    if (!container || !dadosViagem) return;

    var carimboEl = document.getElementById('carimbo-atualizacao');
    if (carimboEl) {
      carimboEl.innerText = 'Atualizado às ' + (dadosViagem.atualizado_em || '12:00');
    }

    switch (abaAtual) {
      case 'hoje': container.innerHTML = renderizarHoje(); break;
      case 'voos': container.innerHTML = renderizarVoos(); break;
      case 'roteiro': container.innerHTML = renderizarRoteiro(); break;
      case 'hotel-carro': container.innerHTML = renderizarHotelCarro(); break;
      case 'documentos': container.innerHTML = renderizarDocumentos(); break;
      case 'motorista': container.innerHTML = renderizarMotorista(); break;
      case 'emergencia': container.innerHTML = renderizarEmergencia(); break;
      default: container.innerHTML = renderizarHoje(); break;
    }
  }

  // Inicialização
  function inicializar() {
    atualizarStatusRede();

    var params = new URLSearchParams(window.location.search);
    var tokenUrl = params.get('t');
    
    if (tokenUrl) {
      localStorage.setItem('vp_token', tokenUrl);
    }

    var token = localStorage.getItem('vp_token') || tokenUrl;

    if (!token) {
      dadosViagem = null;
      mostrarMensagem('Abra o link que a Viajante Pro enviou para você.');
      return;
    }

    buscarViagem(token).then(function (res) {
      dadosViagem = converter(res);
      dadosViagem.token = token;
      salvarNoIndexedDB('viagem_ativa', dadosViagem).catch(function () {});
      renderizarTela();
    }).catch(function (err) {
      if (err && err.codigo === 404) {
        localStorage.removeItem('vp_token');
        salvarNoIndexedDB('viagem_ativa', null).catch(function () {});
        dadosViagem = null;
        mostrarMensagem('Link inválido ou vencido. Peça um novo à Viajante Pro.');
        return;
      }

      // Falha de rede/servidor (exceto 404) -> tentar ler cópia do IndexedDB se o token for o mesmo
      obterDoIndexedDB('viagem_ativa').then(function (dadosSalvos) {
        if (dadosSalvos && dadosSalvos.token === token) {
          dadosViagem = dadosSalvos;
          renderizarTela();
          var carimboEl = document.getElementById('carimbo-atualizacao');
          if (carimboEl) {
            carimboEl.innerText = 'atualizado às ' + (dadosViagem.atualizado_em || '12:00');
          }
        } else {
          dadosViagem = null;
          mostrarMensagem('Sem internet e sem cópia salva. Tente de novo com internet.');
        }
      }).catch(function () {
        dadosViagem = null;
        mostrarMensagem('Sem internet e sem cópia salva. Tente de novo com internet.');
      });
    });

    // Evento de Botão de Conversa
    var btnChat = document.getElementById('btn-conversa');
    if (btnChat) {
      btnChat.addEventListener('click', function () {
        alert('Atendimento Viajante Pro: iniciando conversa com consultor...');
      });
    }
  }

  window.addEventListener('DOMContentLoaded', inicializar);
})();
