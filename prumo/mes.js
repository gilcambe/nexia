'use strict';
// Redesign: aba Mês (plano, tela 5). Entrou / Falta entrar / Saiu, o salário com a origem, a agenda do que falta pagar
// (vermelho só se vence em até 3 dias e passa do saldo), gastos por categoria contra a média de 3 meses e UMA dica.
(function () {
  const MB = window.MB;
  const carregar = () => MB.hub ? Promise.resolve(MB.hub) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/hubs.js'; s.onload = () => ok(MB.hub); s.onerror = falha; document.body.appendChild(s); });
  const CAT = { moradia: 'Moradia', alimentacao: 'Mercado e comida', transporte: 'Transporte', saude: 'Saúde', educacao: 'Educação', familia: 'Família', lazer: 'Lazer', compras: 'Compras', assinaturas: 'Assinaturas', financeiro: 'Financeiro', impostos: 'Impostos', investimentos: 'Investimentos', renda: 'Renda', outros: 'Outros' };
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const dm = (d) => (d ? `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}` : 'sem dia');
  MB.telas.mes = async (el) => {
    const H = await carregar(); const U = await H.ui(); U.aba('mes');
    const p = await MB.api('painel_resumo');
    const m = p.mes_detalhe || { entrou: 0, falta_entrar: 0, saiu: 0, a_pagar_itens: [], categorias: [] };
    const s = m.salario;
    const ad = s && s.adiantamento;
    const nomeMes = `${MESES[Number(p.mes.slice(5, 7)) - 1]} ${p.mes.slice(0, 4)}`;
    el.innerHTML = `<div class="kh">
      <div class="kh-larga"><h2>${nomeMes}</h2><div class="sub">${p.dias_restantes} dia(s) para acabar o mês</div></div>
      <div class="kh-kpis kh-larga" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="card"><div class="r">Entrou</div><div class="v" style="font-size:clamp(13px,3.7vw,18px)">${H.val(m.entrou, 'kh-in')}</div></div>
        <div class="card"><div class="r">Falta entrar</div><div class="v" style="font-size:clamp(13px,3.7vw,18px)">${H.val(m.falta_entrar, 'kh-in')}</div></div>
        <div class="card"><div class="r">Saiu</div><div class="v" style="font-size:clamp(13px,3.7vw,18px)">${H.val(m.saiu, '')}</div></div>
      </div>
      <section class="card"><b>💼 Salário</b>${s ? `<div class="kh-ag"><span>Líquido do mês <span class="sub">(${s.fonte === 'holerite' ? 'holerite' : 'estimado'})</span></span><b>${H.brl(s.liquido)}</b></div>`
        + (ad ? `<div class="kh-ag"><span>Adiantamento ${dm(ad.data)} <span class="sub">${ad.status === 'caiu' ? (ad.automatico ? 'estimado, não lançado' : 'recebido') : 'previsto'}</span></span><span>${H.brl(ad.valor)}</span></div>` : '')
        + `<div class="kh-ag"><span>Falta receber (dia ${String(s.data_salario || '').slice(8, 10) || '30'})</span><b class="kh-in">${H.brl(m.falta_entrar)}</b></div>`
        : '<p class="sub" style="margin:6px 0 0">Mande o holerite ou informe o salário para eu calcular o que ainda cai.</p>'}
        <button class="btn sec" type="button" data-ir="orcamento">Ver salário e holerite</button></section>
      <section class="card"><div style="display:flex;justify-content:space-between"><b>📅 A pagar até o fim do mês</b><b class="kh-out">${H.brl(m.a_pagar_total || 0)}</b></div>
        ${m.a_pagar_itens.length ? m.a_pagar_itens.map((x) => `<div class="kh-ag"><span>${dm(x.data)} · ${H.esc(x.nome)}${x.risco ? ' <b class="kh-neg">· falta saldo</b>' : ''}</span><span class="${x.risco ? 'kh-neg' : 'kh-out'}" style="font-weight:600;white-space:nowrap">${H.brl(x.valor)}</span></div>`).join('')
          : '<p class="sub" style="margin:8px 0 0">Nada a pagar cadastrado. Mande a fatura ou cadastre as contas fixas.</p>'}
        ${(m.proximas_faturas || []).length ? `<div class="sub" style="margin-top:8px">Próximas faturas: ${m.proximas_faturas.map((f) => `${dm(f.vencimento)} ${H.brl(f.valor)}`).join(' · ')}</div>` : ''}</section>
      <section class="card kh-larga"><b>🛒 Gastos por categoria</b>
        ${m.categorias.length ? m.categorias.slice(0, 8).map((c) => `<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;font-size:14px"><span>${H.esc(CAT[c.categoria] || c.categoria)} <span class="sub">${c.pct}%</span></span><span>${H.brl(c.valor)}</span></div>
          <div class="barra" style="height:8px;margin-top:4px"><i style="width:${c.pct}%;background:${c.acima_pct != null && c.acima_pct > 20 ? '#F5A623' : '#2F6BFF'}"></i></div>${c.media3 != null ? `<div class="sub">média de 3 meses: ${H.brl(c.media3)}</div>` : ''}</div>`).join('')
          : '<p class="sub" style="margin:8px 0 0">Nenhum gasto neste mês ainda. Toque em + Lançar.</p>'}
        ${m.dica ? `<div class="aviso-c" style="margin-top:12px">💡 ${H.esc((CAT[m.dica.categoria] || m.dica.categoria) + m.dica.texto.slice(m.dica.categoria.length))} <button class="btn sec mini" type="button" data-ir="documentos" style="margin-top:6px">Ver os gastos</button></div>` : ''}</section>
      ${H.lista([
        ['cartoes', '💳', 'Cartões e faturas', 'Mande a fatura e veja quando vence'],
        ['contas', '🏦', 'Contas do banco', 'Saldo de cada conta'],
        ['documentos', '🧾', 'Lançamentos', 'Tudo que entrou e saiu, com editar e apagar'],
        ['orcamento', '💼', 'Salário e holerite', 'Adiantamento, 13º, horas extras'],
        ['gastos', '🛒', 'Gastos (aba antiga)', 'Compras no cartão por categoria'],
        ['fluxo', '📈', 'Fluxo de caixa', 'Quanto ainda entra e sai nos próximos meses'],
        ['carreira', '🧭', 'Carreira e renda', 'Simular aumento e renda extra'],
        ['compras', '🧺', 'Lista de compras', 'Listas do mercado'],
      ])}
    </div>`;
    H.ligar(el);
  };
})();
