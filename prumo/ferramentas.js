// Kernex Finance: aba Ferramentas (Posso comprar isso?, simulador de futuro e calculadora de milhas).
'use strict';
(function () {
  const MB = window.MB;
  let brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const iniciar = async (aba) => { ({ brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok } = await carregarUi()); MB.ui.aba(aba); };
  const campo = (id, rot, v) => `<label>${rot}</label><input id="${id}" type="number" step="0.01" inputmode="decimal" value="${v == null ? '' : v}">`;
  const pegar = (el, ids) => Object.fromEntries(ids.map((i) => [i, el.querySelector('#' + i).value]));
  MB.telas.ferramentas = async (el) => {
    await iniciar('ferramentas');
    el.innerHTML = `
      <div class="card"><b>🛍️ Posso comprar isso?</b>${campo('pc_valor', 'Valor (R$)')}${campo('pc_parcelas', 'Parcelas', 1)}<button class="btn" id="pc" style="margin-top:10px">Calcular</button><div id="pc_r" class="fraco" style="margin-top:10px"></div></div>
      <div class="card"><b>🎯 Simulador de futuro</b>${campo('f_inicial', 'Já tenho (R$)', 0)}${campo('f_aporte', 'Aporte por mês (R$)', 500)}${campo('f_meses', 'Prazo (meses)', 120)}${campo('f_taxa', 'Rendimento ao ano (%)', 10)}${campo('f_infl', 'Inflação ao ano (%)', 4.5)}${campo('f_meta', 'Meta (R$, opcional)')}<button class="btn" id="f" style="margin-top:10px">Simular</button><div id="f_r" class="fraco" style="margin-top:10px"></div></div>
      <div class="card"><b>✈️ Calculadora de milhas</b>${campo('m_preco', 'Preço pago pelas milhas (R$)')}${campo('m_milhas', 'Quantidade de milhas')}${campo('m_anuidade', 'Anuidade rateada (R$)', 0)}
        ${campo('m_pontos', 'Pontos a transferir')}${campo('m_bonus', 'Bônus da transferência (%)', 0)}
        ${campo('m_pd', 'Preço da passagem em dinheiro (R$)')}${campo('m_mr', 'Milhas pedidas no resgate')}${campo('m_taxas', 'Taxas do resgate (R$)', 0)}${campo('m_vm', 'Valor que você dá a 1.000 milhas (R$)', 20)}
        <button class="btn" id="m" style="margin-top:10px">Calcular</button><div id="m_r" class="fraco" style="margin-top:10px"></div></div>`;
    const msgErro = (e) => (e && e.message) || 'Confira os números.';
    el.querySelector('#pc').onclick = async () => {
      const d = pegar(el, ['pc_valor', 'pc_parcelas']);
      try {
        const r = await MB.api('posso_comprar', { valor: d.pc_valor, parcelas: d.pc_parcelas });
        const V = { sim: '✅ Cabe no seu orçamento.', cuidado: '⚠️ Dá, mas com cuidado.', nao: '⛔ Não cabe agora.' };
        el.querySelector('#pc_r').innerHTML = `<b>${V[r.veredito]}</b><br>Parcela: ${brl(r.parcela)}<br>Sobra mensal depois: ${brl(r.sobraDepois)} (antes: ${brl(r.base.sobra_mes)})<br>Reserva: ${r.mesesReservaAntes === null ? 'sem dados' : r.mesesReservaAntes + ' → ' + r.mesesReservaDepois + ' meses'}<br>${esc(r.aviso)}`;
      } catch (e) { el.querySelector('#pc_r').textContent = msgErro(e); }
    };
    el.querySelector('#f').onclick = async () => {
      const d = pegar(el, ['f_inicial', 'f_aporte', 'f_meses', 'f_taxa', 'f_infl', 'f_meta']);
      try {
        const r = await MB.api('futuro_simular', { inicial: d.f_inicial, aporte: d.f_aporte, meses: d.f_meses, taxa_anual: d.f_taxa, inflacao_anual: d.f_infl, meta: d.f_meta });
        el.querySelector('#f_r').innerHTML = `Você investe ${brl(r.investido)} e chega a <b>${brl(r.nominal)}</b> (rende ${brl(r.rendimento)}).<br>Em valores de hoje (descontada a inflação): ${brl(r.real)}.${r.aporte_necessario !== null ? `<br>Para chegar na meta: ${brl(r.aporte_necessario)} por mês.` : ''}<br>${esc(r.aviso)}`;
      } catch (e) { el.querySelector('#f_r').textContent = msgErro(e); }
    };
    el.querySelector('#m').onclick = async () => {
      const d = pegar(el, ['m_preco', 'm_milhas', 'm_anuidade', 'm_pontos', 'm_bonus', 'm_pd', 'm_mr', 'm_taxas', 'm_vm']);
      try {
        const r = await MB.api('milhas_calcular', { preco: d.m_preco, milhas: d.m_milhas, anuidade: d.m_anuidade, pontos: d.m_pontos, bonus_pct: d.m_bonus, preco_dinheiro: d.m_pd, milhas_resgate: d.m_mr, taxas: d.m_taxas, valor_milheiro: d.m_vm });
        el.querySelector('#m_r').innerHTML = [r.custo_milheiro != null ? `Custo do milheiro: <b>${brl(r.custo_milheiro)}</b>` : '', r.milhas_com_bonus != null ? `Milhas depois do bônus: <b>${r.milhas_com_bonus.toLocaleString('pt-BR')}</b>` : '', r.resgate ? `Resgate custa ${brl(r.resgate.custoMilhas)} contra ${brl(r.resgate.precoDinheiro)} em dinheiro: <b>${r.resgate.compensa ? 'compensa' : 'não compensa'}</b> (${brl(r.resgate.economia)}).` : '', esc(r.aviso)].filter(Boolean).join('<br>');
      } catch (e) { el.querySelector('#m_r').textContent = msgErro(e); }
    };
  };
})();
