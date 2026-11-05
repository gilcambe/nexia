'use strict';
// Kernex Finance: aba Cartões. Limite comprometido, próximas faturas, qual cartão rende mais, simulador de compra,
// recorrências e cobranças para revisar. Os cálculos vêm do servidor; aqui só desenha.
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const nomeMes = (m) => MES[Number(m.slice(5)) - 1] + '/' + m.slice(2, 4);

  MB.telas.cartoes = async (el) => {
    const { brl, esc, barra, aba } = await carregarUi();
    aba('cartoes');
    const [v, i] = await Promise.all([MB.api('cartao_visao'), MB.api('cartao_inteligencia')]);
    if (!v.cartoes.length) { el.innerHTML = '<div class="card fraco">Cadastre seu primeiro cartão na aba Gastos, em "Meus cartões". Depois volte aqui.</div>'; return; }
    el.innerHTML = `
      <div class="card"><div class="fraco">Limite comprometido (estimado)</div><div class="grande">${brl(v.total_comprometido)}</div>
        <div class="fraco">de ${brl(v.total_limite)} de limite · limite de cartão não é dinheiro</div></div>
      ${v.cartoes.map((k) => `<div class="card" data-cartao="${esc(k.id)}"><div class="item" style="padding:0;border:0"><span class="n">${esc(k.nome)}${k.bandeira ? ' · ' + esc(k.bandeira) : ''}</span><span>${k.vence_em_dias <= 3 ? '🟠 ' : ''}vence dia ${k.dia_vencimento}</span></div>
        ${barra(k.pct || 0, k.pct > 80 ? '#ef4444' : '')}
        <div class="fraco">Comprometido ${brl(k.comprometido)} · disponível ${brl(k.disponivel)}${k.pct === null ? '' : ' · ' + String(k.pct).replace('.', ',') + '%'}</div>
        <div class="fraco" style="margin-top:8px">Próximas faturas</div>
        <div style="display:flex;gap:4px;align-items:flex-end;height:70px">${(() => { const max = Math.max(1, ...k.proximas.map((p) => p.valor)); return k.proximas.map((p) => `<div style="flex:1;text-align:center;font-size:11px"><div style="height:${Math.round((p.valor / max) * 48)}px;background:var(--azul2);border-radius:4px 4px 0 0;min-height:2px"></div><span class="fraco">${nomeMes(p.mes)}</span></div>`).join(''); })()}</div>
        <div class="fraco">Este mês: ${brl(k.fatura_mes)}</div>
        ${k.anuidade_analise ? `<div class="fraco" style="margin-top:8px">💳 Anuidade ${brl(k.anuidade_analise.anuidade)}: ${k.anuidade_analise.compensa === null ? esc(k.anuidade_analise.motivo) : k.anuidade_analise.compensa ? 'compensa (retorno ' + brl(k.anuidade_analise.retorno_anual) + ' por ano no seu ritmo de gasto)' : 'não compensa no seu ritmo de gasto (retorno ' + brl(k.anuidade_analise.retorno_anual) + ')'}</div>` : ''}</div>`).join('')}
      <div class="card"><h3 style="margin:0 0 6px">🏆 Qual cartão rende mais?</h3>
        ${v.melhor.ranking.map((r, n) => `<div class="item"><span class="n">${n + 1}. ${esc(r.nome)}</span><span>${String(r.retorno.pct).replace('.', ',')}% de volta${r.retorno.parcial ? ' (só cashback)' : ''}</span></div>`).join('') || '<p class="fraco">Informe pontos por real e o valor do milheiro (ou cashback) nos cartões para comparar.</p>'}
        ${v.melhor.sem_dados.length ? `<div class="fraco">Sem dados para comparar: ${v.melhor.sem_dados.map((x) => esc(x.nome)).join(', ')}.</div>` : ''}</div>
      <div class="card"><h3 style="margin:0 0 6px">🧮 Simular compra</h3>
        <label>Cartão</label><select id="sim-cartao">${v.cartoes.map((k) => `<option value="${esc(k.id)}">${esc(k.nome)}</option>`).join('')}</select>
        <label>Valor total (R$)</label><input id="sim-valor" type="number" step="0.01" inputmode="decimal">
        <label>Parcelas</label><input id="sim-parc" type="number" value="1" min="1" max="48">
        <button class="btn" id="sim-ir" type="button" style="margin-top:10px">Simular</button><div id="sim-res"></div></div>
      ${i.recorrentes.length ? `<div class="card"><h3 style="margin:0 0 6px">🔁 Compras recorrentes</h3>${i.recorrentes.map((r) => `<div class="item"><span class="n">${esc(r.estabelecimento)}</span><span>${brl(r.valor_medio)} · ${r.meses} meses</span></div>`).join('')}</div>` : ''}
      ${i.suspeitas.length ? `<div class="card"><h3 style="margin:0 0 6px">🔎 Cobranças para revisar</h3><div class="fraco">Não é acusação: só valem uma olhada.</div>${i.suspeitas.map((s) => `<div class="item"><div><div class="n">${esc(s.lancamento.descricao)}</div><div class="fraco">${esc(s.motivo)} · ${s.lancamento.data.slice(8, 10)}/${s.lancamento.data.slice(5, 7)}</div></div><span class="v">${brl(s.lancamento.valor)}</span></div>`).join('')}</div>` : ''}
      <div class="fraco" style="margin-top:8px">${esc(v.aviso)}</div>`;
    el.querySelector('#sim-ir').onclick = async () => {
      const res = el.querySelector('#sim-res');
      const valor = Number(el.querySelector('#sim-valor').value);
      if (!(valor > 0)) { res.innerHTML = '<div class="aviso-c" style="margin-top:10px">Digite o valor da compra.</div>'; return; }
      try {
        const r = await MB.api('cartao_simular', { cartao_id: el.querySelector('#sim-cartao').value, valor, parcelas: Number(el.querySelector('#sim-parc').value) || 1 });
        res.innerHTML = `<div class="card" style="margin-top:10px;border-color:${r.cabe ? 'var(--verde)' : 'var(--perigo)'}"><div class="n">${r.cabe ? '✅ Cabe no limite' : '🔴 Não cabe no limite'}</div>
          <div class="fraco">Disponível: ${brl(r.disponivel_antes)} → ${brl(r.disponivel_depois)}${r.pct_depois === null ? '' : ' (' + String(r.pct_depois).replace('.', ',') + '% comprometido)'}</div>
          ${r.faturas.map((f) => `<div class="item"><span>${nomeMes(f.mes)}</span><span>${brl(f.valor_antes)} → <b>${brl(f.valor_antes + f.parcela_nova)}</b></span></div>`).join('')}</div>`;
      } catch { /* erro já mostrado */ }
    };
  };
})();
