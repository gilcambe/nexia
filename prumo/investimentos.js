'use strict';
// Kernex Finance: aba Investimentos. Rentabilidade, concentração, calendário, cotação com fonte e simulador de juros compostos.
// Cálculos vêm do servidor (motor). Cotação sem fonte/data não é aceita; velha aparece como "desatualizada".
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });

  MB.telas.investimentos = async (el) => {
    const { brl, esc, TIPOS, formulario, aba } = await carregarUi();
    aba('investimentos');
    const v = await MB.api('invest_visao');
    const c = v.concentracao;
    const pct = (n) => String(n).replace('.', ',');
    el.innerHTML = `
      <div class="card"><div class="fraco">Total investido (carteira)</div><div class="grande">${c.total === null ? '—' : brl(c.total)}</div>
        <div class="fraco">${c.total === null ? esc(c.lacuna) : `${c.diversificacao} tipo(s) de investimento · proventos recebidos no ano ${brl(v.proventos_recebidos_ano)}`}</div></div>
      ${v.lacunas.map((l) => `<div class="card"><div class="fraco">ℹ️ ${esc(l)}</div></div>`).join('')}
      ${c.alertas.length ? `<div class="card"><div class="n">⚠️ Concentração</div>${c.alertas.map((a) => `<div class="fraco">• ${esc(a)}</div>`).join('')}</div>` : ''}
      ${v.itens.length ? `<div class="card"><h3 style="margin:0 0 6px">Seus ativos</h3>${v.itens.map((x) => `<div class="item" data-id="${esc(x.id)}"><div><div class="n">${esc(x.nome)}</div><div class="fraco">${esc(TIPOS[x.tipo] || x.tipo)}${x.rentabilidade ? ` · rentabilidade ${pct(x.rentabilidade.pct)}%` : ''}${x.cotacao ? ` · cotação ${brl(x.cotacao.preco)} (${esc(x.cotacao.fonte)})${x.cotacao.desatualizada ? ' <b class="verm">desatualizada</b>' : ''}` : ' · sem cotação'}</div></div><div class="v">${brl(x.valor)}</div></div>`).join('')}<div class="fraco">Toque num ativo para registrar a cotação (precisa de fonte).</div></div>` : ''}
      <div class="card"><h3 style="margin:0 0 6px">📅 Próximos 60 dias</h3>${v.calendario.length ? v.calendario.map((x) => `<div class="item"><div><div class="n">${esc(x.nome)}</div><div class="fraco">${x.tipo === 'vencimento' ? 'Vencimento' : 'Provento (' + esc(x.tipo) + ')'} · ${esc(x.data)}</div></div><div class="v">${brl(x.valor)}</div></div>`).join('') : '<div class="fraco">Nada a vencer ou receber. Cadastre vencimentos na carteira e proventos aqui.</div>'}
        <button class="btn sec" id="novo-prov" type="button" style="margin-top:8px">+ Provento</button></div>
      <div class="card"><h3 style="margin:0 0 6px">🧮 Simulador de aportes</h3>
        <div class="fraco">Usa a taxa que você informar, fixa, sem imposto e sem inflação.</div>
        <label>Valor inicial (R$)</label><input id="si-ini" type="number" step="0.01" inputmode="decimal" placeholder="0">
        <label>Aporte por mês (R$)</label><input id="si-ap" type="number" step="0.01" inputmode="decimal" placeholder="0">
        <label>Taxa por mês (%)</label><input id="si-tx" type="number" step="0.01" inputmode="decimal" placeholder="0,8">
        <label>Prazo (anos)</label><input id="si-an" type="number" step="1" inputmode="numeric" placeholder="10">
        <button class="btn" id="si-ir" type="button" style="margin-top:10px">Simular</button><div id="si-res"></div></div>
      <div class="card"><button class="btn sec" id="an-ir" type="button">🔎 Observações sobre minha carteira</button><div id="an-res"></div></div>
      <div class="fraco" style="margin:8px 0">${esc(v.aviso)}</div>`;

    el.querySelectorAll('.item[data-id]').forEach((i) => {
      i.onclick = () => {
        const x = v.itens.find((y) => y.id === i.dataset.id);
        formulario('Cotação de ' + x.nome, [
          { nome: 'preco', rotulo: 'Preço por unidade (R$)', tipo: 'number' },
          { nome: 'fonte', rotulo: 'Fonte (site, corretora, extrato)' },
          { nome: 'data_hora', rotulo: 'Data e hora (AAAA-MM-DDTHH:MM, vazio = agora)' },
        ], async (f) => { const o = { id: x.id, preco: Number(f.preco), fonte: f.fonte }; if (f.data_hora) o.data_hora = new Date(f.data_hora).toISOString(); await MB.api('invest_cotacao', o); MB.ui.ok('Cotação salva.'); }, null);
      };
    });
    el.querySelector('#novo-prov').onclick = () => formulario('Novo provento', [
      { nome: 'ativo', rotulo: 'Ativo' }, { nome: 'data', rotulo: 'Data (AAAA-MM-DD)' }, { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'number' },
    ], async (f) => { await MB.api('invest_dividendo_salvar', { ...f, valor: Number(f.valor) }); MB.ui.ok('Provento salvo.'); }, null);
    el.querySelector('#si-ir').onclick = async () => {
      const res = el.querySelector('#si-res');
      try {
        const r = await MB.api('invest_simular', { inicial: el.querySelector('#si-ini').value, aporte: el.querySelector('#si-ap').value, taxa_mes: el.querySelector('#si-tx').value, anos: el.querySelector('#si-an').value });
        res.innerHTML = `<div class="card" style="margin-top:8px"><div class="n">Em ${r.premissas.anos} ano(s): ${brl(r.final)}</div><div class="fraco">Você coloca ${brl(r.investido)} · rende ${brl(r.rendimento)}</div><div class="fraco">${esc(r.aviso)}</div></div>`;
      } catch (e) { res.innerHTML = `<div class="fraco verm">${esc(e.message || 'Não consegui simular.')}</div>`; }
    };
    el.querySelector('#an-ir').onclick = async () => {
      const r = await MB.api('invest_analise');
      el.querySelector('#an-res').innerHTML = `<div style="margin-top:8px">${r.observacoes.length ? r.observacoes.map((o) => `<div class="fraco">• ${esc(o)}</div>`).join('') : '<div class="fraco">Nada de especial a apontar com os dados cadastrados.</div>'}<div class="fraco" style="margin-top:4px">Fonte: ${esc(r.fonte)}. ${esc(r.aviso)}</div></div>`;
    };
  };
})();
