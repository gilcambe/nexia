// Viajante Pro — funções puras do app do viajante (testadas em Node: tests/unit/viajantepro-app.test.js).
(function (raiz) {
  'use strict';

  const dia = iso => String(iso || '').slice(0, 10);
  const soDigitos = v => String(v || '').replace(/\D/g, '');

  // Quantos dias faltam de hoje (AAAA-MM-DD) até a data (negativo = já passou).
  function diasAte(hoje, data) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia(data))) return null;
    return Math.round((Date.parse(dia(data)) - Date.parse(dia(hoje))) / 86400000);
  }

  // Em que fase a viagem está: antes, durante ou depois.
  function fase(viagem, hoje) {
    const ate = diasAte(hoje, viagem.data_saida);
    const volta = diasAte(hoje, viagem.data_retorno || viagem.data_saida);
    if (ate !== null && ate > 0) return { fase: 'antes', dias: ate };
    if (volta !== null && volta < 0) return { fase: 'depois', dias: -volta };
    return { fase: 'durante', dias: 0 };
  }

  // Tudo o que acontece num dia, em ordem de hora (voos, transfers, check-in, passeios).
  function eventosDoDia(viagem, data) {
    const d = dia(data);
    const ev = [];
    (viagem.voos || []).forEach(v => { if (dia(v.data) === d) ev.push({ hora: v.partida || '', tipo: 'voo', titulo: `Voo ${v.cia || ''} ${v.numero || ''} ${v.trecho || ''}`.replace(/\s+/g, ' ').trim(), detalhe: [v.terminal && `Terminal ${v.terminal}`, v.portao && `Portão ${v.portao}`].filter(Boolean).join(' · '), alerta: alertaVoo(v) }); });
    (viagem.transfers || []).forEach(t => { if (dia(t.data) === d) ev.push({ hora: t.hora || '', tipo: 'transfer', titulo: `Transfer: ${t.de || ''} → ${t.para || ''}`, detalhe: [t.motorista, t.telefone].filter(Boolean).join(' · ') }); });
    (viagem.hoteis || []).forEach(h => {
      if (dia(h.checkin) === d) ev.push({ hora: h.checkin_hora || '', tipo: 'hotel', titulo: `Check-in: ${h.nome || 'hotel'}`, detalhe: h.endereco || '' });
      if (dia(h.checkout) === d) ev.push({ hora: h.checkout_hora || '', tipo: 'hotel', titulo: `Check-out: ${h.nome || 'hotel'}`, detalhe: '' });
    });
    (viagem.carros || []).forEach(c => { if (dia(c.retirada) === d) ev.push({ hora: c.retirada_hora || '', tipo: 'carro', titulo: `Retirar carro: ${c.locadora || ''}`, detalhe: c.endereco || '' }); });
    (viagem.roteiro || []).forEach(r => { if (dia(r.data) === d) (r.itens || []).forEach(i => ev.push({ hora: i.hora || '', tipo: 'passeio', titulo: i.titulo || '', detalhe: i.endereco || '' })); });
    return ev.sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99'));
  }

  // Aviso grande em vermelho: voo atrasado, cancelado ou com portão trocado.
  function alertaVoo(v) {
    const s = String(v.status || '').toLowerCase();
    if (/cancel/.test(s)) return 'VOO CANCELADO';
    if (/atras/.test(s)) return 'VOO ATRASADO' + (v.nova_partida ? ` — nova saída ${v.nova_partida}` : '');
    if (/port/.test(s)) return 'PORTÃO TROCADO' + (v.portao ? ` — agora portão ${v.portao}` : '');
    return '';
  }
  const alertas = viagem => (viagem.voos || []).map(v => ({ voo: v, texto: alertaVoo(v) })).filter(a => a.texto);

  // Check-in online abre 24h/48h antes: devolve o aviso para o voo, se for hora.
  function avisoCheckin(voo, agoraMs) {
    if (!voo.data) return '';
    const saida = Date.parse(`${dia(voo.data)}T${/^\d{2}:\d{2}$/.test(voo.partida || '') ? voo.partida : '00:00'}:00`);
    const horas = (saida - agoraMs) / 3600000;
    const abre = Number(voo.checkin_horas) || 48;
    if (horas > 0 && horas <= abre) return 'Check-in aberto: faça agora';
    if (horas > abre && horas <= abre + 24) return `Check-in abre ${abre}h antes do voo`;
    return '';
  }

  function linkMapa(endereco) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(endereco || ''); }
  function linkSMS(numero, texto) { return `sms:+${soDigitos(numero)}?body=${encodeURIComponent(texto || '')}`; }
  function linkWhats(numero, texto) { return `https://wa.me/${soDigitos(numero)}?text=${encodeURIComponent(texto || '')}`; }

  function mensagemSOS(nome, titulo, lat, lon) {
    const onde = (typeof lat === 'number' && typeof lon === 'number') ? `estou em https://maps.google.com/?q=${lat.toFixed(6)},${lon.toFixed(6)}` : 'não consegui pegar o GPS';
    return `SOS Viajante Pro - ${nome || 'viajante'} - ${titulo || 'viagem'} - ${onde}`;
  }

  // ── Fila de mensagens sem internet ──
  // Cada mensagem tem id_local único; a API ignora repetidas, então reenviar nunca duplica.
  function novaMensagem(fila, texto, agoraMs, aleatorio) {
    const item = { id_local: `m${agoraMs.toString(36)}${aleatorio || Math.random().toString(36).slice(2, 8)}`, texto: String(texto || '').trim(), criado_em: new Date(agoraMs).toISOString(), estado: 'fila' };
    return { fila: [...fila, item], item };
  }

  // Tenta mandar tudo o que está na fila, uma de cada vez e na ordem. Para no primeiro erro de rede.
  async function enviarFila(fila, enviar) {
    const restante = [...fila];
    const enviadas = [];
    while (restante.length) {
      const m = restante[0];
      try { await enviar(m); } catch (e) { break; }
      enviadas.push({ ...m, estado: 'chegou' });
      restante.shift();
    }
    return { fila: restante, enviadas };
  }

  // Junta as mensagens do servidor com as que ainda estão na fila do aparelho.
  function juntarConversa(doServidor, fila) {
    const ids = new Set((doServidor || []).map(m => m.id_local));
    const pend = (fila || []).filter(m => !ids.has(m.id_local)).map(m => ({ ...m, de: 'cliente', pendente: true }));
    return [...(doServidor || []), ...pend];
  }

  const api = { diasAte, fase, eventosDoDia, alertaVoo, alertas, avisoCheckin, linkMapa, linkSMS, linkWhats, mensagemSOS, novaMensagem, enviarFila, juntarConversa };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.VP = api;
})(typeof self !== 'undefined' ? self : this);
