'use strict';
// Kernex Finance: aba Início. Números vêm do servidor (motor determinístico); aqui só desenha.
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const NOME_CAT = { moradia: 'Moradia', alimentacao: 'Alimentação', transporte: 'Transporte', saude: 'Saúde', educacao: 'Educação', familia: 'Família', lazer: 'Lazer', compras: 'Compras', assinaturas: 'Assinaturas', financeiro: 'Financeiro', impostos: 'Impostos', investimentos: 'Investimentos', renda: 'Renda', outros: 'Outros' };
  const LACUNA = { contas: 'suas contas bancárias', dividas: 'suas dívidas', lancamentos: 'lançamentos (envie uma fatura ou extrato)' };

  MB.telas.inicio = async (el) => {
    const { brl, esc, barra, aba } = await carregarUi();
    aba('inicio');
    const [r, sf] = await Promise.all([MB.api('inicio_resumo'), MB.api('saude_financeira')]);
    const nome = (MB.usuario && MB.usuario() && MB.usuario().displayName || '').split(' ')[0];
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    let insight = 'Envie seu primeiro documento para eu entender seus gastos.';
    if (r.qtd_lancamentos > 0) {
      if (r.variacao_despesas_pct === null) insight = `Neste mês você gastou ${brl(r.despesas)}. Ainda não há mês anterior para comparar.`;
      else if (r.variacao_despesas_pct <= 0) insight = `Seus gastos estão ${Math.abs(r.variacao_despesas_pct).toLocaleString('pt-BR')}% menores que no mês passado.`;
      else insight = `Seus gastos estão ${r.variacao_despesas_pct.toLocaleString('pt-BR')}% maiores que no mês passado.`;
    }
    const cats = Object.entries(r.por_categoria || {}).sort((a, b) => b[1] - a[1]);
    el.innerHTML = `
      <p class="fraco" style="margin:0 0 10px">${saudacao}${nome ? ', ' + esc(nome) : ''}</p>
      ${r.alertas_limite.length ? r.alertas_limite.map((a) => `<div class="aviso-c">${a.status === 'estourado' ? '🔴' : '🟠'} <b>${esc(NOME_CAT[a.categoria] || a.categoria)}</b>: ${brl(a.gasto)} de ${brl(a.limite)} (${String(a.pct).replace('.', ',')}%)${a.status === 'estourado' ? ' — passou do limite' : ' — perto do limite'}.</div>`).join('') : ''}
      <div class="card kf-hero"><div class="fraco">Saldo disponível</div><div class="grande">${r.saldo_disponivel === null ? '—' : brl(r.saldo_disponivel)}</div>
        <div class="fraco" style="margin-bottom:10px">${r.saldo_disponivel === null ? 'Cadastre suas contas na aba Contas.' : 'Dinheiro em conta, sem limite de cartão.'}</div>
        <div class="fraco">Patrimônio líquido</div><div class="n" style="font-size:22px">${brl(r.patrimonio.liquido)}</div>
        <div class="fraco">Investimentos ${brl(r.investimentos)}${r.milhas_estimado ? ' · Milhas ≈ ' + brl(r.milhas_estimado) : ''}</div></div>
      <div class="linha kf-tres">
        <div class="card"><div class="fraco">Receita</div><div class="n verde">${brl(r.receitas)}</div></div>
        <div class="card"><div class="fraco">Gasto</div><div class="n verm">${brl(r.despesas)}</div></div>
        <div class="card"><div class="fraco">Economia</div><div class="n ${r.economia < 0 ? 'verm' : 'verde'}">${brl(r.economia)}</div></div>
      </div>
      <div class="card"><div class="item" style="padding:0;border:0"><span class="fraco">Saúde financeira</span><span class="grande" style="font-size:28px">${sf.nota === null ? '—' : sf.nota + '<span class="fraco" style="font-size:14px">/100</span>'}</span></div>
        ${sf.indicadores.map((x) => `<div style="margin:6px 0"><div class="item" style="padding:0;border:0"><span>${esc(x.nome)}</span><span class="fraco">${esc(x.texto)}</span></div>${barra(x.nota, x.nota < 40 ? '#ef4444' : x.nota < 70 ? '#f59e0b' : '')}</div>`).join('')}
        <div class="fraco" style="margin-top:6px">${esc(sf.aviso)}${sf.nota_mes_anterior !== null && sf.nota !== null ? ' Mês anterior: ' + sf.nota_mes_anterior + '.' : ''}</div></div>
      <div class="card kf-insight"><div class="fraco">💡 Resumo do mês</div><div>${esc(insight)}</div></div>
      <button class="btn" id="kf-doc" type="button">📄 Enviar documento</button>
      <div class="linha" style="margin-top:8px"><button class="btn sec" id="kf-ia" type="button">🤖 Perguntar à IA</button><button class="btn sec" id="kf-posso" type="button">🛒 Posso comprar?</button></div>
      ${r.dividas.registradas ? `<div class="card" style="margin-top:12px"><div class="item" style="padding:0;border:0"><span class="fraco">Dívidas</span><span class="n verm">${brl(r.dividas.total)}</span></div><div class="fraco">Parcelas ${brl(r.dividas.parcelas_mes)} por mês${r.dividas.comprometimento_pct !== null ? ' · ' + String(r.dividas.comprometimento_pct).replace('.', ',') + '% da renda' : ''}</div><button class="btn sec mini" id="kf-div" type="button" style="margin-top:8px">Ver plano de quitação</button></div>` : r.dividas.sem ? '' : `<div class="card" style="margin-top:12px"><div class="fraco">Ainda não sei se você tem dívidas. Cadastre ou diga que não tem, e a nota de saúde fica mais completa.</div><button class="btn sec mini" id="kf-div" type="button" style="margin-top:8px">Ir para Dívidas</button></div>`}
      ${r.vencimentos.length ? `<div class="card" style="margin-top:12px"><div class="fraco">Próximos vencimentos de fatura</div>${r.vencimentos.map((v) => `<div class="item"><span class="n">💳 ${esc(v.cartao)}</span><span>${v.em_dias === 0 ? 'hoje' : 'em ' + v.em_dias + ' dia(s)'} · dia ${v.dia}</span></div>`).join('')}</div>` : ''}
      ${cats.length ? `<div class="card" style="margin-top:12px"><div class="fraco">Gastos por categoria</div>${cats.map(([k, v]) => `<div style="margin:6px 0"><div class="item" style="padding:0;border:0"><span>${esc(NOME_CAT[k] || k)}</span><span>${brl(v)}</span></div>${barra(r.despesas ? (v / r.despesas) * 100 : 0)}</div>`).join('')}</div>` : ''}
      ${r.lacunas.length ? `<div class="card fraco" style="margin-top:12px">Para calcular saldo disponível e saúde financeira ainda faltam: ${r.lacunas.map((l) => esc(LACUNA[l] || l)).join(', ')}. Nada é estimado no lugar.</div>` : ''}`;
    el.querySelector('#kf-doc').onclick = () => MB.abrirAba('documentos');
    const bd = el.querySelector('#kf-div'); if (bd) bd.onclick = () => MB.abrirAba('dividas');
    el.querySelector('#kf-ia').onclick = () => MB.abrirAba('assistente');
    el.querySelector('#kf-posso').onclick = () => MB.abrirAba('assistente');
  };
})();
