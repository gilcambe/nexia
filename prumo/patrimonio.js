'use strict';
// Redesign: aba Patrimônio e Futuro (plano, tela 6). Total (tudo menos dívidas) e a composição, reserva de emergência,
// independência financeira, INSS e dívidas por juros; score de crédito. Não é recomendação de investimento.
(function () {
  const MB = window.MB;
  const carregar = () => MB.hub ? Promise.resolve(MB.hub) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/hubs.js'; s.onload = () => ok(MB.hub); s.onerror = falha; document.body.appendChild(s); });
  const script = (chave, src) => MB[chave] ? Promise.resolve(MB[chave]) : new Promise((ok) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(MB[chave]); s.onerror = () => ok(null); document.body.appendChild(s); });
  const ABA = { conta: 'contas', renda_fixa: 'investimentos', acoes_fiis: 'carteira', previdencia: 'investimentos', cripto: 'carteira', fgts: 'aposentadoria', outro: 'investimentos' };
  const barra = (pct, cor) => `<div class="barra" style="height:8px;margin-top:6px"><i style="width:${Math.max(0, Math.min(100, pct))}%;background:${cor || '#2F6BFF'}"></i></div>`;
  MB.telas.patrimonio = async (el) => {
    const H = await carregar(); const U = await H.ui(); U.aba('patrimonio');
    const SIL = { silencioso: true };
    const [r, sc] = await Promise.all([MB.api('patrimonio_resumo'), MB.api('score_listar', {}, SIL).catch(() => null)]);
    const rv = r.reserva; const ind = r.independencia; const inss = r.inss;
    el.innerHTML = `<div class="kh">
      <section class="card kh-larga" style="background:linear-gradient(140deg,#17255A 0%,#121B33 65%)"><div class="sub">Patrimônio total</div>
        <div style="font-size:32px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums">${r.bruto > 0 || r.dividas_total > 0 ? H.brl(r.total) : '<span class="kh-zero">—</span>'}</div>
        ${r.variacao_investimentos != null ? `<div class="sub ${r.variacao_investimentos >= 0 ? 'kh-in' : 'kh-out'}">${r.variacao_investimentos >= 0 ? '+' : '−'} ${H.brl(Math.abs(r.variacao_investimentos))} nos investimentos este mês</div>` : ''}
        ${r.dividas_total > 0 ? `<div class="sub">Já descontadas ${H.brl(r.dividas_total)} de dívidas.</div>` : ''}
        ${r.composicao.length ? r.composicao.map((x) => `<button class="kh-it" type="button" data-ir="${ABA[x.id] || 'investimentos'}" style="min-height:48px"><div style="flex:1"><b style="font-size:14px">${H.esc(x.nome)}</b><span>${x.pct}%</span></div><span style="font-weight:600;color:var(--texto);font-size:14px;margin-left:auto">${H.brl(x.valor)}</span></button>`).join('')
          : '<p class="sub" style="margin:8px 0 0">Cadastre suas contas e investimentos (print da corretora, extrato ou digitando).</p>'}
      </section>
      <section class="card"><b>🛟 Reserva de emergência</b>${rv && rv.alvo > 0 ? `<div style="display:flex;justify-content:space-between;margin-top:6px"><span>${rv.meses_cobertos == null ? '—' : String(rv.meses_cobertos).replace('.', ',')} de ${rv.meses_meta} meses</span><span class="sub">${H.brl(rv.guardado)} de ${H.brl(rv.alvo)}</span></div>${barra(rv.pct)}
          <div class="sub" style="margin-top:6px">${rv.falta > 0 ? `Faltam ${H.brl(rv.falta)}.${rv.aporte && rv.meses_para_completar ? ` Guardando ${H.brl(rv.aporte)}/mês, completa em ${rv.meses_para_completar} meses.` : ''}` : '✅ Reserva completa.'}</div>
          <button class="btn sec mini" type="button" id="kp-res" style="margin-top:8px">Ajustar meta</button>`
        : '<p class="sub" style="margin:6px 0 0">Para calcular preciso dos seus gastos de 3 meses e de uma conta poupança ou reserva.</p>'}</section>
      <section class="card"><b>🏝️ Independência financeira</b>${ind ? `<div style="display:flex;justify-content:space-between;margin-top:6px"><span>${String(ind.pct).replace('.', ',')}%</span><span class="sub">${H.brl(ind.investido)} de ${H.brl(ind.alvo)}</span></div>${barra(ind.pct, '#2ECC71')}<div class="sub" style="margin-top:6px">Conta simples: investido ÷ (gasto do mês × 12 × 25). Uma referência, não uma garantia.</div>`
        : '<p class="sub" style="margin:6px 0 0">Aparece quando eu souber quanto você gasta por mês (3 meses de lançamentos).</p>'}</section>
      <section class="card"><b>🧓 INSS e aposentadoria</b>${inss ? `<div style="margin-top:6px">${inss.anos} anos e ${inss.meses} meses de contribuição (CNIS)</div><div class="sub">Confira sempre no Meu INSS: a leitura pode errar.</div>`
        : '<p class="sub" style="margin:6px 0 0">Mande o PDF do extrato CNIS (Meu INSS) para eu ler o tempo de contribuição.</p>'}<button class="btn sec" type="button" data-ir="aposentadoria">Ver regras e simulação</button></section>
      <section class="card"><b>📉 Dívidas</b>${r.dividas.length ? r.dividas.map((d) => `<div class="kh-ag"><span>${H.esc(d.credor || 'Dívida')}<br><span class="sub">${String(d.juros_mes).replace('.', ',')}% ao mês · juros ≈ ${H.brl(d.custo_mes)}/mês</span></span><b class="kh-out">${H.brl(d.saldo)}</b></div>`).join('') + '<div class="sub" style="margin-top:6px">Em ordem dos juros mais caros: quitar as de cima primeiro economiza mais.</div>'
        : '<p class="sub" style="margin:6px 0 0">Nenhuma dívida cadastrada.</p>'}<button class="btn sec" type="button" data-ir="dividas">Ver dívidas</button></section>
      <div id="kh-score"></div>
      ${H.lista([
        ['investimentos', '📈', 'Investimentos', 'Quanto tem e quanto rende'],
        ['carteira', '👛', 'Carteira', 'Ações, FIIs, renda fixa, cripto'],
        ['objetivos', '🎯', 'Objetivos', 'Carro, casa, viagem'],
        ['metas', '🏁', 'Metas do mês', 'Quanto guardar'],
        ['mercado', '📰', 'Mercado', 'Cotações do dia'],
        ['robos', '🤖', 'Robôs', 'Avisos automáticos de investimentos'],
      ])}
      <p class="sub kh-larga" style="text-align:center">${H.esc(r.aviso)}</p>
    </div>`;
    H.ligar(el);
    const kr = el.querySelector('#kp-res');
    if (kr) kr.onclick = () => U.formulario('Reserva de emergência', [{ nome: 'meses', rotulo: 'Quantos meses de gastos guardar', tipo: 'number', valor: rv.meses_meta }, { nome: 'aporte', rotulo: 'Quanto guardar por mês (R$)', tipo: 'number', valor: rv.aporte || '' }],
      (d) => MB.api('reserva_salvar', { meses: Number(d.meses) || 6, aporte: d.aporte === '' ? null : Number(d.aporte) }));
    // Score de crédito (Serasa, SPC, Boa Vista): o cartão de sempre, com ler print.
    const m = await script('score', '/prumo/score.js');
    const slot = el.querySelector('#kh-score');
    if (m && slot && sc) { slot.innerHTML = m.cartao(sc); try { m.ligar(el, { api: MB.api, pdf: await script('pdf', '/prumo/pdf.js'), reduzir: U.reduzir, formulario: U.formulario, ok: U.ok }); } catch { /* sem leitura de print, o resto segue */ } }
  };
})();
