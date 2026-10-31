// Viajante Pro — funções puras do painel (testadas em Node: tests/unit/viajantepro-painel.test.js).
(function (raiz) {
  'use strict';
  const dia = s => String(s || '').slice(0, 10);
  const diasEntre = (a, b) => Math.round((Date.parse(dia(b)) - Date.parse(dia(a))) / 86400000);

  function linkApp(origem, token) { return `${String(origem).replace(/\/$/, '')}/app/?t=${token}`; }
  function linkWhatsApp(numero, nome, link) {
    const txt = `Olá${nome ? ' ' + nome : ''}! Aqui está o app da sua viagem com a Viajante Pro. Abra pelo link (não precisa instalar nem senha): ${link}`;
    return `https://wa.me/${String(numero || '').replace(/\D/g, '')}?text=${encodeURIComponent(txt)}`;
  }

  // O que ainda falta numa viagem antes do embarque.
  function pendencias(v) {
    const p = [];
    const docs = (v.documentos || []).map(d => String(d.titulo || '').toLowerCase()).join(' ');
    if (!(v.voos || []).length) p.push('voos');
    if (!(v.hoteis || []).length) p.push('hotel');
    if (!/seguro/.test(docs)) p.push('seguro');
    if (!/passaporte|rg|identidade/.test(docs) && (v.pendencias || {}).passaporte !== true) p.push('passaporte/documento');
    if ((v.voos || []).some(x => !x.localizador)) p.push('localizador do voo');
    if (!(v.emergencia || {}).telefone_24h) p.push('telefone 24h');
    if ((v.pendencias || {}).pagamento === false) p.push('pagamento');
    return p;
  }

  function proximas(viagens, hoje, dias = 30) {
    return (viagens || []).filter(v => { const d = diasEntre(hoje, v.data_saida); return d >= 0 && d <= dias; })
      .sort((a, b) => dia(a.data_saida).localeCompare(dia(b.data_saida)));
  }
  const viajandoAgora = (viagens, hoje) => (viagens || []).filter(v => dia(v.data_saida) <= dia(hoje) && dia(v.data_retorno || v.data_saida) >= dia(hoje));
  const embarcamHoje = (viagens, hoje) => (viagens || []).filter(v => dia(v.data_saida) === dia(hoje));
  const voltamHoje = (viagens, hoje) => (viagens || []).filter(v => dia(v.data_retorno) === dia(hoje));
  const voosComProblema = viagens => (viagens || []).flatMap(v => (v.voos || []).filter(x => /atras|cancel|port/i.test(x.status || '')).map(x => ({ viagem: v, voo: x })));

  // Roteiro em texto simples: linha "AAAA-MM-DD Título" abre um dia; "10:00 | Passeio | endereço" é item do dia.
  function roteiroDeTexto(txt) {
    const dias = [];
    String(txt || '').split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
      const m = l.match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/);
      if (m) { dias.push({ data: m[1], titulo: m[2] || '', itens: [] }); return; }
      if (!dias.length) dias.push({ data: '', titulo: '', itens: [] });
      const [hora, titulo, endereco] = l.split('|').map(s => s.trim());
      if (titulo === undefined) dias[dias.length - 1].itens.push({ hora: '', titulo: hora, endereco: '' });
      else dias[dias.length - 1].itens.push({ hora, titulo, endereco: endereco || '' });
    });
    return dias;
  }
  function roteiroParaTexto(r) {
    return (r || []).map(d => [`${d.data || ''} ${d.titulo || ''}`.trim(), ...(d.itens || []).map(i => ((!i.hora && !i.endereco) ? i.titulo : `${i.hora || ''} | ${i.titulo || ''}${i.endereco ? ' | ' + i.endereco : ''}`))].join('\n')).join('\n');
  }

  const api = { linkApp, linkWhatsApp, pendencias, proximas, viajandoAgora, embarcamHoje, voltamHoje, voosComProblema, roteiroDeTexto, roteiroParaTexto };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.VPP = api;
})(typeof self !== 'undefined' ? self : this);
