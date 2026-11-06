'use strict';
// Kernex Finance: aba Dívidas. Cadastro, comparação de estratégias de quitação, quitação antecipada e renegociação.
// Os cálculos vêm do servidor (motor); aqui só desenha. Sem dívida cadastrada não presumimos que não há dívida.
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const NIVEL = { baixo: '🟢 baixo', 'médio': '🟠 médio', alto: '🔴 alto' };

  MB.telas.dividas = async (el) => {
    const { brl, esc, opcoes, formulario, aba } = await carregarUi();
    aba('dividas');
    const d = await MB.api('divida_listar');
    const pct = (n) => String(n).replace('.', ',');
    el.innerHTML = `
      <div class="card"><div class="fraco">Você deve (dívidas cadastradas)</div><div class="grande">${d.dividas.length ? brl(d.resumo.total) : d.sem_dividas ? 'R$ 0,00' : '—'}</div>
        <div class="fraco">${d.dividas.length ? `Parcelas ${brl(d.resumo.parcelas_mes)} por mês · juros estimados ${brl(d.resumo.juros_mes_estimado)} por mês` : d.sem_dividas ? 'Você informou que não tem dívidas.' : 'Ainda não sei: cadastre suas dívidas ou diga que não tem nenhuma.'}</div>
        <div class="fraco" style="margin-top:4px">Fatura de cartão em dia não entra aqui; só o que você cadastrar.</div></div>
      <button class="btn" id="nova-div" type="button">+ Dívida</button>
      ${!d.dividas.length ? `<button class="btn sec" id="sem-div" type="button" style="margin-top:8px">${d.sem_dividas ? 'Desfazer: voltei a ter dívida' : 'Não tenho dívidas'}</button>` : ''}
      ${d.dividas.length ? `<div class="card" style="margin-top:12px">${d.dividas.map((x) => `<div class="item" data-id="${esc(x.id)}"><div><div class="n">${esc(x.credor)}</div><div class="fraco">${esc(d.tipos[x.tipo] || x.tipo)} · juros ${pct(x.juros_mes)}% ao mês${x.cet_ano ? ' · CET ' + pct(x.cet_ano) + '% ao ano' : ''}${x.parcela ? ' · parcela ' + brl(x.parcela) : ''}</div></div><div style="text-align:right"><div class="v verm">${brl(x.saldo)}</div><button class="btn sec mini" data-reneg="${esc(x.id)}" type="button">Renegociar</button></div></div>`).join('')}</div>
      <div class="card"><h3 style="margin:0 0 6px">🧮 Plano de quitação</h3>
        <div class="fraco">Compara pagar só o mínimo, avalanche (maior juros primeiro) e bola de neve (menor dívida primeiro).</div>
        <label>Extra por mês (R$)</label><input id="pl-extra" type="number" step="0.01" inputmode="decimal" placeholder="0">
        <label>Valor à vista para quitar parte (R$, opcional)</label><input id="pl-vista" type="number" step="0.01" inputmode="decimal" placeholder="0">
        <button class="btn" id="pl-ir" type="button" style="margin-top:10px">Comparar</button><div id="pl-res"></div></div>` : ''}`;

    const editar = (x) => formulario(x ? 'Editar dívida' : 'Nova dívida', [
      { nome: 'credor', rotulo: 'Com quem é a dívida', valor: x && x.credor },
      { nome: 'tipo', rotulo: 'Tipo', opcoes: opcoes(d.tipos, x ? x.tipo : 'cartao') },
      { nome: 'saldo', rotulo: 'Quanto falta pagar (R$)', tipo: 'number', valor: x && x.saldo },
      { nome: 'juros_mes', rotulo: 'Juros por mês (%)', tipo: 'number', valor: x && x.juros_mes },
      { nome: 'parcela', rotulo: 'Parcela mensal (R$)', tipo: 'number', valor: x && x.parcela },
      { nome: 'cet_ano', rotulo: 'CET por ano, % (opcional)', tipo: 'number', valor: x && x.cet_ano },
      { nome: 'dia_vencimento', rotulo: 'Dia do vencimento (opcional)', tipo: 'number', valor: x && x.dia_vencimento },
    ], async (v) => { const o = { ...v, id: x && x.id }; for (const k of ['cet_ano', 'dia_vencimento']) if (v[k] === '') delete o[k]; await MB.api('divida_salvar', o); MB.ui.ok('Dívida salva.'); },
    x ? async () => { await MB.api('divida_apagar', { id: x.id }); } : null);
    el.querySelector('#nova-div').onclick = () => editar(null);
    const sem = el.querySelector('#sem-div');
    if (sem) sem.onclick = async () => { await MB.api('divida_nenhuma', { sem: !d.sem_dividas }); MB.abrirAba('dividas'); };
    el.querySelectorAll('.item[data-id]').forEach((i) => {
      i.onclick = () => editar(d.dividas.find((y) => y.id === i.dataset.id));
    });
    el.querySelectorAll('[data-reneg]').forEach((b) => { b.onclick = (ev) => { ev.stopPropagation(); renegociar(d.dividas.find((y) => y.id === b.dataset.reneg)); }; });

    function renegociar(x) {
      formulario('Renegociar ' + x.credor, [
        { nome: 'nova_taxa_mes', rotulo: 'Juros por mês da proposta (%)', tipo: 'number' },
        { nome: 'prazo_meses', rotulo: 'Prazo da proposta (meses)', tipo: 'number' },
        { nome: 'taxa_fixa', rotulo: 'Taxas da proposta, R$ (opcional)', tipo: 'number' },
      ], async (v) => {
        const o = { id: x.id, nova_taxa_mes: Number(v.nova_taxa_mes), prazo_meses: Number(v.prazo_meses) }; if (v.taxa_fixa !== '') o.taxa_fixa = Number(v.taxa_fixa);
        const r = await MB.api('divida_renegociar', o);
        alert(`Proposta: parcela de ${brl(r.nova.parcela)} por ${r.nova.prazo} meses; custo total de juros e taxas ${brl(r.nova.custo_total_juros_e_taxas)}.\n` +
          (r.atual.nunca ? 'Hoje a sua parcela nem cobre os juros: a proposta é melhor.' : `Seguir como está custa ${brl(r.atual.juros)} de juros em ${r.atual.meses} meses.\n${r.compensa ? '✅ A proposta compensa: economiza ' + brl(r.economia) + '.' : '🔴 A proposta NÃO compensa: custa ' + brl(-r.economia) + ' a mais.'}`) + '\n\n' + r.aviso);
      }, null);
    }

    const ir = el.querySelector('#pl-ir');
    if (ir) ir.onclick = async () => {
      const res = el.querySelector('#pl-res');
      const o = {}; const ex = el.querySelector('#pl-extra').value; const av = el.querySelector('#pl-vista').value;
      if (ex !== '') o.extra = Number(ex); if (av !== '') o.a_vista = Number(av);
      try {
        const r = await MB.api('divida_plano', o); const e = r.estrategias;
        const bloco = (nome, x, destaque) => `<div class="card" style="margin-top:8px${destaque ? ';border-color:var(--azul2)' : ''}"><div class="n">${destaque ? '⭐ ' : ''}${nome}</div>${x.nunca ? '<div class="fraco verm">Nunca quita: a parcela não cobre os juros.</div>' : `<div class="fraco">Quita em ${x.meses} meses · juros ${brl(x.juros_pagos)}${x.economia_vs_minimo ? ' · economiza ' + brl(x.economia_vs_minimo) + ' contra o mínimo' : ''}</div>`}</div>`;
        res.innerHTML = `${bloco('Só o mínimo', e.so_minimo, false)}${bloco('Avalanche', e.avalanche, e.melhor === 'avalanche')}${bloco('Bola de neve', e.bola_de_neve, e.melhor === 'bola_de_neve')}
          ${e.diferenca_avalanche_bola !== null ? `<div class="fraco" style="margin-top:6px">Avalanche × bola de neve: diferença de ${brl(Math.abs(e.diferenca_avalanche_bola))} em juros.</div>` : ''}
          ${r.quitacao_antecipada ? `<div class="card" style="margin-top:8px"><div class="n">💵 Quitação antecipada</div><div class="fraco">Usando ${brl(r.quitacao_antecipada.valor_usado)} em "${esc(r.quitacao_antecipada.alvo)}": juros de ${brl(r.quitacao_antecipada.juros_sem)} para ${brl(r.quitacao_antecipada.juros_com)}${r.quitacao_antecipada.economia ? ' (economiza ' + brl(r.quitacao_antecipada.economia) + ')' : ''}; prazo de ${r.quitacao_antecipada.meses_sem} para ${r.quitacao_antecipada.meses_com} meses.</div></div>` : ''}
          <div class="card" style="margin-top:8px"><div class="n">⚠️ Risco de liquidez: ${NIVEL[r.risco_liquidez.nivel]}</div>${r.risco_liquidez.avisos.map((a) => `<div class="fraco">• ${esc(a)}</div>`).join('') || '<div class="fraco">O plano cabe no que sobra por mês.</div>'}</div>
          <div class="fraco" style="margin-top:6px">${esc(r.aviso)}</div>`;
      } catch { /* erro já mostrado */ }
    };
  };
})();
