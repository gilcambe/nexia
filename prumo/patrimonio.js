'use strict';
// Redesign: aba Patrimônio e Futuro. Quanto você tem no total, reserva, dívidas e aposentadoria; score de crédito.
(function () {
  const MB = window.MB;
  const carregar = () => MB.hub ? Promise.resolve(MB.hub) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/hubs.js'; s.onload = () => ok(MB.hub); s.onerror = falha; document.body.appendChild(s); });
  const script = (chave, src) => MB[chave] ? Promise.resolve(MB[chave]) : new Promise((ok) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(MB[chave]); s.onerror = () => ok(null); document.body.appendChild(s); });
  MB.telas.patrimonio = async (el) => {
    const H = await carregar(); const U = await H.ui(); U.aba('patrimonio');
    const SIL = { silencioso: true };
    const [r, pl, sc] = await Promise.all([MB.api('inicio_resumo'), MB.api('planejar_mes', {}, SIL).catch(() => null), MB.api('score_listar', {}, SIL).catch(() => null)]);
    const pat = r.patrimonio || {}; const rv = pl && pl.reserva; const dv = r.dividas || {};
    const total = typeof pat.total === 'number' ? pat.total : (typeof pat.liquido === 'number' ? pat.liquido : null);
    el.innerHTML = `<div class="kh">
      <div class="kh-larga"><h2>Patrimônio e futuro</h2><div class="sub">Tudo que é seu, menos o que deve</div></div>
      <div class="kh-kpis kh-larga">
        <div class="card"><div class="r">Patrimônio</div><div class="v">${H.val(total, '')}</div></div>
        <div class="card"><div class="r">Investimentos</div><div class="v">${H.val(r.investimentos, 'kh-in')}</div></div>
        <div class="card"><div class="r">Dívidas</div><div class="v">${H.val(dv.total, 'kh-out')}</div></div>
        <div class="card"><div class="r">Milhas (estimado)</div><div class="v">${H.val(r.milhas_estimado, '')}</div></div>
      </div>
      <section class="card"><b>🛟 Reserva de emergência</b>${rv && rv.alvo > 0 ? `<div class="sub" style="margin-top:4px">Meta: ${rv.meses} meses de gastos (${H.brl(rv.alvo)}). Guardado: ${H.brl(rv.guardado)}.</div><div class="barra" style="height:8px;margin-top:8px"><i style="width:${Math.min(100, rv.pct)}%;background:#2F6BFF"></i></div><div class="sub" style="margin-top:6px">${rv.falta > 0 ? `Falta ${H.brl(rv.falta)}.` : '✅ Reserva completa.'}</div>`
        : '<p class="sub" style="margin:6px 0 0">Para calcular, preciso dos seus gastos de 3 meses e de uma conta poupança ou reserva.</p>'}</section>
      <div id="kh-score"></div>
      ${H.lista([
        ['investimentos', '📈', 'Investimentos', 'Quanto tem e quanto rende'],
        ['carteira', '👛', 'Carteira', 'Ações, FIIs, renda fixa, cripto'],
        ['dividas', '📉', 'Dívidas', 'Parcelas, juros e quanto falta'],
        ['aposentadoria', '🧓', 'Aposentadoria e FGTS', 'INSS (CNIS), tempo e média'],
        ['objetivos', '🎯', 'Objetivos', 'Carro, casa, viagem'],
        ['metas', '🏁', 'Metas do mês', 'Quanto guardar'],
        ['mercado', '📰', 'Mercado', 'Cotações do dia'],
        ['robos', '🤖', 'Robôs', 'Avisos automáticos de investimentos'],
      ])}
    </div>`;
    H.ligar(el);
    // Score de crédito (Serasa, SPC, Boa Vista): o cartão de sempre, com ler print.
    const m = await script('score', '/prumo/score.js');
    const slot = el.querySelector('#kh-score');
    if (m && slot && sc) { slot.innerHTML = m.cartao(sc); try { m.ligar(el, { api: MB.api, pdf: await script('pdf', '/prumo/pdf.js'), reduzir: U.reduzir, formulario: U.formulario, ok: U.ok }); } catch { /* sem leitura de print, o resto segue */ } }
  };
})();
