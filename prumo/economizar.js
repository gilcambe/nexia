'use strict';
// Kernex Finance: aba Economizar. Assinaturas, cobranças repetidas, tarifas, delivery e ideias de renda extra.
// Tudo é ponto para REVISAR (não acusação). Não prometemos economia nem renda.
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });

  MB.telas.economizar = async (el) => {
    const { brl, esc, formulario, aba } = await carregarUi();
    aba('economizar');
    const [v, o] = await Promise.all([MB.api('econ_visao'), MB.api('econ_oportunidades')]);
    el.innerHTML = `
      ${v.lacunas.map((l) => `<div class="card"><div class="fraco">ℹ️ ${esc(l)}</div></div>`).join('')}
      ${v.dicas.length ? `<div class="card"><h3 style="margin:0 0 6px">💡 Para revisar</h3>${v.dicas.map((d) => `<div class="fraco">• ${esc(d)}</div>`).join('')}</div>` : ''}
      ${v.assinaturas.length ? `<div class="card"><h3 style="margin:0 0 6px">🔁 Cobranças que se repetem</h3>${v.assinaturas.map((a) => `<div class="item"><div><div class="n">${esc(a.estabelecimento)}</div><div class="fraco">${a.meses} meses seguidos · ${brl(a.valor_medio * 12)} por ano</div></div><div class="v">${brl(a.valor_medio)}/mês</div></div>`).join('')}</div>` : ''}
      ${v.cobrancas_repetidas.length ? `<div class="card"><h3 style="margin:0 0 6px">⚠️ Possível cobrança duplicada</h3>${v.cobrancas_repetidas.map((c) => `<div class="item"><div><div class="n">${esc(c.descricao)}</div><div class="fraco">${esc(c.data)}</div></div><div class="v">${brl(c.valor)}</div></div>`).join('')}</div>` : ''}
      ${v.tarifas.total > 0 ? `<div class="card"><h3 style="margin:0 0 6px">🏦 Tarifas e juros do mês: ${brl(v.tarifas.total)}</h3>${v.tarifas.itens.map((t) => `<div class="fraco">${esc(t.descricao)} · ${brl(t.valor)}</div>`).join('')}</div>` : ''}
      ${v.delivery.atual > 0 ? `<div class="card"><h3 style="margin:0 0 6px">🛵 Delivery no mês: ${brl(v.delivery.atual)}</h3><div class="fraco">${v.delivery.media !== null ? `Média dos meses anteriores: ${brl(v.delivery.media)}${v.delivery.acima ? ' — <b class="verm">acima da média</b>' : ''}` : esc(v.delivery.lacuna || '')}</div></div>` : ''}
      <div class="fraco" style="margin:6px 0">${esc(v.aviso)}</div>
      <div class="card" id="kf-cortes" hidden></div>
      <div class="card"><h3 style="margin:0 0 6px">🌱 Ideias de renda extra</h3>
        ${o.perfil ? `<div class="fraco">Seu perfil: ${o.perfil.horas_semana} h/semana, capital ${brl(o.perfil.capital)}${o.perfil.habilidades.length ? ', habilidades: ' + esc(o.perfil.habilidades.join(', ')) : ''}</div>` : `<div class="fraco">${esc(o.lacuna)}</div>`}
        ${o.oportunidades.map((x) => `<div class="item"><div><div class="n">${esc(x.nome)}</div><div class="fraco">Investimento: ${esc(x.investimento)} · tempo até o 1º ganho: ${esc(x.tempo)} · risco ${esc(x.risco)}</div><div class="fraco">Ganho: ${esc(x.ganho)}</div></div></div>`).join('')}
        <button class="btn" id="perfil" type="button" style="margin-top:8px">${o.perfil ? 'Editar meu perfil' : 'Contar meu perfil'}</button>
        <div class="fraco" style="margin-top:6px">${esc(o.aviso)}</div></div>`;
    // Fase 9 (#4013): cortes com impacto_anual e acompanhamento. Carrega depois, não segura a tela.
    const kc = el.querySelector('#kf-cortes');
    const NOMES = { revisar: 'Revisar', feito: 'Feito', ignorar: 'Ignorar', adiar: 'Adiar' };
    const desenhar = (cr) => {
      if (!cr || !cr.itens || !cr.itens.length) return;
      kc.innerHTML = `<h3 style="margin:0 0 6px">✂️ Onde cortar: ${brl(cr.impacto_anual_aberto)} por ano</h3>` + cr.itens.map((x) => `<div class="item" style="flex-wrap:wrap"><div><div class="n">${esc(x.titulo)}</div><div class="fraco">${esc(x.evidencia)} · prioridade ${esc(x.prioridade)}</div></div><span class="v">${brl(x.impacto_anual)}/ano</span>
        <div style="width:100%;margin-top:4px">${Object.keys(NOMES).map((s) => `<button type="button" class="btn ${x.status === s ? '' : 'sec'} mini" data-corte="${esc(x.id)}" data-st="${s}">${NOMES[s]}</button>`).join(' ')}</div></div>`).join('');
      kc.hidden = false;
      kc.querySelectorAll('[data-corte]').forEach((b) => { b.onclick = async () => { try { await MB.api('corte_marcar', { id: b.dataset.corte, status: b.dataset.st }); desenhar(await MB.api('cortes_listar', {}, { silencioso: true })); } catch { /* erro já mostrado */ } }; });
    };
    if (kc) MB.api('cortes_listar', {}, { silencioso: true }).then(desenhar).catch(() => {});
    el.querySelector('#perfil').onclick = () => formulario('Meu perfil', [
      { nome: 'habilidades', rotulo: 'Habilidades (separe por vírgula: ensino, design, culinaria…)', valor: o.perfil ? o.perfil.habilidades.join(', ') : '' },
      { nome: 'horas_semana', rotulo: 'Horas livres por semana', tipo: 'number', valor: o.perfil && o.perfil.horas_semana },
      { nome: 'capital', rotulo: 'Quanto pode investir (R$)', tipo: 'number', valor: o.perfil && o.perfil.capital },
    ], async (f) => { await MB.api('econ_perfil_salvar', { habilidades: f.habilidades, horas_semana: Number(f.horas_semana), capital: Number(f.capital || 0) }); MB.ui.ok('Perfil salvo.'); }, null);
  };
})();
