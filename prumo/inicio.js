'use strict';
// Kernex Finance: aba Início. Números vêm do servidor (motor determinístico); aqui só desenha.
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const carregarGraficos = () => MB.graficos ? Promise.resolve(MB.graficos) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/graficos.js'; s.onload = () => ok(MB.graficos); s.onerror = falha; document.body.appendChild(s); });
  const NOME_CAT = { moradia: 'Moradia', alimentacao: 'Alimentação', transporte: 'Transporte', saude: 'Saúde', educacao: 'Educação', familia: 'Família', lazer: 'Lazer', compras: 'Compras', assinaturas: 'Assinaturas', financeiro: 'Financeiro', impostos: 'Impostos', investimentos: 'Investimentos', renda: 'Renda', outros: 'Outros' };
  const carregarFluxo = () => MB.fluxoVisao ? Promise.resolve(MB.fluxoVisao) : new Promise((ok) => { const s = document.createElement('script'); s.src = '/prumo/fluxo-visao.js'; s.onload = () => ok(MB.fluxoVisao); s.onerror = () => ok(null); document.body.appendChild(s); });
  const carregarPrevisto = () => Promise.resolve(MB.previsto || null); // previsto.js vem no index.html; sem ele a tela segue sem a parte de previstos
  const carregarScript = (chave, src) => MB[chave] ? Promise.resolve(MB[chave]) : new Promise((ok) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(MB[chave]); s.onerror = () => ok(null); setTimeout(() => ok(MB[chave] || null), 4000); document.body.appendChild(s); });
  const LACUNA = { contas: 'suas contas bancárias', dividas: 'suas dívidas', lancamentos: 'lançamentos (envie uma fatura ou extrato)' };
  const fmtAte = (d) => { if (!d) return ''; const p = String(d).split('-'); return p.length === 3 ? 'até ' + p[2] + '/' + p[1] : 'até ' + d; };

  MB.telas.inicio = async (el) => {
    const { brl, esc, barra, aba } = await carregarUi();
    aba('inicio');
    const [r, sf] = await Promise.all([MB.api('inicio_resumo'), MB.api('saude_financeira')]);
    const notaSaude = sf.completa || (sf.nota !== null && sf.nota !== undefined) ? sf.nota : (sf.nota_parcial === undefined ? null : sf.nota_parcial);
    // Opcionais (score, gráfico, cotação ao vivo) rodam em paralelo e NÃO seguram a tela: o principal aparece primeiro.
    const SIL = { silencioso: true };
    const pScore = carregarScript('score', '/prumo/score.js')
      .then(async (m) => (m ? { m, html: m.cartao(await MB.api('score_listar', {}, SIL)) } : null)).catch(() => null);
    const pGraf = (async () => {
      const graficos = await carregarGraficos();
      const [hist, cot] = await Promise.all([MB.api('historico_listar', {}, SIL).catch(() => null), MB.api('cotacoes_vivas', {}, SIL).catch(() => null)]);
      let patrimSvg = '';
      if (hist && Array.isArray(hist.meses) && hist.meses.length) patrimSvg = graficos.linha(hist.meses.map((m) => ({ rotulo: String(m.mes || ''), valor: Number(m.total || 0) })));
      let ativos = [];
      if (cot && Array.isArray(cot.itens)) for (const c of cot.itens) { const g = graficos.ganhoDoDia(c); if (g != null) ativos.push({ rotulo: c.ticker || c.nome || c.rotulo || 'Ativo', valor: g }); }
      ativos = ativos.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)).slice(0, 8);
      return { patrimSvg, hojeHtml: graficos.barras(ativos), hojeTotal: ativos.reduce((t, a) => t + a.valor, 0) };
    })().catch(() => null);
    // Espera no máximo 1,2 s: se chegou, já entra junto; se não, entra quando chegar.
    const rapido = (p) => Promise.race([p, new Promise((ok) => setTimeout(() => ok(undefined), 1200))]);
    const [sc, gr] = await Promise.all([rapido(pScore), rapido(pGraf)]);
    const corpoHoje = (g) => `${g.hojeHtml}<div class="n ${g.hojeTotal >= 0 ? 'verde' : 'verm'}" style="margin-top:6px">${brl(g.hojeTotal)}</div>`;
    const esperando = '<p class="fraco">Carregando…</p>';
    const nome = (MB.usuario && MB.usuario() && MB.usuario().displayName || '').split(' ')[0];
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    let insight = 'Envie seu primeiro documento para eu entender seus gastos.';
    if (r.qtd_lancamentos > 0) {
      if (r.variacao_despesas_pct === null) insight = `Neste mês você gastou ${brl(r.despesas)}. Ainda não há mês anterior para comparar.`;
      else if (r.variacao_despesas_pct <= 0) insight = `Seus gastos estão ${Math.abs(r.variacao_despesas_pct).toLocaleString('pt-BR')}% menores que no mês passado.`;
      else insight = `Seus gastos estão ${r.variacao_despesas_pct.toLocaleString('pt-BR')}% maiores que no mês passado.`;
    }
    const pv = await carregarPrevisto();
    let fluxoHtml = '';
    try { const fv = r.fluxo_inicio && await carregarFluxo(); if (fv) fluxoHtml = fv.cartaoInicio(r.fluxo_inicio); } catch (e) { /* sem o cartão, o resto segue */ }
    const cats = Object.entries(r.por_categoria || {}).sort((a, b) => b[1] - a[1]);
    el.innerHTML = `
      <p class="fraco" style="margin:0 0 10px">${saudacao}${nome ? ', ' + esc(nome) : ''}</p>
      ${r.alertas_limite.length ? r.alertas_limite.map((a) => `<div class="aviso-c">${a.status === 'estourado' ? '🔴' : '🟠'} <b>${esc(NOME_CAT[a.categoria] || a.categoria)}</b>: ${brl(a.gasto)} de ${brl(a.limite)} (${String(a.pct).replace('.', ',')}%)${a.status === 'estourado' ? ' — passou do limite' : ' — perto do limite'}.</div>`).join('') : ''}
      <details class="card kf-dobra" id="kf-saude"><summary><span class="fraco">Saúde financeira${sf.completa ? '' : ' (parcial)'}</span><span><b class="kf-num">${notaSaude === null ? '—' : notaSaude}</b>${notaSaude === null ? '' : '<span class="fraco" style="font-size:12px">/100</span>'}</span></summary>
        <div class="kf-dobra-corpo"><div class="fraco">${esc(sf.resumo || sf.aviso)}</div>
        ${sf.indicadores.map((x) => `<div style="margin:6px 0"><div class="item" style="padding:0;border:0"><span>${esc(x.nome)}</span><span class="fraco">${esc(x.texto)}</span></div>${barra(x.nota, x.nota < 40 ? '#ef4444' : x.nota < 70 ? '#f59e0b' : '')}</div>`).join('')}
        ${sf.completa ? '' : `<div class="aviso-c" style="margin:6px 0 0">👉 ${esc(sf.proximo_passo || 'Cadastre suas contas na aba Contas para começar.')}</div>`}
        <div class="fraco" style="margin-top:6px">${sf.completa ? esc(sf.aviso) + (sf.nota_mes_anterior !== null && sf.nota_mes_anterior !== undefined ? ' Mês anterior: ' + sf.nota_mes_anterior + '.' : '') : ''}</div></div></details>
      <div id="kf-score">${sc ? sc.html : ''}</div>
      ${r.tres_numeros ? `
      <div class="card" id="kf-tres-numeros">
        <div class="linha kf-tres" style="margin:0">
          <div><div class="fraco">Quanto tenho</div><div class="n">${r.tres_numeros.tenho === null ? '—' : brl(r.tres_numeros.tenho)}</div></div>
          <div><div class="fraco">Comprometido</div><div class="n verm">${r.tres_numeros.comprometido === null ? '—' : brl(r.tres_numeros.comprometido)}</div></div>
          <div><div class="fraco">Posso gastar${r.tres_numeros.ate ? ' (' + fmtAte(r.tres_numeros.ate) + ')' : ''}</div><div class="n verde">${r.tres_numeros.posso_gastar === null ? '—' : brl(r.tres_numeros.posso_gastar)}</div></div>
        </div>
        ${r.tres_numeros.tenho === null ? '<div class="fraco" style="margin-top:8px">Cadastre suas contas na aba Contas. <button class="btn sec mini" id="kf-contas-btn" type="button" style="margin-top:4px">Ir para Contas</button></div>' : ''}
      </div>` : ''}
      <div class="card kf-hero"><div class="fraco">Saldo disponível</div><div class="grande">${r.saldo_disponivel === null ? '—' : brl(r.saldo_disponivel)}</div>
        <div class="fraco" style="margin-bottom:10px">${r.saldo_disponivel === null ? 'Cadastre suas contas na aba Contas.' : 'Dinheiro em conta, sem limite de cartão.'}</div>
        <div class="fraco">Patrimônio líquido</div><div class="n" style="font-size:22px">${brl(r.patrimonio.liquido)}</div>
        <div class="fraco">Investimentos ${brl(r.investimentos)}${r.milhas_estimado ? ' · Milhas ≈ ' + brl(r.milhas_estimado) : ''}</div></div>
      <div class="linha kf-tres">
        <div class="card"><div class="fraco">Receita</div><div class="n verde">${brl(r.receitas)}</div></div>
        <div class="card"><div class="fraco">Gasto</div><div class="n verm">${brl(r.despesas)}</div></div>
        <div class="card"><div class="fraco">Economia</div><div class="n ${r.economia < 0 ? 'verm' : 'verde'}">${brl(r.economia)}</div></div>
      </div>
      <div class="linha kf-tres" id="kf-previsto">
        <div class="card"><div class="fraco">A receber no mês</div><div class="n verde">${brl(r.a_receber || 0)}</div></div>
        <div class="card"><div class="fraco">A pagar no mês</div><div class="n verm">${brl(r.a_pagar || 0)}</div></div>
      </div>
      ${pv ? pv.cartao(r.previstos, 'Previsto no mês (ainda não aconteceu)') : ''}
      <div class="card kf-insight"><div class="fraco">💡 Resumo do mês</div><div>${esc(insight)}</div></div>
      <div class="card" id="kf-graf-patrimonio" style="margin-top:12px"><div class="fraco">Seu patrimônio</div><div id="kf-patrim-corpo">${gr ? gr.patrimSvg : gr === null ? '' : esperando}</div></div>
      <div class="card" id="kf-graf-hoje" style="margin-top:12px"><div class="fraco">Ganhos e perdas de hoje</div><div id="kf-hoje-corpo">${gr ? corpoHoje(gr) : gr === null ? '' : esperando}</div></div>
      <button class="btn" id="kf-doc" type="button">📄 Enviar documento</button>
      <div class="linha" style="margin-top:8px"><button class="btn sec" id="kf-ia" type="button">🤖 Perguntar à IA</button><button class="btn sec" id="kf-posso" type="button">🛒 Posso comprar?</button></div>
      ${r.dividas.registradas ? `<div class="card" style="margin-top:12px"><div class="item" style="padding:0;border:0"><span class="fraco">Dívidas</span><span class="n verm">${brl(r.dividas.total)}</span></div><div class="fraco">Parcelas ${brl(r.dividas.parcelas_mes)} por mês${r.dividas.comprometimento_pct !== null ? ' · ' + String(r.dividas.comprometimento_pct).replace('.', ',') + '% da renda' : ''}</div><button class="btn sec mini" id="kf-div" type="button" style="margin-top:8px">Ver plano de quitação</button></div>` : r.dividas.sem ? '' : `<div class="card" style="margin-top:12px"><div class="fraco">Ainda não sei se você tem dívidas. Cadastre ou diga que não tem, e a nota de saúde fica mais completa.</div><button class="btn sec mini" id="kf-div" type="button" style="margin-top:8px">Ir para Dívidas</button></div>`}
      ${fluxoHtml}
      ${r.vencimentos.length ? `<div class="card" style="margin-top:12px"><div class="fraco">Próximos vencimentos de fatura</div>${r.vencimentos.map((v) => `<div class="item"><span class="n">💳 ${esc(v.cartao)}</span><span>${v.em_dias === 0 ? 'hoje' : 'em ' + v.em_dias + ' dia(s)'} · dia ${v.dia}</span></div>`).join('')}</div>` : ''}
      ${cats.length ? `<div class="card" style="margin-top:12px"><div class="fraco">Gastos por categoria</div>${cats.map(([k, v]) => `<div style="margin:6px 0"><div class="item" style="padding:0;border:0"><span>${esc(NOME_CAT[k] || k)}</span><span>${brl(v)}</span></div>${barra(r.despesas ? (v / r.despesas) * 100 : 0)}</div>`).join('')}</div>` : ''}
      ${r.lacunas.length ? `<div class="card fraco" style="margin-top:12px">Para calcular saldo disponível e saúde financeira ainda faltam: ${r.lacunas.map((l) => esc(LACUNA[l] || l)).join(', ')}. Nada é estimado no lugar.</div>` : ''}`;
    if (pv) pv.ligar(el);
    const ligarScore = async (x) => { if (!x) return; try { x.m.ligar(el, { api: MB.api, pdf: await carregarScript('pdf', '/prumo/pdf.js'), reduzir: MB.ui.reduzir, formulario: MB.ui.formulario, ok: MB.ui.ok }); } catch (e) { /* sem leitura de print, o resto segue */ } };
    if (sc) await ligarScore(sc);
    else if (sc === undefined) pScore.then((x) => { const slot = el.querySelector('#kf-score'); if (x && slot) { slot.innerHTML = x.html; ligarScore(x); } });
    if (gr === undefined) pGraf.then((g) => {
      const a = el.querySelector('#kf-patrim-corpo'); const b = el.querySelector('#kf-hoje-corpo');
      if (a) a.innerHTML = g ? g.patrimSvg : ''; if (b) b.innerHTML = g ? corpoHoje(g) : '<p class="fraco">Cotações indisponíveis agora.</p>';
    });
    el.querySelector('#kf-doc').onclick = () => MB.abrirAba('documentos');
    const bc = el.querySelector('#kf-contas-btn'); if (bc) bc.onclick = () => MB.abrirAba('contas');
    const bd = el.querySelector('#kf-div'); if (bd) bd.onclick = () => MB.abrirAba('dividas');
    const bf = el.querySelector('#kf-fluxo-ver'); if (bf) bf.onclick = () => MB.abrirAba('fluxo');
    el.querySelector('#kf-ia').onclick = () => MB.abrirAba('assistente');
    el.querySelector('#kf-posso').onclick = () => MB.abrirAba('assistente');
  };
})();
